import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
process.chdir('/home/user/Bosom/adventure');
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { port: 5600 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const base='/opt/pw-browsers'; let exe; for (const d of fs.readdirSync(base)) for (const c of ['chrome-linux/chrome','chrome-linux64/chrome']) { const p=path.join(base,d,c); if (fs.existsSync(p)) exe=p; }
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => console.log(m.text()));
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto(url + 'tools/blank.html').catch(()=>{});
const r = await page.evaluate(async () => {
  const T = await import('/src/village/tex.js');
  const out = {};
  for (const k of ['woodTex','plankTex','plasterTex','stoneTex','ruinTex','cobbleTex','thatchTex','shingleTex','slateTex','redTileTex','pathTex','soilTex','windowTex','signTex','clothTex']) { const t0=performance.now(); T[k](); out[k]=Math.round(performance.now()-t0); }
  return out;
});
console.log(JSON.stringify(r));
await browser.close(); await server.close();
