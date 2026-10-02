// Green/red check for Papercraft as a home-screen app (a PWA), served the way GitHub Pages serves it (over http, from papercraft/): the
// address opens the app, the manifest names it and points at icons that exist at their stated sizes, the service worker installs and keeps
// the app, and with the connection cut the app still opens and works (folds a picture). Run: node tools/check_app.js
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), http = require('http'), fs = require('fs'), R = p => path.resolve(__dirname, '..', p);
const TYPES = { html: 'text/html', js: 'text/javascript', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png', jpg: 'image/jpeg' };
(async () => {
  const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]), f = R('.' + (u.endsWith('/') ? u + 'index.html' : u)); if (!f.startsWith(R('.')) || !fs.existsSync(f)) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); }).listen(0); const base = `http://localhost:${srv.address().port}/papercraft/`;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), ctx = await b.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [], bad = m => errs.push(m); p.on('pageerror', e => errs.push(e.message));
  await p.goto(base); await p.waitForURL(/sprite-viewer\.html/); await p.waitForFunction(() => window.READY, null, { timeout: 60000 }); console.log('the address opens', p.url().replace(base, 'papercraft/'));
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'), r = await fetch(l.href); return { ok: r.ok, type: r.headers.get('content-type'), m: await r.json() }; });
  if (!man.ok || man.m.name !== 'Papercraft' || man.m.display !== 'standalone' || !man.m.start_url) bad('manifest: ' + JSON.stringify(man.m).slice(0, 200));
  for (const ic of man.m.icons) { const [w, h] = await p.evaluate(src => new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth, im.naturalHeight]); im.onerror = () => res([0, 0]); im.src = src; }), new URL(ic.src, base).href);
    console.log('icon', ic.src, w + 'x' + h, ic.purpose || ''); if (ic.sizes !== `${w}x${h}`) bad(`icon ${ic.src} is ${w}x${h}, says ${ic.sizes}`); }
  const touch = await p.evaluate(() => document.querySelector('link[rel=apple-touch-icon]').href); console.log('home-screen icon (iPhone):', touch.replace(base, ''));
  const sw = await p.evaluate(async () => { const reg = await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 500)); const keys = await caches.keys(), c = await caches.open(keys.find(k => k.startsWith('papercraft-'))); return { scope: reg.scope, keys, kept: (await c.keys()).map(q => q.url.split('/papercraft/')[1]) }; });
  console.log('service worker:', sw.scope.replace(base, 'papercraft/') || 'papercraft/', '| kept for offline:', sw.kept.join(', ')); if (!sw.kept.includes('sprite-viewer.html')) bad('the app page is not kept for offline');
  await p.reload(); await p.waitForFunction(() => window.READY, null, { timeout: 60000 }); // now controlled by the worker
  await ctx.setOffline(true); await p.reload(); const off = await p.waitForFunction(() => window.READY, null, { timeout: 60000 }).then(() => true).catch(() => false);
  console.log('offline: the app', off ? 'opens' : 'does NOT open'); if (!off) bad('the app does not open offline');
  if (off) { await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); const ok = await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1 && MINE.geo && MINE.geo.length, null, { timeout: 120000 }).then(() => true).catch(() => false);
    const parts = await p.evaluate(() => MINE.geo ? MINE.geo.length : 0); console.log('offline: a picture folded and rigged into', parts, 'parts'); if (!ok || !parts) bad('the app does not work offline'); await p.screenshot({ path: R('papercraft/shots/app-offline.png') }); }
  await ctx.setOffline(false); await b.close(); srv.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN installable: manifest, icons, offline copy, works with no connection'); process.exit(errs.length ? 1 : 0);
})();
