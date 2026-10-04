// Phone-sized check of stacked motions and Gummi-style part swaps in papercraft/sprite-viewer.html, on Koto drawn in a T-pose with the built-in
// sword. A Move (Run) with an Act on top: Run + Draw (the legs run, the drawing arm draws), Run + Swing, Run + Jump (the jump's bounce on top of
// the run's); tapping the Act again stops it. Then Sudashorn's head (tools/fixtures/sud-stand.png, found by her own rig) snapped onto Koto's neck,
// as tall as his own head, his own head hidden, moving with his body; Own puts his back. Run: node tools/shoot_layers.js -> papercraft/shots/layers-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [], bad = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-tpose.jpg')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.click('#tViews'); await p.click('[data-prop=sword]'); await p.click('#tPose');
  const shot = async (n, yaw) => { await p.evaluate(y => { cam.to = null; cam.yaw = y; cam.pitch = 0.15; cam.zoom = radius * 1.05; }, yaw); await p.waitForTimeout(600); await p.screenshot({ path: R(`papercraft/shots/layers-${n}.png`) }); };
  await p.click('[data-anim=run]');
  for (const [act, yaw] of [['draw', 2.2], ['swing', 0.8], ['jump', 1.0]]) { await p.click(`[data-anim=${act}]`); const key = await p.evaluate(() => animKey()); if (key !== 'run+' + act) bad('stack is ' + key);
    const m = await p.evaluate(a => { const L = LOOP.run, sd = MINE.prop && MINE.prop.side === 'L' ? 'L' : 'R', out = { legRun: 0, armAct: 0, bob: 0 }; // the legs follow the run, the act's arm follows the act
      for (let i = 0; i < 24; i++) { const t = 50 + i / 24 * L * 2, P = poseNow(t, 'run+' + a), Rn = poseNow(t, 'run'), X = poseNow(t, a), arm = a === 'jump' ? 'armL' : 'arm' + sd;
        out.legRun = Math.max(out.legRun, Math.abs(P.A.legL.ph - Rn.A.legL.ph - (a === 'jump' ? X.A.legL.ph - poseNow(t, 'still').A.legL.ph : 0))); out.armAct = Math.max(out.armAct, Math.abs(P.A[arm].th - X.A[arm].th) + Math.abs(P.A[arm].ph - X.A[arm].ph));
        if (a === 'jump') out.bob = Math.max(out.bob, Math.abs(P.bob - (Rn.bob + X.bob - poseNow(t, 'still').bob))); } return out; }, act);
    console.log(`run + ${act}: legs off the run by ${m.legRun.toFixed(4)}, the act's arm off the act by ${m.armAct.toFixed(4)}${act === 'jump' ? ', bounce off run + jump by ' + m.bob.toFixed(4) : ''}`);
    if (m.legRun > 1e-6 || m.armAct > 1e-6 || m.bob > 1e-6) bad('run + ' + act + ' does not stack');
    await shot('run-' + act, yaw); await p.click(`[data-anim=${act}]`); } // tap again: the act stops
  if (await p.evaluate(() => animKey()) !== 'run') bad('tapping the act again did not stop it');
  // a head from another picture, the Gummi Ship way
  await p.click('#tViews'); await p.setInputFiles('#fileHead', R('tools/fixtures/sud-stand.png')); await p.waitForFunction(() => (window.MODULE_READY || 0) >= 1, null, { timeout: 60000 });
  const mod = await p.evaluate(() => { const m = MINE.mods.head, G = MINE.geo, k = m.part, F = frames(performance.now() / 1000); applyPose(performance.now() / 1000); let o = 0; for (let j = 0; j < k; j++) o += G[j].n * 7;
    const d = MINE.dyn, first = [d[o], d[o + 1], d[o + 2]]; let flat = true; for (let i = 0; i < G[k].n; i++) if (Math.abs(d[o + i * 7] - first[0]) + Math.abs(d[o + i * 7 + 2] - first[2]) > 1e-6) { flat = false; break; }
    let zmin = 1e9, zmax = -1e9; for (let i = 2; i < m.rest.length; i += 7) { zmin = Math.min(zmin, m.rest[i]); zmax = Math.max(zmax, m.rest[i]); } return { tris: m.rest.length / 21, hidden: flat, height: zmax - zmin, own: G[k].pv }; });
  console.log('head swap: Sudashorn\'s head', mod.tris, 'triangles,', mod.height.toFixed(1), 'tall | Koto\'s own head hidden:', mod.hidden); if (!mod.tris || !mod.hidden) bad('the head swap did not take');
  await p.click('#tPose'); await p.click('[data-anim=still]'); await p.click('[data-anim=still]'); await shot('head-swap', 0.5); await p.click('[data-anim=walk]'); await shot('head-swap-walk', 0.9);
  await p.click('#tViews'); await p.click('[data-head=own]'); const back = await p.evaluate(() => !MINE.mods); if (!back) bad('Own did not put his head back');
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN run + draw / swing / jump stack, a head swapped in from another picture and back'); process.exit(errs.length ? 1 : 0);
})();
