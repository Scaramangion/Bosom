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
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { port: 5199 + Math.floor(Math.random()*300), host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
for (const n of names) {
  await page.goto(`${url}src/world/dev.html?shot=${n}`, { waitUntil: "commit", timeout: 120000 });
  try { await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 }); } catch { logs.push(`[timeout] ${n}`); }
  await page.waitForTimeout(WAIT);
  const fps = await page.evaluate(async () => { const f0 = window.__ctx?.frames || 0; await new Promise(r => setTimeout(r, 2000)); return ((window.__ctx?.frames || 0) - f0) / 2; });
  await page.screenshot({ path: `${out}/${n}.png`, timeout: 180000 });
  console.log(`shot ${n} -> ${out}/${n}.png  (swiftshader fps ~${fps})`);
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n'));
console.log(`console errors/warnings: ${logs.length} (see ${out}/console.log)`);
if (logs.length) console.log(logs.slice(0, 15).join('\n'));
await browser.close();
await server.close();
