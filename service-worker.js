// 缓存版本号 - 更新内容时请修改此版本号
const CACHE_VERSION = 'v4.1';
const STATIC_CACHE = `pinecone-static-${CACHE_VERSION}`;
const DATA_CACHE = `pinecone-data-${CACHE_VERSION}`;

// 预缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/favicon-96x96.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png',
  '/styles.css',
  '/app.js',
  '/icon-fetcher.js',
  '/linkding-fetcher.js'
];

// 安装阶段：预缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 激活阶段：清理旧缓存并通知所有客户端
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

// 监听来自客户端的消息
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// 后台更新缓存的辅助函数
function backgroundUpdateCache(cache, request) {
  fetch(request).then(async response => {
    if (response.ok) {
      const cacheToUse = cache || await caches.open(STATIC_CACHE);
      cacheToUse.put(request, response.clone());
    }
  }).catch(() => {
    // Silently fail - background update is best-effort
  });
}

// 请求拦截
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Linkding API 请求不经过 Service Worker
  if (requestUrl.pathname.includes('/api/')) {
    return;
  }

  // 针对 services.json：网络优先，失败回退缓存
  if (requestUrl.pathname.endsWith('/services.json')) {
    event.respondWith(
      fetch(event.request)
        .then(async response => {
          if (response.ok) {
            const responseClone = response.clone();
            try {
              const cache = await caches.open(DATA_CACHE);
              cache.put(event.request, responseClone);
            } catch (e) {
              console.warn('Failed to cache services.json:', e);
            }
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return cached || new Response('Unable to load services', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
    return;
  }

  // icons 文件夹：缓存优先，带后台更新
  if (requestUrl.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then(async cached => {
        if (cached) {
          backgroundUpdateCache(null, event.request);
          return cached;
        }
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (e) {
          // Return a simple fallback or the cached version if available
          return new Response('', { status: 404, statusText: 'Not Found' });
        }
      })
    );
    return;
  }

  // 静态资源：缓存优先，带后台更新
  if (STATIC_ASSETS.includes(requestUrl.pathname)) {
    event.respondWith(
      caches.match(event.request).then(async cached => {
        if (cached) {
          backgroundUpdateCache(null, event.request);
          return cached;
        }
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(event.request, response.clone());
          }
          return response;
        } catch (e) {
          return new Response('', { status: 404, statusText: 'Not Found' });
        }
      })
    );
    return;
  }

  // 其他请求：网络优先，失败回退缓存
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      return cached || new Response('', { status: 404, statusText: 'Not Found' });
    })
  );
});
