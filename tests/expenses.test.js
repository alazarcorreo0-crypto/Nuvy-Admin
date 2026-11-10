import test from 'node:test';
import assert from 'node:assert/strict';

import {
  suggestExpenseCategory,
  validateExpense
} from '../js/core/validation.js';

test('el gasto se guarda con su categoría fija o variable', () => {
  const fixed = validateExpense({
    date: '2026-11-11',
    concept: 'Renta del local',
    amount: 500,
    category: 'fixed'
  });
  assert.equal(fixed.category, 'fixed');
  assert.equal(fixed.concept, 'Renta del local');

  const variable = validateExpense({
    date: '2026-11-11',
    concept: 'Gasolina',
    amount: 100,
    category: 'variable'
  });
  assert.equal(variable.category, 'variable');
});

test('un gasto sin categoría se considera variable', () => {
  const legacy = validateExpense({
    date: '2026-11-11',
    concept: 'Renta',
    amount: 500
  });
  assert.equal(legacy.category, 'variable');
});

test('la sugerencia de categoría reconoce los conceptos fijos', () => {
  assert.equal(suggestExpenseCategory('Renta'), 'fixed');
  assert.equal(suggestExpenseCategory('Luz CFE'), 'fixed');
  assert.equal(suggestExpenseCategory('Sueldos de la semana'), 'fixed');
  assert.equal(suggestExpenseCategory('Internet de la tienda'), 'fixed');
  assert.equal(suggestExpenseCategory('Nómina'), 'fixed');
  assert.equal(suggestExpenseCategory('Agua embotellada'), 'fixed');

  assert.equal(suggestExpenseCategory('Gasolina'), 'variable');
  assert.equal(suggestExpenseCategory('Reparación de licuadora'), 'variable');
  assert.equal(suggestExpenseCategory('Mantenimiento'), 'variable');
  assert.equal(suggestExpenseCategory(''), 'variable');
});
