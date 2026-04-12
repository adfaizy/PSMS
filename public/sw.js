const CACHE_VERSION = "psms-cache-v1";

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
  };
}

function isHtmlNavigation(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept");
  return typeof accept === "string" && accept.includes("text/html");
}

self.addEventListener("install", (event) => {
  const { root, index, manifest, favicon } = appShellUrls();
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll([root, index, manifest, favicon]))
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);
  const path = url.pathname;

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

  // Manifest, icons, sw scope: prefer network so updates propagate; cache as offline fallback only.
  event.respondWith(
    fetch(event.request)
      .then((networkRes) => {
        const copy = networkRes.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy)).catch(() => undefined);
        return networkRes;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match(appShellUrls().index))),
  );
});
