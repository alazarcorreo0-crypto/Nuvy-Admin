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
  EXPENSE_PERIOD_LABELS,
  suggestExpenseCategory
} from '../core/validation.js';
import { proratedExpenseAmount } from '../core/weekly-cut.js';
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

const VIEW_KEY = 'gastos';

const CONCEPT_SUGGESTIONS = [
  'Sueldos',
  'Renta',
  'Luz',
  'Agua',
  'Gas',
  'Internet',
  'Mantenimiento',
  'Limpieza',
  'Retiro del dueño',
  'Otros'
];

function periodOptions(selected) {
  return Object.entries(EXPENSE_PERIOD_LABELS)
    .map(
      ([value, label]) =>
        `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
    )
    .join('');
}

function renderForm(ctx) {
  const editing = ctx.state.editingExpenseId
    ? ctx.snapshot.expenses.find((expense) => expense.id === ctx.state.editingExpenseId)
    : null;
  const suggestedCategory = editing?.category ?? 'variable';

  return `
    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2>${editing ? 'Editar gasto' : 'Registrar gasto del día'}</h2>
          <p>${editing
            ? 'Corrige la fecha, el concepto, el monto o cada cuánto lo pagas.'
            : 'Sueldos, renta, luz y cualquier gasto que no sea compra de insumos.'}</p>
        </div>
        ${editing ? '<button type="button" class="button button-small button-ghost" data-cancel-expense-edit>Cancelar</button>' : ''}
      </div>

      <form id="expense-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="expense-date">Fecha</label>
            <input id="expense-date" name="date" type="date" required value="${editing?.date ?? ctx.today}">
          </div>
          <div class="field">
            <label for="expense-concept">Concepto</label>
            <input id="expense-concept" name="concept" type="text" list="concept-list"
              maxlength="90" required placeholder="Ej. Sueldos, luz, renta"
              value="${editing ? escapeHtml(editing.concept) : ''}">
            <datalist id="concept-list">
              ${CONCEPT_SUGGESTIONS.map((concept) => `<option value="${escapeHtml(concept)}"></option>`).join('')}
            </datalist>
          </div>
          <div class="field">
            <label for="expense-amount">Monto</label>
            <div class="input-suffix-wrap">
              <input id="expense-amount" name="amount" type="number" inputmode="decimal"
                min="0.01" step="0.01" required placeholder="0.00"
                value="${editing ? String(editing.amount) : ''}">
              <span class="input-suffix">MXN</span>
            </div>
          </div>
          <div class="field">
            <label for="expense-category">Tipo de gasto</label>
            <select id="expense-category" name="category" required>
              <option value="fixed" ${suggestedCategory === 'fixed' ? 'selected' : ''}>Fijo — renta, luz, agua, sueldos, internet</option>
              <option value="variable" ${suggestedCategory === 'variable' ? 'selected' : ''}>Variable — gasolina, imprevistos, otros</option>
              <option value="owner" ${suggestedCategory === 'owner' ? 'selected' : ''}>Retiro del dueño — dinero que te sacas</option>
            </select>
            <span class="field-help">Los retiros del dueño no son gasto del negocio: salen del efectivo y de tu ganancia, no del punto de equilibrio.</span>
          </div>
          <div class="field">
            <label for="expense-period">¿Cada cuánto lo pagas?</label>
            <select id="expense-period" name="period" required>
              ${periodOptions(editing?.period ?? 'once')}
            </select>
            <span class="field-help">Si lo pagas cada semana, quincena o mes, la app le cobra a cada semana solo su parte por día. Un gasto de una sola vez cae completo en su fecha.</span>
          </div>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">
            ${icon(editing ? 'check' : 'plus')} ${editing ? 'Guardar cambios' : 'Guardar gasto'}
          </button>
        </div>
      </form>
    </section>
  `;
}

function categoryBadge(expense) {
  if (expense.category === 'owner') {
    return '<span class="badge badge-liquid">Retiro del dueño</span>';
  }
  return expense.category === 'fixed'
    ? '<span class="badge badge-neutral">Fijo</span>'
    : '<span class="badge badge-dry">Variable</span>';
}

function isRecurring(expense) {
  return expense.period && expense.period !== 'once';
}

/**
 * Gastos recurrentes activos: cuánto le toca a la semana en curso.
 */
function renderRecurring(ctx) {
  const week = getWeekRange(ctx.today);
  const recurring = ctx.snapshot.expenses.filter(isRecurring);
  if (recurring.length === 0) return '';

  return `
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Gastos recurrentes</h2>
          <p>Lo que pagas cada semana, quincena o mes, y la parte que le toca a esta semana (${formatWeekRange(week.start, week.end)}).</p>
        </div>
      </div>
      <div class="record-list">
        ${recurring
          .map(
            (expense) => {
              const prorated = proratedExpenseAmount(expense, week.start, week.end);
              return `
                <div class="record-item">
                  <div class="record-main">
                    <div class="record-title">
                      ${escapeHtml(expense.concept)}
                      <span class="badge badge-base">Recurrente · ${escapeHtml(EXPENSE_PERIOD_LABELS[expense.period] ?? expense.period)}</span>
                    </div>
                    <div class="record-meta">
                      <span>Se paga cada ${expense.period === 'weekly' ? 'semana' : expense.period === 'fortnightly' ? 'quincena' : 'mes'} desde el ${formatDateLong(expense.date)}</span>
                      ${prorated > 0 ? `<span>Le toca a esta semana: ${money(prorated)}</span>` : '<span>Esta semana no le toca nada</span>'}
                    </div>
                  </div>
                  <div class="record-amount">${money(expense.amount)}</div>
                  <div class="record-actions">
                    <button class="record-edit" type="button" data-edit-expense="${expense.id}" aria-label="Editar gasto">
                      ${icon('edit')}
                    </button>
                    <button class="record-delete" type="button" data-delete-expense="${expense.id}" aria-label="Borrar gasto">
                      ${icon('trash')}
                    </button>
                  </div>
                </div>
              `;
            }
          )
          .join('')}
      </div>
    </section>
  `;
}

function renderExpenseItem(expense) {
  return `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title">
          ${escapeHtml(expense.concept)} ${categoryBadge(expense)}
          ${isRecurring(expense) ? `<span class="badge badge-base">Recurrente</span>` : ''}
        </div>
        <div class="record-meta"><span>${formatDateLong(expense.date)}</span></div>
      </div>
      <div class="record-amount">${money(expense.amount)}</div>
      <div class="record-actions">
        <button class="record-edit" type="button" data-edit-expense="${expense.id}" aria-label="Editar gasto">
          ${icon('edit')}
        </button>
        <button class="record-delete" type="button" data-delete-expense="${expense.id}" aria-label="Borrar gasto">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

export function render(ctx) {
  const today = ctx.today;
  const week = getWeekRange(today);
  const expenses = ctx.snapshot.expenses;
  const filters = getFilters(ctx, VIEW_KEY);
  const filteredExpenses = filterRecords(expenses, filters, { textFields: ['concept'] });
  const shownExpenses = filteredExpenses.slice(0, filters.limit);
  const groups = groupByDate(shownExpenses);
  const expensesToday = expenses.filter((expense) => expense.date === today);
  const expensesWeek = expenses.filter(
    (expense) => expense.date >= week.start && expense.date <= week.end
  );
  const fixedWeek = expensesWeek.filter(
    (expense) => expense.category === 'fixed'
  );
  const variableWeek = expensesWeek.filter(
    (expense) => expense.category !== 'fixed' && expense.category !== 'owner'
  );
  const ownerWeek = expensesWeek.filter((expense) => expense.category === 'owner');

  return `
    ${pageHeader({
      eyebrow: 'Dinero que sale',
      title: 'Gastos',
      subtitle: 'Registra los gastos del negocio. Las compras de insumos van en su propia pantalla.',
      actions: expenses.length ? exportCsvButton('expenses') : ''
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
          detail: `${formatWeekRange(week.start, week.end)} · Fijos ${money(sum(fixedWeek.map((expense) => expense.amount)))} · Variables ${money(sum(variableWeek.map((expense) => expense.amount)))}`,
          tone: 'warning',
          iconName: 'chart'
        })}
        ${statCard({
          label: 'Fijos de la semana',
          value: money(sum(fixedWeek.map((expense) => expense.amount))),
          detail: `Renta, luz, agua, sueldos…`,
          tone: 'default',
          iconName: 'calendar'
        })}
        ${ownerWeek.length
          ? statCard({
              label: 'Retiros del dueño',
              value: money(sum(ownerWeek.map((expense) => expense.amount))),
              detail: 'No cuentan como gasto del negocio',
              tone: 'default',
              iconName: 'download'
            })
          : ''}
      </div>
    </section>

    ${renderRecurring(ctx)}

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Gastos registrados</h2>
          <p>${expenses.length} gasto${expenses.length === 1 ? '' : 's'} en total.</p>
        </div>
      </div>

      ${expenses.length > 0 ? renderFilterBar({
          viewKey: VIEW_KEY,
          filters,
          showText: true,
          textPlaceholder: 'Buscar por concepto…',
          count: filteredExpenses.length,
          total: expenses.length
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
                    ${group.items.map((expense) => renderExpenseItem(expense)).join('')}
                  </div>
                `
              )
              .join('')}
          </div>`
        : emptyState({
            iconName: 'receipt',
            title: expenses.length ? 'Ningún gasto coincide con el filtro' : 'Todavía no hay gastos',
            text: expenses.length
              ? 'Prueba con otro rango de fechas u otra palabra.'
              : 'Registra los gastos del día para que la ganancia real del corte sea correcta.',
            action: expenses.length
              ? ''
              : '<button class="button button-soft" type="button" data-focus-expense>Registrar el primer gasto</button>'
          })}

      ${renderShowMore(VIEW_KEY, filteredExpenses.length, shownExpenses.length)}
    </section>
  `;
}

export function bind(root, ctx) {
  const form = root.querySelector('#expense-form');
  const conceptInput = form.elements.namedItem('concept');
  const categorySelect = form.elements.namedItem('category');
  const periodSelect = form.elements.namedItem('period');

  // Cuando el concepto claramente es fijo (renta, luz, sueldos…), lo sugerimos.
  conceptInput.addEventListener('input', () => {
    if (!categorySelect) return;
    categorySelect.value = suggestExpenseCategory(conceptInput.value);
  });

  handleSubmit(form, async () => {
    const values = readForm(form);
    if (ctx.state.editingExpenseId) {
      await ctx.store.updateExpense(ctx.state.editingExpenseId, values);
      ctx.state.editingExpenseId = null;
      ctx.toast('Gasto actualizado.', 'success');
    } else {
      await ctx.store.addExpense(values);
      ctx.toast('Gasto registrado.', 'success');
    }
    resetFormWithDate(form, ctx.today);
    if (categorySelect) categorySelect.value = 'variable';
    if (periodSelect) periodSelect.value = 'once';
    ctx.refresh();
  });

  root.querySelector('[data-cancel-expense-edit]')?.addEventListener('click', () => {
    ctx.state.editingExpenseId = null;
    ctx.refresh();
  });

  root.querySelectorAll('[data-edit-expense]').forEach((button) => {
    button.addEventListener('click', () => {
      ctx.state.editingExpenseId = button.dataset.editExpense;
      ctx.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  root.querySelector('[data-focus-expense]')?.addEventListener('click', () => {
    conceptInput?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  root.querySelectorAll('[data-delete-expense]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar este gasto?')) return;
      const expense = ctx.snapshot.expenses.find(
        (item) => item.id === button.dataset.deleteExpense
      );
      if (!expense) return;
      try {
        await deleteWithUndo(ctx, expense, 'Gasto borrado.');
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });

  root.querySelector('[data-export-csv="expenses"]')?.addEventListener('click', () => {
    const expenses = ctx.snapshot.expenses;
    downloadCsv(
      `nuvy-gastos-${ctx.today}.csv`,
      ['Fecha', 'Concepto', 'Tipo', 'Monto (MXN)', 'Cada cuánto'],
      expenses.map((expense) => [
        expense.date,
        expense.concept,
        expense.category === 'fixed'
          ? 'Fijo'
          : expense.category === 'owner'
            ? 'Retiro del dueño'
            : 'Variable',
        expense.amount,
        EXPENSE_PERIOD_LABELS[expense.period ?? 'once'] ?? 'Una sola vez'
      ])
    );
    ctx.toast('Gastos descargados en CSV.', 'success');
  });

  bindFilterBar(root, ctx, VIEW_KEY);
  bindShowMore(root, ctx, VIEW_KEY);
}
