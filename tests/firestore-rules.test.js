import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rulesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'firestore.rules'
);

/**
 * Los tipos de registro que la app escribe en Firestore.
 * Si agregas uno nuevo en store.js, debe estar también en la
 * lista de kinds permitidos de firestore.rules.
 */
const KINDS_THE_APP_WRITES = [
  'supply',
  'supplyType',
  'purchase',
  'sale',
  'expense',
  'count',
  'waste',
  'cashClose',
  'goal'
];

function allowedKindsInRules() {
  const rules = readFileSync(rulesPath, 'utf8');
  const match = rules.match(/data\.kind in \[([^\]]+)\]/);
  assert.ok(match, 'firestore.rules debe tener una lista de kinds permitidos.');
  return match[1]
    .split(',')
    .map((kind) => kind.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

test('las reglas de Firestore permiten todos los kinds que la app escribe', () => {
  const allowed = allowedKindsInRules();
  for (const kind of KINDS_THE_APP_WRITES) {
    assert.ok(
      allowed.includes(kind),
      `firestore.rules no permite el kind "${kind}". Agregalo a la lista de kinds o el guardado fallará con permission-denied.`
    );
  }
});

test('las reglas no permiten kinds que la app no usa', () => {
  const allowed = allowedKindsInRules();
  for (const kind of allowed) {
    assert.ok(
      KINDS_THE_APP_WRITES.includes(kind),
      `firestore.rules permite el kind "${kind}", pero la app no lo escribe.`
    );
  }
});
