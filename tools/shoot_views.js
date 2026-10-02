// Phone-sized check of the back of a model in papercraft/sprite-viewer.html: Koto's front view (tools/fixtures/koto-front.png, from his own four-view
// sheet), seen from behind with the back mirrored, guessed, and taken from his back view (koto-back.png). Saves the model with its back.
// RED on page errors or a back view that does not fit. Run: node tools/shoot_views.js -> papercraft/shots/views-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), fs = require('fs'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 }); await p.waitForTimeout(500);
  console.log('rig:', await p.evaluate(() => MINE.rig.humanoid ? MINE.rig.parts.map(q => q.name).join(' ') : 'one piece'), '| back:', await p.evaluate(() => MINE.backMode));
  await p.click('#tViews'); await p.waitForTimeout(300);
  const shot = async (name, yaw) => { await p.evaluate(y => { cam.zoom = 0; cam.to = null; cam.yaw = y; cam.pitch = 0.12; }, yaw); await p.waitForTimeout(500); await p.screenshot({ path: R(`papercraft/shots/views-${name}.png`) }); };
  await shot('front', 0.35);
  for (const mode of ['mirror', 'guess']) { await p.click(`[data-back=${mode}]`); await p.waitForTimeout(300); await shot(mode, Math.PI - 0.35); }
  await p.setInputFiles('#fileBack', R('tools/fixtures/koto-back.png')); await p.waitForFunction(() => (window.BACK_DONE || 0) >= 1, null, { timeout: 120000 }); await p.waitForTimeout(400);
  const fit = await p.evaluate(() => MINE.backFit); console.log('back view fitted:', (fit * 100).toFixed(1) + '% of the front matched'); if (!(fit > 0.8)) errs.push('back view fits only ' + fit);
  await shot('picture', Math.PI - 0.35); await shot('picture-side', Math.PI / 2 + 0.25);
  await p.setInputFiles('#fileSide', R('tools/fixtures/koto-left.png')); await p.waitForFunction(() => (window.SIDE_DONE || 0) >= 1, null, { timeout: 120000 }); await p.waitForTimeout(400); // his side view
  const facing = await p.evaluate(() => MINE.sideFit && MINE.sideFit.panels[0].facing); console.log('side view faces', facing); if (facing !== 'right') errs.push('side view facing ' + facing);
  await shot('side-west', -Math.PI / 2); await shot('side-east', Math.PI / 2); await shot('side-34', -0.8); await shot('side-34back', Math.PI + 0.8);
  await p.evaluate(() => { MINE.addSide = true; }); await p.setInputFiles('#fileSide', R('tools/fixtures/koto-right.png')); await p.waitForFunction(() => (window.SIDE_DONE || 0) >= 2, null, { timeout: 120000 }); await p.waitForTimeout(400); // and his other side
  const sides = await p.evaluate(() => MINE.sideFit.panels.map(q => q.facing + (q.east ? '/east' : '/west')).join(' ')); console.log('side views:', sides); if (!/east/.test(sides) || !/west/.test(sides)) errs.push('both sides not covered: ' + sides);
  await shot('two-west', -Math.PI / 2); await shot('two-east', Math.PI / 2);
  const dir = R('papercraft/shots/export-views'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const kind of ['model', 'png', 'json']) { await p.click('#save'); await p.waitForTimeout(200); const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`[data-save=${kind}]`)]); await d.saveAs(path.join(dir, d.suggestedFilename())); }
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN mirrored, guessed and fitted backs'); process.exit(errs.length ? 1 : 0);
})();
