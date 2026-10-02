// Cut-out check: runs paperCutout + paperTrace (from the viewer page, i.e. the real module) on test pictures in headless Chromium and saves a
// contact sheet of the cut-outs on a checkerboard: papercraft/shots/cutouts.png. RED if any picture fails to trace or keeps its whole frame.
// Run: node tools/check_cutout.js
const { chromium } = require(process.env.PW || 'playwright'); const path = require('path'), fs = require('fs'), R = p => path.resolve(__dirname, '..', p);
const PICS = ['art-source/characters/girl_front.png', 'art-source/incoming/images/07e6d49e-IMG_6014.jpeg', 'art-source/incoming/images/5e430c49-IMG_5986.jpeg',
  'tools/fixtures/grid-paper.jpg', 'art-source/incoming/images/7013001f-image.jpg', 'art-source/incoming/images/b34dd5de-IMG_6010.jpeg'];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + R('papercraft/sprite-viewer.html') + '?spin=0'); await p.waitForFunction(() => window.READY);
  const out = [];
  for (const f of PICS) {
    const data = 'data:image/' + (f.endsWith('png') ? 'png' : 'jpeg') + ';base64,' + fs.readFileSync(R(f)).toString('base64');
    out.push(await p.evaluate(async (data) => { const im = new Image(); im.src = data; await im.decode(); const t0 = performance.now();
      const C = paperCutout(im, { max: 256, tol: 48, one: true }), S = paperTrace(C.px, C.w, [0, 0, C.w, C.h]), ms = performance.now() - t0;
      let air = 0; for (let i = 3; i < C.px.length; i += 4) if (!C.px[i]) air++;
      const cv = document.createElement('canvas'); cv.width = 260; cv.height = 280; const g = cv.getContext('2d'); for (let y = 0; y < 260; y += 10) for (let x = 0; x < 260; x += 10) { g.fillStyle = (x + y) / 10 % 2 ? '#3a3f4c' : '#2a2e38'; g.fillRect(x, y, 10, 10); }
      g.imageSmoothingEnabled = false; const k = Math.min(256 / C.w, 256 / C.h); g.drawImage(C.cv, 2 + (256 - C.w * k) / 2, 2 + (256 - C.h * k) / 2, C.w * k, C.h * k);
      g.fillStyle = '#e8e6df'; g.font = '11px sans-serif'; g.fillText(S ? `${C.w}x${C.h}  ${S.pts.length / 2} corners  ${(100 * air / (C.w * C.h)) | 0}% air  ${ms | 0}ms` : 'NO CUT', 4, 274);
      return { url: cv.toDataURL(), ok: !!S && air > 0 }; }, data));
  }
  const sheet = await p.evaluate(async (urls) => { const cv = document.createElement('canvas'); cv.width = 260 * urls.length; cv.height = 280; const g = cv.getContext('2d');
    for (let i = 0; i < urls.length; i++) { const im = new Image(); im.src = urls[i]; await im.decode(); g.drawImage(im, i * 260, 0); } return cv.toDataURL(); }, out.map(o => o.url));
  fs.writeFileSync(R('papercraft/shots/cutouts.png'), Buffer.from(sheet.split(',')[1], 'base64')); await b.close();
  out.forEach((o, i) => !o.ok && errs.push('no background removed: ' + PICS[i]));
  console.log(errs.length ? 'RED ' + errs.join(' | ') : 'GREEN ' + PICS.length + ' pictures cut out and traced'); process.exit(errs.length ? 1 : 0);
})();
