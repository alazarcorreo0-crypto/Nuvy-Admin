import { escapeHtml } from '../ui/components.js';
import { sum } from '../core/format.js';

export { escapeHtml };

export function groupByDate(records, dateKey = 'date') {
  const groups = new Map();
  for (const record of records) {
    const date = record[dateKey] || 'Sin fecha';
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(record);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => String(b).localeCompare(String(a)))
    .map(([date, items]) => ({
      date,
      items,
      total: sum(items.map((item) => item.amount ?? item.totalPaid ?? 0))
    }));
}

export function setFormError(form, message = '') {
  let error = form.querySelector('[data-form-error]');
  if (!error) {
    error = document.createElement('p');
    error.className = 'form-error';
    error.dataset.formError = '';
    error.setAttribute('role', 'alert');
    form.prepend(error);
  }
  error.textContent = message;
  error.classList.toggle('hidden', !message);
}

export function clearFormError(form) {
  setFormError(form, '');
}

export function setFormBusy(form, busy) {
  const button = form.querySelector('[type="submit"]');
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px"></span> Guardando…';
  } else if (button.dataset.originalText) {
    button.innerHTML = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

export async function handleSubmit(form, handler) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearFormError(form);
    if (!form.reportValidity()) return;
    setFormBusy(form, true);
    try {
      await handler();
    } catch (error) {
      setFormError(form, error?.message ?? 'No se pudo guardar.');
    } finally {
      setFormBusy(form, false);
    }
  });
}

export function readForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function resetFormWithDate(form, date, keep = []) {
  const values = Object.fromEntries(
    keep.map((name) => [name, form.elements.namedItem(name)?.value])
  );
  form.reset();
  if (form.elements.namedItem('date')) {
    form.elements.namedItem('date').value = date;
  }
  for (const [name, value] of Object.entries(values)) {
    const field = form.elements.namedItem(name);
    if (field && value !== undefined) field.value = value;
  }
}

export function confirmDelete(message = '¿Borrar este registro? Esta acción no se puede deshacer.') {
  return window.confirm(message);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function todayFor(ctx) {
  return ctx.today;
}

export function formValue(form, name) {
  return form.elements.namedItem(name)?.value ?? '';
}

export function setPreview(element, text) {
  if (element) element.textContent = text;
}
