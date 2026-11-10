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
  deleteWithUndo,
  downloadCsv,
  exportCsvButton,
  groupByDate,
  handleSubmit,
  readForm,
  resetFormWithDate
} from './shared.js';
import {
  bindFilterBar,
  bindShowMore,
  filterRecords,
  getFilters,
  renderFilterBar,
  renderShowMore
} from './filters.js';

const VIEW_KEY = 'ventas';

function renderForm(ctx) {
  const editing = ctx.state.editingSaleId
    ? ctx.snapshot.sales.find((sale) => sale.id === ctx.state.editingSaleId)
    : null;

  return `
    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2>${editing ? 'Editar venta' : 'Registrar venta del día'}</h2>
          <p>${editing
            ? 'Corrige la fecha, el monto o los clientes y guarda los cambios.'
            : 'La fecha, el monto total vendido y (si quieres) cuántos clientes atendiste.'}</p>
        </div>
        ${editing ? '<button type="button" class="button button-small button-ghost" data-cancel-sale-edit>Cancelar</button>' : ''}
      </div>

      <form id="sale-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="sale-date">Fecha</label>
            <input id="sale-date" name="date" type="date" required value="${editing?.date ?? ctx.today}">
          </div>
          <div class="field">
            <label for="sale-amount">Monto total vendido</label>
            <div class="input-suffix-wrap">
              <input id="sale-amount" name="amount" type="number" inputmode="decimal"
                min="0.01" step="0.01" required placeholder="0.00"
                value="${editing ? String(editing.amount) : ''}">
              <span class="input-suffix">MXN</span>
            </div>
            <span class="field-help">Si registras varias ventas del mismo día, se suman.</span>
          </div>
          <div class="field">
            <label for="sale-tickets">¿Cuántos clientes? (opcional)</label>
            <input id="sale-tickets" name="tickets" type="number" inputmode="numeric"
              min="1" step="1" placeholder="Ej. 35"
              value="${editing?.tickets ? String(editing.tickets) : ''}">
            <span class="field-help">Con esto la app calcula tu ticket promedio y los gramos por cliente. Puedes dejarlo vacío.</span>
          </div>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">
            ${icon(editing ? 'check' : 'plus')} ${editing ? 'Guardar cambios' : 'Guardar venta'}
          </button>
        </div>
      </form>
    </section>
  `;
}

/**
 * Bloque "Cerrar el día": al terminar el día cuentas el efectivo y la app
 * dice si falta o sobra contra lo que se vendió.
 */
function renderCashClose(ctx) {
  const today = ctx.today;
  const closes = ctx.snapshot.cashCloses;
  const week = getWeekRange(today);
  const weekCloses = closes.filter(
    (close) => close.date >= week.start && close.date <= week.end
  );

  const weekDifferences = weekCloses.map((close) => {
    const daySales = ctx.snapshot.sales.filter((sale) => sale.date === close.date);
    const salesTotal = sum(daySales.map((sale) => sale.amount));
    const expected = salesTotal - (Number(close.cardSales) || 0);
    return Number(close.countedCash) - expected;
  });
  const weekTotalDifference = sum(weekDifferences);
  const missingTotal = sum(weekDifferences.filter((value) => value < 0));
  const extraTotal = sum(weekDifferences.filter((value) => value > 0));

  const weekSummary = weekCloses.length
    ? `
      <p class="sim-note">
        <strong>Resumen de la semana (${formatWeekRange(week.start, week.end)}):</strong>
        ${weekTotalDifference === 0
          ? 'Todos los días cuadran.'
          : `${missingTotal < 0 ? `Faltan ${money(Math.abs(missingTotal))}` : ''}${missingTotal < 0 && extraTotal > 0 ? ' y ' : ''}${extraTotal > 0 ? `sobran ${money(extraTotal)}` : ''} entre ${weekCloses.length} cierre${weekCloses.length === 1 ? '' : 's'}.`}
      </p>
    `
    : '';

  return `
    <section class="card form-card no-print">
      <div class="card-header">
        <div>
          <h2>Cerrar el día</h2>
          <p>Al terminar, cuenta el efectivo de la caja. La app te dice si falta o sobra contra lo vendido.</p>
        </div>
      </div>

      <form id="cashclose-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="cashclose-date">Día que cierras</label>
            <input id="cashclose-date" name="date" type="date" required value="${today}">
          </div>
          <div class="field">
            <label for="cashclose-card">Ventas con tarjeta (opcional)</label>
            <div class="input-suffix-wrap">
              <input id="cashclose-card" name="cardSales" type="number" inputmode="decimal"
                min="0" step="0.01" placeholder="0.00">
              <span class="input-suffix">MXN</span>
            </div>
            <span class="field-help">Si aceptas tarjeta, escríbelo para restarlo del efectivo esperado.</span>
          </div>
          <div class="field">
            <label for="cashclose-cash">Efectivo contado en la caja</label>
            <div class="input-suffix-wrap">
              <input id="cashclose-cash" name="countedCash" type="number" inputmode="decimal"
                min="0" step="0.01" required placeholder="0.00">
              <span class="input-suffix">MXN</span>
            </div>
          </div>
          <div class="field">
            <label for="cashclose-note">Nota (opcional)</label>
            <input id="cashclose-note" name="note" type="text" maxlength="140"
              placeholder="Ej. faltó cambio de $50">
          </div>
        </div>

        <div class="form-preview">
          Efectivo esperado: <strong data-cashclose-expected>—</strong> ·
          <span data-cashclose-difference>—</span>
        </div>

        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('check')} Guardar cierre</button>
        </div>
      </form>

      ${weekSummary}

      ${closes.length
        ? `
          <div class="section">
            <div class="section-heading">
              <div>
                <h3>Cierres guardados</h3>
                <p>Los últimos ${Math.min(closes.length, 20)} cierres de caja.</p>
              </div>
            </div>
            ${closes.slice(0, 20).map((close) => renderCashCloseItem(close, ctx)).join('')}
          </div>
        `
        : ''}
    </section>
  `;
}

function renderCashCloseItem(close, ctx) {
  const daySales = ctx.snapshot.sales.filter((sale) => sale.date === close.date);
  const salesTotal = sum(daySales.map((sale) => sale.amount));
  const expected = salesTotal - (Number(close.cardSales) || 0);
  const difference = Number(close.countedCash) - expected;

  const differenceText =
    difference === 0
      ? '<span class="badge badge-success">Cuadra</span>'
      : difference > 0
        ? `<span class="badge badge-warning">Sobran ${money(difference)}</span>`
        : `<span class="badge badge-danger">Faltan ${money(Math.abs(difference))}</span>`;

  return `
    <div class="cashclose-item">
      <div>
        <strong>${formatDateLong(close.date)}</strong>
        <div>
          Esperado ${money(expected)} · Contado ${money(close.countedCash)}
          ${Number(close.cardSales) > 0 ? ` · Tarjeta ${money(close.cardSales)}` : ''}
          ${close.note ? ` · ${close.note}` : ''}
        </div>
      </div>
      <div class="record-actions">
        ${differenceText}
        <button class="record-delete" type="button" data-delete-cashclose="${close.id}" aria-label="Borrar cierre">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

function renderSaleItem(sale) {
  return `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title">
          Venta del día
          ${sale.tickets ? `<span class="badge badge-neutral">${sale.tickets} cliente${sale.tickets === 1 ? '' : 's'}</span>` : ''}
        </div>
        <div class="record-meta"><span>${formatDateLong(sale.date)}</span></div>
      </div>
      <div class="record-amount">${money(sale.amount)}</div>
      <div class="record-actions">
        <button class="record-edit" type="button" data-edit-sale="${sale.id}" aria-label="Editar venta">
          ${icon('edit')}
        </button>
        <button class="record-delete" type="button" data-delete-sale="${sale.id}" aria-label="Borrar venta">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

export function render(ctx) {
  const today = ctx.today;
  const week = getWeekRange(today);
  const allSales = ctx.snapshot.sales;
  const filters = getFilters(ctx, VIEW_KEY);
  const filteredSales = filterRecords(allSales, filters);
  const shownSales = filteredSales.slice(0, filters.limit);
  const groups = groupByDate(shownSales);
  const salesToday = allSales.filter((sale) => sale.date === today);
  const salesWeek = allSales.filter(
    (sale) => sale.date >= week.start && sale.date <= week.end
  );

  return `
    ${pageHeader({
      eyebrow: 'Dinero que entra',
      title: 'Ventas',
      subtitle: 'Captura el total vendido del día. El sistema lo usa para el corte semanal.',
      actions: allSales.length ? exportCsvButton('sales') : ''
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

    ${renderCashClose(ctx)}

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Ventas registradas</h2>
          <p>${allSales.length} venta${allSales.length === 1 ? '' : 's'} en total.</p>
        </div>
      </div>

      ${allSales.length > 0 ? renderFilterBar({
          viewKey: VIEW_KEY,
          filters,
          count: filteredSales.length,
          total: allSales.length
        }) : ''}

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
                    ${group.items.map((sale) => renderSaleItem(sale)).join('')}
                  </div>
                `
              )
              .join('')}
          </div>`
        : emptyState({
            iconName: 'cash',
            title: allSales.length ? 'Ninguna venta coincide con el filtro' : 'Todavía no hay ventas',
            text: allSales.length
              ? 'Prueba con otro rango de fechas.'
              : 'Registra el total vendido al terminar el día. Es lo único que necesitas capturar.',
            action: allSales.length
              ? ''
              : '<button class="button button-soft" type="button" data-focus-sale>Registrar la primera venta</button>'
          })}

      ${renderShowMore(VIEW_KEY, filteredSales.length, shownSales.length)}
    </section>
  `;
}

function updateCashClosePreview(root, ctx) {
  const dateInput = root.querySelector('#cashclose-date');
  const cardInput = root.querySelector('#cashclose-card');
  const cashInput = root.querySelector('#cashclose-cash');
  const expectedEl = root.querySelector('[data-cashclose-expected]');
  const differenceEl = root.querySelector('[data-cashclose-difference]');
  if (!dateInput || !expectedEl || !differenceEl) return;

  const daySales = ctx.snapshot.sales.filter((sale) => sale.date === dateInput.value);
  const salesTotal = sum(daySales.map((sale) => sale.amount));
  const card = Number(cardInput?.value) || 0;
  const expected = salesTotal - card;
  expectedEl.textContent = money(expected);

  const cashValue = cashInput?.value ?? '';
  if (cashValue === '' || !Number.isFinite(Number(cashValue))) {
    differenceEl.textContent = 'cuenta el efectivo para ver la diferencia';
    return;
  }

  const difference = Number(cashValue) - expected;
  if (Math.abs(difference) < 0.005) {
    differenceEl.textContent = 'Cuadra exacto.';
  } else if (difference > 0) {
    differenceEl.textContent = `Sobran ${money(difference)}.`;
  } else {
    differenceEl.textContent = `Faltan ${money(Math.abs(difference))}.`;
  }
}

export function bind(root, ctx) {
  const form = root.querySelector('#sale-form');
  handleSubmit(form, async () => {
    const values = readForm(form);
    if (ctx.state.editingSaleId) {
      await ctx.store.updateSale(ctx.state.editingSaleId, values);
      ctx.state.editingSaleId = null;
      ctx.toast('Venta actualizada.', 'success');
    } else {
      await ctx.store.addSale(values);
      ctx.toast('Venta registrada.', 'success');
    }
    resetFormWithDate(form, ctx.today);
    ctx.refresh();
  });

  root.querySelector('[data-cancel-sale-edit]')?.addEventListener('click', () => {
    ctx.state.editingSaleId = null;
    ctx.refresh();
  });

  root.querySelectorAll('[data-edit-sale]').forEach((button) => {
    button.addEventListener('click', () => {
      ctx.state.editingSaleId = button.dataset.editSale;
      ctx.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  root.querySelector('[data-focus-sale]')?.addEventListener('click', () => {
    form.elements.namedItem('amount')?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  root.querySelector('[data-export-csv="sales"]')?.addEventListener('click', () => {
    const sales = ctx.snapshot.sales;
    downloadCsv(
      `nuvy-ventas-${ctx.today}.csv`,
      ['Fecha', 'Monto (MXN)', 'Clientes'],
      sales.map((sale) => [sale.date, sale.amount, sale.tickets ?? ''])
    );
    ctx.toast('Ventas descargadas en CSV.', 'success');
  });

  root.querySelectorAll('[data-delete-sale]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar esta venta?')) return;
      const sale = ctx.snapshot.sales.find((item) => item.id === button.dataset.deleteSale);
      if (!sale) return;
      try {
        await deleteWithUndo(ctx, sale, 'Venta borrada.');
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });

  root.querySelectorAll('[data-delete-cashclose]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar este cierre de caja?')) return;
      const close = ctx.snapshot.cashCloses.find(
        (item) => item.id === button.dataset.deleteCashclose
      );
      if (!close) return;
      try {
        await deleteWithUndo(ctx, close, 'Cierre de caja borrado.');
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });

  const cashCloseForm = root.querySelector('#cashclose-form');
  if (cashCloseForm) {
    updateCashClosePreview(root, ctx);
    for (const input of cashCloseForm.querySelectorAll('input')) {
      input.addEventListener('input', () => updateCashClosePreview(root, ctx));
      input.addEventListener('change', () => updateCashClosePreview(root, ctx));
    }

    handleSubmit(cashCloseForm, async () => {
      const values = readForm(cashCloseForm);
      await ctx.store.addCashClose(values);
      ctx.toast('Cierre de caja guardado.', 'success');
      resetFormWithDate(cashCloseForm, ctx.today);
      updateCashClosePreview(root, ctx);
      ctx.refresh();
    });
  }

  bindFilterBar(root, ctx, VIEW_KEY);
  bindShowMore(root, ctx, VIEW_KEY);
}
