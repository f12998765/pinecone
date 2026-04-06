// 缓存版本号 - 更新内容时请修改此版本号
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `pinecone-static-${CACHE_VERSION}`;
const DATA_CACHE = `pinecone-data-${CACHE_VERSION}`;

// 预缓存的静态资源（只包含实际存在的文件）
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/favicon-96x96.png',
  '/web-app-manifest-192x192.png',
  '/web-app-manifest-512x512.png'
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
    ).then(() => {
      // 通知所有客户端有新内容可用
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ action: 'newContentAvailable' });
        });
      });
    })
  );
  self.clients.claim();
});

// 监听来自客户端的消息
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// 请求拦截
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // 针对 services.json：网络优先，失败回退缓存，并后台更新缓存
  if (requestUrl.pathname.endsWith('/services.json')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            caches.open(DATA_CACHE).then(cache => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 动态缓存 icons 文件夹：缓存优先，但带后台更新
  if (requestUrl.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) {
          // 有缓存，后台更新
          fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
          }).catch(() => {});
          return cached;
        }
        // 没缓存，请求网络
        return fetch(event.request).then(response => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => null);
      })
    );
    return;
  }

  // 静态资源：缓存优先，但带后台更新
  if (STATIC_ASSETS.includes(requestUrl.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async cache => {
        const cached = await cache.match(event.request);
        if (cached) {
          // 有缓存，后台更新
          fetch(event.request).then(response => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
          }).catch(() => {});
          return cached;
        }
        // 没缓存，请求网络
        return fetch(event.request).then(response => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => null);
      })
    );
    return;
  }

  // 其他请求：网络优先，失败回退缓存
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
