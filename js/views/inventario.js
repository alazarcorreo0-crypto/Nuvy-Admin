import { formatDateLong, formatDateShort } from '../core/dates.js';
import { baseQuantity, money, number, purchaseQuantity, sum } from '../core/format.js';
import {
  baseToPurchaseUnits,
  countToBase,
  countUnitLabel,
  countUnitOptions,
  getBaseUnitLabel,
  getPurchaseUnitLabel
} from '../core/units.js';
import {
  averageDailyConsumption,
  getWeightedAverageCost
} from '../core/inventory.js';
import { WASTE_REASONS } from '../core/validation.js';
import {
  emptyState,
  escapeHtml,
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

const VIEW_KEY = 'inventario';

function supplyOptions(supplies, selected) {
  return supplies
    .map(
      (supply) =>
        `<option value="${supply.id}" ${supply.id === selected ? 'selected' : ''}>${escapeHtml(supply.name)}</option>`
    )
    .join('');
}

function unitOptions(supply, selected) {
  return countUnitOptions(supply)
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === selected ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
    )
    .join('');
}

function reasonOptions(selected) {
  return WASTE_REASONS.map(
    (reason) => `<option value="${escapeHtml(reason)}" ${reason === selected ? 'selected' : ''}>${escapeHtml(reason.charAt(0).toUpperCase() + reason.slice(1))}</option>`
  ).join('');
}

function renderForm(ctx) {
  const supplies = ctx.snapshot.supplies;
  if (supplies.length === 0) {
    return emptyState({
      iconName: 'box',
      title: 'Primero da de alta un insumo',
      text: 'Para contar el inventario necesitas tener insumos en el catálogo.',
      action: '<button class="button button-primary" data-go="insumos">Ir a Insumos</button>'
    });
  }

  const first = supplies[0];
  const firstUnit = countUnitOptions(first)[0]?.value ?? 'g';

  return `
    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2>Conteo físico</h2>
          <p>Escribe cuánto queda físicamente. Puedes contar en gramos, kilos, bolsas, piezas, mililitros o litros.</p>
        </div>
      </div>

      <form id="count-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="count-date">Fecha del conteo</label>
            <input id="count-date" name="date" type="date" required value="${ctx.today}">
          </div>
          <div class="field">
            <label for="count-supply">Insumo</label>
            <select id="count-supply" name="supplyId" required>
              ${supplyOptions(supplies, '')}
            </select>
          </div>
          <div class="field">
            <label for="count-quantity">Cantidad física</label>
            <div class="input-suffix-wrap">
              <input id="count-quantity" name="quantity" type="number" inputmode="decimal"
                min="0" step="0.01" required placeholder="Ej. 3000">
              <span class="input-suffix" data-count-unit>g</span>
            </div>
            <span class="field-help" data-count-help>Puedes escribir 0 si se acabó.</span>
          </div>
          <div class="field">
            <label for="count-unit">Unidad del conteo</label>
            <select id="count-unit" name="unit" required>
              ${unitOptions(first, firstUnit)}
            </select>
          </div>
          <div class="field field-span-2">
            <p class="prefill-note hidden" data-count-prefill></p>
            <div class="form-preview" data-count-preview></div>
          </div>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('clipboard')} Guardar conteo</button>
        </div>
      </form>
    </section>
  `;
}

/**
 * Formulario de merma: lo que se perdió y por qué.
 */
function renderWasteForm(ctx) {
  const supplies = ctx.snapshot.supplies;
  if (supplies.length === 0) return '';

  const first = supplies[0];
  const firstUnit = countUnitOptions(first)[0]?.value ?? 'g';

  return `
    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2>Registrar merma</h2>
          <p>¿Se derritió nieve, se cayó algo o regalaste muestras? Regístralo aquí para que el corte sepa cuánto producto se vendió de verdad.</p>
        </div>
      </div>

      <form id="waste-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="waste-date">Fecha</label>
            <input id="waste-date" name="date" type="date" required value="${ctx.today}">
          </div>
          <div class="field">
            <label for="waste-supply">Insumo</label>
            <select id="waste-supply" name="supplyId" required>
              ${supplyOptions(supplies, '')}
            </select>
          </div>
          <div class="field">
            <label for="waste-quantity">Cantidad perdida</label>
            <div class="input-suffix-wrap">
              <input id="waste-quantity" name="quantity" type="number" inputmode="decimal"
                min="0.0001" step="any" required placeholder="Ej. 500">
              <span class="input-suffix" data-waste-unit>g</span>
            </div>
          </div>
          <div class="field">
            <label for="waste-unit">Unidad</label>
            <select id="waste-unit" name="unit" required>
              ${unitOptions(first, firstUnit)}
            </select>
          </div>
          <div class="field">
            <label for="waste-reason">¿Por qué se perdió?</label>
            <select id="waste-reason" name="reason" required>
              ${reasonOptions('se derritió')}
            </select>
          </div>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('alert')} Guardar merma</button>
        </div>
      </form>
    </section>
  `;
}

/**
 * Tabla de inventario estimado con valor y días que alcanza.
 */
function renderEstimatedTable(ctx) {
  const supplies = ctx.snapshot.supplies;
  if (supplies.length === 0) return '';

  const rows = supplies.map((supply) => {
    const estimate = ctx.store.getEstimatedInventoryFor(supply, ctx.today);
    const baseUnit = getBaseUnitLabel(supply);
    const costInfo = getWeightedAverageCost(supply, ctx.snapshot.purchases);
    const value =
      estimate.quantity !== null ? estimate.quantity * costInfo.costPerBase : null;
    const daily = averageDailyConsumption(
      ctx.snapshot.counts,
      ctx.snapshot.purchases,
      supply,
      ctx.today
    );
    const days =
      daily !== null && estimate.quantity !== null
        ? Math.floor(estimate.quantity / daily)
        : null;
    return { supply, estimate, baseUnit, costInfo, value, daily, days };
  });

  const totalCapital = sum(
    rows.map((row) => row.value).filter((value) => value !== null)
  );

  return `
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Inventario estimado</h2>
          <p>Último conteo + compras registradas después de ese conteo. No se descuenta por ventas.</p>
        </div>
      </div>

      <div class="stats-grid">
        ${statCard({
          label: 'Capital en inventario',
          value: money(totalCapital),
          detail: 'Suma del inventario estimado valorizado a costo promedio',
          tone: 'default',
          iconName: 'box'
        })}
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Insumo</th>
              <th>Último conteo</th>
              <th class="num">Quedó</th>
              <th class="num">Compras después</th>
              <th class="num">Estimado hoy</th>
              <th class="num">Valor</th>
              <th class="num">Días que alcanza</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(({ supply, estimate, baseUnit, value, days }) => {
                const lastCount = estimate.lastCount;
                return `
                  <tr>
                    <td><strong>${escapeHtml(supply.name)}</strong></td>
                    <td>${lastCount ? formatDateShort(lastCount.date) : '<span class="muted">Sin conteo</span>'}</td>
                    <td class="num">${lastCount ? baseQuantity(lastCount.quantity, baseUnit) : '—'}</td>
                    <td class="num">${lastCount ? `+${baseQuantity(estimate.purchasesAfter, baseUnit)}` : '—'}</td>
                    <td class="num strong">${estimate.quantity !== null ? baseQuantity(estimate.quantity, baseUnit) : '—'}</td>
                    <td class="num">${value !== null ? money(value) : '—'}</td>
                    <td class="num">${days !== null ? `${days > 365 ? '365+' : number(days, 0)} día${days === 1 ? '' : 's'}` : '—'}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="sim-note">
        <strong>Valor:</strong> inventario estimado × costo promedio de tus compras.
        <strong>Días que alcanza:</strong> inventario estimado ÷ consumo diario promedio de las
        últimas 4 semanas. Un guion (—) significa que todavía no hay historial suficiente para calcularlo.
      </p>
    </section>
  `;
}

function renderCountItem(count, ctx) {
  const supply = ctx.store.getSupplyById(count.supplyId);
  const baseUnit = count.baseUnit ?? (supply ? getBaseUnitLabel(supply) : 'g');
  const entered = count.enteredUnit
    ? `${number(count.enteredQuantity, 2)} ${countUnitLabel(supply, count.enteredUnit)}`
    : baseQuantity(count.quantity, baseUnit);
  const base = baseQuantity(count.quantity, baseUnit);
  const unitLabel = supply ? getPurchaseUnitLabel(supply.purchaseUnit, true) : '';

  return `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title">
          ${escapeHtml(count.supplyName ?? supply?.name ?? 'Insumo borrado')}
          <span class="badge badge-success">${entered}</span>
        </div>
        <div class="record-meta">
          <span>${formatDateShort(count.date)}</span>
          <span>Equivale a ${base}</span>
          ${supply ? `<span>${purchaseQuantity(baseToPurchaseUnits(count.quantity, supply), supply.purchaseUnit)} de ${unitLabel}</span>` : ''}
        </div>
      </div>
      <div class="record-actions">
        <button class="record-delete" type="button" data-delete-count="${count.id}" aria-label="Borrar conteo">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

function renderWasteItem(waste, ctx) {
  const supply = ctx.store.getSupplyById(waste.supplyId);
  const baseUnit = waste.baseUnit ?? (supply ? getBaseUnitLabel(supply) : 'g');
  const entered = waste.enteredUnit
    ? `${number(waste.enteredQuantity, 2)} ${countUnitLabel(supply, waste.enteredUnit)}`
    : baseQuantity(waste.quantity, baseUnit);

  return `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title">
          ${escapeHtml(waste.supplyName ?? supply?.name ?? 'Insumo borrado')}
          <span class="badge badge-danger">Merma · ${escapeHtml(waste.reason ?? 'otro')}</span>
        </div>
        <div class="record-meta">
          <span>${formatDateShort(waste.date)}</span>
          <span>Se perdieron ${baseQuantity(waste.quantity, baseUnit)} (${entered})</span>
        </div>
      </div>
      <div class="record-actions">
        <button class="record-delete" type="button" data-delete-waste="${waste.id}" aria-label="Borrar merma">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

export function render(ctx) {
  const counts = ctx.snapshot.counts;
  const wastes = ctx.snapshot.wastes;
  const filters = getFilters(ctx, VIEW_KEY);
  const filteredCounts = filterRecords(counts, filters);
  const shownCounts = filteredCounts.slice(0, filters.limit);
  const groups = groupByDate(shownCounts);
  const wasteGroups = groupByDate(wastes.slice(0, 20));

  return `
    ${pageHeader({
      eyebrow: 'Viernes de inventario',
      title: 'Inventario',
      subtitle: 'El inventario solo cambia con compras y conteos físicos. Nunca se descuenta automáticamente por una venta.',
      actions: counts.length ? exportCsvButton('counts') : ''
    })}

    <div class="notice notice-info">
      <div class="notice-icon">${icon('info')}</div>
      <div class="notice-body">
        <strong>Si un insumo se acabó a media semana</strong>
        <p>Registra un conteo en cero, luego registra la compra nueva y al viernes haz el conteo final. El sistema maneja varios conteos y compras dentro de la misma semana.</p>
      </div>
    </div>

    ${renderForm(ctx)}
    ${renderWasteForm(ctx)}
    ${renderEstimatedTable(ctx)}

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Conteos registrados</h2>
          <p>${counts.length} conteo${counts.length === 1 ? '' : 's'} en total.</p>
        </div>
      </div>

      ${counts.length > 0 ? renderFilterBar({
          viewKey: VIEW_KEY,
          filters,
          supplies: ctx.snapshot.supplies,
          showSupply: true,
          supplyLabel: 'Insumo del conteo',
          count: filteredCounts.length,
          total: counts.length
        }) : ''}

      ${groups.length
        ? `<div class="record-list">
            ${groups
              .map(
                (group) => `
                  <div class="record-group">
                    <div class="record-group-head">
                      <strong>${formatDateLong(group.date)}</strong>
                      <span>${group.items.length} insumo${group.items.length === 1 ? '' : 's'}</span>
                    </div>
                    ${group.items.map((count) => renderCountItem(count, ctx)).join('')}
                  </div>
                `
              )
              .join('')}
          </div>`
        : emptyState({
            iconName: 'clipboard',
            title: counts.length ? 'Ningún conteo coincide con el filtro' : 'Todavía no hay conteos',
            text: counts.length
              ? 'Prueba con otro rango de fechas u otro insumo.'
              : 'El viernes es el día de inventario. Cuenta cada insumo y registra lo que queda físicamente.',
            action: counts.length
              ? ''
              : '<button class="button button-soft" type="button" data-focus-count>Registrar el primer conteo</button>'
          })}

      ${renderShowMore(VIEW_KEY, filteredCounts.length, shownCounts.length)}
    </section>

    ${wastes.length
      ? `
        <section class="section">
          <div class="section-heading">
            <div>
              <h2>Mermas registradas</h2>
              <p>${wastes.length} merma${wastes.length === 1 ? '' : 's'} en total.</p>
            </div>
          </div>
          <div class="record-list">
            ${wasteGroups
              .map(
                (group) => `
                  <div class="record-group">
                    <div class="record-group-head">
                      <strong>${formatDateLong(group.date)}</strong>
                      <span>${group.items.length} merma${group.items.length === 1 ? '' : 's'}</span>
                    </div>
                    ${group.items.map((waste) => renderWasteItem(waste, ctx)).join('')}
                  </div>
                `
              )
              .join('')}
          </div>
        </section>
      `
      : ''}
  `;
}

function currentSupply(form, ctx) {
  return ctx.store.getSupplyById(form.elements.namedItem('supplyId').value);
}

/**
 * Convierte una cantidad base a la unidad del formulario.
 */
function baseToCountUnit(base, unit, supply) {
  const factor = countToBase(1, unit, supply);
  return factor > 0 ? base / factor : base;
}

function updateCountForm(form, ctx, resetUnit = false) {
  const supply = currentSupply(form, ctx);
  if (!supply) return;

  const unitSelect = form.elements.namedItem('unit');
  const previousUnit = unitSelect.value;
  const options = countUnitOptions(supply);
  const selected = resetUnit || !options.some((option) => option.value === previousUnit)
    ? options[0]?.value
    : previousUnit;
  unitSelect.innerHTML = unitOptions(supply, selected);
  unitSelect.value = selected;

  const unitLabel = form.querySelector('[data-count-unit]');
  const help = form.querySelector('[data-count-help]');
  const preview = form.querySelector('[data-count-preview]');
  const prefillNote = form.querySelector('[data-count-prefill]');
  const quantityInput = form.elements.namedItem('quantity');

  if (unitLabel) {
    unitLabel.textContent =
      selected === 'liter' ? 'L' : selected === 'piece' ? 'pza' : selected === 'bag' ? 'bolsa' : selected;
  }
  if (help) {
    help.textContent = `Puedes contar en ${countUnitOptions(supply).map((option) => option.label).join(', ')}.`;
  }

  // Precargar el conteo con el inventario estimado. Se marca claramente
  // como estimado: nunca se guarda solo, tú decides con el botón Guardar.
  if (quantityInput.value === '') {
    const estimate = ctx.store.getEstimatedInventoryFor(supply, ctx.today);
    if (estimate.quantity !== null) {
      const prefillValue = baseToCountUnit(estimate.quantity, selected, supply);
      const decimals = selected === 'kg' || selected === 'liter' ? 2 : 0;
      quantityInput.value = String(
        Math.round(prefillValue * 10 ** decimals) / 10 ** decimals
      );
      if (prefillNote) {
        prefillNote.classList.remove('hidden');
        prefillNote.textContent = `Precargado con el inventario estimado (${baseQuantity(estimate.quantity, getBaseUnitLabel(supply))}) — ajústalo al conteo real antes de guardar.`;
      }
    } else if (prefillNote) {
      prefillNote.classList.add('hidden');
    }
  }

  // La cantidad se lee DESPUÉS del prellenado para que el preview refleje
  // el valor precargado, no el vacío.
  const quantity = Number(quantityInput.value);

  if (preview) {
    if (Number.isFinite(quantity) && quantity >= 0) {
      const base = countToBase(quantity, selected, supply);
      preview.textContent = `Se guardarán ${baseQuantity(base, getBaseUnitLabel(supply))} de ${supply.name}.`;
    } else {
      preview.textContent = '';
    }
  }
}

function updateWasteForm(form, ctx, resetUnit = false) {
  const supply = currentSupply(form, ctx);
  if (!supply) return;

  const unitSelect = form.elements.namedItem('unit');
  const previousUnit = unitSelect.value;
  const options = countUnitOptions(supply);
  const selected = resetUnit || !options.some((option) => option.value === previousUnit)
    ? options[0]?.value
    : previousUnit;
  unitSelect.innerHTML = unitOptions(supply, selected);
  unitSelect.value = selected;

  const unitLabel = form.querySelector('[data-waste-unit]');
  if (unitLabel) {
    unitLabel.textContent =
      selected === 'liter' ? 'L' : selected === 'piece' ? 'pza' : selected === 'bag' ? 'bolsa' : selected;
  }
}

export function bind(root, ctx) {
  root.querySelector('[data-export-csv="counts"]')?.addEventListener('click', () => {
    const counts = ctx.snapshot.counts;
    downloadCsv(
      `nuvy-conteos-${ctx.today}.csv`,
      ['Fecha', 'Insumo', 'Cantidad capturada', 'Unidad capturada', 'Cantidad base', 'Unidad base'],
      counts.map((count) => [
        count.date,
        count.supplyName,
        count.enteredQuantity ?? count.quantity,
        count.enteredUnit ?? count.baseUnit ?? 'g',
        count.quantity,
        count.baseUnit ?? 'g'
      ])
    );
    ctx.toast('Conteos descargados en CSV.', 'success');
  });

  root.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => ctx.navigate(button.dataset.go));
  });

  const form = root.querySelector('#count-form');
  if (form) {
    form.elements.namedItem('supplyId').addEventListener('change', () => updateCountForm(form, ctx, true));
    form.elements.namedItem('unit').addEventListener('change', () => updateCountForm(form, ctx));
    form.elements.namedItem('quantity').addEventListener('input', () => {
      const prefillNote = form.querySelector('[data-count-prefill]');
      if (prefillNote && form.elements.namedItem('quantity').value === '') {
        return; // vacío: se vuelve a precargar al cambiar de insumo
      }
      prefillNote?.classList.add('hidden');
      updateCountForm(form, ctx);
    });
    updateCountForm(form, ctx, true);

    handleSubmit(form, async () => {
      const values = readForm(form);
      await ctx.store.addCount(values);
      ctx.toast('Conteo guardado.', 'success');
      const prefillNote = form.querySelector('[data-count-prefill]');
      prefillNote?.classList.add('hidden');
      resetFormWithDate(form, ctx.today, ['supplyId']);
      updateCountForm(form, ctx, false);
      ctx.refresh();
    });

    root.querySelector('[data-focus-count]')?.addEventListener('click', () => {
      form.elements.namedItem('quantity')?.focus();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    root.querySelectorAll('[data-delete-count]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirmDelete('¿Borrar este conteo? El inventario estimado cambiará.')) return;
        const count = ctx.snapshot.counts.find(
          (item) => item.id === button.dataset.deleteCount
        );
        if (!count) return;
        try {
          await deleteWithUndo(ctx, count, 'Conteo borrado.');
        } catch (error) {
          ctx.toast(error.message, 'danger');
        }
      });
    });
  }

  const wasteForm = root.querySelector('#waste-form');
  if (wasteForm) {
    wasteForm.elements.namedItem('supplyId').addEventListener('change', () =>
      updateWasteForm(wasteForm, ctx, true)
    );
    updateWasteForm(wasteForm, ctx, true);

    handleSubmit(wasteForm, async () => {
      const values = readForm(wasteForm);
      await ctx.store.addWaste(values);
      ctx.toast('Merma registrada.', 'success');
      resetFormWithDate(wasteForm, ctx.today, ['supplyId']);
      updateWasteForm(wasteForm, ctx, false);
      ctx.refresh();
    });

    root.querySelectorAll('[data-delete-waste]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!confirmDelete('¿Borrar esta merma?')) return;
        const waste = ctx.snapshot.wastes.find(
          (item) => item.id === button.dataset.deleteWaste
        );
        if (!waste) return;
        try {
          await deleteWithUndo(ctx, waste, 'Merma borrada.');
        } catch (error) {
          ctx.toast(error.message, 'danger');
        }
      });
    });
  }

  bindFilterBar(root, ctx, VIEW_KEY);
  bindShowMore(root, ctx, VIEW_KEY);
}
