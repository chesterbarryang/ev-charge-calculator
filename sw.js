const CACHE_NAME = 'ev-charge-calc-v3'; // Bumped version to force a new cache layer
const ASSETS = [
  '/ev-charge-calculator', 
  '/ev-charge-calculator/index.html',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
];

// Install Event - Forces the waiting service worker to become active immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => {
      return self.skipWaiting(); // <--- Crucial: Kicks out the old service worker
    })
  );
});

// Activate Event - Cleans up old cache versions (like v1 and v2)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // <--- Crucial: Instantly takes control of the open page
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
