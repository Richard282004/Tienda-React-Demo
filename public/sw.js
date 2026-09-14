// Service worker mínimo: solo existe para recibir notificaciones push
// mientras la PWA no está abierta (requisito de la Push API) y abrir el
// panel al tocarlas. No cachea nada de la tienda.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'Nueva venta', body: '' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload no era JSON; se muestra con el texto por defecto */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/favicon.svg',
      badge: data.icon || '/favicon.svg',
      data: { url: data.url || '/admin' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(new URL(url, self.location.origin).pathname) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
