/* Offline cache: the app works without internet after the first visit.
   Bump VERSION whenever a file changes so phones pick up the new version. */
const VERSION = 'icu-handover-v4';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './style.css', './print.css',
  './config.js', './lock.js', './demo-data.js', './store.js', './validate.js', './print.js', './editor.js', './app.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* network first (new version when online), cache when offline */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) { return; }
  e.respondWith(
    fetch(e.request)
      .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
