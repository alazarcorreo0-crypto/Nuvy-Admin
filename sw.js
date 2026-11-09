/*
 * Service worker de Nuvy Admin.
 *
 * Estrategia:
 * - La página principal usa red primero y, si no hay internet, la copia guardada.
 * - Los archivos de la app usan caché primero y se actualizan solos cuando hay red.
 * - Las llamadas a Firestore NO se cachean: Firestore ya maneja su propia cola
 *   offline y se sincroniza al volver la conexión.
 *
 * Cuando publiques cambios importantes, sube el número de VERSION.
 */

const VERSION = 'nuvy-admin-v1.0.4';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/config.js',
  './js/core/dates.js',
  './js/core/format.js',
  './js/core/units.js',
  './js/core/validation.js',
  './js/core/inventory.js',
  './js/core/weekly-cut.js',
  './js/services/settings-store.js',
  './js/services/local-adapter.js',
  './js/services/firestore-adapter.js',
  './js/services/store.js',
  './js/ui/icons.js',
  './js/ui/components.js',
  './js/views/shared.js',
  './js/views/inicio.js',
  './js/views/insumos.js',
  './js/views/compras.js',
  './js/views/ventas.js',
  './js/views/gastos.js',
  './js/views/inventario.js',
  './js/views/corte.js',
  './js/views/ajustes.js',
  './vendor/firebase/firebase-app.js',
  './vendor/firebase/firebase-firestore.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // El propio service worker no debe quedar atrapado en una copia vieja.
  if (url.pathname.endsWith('/sw.js')) return;

  // La configuración de Firebase se pide a la red primero para que un cambio
  // en js/config.js se vea al recargar, sin esperar a la siguiente visita.
  if (url.pathname.endsWith('/js/config.js')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
            return response;
          }
          return caches.match(request).then((cached) => cached || response);
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => {
              cache.put('./index.html', copy.clone());
              cache.put('./', copy);
            });
            return response;
          }
          return caches
            .match('./index.html')
            .then((cached) => cached || caches.match('./'))
            .then((cached) => cached || response);
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((cached) => cached || caches.match('./'))
            .then((cached) => cached || fetch('./index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
