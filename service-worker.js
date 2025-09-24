// 缓存版本号
const STATIC_CACHE = 'pinecone-static-v1';
const DATA_CACHE = 'pinecone-data-v2';

// 预缓存的静态资源（含 services.json）
const STATIC_ASSETS = [
  '/', // 根页面
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/favicon-96x96.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  '/styles.css', // 如果有 CSS
  '/main.js',    // 如果有 JS
  '/services.json' // 预缓存 JSON
];

// 安装阶段：预缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 激活阶段：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== STATIC_CACHE && k !== DATA_CACHE)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 请求拦截
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 针对 services.json：双缓存 + SWR
  if (requestUrl.pathname.endsWith('/services.json')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(dataCache => {
        return dataCache.match(event.request).then(cachedResponse => {
          const fetchPromise = fetch(event.request).then(networkResponse => {
            dataCache.put(event.request, networkResponse.clone());
            return networkResponse;
          }).catch(() => {
            // 如果数据缓存没有，就回退到静态缓存
            return cachedResponse || caches.match(event.request);
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 动态缓存 icons 文件夹
  if (requestUrl.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          return caches.open(STATIC_CACHE).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先
  if (STATIC_ASSETS.includes(requestUrl.pathname) || requestUrl.origin === location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          return caches.open(STATIC_CACHE).then(cache => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // 其他请求：网络优先
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
