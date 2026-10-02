// Phone-sized check of a figure drawn in a T-pose (tools/fixtures/tpose.png, an original test figure: big head, arms straight out, a tunic
// that flares below the belt) and of getting unstuck. The rig must give the arms to the arms (not to the torso), the torso must stay the
// base (a drag along the spine turns the view, it does not swing the body like a limb), a motion chosen in Edit joints ends Edit joints,
// the 3D view must come back after the phone takes the graphics away (a lost WebGL context), and tapping the Papercraft wordmark must
// bring back the start page from anywhere. Run: node tools/shoot_tpose.js -> papercraft/shots/tpose-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [], bad = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/tpose.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  // the arms belong to the arms: pixels well outside the body's width, in the arm band, are arm or forearm
  const arms = await p.evaluate(() => { const R = MINE.rig, w = MINE.w, by = n => R.parts.find(q => q.name === n), cx = R.cx, tor = by('torso'); let out = 0, limb = 0;
    for (let i = 0; i < w * MINE.h; i++) { if (MINE.px[i * 4 + 3] < 128) continue; const x = i % w, y = (i / w) | 0; if (y > R.hip || Math.abs(x - cx) < Math.max(...R.core) + 4 || y <= R.neck) continue; out++; if (['armL', 'armR', 'foreL', 'foreR'].some(n => by(n) && by(n).mask[i])) limb++; }
    return { share: limb / (out || 1), core: R.core.map(v => Math.round(v)), humanoid: R.humanoid }; });
  console.log('T-pose: body half-widths', arms.core, '| arm pixels given to the arms', (arms.share * 100).toFixed(0) + '%'); if (!arms.humanoid || arms.share < 0.9) bad('the arms were given to the torso');
  await p.click('#tPose'); await p.click('[data-anim=still]'); await p.waitForTimeout(1200); await p.screenshot({ path: R('papercraft/shots/tpose-rig.png') });
  // the torso is the base: a drag along the spine does not pose it
  const sp = await p.evaluate(() => { const q = BONES.find(z => MINE.geo[z[2]] && MINE.geo[z[2]].parent < 0) || BONES[0]; return [(q[0][0] * 0.3 + q[1][0] * 0.7), (q[0][1] * 0.3 + q[1][1] * 0.7)]; });
  await p.mouse.move(sp[0], sp[1]); await p.mouse.down(); await p.mouse.move(sp[0] + 60, sp[1] + 10, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(200);
  const pose = await p.evaluate(() => ST.pose); if (pose.torso) bad('the torso was swung like a limb'); console.log('drag along the spine: pose', JSON.stringify(pose));
  // the motions, from a T-pose (arms come down for walking)
  for (const an of ['walk', 'wave', 'jump', 'swing']) { await p.click(`[data-anim=${an}]`); await p.evaluate(() => { cam.to = null; cam.yaw = 0.35; cam.pitch = 0.12; cam.zoom = 0; }); await p.waitForTimeout(450); await p.screenshot({ path: R(`papercraft/shots/tpose-${an}.png`) }); }
  // a motion chosen in Edit joints ends Edit joints
  await p.click('#editJ'); await p.waitForTimeout(300); await p.click('[data-anim=walk]'); const ej = await p.evaluate(() => [ST.editJ, ST.anim]); if (ej[0] || ej[1] !== 'walk') bad('Walk in Edit joints left it on: ' + ej);
  // the phone takes the graphics away, then gives them back: the figure comes back
  await p.evaluate(() => { const x = gl.getExtension('WEBGL_lose_context'); window.__lc = x; x.loseContext(); }); await p.waitForTimeout(400);
  await p.evaluate(() => window.__lc.restoreContext()); await p.waitForFunction(() => (window.GL_RESTORED || 0) >= 1, null, { timeout: 10000 }).catch(() => bad('the 3D view did not come back'));
  await p.waitForTimeout(500); await p.screenshot({ path: R('papercraft/shots/tpose-restored.png') });
  const painted = await p.evaluate(() => { const px = new Uint8Array(4 * 40 * 40); gl.readPixels((gl.drawingBufferWidth >> 1) - 20, (gl.drawingBufferHeight >> 1) - 20, 40, 40, gl.RGBA, gl.UNSIGNED_BYTE, px); const c = new Set(); for (let i = 0; i < px.length; i += 4) c.add(px[i] >> 4 << 8 | px[i + 1] >> 4 << 4 | px[i + 2] >> 4); return c.size; });
  console.log('after the graphics came back:', painted, 'colours in the middle of the view'); if (painted < 4) bad('the view stayed blank after the graphics came back');
  // the wordmark goes home from anywhere: from a sheet, mid-pose
  await p.click('#more'); await p.waitForTimeout(200); await p.click('#home'); await p.waitForTimeout(600);
  const home = await p.evaluate(() => [ST.mode, !!MINE.img, $('hello').hidden, $('sheet').hidden, $('tPose').disabled, window.HOME]); console.log('home:', JSON.stringify(home));
  if (await p.evaluate(() => $('skel').innerHTML.length + $('joints').innerHTML.length)) bad('the skeleton stayed on the start page'); if (home[0] !== 'start' || home[1] || home[2] || !home[3] || !home[4]) bad('the wordmark did not bring back the start page');
  await p.screenshot({ path: R('papercraft/shots/tpose-home.png') });
  await p.setInputFiles('#file', R('tools/fixtures/tpose.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 2, null, { timeout: 120000 }); if (!(await p.evaluate(() => MINE.rig && MINE.rig.humanoid))) bad('a new picture after Home did not rig');
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN T-pose rigged, torso stays the base, graphics recover, Papercraft goes home'); process.exit(errs.length ? 1 : 0);
})();
