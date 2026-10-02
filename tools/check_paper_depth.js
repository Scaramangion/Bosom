// Green/red check for Papercraft's depth sources (24-papercraft.js): colour regions as planes (o.planes), a painted depth map (o.relief) and an
// optional provider (PAPER_DEPTH.register), on Round (paperPuff) and Facets (paperFacet). Every shape must stay a closed shell wound the module's way
// and come out the same twice; white must bring the front toward the camera and black send it back, the back untouched; planes must flatten each
// colour region; and a registered provider's map must shape the front exactly as the same map painted by hand. No neural network is involved.
// Run from the repo root: node tools/check_paper_depth.js
const fs = require('fs'), { execFileSync } = require('child_process'), os = require('os'), path = require('path');
const src = fs.readFileSync('src/js/game/24-papercraft.js', 'utf8'), body = s => src.slice(src.indexOf(s), src.indexOf('\n        }\n', src.indexOf(s)) + 10);
const lib = new Function(src.slice(src.indexOf('const PAPER_TRACE'), src.indexOf('        // ---- any picture -> a cut-out')) + body('        function paperPuff(') + body('        function paperFacet(') +
  '; return { paperTrace, paperPuff, paperFacet, paperRegions, PAPER_DEPTH };')();
const db = JSON.parse(fs.readFileSync('assets/papercraft/sprite-polys.json', 'utf8')), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'depth-'));
const rgba = file => { const raw = path.join(tmp, path.basename(file) + '.rgba'); const wh = execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(${JSON.stringify(file)}).convert('RGBA'); open(${JSON.stringify(raw)},'wb').write(im.tobytes()); print(im.size[0], im.size[1])`]).toString().trim().split(' ').map(Number); return { px: fs.readFileSync(raw), w: wh[0], h: wh[1] }; };
let bad = 0, n = 0; const t0 = Date.now(), red = (...m) => { bad++; if (bad < 12) console.log('RED', ...m); };
const shell = V => { const k2 = i => V.slice(i * 7, i * 7 + 3).map(v => v.toFixed(4)).join(','), edges = new Map(); let vol = 0;
  for (let t = 0; t < V.length / 7; t += 3) { const p = [0, 1, 2].map(i => V.slice((t + i) * 7, (t + i) * 7 + 3)); vol += p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0]);
    for (let i = 0; i < 3; i++) { const e = k2(t + i) + '>' + k2(t + (i + 1) % 3); edges.set(e, (edges.get(e) || 0) + 1); } }
  let open = 0; for (const [e, c] of edges) { const [a, b] = e.split('>'); if (a !== b && c !== (edges.get(b + '>' + a) || 0)) open++; } return { open, vol }; };
const reach = V => { let f = 0, b = 0; for (let i = 0; i < V.length; i += 7) { f = Math.max(f, V[i + 1]); b = Math.min(b, V[i + 1]); } return [f, -b]; }; // out = +y (ang 0): how far the front and the back reach
// 1) every few sprites of every atlas, both shapes, with each source
for (const [at, A] of Object.entries(db.atlases)) { const { px } = rgba(A.file); let k = 0;
  for (const [key, S] of Object.entries(db.sprites)) { if (!key.startsWith(at + '/') || k++ % 5) continue; const [, , w, h] = S.rect, gray = v => ({ px: new Uint8Array(w * h).fill(v) });
    for (const [nm, fold] of [['puff', (o) => lib.paperPuff([], px, A.size[0], A.size[1], S.rect, Object.assign({ anchor: S.anchor, depth: 4 }, o))], ['facet', (o) => lib.paperFacet([], px, A.size[0], A.size[1], S.rect, Object.assign({ anchor: S.anchor, depth: 4, budget: 300 }, o))]]) {
      const plain = fold({}), [f0, b0] = reach(plain);
      for (const [src, o] of [['planes', { planes: 0.8 }], ['white', { relief: gray(255) }], ['black', { relief: gray(0) }], ['grey', { relief: gray(128) }], ['stripes', { relief: { px: Uint8Array.from({ length: w * h }, (_, i) => ((i % w) >> 2) & 1 ? 230 : 40) }, planes: 0.5 }]]) { n++;
        const V = fold(o), again = fold(o), { open, vol } = shell(V), [f, b] = reach(V);
        if (open || !(vol <= 0) || !V.length) red(key, nm, src, 'open edges', open, 'vol', vol.toFixed(1));
        if (again.length !== V.length || !again.every((v, i) => v === V[i])) red(key, nm, src, 'not deterministic');
        if (Math.abs(b - b0) > 1e-6) red(key, nm, src, 'the back moved', b0.toFixed(3), '->', b.toFixed(3));
        if (src === 'white' && f0 > 0.2 && !(f > f0 * 1.5)) red(key, nm, 'white did not come forward', f0.toFixed(2), '->', f.toFixed(2));
        if (src === 'black' && f0 > 0.2 && !(f < f0 * 0.5)) red(key, nm, 'black did not go back', f0.toFixed(2), '->', f.toFixed(2));
        if (src === 'grey' && Math.abs(f - f0) > f0 * 0.02 + 1e-6) red(key, nm, 'grey changed the front', f0.toFixed(3), '->', f.toFixed(3)); } } } }
// 2) the regions of a real painting: Koto from his sheet (every painted pixel in one region, a sensible number of them), and planes flatten them
{ const K = rgba('tools/fixtures/koto-front.png'), { px, w, h } = K, R = lib.paperRegions(px, w, [0, 0, w, h]); let paint = 0, miss = 0; const size = new Map();
  for (let i = 0; i < w * h; i++) { const on = px[i * 4 + 3] >= 128; if (on) paint++; if (on !== (R.id[i] >= 0)) miss++; if (R.id[i] >= 0) size.set(R.id[i], (size.get(R.id[i]) || 0) + 1); }
  const small = [...size.values()].filter(c => c < paint * 0.004).length; console.log('Koto:', R.n, 'colour regions,', small, 'small islands');
  if (miss) red('regions: ' + miss + ' pixels mislabelled'); if (R.n < 4 || R.n > 160) red('regions: ' + R.n + ' on Koto'); if (R.n !== lib.paperRegions(px, w, [0, 0, w, h]).n) red('regions not cached');
  // spread of the front's heights within each region, with and without planes (vertices of a fine puff, grouped by the region under them)
  const spread = o => { const V = lib.paperPuff([], px, w, h, [0, 0, w, h], Object.assign({ anchor: [w / 2, h], depth: 4, s: 1, step: 2 }, o)), by = new Map();
    for (let i = 0; i < V.length; i += 7) { if (V[i + 1] <= 0.05) continue; const x = Math.round(V[i] + w / 2), y = Math.round(h - V[i + 2]); if (x < 0 || y < 0 || x >= w || y >= h) continue; const r = R.id[y * w + x]; if (r < 0) continue;
      const e = by.get(r) || [1e9, -1e9]; e[0] = Math.min(e[0], V[i + 1]); e[1] = Math.max(e[1], V[i + 1]); by.set(r, e); }
    let s = 0, c = 0; for (const [r, e] of by) if (size.get(r) > paint * 0.01) { s += e[1] - e[0]; c++; } return s / (c || 1); };
  const s0 = spread({}), s1 = spread({ planes: 1 }); console.log('height spread inside a region: silhouette', s0.toFixed(2), '| planes', s1.toFixed(2)); if (!(s1 < s0 * 0.75)) red('planes did not flatten the regions');
  // 3) an optional provider: whatever it returns is a relief map, used exactly like a painted one (here a toy provider: brighter paint comes forward)
  lib.PAPER_DEPTH.register('toy', ({ px, w, h }) => Uint8Array.from({ length: w * h }, (_, i) => (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3)); lib.PAPER_DEPTH.register('toy', lib.PAPER_DEPTH.providers[0].fn);
  if (lib.PAPER_DEPTH.providers.length !== 1) red('register twice keeps one provider');
  const map = lib.PAPER_DEPTH.providers[0].fn({ px, w, h }), a = lib.paperFacet([], px, w, h, [0, 0, w, h], { anchor: [w / 2, h], depth: 4, relief: { px: map } }), b = lib.paperFacet([], px, w, h, [0, 0, w, h], { anchor: [w / 2, h], depth: 4, relief: { px: Uint8Array.from(map) } });
  if (a.length !== b.length || !a.every((v, i) => v === b[i])) red('a provider map and the same map painted differ'); }
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? 'RED' : 'GREEN', n, 'shapes with planes, painted depth and a provider,', bad, 'failed,', ((Date.now() - t0) / 1000).toFixed(1) + 's'); process.exit(bad ? 1 : 0);
