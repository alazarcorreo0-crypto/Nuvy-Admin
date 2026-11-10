import {
  addDays,
  formatDateLong,
  formatWeekRange,
  getWeekRange,
  isValidDateString
} from '../core/dates.js';
import { baseQuantity, cost, money, number, purchaseQuantity } from '../core/format.js';
import { getPurchaseUnitLabel } from '../core/units.js';
import {
  emptyState,
  escapeHtml,
  notice,
  pageHeader,
  statCard
} from '../ui/components.js';
import { icon } from '../ui/icons.js';

function anchorDate(ctx) {
  return isValidDateString(ctx.state.corteDate)
    ? ctx.state.corteDate
    : ctx.today;
}

function renderWeekToolbar(ctx, cut) {
  return `
    <div class="week-toolbar no-print">
      <div class="field">
        <label for="cut-date">Semana que quieres revisar</label>
        <input id="cut-date" name="cutDate" type="date" value="${cut.start}">
      </div>
      <div class="week-nav">
        <button class="button button-small" type="button" data-cut-prev>${icon('arrowLeft')} Anterior</button>
        <button class="button button-small" type="button" data-cut-current>Semana actual</button>
        <button class="button button-small" type="button" data-cut-next>Siguiente ${icon('arrowRight')}</button>
      </div>
    </div>
  `;
}

function renderSummary(cut) {
  const profitTone = cut.complete && cut.profit < 0 ? ' is-negative' : '';
  const profitValue = cut.complete ? money(cut.profit) : '—';
  const profitDetail = cut.complete
    ? 'Ventas − gastos − costo del insumo consumido'
    : 'Falta el conteo final de algunos insumos';
  return `
    <section class="cut-hero">
      <p class="eyebrow" style="color:rgba(255,255,255,.78)">Corte semanal</p>
      <h2>${escapeHtml(formatWeekRange(cut.start, cut.end))}</h2>
      <p>El consumo se calcula con inventario inicial + compras de la semana − inventario final. Las ventas no descuentan inventario.</p>

      <div class="cut-summary">
        <article class="stat-card cut-profit${profitTone}">
          <div class="stat-top">
            <span class="stat-label">Ganancia real de la semana</span>
            <span class="stat-icon">${icon('chart')}</span>
          </div>
          <strong class="stat-value">${profitValue}</strong>
          <span class="stat-detail">${profitDetail}</span>
        </article>
      </div>

      <button class="button no-print" type="button" data-print-cut>${icon('receipt')} Imprimir corte</button>
    </section>
  `;
}

function renderTotals(cut) {
  return `
    <section class="section">
      <div class="stats-grid">
        ${statCard({
          label: 'Ventas de la semana',
          value: money(cut.totalSales),
          detail: `${cut.weekSales.length} venta${cut.weekSales.length === 1 ? '' : 's'}`,
          tone: 'success',
          iconName: 'cash'
        })}
        ${statCard({
          label: 'Gastos de la semana',
          value: money(cut.totalExpenses),
          detail: `Fijos ${money(cut.totalFixedExpenses)} · Variables ${money(cut.totalVariableExpenses)}`,
          tone: 'danger',
          iconName: 'receipt'
        })}
        ${statCard({
          label: 'Compras de insumos',
          value: money(cut.totalPurchases),
          detail: 'No se restan de la ganancia; quedan en inventario',
          tone: 'warning',
          iconName: 'cart'
        })}
        ${statCard({
          label: 'Costo del insumo consumido',
          value: money(cut.totalConsumptionCost),
          detail: cut.complete
            ? 'Valorizado a costo promedio ponderado'
            : 'Parcial: faltan conteos finales',
          tone: 'berry',
          iconName: 'scale'
        })}
        ${statCard({
          label: 'Valor del inventario final',
          value: money(cut.totalFinalValue),
          detail: cut.complete
            ? 'Lo que quedó al viernes'
            : 'Parcial: faltan conteos finales',
          tone: 'default',
          iconName: 'box'
        })}
      </div>
    </section>
  `;
}

function renderViability(cut) {
  const v = cut.viability;

  if (!v.hasProductData) {
    return `
      <section class="section">
        <div class="section-heading">
          <div>
            <h2>¿Voy bien o mal?</h2>
            <p>Comparación entre tu precio y el costo real del producto que vendes.</p>
          </div>
        </div>
        ${notice({
          tone: 'info',
          iconName: 'scale',
          title: 'Todavía no se puede calcular',
          text: 'Registra los conteos físicos de la base y los toppings para saber cuántos gramos consumes. Con eso la app calcula cuánto te cuesta cada gramo y si tu precio deja ganancia.'
        })}
      </section>
    `;
  }

  const verdict = cut.complete
    ? v.viable
      ? notice({
          tone: 'success',
          iconName: 'check',
          title: `Tu precio sí te deja ganancia: ${money(cut.profit)}`,
          text: 'De cada peso vendido te quedas con lo que sobra después del producto, los gastos fijos y los variables.'
        })
      : notice({
          tone: 'danger',
          iconName: 'alert',
          title: `Con este precio pierdes ${money(Math.abs(cut.profit))}`,
          text: 'El costo del producto más los gastos de la semana son mayores que lo vendido. Sube el precio, baja costos o vende más gramos.'
        })
    : notice({
        tone: 'warning',
        iconName: 'alert',
        title: 'Corte incompleto',
        text: 'Faltan conteos finales, así que el consumo está parcial. Completa los conteos para ver el veredicto.'
      });

  const marginTone = v.marginPerGram !== null && v.marginPerGram > 0 ? 'success' : 'danger';

  return `
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>¿Voy bien o mal?</h2>
          <p>Qué tanto te cuesta el gramo de producto y cuánto necesitas vender para no perder.</p>
        </div>
      </div>

      ${verdict}

      <div class="stats-grid">
        ${statCard({
          label: 'Costo del producto por gramo',
          value: cost(v.costPerGram),
          detail: `${baseQuantity(v.productConsumptionBase, 'g')} de mezcla consumidos (base + toppings; los líquidos cuentan 1 L como 1 kg)`,
          tone: 'default',
          iconName: 'scale'
        })}
        ${statCard({
          label: 'Precio real por gramo',
          value: cost(v.effectivePricePerGram),
          detail: 'Ventas ÷ gramos consumidos. Aproximado: asume que todo lo consumido se vendió.',
          tone: 'info',
          iconName: 'cash'
        })}
        ${statCard({
          label: 'Ganancia por gramo',
          value: cost(v.marginPerGram),
          detail: 'Precio real − costo del producto',
          tone: marginTone,
          iconName: 'chart'
        })}
        ${statCard({
          label: 'Punto de equilibrio semanal',
          value: v.breakEvenSales !== null ? money(v.breakEvenSales) : '—',
          detail: v.breakEvenSales !== null
            ? `Ventas mínimas para no perder${v.breakEvenGrams !== null ? ` (≈ ${number(v.breakEvenGrams / 1000)} kg)` : ''}. Cubre gastos fijos ${money(v.totalOverheads - cut.totalVariableExpenses - v.supportConsumptionCost)}, variables ${money(cut.totalVariableExpenses)} e insumos de apoyo ${money(v.supportConsumptionCost)}.`
            : 'El costo del producto consume más de lo que se vende; no hay punto de equilibrio con estos números.',
          tone: 'warning',
          iconName: 'clipboard'
        })}
      </div>
    </section>
  `;
}

function renderRow(row) {
  const initialText = row.initialCount
    ? baseQuantity(row.initialBase, row.baseUnit)
    : 'Sin conteo (0)';
  const finalText = row.finalBase === null
    ? 'Falta conteo'
    : baseQuantity(row.finalBase, row.baseUnit);
  const consumptionText = row.consumptionBase === null
    ? '—'
    : baseQuantity(row.consumptionBase, row.baseUnit);
  const costText = row.consumptionCost === null
    ? '—'
    : money(row.consumptionCost);
  const suggestedText = row.suggested === null
    ? '—'
    : purchaseQuantity(row.suggested, row.supply.purchaseUnit);

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
          <span>Compras de la semana</span>
          <strong>+${baseQuantity(row.purchasedBase, row.baseUnit)}</strong>
        </div>
        <div class="cut-cell${row.missingFinal ? ' is-warning' : ''}">
          <span>Inventario final</span>
          <strong>${finalText}</strong>
        </div>
        <div class="cut-cell">
          <span>Consumo</span>
          <strong>${consumptionText}</strong>
        </div>
        <div class="cut-cell">
          <span>Costo del consumo</span>
          <strong>${costText}</strong>
        </div>
        <div class="cut-cell">
          <span>Costo promedio</span>
          <strong>${cost(row.costPerBase)} / ${row.baseUnit}</strong>
        </div>
        <div class="cut-cell">
          <span>Compra sugerida</span>
          <strong>${suggestedText}</strong>
        </div>
        <div class="cut-cell">
          <span>Unidad de compra</span>
          <strong>${escapeHtml(getPurchaseUnitLabel(row.supply.purchaseUnit, true))}</strong>
        </div>
      </div>

      ${row.warnings.map((warning) => `<p class="cut-warning">${escapeHtml(warning)}</p>`).join('')}
    </article>
  `;
}

function renderSuggestions(cut) {
  if (cut.suggestions.length === 0) {
    return notice({
      tone: 'info',
      iconName: 'info',
      title: 'Sin compras sugeridas',
      text: 'Con el consumo de esta semana no hace falta comprar más insumos, o todavía faltan conteos para calcularlo.'
    });
  }

  return `
    <div class="shopping-list">
      ${cut.suggestions
        .map(
          (item) => `
            <div class="shopping-item">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>Consumo de la semana: ${baseQuantity(item.consumptionBase, item.baseUnit)}</span>
              </div>
              <div class="shopping-qty">${purchaseQuantity(item.quantity, item.unit)}</div>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

export function render(ctx) {
  const anchor = anchorDate(ctx);
  const cut = ctx.store.getWeeklyCut(anchor);
  const week = getWeekRange(anchor);

  const missingNotice = cut.complete
    ? ''
    : notice({
        tone: 'warning',
        iconName: 'alert',
        title: 'El corte está incompleto',
        text: cut.warnings.join(' ')
      });

  const noActivity = cut.rows.length === 0
    ? emptyState({
        iconName: 'chart',
        title: 'No hay actividad en esta semana',
        text: 'Registra ventas, gastos, compras y conteos dentro de la semana para poder calcular el corte.',
        action: '<button class="button button-soft" data-go="ventas">Registrar una venta</button>'
      })
    : '';

  return `
    ${pageHeader({
      eyebrow: 'Ganancia real',
      title: 'Corte semanal',
      subtitle: `Semana de negocio: sábado a viernes · ${formatWeekRange(week.start, week.end)}`,
      actions: '<button class="button button-small no-print" type="button" data-print-cut>Imprimir</button>'
    })}

    ${renderWeekToolbar(ctx, cut)}
    ${missingNotice}

    ${noActivity || `
      ${renderSummary(cut)}
      ${renderTotals(cut)}
      ${renderViability(cut)}

      <section class="section">
        <div class="section-heading">
          <div>
            <h2>Detalle por insumo</h2>
            <p>Inventario inicial + compras − inventario final = consumo.</p>
          </div>
        </div>
        ${cut.rows.map(renderRow).join('')}
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <h2>Compra sugerida para la próxima semana</h2>
            <p>Se calcula con el consumo de esta semana. Las bolsas y piezas se redondean hacia arriba.</p>
          </div>
        </div>
        ${renderSuggestions(cut)}
      </section>
    `}
  `;
}

export function bind(root, ctx) {
  const dateInput = root.querySelector('#cut-date');
  const anchor = anchorDate(ctx);

  dateInput?.addEventListener('change', () => {
    if (!isValidDateString(dateInput.value)) return;
    ctx.state.corteDate = dateInput.value;
    ctx.refresh();
  });

  root.querySelector('[data-cut-prev]')?.addEventListener('click', () => {
    ctx.state.corteDate = addDays(anchor, -7);
    ctx.refresh();
  });

  root.querySelector('[data-cut-next]')?.addEventListener('click', () => {
    ctx.state.corteDate = addDays(anchor, 7);
    ctx.refresh();
  });

  root.querySelector('[data-cut-current]')?.addEventListener('click', () => {
    ctx.state.corteDate = ctx.today;
    ctx.refresh();
  });

  root.querySelectorAll('[data-print-cut]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });

  root.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => ctx.navigate(button.dataset.go));
  });
}
