import { addDays } from '../core/dates.js';
import { escapeHtml } from '../ui/components.js';
import { icon } from '../ui/icons.js';

/**
 * Filtros por vista: rango de fechas, atajos rápidos, búsqueda de texto y
 * filtro por insumo. Los filtros viven en ctx.state.viewFilters[viewKey]
 * para que no se pierdan al actualizar la pantalla.
 */

export const DEFAULT_FILTER_LIMIT = 50;

export function getFilters(ctx, viewKey) {
  const stored = ctx.state.viewFilters[viewKey] ?? {};
  return {
    from: '',
    to: '',
    text: '',
    supplyId: '',
    limit: DEFAULT_FILTER_LIMIT,
    ...stored
  };
}

export function saveFilters(ctx, viewKey, changes) {
  ctx.state.viewFilters[viewKey] = {
    ...(ctx.state.viewFilters[viewKey] ?? {}),
    ...changes
  };
}

export function filterRecords(records, filters, { textFields = [] } = {}) {
  const term = String(filters.text ?? '').trim().toLowerCase();
  return records.filter((record) => {
    if (filters.from && String(record.date ?? '') < filters.from) return false;
    if (filters.to && String(record.date ?? '') > filters.to) return false;
    if (filters.supplyId && record.supplyId !== filters.supplyId) return false;
    if (term && textFields.length > 0) {
      const haystack = textFields
        .map((field) => String(record[field] ?? ''))
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

function shortcutRange(kind, today) {
  if (kind === 'all') return { from: '', to: '' };
  if (kind === 'month') {
    return { from: `${today.slice(0, 7)}-01`, to: monthEnd(today) };
  }
  if (kind === 'lastMonth') {
    const [year, month] = today.slice(0, 7).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 2, 1));
    const previous = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return { from: `${previous}-01`, to: monthEnd(`${previous}-15`) };
  }
  if (kind === '30d') {
    return { from: addDays(today, -29), to: today };
  }
  return null;
}

function monthEnd(dateString) {
  const [year, month] = dateString.slice(0, 7).split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${dateString.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
}

/**
 * Barra de filtros: fechas desde/hasta, chips de atajos, búsqueda y filtro
 * de insumo (opcional). El que llame decide qué muestra.
 */
export function renderFilterBar({
  viewKey,
  filters,
  supplies = [],
  showText = false,
  showSupply = false,
  textPlaceholder = 'Buscar…',
  supplyLabel = 'Insumo',
  count = 0,
  total = 0
}) {
  const supplyOptions = supplies
    .map(
      (supply) =>
        `<option value="${supply.id}" ${supply.id === filters.supplyId ? 'selected' : ''}>${escapeHtml(supply.name)}</option>`
    )
    .join('');

  return `
    <div class="filter-bar" data-filter-bar="${escapeHtml(viewKey)}">
      <div class="field filter-field-date">
        <label for="filter-from-${escapeHtml(viewKey)}">Desde</label>
        <input id="filter-from-${escapeHtml(viewKey)}" type="date" data-filter-from value="${escapeHtml(filters.from)}">
      </div>
      <div class="field filter-field-date">
        <label for="filter-to-${escapeHtml(viewKey)}">Hasta</label>
        <input id="filter-to-${escapeHtml(viewKey)}" type="date" data-filter-to value="${escapeHtml(filters.to)}">
      </div>
      ${showSupply ? `
        <div class="field filter-field-select">
          <label for="filter-supply-${escapeHtml(viewKey)}">${escapeHtml(supplyLabel)}</label>
          <select id="filter-supply-${escapeHtml(viewKey)}" data-filter-supply>
            <option value="">Todos</option>
            ${supplyOptions}
          </select>
        </div>
      ` : ''}
      ${showText ? `
        <div class="field filter-field-search">
          <label for="filter-text-${escapeHtml(viewKey)}">Buscar</label>
          <input id="filter-text-${escapeHtml(viewKey)}" type="search" data-filter-text
            placeholder="${escapeHtml(textPlaceholder)}" value="${escapeHtml(filters.text)}">
        </div>
      ` : ''}
      <div class="chip-row">
        <button type="button" class="chip" data-filter-shortcut="month">Este mes</button>
        <button type="button" class="chip" data-filter-shortcut="lastMonth">Mes pasado</button>
        <button type="button" class="chip" data-filter-shortcut="30d">Últimos 30 días</button>
        <button type="button" class="chip" data-filter-shortcut="all">Todo</button>
        <span class="filter-count">${count === total ? `${total} registro${total === 1 ? '' : 's'}` : `${count} de ${total} registro${total === 1 ? '' : 's'}`}</span>
      </div>
    </div>
  `;
}

export function bindFilterBar(root, ctx, viewKey) {
  const bar = root.querySelector(`[data-filter-bar="${viewKey}"]`);
  if (!bar) return;

  bar.querySelectorAll('[data-filter-from]').forEach((input) => {
    input.addEventListener('change', () => {
      saveFilters(ctx, viewKey, { from: input.value });
      ctx.refresh();
    });
  });

  bar.querySelectorAll('[data-filter-to]').forEach((input) => {
    input.addEventListener('change', () => {
      saveFilters(ctx, viewKey, { to: input.value });
      ctx.refresh();
    });
  });

  bar.querySelectorAll('[data-filter-supply]').forEach((select) => {
    select.addEventListener('change', () => {
      saveFilters(ctx, viewKey, { supplyId: select.value });
      ctx.refresh();
    });
  });

  bar.querySelectorAll('[data-filter-text]').forEach((input) => {
    input.addEventListener('input', () => {
      // La búsqueda se aplica al soltar el teclado para no redibujar cada letra.
      saveFilters(ctx, viewKey, { text: input.value, limit: DEFAULT_FILTER_LIMIT });
      window.clearTimeout(input.dataset.searchTimer);
      input.dataset.searchTimer = window.setTimeout(() => ctx.refresh(), 350);
    });
  });

  bar.querySelectorAll('[data-filter-shortcut]').forEach((button) => {
    button.addEventListener('click', () => {
      const range = shortcutRange(button.dataset.filterShortcut, ctx.today);
      if (!range) return;
      saveFilters(ctx, viewKey, { ...range, limit: DEFAULT_FILTER_LIMIT });
      ctx.refresh();
    });
  });
}

/**
 * Botón "Ver más" para no dibujar cientos de registros de golpe.
 */
export function renderShowMore(viewKey, filteredCount, shownCount) {
  if (filteredCount <= shownCount) return '';
  const remaining = filteredCount - shownCount;
  return `
    <div class="section" style="text-align:center">
      <button class="button button-soft" type="button" data-show-more="${escapeHtml(viewKey)}">
        ${icon('arrowRight')} Ver más (${remaining} restante${remaining === 1 ? '' : 's'})
      </button>
    </div>
  `;
}

export function bindShowMore(root, ctx, viewKey, step = 50) {
  root.querySelectorAll(`[data-show-more="${viewKey}"]`).forEach((button) => {
    button.addEventListener('click', () => {
      const filters = getFilters(ctx, viewKey);
      saveFilters(ctx, viewKey, { limit: filters.limit + step });
      ctx.refresh();
    });
  });
}
