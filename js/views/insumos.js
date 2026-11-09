import {
  allowedPurchaseUnits,
  defaultContentForUnit,
  getBaseUnitLabel,
  getContentHelp,
  getContentLabel,
  getContentSuffix,
  getPurchaseUnitLabel,
  getSupplyType,
  isContentFixed,
  SUPPLY_TYPES
} from '../core/units.js';
import { cost, money, number, purchaseQuantity } from '../core/format.js';
import { getWeightedAverageCost } from '../core/inventory.js';
import {
  emptyState,
  escapeHtml,
  pageHeader,
  supplyTypeBadge
} from '../ui/components.js';
import { icon } from '../ui/icons.js';
import {
  confirmDelete,
  handleSubmit,
  readForm,
  resetFormWithDate,
  setPreview
} from './shared.js';

function unitOptionsFor(type, selected) {
  return allowedPurchaseUnits(type)
    .map(
      (unit) =>
        `<option value="${unit}" ${unit === selected ? 'selected' : ''}>${escapeHtml(getPurchaseUnitLabel(unit, true))}</option>`
    )
    .join('');
}

function renderForm(ctx) {
  const editing = ctx.state.editingSupplyId
    ? ctx.store.getSupplyById(ctx.state.editingSupplyId)
    : null;
  const type = editing?.type ?? 'base';
  const unit = editing?.purchaseUnit ?? getSupplyType(type).defaultUnit;
  const content = editing?.contentPerUnit ?? defaultContentForUnit(unit);
  const suffix = getContentSuffix(unit, type);
  const fixed = isContentFixed(unit);

  return `
    <section class="card form-card" id="supply-form-card">
      <div class="card-header">
        <div>
          <h2>${editing ? 'Editar insumo' : 'Nuevo insumo'}</h2>
          <p>${editing ? 'Los cambios aplican a las próximas compras.' : 'Registra la base, los toppings secos y los líquidos.'}</p>
        </div>
        ${editing ? '<button type="button" class="button button-small button-ghost" data-cancel-edit>Cancelar</button>' : ''}
      </div>

      <form id="supply-form" novalidate>
        <div class="form-grid">
          <div class="field field-span-2">
            <label for="supply-name">Nombre del insumo</label>
            <input id="supply-name" name="name" type="text" maxlength="90" required
              placeholder="Ej. Base de nieve, Nuez, Gomitas, Chocolate líquido"
              value="${escapeHtml(editing?.name ?? '')}" autocomplete="off">
          </div>

          <div class="field">
            <label for="supply-type">Tipo</label>
            <select id="supply-type" name="type" required>
              ${Object.entries(SUPPLY_TYPES)
                .map(
                  ([value, config]) =>
                    `<option value="${value}" ${value === type ? 'selected' : ''}>${escapeHtml(config.label)}</option>`
                )
                .join('')}
            </select>
          </div>

          <div class="field">
            <label for="supply-unit">Unidad de compra</label>
            <select id="supply-unit" name="purchaseUnit" required>
              ${unitOptionsFor(type, unit)}
            </select>
            <span class="field-help" data-unit-help>La base se compra por bolsa; los toppings secos por kg o pieza; los líquidos por litro o kg.</span>
          </div>

          <div class="field">
            <label for="supply-content" data-content-label>${getContentLabel(unit)} (${suffix})</label>
            <input id="supply-content" name="contentPerUnit" type="number" inputmode="decimal"
              min="0.0001" step="any" required value="${escapeHtml(String(content))}"
              ${fixed ? 'readonly' : ''}>
            <span class="field-help" data-content-help>${escapeHtml(getContentHelp(unit, type))}</span>
          </div>

          <div class="field">
            <label for="supply-price">Precio de compra actual por unidad</label>
            <div class="input-suffix-wrap">
              <input id="supply-price" name="pricePerUnit" type="number" inputmode="decimal"
                min="0" step="0.01" required placeholder="0.00"
                value="${escapeHtml(String(editing?.pricePerUnit ?? ''))}">
              <span class="input-suffix">MXN</span>
            </div>
            <span class="field-help">Es el precio que pagas hoy por una bolsa, kg, pieza o litro.</span>
          </div>

          <div class="field field-span-2">
            <div class="form-preview" data-supply-preview></div>
          </div>
        </div>

        <div class="form-actions">
          <button class="button button-primary" type="submit">
            ${icon('check')} ${editing ? 'Guardar cambios' : 'Guardar insumo'}
          </button>
        </div>
      </form>
    </section>
  `;
}

function renderSupplyCard(supply, ctx) {
  const snapshot = ctx.snapshot;
  const costInfo = getWeightedAverageCost(supply, snapshot.purchases);
  const baseUnit = getBaseUnitLabel(supply);
  const typeConfig = getSupplyType(supply.type);
  const contentSuffix = getContentSuffix(supply.purchaseUnit, supply.type);
  const equivalent = purchaseQuantity(1, supply.purchaseUnit);

  return `
    <article class="supply-card">
      <div class="supply-card-head">
        <div>
          <h3 class="supply-name">${escapeHtml(supply.name)}</h3>
          <div style="margin-top:6px">${supplyTypeBadge(supply.type)}</div>
        </div>
        <div class="supply-actions">
          <button class="button button-icon button-ghost" type="button" data-edit-supply="${supply.id}" aria-label="Editar ${escapeHtml(supply.name)}">
            ${icon('edit')}
          </button>
          <button class="button button-icon button-ghost" type="button" data-delete-supply="${supply.id}" aria-label="Borrar ${escapeHtml(supply.name)}">
            ${icon('trash')}
          </button>
        </div>
      </div>

      <div class="supply-details">
        <div class="supply-detail">
          <span>Compra</span>
          <strong>${equivalent} = ${number(supply.contentPerUnit, 2)} ${contentSuffix}</strong>
        </div>
        <div class="supply-detail">
          <span>Precio actual</span>
          <strong>${money(supply.pricePerUnit)}</strong>
        </div>
        <div class="supply-detail">
          <span>Costo de catálogo</span>
          <strong>${cost(costInfo.source === 'catalog' ? costInfo.costPerBase : supply.pricePerUnit / supply.contentPerUnit)} / ${baseUnit}</strong>
        </div>
        <div class="supply-detail">
          <span>Costo promedio de compras</span>
          <strong>${cost(costInfo.costPerBase)} / ${baseUnit}</strong>
        </div>
      </div>
    </article>
  `;
}

export function render(ctx) {
  const supplies = ctx.snapshot.supplies;
  return `
    ${pageHeader({
      eyebrow: 'Catálogo',
      title: 'Insumos',
      subtitle: 'Lo que compras para preparar y servir. El costo por gramo o mililitro se calcula solo.'
    })}

    ${renderForm(ctx)}

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Tus insumos</h2>
          <p>${supplies.length} insumo${supplies.length === 1 ? '' : 's'} registrado${supplies.length === 1 ? '' : 's'}.</p>
        </div>
      </div>
      ${supplies.length
        ? `<div class="supply-grid">${supplies.map((supply) => renderSupplyCard(supply, ctx)).join('')}</div>`
        : emptyState({
            iconName: 'box',
            title: 'Todavía no hay insumos',
            text: 'Empieza con la base de nieve. Después agrega los toppings secos y líquidos que vendes.',
            action: '<button class="button button-soft" type="button" data-focus-form>Dar de alta el primero</button>'
          })}
    </section>
  `;
}

function syncFormForType(form, resetValues = false) {
  const type = form.elements.namedItem('type').value;
  const unitSelect = form.elements.namedItem('purchaseUnit');
  const contentInput = form.elements.namedItem('contentPerUnit');
  const config = getSupplyType(type);
  const allowed = allowedPurchaseUnits(type);

  const previousUnit = unitSelect.value;
  unitSelect.innerHTML = unitOptionsFor(type, allowed.includes(previousUnit) ? previousUnit : config.defaultUnit);

  if (resetValues || !allowed.includes(previousUnit)) {
    const nextUnit = allowed.includes(previousUnit) ? previousUnit : config.defaultUnit;
    unitSelect.value = nextUnit;
    contentInput.value = String(defaultContentForUnit(nextUnit));
  }

  syncFormForUnit(form);
}

function syncFormForUnit(form) {
  const type = form.elements.namedItem('type').value;
  const unit = form.elements.namedItem('purchaseUnit').value;
  const contentInput = form.elements.namedItem('contentPerUnit');
  const suffix = getContentSuffix(unit, type);
  const label = form.querySelector('[data-content-label]');
  const help = form.querySelector('[data-content-help]');
  const unitHelp = form.querySelector('[data-unit-help]');

  if (label) label.textContent = `${getContentLabel(unit)} (${suffix})`;
  if (help) help.textContent = getContentHelp(unit, type);

  if (isContentFixed(unit)) {
    contentInput.value = '1000';
    contentInput.readOnly = true;
  } else {
    contentInput.readOnly = false;
    if (!contentInput.value || contentInput.value === '1000') {
      contentInput.value = String(defaultContentForUnit(unit));
    }
  }

  if (unitHelp) {
    unitHelp.textContent =
      type === 'base'
        ? 'La base se compra por bolsa. Escribe cuántos gramos trae una bolsa.'
        : type === 'liquid'
          ? 'Los toppings líquidos se compran por litro o por kg. La app toma 1 litro o 1 kg como 1,000 ml.'
          : 'Los toppings secos se compran por kg o por pieza.';
  }

  updatePreview(form);
}

function updatePreview(form) {
  const type = form.elements.namedItem('type').value;
  const unit = form.elements.namedItem('purchaseUnit').value;
  const content = Number(form.elements.namedItem('contentPerUnit').value);
  const price = Number(form.elements.namedItem('pricePerUnit').value);
  const preview = form.querySelector('[data-supply-preview]');
  const baseUnit = getSupplyType(type).baseUnit;

  if (!preview) return;
  if (!(content > 0) || !Number.isFinite(price)) {
    preview.textContent = '';
    return;
  }

  const perBase = price / content;
  preview.textContent = `Costo calculado: ${money(price)} por ${getPurchaseUnitLabel(unit)} ÷ ${number(content, 2)} ${baseUnit} = ${cost(perBase)} por ${baseUnit}.`;
}

export function bind(root, ctx) {
  const form = root.querySelector('#supply-form');
  if (!form) return;

  form.elements.namedItem('type').addEventListener('change', () => {
    syncFormForType(form, true);
  });
  form.elements.namedItem('purchaseUnit').addEventListener('change', () => {
    syncFormForUnit(form);
  });
  form.elements.namedItem('contentPerUnit').addEventListener('input', () => updatePreview(form));
  form.elements.namedItem('pricePerUnit').addEventListener('input', () => updatePreview(form));

  syncFormForUnit(form);
  updatePreview(form);

  handleSubmit(form, async () => {
    const values = readForm(form);
    if (ctx.state.editingSupplyId) {
      await ctx.store.updateSupply(ctx.state.editingSupplyId, values);
      ctx.state.editingSupplyId = null;
      ctx.toast('Insumo actualizado.', 'success');
    } else {
      await ctx.store.addSupply(values);
      ctx.toast('Insumo guardado.', 'success');
    }
    form.reset();
    ctx.refresh();
  });

  root.querySelectorAll('[data-edit-supply]').forEach((button) => {
    button.addEventListener('click', () => {
      ctx.state.editingSupplyId = button.dataset.editSupply;
      ctx.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  root.querySelector('[data-cancel-edit]')?.addEventListener('click', () => {
    ctx.state.editingSupplyId = null;
    ctx.refresh();
  });

  root.querySelectorAll('[data-delete-supply]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar este insumo? Solo se puede borrar si no tiene compras ni conteos.')) return;
      try {
        await ctx.store.deleteSupply(button.dataset.deleteSupply);
        ctx.toast('Insumo borrado.', 'success');
        ctx.refresh();
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });

  root.querySelector('[data-focus-form]')?.addEventListener('click', () => {
    form.elements.namedItem('name')?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
