// The Papercraft app icon, made from the motif itself (docs/BRAND.md): Sudashorn folded as Facets, turned a little, on the studio stage,
// rendered by the viewer (no UI) at 1024 x 1024 and scaled down. Writes assets/icons/papercraft-{1024,512,192,180,maskable-512}.png.
// The maskable icon keeps her inside the middle 80% (Android may cut any shape from it). Run: node tools/make_papercraft_icons.js
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), { execFileSync } = require('child_process'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const shoot = async (file, fill) => { const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
    await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?mode=one&s=sud/stand&spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
    await p.addStyleTag({ content: '.top,.bar,.hello,.toast,#joints,#skel,.panel{display:none!important}' }); // the stage and the girl, nothing else
    await p.evaluate(f => { cam.to = null; cam.yaw = 0.55; cam.pitch = 0.16; const hh = 24 * SPRITE_POLYS.sprites['sud/stand'].rect[3] / 85; focus = [0, 0, hh * 0.5]; cam.zoom = hh / (2 * Math.tan(0.4) * f); }, fill);
    await p.waitForTimeout(800); await p.screenshot({ path: file }); await p.close(); };
  const tmp = R('assets/icons/.papercraft-full.png'), tmpM = R('assets/icons/.papercraft-mask.png'); await shoot(tmp, 0.78); await shoot(tmpM, 0.6); await b.close();
  execFileSync('python3', ['-c', `
from PIL import Image
import os
a = Image.open(${JSON.stringify(tmp)}).convert('RGB'); m = Image.open(${JSON.stringify(tmpM)}).convert('RGB')
for n in (1024, 512, 192): a.resize((n, n), Image.LANCZOS).save(${JSON.stringify(R('assets/icons'))} + '/papercraft-%d.png' % n)
a.resize((180, 180), Image.LANCZOS).save(${JSON.stringify(R('assets/icons/papercraft-180.png'))})
m.resize((512, 512), Image.LANCZOS).save(${JSON.stringify(R('assets/icons/papercraft-maskable-512.png'))})
os.remove(${JSON.stringify(tmp)}); os.remove(${JSON.stringify(tmpM)})`]);
  console.log('GREEN icons written: assets/icons/papercraft-{1024,512,192,180,maskable-512}.png');
})();
