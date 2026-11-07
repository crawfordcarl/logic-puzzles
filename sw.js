// Puzzle Puffin offline helper.
// Keeps a copy of the site on the device after the first visit, so it opens with no internet.
// The page itself is fetched fresh whenever there is a connection, so updates still arrive;
// fonts and pictures come straight from the saved copy.
// Change CACHE whenever the fonts, icons or this file change, so devices pick up the new copies.
const CACHE = 'puzzle-puffin-v1';
const FILES = [
  './',
  'index.html',
  'puffin.svg',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/Andika-Regular.woff',
  'fonts/Andika-Bold.woff',
  'fonts/Baloo2-600.woff',
  'fonts/Baloo2-800.woff',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('puzzle-puffin-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Give up on a slow connection after a few seconds and use the saved copy instead.
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms))]);

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // The page: try the internet first so updates arrive, fall back to the saved copy.
    event.respondWith(
      withTimeout(fetch(req), 4000)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./', copy)); }
          return res;
        })
        .catch(() => caches.match('./').then(r => r || caches.match('index.html')))
    );
    return;
  }

  // Fonts, icons and pictures: use the saved copy, fetching and saving anything new.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
