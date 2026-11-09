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
  return {
    date: date(input.date),
    amount: decimal(input.amount, 'el monto vendido', { min: 0.01 })
  };
}

export function validateExpense(input) {
  return {
    date: date(input.date),
    concept: text(input.concept, 'el concepto del gasto'),
    amount: decimal(input.amount, 'el monto del gasto', { min: 0.01 })
  };
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
