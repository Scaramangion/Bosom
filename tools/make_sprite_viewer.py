"""Assembles papercraft/sprite-viewer.html (the Papercraft Viewer): the game's REAL paper module (src/js/game/24-papercraft.js, verbatim),
the traced sprite outlines (assets/papercraft/sprite-polys.json) and their atlases, plus a small orbit-camera harness and a phone-first UI.
Any picture you choose is cut out (paperCutout), traced (paperTrace) and folded (paperSprite) on the device.
Run: python3 tools/make_sprite_viewer.py [--artifact OUT]   (--artifact also writes the page without its document wrapper, for publishing)

URL options (handy for screenshots): ?mode=start|cast|one  &s=farm/f_elder  &t=1.5 (depth)  &wire=1  &ps1=1  &yaw=0.6  &pitch=0.35  &dist=90  &spin=0
"""
import base64, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8', newline='').read()
module = rd('src/js/game/24-papercraft.js')
db = json.loads(rd('assets/papercraft/sprite-polys.json'))
uri = lambda p: 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(ROOT, p), 'rb').read()).decode()
atlases = ''.join('<script type="text/plain" id="atlas-%s">%s</script>\n' % (k, uri(v['file'])) for k, v in db['atlases'].items())
ICON = { # 24 px line icons, drawn in currentColor
    'photo': '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-5 4 4 3-3 4 4"/>',
    'cut': '<circle cx="6.5" cy="7" r="2.6"/><circle cx="6.5" cy="17" r="2.6"/><path d="M8.6 8.6L20 18M8.6 15.4L20 6"/>',
    'depth': '<path d="M5 8l7-4 7 4v8l-7 4-7-4z"/><path d="M5 8l7 4 7-4M12 12v8"/>',
    'look': '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M12 4a8 8 0 0 1 0 16" fill="currentColor" stroke="none"/>',
    'pose': '<circle cx="12" cy="4.6" r="2.1"/><path d="M12 7v7M12 9l-5 3M12 9l5-3.5M12 14l-3.5 6M12 14l3.5 6"/>',
    'views': '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1"/><path d="M17.8 3.6l-.3 3.4-3.4-.3"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M6.2 20.4l.3-3.4 3.4.3"/><circle cx="12" cy="12" r="2.2"/>',
    'save': '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19h14"/>',
    'more': '<circle cx="6" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18" cy="12" r="1.4" fill="currentColor"/>',
}
svg = lambda k: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % ICON[k]

html = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
<title>Papercraft Viewer</title><style>
/* a calm studio stage, full bleed; one floating tool bar at the bottom; everything else tucked into one Options sheet */
:root{--scene:#ececf1;--floor:#dcdce4;--shadow:rgba(20,20,30,.30);--label:#1d1d1f;--label2:#6e6e73;--material:rgba(250,250,252,.78);--hair:rgba(0,0,0,.10);
  --tint:#a8670f;--tint-ink:#ffffff;--fill:rgba(118,118,128,.12);--sheet:#f2f2f7;--group:#ffffff;--wire:#d9a030;
  --font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif;--r:14px}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--scene:#1b1b1f;--floor:#2b2b31;--shadow:rgba(0,0,0,.55);--label:#f5f5f7;--label2:#98989d;--material:rgba(36,36,40,.72);--hair:rgba(255,255,255,.12);
  --tint:#e0a447;--tint-ink:#1d1d1f;--fill:rgba(118,118,128,.24);--sheet:#1c1c1e;--group:#2c2c2e;--wire:#f0c060;color-scheme:dark}}
:root[data-theme="dark"]{--scene:#1b1b1f;--floor:#2b2b31;--shadow:rgba(0,0,0,.55);--label:#f5f5f7;--label2:#98989d;--material:rgba(36,36,40,.72);--hair:rgba(255,255,255,.12);
  --tint:#e0a447;--tint-ink:#1d1d1f;--fill:rgba(118,118,128,.24);--sheet:#1c1c1e;--group:#2c2c2e;--wire:#f0c060;color-scheme:dark}
html,body{margin:0;height:100%;background:var(--scene);color:var(--label);font:15px/1.35 var(--font);overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
[hidden]{display:none!important}canvas#c{display:block;width:100%;height:100%}
button,label.btn{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
button:disabled{opacity:.35;cursor:default}:focus-visible{outline:2px solid var(--tint);outline-offset:2px;border-radius:8px}
.glass{background:var(--material);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border:.5px solid var(--hair)}
.top{position:fixed;left:16px;right:16px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;align-items:center;justify-content:space-between;pointer-events:none}
.word{font-weight:600;font-size:17px;letter-spacing:-.01em;pointer-events:auto}
.tr{display:flex;gap:8px}.round{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;pointer-events:auto}
.bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:4px;padding:6px;border-radius:22px}
.joint{position:fixed;width:12px;height:12px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid var(--tint);background:var(--material);pointer-events:none}.tab{min-width:52px;height:52px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;color:var(--label2)}
.tab[aria-pressed="true"]{color:var(--tint);background:var(--fill)}
.panel{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 32px));box-sizing:border-box;border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:12px}
.panel.col{flex-direction:column;align-items:stretch}.panel .line{display:flex;align-items:center;gap:10px}.panel.col>.seg{flex:none}.panel .line .seg{flex:1}.panel .hint{flex:1;min-width:0;font-size:14px;color:var(--label2)}
.panel input[type=range]{flex:1;min-width:0;accent-color:var(--tint)}.small{font-size:13px;color:var(--label2)}
.pill{height:32px;padding:0 14px;border-radius:16px;background:var(--fill);font-size:14px;font-weight:500}.pill.tinted{background:var(--tint);color:var(--tint-ink)}
.seg{display:flex;flex:1;background:var(--fill);border-radius:9px;padding:2px;gap:2px}.seg button{flex:1;height:30px;border-radius:7px;font-size:13px;font-weight:500}
.seg button[aria-pressed="true"]{background:var(--group);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.hello{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 32px));box-sizing:border-box;border-radius:20px;padding:20px;text-align:center}
.hello h1{margin:0 0 6px;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.02em;text-wrap:balance}.hello p{margin:0 0 16px;color:var(--label2);font-size:15px;text-wrap:balance}
.primary{display:flex;align-items:center;justify-content:center;height:50px;border-radius:14px;background:var(--tint);color:var(--tint-ink);font-weight:600;font-size:17px;cursor:pointer}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.25)}
.sheet{position:fixed;left:0;right:0;bottom:0;max-height:78%;overflow:auto;background:var(--sheet);border-radius:16px 16px 0 0;padding:8px 16px calc(24px + env(safe-area-inset-bottom,0px));box-sizing:border-box;touch-action:pan-y}
@media (min-width:640px){.sheet{left:50%;right:auto;width:420px;transform:translateX(-50%)}}
.grab{width:36px;height:5px;border-radius:3px;background:var(--hair);margin:0 auto 6px}
.sheet header{display:flex;align-items:center;justify-content:space-between;margin:4px 0 12px}.sheet h2{margin:0;font-size:17px;font-weight:600}.link{color:var(--tint);font-weight:600;font-size:17px}
.cap{margin:18px 4px 6px;font-size:13px;color:var(--label2);text-transform:uppercase;letter-spacing:.04em}
.group{background:var(--group);border-radius:12px;overflow:hidden}
.row{display:flex;align-items:center;gap:12px;min-height:46px;padding:6px 14px;box-sizing:border-box}.row+.row{border-top:.5px solid var(--hair)}.row>span:first-child{flex:1;min-width:0}
.row input[type=range]{flex:1.4;min-width:0;accent-color:var(--tint)}.row select{font:inherit;color:var(--label2);background:none;border:0;max-width:55%;text-align:right}
.switch{appearance:none;-webkit-appearance:none;width:51px;height:31px;border-radius:16px;background:var(--fill);position:relative;cursor:pointer;flex:none;margin:0;transition:background .2s}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,.2);transition:transform .2s}
.switch:checked{background:#34c759}.switch:checked::after{transform:translateX(20px)}
.act{width:100%;text-align:left;font:inherit;color:inherit}.act b{font-weight:600}.info{margin:10px 4px 0;font-size:13px;color:var(--label2);font-variant-numeric:tabular-nums}
.toast{position:fixed;left:50%;top:calc(56px + env(safe-area-inset-top,0px));transform:translate(-50%,-8px);max-width:calc(100vw - 32px);box-sizing:border-box;padding:10px 16px;border-radius:20px;font-size:14px;opacity:0;transition:opacity .25s,transform .25s;pointer-events:none;text-align:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
.ripple{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:2px solid var(--tint);pointer-events:none;animation:rip .5s ease-out forwards}
@keyframes rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.4);opacity:0}}
@media (prefers-reduced-motion:reduce){.toast,.switch,.switch::after{transition:none}.ripple{animation:none;opacity:0}}
</style></head><body><canvas id="c" aria-label="3D view of the paper model"></canvas>
<input id="file" type="file" accept="image/*,.json,application/json" hidden>
<div class="top"><span class="word">Papercraft</span><span class="tr"><button id="save" class="round glass" aria-label="Save" disabled>''' + svg('save') + '''</button><button id="more" class="round glass" aria-label="Options">''' + svg('more') + '''</button></span></div>
<div id="hello" class="hello glass" hidden><h1>Turn any picture into a paper model</h1><p>Choose a photo or a drawing. Papercraft cuts out the subject and folds it into 3D.</p><label class="primary" for="file">Choose Photo</label></div>
<div id="pDepth" class="panel glass col" hidden><div class="seg" role="group" aria-label="Shape"><button data-shape="card" aria-pressed="false">Card</button><button data-shape="round" aria-pressed="true">Round</button></div><div class="line"><span class="small">Thin</span><input id="thick" type="range" min="0" max="4" step="0.25" value="2" aria-label="Depth"><span class="small">Full</span></div></div>
<div id="pCut" class="panel glass col" hidden><div class="line"><div class="seg" role="group" aria-label="Tap to"><button data-mark="keep" aria-pressed="true">Keep</button><button data-mark="drop" aria-pressed="false">Remove</button></div><button id="undo" class="pill">Undo</button><button id="done" class="pill tinted">Done</button></div><span class="hint" id="cutHint">Tap the person or thing you want to keep.</span></div>
<div id="pPose" class="panel glass col" hidden><div class="seg" role="group" aria-label="Move"><button data-anim="still" aria-pressed="false">Still</button><button data-anim="idle" aria-pressed="true">Idle</button><button data-anim="walk" aria-pressed="false">Walk</button><button data-anim="wave" aria-pressed="false">Wave</button></div><div class="line"><span class="hint" id="poseHint">Drag an arm, a leg or the head to pose it.</span><button id="reset" class="pill">Reset</button></div></div>
<div id="joints" aria-hidden="true"></div>
<div id="pViews" class="panel glass col" hidden><div class="line"><span class="small" style="width:34px">Back</span><div class="seg" role="group" aria-label="Back"><button data-back="mirror" aria-pressed="false">Mirror</button><button data-back="guess" aria-pressed="true">Guess</button><button data-back="picture" aria-pressed="false">Picture</button></div></div>
<div class="line"><span class="small" style="width:34px">Side</span><div class="seg" role="group" aria-label="Side"><button data-side="round" aria-pressed="true">Round</button><button data-side="picture" aria-pressed="false">Picture</button></div><button id="flipSide" class="pill" hidden>Flip</button></div>
<div class="line"><span class="hint" id="viewsHint">The back is guessed from the front. Choose Picture to use a back view.</span><button id="turn" class="pill">Turn</button></div></div>
<input id="fileBack" type="file" accept="image/*" hidden><input id="fileSide" type="file" accept="image/*" hidden>
<div id="pLook" class="panel glass" hidden><div class="seg" role="group" aria-label="Look"><button data-look="clean" aria-pressed="true">Clean</button><button data-look="ps1" aria-pressed="false">PS1</button></div></div>
<nav class="bar glass" aria-label="Tools">
<label class="tab btn" for="file" id="tPhoto">''' + svg('photo') + '''Photo</label>
<button class="tab" id="tCut" aria-pressed="false" disabled>''' + svg('cut') + '''Cut</button>
<button class="tab" id="tDepth" aria-pressed="false">''' + svg('depth') + '''Depth</button>
<button class="tab" id="tViews" aria-pressed="false" disabled>''' + svg('views') + '''Views</button>
<button class="tab" id="tPose" aria-pressed="false" disabled>''' + svg('pose') + '''Pose</button>
<button class="tab" id="tLook" aria-pressed="false">''' + svg('look') + '''Look</button></nav>
<div id="scrim" class="scrim" hidden></div>
<div id="sheet" class="sheet" role="dialog" aria-label="Options" hidden><div class="grab"></div><header><h2>Options</h2><button id="close" class="link">Done</button></header>
<div class="cap">Picture</div><div class="group">
<div class="row"><span>Detail</span><div class="seg" style="flex:1.4" role="group" aria-label="Detail"><button data-detail="96" aria-pressed="false">Low</button><button data-detail="160" aria-pressed="false">Medium</button><button data-detail="256" aria-pressed="true">High</button></div></div>
<div class="row"><span>Cut-out</span><div class="seg" style="flex:1.4" role="group" aria-label="Cut-out"><button data-method="auto" aria-pressed="true">Auto</button><button data-method="key" aria-pressed="false">Backdrop</button><button data-method="photo" aria-pressed="false">Photo</button></div></div>
<div class="row"><span>Backdrop tolerance</span><input id="tol" type="range" min="12" max="120" step="4" value="48" aria-label="Backdrop tolerance"></div>
<div class="row"><span>Keep one piece</span><input id="one" class="switch" type="checkbox" checked aria-label="Keep one piece"></div></div>
<div class="cap">View</div><div class="group">
<div class="row"><span>Turn slowly</span><input id="spin" class="switch" type="checkbox" checked aria-label="Turn slowly"></div>
<div class="row"><span>Show wireframe</span><input id="wire" class="switch" type="checkbox" aria-label="Show wireframe"></div></div>
<div class="cap">Examples from Saga of Koto</div><div class="group">
<div class="row"><span>The whole cast</span><button id="cast" class="link" style="font-size:15px">Show</button></div>
<div class="row"><span>One sprite</span><select id="spr" aria-label="Sprite"></select></div></div>
<p class="info" id="info"></p></div>
<div id="saveSheet" class="sheet" role="dialog" aria-label="Save" hidden><div class="grab"></div><header><h2>Save</h2><button id="saveClose" class="link">Cancel</button></header>
<div class="group">
<button class="row act" data-save="model"><span><b>3D model</b><br><span class="small">.zip with a .glb (most 3D apps and engines; rigged, with Idle, Walk and Wave) and an .obj with its texture</span></span></button>
<button class="row act" data-save="png"><span><b>Cut-out picture</b><br><span class="small">.png at the photo's full size, background transparent</span></span></button>
<button class="row act" data-save="json"><span><b>Papercraft file</b><br><span class="small">.json: the outline and picture, to open here again or load in the game</span></span></button></div>
<p class="info" id="saveInfo"></p></div>
<div id="toast" class="toast glass" role="status"></div>
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
// ---------- state: everything the page shows comes from here ----------
const Q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
const ST = { anim: Q.get('anim') || 'idle', pose: {}, method: 'auto', shape: Q.get('shape') || 'round', mode: Q.get('mode') || (Q.get('s') ? 'one' : 'start'), sprite: Q.get('s') || 'sud/stand', tool: null, look: Q.get('ps1') === '1' ? 'ps1' : 'clean', detail: 256, tol: 48, one: true };
const MINE = { img: null, px: null, full: null, S: null, fullS: null, w: 0, h: 0, marks: [], mark: 'keep', ms: 0, fold: null, method: '' };
// ---------- a tiny renderer: an orbit camera, the SAME fragment shader as the game (PAPER_GLSL.frag) ----------
const cv = $('c'), gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
const vsrc = `attribute vec3 aP;attribute vec2 aT;attribute vec2 aS;uniform mat4 uM;varying vec2 vT;varying vec3 vW;varying float vZ,vSh,vEm;
  void main(){vec4 p=uM*vec4(aP,1.);gl_Position=p;vT=aT;vW=aP;vZ=p.w;vSh=aS.x;vEm=aS.y;}`;
const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const link = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aT'); gl.bindAttribLocation(p, 2, 'aS'); gl.linkProgram(p); return p; };
const prog = link(vsrc, PAPER_GLSL.frag), wprog = link('attribute vec3 aP;uniform mat4 uM;void main(){gl_Position=uM*vec4(aP,1.);}', 'precision mediump float;uniform vec3 uC;void main(){gl_FragColor=vec4(uC,1.);}');
const texOf = (src, rep, old) => { if (old) gl.deleteTexture(old); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); const f = rep === 'smooth' ? gl.LINEAR : gl.NEAREST, wr = rep === true ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  [[gl.TEXTURE_MIN_FILTER, f], [gl.TEXTURE_MAG_FILTER, f], [gl.TEXTURE_WRAP_S, wr], [gl.TEXTURE_WRAP_T, wr]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  if (src.px) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, src.w, src.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(src.px.buffer)); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); return t; };
const TEX = {}, ATLAS_PX = {}; let loaded = 0; const names = Object.keys(SPRITE_POLYS.atlases);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const rgb = c => { const m = c.match(/^#([0-9a-f]{6})$/i); if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255); const n = c.match(/[\\d.]+/g) || [0, 0, 0]; return n.slice(0, 3).map(v => +v / 255); };
const flags = () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#5c5246'; g.fillRect(0, 0, 64, 64); // the town's flagstones, jittered by the prime (the PS1 look)
  for (let y = 0, r = 0; y < 64; y += 16, r++) for (let x = -(r % 2) * 8; x < 64; x += 16) { const k = paperPrime(x * 7 + y), v = 150 + k * 30 | 0; g.fillStyle = `rgb(${v},${v - 8},${v - 22})`; g.fillRect(x + 1, y + 1, 14, 14); } return c; };
const studio = shadowW => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), sc = css('--scene'), fl = css('--floor'); // a soft disc of floor fading into the stage, with a contact shadow
  g.fillStyle = sc; g.fillRect(0, 0, 256, 256); let gr = g.createRadialGradient(128, 128, 8, 128, 128, 127); gr.addColorStop(0, fl); gr.addColorStop(0.35, fl); gr.addColorStop(1, sc); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  if (shadowW) { g.save(); g.translate(128, 128); g.scale(1, 0.32); gr = g.createRadialGradient(0, 0, 0, 0, 0, shadowW); gr.addColorStop(0, css('--shadow')); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, shadowW, 0, 7); g.fill(); g.restore(); }
  return c; };
let groups = [], wire = null, wireN = 0, gbuf = gl.createBuffer(), gN = 0, focus = [0, 0, 12], radius = 60, tris = 0;
function stage(R, shadowW) { // the floor: studio disc (clean) or flagstones (PS1). Shade 1/0.9 so the disc's rim meets the stage colour.
  const ps1 = ST.look === 'ps1', G = ps1 ? 600 : R, u1 = ps1 ? G / 24 : 1, u0 = ps1 ? 0 : 0, s = ps1 ? .85 : 1 / 0.9;
  TEX.ground = ps1 ? texOf(flags(), true, TEX.ground) : texOf(studio(shadowW ? shadowW / R * 128 : 0), 'smooth', TEX.ground);
  const V = [-G, G, 0, u0, u1, s, 0, G, G, 0, u1, u1, s, 0, G, -G, 0, u1, u0, s, 0, -G, G, 0, u0, u1, s, 0, G, -G, 0, u1, u0, s, 0, -G, -G, 0, u0, u0, s, 0];
  if (!ps1) { const D = 2400, c = 1 / 512, P = (a, b) => [Math.cos(a) * Math.cos(b) * D, Math.sin(a) * Math.cos(b) * D, Math.sin(b) * D - 1]; // the studio dome (and a skirt of floor out to it), all the stage colour
    for (let i = 0; i < 32; i++) for (let j = 0; j < 8; j++) { const a0 = i / 32 * 2 * Math.PI, a1 = (i + 1) / 32 * 2 * Math.PI, b0 = j / 8 * Math.PI / 2, b1 = (j + 1) / 8 * Math.PI / 2;
      for (const q of [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b0), P(a1, b1), P(a0, b1)]) V.push(q[0], q[1], q[2], c, c, s, 0); }
    for (let i = 0; i < 32; i++) { const a0 = i / 32 * 2 * Math.PI, a1 = (i + 1) / 32 * 2 * Math.PI; for (const q of [[0, 0], [Math.cos(a0) * D, Math.sin(a0) * D], [Math.cos(a1) * D, Math.sin(a1) * D]]) V.push(q[0], q[1], -1, c, c, s, 0); } }
  gl.bindBuffer(gl.ARRAY_BUFFER, gbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(V), gl.STATIC_DRAW); gN = V.length / 7; }
const depth = () => +$('thick').value;
function build() { // fold every piece on stage; one buffer per texture
  const th = depth(), round = ST.shape === 'round', per = {}, put = (key, h, x, y, ang, flip) => { const S = SPRITE_POLYS.sprites[key]; if (!S) return 0; const at = key.split('/')[0], A = SPRITE_POLYS.atlases[at].size, o = { x, y, ang, flip, s: h / S.rect[3], anchor: S.anchor };
    if (round && ATLAS_PX[at]) paperPuff(per[at] || (per[at] = []), ATLAS_PX[at], A[0], A[1], S.rect, Object.assign(o, { depth: th * h * 0.05 })); else paperSprite(per[at] || (per[at] = []), S, A, Object.assign(o, { thick: th * h / 24 })); return h * S.rect[2] / S.rect[3]; };
  let shadow = 0, R = 120;
  if (ST.mode === 'mine' && MINE.S && ST.tool === 'cut' && MINE.fullS) { const S = MINE.S, hh = Math.min(40, 60 * S.rect[3] / S.rect[2]), s = hh / S.rect[3]; MINE.fold = { s, hh, th: 0 }; MINE.fullS.anchor = S.anchor; // Cut: the whole picture, flat, facing you
    paperSprite(per.cutview = [], MINE.fullS, [MINE.w, MINE.h], { s, thick: 0 }); focus = [0, 0, hh / 2]; radius = Math.max(hh, S.rect[2] * s) * 1.5; shadow = 0; R = Math.max(hh, S.rect[2] * s) * 4.2; }
  else if (ST.mode === 'mine' && MINE.S) { const S = MINE.S, hh = Math.min(40, 60 * S.rect[3] / S.rect[2]), s = hh / S.rect[3], D = th * hh * 0.05; MINE.fold = { s, hh, th: round ? 0 : th * hh / 24 };
    const RG = MINE.rig, P = RG.parts.length, Rg = round ? paperPuff([], MINE.px, MINE.w, MINE.h, [0, 0, MINE.w, MINE.h], { s, depth: D, anchor: S.anchor }).R : 0; // one fullest point for all parts: limbs puff thinner than the body
    MINE.geo = RG.parts.map((pt, k) => { const V = []; const bk = MINE.backDU ? { backDU: MINE.backDU, back: 0.92, shade: [1, 0.9, 0.74] } : {}, SD = MINE.sideFit, Wt = MINE.rigW, Ht = MINE.h * P;
      if (SD && round) { const m = th / 2, floor = 0.35 * s; bk.depthRow = y => { const [f, b] = SD.depth(y); return f + b > 0 ? [Math.max(floor, f * s * m), Math.max(floor, b * s * m)] : [D, D]; }; // the side view's outline: how far the body reaches forward and back at this height
        bk.sideUV = (x, y, dd) => [(2 * MINE.w + Math.max(0.5, Math.min(SD.ws - 0.5, SD.c + dd / s))) / Wt, (k * MINE.h + y) / Ht]; } if (round) paperPuff(V, MINE.rigPx, MINE.rigW, MINE.h * P, [0, k * MINE.h, MINE.w, MINE.h], { s, depth: D, anchor: S.anchor, R: Rg, field: { px: MINE.px, W: MINE.w, rect: [0, 0, MINE.w, MINE.h] }, ...bk }); else if (MINE.rigS[k]) paperSprite(V, MINE.rigS[k], [MINE.rigW, MINE.h * P], { s, thick: MINE.fold.th, ...bk });
      return { V, name: pt.name, parent: pt.parent, dir: pt.dir, pv: [(pt.pivot[0] - S.anchor[0]) * s, 0, (S.anchor[1] - pt.pivot[1]) * s], n: V.length / 7 }; });
    per.rig = [].concat(...MINE.geo.map(g => g.V)); MINE.rest = Float32Array.from(per.rig); MINE.dyn = Float32Array.from(per.rig); focus = [0, 0, hh / 2]; radius = Math.max(hh, S.rect[2] * s) * 1.7; shadow = S.rect[2] * s * 0.55; R = Math.max(hh, S.rect[2] * s) * 4.2; }
  else if (ST.mode === 'cast') { const n0 = 14, look = [150, 260]; // two arcs on the plaza, each piece turned toward the lens and nudged by the prime
    CAST.forEach(([key, h], i) => { const row = i < n0 ? 0 : 1, k = row ? i - n0 : i, n = row ? CAST.length - n0 : n0, x = (k - (n - 1) / 2) * (row ? 30 : 17) + (paperPrime(i) - 0.5) * 5, y = row ? -40 + Math.abs(k - (n - 1) / 2) * 5 : 10 + Math.abs(k - (n - 1) / 2) * 3;
      put(key, h, x, y, Math.atan2(-(look[0] - x), look[1] - y) + (paperPrime(i + 50) - 0.5) * 0.6, paperPrime(i + 99) < 0.3); });
    put(STALKER[0], STALKER[1], -30, -95, 0.3, false); focus = [-20, -25, 12]; radius = 155; R = 420; }
  else { const S = SPRITE_POLYS.sprites[ST.sprite], h = 24 * S.rect[3] / 85, w = put(ST.sprite, h, 0, 0, 0, false), hi = ST.mode === 'start' && !MINE.img; focus = [0, 0, hi ? -h * 0.32 : h / 2]; radius = Math.max(h, w) * (hi ? 2.5 : 1.9); shadow = w * 0.55; R = Math.max(h, w) * 4.2; }
  stage(R, shadow);
  tris = Object.values(per).reduce((n, v) => n + v.length / 21, 0);
  for (const g of groups) gl.deleteBuffer(g.b);
  groups = Object.entries(per).map(([at, v]) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), at === 'rig' ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return { at, b, n: v.length / 7 }; });
  const L = []; for (const v of Object.values(per)) for (let t = 0; t < v.length / 7; t += 3) for (let i = 0; i < 3; i++) { const a = (t + i) * 7, b = (t + (i + 1) % 3) * 7; L.push(v[a], v[a + 1], v[a + 2], v[b], v[b + 1], v[b + 2]); }
  wire = wire || gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, wire); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.STATIC_DRAW); wireN = L.length / 3;
  info(); }
function info() { $('info').textContent = (ST.mode === 'mine' && MINE.S ? `Your picture: ${MINE.w} × ${MINE.h} px, cut as a ${MINE.method === 'photo' ? 'photo (subject learned)' : MINE.method === 'key' ? 'plain backdrop' : 'picture with its own transparency'}, ${MINE.S.pts.length / 2} corners, ${MINE.ms | 0} ms; rig: ${MINE.rig && MINE.rig.humanoid ? 'head, torso, arms, legs' : 'one piece'}. ` : '') + `${tris} triangles on stage. Prime ${PAPER.PRIME}.`; }
// ---------- the camera ----------
const cam = { yaw: +(Q.get('yaw') || 0.5), pitch: +(Q.get('pitch') || 0.22), zoom: +(Q.get('dist') || 0), to: null };
function eye() { const d = cam.zoom || radius * 1.6, [tx, ty, tz] = focus, cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const e = [tx + Math.sin(cam.yaw) * cp * d, ty + Math.cos(cam.yaw) * cp * d, tz + sp * d], f = [tx - e[0], ty - e[1], tz - e[2]], fl = Math.hypot(...f); f[0] /= fl; f[1] /= fl; f[2] /= fl;
  let r = [-f[1], f[0], 0]; const rl = Math.hypot(r[0], r[1]); r = [r[0] / rl, r[1] / rl, 0]; const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]]; return { e, f, r, u }; } // x east, y SOUTH, z up is left-handed: right = up x forward, up = forward x right (no mirror)
const FOV = 1 / Math.tan(0.4);
function matrix(w, h) { // perspective * lookAt(focus), z up
  const { e, f, r, u } = eye(), V = [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), (f[0] * e[0] + f[1] * e[1] + f[2] * e[2]), 1];
  const n = 1, fa = 4000, t = FOV, a = w / h, P = [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, -(fa + n) / (fa - n), -1, 0, 0, -2 * fa * n / (fa - n), 0];
  const M = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + j] * V[i * 4 + k]; M[i * 4 + j] = s; } return M; }
let last = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
  if (cam.to) { const k = 1 - Math.exp(-dt * 9); let dy = ((cam.to.yaw - cam.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; cam.yaw += dy * k; cam.pitch += (cam.to.pitch - cam.pitch) * k; if (Math.abs(dy) + Math.abs(cam.to.pitch - cam.pitch) < 0.002) { cam.yaw = cam.to.yaw; cam.pitch = cam.to.pitch; } }
  else if ($('spin').checked && !held && ST.tool !== 'cut') cam.yaw += dt * 0.3;
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth * dpr | 0, h = cv.clientHeight * dpr | 0; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ps1 = ST.look === 'ps1', sc = ps1 ? [0.55, 0.62, 0.7] : rgb(css('--scene'));
  gl.viewport(0, 0, w, h); gl.clearColor(sc[0], sc[1], sc[2], 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); // faces are wound counter-clockwise seen from outside, and this camera does not mirror the world
  if (rigLive()) { applyPose(now / 1000); joints(now / 1000); } else $('joints').innerHTML = '';
  const M = matrix(w, h); gl.useProgram(prog); for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uM'), false, M); const U = n => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uSheet'), 7); gl.uniform1f(U('uAmb'), 0.9); gl.uniform1f(U('uFogD'), 5); gl.uniform1f(U('uZc'), 0); gl.uniform1f(U('uGlow'), 0); gl.uniform1f(U('uDS'), w / 240); gl.uniform2f(U('uRes'), w, h);
  gl.uniform1f(U('uTime'), now / 1000 % 1000); gl.uniform3f(U('uTint'), 1, 1, 1); gl.uniform1f(U('uDesat'), 0.2); gl.uniform1f(U('uGrade'), ps1 ? 1 : 0); gl.uniform3f(U('uFogC'), sc[0], sc[1], sc[2]); gl.uniform3fv(U('uLW[0]'), new Float32Array(24));
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); gl.activeTexture(gl.TEXTURE7);
  const draw = (b, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 20); gl.drawArrays(gl.TRIANGLES, 0, n); };
  gl.disable(gl.CULL_FACE); gl.bindTexture(gl.TEXTURE_2D, TEX.ground); draw(gbuf, gN); gl.enable(gl.CULL_FACE);
  for (const g of groups) if (TEX[g.at]) { gl.bindTexture(gl.TEXTURE_2D, TEX[g.at]); draw(g.b, g.n); }
  gl.disable(gl.POLYGON_OFFSET_FILL);
  if ($('wire').checked && wire) { gl.useProgram(wprog); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.uniformMatrix4fv(gl.getUniformLocation(wprog, 'uM'), false, M); gl.uniform3fv(gl.getUniformLocation(wprog, 'uC'), rgb(css('--wire'))); gl.bindBuffer(gl.ARRAY_BUFFER, wire); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.drawArrays(gl.LINES, 0, wireN); }
  requestAnimationFrame(frame); }
// ---------- the rig in motion: each part turns about its pivot, in the picture's plane (Paper Mario) or swinging forward and back (Minecraft) ----------
const LOOP = { idle: 4, walk: 0.9, wave: 1.4 }; // seconds per loop (what the saved animations use)
function poseNow(t, an0) { // per part: th (turn in the picture's plane, counter-clockwise as seen from the front), ph (swing forward / back); plus the body's bob and lean
  const G = MINE.geo, A = {}; let bob = 0; for (const g of G) A[g.name] = { th: ST.pose[g.name] || 0, ph: 0 }; const hh = MINE.fold.hh, an = an0 || ST.anim, has = n => A[n];
  const hang = k => has(k) ? -G.find(g => g.name === k).dir * 0.9 : 0; // arms out (a T-pose) come down to hang by the sides when walking
  if (an === 'idle') { const b = Math.sin(t * 2 * Math.PI / 2); bob = (b * 0.5 + 0.5) * 0.012 * hh; if (has('head')) A.head.th += 0.06 * Math.sin(t * 2 * Math.PI / 4); if (has('armL')) A.armL.th -= 0.05 * b; if (has('armR')) A.armR.th += 0.05 * b; A.torso.th += 0.015 * Math.sin(t * 2 * Math.PI / 4); } // loops every 4 s
  if (an === 'walk') { const p = t * 2 * Math.PI / 0.9, w = Math.sin(p); bob = Math.abs(Math.cos(p)) * 0.025 * hh; if (has('legL')) { A.legL.ph += 0.55 * w; A.legR.ph -= 0.55 * w; } if (has('armL')) { A.armL.ph -= 0.45 * w; A.armR.ph += 0.45 * w; A.armL.th += hang('armL'); A.armR.th += hang('armR'); } if (has('head')) A.head.th += 0.04 * Math.sin(p * 2); }
  if (an === 'wave') { if (has('armR')) A.armR.th += hang('armR') + 2.55 + 0.38 * Math.sin(t * 2 * Math.PI / 0.7); if (has('armL')) A.armL.th += hang('armL') * 0.5; if (has('head')) A.head.th += 0.08 * Math.sin(t * 2 * Math.PI / 1.4); bob = 0.006 * hh * Math.sin(t * 2 * Math.PI / 0.7); }
  return { A, bob }; }
function applyPose(t) { // rest mesh -> posed mesh: a part turns about its own pivot, then everything turns with the torso about the hips and bobs
  const G = MINE.geo, { A, bob } = poseNow(t), out = MINE.dyn, rest = MINE.rest, T = G.find(g => g.name === 'torso'), tA = A.torso, tc = Math.cos(tA.th), ts = Math.sin(tA.th); let o = 0;
  for (const g of G) { const a = A[g.name], c = Math.cos(a.th), sn = Math.sin(a.th), cp = Math.cos(a.ph), sp = Math.sin(a.ph), [px, py, pz] = g.pv, own = g.name !== 'torso';
    for (let i = 0; i < g.n; i++, o += 7) { let x = rest[o], y = rest[o + 1], z = rest[o + 2];
      if (own) { let dx = x - px, dz = z - pz; x = px + c * dx - sn * dz; z = pz + sn * dx + c * dz; const dy = y - py; dz = z - pz; y = py + cp * dy - sp * dz; z = pz + sp * dy + cp * dz; }
      const dx = x - T.pv[0], dz = z - T.pv[2]; out[o] = T.pv[0] + tc * dx - ts * dz; out[o + 1] = y; out[o + 2] = T.pv[2] + ts * dx + tc * dz + bob; } }
  const g = groups.find(q => q.at === 'rig'); if (g) { gl.bindBuffer(gl.ARRAY_BUFFER, g.b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, out); } }
const pivotNow = (name, t) => { const G = MINE.geo, g = G.find(q => q.name === name), T = G.find(q => q.name === 'torso'), { A, bob } = poseNow(t), tc = Math.cos(A.torso.th), ts = Math.sin(A.torso.th), dx = g.pv[0] - T.pv[0], dz = g.pv[2] - T.pv[2];
  return [T.pv[0] + tc * dx - ts * dz, g.pv[1], T.pv[2] + ts * dx + tc * dz + bob]; };
function toScreen(P) { const rc = cv.getBoundingClientRect(), M = matrix(rc.width, rc.height), q = [0, 1, 2, 3].map(j => P[0] * M[j] + P[1] * M[4 + j] + P[2] * M[8 + j] + M[12 + j]); return [rc.left + (q[0] / q[3] + 1) / 2 * rc.width, rc.top + (1 - q[1] / q[3]) / 2 * rc.height]; }
const rigLive = () => ST.mode === 'mine' && MINE.geo && ST.tool !== 'cut' && groups.some(g => g.at === 'rig');
function joints(t) { const box = $('joints'); if (!(rigLive() && ST.tool === 'pose' && MINE.rig.humanoid)) { box.innerHTML = ''; return; }
  const G = MINE.geo; while (box.children.length < G.length) { const d = document.createElement('div'); d.className = 'joint'; box.appendChild(d); } while (box.children.length > G.length) box.lastChild.remove();
  G.forEach((g, k) => { const [x, y] = toScreen(pivotNow(g.name, t)); box.children[k].style.left = x + 'px'; box.children[k].style.top = y + 'px'; }); }
let grab = null; // a part being posed by a drag
function pickPart(x, y) { const rc = cv.getBoundingClientRect(), M = matrix(rc.width, rc.height), G = MINE.geo, out = MINE.dyn; let best = null, bd = 44 * 44, o = 0;
  G.forEach(g => { for (let i = 0; i < g.n; i++, o += 7) { if (i % 3) continue; const q = [0, 1, 2, 3].map(j => out[o] * M[j] + out[o + 1] * M[4 + j] + out[o + 2] * M[8 + j] + M[12 + j]), sx = rc.left + (q[0] / q[3] + 1) / 2 * rc.width, sy = rc.top + (1 - q[1] / q[3]) / 2 * rc.height, d = (sx - x) ** 2 + (sy - y) ** 2 + (g.name === 'torso' ? 400 : 0); /* limbs win over the torso when both are near the finger */
    if (d < bd) { bd = d; best = g.name; } } }); return best; }
// ---------- touch: drag to turn, pinch or wheel to zoom, tap to keep / remove (in Cut), double-tap to reset ----------
const pts = new Map(); let held = false, pd = 0, down = null, lastTap = 0;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); held = true; cam.to = null; grab = null;
  if (ST.tool === 'pose' && rigLive() && MINE.rig.humanoid && pts.size === 1) { const nm = pickPart(e.clientX, e.clientY); if (nm) { const [px, py] = toScreen(pivotNow(nm, performance.now() / 1000)); grab = { nm, a: Math.atan2(-(e.clientY - py), e.clientX - px) }; } } if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() }; else down = null; closeSheet(); });
cv.addEventListener('pointermove', e => { const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) cam.zoom = Math.max(10, Math.min(3000, (cam.zoom || radius * 1.6) * pd / d)); pd = d; return; }
  if (grab && pts.size === 1) { const [px, py] = toScreen(pivotNow(grab.nm, performance.now() / 1000)), a = Math.atan2(-(e.clientY - py), e.clientX - px); let d = a - grab.a; d = Math.atan2(Math.sin(d), Math.cos(d)); ST.pose[grab.nm] = (ST.pose[grab.nm] || 0) + (Math.cos(cam.yaw) >= 0 ? d : -d); grab.a = a; return; }
  if (ST.tool === 'cut') return; cam.yaw -= dx * 0.006; cam.pitch = Math.max(0.02, Math.min(1.45, cam.pitch + dy * 0.005)); });
const up = e => { pts.delete(e.pointerId); pd = 0; if (!pts.size) { held = false; if (grab) { grab = null; down = null; return; } }
  if (down && e.type === 'pointerup' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 400) {
    if (ST.tool === 'cut') markAt(e.clientX, e.clientY); else { const t = performance.now(); if (t - lastTap < 320) { cam.zoom = 0; cam.to = { yaw: 0.5, pitch: 0.22 }; } lastTap = t; } }
  down = null; };
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = Math.max(10, Math.min(3000, (cam.zoom || radius * 1.6) * (1 + e.deltaY * 0.001))); }, { passive: false });
function markAt(x, y) { // cast a ray from the tap onto the picture's face: that spot is to keep, or to remove
  if (ST.mode !== 'mine' || !MINE.S || !MINE.fold) return; const rc = cv.getBoundingClientRect(), nx = (x - rc.left) / rc.width * 2 - 1, ny = 1 - (y - rc.top) / rc.height * 2, a = rc.width / rc.height, { e, f, r, u } = eye();
  const d = [0, 1, 2].map(i => f[i] + r[i] * nx * a / FOV + u[i] * ny / FOV), yp = (e[1] >= 0 ? 1 : -1) * MINE.fold.th / 2; if (Math.abs(d[1]) < 1e-6) return;
  const l = (yp - e[1]) / d[1], X = e[0] + l * d[0], Z = e[2] + l * d[2], s = MINE.fold.s, A = MINE.S.anchor, U = (X / s + A[0]) / MINE.w, V = (A[1] - Z / s) / MINE.h;
  if (l <= 0 || U < 0 || V < 0 || U > 1 || V > 1) return; const rp = document.createElement('div'); rp.className = 'ripple'; rp.style.left = x + 'px'; rp.style.top = y + 'px'; document.body.appendChild(rp); setTimeout(() => rp.remove(), 600);
  MINE.marks.push([U, V, MINE.mark === 'keep']); $('undo').disabled = false; makeMine(); }
window.screenOf = (U, V) => { // where a point of your picture's front face is on screen (used by the tests)
  const s = MINE.fold.s, A = MINE.S.anchor, P = [(U * MINE.w - A[0]) * s, MINE.fold.th / 2, (A[1] - V * MINE.h) * s, 1], rc = cv.getBoundingClientRect(), M = matrix(rc.width, rc.height), o = [0, 1, 2, 3].map(j => P[0] * M[j] + P[1] * M[4 + j] + P[2] * M[8 + j] + P[3] * M[12 + j]);
  return [rc.left + (o[0] / o[3] + 1) / 2 * rc.width, rc.top + (1 - o[1] / o[3]) / 2 * rc.height]; };
// ---------- the tools: Photo, Cut, Depth, Look (one panel at a time) ----------
const PANELS = { cut: 'pCut', depth: 'pDepth', views: 'pViews', pose: 'pPose', look: 'pLook' }, TABS = { cut: 'tCut', depth: 'tDepth', views: 'tViews', pose: 'tPose', look: 'tLook' };
function setTool(t) { if (ST.tool === t) t = null; const was = ST.tool; ST.tool = t; for (const k in PANELS) { $(PANELS[k]).hidden = k !== t; $(TABS[k]).setAttribute('aria-pressed', k === t); }
  if (t === 'views' && MINE.img && ST.mode !== 'mine') { ST.mode = 'mine'; build(); }
  if (t === 'pose' && MINE.img) { if (ST.mode !== 'mine') { ST.mode = 'mine'; build(); } cam.zoom = 0; cam.to = { yaw: 0, pitch: 0.12 }; }
  if (t === 'cut' && MINE.img) { ST.mode = 'mine'; cam.zoom = 0; cam.to = { yaw: 0, pitch: 0.06 }; $('undo').disabled = !MINE.marks.length; }
  if ((t === 'cut') !== (was === 'cut') && MINE.img) build(); // Cut shows the whole picture, with what is removed dimmed
  refreshHello(); }
for (const b of document.querySelectorAll('[data-mark]')) b.onclick = () => { MINE.mark = b.dataset.mark; document.querySelectorAll('[data-mark]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('cutHint').textContent = MINE.mark === 'keep' ? 'Tap the person or thing you want to keep.' : 'Tap what you want removed.'; };
$('tCut').onclick = () => setTool('cut'); $('tPose').onclick = () => setTool('pose');
for (const b of document.querySelectorAll('[data-anim]')) b.onclick = () => { ST.anim = b.dataset.anim; document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x === b)); if (ST.anim === 'walk') { cam.zoom = 0; cam.to = { yaw: 0.9, pitch: 0.18 }; } };
$('reset').onclick = () => { ST.pose = {}; };
$('tViews').onclick = () => setTool('views'); $('turn').onclick = () => { cam.zoom = 0; cam.to = { yaw: Math.cos(cam.yaw) > 0 ? Math.PI : 0, pitch: 0.12 }; };
for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { if (b.dataset.back === 'picture' && !MINE.backC) { $('fileBack').click(); return; } MINE.backMode = b.dataset.back; rigMine(true); build(); };
for (const b of document.querySelectorAll('[data-side]')) b.onclick = () => { if (b.dataset.side === 'picture') { if (!MINE.sideC) { $('fileSide').click(); return; } MINE.sideMode = 'picture'; } else MINE.sideMode = 'round'; rigMine(true); build(); };
$('flipSide').onclick = () => { MINE.sideFacing = MINE.sideFit && MINE.sideFit.facing === 'right' ? 'left' : 'right'; rigMine(true); build(); };
$('fileSide').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); im.onload = () => { toast('Fitting the side view…', true); setTimeout(() => {
  MINE.sideC = paperCutout(im, { max: ST.detail, tol: ST.tol, one: true, method: ST.method }); MINE.sideMode = 'picture'; MINE.sideFacing = null; rigMine(true); build(); hideToast(); cam.zoom = 0; cam.to = { yaw: -Math.PI / 2 + 0.2, pitch: 0.12 }; window.SIDE_DONE = (window.SIDE_DONE || 0) + 1; }, 30); };
  im.onerror = () => toast('That file could not be opened as a picture.'); im.src = URL.createObjectURL(f); e.target.value = ''; };
$('fileBack').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); im.onload = () => { toast('Fitting the back view…', true); setTimeout(() => {
  MINE.backImg = im; MINE.backC = paperCutout(im, { max: ST.detail, tol: ST.tol, one: true, method: ST.method }); MINE.backMode = 'picture'; rigMine(true); build(); hideToast(); cam.zoom = 0; cam.to = { yaw: Math.PI, pitch: 0.12 }; window.BACK_DONE = (window.BACK_DONE || 0) + 1; }, 30); };
  im.onerror = () => toast('That file could not be opened as a picture.'); im.src = URL.createObjectURL(f); e.target.value = ''; }; $('tDepth').onclick = () => setTool('depth'); $('tLook').onclick = () => setTool('look'); $('done').onclick = () => setTool(null);
$('undo').onclick = () => { MINE.marks.pop(); $('undo').disabled = !MINE.marks.length; makeMine(); };
$('thick').oninput = build;
for (const b of document.querySelectorAll('[data-shape]')) b.onclick = () => { ST.shape = b.dataset.shape; document.querySelectorAll('[data-shape]').forEach(x => x.setAttribute('aria-pressed', x === b)); build(); };
for (const b of document.querySelectorAll('[data-look]')) b.onclick = () => { ST.look = b.dataset.look; document.querySelectorAll('[data-look]').forEach(x => x.setAttribute('aria-pressed', x === b)); build(); };
// ---------- Options sheet ----------
function openSheet() { info(); $('sheet').hidden = $('scrim').hidden = false; } function closeSheet() { $('sheet').hidden = $('scrim').hidden = true; }
$('more').onclick = openSheet; $('close').onclick = closeSheet; $('scrim').onclick = closeSheet;
for (const b of document.querySelectorAll('[data-detail]')) b.onclick = () => { ST.detail = +b.dataset.detail; document.querySelectorAll('[data-detail]').forEach(x => x.setAttribute('aria-pressed', x === b)); makeMine(); };
for (const b of document.querySelectorAll('[data-method]')) b.onclick = () => { ST.method = b.dataset.method; document.querySelectorAll('[data-method]').forEach(x => x.setAttribute('aria-pressed', x === b)); makeMine(); };
let redo = 0; $('tol').oninput = () => { ST.tol = +$('tol').value; clearTimeout(redo); redo = setTimeout(makeMine, 120); }; $('one').onchange = () => { ST.one = $('one').checked; makeMine(); };
$('cast').onclick = () => { ST.mode = 'cast'; setTool(null); cam.zoom = 0; cam.to = { yaw: 0.5, pitch: 0.42 }; build(); closeSheet(); };
{ const sel = $('spr'); for (const at of names) { const og = document.createElement('optgroup'); og.label = at; for (const k of Object.keys(SPRITE_POLYS.sprites)) if (k.startsWith(at + '/')) { const o = document.createElement('option'); o.value = k; o.textContent = k.split('/')[1]; og.appendChild(o); } sel.appendChild(og); }
  sel.value = ST.sprite; sel.onchange = () => { ST.sprite = sel.value; ST.mode = 'one'; setTool(null); cam.zoom = 0; build(); closeSheet(); }; }
// ---------- the rig of your picture (paperRig): its parts, laid out one under another in a texture of their own ----------
function backNow() { // the back, in the front's own pixels: a back view fitted to the front (gaps filled by the guess), the guess, or none (Mirror)
  if (MINE.backMode === 'mirror') return null; const head = MINE.rig && MINE.rig.humanoid ? MINE.rig.parts.find(q => q.name === 'head').mask : null, guess = paperGuessBack(MINE.px, MINE.w, MINE.h, head);
  if (MINE.backMode !== 'picture' || !MINE.backC) return guess;
  const fit = paperFitView(MINE.px, MINE.w, MINE.h, MINE.backC.px, MINE.backC.w, MINE.backC.h, { mirror: true }); let hit = 0, all = 0;
  for (let i = 0; i < MINE.w * MINE.h; i++) { if (MINE.px[i * 4 + 3] < 128) continue; all++; if (fit[i * 4 + 3]) hit++; else for (let c = 0; c < 4; c++) fit[i * 4 + c] = guess[i * 4 + c]; } MINE.backFit = all ? hit / all : 0; return fit; }
function sideNow() { // the side view fitted to the front's rows, its empty pixels filled from the nearest paint (side faces must never sample air)
  if (MINE.sideMode !== 'picture' || !MINE.sideC) return null; const F = paperFitSide(MINE.px, MINE.w, MINE.h, MINE.sideC.px, MINE.sideC.w, MINE.sideC.h, { facing: MINE.sideFacing }); if (!F) return null;
  const { px, ws } = F, h = MINE.h, rowOn = y => { for (let x = 0; x < ws; x++) if (px[(y * ws + x) * 4 + 3]) return true; return false; };
  for (let y = 0; y < h; y++) { if (!rowOn(y)) continue; let last = -1; for (let x = 0; x < ws; x++) { const o = (y * ws + x) * 4; if (px[o + 3]) last = o; else if (last >= 0) { px[o] = px[last]; px[o + 1] = px[last + 1]; px[o + 2] = px[last + 2]; px[o + 3] = 255; } }
    let first = -1; for (let x = 0; x < ws; x++) if (px[(y * ws + x) * 4 + 3]) { first = (y * ws + x) * 4; break; } for (let x = 0; x < ws; x++) { const o = (y * ws + x) * 4; if (px[o + 3]) break; px[o] = px[first]; px[o + 1] = px[first + 1]; px[o + 2] = px[first + 2]; px[o + 3] = 255; } }
  let near = -1; const rows = []; for (let y = 0; y < h; y++) rows.push(rowOn(y)); for (let y = 0; y < h; y++) { if (rows[y]) { near = y; continue; } let src = near; for (let yy = y + 1; yy < h && src < 0; yy++) if (rows[yy]) src = yy; if (src >= 0) px.copyWithin(y * ws * 4, src * ws * 4, (src + 1) * ws * 4); }
  return F; }
function rigMine(keepRig) { const R = MINE.rig = keepRig && MINE.rig ? MINE.rig : paperRig(MINE.px, MINE.w, [0, 0, MINE.w, MINE.h]), P = R.parts.length, w = MINE.w, h = MINE.h, SD = MINE.sideFit = sideNow(), ws = SD ? SD.ws : 0, W2 = 2 * w + ws, px = new Uint8ClampedArray(W2 * h * 4 * P);
  if (!keepRig) MINE.backMode = MINE.backMode || (R.humanoid ? 'guess' : 'mirror'); const B = backNow(); MINE.backDU = 0; // texture: each part one row, front on the left half, back on the right
  R.parts.forEach((pt, k) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, o = ((k * h + y) * W2 + x) * 4, ob = o + w * 4, a = pt.mask[i] && MINE.px[i * 4 + 3] >= 128 ? 255 : 0;
    px[o] = MINE.px[i * 4]; px[o + 1] = MINE.px[i * 4 + 1]; px[o + 2] = MINE.px[i * 4 + 2]; px[o + 3] = a; const src = B || MINE.px; px[ob] = src[i * 4]; px[ob + 1] = src[i * 4 + 1]; px[ob + 2] = src[i * 4 + 2]; px[ob + 3] = a; }
    if (SD) for (let y = 0; y < h; y++) px.set(SD.px.subarray(y * ws * 4, (y + 1) * ws * 4), ((k * h + y) * W2 + 2 * w) * 4); }); // and the side view, the same in every row of parts
  MINE.backDU = B ? w / W2 : 0; MINE.rigPx = px; MINE.rigW = W2; MINE.rigS = R.parts.map((pt, k) => paperTrace(px, W2, [0, k * h, w, h])); TEX.rig = texOf({ px, w: W2, h: h * P }, false, TEX.rig);
  document.querySelectorAll('[data-back]').forEach(x => x.setAttribute('aria-pressed', x.dataset.back === MINE.backMode)); $('tViews').disabled = false;
  document.querySelectorAll('[data-side]').forEach(x => x.setAttribute('aria-pressed', x.dataset.side === (SD ? 'picture' : 'round'))); $('flipSide').hidden = !SD;
  $('viewsHint').textContent = SD ? `Side view in: depth from its outline, its paint on the sides (facing ${SD.facing === 'right' ? 'right' : 'left'} in the picture). ` + (MINE.backMode === 'picture' && MINE.backC ? 'Back from your back view.' : MINE.backMode === 'guess' ? 'Back guessed.' : 'Back mirrored.') : MINE.backMode === 'mirror' ? 'The back shows the front, mirrored and darker.' : MINE.backMode === 'guess' ? 'The back is guessed from the front: hair over the head, clothes without the details.' : MINE.backC ? `Your back view, fitted to the front (${Math.round((MINE.backFit || 0) * 100)}% matched; the rest is guessed).` : 'Choose a back view: the same figure, from behind.';
  $('tPose').disabled = false; $('poseHint').textContent = R.humanoid ? 'Drag an arm, a leg or the head to pose it.' : 'No arms or legs found: it moves as one piece.'; ST.pose = {}; }
// ---------- your picture: cut out (paperCutout), traced (paperTrace), folded (paperSprite), all on this device ----------
let toastT = 0; function toast(m, stay) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); if (!stay) toastT = setTimeout(hideToast, 3400); } function hideToast() { $('toast').classList.remove('on'); }
let busy = 0, again = false;
function makeMine(first) { if (!MINE.img) return; if (busy) { again = true; return; } busy = 1; // the cut can take a second on a phone: say so, let the screen paint, then work
  toast('Finding the subject…', true); setTimeout(() => { try { cutNow(first); } finally { busy = 0; if (again) { again = false; makeMine(); } else hideToast(); window.CUT_DONE = (window.CUT_DONE || 0) + 1; } }, 30); }
function cutNow(first) { const t0 = performance.now();
  const C = paperCutout(MINE.img, { max: ST.detail, tol: ST.tol, one: ST.one, keep: MINE.marks.filter(m => m[2]).map(m => [m[0], m[1]]), drop: MINE.marks.filter(m => !m[2]).map(m => [m[0], m[1]]), method: ST.method });
  MINE.S = paperTrace(C.px, C.w, [0, 0, C.w, C.h]); if (MINE.S) { const P = MINE.S.pts; let x0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < P.length; i += 2) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y1 = Math.max(y1, P[i + 1]); } MINE.S.anchor = [(x0 + x1) / 2, y1]; } // it stands on its lowest painted pixel
  MINE.w = C.w; MINE.px = C.px; MINE.h = C.h; rigMine(); MINE.ms = performance.now() - t0; MINE.method = C.method; TEX.mine = texOf(C, false, TEX.mine);
  { const v = new Uint8ClampedArray(C.full); for (let i = 0; i < C.w * C.h; i++) { if (!C.px[i * 4 + 3]) { const l = 0.299 * v[i * 4] + 0.587 * v[i * 4 + 1] + 0.114 * v[i * 4 + 2], k = ((i % C.w) + ((i / C.w) | 0)) % 6 < 3 ? 0.22 : 0.3; v[i * 4] = v[i * 4 + 1] = v[i * 4 + 2] = l * k + 18; } v[i * 4 + 3] = 255; } /* the Cut view: removed parts dark, grey and lightly striped */
    TEX.cutview = texOf({ px: v, w: C.w, h: C.h }, false, TEX.cutview); MINE.fullS = paperTrace(new Uint8ClampedArray(C.w * C.h * 4).fill(255), C.w, [0, 0, C.w, C.h]); }
  let air = 0; for (let i = 3; i < C.px.length; i += 4) if (!C.px[i]) air++;
  if (!MINE.S) { toast('Everything was removed. Tap Undo, or tap Keep on what you want.'); groups = []; tris = 0; return; }
  if (first && (!air || C.method === 'photo')) setTimeout(() => toast(C.method === 'photo' ? 'Not quite right? Tap Cut, then tap what to keep or remove.' : 'No background found. Tap Cut, then Remove, and tap it.'), 400);
  ST.mode = 'mine'; $('save').disabled = false; build(); }
$('file').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); MINE.name = (f.name || 'papercraft').replace(/\\.papercraft\\.json$|\\.[^.]+$/, '').replace(/[^\\w-]+/g, '-').slice(0, 40) || 'papercraft';
  if (/json/.test(f.type) || /\\.json$/i.test(f.name)) { f.text().then(t => { try { const r = JSON.parse(t); if (!r.picture) throw 0; im.src = r.picture; if (r.shape) { ST.shape = r.shape; document.querySelectorAll('[data-shape]').forEach(x => x.setAttribute('aria-pressed', x.dataset.shape === ST.shape)); document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x.dataset.anim === ST.anim)); } if (r.depth != null) $('thick').value = r.depth; } catch (_) { toast('That is not a Papercraft file.'); } }); e.target.value = ''; }
  im.onload = () => { MINE.img = im; MINE.marks = []; MINE.backMode = null; MINE.backC = null; MINE.backImg = null; MINE.sideMode = null; MINE.sideC = null; MINE.sideFacing = null; $('tCut').disabled = false; setTool(null); cam.zoom = 0; cam.to = { yaw: 0.5, pitch: 0.22 }; makeMine(true); refreshHello(); window.MINE_READY = (window.MINE_READY || 0) + 1; };
  im.onerror = () => toast('That file could not be opened as a picture.'); if (!im.src) im.src = URL.createObjectURL(f); e.target.value = ''; };
function refreshHello() { $('hello').hidden = !(ST.mode === 'start' && !MINE.img && !ST.tool); }
// ---------- Save: a 3D model (.zip: .glb + .obj/.mtl/.png), the cut-out (.png, full size) or a Papercraft file (.json) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function zip(files) { // a plain .zip (stored, no compression): [{name, data: Uint8Array}]
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
  for (const f of files) { const nm = enc.encode(f.name), d = f.data; let c = 0xffffffff; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); c = (c ^ 0xffffffff) >>> 0;
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
    const e = new DataView(new ArrayBuffer(46)); e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint32(16, c, true); e.setUint32(20, d.length, true); e.setUint32(24, d.length, true); e.setUint16(28, nm.length, true); e.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), nm, d); cd.push(new Uint8Array(e.buffer), nm); off += 30 + nm.length + d.length; }
  const cdl = cd.reduce((n, a) => n + a.length, 0), end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdl, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...cd, new Uint8Array(end.buffer)], { type: 'application/zip' }); }
const pngOf = (px, w, h) => new Promise(res => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px), w, h), 0, 0); c.toBlob(b => b.arrayBuffer().then(a => res(new Uint8Array(a))), 'image/png'); });
function meshNow() { // the model on stage, as parts (each its rest mesh in the 7-float paper format, a pivot and a parent) with one texture
  if (ST.mode === 'mine' && MINE.S && MINE.geo) return { parts: MINE.geo.map(g => ({ name: g.name, parent: g.parent, pv: g.pv, V: g.V })), hh: MINE.fold.hh, px: MINE.rigPx, w: MINE.rigW, h: MINE.h * MINE.rig.parts.length, name: MINE.name || 'papercraft', rig: true };
  if (ST.mode === 'one' || ST.mode === 'start') { const key = ST.sprite, S = SPRITE_POLYS.sprites[key], at = key.split('/')[0], A = SPRITE_POLYS.atlases[at].size, hh = 24 * S.rect[3] / 85, s = hh / S.rect[3], th = depth(), V = [];
    if (ST.shape === 'round') paperPuff(V, ATLAS_PX[at], A[0], A[1], S.rect, { s, depth: th * hh * 0.05, anchor: S.anchor }); else paperSprite(V, S, A, { s, thick: th * hh / 24, anchor: S.anchor });
    return { parts: [{ name: key.split('/')[1], parent: -1, pv: [0, 0, 0], V }], hh, px: ATLAS_PX[at], w: A[0], h: A[1], name: key.split('/')[1], rig: false }; }
  return null; }
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const G3 = (p, k) => [p[0] * k, p[2] * k, p[1] * k]; // world (x east, y south, z up) -> glTF (x, y up, z toward the viewer), metres; also turns left- into right-handed
async function modelZip(m) { // glTF 2.0 binary: a node per part at its pivot (a rig), its mesh around that pivot, Idle / Walk / Wave as animations; plus an .obj of the rest pose
  const k = 1 / m.hh, png = await pngOf(m.px, m.w, m.h), pad4 = x => (x + 3) & ~3, chunks = [], views = [], acc = []; let off = 0;
  const view = (u8, target) => { views.push({ buffer: 0, byteOffset: off, byteLength: u8.length, ...(target ? { target } : {}) }); chunks.push([off, u8]); off = pad4(off + u8.length); return views.length - 1; };
  const accessor = (f32, type, extra) => { acc.push({ bufferView: view(new Uint8Array(f32.buffer), extra && extra.anim ? 0 : 34962), componentType: 5126, count: f32.length / { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[type], type, ...(extra && extra.mm || {}) }); if (extra && extra.anim) delete views[views.length - 1].target; return acc.length - 1; };
  const meshes = [], nodes = [{ name: m.name, children: [] }], objV = [], objT = [], objG = [];
  m.parts.forEach((pt, i) => { const n = pt.V.length / 7, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], P0 = G3(pt.pv, k);
    for (let j = 0; j < n; j++) { const o = j * 7, q = G3([pt.V[o], pt.V[o + 1], pt.V[o + 2]], k); objV.push(q); objT.push([pt.V[o + 3], pt.V[o + 4]]); for (let a = 0; a < 3; a++) { const v = q[a] - P0[a]; pos[j * 3 + a] = v; mn[a] = Math.min(mn[a], v); mx[a] = Math.max(mx[a], v); }
      uv[j * 2] = pt.V[o + 3]; uv[j * 2 + 1] = pt.V[o + 4]; col[j * 3] = col[j * 3 + 1] = col[j * 3 + 2] = Math.min(1, pt.V[o + 5]); }
    objG.push([pt.name, n]);
    meshes.push({ name: pt.name, primitives: [{ attributes: { POSITION: accessor(pos, 'VEC3', { mm: { min: mn, max: mx } }), TEXCOORD_0: accessor(uv, 'VEC2'), COLOR_0: accessor(col, 'VEC3') }, material: 0 }] }); });
  m.parts.forEach((pt, i) => { const P0 = G3(pt.pv, k), par = pt.parent >= 0 ? m.parts[pt.parent] : null, base = par ? G3(par.pv, k) : [0, 0, 0];
    nodes.push({ name: pt.name, mesh: i, translation: [P0[0] - base[0], P0[1] - base[1], P0[2] - base[2]], children: [] }); });
  m.parts.forEach((pt, i) => (pt.parent >= 0 ? nodes[1 + pt.parent].children : nodes[0].children).push(1 + i)); nodes.forEach(n => { if (!n.children.length) delete n.children; });
  const animations = [];
  if (m.rig) for (const an of ['idle', 'walk', 'wave']) { const L = LOOP[an], F = Math.round(L * 24), times = new Float32Array(F + 1); for (let f = 0; f <= F; f++) times[f] = f / 24 * L / (F / 24);
    const tIn = accessor(times, 'SCALAR', { anim: true, mm: { min: [0], max: [times[F]] } }), channels = [], samplers = [];
    m.parts.forEach((pt, i) => { const rot = new Float32Array((F + 1) * 4), tr = pt.parent < 0 ? new Float32Array((F + 1) * 3) : null, n0 = nodes[1 + i].translation;
      for (let f = 0; f <= F; f++) { const { A, bob } = poseNow(times[f], an), a = A[pt.name] || { th: 0, ph: 0 }, qz = [0, 0, Math.sin(a.th / 2), Math.cos(a.th / 2)], qx = [Math.sin(-a.ph / 2), 0, 0, Math.cos(-a.ph / 2)], q = qmul(qx, qz);
        rot.set(q, f * 4); if (tr) tr.set([n0[0], n0[1] + bob * k, n0[2]], f * 3); }
      samplers.push({ input: tIn, output: accessor(rot, 'VEC4', { anim: true }), interpolation: 'LINEAR' }); channels.push({ sampler: samplers.length - 1, target: { node: 1 + i, path: 'rotation' } });
      if (tr) { samplers.push({ input: tIn, output: accessor(tr, 'VEC3', { anim: true }), interpolation: 'LINEAR' }); channels.push({ sampler: samplers.length - 1, target: { node: 1 + i, path: 'translation' } }); } });
    animations.push({ name: an[0].toUpperCase() + an.slice(1), channels, samplers }); }
  const imgView = view(png);
  const gltf = { asset: { version: '2.0', generator: 'Papercraft (Saga of Koto)' }, extensionsUsed: ['KHR_materials_unlit'], scene: 0, scenes: [{ nodes: [0] }], nodes, meshes, ...(animations.length ? { animations } : {}),
    materials: [{ name: 'paper', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 }, alphaMode: 'MASK', alphaCutoff: 0.5, extensions: { KHR_materials_unlit: {} } }],
    textures: [{ source: 0, sampler: 0 }], samplers: [{ magFilter: 9728, minFilter: 9728, wrapS: 33071, wrapT: 33071 }], images: [{ bufferView: imgView, mimeType: 'image/png' }],
    buffers: [{ byteLength: off }], bufferViews: views, accessors: acc };
  const js = new TextEncoder().encode(JSON.stringify(gltf)), jl = pad4(js.length), glb = new Uint8Array(12 + 8 + jl + 8 + off), dv = new DataView(glb.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, glb.length, true); dv.setUint32(12, jl, true); dv.setUint32(16, 0x4e4f534a, true); glb.set(js, 20); for (let i = js.length; i < jl; i++) glb[20 + i] = 32;
  const b0 = 20 + jl; dv.setUint32(b0, off, true); dv.setUint32(b0 + 4, 0x004e4942, true); for (const [o, u8] of chunks) glb.set(u8, b0 + 8 + o);
  const N = objV.length, Lo = [`# Papercraft (Saga of Koto): ${m.name}, ${N / 3} triangles, 1 m tall, y up, rest pose${m.rig ? ' (the .glb carries the rig and its animations)' : ''}`, `mtllib ${m.name}.mtl`];
  for (const q of objV) Lo.push(`v ${q[0].toFixed(5)} ${q[1].toFixed(5)} ${q[2].toFixed(5)}`); for (const t of objT) Lo.push(`vt ${t[0].toFixed(5)} ${(1 - t[1]).toFixed(5)}`);
  Lo.push('usemtl paper'); let at = 1; for (const [nm, n] of objG) { Lo.push(`g ${nm}`); for (let i = 0; i < n; i += 3, at += 3) Lo.push(`f ${at}/${at} ${at + 1}/${at + 1} ${at + 2}/${at + 2}`); }
  const t = s => new TextEncoder().encode(s);
  return zip([{ name: m.name + '.glb', data: glb }, { name: m.name + '.obj', data: t(Lo.join('\\n') + '\\n') }, { name: m.name + '.mtl', data: t(`newmtl paper\\nKd 1 1 1\\nmap_Kd ${m.name}.png\\nmap_d ${m.name}.png\\n`) }, { name: m.name + '.png', data: png },
    { name: 'README.txt', data: t(`${m.name}: made with Papercraft (Saga of Koto).\\n${m.name}.glb  - glTF 2.0 for Blender, Unity, Godot, three.js and most 3D viewers. Unlit, texture with an alpha cut, 1 m tall, y up, front toward +z.\\n${m.rig ? `  Rigged: a node per part (${m.parts.map(q => q.name).join(', ')}), each at its pivot, children of the torso; animations Idle (4 s), Walk (0.9 s), Wave (1.4 s), looping.\\n` : ''}${m.name}.obj  - the same mesh in its rest pose for apps that prefer OBJ (+ .mtl and .png), one group per part.\\n`) }]); }
async function cutoutPng() { // your subject at the photo's own size (up to 2048 px): the cut's mask, scaled up smoothly, applied to the original
  const im = MINE.img, W0 = im.naturalWidth, H0 = im.naturalHeight, k = Math.min(1, 2048 / Math.max(W0, H0)), W = Math.round(W0 * k), H = Math.round(H0 * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0, W, H); const big = g.getImageData(0, 0, W, H);
  const mc = document.createElement('canvas'); mc.width = MINE.w; mc.height = MINE.h; const mp = new ImageData(MINE.w, MINE.h); for (let i = 0; i < MINE.w * MINE.h; i++) mp.data[i * 4 + 3] = MINE.px[i * 4 + 3]; mc.getContext('2d').putImageData(mp, 0, 0);
  const sc = document.createElement('canvas'); sc.width = W; sc.height = H; const sg = sc.getContext('2d'); sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = 'high'; sg.drawImage(mc, 0, 0, W, H); const m = sg.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) big.data[i * 4 + 3] = Math.min(big.data[i * 4 + 3], m[i * 4 + 3] >= 128 ? 255 : 0); // a hard edge, like the paper
  let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (big.data[(y * W + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null; g.putImageData(big, 0, 0); const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); // trimmed to the subject
  return new Promise(res => o.toBlob(res, 'image/png')); }
async function offer(filename, data) { // the viewer's own save (with its confirmation) inside Claude; a plain download anywhere else
  const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
  if (dl) { try { await dl.save({ filename, data }); toast('Saved ' + filename + '.'); } catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'rate_limited' ? 'One save at a time: try again in a moment.' : 'This view cannot save files.'); } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(data instanceof Blob ? data : new Blob([data])); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('Saved ' + filename + '.'); }
function openSave() { const m = meshNow(); $('saveInfo').textContent = m ? `${m.name}: ${m.parts.reduce((n, q) => n + q.V.length / 21, 0)} triangles, ${ST.shape === 'round' ? 'round' : 'card'}${m.rig ? ', rigged: ' + m.parts.length + ' parts, Idle / Walk / Wave' : ''}.` : '';
  document.querySelector('[data-save=png]').disabled = document.querySelector('[data-save=json]').disabled = !(ST.mode === 'mine' && MINE.S); document.querySelector('[data-save=model]').disabled = !m;
  closeSheet(); setTool(null); $('saveSheet').hidden = $('scrim').hidden = false; }
function closeSave() { $('saveSheet').hidden = true; if ($('sheet').hidden) $('scrim').hidden = true; }
$('save').onclick = openSave; $('saveClose').onclick = closeSave; $('scrim').addEventListener('click', closeSave);
for (const b of document.querySelectorAll('[data-save]')) b.onclick = async () => { const kind = b.dataset.save; closeSave(); toast('Preparing…', true);
  try { if (kind === 'model') { const m = meshNow(); await offer(m.name + '-papercraft.zip', await modelZip(m)); }
    else if (kind === 'png') { const p = await cutoutPng(); if (p) await offer((MINE.name || 'cutout') + '.png', p); else toast('Nothing to save: everything was removed.'); }
    else { const png = await pngOf(MINE.px, MINE.w, MINE.h); let bin = ''; for (let i = 0; i < png.length; i += 32768) bin += String.fromCharCode.apply(null, png.subarray(i, i + 32768));
      const S = MINE.S, rec = { papercraft: 1, name: MINE.name || 'papercraft', prime: PAPER.PRIME, picture: 'data:image/png;base64,' + btoa(bin), size: [MINE.w, MINE.h], sprite: { rect: S.rect, anchor: S.anchor, pts: S.pts, rings: S.rings, tris: S.tris, ein: S.ein }, shape: ST.shape, depth: depth() };
      await offer(rec.name + '.papercraft.json', JSON.stringify(rec)); } }
  catch (e) { toast('Could not save: ' + (e && e.message || e)); } };
// ---------- start ----------
if (Q.get('t')) $('thick').value = Q.get('t'); $('wire').checked = Q.get('wire') === '1'; $('spin').checked = Q.get('spin') !== '0';
document.querySelectorAll('[data-look]').forEach(x => x.setAttribute('aria-pressed', x.dataset.look === ST.look)); document.querySelectorAll('[data-shape]').forEach(x => x.setAttribute('aria-pressed', x.dataset.shape === ST.shape)); document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x.dataset.anim === ST.anim));
const retheme = () => { if (loaded === names.length) build(); }; matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme); new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
$('save').disabled = false;
for (const at of names) { const im = new Image(); im.onload = () => { TEX[at] = texOf(im); { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); ATLAS_PX[at] = g.getImageData(0, 0, im.width, im.height).data; } /* pixels, for Round */ if (++loaded === names.length) { build(); refreshHello(); requestAnimationFrame(frame); window.READY = true; } }; im.src = $('atlas-' + at).textContent.trim(); }
</script></body></html>'''
if '--artifact' in sys.argv:  # the same page without its own document wrapper (the artifact host adds one)
    body = re.sub(r'^<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport"[^>]*>', '', html).replace('</style></head><body>', '</style>', 1).replace('</body></html>', '')
    dst = sys.argv[sys.argv.index('--artifact') + 1]; open(dst, 'w', encoding='utf-8').write(body); print('wrote', dst)
out = os.path.join(ROOT, 'papercraft/sprite-viewer.html'); open(out, 'w', encoding='utf-8', newline='').write(html); print('wrote', out, round(len(html) / 1024), 'KB')
