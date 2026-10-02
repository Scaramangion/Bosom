// usage: node hshot.mjs outdir name1='query' name2='query' ...
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
process.chdir('/home/user/Bosom/adventure');
const [out, ...specs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { port: 5600 + Math.floor(Math.random() * 300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = +(process.env.W || 900), H = +(process.env.H || 900);
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
for (const s of specs) {
  const i = s.indexOf('='); const name = s.slice(0, i), q = s.slice(i + 1);
  const full = q.startsWith('game:') ? `${url}?${q.slice(5)}` : `${url}src/hero/debug/index.html?${q}`;
  const t0 = Date.now();
  await page.goto(full, { waitUntil: 'commit', timeout: 120000 });
  try { await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 120000 }); } catch { logs.push('timeout ' + name); }
  await page.waitForTimeout(+(process.env.WAIT || 1500));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'ok', Date.now() - t0, 'ms');
}
fs.writeFileSync(`${out}/console.log`, logs.join('\n'));
console.log(logs.slice(0, 20).join('\n'));
await browser.close(); await server.close();
