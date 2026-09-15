/* Cookwise service worker — hand-written, no build step.
 *
 * Strategies
 *   navigations          network-first, cache fallback, then /offline.html
 *   /_next/static/*      stale-while-revalidate (content-hashed, safe to reuse)
 *   fonts, images, icons stale-while-revalidate
 *   /api/*               never cached (always network; AI + auth must be live)
 *   everything else      cache-first for same-origin GETs already in the cache
 *
 * Bump CACHE_VERSION whenever the precache list or a strategy changes; the
 * activate handler deletes every cache that does not match the current names.
 */

const CACHE_VERSION = "v1";
const PRECACHE = `cookwise-precache-${CACHE_VERSION}`;
const RUNTIME = `cookwise-runtime-${CACHE_VERSION}`;
const CURRENT_CACHES = [PRECACHE, RUNTIME];

const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  "/",
  "/home",
  "/plan",
  "/cook",
  "/pantry",
  "/profile",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

// ---------------------------------------------------------------------------
// Install / activate
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // addAll() is all-or-nothing; a single 404 during development would
      // abort the whole install, so cache each entry independently.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "reload" });
            if (response.ok) await cache.put(url, response);
          } catch {
            /* offline during install — the runtime handler will fill this in */
          }
        }),
      );
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("cookwise-") && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------------------------------------------------------------------
// Fetch strategies
// ---------------------------------------------------------------------------

function isStaleWhileRevalidate(url, request) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  if (url.origin === "https://fonts.gstatic.com") return true;
  if (url.origin === "https://fonts.googleapis.com") return true;
  return request.destination === "image" || request.destination === "font";
}

/** Network-first; on failure serve the cached page, then the offline page. */
async function handleNavigation(event) {
  const { request } = event;
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) {
      void putInCache(RUNTIME, request, preloaded.clone());
      return preloaded;
    }

    const response = await fetch(request);
    if (response && response.ok) {
      void putInCache(RUNTIME, request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await caches.match(request)) ??
      (await caches.match(new URL(request.url).pathname));
    if (cached) return cached;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response("You are offline.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

/** Serve the cached copy immediately and refresh it in the background. */
function staleWhileRevalidate(event) {
  const { request } = event;

  // Start the refresh and register it with the event *synchronously*, before
  // any await, so the worker is not torn down mid-revalidation.
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) void putInCache(RUNTIME, request, response.clone());
      return response;
    })
    .catch(() => undefined);
  event.waitUntil(network);

  return caches.match(request).then(
    (cached) =>
      cached ??
      network.then(
        (response) => response ?? new Response("", { status: 504, statusText: "Offline" }),
      ),
  );
}

/** Cache-first for anything else we have already stored. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && request.method === "GET") {
      void putInCache(RUNTIME, request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function putInCache(cacheName, request, response) {
  try {
    // Opaque and partial responses are not worth storing.
    if (!response || response.status !== 200 || response.type === "opaque") return;
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    /* quota exceeded or an unsupported request — not worth failing over */
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API traffic — AI routes, auth callbacks and the ML proxy must
  // always hit the network so their fallbacks can fire correctly.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    return;
  }

  // Skip Next.js dev/HMR endpoints and range requests.
  if (url.pathname.startsWith("/_next/webpack-hmr")) return;
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  // Cross-origin: only the font hosts are worth touching.
  if (url.origin !== self.location.origin && !isStaleWhileRevalidate(url, request)) {
    return;
  }

  if (isStaleWhileRevalidate(url, request)) {
    event.respondWith(staleWhileRevalidate(event));
    return;
  }

  event.respondWith(cacheFirst(request));
});
