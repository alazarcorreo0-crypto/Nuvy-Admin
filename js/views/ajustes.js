import { APP_CONFIG } from '../config.js';
import { formatDateShort } from '../core/dates.js';
import { normalizeFamilyCode } from '../core/validation.js';
import {
  escapeHtml,
  notice,
  pageHeader,
  statusInfo,
  syncPill
} from '../ui/components.js';
import { icon } from '../ui/icons.js';
import {
  buildSetupLink,
  clearFirebaseConfig,
  getEffectiveFirebaseConfig,
  hasCodeFirebaseConfig,
  isForceLocal,
  parseFirebaseConfigInput,
  readLocalRecords,
  readStoredFirebaseConfig,
  saveFamilyCode,
  saveFirebaseConfig,
  savePendingMigration,
  setForceLocal
} from '../services/settings-store.js';
import {
  confirmDelete,
  copyToClipboard,
  handleSubmit
} from './shared.js';

function renderFamilyCard(ctx) {
  const familyCode = ctx.snapshot.familyCode;
  const setupLink = buildSetupLink(familyCode);
  const whatsappText = `Usa Nuvy Admin con la familia ${familyCode}. Abre este enlace en tu teléfono: ${setupLink}`;
  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Compartir con la familia</h2>
          <p>El mismo código y el mismo enlace abren los mismos datos en todos los teléfonos.</p>
        </div>
        <span class="stat-icon">${icon('users')}</span>
      </div>

      <div class="code-box">
        <span class="code-value" data-family-code>${escapeHtml(familyCode)}</span>
        <button class="button button-small button-soft" type="button" data-copy-code>${icon('clipboard')} Copiar código</button>
      </div>

      <div class="field" style="margin-top:14px">
        <label for="setup-link">Enlace para otros teléfonos</label>
        <input id="setup-link" type="text" readonly value="${escapeHtml(setupLink)}">
        <span class="field-help">Mándalo por WhatsApp. Al abrirlo, el teléfono queda configurado con el mismo código de familia.</span>
      </div>

      <div class="button-row" style="margin-top:12px">
        <button class="button button-small button-primary" type="button" data-copy-link>${icon('share')} Copiar enlace</button>
        <a class="button button-small" href="${escapeHtml(whatsappLink)}" target="_blank" rel="noopener">${icon('share')} Enviar por WhatsApp</a>
      </div>

      <details class="disclosure" style="margin-top:16px">
        <summary>Usar otro código de familia</summary>
        <div>
          <p class="field-help">Si escribes otro código, la app abrirá los datos de esa familia. No se borra nada de la familia actual.</p>
          <form id="join-family-form" novalidate>
            <div class="field">
              <label for="join-family-code">Código de familia</label>
              <input id="join-family-code" name="familyCode" type="text" required
                maxlength="64" autocomplete="off" spellcheck="false"
                placeholder="Ej. NUVY-ABCD-2345">
            </div>
            <div class="form-actions">
              <button class="button button-small button-primary" type="submit">${icon('users')} Entrar con ese código</button>
            </div>
          </form>
        </div>
      </details>
    </section>
  `;
}

function renderStatusCard(ctx) {
  const status = ctx.snapshot.status;
  const config = getEffectiveFirebaseConfig();
  const info = statusInfo(status);
  const forcedLocal = isForceLocal();

  const fallbackNotice = config && status.mode === 'local' && !forcedLocal
    ? notice({
        tone: 'warning',
        iconName: 'cloudOff',
        title: 'La nube no está disponible',
        text: status.error || 'La app está usando los datos guardados en este dispositivo. Cuando vuelva la conexión, puedes reintentar.'
      })
    : '';

  const localNotice = !config
    ? notice({
        tone: 'info',
        iconName: 'info',
        title: 'Estás en modo local',
        text: 'Los datos se guardan solamente en este teléfono. Para compartirlos con otro teléfono, configura Firebase más abajo.'
      })
    : '';

  const forcedNotice = config && forcedLocal
    ? notice({
        tone: 'info',
        iconName: 'cloudOff',
        title: 'Elegiste seguir sin nube',
        text: 'Los datos nuevos se guardan solo en este teléfono. Cuando quieras, vuelve a conectar la nube para sincronizarlos.'
      })
    : '';

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Sincronización</h2>
          <p>Así se están guardando los datos ahora mismo.</p>
        </div>
        ${syncPill(status)}
      </div>

      ${fallbackNotice}
      ${localNotice}
      ${forcedNotice}

      <div class="detail-list">
        <div class="detail-row">
          <dt>Modo</dt>
          <dd>${status.mode === 'cloud' ? 'Nube compartida' : 'Solo este dispositivo'}</dd>
        </div>
        <div class="detail-row">
          <dt>Estado</dt>
          <dd>${escapeHtml(info.label)}</dd>
        </div>
        <div class="detail-row">
          <dt>Internet</dt>
          <dd>${status.online ? 'Conectado' : 'Sin conexión'}</dd>
        </div>
        <div class="detail-row">
          <dt>Última sincronización</dt>
          <dd>${status.lastSync ? formatDateShort(status.lastSync.slice(0, 10)) : '—'}</dd>
        </div>
        ${status.pending ? `
          <div class="detail-row">
            <dt>Cambios pendientes</dt>
            <dd>Se subirán al volver la conexión</dd>
          </div>
        ` : ''}
      </div>

      <div class="button-row" style="margin-top:16px">
        <button class="button button-small" type="button" data-retry-connection>${icon('refresh')} Reintentar conexión</button>
        ${status.mode === 'cloud'
          ? '<button class="button button-small button-danger" type="button" data-use-local>Seguir sin nube</button>'
          : ''}
        ${forcedLocal
          ? '<button class="button button-small button-primary" type="button" data-use-cloud>Volver a conectar la nube</button>'
          : ''}
      </div>
    </section>
  `;
}

function renderFirebaseCard(ctx) {
  const codeConfig = hasCodeFirebaseConfig();
  const storedConfig = readStoredFirebaseConfig();
  const currentConfig = getEffectiveFirebaseConfig();
  const configText = storedConfig ? JSON.stringify(storedConfig, null, 2) : '';

  if (codeConfig) {
    return `
      <section class="card">
        <div class="card-header">
          <div>
            <h2>Firebase</h2>
            <p>La configuración viene incluida en el archivo del proyecto.</p>
          </div>
          <span class="stat-icon">${icon('cloud')}</span>
        </div>

        <div class="detail-list">
          <div class="detail-row">
            <dt>Proyecto</dt>
            <dd>${escapeHtml(currentConfig?.projectId ?? '—')}</dd>
          </div>
          <div class="detail-row">
            <dt>Origen</dt>
            <dd>js/config.js</dd>
          </div>
        </div>

        <p class="field-help" style="margin-top:14px">
          Para cambiar la configuración, edita <strong>js/config.js</strong> y vuelve a publicar la app.
          El README explica cómo hacerlo.
        </p>
      </section>
    `;
  }

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Firebase</h2>
          <p>Pega aquí la configuración de tu proyecto para activar la nube.</p>
        </div>
        <span class="stat-icon">${icon('cloud')}</span>
      </div>

      ${currentConfig
        ? notice({
            tone: 'success',
            iconName: 'check',
            title: 'Nube configurada',
            text: `Proyecto: ${currentConfig.projectId}. Si cambias la configuración, la app se recargará y volverá a conectar.`
          })
        : notice({
            tone: 'info',
            iconName: 'info',
            title: 'Todavía no hay nube',
            text: 'Sin Firebase, la app funciona completa en este teléfono, pero no se sincroniza con otros teléfonos.'
          })}

      <form id="firebase-form" novalidate>
        <div class="field">
          <label for="firebase-config">Configuración de Firebase</label>
          <textarea id="firebase-config" name="firebaseConfig" spellcheck="false"
            placeholder='Pega aquí el objeto que copia Firebase, por ejemplo:&#10;{&#10;  "apiKey": "AIza...",&#10;  "authDomain": "mi-nuvy.firebaseapp.com",&#10;  "projectId": "mi-nuvy",&#10;  "storageBucket": "mi-nuvy.appspot.com",&#10;  "messagingSenderId": "1234567890",&#10;  "appId": "1:1234567890:web:abcdef"&#10;}'>${escapeHtml(configText)}</textarea>
          <span class="field-help">Puedes pegar el texto tal como lo muestra Firebase, con o sin “const firebaseConfig =”.</span>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('check')} Guardar y conectar</button>
          ${storedConfig
            ? '<button class="button button-small button-danger" type="button" data-remove-config>Quitar configuración</button>'
            : ''}
        </div>
      </form>

      <details class="disclosure" style="margin-top:16px">
        <summary>¿Qué más hay que hacer en Firebase?</summary>
        <div>
          <ol class="steps">
            <li>Crear el proyecto y activar Firestore Database.</li>
            <li>Registrar una app web y copiar la configuración.</li>
            <li>Publicar las reglas de <strong>firestore.rules</strong> en la consola de Firebase.</li>
          </ol>
          <p class="field-help">El archivo README.md tiene los pasos completos, con capturas descritas y sin tecnicismos.</p>
        </div>
      </details>
    </section>
  `;
}

function renderInstallCard(ctx) {
  const canInstall = Boolean(ctx.state.installPrompt);
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Instalar en el teléfono</h2>
          <p>Se abre como una app, sin barra de direcciones.</p>
        </div>
        <span class="stat-icon">${icon('install')}</span>
      </div>

      ${canInstall
        ? `<button class="button button-primary button-block" type="button" data-install>${icon('install')} Instalar Nuvy Admin</button>`
        : `
          <div class="detail-list">
            <div class="detail-row">
              <dt>Android (Chrome)</dt>
              <dd>Menú ⋮ → “Instalar aplicación”</dd>
            </div>
            <div class="detail-row">
              <dt>iPhone (Safari)</dt>
              <dd>Compartir → “Añadir a pantalla de inicio”</dd>
            </div>
          </div>
        `}

      <p class="field-help" style="margin-top:14px">
        Después de instalarla, ábrela desde el ícono. Funciona sin internet y sincroniza cuando vuelve la conexión.
      </p>
    </section>
  `;
}

function renderAboutCard() {
  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Acerca de Nuvy Admin</h2>
          <p>Control de nieve por peso, sin cuentas ni contraseñas.</p>
        </div>
        <span class="stat-icon">${icon('snowflake')}</span>
      </div>

      <div class="detail-list">
        <div class="detail-row">
          <dt>Versión</dt>
          <dd>${escapeHtml(APP_CONFIG.appVersion)}</dd>
        </div>
        <div class="detail-row">
          <dt>Zona horaria del negocio</dt>
          <dd>${escapeHtml(APP_CONFIG.businessTimeZone)}</dd>
        </div>
        <div class="detail-row">
          <dt>Semana de corte</dt>
          <dd>Sábado a viernes</dd>
        </div>
        <div class="detail-row">
          <dt>Datos</dt>
          <dd>Se guardan en este teléfono y, si hay Firebase, también en la nube.</dd>
        </div>
      </div>

      <p class="field-help" style="margin-top:14px">
        El código de familia es un espacio compartido, no una contraseña. Cualquier persona que tenga el enlace puede ver y editar los datos de esa familia. Compártelo solo con personas de confianza.
      </p>
    </section>
  `;
}

export function render(ctx) {
  return `
    ${pageHeader({
      eyebrow: 'Configuración',
      title: 'Ajustes',
      subtitle: 'Comparte el código con tu familia, revisa la sincronización y conecta la nube.'
    })}

    <div class="settings-grid">
      ${renderFamilyCard(ctx)}
      ${renderStatusCard(ctx)}
      ${renderFirebaseCard(ctx)}
      ${renderInstallCard(ctx)}
      ${renderAboutCard()}
    </div>
  `;
}

export function bind(root, ctx) {
  const familyCode = ctx.snapshot.familyCode;

  root.querySelector('[data-copy-code]')?.addEventListener('click', async () => {
    const ok = await copyToClipboard(familyCode);
    ctx.toast(ok ? 'Código copiado.' : 'No se pudo copiar el código.', ok ? 'success' : 'danger');
  });

  root.querySelector('[data-copy-link]')?.addEventListener('click', async () => {
    const link = root.querySelector('#setup-link')?.value ?? buildSetupLink(familyCode);
    const ok = await copyToClipboard(link);
    ctx.toast(ok ? 'Enlace copiado.' : 'No se pudo copiar el enlace.', ok ? 'success' : 'danger');
  });

  root.querySelector('[data-install]')?.addEventListener('click', () => ctx.installApp());

  root.querySelector('[data-retry-connection]')?.addEventListener('click', () => {
    ctx.toast('Reintentando la conexión…', 'info');
    window.setTimeout(() => window.location.reload(), 400);
  });

  root.querySelector('[data-use-local]')?.addEventListener('click', () => {
    if (!confirmDelete('¿Seguir sin nube en este teléfono? Los datos nuevos se guardarán solo aquí hasta que vuelvas a conectar.')) return;
    setForceLocal(true);
    window.location.reload();
  });

  root.querySelector('[data-use-cloud]')?.addEventListener('click', () => {
    setForceLocal(false);
    window.location.reload();
  });

  root.querySelector('[data-remove-config]')?.addEventListener('click', () => {
    if (!confirmDelete('¿Quitar la configuración de Firebase de este teléfono? La app seguirá funcionando en modo local.')) return;
    clearFirebaseConfig();
    setForceLocal(false);
    window.location.reload();
  });

  const joinForm = root.querySelector('#join-family-form');
  if (joinForm) {
    handleSubmit(joinForm, async () => {
      const raw = joinForm.elements.namedItem('familyCode').value;
      const normalized = normalizeFamilyCode(raw);
      if (normalized === familyCode) {
        ctx.toast('Ya estás usando ese código.', 'info');
        return;
      }
      const localRecords = readLocalRecords(normalized);
      const message = localRecords.length
        ? 'Ese código ya tiene datos guardados en este teléfono. ¿Entrar y verlos?'
        : '¿Cambiar a ese código de familia? Los datos de la familia actual no se borran.';
      if (!confirmDelete(message)) return;
      saveFamilyCode(normalized);
      ctx.toast('Código guardado. Abriendo la familia…', 'success');
      window.setTimeout(() => window.location.reload(), 500);
    });
  }

  const firebaseForm = root.querySelector('#firebase-form');
  if (firebaseForm) {
    handleSubmit(firebaseForm, async () => {
      const text = firebaseForm.elements.namedItem('firebaseConfig').value;
      const config = parseFirebaseConfigInput(text);
      saveFirebaseConfig(config);

      const localRecords = readLocalRecords(familyCode);
      if (localRecords.length > 0) {
        savePendingMigration(familyCode, localRecords);
      }

      setForceLocal(false);
      ctx.toast('Configuración guardada. Reconectando…', 'success');
      window.setTimeout(() => window.location.reload(), 700);
    });
  }

}
