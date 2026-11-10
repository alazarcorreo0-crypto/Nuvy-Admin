import test from 'node:test';
import assert from 'node:assert/strict';

import { getWeekRange } from '../js/core/dates.js';
import { getWeightedAverageCost } from '../js/core/inventory.js';
import {
  countToBase,
  purchaseToBase,
  setCustomSupplyTypes
} from '../js/core/units.js';
import {
  buildWeeklyCut,
  suggestPurchaseQuantity
} from '../js/core/weekly-cut.js';

const BASE = {
  id: 'base',
  name: 'Base de nieve',
  type: 'base',
  purchaseUnit: 'bag',
  contentPerUnit: 5000,
  pricePerUnit: 200
};

const NUEZ = {
  id: 'nuez',
  name: 'Nuez',
  type: 'dry',
  purchaseUnit: 'kg',
  contentPerUnit: 1000,
  pricePerUnit: 300
};

const LIQUID = {
  id: 'chocolate',
  name: 'Chocolate líquido',
  type: 'liquid',
  purchaseUnit: 'liter',
  contentPerUnit: 1000,
  pricePerUnit: 180
};

const LIQUID_KG = {
  ...LIQUID,
  id: 'chocolate-kg',
  purchaseUnit: 'kg'
};

let sequence = 0;
function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function purchase(overrides) {
  return {
    id: nextId('purchase'),
    kind: 'purchase',
    date: '2026-11-09',
    quantity: 1,
    totalPaid: 0,
    supplyId: 'base',
    supplyName: 'Base de nieve',
    unit: 'bag',
    contentPerUnit: 5000,
    createdAt: `2026-11-09T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function count(overrides) {
  return {
    id: nextId('count'),
    kind: 'count',
    date: '2026-11-07',
    quantity: 0,
    supplyId: 'base',
    supplyName: 'Base de nieve',
    baseUnit: 'g',
    createdAt: `2026-11-07T10:00:${String(sequence).padStart(2, '0')}.000Z`,
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
    date: '2026-11-11',
    concept: 'Gasto',
    amount: 0,
    createdAt: `2026-11-11T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= epsilon,
    `Se esperaba ${expected} y llegó ${actual}`
  );
}

function successScenario() {
  return {
    anchorDate: '2026-11-09',
    supplies: [BASE, NUEZ],
    purchases: [
      purchase({
        supplyId: 'base',
        supplyName: 'Base de nieve',
        quantity: 1,
        totalPaid: 200,
        contentPerUnit: 5000
      }),
      purchase({
        supplyId: 'nuez',
        supplyName: 'Nuez',
        unit: 'kg',
        quantity: 1,
        totalPaid: 300,
        contentPerUnit: 1000
      })
    ],
    sales: [sale({ amount: 5000 })],
    expenses: [expense({ amount: 1000 })],
    counts: [
      count({ supplyId: 'base', quantity: 3000, date: '2026-11-07' }),
      count({ supplyId: 'nuez', quantity: 1000, date: '2026-11-07' }),
      count({ supplyId: 'base', quantity: 6000, date: '2026-11-13' }),
      count({ supplyId: 'nuez', quantity: 1600, date: '2026-11-13' })
    ]
  };
}

test('análisis de viabilidad: costo por gramo, margen y punto de equilibrio', () => {
  const scenario = successScenario();
  scenario.expenses = [
    expense({ concept: 'Renta', amount: 500, category: 'fixed' }),
    expense({ concept: 'Gasolina', amount: 300, category: 'variable' })
  ];
  const cut = buildWeeklyCut(scenario);

  // Producto consumido: 2,000 g de base + 400 g de nuez = 2,400 g por $200.
  assert.equal(cut.viability.productConsumptionBase, 2400);
  closeTo(cut.viability.productConsumptionCost, 200);
  closeTo(cut.viability.costPerGram, 200 / 2400);
  closeTo(cut.viability.effectivePricePerGram, 5000 / 2400);
  closeTo(cut.viability.marginPerGram, 2);

  // Margen bruto: 5,000 − 200 = 4,800 (96% de las ventas).
  closeTo(cut.viability.grossMargin, 4800);
  closeTo(cut.viability.grossMarginPct, 0.96);

  // Hay que cubrir $800 de gastos. Sin insumos de apoyo.
  closeTo(cut.viability.totalOverheads, 800);
  closeTo(cut.viability.breakEvenSales, 800 / 0.96);
  closeTo(cut.viability.breakEvenGrams, 400);

  assert.equal(cut.viability.viable, true);
  assert.equal(cut.totalFixedExpenses, 500);
  assert.equal(cut.totalVariableExpenses, 300);
});

test('los gastos viejos sin categoría cuentan como variables', () => {
  const scenario = successScenario();
  scenario.expenses = [expense({ concept: 'Renta', amount: 100 })];
  const cut = buildWeeklyCut(scenario);

  assert.equal(cut.totalFixedExpenses, 0);
  assert.equal(cut.totalVariableExpenses, 100);
});

test('los insumos de tipos personalizados son de apoyo, no producto', () => {
  const VASOS = {
    id: 'vasos',
    name: 'Vasos',
    type: 'desechables',
    purchaseUnit: 'piece',
    contentPerUnit: 1,
    pricePerUnit: 1
  };

  setCustomSupplyTypes([
    { id: 'desechables', name: 'Desechables', baseUnit: 'piece', defaultUnit: 'piece' }
  ]);
  try {
    const cut = buildWeeklyCut({
      anchorDate: '2026-11-09',
      supplies: [BASE, VASOS],
      purchases: [
        purchase({ supplyId: 'base', quantity: 1, totalPaid: 200, contentPerUnit: 5000 }),
        purchase({
          supplyId: 'vasos',
          supplyName: 'Vasos',
          unit: 'piece',
          quantity: 100,
          totalPaid: 100,
          contentPerUnit: 1
        })
      ],
      sales: [sale({ amount: 1000 })],
      expenses: [expense({ concept: 'Renta', amount: 100, category: 'fixed' })],
      counts: [
        count({ supplyId: 'base', quantity: 0, date: '2026-11-07' }),
        count({ supplyId: 'vasos', quantity: 0, date: '2026-11-07', baseUnit: 'pza' }),
        count({ supplyId: 'base', quantity: 4000, date: '2026-11-13' }),
        count({ supplyId: 'vasos', quantity: 50, date: '2026-11-13', baseUnit: 'pza' })
      ]
    });

    // Solo la base (1,000 g) cuenta como producto.
    assert.equal(cut.viability.productConsumptionBase, 1000);
    closeTo(cut.viability.costPerGram, 0.04);
    closeTo(cut.viability.effectivePricePerGram, 1);
    closeTo(cut.viability.marginPerGram, 0.96);

    // Los vasos consumidos ($50) van a los gastos por cubrir.
    closeTo(cut.viability.supportConsumptionCost, 50);
    closeTo(cut.viability.totalOverheads, 150);
    closeTo(cut.viability.breakEvenSales, 150 / 0.96);

    assert.equal(cut.viability.viable, true);
    closeTo(cut.profit, 810);
  } finally {
    setCustomSupplyTypes([]);
  }
});

test('sin conteos no hay análisis de viabilidad', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [BASE],
    purchases: [purchase({ supplyId: 'base', quantity: 1, totalPaid: 200 })],
    sales: [sale({ amount: 500 })],
    expenses: [],
    counts: []
  });

  assert.equal(cut.viability.hasProductData, false);
  assert.equal(cut.viability.costPerGram, null);
  assert.equal(cut.viability.breakEvenSales, null);
});

test('la semana de negocio va de sábado a viernes', () => {
  assert.deepEqual(getWeekRange('2026-11-07'), {
    start: '2026-11-07',
    end: '2026-11-13'
  });
  assert.deepEqual(getWeekRange('2026-11-08'), {
    start: '2026-11-07',
    end: '2026-11-13'
  });
  assert.deepEqual(getWeekRange('2026-11-13'), {
    start: '2026-11-07',
    end: '2026-11-13'
  });
  assert.deepEqual(getWeekRange('2026-11-14'), {
    start: '2026-11-14',
    end: '2026-11-20'
  });
});

test('caso de éxito: consumo, costo, ganancia y compra sugerida', () => {
  const cut = buildWeeklyCut(successScenario());

  assert.equal(cut.start, '2026-11-07');
  assert.equal(cut.end, '2026-11-13');
  assert.equal(cut.complete, true);
  assert.equal(cut.rows.length, 2);

  const base = cut.rows.find((row) => row.supplyId === 'base');
  const nuez = cut.rows.find((row) => row.supplyId === 'nuez');

  assert.equal(base.consumptionBase, 2000);
  closeTo(base.consumptionCost, 80);

  assert.equal(nuez.consumptionBase, 400);
  closeTo(nuez.consumptionCost, 120);

  closeTo(cut.totalConsumptionCost, 200);
  closeTo(cut.profit, 3800);

  assert.deepEqual(
    cut.suggestions.map((item) => ({
      supplyId: item.supplyId,
      quantity: item.quantity,
      unit: item.unit
    })),
    [
      { supplyId: 'base', quantity: 1, unit: 'bag' },
      { supplyId: 'nuez', quantity: 0.4, unit: 'kg' }
    ]
  );
});

test('varios conteos y una compra después de un conteo en cero', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [BASE],
    purchases: [
      purchase({
        date: '2026-11-11',
        quantity: 1,
        totalPaid: 200,
        supplyId: 'base'
      })
    ],
    sales: [],
    expenses: [],
    counts: [
      count({ date: '2026-11-07', quantity: 3000 }),
      count({ date: '2026-11-11', quantity: 0 }),
      count({ date: '2026-11-13', quantity: 5000 })
    ]
  });

  assert.equal(cut.complete, true);
  assert.equal(cut.rows[0].consumptionBase, 3000);
  closeTo(cut.rows[0].consumptionCost, 120);
});

test('si hay una compra después del último conteo, el corte queda incompleto', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [BASE],
    purchases: [
      purchase({
        date: '2026-11-13',
        quantity: 1,
        totalPaid: 200,
        supplyId: 'base'
      })
    ],
    sales: [],
    expenses: [],
    counts: [
      count({ date: '2026-11-07', quantity: 3000 }),
      count({ date: '2026-11-12', quantity: 4000 })
    ]
  });

  assert.equal(cut.complete, false);
  assert.equal(cut.rows[0].missingFinal, true);
  assert.equal(cut.rows[0].consumptionBase, null);
  assert.equal(cut.rows[0].suggested, null);
  assert.match(cut.rows[0].warnings.join(' '), /compras después del último conteo/i);
});

test('sin conteo final no se inventa consumo', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [BASE],
    purchases: [],
    sales: [],
    expenses: [],
    counts: [count({ date: '2026-11-07', quantity: 3000 })]
  });

  assert.equal(cut.complete, false);
  assert.equal(cut.rows[0].consumptionBase, null);
  assert.equal(cut.rows[0].consumptionCost, null);
  assert.equal(cut.rows[0].suggested, null);
});

test('costo promedio ponderado con varias compras', () => {
  const purchases = [
    purchase({
      date: '2026-11-08',
      quantity: 1,
      totalPaid: 200,
      contentPerUnit: 5000,
      supplyId: 'base'
    }),
    purchase({
      date: '2026-11-09',
      quantity: 2,
      totalPaid: 500,
      contentPerUnit: 5000,
      supplyId: 'base'
    })
  ];

  const all = getWeightedAverageCost(BASE, purchases);
  assert.equal(all.totalBase, 15000);
  assert.equal(all.totalCost, 700);
  closeTo(all.costPerBase, 700 / 15000);

  const first = getWeightedAverageCost(BASE, purchases, '2026-11-08');
  assert.equal(first.totalBase, 5000);
  closeTo(first.costPerBase, 0.04);
});

test('si no hay compras se usa el precio del catálogo', () => {
  const info = getWeightedAverageCost(BASE, []);
  assert.equal(info.source, 'catalog');
  closeTo(info.costPerBase, 0.04);
});

test('la compra sugerida redondea bolsas hacia arriba y kg a dos decimales', () => {
  assert.equal(suggestPurchaseQuantity(BASE, 2000), 1);
  assert.equal(suggestPurchaseQuantity(BASE, 5001), 2);
  assert.equal(suggestPurchaseQuantity(BASE, 0), 0);
  assert.equal(suggestPurchaseQuantity(BASE, -10), 0);
  assert.equal(suggestPurchaseQuantity(NUEZ, 400), 0.4);
  assert.equal(suggestPurchaseQuantity(NUEZ, 401), 0.41);
  assert.equal(suggestPurchaseQuantity(LIQUID, 1000), 1);
  assert.equal(suggestPurchaseQuantity(LIQUID_KG, 1500), 1.5);
});

test('conversiones de compra y conteo', () => {
  assert.equal(purchaseToBase(1.5, NUEZ), 1500);
  assert.equal(purchaseToBase(2, BASE), 10000);
  assert.equal(countToBase(2, 'bag', BASE), 10000);
  assert.equal(countToBase(500, 'g', BASE), 500);
  assert.equal(countToBase(1.5, 'kg', BASE), 1500);
  assert.equal(countToBase(1, 'liter', LIQUID), 1000);
  assert.equal(countToBase(250, 'g', LIQUID), 250);
  assert.equal(countToBase(1.5, 'kg', LIQUID), 1500);
  assert.equal(purchaseToBase(2, LIQUID_KG), 2000);
});

test('un insumo sin actividad no ensucia el corte', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [BASE, NUEZ],
    purchases: [],
    sales: [],
    expenses: [],
    counts: []
  });

  assert.equal(cut.rows.length, 0);
  assert.equal(cut.complete, true);
  assert.equal(cut.profit, 0);
  assert.deepEqual(cut.suggestions, []);
});
