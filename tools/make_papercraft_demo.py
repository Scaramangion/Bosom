"""Assembles papercraft/paper-demo.html: the game's REAL paper module (src/js/game/24-papercraft.js, verbatim) + a tiny harness and an orbit camera.
Nothing in the paper code is copied by hand, so the demo can never drift from the game. Run: python3 tools/make_papercraft_demo.py"""
import base64, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8', newline='').read()
module = rd('src/js/game/24-papercraft.js')
town = rd('src/js/game/25-the-town-widened.js').split('\n')
blueprint = next(l for l in town if 'const TOWN_BLUEPRINT' in l)
widen = '\n'.join(l for l in town if 'PAPER_STALLS' in l or 'widenTown' in l or 'TOWN_BLUEPRINT.forEach' in l)
rng = next(l for l in rd('src/js/game/22-the-grow-hollow.js').split('\n') if 'function rngOf' in l)
uri = lambda p: 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(ROOT, p), 'rb').read()).decode()
html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Papercraft Town</title><style>html,body{margin:0;height:100%;background:#14161c;color:#e8e6df;font:12px system-ui,sans-serif;overflow:hidden;touch-action:none}
canvas{display:block;width:100%;height:100%}#ui{position:fixed;left:8px;right:8px;top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:rgba(12,14,22,.82);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px}
#ui label{display:flex;gap:6px;align-items:center}input[type=number]{width:64px;background:#0c0e16;color:#fff;border:1px solid #444;border-radius:4px;padding:3px}button{background:#222733;color:#fff;border:1px solid #555;border-radius:5px;padding:4px 8px}
#msg{position:fixed;left:8px;bottom:8px;opacity:.7}</style></head><body><canvas id="c"></canvas>
<div id="ui"><b>PAPER TOWN</b><label>prime <input id="prime" type="number" value="113"></label><button id="fold">fold</button><label>night <input id="night" type="range" min="0" max="1" step="0.01" value="0"></label><label><input id="grade" type="checkbox" checked> PS1 look</label><span id="stats"></span></div>
<div id="msg">drag: orbit &middot; wheel / pinch: zoom &middot; the tile map is the blueprint, the sheet is the paint, the prime is the anchor</div>
<script type="text/plain" id="paper-pieces">''' + uri('assets/atlases/paper-pieces.webp') + '''</script>
<script type="text/plain" id="cottage-tex">''' + uri('assets/atlases/cottage-tex.webp') + '''</script>
<script>
// ---------- harness: the handful of globals the paper module expects from the game ----------
const TILE_BUMPER = 15, TILE_SIZE = 16; ''' + rng.strip() + '''
''' + blueprint.strip() + '''
const MAP_COLS = TOWN_BLUEPRINT[0].length, MAP_ROWS = TOWN_BLUEPRINT.length, MAP_DATA = TOWN_BLUEPRINT.map(r => new Array(MAP_COLS).fill(0));
const FX_GL = { ok: false }, COMBAT = { amt: 0 }; let currentMapName = 'overworld', gameState = 'PLAYING';
''' + widen + '''
// ---------- the paper module, verbatim from the game ----------
''' + module + '''
// ---------- a tiny renderer: an orbit camera instead of the game's camera; the SAME fragment shader (PAPER_GLSL.frag) ----------
const cv = document.getElementById('c'), gl = cv.getContext('webgl', { antialias: false });
const vert = `attribute vec3 aP;attribute vec2 aT;attribute vec2 aS;uniform mat4 uM;varying vec2 vT;varying vec3 vW;varying float vZ,vSh,vEm;
  void main(){vec4 p=uM*vec4(aP,1.);gl_Position=p;vT=aT;vW=aP;vZ=p.w;vSh=aS.x;vEm=aS.y;}`;
const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const prog = gl.createProgram(); gl.attachShader(prog, mk(gl.VERTEX_SHADER, vert)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, PAPER_GLSL.frag));
gl.bindAttribLocation(prog, 0, 'aP'); gl.bindAttribLocation(prog, 1, 'aT'); gl.bindAttribLocation(prog, 2, 'aS'); gl.linkProgram(prog); gl.useProgram(prog);
const U = n => gl.getUniformLocation(prog, n), buf = gl.createBuffer(), tex = gl.createTexture();
function fold() { // the whole idea in four lines: blueprint -> sheet -> folded mesh -> upload
    PAPER.PRIME = +document.getElementById('prime').value || 113; PAPER.mesh = null; PAPER.sheet = null; PAPER.n = 0;
    const mesh = paperBuild(), sheet = paperSheet();
    const c = PAPER_CELLS.stone, u = (c[0] * 48 + 24) / 1024, v = (c[1] * 78 + 40) / 1024, gx0 = -400, gx1 = MAP_COLS * 16 + 400, gy0 = -400, gy1 = MAP_ROWS * 16 + 700; // a plain street, so the folds have something to stand on
    const ground = new Float32Array([gx0, gy1, -0.5, u, v, 0.8, 0, gx1, gy1, -0.5, u, v, 0.8, 0, gx1, gy0, -0.5, u, v, 0.8, 0, gx0, gy1, -0.5, u, v, 0.8, 0, gx1, gy0, -0.5, u, v, 0.8, 0, gx0, gy0, -0.5, u, v, 0.8, 0]);
    const all = new Float32Array(mesh.length + ground.length); all.set(mesh); all.set(ground, mesh.length); drawCount = all.length / 7;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, all, gl.STATIC_DRAW);
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, tex);
    [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    document.getElementById('stats').textContent = PAPER.verts + ' vertices, ' + (PAPER.verts / 3 | 0) + ' triangles, prime ' + PAPER.PRIME;
}
let drawCount = 0; const cam = { yaw: 0.5, pitch: 0.62, dist: 760 };
function matrix(w, h) { // perspective * lookAt(target), z up
    const tx = MAP_COLS * 8, ty = MAP_ROWS * 8 + 90, tz = 20, cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const e = [tx + Math.sin(cam.yaw) * cp * cam.dist, ty + Math.cos(cam.yaw) * cp * cam.dist, tz + sp * cam.dist];
    const f = [tx - e[0], ty - e[1], tz - e[2]], fl = Math.hypot(...f); f[0] /= fl; f[1] /= fl; f[2] /= fl;
    let r = [f[1] * 1 - f[2] * 0, f[2] * 0 - f[0] * 1, 0]; const rl = Math.hypot(r[0], r[1]); r = [r[0] / rl, r[1] / rl, 0];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const V = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), (f[0] * e[0] + f[1] * e[1] + f[2] * e[2]), 1];
    const n = 4, fa = 4000, t = 1 / Math.tan(0.4), a = w / h, P = [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, -(fa + n) / (fa - n), -1, 0, 0, -2 * fa * n / (fa - n), 0];
    const M = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + j] * V[i * 4 + k]; M[i * 4 + j] = s; } return M;
}
function frame(now) {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth * dpr | 0, h = cv.clientHeight * dpr | 0; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); const night = +document.getElementById('night').value, amb = 0.85 - night * 0.43;
    gl.clearColor(0.55 - night * 0.4, 0.62 - night * 0.45, 0.7 - night * 0.4, 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CW); // x east, y SOUTH, z up is a left-handed world, so the folded faces wind clockwise here
    gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, buf); for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 20);
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U('uSheet'), 7); gl.uniformMatrix4fv(U('uM'), false, matrix(w, h));
    gl.uniform1f(U('uAmb'), amb); gl.uniform1f(U('uFogD'), 5); gl.uniform1f(U('uZc'), 0); gl.uniform1f(U('uGlow'), Math.max(0, Math.min(1, (0.62 - amb) / 0.22))); gl.uniform1f(U('uDS'), w / 240); gl.uniform2f(U('uRes'), w, h);
    gl.uniform1f(U('uTime'), now / 1000 % 1000); gl.uniform3f(U('uTint'), 1, 1, 1); gl.uniform1f(U('uDesat'), 0.2); gl.uniform1f(U('uGrade'), document.getElementById('grade').checked ? 1 : 0);
    gl.uniform3f(U('uFogC'), 0.55 - night * 0.45, 0.62 - night * 0.5, 0.72 - night * 0.45);
    const LW = new Float32Array(24); gl.uniform3fv(U('uLW[0]'), LW); gl.drawArrays(gl.TRIANGLES, 0, drawCount); requestAnimationFrame(frame);
}
let drag = null; cv.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); }); cv.addEventListener('pointerup', () => drag = null);
cv.addEventListener('pointermove', e => { if (!drag) return; cam.yaw -= (e.clientX - drag[0]) * 0.006; cam.pitch = Math.max(0.12, Math.min(1.45, cam.pitch + (e.clientY - drag[1]) * 0.005)); drag = [e.clientX, e.clientY]; });
cv.addEventListener('wheel', e => { e.preventDefault(); cam.dist = Math.max(120, Math.min(2200, cam.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
document.getElementById('fold').onclick = fold; setTimeout(() => { fold(); requestAnimationFrame(frame); }, 150);
</script></body></html>'''
out = os.path.join(ROOT, 'papercraft/paper-demo.html'); open(out, 'w', encoding='utf-8', newline='').write(html); print('wrote', out, round(len(html) / 1024), 'KB')
