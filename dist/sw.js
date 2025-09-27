// sw.js — PWA با کش نسخه‌دار و fallback آفلاین
const VERSION = 'v1.0.2';
const CACHE = `kalangar-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './favicon.svg',
  './privacy.html',
  './terms.html',
  './offline.html',
  './assets/logo-mark-warm.svg',
  './assets/logo-lockup-horizontal.svg',
  './assets/hero.jpg'
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

  // Navigation requests: try cache, then network, then offline.html
  if (req.mode === 'navigate'){
    e.respondWith((async ()=>{
      try{
        const net = await fetch(req);
        // فروشگاه: نسخه جدید را کش کن
        const cache = await caches.open(CACHE);
        cache.put(req, net.clone()).catch(()=>{});
        return net;
      }catch(err){
        const cached = await caches.match(req);
        return cached || caches.match('./offline.html');
      }
    })());
    return;
  }

  // Static and CDN: cache-first, then network
  e.respondWith(
    caches.match(req).then(cached=>{
      const fetchPromise = fetch(req).then(res=>{
        caches.open(CACHE).then(c=> c.put(req, res.clone())).catch(()=>{});
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
