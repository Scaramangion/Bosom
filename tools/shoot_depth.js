// Phone-sized check of Depth in papercraft/sprite-viewer.html, with no neural network anywhere: Koto (front, back and side views) in Facets, then
// depth from the painting's colour regions (Planes); painted by hand (Near over his head, Far over his chest); a grey map uploaded (left near,
// right far); depth layers (his head tapped a layer forward); and an optional provider plugged in from outside (a toy one). Saves the Papercraft
// file and opens it again: the painted depth and the layers must come back. RED on page errors or a depth that did not move the right way.
// Run: node tools/shoot_depth.js -> papercraft/shots/depth-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), fs = require('fs'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [], bad = m => errs.push(m);
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.setInputFiles('#fileBack', R('tools/fixtures/koto-back.png')); await p.waitForFunction(() => (window.BACK_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.setInputFiles('#fileSide', R('tools/fixtures/koto-left.png')); await p.waitForFunction(() => (window.SIDE_DONE || 0) >= 1, null, { timeout: 120000 }); await p.waitForTimeout(300);
  const reach = () => p.evaluate(() => Object.fromEntries(MINE.geo.map(g => { let f = -1e9; for (let i = 0; i < g.V.length; i += 7) f = Math.max(f, g.V[i + 1]); return [g.name, +(f - g.pv[1]).toFixed(3)]; })));
  const frontAt = (nm, u0, u1, v0, v1) => p.evaluate(([nm, u0, u1, v0, v1]) => { const g = MINE.geo.find(q => q.name === nm), sc = MINE.fold.s, A = MINE.S.anchor; let t = 0, n = 0; // how far the part's front stands out over a patch of the picture
    for (let i = 0; i < g.V.length; i += 7) { const u = (g.V[i] / sc + A[0]) / MINE.w, v = (A[1] - g.V[i + 2] / sc) / MINE.h, y = g.V[i + 1] - g.pv[1]; if (u >= u0 && u <= u1 && v >= v0 && v <= v1 && y > 0) { t += y; n++; } } return n ? t / n : 0; }, [nm, u0, u1, v0, v1]);
  const shot = async (name, yaw = 0.6, pitch = 0.14) => { await p.evaluate(([y, q]) => { cam.zoom = 0; cam.to = null; cam.yaw = y; cam.pitch = q; }, [yaw, pitch]); await p.waitForTimeout(400); await p.screenshot({ path: R(`papercraft/shots/depth-${name}.png`) }); };
  await p.click('#tDepth'); await p.click('[data-shape=facets]'); await p.evaluate(() => document.querySelector('[data-budget="300"]').click()); await p.waitForTimeout(200);
  const r0 = await reach(), h0 = await frontAt('head', 0.35, 0.65, 0.1, 0.24), c0 = await frontAt('torso', 0.35, 0.65, 0.38, 0.52); await shot('shape');
  // Planes: the colour regions flatten into planes (the front's heights change, the parts stay whole)
  await p.click('[data-dsrc=planes]'); await p.waitForTimeout(300); const r1 = await reach(); await shot('planes');
  if (JSON.stringify(r1) === JSON.stringify(r0)) bad('planes changed nothing'); console.log('front reach: shape', r0.head, r0.torso, '| planes', r1.head, r1.torso);
  // Paint: Near over the head, Far over the chest (drags on the figure, seen from the front)
  await p.click('[data-dsrc=paint]'); await p.waitForTimeout(900); await shot('paint-start', 0, 0.06);
  const drag = async (pts, brush) => { await p.click(`[data-brush="${brush}"]`); const at = await p.evaluate(q => q.map(([u, v]) => screenOf(u, v)), pts); const n0 = await p.evaluate(() => window.PAINTED || 0); if (await p.evaluate(([x, y]) => document.elementFromPoint(x, y).tagName, at[0]) !== 'CANVAS') bad('the panel covers the figure where you paint');
    for (let pass = 0; pass < 3; pass++) { await p.mouse.move(at[0][0], at[0][1]); await p.mouse.down(); for (const [x, y] of at.slice(1)) await p.mouse.move(x, y, { steps: 6 }); await p.mouse.up(); }
    await p.waitForFunction(n => (window.PAINTED || 0) >= n + 3, n0); };
  await drag([[0.3, 0.1], [0.7, 0.1], [0.7, 0.15], [0.3, 0.15], [0.3, 0.2], [0.7, 0.2], [0.7, 0.25]], 255);
  await drag([[0.3, 0.38], [0.7, 0.38], [0.7, 0.43], [0.3, 0.43], [0.3, 0.48], [0.7, 0.48], [0.7, 0.53]], 0); await p.waitForTimeout(300); await p.screenshot({ path: R('papercraft/shots/depth-painting.png') });
  const h2 = await frontAt('head', 0.35, 0.65, 0.1, 0.24), c2 = await frontAt('torso', 0.35, 0.65, 0.38, 0.52), m = await p.evaluate(() => { const M = MINE.depthMap, w = MINE.w, h = MINE.h, avg = (u0, u1, v0, v1) => { let s = 0, n = 0; for (let y = Math.round(v0 * h); y < v1 * h; y++) for (let x = Math.round(u0 * w); x < u1 * w; x++) { s += M[y * w + x]; n++; } return s / n; }; return M ? [avg(0.4, 0.6, 0.14, 0.2), avg(0.4, 0.6, 0.42, 0.48)] : null; });
  console.log('painted map: head', m && m[0].toFixed(0), 'chest', m && m[1].toFixed(0), '| front over the face', h0.toFixed(2), '->', h2.toFixed(2), '| over the chest', c0.toFixed(2), '->', c2.toFixed(2));
  if (!m || !(m[0] > 180) || !(m[1] < 80)) bad('the brush did not paint near / far'); if (!(h2 > h0 * 1.2)) bad('head did not come forward'); if (!(c2 < c0 * 0.8)) bad('chest did not go back');
  await p.click('#tDepth'); await shot('painted'); await shot('painted-side', 1.45, 0.1); await p.click('#tDepth');
  // a grey map: white on the left, black on the right (the figure leans its left side toward you)
  await p.setInputFiles('#fileDepth', R('tools/fixtures/depth-ramp.png')); await p.waitForFunction(() => (window.DEPTH_DONE || 0) >= 1);
  const r3 = await reach(); console.log('map: front reach armL', r3.armL, 'armR', r3.armR); if (!(r3.armL > r3.armR)) bad('the grey map did not bring the white side forward');
  await p.click('#tDepth'); await shot('map', 0.25, 0.1); await p.click('#tDepth');
  // depth layers: on, then tap the head (it was layer 3: now 4, the foreground)
  await p.click('[data-dsrc=shape]'); await p.click('#layersBtn'); await p.waitForTimeout(300); const pv = () => p.evaluate(() => Object.fromEntries(MINE.geo.map(g => [g.name, +g.pv[1].toFixed(3)])));
  const L0 = await pv(); if (!(L0.head > L0.armL && L0.armL > L0.torso)) bad('layers: head, arms, body not in order ' + JSON.stringify(L0));
  await p.evaluate(() => { cam.zoom = 0; cam.to = null; cam.yaw = 0; cam.pitch = 0.06; }); await p.waitForTimeout(300); const hd = await p.evaluate(() => screenOf(0.5, 0.12)); await p.mouse.click(hd[0], hd[1]); await p.waitForFunction(() => (window.LAYERED || 0) >= 1);
  const L1 = await pv(); console.log('layers: head', L0.head, '->', L1.head, '| arms', L1.armL, '| body', L1.torso); if (!(L1.head > L0.head)) bad('tapping the head did not bring it forward');
  await p.click('#tDepth'); await shot('layers', 1.2, 0.12); await p.click('#tDepth');
  // an optional provider, plugged in from outside (Papercraft ships none): a toy that brings bright paint forward
  await p.evaluate(() => window.addDepthProvider('Toy', ({ px, w, h }) => Uint8Array.from({ length: w * h }, (_, i) => (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3)));
  const nb = await p.$$eval('[data-dsrc]', bs => bs.map(b => b.textContent)); if (!nb.includes('Toy')) bad('provider button missing: ' + nb);
  const d0 = await p.evaluate(() => window.DEPTH_DONE || 0); await p.click('[data-dsrc="p:Toy"]'); await p.waitForFunction(n => (window.DEPTH_DONE || 0) > n, d0);
  const toy = await p.evaluate(() => ST.dsrc + ' ' + MINE.depthMap[Math.round(MINE.h * 0.3) * MINE.w + (MINE.w >> 1)]); console.log('provider: depth from', toy); if (!toy.startsWith('paint')) bad('provider map not editable as paint');
  // save the Papercraft file, open it again: painted depth and layers come back
  const dir = R('papercraft/shots/export-depth'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const kind of ['model', 'png', 'json']) { await p.click('#save'); await p.waitForTimeout(200); const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`[data-save=${kind}]`)]); await d.saveAs(path.join(dir, d.suggestedFilename())); }
  const before = await p.evaluate(() => [Array.from(MINE.depthMap.slice(5000, 5010)).join(','), JSON.stringify(MINE.layers), ST.layersOn]);
  const json = fs.readdirSync(dir).find(f => f.endsWith('.json')); const k0 = await p.evaluate(() => window.CUT_DONE); await p.setInputFiles('#file', path.join(dir, json)); await p.waitForFunction(n => window.CUT_DONE > n, k0, { timeout: 120000 }); await p.waitForTimeout(300);
  const after = await p.evaluate(() => [MINE.depthMap ? Array.from(MINE.depthMap.slice(5000, 5010)).join(',') : null, JSON.stringify(MINE.layers), ST.layersOn]);
  if (JSON.stringify(after) !== JSON.stringify(before)) bad('reopened file lost depth: ' + JSON.stringify(before) + ' vs ' + JSON.stringify(after)); else console.log('reopened: painted depth and layers kept');
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN planes, painting, a grey map, layers, a provider, saved and reopened'); process.exit(errs.length ? 1 : 0);
})();
