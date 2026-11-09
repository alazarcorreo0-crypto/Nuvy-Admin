import {
  getApp,
  getApps,
  initializeApp
} from '../../vendor/firebase/firebase-app.js';
import {
  collection,
  deleteDoc,
  doc,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  setLogLevel,
  writeBatch
} from '../../vendor/firebase/firebase-firestore.js';

setLogLevel('error');

const BATCH_LIMIT = 400;

function friendlyError(error) {
  const code = error?.code ?? '';
  if (code === 'permission-denied') {
    return 'Firebase rechazó la conexión. Revisa las reglas de Firestore en la consola de Firebase.';
  }
  if (code === 'unavailable') {
    return 'No se pudo conectar con la nube. La app seguirá guardando en este dispositivo.';
  }
  if (code === 'failed-precondition') {
    return 'Firebase necesita que abras la app en otra pestaña o que revises la configuración.';
  }
  return error?.message ?? 'No se pudo conectar con la nube.';
}

export class FirestoreAdapter {
  constructor({ firebaseConfig, familyCode }) {
    this.mode = 'cloud';
    this.firebaseConfig = firebaseConfig;
    this.familyCode = familyCode;
    this.app = null;
    this.db = null;
    this.recordsRef = null;
    this.unsubscribeSnapshot = null;
    this.onlineHandler = null;
    this.offlineHandler = null;
    this.listeners = new Set();
    this.lastSnapshotMetadata = null;
  }

  subscribe({ onData, onStatus }) {
    const listener = { onData, onStatus };
    this.listeners.add(listener);

    try {
      this.app = getApps().length ? getApp() : initializeApp(this.firebaseConfig);
      this.db = this.createFirestore(this.app);
      this.recordsRef = collection(
        this.db,
        'families',
        this.familyCode,
        'records'
      );
    } catch (error) {
      onStatus({
        mode: 'cloud',
        loading: false,
        online: navigator.onLine,
        error: friendlyError(error),
        fromCache: false,
        pending: false,
        lastSync: null
      });
      return () => this.listeners.delete(listener);
    }

    try {
      this.unsubscribeSnapshot = onSnapshot(
        this.recordsRef,
        { includeMetadataChanges: true },
        (snapshot) => {
          this.lastSnapshotMetadata = snapshot.metadata;
          const records = snapshot.docs.map((document) => ({
            ...document.data(),
            id: document.id
          }));

          for (const item of this.listeners) item.onData(records);

          const metadata = snapshot.metadata;
          this.emitStatus({
            mode: 'cloud',
            loading: false,
            online: navigator.onLine,
            error: null,
            fromCache: metadata.fromCache,
            pending: metadata.hasPendingWrites,
            lastSync:
              !metadata.fromCache && !metadata.hasPendingWrites
                ? new Date().toISOString()
                : undefined
          });
        },
        (error) => {
          this.emitStatus({
            mode: 'cloud',
            loading: false,
            online: navigator.onLine,
            error: friendlyError(error),
            fromCache: false,
            pending: false
          });
        }
      );
    } catch (error) {
      onStatus({
        mode: 'cloud',
        loading: false,
        online: navigator.onLine,
        error: friendlyError(error),
        fromCache: false,
        pending: false,
        lastSync: null
      });
      return () => this.listeners.delete(listener);
    }

    this.onlineHandler = () => this.emitStatus({ online: true });
    this.offlineHandler = () => this.emitStatus({ online: false });
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    return () => {
      this.unsubscribeSnapshot?.();
      this.unsubscribeSnapshot = null;
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
      this.listeners.delete(listener);
    };
  }

  createFirestore(app) {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      // Si la app ya inicializó Firestore (por ejemplo, al recargar en la
      // misma sesión), usamos la instancia existente.
      return getFirestore(app);
    }
  }

  async put(record) {
    if (!this.recordsRef) throw new Error('Firestore no está conectado.');
    await setDoc(doc(this.recordsRef, record.id), record, { merge: false });
    return record;
  }

  async remove(id) {
    if (!this.recordsRef) throw new Error('Firestore no está conectado.');
    await deleteDoc(doc(this.recordsRef, id));
  }

  async migrate(records) {
    if (!this.recordsRef || !Array.isArray(records) || records.length === 0) {
      return;
    }

    for (let start = 0; start < records.length; start += BATCH_LIMIT) {
      const chunk = records.slice(start, start + BATCH_LIMIT);
      const batch = writeBatch(this.db);
      for (const record of chunk) {
        if (!record?.id) continue;
        batch.set(doc(this.recordsRef, record.id), record, { merge: true });
      }
      await batch.commit();
    }
  }

  emitStatus(extra = {}) {
    for (const listener of this.listeners) {
      listener.onStatus({
        mode: 'cloud',
        loading: false,
        online: navigator.onLine,
        error: null,
        fromCache: this.lastSnapshotMetadata?.fromCache ?? false,
        pending: this.lastSnapshotMetadata?.hasPendingWrites ?? false,
        ...extra
      });
    }
  }
}
