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
  setCustomSupplyTypes
} from '../js/core/units.js';
import {
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

      assert.deepEqual(type.purchaseUnits, ['liter', 'kg']);
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
