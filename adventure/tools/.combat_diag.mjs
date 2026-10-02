import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
const shot = process.argv[2] || 'combat';
function findChromium() { const base = '/opt/pw-browsers'; for (const d of fs.readdirSync(base)) for (const c of ['chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = path.join(base, d, c); if (fs.existsSync(p)) return p; } }
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { hmr: false, watch: null, port: 5600 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('console', m => console.log('[console]', m.type(), m.text().slice(0, 300)));
page.on('pageerror', e => console.log('[pageerror]', e.message));
const t0 = Date.now();
await page.goto(`${server.resolvedUrls.local[0]}?shot=${shot}${process.argv[3]||''}`, { timeout: 300000, waitUntil: 'commit' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300000, polling: 1000 });
console.log('ready after', (Date.now() - t0) / 1000);
for (let i = 0; i < 6; i++) {
  await new Promise(r => setTimeout(r, 10000));
  const info = await page.evaluate(() => { const c = window.__ctx; const r = c.renderer.info; return { frames: c.frames, tris: r.render.triangles, calls: r.render.calls, enemies: c.enemies.length }; }).catch(e => 'eval fail ' + e.message);
  console.log((Date.now() - t0) / 1000, JSON.stringify(info));
}
await browser.close(); await server.close();
