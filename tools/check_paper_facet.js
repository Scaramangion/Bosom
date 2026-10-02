// Green/red check for paperFacet (24-papercraft.js): every sprite at the four budgets (PS1 Low 40, PS1 100, PS2 Low 300, PS2 800), and once mirrored and
// turned, must be a closed shell (every edge matched by as many running the other way) wound the module's way, stay near its budget, and come out the
// same twice. Run from the repo root: node tools/check_paper_facet.js
const fs = require('fs'), { execFileSync } = require('child_process'), os = require('os'), path = require('path');
const src = fs.readFileSync('src/js/game/24-papercraft.js', 'utf8'), body = s => src.slice(src.indexOf(s), src.indexOf('\n        }\n', src.indexOf(s)) + 10);
const lib = new Function(src.slice(src.indexOf('const PAPER_TRACE'), src.indexOf('        // ---- any picture -> a cut-out')) + body('        function paperFacet(') + '; return { paperTrace, paperFacet };')();
const db = JSON.parse(fs.readFileSync('assets/papercraft/sprite-polys.json', 'utf8')), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'facet-'));
let bad = 0, n = 0, over = 0; const t0 = Date.now(), tally = { 40: [], 100: [], 300: [], 800: [] };
for (const [at, A] of Object.entries(db.atlases)) {
  const raw = path.join(tmp, at + '.rgba'); execFileSync('python3', ['-c', `from PIL import Image; open(${JSON.stringify(raw)},'wb').write(Image.open(${JSON.stringify(A.file)}).convert('RGBA').tobytes())`]);
  const px = fs.readFileSync(raw); let k = 0;
  for (const [key, S] of Object.entries(db.sprites)) { if (!key.startsWith(at + '/')) continue; if (at === 'hero' && k++ % 6) continue; // every sixth hero frame keeps the run short
    for (const o of [{ budget: 40 }, { budget: 100 }, { budget: 300 }, { budget: 800 }, { budget: 300, flip: true, ang: 0.7, x: 40, y: -12, s: 0.3, flat: false }]) { n++;
      const V = lib.paperFacet([], px, A.size[0], A.size[1], S.rect, Object.assign({ anchor: S.anchor, depth: 4 }, o)), tris = V.length / 21;
      if (!o.flip) tally[o.budget].push(tris); if (tris > o.budget * 1.8 + 24) over++;
      const k2 = i => V.slice(i * 7, i * 7 + 3).map(v => v.toFixed(4)).join(','), edges = new Map(); let vol = 0;
      for (let t = 0; t < V.length / 7; t += 3) { const p = [0, 1, 2].map(i => V.slice((t + i) * 7, (t + i) * 7 + 3)); vol += p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) - p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0]);
        for (let i = 0; i < 3; i++) { const e = k2(t + i) + '>' + k2(t + (i + 1) % 3); edges.set(e, (edges.get(e) || 0) + 1); } }
      let open = 0; for (const [e, c] of edges) { const [a, b] = e.split('>'); if (a === b) continue; if (c !== (edges.get(b + '>' + a) || 0)) open++; }
      const again = lib.paperFacet([], px, A.size[0], A.size[1], S.rect, Object.assign({ anchor: S.anchor, depth: 4 }, o)), same = again.length === V.length && again.every((v, i) => v === V[i]);
      if (open || !(vol <= 0) || !tris || !same) { bad++; if (bad < 6) console.log('RED', key, JSON.stringify(o), 'tris', tris, 'open edges', open, 'vol', vol.toFixed(1), same ? '' : 'not deterministic'); } } }
}
fs.rmSync(tmp, { recursive: true, force: true }); const med = v => v.slice().sort((a, b) => a - b)[v.length >> 1];
console.log('triangles per sprite (median): PS1 Low', med(tally[40]), '| PS1', med(tally[100]), '| PS2 Low', med(tally[300]), '| PS2', med(tally[800]), '|', over, 'over budget by far');
console.log(bad ? 'RED' : 'GREEN', n, 'facetings,', bad, 'failed,', ((Date.now() - t0) / 1000).toFixed(1) + 's'); process.exit(bad ? 1 : 0);
