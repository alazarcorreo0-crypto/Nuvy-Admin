import {
  buildMonthComparison,
  shiftMonth
} from '../core/monthly-cut.js';
import { formatDateLong } from '../core/dates.js';
import { baseQuantity, money, number } from '../core/format.js';
import {
  emptyState,
  escapeHtml,
  notice,
  pageHeader,
  statCard
} from '../ui/components.js';
import { icon } from '../ui/icons.js';
import { downloadCsv } from './shared.js';

function monthValue(ctx) {
  const stored = ctx.state.mensualMonth;
  if (typeof stored === 'string' && /^\d{4}-\d{2}$/.test(stored)) {
    return stored;
  }
  return ctx.today.slice(0, 7);
}

function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return date.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function percent(value, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—';
  }
  return `${number(Number(value) * 100, decimals)}%`;
}

function renderToolbar(ctx, month) {
  return `
    <div class="week-toolbar no-print">
      <div class="field">
        <label for="mensual-month">Mes que quieres revisar</label>
        <input id="mensual-month" name="month" type="month" value="${month}">
      </div>
      <div class="week-nav">
        <button class="button button-small" type="button" data-month-prev>${icon('arrowLeft')} Anterior</button>
        <button class="button button-small" type="button" data-month-current>Mes actual</button>
        <button class="button button-small" type="button" data-month-next>Siguiente ${icon('arrowRight')}</button>
      </div>
    </div>
  `;
}

/**
 * La escalera de utilidades del mes: de las ventas a la utilidad neta,
 * restando en orden y explicando cada paso.
 */
function renderIncomeStatement(cut) {
  const rows = [
    { label: 'Ventas', value: cut.totalSales, hint: `${cut.monthSales.length} venta${cut.monthSales.length === 1 ? '' : 's'} del mes`, strong: true },
    {
      label: '− Costo del producto vendido',
      value: -cut.productSoldCost,
      hint: 'Base y toppings vendidos, sin contar merma'
    },
    {
      label: '− Costo de la merma',
      value: -cut.totalWasteCost,
      hint: 'Lo que se derritió, se cayó o regalaste'
    },
    { label: '= Utilidad bruta', value: cut.grossProfit, hint: 'Lo que deja el producto', strong: true },
    {
      label: '− Gastos fijos',
      value: -cut.totalFixedExpenses,
      hint: 'Renta, luz, sueldos… con la parte de los recurrentes'
    },
    {
      label: '− Gastos variables',
      value: -cut.totalVariableExpenses,
      hint: 'Gasolina, imprevistos…'
    },
    {
      label: '− Insumos de apoyo consumidos',
      value: -(cut.supportSoldCost + cut.supportWasteCost),
      hint: 'Vasos, servilletas, bolsas…'
    },
    { label: '= Utilidad de operación', value: cut.operatingProfit, hint: 'El negocio antes de tus retiros', strong: true },
    {
      label: '− Retiros del dueño',
      value: -cut.ownerWithdrawals,
      hint: 'No son un gasto: es el dinero que te sacaste'
    },
    { label: '= Utilidad neta', value: cut.netProfit, hint: 'Lo que quedó del mes para ti', strong: true, final: true }
  ];

  return `
    <div class="detail-list">
      ${rows
        .map(
          (row) => `
            <div class="detail-row${row.strong ? ' strong' : ''}">
              <dt>
                ${escapeHtml(row.label)}
                <span class="detail-hint">${escapeHtml(row.hint)}</span>
              </dt>
              <dd class="${row.value < 0 ? 'is-negative' : ''}${row.final && row.value < 0 ? ' is-negative' : ''}">${money(row.value)}</dd>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

function renderComparison(ctx, cut) {
  const previous = ctx.store.getMonthlyCut(shiftMonth(cut.month, -1));
  const comparison = buildMonthComparison(cut, previous);

  if (!comparison.hasPrevious) {
    return notice({
      tone: 'info',
      iconName: 'chart',
      title: 'Sin comparación',
      text: 'El mes anterior no tiene ventas, gastos ni compras registradas. Cuando captures un mes más, aquí vas a ver si vas arriba o abajo.'
    });
  }

  return `
    <div class="compare-list">
      ${comparison.rows
        .map((row) => {
          const deltaText =
            row.changeType === 'flat'
              ? 'igual que el mes pasado'
              : row.changeType === 'new'
                ? 'nuevo: el mes pasado fue cero'
                : `${row.diff >= 0 ? '+' : '−'}${money(Math.abs(row.diff))} (${row.pct >= 0 ? '+' : '−'}${percent(Math.abs(row.pct), 0)})`;
          const arrow = row.changeType === 'changed' || row.changeType === 'new'
            ? icon(row.diff >= 0 ? 'arrowRight' : 'arrowLeft')
            : '';
          return `
            <div class="compare-row">
              <div class="compare-label">
                <strong>${escapeHtml(row.label)}</strong>
                <span>Del ${escapeHtml(monthLabel(shiftMonth(cut.month, -1)))}</span>
              </div>
              <div class="compare-value">
                <strong>${money(row.current)}</strong>
                <span class="compare-delta is-${row.tone}">${arrow} ${deltaText} vs mes anterior</span>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

/**
 * Meta del mes: barra de avance de ventas y tope de gastos.
 */
function renderGoal(ctx, cut) {
  const goal = ctx.store.getGoalFor(cut.month);
  if (!goal) {
    return notice({
      tone: 'info',
      iconName: 'calendar',
      title: 'Ponle una meta al mes',
      text: 'En Ajustes puedes fijar cuánto quieres vender y hasta dónde dejar los gastos. Aquí verías tu avance.',
      action: '<button class="button button-small button-soft" data-go="ajustes">Fijar meta</button>'
    });
  }

  const salesGoal = Number(goal.salesGoal) || 0;
  const expenseCap = Number(goal.expenseCap) || 0;
  const blocks = [];

  if (salesGoal > 0) {
    const pct = Math.min(100, (cut.totalSales / salesGoal) * 100);
    const missing = Math.max(0, salesGoal - cut.totalSales);
    blocks.push(`
      <div class="progress-block">
        <div class="progress-head">
          <strong>Meta de ventas</strong>
          <span>${money(cut.totalSales)} de ${money(salesGoal)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <p class="progress-foot">
          ${cut.totalSales >= salesGoal
            ? `¡Meta cumplida! Vas ${money(cut.totalSales - salesGoal)} arriba.`
            : `Faltan ${money(missing)} para llegar (${pct.toFixed(0)}%).`}
        </p>
      </div>
    `);
  }

  if (expenseCap > 0) {
    const pct = Math.min(100, (cut.totalExpenses / expenseCap) * 100);
    const over = Math.max(0, cut.totalExpenses - expenseCap);
    blocks.push(`
      <div class="progress-block">
        <div class="progress-head">
          <strong>Tope de gastos</strong>
          <span>${money(cut.totalExpenses)} de ${money(expenseCap)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill${over > 0 ? ' is-over' : ''}" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <p class="progress-foot">
          ${over > 0
            ? `Te pasaste del tope por ${money(over)}.`
            : `Dentro del tope: te quedan ${money(expenseCap - cut.totalExpenses)}.`}
        </p>
      </div>
    `);
  }

  return blocks.join('') || '';
}

function renderSupplyRows(cut) {
  if (cut.rows.length === 0) return '';

  return `
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Detalle por insumo</h2>
          <p>Consumo del mes: inventario inicial + compras del mes − inventario final. La merma se separa de lo vendido.</p>
        </div>
      </div>
      ${cut.rows
        .map((row) => {
          const initialText = row.initialCount
            ? baseQuantity(row.initialBase, row.baseUnit)
            : 'Sin conteo (0)';
          const finalText = row.finalBase === null ? 'Falta conteo' : baseQuantity(row.finalBase, row.baseUnit);
          return `
            <article class="cut-row">
              <div class="cut-row-head">
                <div>
                  <h3>${escapeHtml(row.supplyName)}</h3>
                  <p>
                    ${row.initialCount ? `Conteo inicial: ${formatDateLong(row.initialCount.date)}` : 'Sin conteo inicial registrado'}
                    ${row.finalDate ? ` · Conteo final: ${formatDateLong(row.finalDate)}` : ''}
                  </p>
                </div>
                ${row.missingFinal
                  ? '<span class="badge badge-danger">Falta conteo final</span>'
                  : '<span class="badge badge-success">Completo</span>'}
              </div>
              <div class="cut-grid">
                <div class="cut-cell">
                  <span>Inventario inicial</span>
                  <strong>${initialText}</strong>
                </div>
                <div class="cut-cell">
                  <span>Compras del mes</span>
                  <strong>+${baseQuantity(row.purchasedBase, row.baseUnit)}</strong>
                </div>
                <div class="cut-cell${row.missingFinal ? ' is-warning' : ''}">
                  <span>Inventario final</span>
                  <strong>${finalText}</strong>
                </div>
                <div class="cut-cell">
                  <span>Consumo</span>
                  <strong>${row.consumptionBase === null ? '—' : baseQuantity(row.consumptionBase, row.baseUnit)}</strong>
                </div>
                <div class="cut-cell">
                  <span>Vendido</span>
                  <strong>${row.soldBase === null ? '—' : baseQuantity(row.soldBase, row.baseUnit)}</strong>
                </div>
                <div class="cut-cell">
                  <span>Merma</span>
                  <strong>${row.billableWasteBase === null ? '—' : `${baseQuantity(row.billableWasteBase, row.baseUnit)} (${money(row.wasteCost)})`}</strong>
                </div>
                <div class="cut-cell">
                  <span>Costo del consumo</span>
                  <strong>${row.consumptionCost === null ? '—' : money(row.consumptionCost)}</strong>
                </div>
              </div>
              ${row.warnings.map((warning) => `<p class="cut-warning">${escapeHtml(warning)}</p>`).join('')}
            </article>
          `;
        })
        .join('')}
    </section>
  `;
}

export function render(ctx) {
  const month = monthValue(ctx);
  const cut = ctx.store.getMonthlyCut(month);

  const missingNotice = cut.complete
    ? ''
    : notice({
        tone: 'warning',
        iconName: 'alert',
        title: 'El mes está incompleto',
        text: cut.warnings.join(' ')
      });

  const noActivity =
    cut.monthSales.length === 0 &&
    cut.monthRegisteredExpenses.length === 0 &&
    cut.monthPurchases.length === 0 &&
    cut.rows.length === 0;

  if (noActivity) {
    return `
      ${pageHeader({
        eyebrow: 'Cómo va el mes',
        title: 'Corte mensual',
        subtitle: `Mes en revisión: ${monthLabel(month)}`,
        actions: '<button class="button button-small no-print" type="button" data-print-mensual>Imprimir</button>'
      })}
      ${renderToolbar(ctx, month)}
      ${emptyState({
        iconName: 'calendar',
        title: 'No hay actividad en este mes',
        text: 'Registra ventas, gastos, compras y conteos dentro del mes para poder calcular el corte mensual.',
        action: '<button class="button button-soft" data-go="ventas">Registrar una venta</button>'
      })}
    `;
  }

  const netTone = cut.netProfit < 0 ? ' is-negative' : '';
  const operatingTone = cut.operatingProfit < 0 ? ' is-negative' : '';

  return `
    ${pageHeader({
      eyebrow: 'Cómo va el mes',
      title: 'Corte mensual',
      subtitle: `Mes en revisión: ${monthLabel(month)}`,
      actions: '<button class="button button-small no-print" type="button" data-export-mensual>CSV</button><button class="button button-small no-print" type="button" data-print-mensual>Imprimir</button>'
    })}

    ${renderToolbar(ctx, month)}
    ${missingNotice}

    <section class="cut-hero">
      <p class="eyebrow" style="color:rgba(255,255,255,.78)">Corte mensual</p>
      <h2>${escapeHtml(monthLabel(month))}</h2>
      <p>Del ${formatDateLong(cut.start)} al ${formatDateLong(cut.end)}. Los gastos recurrentes se cobran por día, así que la renta mensual cae completa aquí.</p>
      <div class="cut-summary">
        <article class="stat-card cut-profit">
          <div class="stat-top">
            <span class="stat-label">Utilidad de operación</span>
            <span class="stat-icon">${icon('chart')}</span>
          </div>
          <strong class="stat-value${operatingTone}">${money(cut.operatingProfit)}</strong>
          <span class="stat-detail">Ventas − producto − merma − gastos fijos − gastos variables − insumos de apoyo. Antes de tus retiros.</span>
        </article>
        <article class="stat-card cut-profit">
          <div class="stat-top">
            <span class="stat-label">Utilidad neta del mes</span>
            <span class="stat-icon">${icon('cash')}</span>
          </div>
          <strong class="stat-value${netTone}">${money(cut.netProfit)}</strong>
          <span class="stat-detail">Utilidad de operación − retiros del dueño (${money(cut.ownerWithdrawals)}). Es lo que quedó del mes para ti.</span>
        </article>
      </div>
      <button class="button no-print" type="button" data-print-mensual>${icon('receipt')} Imprimir corte mensual</button>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>De las ventas a la utilidad neta</h2>
          <p>Cada renglón explica de dónde sale el siguiente.</p>
        </div>
      </div>
      <div class="card">
        ${renderIncomeStatement(cut)}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Resumen</h2>
          <p>Los números clave del mes.</p>
        </div>
      </div>
      <div class="stats-grid">
        ${statCard({
          label: 'Ventas del mes',
          value: money(cut.totalSales),
          detail: `${cut.monthSales.length} venta${cut.monthSales.length === 1 ? '' : 's'}${cut.tickets.hasTicketData ? ` · ticket promedio ${money(cut.tickets.averageTicket)}` : ''}`,
          tone: 'success',
          iconName: 'cash'
        })}
        ${statCard({
          label: 'Compras de insumos',
          value: money(cut.totalPurchases),
          detail: 'No se restan de la utilidad: quedan en inventario',
          tone: 'warning',
          iconName: 'cart'
        })}
        ${statCard({
          label: 'Costo de la merma',
          value: money(cut.totalWasteCost),
          detail: cut.totalWasteCost > 0 ? 'Registrada en Inventario → Registrar merma' : 'Sin merma registrada',
          tone: 'default',
          iconName: 'alert'
        })}
        ${statCard({
          label: 'Valor del inventario final',
          value: money(cut.totalFinalValue),
          detail: cut.complete ? 'Lo que quedó al cierre del mes' : 'Parcial: faltan conteos finales',
          tone: 'default',
          iconName: 'box'
        })}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Comparado con el mes anterior</h2>
          <p>Cómo te fue contra el mes pasado.</p>
        </div>
      </div>
      ${renderComparison(ctx, cut)}
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Tu meta del mes</h2>
          <p>Cómo va ${escapeHtml(monthLabel(month))} contra lo que te propusiste.</p>
        </div>
      </div>
      ${renderGoal(ctx, cut)}
    </section>

    ${renderSupplyRows(cut)}
  `;
}

export function bind(root, ctx) {
  const monthInput = root.querySelector('#mensual-month');
  const month = monthValue(ctx);

  monthInput?.addEventListener('change', () => {
    if (!/^\d{4}-\d{2}$/.test(monthInput.value)) return;
    ctx.state.mensualMonth = monthInput.value;
    ctx.refresh();
  });

  root.querySelector('[data-month-prev]')?.addEventListener('click', () => {
    ctx.state.mensualMonth = shiftMonth(month, -1);
    ctx.refresh();
  });

  root.querySelector('[data-month-next]')?.addEventListener('click', () => {
    ctx.state.mensualMonth = shiftMonth(month, 1);
    ctx.refresh();
  });

  root.querySelector('[data-month-current]')?.addEventListener('click', () => {
    ctx.state.mensualMonth = ctx.today.slice(0, 7);
    ctx.refresh();
  });

  root.querySelectorAll('[data-print-mensual]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  root.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => ctx.navigate(button.dataset.go));
  });

  root.querySelector('[data-export-mensual]')?.addEventListener('click', () => {
    const cut = ctx.store.getMonthlyCut(month);
    downloadCsv(
      `nuvy-mensual-${cut.month}.csv`,
      ['Renglón', 'Monto (MXN)'],
      [
        ['Ventas', cut.totalSales],
        ['Costo del producto vendido', cut.productSoldCost],
        ['Costo de la merma', cut.totalWasteCost],
        ['Utilidad bruta', cut.grossProfit],
        ['Gastos fijos', cut.totalFixedExpenses],
        ['Gastos variables', cut.totalVariableExpenses],
        ['Insumos de apoyo consumidos', cut.supportSoldCost + cut.supportWasteCost],
        ['Utilidad de operación', cut.operatingProfit],
        ['Retiros del dueño', cut.ownerWithdrawals],
        ['Utilidad neta', cut.netProfit]
      ]
    );
    ctx.toast('Corte mensual descargado en CSV.', 'success');
  });
}
