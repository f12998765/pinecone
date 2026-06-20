const CACHE_VERSION = 'v5.2';
const STATIC_CACHE = `pinecone-static-${CACHE_VERSION}`;
const DATA_CACHE = `pinecone-data-${CACHE_VERSION}`;

async function cacheFirst(event) {
  const cached = await caches.match(event.request, { cacheName: STATIC_CACHE });
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
    const cached = await caches.match(event.request, { cacheName: DATA_CACHE });
    return cached || new Response('Unable to load services', { status: 503 });
  }
}

const bgUpdatePending = new Set();
function bgUpdate(request) {
  if (bgUpdatePending.has(request.url)) return;
  bgUpdatePending.add(request.url);
  fetch(request).then(async r => {
    if (r.ok) (await caches.open(STATIC_CACHE)).put(request, r.clone());
  }).catch(() => {}).finally(() => bgUpdatePending.delete(request.url));
}

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.race([
      caches.open(STATIC_CACHE).then(() => self.skipWaiting()),
      new Promise((_, reject) => setTimeout(() => reject(new Error('install timed out')), 10000))
    ]).catch(err => console.warn('install failed:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== DATA_CACHE).map(caches.delete.bind(caches))))
      .then(() => self.clients.claim()).catch(err => console.warn('activate cleanup failed:', err))
  );
});

self.addEventListener('message', event => {
  if (event.data?.action === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const { pathname, protocol } = new URL(event.request.url);
  // Only cache http/https requests
  if (protocol !== 'http:' && protocol !== 'https:') return;
  if (pathname === '/sw.js') return;
  if (pathname.startsWith('/api/')) return;
  if (pathname === '/local/services.json') return event.respondWith(networkFirst(event));
  if (pathname.startsWith('/local/icons/')) return event.respondWith(cacheFirst(event));
  // Static assets by file extension
  if (/\.(js|css|png|svg|ico|woff2?)$/.test(pathname)) return event.respondWith(cacheFirst(event));
  // Navigation requests
  if (event.request.mode === 'navigate') return event.respondWith(networkFirst(event));
  event.respondWith(
    fetch(event.request).catch(async () => (await caches.match(event.request, { cacheName: DATA_CACHE })) || new Response('', { status: 404 }))
  );
});
