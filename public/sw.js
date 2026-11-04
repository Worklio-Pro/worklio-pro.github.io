// Shows push notifications and opens the right page when one is tapped. It doesn't cache anything or handle page loads.
self.addEventListener('push', (e) => {
  let m = {}; try { m = e.data.json(); } catch (err) { /* no readable message: the generic title below */ }
  e.waitUntil(self.registration.showNotification(m.title || 'Worklio Pro', { body: m.body || '', icon: '/img/app/icon-192.png', tag: m.tag, data: { url: m.url || '/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data.url, self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
    const tab = tabs[0]; if (!tab) return self.clients.openWindow(url);
    return tab.focus().then((t) => (t.navigate ? t.navigate(url) : t));
  }));
});
