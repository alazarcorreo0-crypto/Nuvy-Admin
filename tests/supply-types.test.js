import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allowedPurchaseUnits,
  countToBase,
  countUnitOptions,
  defaultContentForUnit,
  getBaseUnitLabel,
  getSupplyType,
  hasSupplyType,
  isContentFixed,
  listSupplyTypes,
  purchaseToBase,
  purchaseUnitsForSupply,
  setCustomSupplyTypes
} from '../js/core/units.js';
import {
  validatePurchase,
  validateSupply,
  validateSupplyType
} from '../js/core/validation.js';

function withCustomTypes(types, run) {
  setCustomSupplyTypes(types);
  try {
    run();
  } finally {
    setCustomSupplyTypes([]);
  }
}

test('un tipo personalizado por piezas sirve para desechables', () => {
  withCustomTypes(
    [{ id: 'desechables', name: 'Desechables', baseUnit: 'piece', defaultUnit: 'bag' }],
    () => {
      assert.equal(hasSupplyType('desechables'), true);
      assert.equal(getSupplyType('desechables').label, 'Desechables');
      assert.equal(getSupplyType('desechables').baseUnit, 'piece');
      assert.deepEqual(allowedPurchaseUnits('desechables'), ['piece', 'bag']);

      const supply = {
        id: 'vasos',
        name: 'Vasos',
        type: 'desechables',
        purchaseUnit: 'bag',
        contentPerUnit: 100,
        pricePerUnit: 50
      };

      assert.equal(getBaseUnitLabel(supply), 'pza');
      assert.deepEqual(
        countUnitOptions(supply).map((option) => option.value),
        ['piece', 'bag']
      );
      assert.equal(countToBase(2, 'bag', supply), 200);
      assert.equal(purchaseToBase(2, supply), 200);
      assert.equal(
        purchaseToBase(3, { ...supply, purchaseUnit: 'piece', contentPerUnit: 1 }),
        3
      );
      assert.equal(isContentFixed('piece', 'desechables'), true);
      assert.equal(defaultContentForUnit('piece', 'desechables'), 1);
    }
  );
});

test('la validación guarda las piezas como contenido fijo', () => {
  withCustomTypes(
    [{ id: 'desechables', name: 'Desechables', baseUnit: 'piece', defaultUnit: 'piece' }],
    () => {
      const supply = validateSupply({
        name: 'Servilletas',
        type: 'desechables',
        purchaseUnit: 'piece',
        contentPerUnit: '',
        pricePerUnit: '25'
      });

      assert.equal(supply.contentPerUnit, 1);
    }
  );
});

test('un tipo personalizado líquido se compra por litro o kg', () => {
  withCustomTypes(
    [{ id: 'limpieza', name: 'Material de limpieza', baseUnit: 'ml', defaultUnit: 'liter' }],
    () => {
      const type = validateSupplyType({
        name: 'Material de limpieza',
        baseUnit: 'ml',
        defaultUnit: 'liter'
      });

      assert.deepEqual(type.purchaseUnits, ['liter', 'gal', 'kg', 'g']);
      assert.equal(type.defaultUnit, 'liter');

      const supply = {
        id: 'cloro',
        name: 'Cloro',
        type: 'limpieza',
        purchaseUnit: 'kg',
        contentPerUnit: 1000,
        pricePerUnit: 30
      };

      assert.equal(getBaseUnitLabel(supply), 'ml');
      assert.equal(purchaseToBase(1.5, supply), 1500);
    }
  );
});

test('un topping líquido puede medirse en gramos o en mililitros', () => {
  const inGrams = {
    id: 'chocolate',
    name: 'Chocolate líquido',
    type: 'liquid',
    baseUnit: 'g',
    purchaseUnit: 'kg',
    contentPerUnit: 1000,
    pricePerUnit: 180
  };

  assert.equal(getBaseUnitLabel(inGrams), 'g');
  assert.deepEqual(
    countUnitOptions(inGrams).map((option) => option.value),
    ['g', 'kg']
  );
  assert.equal(purchaseToBase(2, inGrams), 2000);
  assert.equal(purchaseToBase(500, { ...inGrams, purchaseUnit: 'g' }), 500);

  const inMilliliters = { ...inGrams, baseUnit: 'ml', purchaseUnit: 'liter' };
  assert.equal(getBaseUnitLabel(inMilliliters), 'ml');
  assert.deepEqual(
    countUnitOptions(inMilliliters).map((option) => option.value),
    ['ml', 'liter', 'gal', 'g', 'kg']
  );
  assert.equal(countToBase(1, 'liter', inMilliliters), 1000);

  // Los insumos viejos sin baseUnit usan la medida nueva por defecto: g.
  assert.equal(getBaseUnitLabel({ ...inGrams, baseUnit: undefined }), 'g');
});

test('la validación guarda la medida elegida del topping líquido', () => {
  const inMilliliters = validateSupply({
    name: 'Chocolate líquido',
    type: 'liquid',
    baseUnit: 'ml',
    purchaseUnit: 'liter',
    contentPerUnit: '',
    pricePerUnit: '180'
  });
  assert.equal(inMilliliters.baseUnit, 'ml');
  assert.equal(inMilliliters.contentPerUnit, 1000);

  const inGrams = validateSupply({
    name: 'Chocolate líquido',
    type: 'liquid',
    baseUnit: 'g',
    purchaseUnit: 'kg',
    contentPerUnit: '',
    pricePerUnit: '180'
  });
  assert.equal(inGrams.baseUnit, 'g');
  assert.equal(inGrams.contentPerUnit, 1000);

  const byGram = validateSupply({
    name: 'Chocolate líquido',
    type: 'liquid',
    baseUnit: 'g',
    purchaseUnit: 'g',
    contentPerUnit: '',
    pricePerUnit: '0.18'
  });
  assert.equal(byGram.contentPerUnit, 1);
});

test('una compra se puede capturar en kilos o gramos según convenga', () => {
  const supply = {
    id: 'chocolate',
    name: 'Chocolate líquido',
    type: 'liquid',
    baseUnit: 'g',
    purchaseUnit: 'kg',
    contentPerUnit: 1000,
    pricePerUnit: 180
  };
  const base = { date: '2026-11-14', supplyId: 'chocolate', totalPaid: '180' };

  const byKg = validatePurchase({ ...base, quantity: '2', unit: 'kg' }, supply);
  assert.equal(byKg.unit, 'kg');
  assert.equal(byKg.contentPerUnit, 1000);

  const byGram = validatePurchase({ ...base, quantity: '750', unit: 'g' }, supply);
  assert.equal(byGram.unit, 'g');
  assert.equal(byGram.contentPerUnit, 1);

  // Sin unidad explícita se usa la unidad de compra habitual del insumo.
  const fallback = validatePurchase({ ...base, quantity: '1' }, supply);
  assert.equal(fallback.unit, 'kg');
  assert.equal(fallback.contentPerUnit, 1000);

  assert.throws(
    () => validatePurchase({ ...base, quantity: '1', unit: 'bag' }, supply),
    /unidad de compra válida/
  );
});

test('una compra conserva el contenido capturado del insumo', () => {
  const bagSupply = {
    id: 'base',
    name: 'Base de nieve',
    type: 'base',
    baseUnit: 'g',
    purchaseUnit: 'bag',
    contentPerUnit: 5000,
    pricePerUnit: 200
  };

  const byBag = validatePurchase(
    { date: '2026-11-14', supplyId: 'base', quantity: '1', unit: 'bag', totalPaid: '200' },
    bagSupply
  );
  assert.equal(byBag.contentPerUnit, 5000);

  const pieceSupply = {
    id: 'nuez',
    name: 'Nuez',
    type: 'dry',
    baseUnit: 'g',
    purchaseUnit: 'piece',
    contentPerUnit: 5,
    pricePerUnit: 3
  };

  const byPiece = validatePurchase(
    { date: '2026-11-14', supplyId: 'nuez', quantity: '10', unit: 'piece', totalPaid: '30' },
    pieceSupply
  );
  assert.equal(byPiece.contentPerUnit, 5);

  // Si se compra en una unidad con conversión fija, se usa esa conversión.
  const byKg = validatePurchase(
    { date: '2026-11-14', supplyId: 'nuez', quantity: '1', unit: 'kg', totalPaid: '300' },
    pieceSupply
  );
  assert.equal(byKg.contentPerUnit, 1000);
});

test('las compras solo ofrecen unidades cuyo contenido se conoce', () => {
  const byKg = {
    id: 'nuez',
    name: 'Nuez',
    type: 'dry',
    baseUnit: 'g',
    purchaseUnit: 'kg',
    contentPerUnit: 1000,
    pricePerUnit: 300
  };
  assert.deepEqual(purchaseUnitsForSupply(byKg), ['kg', 'g']);

  const byPiece = { ...byKg, purchaseUnit: 'piece', contentPerUnit: 5 };
  assert.deepEqual(purchaseUnitsForSupply(byPiece), ['kg', 'g', 'piece']);

  const byBag = {
    id: 'base',
    name: 'Base de nieve',
    type: 'base',
    baseUnit: 'g',
    purchaseUnit: 'bag',
    contentPerUnit: 5000,
    pricePerUnit: 200
  };
  assert.deepEqual(purchaseUnitsForSupply(byBag), ['bag', 'kg', 'g', 'liter', 'gal']);
});

test('los tipos personalizados se suman a los tres tipos fijos', () => {
  withCustomTypes(
    [{ id: 'empaques', name: 'Empaques', baseUnit: 'piece', defaultUnit: 'piece' }],
    () => {
      const keys = listSupplyTypes().map((entry) => entry.key);
      assert.deepEqual(keys, ['base', 'dry', 'liquid', 'empaques']);
    }
  );
});

test('no se acepta un tipo con una medida desconocida', () => {
  assert.throws(
    () => validateSupplyType({ name: 'Raro', baseUnit: 'litros', defaultUnit: 'liter' }),
    /cómo se mide/
  );
});
