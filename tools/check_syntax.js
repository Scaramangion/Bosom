// Green/red syntax check for the whole project: every JavaScript file (node --check), every inline <script> in every HTML page we ship or
// generate (written out and checked the same way; JSON and other data blocks parsed as JSON), and every Python tool (py_compile). Run from the
// repo root: node tools/check_syntax.js   (it first builds the game, python3 build.py, and checks the built game/index.html: the real joined
// game script; --no-build skips that; add a path to check a page outside the repo, e.g. the published artifact)
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-')), bad = [], tally = { js: 0, html: 0, scripts: 0, data: 0, py: 0 };
const args = process.argv.slice(2), build = !args.includes('--no-build'); if (build) execFileSync('python3', ['build.py'], { stdio: 'pipe' });
const walk = (d, out = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (/^(node_modules|\.git|legacy|__pycache__)$/.test(e.name) || (d === '.' && e.name === 'game')) continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const files = walk('.').concat(build ? ['game/index.html', 'game/sw.js'].filter(f => fs.existsSync(f)) : [], args.filter(a => !a.startsWith('--'))), check = (file, label) => { try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); } catch (e) { bad.push(label + ': ' + String(e.stderr).split('\n').filter(Boolean).slice(0, 4).join(' / ')); } };
for (const f of files.filter(f => /\.(m?js)$/.test(f))) { tally.js++; check(f, f); }
for (const f of files.filter(f => /\.html$/.test(f))) { tally.html++; const src = fs.readFileSync(f, 'utf8'), re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi; let m, n = 0;
  while ((m = re.exec(src))) { const attrs = m[1], body = m[2]; if (/\bsrc=/.test(attrs) || !body.trim() || /^\s*\{\{[^}]+\}\}\s*$/.test(body)) continue; /* a build placeholder in the template: checked where it is filled in */ n++; const type = (attrs.match(/type=["']?([^"'\s>]+)/) || [])[1] || 'text/javascript', line = src.slice(0, m.index).split('\n').length;
    if (/json/.test(type)) { tally.data++; try { JSON.parse(body); } catch (e) { bad.push(`${f}:${line} JSON block: ${e.message}`); } continue; }
    if (!/javascript|module|^text\/babel$/.test(type) && type !== 'text/javascript') { tally.data++; continue; } // data blocks (a base64 atlas, a shader source) are not scripts
    tally.scripts++; const out = path.join(tmp, path.basename(f) + '.' + n + (type === 'module' ? '.mjs' : '.js')); fs.writeFileSync(out, body); check(out, `${f}:${line} <script>`); } }
const py = files.filter(f => /\.py$/.test(f)); tally.py = py.length;
if (py.length) try { execFileSync('python3', ['-c', 'import py_compile,sys\nfor f in sys.argv[2:]: py_compile.compile(f, doraise=True, cfile=sys.argv[1] + "/x.pyc")', tmp, ...py], { stdio: 'pipe' }); } catch (e) { bad.push('python: ' + String(e.stderr).split('\n').filter(Boolean).slice(-3).join(' / ')); }
fs.rmSync(tmp, { recursive: true, force: true });
for (const b of bad) console.log('RED', b);
console.log(bad.length ? 'RED' : 'GREEN', `${tally.js} JS files, ${tally.scripts} inline scripts in ${tally.html} pages (${tally.data} data blocks), ${tally.py} Python tools,`, bad.length, 'with errors'); process.exit(bad.length ? 1 : 0);
