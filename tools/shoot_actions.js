// Phone-sized check of the rig as a skeleton you move like Lego: Koto (front, back and side views) in Pose. The see-through skeleton is drawn
// over him (bones from joint to joint, out to the hands, feet and crown); a bone dragged turns its own part; Walk, Jump and Swing play as
// motions that make sense (the jump leaves the ground and comes back, its knees bend in the crouch; the swing winds up, strikes, recovers),
// and the saved model carries all five animations. Run: node tools/shoot_actions.js -> papercraft/shots/action-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), fs = require('fs'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [], bad = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.setInputFiles('#fileBack', R('tools/fixtures/koto-back.png')); await p.waitForFunction(() => (window.BACK_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.click('#tPose'); await p.click('[data-anim=still]'); await p.waitForTimeout(1200);
  const bones = await p.evaluate(() => BONES.length); console.log('skeleton:', bones, 'bones'); if (bones < 13) bad('skeleton has ' + bones + ' bones');
  await p.screenshot({ path: R('papercraft/shots/action-skeleton.png') });
  // drag the right forearm's bone: it turns, nothing else does
  const fr = await p.evaluate(() => { const k = MINE.geo.findIndex(g => g.name === 'foreR'), q = BONES.find(z => z[2] === k); return [(q[0][0] + q[1][0]) / 2, (q[0][1] + q[1][1]) / 2]; });
  await p.mouse.move(fr[0], fr[1]); await p.mouse.down(); await p.mouse.move(fr[0] + 40, fr[1] - 30, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(300);
  const pose = await p.evaluate(() => ST.pose); console.log('dragged bone:', JSON.stringify(pose)); if (!(Math.abs(pose.foreR || 0) > 0.2) || Object.keys(pose).length !== 1) bad('dragging the forearm bone did not turn just the forearm');
  await p.screenshot({ path: R('papercraft/shots/action-posed.png') }); await p.click('#reset');
  // the motions, as numbers: poseNow over one loop
  const m = await p.evaluate(() => { const hh = MINE.fold.hh, run = (an, L) => { const s = []; for (let i = 0; i < 48; i++) { const t = i / 48 * L, { A, bob } = poseNow(t, an); s.push({ t, bob: bob / hh, shin: A.shinL ? A.shinL.ph : 0, arm: A.armR ? A.armR.th : 0, armPh: A.armR ? A.armR.ph : 0 }); } return s; };
    return { jump: run('jump', LOOP.jump), swing: run('swing', LOOP.swing), walk: run('walk', LOOP.walk), loops: [poseNow(0, 'jump').bob - poseNow(LOOP.jump, 'jump').bob, poseNow(0, 'swing').A.armR.th - poseNow(LOOP.swing, 'swing').A.armR.th] }; });
  const J = m.jump, top = Math.max(...J.map(q => q.bob)), low = Math.min(...J.map(q => q.bob)), crouchKnee = Math.min(...J.filter(q => q.bob < -0.03).map(q => q.shin)), up = J.find(q => q.bob === top);
  console.log('jump: highest', top.toFixed(2), 'of his height, crouch', low.toFixed(2), ', knees in the crouch', crouchKnee.toFixed(2), ', arms in the air', up.arm.toFixed(2));
  if (!(top > 0.25)) bad('jump does not leave the ground'); if (!(low < -0.04)) bad('no crouch before the jump'); if (!(crouchKnee < -0.6)) bad('knees do not bend in the crouch'); if (Math.abs(J[0].bob) > 1e-6) bad('jump does not start on the ground');
  const S = m.swing, peak = Math.max(...S.map(q => q.arm)), strike = S.reduce((a, q) => q.armPh > a.armPh ? q : a), wind = S.find(q => q.arm === peak);
  console.log('swing: arm raised to', peak.toFixed(2), 'at', wind.t.toFixed(2), 's, struck forward', strike.armPh.toFixed(2), 'at', strike.t.toFixed(2), 's');
  if (!(peak > 1.5)) bad('swing does not wind up'); if (!(strike.t > wind.t)) bad('swing strikes before it winds up'); if (!(strike.armPh > 0.5)) bad('swing does not come forward');
  if (Math.abs(m.loops[0]) > 1e-6 || Math.abs(m.loops[1]) > 1e-6) bad('jump or swing does not loop seamlessly');
  // screenshots through each motion
  for (const an of ['walk', 'jump', 'swing']) { await p.click(`[data-anim=${an}]`); await p.evaluate(() => { cam.to = null; cam.yaw = 0.7; cam.pitch = 0.12; }); for (let i = 0; i < 4; i++) { await p.waitForTimeout(260); await p.screenshot({ path: R(`papercraft/shots/action-${an}${i}.png`) }); } }
  // saved model: five animations
  const dir = R('papercraft/shots/export-actions'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const kind of ['model', 'png', 'json']) { await p.click('#save'); await p.waitForTimeout(200); const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`[data-save=${kind}]`)]); await d.saveAs(path.join(dir, d.suggestedFilename())); }
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN a skeleton you can grab, walk, jump and swing, saved'); process.exit(errs.length ? 1 : 0);
})();
