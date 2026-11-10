import { formatDateLong, getWeekRange, formatWeekRange } from '../core/dates.js';
import { money, sum } from '../core/format.js';
import {
  emptyState,
  pageHeader,
  statCard
} from '../ui/components.js';
import { icon } from '../ui/icons.js';
import {
  confirmDelete,
  downloadCsv,
  exportCsvButton,
  groupByDate,
  handleSubmit,
  readForm,
  resetFormWithDate
} from './shared.js';

function renderForm(ctx) {
  return `
    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2>Registrar venta del día</h2>
          <p>Solamente la fecha y el monto total vendido. No hace falta capturar gramos ni productos.</p>
        </div>
      </div>

      <form id="sale-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="sale-date">Fecha</label>
            <input id="sale-date" name="date" type="date" required value="${ctx.today}">
          </div>
          <div class="field">
            <label for="sale-amount">Monto total vendido</label>
            <div class="input-suffix-wrap">
              <input id="sale-amount" name="amount" type="number" inputmode="decimal"
                min="0.01" step="0.01" required placeholder="0.00">
              <span class="input-suffix">MXN</span>
            </div>
            <span class="field-help">Si registras varias ventas del mismo día, se suman.</span>
          </div>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('plus')} Guardar venta</button>
        </div>
      </form>
    </section>
  `;
}

export function render(ctx) {
  const today = ctx.today;
  const week = getWeekRange(today);
  const sales = ctx.snapshot.sales;
  const groups = groupByDate(sales);
  const salesToday = sales.filter((sale) => sale.date === today);
  const salesWeek = sales.filter(
    (sale) => sale.date >= week.start && sale.date <= week.end
  );

  return `
    ${pageHeader({
      eyebrow: 'Dinero que entra',
      title: 'Ventas',
      subtitle: 'Captura el total vendido del día. El sistema lo usa para el corte semanal.',
      actions: sales.length ? exportCsvButton('sales') : ''
    })}

    ${renderForm(ctx)}

    <section class="section">
      <div class="stats-grid">
        ${statCard({
          label: 'Ventas de hoy',
          value: money(sum(salesToday.map((sale) => sale.amount))),
          detail: `${salesToday.length} registro${salesToday.length === 1 ? '' : 's'}`,
          tone: 'success',
          iconName: 'cash'
        })}
        ${statCard({
          label: 'Ventas de la semana',
          value: money(sum(salesWeek.map((sale) => sale.amount))),
          detail: formatWeekRange(week.start, week.end),
          tone: 'default',
          iconName: 'chart'
        })}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Ventas registradas</h2>
          <p>${sales.length} venta${sales.length === 1 ? '' : 's'} en total.</p>
        </div>
      </div>
      ${groups.length
        ? `<div class="record-list">
            ${groups
              .map(
                (group) => `
                  <div class="record-group">
                    <div class="record-group-head">
                      <strong>${formatDateLong(group.date)}</strong>
                      <span>${money(group.total)}</span>
                    </div>
                    ${group.items
                      .map(
                        (sale) => `
                          <div class="record-item">
                            <div class="record-main">
                              <div class="record-title">Venta del día</div>
                              <div class="record-meta"><span>${formatDateLong(sale.date)}</span></div>
                            </div>
                            <div class="record-amount">${money(sale.amount)}</div>
                            <div class="record-actions">
                              <button class="record-delete" type="button" data-delete-sale="${sale.id}" aria-label="Borrar venta">
                                ${icon('trash')}
                              </button>
                            </div>
                          </div>
                        `
                      )
                      .join('')}
                  </div>
                `
              )
              .join('')}
          </div>`
        : emptyState({
            iconName: 'cash',
            title: 'Todavía no hay ventas',
            text: 'Registra el total vendido al terminar el día. Es lo único que necesitas capturar.',
            action: '<button class="button button-soft" type="button" data-focus-sale>Registrar la primera venta</button>'
          })}
    </section>
  `;
}

export function bind(root, ctx) {
  const form = root.querySelector('#sale-form');
  handleSubmit(form, async () => {
    const values = readForm(form);
    await ctx.store.addSale(values);
    ctx.toast('Venta registrada.', 'success');
    resetFormWithDate(form, ctx.today);
    ctx.refresh();
  });

  root.querySelector('[data-focus-sale]')?.addEventListener('click', () => {
    form.elements.namedItem('amount')?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  root.querySelector('[data-export-csv="sales"]')?.addEventListener('click', () => {
    const sales = ctx.snapshot.sales;
    downloadCsv(
      `nuvy-ventas-${ctx.today}.csv`,
      ['Fecha', 'Monto (MXN)'],
      sales.map((sale) => [sale.date, sale.amount])
    );
    ctx.toast('Ventas descargadas en CSV.', 'success');
  });

  root.querySelectorAll('[data-delete-sale]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar esta venta?')) return;
      try {
        await ctx.store.deleteRecord(button.dataset.deleteSale);
        ctx.toast('Venta borrada.', 'success');
        ctx.refresh();
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });
}
