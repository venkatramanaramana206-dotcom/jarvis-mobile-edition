
const CACHE_NAME = "jarvis-cache-v1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./Script.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_FILES).catch((error) => {
        console.warn("Some files could not be cached:", error);
      })
    )
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith("jarvis-cache-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestURL = new URL(event.request.url);

  if (requestURL.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const responseCopy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
        }

        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);

        if (cachedResponse) return cachedResponse;

        if (event.request.mode === "navigate") {
          return (
            (await caches.match("./index.html")) ||
            new Response("J.A.R.V.I.S is offline. Please reconnect to the internet.", {
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            })
          );
        }

        return new Response("Offline", { status: 503 });
      })
  );
});
