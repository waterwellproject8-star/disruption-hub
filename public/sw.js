// DisruptionHub Driver PWA — Service Worker
// Handles push notifications and basic offline caching

const CACHE_NAME = 'dh-driver-v3'
const OFFLINE_URLS = ['/driver', '/icon-192.png']

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  )
  self.skipWaiting()
})

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ── FETCH — serve from cache when offline ─────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

// ── PUSH NOTIFICATION ─────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return

  let payload
  try {
    payload = JSON.parse(event.data.text())
  } catch {
    payload = { title: 'DisruptionHub', body: event.data.text() }
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon-192.png',
    badge: payload.badge || '/badge-72.png',
    data: payload.data || {},
    actions: payload.actions || [
      { action: 'acknowledge', title: '✓ Got it' },
      { action: 'open', title: 'Open app' },
    ],
    requireInteraction: payload.requireInteraction || false,
    tag: payload.tag || 'dh-alert',
    renotify: true,
    vibrate: payload.urgent ? [200, 100, 200, 100, 200] : [200],
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'DisruptionHub', options)
  )
})

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'acknowledge') {
    // Auto-acknowledge via API if job_id is in data
    const jobId = event.notification.data?.job_id
    const clientId = event.notification.data?.client_id
    if (jobId && clientId) {
      fetch('/api/driver/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, client_id: clientId, response: 'acknowledged' })
      }).catch(() => {})
    }
    return
  }

  // Open the driver app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/driver') && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow('/driver')
    })
  )
})
