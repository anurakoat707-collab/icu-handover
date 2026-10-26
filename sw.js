/* Offline cache: the app works without internet after the first visit.
   Bump VERSION whenever a file changes so phones pick up the new version. */
const VERSION = 'icu-handover-v11';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './style.css', './print.css',
  './config.js', './demo-data.js', './store.js', './cloud.js', './validate.js', './print.js', './editor.js', './app.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];

self.addEventListener('install', e => {
  /* cache: 'reload' = straight from GitHub, never an older copy from the browser cache */
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* network first (new version when online), cache when offline.
   no-cache = ask GitHub every time (GitHub Pages lets browsers keep files 10 min otherwise) */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin) || e.request.headers.has('authorization')) { return; }
  /* keep the original request (headers, mode); a navigation request cannot be copied with options -> use its url */
  const req = e.request.mode === 'navigate' ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(req)
      .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
