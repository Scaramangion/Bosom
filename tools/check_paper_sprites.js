// Green/red check for paperSprite (24-papercraft.js): every traced sprite, folded with thickness (plain and mirrored + turned), must be a
// closed shell wound the module's way (every edge shared once each way; (B-A)x(C-A) pointing inward). Run: node tools/check_paper_sprites.js
const fs = require('fs');
const src = fs.readFileSync('src/js/game/24-papercraft.js', 'utf8');
const fn = src.slice(src.indexOf('function paperSprite('), src.indexOf('// ---- the GPU half'));
const paperSprite = new Function(fn + '; return paperSprite;')();
const db = JSON.parse(fs.readFileSync('assets/papercraft/sprite-polys.json', 'utf8'));
let bad = 0, n = 0, tris = 0;
for (const [key, S] of Object.entries(db.sprites)) {
  const A = db.atlases[key.split('/')[0]].size;
  for (const o of [{ thick: 1.5 }, { thick: 2, flip: true, ang: 0.7, x: 40, y: -12 }]) {
    const V = paperSprite([], S, A, o); n++; tris += V.length / 21;
    const k = (i) => V.slice(i * 7, i * 7 + 3).map(v => v.toFixed(4)).join(',');
    const edges = new Map(); let vol = 0;
    for (let t = 0; t < V.length / 7; t += 3) {
      const p = [0, 1, 2].map(i => V.slice((t + i) * 7, (t + i) * 7 + 3));
      vol += p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0]);
      for (let i = 0; i < 3; i++) { const a = k(t + i), b = k(t + (i + 1) % 3); edges.set(a + '>' + b, (edges.get(a + '>' + b) || 0) + 1); }
    }
    let open = 0; for (const [e, c] of edges) { const [a, b] = e.split('>'); if (c !== 1 || edges.get(b + '>' + a) !== 1) open++; }
    if (open || !(vol < 0)) { bad++; if (bad < 6) console.log('RED', key, JSON.stringify(o), 'open edges', open, 'vol', vol.toFixed(1)); }
  }
}
console.log(bad ? 'RED' : 'GREEN', n, 'folds,', tris, 'triangles,', bad, 'failed');
