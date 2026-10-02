// Green/red check: paperTrace (24-papercraft.js, the browser tracer) must cut exactly the polygons tools/sprite_poly.py cut, for every sprite.
// Needs the atlases as raw RGBA: Python decodes them, so both tracers read the very same bytes. Run from the repo root: node tools/check_paper_trace.js
const fs = require('fs'), { execFileSync } = require('child_process'), os = require('os'), path = require('path');
const src = fs.readFileSync('src/js/game/24-papercraft.js', 'utf8');
const paperTrace = new Function(src.slice(src.indexOf('const PAPER_TRACE'), src.indexOf('// ---- sprites folded into paper')) + '; return paperTrace;')();
const db = JSON.parse(fs.readFileSync('assets/papercraft/sprite-polys.json', 'utf8')), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-'));
let bad = 0, n = 0; const t0 = Date.now();
for (const [at, A] of Object.entries(db.atlases)) {
  const raw = path.join(tmp, at + '.rgba');
  execFileSync('python3', ['-c', `from PIL import Image; open(${JSON.stringify(raw)},'wb').write(Image.open(${JSON.stringify(A.file)}).convert('RGBA').tobytes())`]);
  const px = fs.readFileSync(raw);
  for (const [key, S] of Object.entries(db.sprites)) { if (!key.startsWith(at + '/')) continue; n++;
    const T = paperTrace(px, A.size[0], S.rect, { anchor: S.anchor });
    const same = T && ['pts', 'rings', 'tris', 'ein'].every(k => JSON.stringify(T[k]) === JSON.stringify(S[k]));
    if (!same) { bad++; if (bad <= 5) console.log('RED', key, T ? ['pts', 'rings', 'tris', 'ein'].map(k => k + ' ' + T[k].length + '/' + S[k].length).join(' ') : 'null'); } }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? 'RED' : 'GREEN', n, 'sprites traced in the browser tracer,', bad, 'differ from the Python cut,', ((Date.now() - t0) / 1000).toFixed(1) + 's');
process.exit(bad ? 1 : 0);
