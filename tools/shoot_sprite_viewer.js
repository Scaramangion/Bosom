// Screenshots of papercraft/sprite-viewer.html in headless Chromium (software WebGL). Fails (RED) on any page error.
// Run: node tools/shoot_sprite_viewer.js  ->  papercraft/shots/viewer-*.png
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path');
const page_ = 'file://' + path.resolve(__dirname, '../papercraft/sprite-viewer.html');
const SHOTS = [['viewer-cast', '?mode=cast&spin=0'], ['viewer-cast-wire', '?mode=cast&spin=0&wire=1&ps1=0'], ['viewer-elder-turn', '?s=farm/f_elder&spin=0&yaw=1.15&pitch=0.25&t=2'],
  ['viewer-elder-back', '?s=farm/f_elder&spin=0&yaw=3.4&pitch=0.25&t=2'], ['viewer-cow-edge', '?s=farm/cow&spin=0&yaw=1.45&pitch=0.3&t=3&wire=1&ps1=0']];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 600 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  for (const [name, q] of SHOTS) { await p.goto(page_ + q); await p.waitForFunction(() => window.READY, null, { timeout: 60000 }); await p.waitForTimeout(600);
    await p.screenshot({ path: path.resolve(__dirname, '../papercraft/shots/' + name + '.png') }); console.log('shot', name, await p.$eval('#stats', e => e.textContent)); }
  await b.close(); console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN no page errors'); process.exit(errs.length ? 1 : 0);
})();
