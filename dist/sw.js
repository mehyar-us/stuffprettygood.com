/* Stuff Pretty Good service worker
 * Cache strategy:
 *   - HTML navigations: network-first, fall back to cached, fall back to /offline.html
 *   - Same-origin static assets (CSS / manifest / icons / images): cache-first
 *   - Outbound affiliate traffic / Workers API: passthrough (never cached, never intercepted)
 * Bumping SW_VERSION invalidates the old caches on the next activate.
 */
const SW_VERSION = 'spg-v2';
const SW_CACHE = `spg-${SW_VERSION}`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  '/',
  '/styles.css',
  '/favicon.svg',
  '/site.webmanifest',
  '/assets/site/spg-logo.svg',
  '/assets/site/spg-shopping-guide.svg',
  OFFLINE_URL,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SW_CACHE);
      try { await cache.addAll(PRECACHE); } catch (e) { /* best-effort precache */ }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== SW_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

const isHtmlRequest = (req) =>
  req.mode === 'navigate'
  || (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));

const isSameOriginAsset = (url) =>
  url.origin === self.location.origin
  && !url.pathname.startsWith('/go/')
  && !url.pathname.startsWith('/api/');

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache the affiliate / Workers API endpoints.
  if (url.hostname === 'stuffprettygood-api.mehyar.workers.dev') return;
  if (/amazon|impact|walmart|clarity|cloudflare|google|bing|facebook/i.test(url.hostname)) return;

  // HTML navigation → network-first, fall back to cache, fall back to offline.
  if (isHtmlRequest(req)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(SW_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (_) {
          const cached = await caches.match(req);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          return new Response('Offline. Cache empty.', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Same-origin static assets → cache-first.
  if (isSameOriginAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.status === 200 && fresh.type === 'basic') {
            const cache = await caches.open(SW_CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (_) {
          return cached || Response.error();
        }
      })()
    );
  }
});

// Allow the page to ask the SW to skipWaiting (force-update the SW right now).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
