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


// ─────────────────────────────────────────────────────────────────────────────
// Attendance module — web-push handlers (merged from the standalone Attendance
// app's service worker; a page can only have ONE service worker per scope, so
// they live here). Flowdesk's caching logic above is unchanged.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Attendance Update', body: 'You have a new notification' };
  try { data = event.data.json(); } catch (_) {}

  // 8-hour checkout reminders stay on screen until dismissed
  const is8HrReminder = data.tag === 'checkout-8hr-reminder';

  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || `attendance-${Date.now()}`,
    renotify: true,
    vibrate: is8HrReminder ? [300, 100, 300, 100, 300] : [200, 100, 200],
    requireInteraction: is8HrReminder,
    data: { url: data.url || '/admin/attendance' },
    actions: is8HrReminder
      ? [{ action: 'checkout', title: '✅ Check Out Now' }, { action: 'dismiss', title: 'Later' }]
      : [{ action: 'open', title: 'Open' }, { action: 'dismiss', title: 'Dismiss' }],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Attendance', options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
        for (const c of list) c.postMessage({ type: 'NOTIFICATION_RECEIVED' });
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.action === 'checkout'
    ? '/admin/attendance'
    : (event.notification.data?.url || '/admin/attendance');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((newSub) =>
        fetch('/api/attendance/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: newSub }),
        })
      )
  );
});
