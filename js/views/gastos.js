import { formatDateLong, getWeekRange, formatWeekRange } from '../core/dates.js';
import { money, sum } from '../core/format.js';
import {
  emptyState,
  escapeHtml,
  pageHeader,
  statCard
} from '../ui/components.js';
import { icon } from '../ui/icons.js';
import {
  confirmDelete,
  groupByDate,
  handleSubmit,
  readForm,
  resetFormWithDate
} from './shared.js';

const CONCEPT_SUGGESTIONS = [
  'Sueldos',
  'Renta',
  'Luz',
  'Agua',
  'Gas',
  'Internet',
  'Mantenimiento',
  'Limpieza',
  'Otros'
];

function renderForm(ctx) {
  return `
    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2>Registrar gasto del día</h2>
          <p>Sueldos, renta, luz y cualquier gasto que no sea compra de insumos.</p>
        </div>
      </div>

      <form id="expense-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="expense-date">Fecha</label>
            <input id="expense-date" name="date" type="date" required value="${ctx.today}">
          </div>
          <div class="field">
            <label for="expense-concept">Concepto</label>
            <input id="expense-concept" name="concept" type="text" list="concept-list"
              maxlength="90" required placeholder="Ej. Sueldos, luz, renta">
            <datalist id="concept-list">
              ${CONCEPT_SUGGESTIONS.map((concept) => `<option value="${escapeHtml(concept)}"></option>`).join('')}
            </datalist>
          </div>
          <div class="field">
            <label for="expense-amount">Monto</label>
            <div class="input-suffix-wrap">
              <input id="expense-amount" name="amount" type="number" inputmode="decimal"
                min="0.01" step="0.01" required placeholder="0.00">
              <span class="input-suffix">MXN</span>
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('plus')} Guardar gasto</button>
        </div>
      </form>
    </section>
  `;
}

export function render(ctx) {
  const today = ctx.today;
  const week = getWeekRange(today);
  const expenses = ctx.snapshot.expenses;
  const groups = groupByDate(expenses);
  const expensesToday = expenses.filter((expense) => expense.date === today);
  const expensesWeek = expenses.filter(
    (expense) => expense.date >= week.start && expense.date <= week.end
  );

  return `
    ${pageHeader({
      eyebrow: 'Dinero que sale',
      title: 'Gastos',
      subtitle: 'Registra los gastos del negocio. Las compras de insumos van en su propia pantalla.'
    })}

    ${renderForm(ctx)}

    <section class="section">
      <div class="stats-grid">
        ${statCard({
          label: 'Gastos de hoy',
          value: money(sum(expensesToday.map((expense) => expense.amount))),
          detail: `${expensesToday.length} registro${expensesToday.length === 1 ? '' : 's'}`,
          tone: 'danger',
          iconName: 'receipt'
        })}
        ${statCard({
          label: 'Gastos de la semana',
          value: money(sum(expensesWeek.map((expense) => expense.amount))),
          detail: formatWeekRange(week.start, week.end),
          tone: 'warning',
          iconName: 'chart'
        })}
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Gastos registrados</h2>
          <p>${expenses.length} gasto${expenses.length === 1 ? '' : 's'} en total.</p>
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
                        (expense) => `
                          <div class="record-item">
                            <div class="record-main">
                              <div class="record-title">${escapeHtml(expense.concept)}</div>
                              <div class="record-meta"><span>${formatDateLong(expense.date)}</span></div>
                            </div>
                            <div class="record-amount">${money(expense.amount)}</div>
                            <div class="record-actions">
                              <button class="record-delete" type="button" data-delete-expense="${expense.id}" aria-label="Borrar gasto">
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
            iconName: 'receipt',
            title: 'Todavía no hay gastos',
            text: 'Registra los gastos del día para que la ganancia real del corte sea correcta.',
            action: '<button class="button button-soft" type="button" data-focus-expense>Registrar el primer gasto</button>'
          })}
    </section>
  `;
}

export function bind(root, ctx) {
  const form = root.querySelector('#expense-form');
  handleSubmit(form, async () => {
    const values = readForm(form);
    await ctx.store.addExpense(values);
    ctx.toast('Gasto registrado.', 'success');
    resetFormWithDate(form, ctx.today);
    ctx.refresh();
  });

  root.querySelector('[data-focus-expense]')?.addEventListener('click', () => {
    form.elements.namedItem('concept')?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  root.querySelectorAll('[data-delete-expense]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar este gasto?')) return;
      try {
        await ctx.store.deleteRecord(button.dataset.deleteExpense);
        ctx.toast('Gasto borrado.', 'success');
        ctx.refresh();
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });
}
