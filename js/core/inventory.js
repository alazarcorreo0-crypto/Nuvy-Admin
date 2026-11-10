import { addDays } from './dates.js';
import { sum } from './format.js';
import { purchaseRecordBaseQuantity } from './units.js';

function compareCounts(a, b) {
  const dateCompare = String(a.date).localeCompare(String(b.date));
  if (dateCompare !== 0) return dateCompare;
  const createdCompare = String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
  if (createdCompare !== 0) return createdCompare;
  return String(a.id ?? '').localeCompare(String(b.id ?? ''));
}

function comparePurchases(a, b) {
  const dateCompare = String(a.date).localeCompare(String(b.date));
  if (dateCompare !== 0) return dateCompare;
  return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
}

export function getSupplyPurchases(supplyId, purchases) {
  return purchases
    .filter((purchase) => purchase.supplyId === supplyId)
    .sort(comparePurchases);
}

export function getSupplyCounts(supplyId, counts) {
  return counts
    .filter((count) => count.supplyId === supplyId)
    .sort(compareCounts);
}

/**
 * Devuelve el conteo más reciente que cumpla el filtro.
 */
export function getLatestCount(counts, supplyId, predicate = () => true) {
  const matches = counts
    .filter((count) => count.supplyId === supplyId && predicate(count))
    .sort(compareCounts);
  return matches.at(-1) ?? null;
}

export function getInitialCount(counts, supplyId, weekStart) {
  return getLatestCount(counts, supplyId, (count) => count.date <= weekStart);
}

export function getFinalCount(counts, supplyId, weekStart, weekEnd) {
  return getLatestCount(
    counts,
    supplyId,
    (count) => count.date > weekStart && count.date <= weekEnd
  );
}

export function getLastCount(counts, supplyId, throughDate = '9999-12-31') {
  return getLatestCount(counts, supplyId, (count) => count.date <= throughDate);
}

export function getPurchasesInRange(purchases, supplyId, start, end) {
  return purchases
    .filter(
      (purchase) =>
        purchase.supplyId === supplyId &&
        purchase.date >= start &&
        purchase.date <= end
    )
    .sort(comparePurchases);
}

export function getPurchasesBefore(purchases, supplyId, date) {
  return purchases
    .filter((purchase) => purchase.supplyId === supplyId && purchase.date < date)
    .sort(comparePurchases);
}

/**
 * Compras registradas después de un conteo (por fecha, o por createdAt
 * cuando comparten la misma fecha).
 *
 * `limitDate` es un límite superior opcional: solo cuentan las compras
 * con fecha hasta ese día. Sirve para que las compras de semanas
 * posteriores no invaliden los conteos de la semana que se revisa.
 */
export function getPurchasesAfterCount(purchases, supplyId, count, limitDate = null) {
  if (!count) return [];
  return purchases
    .filter((purchase) => {
      if (purchase.supplyId !== supplyId) return false;
      if (limitDate && purchase.date > limitDate) return false;
      if (purchase.date > count.date) return true;
      if (purchase.date < count.date) return false;
      return String(purchase.createdAt ?? '') > String(count.createdAt ?? '');
    })
    .sort(comparePurchases);
}

/**
 * Costo promedio ponderado por unidad base (g o ml).
 *
 * Se calcula con todas las compras registradas hasta la fecha indicada:
 *   suma de lo pagado / suma de unidades base compradas.
 *
 * Si todavía no hay compras, se usa el precio actual del catálogo.
 */
export function getWeightedAverageCost(supply, purchases, throughDate = null) {
  const relevant = purchases
    .filter(
      (purchase) =>
        purchase.supplyId === supply.id &&
        (!throughDate || purchase.date <= throughDate)
    )
    .sort(comparePurchases);

  let totalBase = 0;
  let totalCost = 0;

  for (const purchase of relevant) {
    const base = purchaseRecordBaseQuantity(purchase);
    if (base > 0) {
      totalBase += base;
      totalCost += Number(purchase.totalPaid) || 0;
    }
  }

  if (totalBase > 0) {
    return {
      costPerBase: totalCost / totalBase,
      totalBase,
      totalCost,
      source: 'purchases',
      purchaseCount: relevant.length
    };
  }

  const content = Number(supply.contentPerUnit) || 0;
  return {
    costPerBase: content > 0 ? (Number(supply.pricePerUnit) || 0) / content : 0,
    totalBase: 0,
    totalCost: 0,
    source: 'catalog',
    purchaseCount: 0
  };
}

/**
 * Inventario estimado de un insumo a una fecha:
 * último conteo + compras posteriores a ese conteo.
 *
 * Si nunca se ha hecho un conteo, devuelve quantity = null. No queremos
 * inventar que todo lo comprado sigue en existencia.
 */
export function getEstimatedInventory(supply, counts, purchases, asOfDate) {
  const lastCount = getLastCount(counts, supply.id, asOfDate);
  if (!lastCount) {
    return {
      quantity: null,
      lastCount: null,
      purchasesAfter: 0,
      hasCount: false
    };
  }

  const purchasesAfter = getPurchasesAfterCount(
    purchases,
    supply.id,
    lastCount,
    asOfDate
  );
  const added = purchasesAfter.reduce(
    (total, purchase) => total + purchaseRecordBaseQuantity(purchase),
    0
  );

  return {
    quantity: (Number(lastCount.quantity) || 0) + added,
    lastCount,
    purchasesAfter: added,
    hasCount: true
  };
}

export function hasPurchasesAfterCount(purchases, supplyId, count, limitDate = null) {
  return getPurchasesAfterCount(purchases, supplyId, count, limitDate).length > 0;
}

export function getLastPurchase(purchases, supplyId, throughDate = '9999-12-31') {
  return purchases
    .filter(
      (purchase) =>
        purchase.supplyId === supplyId && purchase.date <= throughDate
    )
    .sort(comparePurchases)
    .at(-1) ?? null;
}

/**
 * Consumo diario promedio de un insumo en las últimas `windowDays` días
 * (por defecto 4 semanas).
 *
 * Se calcula como: consumo total del periodo ÷ días del periodo, donde el
 * consumo es conteo inicial + compras del periodo − último conteo.
 * Devuelve null si no hay historial suficiente (sin conteos que abarquen
 * la ventana o sin consumo).
 */
export function averageDailyConsumption(
  counts,
  purchases,
  supply,
  asOfDate,
  windowDays = 28
) {
  const windowStart = addDays(asOfDate, -(windowDays - 1));
  const initial = getInitialCount(counts, supply.id, windowStart);
  const latest = getLastCount(counts, supply.id, asOfDate);
  if (!initial || !latest || latest.date < windowStart || latest.date <= initial.date) {
    return null;
  }

  const purchasedBase = sum(
    getPurchasesInRange(purchases, supply.id, windowStart, asOfDate).map(
      (purchase) => purchaseRecordBaseQuantity(purchase)
    )
  );
  const consumption =
    Number(initial.quantity) + purchasedBase - Number(latest.quantity);
  if (consumption <= 0) return null;
  return consumption / windowDays;
}

/**
 * Días que alcanza el inventario estimado de un insumo con el consumo
 * diario promedio. Devuelve null si no se puede calcular (sin conteos
 * recientes o sin historial de consumo).
 */
export function daysOfSupplyRemaining(supply, counts, purchases, asOfDate) {
  const estimate = getEstimatedInventory(supply, counts, purchases, asOfDate);
  if (estimate.quantity === null) return null;
  const daily = averageDailyConsumption(counts, purchases, supply, asOfDate);
  if (daily === null || daily <= 0) return null;
  return Math.floor(estimate.quantity / daily);
}
