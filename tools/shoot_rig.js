// Phone-sized check of the rig in papercraft/sprite-viewer.html: choose a character, open Pose, and shoot Idle, Walk (a strip of frames from
// three-quarter view), Wave, and a pose made by dragging an arm. RED on any page error or a character that is not rigged.
// Run: node tools/shoot_rig.js -> papercraft/shots/rig-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  for (const [name, file] of [['starter', 'art-source/characters/starter_front.png'], ['girl', 'art-source/characters/girl_front.png']]) {
    await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
    await p.setInputFiles('#file', R(file)); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 }); await p.waitForTimeout(600);
    const rig = await p.evaluate(() => MINE.rig.humanoid ? MINE.rig.parts.map(q => q.name).join(' ') : 'one piece'); console.log(name, 'rig:', rig); if (!/legR/.test(rig)) errs.push(name + ' not rigged');
    await p.click('#tPose'); await p.waitForTimeout(1200); await p.screenshot({ path: R(`papercraft/shots/rig-${name}-pose.png`) });
    await p.click('[data-anim=walk]'); await p.waitForTimeout(1500); for (let i = 0; i < 4; i++) { await p.screenshot({ path: R(`papercraft/shots/rig-${name}-walk${i}.png`) }); await p.waitForTimeout(220); }
    await p.click('[data-anim=wave]'); await p.evaluate(() => { cam.to = { yaw: 0.25, pitch: 0.12 }; }); await p.waitForTimeout(1300); await p.screenshot({ path: R(`papercraft/shots/rig-${name}-wave.png`) });
    await p.click('[data-anim=still]'); await p.evaluate(() => { cam.to = { yaw: 0, pitch: 0.12 }; }); await p.waitForTimeout(1200);
    const [x0, y0] = await p.evaluate(() => { const G = MINE.geo.find(g => g.name === 'armL'), o = MINE.geo.slice(0, MINE.geo.indexOf(G)).reduce((n, g) => n + g.n, 0) * 7; const zs = []; for (let i = 0; i < G.n; i++) zs.push(MINE.dyn[o + i * 7 + 2]); zs.sort((a, b) => a - b); const zlo = zs[zs.length * 0.3 | 0], zhi = zs[zs.length * 0.6 | 0]; let best = 0, by = -1e9; for (let i = 0; i < G.n; i++) { const x = MINE.dyn[o + i * 7], z = MINE.dyn[o + i * 7 + 2]; if (z >= zlo && z <= zhi && -x > by) { by = -x; best = i; } } /* the outer edge of the upper arm */ return toScreen([MINE.dyn[o + best * 7], MINE.dyn[o + best * 7 + 1], MINE.dyn[o + best * 7 + 2]]); });
    await p.mouse.move(x0, y0 - 4); await p.mouse.down(); for (let k = 1; k <= 10; k++) await p.mouse.move(x0 - k * 9, y0 - 4 - k * 12); await p.mouse.up(); await p.waitForTimeout(400);
    const posed = await p.evaluate(() => ST.pose.armL || 0); console.log(name, 'arm posed by', posed.toFixed(2), 'rad'); if (Math.abs(posed) < 0.3) errs.push(name + ' arm did not pose');
    await p.screenshot({ path: R(`papercraft/shots/rig-${name}-posed.png`) });
  }
  { // Edit joints: move the left elbow down a little, and give the side-view child (no rig found) a rig by hand
    await p.click('[data-anim=still]'); await p.click('#editJ'); await p.waitForTimeout(1200); await p.screenshot({ path: R('papercraft/shots/rig-joints-edit.png') });
    const before = await p.evaluate(() => MINE.rig.parts.find(q => q.name === 'foreL').pivot.slice()), dot = await p.$('.joint.edit.foreL'), bb = await dot.boundingBox();
    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); for (let k = 1; k <= 6; k++) await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + k * 4); await p.mouse.up();
    await p.waitForFunction(() => (window.JOINT_MOVED || 0) >= 1, null, { timeout: 30000 }); await p.waitForTimeout(500);
    const after = await p.evaluate(() => MINE.rig.parts.find(q => q.name === 'foreL').pivot.slice()); console.log('elbow moved from', before.map(v => v.toFixed(1)).join(','), 'to', after.map(v => v.toFixed(1)).join(','));
    if (!(after[1] > before[1] + 2)) errs.push('elbow did not move'); await p.screenshot({ path: R('papercraft/shots/rig-joints-moved.png') }); await p.click('#editJ'); await p.waitForTimeout(300);
    await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
    await p.setInputFiles('#file', R('art-source/characters/child_side.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 }); await p.waitForTimeout(500);
    const was = await p.evaluate(() => MINE.rig.humanoid); await p.click('#tPose'); await p.click('#editJ'); await p.waitForTimeout(800); const now = await p.evaluate(() => MINE.rig.humanoid && MINE.rig.parts.length);
    console.log('side-view child: rig found', was, '-> after Edit joints', now, 'parts'); if (!now) errs.push('Edit joints did not make a rig'); await p.screenshot({ path: R('papercraft/shots/rig-joints-forced.png') }); await p.click('#editJ'); }
  { const fs = require('fs'), dir = R('papercraft/shots/export-rig'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); // save the rigged model of the last character
    await p.click('#reset'); for (const kind of ['model', 'png', 'json']) { await p.click('#save'); await p.waitForTimeout(200); const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`[data-save=${kind}]`)]); await d.saveAs(path.join(dir, d.suggestedFilename())); console.log('saved', d.suggestedFilename()); } }
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN rigged, animated and posed'); process.exit(errs.length ? 1 : 0);
})();
