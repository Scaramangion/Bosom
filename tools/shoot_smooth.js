// Phone-sized check of the Smooth look in papercraft/sprite-viewer.html: Koto drawn in a T-pose on grid paper (tools/fixtures/koto-tpose.jpg)
// and Sudashorn (the opening sprite), folded as Facets at PS2 with soft shading across faces, the painting filtered and the outline cut
// straight, next to the Painting look; then Koto walking. RED on page errors or a rig that is not humanoid. Run: node tools/shoot_smooth.js
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const shot = async (n, yaw = 0.45) => { await p.evaluate(y => { cam.to = null; cam.yaw = y; cam.pitch = 0.12; cam.zoom = 0; }, yaw); await p.waitForTimeout(500); await p.screenshot({ path: R(`papercraft/shots/smooth-${n}.png`) }); };
  const look = async a => { await p.click('#tLook'); await p.click(`[data-abs=${a}]`); await p.click('#tLook'); await p.waitForTimeout(300); };
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still&mode=one&s=sud/stand'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.evaluate(() => document.querySelector('[data-budget="800"]').click()); await shot('stand-painting'); await look('smooth'); await shot('stand-smooth');
  await p.setInputFiles('#file', R('tools/fixtures/koto-tpose.jpg')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  const rig = await p.evaluate(() => [MINE.rig.humanoid, MINE.rig.parts.length, MINE.method]); console.log('Koto T-pose: cut as', rig[2], '| rig', rig[0] ? 'humanoid' : 'one piece', rig[1], 'parts'); if (!rig[0]) errs.push('the T-pose did not rig');
  await shot('koto-smooth'); await look('painting'); await shot('koto-painting'); await look('smooth');
  await p.click('#tPose'); await p.click('[data-anim=walk]'); await p.waitForTimeout(700); await shot('koto-walk', 0.9);
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN the Smooth look on Koto and Sudashorn, rigged and walking'); process.exit(errs.length ? 1 : 0);
})();
