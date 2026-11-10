import { isDateInRange } from './dates.js';
import { sum } from './format.js';
import { buildSupplyRows, proratedExpenseAmount } from './weekly-cut.js';

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthString(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

/**
 * '2026-11' → { start: '2026-11-01', end: '2026-11-30' }
 */
export function monthRange(monthString) {
  if (!isValidMonthString(monthString)) {
    throw new Error(`Mes inválido: ${monthString}`);
  }
  const [year, month] = monthString.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value) => String(value).padStart(2, '0');
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`
  };
}

/**
 * '2026-11' con delta −1 → '2026-10'. Sirve para comparar contra el mes
 * anterior.
 */
export function shiftMonth(monthString, delta) {
  if (!isValidMonthString(monthString)) {
    throw new Error(`Mes inválido: ${monthString}`);
  }
  const [year, month] = monthString.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  const pad = (value) => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}`;
}

/**
 * Corte mensual: la misma lógica del corte semanal pero para el mes de
 * calendario completo.
 *
 * La tabla que produce:
 *   ventas
 *   − costo del producto vendido − merma        = utilidad bruta
 *   − gastos fijos − gastos variables            = utilidad de operación
 *   − retiros del dueño                          = utilidad neta
 *
 * Los gastos recurrentes se prorratean al mes igual que en el corte
 * semanal. Los retiros del dueño no son un gasto: van por separado.
 */
export function buildMonthlyCut({
  month,
  supplies,
  purchases,
  sales,
  expenses,
  counts,
  wastes = []
}) {
  const { start, end } = monthRange(month);

  const monthSales = sales.filter((sale) => isDateInRange(sale.date, start, end));
  const monthPurchases = purchases.filter((purchase) =>
    isDateInRange(purchase.date, start, end)
  );
  const monthRegisteredExpenses = expenses.filter((expense) =>
    isDateInRange(expense.date, start, end)
  );

  const monthExpenses = expenses
    .map((expense) => ({
      ...expense,
      proratedAmount: proratedExpenseAmount(expense, start, end)
    }))
    .filter((expense) => expense.proratedAmount > 0);
  const operatingExpenses = monthExpenses.filter(
    (expense) => expense.category !== 'owner'
  );
  const monthFixedExpenses = operatingExpenses.filter(
    (expense) => expense.category === 'fixed'
  );
  const monthVariableExpenses = operatingExpenses.filter(
    (expense) => expense.category !== 'fixed'
  );
  const ownerWithdrawalRecords = monthExpenses.filter(
    (expense) => expense.category === 'owner'
  );

  const rows = buildSupplyRows({
    supplies,
    purchases,
    counts,
    wastes,
    rangeStart: start,
    rangeEnd: end,
    // En un mes es normal que el conteo inicial tenga hasta ~5 semanas.
    staleInitialDays: 35
  });

  const visibleRows = rows.filter((row) => row.hasActivity || row.missingFinal);
  const complete = visibleRows.every((row) => !row.missingFinal);
  const missingCounts = visibleRows
    .filter((row) => row.missingFinal)
    .map((row) => row.supplyName);

  const measuredRows = visibleRows.filter((row) => row.consumptionBase !== null);
  const productRows = measuredRows.filter((row) => row.isProductSupply);
  const supportRows = measuredRows.filter((row) => !row.isProductSupply);

  const productSoldCost = sum(productRows.map((row) => row.soldCost));
  const productWasteCost = sum(productRows.map((row) => row.wasteCost));
  const productSoldBase = sum(productRows.map((row) => row.soldBase));
  const supportSoldCost = sum(supportRows.map((row) => row.soldCost));
  const supportWasteCost = sum(supportRows.map((row) => row.wasteCost));
  const totalWasteCost = productWasteCost + supportWasteCost;

  const totalSales = sum(monthSales.map((sale) => sale.amount));
  const totalFixedExpenses = sum(
    monthFixedExpenses.map((expense) => expense.proratedAmount)
  );
  const totalVariableExpenses = sum(
    monthVariableExpenses.map((expense) => expense.proratedAmount)
  );
  const ownerWithdrawals = sum(
    ownerWithdrawalRecords.map((expense) => expense.proratedAmount)
  );
  const totalPurchases = sum(
    monthPurchases.map((purchase) => purchase.totalPaid)
  );

  const grossProfit = totalSales - productSoldCost - productWasteCost;
  const operatingProfit =
    grossProfit -
    totalFixedExpenses -
    totalVariableExpenses -
    supportSoldCost -
    supportWasteCost;
  const netProfit = operatingProfit - ownerWithdrawals;

  const totalConsumptionCost = sum(
    visibleRows
      .map((row) => row.consumptionCost)
      .filter((value) => value !== null)
  );
  const totalFinalValue = sum(
    visibleRows.map((row) => row.finalValue).filter((value) => value !== null)
  );

  const warnings = [];
  if (!complete) {
    warnings.push(
      `Faltan conteos para: ${missingCounts.join(', ')}. El mes está incompleto y el consumo es parcial.`
    );
  }

  const ticketSales = monthSales.filter(
    (sale) => Number.isInteger(Number(sale.tickets)) && Number(sale.tickets) > 0
  );
  const totalTickets = sum(ticketSales.map((sale) => sale.tickets));
  const averageTicket =
    totalTickets > 0
      ? sum(ticketSales.map((sale) => sale.amount)) / totalTickets
      : null;

  return {
    month,
    start,
    end,
    monthSales,
    monthPurchases,
    monthRegisteredExpenses,
    monthExpenses,
    monthFixedExpenses,
    monthVariableExpenses,
    rows: visibleRows,
    allRows: rows,
    complete,
    missingCounts,
    warnings,
    totalSales,
    totalPurchases,
    totalConsumptionCost,
    totalFinalValue,
    productSoldCost,
    productWasteCost,
    productSoldBase,
    supportSoldCost,
    supportWasteCost,
    totalWasteCost,
    totalFixedExpenses,
    totalVariableExpenses,
    totalExpenses: totalFixedExpenses + totalVariableExpenses,
    grossProfit,
    operatingProfit,
    ownerWithdrawals,
    netProfit,
    tickets: {
      totalTickets,
      averageTicket,
      hasTicketData: totalTickets > 0
    }
  };
}

/**
 * ¿El mes tuvo movimiento? Se usa para decidir si se muestra la
 * comparación contra el mes anterior.
 */
export function hasMonthActivity(cut) {
  if (!cut) return false;
  return (
    (cut.monthSales?.length ?? 0) > 0 ||
    (cut.monthRegisteredExpenses?.length ?? 0) > 0 ||
    (cut.monthPurchases?.length ?? 0) > 0 ||
    (cut.rows?.length ?? 0) > 0
  );
}

/**
 * Compara el mes actual contra el anterior, con las mismas ideas que la
 * comparación semanal.
 */
export function buildMonthComparison(current, previous) {
  const hasPrevious = hasMonthActivity(previous);
  const prev = previous ?? null;

  const entries = [
    {
      key: 'sales',
      label: 'Ventas',
      current: current.totalSales,
      previous: prev?.totalSales ?? 0,
      isMoney: true,
      invert: false
    },
    {
      key: 'expenses',
      label: 'Gastos fijos + variables',
      current: current.totalExpenses,
      previous: prev?.totalExpenses ?? 0,
      isMoney: true,
      invert: true
    },
    {
      key: 'productCost',
      label: 'Costo del producto vendido',
      current: current.productSoldCost,
      previous: prev?.productSoldCost ?? 0,
      isMoney: true,
      invert: true
    },
    {
      key: 'netProfit',
      label: 'Utilidad neta',
      current: current.netProfit,
      previous: prev?.netProfit ?? 0,
      isMoney: true,
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
