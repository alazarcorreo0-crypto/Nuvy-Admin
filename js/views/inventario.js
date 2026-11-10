import { formatDateLong, formatDateShort } from '../core/dates.js';
import { baseQuantity, number, purchaseQuantity } from '../core/format.js';
import {
  baseToPurchaseUnits,
  countToBase,
  countUnitLabel,
  countUnitOptions,
  getBaseUnitLabel,
  getPurchaseUnitLabel
} from '../core/units.js';
import {
  emptyState,
  escapeHtml,
  pageHeader
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

function renderEstimatedTable(ctx) {
  const supplies = ctx.snapshot.supplies;
  if (supplies.length === 0) return '';

  return `
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Inventario estimado</h2>
          <p>Último conteo + compras registradas después de ese conteo. No se descuenta por ventas.</p>
        </div>
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
            </tr>
          </thead>
          <tbody>
            ${supplies
              .map((supply) => {
                const estimate = ctx.store.getEstimatedInventoryFor(supply, ctx.today);
                const baseUnit = getBaseUnitLabel(supply);
                const lastCount = estimate.lastCount;
                return `
                  <tr>
                    <td><strong>${escapeHtml(supply.name)}</strong></td>
                    <td>${lastCount ? formatDateShort(lastCount.date) : '<span class="muted">Sin conteo</span>'}</td>
                    <td class="num">${lastCount ? baseQuantity(lastCount.quantity, baseUnit) : '—'}</td>
                    <td class="num">${lastCount ? `+${baseQuantity(estimate.purchasesAfter, baseUnit)}` : '—'}</td>
                    <td class="num strong">${estimate.quantity !== null ? baseQuantity(estimate.quantity, baseUnit) : '—'}</td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
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

export function render(ctx) {
  const counts = ctx.snapshot.counts;
  const groups = groupByDate(counts);

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
    ${renderEstimatedTable(ctx)}

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Conteos registrados</h2>
          <p>${counts.length} conteo${counts.length === 1 ? '' : 's'} en total.</p>
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
            title: 'Todavía no hay conteos',
            text: 'El viernes es el día de inventario. Cuenta cada insumo y registra lo que queda físicamente.',
            action: '<button class="button button-soft" type="button" data-focus-count>Registrar el primer conteo</button>'
          })}
    </section>
  `;
}

function currentSupply(form, ctx) {
  return ctx.store.getSupplyById(form.elements.namedItem('supplyId').value);
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
  const quantity = Number(form.elements.namedItem('quantity').value);
  const unit = unitSelect.value;

  if (unitLabel) {
    unitLabel.textContent = unit === 'liter' ? 'L' : unit === 'piece' ? 'pza' : unit === 'bag' ? 'bolsa' : unit;
  }
  if (help) {
    help.textContent = `Puedes contar en ${countUnitOptions(supply).map((option) => option.label).join(', ')}.`;
  }
  if (preview) {
    if (Number.isFinite(quantity) && quantity >= 0) {
      const base = countToBase(quantity, unit, supply);
      preview.textContent = `Se guardarán ${baseQuantity(base, getBaseUnitLabel(supply))} de ${supply.name}.`;
    } else {
      preview.textContent = '';
    }
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

  const form = root.querySelector('#count-form');
  if (!form) {
    root.querySelectorAll('[data-go]').forEach((button) => {
      button.addEventListener('click', () => ctx.navigate(button.dataset.go));
    });
    return;
  }

  form.elements.namedItem('supplyId').addEventListener('change', () => updateCountForm(form, ctx, true));
  form.elements.namedItem('unit').addEventListener('change', () => updateCountForm(form, ctx));
  form.elements.namedItem('quantity').addEventListener('input', () => updateCountForm(form, ctx));
  updateCountForm(form, ctx, true);

  handleSubmit(form, async () => {
    const values = readForm(form);
    await ctx.store.addCount(values);
    ctx.toast('Conteo guardado.', 'success');
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
      try {
        await ctx.store.deleteRecord(button.dataset.deleteCount);
        ctx.toast('Conteo borrado.', 'success');
        ctx.refresh();
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });
}
