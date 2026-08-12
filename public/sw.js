self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow('/')
    }),
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  try {
    const payload = event.data.json()
    const title = payload.title || 'SST Timetable Alert 🔔'
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/icon.png',
      badge: payload.badge || '/icon.png',
      vibrate: [200, 100, 200, 100, 200],
      tag: payload.tag || 'sst-notif',
      renotify: true,
      data: payload.data || {},
    }
    event.waitUntil(self.registration.showNotification(title, options))
  } catch {
    const text = event.data.text()
    event.waitUntil(
      self.registration.showNotification('SST Timetable Alert 🔔', {
        body: text,
        icon: '/icon.png',
        badge: '/icon.png',
        vibrate: [200, 100, 200],
        tag: 'sst-notif',
        renotify: true,
      }),
    )
  }
})
