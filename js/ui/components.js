import { icon } from './icons.js';
import { getTypeLabel } from '../core/units.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function pageHeader({ title, subtitle = '', eyebrow = '', actions = '' }) {
  return `
    <div class="page-heading">
      <div>
        ${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="page-subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}
    </div>
  `;
}

export function statCard({ label, value, detail = '', tone = 'default', iconName = '' }) {
  return `
    <article class="stat-card stat-${tone}">
      <div class="stat-top">
        <span class="stat-label">${escapeHtml(label)}</span>
        ${iconName ? `<span class="stat-icon">${icon(iconName)}</span>` : ''}
      </div>
      <strong class="stat-value">${value}</strong>
      ${detail ? `<span class="stat-detail">${detail}</span>` : ''}
    </article>
  `;
}

export function emptyState({ iconName = 'sparkles', title, text, action = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-icon">${icon(iconName)}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      ${action ? `<div class="empty-action">${action}</div>` : ''}
    </div>
  `;
}

export function badge(text, tone = 'neutral') {
  return `<span class="badge badge-${tone}">${escapeHtml(text)}</span>`;
}

export function supplyTypeBadge(type) {
  const tone = type === 'base' ? 'base' : type === 'liquid' ? 'liquid' : 'dry';
  return badge(getTypeLabel(type), tone);
}

export function statusInfo(status) {
  if (status?.loading) {
    return {
      tone: 'info',
      iconName: 'refresh',
      label: 'Conectando…',
      detail: 'Buscando datos'
    };
  }

  if (status?.error) {
    return {
      tone: 'danger',
      iconName: 'alert',
      label: 'Error de sincronización',
      detail: status.error
    };
  }

  if (status?.mode === 'local') {
    return {
      tone: 'neutral',
      iconName: 'cloudOff',
      label: 'Solo este dispositivo',
      detail: 'Modo local'
    };
  }

  if (!status?.online) {
    return {
      tone: 'warning',
      iconName: 'wifiOff',
      label: 'Sin conexión',
      detail: 'Se sincronizará al volver la red'
    };
  }

  if (status?.pending || status?.fromCache) {
    return {
      tone: 'warning',
      iconName: 'cloud',
      label: 'Guardado local',
      detail: 'Esperando a la nube'
    };
  }

  return {
    tone: 'success',
    iconName: 'check',
    label: 'Sincronizado',
    detail: 'Todo al día'
  };
}

export function syncPill(status) {
  const info = statusInfo(status);
  return `
    <span class="sync-pill sync-${info.tone}" title="${escapeHtml(info.detail)}">
      ${icon(info.iconName)}
      <span class="sync-label">${escapeHtml(info.label)}</span>
    </span>
  `;
}

export function notice({ tone = 'info', iconName = 'info', title = '', text, action = '' }) {
  return `
    <div class="notice notice-${tone}">
      <div class="notice-icon">${icon(iconName)}</div>
      <div class="notice-body">
        ${title ? `<strong>${escapeHtml(title)}</strong>` : ''}
        <p>${escapeHtml(text)}</p>
        ${action ? `<div class="notice-action">${action}</div>` : ''}
      </div>
    </div>
  `;
}

export function formError(message) {
  return `<p class="form-error" role="alert">${escapeHtml(message)}</p>`;
}
