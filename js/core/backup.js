/**
 * Respaldo completo de Nuvy Admin.
 *
 * Un respaldo es un archivo JSON con TODO el historial de la familia:
 * ventas, gastos, compras, conteos, insumos y ajustes del catálogo.
 * Sirve para recuperar los datos si se pierde el teléfono o si alguien
 * borra la familia por error.
 *
 * Restaurar nunca borra: los registros se vuelven a guardar uno por uno
 * y si ya existían, se actualizan en lugar de duplicarse.
 */

import { ValidationError } from './validation.js';
import { formatDateShort, isValidDateString } from './dates.js';

export const BACKUP_SCHEMA = 'nuvy-backup';
export const BACKUP_VERSION = 1;

const KNOWN_KINDS = [
  'supply',
  'supplyType',
  'purchase',
  'sale',
  'expense',
  'count',
  'cashClose',
  'waste',
  'goal'
];

/**
 * Construye el archivo de respaldo a partir de los registros actuales.
 */
export function buildBackup(familyCode, records, exportedAt = new Date().toISOString()) {
  const cleanCode = String(familyCode ?? '').trim();
  if (!cleanCode) {
    throw new ValidationError('No se pudo crear el respaldo porque falta el código de familia.');
  }
  if (!Array.isArray(records)) {
    throw new ValidationError('No hay registros para respaldar.');
  }

  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt,
    familyCode: cleanCode,
    records: records.map((record) => ({ ...record }))
  };
}

/**
 * Convierte el respaldo a texto para guardarlo en un archivo.
 */
export function serializeBackup(backup) {
  return JSON.stringify(backup, null, 2);
}

/**
 * Lee y valida un respaldo que viene de un archivo o de texto pegado.
 * Lanza ValidationError con mensaje en español si algo no cuadra.
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(String(text ?? ''));
  } catch {
    throw new ValidationError('Ese texto no es un respaldo válido. Debe ser un archivo JSON descargado de la app.');
  }

  return validateBackup(data);
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('El respaldo no tiene el formato esperado.');
  }
  if (data.schema !== BACKUP_SCHEMA) {
    throw new ValidationError('Este archivo no es un respaldo de Nuvy Admin.');
  }
  if (data.version !== BACKUP_VERSION) {
    throw new ValidationError(`El respaldo es de una versión (${data.version}) que esta app no conoce. Actualiza la app antes de restaurarlo.`);
  }
  if (typeof data.familyCode !== 'string' || !data.familyCode.trim()) {
    throw new ValidationError('El respaldo no dice de qué familia son los datos.');
  }
  if (!Array.isArray(data.records)) {
    throw new ValidationError('El respaldo no trae la lista de registros.');
  }

  const records = data.records
    .filter((record) => record && typeof record === 'object' && record.id)
    .map((record) => ({ ...record }));

  return {
    schema: BACKUP_SCHEMA,
    version: BACKUP_VERSION,
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : null,
    familyCode: data.familyCode.trim(),
    records
  };
}

/**
 * Resumen para mostrar antes de restaurar: cuántos registros trae y de
 * qué fecha a qué fecha.
 */
export function summarizeBackup(backup) {
  const records = backup?.records ?? [];
  const dates = records
    .map((record) => record.date)
    .filter((date) => typeof date === 'string' && isValidDateString(date))
    .sort();

  return {
    familyCode: backup?.familyCode ?? '',
    count: records.length,
    firstDate: dates[0] ?? null,
    lastDate: dates.at(-1) ?? null,
    exportedAt: backup?.exportedAt ?? null,
    kinds: [...new Set(records.map((record) => record.kind).filter(Boolean))]
  };
}

/**
 * Texto amable para la vista previa de la restauración.
 */
export function backupSummaryText(summary) {
  if (summary.count === 0) {
    return 'El respaldo está vacío: no trae ningún registro.';
  }
  const range = summary.firstDate
    ? ` del ${formatDateShort(summary.firstDate)} al ${formatDateShort(summary.lastDate)}`
    : '';
  return `Vas a restaurar ${summary.count} registro${summary.count === 1 ? '' : 's'}${range} de la familia ${summary.familyCode}.`;
}

/**
 * El respaldo solo se puede restaurar sin aviso extra si es de la misma
 * familia. Si es de otra, hay que avisar explícitamente antes de subir nada.
 * La comparación ignora mayúsculas/minúsculas y espacios.
 */
export function isSameFamily(backup, familyCode) {
  const normalize = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return normalize(backup?.familyCode) === normalize(familyCode) && normalize(familyCode) !== '';
}
