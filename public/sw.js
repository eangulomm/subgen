const SHELL_CACHE = 'subgen-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith('subgen-shell-') && name !== SHELL_CACHE).map((name) => caches.delete(name)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) void caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
  );
});
