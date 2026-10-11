

/* ==========================================
   JARVIS AI — SERVICE WORKER
   File: frontend/sw.js
   ========================================== */

"use strict";

const CACHE_PREFIX = "jarvis-ai-";
const CACHE_VERSION = "v1";
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;

const APP_FILES = [
  "../index.html",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./mic-button.html",
  "./jarvis-build-log.html"
];

/* Install: cache essential app files */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error("JARVIS cache installation failed:", error);
      })
  );
});

/* Activate: remove older JARVIS caches */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        const oldCaches = cacheNames.filter((name) =>
          name.startsWith(CACHE_PREFIX) &&
          name !== STATIC_CACHE
        );

        return Promise.all(
          oldCaches.map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

/* Fetch: serve cached local files when appropriate */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never cache AI API requests or other external requests.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Do not cache requests that look like API calls.
  if (
    url.pathname.includes("/api/") ||
    url.pathname.endsWith("/chat/completions")
  ) {
    return;
  }

  // Navigation: try network first, then cached app page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);

          if (cachedPage) {
            return cachedPage;
          }

          const fallback = await caches.match("../index.html");

          if (fallback) {
            return fallback;
          }

          return new Response(
            "JARVIS is offline. Please reconnect to the internet.",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        })
    );

    return;
  }

  // Static resources: use cache first, then network.
  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const response = await fetch(request);

        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();

          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      } catch (error) {
        return new Response("Resource unavailable offline.", {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        });
      }
    })
  );
});
