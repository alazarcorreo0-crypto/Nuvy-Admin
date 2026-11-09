/**
 * Catálogo de tipos de insumo y conversiones entre unidades.
 *
 * Regla importante:
 * - Todo el inventario se guarda internamente en la unidad base:
 *   gramos (g) para sólidos, mililitros (ml) para líquidos y piezas para
 *   artículos que se cuentan por unidad (desechables, limpieza, etc.).
 * - Las compras se capturan en la unidad de compra del insumo
 *   (bolsa, kg, pieza o litro) y se convierten a la unidad base.
 * - Los toppings líquidos se pueden comprar por litro o por kg. Para la app,
 *   1 litro y 1 kg equivalen a 1,000 ml.
 * - Los conteos físicos se pueden capturar en g, kg, bolsa, pieza, ml o L.
 *
 * Además de los tres tipos fijos (base, seco y líquido), la familia puede
 * crear sus propios tipos desde la pantalla de Insumos. Esos tipos viven en
 * los datos compartidos y se registran aquí en tiempo de ejecución.
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
    units: ['liter', 'kg'],
    defaultUnit: 'liter',
    defaultContent: 1000
  }
};

export const SUPPLY_TYPE_ORDER = ['base', 'dry', 'liquid'];

export const BASE_UNIT_LABELS = {
  g: 'g',
  ml: 'ml',
  piece: 'pza'
};

/**
 * Tipos creados por la familia. La llave es el id del registro y se guarda
 * en supply.type, así que nunca cambia aunque se renombre el tipo.
 */
const customSupplyTypes = new Map();

export function normalizeBaseUnit(value) {
  return ['g', 'ml', 'piece'].includes(value) ? value : 'piece';
}

export function purchaseUnitsForBaseUnit(baseUnit) {
  const unit = normalizeBaseUnit(baseUnit);
  if (unit === 'ml') return ['liter', 'kg'];
  if (unit === 'piece') return ['piece', 'bag'];
  return ['kg', 'piece', 'bag'];
}

export function defaultUnitForBaseUnit(baseUnit) {
  const unit = normalizeBaseUnit(baseUnit);
  if (unit === 'ml') return 'liter';
  if (unit === 'piece') return 'piece';
  return 'kg';
}

/**
 * Registra los tipos personalizados que vienen del almacenamiento.
 * Se llama cada vez que cambia la lista de registros.
 */
export function setCustomSupplyTypes(types = []) {
  customSupplyTypes.clear();
  for (const entry of types) {
    if (!entry?.id || SUPPLY_TYPES[entry.id]) continue;
    const baseUnit = normalizeBaseUnit(entry.baseUnit);
    const units = purchaseUnitsForBaseUnit(baseUnit);
    customSupplyTypes.set(entry.id, {
      label: String(entry.name ?? entry.label ?? 'Tipo personalizado').trim() || 'Tipo personalizado',
      shortLabel: String(entry.name ?? entry.shortLabel ?? 'Tipo').trim() || 'Tipo',
      baseUnit,
      units,
      defaultUnit: units.includes(entry.defaultUnit)
        ? entry.defaultUnit
        : defaultUnitForBaseUnit(baseUnit),
      defaultContent: defaultContentForBase(units.includes(entry.defaultUnit) ? entry.defaultUnit : defaultUnitForBaseUnit(baseUnit), baseUnit),
      custom: true
    });
  }
}

/**
 * Lista los tipos fijos y los personalizados, en el orden en que deben
 * aparecer en los selectores.
 */
export function listSupplyTypes() {
  return [
    ...Object.entries(SUPPLY_TYPES).map(([key, config]) => ({
      key,
      config,
      custom: false
    })),
    ...[...customSupplyTypes.entries()].map(([key, config]) => ({
      key,
      config,
      custom: true
    }))
  ];
}

export function hasSupplyType(type) {
  return Boolean(SUPPLY_TYPES[type]) || customSupplyTypes.has(type);
}

export function supplyTypeOrderIndex(type) {
  const index = SUPPLY_TYPE_ORDER.indexOf(type);
  return index === -1 ? SUPPLY_TYPE_ORDER.length : index;
}

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
  return customSupplyTypes.get(type) ?? SUPPLY_TYPES[type] ?? SUPPLY_TYPES.dry;
}

export function getBaseUnit(supply) {
  return getSupplyType(supply?.type).baseUnit;
}

export function getBaseUnitLabel(supply) {
  return BASE_UNIT_LABELS[getBaseUnit(supply)] ?? 'g';
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
  return getBaseUnitLabel({ type });
}

export function getContentHelp(unit, type) {
  const suffix = getContentSuffix(unit, type);
  const baseUnit = getSupplyType(type).baseUnit;
  switch (unit) {
    case 'bag':
      return baseUnit === 'piece'
        ? `Ejemplo: una bolsa trae 100 ${suffix}.`
        : `Ejemplo: una bolsa trae 5,000 ${suffix}.`;
    case 'piece':
      return baseUnit === 'piece'
        ? `Una pieza siempre cuenta como 1 ${suffix}.`
        : `Ejemplo: una pieza pesa 5 ${suffix}.`;
    case 'kg':
      return baseUnit === 'ml'
        ? 'Se toman 1,000 ml por kilogramo.'
        : `Un kilogramo siempre son 1,000 ${suffix}.`;
    case 'liter':
      return `Un litro siempre son 1,000 ${suffix}.`;
    default:
      return '';
  }
}

export function isContentFixed(unit, type = null) {
  if (unit === 'kg' || unit === 'liter') return true;
  return unit === 'piece' && Boolean(type) && getSupplyType(type).baseUnit === 'piece';
}

/**
 * Contenido que trae una unidad de compra cuando no hace falta preguntarlo.
 * - kg y litro siempre son 1,000 unidades base.
 * - pieza de un tipo que se cuenta por pieza siempre es 1 pieza.
 * - bolsa de piezas se asume de 100; bolsa de g/ml de 5,000.
 */
export function defaultContentForBase(unit, baseUnit) {
  const normalizedBase = normalizeBaseUnit(baseUnit);
  if (unit === 'kg' || unit === 'liter') return 1000;
  if (unit === 'piece') return normalizedBase === 'piece' ? 1 : '';
  if (unit === 'bag') return normalizedBase === 'piece' ? 100 : 5000;
  return '';
}

export function defaultContentForUnit(unit, type = null) {
  const baseUnit = type ? getSupplyType(type).baseUnit : 'g';
  return defaultContentForBase(unit, baseUnit);
}

export function allowedPurchaseUnits(type) {
  return getSupplyType(type).units;
}

export function purchaseBaseFactor(supply, unit = supply.purchaseUnit) {
  if (unit === 'kg' || unit === 'liter') return 1000;
  if (unit === 'piece' && getBaseUnit(supply) === 'piece') return 1;
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
 * Para líquidos se ofrecen ml/L y también g/kg, porque a veces se compran
 * por peso (por ejemplo, un topping líquido que llega por kilogramo).
 */
export function countUnitOptions(supply) {
  if (!supply) return [];

  if (getBaseUnit(supply) === 'piece') {
    const options = [{ value: 'piece', label: 'piezas', factor: 1 }];
    if (supply.purchaseUnit === 'bag') {
      options.push({
        value: 'bag',
        label: 'bolsas',
        factor: Number(supply.contentPerUnit) || 0
      });
    }
    return options;
  }

  if (getBaseUnit(supply) === 'ml') {
    return [
      { value: 'ml', label: 'mililitros (ml)', factor: 1 },
      { value: 'liter', label: 'litros (L)', factor: 1000 },
      { value: 'g', label: 'gramos (g)', factor: 1 },
      { value: 'kg', label: 'kilogramos (kg)', factor: 1000 }
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
