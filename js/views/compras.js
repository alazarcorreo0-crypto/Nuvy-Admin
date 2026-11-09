import { formatDateLong, formatDateShort } from '../core/dates.js';
import {
  baseQuantity,
  cost,
  money,
  number,
  purchaseQuantity
} from '../core/format.js';
import {
  getBaseUnitLabel,
  getPurchaseUnitLabel,
  purchaseToBase
} from '../core/units.js';
import {
  emptyState,
  escapeHtml,
  pageHeader
} from '../ui/components.js';
import { icon } from '../ui/icons.js';
import {
  confirmDelete,
  groupByDate,
  handleSubmit,
  readForm,
  resetFormWithDate
} from './shared.js';

function supplyOptions(supplies, selected) {
  return supplies
    .map(
      (supply) =>
        `<option value="${supply.id}" ${supply.id === selected ? 'selected' : ''}>${escapeHtml(supply.name)} — ${escapeHtml(getPurchaseUnitLabel(supply.purchaseUnit, true))}</option>`
    )
    .join('');
}

function renderForm(ctx) {
  const supplies = ctx.snapshot.supplies;
  if (supplies.length === 0) {
    return emptyState({
      iconName: 'box',
      title: 'Primero da de alta un insumo',
      text: 'Para registrar una compra necesitas tener al menos un insumo en el catálogo.',
      action: '<button class="button button-primary" data-go="insumos">Ir a Insumos</button>'
    });
  }

  const editing = ctx.state.editingPurchaseId
    ? ctx.snapshot.purchases.find((purchase) => purchase.id === ctx.state.editingPurchaseId)
    : null;
  const editingSupply = editing ? ctx.store.getSupplyById(editing.supplyId) : null;
  const selectedSupplyId = editing?.supplyId ?? '';
  const initialUnit = editing
    ? (editing.unit ?? editingSupply?.purchaseUnit ?? '')
    : '';

  return `
    <section class="card form-card">
      <div class="card-header">
        <div>
          <h2>${editing ? 'Editar compra' : 'Registrar compra'}</h2>
          <p>${editing
            ? 'Corrige la fecha, el insumo, la cantidad o el total pagado.'
            : 'La compra aumenta el inventario del sistema. No se descuenta por ventas.'}</p>
        </div>
        ${editing ? '<button type="button" class="button button-small button-ghost" data-cancel-purchase-edit>Cancelar</button>' : ''}
      </div>

      <form id="purchase-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="purchase-date">Fecha</label>
            <input id="purchase-date" name="date" type="date" required value="${editing?.date ?? ctx.today}">
          </div>

          <div class="field">
            <label for="purchase-supply">Insumo</label>
            <select id="purchase-supply" name="supplyId" required>
              ${supplyOptions(supplies, selectedSupplyId)}
            </select>
          </div>

          <div class="field">
            <label for="purchase-quantity">Cantidad comprada</label>
            <div class="input-suffix-wrap">
              <input id="purchase-quantity" name="quantity" type="number" inputmode="decimal"
                min="0.0001" step="any" required placeholder="Ej. 1"
                value="${editing ? escapeHtml(String(editing.quantity)) : ''}">
              <span class="input-suffix" data-purchase-unit>${escapeHtml(initialUnit ? getPurchaseUnitLabel(initialUnit) : 'unidad')}</span>
            </div>
            <span class="field-help" data-purchase-quantity-help>Escribe cuántas bolsas, kg, piezas o litros compraste.</span>
          </div>

          <div class="field">
            <label for="purchase-total">Total pagado</label>
            <div class="input-suffix-wrap">
              <input id="purchase-total" name="totalPaid" type="number" inputmode="decimal"
                min="0" step="0.01" required placeholder="0.00"
                value="${editing ? escapeHtml(String(editing.totalPaid)) : ''}">
              <span class="input-suffix">MXN</span>
            </div>
            <span class="field-help">Lo que pagaste en total por esta compra.</span>
          </div>

          <div class="field field-span-2">
            <div class="form-preview" data-purchase-preview></div>
          </div>
        </div>

        <div class="form-actions">
          <button class="button button-primary" type="submit">
            ${icon(editing ? 'check' : 'plus')} ${editing ? 'Guardar cambios' : 'Guardar compra'}
          </button>
        </div>
      </form>
    </section>
  `;
}

function renderPurchaseItem(purchase, ctx) {
  const supply = ctx.store.getSupplyById(purchase.supplyId);
  const baseUnit = supply ? getBaseUnitLabel(supply) : (purchase.baseUnit ?? 'g');
  const base = (Number(purchase.quantity) || 0) * (Number(purchase.contentPerUnit) || 0);
  const unit = purchase.unit ?? supply?.purchaseUnit ?? '';
  const costPerBase = base > 0 ? (Number(purchase.totalPaid) || 0) / base : 0;

  return `
    <div class="record-item">
      <div class="record-main">
        <div class="record-title">
          ${escapeHtml(purchase.supplyName ?? supply?.name ?? 'Insumo borrado')}
          <span class="badge badge-neutral">${escapeHtml(purchaseQuantity(purchase.quantity, unit))}</span>
        </div>
        <div class="record-meta">
          <span>${formatDateShort(purchase.date)}</span>
          <span>${baseQuantity(base, baseUnit)}</span>
          <span>${cost(costPerBase)} / ${baseUnit}</span>
        </div>
      </div>
      <div class="record-amount">${money(purchase.totalPaid)}</div>
      <div class="record-actions">
        <button class="record-edit" type="button" data-edit-purchase="${purchase.id}" aria-label="Editar compra">
          ${icon('edit')}
        </button>
        <button class="record-delete" type="button" data-delete-purchase="${purchase.id}" aria-label="Borrar compra">
          ${icon('trash')}
        </button>
      </div>
    </div>
  `;
}

export function render(ctx) {
  const purchases = ctx.snapshot.purchases;
  const groups = groupByDate(purchases);
  const form = renderForm(ctx);

  return `
    ${pageHeader({
      eyebrow: 'Inventario que entra',
      title: 'Compras',
      subtitle: 'Cada compra suma al inventario del sistema. El consumo se calcula con los conteos físicos.'
    })}

    ${form}

    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Compras registradas</h2>
          <p>${purchases.length} compra${purchases.length === 1 ? '' : 's'} en total.</p>
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
                    ${group.items.map((purchase) => renderPurchaseItem(purchase, ctx)).join('')}
                  </div>
                `
              )
              .join('')}
          </div>`
        : emptyState({
            iconName: 'cart',
            title: 'Todavía no hay compras',
            text: 'Registra la primera compra de base o toppings para que el inventario empiece a moverse.',
            action: '<button class="button button-soft" data-go="insumos">Revisar insumos</button>'
          })}
    </section>
  `;
}

function currentSupply(form, ctx) {
  return ctx.store.getSupplyById(form.elements.namedItem('supplyId').value);
}

function updatePurchaseForm(form, ctx) {
  const supply = currentSupply(form, ctx);
  const unitLabel = form.querySelector('[data-purchase-unit]');
  const help = form.querySelector('[data-purchase-quantity-help]');
  const preview = form.querySelector('[data-purchase-preview]');
  if (!supply) return;

  const unit = getPurchaseUnitLabel(supply.purchaseUnit);
  if (unitLabel) unitLabel.textContent = unit;
  if (help) {
    help.textContent = `Se registrará en ${getPurchaseUnitLabel(supply.purchaseUnit, true)}. Contenido: ${number(supply.contentPerUnit, 2)} ${getBaseUnitLabel(supply)} por ${unit}.`;
  }

  const quantity = Number(form.elements.namedItem('quantity').value);
  const total = Number(form.elements.namedItem('totalPaid').value);
  if (preview) {
    if (quantity > 0) {
      const base = purchaseToBase(quantity, supply);
      const costPerBase = total > 0 ? total / base : 0;
      preview.textContent = `Entran ${baseQuantity(base, getBaseUnitLabel(supply))} al inventario.${total > 0 ? ` Costo promedio de esta compra: ${cost(costPerBase)} por ${getBaseUnitLabel(supply)}.` : ''}`;
    } else {
      preview.textContent = '';
    }
  }
}

export function bind(root, ctx) {
  const form = root.querySelector('#purchase-form');
  if (!form) {
    root.querySelectorAll('[data-go]').forEach((button) => {
      button.addEventListener('click', () => ctx.navigate(button.dataset.go));
    });
    return;
  }

  form.elements.namedItem('supplyId').addEventListener('change', () => updatePurchaseForm(form, ctx));
  form.elements.namedItem('quantity').addEventListener('input', () => updatePurchaseForm(form, ctx));
  form.elements.namedItem('totalPaid').addEventListener('input', () => updatePurchaseForm(form, ctx));
  updatePurchaseForm(form, ctx);

  handleSubmit(form, async () => {
    const values = readForm(form);
    if (ctx.state.editingPurchaseId) {
      await ctx.store.updatePurchase(ctx.state.editingPurchaseId, values);
      ctx.state.editingPurchaseId = null;
      ctx.toast('Compra actualizada. Inventario recalculado.', 'success');
    } else {
      await ctx.store.addPurchase(values);
      ctx.toast('Compra registrada. Inventario actualizado.', 'success');
    }
    resetFormWithDate(form, ctx.today, ['supplyId']);
    updatePurchaseForm(form, ctx);
    ctx.refresh();
  });

  root.querySelectorAll('[data-edit-purchase]').forEach((button) => {
    button.addEventListener('click', () => {
      ctx.state.editingPurchaseId = button.dataset.editPurchase;
      ctx.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  root.querySelector('[data-cancel-purchase-edit]')?.addEventListener('click', () => {
    ctx.state.editingPurchaseId = null;
    ctx.refresh();
  });

  root.querySelectorAll('[data-delete-purchase]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (!confirmDelete('¿Borrar esta compra? El inventario estimado cambiará.')) return;
      try {
        await ctx.store.deleteRecord(button.dataset.deletePurchase);
        ctx.toast('Compra borrada.', 'success');
        ctx.refresh();
      } catch (error) {
        ctx.toast(error.message, 'danger');
      }
    });
  });
}
