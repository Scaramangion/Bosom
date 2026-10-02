/* Papercraft service worker (made by tools/make_sprite_viewer.py): the app page is fetched fresh whenever you are online, so every new build
   shows up, and the last good copy is kept so the app opens with no connection. Everything Papercraft does happens on the phone: nothing is sent anywhere. */
const VERSION = 'papercraft-4366a47991';
const CORE = ['sprite-viewer.html', 'manifest.webmanifest', 'icons/papercraft-180.png', 'icons/papercraft-192.png', 'icons/papercraft-512.png', 'icons/papercraft-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('papercraft-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') { // the app page: network first, the saved copy when offline
    e.respondWith(fetch(req, { cache: 'no-store' }).then(r => { if (r.ok && /sprite-viewer\.html$/.test(new URL(req.url).pathname)) { const copy = r.clone(); caches.open(VERSION).then(c => c.put('sprite-viewer.html', copy)); } return r; })
      .catch(() => caches.match('sprite-viewer.html')));
    return; }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
