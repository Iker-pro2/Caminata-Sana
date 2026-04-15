const CACHE_NAME = 'caminata-sana-v1';
const assets = [
  './',
  './index.html',
  './style.css',
  './navbar.js'
];

// Instalar el Service Worker y guardar archivos básicos en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

// Responder desde el caché si no hay internet
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});