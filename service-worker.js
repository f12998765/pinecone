// 缓存版本号
const STATIC_CACHE = 'pinecone-static-v2'; // bump 一下版本号
const DATA_CACHE = 'pinecone-data-v4';

// 预缓存的静态资源（不包含 services.json）
const STATIC_ASSETS = [
  '/', '/index.html',
  '/manifest.json',
  '/favicon.ico', '/favicon.svg',
  '/apple-touch-icon.png',
  '/favicon-96x96.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  '/styles.css',
  '/main.js'
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

  // 针对 services.json：版本驱动的缓存策略
  if (requestUrl.pathname.endsWith('/services.json')) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) {
          // 有缓存 → 直接返回，不请求网络
          return cached;
        }
        // 没缓存（说明版本号变了，旧缓存被清理）→ 请求网络
        return fetch(event.request).then(res => {
          cache.put(event.request, res.clone());
          return res;
        }).catch(() => null);
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
  if (STATIC_ASSETS.includes(requestUrl.pathname)) {
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

  // 其他请求：网络优先，失败回退缓存
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
