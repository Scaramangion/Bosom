// Bakes src/village/tex.js procedural textures into public/village/tex (webp) + manifest.json
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { port: 5600 + Math.floor(Math.random()*300), host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const base='/opt/pw-browsers'; let exe; for (const d of fs.readdirSync(base)) for (const c of ['chrome-linux/chrome','chrome-linux64/chrome']) { const p=path.join(base,d,c); if (fs.existsSync(p)) exe=p; }
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto(url + 'tools/.village/none.html').catch(()=>{});
await page.evaluate(() => { document.body.innerHTML = ''; });
const res = await page.evaluate(async () => {
  const T = await import('/src/village/tex.js');
  T.woodTex('dark'); T.woodTex('light'); T.plankTex('warm'); T.plankTex('grey'); T.plankTex('red');
  T.plasterTex(); T.stoneTex(); T.ruinTex(); T.cobbleTex(); T.thatchTex(); T.shingleTex(); T.slateTex(); T.redTileTex();
  T.pathTex(); T.soilTex(); T.windowTex(); T.signTex(); T.clothTex(); T.smokeTex();
  for (const k of ['wheat', 'veg', 'weed']) T.cropTex(k);
  const out = { manifest: {}, files: {} };
  const ser = (key, prop, t) => {
    const name = key + (prop ? '.' + prop : '') ;
    const img = t.image;
    const alpha = /path|crop|smoke/.test(key);
    const file = name + (alpha ? '.png' : '.webp');
    out.files[file] = alpha ? img.toDataURL('image/png') : img.toDataURL('image/webp', 0.93);
    return { file, srgb: t.colorSpace === 'srgb', repeat: t.wrapS === 1000 };
  };
  for (const [k, v] of Object.entries(T.cache)) {
    if (v.isTexture) out.manifest[k] = ser(k, '', v);
    else { out.manifest[k] = {}; for (const [p, t] of Object.entries(v)) out.manifest[k][p] = ser(k, p, t); }
  }
  return out;
});
const dir = 'public/village/tex'; fs.mkdirSync(dir, { recursive: true });
let total = 0;
for (const [f, d] of Object.entries(res.files)) { const b = Buffer.from(d.split(',')[1], 'base64'); total += b.length; fs.writeFileSync(path.join(dir, f), b); }
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(res.manifest, null, 1));
console.log('baked', Object.keys(res.files).length, 'files', (total/1e6).toFixed(1), 'MB');
await browser.close(); await server.close();
