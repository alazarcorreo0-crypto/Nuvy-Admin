import { todayInTimeZone } from '../core/dates.js';
import {
  getEstimatedInventory,
  getLastCount
} from '../core/inventory.js';
import {
  countToBase,
  getBaseUnitLabel,
  listSupplyTypes,
  setCustomSupplyTypes,
  supplyTypeOrderIndex,
  SUPPLY_TYPES
} from '../core/units.js';
import {
  ValidationError,
  validateCashClose,
  validateCount,
  validateExpense,
  validateGoal,
  validatePurchase,
  validateSale,
  validateSupply,
  validateSupplyType,
  validateWaste
} from '../core/validation.js';
import { buildWeeklyCut } from '../core/weekly-cut.js';
import { buildMonthlyCut } from '../core/monthly-cut.js';
import { APP_CONFIG } from '../config.js';

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortByDateDesc(records) {
  return records.slice().sort((a, b) => {
    const dateCompare = String(b.date ?? '').localeCompare(String(a.date ?? ''));
    if (dateCompare !== 0) return dateCompare;
    return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
  });
}

function sortSupplies(records) {
  return records.slice().sort((a, b) => {
    const typeCompare =
      supplyTypeOrderIndex(a.type) - supplyTypeOrderIndex(b.type);
    if (typeCompare !== 0) return typeCompare;
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es');
  });
}

export class DataStore {
  constructor({ adapter, familyCode }) {
    this.adapter = adapter;
    this.familyCode = familyCode;
    this.records = [];
    this.listeners = new Set();
    this.unsubscribeAdapter = null;
    this.status = {
      mode: adapter.mode,
      loading: true,
      online: navigator.onLine,
      error: null,
      fromCache: false,
      pending: false,
      lastSync: null
    };
  }

  init() {
    return new Promise((resolve) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        this.status = {
          ...this.status,
          loading: false,
          error: this.records.length === 0
            ? 'La nube tardó demasiado en responder. Revisa la conexión e intenta de nuevo.'
            : this.status.error
        };
        this.emit();
        finish();
      }, 9000);

      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.status = { ...this.status, loading: false };
        this.emit();
        resolve();
      };

      try {
        this.unsubscribeAdapter = this.adapter.subscribe({
          onData: (records) => {
            this.records = Array.isArray(records) ? records : [];
            this.status.loading = false;
            this.emit();
            finish();
          },
          onStatus: (status) => {
            this.mergeStatus(status);
            this.emit();
            if (status?.error) finish();
          }
        });
      } catch (error) {
        this.status = {
          ...this.status,
          loading: false,
          error: error?.message ?? 'No se pudo iniciar el almacenamiento.'
        };
        this.emit();
        finish();
      }
    });
  }

  mergeStatus(status = {}) {
    const clean = Object.fromEntries(
      Object.entries(status).filter(([, value]) => value !== undefined)
    );
    this.status = {
      ...this.status,
      ...clean,
      mode: this.adapter.mode,
      loading: false
    };
  }

  setNetworkStatus(online) {
    this.status = { ...this.status, online: Boolean(online) };
    this.emit();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  getSnapshot() {
    setCustomSupplyTypes(this.getCustomSupplyTypes());
    return {
      familyCode: this.familyCode,
      status: { ...this.status },
      records: this.records,
      supplies: this.getSupplies(),
      supplyTypes: listSupplyTypes(),
      purchases: this.getPurchases(),
      sales: this.getSales(),
      expenses: this.getExpenses(),
      counts: this.getCounts(),
      wastes: this.getWastes(),
      cashCloses: this.getCashCloses(),
      goals: this.getGoals()
    };
  }

  getSupplies() {
    return sortSupplies(this.records.filter((record) => record.kind === 'supply'));
  }

  getCustomSupplyTypes() {
    return this.records
      .filter((record) => record.kind === 'supplyType')
      .sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'));
  }

  getPurchases() {
    return sortByDateDesc(
      this.records.filter((record) => record.kind === 'purchase')
    );
  }

  getSales() {
    return sortByDateDesc(this.records.filter((record) => record.kind === 'sale'));
  }

  getExpenses() {
    return sortByDateDesc(
      this.records.filter((record) => record.kind === 'expense')
    );
  }

  getCounts() {
    return sortByDateDesc(
      this.records.filter((record) => record.kind === 'count')
    );
  }

  getWastes() {
    return sortByDateDesc(
      this.records.filter((record) => record.kind === 'waste')
    );
  }

  getCashCloses() {
    return sortByDateDesc(
      this.records.filter((record) => record.kind === 'cashClose')
    );
  }

  getGoals() {
    return this.records
      .filter((record) => record.kind === 'goal')
      .sort((a, b) => String(b.month ?? '').localeCompare(String(a.month ?? '')));
  }

  getSupplyById(id) {
    return this.getSupplies().find((supply) => supply.id === id) ?? null;
  }

  async addRecord(kind, fields) {
    const timestamp = nowIso();
    const record = {
      id: newId(),
      kind,
      ...fields,
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 1
    };
    await this.adapter.put(record);
    return record;
  }

  async updateRecord(id, fields) {
    const existing = this.records.find((record) => record.id === id);
    if (!existing) throw new ValidationError('No se encontró el registro.');
    const updated = {
      ...existing,
      ...fields,
      id: existing.id,
      kind: existing.kind,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
      schemaVersion: 1
    };
    await this.adapter.put(updated);
    return updated;
  }

  async deleteRecord(id) {
    const existing = this.records.find((record) => record.id === id);
    if (!existing) return;
    await this.adapter.remove(id);
  }

  async addSupply(input) {
    const data = validateSupply(input);
    return this.addRecord('supply', data);
  }

  async updateSupply(id, input) {
    const data = validateSupply(input);
    return this.updateRecord(id, data);
  }

  async deleteSupply(id) {
    const usedInPurchases = this.getPurchases().some(
      (purchase) => purchase.supplyId === id
    );
    const usedInCounts = this.getCounts().some((count) => count.supplyId === id);
    if (usedInPurchases || usedInCounts) {
      throw new ValidationError(
        'No puedes borrar este insumo porque tiene compras o conteos registrados. Puedes cambiarle el precio o el nombre.'
      );
    }
    await this.deleteRecord(id);
  }

  async addSupplyType(input) {
    const data = validateSupplyType(input);
    this.ensureSupplyTypeNameAvailable(data.name);
    return this.addRecord('supplyType', data);
  }

  async updateSupplyType(id, input) {
    const existing = this.records.find(
      (record) => record.id === id && record.kind === 'supplyType'
    );
    if (!existing) throw new ValidationError('No se encontró el tipo de insumo.');

    const data = validateSupplyType(input);
    this.ensureSupplyTypeNameAvailable(data.name, id);

    if (data.baseUnit !== existing.baseUnit) {
      const used = this.getSupplies().some((supply) => supply.type === id);
      if (used) {
        throw new ValidationError(
          'No puedes cambiar cómo se mide este tipo porque ya tiene insumos registrados. Puedes cambiarle el nombre.'
        );
      }
    }

    return this.updateRecord(id, data);
  }

  async deleteSupplyType(id) {
    const used = this.getSupplies().some((supply) => supply.type === id);
    if (used) {
      throw new ValidationError(
        'No puedes borrar este tipo porque tiene insumos registrados. Primero cambia esos insumos a otro tipo.'
      );
    }
    await this.deleteRecord(id);
  }

  ensureSupplyTypeNameAvailable(name, exceptId = null) {
    const clean = String(name ?? '').trim().toLocaleLowerCase('es');
    const fixedLabels = Object.values(SUPPLY_TYPES).map((config) => config.label);
    const customLabels = this.getCustomSupplyTypes()
      .filter((record) => record.id !== exceptId)
      .map((record) => record.name);
    const duplicate = [...fixedLabels, ...customLabels].some(
      (label) => String(label ?? '').trim().toLocaleLowerCase('es') === clean
    );
    if (duplicate) {
      throw new ValidationError('Ya existe un tipo de insumo con ese nombre.', 'name');
    }
  }

  async addPurchase(input) {
    const supply = this.getSupplyById(input.supplyId);
    const data = validatePurchase(input, supply);
    return this.addRecord('purchase', {
      ...data,
      supplyName: supply.name,
      unit: supply.purchaseUnit,
      contentPerUnit: supply.contentPerUnit
    });
  }

  async updatePurchase(id, input) {
    const existing = this.records.find(
      (record) => record.id === id && record.kind === 'purchase'
    );
    if (!existing) throw new ValidationError('No se encontró la compra.');

    const supply = this.getSupplyById(input.supplyId);
    const data = validatePurchase(input, supply);
    return this.updateRecord(id, {
      ...data,
      supplyName: supply.name,
      unit: supply.purchaseUnit,
      contentPerUnit: supply.contentPerUnit
    });
  }

  async addSale(input) {
    const data = validateSale(input);
    return this.addRecord('sale', data);
  }

  async updateSale(id, input) {
    const existing = this.records.find(
      (record) => record.id === id && record.kind === 'sale'
    );
    if (!existing) throw new ValidationError('No se encontró la venta.');

    const data = validateSale(input);
    return this.updateRecord(id, data);
  }

  async addExpense(input) {
    const data = validateExpense(input);
    return this.addRecord('expense', data);
  }

  async updateExpense(id, input) {
    const existing = this.records.find(
      (record) => record.id === id && record.kind === 'expense'
    );
    if (!existing) throw new ValidationError('No se encontró el gasto.');

    const data = validateExpense(input);
    return this.updateRecord(id, data);
  }

  /**
   * Merma de insumo: se guarda en unidad base (g, ml o piezas) igual que
   * los conteos, con el motivo por el que se perdió.
   */
  async addWaste(input) {
    const supply = this.getSupplyById(input.supplyId);
    const data = validateWaste(input, supply);
    const base = countToBase(data.quantity, data.unit, supply);
    return this.addRecord('waste', {
      date: data.date,
      supplyId: supply.id,
      supplyName: supply.name,
      quantity: base,
      enteredQuantity: data.quantity,
      enteredUnit: data.unit,
      contentPerUnit: supply.contentPerUnit,
      baseUnit: getBaseUnitLabel(supply),
      reason: data.reason
    });
  }

  /**
   * Cierre de caja del día: el efectivo contado al terminar.
   */
  async addCashClose(input) {
    const data = validateCashClose(input);
    return this.addRecord('cashClose', data);
  }

  /**
   * Meta del mes. Solo puede haber una por mes: si ya existe, se actualiza.
   */
  async setGoal(input) {
    const data = validateGoal(input);
    const existing = this.getGoalFor(data.month);
    if (existing) {
      return this.updateRecord(existing.id, data);
    }
    return this.addRecord('goal', data);
  }

  getGoalFor(month) {
    return (
      this.records.find(
        (record) => record.kind === 'goal' && record.month === month
      ) ?? null
    );
  }

  /**
   * Devuelve un registro borrado a como estaba (para "Deshacer").
   * No crea uno nuevo: reusa el id y las fechas originales para que la
   * sincronización entre teléfonos lo vea como el mismo registro.
   */
  async restoreRecord(record) {
    if (!record || typeof record !== 'object' || !record.id || !record.kind) {
      throw new ValidationError('No hay nada que deshacer.');
    }
    await this.adapter.put({ ...record });
    return record;
  }

  async addCount(input) {
    const supply = this.getSupplyById(input.supplyId);
    const data = validateCount(input, supply);
    const base = countToBase(data.quantity, data.unit, supply);
    return this.addRecord('count', {
      date: data.date,
      supplyId: supply.id,
      supplyName: supply.name,
      quantity: base,
      enteredQuantity: data.quantity,
      enteredUnit: data.unit,
      contentPerUnit: supply.contentPerUnit,
      baseUnit: getBaseUnitLabel(supply)
    });
  }

  async migrate(records) {
    if (typeof this.adapter.migrate === 'function') {
      await this.adapter.migrate(records);
    }
  }

  getWeeklyCut(anchorDate) {
    return buildWeeklyCut({
      anchorDate,
      supplies: this.getSupplies(),
      purchases: this.getPurchases(),
      sales: this.getSales(),
      expenses: this.getExpenses(),
      counts: this.getCounts(),
      wastes: this.getWastes()
    });
  }

  getMonthlyCut(month) {
    return buildMonthlyCut({
      month,
      supplies: this.getSupplies(),
      purchases: this.getPurchases(),
      sales: this.getSales(),
      expenses: this.getExpenses(),
      counts: this.getCounts(),
      wastes: this.getWastes()
    });
  }

  getEstimatedInventoryFor(supply, asOfDate = todayInTimeZone(APP_CONFIG.businessTimeZone)) {
    return getEstimatedInventory(
      supply,
      this.getCounts(),
      this.getPurchases(),
      asOfDate
    );
  }

  getLastCountFor(supply, throughDate = '9999-12-31') {
    return getLastCount(this.getCounts(), supply.id, throughDate);
  }

  destroy() {
    this.unsubscribeAdapter?.();
    this.listeners.clear();
  }
}
