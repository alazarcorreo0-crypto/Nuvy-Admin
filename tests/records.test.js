import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPENSE_CATEGORIES,
  EXPENSE_PERIODS,
  ValidationError,
  validateCashClose,
  validateExpense,
  validateGoal,
  validateSale,
  validateWaste,
  WASTE_REASONS
} from '../js/core/validation.js';

const BASE = {
  id: 'base',
  name: 'Base de nieve',
  type: 'base',
  purchaseUnit: 'bag',
  contentPerUnit: 5000,
  pricePerUnit: 200
};

const PIECE_SUPPLY = {
  id: 'vasos',
  name: 'Vasos',
  type: 'desechables',
  purchaseUnit: 'piece',
  contentPerUnit: 1,
  pricePerUnit: 1
};

test('la venta acepta un número entero de clientes', () => {
  const sale = validateSale({ date: '2026-11-10', amount: 500, tickets: '12' });
  assert.equal(sale.tickets, 12);

  const withoutTickets = validateSale({ date: '2026-11-10', amount: 500 });
  assert.equal('tickets' in withoutTickets, false);

  const emptyTickets = validateSale({ date: '2026-11-10', amount: 500, tickets: '' });
  assert.equal('tickets' in emptyTickets, false);
});

test('la venta rechaza clientes que no sean enteros positivos', () => {
  for (const tickets of ['0', '-3', '2.5', 'abc']) {
    assert.throws(
      () => validateSale({ date: '2026-11-10', amount: 500, tickets }),
      ValidationError
    );
  }
});

test('el gasto tiene periodo y categoría de dueño', () => {
  const monthly = validateExpense({
    date: '2026-11-01',
    concept: 'Renta',
    amount: 3000,
    category: 'fixed',
    period: 'monthly'
  });
  assert.equal(monthly.period, 'monthly');

  // Sin periodo se guarda como "una sola vez" (el comportamiento de siempre).
  const once = validateExpense({
    date: '2026-11-10',
    concept: 'Gasolina',
    amount: 200
  });
  assert.equal(once.period, 'once');

  // Periodo desconocido también cae en "once".
  const weird = validateExpense({
    date: '2026-11-10',
    concept: 'Gasolina',
    amount: 200,
    period: 'anual'
  });
  assert.equal(weird.period, 'once');

  const owner = validateExpense({
    date: '2026-11-10',
    concept: 'Retiro del dueño',
    amount: 800,
    category: 'owner'
  });
  assert.equal(owner.category, 'owner');

  assert.deepEqual(EXPENSE_CATEGORIES, ['fixed', 'variable', 'owner']);
  assert.deepEqual(EXPENSE_PERIODS, ['once', 'weekly', 'fortnightly', 'monthly']);
});

test('la merma se valida con insumo, unidad y motivo', () => {
  const waste = validateWaste(
    { date: '2026-11-10', quantity: 500, unit: 'g', reason: 'se derritió' },
    BASE
  );
  assert.equal(waste.supplyId, BASE.id);
  assert.equal(waste.quantity, 500);
  assert.equal(waste.reason, 'se derritió');

  // Un motivo desconocido cae en "otro".
  const other = validateWaste(
    { date: '2026-11-10', quantity: 1, unit: 'bag', reason: 'lo robó el gato' },
    BASE
  );
  assert.equal(other.reason, 'otro');

  // Unidad que no corresponde al insumo: rechazada.
  assert.throws(
    () => validateWaste({ date: '2026-11-10', quantity: 1, unit: 'liter' }, BASE),
    ValidationError
  );

  // Sin insumo: rechazada.
  assert.throws(
    () => validateWaste({ date: '2026-11-10', quantity: 1, unit: 'g' }, null),
    ValidationError
  );

  // Cantidad negativa: rechazada.
  assert.throws(
    () =>
      validateWaste(
        { date: '2026-11-10', quantity: -5, unit: 'g', reason: 'otro' },
        BASE
      ),
    ValidationError
  );

  assert.ok(WASTE_REASONS.includes('muestra'));
});

test('la merma de un insumo por piezas usa sus unidades', () => {
  const waste = validateWaste(
    { date: '2026-11-10', quantity: 10, unit: 'piece', reason: 'se cayó' },
    PIECE_SUPPLY
  );
  assert.equal(waste.quantity, 10);
});

test('el cierre de caja valida efectivo, tarjeta y nota', () => {
  const close = validateCashClose({
    date: '2026-11-10',
    countedCash: 1500,
    cardSales: 300,
    note: 'Faltaron $20 del lunes'
  });
  assert.equal(close.date, '2026-11-10');
  assert.equal(close.countedCash, 1500);
  assert.equal(close.cardSales, 300);
  assert.equal(close.note, 'Faltaron $20 del lunes');

  // Tarjeta y nota son opcionales.
  const minimal = validateCashClose({ date: '2026-11-10', countedCash: 0 });
  assert.equal(minimal.countedCash, 0);
  assert.equal('cardSales' in minimal, false);
  assert.equal('note' in minimal, false);

  // Fecha inválida: rechazada.
  assert.throws(
    () => validateCashClose({ date: '10 de noviembre', countedCash: 100 }),
    ValidationError
  );

  // Efectivo negativo: rechazado.
  assert.throws(
    () => validateCashClose({ date: '2026-11-10', countedCash: -50 }),
    ValidationError
  );

  // Nota demasiado larga: rechazada.
  assert.throws(
    () =>
      validateCashClose({
        date: '2026-11-10',
        countedCash: 100,
        note: 'x'.repeat(141)
      }),
    ValidationError
  );
});

test('la meta del mes exige mes válido y al menos un número', () => {
  const goal = validateGoal({ month: '2026-11', salesGoal: 40000, expenseCap: 8000 });
  assert.equal(goal.month, '2026-11');
  assert.equal(goal.salesGoal, 40000);
  assert.equal(goal.expenseCap, 8000);

  // Solo meta de ventas.
  const salesOnly = validateGoal({ month: '2026-11', salesGoal: 40000, expenseCap: 0 });
  assert.equal(salesOnly.expenseCap, 0);

  // Mes inválido: rechazado.
  assert.throws(() => validateGoal({ month: '2026-13', salesGoal: 1 }), ValidationError);
  assert.throws(() => validateGoal({ month: 'noviembre', salesGoal: 1 }), ValidationError);

  // Sin ninguna meta: rechazado.
  assert.throws(
    () => validateGoal({ month: '2026-11', salesGoal: 0, expenseCap: 0 }),
    ValidationError
  );
});
