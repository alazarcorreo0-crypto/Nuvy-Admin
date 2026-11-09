/**
 * Formatos de números y moneda para toda la aplicación.
 */

const moneyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 2
});

const oneDecimalFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 1
});

const fourDecimalFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4
});

export const PURCHASE_UNIT_LABELS = {
  kg: 'kg',
  piece: 'pieza',
  liter: 'L',
  bag: 'bolsa'
};

export const PURCHASE_UNIT_PLURALS = {
  kg: 'kg',
  piece: 'piezas',
  liter: 'L',
  bag: 'bolsas'
};

export function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? moneyFormatter.format(number) : '—';
}

export function number(value, maximumFractionDigits = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  if (maximumFractionDigits === 1) return oneDecimalFormatter.format(parsed);
  if (maximumFractionDigits === 4) return fourDecimalFormatter.format(parsed);
  return new Intl.NumberFormat('es-MX', {
    maximumFractionDigits
  }).format(parsed);
}

export function cost(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return fourDecimalFormatter.format(parsed);
}

export function baseQuantity(value, baseUnit = 'g') {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${number(parsed, parsed % 1 === 0 ? 0 : 2)} ${baseUnit}`;
}

export function purchaseQuantity(value, unit) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  const label = Math.abs(parsed) === 1
    ? (PURCHASE_UNIT_LABELS[unit] ?? unit)
    : (PURCHASE_UNIT_PLURALS[unit] ?? unit);
  return `${number(parsed, 2)} ${label}`;
}

export function parseNumberInput(value) {
  if (typeof value === 'number') return value;
  const normalized = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.');
  if (!normalized) return NaN;
  return Number(normalized);
}

export function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

export function ceilTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.ceil((Number(value) - Number.EPSILON) * factor) / factor;
}

export function sum(values) {
  return values.reduce((total, value) => total + (Number(value) || 0), 0);
}

export function todayLabel(dateString) {
  return dateString ?? '';
}
