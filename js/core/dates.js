/**
 * Utilidades de fechas para Nuvy Admin.
 *
 * Las fechas del negocio se guardan como texto YYYY-MM-DD para que no cambien
 * de día por la zona horaria del teléfono. Los cálculos de semana usan UTC
 * sobre esas fechas, que son fechas "de calendario", no instantes.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && toDateString(date) === value;
}

export function parseDate(value) {
  if (!isValidDateString(value)) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return new Date(`${value}T12:00:00.000Z`);
}

export function toDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayInTimeZone(timeZone = 'America/Mexico_City') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(dateString, days) {
  const date = parseDate(dateString);
  date.setUTCDate(date.getUTCDate() + Number(days));
  return toDateString(date);
}

/**
 * Devuelve la semana de negocio (sábado a viernes) que contiene la fecha.
 * Si la fecha es sábado, la semana empieza ese mismo día.
 */
export function getWeekRange(dateString) {
  const date = parseDate(dateString);
  const dayOfWeek = date.getUTCDay(); // 0 domingo ... 6 sábado
  const daysSinceSaturday = (dayOfWeek + 1) % 7;
  const start = addDays(dateString, -daysSinceSaturday);
  const end = addDays(start, 6);
  return { start, end };
}

export function isDateInRange(dateString, start, end) {
  return Boolean(dateString) && dateString >= start && dateString <= end;
}

export function compareDateStrings(a, b) {
  return String(a).localeCompare(String(b));
}

export function formatDateLong(dateString) {
  if (!isValidDateString(dateString)) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parseDate(dateString));
}

export function formatDateShort(dateString) {
  if (!isValidDateString(dateString)) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parseDate(dateString));
}

export function formatDateCompact(dateString) {
  if (!isValidDateString(dateString)) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(parseDate(dateString));
}

export function formatWeekRange(start, end) {
  if (!isValidDateString(start) || !isValidDateString(end)) return '—';
  return `${formatDateCompact(start)} al ${formatDateShort(end)}`;
}

export function capitalizeFirst(value) {
  const text = String(value ?? '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function lastDate(dates) {
  return dates.filter(Boolean).sort().at(-1) ?? null;
}

export function dateIsBefore(a, b) {
  return Boolean(a) && Boolean(b) && a < b;
}

export function dateIsAfter(a, b) {
  return Boolean(a) && Boolean(b) && a > b;
}
