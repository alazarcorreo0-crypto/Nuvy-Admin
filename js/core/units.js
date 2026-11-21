/**
 * Catálogo de tipos de insumo y conversiones entre unidades.
 *
 * Regla importante:
 * - Todo el inventario se guarda internamente en la unidad base:
 *   gramos (g) para sólidos, gramos o mililitros (ml) para toppings
 *   líquidos (según lo elegido en cada insumo) y piezas para artículos
 *   que se cuentan por unidad (desechables, limpieza, etc.).
 * - Las compras se capturan en la unidad de compra del insumo
 *   (bolsa, kg, gramo, pieza o litro) y se convierten a la unidad base.
 * - Los toppings líquidos se pueden medir por peso (gramos) o por volumen
 *   (mililitros), y se pueden comprar por kg, gramo o litro. Para la app,
 *   1 litro = 1 kg = 1,000 g = 1,000 ml.
 * - Los conteos físicos se pueden capturar en g, kg, bolsa, pieza, ml o L.
 *
 * Además de los tres tipos fijos (base, seco y líquido), la familia puede
 * crear sus propios tipos desde la pantalla de Insumos. Esos tipos viven en
 * los datos compartidos y se registran aquí en tiempo de ejecución.
 */

// 1 galón (US) = 3.785411784 litros = 3,785.411784 ml/g base.
const GALLON_TO_BASE = 3785.411784;

export const SUPPLY_TYPES = {
  base: {
    label: 'Base de nieve',
    shortLabel: 'Base',
    baseUnit: 'g',
    baseUnits: ['g', 'ml'],
    units: ['bag', 'kg', 'g', 'liter', 'gal'],
    purchaseUnitsByBaseUnit: {
      g: ['bag', 'kg', 'g', 'liter', 'gal'],
      ml: ['bag', 'gal', 'liter', 'kg', 'g']
    },
    defaultUnit: 'bag',
    defaultContent: 5000
  },
  dry: {
    label: 'Topping seco',
    shortLabel: 'Seco',
    baseUnit: 'g',
    units: ['kg', 'g', 'piece', 'bag'],
    defaultUnit: 'kg',
    defaultContent: 1000
  },
  liquid: {
    label: 'Topping líquido',
    shortLabel: 'Líquido',
    // Por defecto se mide por peso, pero cada insumo puede elegir ml.
    baseUnit: 'g',
    baseUnits: ['g', 'ml'],
    units: ['kg', 'g', 'liter', 'gal'],
    purchaseUnitsByBaseUnit: {
      g: ['kg', 'g', 'liter', 'gal'],
      ml: ['liter', 'gal', 'kg', 'g']
    },
    defaultUnit: 'kg',
    defaultContent: 1000
  }
};

export const SUPPLY_TYPE_ORDER = ['base', 'dry', 'liquid'];

export const BASE_UNIT_LABELS = {
  g: 'g',
  ml: 'ml',
  piece: 'pza'
};

export const BASE_UNIT_NAMES = {
  g: 'Gramos (peso)',
  ml: 'Mililitros (líquido)',
  piece: 'Piezas (unidades)'
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
  if (unit === 'ml') return ['liter', 'gal', 'kg', 'g'];
  if (unit === 'piece') return ['piece', 'bag'];
  return ['kg', 'g', 'liter', 'gal', 'piece', 'bag'];
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
  g: 'gramo',
  piece: 'pieza',
  liter: 'litro',
  bag: 'bolsa',
  gal: 'galón'
};

export const PURCHASE_UNIT_PLURALS = {
  kg: 'kilogramos',
  g: 'gramos',
  piece: 'piezas',
  liter: 'litros',
  bag: 'bolsas',
  gal: 'galones'
};

export function getSupplyType(type) {
  return customSupplyTypes.get(type) ?? SUPPLY_TYPES[type] ?? SUPPLY_TYPES.dry;
}

/**
 * Medidas base que acepta un tipo. La mayoría solo tiene una; los toppings
 * líquidos aceptan gramos (peso) o mililitros (volumen) por insumo.
 */
export function allowedBaseUnits(type) {
  const config = getSupplyType(type);
  return Array.isArray(config.baseUnits) && config.baseUnits.length > 0
    ? config.baseUnits
    : [config.baseUnit];
}

export function defaultBaseUnitForType(type) {
  return getSupplyType(type).baseUnit;
}

/**
 * Toma la medida guardada en el insumo si es válida para su tipo; si no,
 * cae en la medida por defecto del tipo. Así los insumos viejos (sin
 * `baseUnit`) siguen funcionando.
 */
export function normalizeSupplyBaseUnit(type, value) {
  const allowed = allowedBaseUnits(type);
  return allowed.includes(value) ? value : defaultBaseUnitForType(type);
}

export function getBaseUnit(supply) {
  return normalizeSupplyBaseUnit(supply?.type, supply?.baseUnit);
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
    case 'g':
      return 'Contenido por gramo';
    case 'liter':
      return 'Contenido por litro';
    case 'gal':
      return 'Contenido por galón';
    default:
      return 'Contenido por unidad';
  }
}

export function getContentSuffix(unit, type = null, baseUnit = null) {
  const resolved = baseUnit ?? (type ? getSupplyType(type).baseUnit : 'g');
  return BASE_UNIT_LABELS[normalizeBaseUnit(resolved)] ?? 'g';
}

export function getContentHelp(unit, type = null, baseUnit = null) {
  const resolvedBase = normalizeBaseUnit(
    baseUnit ?? (type ? getSupplyType(type).baseUnit : 'g')
  );
  const suffix = getContentSuffix(unit, type, resolvedBase);
  switch (unit) {
    case 'bag':
      return resolvedBase === 'piece'
        ? `Ejemplo: una bolsa trae 100 ${suffix}.`
        : `Ejemplo: una bolsa trae 5,000 ${suffix}.`;
    case 'piece':
      return resolvedBase === 'piece'
        ? `Una pieza siempre cuenta como 1 ${suffix}.`
        : `Ejemplo: una pieza pesa 5 ${suffix}.`;
    case 'g':
      return resolvedBase === 'ml'
        ? 'Se toma 1 gramo como 1 ml.'
        : `Un gramo siempre es 1 ${suffix}.`;
    case 'kg':
      return `Un kilogramo siempre son 1,000 ${suffix}.`;
    case 'liter':
      return `Un litro siempre son 1,000 ${suffix}.`;
    case 'gal':
      return `Un galón siempre son 3,785.41 ${suffix}.`;
    default:
      return '';
  }
}

export function isContentFixed(unit, type = null, baseUnit = null) {
  if (unit === 'kg' || unit === 'liter' || unit === 'g' || unit === 'gal') return true;
  const resolvedBase = baseUnit ?? (type ? getSupplyType(type).baseUnit : null);
  return unit === 'piece' && Boolean(type) && resolvedBase === 'piece';
}

/**
 * Contenido que trae una unidad de compra cuando no hace falta preguntarlo.
 * - kg y litro siempre son 1,000 unidades base.
 * - galón siempre son 3,785.411784 unidades base.
 * - gramo siempre es 1 unidad base (1 g = 1 ml para la app).
 * - pieza de un tipo que se cuenta por pieza siempre es 1 pieza.
 * - bolsa de piezas se asume de 100; bolsa de g/ml de 5,000.
 */
export function defaultContentForBase(unit, baseUnit) {
  const normalizedBase = normalizeBaseUnit(baseUnit);
  if (unit === 'kg' || unit === 'liter') return 1000;
  if (unit === 'gal') return GALLON_TO_BASE;
  if (unit === 'g') return normalizedBase === 'piece' ? '' : 1;
  if (unit === 'piece') return normalizedBase === 'piece' ? 1 : '';
  if (unit === 'bag') return normalizedBase === 'piece' ? 100 : 5000;
  return '';
}

export function defaultContentForUnit(unit, type = null, baseUnit = null) {
  const resolvedBase = baseUnit ?? (type ? getSupplyType(type).baseUnit : 'g');
  return defaultContentForBase(unit, resolvedBase);
}

/**
 * Unidades de compra que acepta un tipo, considerando la medida elegida en
 * el insumo (por ejemplo, un topping líquido medido en g o en ml).
 */
export function allowedPurchaseUnits(type, baseUnit = null) {
  const config = getSupplyType(type);
  if (config.purchaseUnitsByBaseUnit) {
    const resolved = normalizeSupplyBaseUnit(type, baseUnit ?? config.baseUnit);
    return config.purchaseUnitsByBaseUnit[resolved] ?? config.units;
  }
  return config.units;
}

export function purchaseBaseFactor(supply, unit = supply.purchaseUnit) {
  if (unit === 'kg' || unit === 'liter') return 1000;
  if (unit === 'gal') return GALLON_TO_BASE;
  if (unit === 'g') return 1;
  if (unit === 'piece' && getBaseUnit(supply) === 'piece') return 1;
  return Number(supply?.contentPerUnit) || 0;
}

/**
 * Unidades en las que se puede capturar una compra suelta de este insumo.
 * Incluye la unidad habitual (aunque sea bolsa o pieza con contenido
 * capturado) y las unidades de conversión fija (kg, g, litro, galón). No ofrece
 * piezas de un insumo que se pesa, porque no se sabe cuánto pesa cada pieza.
 */
export function purchaseUnitsForSupply(supply) {
  if (!supply) return [];
  const base = getBaseUnit(supply);
  return allowedPurchaseUnits(supply.type, supply.baseUnit).filter((unit) => {
    if (unit === supply.purchaseUnit) return true;
    if (unit === 'kg' || unit === 'g' || unit === 'liter' || unit === 'gal') return true;
    if (unit === 'piece') return base === 'piece';
    return false;
  });
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
      { value: 'gal', label: 'galones (gal)', factor: GALLON_TO_BASE },
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
