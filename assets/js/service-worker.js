const CACHE_VERSION = 'v4.5';
const STATIC_CACHE = `pinecone-static-${CACHE_VERSION}`;
const DATA_CACHE = `pinecone-data-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/assets/images/favicon.ico', '/assets/images/favicon.svg', '/assets/images/apple-touch-icon.png',
  '/assets/images/favicon-96x96.png', '/assets/images/web-app-manifest-192x192.png', '/assets/images/web-app-manifest-512x512.png',
  '/assets/js/app.js', '/assets/js/icon-fetcher.js', '/assets/js/linkding-fetcher.js', '/assets/js/db.js', '/assets/js/persist.js',
  '/assets/vendor/alpinejs.3.15.12.min.js', '/assets/vendor/alpinejs-focus.3.15.12.min.js',
];

async function cacheFirst(event) {
  const cached = await caches.match(event.request);
  if (cached) { bgUpdate(event.request); return cached; }
  try {
    const r = await fetch(event.request);
    if (r.ok) (await caches.open(STATIC_CACHE)).put(event.request, r.clone());
    return r;
  } catch { return new Response('', { status: 404 }); }
}

async function networkFirst(event) {
  try {
    const r = await fetch(event.request);
    if (r.ok) (await caches.open(DATA_CACHE)).put(event.request, r.clone());
    return r;
  } catch {
    const cached = await caches.match(event.request);
    return cached || new Response('Unable to load services', { status: 503 });
  }
}

function bgUpdate(request) {
  fetch(request).then(async r => {
    if (r.ok) (await caches.open(STATIC_CACHE)).put(request, r.clone());
  }).catch(() => {});
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== DATA_CACHE).map(caches.delete.bind(caches))))
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data?.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { pathname } = new URL(event.request.url);
  if (pathname.includes('/api/')) return;
  if (pathname.endsWith('/local/services.json')) return event.respondWith(networkFirst(event));
  if (pathname.startsWith('/local/icons/')) return event.respondWith(cacheFirst(event));
  if (STATIC_ASSETS.includes(pathname)) return event.respondWith(cacheFirst(event));
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(event.request)) || new Response('', { status: 404 }))
  );
});
