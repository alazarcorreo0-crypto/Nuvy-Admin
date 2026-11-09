import { APP_CONFIG } from '../config.js';
import { normalizeFamilyCode, validateFirebaseConfig } from '../core/validation.js';

const KEYS = {
  familyCode: 'nuvy.familyCode',
  firebaseConfig: 'nuvy.firebaseConfig',
  migration: 'nuvy.pendingMigration',
  forceLocal: 'nuvy.forceLocal'
};

function cloudFallbackKey(familyCode) {
  return `nuvy.cloudFallback.${normalizeFamilyCode(familyCode)}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // El almacenamiento puede estar bloqueado en algunos navegadores.
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nada que hacer.
  }
}

export function generateFamilyCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);
  return `NUVY-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}

export function readStoredFamilyCode() {
  const value = safeGet(KEYS.familyCode);
  if (!value) return null;
  try {
    return normalizeFamilyCode(value);
  } catch {
    return null;
  }
}

export function saveFamilyCode(code) {
  const normalized = normalizeFamilyCode(code);
  safeSet(KEYS.familyCode, normalized);
  return normalized;
}

export function readStoredFirebaseConfig() {
  const raw = safeGet(KEYS.firebaseConfig);
  if (!raw) return null;
  try {
    return validateFirebaseConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveFirebaseConfig(config) {
  const validated = validateFirebaseConfig(config);
  safeSet(KEYS.firebaseConfig, JSON.stringify(validated));
  return validated;
}

export function clearFirebaseConfig() {
  safeRemove(KEYS.firebaseConfig);
}

export function hasCodeFirebaseConfig() {
  return Boolean(APP_CONFIG.firebase);
}

/**
 * La configuración escrita en js/config.js tiene prioridad. Así, si el dueño
 * actualiza el archivo y vuelve a publicar, todos los dispositivos la usan.
 * La configuración guardada desde Ajustes sirve para probar o para cuando no
 * se quiere editar el código.
 */
export function getEffectiveFirebaseConfig() {
  if (APP_CONFIG.firebase) {
    try {
      return validateFirebaseConfig(APP_CONFIG.firebase);
    } catch {
      return null;
    }
  }
  return readStoredFirebaseConfig();
}

export function isForceLocal() {
  return safeGet(KEYS.forceLocal) === '1';
}

export function setForceLocal(value) {
  if (value) safeSet(KEYS.forceLocal, '1');
  else safeRemove(KEYS.forceLocal);
}

export function localDataKey(familyCode) {
  return `nuvy.data.${normalizeFamilyCode(familyCode)}`;
}

export function readLocalRecords(familyCode) {
  const raw = safeGet(localDataKey(familyCode));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((record) => record?.id) : [];
  } catch {
    return [];
  }
}

export function clearLocalRecords(familyCode) {
  safeRemove(localDataKey(familyCode));
}

export function savePendingMigration(familyCode, records) {
  safeSet(
    KEYS.migration,
    JSON.stringify({
      familyCode: normalizeFamilyCode(familyCode),
      records: Array.isArray(records) ? records : []
    })
  );
}

export function readPendingMigration(familyCode) {
  const raw = safeGet(KEYS.migration);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.familyCode !== normalizeFamilyCode(familyCode)) return null;
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return null;
  }
}

export function clearPendingMigration() {
  safeRemove(KEYS.migration);
}

/**
 * Marca que este teléfono tuvo que trabajar sin nube para una familia.
 * Al volver la conexión, los datos locales se suben antes de usar la nube.
 */
export function markCloudFallback(familyCode) {
  safeSet(cloudFallbackKey(familyCode), '1');
}

export function hasCloudFallback(familyCode) {
  return safeGet(cloudFallbackKey(familyCode)) === '1';
}

export function clearCloudFallback(familyCode) {
  safeRemove(cloudFallbackKey(familyCode));
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildSetupLink(familyCode) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('familia', normalizeFamilyCode(familyCode));

  if (!hasCodeFirebaseConfig()) {
    const config = readStoredFirebaseConfig();
    if (config) {
      const payload = toBase64Url(JSON.stringify({ v: 1, f: familyCode, c: config }));
      url.searchParams.set('nuvy', payload);
    }
  }

  return url.toString();
}

export function parseSetupFromUrl() {
  const url = new URL(window.location.href);
  let changed = false;
  let importedConfig = false;

  const payload = url.searchParams.get('nuvy');
  if (payload) {
    try {
      const data = JSON.parse(fromBase64Url(payload));
      if (data?.f) {
        saveFamilyCode(data.f);
        changed = true;
      }
      if (data?.c) {
        saveFirebaseConfig(data.c);
        importedConfig = true;
        changed = true;
      }
    } catch {
      // Un enlace dañado no debe impedir que la app abra.
    }
  }

  const family = url.searchParams.get('familia');
  if (family) {
    try {
      saveFamilyCode(family);
      changed = true;
    } catch {
      // Se ignora un código inválido.
    }
  }

  if (changed) {
    url.searchParams.delete('nuvy');
    url.searchParams.delete('familia');
    const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, '', cleanUrl);
  }

  return { changed, importedConfig };
}

/**
 * Acepta el objeto que muestra Firebase Console, con o sin "const firebaseConfig =".
 */
export function parseFirebaseConfigInput(text) {
  const source = String(text ?? '').trim();
  if (!source) {
    throw new Error('Pega la configuración de Firebase.');
  }

  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  let candidate = start >= 0 && end > start ? source.slice(start, end + 1) : source;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // Firebase Console muestra claves sin comillas y comillas simples.
    const jsonish = candidate
      .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1');
    parsed = JSON.parse(jsonish);
  }

  return validateFirebaseConfig(parsed);
}

export function getAppBaseUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}
