import {
  allowedPurchaseUnits,
  defaultContentForUnit,
  defaultUnitForBaseUnit,
  getBaseUnitLabel,
  getContentHelp,
  getContentLabel,
  getContentSuffix,
  getPurchaseUnitLabel,
  getSupplyType,
  isContentFixed,
  purchaseUnitsForBaseUnit
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

function typeOptionsFor(ctx, selected) {
  return (ctx.snapshot.supplyTypes ?? [])
    .map(
      (entry) =>
        `<option value="${entry.key}" ${entry.key === selected ? 'selected' : ''}>${escapeHtml(entry.config.label)}</option>`
    )
    .join('');
}

function renderForm(ctx) {
  const editing = ctx.state.editingSupplyId
    ? ctx.store.getSupplyById(ctx.state.editingSupplyId)
    : null;
  const type = editing?.type ?? 'base';
  const unit = editing?.purchaseUnit ?? getSupplyType(type).defaultUnit;
  const content = editing?.contentPerUnit ?? defaultContentForUnit(unit, type);
  const suffix = getContentSuffix(unit, type);
  const fixed = isContentFixed(unit, type);

  return `
    <section class="card form-card" id="supply-form-card">
      <div class="card-header">
        <div>
          <h2>${editing ? 'Editar insumo' : 'Nuevo insumo'}</h2>
          <p>${editing ? 'Los cambios aplican a las próximas compras.' : 'Registra la base, los toppings, los desechables, la limpieza y lo que necesites.'}</p>
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
              ${typeOptionsFor(ctx, type)}
            </select>
            <button class="button button-small button-ghost" type="button" data-new-type>
              ${icon('plus')} Agregar tipo
            </button>
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

function renderTypeCard(entry) {
  const config = entry.config;
  const baseLabel = getBaseUnitLabel({ type: entry.key });
  const unitList = (config.units ?? [])
    .map((unit) => getPurchaseUnitLabel(unit, true))
    .join(', ');

  return `
    <article class="type-card">
      <div class="type-card-main">
        <div class="type-card-title">
          <strong>${escapeHtml(config.label)}</strong>
          <span class="badge badge-neutral">${entry.custom ? 'Personalizado' : 'Fijo'}</span>
        </div>
        <p>Se mide en <strong>${escapeHtml(baseLabel)}</strong> · Se compra por ${escapeHtml(unitList)}.</p>
      </div>
      ${entry.custom
        ? `<div class="supply-actions">
            <button class="button button-icon button-ghost" type="button" data-edit-type="${entry.key}" aria-label="Editar ${escapeHtml(config.label)}">
              ${icon('edit')}
            </button>
            <button class="button button-icon button-ghost" type="button" data-delete-type="${entry.key}" aria-label="Borrar ${escapeHtml(config.label)}">
              ${icon('trash')}
            </button>
          </div>`
        : ''}
    </article>
  `;
}

function renderTypeManager(ctx) {
  const types = ctx.snapshot.supplyTypes ?? [];

  return `
    <section class="section" id="supply-types-section">
      <div class="section-heading">
        <div>
          <h2>Tipos de insumo</h2>
          <p>Agrega categorías como Desechables o Material de limpieza. Puedes editarlas o quitarlas cuando quieras.</p>
        </div>
        <button class="button button-small button-soft" type="button" data-new-type>
          ${icon('plus')} Agregar tipo
        </button>
      </div>

      <div class="type-grid">
        ${types.map((entry) => renderTypeCard(entry)).join('')}
      </div>

      <div class="card form-card hidden" id="type-form-card">
        <div class="card-header">
          <div>
            <h2 data-type-form-title>Nuevo tipo</h2>
            <p data-type-form-copy>Así se medirá y se comprará este tipo de insumo.</p>
          </div>
          <button type="button" class="button button-small button-ghost" data-cancel-type>Cancelar</button>
        </div>

        <form id="type-form" novalidate>
          <input type="hidden" name="typeId" value="">
          <div class="form-grid">
            <div class="field field-span-2">
              <label for="type-name">Nombre del tipo</label>
              <input id="type-name" name="name" type="text" maxlength="40" required
                placeholder="Ej. Desechables, Material de limpieza, Empaques" autocomplete="off">
              <span class="field-help">Después podrás elegir este tipo al dar de alta un insumo.</span>
            </div>

            <div class="field">
              <label for="type-base-unit">¿Cómo se mide?</label>
              <select id="type-base-unit" name="baseUnit" required>
                <option value="piece">Piezas (unidades)</option>
                <option value="g">Gramos (peso)</option>
                <option value="ml">Mililitros (líquido)</option>
              </select>
              <span class="field-help" data-type-base-help></span>
            </div>

            <div class="field">
              <label for="type-default-unit">Unidad de compra principal</label>
              <select id="type-default-unit" name="defaultUnit" required></select>
              <span class="field-help" data-type-unit-help></span>
            </div>
          </div>

          <div class="form-actions">
            <button class="button button-primary" type="submit">${icon('check')} Guardar tipo</button>
          </div>
        </form>
      </div>
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
      subtitle: 'Lo que compras para preparar, servir y mantener el negocio. El costo por unidad se calcula solo.'
    })}

    ${renderForm(ctx)}

    ${renderTypeManager(ctx)}

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
            text: 'Empieza con la base de nieve. Después agrega los toppings, los desechables y lo que uses en el negocio.',
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
    contentInput.value = String(defaultContentForUnit(nextUnit, type));
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

  if (isContentFixed(unit, type)) {
    contentInput.value = String(defaultContentForUnit(unit, type));
    contentInput.readOnly = true;
  } else {
    contentInput.readOnly = false;
    if (!contentInput.value || contentInput.value === '1000' || contentInput.value === '1') {
      contentInput.value = String(defaultContentForUnit(unit, type));
    }
  }

  if (unitHelp) {
    const config = getSupplyType(type);
    unitHelp.textContent = config.custom
      ? `Se compra por ${config.units.map((item) => getPurchaseUnitLabel(item, true)).join(', ')}.`
      : type === 'base'
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
  const baseUnit = getBaseUnitLabel({ type });

  if (!preview) return;
  if (!(content > 0) || !Number.isFinite(price)) {
    preview.textContent = '';
    return;
  }

  const perBase = price / content;
  preview.textContent = `Costo calculado: ${money(price)} por ${getPurchaseUnitLabel(unit)} ÷ ${number(content, 2)} ${baseUnit} = ${cost(perBase)} por ${baseUnit}.`;
}

function syncTypeFormUnits(form, selected = null) {
  const baseUnit = form.elements.namedItem('baseUnit').value;
  const units = purchaseUnitsForBaseUnit(baseUnit);
  const current = selected ?? form.elements.namedItem('defaultUnit').value;
  const chosen = units.includes(current) ? current : defaultUnitForBaseUnit(baseUnit);
  const select = form.elements.namedItem('defaultUnit');
  const baseHelp = form.querySelector('[data-type-base-help]');
  const unitHelp = form.querySelector('[data-type-unit-help]');

  select.innerHTML = units
    .map(
      (unit) =>
        `<option value="${unit}" ${unit === chosen ? 'selected' : ''}>${escapeHtml(getPurchaseUnitLabel(unit, true))}</option>`
    )
    .join('');
  select.value = chosen;

  if (baseHelp) {
    baseHelp.textContent = baseUnit === 'piece'
      ? 'El inventario se cuenta en piezas. Ideal para desechables, empaques y limpieza.'
      : baseUnit === 'g'
        ? 'El inventario se cuenta en gramos.'
        : 'El inventario se cuenta en mililitros.';
  }

  if (unitHelp) {
    unitHelp.textContent = baseUnit === 'piece'
      ? 'Se compra por pieza o por bolsa. El contenido es cuántas piezas trae la bolsa.'
      : baseUnit === 'g'
        ? 'Se compra por kg, pieza o bolsa. El contenido es cuántos gramos trae cada una.'
        : 'Se compra por litro o por kg. La app toma 1 litro o 1 kg como 1,000 ml.';
  }
}

function showTypeForm(root, { id = '', name = '', baseUnit = 'piece', defaultUnit = null } = {}) {
  const card = root.querySelector('#type-form-card');
  const form = root.querySelector('#type-form');
  if (!card || !form) return;

  form.elements.namedItem('typeId').value = id;
  form.elements.namedItem('name').value = name;
  form.elements.namedItem('baseUnit').value = baseUnit;
  syncTypeFormUnits(form, defaultUnit);

  const title = root.querySelector('[data-type-form-title]');
  const copy = root.querySelector('[data-type-form-copy]');
  if (title) title.textContent = id ? 'Editar tipo' : 'Nuevo tipo';
  if (copy) {
    copy.textContent = id
      ? 'Puedes cambiar el nombre. Si ya tiene insumos, no se puede cambiar cómo se mide.'
      : 'Así se medirá y se comprará este tipo de insumo.';
  }

  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  form.elements.namedItem('name').focus();
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

  const typeForm = root.querySelector('#type-form');
  const typeCard = root.querySelector('#type-form-card');

  root.querySelectorAll('[data-new-type]').forEach((button) => {
    button.addEventListener('click', () => showTypeForm(root));
  });

  root.querySelectorAll('[data-edit-type]').forEach((button) => {
    const entry = (ctx.snapshot.supplyTypes ?? []).find(
      (item) => item.key === button.dataset.editType
    );
    if (!entry) return;
    button.addEventListener('click', () => {
      showTypeForm(root, {
        id: entry.key,
        name: entry.config.label,
        baseUnit: entry.config.baseUnit,
        defaultUnit: entry.config.defaultUnit
      });
    });
  });

  root.querySelectorAll('[data-delete-type]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar este tipo? Solo se puede borrar si no tiene insumos registrados.')) return;
      try {
        await ctx.store.deleteSupplyType(button.dataset.deleteType);
        ctx.toast('Tipo borrado.', 'success');
        ctx.refresh();
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });

  root.querySelector('[data-cancel-type]')?.addEventListener('click', () => {
    typeForm?.reset();
    typeCard?.classList.add('hidden');
  });

  if (typeForm) {
    typeForm.elements.namedItem('baseUnit').addEventListener('change', () => {
      syncTypeFormUnits(typeForm);
    });
    syncTypeFormUnits(typeForm);

    handleSubmit(typeForm, async () => {
      const values = readForm(typeForm);
      const id = values.typeId;
      delete values.typeId;
      if (id) {
        await ctx.store.updateSupplyType(id, values);
        ctx.toast('Tipo actualizado.', 'success');
      } else {
        await ctx.store.addSupplyType(values);
        ctx.toast('Tipo agregado.', 'success');
      }
      ctx.refresh();
    });
  }

  root.querySelector('[data-focus-form]')?.addEventListener('click', () => {
    form.elements.namedItem('name')?.focus();
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
