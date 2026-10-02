// Phone-sized check of the proportional skeleton in papercraft/sprite-viewer.html: Koto in Edit joints shows how each joint is known (filled:
// placed by you, ringed: seen in the picture, dashed: estimated) and his proportions in torso heights; moving his right knee makes just that
// joint USER_CONFIRMED; the skeleton (15 joints, prime IDs, bones, ratios) is saved in the Papercraft file and in the .glb (scene extras), and
// reopening the file keeps the knee yours. Run: node tools/shoot_skeleton.js -> papercraft/shots/skeleton-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), fs = require('fs'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [], bad = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.click('#tPose'); await p.click('[data-anim=still]'); await p.click('#editJ'); await p.waitForTimeout(1200);
  const ev0 = await p.evaluate(() => Object.fromEntries(MINE.skel.joints.map(j => [j.name, j.evidence]))), hint = await p.evaluate(() => $('poseHint').textContent);
  const kinds = await p.evaluate(() => [...document.querySelectorAll('.joint.edit')].map(d => d.className.split(' ').find(c => c.startsWith('ev-')))); console.log('edit joints:', hint); console.log('dots:', kinds.join(' '));
  if (kinds.some(k => !k)) bad('a joint dot without its evidence'); if (!/torsos/.test(hint)) bad('no proportions in the hint');
  await p.screenshot({ path: R('papercraft/shots/skeleton-edit.png') });
  const knee = await p.evaluate(() => JOINT_AT.find(q => q[0] === 'shinL')[1]); await p.mouse.move(knee[0], knee[1]); await p.mouse.down(); await p.mouse.move(knee[0] + 2, knee[1] - 14, { steps: 5 }); await p.mouse.up();
  await p.waitForFunction(() => (window.JOINT_MOVED || 0) >= 1); await p.waitForTimeout(400);
  const ev1 = await p.evaluate(() => Object.fromEntries(MINE.skel.joints.map(j => [j.name, j.evidence]))), conf = await p.evaluate(() => MINE.confirmed);
  console.log('after moving the knee: KNEE_R', ev0.KNEE_R, '->', ev1.KNEE_R, '| KNEE_L', ev1.KNEE_L, '| confirmed', JSON.stringify(conf));
  if (ev1.KNEE_R !== 'USER_CONFIRMED' || ev1.KNEE_L === 'USER_CONFIRMED' || Object.values(ev1).filter(v => v === 'USER_CONFIRMED').length !== 1) bad('only the moved knee should be yours');
  await p.screenshot({ path: R('papercraft/shots/skeleton-knee.png') });
  const dir = R('papercraft/shots/export-skeleton'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await p.click('#editJ'); for (const kind of ['model', 'png', 'json']) { await p.click('#save'); await p.waitForTimeout(200); const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`[data-save=${kind}]`)]); await d.saveAs(path.join(dir, d.suggestedFilename())); }
  const jf = fs.readdirSync(dir).find(f => f.endsWith('.json')), rec = JSON.parse(fs.readFileSync(path.join(dir, jf), 'utf8'));
  if (!rec.skeleton || rec.skeleton.joints.length !== 15 || !rec.skeleton.bones.length) bad('the file has no skeleton'); else console.log('file: skeleton with', rec.skeleton.joints.length, 'joints,', rec.skeleton.bones.length, 'bones, profile', JSON.stringify(rec.skeleton.profile));
  const zip = fs.readFileSync(path.join(dir, fs.readdirSync(dir).find(f => f.endsWith('.zip')))), g0 = zip.indexOf(Buffer.from('glTF')), jl = zip.readUInt32LE(g0 + 12), gj = JSON.parse(zip.slice(g0 + 20, g0 + 20 + jl).toString());
  const ex = gj.scenes[0].extras && gj.scenes[0].extras.papercraftSkeleton; if (!ex || ex.joints.length !== 15) bad('the .glb has no skeleton'); else console.log('glb: scene extras carry the skeleton (', ex.joints.map(j => j.id).join(' '), ')');
  const c0 = await p.evaluate(() => window.CUT_DONE); await p.setInputFiles('#file', path.join(dir, jf)); await p.waitForFunction(n => window.CUT_DONE > n, c0, { timeout: 120000 }); await p.waitForTimeout(300);
  const back = await p.evaluate(() => MINE.skel.joints.find(j => j.name === 'KNEE_R').evidence); console.log('reopened: KNEE_R', back); if (back !== 'USER_CONFIRMED') bad('reopening lost the knee you placed');
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN evidence shown, a knee made yours, skeleton saved in the file and the model, kept on reopening'); process.exit(errs.length ? 1 : 0);
})();
