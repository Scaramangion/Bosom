// Phone-sized check of the rig's physics in papercraft/sprite-viewer.html. Run: a longer stride, high knees, pumping arms, the body leaning in;
// motions blend (no snapping from one to the next); the T-pose figure in Ragdoll lets its arms fall under gravity, can be picked up by the body
// (limbs swing behind, the body leans against the motion) and dropped (it falls back to the floor and settles), all within the skeleton's
// joint limits and with no NaN. The physics is stepped by hand here (60 steps a second), so the numbers are the same on every run.
// Run: node tools/shoot_ragdoll.js -> papercraft/shots/rag-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [], bad = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.click('#tPose'); await p.click('[data-anim=still]'); await p.waitForTimeout(600);
  // the run, as numbers (the exact motion the saved model carries)
  const run = await p.evaluate(() => { const s = (an, L) => { let lean = 0, leg = 0, knee = 0; for (let i = 0; i < 40; i++) { const { A } = poseNow(i / 40 * L, an); lean += A.torso.ph / 40; leg = Math.max(leg, Math.abs(A.legL.ph + A.torso.ph)); knee = Math.min(knee, A.shinL.ph); } return { lean, leg, knee }; };
    const a = poseNow(0, 'run'), z = poseNow(LOOP.run, 'run'); return { run: s('run', LOOP.run), walk: s('walk', LOOP.walk), loops: Math.max(...Object.keys(a.A).map(k => Math.abs(a.A[k].th - z.A[k].th) + Math.abs(a.A[k].ph - z.A[k].ph))) }; });
  console.log('run: lean', run.run.lean.toFixed(2), '| stride', run.run.leg.toFixed(2), 'vs walk', run.walk.leg.toFixed(2), '| knee up to', run.run.knee.toFixed(2), '| loop seam', run.loops.toExponential(1));
  if (!(run.run.lean < -0.15)) bad('the run does not lean in'); if (!(run.run.leg > run.walk.leg * 1.4)) bad('the run strides no longer than the walk'); if (!(run.run.knee < -1.2)) bad('no high knees'); if (run.loops > 1e-6) bad('the run does not loop');
  // blending: from Still to Run and back, stepped by hand: no part jumps
  await p.evaluate(() => { window.PH_MANUAL = true; }); await p.click('[data-anim=run]');
  const blend = await p.evaluate(() => { let worst = 0, t = performance.now() / 1000, prev = null; for (let i = 0; i < 90; i++) { if (i === 45) ST.anim = 'still'; t += 1 / 60; stepPhysics(t, 1 / 60);
      const cur = JSON.parse(JSON.stringify(PH.A)); if (prev) for (const k in cur) worst = Math.max(worst, Math.abs(cur[k].th - prev[k].th), Math.abs(cur[k].ph - prev[k].ph)); prev = cur; } return worst; });
  console.log('blending Still -> Run -> Still: the largest change in one frame', blend.toFixed(3), 'rad'); if (!(blend < 0.25)) bad('a part snaps between motions');
  await p.evaluate(() => { window.PH_MANUAL = false; }); await p.click('[data-anim=run]'); await p.evaluate(() => { cam.to = null; cam.yaw = 1.2; cam.pitch = 0.1; });
  for (let i = 0; i < 3; i++) { await p.waitForTimeout(220); await p.screenshot({ path: R(`papercraft/shots/rag-run${i}.png`) }); }
  // Ragdoll on the T-pose figure: its arms fall
  await p.setInputFiles('#file', R('tools/fixtures/tpose.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 2, null, { timeout: 120000 }); await p.click('#tPose'); await p.click('[data-anim=still]'); await p.waitForTimeout(400);
  await p.evaluate(() => { window.PH_MANUAL = true; let t = performance.now() / 1000; for (let i = 0; i < 120; i++) { t += 1 / 60; stepPhysics(t, 1 / 60); } }); await p.click('#ragBtn'); // settled in its drawn pose first
  const armAngle = () => p.evaluate(() => { const G = MINE.geo, F = frames(performance.now() / 1000), k = G.findIndex(g => g.name === 'armL'), e = G.findIndex(g => g.name === 'foreL'), at = (f, q) => [0, 2].map(i => F[f].M[i * 3] * q[0] + F[f].M[i * 3 + 1] * q[1] + F[f].M[i * 3 + 2] * q[2] + F[f].v[i]); // shoulder to elbow
    const s = at(G[k].parent, G[k].pv), el = at(k, G[e].pv); return Math.abs(Math.atan2(el[0] - s[0], -(el[1] - s[1]))); });
  const a0 = await armAngle(); await p.evaluate(() => { let t = performance.now() / 1000; for (let i = 0; i < 150; i++) { t += 1 / 60; stepPhysics(t, 1 / 60); } }); const a1 = await armAngle();
  console.log('ragdoll: the left arm from', (a0 * 180 / Math.PI).toFixed(0) + '° to', (a1 * 180 / Math.PI).toFixed(0) + '° from hanging'); if (!(a1 < a0 - 0.6)) bad('the arms do not fall in Ragdoll');
  await p.evaluate(() => { window.PH_MANUAL = false; cam.to = null; cam.yaw = 0.3; cam.pitch = 0.1; }); await p.waitForTimeout(500); await p.screenshot({ path: R('papercraft/shots/rag-fallen.png') }); await p.evaluate(() => { window.PH_MANUAL = true; });
  // pick it up by the body, carry it sideways, let go
  const body = await p.evaluate(() => { const g = MINE.geo[0], F = frames(performance.now() / 1000), P = [g.pv[0] + F[0].v[0], g.pv[1] + F[0].v[1], g.pv[2] + F[0].v[2] + MINE.fold.hh * 0.18]; return toScreen(P); });
  await p.mouse.move(body[0], body[1]); await p.mouse.down(); const carried = await p.evaluate(() => !!PH.carry); if (!carried) bad('the body could not be picked up');
  let swing = 0, lean = 0, top = 0; for (let i = 1; i <= 12; i++) { await p.mouse.move(body[0] + i * 9, body[1] - i * 12);
    const st = await p.evaluate(() => { let t = performance.now() / 1000; for (let j = 0; j < 4; j++) { t += 1 / 60; stepPhysics(t, 1 / 60); } const k = MINE.geo.findIndex(g => g.name === 'armL'); return [Math.abs(PH.S[k].w), PH.S[0].th, PH.root.z]; }); swing = Math.max(swing, st[0]); lean = Math.max(lean, st[1]); top = Math.max(top, st[2]); }
  await p.evaluate(() => { window.PH_MANUAL = false; }); await p.waitForTimeout(300); await p.screenshot({ path: R('papercraft/shots/rag-carried.png') }); await p.evaluate(() => { window.PH_MANUAL = true; });
  console.log('carried: lifted', top.toFixed(1), 'units, the arm swung at up to', swing.toFixed(1), 'rad/s, the body leaned', lean.toFixed(2), 'rad'); if (!(top > 3)) bad('it was not lifted'); if (!(swing > 0.5)) bad('the limbs did not swing'); if (!(lean > 0.05)) bad('the body did not lean against the motion');
  await p.mouse.up(); const dropped = await p.evaluate(() => { let t = performance.now() / 1000, z = []; for (let i = 0; i < 240; i++) { t += 1 / 60; stepPhysics(t, 1 / 60); if (i % 40 === 0) z.push(+PH.root.z.toFixed(2)); } return { z, end: PH.root.z, nan: PH.S.some(S => !isFinite(S.th) || !isFinite(S.w) || !isFinite(S.ph)) || !isFinite(PH.root.x),
    limits: PH.S.map((S, k) => { const L = LIMB[MINE.geo[k].name], lim = L && PAPER_SKELETON.LIMITS[L]; return !lim || (S.th >= lim.th[0] * Math.PI / 180 - 1e-6 && S.th <= lim.th[1] * Math.PI / 180 + 1e-6); }).every(Boolean) }; });
  console.log('dropped: height', dropped.z.join(' -> '), '-> rests at', dropped.end.toFixed(2), '| within joint limits:', dropped.limits, '| NaN:', dropped.nan);
  if (dropped.end > 0.01) bad('it did not come back to the floor'); if (!dropped.limits) bad('a joint went past its limits'); if (dropped.nan) bad('NaN in the physics');
  await p.evaluate(() => { window.PH_MANUAL = false; }); await p.waitForTimeout(400); await p.screenshot({ path: R('papercraft/shots/rag-dropped.png') });
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN run leans in, motions blend, the ragdoll falls, is carried, swings, drops and settles'); process.exit(errs.length ? 1 : 0);
})();
