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
  buildWeekComparison
} from '../core/weekly-cut.js';
import { APP_CONFIG } from '../config.js';
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

function percent(value, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—';
  }
  return `${number(Number(value) * 100, decimals)}%`;
}

/**
 * Color del food cost según los umbrales de config.js:
 * verde hasta 30%, ámbar hasta 38%, rojo arriba de eso.
 */
function foodCostTone(pct) {
  if (pct === null) return 'default';
  const value = pct * 100;
  if (value <= APP_CONFIG.foodCostGoodPercent) return 'success';
  if (value <= APP_CONFIG.foodCostWarningPercent) return 'warning';
  return 'danger';
}

function expenseRatioTone(pct) {
  if (pct === null) return 'default';
  return pct * 100 <= 50 ? 'success' : 'warning';
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
    ? 'Ventas − gastos − costo de lo consumido (lo vendido y la merma)'
    : 'Falta el conteo final de algunos insumos';
  const cashTone = cut.cashFlow.remaining < 0 ? ' is-negative' : '';
  return `
    <section class="cut-hero">
      <p class="eyebrow" style="color:rgba(255,255,255,.78)">Corte semanal</p>
      <h2>${escapeHtml(formatWeekRange(cut.start, cut.end))}</h2>
      <p>El consumo se calcula con inventario inicial + compras de la semana − inventario final. Las ventas no descuentan inventario.</p>

      <div class="cut-summary">
        <article class="stat-card cut-profit">
          <div class="stat-top">
            <span class="stat-label">Ganancia contable de la semana</span>
            <span class="stat-icon">${icon('chart')}</span>
          </div>
          <strong class="stat-value${profitTone}">${profitValue}</strong>
          <span class="stat-detail">${profitDetail}. No cuenta el dinero de las compras ni los retiros: eso es inventario y tu sueldo, no ganancia.</span>
        </article>

        <article class="stat-card cut-profit">
          <div class="stat-top">
            <span class="stat-label">Dinero que te queda en la caja</span>
            <span class="stat-icon">${icon('cash')}</span>
          </div>
          <strong class="stat-value${cashTone}">${money(cut.cashFlow.remaining)}</strong>
          <span class="stat-detail">Ventas ${money(cut.cashFlow.salesIn)} − gastos pagados ${money(cut.cashFlow.expensesPaid)} − compras ${money(cut.cashFlow.purchasesPaid)}${cut.cashFlow.ownerWithdrawals > 0 ? ` − retiros del dueño ${money(cut.cashFlow.ownerWithdrawals)}` : ''}. Es lo que de verdad salió y entró de efectivo, sin importar cuándo se consume.</span>
        </article>
      </div>

      <button class="button no-print" type="button" data-print-cut>${icon('receipt')} Imprimir corte</button>
    </section>
  `;
}

function renderTotals(cut) {
  const foodCost = cut.foodCostPct;
  const foodCostValue = foodCost === null ? '—' : percent(foodCost);
  const foodCostDetail = foodCost === null
    ? 'Registra los conteos para saber cuánto producto vendiste'
    : `De cada $100 que vendes, $${number(foodCost * 100, 0)} se van en la base y los toppings. Menos de ${APP_CONFIG.foodCostGoodPercent}% está bien; más de ${APP_CONFIG.foodCostWarningPercent}% es mucho.`;
  const expenseRatio = cut.expenseRatioPct;
  const expenseRatioDetail = expenseRatio === null
    ? 'Sin ventas esta semana'
    : `De cada $100 que vendes, $${number(expenseRatio * 100, 0)} se van en gastos (fijos y variables, con la parte de los recurrentes).`;

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
          detail: `Fijos ${money(cut.totalFixedExpenses)} · Variables ${money(cut.totalVariableExpenses)}${cut.totalProratedOwnerWithdrawals > 0 ? ' · Sin los retiros del dueño' : ''}`,
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
        ${statCard({
          label: 'Retiros del dueño',
          value: money(cut.cashFlow.ownerWithdrawals),
          detail: cut.cashFlow.ownerWithdrawals > 0
            ? 'No son un gasto del negocio: salen de la caja y de tu ganancia personal'
            : 'Sin retiros esta semana',
          tone: 'default',
          iconName: 'download'
        })}
        ${statCard({
          label: 'Food cost',
          value: foodCostValue,
          detail: foodCostDetail,
          tone: foodCostTone(foodCost),
          iconName: 'scale'
        })}
        ${statCard({
          label: 'Gastos entre ventas',
          value: expenseRatio === null ? '—' : percent(expenseRatio),
          detail: expenseRatioDetail,
          tone: expenseRatioTone(expenseRatio),
          iconName: 'receipt'
        })}
        ${statCard({
          label: 'Ticket promedio',
          value: cut.tickets.hasTicketData ? money(cut.tickets.averageTicket) : '—',
          detail: cut.tickets.hasTicketData
            ? `${number(cut.tickets.totalTickets, 0)} clientes en ${cut.tickets.ticketSalesCount} venta${cut.tickets.ticketSalesCount === 1 ? '' : 's'} con clientes capturados`
            : 'Captura los clientes del día en Ventas para verlo',
          tone: 'info',
          iconName: 'users'
        })}
        ${statCard({
          label: 'Gramos por cliente',
          value: cut.tickets.gramsPerCustomer !== null
            ? baseQuantity(cut.tickets.gramsPerCustomer, 'g')
            : '—',
          detail: cut.tickets.gramsPerCustomer !== null
            ? 'Producto servido por cliente (sin contar merma)'
            : 'Se calcula con los clientes capturados en Ventas',
          tone: 'info',
          iconName: 'scale'
        })}
        ${cut.waste.hasWaste
          ? statCard({
              label: 'Costo de la merma',
              value: money(cut.waste.totalWasteCost),
              detail: `${baseQuantity(cut.waste.totalWasteBase, 'g')} perdidos (${baseQuantity(cut.waste.productWasteBase, 'g')} de producto y ${baseQuantity(cut.waste.supportWasteBase, 'g')} de apoyo)`,
              tone: 'danger',
              iconName: 'alert'
            })
          : ''}
      </div>
    </section>
  `;
}

/**
 * Comparación contra la semana anterior con deltas y porcentajes.
 */
function renderComparison(ctx, cut) {
  const previous = ctx.store.getWeeklyCut(addDays(cut.start, -7));
  const comparison = buildWeekComparison(cut, previous);

  if (!comparison.hasPrevious) {
    return `
      <section class="section">
        <div class="section-heading">
          <div>
            <h2>Comparado con la semana anterior</h2>
            <p>Cómo te fue contra hace 7 días.</p>
          </div>
        </div>
        ${notice({
          tone: 'info',
          iconName: 'chart',
          title: 'Sin comparación',
          text: 'La semana anterior no tiene ventas, gastos ni compras registradas. Cuando captures una semana más, aquí vas a ver si vas arriba o abajo.'
        })}
      </section>
    `;
  }

  return `
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Comparado con la semana anterior</h2>
          <p>Cómo te fue contra hace 7 días (${formatWeekRange(previous.start, previous.end)}).</p>
        </div>
      </div>
      <div class="compare-list">
        ${comparison.rows
          .map((row) => {
            const formatted = row.isMoney ? money(row.current) : baseQuantity(row.current, 'g');
            const deltaText =
              row.changeType === 'flat'
                ? 'igual que la semana pasada'
                : row.changeType === 'new'
                  ? 'nuevo: la semana pasada fue cero'
                  : `${row.diff >= 0 ? '+' : '−'}${row.isMoney ? money(Math.abs(row.diff)) : baseQuantity(Math.abs(row.diff), 'g')} (${row.pct >= 0 ? '+' : '−'}${percent(Math.abs(row.pct), 0)})`;
            const arrow = row.changeType === 'changed' || row.changeType === 'new'
              ? icon(row.diff >= 0 ? 'arrowRight' : 'arrowLeft')
              : '';
            return `
              <div class="compare-row">
                <div class="compare-label">
                  <strong>${escapeHtml(row.label)}</strong>
                  <span>${escapeHtml(row.hint)}</span>
                </div>
                <div class="compare-value">
                  <strong>${formatted}</strong>
                  <span class="compare-delta is-${row.tone}">${arrow} ${deltaText} vs semana anterior</span>
                </div>
              </div>
            `;
          })
          .join('')}
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
          detail: `${baseQuantity(v.productConsumptionBase, 'g')} de mezcla vendidos (base + toppings; los líquidos cuentan 1 L como 1 kg)`,
          tone: 'default',
          iconName: 'scale'
        })}
        ${statCard({
          label: 'Precio real por gramo',
          value: cost(v.effectivePricePerGram),
          detail: 'Ventas ÷ gramos vendidos (sin contar la merma)',
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
            ? `Ventas mínimas para no perder${v.breakEvenGrams !== null ? ` (≈ ${number(v.breakEvenGrams / 1000)} kg)` : ''}. Cubre gastos fijos ${money(cut.totalFixedExpenses)} + variables ${money(cut.totalVariableExpenses)} + insumos de apoyo ${money(v.supportConsumptionCost)} + merma ${money(cut.waste.totalWasteCost)} = ${money(v.totalOverheads)}.`
            : 'El costo del producto consume más de lo que se vende; no hay punto de equilibrio con estos números.',
          tone: 'warning',
          iconName: 'clipboard'
        })}
      </div>

      <p class="sim-note">
        <strong>Sobre los gastos recurrentes:</strong> los gastos con periodo (cada semana, quincena o mes)
        se cobran por día. Si tu renta es de $3,000 al mes, a una semana le toca
        $3,000 × 7 ÷ 30 = $700, y al mes entero los $3,000 completos.
        Así ninguna semana sale cara solo porque cayó la renta.
      </p>
    </section>
  `;
}

/**
 * Simulador de precio: con el costo por gramo de la semana, ayuda a decidir
 * cuánto cobrar. Todo es una estimación, no se guarda nada.
 */
function renderPriceSimulator(cut) {
  const v = cut.viability;
  const hasData = v.hasProductData && v.costPerGram !== null;
  const costValue = hasData ? v.costPerGram : 0.04;

  return `
    <section class="section no-print">
      <div class="section-heading">
        <div>
          <h2>Simulador de precio</h2>
          <p>¿Cuánto deberías cobrar? Mueve los números y la app te dice un precio estimado.</p>
        </div>
      </div>

      <div class="card form-card">
        <form id="simulator-form" novalidate>
          <div class="form-grid">
            <div class="field">
              <label for="sim-cost">Costo por gramo</label>
              <input id="sim-cost" name="simCost" type="number" step="0.0001" min="0" value="${costValue.toFixed(4)}" inputmode="decimal">
            </div>
            <div class="field">
              <label for="sim-grams">Gramos por porción típica</label>
              <input id="sim-grams" name="simGrams" type="number" step="1" min="1" value="100" inputmode="numeric">
            </div>
            <div class="field">
              <label for="sim-margin">Margen que quieres (%)</label>
              <input id="sim-margin" name="simMargin" type="number" step="1" min="0" max="99" value="65" inputmode="numeric">
            </div>
          </div>
        </form>

        <div class="stats-grid">
          ${statCard({
            label: 'Precio sugerido por porción',
            value: '<span id="sim-price">—</span>',
            detail: 'Costo ÷ (1 − margen). Estimación para decidir tu precio, no un precio oficial.',
            tone: 'info',
            iconName: 'sparkles'
          })}
          ${statCard({
            label: 'Precio por 100 g',
            value: '<span id="sim-price-100">—</span>',
            detail: 'Para comparar contra competidores que venden por 100 g.',
            tone: 'info',
            iconName: 'scale'
          })}
          ${statCard({
            label: 'Ganancia por porción',
            value: '<span id="sim-profit">—</span>',
            detail: 'Lo que te queda de cada porción vendida.',
            tone: 'success',
            iconName: 'chart'
          })}
          ${statCard({
            label: 'Precio para cubrir todo',
            value: '<span id="sim-fixed">—</span>',
            detail: hasData
              ? 'Precio por porción para cubrir el producto, los gastos de la semana y la merma vendiendo lo mismo que esta semana.'
              : 'Sin conteos no se puede calcular. Registra conteos para verlo.',
            tone: 'warning',
            iconName: 'clipboard'
          })}
        </div>

        <p class="sim-note">Estimación con los datos de esta semana. Los costos cambian cada semana según tus compras; revisa el precio cuando cambien.</p>
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
  const wasteText = row.billableWasteBase === null
    ? '—'
    : row.billableWasteBase > 0
      ? `${baseQuantity(row.billableWasteBase, row.baseUnit)} (${money(row.wasteCost)})`
      : '0';
  const soldText = row.soldBase === null
    ? '—'
    : baseQuantity(row.soldBase, row.baseUnit);

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
          <span>Merma</span>
          <strong>${wasteText}</strong>
        </div>
        <div class="cut-cell">
          <span>Consumo vendido</span>
          <strong>${soldText}</strong>
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
      text: 'Con el consumo de esta semana y lo que te quedó en inventario no hace falta comprar más, o todavía faltan conteos para calcularlo.'
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
                <span class="suggestion-breakdown">
                  Consumo ${baseQuantity(item.consumptionBase, item.baseUnit)} + ${item.cushionPercent}% de colchón
                  − inventario final ${baseQuantity(item.stockBase, item.baseUnit)}
                  → falta ${baseQuantity(item.neededBase, item.baseUnit)}
                </span>
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
      ${renderComparison(ctx, cut)}
      ${renderViability(cut)}
      ${renderPriceSimulator(cut)}

      <section class="section">
        <div class="section-heading">
          <div>
            <h2>Detalle por insumo</h2>
            <p>Inventario inicial + compras − inventario final = consumo. La merma se resta para saber lo vendido.</p>
          </div>
        </div>
        ${cut.rows.map(renderRow).join('')}
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <h2>Compra sugerida para la próxima semana</h2>
            <p>Se calcula con el consumo de esta semana más un colchón del ${cut.suggestions[0]?.cushionPercent ?? APP_CONFIG.purchaseCushionPercent}%, restando lo que te quedó. Las bolsas y piezas se redondean hacia arriba.</p>
          </div>
        </div>
        ${renderSuggestions(cut)}
      </section>
    `}
  `;
}

/**
 * Calcula los resultados del simulador con los valores actuales del
 * formulario. No guarda nada: es solo para probar números.
 */
function runSimulator(root, cut) {
  const costInput = root.querySelector('#sim-cost');
  const gramsInput = root.querySelector('#sim-grams');
  const marginInput = root.querySelector('#sim-margin');
  const priceEl = root.querySelector('#sim-price');
  const price100El = root.querySelector('#sim-price-100');
  const profitEl = root.querySelector('#sim-profit');
  const fixedEl = root.querySelector('#sim-fixed');
  if (!costInput || !gramsInput || !marginInput) return;

  const costPerGram = Number(costInput.value);
  const grams = Number(gramsInput.value);
  const marginPercent = Number(marginInput.value);

  const valid =
    Number.isFinite(costPerGram) &&
    costPerGram > 0 &&
    Number.isFinite(grams) &&
    grams > 0 &&
    Number.isFinite(marginPercent) &&
    marginPercent >= 0 &&
    marginPercent < 100;

  if (!valid) {
    priceEl.textContent = '—';
    price100El.textContent = '—';
    profitEl.textContent = '—';
    fixedEl.textContent = '—';
    return;
  }

  const divisor = 1 - marginPercent / 100;
  const portionCost = costPerGram * grams;
  const portionPrice = portionCost / divisor;
  const pricePer100 = (costPerGram * 100) / divisor;

  priceEl.textContent = money(portionPrice);
  price100El.textContent = money(pricePer100);
  profitEl.textContent = money(portionPrice - portionCost);

  const soldBase = cut.viability?.productConsumptionBase ?? 0;
  const soldCost = cut.viability?.productConsumptionCost ?? 0;
  if (soldBase > 0) {
    const perGramToCover = (soldCost + cut.viability.totalOverheads) / soldBase;
    fixedEl.textContent = money(perGramToCover * grams);
  } else {
    fixedEl.textContent = '—';
  }
}

export function bind(root, ctx) {
  const dateInput = root.querySelector('#cut-date');
  const anchor = anchorDate(ctx);
  const cut = ctx.store.getWeeklyCut(anchor);

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

  const simulatorForm = root.querySelector('#simulator-form');
  if (simulatorForm) {
    runSimulator(root, cut);
    simulatorForm.addEventListener('input', () => runSimulator(root, cut));
  }
}
