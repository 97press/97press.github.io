// Офлайн-кеш пульта. Обробляє ЛИШЕ власні файли пульта, решту запитів
// на домені не чіпає — сусідні сайти на тому ж github.io не постраждають.
// Стратегія: віддаємо з кешу миттєво, у фоні оновлюємо (нова версія — з наступного запуску).
// Після змін у файлах збільшуй номер версії.
const PREFIX = 'spike-pult-';
const CACHE = PREFIX + 'v4';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const OWN = new Set(ASSETS.map(a => new URL(a, self.registration.scope).href));

self.addEventListener('install', e => {
  // cache: 'reload' — в обхід HTTP-кешу GitHub Pages (~10 хв), інакше нова версія
  // service worker могла б закешувати старий index.html.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      // видаляємо лише старі версії СВОГО кешу, чужі кеші домену не чіпаємо
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  url.search = ''; url.hash = '';
  if (!OWN.has(url.href)) return;          // не наш файл — браузер обробить сам

  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request.url, { cache: 'no-cache' })
        .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || new Response('Офлайн: ресурс не закешовано', { status: 503 });
    })
  );
});
