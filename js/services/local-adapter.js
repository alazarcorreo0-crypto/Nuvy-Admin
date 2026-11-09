import {
  localDataKey,
  readLocalRecords
} from './settings-store.js';

/**
 * Almacenamiento local por familia. Se usa cuando no hay nube configurada
 * o cuando el usuario decide seguir sin conexión.
 *
 * Los datos se guardan en localStorage y se sincronizan entre pestañas del
 * mismo navegador con BroadcastChannel (y con el evento storage como respaldo).
 */
export class LocalAdapter {
  constructor(familyCode) {
    this.mode = 'local';
    this.familyCode = familyCode;
    this.records = readLocalRecords(familyCode);
    this.listeners = new Set();
    this.channel = null;
    this.storageHandler = null;
    this.started = false;
  }

  subscribe({ onData, onStatus }) {
    const listener = { onData, onStatus };
    this.listeners.add(listener);
    this.started = true;

    onData(this.records.slice());
    onStatus({
      mode: 'local',
      loading: false,
      online: navigator.onLine,
      error: null,
      fromCache: false,
      pending: false,
      lastSync: null
    });

    this.startCrossTabSync();
    this.emitStatus();

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stopCrossTabSync();
    };
  }

  startCrossTabSync() {
    if (this.channel || typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel(`nuvy-local-${this.familyCode}`);
      this.channel.addEventListener('message', (event) => {
        if (event.data?.type === 'changed') this.reloadFromStorage();
      });
    } catch {
      this.channel = null;
    }

    this.storageHandler = (event) => {
      if (event.key === localDataKey(this.familyCode)) {
        this.reloadFromStorage();
      }
    };
    window.addEventListener('storage', this.storageHandler);
  }

  stopCrossTabSync() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
  }

  reloadFromStorage() {
    this.records = readLocalRecords(this.familyCode);
    this.emitData();
  }

  persist() {
    try {
      localStorage.setItem(
        localDataKey(this.familyCode),
        JSON.stringify(this.records)
      );
    } catch (error) {
      console.error('No se pudo guardar en este dispositivo.', error);
      this.emitStatus({
        error: 'No se pudo guardar en este dispositivo. Revisa el espacio libre del navegador.'
      });
      throw error;
    }
  }

  async put(record) {
    const index = this.records.findIndex((item) => item.id === record.id);
    if (index >= 0) this.records[index] = record;
    else this.records.push(record);
    this.persist();
    this.emitData();
    this.broadcast();
    return record;
  }

  async remove(id) {
    this.records = this.records.filter((record) => record.id !== id);
    this.persist();
    this.emitData();
    this.broadcast();
  }

  async migrate(records) {
    if (!Array.isArray(records) || records.length === 0) return;
    const byId = new Map(this.records.map((record) => [record.id, record]));
    for (const record of records) {
      if (record?.id) byId.set(record.id, record);
    }
    this.records = Array.from(byId.values());
    this.persist();
    this.emitData();
    this.broadcast();
  }

  broadcast() {
    try {
      this.channel?.postMessage({ type: 'changed' });
    } catch {
      // Si BroadcastChannel falla, el evento storage sigue funcionando.
    }
  }

  emitData() {
    const copy = this.records.slice();
    for (const listener of this.listeners) listener.onData(copy);
  }

  emitStatus(extra = {}) {
    for (const listener of this.listeners) {
      listener.onStatus({
        mode: 'local',
        loading: false,
        online: navigator.onLine,
        error: null,
        fromCache: false,
        pending: false,
        lastSync: null,
        ...extra
      });
    }
  }
}
