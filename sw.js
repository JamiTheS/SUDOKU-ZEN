const CACHE_NAME = "sudoku-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./battle-styles.css",
  "./script.js",
  "./battle-manager.js",
  "./coop-manager.js",
  "./icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
