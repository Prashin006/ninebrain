// Offline shell: hashed assets cache-first, pages network-first, API never cached.
const CACHE = 'ninebrain-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './favicon.svg', './manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  if (url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone()
      caches.open(CACHE).then((c) => c.put(e.request, copy))
      return r
    })))
    return
  }
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone()
    caches.open(CACHE).then((c) => c.put(e.request, copy))
    return r
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html'))))
})
