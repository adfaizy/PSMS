const CACHE_VERSION = "psms-cache-v2";

/** Directory URL where this script lives (e.g. `https://host/` or `https://host/psms/`). */
function appRootUrl() {
  return new URL(".", self.location).href;
}

function appShellUrls() {
  const root = appRootUrl();
  return {
    root,
    index: new URL("index.html", root).href,
    manifest: new URL("manifest.webmanifest", root).href,
    favicon: new URL("favicon.png", root).href,
    icon192: new URL("pwa-icon-192.png", root).href,
    icon512: new URL("pwa-icon-512.png", root).href,
    apple: new URL("apple-touch-icon.png", root).href,
  };
}

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept");
  return typeof accept === "string" && accept.includes("text/html");
}

self.addEventListener("install", (event) => {
  const urls = appShellUrls();
  const shell = [
    urls.root,
    urls.index,
    urls.manifest,
    urls.favicon,
    urls.icon192,
    urls.icon512,
    urls.apple,
  ];
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(shell))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const path = url.pathname;

  // Never cache the service worker itself
  if (path.endsWith("/sw.js") || path === "/sw.js") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for HTML: ensures new deploys load fresh index.html (new Vite chunk URLs).
  if (isHtmlNavigation(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          return networkRes;
        })
        .catch(() => caches.match(appShellUrls().index)),
    );
    return;
  }

  // Vite fingerprinted assets: cache-first is safe (each build uses new URLs).
  if (path.includes("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
          return networkRes;
        });
      }),
    );
    return;
  }

  // Manifest, icons, config: prefer network so updates propagate; cache as offline fallback.
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        if (!networkRes || !networkRes.ok) return networkRes;
        const copy = networkRes.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
        return networkRes;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match(appShellUrls().index))),
  );
});
