import { APP_CONFIG } from './config.js';
import { todayInTimeZone } from './core/dates.js';
import { normalizeFamilyCode } from './core/validation.js';
import { DataStore } from './services/store.js';
import { LocalAdapter } from './services/local-adapter.js';
import {
  clearCloudFallback,
  clearPendingMigration,
  generateFamilyCode,
  getEffectiveFirebaseConfig,
  hasCloudFallback,
  isForceLocal,
  markCloudFallback,
  parseSetupFromUrl,
  readLocalRecords,
  readPendingMigration,
  readStoredFamilyCode,
  saveFamilyCode,
  savePendingMigration
} from './services/settings-store.js';
import { escapeHtml, notice, syncPill } from './ui/components.js';
import { icon } from './ui/icons.js';
import * as inicio from './views/inicio.js';
import * as ventas from './views/ventas.js';
import * as gastos from './views/gastos.js';
import * as compras from './views/compras.js';
import * as inventario from './views/inventario.js';
import * as insumos from './views/insumos.js';
import * as corte from './views/corte.js';
import * as mensual from './views/mensual.js';
import * as ajustes from './views/ajustes.js';

const NAV_ITEMS = [
  {
    id: 'inicio',
    label: 'Inicio',
    icon: 'home',
    title: 'Inicio',
    subtitle: 'Resumen del negocio'
  },
  {
    id: 'ventas',
    label: 'Ventas',
    icon: 'cash',
    title: 'Ventas',
    subtitle: 'Dinero que entra'
  },
  {
    id: 'gastos',
    label: 'Gastos',
    icon: 'receipt',
    title: 'Gastos',
    subtitle: 'Dinero que sale'
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: 'cart',
    title: 'Compras',
    subtitle: 'Inventario que entra'
  },
  {
    id: 'inventario',
    label: 'Inventario',
    icon: 'clipboard',
    title: 'Inventario',
    subtitle: 'Conteo físico'
  },
  {
    id: 'insumos',
    label: 'Insumos',
    icon: 'box',
    title: 'Insumos',
    subtitle: 'Catálogo y precios'
  },
  {
    id: 'corte',
    label: 'Corte semanal',
    icon: 'chart',
    title: 'Corte semanal',
    subtitle: 'Ganancia real'
  },
  {
    id: 'mensual',
    label: 'Corte mensual',
    icon: 'calendar',
    title: 'Corte mensual',
    subtitle: 'Cómo va el mes'
  },
  {
    id: 'ajustes',
    label: 'Ajustes',
    icon: 'settings',
    title: 'Ajustes',
    subtitle: 'Familia y sincronización'
  }
];

const BOTTOM_ITEMS = ['inicio', 'ventas', 'compras', 'inventario', 'corte'];

const VIEW_MODULES = {
  inicio,
  ventas,
  gastos,
  compras,
  inventario,
  insumos,
  corte,
  mensual,
  ajustes
};

const state = {
  view: 'inicio',
  today: todayInTimeZone(APP_CONFIG.businessTimeZone),
  familyCode: null,
  store: null,
  snapshot: null,
  unsubscribeStore: null,
  installPrompt: null,
  editingSupplyId: null,
  editingPurchaseId: null,
  editingSaleId: null,
  editingExpenseId: null,
  corteDate: null,
  mensualMonth: null,
  backupRestore: null,
  viewFilters: {},
  pendingRender: false,
  cloudFallback: false,
  retryingCloud: false
};

let onboardingOpen = false;
let renderFrame = null;

const dom = {
  sideNav: null,
  bottomNav: null,
  viewRoot: null,
  headerTitle: null,
  familyChip: null,
  syncWrap: null,
  loadingScreen: null,
  loadingText: null,
  onboarding: null,
  toastContainer: null,
  menuButton: null,
  backdrop: null
};

function navItem(id) {
  return NAV_ITEMS.find((item) => item.id === id) ?? NAV_ITEMS[0];
}

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return VIEW_MODULES[raw] ? raw : 'inicio';
}

function makeContext() {
  return {
    store: state.store,
    snapshot: state.snapshot,
    today: state.today,
    state,
    navigate,
    refresh,
    toast,
    installApp
  };
}

function renderNav() {
  dom.sideNav.innerHTML = NAV_ITEMS.map(
    (item) => `
      <a class="nav-link" href="#${item.id}" data-view="${item.id}">
        ${icon(item.icon)}
        <span>${escapeHtml(item.label)}</span>
      </a>
    `
  ).join('');

  dom.bottomNav.innerHTML = BOTTOM_ITEMS.map((id) => {
    const item = navItem(id);
    return `
      <a class="bottom-link" href="#${item.id}" data-view="${item.id}">
        ${icon(item.icon)}
        <span>${escapeHtml(item.id === 'inventario' ? 'Conteo' : item.label)}</span>
      </a>
    `;
  }).join('');
}

function updateActiveNav() {
  document.querySelectorAll('[data-view]').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === state.view);
  });
}

function updateChrome() {
  const item = navItem(state.view);
  if (dom.headerTitle) {
    dom.headerTitle.innerHTML = `
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.subtitle)}</span>
    `;
  }

  if (dom.familyChip) {
    dom.familyChip.classList.toggle('hidden', !state.familyCode);
    dom.familyChip.innerHTML = `${icon('users')}<span class="family-code-text">${escapeHtml(state.familyCode ?? '')}</span>`;
  }

  if (dom.syncWrap) {
    const status = state.snapshot?.status ?? {
      loading: Boolean(state.familyCode),
      mode: state.familyCode ? 'cloud' : 'local'
    };
    dom.syncWrap.innerHTML = syncPill(status);
  }

  updateActiveNav();
}

function renderView() {
  if (onboardingOpen || !state.snapshot) return;

  if (renderFrame !== null) {
    cancelAnimationFrame(renderFrame);
    renderFrame = null;
  }

  state.today = todayInTimeZone(APP_CONFIG.businessTimeZone);
  state.pendingRender = false;

  const module = VIEW_MODULES[state.view] ?? VIEW_MODULES.inicio;
  const ctx = makeContext();

  try {
    dom.viewRoot.innerHTML = module.render(ctx);
    module.bind?.(dom.viewRoot, ctx);
  } catch (error) {
    console.error('No se pudo dibujar la pantalla.', error);
    dom.viewRoot.innerHTML = notice({
      tone: 'danger',
      iconName: 'alert',
      title: 'Algo salió mal al abrir esta pantalla',
      text: error?.message ?? 'Recarga la app e intenta de nuevo.'
    });
  }

  updateChrome();
}

function refresh() {
  if (renderFrame !== null) {
    cancelAnimationFrame(renderFrame);
    renderFrame = null;
  }
  renderView();
}

function scheduleRender() {
  if (renderFrame !== null) return;
  renderFrame = requestAnimationFrame(() => {
    renderFrame = null;
    if (isEditingField()) {
      state.pendingRender = true;
      return;
    }
    renderView();
  });
}

function isEditingField() {
  const active = document.activeElement;
  if (!active || !dom.viewRoot) return false;
  if (!dom.viewRoot.contains(active)) return false;
  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(active.tagName);
}

function onStoreUpdate(snapshot) {
  const previous = state.snapshot;
  const recordsChanged = !previous || previous.records !== snapshot.records;
  state.snapshot = snapshot;
  updateChrome();

  if (recordsChanged && !onboardingOpen) scheduleRender();
}

function navigate(view) {
  const target = VIEW_MODULES[view] ? view : 'inicio';
  state.editingSupplyId = null;
  state.editingPurchaseId = null;
  state.editingSaleId = null;
  state.editingExpenseId = null;
  closeDrawer();

  if (window.location.hash === `#${target}`) {
    state.view = target;
    refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  window.location.hash = target;
}

function handleRoute() {
  const next = parseHash();
  if (next !== state.view) {
    state.view = next;
    state.editingSupplyId = null;
    state.editingPurchaseId = null;
    state.editingSaleId = null;
    state.editingExpenseId = null;
  }
  closeDrawer();
  renderView();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openDrawer() {
  document.body.classList.add('drawer-open');
}

function closeDrawer() {
  document.body.classList.remove('drawer-open');
}

function showLoading(text = 'Preparando tus datos…') {
  if (!dom.loadingScreen) return;
  if (dom.loadingText) dom.loadingText.textContent = text;
  dom.loadingScreen.classList.remove('hidden');
}

function hideLoading() {
  dom.loadingScreen?.classList.add('hidden');
}

function toast(message, tone = 'default', options = {}) {
  if (!dom.toastContainer) return;
  const element = document.createElement('div');
  element.className = `toast toast-${tone}`;
  const iconName = tone === 'success' ? 'check' : tone === 'danger' || tone === 'warning' ? 'alert' : 'info';
  element.innerHTML = `${icon(iconName)}<span>${escapeHtml(message)}</span>`;

  // Un toast con botón (por ejemplo "Deshacer") dura más y se va solo
  // al terminar el tiempo o al hacer clic en el botón.
  let removeTimer = null;
  const remove = () => {
    window.clearTimeout(removeTimer);
    element.remove();
  };

  const action = options?.action;
  if (action?.label && typeof action?.onClick === 'function') {
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'toast-action';
    actionButton.textContent = String(action.label);
    actionButton.addEventListener('click', async () => {
      remove();
      try {
        await action.onClick();
      } catch (error) {
        toast(error?.message ?? 'No se pudo completar la acción.', 'danger');
      }
    });
    element.appendChild(actionButton);
  }

  dom.toastContainer.appendChild(element);
  removeTimer = window.setTimeout(remove, options?.duration ?? 4200);
}

async function installApp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    try {
      await state.installPrompt.userChoice;
    } catch {
      // El usuario puede cerrar el cuadro del navegador.
    }
    state.installPrompt = null;
    scheduleRender();
    return;
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(
    isIOS
      ? 'En Safari: toca Compartir y luego “Añadir a pantalla de inicio”.'
      : 'Abre el menú del navegador y elige “Instalar aplicación”.',
    'info'
  );
}

function cleanupStore() {
  state.unsubscribeStore?.();
  state.unsubscribeStore = null;
  state.store?.destroy();
  state.store = null;
}

function shouldFallbackToLocal(store) {
  if (store.records.length > 0) return false;
  if (store.status.error) return true;
  if (!navigator.onLine) return true;
  return false;
}

async function runPendingMigration(store, familyCode) {
  const pending = readPendingMigration(familyCode);
  if (!pending?.length) return;

  try {
    await store.migrate(pending);
    clearPendingMigration();
    toast('Los datos guardados en este teléfono se subieron a la nube.', 'success');
  } catch (error) {
    console.error('No se pudieron subir los datos locales.', error);
    toast('No se pudieron subir los datos locales. Se intentará al volver a abrir.', 'warning');
  }
}

async function createCloudStore(config, familyCode) {
  const { FirestoreAdapter } = await import('./services/firestore-adapter.js');
  return new DataStore({
    adapter: new FirestoreAdapter({ firebaseConfig: config, familyCode }),
    familyCode
  });
}

function showFatalError(error) {
  onboardingOpen = false;
  dom.onboarding.classList.add('hidden');
  hideLoading();
  state.snapshot = null;

  dom.viewRoot.innerHTML = notice({
    tone: 'danger',
    iconName: 'alert',
    title: 'No se pudieron cargar los datos',
    text: error?.message ?? 'Revisa la conexión y vuelve a intentarlo.',
    action: '<button class="button button-primary" type="button" data-retry-app>Reintentar</button>'
  });

  dom.viewRoot.querySelector('[data-retry-app]')?.addEventListener('click', () => {
    startApp();
  });

  updateChrome();
}

async function startApp() {
  const familyCode = state.familyCode || readStoredFamilyCode();
  if (!familyCode) {
    showOnboarding();
    return;
  }

  try {
    state.familyCode = familyCode;
    state.snapshot = null;
    state.cloudFallback = false;
    cleanupStore();
    showLoading('Preparando tus datos…');

    const config = getEffectiveFirebaseConfig();
    const useCloud = Boolean(config) && !isForceLocal();
    let cloudError = null;
    let store;

    if (useCloud) {
      try {
        store = await createCloudStore(config, familyCode);
        await store.init();
      } catch (error) {
        console.error('No se pudo cargar Firebase.', error);
        store?.destroy();
        store = null;
        cloudError = 'No se pudo cargar la conexión con la nube. La app usará los datos de este teléfono.';
      }

      if (!store || shouldFallbackToLocal(store)) {
        if (store) {
          cloudError = cloudError || store.status.error || (navigator.onLine
            ? 'No se pudo conectar con la nube. La app seguirá con los datos de este teléfono.'
            : 'Sin conexión a internet. La app usará los datos de este teléfono.');
          store.destroy();
        }
        state.cloudFallback = true;
        markCloudFallback(familyCode);
        store = new DataStore({
          adapter: new LocalAdapter(familyCode),
          familyCode
        });
        await store.init();
      }
    } else {
      store = new DataStore({
        adapter: new LocalAdapter(familyCode),
        familyCode
      });
      await store.init();
    }

    state.store = store;

    if (cloudError) {
      store.status = { ...store.status, error: cloudError };
      store.emit();
    }

    if (store.status.mode === 'cloud') {
      if (hasCloudFallback(familyCode)) {
        // Este teléfono trabajó sin nube. Subimos lo capturado antes de
        // seguir usando la nube para no perder esos registros.
        const localRecords = readLocalRecords(familyCode);
        if (localRecords.length > 0) {
          savePendingMigration(familyCode, localRecords);
        }
        clearCloudFallback(familyCode);
      }
      await runPendingMigration(store, familyCode);
    }

    state.unsubscribeStore = store.subscribe(onStoreUpdate);
    hideLoading();
    onboardingOpen = false;
    dom.onboarding.classList.add('hidden');
    state.today = todayInTimeZone(APP_CONFIG.businessTimeZone);
    renderView();
    updateChrome();
  } catch (error) {
    console.error('No se pudo iniciar la app.', error);
    showFatalError(error);
  }
}

function onboardingNote() {
  const config = getEffectiveFirebaseConfig();
  if (config) {
    return 'La nube ya está configurada. Al entrar con tu código, los datos se sincronizarán entre los teléfonos que usen el mismo código.';
  }
  return 'La nube todavía no está configurada. Puedes empezar en modo local y conectarla después desde Ajustes. Mientras tanto, los datos solo vivirán en este teléfono.';
}

function showOnboarding() {
  onboardingOpen = true;
  hideLoading();
  state.familyCode = null;
  updateChrome();

  dom.onboarding.classList.remove('hidden');
  dom.onboarding.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-brand">
        <span class="brand-mark">${icon('snowflake')}</span>
        <div>
          <h1>Nuvy Admin</h1>
          <p>Nieve por peso · inventario y corte semanal</p>
        </div>
      </div>

      <p class="onboarding-copy">
        Para empezar, <strong>crea un código de familia</strong> o entra con el código que ya usa tu familia.
        El mismo código abre los mismos datos en todos los teléfonos.
      </p>

      <div class="onboarding-actions">
        <button class="button button-primary button-block" type="button" data-create-family>
          ${icon('sparkles')} Crear un código nuevo
        </button>
        <button class="button button-block" type="button" data-show-join>
          ${icon('users')} Ya tengo un código
        </button>
      </div>

      <form class="onboarding-form hidden" id="onboarding-join-form" novalidate>
        <div class="field">
          <label for="onboarding-code">Código de familia</label>
          <input id="onboarding-code" name="familyCode" type="text" required
            maxlength="64" autocomplete="off" spellcheck="false"
            placeholder="Ej. NUVY-ABCD-2345">
          <span class="field-help">Escríbelo tal como te lo compartieron. No importan las minúsculas.</span>
        </div>
        <p class="form-error hidden" data-onboarding-error></p>
        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('arrowRight')} Entrar</button>
        </div>
      </form>

      <p class="onboarding-note">${escapeHtml(onboardingNote())}</p>
    </div>
  `;

  dom.onboarding.querySelector('[data-create-family]')?.addEventListener('click', () => {
    const code = generateFamilyCode();
    saveFamilyCode(code);
    state.familyCode = code;
    toast(`Código creado: ${code}`, 'success');
    startApp();
  });

  dom.onboarding.querySelector('[data-show-join]')?.addEventListener('click', () => {
    const form = dom.onboarding.querySelector('#onboarding-join-form');
    form?.classList.toggle('hidden');
    if (!form?.classList.contains('hidden')) {
      form.elements.namedItem('familyCode')?.focus();
    }
  });

  dom.onboarding.querySelector('#onboarding-join-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = form.querySelector('[data-onboarding-error]');
    try {
      const code = normalizeFamilyCode(form.elements.namedItem('familyCode').value);
      saveFamilyCode(code);
      state.familyCode = code;
      startApp();
    } catch (validationError) {
      if (error) {
        error.textContent = validationError?.message ?? 'Escribe un código válido.';
        error.classList.remove('hidden');
      }
    }
  });
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || window.location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('El modo sin conexión no se pudo activar.', error);
    });
  });
}

function setupChrome() {
  dom.sideNav = document.getElementById('side-nav');
  dom.bottomNav = document.getElementById('bottom-nav');
  dom.viewRoot = document.getElementById('view-root');
  dom.headerTitle = document.getElementById('header-title');
  dom.familyChip = document.getElementById('family-chip');
  dom.syncWrap = document.getElementById('sync-pill-wrap');
  dom.loadingScreen = document.getElementById('loading-screen');
  dom.loadingText = document.getElementById('loading-text');
  dom.onboarding = document.getElementById('onboarding');
  dom.toastContainer = document.getElementById('toast-container');
  dom.menuButton = document.getElementById('menu-button');
  dom.backdrop = document.getElementById('drawer-backdrop');

  document.getElementById('brand-mark').innerHTML = icon('snowflake');
  dom.menuButton.innerHTML = icon('menu');

  renderNav();

  dom.menuButton.addEventListener('click', () => {
    document.body.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
  });
  dom.backdrop.addEventListener('click', closeDrawer);

  dom.sideNav.addEventListener('click', (event) => {
    if (event.target.closest('[data-view]')) closeDrawer();
  });
  dom.bottomNav.addEventListener('click', () => closeDrawer());

  dom.viewRoot.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (state.pendingRender && !isEditingField()) refresh();
    }, 0);
  });

  window.addEventListener('hashchange', handleRoute);

  window.addEventListener('online', () => {
    state.store?.setNetworkStatus(true);
    if (state.cloudFallback && state.familyCode && !state.retryingCloud) {
      state.retryingCloud = true;
      startApp().finally(() => {
        state.retryingCloud = false;
      });
    }
  });

  window.addEventListener('offline', () => {
    state.store?.setNetworkStatus(false);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    scheduleRender();
  });

  window.addEventListener('appinstalled', () => {
    state.installPrompt = null;
    toast('Nuvy Admin quedó instalada en este teléfono.', 'success');
    scheduleRender();
  });

  window.setInterval(() => {
    const today = todayInTimeZone(APP_CONFIG.businessTimeZone);
    if (today !== state.today && !isEditingField()) {
      state.today = today;
      if (state.snapshot) refresh();
    }
  }, 60_000);
}

function boot() {
  setupChrome();
  registerServiceWorker();

  const setup = parseSetupFromUrl();
  if (setup.importedConfig) {
    const code = readStoredFamilyCode();
    if (code) {
      const localRecords = readLocalRecords(code);
      if (localRecords.length > 0) savePendingMigration(code, localRecords);
    }
    toast('Configuración de la nube importada.', 'success');
  }

  let familyCode = readStoredFamilyCode();
  if (!familyCode && APP_CONFIG.defaultFamilyCode) {
    try {
      familyCode = saveFamilyCode(APP_CONFIG.defaultFamilyCode);
    } catch (error) {
      console.warn('El código de familia de config.js no es válido.', error);
      familyCode = null;
    }
  }

  if (!familyCode) {
    state.view = parseHash();
    showOnboarding();
    return;
  }

  state.familyCode = familyCode;
  state.view = parseHash();
  if (!window.location.hash) {
    window.history.replaceState(null, '', '#inicio');
  }

  startApp();
}

document.addEventListener('DOMContentLoaded', boot);
