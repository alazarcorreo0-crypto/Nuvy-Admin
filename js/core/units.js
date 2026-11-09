/**
 * Catálogo de tipos de insumo y conversiones entre unidades.
 *
 * Regla importante:
 * - Todo el inventario se guarda internamente en la unidad base:
 *   gramos (g) para sólidos y mililitros (ml) para líquidos.
 * - Las compras se capturan en la unidad de compra del insumo
 *   (bolsa, kg, pieza o litro) y se convierten a la unidad base.
 * - Los conteos físicos se pueden capturar en g, kg, bolsa, pieza, ml o L.
 */

export const SUPPLY_TYPES = {
  base: {
    label: 'Base de nieve',
    shortLabel: 'Base',
    baseUnit: 'g',
    units: ['bag'],
    defaultUnit: 'bag',
    defaultContent: 5000
  },
  dry: {
    label: 'Topping seco',
    shortLabel: 'Seco',
    baseUnit: 'g',
    units: ['kg', 'piece'],
    defaultUnit: 'kg',
    defaultContent: 1000
  },
  liquid: {
    label: 'Topping líquido',
    shortLabel: 'Líquido',
    baseUnit: 'ml',
    units: ['liter'],
    defaultUnit: 'liter',
    defaultContent: 1000
  }
};

export const SUPPLY_TYPE_ORDER = ['base', 'dry', 'liquid'];

export const PURCHASE_UNIT_NAMES = {
  kg: 'kilogramo',
  piece: 'pieza',
  liter: 'litro',
  bag: 'bolsa'
};

export const PURCHASE_UNIT_PLURALS = {
  kg: 'kilogramos',
  piece: 'piezas',
  liter: 'litros',
  bag: 'bolsas'
};

export function getSupplyType(type) {
  return SUPPLY_TYPES[type] ?? SUPPLY_TYPES.dry;
}

export function getBaseUnit(supply) {
  return getSupplyType(supply?.type).baseUnit;
}

export function getBaseUnitLabel(supply) {
  return getBaseUnit(supply) === 'ml' ? 'ml' : 'g';
}

export function getTypeLabel(type) {
  return getSupplyType(type).label;
}

export function getTypeShortLabel(type) {
  return getSupplyType(type).shortLabel;
}

export function getPurchaseUnitLabel(unit, plural = false) {
  const labels = plural ? PURCHASE_UNIT_PLURALS : PURCHASE_UNIT_NAMES;
  return labels[unit] ?? unit;
}

export function getContentLabel(unit) {
  switch (unit) {
    case 'bag':
      return 'Contenido por bolsa';
    case 'piece':
      return 'Contenido por pieza';
    case 'kg':
      return 'Contenido por kilogramo';
    case 'liter':
      return 'Contenido por litro';
    default:
      return 'Contenido por unidad';
  }
}

export function getContentSuffix(unit, type) {
  return getSupplyType(type).baseUnit === 'ml' ? 'ml' : 'g';
}

export function getContentHelp(unit, type) {
  const suffix = getContentSuffix(unit, type);
  switch (unit) {
    case 'bag':
      return `Ejemplo: una bolsa trae 5,000 ${suffix}.`;
    case 'piece':
      return `Ejemplo: una pieza pesa 5 ${suffix}.`;
    case 'kg':
      return `Un kilogramo siempre son 1,000 ${suffix}.`;
    case 'liter':
      return `Un litro siempre son 1,000 ${suffix}.`;
    default:
      return '';
  }
}

export function isContentFixed(unit) {
  return unit === 'kg' || unit === 'liter';
}

export function defaultContentForUnit(unit) {
  if (unit === 'kg' || unit === 'liter') return 1000;
  if (unit === 'bag') return 5000;
  return '';
}

export function allowedPurchaseUnits(type) {
  return getSupplyType(type).units;
}

export function purchaseBaseFactor(supply, unit = supply.purchaseUnit) {
  if (unit === 'kg' || unit === 'liter') return 1000;
  return Number(supply?.contentPerUnit) || 0;
}

export function purchaseToBase(quantity, supply, unit = supply.purchaseUnit) {
  return (Number(quantity) || 0) * purchaseBaseFactor(supply, unit);
}

export function purchaseRecordBaseQuantity(purchase) {
  return (Number(purchase?.quantity) || 0) * (Number(purchase?.contentPerUnit) || 0);
}

/**
 * Unidades que tiene sentido usar al hacer un conteo físico.
 * Para sólidos se ofrecen g/kg y, si aplica, bolsas o piezas.
 * Para líquidos se ofrecen ml/L.
 */
export function countUnitOptions(supply) {
  if (!supply) return [];
  if (getBaseUnit(supply) === 'ml') {
    return [
      { value: 'ml', label: 'mililitros (ml)', factor: 1 },
      { value: 'liter', label: 'litros (L)', factor: 1000 }
    ];
  }

  const options = [
    { value: 'g', label: 'gramos (g)', factor: 1 },
    { value: 'kg', label: 'kilogramos (kg)', factor: 1000 }
  ];

  if (supply.purchaseUnit === 'bag') {
    options.push({
      value: 'bag',
      label: 'bolsas',
      factor: Number(supply.contentPerUnit) || 0
    });
  }

  if (supply.purchaseUnit === 'piece') {
    options.push({
      value: 'piece',
      label: 'piezas',
      factor: Number(supply.contentPerUnit) || 0
    });
  }

  return options;
}

export function countUnitLabel(supply, unit) {
  return countUnitOptions(supply).find((option) => option.value === unit)?.label ?? unit;
}

export function countToBase(quantity, unit, supply) {
  const option = countUnitOptions(supply).find((item) => item.value === unit);
  if (!option) {
    throw new Error(`La unidad ${unit} no sirve para este insumo.`);
  }
  return (Number(quantity) || 0) * option.factor;
}

export function baseToPurchaseUnits(baseQuantity, supply) {
  const content = Number(supply?.contentPerUnit) || 0;
  return content > 0 ? (Number(baseQuantity) || 0) / content : 0;
}

export function baseToCountUnits(baseQuantity, unit, supply) {
  const option = countUnitOptions(supply).find((item) => item.value === unit);
  if (!option || option.factor <= 0) return 0;
  return (Number(baseQuantity) || 0) / option.factor;
}
