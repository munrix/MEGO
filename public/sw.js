// Minimal service worker: enables PWA install; network-first so live
// scan/check-in data is never stale.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // passthrough — no offline caching in phase 1
});
