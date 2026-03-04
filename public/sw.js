const SW_VERSION = "v1.1.0";
const APP_SHELL_CACHE = `app-shell-${SW_VERSION}`;
const ASSET_CACHE = `assets-${SW_VERSION}`;

const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/offline.html",
  "/FinanceIcon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, ASSET_CACHE].includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const isNavigationRequest = (request) =>
  request.mode === "navigate" && request.method === "GET";

const isStaticAsset = ({ request, url }) =>
  request.method === "GET" &&
  url.origin === self.location.origin &&
  ["style", "script", "font", "image"].includes(request.destination);

const isSensitiveApiRequest = ({ request, url }) => {
  if (request.method !== "GET") return false;

  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/functions/v1/")
  );
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cachedApp = await caches.match("/index.html");
          return cachedApp || caches.match("/offline.html");
        })
    );
    return;
  }

  if (isSensitiveApiRequest({ request, url })) {
    event.respondWith(fetch(request));
    return;
  }

  if (isStaticAsset({ request, url })) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.headers.get("Cache-Control")?.includes("no-store")) {
            return response;
          }

          const cloned = response.clone();
          caches.open(ASSET_CACHE).then((cache) => cache.put(request, cloned));
          return response;
        });
      })
    );
  }
});
