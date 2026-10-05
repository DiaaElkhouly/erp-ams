const CACHE_NAME = "ims-cache-v1";
const STATIC_ASSETS = ["/offline", "/favicon.ico"];
const STATIC_NEXT_ASSETS = /^\/_next\/static\//;
const NEXT_DATA = /^\/_next\/data\//;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache authenticated HTML - API calls and navigations to dashboard require auth
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("/offline") as Promise<Response>)
    );
    return;
  }

  // Cache-first for Next.js static assets
  if (STATIC_NEXT_ASSETS.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Network-first for API calls - don't cache them
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response("offline", { status: 503 })));
    return;
  }

  // Default: try network, fallback to offline page if it's a navigation
  event.respondWith(
    fetch(request).catch(() => caches.match("/offline"))
  );
});
