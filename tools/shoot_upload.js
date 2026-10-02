// Phone-sized check of "+ picture": uploads test images into papercraft/sprite-viewer.html in headless Chromium, screenshots each fold.
// RED on any page error or a picture that does not fold. Run: node tools/shoot_upload.js  ->  papercraft/shots/phone-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
const TESTS = [['phone-sprite', 'art-source/characters/girl_front.png', ''], ['phone-dagger', 'art-source/incoming/images/07e6d49e-IMG_6014.jpeg', ''],
  ['phone-pair', 'art-source/incoming/images/5e430c49-IMG_5986.jpeg', ''], ['phone-textured', 'art-source/incoming/images/50ad0851-image.jpg', ''], ['phone-dagger-wire', 'art-source/incoming/images/07e6d49e-IMG_6014.jpeg', 'wire'],
  ['phone-erase', 'art-source/incoming/images/50ad0851-image.jpg', 'erase', [[0.2, 0.5], [0.8, 0.45], [0.5, 0.08], [0.75, 0.85]]], ['phone-erase-cut', 'art-source/incoming/images/50ad0851-image.jpg', 'erase-open', [[0.2, 0.5], [0.8, 0.45], [0.5, 0.08], [0.75, 0.85]]]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  for (const [name, file, opt, taps] of TESTS) {
    await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&yaw=0.6&pitch=0.3' + (opt === 'wire' ? '&wire=1&ps1=0' : '')); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
    await p.setInputFiles('#file', R(file)); await p.waitForFunction(() => window.MINE_READY, null, { timeout: 60000 }); await p.waitForTimeout(500);
    if (taps) { await p.click('#cut'); await p.waitForTimeout(300); // tap to erase: open the big preview, then tap the background
      for (const [u, v] of taps) { const r = await p.$eval('#cut', c => { const b = c.getBoundingClientRect(), k = Math.min(b.width / c.width, b.height / c.height); return [b.left + (b.width - c.width * k) / 2, b.top + (b.height - c.height * k) / 2, c.width * k, c.height * k]; });
        const n = await p.evaluate(() => window.MINE_READY); await p.mouse.click(r[0] + u * r[2], r[1] + v * r[3]); await p.waitForTimeout(200); }
      if (opt !== 'erase-open') { await p.mouse.click(30, 600); await p.waitForTimeout(300); } }
    const stats = await p.$eval('#stats', e => e.textContent); if (!/triangles/.test(stats) || /nothing/.test(stats)) errs.push(name + ': ' + stats);
    await p.screenshot({ path: R('papercraft/shots/' + name + '.png') }); console.log('shot', name, '|', stats);
  }
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN no page errors, every picture folded'); process.exit(errs.length ? 1 : 0);
})();
