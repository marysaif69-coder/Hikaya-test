// Hikaya team app: shows phone notifications (new stops, team messages, new orders, shift
// reminders) and opens the right page when one is tapped. No offline caching.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Hikaya team', {
    body: d.body || '', tag: d.tag, icon: '/brand/app-192.png', badge: '/brand/app-192.png', data: { url: d.url || '/admin/driver/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/admin/driver/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url === url && 'focus' in w) return w.focus();
    return self.clients.openWindow(url);
  }));
});
