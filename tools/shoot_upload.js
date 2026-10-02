// Phone-sized check of the picture path in papercraft/sprite-viewer.html (headless Chromium): choose a picture, fold it, tap Erase and tap the
// background on the model itself. RED on any page error or a picture that does not fold. Run: node tools/shoot_upload.js -> papercraft/shots/phone-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
const TESTS = [['phone-sprite', 'art-source/characters/girl_front.png'], ['phone-dagger', 'art-source/incoming/images/07e6d49e-IMG_6014.jpeg'],
  ['phone-pair', 'art-source/incoming/images/5e430c49-IMG_5986.jpeg'], ['phone-grid', 'tools/fixtures/grid-paper.jpg'],
  ['phone-erase', 'art-source/incoming/images/50ad0851-image.jpg', [[0.2, 0.55], [0.64, 0.5], [0.63, 0.38], [0.66, 0.6]]]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  for (const [name, file, taps] of TESTS) {
    await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
    if (name === 'phone-sprite') await p.screenshot({ path: R('papercraft/shots/phone-start.png') });
    await p.setInputFiles('#file', R(file)); await p.waitForFunction(() => window.MINE_READY, null, { timeout: 60000 }); await p.waitForTimeout(900);
    if (taps) { await p.click('#tErase'); await p.waitForTimeout(1200);
      for (const [u, v] of taps) { const [x, y] = await p.evaluate(([u, v]) => screenOf(u, v), [u, v]); await p.mouse.click(x, y); await p.waitForTimeout(250); }
      console.log('  erased with', await p.evaluate(() => MINE.seeds.length), 'taps');
      await p.waitForTimeout(400); await p.screenshot({ path: R('papercraft/shots/' + name + '-tapping.png') }); await p.click('#done'); await p.waitForTimeout(900); }
    const info = await p.$eval('#info', e => e.textContent); if (!/corners/.test(info)) errs.push(name + ': ' + info);
    await p.screenshot({ path: R('papercraft/shots/' + name + '.png') }); console.log('shot', name, '|', info);
  }
  await p.click('#more'); await p.waitForTimeout(300); await p.screenshot({ path: R('papercraft/shots/phone-options.png') });
  await p.emulateMedia({ colorScheme: 'dark' }); await p.click('#close'); await p.click('#tDepth'); await p.waitForTimeout(500); await p.screenshot({ path: R('papercraft/shots/phone-dark-depth.png') });
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN no page errors, every picture folded'); process.exit(errs.length ? 1 : 0);
})();
