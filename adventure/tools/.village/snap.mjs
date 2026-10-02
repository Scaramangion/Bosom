// usage: node tools/.village/snap.mjs out.png shotName [camx,camy,camz,lx,ly,lz] [tod]
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import fs from 'fs'; import path from 'path';
const [outDir, shot, ...views] = process.argv.slice(2); // views: name=camx,camy,camz,lx,ly,lz@tod  (cam may be 'shot')
const server = await createServer({ configFile: path.resolve('vite.config.js'), server: { port: 5600 + Math.floor(Math.random()*300), host: '127.0.0.1', hmr: false, ws: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const base='/opt/pw-browsers'; let exe; for (const d of fs.readdirSync(base)) for (const c of ['chrome-linux/chrome','chrome-linux64/chrome']) { const p=path.join(base,d,c); if (fs.existsSync(p)) exe=p; }
const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs=[];
page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type()+' '+m.text().slice(0,300)); });
page.on('pageerror', e => logs.push('ERR '+e.message));
page.goto(url + '?shot=' + shot, {timeout: 1500000}).catch(e=>logs.push('goto '+e.message));
await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 1500000, polling: 1000 });
await page.waitForTimeout(4000);
for (const v of views) {
  const [name, rest] = v.split('='); const [cam, tod] = (rest || 'shot').split('@');
  const ok = await page.evaluate(async ([cam, tod]) => {
    const c = window.__ctx; window.__pause = false;
    if (tod) { if (c.shot) c.shot.tod = +tod; c.setTod && c.setTod(+tod); }
    if (cam && cam !== 'shot') { const v = cam.split(',').map(Number); if (c.shot) c.shot.cam = { pos: v.slice(0,3), look: v.slice(3) }; }
    await new Promise(r => setTimeout(r, 2500));
    window.__pause = true;
    if (cam && cam !== 'shot') { const v = cam.split(',').map(Number); c.camera.position.set(v[0],v[1],v[2]); c.camera.lookAt(v[3],v[4],v[5]); c.camera.updateMatrixWorld(); }
    c.renderer.setRenderTarget(null); c.renderer.render(c.scene, c.camera);
    return c.renderer.domElement.toDataURL('image/png');
  }, [cam, tod]);
  fs.writeFileSync(outDir + '/' + name + '.png', Buffer.from(ok.split(',')[1], 'base64'));
  console.log('wrote', name);
}
fs.writeFileSync(outDir + '/console.log', logs.join('\n'));
console.log(logs.filter(l=>/village|Error|ERR/.test(l)).slice(0,20).join('\n'));
console.log('logs', logs.length);
await browser.close(); await server.close();
