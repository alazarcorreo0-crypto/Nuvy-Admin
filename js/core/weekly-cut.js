import {
  addDays,
  daysBetweenDates,
  daysInMonth,
  formatDateMonthYear,
  getWeekRange,
  isDateInRange
} from './dates.js';
import { ceilTo, sum } from './format.js';
import {
  getFinalCount,
  getInitialCount,
  getPurchasesBefore,
  getPurchasesInRange,
  getWeightedAverageCost,
  hasPurchasesAfterCount
} from './inventory.js';
import {
  getSupplyType,
  purchaseRecordBaseQuantity,
  getBaseUnitLabel
} from './units.js';
import { APP_CONFIG } from '../config.js';

/**
 * Si el conteo inicial tiene más de estos días antes del sábado, el consumo
 * de la semana puede estar cobrando movimiento de varias semanas. No se
 * cambia el cálculo: solo se avisa.
 */
const STALE_INITIAL_COUNT_DAYS = 10;

/**
 * Calcula la cantidad sugerida de compra para la próxima semana.
 * - Bolsas y piezas se redondean hacia arriba (no se compran fracciones).
 * - kg y litros se redondean hacia arriba a 2 decimales.
 *
 * `neededBase` es lo que falta comprar, ya en unidad base (g, ml o piezas).
 */
export function suggestPurchaseQuantity(supply, neededBase) {
  const needed = Number(neededBase);
  const content = Number(supply?.contentPerUnit);
  if (!Number.isFinite(needed) || needed <= 0 || !(content > 0)) {
    return 0;
  }

  const units = needed / content;
  if (supply.purchaseUnit === 'bag' || supply.purchaseUnit === 'piece') {
    return Math.ceil(units - 1e-9);
  }
  return ceilTo(units, 2);
}

/* ── Gastos recurrentes y prorrateo ──────────────────────────────────────── */

/**
 * Cuántos días dura el periodo de un gasto:
 * - once: solo el día en que se registró.
 * - weekly: 7 días a partir de la fecha.
 * - fortnightly: 15 días a partir de la fecha.
 * - monthly: los días que tenga el mes de la fecha, a partir de la fecha.
 *
 * Los gastos viejos (sin periodo) se tratan como "once", así que los
 * números de cortes pasados no cambian.
 */
export function expensePeriodDays(expense) {
  const period = expense?.period ?? 'once';
  if (period === 'weekly') return 7;
  if (period === 'fortnightly') return 15;
  if (period === 'monthly') return daysInMonth(expense?.date);
  return 1;
}

/**
 * Cuánto de un gasto le toca a un periodo (por ejemplo, la semana del
 * corte o un mes).
 *
 * El periodo del gasto empieza en su fecha y dura `expensePeriodDays`.
 * Lo que se carga al rango es:
 *
 *   monto × (días traslapados ÷ días del periodo)
 *
 * Ejemplo: una renta mensual de $3,000 del 1 de noviembre le toca a la
 * semana del 7 al 13: $3,000 × 7 ÷ 30 = $700.
 */
export function proratedExpenseAmount(expense, rangeStart, rangeEnd) {
  const amount = Number(expense?.amount) || 0;
  const date = expense?.date;
  if (!amount || !date) return 0;

  const periodDays = expensePeriodDays(expense);

  // Un gasto de una sola vez (o viejo, sin periodo) cae entero en el rango
  // que contenga su fecha. Es exactamente el comportamiento de siempre.
  if (periodDays <= 1) {
    return isDateInRange(date, rangeStart, rangeEnd) ? amount : 0;
  }

  const periodEndExclusive = addDays(date, periodDays);
  const rangeEndExclusive = addDays(rangeEnd, 1);
  const overlapStart = date > rangeStart ? date : rangeStart;
  const overlapEndExclusive =
    periodEndExclusive < rangeEndExclusive ? periodEndExclusive : rangeEndExclusive;
  const overlapDays = daysBetweenDates(overlapStart, overlapEndExclusive);

  if (overlapDays === null || overlapDays <= 0) return 0;
  return amount * (overlapDays / periodDays);
}

/* ── Filas por insumo (semanal y mensual) ───────────────────────────────── */

/**
 * Calcula el consumo de cada insumo dentro de un rango de fechas por
 * diferencia de conteos:
 *
 *   inventario inicial + compras del rango − inventario final
 *
 * La merma registrada en el rango se separa del consumo:
 *
 *   consumo vendido = consumo total − merma
 *
 * Es la misma cuenta para la semana y para el mes; lo único que cambia
 * es el rango.
 */
export function buildSupplyRows({
  supplies,
  purchases,
  counts,
  wastes = [],
  rangeStart,
  rangeEnd,
  staleInitialDays = STALE_INITIAL_COUNT_DAYS
}) {
  return supplies.map((supply) => {
    const baseUnit = getBaseUnitLabel(supply);
    const typeConfig = getSupplyType(supply.type);
    // Los insumos de tipos fijos (base, topping seco y líquido) forman parte
    // del producto que se vende por gramo. Los tipos personalizados
    // (desechables, limpieza, empaques) son de apoyo: su consumo se suma
    // a los gastos para el punto de equilibrio.
    const isProductSupply = !typeConfig.custom;
    const initialCount = getInitialCount(counts, supply.id, rangeStart);
    const initialCountAgeDays = initialCount
      ? daysBetweenDates(initialCount.date, rangeStart)
      : null;
    const finalCandidate = getFinalCount(counts, supply.id, rangeStart, rangeEnd);
    // Las compras solo invalidan el conteo final si caen dentro del mismo
    // rango del corte: una compra posterior pertenece a otro periodo y no
    // debe afectar este corte.
    const finalIsStale =
      Boolean(finalCandidate) &&
      hasPurchasesAfterCount(purchases, supply.id, finalCandidate, rangeEnd);

    const finalCount = finalIsStale ? null : finalCandidate;
    const initialBase = initialCount ? Number(initialCount.quantity) || 0 : 0;
    const supplyPurchases = getPurchasesInRange(
      purchases,
      supply.id,
      rangeStart,
      rangeEnd
    );
    const purchasedBase = sum(
      supplyPurchases.map((purchase) => purchaseRecordBaseQuantity(purchase))
    );
    const purchasesBefore = getPurchasesBefore(purchases, supply.id, rangeStart);
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

    // Merma del rango: solo cuenta la parte que el consumo total puede
    // explicar (si registras más merma que consumo, avisamos).
    const supplyWastes = wastes.filter(
      (waste) =>
        waste.supplyId === supply.id && isDateInRange(waste.date, rangeStart, rangeEnd)
    );
    const registeredWasteBase = sum(
      supplyWastes.map((waste) => Number(waste.quantity) || 0)
    );
    const billableWasteBase =
      consumptionBase === null
        ? null
        : Math.min(registeredWasteBase, Math.max(0, consumptionBase));
    const soldBase =
      consumptionBase === null
        ? null
        : Math.max(0, consumptionBase - (billableWasteBase ?? 0));

    const costInfo = getWeightedAverageCost(supply, purchases, rangeEnd);
    const consumptionCost =
      consumptionBase === null ? null : consumptionBase * costInfo.costPerBase;
    const wasteCost =
      billableWasteBase === null ? null : billableWasteBase * costInfo.costPerBase;
    const soldCost = soldBase === null ? null : soldBase * costInfo.costPerBase;
    const finalValue =
      finalBase === null ? null : finalBase * costInfo.costPerBase;

    const warnings = [];
    if (missingFinal) {
      warnings.push(
        finalIsStale
          ? 'Hay compras después del último conteo; registra un conteo final nuevo.'
          : 'Falta el conteo físico final del periodo.'
      );
    }
    if (!initialCount && purchasedBeforeBase > 0) {
      warnings.push(
        'No hay conteo inicial; se asumió 0. Si ya tenías inventario, registra un conteo con fecha de inicio.'
      );
    }
    if (initialCountAgeDays !== null && initialCountAgeDays > staleInitialDays) {
      const days = initialCountAgeDays;
      warnings.push(
        `Tu conteo inicial es del ${formatDateMonthYear(initialCount.date)} (hace ${days} día${days === 1 ? '' : 's'}). El consumo de este periodo puede estar inflado; registra un conteo más reciente.`
      );
    }
    if (consumptionBase !== null && consumptionBase < 0) {
      warnings.push(
        'El conteo final es mayor que el inventario inicial más las compras. Revisa los conteos.'
      );
    }
    if (registeredWasteBase > 0 && consumptionBase !== null && registeredWasteBase > Math.max(0, consumptionBase)) {
      warnings.push(
        'Registraste más merma que el consumo calculado. Revisa los conteos y la merma; solo se descuenta la parte que alcanza.'
      );
    }

    return {
      supply,
      supplyId: supply.id,
      supplyName: supply.name,
      baseUnit,
      isProductSupply,
      initialCount,
      initialBase,
      initialCountAgeDays,
      finalCount,
      finalBase,
      finalDate: finalCount?.date ?? null,
      finalCandidate,
      finalIsStale,
      purchasedBase,
      purchasedBeforeBase,
      weekPurchases: supplyPurchases,
      rangePurchases: supplyPurchases,
      consumptionBase,
      missingFinal,
      costPerBase: costInfo.costPerBase,
      costSource: costInfo.source,
      consumptionCost,
      finalValue,
      warnings,
      hasActivity,
      // Merma y consumo vendido
      wastes: supplyWastes,
      registeredWasteBase,
      billableWasteBase,
      wasteCost,
      soldBase,
      soldCost
    };
  });
}

/* ── Resúmenes de gastos ────────────────────────────────────────────────── */

function withProratedAmount(expenses, rangeStart, rangeEnd) {
  return expenses
    .map((expense) => ({
      ...expense,
      proratedAmount: proratedExpenseAmount(expense, rangeStart, rangeEnd)
    }))
    .filter((expense) => expense.proratedAmount > 0);
}

/* ── Corte semanal ──────────────────────────────────────────────────────── */

/**
 * Construye el corte semanal completo (sábado a viernes).
 *
 * Dinero:
 * - `profit` (ganancia contable) = ventas − gastos prorrateados − costo de
 *   lo consumido (vendido + merma).
 * - `cashFlow` (dinero que queda) = ventas − gastos pagados − compras −
 *   retiros del dueño.
 */
export function buildWeeklyCut({
  anchorDate,
  supplies,
  purchases,
  sales,
  expenses,
  counts,
  wastes = [],
  cushionPercent = APP_CONFIG.purchaseCushionPercent
}) {
  const { start, end } = getWeekRange(anchorDate);

  const weekPurchases = purchases.filter((purchase) =>
    isDateInRange(purchase.date, start, end)
  );
  const weekSales = sales.filter((sale) => isDateInRange(sale.date, start, end));
  const weekRegisteredExpenses = expenses.filter((expense) =>
    isDateInRange(expense.date, start, end)
  );

  // Gastos que le tocan a esta semana, con la parte prorrateada de los
  // recurrentes. Los gastos normales (sin periodo) caen completos, igual
  // que siempre.
  const weekExpenses = withProratedAmount(expenses, start, end);
  const operatingExpenses = weekExpenses.filter(
    (expense) => expense.category !== 'owner'
  );
  const ownerExpenseRecords = weekExpenses.filter(
    (expense) => expense.category === 'owner'
  );

  const weekFixedExpenses = operatingExpenses.filter(
    (expense) => expense.category === 'fixed'
  );
  const weekVariableExpenses = operatingExpenses.filter(
    (expense) => expense.category !== 'fixed'
  );

  const totalSales = sum(weekSales.map((sale) => sale.amount));
  const totalExpenses = sum(
    operatingExpenses.map((expense) => expense.proratedAmount)
  );
  const totalFixedExpenses = sum(
    weekFixedExpenses.map((expense) => expense.proratedAmount)
  );
  const totalVariableExpenses = sum(
    weekVariableExpenses.map((expense) => expense.proratedAmount)
  );
  const totalProratedOwnerWithdrawals = sum(
    ownerExpenseRecords.map((expense) => expense.proratedAmount)
  );

  const rows = buildSupplyRows({
    supplies,
    purchases,
    counts,
    wastes,
    rangeStart: start,
    rangeEnd: end
  });

  // Compra sugerida: consumo + colchón − inventario que quedó.
  const rowsWithSuggestions = rows.map((row) => {
    const stockBase = row.finalBase;
    const targetBase =
      row.consumptionBase === null
        ? null
        : Math.max(0, row.consumptionBase) * (1 + cushionPercent / 100);
    const neededBase =
      row.consumptionBase === null || stockBase === null
        ? null
        : Math.max(0, targetBase - stockBase);
    const suggested =
      neededBase === null ? null : suggestPurchaseQuantity(row.supply, neededBase);

    return {
      ...row,
      stockBase,
      targetBase,
      neededBase,
      suggested,
      cushionPercent
    };
  });

  const visibleRows = rowsWithSuggestions.filter(
    (row) => row.hasActivity || row.missingFinal
  );
  const complete = visibleRows.every((row) => !row.missingFinal);
  const missingCounts = visibleRows
    .filter((row) => row.missingFinal)
    .map((row) => row.supplyName);

  const measuredRows = visibleRows.filter(
    (row) => row.consumptionBase !== null
  );
  const productRows = measuredRows.filter((row) => row.isProductSupply);
  const supportRows = measuredRows.filter((row) => !row.isProductSupply);

  const productSoldCost = sum(productRows.map((row) => row.soldCost));
  const supportSoldCost = sum(supportRows.map((row) => row.soldCost));
  const productWasteBase = sum(productRows.map((row) => row.billableWasteBase));
  const productWasteCost = sum(productRows.map((row) => row.wasteCost));
  const supportWasteBase = sum(supportRows.map((row) => row.billableWasteBase));
  const supportWasteCost = sum(supportRows.map((row) => row.wasteCost));
  const totalWasteCost = productWasteCost + supportWasteCost;
  const totalWasteBase = productWasteBase + supportWasteBase;
  // Gramos de mezcla vendidos: los tipos de producto se miden en g o ml
  // y la app toma 1 L como 1 kg, así que se suman directo.
  const productSoldBase = sum(productRows.map((row) => row.soldBase));

  const totalSoldCost = productSoldCost + supportSoldCost;
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

  // Ganancia contable: resta lo vendido, la merma y los gastos prorrateados.
  const profit = totalSales - totalExpenses - totalSoldCost - totalWasteCost;

  // ── Flujo de efectivo ───────────────────────────────────────────────────
  // Lo que de verdad entró y salió de la caja en la semana. Los retiros
  // del dueño no son un gasto del negocio: aquí se muestran por separado.
  const expensesPaid = sum(
    weekRegisteredExpenses
      .filter((expense) => expense.category !== 'owner')
      .map((expense) => expense.amount)
  );
  const ownerWithdrawals = sum(
    weekRegisteredExpenses
      .filter((expense) => expense.category === 'owner')
      .map((expense) => expense.amount)
  );
  const cashFlow = {
    salesIn: totalSales,
    expensesPaid,
    purchasesPaid: totalPurchases,
    ownerWithdrawals,
    remaining: totalSales - expensesPaid - totalPurchases - ownerWithdrawals
  };

  // ── Tickets promedio ────────────────────────────────────────────────────
  const ticketSales = weekSales.filter(
    (sale) => Number.isInteger(Number(sale.tickets)) && Number(sale.tickets) > 0
  );
  const totalTickets = sum(ticketSales.map((sale) => sale.tickets));
  const ticketSalesAmount = sum(ticketSales.map((sale) => sale.amount));
  const averageTicket = totalTickets > 0 ? ticketSalesAmount / totalTickets : null;
  const gramsPerCustomer =
    totalTickets > 0 && productSoldBase > 0 ? productSoldBase / totalTickets : null;

  // ── Análisis de viabilidad ──────────────────────────────────────────────
  // Solo se calcula cuando hay conteos: sin conteos no hay consumo conocido.
  const hasProductData = productSoldBase > 0;
  const costPerGram = hasProductData
    ? productSoldCost / productSoldBase
    : null;
  // Precio al que de verdad estás vendiendo el gramo: lo vendido dividido
  // entre los gramos de producto que se vendieron (sin contar merma).
  const effectivePricePerGram = hasProductData
    ? totalSales / productSoldBase
    : null;
  const marginPerGram =
    effectivePricePerGram !== null && costPerGram !== null
      ? effectivePricePerGram - costPerGram
      : null;

  const grossMargin = totalSales - productSoldCost;
  const grossMarginPct = totalSales > 0 ? grossMargin / totalSales : null;

  // Todo lo que hay que cubrir antes de ganar: gastos fijos, gastos
  // variables, el costo de los insumos de apoyo consumidos y la merma.
  const totalOverheads =
    totalFixedExpenses +
    totalVariableExpenses +
    supportSoldCost +
    totalWasteCost;

  // Ventas necesarias para no perder dinero en la semana. Solo tiene
  // sentido si se conoce el costo del producto (con conteos).
  const breakEvenSales =
    hasProductData && grossMarginPct !== null && grossMarginPct > 0
      ? totalOverheads / grossMarginPct
      : null;
  // Gramos que habría que vender para cubrir lo mismo.
  const breakEvenGrams =
    marginPerGram !== null && marginPerGram > 0
      ? totalOverheads / marginPerGram
      : null;

  const viable = complete && hasProductData && profit >= 0;

  // Food cost: del costo del producto vendido entre las ventas.
  const foodCostPct =
    hasProductData && totalSales > 0 ? productSoldCost / totalSales : null;
  const expenseRatioPct =
    totalSales > 0 ? totalExpenses / totalSales : null;

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
      consumptionCost: row.consumptionCost,
      stockBase: row.stockBase,
      targetBase: row.targetBase,
      neededBase: row.neededBase,
      cushionPercent: row.cushionPercent
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
    weekRegisteredExpenses,
    weekExpenses,
    weekFixedExpenses,
    weekVariableExpenses,
    weekPurchases,
    totalSales,
    totalExpenses,
    totalFixedExpenses,
    totalVariableExpenses,
    totalPurchases,
    totalConsumptionCost,
    totalSoldCost,
    totalFinalValue,
    profit,
    cashFlow,
    ownerWithdrawals,
    totalProratedOwnerWithdrawals,
    foodCostPct,
    expenseRatioPct,
    tickets: {
      ticketSalesCount: ticketSales.length,
      totalTickets,
      averageTicket,
      gramsPerCustomer,
      hasTicketData: totalTickets > 0
    },
    waste: {
      totalWasteBase,
      totalWasteCost,
      productWasteBase,
      productWasteCost,
      supportWasteBase,
      supportWasteCost,
      hasWaste: totalWasteCost > 0
    },
    rows: visibleRows,
    allRows: rowsWithSuggestions,
    suggestions,
    missingCounts,
    complete,
    warnings,
    viability: {
      hasProductData,
      productConsumptionBase: productSoldBase,
      productConsumptionCost: productSoldCost,
      productWasteBase,
      productWasteCost,
      supportConsumptionCost: supportSoldCost,
      supportWasteCost,
      costPerGram,
      effectivePricePerGram,
      marginPerGram,
      grossMargin,
      grossMarginPct,
      totalOverheads,
      breakEvenSales,
      breakEvenGrams,
      viable
    }
  };
}

/* ── Comparación contra la semana anterior ───────────────────────────────── */

/**
 * ¿La semana tuvo movimiento? Si no, no tiene sentido comparar.
 */
export function hasWeekActivity(cut) {
  if (!cut) return false;
  return (
    (cut.weekSales?.length ?? 0) > 0 ||
    (cut.weekRegisteredExpenses?.length ?? 0) > 0 ||
    (cut.weekPurchases?.length ?? 0) > 0 ||
    (cut.rows?.length ?? 0) > 0
  );
}

/**
 * Compara el corte de esta semana contra el de la anterior.
 *
 * Cada fila trae: valores actual/anterior, diferencia, porcentaje y
 * tono (good/bad/neutral). Si la semana anterior no tiene datos,
 * `hasPrevious` es false y la vista muestra "sin comparación".
 */
export function buildWeekComparison(current, previous) {
  const hasPrevious = hasWeekActivity(previous);
  const prev = previous ?? null;

  const entries = [
    {
      key: 'sales',
      label: 'Ventas',
      hint: 'Lo que entró',
      current: current.totalSales,
      previous: prev?.totalSales ?? 0,
      isMoney: true,
      invert: false
    },
    {
      key: 'expenses',
      label: 'Gastos',
      hint: 'Con la parte de los recurrentes',
      current: current.totalExpenses,
      previous: prev?.totalExpenses ?? 0,
      isMoney: true,
      invert: true
    },
    {
      key: 'productCost',
      label: 'Costo del producto',
      hint: 'Lo que vendiste en insumo',
      current: current.viability?.productConsumptionCost ?? 0,
      previous: prev?.viability?.productConsumptionCost ?? 0,
      isMoney: true,
      invert: true
    },
    {
      key: 'profit',
      label: 'Ganancia',
      hint: 'La contable del corte',
      current: current.profit,
      previous: prev?.profit ?? 0,
      isMoney: true,
      invert: false
    },
    {
      key: 'grams',
      label: 'Gramos vendidos',
      hint: 'Producto servido a clientes',
      current: current.viability?.productConsumptionBase ?? 0,
      previous: prev?.viability?.productConsumptionBase ?? 0,
      isMoney: false,
      invert: false
    }
  ];

  const rows = entries.map((entry) => {
    const diff = entry.current - entry.previous;
    let pct = null;
    let tone = 'neutral';
    let changeType = 'flat';

    if (hasPrevious) {
      if (entry.previous === 0) {
        changeType = entry.current > 0 ? 'new' : 'flat';
        tone = entry.current > 0 ? (entry.invert ? 'bad' : 'good') : 'neutral';
      } else {
        pct = diff / Math.abs(entry.previous);
        if (Math.abs(diff) < 0.005) {
          changeType = 'flat';
          tone = 'neutral';
        } else {
          changeType = 'changed';
          const wentUp = diff > 0;
          tone = wentUp === entry.invert ? 'bad' : 'good';
        }
      }
    }

    return { ...entry, diff, pct, tone, changeType, hasPrevious };
  });

  return { hasPrevious, rows };
}
