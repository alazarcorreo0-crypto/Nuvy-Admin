import { isValidDateString } from './dates.js';
import { parseNumberInput } from './format.js';
import {
  allowedPurchaseUnits,
  countUnitOptions,
  defaultContentForUnit,
  hasSupplyType,
  isContentFixed,
  normalizeBaseUnit,
  purchaseUnitsForBaseUnit
} from './units.js';

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

function text(value, label, maxLength = 90) {
  const clean = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) throw new ValidationError(`Escribe ${label}.`);
  if (clean.length > maxLength) {
    throw new ValidationError(`${label} no puede tener más de ${maxLength} caracteres.`);
  }
  return clean;
}

function decimal(value, label, { min = 0, max = 1_000_000_000 } = {}) {
  const parsed = parseNumberInput(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`Escribe un número válido en ${label}.`);
  }
  if (parsed < min) {
    throw new ValidationError(`${label} debe ser mayor o igual a ${min}.`);
  }
  if (parsed > max) {
    throw new ValidationError(`${label} es demasiado grande.`);
  }
  return parsed;
}

function date(value) {
  if (!isValidDateString(value)) {
    throw new ValidationError('Elige una fecha válida.');
  }
  return value;
}

export function normalizeFamilyCode(value) {
  const clean = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

  if (clean.length < 6) {
    throw new ValidationError('El código de familia debe tener al menos 6 caracteres.');
  }
  if (clean.length > 64) {
    throw new ValidationError('El código de familia es demasiado largo.');
  }
  if (!/^[A-Z0-9-]+$/.test(clean)) {
    throw new ValidationError('El código solo puede tener letras, números y guiones.');
  }
  return clean;
}

export function validateSupply(input) {
  const name = text(input.name, 'el nombre del insumo');
  const type = String(input.type ?? '');
  if (!hasSupplyType(type)) {
    throw new ValidationError('Elige el tipo de insumo.', 'type');
  }

  const purchaseUnit = String(input.purchaseUnit ?? '');
  if (!allowedPurchaseUnits(type).includes(purchaseUnit)) {
    throw new ValidationError('La unidad de compra no corresponde al tipo de insumo.', 'purchaseUnit');
  }

  const contentPerUnit = isContentFixed(purchaseUnit, type)
    ? defaultContentForUnit(purchaseUnit, type)
    : decimal(input.contentPerUnit, 'el contenido por unidad', { min: 0.0001 });

  const pricePerUnit = decimal(input.pricePerUnit, 'el precio de compra', { min: 0 });

  return {
    name,
    type,
    purchaseUnit,
    contentPerUnit,
    pricePerUnit
  };
}

export function validateSupplyType(input) {
  const name = text(input.name, 'el nombre del tipo de insumo', 40);
  const baseUnit = normalizeBaseUnit(input.baseUnit);
  if (!['g', 'ml', 'piece'].includes(String(input.baseUnit ?? ''))) {
    throw new ValidationError('Elige cómo se mide este tipo de insumo.', 'baseUnit');
  }

  const purchaseUnits = purchaseUnitsForBaseUnit(baseUnit);
  const requestedUnit = String(input.defaultUnit ?? '');
  const defaultUnit = purchaseUnits.includes(requestedUnit)
    ? requestedUnit
    : purchaseUnits[0];

  return {
    name,
    baseUnit,
    purchaseUnits,
    defaultUnit
  };
}

export function validatePurchase(input, supply) {
  if (!supply) {
    throw new ValidationError('Elige un insumo.', 'supplyId');
  }
  return {
    date: date(input.date),
    supplyId: supply.id,
    quantity: decimal(input.quantity, 'la cantidad comprada', { min: 0.0001 }),
    totalPaid: decimal(input.totalPaid, 'el total pagado', { min: 0 })
  };
}

export function validateSale(input) {
  const sale = {
    date: date(input.date),
    amount: decimal(input.amount, 'el monto vendido', { min: 0.01 })
  };

  // Tickets (clientes) es opcional: entero mayor o igual a 1.
  const rawTickets = input.tickets;
  if (rawTickets !== undefined && rawTickets !== null && String(rawTickets).trim() !== '') {
    const parsed = parseNumberInput(rawTickets);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      throw new ValidationError(
        'Los clientes del día deben ser un número entero (1 o más).',
        'tickets'
      );
    }
    sale.tickets = parsed;
  }

  return sale;
}

export const EXPENSE_CATEGORIES = ['fixed', 'variable', 'owner'];

/**
 * Periodos de pago que puede tener un gasto recurrente.
 * "once" (el comportamiento de siempre) es el que usan los gastos viejos.
 */
export const EXPENSE_PERIODS = ['once', 'weekly', 'fortnightly', 'monthly'];

export const EXPENSE_PERIOD_LABELS = {
  once: 'Una sola vez',
  weekly: 'Cada semana',
  fortnightly: 'Cada quincena',
  monthly: 'Cada mes'
};

export function validateExpense(input) {
  const category = EXPENSE_CATEGORIES.includes(input.category)
    ? input.category
    : 'variable';
  const period = EXPENSE_PERIODS.includes(input.period) ? input.period : 'once';
  return {
    date: date(input.date),
    concept: text(input.concept, 'el concepto del gasto'),
    category,
    amount: decimal(input.amount, 'el monto del gasto', { min: 0.01 }),
    period
  };
}

/**
 * Motivos de merma que se pueden registrar en Inventario.
 */
export const WASTE_REASONS = ['se derritió', 'se cayó', 'muestra', 'otro'];

/**
 * Merma de insumo: lo que se perdió y por qué. La cantidad se captura en
 * la unidad que elija la persona (g, kg, bolsas…) y se convierte a la
 * unidad base antes de guardarla.
 */
export function validateWaste(input, supply) {
  if (!supply) {
    throw new ValidationError('Elige un insumo.', 'supplyId');
  }

  const unit = String(input.unit ?? '');
  const options = countUnitOptions(supply);
  if (!options.some((option) => option.value === unit)) {
    throw new ValidationError('Elige una unidad válida para este insumo.', 'unit');
  }

  const reason = WASTE_REASONS.includes(input.reason) ? input.reason : 'otro';

  return {
    date: date(input.date),
    supplyId: supply.id,
    quantity: decimal(input.quantity, 'la cantidad de merma', { min: 0.0001 }),
    unit,
    reason
  };
}

/**
 * Cierre de caja: el efectivo que quedó contado al terminar el día.
 * `cardSales` es opcional y sirve para restar las ventas con tarjeta del
 * efectivo esperado.
 */
export function validateCashClose(input) {
  const close = {
    date: date(input.date),
    countedCash: decimal(input.countedCash, 'el efectivo contado', { min: 0 })
  };

  const rawCard = input.cardSales;
  if (rawCard !== undefined && rawCard !== null && String(rawCard).trim() !== '') {
    close.cardSales = decimal(rawCard, 'las ventas con tarjeta', { min: 0 });
  }

  const rawNote = String(input.note ?? '').trim();
  if (rawNote) {
    if (rawNote.length > 140) {
      throw new ValidationError('La nota no puede tener más de 140 caracteres.');
    }
    close.note = rawNote;
  }

  return close;
}

function monthString(value, label) {
  const clean = String(value ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(clean)) {
    throw new ValidationError(`Elige ${label} válido.`, 'month');
  }
  const year = Number(clean.slice(0, 4));
  if (year < 2000 || year > 2100) {
    throw new ValidationError('El mes está fuera de rango.', 'month');
  }
  return clean;
}

/**
 * Meta del mes: cuánto quieres vender y hasta dónde puedes dejar los
 * gastos. Ambas son opcionales entre sí, pero al menos una debe tener
 * número.
 */
export function validateGoal(input) {
  const month = monthString(input.month, 'un mes');
  const salesGoal = decimal(input.salesGoal, 'la meta de ventas', {
    min: 0,
    max: 100_000_000
  });
  const expenseCap = decimal(input.expenseCap, 'el tope de gastos', {
    min: 0,
    max: 100_000_000
  });

  if (salesGoal <= 0 && expenseCap <= 0) {
    throw new ValidationError(
      'Escribe al menos una meta: cuánto quieres vender o hasta dónde pueden llegar los gastos.'
    );
  }

  return { month, salesGoal, expenseCap };
}

/**
 * Conceptos que casi siempre son gastos fijos. Se usan solo para sugerir
 * la clasificación en el formulario; el usuario siempre puede cambiarla.
 */
export const FIXED_EXPENSE_CONCEPTS = [
  'renta',
  'luz',
  'agua',
  'internet',
  'telefono',
  'sueldo',
  'sueldos',
  'nomina',
  'salario',
  'salarios',
  'predial',
  'seguro'
];

export function suggestExpenseCategory(concept) {
  const clean = String(concept ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return FIXED_EXPENSE_CONCEPTS.some((word) => clean.includes(word))
    ? 'fixed'
    : 'variable';
}

export function validateCount(input, supply) {
  if (!supply) {
    throw new ValidationError('Elige un insumo.', 'supplyId');
  }

  const unit = String(input.unit ?? '');
  const options = countUnitOptions(supply);
  if (!options.some((option) => option.value === unit)) {
    throw new ValidationError('Elige una unidad válida para este insumo.', 'unit');
  }

  return {
    date: date(input.date),
    supplyId: supply.id,
    quantity: decimal(input.quantity, 'la cantidad contada', { min: 0 }),
    unit
  };
}

export function validateFirebaseConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ValidationError('La configuración de Firebase no es válida.');
  }

  const config = {
    apiKey: String(input.apiKey ?? '').trim(),
    authDomain: String(input.authDomain ?? '').trim(),
    projectId: String(input.projectId ?? '').trim(),
    storageBucket: String(input.storageBucket ?? '').trim(),
    messagingSenderId: String(input.messagingSenderId ?? '').trim(),
    appId: String(input.appId ?? '').trim()
  };

  if (!config.apiKey) throw new ValidationError('Falta apiKey en la configuración de Firebase.');
  if (!config.projectId) throw new ValidationError('Falta projectId en la configuración de Firebase.');
  if (!config.appId) throw new ValidationError('Falta appId en la configuración de Firebase.');

  return config;
}
