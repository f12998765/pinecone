const CACHE_NAME = 'navigation-panel-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/services.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://code.jquery.com/jquery-3.6.0.min.js',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

