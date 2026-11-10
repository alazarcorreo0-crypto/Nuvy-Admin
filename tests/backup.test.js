import test from 'node:test';
import assert from 'node:assert/strict';

import {
  backupSummaryText,
  buildBackup,
  isSameFamily,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  validateBackup
} from '../js/core/backup.js';

const RECORDS = [
  {
    id: 'supply-1',
    kind: 'supply',
    name: 'Base de nieve',
    type: 'base',
    purchaseUnit: 'bag',
    contentPerUnit: 5000,
    pricePerUnit: 200,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    schemaVersion: 1
  },
  {
    id: 'count-1',
    kind: 'count',
    date: '2026-08-01',
    supplyId: 'supply-1',
    quantity: 3000,
    createdAt: '2026-08-01T11:00:00.000Z',
    updatedAt: '2026-08-01T11:00:00.000Z',
    schemaVersion: 1
  },
  {
    id: 'sale-1',
    kind: 'sale',
    date: '2026-08-05',
    amount: 500,
    createdAt: '2026-08-05T21:00:00.000Z',
    updatedAt: '2026-08-05T21:00:00.000Z',
    schemaVersion: 1
  },
  {
    id: 'sale-2',
    kind: 'sale',
    date: '2026-09-12',
    amount: 750,
    tickets: 25,
    createdAt: '2026-09-12T21:00:00.000Z',
    updatedAt: '2026-09-12T21:00:00.000Z',
    schemaVersion: 1
  }
];

test('respaldo ida y vuelta: crear, serializar, leer y restaurar', () => {
  const backup = buildBackup('NUVY-TEST-01', RECORDS, '2026-11-09T12:00:00.000Z');

  assert.equal(backup.schema, 'nuvy-backup');
  assert.equal(backup.version, 1);
  assert.equal(backup.exportedAt, '2026-11-09T12:00:00.000Z');
  assert.equal(backup.familyCode, 'NUVY-TEST-01');
  assert.equal(backup.records.length, 4);

  const text = serializeBackup(backup);
  const restored = parseBackup(text);

  assert.equal(restored.familyCode, 'NUVY-TEST-01');
  assert.deepEqual(
    restored.records.map((record) => record.id).sort(),
    ['count-1', 'sale-1', 'sale-2', 'supply-1']
  );
  // El registro restaurado conserva sus campos intactos.
  assert.deepEqual(restored.records.find((record) => record.id === 'sale-2'), RECORDS[3]);
});

test('el respaldo no modifica los registros originales', () => {
  const original = JSON.parse(JSON.stringify(RECORDS));
  buildBackup('NUVY-TEST-01', RECORDS);
  assert.deepEqual(RECORDS, original);
});

test('la vista previa del respaldo dice cuántos registros y de qué fechas', () => {
  const summary = summarizeBackup(parseBackup(serializeBackup(buildBackup('NUVY-TEST-01', RECORDS))));
  assert.equal(summary.count, 4);
  assert.equal(summary.firstDate, '2026-08-01');
  assert.equal(summary.lastDate, '2026-09-12');
  assert.ok(backupSummaryText(summary).includes('4 registros'));
  assert.ok(backupSummaryText(summary).includes('NUVY-TEST-01'));
});

test('un respaldo sin fechas también se describe bien', () => {
  const summary = summarizeBackup(
    validateBackup({
      schema: 'nuvy-backup',
      version: 1,
      familyCode: 'NUVY-TEST-01',
      records: [{ id: 'x', kind: 'supply' }]
    })
  );
  assert.equal(summary.count, 1);
  assert.equal(summary.firstDate, null);
  assert.ok(backupSummaryText(summary).includes('1 registro'));
  assert.ok(!backupSummaryText(summary).includes(' del '));
});

test('un respaldo vacío se puede crear pero avisa que no trae nada', () => {
  const summary = summarizeBackup(buildBackup('NUVY-TEST-01', []));
  assert.equal(summary.count, 0);
  assert.ok(backupSummaryText(summary).includes('vacío'));
});

test('se rechaza un archivo que no es respaldo de Nuvy', () => {
  assert.throws(() => parseBackup('{"schema": "otra-cosa"}'), /no es un respaldo/i);
  assert.throws(() => parseBackup('no soy json'), /no es un respaldo válido/i);
  assert.throws(() => parseBackup('null'), /no tiene el formato esperado/i);
});

test('se rechaza un respaldo de otra versión', () => {
  assert.throws(
    () =>
      validateBackup({
        schema: 'nuvy-backup',
        version: 99,
        familyCode: 'NUVY-TEST-01',
        records: []
      }),
    /versión/
  );
});

test('se avisa cuando el respaldo es de otra familia', () => {
  const backup = buildBackup('NUVY-OTRA-99', RECORDS);
  assert.equal(isSameFamily(backup, 'NUVY-TEST-01'), false);
  assert.equal(isSameFamily(backup, 'NUVY-OTRA-99'), true);
  // Con espacios o minúsculas también debe coincidir.
  assert.equal(isSameFamily(backup, 'nuvy-otra-99 '), true);
});

test('un respaldo con registros dañados conserva los sanos', () => {
  const parsed = validateBackup({
    schema: 'nuvy-backup',
    version: 1,
    familyCode: 'NUVY-TEST-01',
    records: [{ id: 'ok-1', kind: 'sale', date: '2026-11-01' }, null, 'basura', { kind: 'sin-id' }]
  });
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].id, 'ok-1');
});
