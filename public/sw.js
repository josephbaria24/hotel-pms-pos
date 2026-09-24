/* Minimal service worker — required for Chrome installability on Android. */
const CACHE = "palawansu-hotel-shell-v1";
const PRECACHE = ["/", "/login", "/dashboard", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Chrome requires a fetch handler for the install prompt. */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const url = new URL(req.url);
        if (
          res.ok &&
          url.origin === self.location.origin &&
          (url.pathname.startsWith("/icons/") ||
            url.pathname === "/manifest.webmanifest" ||
            url.pathname === "/login")
        ) {
          const copy = res.clone();
          void caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const fallback = await caches.match("/login");
          if (fallback) return fallback;
        }
        return Response.error();
      }),
  );
});
