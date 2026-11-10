import test from 'node:test';
import assert from 'node:assert/strict';

import { getWeekRange } from '../js/core/dates.js';
import {
  buildMonthComparison,
  buildMonthlyCut,
  hasMonthActivity,
  monthRange,
  shiftMonth
} from '../js/core/monthly-cut.js';

let sequence = 0;
function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function purchase(overrides) {
  return {
    id: nextId('purchase'),
    kind: 'purchase',
    date: '2026-11-05',
    quantity: 1,
    totalPaid: 0,
    supplyId: 'base',
    supplyName: 'Base de nieve',
    unit: 'bag',
    contentPerUnit: 5000,
    createdAt: `2026-11-05T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function count(overrides) {
  return {
    id: nextId('count'),
    kind: 'count',
    date: '2026-11-01',
    quantity: 0,
    supplyId: 'base',
    supplyName: 'Base de nieve',
    baseUnit: 'g',
    createdAt: `2026-11-01T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function sale(overrides) {
  return {
    id: nextId('sale'),
    kind: 'sale',
    date: '2026-11-10',
    amount: 0,
    createdAt: `2026-11-10T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function expense(overrides) {
  return {
    id: nextId('expense'),
    kind: 'expense',
    date: '2026-11-10',
    concept: 'Gasto',
    amount: 0,
    createdAt: `2026-11-10T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function waste(overrides) {
  return {
    id: nextId('waste'),
    kind: 'waste',
    date: '2026-11-10',
    supplyId: 'base',
    supplyName: 'Base de nieve',
    quantity: 0,
    reason: 'otro',
    createdAt: `2026-11-10T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

const BASE = {
  id: 'base',
  name: 'Base de nieve',
  type: 'base',
  purchaseUnit: 'bag',
  contentPerUnit: 5000,
  pricePerUnit: 200
};

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= epsilon,
    `Se esperaba ${expected} y llegó ${actual}`
  );
}

test('monthRange devuelve el primer y último día del mes', () => {
  assert.deepEqual(monthRange('2026-11'), { start: '2026-11-01', end: '2026-11-30' });
  assert.deepEqual(monthRange('2026-02'), { start: '2026-02-01', end: '2026-02-28' });
  assert.deepEqual(monthRange('2028-02'), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(monthRange('2026-12'), { start: '2026-12-01', end: '2026-12-31' });

  assert.throws(() => monthRange('2026-13'));
  assert.throws(() => monthRange('noviembre'));
  assert.throws(() => monthRange('2026-1'));
});

test('shiftMonth mueve el mes hacia adelante o atrás', () => {
  assert.equal(shiftMonth('2026-11', -1), '2026-10');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-11', 0), '2026-11');
});

function monthScenario() {
  return {
    month: '2026-11',
    supplies: [BASE],
    purchases: [
      purchase({ date: '2026-11-05', quantity: 1, totalPaid: 200, supplyId: 'base' })
    ],
    sales: [sale({ amount: 20000, date: '2026-11-15' })],
    expenses: [
      expense({ concept: 'Renta', amount: 3000, date: '2026-11-01', category: 'fixed', period: 'monthly' }),
      expense({ concept: 'Gasolina', amount: 600, date: '2026-11-20', category: 'variable' }),
      expense({ concept: 'Retiro del dueño', amount: 1500, date: '2026-11-30', category: 'owner' })
    ],
    counts: [
      count({ supplyId: 'base', quantity: 3000, date: '2026-11-01' }),
      count({ supplyId: 'base', quantity: 1000, date: '2026-11-30' })
    ],
    wastes: [waste({ supplyId: 'base', quantity: 500, date: '2026-11-18' })]
  };
}

test('el corte mensual calcula la escalera de utilidades', () => {
  const cut = buildMonthlyCut(monthScenario());

  assert.equal(cut.start, '2026-11-01');
  assert.equal(cut.end, '2026-11-30');
  assert.equal(cut.complete, true);

  // Consumo: 3,000 + 5,000 − 1,000 = 7,000 g; 500 g de merma → 6,500 vendidos.
  const row = cut.rows.find((item) => item.supplyId === 'base');
  assert.equal(row.consumptionBase, 7000);
  assert.equal(row.soldBase, 6500);
  closeTo(row.soldCost, 6500 * 0.04);
  closeTo(row.wasteCost, 500 * 0.04);

  // Escalera: bruta, de operación y neta.
  closeTo(cut.productSoldCost, 6500 * 0.04);
  closeTo(cut.grossProfit, 20000 - 6500 * 0.04 - 500 * 0.04);
  closeTo(cut.totalFixedExpenses, 3000);
  closeTo(cut.totalVariableExpenses, 600);
  closeTo(cut.operatingProfit, 20000 - 6500 * 0.04 - 500 * 0.04 - 3000 - 600);
  closeTo(cut.ownerWithdrawals, 1500);
  closeTo(cut.netProfit, cut.operatingProfit - 1500);

  // El retiro del dueño no aparece entre los gastos operativos.
  assert.equal(
    cut.monthFixedExpenses.some((item) => item.category === 'owner'),
    false
  );
  assert.equal(
    cut.monthVariableExpenses.some((item) => item.category === 'owner'),
    false
  );
  closeTo(cut.totalExpenses, 3000 + 600);
});

test('un gasto recurrente de otro mes no se cobra entero en este', () => {
  const scenario = monthScenario();
  scenario.expenses = [
    expense({ concept: 'Renta', amount: 3000, date: '2026-10-01', category: 'fixed', period: 'monthly' })
  ];

  const cut = buildMonthlyCut(scenario);
  closeTo(cut.totalFixedExpenses, 0);
});

test('la comparación mensual marca el rumbo entre meses', () => {
  const current = buildMonthlyCut(monthScenario());

  const previousScenario = monthScenario();
  previousScenario.month = '2026-10';
  previousScenario.sales = [sale({ amount: 15000, date: '2026-10-15' })];
  previousScenario.expenses = [
    expense({ concept: 'Renta', amount: 3000, date: '2026-10-01', category: 'fixed', period: 'monthly' }),
    expense({ concept: 'Retiro del dueño', amount: 1000, date: '2026-10-31', category: 'owner' })
  ];
  previousScenario.counts = [
    count({ supplyId: 'base', quantity: 3000, date: '2026-10-01' }),
    count({ supplyId: 'base', quantity: 1000, date: '2026-10-31' })
  ];
  previousScenario.wastes = [];
  const previous = buildMonthlyCut(previousScenario);

  assert.equal(hasMonthActivity(previous), true);

  const comparison = buildMonthComparison(current, previous);
  assert.equal(comparison.hasPrevious, true);

  const sales = comparison.rows.find((row) => row.key === 'sales');
  closeTo(sales.diff, 5000);
  assert.equal(sales.tone, 'good');

  const netProfit = comparison.rows.find((row) => row.key === 'netProfit');
  assert.equal(netProfit.tone, 'good');
});

test('sin datos del mes anterior no hay comparación mensual', () => {
  const current = buildMonthlyCut(monthScenario());
  const emptyPrevious = buildMonthlyCut({
    month: '2026-10',
    supplies: [BASE],
    purchases: [],
    sales: [],
    expenses: [],
    counts: []
  });

  assert.equal(hasMonthActivity(emptyPrevious), false);

  const comparison = buildMonthComparison(current, emptyPrevious);
  assert.equal(comparison.hasPrevious, false);

  const withoutCut = buildMonthComparison(current, null);
  assert.equal(withoutCut.hasPrevious, false);
});

test('las ventas de noviembre no se cuelan en el corte de octubre', () => {
  const scenario = monthScenario();
  scenario.month = '2026-10';
  // La venta del 15 de noviembre no debe contar para octubre.
  const cut = buildMonthlyCut(scenario);

  assert.equal(cut.monthSales.length, 0);
  closeTo(cut.totalSales, 0);
  closeTo(cut.grossProfit, 0 - cut.productSoldCost - cut.productWasteCost);
});

test('los conteos del mes se respetan aunque haya compras después', () => {
  const scenario = monthScenario();
  // Una compra de diciembre no invalida el conteo final de noviembre.
  scenario.purchases = [
    ...scenario.purchases,
    purchase({ date: '2026-12-03', quantity: 1, totalPaid: 200, supplyId: 'base' })
  ];

  const cut = buildMonthlyCut(scenario);
  assert.equal(cut.complete, true);
  assert.equal(cut.rows[0].finalIsStale, false);
  assert.equal(cut.rows[0].consumptionBase, 7000);
});

test('las semanas del mes empiezan en sábado para calcular conteos', () => {
  // El corte mensual usa los conteos tal cual dentro del rango del mes,
  // igual que el semanal. La semana es solo para referencia.
  const week = getWeekRange('2026-11-05');
  assert.equal(week.start, '2026-10-31');
  assert.equal(week.end, '2026-11-06');
});
