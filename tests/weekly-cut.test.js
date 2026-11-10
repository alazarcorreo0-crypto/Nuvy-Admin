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
  buildWeekComparison,
  buildWeeklyCut,
  expensePeriodDays,
  hasWeekActivity,
  proratedExpenseAmount,
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

  // Con inventario final suficiente (base: 6,000 g, nuez: 1,600 g) no se
  // sugiere comprar nada: el consumo + colchón cabe en lo que quedó.
  assert.deepEqual(cut.suggestions, []);
});

test('la compra sugerida considera el colchón y lo que quedó en inventario', () => {
  const scenario = successScenario();
  // Dejamos poco al final de la semana para que sí haga falta comprar.
  scenario.counts = [
    count({ supplyId: 'base', quantity: 3000, date: '2026-11-07' }),
    count({ supplyId: 'nuez', quantity: 1000, date: '2026-11-07' }),
    count({ supplyId: 'base', quantity: 1000, date: '2026-11-13' }),
    count({ supplyId: 'nuez', quantity: 800, date: '2026-11-13' })
  ];

  const cut = buildWeeklyCut(scenario);

  // Base: consumió 7,000 g; objetivo 7,000 × 1.10 = 7,700; quedan 1,000 g
  // → faltan 6,700 g → 6,700 / 5,000 = 1.34 → 2 bolsas.
  const baseSuggestion = cut.suggestions.find((item) => item.supplyId === 'base');
  assert.equal(baseSuggestion.quantity, 2);
  assert.equal(baseSuggestion.unit, 'bag');
  closeTo(baseSuggestion.stockBase, 1000);
  closeTo(baseSuggestion.targetBase, 7700);
  closeTo(baseSuggestion.neededBase, 6700);
  assert.equal(baseSuggestion.cushionPercent, 10);

  // Nuez: consumió 1,200 g; objetivo 1,320; quedan 800 g → faltan 520 g
  // → 520 / 1,000 = 0.52 kg.
  const nuezSuggestion = cut.suggestions.find((item) => item.supplyId === 'nuez');
  closeTo(nuezSuggestion.quantity, 0.52);
  assert.equal(nuezSuggestion.unit, 'kg');
});

test('el colchón de la compra sugerida se puede configurar', () => {
  const scenario = successScenario();
  scenario.counts = [
    count({ supplyId: 'base', quantity: 3000, date: '2026-11-07' }),
    count({ supplyId: 'nuez', quantity: 1000, date: '2026-11-07' }),
    count({ supplyId: 'base', quantity: 1000, date: '2026-11-13' }),
    count({ supplyId: 'nuez', quantity: 800, date: '2026-11-13' })
  ];

  const cut = buildWeeklyCut({ ...scenario, cushionPercent: 0 });

  // Sin colchón: base consume 7,000, quedan 1,000 → faltan 6,000 → 1.2 bolsas → 2.
  const baseSuggestion = cut.suggestions.find((item) => item.supplyId === 'base');
  assert.equal(baseSuggestion.quantity, 2);
  closeTo(baseSuggestion.neededBase, 6000);
  assert.equal(baseSuggestion.cushionPercent, 0);
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

test('una compra de la semana siguiente no invalida el corte de semanas pasadas', () => {
  const scenario = {
    anchorDate: '2026-11-09',
    supplies: [BASE],
    purchases: [
      purchase({ date: '2026-11-09', quantity: 1, totalPaid: 200, supplyId: 'base' }),
      purchase({ date: '2026-11-16', quantity: 1, totalPaid: 200, supplyId: 'base' })
    ],
    sales: [],
    expenses: [],
    counts: [
      count({ date: '2026-11-07', quantity: 3000 }),
      count({ date: '2026-11-13', quantity: 6000 })
    ]
  };

  const cut = buildWeeklyCut(scenario);

  // La compra del 16 de noviembre pertenece a la semana del 14 al 20:
  // no debe invalidar el conteo final de la semana del 7 al 13.
  assert.equal(cut.rows[0].finalIsStale, false);
  assert.equal(cut.complete, true);
  assert.equal(cut.rows[0].consumptionBase, 2000);
  closeTo(cut.rows[0].consumptionCost, 80);
});

test('una compra dentro de la misma semana sí invalida el conteo final', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [BASE],
    purchases: [
      purchase({ date: '2026-11-09', quantity: 1, totalPaid: 200, supplyId: 'base' }),
      purchase({ date: '2026-11-12', quantity: 1, totalPaid: 200, supplyId: 'base' })
    ],
    sales: [],
    expenses: [],
    counts: [
      count({ date: '2026-11-07', quantity: 3000 }),
      count({ date: '2026-11-11', quantity: 6000 })
    ]
  });

  assert.equal(cut.rows[0].finalIsStale, true);
  assert.equal(cut.complete, false);
  assert.equal(cut.rows[0].consumptionBase, null);
});

test('un conteo inicial viejo avisa que el consumo puede estar inflado', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [BASE],
    purchases: [purchase({ date: '2026-11-09', quantity: 1, totalPaid: 200, supplyId: 'base' })],
    sales: [],
    expenses: [],
    counts: [
      count({ date: '2026-08-01', quantity: 3000 }),
      count({ date: '2026-11-13', quantity: 6000 })
    ]
  });

  // El cálculo no cambia: 3,000 + 5,000 − 6,000 = 2,000.
  assert.equal(cut.rows[0].consumptionBase, 2000);

  const warning = cut.rows[0].warnings.find((text) => /conteo inicial/i.test(text));
  assert.ok(warning, 'debe existir un aviso de conteo inicial viejo');
  assert.match(warning, /1 de agosto de 2026/);
  assert.match(warning, /98 días/);
  assert.match(warning, /inflado/i);
});

test('un conteo inicial reciente no genera el aviso de conteo viejo', () => {
  const buildWithInitialDate = (date) =>
    buildWeeklyCut({
      anchorDate: '2026-11-09',
      supplies: [BASE],
      purchases: [purchase({ date: '2026-11-09', quantity: 1, totalPaid: 200, supplyId: 'base' })],
      sales: [],
      expenses: [],
      counts: [
        count({ date, quantity: 3000 }),
        count({ date: '2026-11-13', quantity: 6000 })
      ]
    });

  // 10 días antes del sábado o menos: sin aviso.
  for (const date of ['2026-11-07', '2026-10-31', '2026-10-28']) {
    const cut = buildWithInitialDate(date);
    assert.equal(
      cut.rows[0].warnings.some((text) => /conteo inicial/i.test(text)),
      false,
      `no debería avisar con conteo del ${date}`
    );
  }

  // 11 días antes del sábado: avisa.
  const cut = buildWithInitialDate('2026-10-27');
  assert.equal(
    cut.rows[0].warnings.some((text) => /conteo inicial/i.test(text)),
    true,
    'debería avisar con conteo del 2026-10-27'
  );
  assert.match(
    cut.rows[0].warnings.find((text) => /conteo inicial/i.test(text)),
    /11 días/
  );
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

/* ── Gastos recurrentes y prorrateo (FASE 3) ─────────────────────────────── */

test('los periodos de gasto duran lo esperado', () => {
  assert.equal(expensePeriodDays({ period: 'once' }), 1);
  assert.equal(expensePeriodDays({}), 1); // gasto viejo sin periodo
  assert.equal(expensePeriodDays({ period: 'weekly' }), 7);
  assert.equal(expensePeriodDays({ period: 'fortnightly' }), 15);
  assert.equal(expensePeriodDays({ period: 'monthly', date: '2026-11-01' }), 30);
  assert.equal(expensePeriodDays({ period: 'monthly', date: '2026-02-01' }), 28);
});

test('un gasto de una sola vez cae completo en el rango de su fecha', () => {
  const once = { date: '2026-11-10', amount: 500, period: 'once' };
  assert.equal(proratedExpenseAmount(once, '2026-11-07', '2026-11-13'), 500);
  assert.equal(proratedExpenseAmount(once, '2026-11-14', '2026-11-20'), 0);

  // Los gastos viejos (sin periodo) se comportan igual.
  const legacy = { date: '2026-11-10', amount: 500 };
  assert.equal(proratedExpenseAmount(legacy, '2026-11-07', '2026-11-13'), 500);
});

test('la renta mensual se prorratea a la semana', () => {
  // Renta de $3,000 del 1 de noviembre: al mes le toca 1/30 por día.
  const rent = { date: '2026-11-01', amount: 3000, period: 'monthly' };

  // Semana del 7 al 13: 7 días de 30 → $700.
  closeTo(proratedExpenseAmount(rent, '2026-11-07', '2026-11-13'), 700);
  // Semana del 14 al 20: 7 días de 30 → $700.
  closeTo(proratedExpenseAmount(rent, '2026-11-14', '2026-11-20'), 700);
  // Semana del 28 al 30: solo 3 días de noviembre (el periodo acaba el 30).
  closeTo(proratedExpenseAmount(rent, '2026-11-28', '2026-11-30'), 300);
  // La semana del 22 al 28 de noviembre ya no toca octubre.
  const octoberRent = { date: '2026-10-05', amount: 3000, period: 'monthly' };
  closeTo(proratedExpenseAmount(octoberRent, '2026-11-07', '2026-11-13'), 0);
});

test('un gasto quincenal se prorratea a la semana', () => {
  // Quincena de $1,500 del 1 al 15 de noviembre: $100 por día.
  const quincena = { date: '2026-11-01', amount: 1500, period: 'fortnightly' };

  // Semana del 7 al 13: 7 días de 15 → $700.
  closeTo(proratedExpenseAmount(quincena, '2026-11-07', '2026-11-13'), 700);
  // Semana del 12 al 18: 4 días (12, 13, 14, 15) → $400.
  closeTo(proratedExpenseAmount(quincena, '2026-11-12', '2026-11-18'), 400);
});

test('un gasto semanal alineado con la semana se cobra completo', () => {
  // $700 del sábado 7 al viernes 13: encaja justo con la semana.
  const weekly = { date: '2026-11-07', amount: 700, period: 'weekly' };
  closeTo(proratedExpenseAmount(weekly, '2026-11-07', '2026-11-13'), 700);

  // $700 del domingo 8: le tocan 6 de los 7 días de la semana.
  const weeklyOffset = { date: '2026-11-08', amount: 700, period: 'weekly' };
  closeTo(proratedExpenseAmount(weeklyOffset, '2026-11-07', '2026-11-13'), 600);
});

test('el corte cobra la parte prorrateada de los recurrentes', () => {
  const cut = buildWeeklyCut({
    anchorDate: '2026-11-09',
    supplies: [],
    purchases: [],
    sales: [sale({ amount: 5000 })],
    expenses: [
      expense({ concept: 'Renta', amount: 3000, date: '2026-11-01', period: 'monthly' }),
      expense({ concept: 'Gasolina', amount: 200, date: '2026-11-10' })
    ],
    counts: []
  });

  // $700 de renta prorrateada + $200 de gasolina completos.
  closeTo(cut.totalExpenses, 900);
  const rent = cut.weekExpenses.find((item) => item.concept === 'Renta');
  assert.ok(rent, 'la renta debe aparecer entre los gastos de la semana');
  assert.equal(rent.period, 'monthly');
  closeTo(rent.proratedAmount, 700);
});

/* ── Retiros del dueño y flujo de efectivo (FASE 3) ───────────────────────── */

test('los retiros del dueño no son gasto: solo salen del efectivo', () => {
  const scenario = successScenario();
  scenario.expenses = [
    expense({ concept: 'Gasolina', amount: 1000 }),
    expense({ concept: 'Retiro del dueño', amount: 800, category: 'owner' })
  ];

  const cut = buildWeeklyCut(scenario);

  // La ganancia contable no se ve afectada por el retiro.
  closeTo(cut.totalExpenses, 1000);
  closeTo(cut.profit, 5000 - 1000 - 200);

  // El retiro sale del flujo de efectivo, no de la ganancia.
  assert.equal(cut.cashFlow.salesIn, 5000);
  assert.equal(cut.cashFlow.expensesPaid, 1000);
  assert.equal(cut.cashFlow.purchasesPaid, 500);
  assert.equal(cut.cashFlow.ownerWithdrawals, 800);
  closeTo(cut.cashFlow.remaining, 5000 - 1000 - 500 - 800);

  // También aparece prorrateado por separado.
  closeTo(cut.totalProratedOwnerWithdrawals, 800);
});

/* ── Food cost (FASE 2) ──────────────────────────────────────────────────── */

test('el food cost compara el costo del producto contra las ventas', () => {
  const cut = buildWeeklyCut(successScenario());

  // Producto vendido: $200 entre $5,000 de ventas = 4%.
  closeTo(cut.foodCostPct, 0.04);
  // Gastos entre ventas: $1,000 / $5,000 = 20%.
  closeTo(cut.expenseRatioPct, 0.2);
});

/* ── Merma (FASE 4) ──────────────────────────────────────────────────────── */

test('la merma se separa del consumo vendido y cuesta aparte', () => {
  const scenario = successScenario();
  const cut = buildWeeklyCut({
    ...scenario,
    wastes: [waste({ supplyId: 'base', quantity: 500, reason: 'se derritió' })]
  });

  const base = cut.rows.find((row) => row.supplyId === 'base');

  // El consumo total no cambia: 2,000 g.
  assert.equal(base.consumptionBase, 2000);
  // Lo vendido es lo que quedó sin la merma.
  assert.equal(base.billableWasteBase, 500);
  assert.equal(base.soldBase, 1500);
  closeTo(base.wasteCost, 500 * 0.04);

  // El costo vendido baja y la merma se cobra aparte.
  closeTo(cut.viability.productConsumptionCost, 1500 * 0.04 + 120);
  closeTo(cut.waste.totalWasteCost, 500 * 0.04);
  closeTo(cut.waste.productWasteBase, 500);
  assert.equal(cut.waste.hasWaste, true);

  // La ganancia resta lo vendido y la merma por separado.
  closeTo(
    cut.profit,
    5000 - 1000 - (1500 * 0.04 + 120) - 500 * 0.04
  );
});

test('registrar más merma que el consumo avisa y solo descuenta lo posible', () => {
  const scenario = successScenario();
  scenario.supplies = [BASE];
  const cut = buildWeeklyCut({
    ...scenario,
    wastes: [waste({ supplyId: 'base', quantity: 9000 })]
  });

  const base = cut.rows.find((row) => row.supplyId === 'base');

  // Solo se puede descontar hasta el consumo total (2,000 g).
  assert.equal(base.billableWasteBase, 2000);
  assert.equal(base.soldBase, 0);
  assert.match(
    base.warnings.join(' '),
    /más merma que el consumo/i
  );

  // Sin producto vendido no hay food cost ni análisis.
  assert.equal(cut.viability.hasProductData, false);
  assert.equal(cut.foodCostPct, null);
});

test('la merma de otro insumo no afecta a la base', () => {
  const scenario = successScenario();
  const cut = buildWeeklyCut({
    ...scenario,
    wastes: [waste({ supplyId: 'nuez', quantity: 200 })]
  });

  const base = cut.rows.find((row) => row.supplyId === 'base');
  const nuez = cut.rows.find((row) => row.supplyId === 'nuez');

  assert.equal(base.soldBase, 2000);
  assert.equal(nuez.billableWasteBase, 200);
  assert.equal(nuez.soldBase, 200);
  closeTo(cut.waste.totalWasteCost, 200 * 0.3);
});

/* ── Tickets promedio (FASE 4) ────────────────────────────────────────────── */

test('el ticket promedio se calcula solo con las ventas que traen clientes', () => {
  const scenario = successScenario();
  scenario.sales = [
    sale({ amount: 3000, tickets: 30 }),
    sale({ amount: 2000, date: '2026-11-11' }) // sin clientes capturados
  ];

  const cut = buildWeeklyCut(scenario);

  assert.equal(cut.tickets.hasTicketData, true);
  assert.equal(cut.tickets.ticketSalesCount, 1);
  assert.equal(cut.tickets.totalTickets, 30);
  closeTo(cut.tickets.averageTicket, 100);
  // 2,400 g de producto entre 30 clientes = 80 g por cliente.
  closeTo(cut.tickets.gramsPerCustomer, 80);
});

test('sin clientes capturados no hay ticket promedio', () => {
  const cut = buildWeeklyCut(successScenario());

  assert.equal(cut.tickets.hasTicketData, false);
  assert.equal(cut.tickets.totalTickets, 0);
  assert.equal(cut.tickets.averageTicket, null);
  assert.equal(cut.tickets.gramsPerCustomer, null);
});

/* ── Comparación contra la semana anterior (FASE 2) ───────────────────────── */

test('la comparación semanal muestra diferencias y porcentajes', () => {
  const current = buildWeeklyCut(successScenario());

  const previousScenario = successScenario();
  previousScenario.anchorDate = '2026-11-02';
  previousScenario.sales = [sale({ amount: 4000, date: '2026-11-04' })];
  previousScenario.expenses = [expense({ amount: 900, date: '2026-11-04' })];
  previousScenario.purchases = [
    purchase({ date: '2026-11-03', quantity: 1, totalPaid: 500, supplyId: 'base' }),
    purchase({ date: '2026-11-03', unit: 'kg', quantity: 1, totalPaid: 300, supplyId: 'nuez' })
  ];
  previousScenario.counts = [
    count({ supplyId: 'base', quantity: 3000, date: '2026-10-31' }),
    count({ supplyId: 'nuez', quantity: 1000, date: '2026-10-31' }),
    count({ supplyId: 'base', quantity: 6000, date: '2026-11-06' }),
    count({ supplyId: 'nuez', quantity: 1600, date: '2026-11-06' })
  ];
  const previous = buildWeeklyCut(previousScenario);

  assert.equal(hasWeekActivity(previous), true);

  const comparison = buildWeekComparison(current, previous);
  assert.equal(comparison.hasPrevious, true);

  const sales = comparison.rows.find((row) => row.key === 'sales');
  closeTo(sales.diff, 1000);
  closeTo(sales.pct, 0.25);
  assert.equal(sales.tone, 'good');

  const expenses = comparison.rows.find((row) => row.key === 'expenses');
  assert.equal(expenses.tone, 'bad'); // gastar más no es bueno
  closeTo(expenses.diff, 100);

  const profit = comparison.rows.find((row) => row.key === 'profit');
  assert.equal(profit.tone, 'good');
});

test('sin datos de la semana anterior no hay comparación', () => {
  const current = buildWeeklyCut(successScenario());
  const emptyPrevious = buildWeeklyCut({
    anchorDate: '2026-11-02',
    supplies: [BASE, NUEZ],
    purchases: [],
    sales: [],
    expenses: [],
    counts: []
  });

  assert.equal(hasWeekActivity(emptyPrevious), false);

  const comparison = buildWeekComparison(current, emptyPrevious);
  assert.equal(comparison.hasPrevious, false);
  for (const row of comparison.rows) {
    assert.equal(row.pct, null);
    assert.equal(row.tone, 'neutral');
  }

  const withoutCut = buildWeekComparison(current, null);
  assert.equal(withoutCut.hasPrevious, false);
});
