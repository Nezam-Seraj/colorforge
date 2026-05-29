// === ColorForge — Service Worker ===
const CACHE_NAME = 'colorforge-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/lucide.min.js',
  './js/app.js',
  './js/studio.js',
  './js/ai-pipeline.js',
  './js/gallery.js',
  './js/discover.js',
  './js/payments.js',
  './js/kids-mode.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

// Install — cache all core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — network-first for HTML, stale-while-revalidate for JS/CSS/Assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle HTTP/HTTPS protocols (ignores chrome-extensions, etc.)
  if (!url.protocol.startsWith('http')) return;

  // HTML documents — network first (so updates are live immediately)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // API calls — network first
  if (url.pathname.includes('/api/') || url.hostname === 'api.replicate.com') {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Static Assets — stale while revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Fail silently, network response will fail
  });

  return cachedResponse || fetchPromise;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // If offline fallback is needed
    if (request.mode === 'navigate') {
      return caches.match('./index.html');
    }
    
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
