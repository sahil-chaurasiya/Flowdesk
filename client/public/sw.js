// Flowdesk service worker
// Purpose: (1) satisfy PWA installability criteria, (2) light runtime caching
// for static assets so the app shell loads a bit faster on repeat visits.
// We intentionally avoid aggressive precaching of hashed build files since
// Vite renames them on every build — network-first keeps things always fresh.

const VERSION = 'flowdesk-v1';
const STATIC_CACHE = `${VERSION}-static`;

const STATIC_ASSET_DESTINATIONS = ['image', 'font', 'style'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('flowdesk-') && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API calls: always go to network, never cache.
  if (url.pathname.startsWith('/api/')) return;

  // Static assets (images/fonts/css/icons): cache-first for speed.
  if (STATIC_ASSET_DESTINATIONS.includes(request.destination)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Navigations (HTML): network-first so logged-in users always get fresh app,
  // falling back to cache if offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
  }
});
