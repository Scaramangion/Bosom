// Phone-sized check of props in papercraft/sprite-viewer.html: Koto with the built-in low-poly sword and with the sword cut from his own character
// sheet (tools/fixtures/prop-sword.png, read by paperProp: tip, guard and grip found by itself). Draw must keep the sword on his back, meet his
// hand at the grip (the hand-over), slide it out along the sheath's line before it turns, hold it up in a guard, and put it back, with no
// jumps (the grip's path never kicks by more than a twentieth of his torso in one frame). The body brush (Edit joints > Body) keeps his cape with his body.
// The motion is sampled with the clock held and the physics stepped by hand, so the numbers repeat. Run: node tools/shoot_props.js
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [], bad = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.setInputFiles('#fileBack', R('tools/fixtures/koto-back.png')); await p.waitForFunction(() => (window.BACK_DONE || 0) >= 1, null, { timeout: 120000 });
  // the body brush: brush over his cape (the red at the sides), and the arms let go of it
  await p.click('#tPose'); await p.click('[data-anim=still]'); await p.click('#editJ'); await p.waitForTimeout(800); await p.click('#bodyBtn');
  const armBefore = await p.evaluate(() => MINE.rig.parts.filter(q => /^(arm|fore)/.test(q.name)).reduce((n, q) => n + q.mask.reduce((a, v) => a + v, 0), 0));
  for (const [u0, v0, u1, v1] of [[0.08, 0.42, 0.14, 0.75], [0.92, 0.42, 0.86, 0.75]]) { const a = await p.evaluate(([u, v]) => screenOf(u, v), [u0, v0]), z = await p.evaluate(([u, v]) => screenOf(u, v), [u1, v1]);
    await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.move(z[0], z[1], { steps: 10 }); await p.mouse.up(); }
  await p.waitForFunction(() => (window.BODY_PAINTED || 0) >= 2); await p.screenshot({ path: R('papercraft/shots/props-body-brush.png') });
  const armAfter = await p.evaluate(() => MINE.rig.parts.filter(q => /^(arm|fore)/.test(q.name)).reduce((n, q) => n + q.mask.reduce((a, v) => a + v, 0), 0)), brushed = await p.evaluate(() => MINE.body.reduce((a, v) => a + v, 0));
  console.log('body brush:', brushed, 'pixels kept with the body; the arms went from', armBefore, 'to', armAfter, 'pixels'); if (!brushed || !(armAfter < armBefore)) bad('the body brush did not take the cape from the arms');
  await p.click('#bodyBtn'); await p.click('#editJ');
  // the sword cut from his sheet: paperProp finds its ends
  await p.click('#tViews'); await p.setInputFiles('#fileProp', R('tools/fixtures/prop-sword.png')); await p.waitForFunction(() => (window.PROP_READY || 0) >= 1, null, { timeout: 60000 });
  const info = await p.evaluate(() => ({ ...MINE.prop.info, tris: MINE.prop.rest.length / 21 })); console.log('picture sword: grip', info.grip.map(Math.round), 'tip', info.tip.map(Math.round), 'guard', info.guard.map(Math.round), '|', info.tris, 'triangles');
  if (!(info.tip[1] > info.grip[1] && info.tip[0] < info.grip[0])) bad('the tip should be at the bottom left of the sheet\'s sword'); if (!(info.tris > 10)) bad('the picture sword did not fold');
  // the draw, sampled
  await p.click('#tPose'); await p.click('[data-anim=draw]'); await p.evaluate(() => { window.PH_MANUAL = true; });
  const run = await p.evaluate(() => { const L = LOOP.draw, S = MINE.propSock, T = S.T, base = 100 * L, out = { jump: 0, at: 0 }; let prev = null, pprev = null; const samples = {};
    for (let i = 0; i <= Math.round(L * 60); i++) { const t = base + i / 60; stepPhysics(t, 1 / 60); const F = frames(t); propPose(t, F); const d = MINE.prop.dyn, grip = [0, 1, 2].map(c => d[c]); // the first vertex sits at the grip end; track the grip itself instead:
      const A = sockWorld(S.back, F), H = sockWorld(S.hand, F), [wp] = propHeld(t), g = A.o.map((c, k) => c + (H.o[k] - c) * wp); if (prev && pprev) { const j = Math.hypot(...g.map((c, k) => c - 2 * prev[k] + pprev[k])); if (j > out.jump) { out.jump = j; out.at = i / 60 / L; } } pprev = prev; prev = g; // a jump is a kick in the grip's path (its second difference), not its speed
      const u = Math.round(i / 60 / L * 100); if ([5, 22, 25, 50].includes(u) && !samples[u]) { let zmin = 1e9, zmax = -1e9; for (let k = 2; k < d.length; k += 7) { zmin = Math.min(zmin, d[k]); zmax = Math.max(zmax, d[k]); } const Fp = frames(t, poseNow(t, 'draw')), pure = [sockWorld(S.hand, Fp).o, sockWorld(S.back, Fp).o]; samples[u] = { grip: g, hand: H.o, sheath: A.o, held: wp, zmin, zmax, torsoBack: F[0].v[1], pure }; } }
    out.T = T; out.samples = samples; return out; });
  const s5 = run.samples[5], s22 = run.samples[22], s25 = run.samples[25], s50 = run.samples[50], T = run.T, gap = q => Math.hypot(...q.hand.map((c, k) => c - q.sheath[k])) / T, pureGap = Math.hypot(...s22.pure[0].map((c, k) => c - s22.pure[1][k])) / T;
  console.log('hand-over: the motion itself puts the hand', pureGap.toFixed(3), 'torsos from the grip; live (springs trailing) at 22%', gap(s22).toFixed(2), 'and at 25%', gap(s25).toFixed(2));
  console.log('on the back (5%): held', s5.held.toFixed(2), '| hand-over (22%): hand to sheathed grip', (Math.hypot(...s22.hand.map((c, k) => c - s22.sheath[k])) / T).toFixed(2), 'torsos | guard (50%): held', s50.held.toFixed(2), ', blade from', s50.zmin.toFixed(1), 'to', s50.zmax.toFixed(1), '| largest kick in the grip\'s path', (run.jump / T).toFixed(3), 'torsos at', (run.at * 100).toFixed(0) + '%');
  if (s5.held !== 0) bad('the sword is not on his back at the start'); if (pureGap > 0.02 || gap(s25) > 0.12) bad('the hand does not meet the grip');
  if (s50.held !== 1 || !(s50.zmax - s50.zmin > 0.8 * T)) bad('no guard with the sword up'); if (run.jump > 0.05 * T) bad('the sword jumps');
  for (const [nm, u, yaw] of [['back', 0.05, 2.3], ['grip', 0.24, 2.3], ['slide', 0.3, 2.3], ['out', 0.38, 2.0], ['guard', 0.5, 0.7], ['sheathe', 0.72, 2.3]]) {
    await p.evaluate(([u, yaw]) => { const t = 100 * LOOP.draw + u * LOOP.draw; window.FREEZE_T = t; for (let j = 0; j < 90; j++) stepPhysics(t, 1 / 60); cam.to = null; cam.yaw = yaw; cam.pitch = 0.18; cam.zoom = radius * 1.0; }, [u, yaw]);
    await p.waitForTimeout(450); await p.screenshot({ path: R(`papercraft/shots/props-${nm}.png`) }); }
  // the built-in sword swaps in
  await p.evaluate(() => { window.FREEZE_T = null; window.PH_MANUAL = false; }); await p.click('#tViews'); await p.click('[data-prop=sword]'); await p.waitForFunction(() => (window.PROP_READY || 0) >= 2);
  const sw = await p.evaluate(() => [MINE.prop.kind, MINE.prop.rest.length / 21]); console.log('built-in sword:', sw[1], 'triangles'); if (sw[0] !== 'sword' || sw[1] < 40) bad('the built-in sword is missing');
  await p.click('#tPose'); await p.click('[data-anim=draw]'); await p.evaluate(() => { window.PH_MANUAL = true; const t = 100 * LOOP.draw + 0.5 * LOOP.draw; window.FREEZE_T = t; for (let j = 0; j < 90; j++) stepPhysics(t, 1 / 60); cam.to = null; cam.yaw = 0.7; cam.pitch = 0.18; cam.zoom = radius * 1.0; });
  await p.waitForTimeout(450); await p.screenshot({ path: R('papercraft/shots/props-builtin-guard.png') });
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN the body brush, a sword from a picture and the built-in one, drawn from the back, held, and put back without a jump'); process.exit(errs.length ? 1 : 0);
})();
