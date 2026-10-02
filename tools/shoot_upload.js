// Phone-sized check of the picture path in papercraft/sprite-viewer.html (headless Chromium): choose a picture, let it cut out and fold,
// open Cut and tap Keep / Remove on the picture itself. RED on any page error or a picture that does not fold.
// Run: node tools/shoot_upload.js -> papercraft/shots/phone-*.png. Photos in tools/fixtures are from scikit-image's sample data (public domain / CC0).
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
const TESTS = [['phone-sprite', 'art-source/characters/girl_front.png'], ['phone-dagger', 'art-source/incoming/images/07e6d49e-IMG_6014.jpeg'],
  ['phone-pair', 'art-source/incoming/images/5e430c49-IMG_5986.jpeg'], ['phone-grid', 'tools/fixtures/grid-paper.jpg'], ['phone-photo', 'tools/fixtures/photo-astronaut.jpg'],
  ['phone-cut', 'art-source/incoming/images/50ad0851-image.jpg', [['keep', 0.5, 0.45], ['drop', 0.25, 0.55], ['drop', 0.66, 0.5]]],
  ['phone-photo-cut', 'tools/fixtures/photo-astronaut.jpg', [['keep', 0.45, 0.55], ['drop', 0.88, 0.75]]]];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const cuts = async n => p.waitForFunction(n => (window.CUT_DONE || 0) >= n, n, { timeout: 120000 });
  for (const [name, file, taps] of TESTS) {
    await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
    if (name === 'phone-sprite') await p.screenshot({ path: R('papercraft/shots/phone-start.png') });
    await p.setInputFiles('#file', R(file)); await cuts(1); await p.waitForTimeout(900);
    if (name === 'phone-sprite' || name === 'phone-grid') { // Round vs Card, seen from the side
      for (const [shape, yaw] of [['round', 1.25], ['round', 0.5], ['card', 1.25]]) { await p.click('#tDepth'); await p.click(`[data-shape=${shape}]`); await p.click('#tDepth');
        await p.evaluate(y => { cam.to = null; cam.yaw = y; cam.pitch = 0.18; }, yaw); await p.waitForTimeout(500); await p.screenshot({ path: R(`papercraft/shots/${name}-${shape}-${yaw}.png`) }); }
      await p.click('#tDepth'); await p.click('[data-shape=round]'); await p.click('#tDepth'); }
    if (taps) { await p.click('#tCut'); await p.waitForTimeout(1200); let n = await p.evaluate(() => window.CUT_DONE);
      for (const [kind, u, v] of taps) { await p.click(`[data-mark=${kind}]`); const [x, y] = await p.evaluate(([u, v]) => screenOf(u, v), [u, v]); await p.mouse.click(x, y); await cuts(++n); await p.waitForTimeout(150); }
      await p.waitForTimeout(400); await p.screenshot({ path: R('papercraft/shots/' + name + '-tapping.png') }); await p.click('#done'); await p.waitForTimeout(900); }
    const info = await p.$eval('#info', e => (e.textContent = '', 0)).then(() => p.evaluate(() => { info(); return document.getElementById('info').textContent; }));
    if (!/corners/.test(info)) errs.push(name + ': ' + info);
    await p.screenshot({ path: R('papercraft/shots/' + name + '.png') }); console.log('shot', name, '|', info);
  }
  { const fs = require('fs'), dir = R('papercraft/shots/export'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); // Save: the model, the cut-out, the Papercraft file
    await p.click('#save'); await p.waitForTimeout(300); await p.screenshot({ path: R('papercraft/shots/phone-save.png') });
    for (const kind of ['model', 'png', 'json']) { if (kind !== 'model') { await p.click('#save'); await p.waitForTimeout(200); } const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`[data-save=${kind}]`)]); await d.saveAs(path.join(dir, d.suggestedFilename())); console.log('saved', d.suggestedFilename()); } }
  await p.click('#more'); await p.waitForTimeout(300); await p.screenshot({ path: R('papercraft/shots/phone-options.png') });
  await p.emulateMedia({ colorScheme: 'dark' }); await p.click('#close'); await p.click('#tLook'); await p.waitForTimeout(500); await p.screenshot({ path: R('papercraft/shots/phone-dark-look.png') });
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN no page errors, every picture folded'); process.exit(errs.length ? 1 : 0);
})();
