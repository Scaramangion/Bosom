// Green/red check for paperPuff (24-papercraft.js): every sprite, puffed (plain, and mirrored + turned), must be a closed shell (every edge matched by as many running the other way) wound the
// module's way: (B-A)x(C-A) pointing inward (negative signed volume). Run from the repo root: node tools/check_paper_puff.js
const fs = require('fs'), { execFileSync } = require('child_process'), os = require('os'), path = require('path');
const src = fs.readFileSync('src/js/game/24-papercraft.js', 'utf8');
const paperPuff = new Function(src.slice(src.indexOf('function paperPuff('), src.indexOf('// ---- the GPU half')) + '; return paperPuff;')();
const db = JSON.parse(fs.readFileSync('assets/papercraft/sprite-polys.json', 'utf8')), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'puff-'));
let bad = 0, n = 0, tris = 0; const t0 = Date.now();
for (const [at, A] of Object.entries(db.atlases)) {
  const raw = path.join(tmp, at + '.rgba'); execFileSync('python3', ['-c', `from PIL import Image; open(${JSON.stringify(raw)},'wb').write(Image.open(${JSON.stringify(A.file)}).convert('RGBA').tobytes())`]);
  const px = fs.readFileSync(raw);
  for (const [key, S] of Object.entries(db.sprites)) { if (!key.startsWith(at + '/')) continue;
    for (const o of [{ depth: 3 }, { depth: 5, flip: true, ang: 0.7, x: 40, y: -12, s: 0.3 }]) { n++;
      const V = paperPuff([], px, A.size[0], A.size[1], S.rect, Object.assign({ anchor: S.anchor }, o)); tris += V.length / 21;
      const k = i => V.slice(i * 7, i * 7 + 3).map(v => v.toFixed(4)).join(','), edges = new Map(); let vol = 0;
      for (let t = 0; t < V.length / 7; t += 3) { const p = [0, 1, 2].map(i => V.slice((t + i) * 7, (t + i) * 7 + 3));
        vol += p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0]);
        for (let i = 0; i < 3; i++) { const e = k(t + i) + '>' + k(t + (i + 1) % 3); edges.set(e, (edges.get(e) || 0) + 1); } }
      let open = 0; for (const [e, c] of edges) { const [a, b] = e.split('>'); if (a === b) continue; if (c !== (edges.get(b + '>' + a) || 0)) open++; } // balanced: where the seam lies flat, front and back sheets coincide (two each way)
      if (open || !(vol <= 0)) { bad++; if (bad < 6) console.log('RED', key, JSON.stringify(o), 'open edges', open, 'vol', vol.toFixed(1)); } } }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? 'RED' : 'GREEN', n, 'puffs,', tris, 'triangles,', bad, 'failed,', ((Date.now() - t0) / 1000).toFixed(1) + 's'); process.exit(bad ? 1 : 0);
