const VERSION = 'v1.0.0';
const CACHE = `kalangar-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './favicon.svg',
  './assets/logo-mark-warm.svg',
  './assets/logo-lockup-horizontal.svg',
  './assets/hero.jpg',
  'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.7/dist/dexie.mjs',
  'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;800&display=swap'
];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=> c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(keys=> Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(cached=>{
      const fetchPromise = fetch(req).then(res=>{
        const copy = res.clone();
        caches.open(CACHE).then(c=> c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(()=> cached);
      return cached || fetchPromise;
    })
  );
});
self.addEventListener('message', (event)=>{
  if (event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});