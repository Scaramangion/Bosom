// Phone-sized check of Facets in papercraft/sprite-viewer.html: Koto (front, back and side views from his sheet) at the four polygon budgets
// (PS1 Low, PS1, PS2 Low, PS2), with and without the wireframe, and the Polygon abstraction at PS1. Saves him at PS1.
// RED on page errors or a budget that is far off. Run: node tools/shoot_facets.js -> papercraft/shots/facets-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), fs = require('fs'), R = p => path.resolve(__dirname, '..', p);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0&anim=still'); await p.waitForFunction(() => window.READY, null, { timeout: 60000 });
  await p.setInputFiles('#file', R('tools/fixtures/koto-front.png')); await p.waitForFunction(() => (window.CUT_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.setInputFiles('#fileBack', R('tools/fixtures/koto-back.png')); await p.waitForFunction(() => (window.BACK_DONE || 0) >= 1, null, { timeout: 120000 });
  await p.setInputFiles('#fileSide', R('tools/fixtures/koto-left.png')); await p.waitForFunction(() => (window.SIDE_DONE || 0) >= 1, null, { timeout: 120000 }); await p.waitForTimeout(300);
  const shot = async name => { await p.evaluate(() => { cam.zoom = 0; cam.to = null; cam.yaw = 0.6; cam.pitch = 0.14; }); await p.waitForTimeout(500); await p.screenshot({ path: R(`papercraft/shots/facets-${name}.png`) }); };
  await p.click('#tDepth'); await p.click('[data-shape=facets]'); await p.click('#tDepth');
  for (const [nm, bud] of [['ps1low', 40], ['ps1', 100], ['ps2low', 300], ['ps2', 800]]) { await p.evaluate(v => document.querySelector(`[data-budget="${v}"]`).click(), bud); await p.waitForTimeout(300);
    const tris = await p.evaluate(() => MINE.geo.reduce((n, g) => n + g.n / 3, 0)); console.log(nm, 'budget', bud, '->', tris, 'triangles'); if (tris > bud * 2.2 + 200) errs.push(nm + ' ' + tris + ' triangles');
    await shot(nm); await p.evaluate(() => { document.getElementById('wire').checked = true; }); await shot(nm + '-wire'); await p.evaluate(() => { document.getElementById('wire').checked = false; }); }
  await p.evaluate(() => document.querySelector('[data-budget="100"]').click()); await p.click('#tLook'); await p.click('[data-abs=polygon]'); await p.click('#tLook'); await p.waitForTimeout(300); await shot('ps1-polygon');
  const dir = R('papercraft/shots/export-facets'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const kind of ['model', 'png', 'json']) { await p.click('#save'); await p.waitForTimeout(200); const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click(`[data-save=${kind}]`)]); await d.saveAs(path.join(dir, d.suggestedFilename())); }
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN four budgets, polygon look, saved'); process.exit(errs.length ? 1 : 0);
})();
