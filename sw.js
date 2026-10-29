// Offline copy of the app files only. Your packing list is never stored here —
// it lives in the phone's private app storage.
// The Japan trip tracker (/Yudale/) shares this website, so this file only ever
// touches caches whose name starts with "packing-".
const PREFIX = 'packing-';
const CACHE = PREFIX + 'v3';
const ASSETS = ['./', './index.html', './packing.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const TIMEOUT_MS = 4000;

self.addEventListener('install', e => {
  // one missing file must not stop offline mode from installing
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a => c.add(a)))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so new uploads arrive), but give up after 4 s on weak Wi-Fi and use the offline copy.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const nav = req.mode === 'navigate';
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fromCache = () => nav
      ? cache.match('./index.html').then(r => r || cache.match(req, { ignoreSearch: true }))
      : cache.match(req, { ignoreSearch: true });
    const net = fetch(req, nav ? { cache: 'no-cache' } : {}).then(res => {
      if (res.ok) cache.put(nav ? './index.html' : req, res.clone());
      return res;
    });
    net.catch(() => {});
    const timeout = new Promise(res => setTimeout(res, TIMEOUT_MS, null));
    try {
      const first = await Promise.race([net, timeout]);
      if (first) return first;
      const cached = await fromCache();
      return cached || await net;
    } catch {
      const cached = await fromCache();
      if (cached) return cached;
      throw new Error('offline');
    }
  })());
});
