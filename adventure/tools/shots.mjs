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
const W = +(flags.w || 1280), H = +(flags.h || 720), WAIT = +(flags.wait || 6000);
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
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { port: 5199 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
for (const n of names) {
  await page.goto(`${url}?shot=${n}`);
  try { await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 }); } catch { logs.push(`[timeout] ${n}`); }
  await page.waitForTimeout(WAIT);
  // SwiftShader can take seconds per frame: make sure several frames rendered at the shot pose
  const t0 = Date.now();
  await page.waitForFunction(() => (window.__ctx?.frames || 0) >= 6, null, { timeout: 400000, polling: 1000 }).catch(() => logs.push(`[slow] ${n}: <6 frames`));
  const frameInfo = await page.evaluate(() => window.__ctx?.frames);
  console.log(`  ${n}: ${frameInfo} frames, waited extra ${((Date.now()-t0)/1000).toFixed(0)}s`);
  const fps = await page.evaluate(async () => { const f0 = window.__ctx?.frames || 0; await new Promise(r => setTimeout(r, 4000)); return ((window.__ctx?.frames || 0) - f0) / 4; });
  // freeze the game loop so the compositor can capture a frame even when SwiftShader is slow
  await page.evaluate(() => { window.__pause = true; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${n}.png`, timeout: 240000 });
  console.log(`shot ${n} -> ${out}/${n}.png  (swiftshader fps ~${fps})`);
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n'));
console.log(`console errors/warnings: ${logs.length} (see ${out}/console.log)`);
if (logs.length) console.log(logs.slice(0, 15).join('\n'));
await browser.close();
await server.close();
