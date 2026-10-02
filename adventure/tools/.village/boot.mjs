import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { port: 5600 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const base='/opt/pw-browsers'; let exe; for (const d of fs.readdirSync(base)) for (const c of ['chrome-linux/chrome','chrome-linux64/chrome']) { const p=path.join(base,d,c); if (fs.existsSync(p)) exe=p; }
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const t0=Date.now();
page.on('console', m => console.log(((Date.now()-t0)/1000).toFixed(1), m.type(), m.text().slice(0,300)));
page.on('pageerror', e => console.log('ERR', e.message));
page.goto(url + '?shot=village', {timeout: 200000}).catch(e=>console.log('goto',e.message));
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 200000 });
console.log('ready at', (Date.now()-t0)/1000);
await browser.close(); await server.close();
