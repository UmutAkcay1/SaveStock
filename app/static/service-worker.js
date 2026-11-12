const CACHE_NAME = "savestock-shell-v43";
const APP_SHELL = [
  "/",
  "/static/manifest.webmanifest",
  "/static/styles.css?v=43",
  "/static/offline-store.js?v=43",
  "/static/app.js?v=43",
  "/static/icons/savestock-192.png",
  "/static/icons/savestock-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(APP_SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.startsWith("savestock-shell-") && key !== CACHE_NAME; })
      .map(function (key) { return caches.delete(key); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request, {cache: "no-cache"}).then(function (response) {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put("/", copy); });
      }
      return response;
    }).catch(function () { return caches.match("/"); }));
    return;
  }

  if (url.pathname.startsWith("/static/")) {
    event.respondWith(fetch(request, {cache: "no-cache"}).then(function (response) {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        throw new Error("SaveStock çevrimdışı ve bu dosya önbellekte bulunamadı.");
      });
    }));
  }
});
