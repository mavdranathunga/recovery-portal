// Service Worker for Recovery Portal PWA
// Strategy:
//   - Static assets (JS, CSS, fonts, images): Cache-first
//   - API calls (/api/*): Network-only (always fresh data)
//   - Pages: Network-first with cache fallback

const CACHE_NAME = "recovery-portal-v1";

const STATIC_ASSETS = [
  "/",
  "/recovery",
  "/diagnostics",
  "/mass-runner",
  "/offline-dump",
  "/icon-192x192.png",
  "/icon-512x512.png",
];

// ── Install: pre-cache shell pages ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ───────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ──────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // API calls — always network (never cache live data)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Next.js HMR / build internals — skip
  if (url.pathname.startsWith("/_next/webpack-hmr") ||
      url.pathname.startsWith("/_next/static/webpack/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Next.js static assets (_next/static/) — cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }

  // Pages & other assets — network-first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
