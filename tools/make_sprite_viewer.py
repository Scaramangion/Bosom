"""Assembles papercraft/sprite-viewer.html: the game's REAL paper module (src/js/game/24-papercraft.js, verbatim), the traced sprite
outlines (assets/papercraft/sprite-polys.json) and their atlases, plus a small orbit-camera harness. Every piece on screen is folded by
paperSprite() at load time, exactly as the game would fold it. Run: python3 tools/make_sprite_viewer.py

URL options (handy for screenshots): ?s=farm/f_elder  &mode=cast|one  &t=1.5 (thickness)  &wire=1  &ps1=0  &yaw=0.6  &pitch=0.35  &dist=90  &spin=0
"""
import base64, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8', newline='').read()
module = rd('src/js/game/24-papercraft.js')
db = json.loads(rd('assets/papercraft/sprite-polys.json'))
uri = lambda p: 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(ROOT, p), 'rb').read()).decode()
atlases = ''.join('<script type="text/plain" id="atlas-%s">%s</script>\n' % (k, uri(v['file'])) for k, v in db['atlases'].items())

html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Paper Sprites</title><style>html,body{margin:0;height:100%;background:#14161c;color:#e8e6df;font:12px system-ui,sans-serif;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;height:100%}#ui{position:fixed;left:8px;right:8px;top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:rgba(12,14,22,.82);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px}
#ui label{display:flex;gap:6px;align-items:center}select,button{background:#222733;color:#fff;border:1px solid #555;border-radius:5px;padding:4px 6px;max-width:46vw}
#msg{position:fixed;left:8px;bottom:8px;opacity:.7}</style></head><body><canvas id="c"></canvas>
<div id="ui"><b>PAPER SPRITES</b><select id="mode"><option value="cast">the cast</option><option value="one">one sprite</option></select><select id="spr"></select>
<label>thick <input id="thick" type="range" min="0" max="4" step="0.25" value="1.25"></label><label><input id="wire" type="checkbox"> wire</label>
<label><input id="spin" type="checkbox" checked> spin</label><label><input id="grade" type="checkbox" checked> PS1 look</label><span id="stats"></span></div>
<div id="msg">drag: orbit &middot; wheel: zoom &middot; each sprite is traced to an outline, folded into a card, painted front, darker back</div>
''' + atlases + '''<script>
// ---------- harness: the handful of globals the paper module expects from the game (none of the town is built here) ----------
const TILE_BUMPER = 15, TILE_SIZE = 16, MAP_COLS = 1, MAP_ROWS = 1, MAP_DATA = [[0]], PAPER_STALLS = new Set(), PAPER_FOUNT = new Set();
const FX_GL = { ok: false }, COMBAT = { amt: 0 }; let currentMapName = 'overworld', gameState = 'PLAYING'; function rngOf(s) { let a = s >>> 0; return () => ((a = Math.imul(a ^ (a >>> 15), 2246822519) + 1) >>> 0) / 4294967296; }
// ---------- the paper module, verbatim from the game ----------
''' + module + '''
// ---------- the traced outlines, verbatim from assets/papercraft/sprite-polys.json ----------
const SPRITE_POLYS = ''' + json.dumps(db, separators=(',', ':')) + ''';
// ---------- the cast: who stands on the plaza (name, height in world px; humans are 24 like FOLK_SIZE.human) ----------
const CAST = [['farm/f_elder', 24], ['farm/f_farmer', 24], ['farm/f_franz', 24], ['farm/f_merchant', 24], ['sud/stand', 24], ['farm/f_clito', 24], ['farm/f_sister', 23], ['farm/f_guide', 23],
  ['hero/basic_down', 24], ['farm/f_child', 18], ['hero/kael_idle', 26], ['hero/rj_down', 34], ['farm/farmhorse', 26], ['farm/cow', 19], ['farm/goat', 17], ['farm/sheep', 14], ['farm/dog', 13], ['farm/cat', 11],
  ['farm/pig', 12], ['farm/rooster', 13], ['farm/goose', 12], ['farm/duck', 10], ['farm/chicken', 10], ['farm/well', 40], ['farm/i_basket', 8], ['farm/i_milk', 8], ['farm/stall', 46]];
const STALKER = ['farm/f_farmer', 24 * 1.35]; // the tall one, at the back
// ---------- a tiny renderer: an orbit camera, the SAME fragment shader as the game (PAPER_GLSL.frag) ----------
const Q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
const cv = $('c'), gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
const vsrc = `attribute vec3 aP;attribute vec2 aT;attribute vec2 aS;uniform mat4 uM;varying vec2 vT;varying vec3 vW;varying float vZ,vSh,vEm;
  void main(){vec4 p=uM*vec4(aP,1.);gl_Position=p;vT=aT;vW=aP;vZ=p.w;vSh=aS.x;vEm=aS.y;}`;
const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const link = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aT'); gl.bindAttribLocation(p, 2, 'aS'); gl.linkProgram(p); return p; };
const prog = link(vsrc, PAPER_GLSL.frag), wprog = link('attribute vec3 aP;uniform mat4 uM;void main(){gl_Position=uM*vec4(aP,1.);}', 'precision mediump float;void main(){gl_FragColor=vec4(1.,.82,.25,1.);}');
const texOf = (src, rep) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, rep ? gl.REPEAT : gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, rep ? gl.REPEAT : gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); return t; };
const TEX = {}, ATLAS_IMG = {}; let loaded = 0; const names = Object.keys(SPRITE_POLYS.atlases);
const ground = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#5c5246'; g.fillRect(0, 0, 64, 64); // flagstones, jittered by the prime
  for (let y = 0, r = 0; y < 64; y += 16, r++) for (let x = -(r % 2) * 8; x < 64; x += 16) { const k = paperPrime(x * 7 + y), v = 150 + k * 30 | 0; g.fillStyle = `rgb(${v},${v - 8},${v - 22})`; g.fillRect(x + 1, y + 1, 14, 14); }
  return c; })();
let groups = [], wire = null, wireN = 0, gbuf = gl.createBuffer(), focus = [0, 0, 12], radius = 60;
function build() { // fold every piece on stage; one buffer per atlas, so each draws with its own texture
  const mode = $('mode').value, th = +$('thick').value, per = {}, put = (key, h, x, y, ang, flip) => { const S = SPRITE_POLYS.sprites[key]; if (!S) return; const at = key.split('/')[0];
    paperSprite(per[at] || (per[at] = []), S, SPRITE_POLYS.atlases[at].size, { x, y, ang, flip, s: h / S.rect[3], thick: th * h / 24 }); };
  if (mode === 'one') { const key = $('spr').value, S = SPRITE_POLYS.sprites[key]; put(key, 24 * S.rect[3] / 85, 0, 0, 0, false); const h = 24 * S.rect[3] / 85; focus = [0, 0, h / 2]; radius = Math.max(h, 24 * S.rect[2] / 85) * 1.9; }
  else { // two arcs on the plaza, each piece turned to the lens' default spot and nudged by the prime, so it never looks set out with a ruler
    const n0 = 14, look = [150, 260];
    CAST.forEach(([key, h], i) => { const row = i < n0 ? 0 : 1, k = row ? i - n0 : i, n = row ? CAST.length - n0 : n0, x = (k - (n - 1) / 2) * (row ? 30 : 17) + (paperPrime(i) - 0.5) * 5, y = row ? -40 + Math.abs(k - (n - 1) / 2) * 5 : 10 + Math.abs(k - (n - 1) / 2) * 3;
      put(key, h, x, y, Math.atan2(-(look[0] - x), look[1] - y) + (paperPrime(i + 50) - 0.5) * 0.6, paperPrime(i + 99) < 0.3); });
    put(STALKER[0], STALKER[1], -30, -95, 0.3, false); focus = [-20, -25, 12]; radius = 155; }
  const tris = Object.values(per).reduce((n, v) => n + v.length / 21, 0);
  groups = Object.entries(per).map(([at, v]) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW); return { at, b, n: v.length / 7 }; });
  const L = []; for (const v of Object.values(per)) for (let t = 0; t < v.length / 7; t += 3) for (let i = 0; i < 3; i++) { const a = (t + i) * 7, b = (t + (i + 1) % 3) * 7; L.push(v[a], v[a + 1], v[a + 2], v[b], v[b + 1], v[b + 2]); }
  wire = wire || gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, wire); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.STATIC_DRAW); wireN = L.length / 3;
  const G = 600, u1 = G / 24; gl.bindBuffer(gl.ARRAY_BUFFER, gbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-G, G, 0, 0, u1, .85, 0, G, G, 0, u1, u1, .85, 0, G, -G, 0, u1, 0, .85, 0, -G, G, 0, 0, u1, .85, 0, G, -G, 0, u1, 0, .85, 0, -G, -G, 0, 0, 0, .85, 0]), gl.STATIC_DRAW);
  $('stats').textContent = tris + ' triangles, prime ' + PAPER.PRIME;
}
const cam = { yaw: +(Q.get('yaw') || 0.5), pitch: +(Q.get('pitch') || 0.42), zoom: +(Q.get('dist') || 0) };
function matrix(w, h) { // perspective * lookAt(focus), z up
  const d = cam.zoom || radius * 1.6, [tx, ty, tz] = focus, cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const e = [tx + Math.sin(cam.yaw) * cp * d, ty + Math.cos(cam.yaw) * cp * d, tz + sp * d];
  const f = [tx - e[0], ty - e[1], tz - e[2]], fl = Math.hypot(...f); f[0] /= fl; f[1] /= fl; f[2] /= fl;
  let r = [f[1], -f[0], 0]; const rl = Math.hypot(r[0], r[1]); r = [r[0] / rl, r[1] / rl, 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const V = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), (f[0] * e[0] + f[1] * e[1] + f[2] * e[2]), 1];
  const n = 1, fa = 3000, t = 1 / Math.tan(0.4), a = w / h, P = [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, -(fa + n) / (fa - n), -1, 0, 0, -2 * fa * n / (fa - n), 0];
  const M = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + j] * V[i * 4 + k]; M[i * 4 + j] = s; } return M;
}
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now; if ($('spin').checked && !drag) cam.yaw += dt * 0.35;
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth * dpr | 0, h = cv.clientHeight * dpr | 0; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h); gl.clearColor(0.55, 0.62, 0.7, 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW); // x east, y SOUTH, z up is a left-handed world, so the folded faces wind clockwise here
  const M = matrix(w, h); gl.useProgram(prog); for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uM'), false, M); const U = n => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uSheet'), 7); gl.uniform1f(U('uAmb'), 0.9); gl.uniform1f(U('uFogD'), 5); gl.uniform1f(U('uZc'), 0); gl.uniform1f(U('uGlow'), 0); gl.uniform1f(U('uDS'), w / 240); gl.uniform2f(U('uRes'), w, h);
  gl.uniform1f(U('uTime'), now / 1000 % 1000); gl.uniform3f(U('uTint'), 1, 1, 1); gl.uniform1f(U('uDesat'), 0.2); gl.uniform1f(U('uGrade'), $('grade').checked ? 1 : 0); gl.uniform3f(U('uFogC'), 0.55, 0.62, 0.72); gl.uniform3fv(U('uLW[0]'), new Float32Array(24));
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); gl.activeTexture(gl.TEXTURE7);
  const draw = (b, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 20); gl.drawArrays(gl.TRIANGLES, 0, n); };
  gl.bindTexture(gl.TEXTURE_2D, TEX.ground); draw(gbuf, 6);
  for (const g of groups) { gl.bindTexture(gl.TEXTURE_2D, TEX[g.at]); draw(g.b, g.n); }
  gl.disable(gl.POLYGON_OFFSET_FILL);
  if ($('wire').checked && wire) { gl.useProgram(wprog); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.uniformMatrix4fv(gl.getUniformLocation(wprog, 'uM'), false, M); gl.bindBuffer(gl.ARRAY_BUFFER, wire); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.drawArrays(gl.LINES, 0, wireN); }
  requestAnimationFrame(frame);
}
let drag = null; cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); }); cv.addEventListener('pointerup', () => drag = null);
cv.addEventListener('pointermove', e => { if (!drag) return; cam.yaw -= (e.clientX - drag[0]) * 0.006; cam.pitch = Math.max(0.02, Math.min(1.45, cam.pitch + (e.clientY - drag[1]) * 0.005)); drag = [e.clientX, e.clientY]; });
cv.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = Math.max(10, Math.min(3000, (cam.zoom || radius * 1.6) * (1 + e.deltaY * 0.001))); }, { passive: false });
{ const sel = $('spr'); for (const at of names) { const og = document.createElement('optgroup'); og.label = at; for (const k of Object.keys(SPRITE_POLYS.sprites)) if (k.startsWith(at + '/')) { const o = document.createElement('option'); o.value = o.textContent = k; og.appendChild(o); } sel.appendChild(og); }
  sel.value = Q.get('s') || 'farm/f_elder'; $('mode').value = Q.get('mode') || (Q.get('s') ? 'one' : 'cast'); if (Q.get('t')) $('thick').value = Q.get('t');
  $('wire').checked = Q.get('wire') === '1'; $('grade').checked = Q.get('ps1') !== '0'; $('spin').checked = Q.get('spin') !== '0';
  const re = () => { cam.zoom = +(Q.get('dist') || 0); build(); }; sel.onchange = () => { $('mode').value = 'one'; re(); }; $('mode').onchange = re; $('thick').oninput = build; }
TEX.ground = texOf(ground, true);
for (const at of names) { const im = new Image(); im.onload = () => { TEX[at] = texOf(im); if (++loaded === names.length) { build(); requestAnimationFrame(frame); document.title = 'Paper Sprites'; window.READY = true; } }; im.src = $('atlas-' + at).textContent.trim(); }
</script></body></html>'''
out = os.path.join(ROOT, 'papercraft/sprite-viewer.html'); open(out, 'w', encoding='utf-8', newline='').write(html); print('wrote', out, round(len(html) / 1024), 'KB')
