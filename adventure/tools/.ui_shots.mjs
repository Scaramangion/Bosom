// Headless screenshot harness for the critic.
// Usage: node tools/shots.mjs [shotNames comma-separated] [outDir] [--w=1600 --h=900 --wait=6000]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')));
const pos = args.filter(a => !a.startsWith('--'));
const names = (pos[0] || 'hero,field,trail,village,water,sunset,combat,forest').split(',');
const out = pos[1] || 'shots';
const W = +(flags.w || 1600), H = +(flags.h || 900), WAIT = +(flags.wait || 6000);
fs.mkdirSync(out, { recursive: true });

function findChromium() {
  const base = '/opt/pw-browsers';
  if (fs.existsSync(path.join(base, 'chromium'))  && fs.statSync(path.join(base,'chromium')).isFile()) return path.join(base, 'chromium');
  for (const d of fs.readdirSync(base)) {
    for (const c of ['chrome-linux/chrome', 'chrome-linux64/chrome']) {
      const p = path.join(base, d, c); if (fs.existsSync(p)) return p;
    }
  }
}
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { hmr: false, watch: null, port: 5199 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const STUB=(flags.stub||'').split(',').filter(Boolean);
await page.route(u => STUB.some(s => u.pathname.startsWith('/src/'+s)), r => r.fulfill({ contentType: 'application/javascript', body: 'export function init(){return null}' }));
page.on('response', r => { if (r.status() >= 400) logs.push('[http ' + r.status() + '] ' + r.url()); });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
for (const n of names) {
  const [sn, extra] = n.split(':'); await page.goto(sn === "title" ? url : `${url}?shot=${sn}`, { waitUntil: "commit", timeout: 180000 });
  try { await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 }); } catch { logs.push(`[timeout] ${n}`); }
  await page.waitForTimeout(WAIT); if (extra === 'pause') { await page.keyboard.press('Escape'); await page.waitForTimeout(1500); } if (extra === 'hurt') { await page.evaluate(() => { const c = window.__ctx; if (c.hero) c.hero.health = Math.max(1, (c.hero.health ?? 12) - 9); else c.hero = { health: 3, maxHealth: 12, position: { x: 10, y: 0, z: -10 } }; c.emit('hero-hurt', {}); c.emit('rupee', { amount: 37 }); }); await page.waitForTimeout(300); } if (extra === 'area') { await page.evaluate(() => window.__ctx.hud.showArea("Brennan's Hollow", 'A farming village')); await page.waitForTimeout(1600); }
  const fps = await page.evaluate(async () => { const f0 = window.__ctx?.frames || 0; await new Promise(r => setTimeout(r, 2000)); return ((window.__ctx?.frames || 0) - f0) / 2; });
  await page.screenshot({ path: `${out}/${n.replace(":","_")}.png`, timeout: 180000 });
  console.log(`shot ${n} -> ${out}/${n.replace(':','_')}.png  (swiftshader fps ~${fps})`);
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n'));
console.log(`console errors/warnings: ${logs.length} (see ${out}/console.log)`);
if (logs.length) console.log(logs.slice(0, 15).join('\n'));
await browser.close();
await server.close();
