import { APP_CONFIG } from '../config.js';
import { daysBetweenDates, formatDateShort } from '../core/dates.js';
import { normalizeFamilyCode } from '../core/validation.js';
import {
  backupSummaryText,
  buildBackup,
  isSameFamily,
  parseBackup,
  serializeBackup,
  summarizeBackup
} from '../core/backup.js';
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
  readLastBackupDate,
  readLocalRecords,
  readStoredFirebaseConfig,
  saveFamilyCode,
  saveFirebaseConfig,
  saveLastBackupDate,
  savePendingMigration,
  setForceLocal
} from '../services/settings-store.js';
import {
  confirmDelete,
  copyToClipboard,
  downloadJson,
  handleSubmit,
  readForm
} from './shared.js';

function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return date.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function renderGoalCard(ctx) {
  const month = ctx.today.slice(0, 7);
  const goal = ctx.store.getGoalFor(month);

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Meta del mes</h2>
          <p>Cuánto quieres vender y hasta dónde dejar los gastos. El Inicio y el corte mensual muestran tu avance.</p>
        </div>
        <span class="stat-icon">${icon('calendar')}</span>
      </div>

      ${goal
        ? notice({
            tone: 'info',
            iconName: 'chart',
            title: `Meta de ${monthLabel(month)}`,
            text: `Vender ${goal.salesGoal > 0 ? '$' + goal.salesGoal : '—'}${goal.expenseCap > 0 ? ` y no pasar de $${goal.expenseCap} de gastos` : ''}.`
          })
        : ''}

      <form id="goal-form" novalidate>
        <div class="form-grid">
          <div class="field">
            <label for="goal-month">Mes de la meta</label>
            <input id="goal-month" name="month" type="month" required value="${goal?.month ?? month}">
          </div>
          <div class="field">
            <label for="goal-sales">¿Cuánto quieres vender?</label>
            <div class="input-suffix-wrap">
              <input id="goal-sales" name="salesGoal" type="number" inputmode="decimal"
                min="0" step="0.01" placeholder="Ej. 40000"
                value="${goal?.salesGoal ? String(goal.salesGoal) : ''}">
              <span class="input-suffix">MXN</span>
            </div>
            <span class="field-help">El total de ventas del mes que quieres lograr.</span>
          </div>
          <div class="field">
            <label for="goal-expenses">Tope de gastos</label>
            <div class="input-suffix-wrap">
              <input id="goal-expenses" name="expenseCap" type="number" inputmode="decimal"
                min="0" step="0.01" placeholder="Ej. 8000"
                value="${goal?.expenseCap ? String(goal.expenseCap) : ''}">
              <span class="input-suffix">MXN</span>
            </div>
            <span class="field-help">Sin contar compras de insumos ni tus retiros. Puedes dejar solo una de las dos.</span>
          </div>
        </div>
        <div class="form-actions">
          <button class="button button-primary" type="submit">${icon('check')} Guardar meta</button>
          ${goal
            ? '<button class="button button-small button-danger" type="button" data-delete-goal>Quitar meta</button>'
            : ''}
        </div>
      </form>
    </section>
  `;
}

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

function renderBackupCard(ctx) {
  const familyCode = ctx.snapshot.familyCode;
  const lastBackupRaw = readLastBackupDate(familyCode);
  const daysAgo = lastBackupRaw
    ? daysBetweenDates(lastBackupRaw.slice(0, 10), ctx.today)
    : null;
  const isStale = daysAgo !== null && daysAgo > 30;

  const lastBackupLine = daysAgo === null
    ? 'Todavía no has descargado un respaldo en este teléfono.'
    : daysAgo <= 0
      ? 'Último respaldo: hoy. 👌'
      : `Último respaldo: hace ${daysAgo} día${daysAgo === 1 ? '' : 's'} (${formatDateShort(lastBackupRaw.slice(0, 10))}).`;

  const staleNotice = isStale
    ? notice({
        tone: 'warning',
        iconName: 'alert',
        title: 'Ya pasaron más de 30 días sin respaldo',
        text: 'Si pierdes el teléfono o borras la familia, no habrá vuelta atrás. Descarga un respaldo nuevo y guárdalo en un lugar seguro.'
      })
    : '';

  const restore = ctx.state.backupRestore ?? null;
  let restorePreview = '';

  if (restore?.error) {
    restorePreview = notice({
      tone: 'danger',
      iconName: 'alert',
      title: 'El respaldo no se puede leer',
      text: restore.error
    });
  } else if (restore?.backup) {
    const summary = restore.summary;
    const mismatch = !isSameFamily(restore.backup, familyCode);
    restorePreview = `
      ${notice({
        tone: 'info',
        iconName: 'download',
        title: 'Revisa antes de restaurar',
        text: backupSummaryText(summary) + ' Restaurar no borra nada: si un registro ya existe, se actualiza; si no existe, se agrega.'
      })}
      ${mismatch
        ? `${notice({
            tone: 'warning',
            iconName: 'alert',
            title: `Este respaldo es de otra familia (${escapeHtml(restore.backup.familyCode)})`,
            text: `Tus datos actuales son de la familia ${escapeHtml(familyCode)}. Si restauras, los registros del respaldo se mezclarán con los tuyos. Solamente continúa si estás seguro de que es lo que quieres.`
          })}
          <div class="field field-check">
            <label for="backup-family-confirm">
              <input id="backup-family-confirm" type="checkbox" data-backup-family-confirm>
              <span>Sí, quiero restaurar registros de la familia ${escapeHtml(restore.backup.familyCode)} en mi familia actual.</span>
            </label>
          </div>`
        : ''}
      <div class="button-row" style="margin-top:12px">
        <button class="button button-primary" type="button" data-backup-restore ${mismatch ? 'disabled' : ''}>
          ${icon('check')} Restaurar ${summary.count} registro${summary.count === 1 ? '' : 's'}
        </button>
      </div>
    `;
  }

  return `
    <section class="card">
      <div class="card-header">
        <div>
          <h2>Respaldo de tus datos</h2>
          <p>Descarga un archivo con todo tu historial y guárdalo en un lugar seguro. Es tu red de seguridad.</p>
        </div>
        <span class="stat-icon">${icon('download')}</span>
      </div>

      <p class="field-help">${escapeHtml(lastBackupLine)}</p>
      ${staleNotice}

      <div class="button-row" style="margin-top:12px">
        <button class="button button-primary" type="button" data-backup-download>
          ${icon('download')} Descargar respaldo
        </button>
      </div>

      <details class="disclosure" style="margin-top:16px">
        <summary>Restaurar un respaldo (si perdiste datos)</summary>
        <div>
          <p class="field-help">
            Usa el archivo que descargaste antes. Primero la app te muestra qué contiene y tú confirmas.
            Restaurar <strong>nunca borra</strong> lo que ya tienes.
          </p>
          <form id="backup-restore-form" novalidate>
            <div class="field">
              <label for="backup-file">Archivo del respaldo (.json)</label>
              <input id="backup-file" type="file" accept=".json,application/json">
            </div>
            <div class="field">
              <label for="backup-text">…o pega aquí el texto del respaldo</label>
              <textarea id="backup-text" name="backupText" spellcheck="false"
                placeholder="Pega aquí el contenido del archivo si lo abriste como texto"></textarea>
            </div>
            <div class="form-actions">
              <button class="button" type="submit">${icon('clipboard')} Revisar respaldo</button>
            </div>
          </form>
          <div style="margin-top:12px" data-backup-preview>${restorePreview}</div>
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
      ${renderGoalCard(ctx)}
      ${renderBackupCard(ctx)}
      ${renderFirebaseCard(ctx)}
      ${renderInstallCard(ctx)}
      ${renderAboutCard()}
    </div>
  `;
}

export function bind(root, ctx) {
  const familyCode = ctx.snapshot.familyCode;

  root.querySelector('[data-backup-download]')?.addEventListener('click', async () => {
    try {
      const backup = buildBackup(familyCode, ctx.store.records);
      downloadJson(`nuvy-respaldo-${familyCode}-${ctx.today}.json`, backup);
      saveLastBackupDate(familyCode, backup.exportedAt);
      ctx.toast(
        `Respaldo descargado con ${backup.records.length} registro${backup.records.length === 1 ? '' : 's'}. Guárdalo en un lugar seguro.`,
        'success'
      );
      ctx.refresh();
    } catch (error) {
      ctx.toast(error?.message ?? 'No se pudo crear el respaldo.', 'danger');
    }
  });

  const restoreForm = root.querySelector('#backup-restore-form');
  if (restoreForm) {
    const fileInput = root.querySelector('#backup-file');

    const reviewText = (text) => {
      try {
        const backup = parseBackup(text);
        ctx.state.backupRestore = {
          backup,
          summary: summarizeBackup(backup),
          confirmed: false
        };
        ctx.refresh();
      } catch (error) {
        ctx.state.backupRestore = { error: error?.message ?? 'No se pudo leer el respaldo.' };
        ctx.refresh();
      }
    };

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => reviewText(String(reader.result ?? ''));
        reader.onerror = () => {
          ctx.state.backupRestore = { error: 'No se pudo leer el archivo. Intenta pegar su contenido como texto.' };
          ctx.refresh();
        };
        reader.readAsText(file);
      });
    }

    restoreForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = restoreForm.elements.namedItem('backupText')?.value ?? '';
      if (!text.trim()) {
        ctx.state.backupRestore = { error: 'Elige el archivo del respaldo o pega su texto primero.' };
        ctx.refresh();
        return;
      }
      reviewText(text);
    });

    const confirmCheckbox = root.querySelector('[data-backup-family-confirm]');
    confirmCheckbox?.addEventListener('change', () => {
      const restoreButton = root.querySelector('[data-backup-restore]');
      if (restoreButton) restoreButton.disabled = !confirmCheckbox.checked;
    });

    root.querySelector('[data-backup-restore]')?.addEventListener('click', async () => {
      const restore = ctx.state.backupRestore;
      if (!restore?.backup) return;
      const count = restore.backup.records.length;
      if (!confirmDelete(
        `¿Restaurar ${count} registro${count === 1 ? '' : 's'}? Nada se borra: los registros que ya existen se actualizan y los nuevos se agregan.`
      )) {
        return;
      }
      try {
        await ctx.store.migrate(restore.backup.records);
        ctx.state.backupRestore = null;
        ctx.toast(
          count === 0
            ? 'El respaldo estaba vacío; no había nada que restaurar.'
            : `Listo: ${count} registro${count === 1 ? '' : 's'} restaurado${count === 1 ? '' : 's'}.`,
          'success'
        );
        ctx.refresh();
      } catch (error) {
        ctx.toast(error?.message ?? 'No se pudo restaurar el respaldo.', 'danger');
      }
    });
  }

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

  const goalForm = root.querySelector('#goal-form');
  if (goalForm) {
    handleSubmit(goalForm, async () => {
      const values = readForm(goalForm);
      await ctx.store.setGoal({
        month: values.month,
        // Los campos vacíos cuentan como cero: con eso la validación exige
        // que al menos uno de los dos tenga número.
        salesGoal: values.salesGoal === '' ? 0 : values.salesGoal,
        expenseCap: values.expenseCap === '' ? 0 : values.expenseCap
      });
      ctx.toast('Meta guardada.', 'success');
      ctx.refresh();
    });

    root.querySelector('[data-delete-goal]')?.addEventListener('click', async () => {
      const goal = ctx.store.getGoalFor(ctx.today.slice(0, 7));
      if (!goal) return;
      if (!confirmDelete('¿Quitar la meta de este mes? Los datos de ventas y gastos no se tocan.')) return;
      try {
        await ctx.store.deleteRecord(goal.id);
        ctx.toast('Meta quitada.', 'success');
        ctx.refresh();
      } catch (error) {
        ctx.toast(error?.message ?? 'No se pudo quitar la meta.', 'danger');
      }
    });
  }

  const joinForm = root.querySelector('#join-family-form');  if (joinForm) {
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
