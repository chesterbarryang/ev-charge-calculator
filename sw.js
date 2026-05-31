const CACHE_NAME = 'ev-charge-calc-v2'; // Bumped version to force browser update
const ASSETS = [
  './', 
  './index.html',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4' // Add this line
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
