const CACHE_NAME = 'fintrack-pro-v6';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/fintrack-icon.svg', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'FinTrack Pro', body: event.data?.text() || 'Tienes una nueva alerta.' };
  }

  const title = payload.title || 'FinTrack Pro';
  const options = {
    body: payload.body || 'Tienes una nueva alerta.',
    icon: payload.icon || '/icons/fintrack-icon.svg',
    badge: payload.badge || '/icons/fintrack-icon.svg',
    tag: payload.tag || 'fintrack-alert',
    data: {
      url: payload.url || '/',
      type: payload.type || 'alert',
    },
    requireInteraction: !!payload.requireInteraction,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => client.url === targetUrl || client.url === self.location.origin + '/');
      if (existingClient) {
        existingClient.focus();
        return existingClient.navigate(targetUrl);
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/offline.html')))
  );
});
