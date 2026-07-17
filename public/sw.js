const CACHE_PREFIX = 'rutas-perdidas-';
const CACHE_VERSION = 'v0.3.0';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/images/app-icon.svg',
  '/images/app-icon-192.png',
  '/images/app-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== SHELL_CACHE &&
                key !== STATIC_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

function isHashedStaticAsset(url) {
  return (
    url.pathname.startsWith('/assets/') &&
    /-[a-z0-9_-]{6,}\.(?:css|gif|jpe?g|js|png|svg|webp|woff2?)$/i.test(
      url.pathname,
    )
  );
}

function isVersionedLocalModel(url) {
  return (
    url.pathname.startsWith('/models/') &&
    url.pathname.toLowerCase().endsWith('.glb')
  );
}

function isMapArchiveRequest(request, url) {
  return (
    request.headers.has('range') ||
    url.pathname.startsWith('/maps/') ||
    url.pathname.toLowerCase().endsWith('.pmtiles')
  );
}

function respondNetworkFirst(event) {
  const request = event.request;
  const network = fetch(request);
  const response = network.catch(async () => {
    const cached = await caches.match(request);
    const shell = cached || (await caches.match('/'));
    return (
      shell ||
      new Response('Sin conexión', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    );
  });

  event.waitUntil(
    network
      .then((networkResponse) => {
        if (!networkResponse.ok) return undefined;
        return caches
          .open(SHELL_CACHE)
          .then((cache) => cache.put(request, networkResponse.clone()));
      })
      .catch(() => undefined),
  );
  event.respondWith(response);
}

function respondCacheFirst(event) {
  const request = event.request;
  const response = caches.open(STATIC_CACHE).then(async (cache) => {
    const match = await cache.match(request);
    if (match) return match;
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });

  event.respondWith(response);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    isMapArchiveRequest(request, url)
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    respondNetworkFirst(event);
    return;
  }

  if (isHashedStaticAsset(url) || isVersionedLocalModel(url)) {
    respondCacheFirst(event);
  }
});
