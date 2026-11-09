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

export function getPurchasesAfterCount(purchases, supplyId, count) {
  if (!count) return [];
  return purchases
    .filter((purchase) => {
      if (purchase.supplyId !== supplyId) return false;
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

  const purchasesAfter = getPurchasesAfterCount(purchases, supply.id, lastCount)
    .filter((purchase) => purchase.date <= asOfDate);
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

export function hasPurchasesAfterCount(purchases, supplyId, count) {
  return getPurchasesAfterCount(purchases, supplyId, count).length > 0;
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
