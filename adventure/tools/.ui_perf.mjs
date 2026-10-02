import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
const STUB = (process.argv[2]||'').split(',').filter(Boolean);
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { hmr: false, watch: null, port: 5600 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const exe = fs.readdirSync('/opt/pw-browsers').map(d => path.join('/opt/pw-browsers', d, 'chrome-linux/chrome')).find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.route(u => STUB.some(s => u.pathname.startsWith('/src/' + s)), r => r.fulfill({ contentType: 'application/javascript', body: 'export function init(){return null}' }));
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto(url + '?shot=hero', { waitUntil: 'commit', timeout: 180000 });
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 180000 });
await page.waitForTimeout(3000);
const measure = () => page.evaluate(async () => { const f0 = __ctx.frames; await new Promise(r => setTimeout(r, 3000)); return (__ctx.frames - f0) / 3; });
console.log('minimap ms', await page.evaluate(() => { const t=performance.now(); for (let i=0;i<50;i++) __ctx.hud._drawMinimap(); return (performance.now()-t)/50; }));
for (let i = 0; i < 0; i++) {
  console.log('hud on', await measure());
  await page.evaluate(() => document.getElementById('ui').style.display = 'none');
  console.log('hud off', await measure());
  await page.evaluate(() => document.getElementById('ui').style.display = '');
}
await browser.close(); await server.close();
