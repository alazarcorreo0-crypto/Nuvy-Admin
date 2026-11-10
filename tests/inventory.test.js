import test from 'node:test';
import assert from 'node:assert/strict';

import {
  averageDailyConsumption,
  daysOfSupplyRemaining
} from '../js/core/inventory.js';

const BASE = {
  id: 'base',
  name: 'Base de nieve',
  type: 'base',
  purchaseUnit: 'bag',
  contentPerUnit: 5000,
  pricePerUnit: 200
};

let sequence = 0;
function nextId(prefix) {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

function count(overrides = {}) {
  sequence += 1;
  return {
    id: nextId('count'),
    kind: 'count',
    date: '2026-11-09',
    quantity: 0,
    supplyId: 'base',
    supplyName: 'Base de nieve',
    baseUnit: 'g',
    createdAt: `2026-11-09T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function purchase(overrides = {}) {
  sequence += 1;
  return {
    id: nextId('purchase'),
    kind: 'purchase',
    date: '2026-10-20',
    quantity: 1,
    totalPaid: 200,
    supplyId: 'base',
    supplyName: 'Base de nieve',
    unit: 'bag',
    contentPerUnit: 5000,
    createdAt: `2026-10-20T10:00:${String(sequence).padStart(2, '0')}.000Z`,
    ...overrides
  };
}

function closeTo(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${message}: se esperaba ${expected} y salió ${actual}`
  );
}

// Ventana por defecto de 28 días: del 2026-10-13 al 2026-11-09.
const AS_OF = '2026-11-09';

test('el consumo diario promedio reparte el consumo de la ventana', () => {
  const counts = [
    count({ date: '2026-10-13', quantity: 10000 }),
    count({ date: '2026-11-09', quantity: 4400 })
  ];
  const purchases = [
    // Compra dentro de la ventana: 2 bolsas = 10,000 g.
    purchase({ date: '2026-10-20', quantity: 2 }),
    // Compra ANTES de la ventana: no debe contar.
    purchase({ date: '2026-10-10', quantity: 1 })
  ];

  const daily = averageDailyConsumption(counts, purchases, BASE, AS_OF);

  // Consumo = 10,000 + 10,000 − 4,400 = 15,600 g en 28 días.
  closeTo(daily, 15600 / 28, 'consumo diario');
});

test('los días que alcanza dividen el inventario estimado entre el consumo diario', () => {
  const counts = [
    count({ date: '2026-10-13', quantity: 10000 }),
    count({ date: '2026-11-09', quantity: 4400 })
  ];
  const purchases = [
    purchase({ date: '2026-10-20', quantity: 2 })
  ];

  // Quedan 4,400 g y se consumen ~557.14 g al día → 7 días completos.
  const days = daysOfSupplyRemaining(BASE, counts, purchases, AS_OF);
  assert.equal(days, 7);
});

test('las compras después del último conteo suman a los días que alcanza', () => {
  const counts = [
    count({
      date: '2026-10-13',
      quantity: 10000,
      createdAt: '2026-10-13T10:00:00.000Z'
    }),
    count({
      date: '2026-11-09',
      quantity: 4400,
      createdAt: '2026-11-09T10:00:00.000Z'
    })
  ];
  const purchases = [
    // Compra del mismo día que el conteo final, pero registrada después:
    // entra al consumo Y al inventario estimado.
    purchase({
      date: '2026-11-09',
      quantity: 1,
      createdAt: '2026-11-09T12:00:00.000Z'
    })
  ];

  // Consumo = 10,000 + 5,000 − 4,400 = 10,600 g → ~378.57 g al día.
  // Inventario estimado = 4,400 + 5,000 = 9,400 g → 24 días completos.
  const days = daysOfSupplyRemaining(BASE, counts, purchases, AS_OF);
  assert.equal(days, 24);
});

test('un conteo solo de hoy no da historial de consumo', () => {
  const counts = [
    count({
      date: '2026-11-09',
      quantity: 4400,
      createdAt: '2026-11-09T10:00:00.000Z'
    })
  ];
  const purchases = [
    purchase({
      date: '2026-11-09',
      quantity: 1,
      createdAt: '2026-11-09T12:00:00.000Z'
    })
  ];

  assert.equal(averageDailyConsumption(counts, purchases, BASE, AS_OF), null);
  assert.equal(daysOfSupplyRemaining(BASE, counts, purchases, AS_OF), null);
});

test('sin conteos no hay consumo diario ni días que alcanzan', () => {
  assert.equal(averageDailyConsumption([], [purchase()], BASE, AS_OF), null);
  assert.equal(daysOfSupplyRemaining(BASE, [], [purchase()], AS_OF), null);
});

test('un solo conteo no basta: initial y latest son el mismo', () => {
  const counts = [count({ date: '2026-10-13', quantity: 10000 })];
  assert.equal(averageDailyConsumption(counts, [], BASE, AS_OF), null);
});

test('si no hubo consumo en la ventana, no hay promedio', () => {
  const counts = [
    count({ date: '2026-10-13', quantity: 4400 }),
    count({ date: '2026-11-09', quantity: 10000 })
  ];
  // Consumo = 4,400 + 0 − 10,000 = negativo.
  assert.equal(averageDailyConsumption(counts, [], BASE, AS_OF), null);
});

test('la ventana de días se puede cambiar', () => {
  const counts = [
    count({ date: '2026-10-27', quantity: 8000 }),
    count({ date: '2026-11-09', quantity: 2000 })
  ];
  const purchases = [purchase({ date: '2026-11-01', quantity: 1 })];

  const daily = averageDailyConsumption(counts, purchases, BASE, AS_OF, 14);

  // Consumo = 8,000 + 5,000 − 2,000 = 11,000 g en 14 días.
  closeTo(daily, 11000 / 14, 'consumo diario en ventana de 14 días');
});
