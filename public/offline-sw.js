const CACHE_NAME = 'masterson-case-digital-offline-v5';

const CORE_PRECACHE_URLS = [
  '/',
  '/index.html',
  '/icon.svg',
  '/manifest.webmanifest',
  '/diagrams/horse-left.png',
  '/diagrams/horse-top.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_PRECACHE_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function warmUrlGraph(cache, initialUrls) {
  const queue = [...initialUrls];
  const visited = new Set();

  while (queue.length > 0) {
    const batch = queue.splice(0, 12).filter((u) => {
      if (!u || visited.has(u)) return false;
      visited.add(u);
      return true;
    });
    if (batch.length === 0) continue;

    await Promise.allSettled(
      batch.map(async (rawUrl) => {
        try {
          const fullUrl = new URL(rawUrl, self.location.origin).href;
          const pathname = new URL(fullUrl).pathname;
          let res = await cache.match(fullUrl, { ignoreVary: true });
          if (!res) {
            res = await fetch(fullUrl);
            if (res && res.status === 200) {
              await cache.put(fullUrl, res.clone());
              await cache.put(pathname, res.clone());
            }
          }
          if (
            res &&
            res.status === 200 &&
            (pathname.startsWith('/src/') ||
              pathname.startsWith('/node_modules/.vite/') ||
              pathname.endsWith('.tsx') ||
              pathname.endsWith('.ts') ||
              pathname.endsWith('.js'))
          ) {
            const text = await res.clone().text();
            const matches = text.matchAll(
              /["'](\/(?:src|node_modules\/\.vite|@vite)\/[^"'\s)]+)["']/g
            );
            for (const m of matches) {
              const depUrl = new URL(m[1], self.location.origin).href;
              if (!visited.has(depUrl)) {
                queue.push(depUrl);
              }
            }
          }
        } catch {
          // Ignore individual warm errors
        }
      })
    );
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'WARM_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        await warmUrlGraph(cache, event.data.urls);
        if (event.source && typeof event.source.postMessage === 'function') {
          event.source.postMessage({ type: 'WARM_COMPLETE' });
        }
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
          cache.put(url.href, networkResponse.clone()).catch(() => {});
          cache.put(url.pathname, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      } catch {
        const cachedResponse =
          (await cache.match(url.href, { ignoreVary: true })) ||
          (await cache.match(request, { ignoreVary: true })) ||
          (await cache.match(url.pathname, { ignoreVary: true })) ||
          (await cache.match(url.pathname, { ignoreSearch: true, ignoreVary: true })) ||
          (request.mode === 'navigate'
            ? (await cache.match('/', { ignoreVary: true })) ||
              (await cache.match('/index.html', { ignoreVary: true }))
            : undefined);
        if (cachedResponse) {
          return cachedResponse;
        }
        return new Response('Offline resource not cached', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    })()
  );
});
