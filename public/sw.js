const CACHE_NAME = 'sst-timetable-v1'
const STATIC_ASSETS = ['/', '/manifest.json', '/favicon.png', '/icon.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) return caches.delete(key)
          }),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((res) => res || caches.match('/'))),
  )
})

self.addEventListener('sync', (event) => {
  if (event.tag === 'sst-background-sync') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' })
        }
      }),
    )
  }
})

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'sst-periodic-sync') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'PERIODIC_SYNC_TRIGGER' })
        }
      }),
    )
  }
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
