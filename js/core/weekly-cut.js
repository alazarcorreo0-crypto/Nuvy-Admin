import { getWeekRange, isDateInRange } from './dates.js';
import { ceilTo, sum } from './format.js';
import {
  getFinalCount,
  getInitialCount,
  getPurchasesBefore,
  getPurchasesInRange,
  getWeightedAverageCost,
  hasPurchasesAfterCount
} from './inventory.js';
import { purchaseRecordBaseQuantity, getBaseUnitLabel } from './units.js';

/**
 * Calcula la cantidad sugerida de compra para la próxima semana.
 * - Bolsas y piezas se redondean hacia arriba (no se compran fracciones).
 * - kg y litros se redondean hacia arriba a 2 decimales.
 */
export function suggestPurchaseQuantity(supply, consumptionBase) {
  const consumption = Number(consumptionBase);
  const content = Number(supply?.contentPerUnit);
  if (!Number.isFinite(consumption) || consumption <= 0 || !(content > 0)) {
    return 0;
  }

  const units = consumption / content;
  if (supply.purchaseUnit === 'bag' || supply.purchaseUnit === 'piece') {
    return Math.ceil(units - 1e-9);
  }
  return ceilTo(units, 2);
}

/**
 * Construye el corte semanal completo (sábado a viernes).
 *
 * El consumo de cada insumo se calcula por diferencia:
 *   inventario inicial + compras de la semana - inventario final
 *
 * No se descuenta nada por ventas.
 */
export function buildWeeklyCut({
  anchorDate,
  supplies,
  purchases,
  sales,
  expenses,
  counts
}) {
  const { start, end } = getWeekRange(anchorDate);

  const weekPurchases = purchases.filter((purchase) =>
    isDateInRange(purchase.date, start, end)
  );
  const weekSales = sales.filter((sale) => isDateInRange(sale.date, start, end));
  const weekExpenses = expenses.filter((expense) =>
    isDateInRange(expense.date, start, end)
  );

  const totalSales = sum(weekSales.map((sale) => sale.amount));
  const totalExpenses = sum(weekExpenses.map((expense) => expense.amount));

  const rows = supplies.map((supply) => {
    const baseUnit = getBaseUnitLabel(supply);
    const initialCount = getInitialCount(counts, supply.id, start);
    const finalCandidate = getFinalCount(counts, supply.id, start, end);
    const finalIsStale =
      Boolean(finalCandidate) &&
      hasPurchasesAfterCount(purchases, supply.id, finalCandidate);

    const finalCount = finalIsStale ? null : finalCandidate;
    const initialBase = initialCount ? Number(initialCount.quantity) || 0 : 0;
    const supplyPurchases = getPurchasesInRange(
      purchases,
      supply.id,
      start,
      end
    );
    const purchasedBase = sum(
      supplyPurchases.map((purchase) => purchaseRecordBaseQuantity(purchase))
    );
    const purchasesBefore = getPurchasesBefore(purchases, supply.id, start);
    const purchasedBeforeBase = sum(
      purchasesBefore.map((purchase) => purchaseRecordBaseQuantity(purchase))
    );
    const finalBase = finalCount ? Number(finalCount.quantity) || 0 : null;

    const hasActivity =
      initialBase > 0 ||
      purchasedBase > 0 ||
      purchasedBeforeBase > 0 ||
      (finalBase ?? 0) > 0;

    const missingFinal = hasActivity && finalBase === null;
    const consumptionBase =
      finalBase === null ? null : initialBase + purchasedBase - finalBase;

    const costInfo = getWeightedAverageCost(supply, purchases, end);
    const consumptionCost =
      consumptionBase === null ? null : consumptionBase * costInfo.costPerBase;
    const finalValue =
      finalBase === null ? null : finalBase * costInfo.costPerBase;
    const suggested = consumptionBase === null
      ? null
      : suggestPurchaseQuantity(supply, Math.max(0, consumptionBase));

    const warnings = [];
    if (missingFinal) {
      warnings.push(
        finalIsStale
          ? 'Hay compras después del último conteo; registra un conteo final nuevo.'
          : 'Falta el conteo físico final de la semana.'
      );
    }
    if (!initialCount && purchasedBeforeBase > 0) {
      warnings.push(
        'No hay conteo inicial; se asumió 0. Si ya tenías inventario, registra un conteo con fecha de inicio.'
      );
    }
    if (consumptionBase !== null && consumptionBase < 0) {
      warnings.push(
        'El conteo final es mayor que el inventario inicial más las compras. Revisa los conteos.'
      );
    }

    return {
      supply,
      supplyId: supply.id,
      supplyName: supply.name,
      baseUnit,
      initialCount,
      initialBase,
      finalCount,
      finalBase,
      finalDate: finalCount?.date ?? null,
      finalCandidate,
      finalIsStale,
      purchasedBase,
      purchasedBeforeBase,
      weekPurchases: supplyPurchases,
      consumptionBase,
      missingFinal,
      costPerBase: costInfo.costPerBase,
      costSource: costInfo.source,
      consumptionCost,
      finalValue,
      suggested,
      warnings,
      hasActivity
    };
  });

  const visibleRows = rows.filter((row) => row.hasActivity || row.missingFinal);
  const complete = visibleRows.every((row) => !row.missingFinal);
  const missingCounts = visibleRows
    .filter((row) => row.missingFinal)
    .map((row) => row.supplyName);

  const totalConsumptionCost = sum(
    visibleRows
      .map((row) => row.consumptionCost)
      .filter((value) => value !== null)
  );
  const totalFinalValue = sum(
    visibleRows.map((row) => row.finalValue).filter((value) => value !== null)
  );
  const totalPurchases = sum(
    weekPurchases.map((purchase) => purchase.totalPaid)
  );
  const profit = totalSales - totalExpenses - totalConsumptionCost;

  const suggestions = visibleRows
    .filter((row) => Number(row.suggested) > 0)
    .map((row) => ({
      supplyId: row.supplyId,
      name: row.supplyName,
      quantity: row.suggested,
      unit: row.supply.purchaseUnit,
      baseQuantity: row.suggested * row.supply.contentPerUnit,
      baseUnit: row.baseUnit,
      consumptionBase: row.consumptionBase,
      consumptionCost: row.consumptionCost
    }));

  const warnings = [];
  if (!complete) {
    warnings.push(
      `Faltan conteos finales para: ${missingCounts.join(', ')}. El corte está incompleto.`
    );
  }

  return {
    start,
    end,
    weekSales,
    weekExpenses,
    weekPurchases,
    totalSales,
    totalExpenses,
    totalPurchases,
    totalConsumptionCost,
    totalFinalValue,
    profit,
    rows: visibleRows,
    allRows: rows,
    suggestions,
    missingCounts,
    complete,
    warnings
  };
}
