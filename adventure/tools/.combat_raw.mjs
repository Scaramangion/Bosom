// dev-only: raw render of combat views (bypasses post-fx). node tools/.combat_raw.mjs shot view1,view2 outdir
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
const [shot = 'combat', views = 'game', out = 'shots/combat', W = 960, H = 540] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
function findChromium() { const base = '/opt/pw-browsers'; for (const d of fs.readdirSync(base)) for (const c of ['chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = path.join(base, d, c); if (fs.existsSync(p)) return p; } }
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { hmr: false, watch: null, port: 5600 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
const t0 = Date.now();
await page.goto(`${server.resolvedUrls.local[0]}?shot=${shot}`, { timeout: 300000, waitUntil: 'commit' });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 400000, polling: 1000 });
await page.waitForFunction(() => (window.__ctx?.frames || 0) >= 3, null, { timeout: 400000, polling: 1000 });
await page.evaluate(() => { window.__pause = true; });
console.log('ready+3 frames', (Date.now() - t0) / 1000);
for (const v of views.split(',')) {
  const t1 = Date.now();
  await page.evaluate(async (v) => {
    const c = window.__ctx;
    if (v !== 'game') c.combat.debugView(v);
    c.renderer.setRenderTarget(null); c.renderer.render(c.scene, c.camera);
  }, v);
  await page.screenshot({ path: `${out}/${shot}_${v}.png`, timeout: 600000 });
  const info = await page.evaluate(() => { const r = window.__ctx.renderer.info.render; return { tris: r.triangles, calls: r.calls }; });
  console.log(v, (Date.now() - t1) / 1000, 's', JSON.stringify(info));
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n'));
console.log(logs.slice(0, 20).join('\n'));
await browser.close(); await server.close();
