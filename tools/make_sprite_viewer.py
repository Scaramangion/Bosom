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
.top{position:fixed;z-index:30;left:16px;right:16px;top:calc(10px + env(safe-area-inset-top,0px));display:flex;align-items:center;justify-content:space-between;pointer-events:none}
.word{font-weight:600;font-size:17px;letter-spacing:-.01em;pointer-events:auto}button.word{padding:6px 8px;margin:-6px -8px;border-radius:10px}button.word:active{opacity:.55}
.tr{display:flex;gap:8px}.round{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;pointer-events:auto}
.bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:4px;padding:6px;border-radius:22px}
.joint{position:fixed;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:#fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.4);pointer-events:none}.joint.edit{width:16px;height:16px;margin:-8px 0 0 -8px;background:var(--tint);box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.35)}.joint.edit.torso{border-radius:4px}.joint.edit.ev-OBSERVED{background:#fff;box-shadow:0 0 0 3.5px var(--tint),0 1px 4px rgba(0,0,0,.35)}.joint.edit.ev-INFERRED,.joint.edit.ev-GEOMETRIC_FIT,.joint.edit.ev-UNCERTAIN{background:rgba(255,255,255,.35);box-shadow:none;border:2.5px dashed var(--tint);margin:-10.5px 0 0 -10.5px}.joint.drag{transform:scale(1.4)}#skel{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}.tab{min-width:52px;height:52px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-size:11px;color:var(--label2)}
.tab[aria-pressed="true"]{color:var(--tint);background:var(--fill)}label.tab{font-size:11px}
.panel{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 32px));box-sizing:border-box;border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:12px}
.panel.col{flex-direction:column;align-items:stretch}.panel .line{display:flex;align-items:center;gap:10px}.panel.col>.seg{flex:none}.panel .line .seg{flex:1}.panel .hint{flex:1;min-width:0;font-size:14px;color:var(--label2)}
.panel input[type=range]{flex:1;min-width:0;accent-color:var(--tint)}.small{font-size:13px;color:var(--label2)}
.pill{height:32px;padding:0 14px;border-radius:16px;background:var(--fill);font-size:14px;font-weight:500}.pill.tinted,.pill[aria-pressed="true"]{background:var(--tint);color:var(--tint-ink)}
.seg{display:flex;flex:1;background:var(--fill);border-radius:9px;padding:2px;gap:2px}.seg button{flex:1;height:30px;border-radius:7px;font-size:13px;font-weight:500}
.seg button[aria-pressed="true"]{background:var(--group);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.hello{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom,0px));width:min(360px,calc(100vw - 32px));box-sizing:border-box;border-radius:20px;padding:20px;text-align:center}
.hello h1{margin:0 0 6px;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.02em;text-wrap:balance}.hello p{margin:0 0 16px;color:var(--label2);font-size:15px;text-wrap:balance}
.primary{display:flex;align-items:center;justify-content:center;height:50px;border-radius:14px;background:var(--tint);color:var(--tint-ink);font-weight:600;font-size:17px;cursor:pointer}
.scrim{position:fixed;inset:0;background:rgba(0,0,0,.08)}
.sheet{position:fixed;left:0;right:0;bottom:0;max-height:62%;overflow:auto;background:var(--sheet);border-radius:16px 16px 0 0;padding:8px 16px calc(24px + env(safe-area-inset-bottom,0px));box-sizing:border-box;touch-action:pan-y}
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
<div class="top"><button id="home" class="word" aria-label="Papercraft: back to the start">Papercraft</button><span class="tr"><button id="save" class="round glass" aria-label="Save" disabled>''' + svg('save') + '''</button><button id="more" class="round glass" aria-label="Options">''' + svg('more') + '''</button></span></div>
<div id="hello" class="hello glass" hidden><h1>Turn any picture into a paper model</h1><p>Choose a photo or a drawing. Papercraft cuts out the subject and folds it into 3D.</p><label class="primary" for="file">Choose Photo</label></div>
<div id="pDepth" class="panel glass col" hidden><div class="seg" id="shapeSeg" role="group" aria-label="Shape"><button data-shape="card" aria-pressed="false">Card</button><button data-shape="round" aria-pressed="false">Round</button><button data-shape="facets" aria-pressed="true">Facets</button></div><div class="seg" id="geoSeg" role="group" aria-label="Geometry"><button data-budget="40">PS1 Low</button><button data-budget="100">PS1</button><button data-budget="300" aria-pressed="true">PS2 Low</button><button data-budget="800">PS2</button></div><div class="line" id="thickRow"><span class="small">Flat</span><input id="thick" type="range" min="0" max="4" step="0.25" value="2" aria-label="Depth"><span class="small">Sculpted</span></div><div class="line"><div class="seg" id="dsrcSeg" role="group" aria-label="Depth from"><button data-dsrc="shape" aria-pressed="true">Shape</button><button data-dsrc="planes" aria-pressed="false">Planes</button><button data-dsrc="paint" aria-pressed="false">Paint</button></div><button id="layersBtn" class="pill" aria-pressed="false">Layers</button></div><div class="line" id="brushRow" hidden><div class="seg" role="group" aria-label="Brush"><button data-brush="255" aria-pressed="true">Near</button><button data-brush="128" aria-pressed="false">Middle</button><button data-brush="0" aria-pressed="false">Far</button></div><button id="dclear" class="pill">Clear</button><button id="dmap" class="pill">Map</button></div><span class="hint" id="depthHint" hidden></span><input id="fileDepth" type="file" accept="image/*" hidden></div>
<div id="pCut" class="panel glass col" hidden><div class="line"><div class="seg" role="group" aria-label="Tap to"><button data-mark="keep" aria-pressed="true">Keep</button><button data-mark="drop" aria-pressed="false">Remove</button></div><button id="undo" class="pill">Undo</button><button id="done" class="pill tinted">Done</button></div><div class="seg" role="group" aria-label="Cut-out"><button data-method="auto" aria-pressed="true">Auto</button><button data-method="key" aria-pressed="false">Backdrop</button><button data-method="photo" aria-pressed="false">Photo</button></div><div class="line" id="tolRow"><span class="small">Tight</span><input id="tol" type="range" min="12" max="120" step="4" value="48" aria-label="Backdrop tolerance"><span class="small">Loose</span><button id="one" class="pill" aria-pressed="true">One piece</button></div><div class="line"><span class="small">Detail</span><div class="seg" role="group" aria-label="Detail"><button data-detail="96" aria-pressed="false">Low</button><button data-detail="160" aria-pressed="false">Medium</button><button data-detail="256" aria-pressed="true">High</button></div></div><span class="hint" id="cutHint">Tap the person or thing you want to keep.</span></div>
<div id="pPose" class="panel glass col" hidden><div class="seg" role="group" aria-label="Move"><button data-anim="still" aria-pressed="false">Still</button><button data-anim="idle" aria-pressed="true">Idle</button><button data-anim="walk" aria-pressed="false">Walk</button><button data-anim="run" aria-pressed="false">Run</button></div><div class="seg" role="group" aria-label="Act"><button data-anim="wave" aria-pressed="false">Wave</button><button data-anim="jump" aria-pressed="false">Jump</button><button data-anim="swing" aria-pressed="false">Swing</button><button data-anim="draw" aria-pressed="false">Draw</button></div><div class="line"><button id="ragBtn" class="pill" aria-pressed="false">Ragdoll</button><button id="editJ" class="pill">Edit joints</button><button id="bodyBtn" class="pill" aria-pressed="false" hidden>Body</button><button id="reset" class="pill">Reset</button></div><span class="hint" id="poseHint">Drag an arm, a leg or the head to pose it.</span></div>
<svg id="skel" aria-hidden="true"></svg><div id="joints" aria-hidden="true"></div>
<div id="pViews" class="panel glass col" hidden><div class="line"><span class="small" style="width:34px">Back</span><div class="seg" role="group" aria-label="Back"><button data-back="mirror" aria-pressed="false">Mirror</button><button data-back="guess" aria-pressed="true">Guess</button><button data-back="picture" aria-pressed="false">Picture</button></div></div>
<div class="line"><span class="small" style="width:34px">Side</span><div class="seg" role="group" aria-label="Side"><button data-side="round" aria-pressed="true">Round</button><button data-side="picture" aria-pressed="false">Picture</button></div></div><div class="line"><span class="small" style="width:34px">Prop</span><div class="seg" role="group" aria-label="Prop"><button data-prop="none" aria-pressed="true">None</button><button data-prop="sword" aria-pressed="false">Sword</button><button data-prop="picture" aria-pressed="false">Picture</button></div><button id="propHand" class="pill" hidden>Other hand</button></div><div class="line"><span class="small" style="width:34px">Head</span><div class="seg" role="group" aria-label="Head"><button data-head="own" aria-pressed="true">Own</button><button data-head="swap" aria-pressed="false">From a picture</button></div></div>
<span class="hint" id="viewsHint">The back is guessed from the front. Choose Picture to use a back view.</span><div class="line" style="justify-content:flex-end"><button id="flipSide" class="pill" hidden>Flip side</button><button id="otherSide" class="pill" hidden>Other side</button><button id="turn" class="pill">Turn</button></div></div>
<input id="fileBack" type="file" accept="image/*" hidden><input id="fileProp" type="file" accept="image/*" hidden><input id="fileHead" type="file" accept="image/*" hidden><input id="fileSide" type="file" accept="image/*" hidden>
<div id="pLook" class="panel glass col" hidden><div class="seg" role="group" aria-label="Look"><button data-look="clean" aria-pressed="true">Clean</button><button data-look="ps1" aria-pressed="false">PS1</button></div><div class="seg" role="group" aria-label="Abstraction"><button data-abs="painting" aria-pressed="true">Painting</button><button data-abs="polygon" aria-pressed="false">Polygon</button><button data-abs="smooth" aria-pressed="false">Smooth</button></div></div>
<nav class="bar glass" id="tabs" aria-label="Tools">
<label class="tab btn" for="file" id="tPhoto">''' + svg('photo') + '''Photo</label>
<button class="tab" id="tCut" aria-pressed="false" disabled>''' + svg('cut') + '''Cut</button>
<button class="tab" id="tDepth" aria-pressed="false">''' + svg('depth') + '''Depth</button>
<button class="tab" id="tViews" aria-pressed="false" disabled>''' + svg('views') + '''Views</button>
<button class="tab" id="tPose" aria-pressed="false" disabled>''' + svg('pose') + '''Pose</button>
<button class="tab" id="tLook" aria-pressed="false">''' + svg('look') + '''Look</button></nav>
<div id="scrim" class="scrim" hidden></div>
<div id="sheet" class="sheet" role="dialog" aria-label="Options" hidden><div class="grab"></div><header><h2>Options</h2><button id="close" class="link">Done</button></header>
<div class="cap">View</div><div class="group">
<div class="row"><span>Turn slowly</span><input id="spin" class="switch" type="checkbox" checked aria-label="Turn slowly"></div>
<div class="row"><span>Show wireframe</span><input id="wire" class="switch" type="checkbox" aria-label="Show wireframe"></div></div>
<div class="cap">Examples from Saga of Koto</div><div class="group">
<div class="row"><span>The whole cast</span><button id="cast" class="link" style="font-size:15px">Show</button></div>
<div class="row"><span>One sprite</span><select id="spr" aria-label="Sprite"></select></div></div>
<p class="info" id="info"></p></div>
<div id="saveSheet" class="sheet" role="dialog" aria-label="Save" hidden><div class="grab"></div><header><h2>Save</h2><button id="saveClose" class="link">Cancel</button></header>
<div class="group">
<button class="row act" data-save="model"><span><b>3D model</b><br><span class="small">.zip with a .glb (most 3D apps and engines; rigged, with Idle, Walk, Run, Wave, Jump, Swing and Draw) and an .obj with its texture</span></span></button>
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
const ST = { dsrc: Q.get('dsrc') || 'shape', brush: 255, layersOn: false, budget: +(Q.get('budget') || 300), abs: Q.get('abs') || 'painting', anim: Q.get('anim') || 'idle', pose: {}, method: 'auto', shape: Q.get('shape') || 'facets', mode: Q.get('mode') || (Q.get('s') ? 'one' : 'start'), sprite: Q.get('s') || 'sud/stand', tool: null, look: Q.get('ps1') === '1' ? 'ps1' : 'clean', detail: 256, tol: 48, one: true };
const MINE = { depthMap: null, layers: null, sides: [], img: null, px: null, full: null, S: null, fullS: null, w: 0, h: 0, marks: [], mark: 'keep', ms: 0, fold: null, method: '' };
// ---------- a tiny renderer: an orbit camera, the SAME fragment shader as the game (PAPER_GLSL.frag) ----------
const cv = $('c'), gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
const vsrc = `attribute vec3 aP;attribute vec2 aT;attribute vec2 aS;uniform mat4 uM;varying vec2 vT;varying vec3 vW;varying float vZ,vSh,vEm;
  void main(){vec4 p=uM*vec4(aP,1.);gl_Position=p;vT=aT;vW=aP;vZ=p.w;vSh=aS.x;vEm=aS.y;}`;
const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
const link = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aP'); gl.bindAttribLocation(p, 1, 'aT'); gl.bindAttribLocation(p, 2, 'aS'); gl.linkProgram(p); return p; };
let prog, wprog; const initGL = () => { prog = link(vsrc, PAPER_GLSL.frag); wprog = link('attribute vec3 aP;uniform mat4 uM;void main(){gl_Position=uM*vec4(aP,1.);}', 'precision mediump float;uniform vec3 uC;void main(){gl_FragColor=vec4(uC,1.);}'); }; initGL();
const texOf = (src, rep, old) => { if (old) gl.deleteTexture(old); const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); const f = rep === 'smooth' ? gl.LINEAR : gl.NEAREST, wr = rep === true ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  [[gl.TEXTURE_MIN_FILTER, f], [gl.TEXTURE_MAG_FILTER, f], [gl.TEXTURE_WRAP_S, wr], [gl.TEXTURE_WRAP_T, wr]].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  if (src.px) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, src.w, src.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(src.px.buffer)); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); t._src = src; t._rep = rep; return t; }; // (the source is kept: if the phone takes the graphics away, they come back)
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
// ---------- depth sources (the module's o.planes / o.relief) and depth layers: all on this device, no neural network needed ----------
const depthFrom = () => ({ planes: ST.dsrc === 'planes' ? 0.8 : 0, relief: ST.dsrc === 'paint' && MINE.depthMap && MINE.depthMap.length === MINE.w * MINE.h ? { px: MINE.depthMap } : null });
const LAYER = { torso: 1, legL: 1, legR: 1, shinL: 1, shinR: 1, armL: 2, armR: 2, foreL: 2, foreR: 2, head: 3 }, LAYER_NAME = ['background', 'body', 'arms', 'head', 'foreground'];
const layerOf = (nm, RG) => ST.layersOn && RG && RG.humanoid ? ((MINE.layers && MINE.layers[nm] != null ? MINE.layers[nm] : LAYER[nm]) ?? 1) - 1 : 0; // 0 background .. 4 foreground; 1 (body) stays put
function build() { // fold every piece on stage; one buffer per texture
  const th = depth(), round = ST.shape === 'round' || ST.shape === 'facets', per = {}, put = (key, h, x, y, ang, flip) => { const S = SPRITE_POLYS.sprites[key]; if (!S) return 0; const at = key.split('/')[0], A = SPRITE_POLYS.atlases[at].size, o = { x, y, ang, flip, s: h / S.rect[3], anchor: S.anchor };
    if (ST.shape === 'facets' && ATLAS_PX[at]) paperFacet(per[at] || (per[at] = []), ATLAS_PX[at], A[0], A[1], S.rect, Object.assign(o, { depth: th * h * 0.05, budget: ST.budget, planes: ST.dsrc === 'planes' ? 0.8 : 0, flat: ST.abs !== 'smooth' }));
    else if (round && ATLAS_PX[at]) paperPuff(per[at] || (per[at] = []), ATLAS_PX[at], A[0], A[1], S.rect, Object.assign(o, { depth: th * h * 0.05, planes: ST.dsrc === 'planes' ? 0.8 : 0 })); else paperSprite(per[at] || (per[at] = []), S, A, Object.assign(o, { thick: th * h / 24 })); return h * S.rect[2] / S.rect[3]; };
  let shadow = 0, R = 120;
  if (ST.mode === 'mine' && MINE.S && ST.tool === 'cut' && MINE.fullS) { const S = MINE.S, hh = Math.min(40, 60 * S.rect[3] / S.rect[2]), s = hh / S.rect[3]; MINE.fold = { s, hh, th: 0 }; MINE.fullS.anchor = S.anchor; // Cut: the whole picture, flat, facing you
    paperSprite(per.cutview = [], MINE.fullS, [MINE.w, MINE.h], { s, thick: 0 }); focus = [0, 0, hh / 2]; radius = Math.max(hh, S.rect[2] * s) * 1.5; shadow = 0; R = Math.max(hh, S.rect[2] * s) * 4.2; }
  else if (ST.mode === 'mine' && MINE.S) { const S = MINE.S, hh = Math.min(40, 60 * S.rect[3] / S.rect[2]), s = hh / S.rect[3], D = th * hh * 0.05; MINE.fold = { s, hh, th: round ? 0 : th * hh / 24 };
    const RG = MINE.rig, P = RG.parts.length, Rg = round ? paperPuff([], MINE.px, MINE.w, MINE.h, [0, 0, MINE.w, MINE.h], { s, depth: D, anchor: S.anchor }).R : 0; // one fullest point for all parts: limbs puff thinner than the body
    MINE.geo = RG.parts.map((pt, k) => { const V = []; const bk = MINE.backDU ? { backDU: MINE.backDU, back: 0.92, shade: [1, 0.9, 0.74] } : {}, SD = MINE.sideFit, Wt = MINE.rigW, Ht = MINE.h * P;
      if (SD && round) { const m = th / 2, floor = 0.35 * s; bk.depthRow = y => { const [f, b] = SD.depth(y); return f + b > 0 ? [Math.max(floor, f * s * m), Math.max(floor, b * s * m)] : [D, D]; }; // the side view's outline: how far the body reaches forward and back at this height
        bk.sideUV = (x, y, dd, east) => { const q = east ? SD.E : SD.W; return [(q.x0 + Math.max(0.5, Math.min(q.ws - 0.5, q.c + dd / s))) / Wt, (k * MINE.h + y) / Ht]; }; } const po = { s, depth: D, anchor: S.anchor, R: Rg, field: { px: MINE.px, W: MINE.w, rect: [0, 0, MINE.w, MINE.h] }, ...depthFrom(), ...bk };
      if (ST.shape === 'facets') { let ak = 0; for (let i = 0; i < MINE.w * MINE.h; i++) if (pt.mask[i] && MINE.px[i * 4 + 3] >= 128) ak++; paperFacet(V, MINE.rigPx, MINE.rigW, MINE.h * P, [0, k * MINE.h, MINE.w, MINE.h], { ...po, budget: Math.max(8, Math.round(ST.budget * ak / MINE.area)), grow: Math.max(2, Math.round(0.02 * Math.max(MINE.w, MINE.h))), cover: ST.abs === 'polygon' ? 0 : 0.985, flat: ST.abs !== 'smooth' }); /* Smooth keeps the painting's own outline: filtered, the alpha cut becomes a smooth curve */ } // the budget shared out by area
      else if (round) paperPuff(V, MINE.rigPx, MINE.rigW, MINE.h * P, [0, k * MINE.h, MINE.w, MINE.h], po); else if (MINE.rigS[k]) paperSprite(V, MINE.rigS[k], [MINE.rigW, MINE.h * P], { s, thick: MINE.fold.th, ...bk });
      const Ly = layerOf(pt.name, RG) * (0.025 * hh + 0.12 * D); if (Ly) for (let i = 1; i < V.length; i += 7) V[i] += Ly; // a depth layer: the whole part moved toward you (or away)
      let far = 0; const ux = Math.sin(pt.dir), uy = Math.cos(pt.dir); for (let i = 0; i < MINE.w * MINE.h; i++) if (pt.mask[i]) far = Math.max(far, (i % MINE.w + 0.5 - pt.pivot[0]) * ux + (((i / MINE.w) | 0) + 0.5 - pt.pivot[1]) * uy); // the bone's far end: as far along the part as it reaches
      const tx = pt.pivot[0] + ux * far, ty = pt.pivot[1] + uy * far;
      return { V, name: pt.name, parent: pt.parent, dir: pt.dir, pv: [(pt.pivot[0] - S.anchor[0]) * s, Ly, (S.anchor[1] - pt.pivot[1]) * s], tip: [(tx - S.anchor[0]) * s, Ly, (S.anchor[1] - ty) * s], n: V.length / 7 }; });
    if (MINE.mods) for (const nm in MINE.mods) per.mod = Array.from(MINE.mods[nm].rest); // a swapped-in piece rides along (placed each frame)
    if (MINE.prop && MINE.prop.rest) { MINE.propSock = propSockets() || MINE.propSock; per.prop = Array.from(MINE.prop.rest); } // the prop rides along (placed each frame)
    per.rig = [].concat(...MINE.geo.map(g => g.V)); MINE.rest = Float32Array.from(per.rig); MINE.dyn = Float32Array.from(per.rig); focus = [0, 0, hh / 2]; radius = Math.max(hh, S.rect[2] * s) * 1.7; shadow = S.rect[2] * s * 0.55; R = Math.max(hh, S.rect[2] * s) * 4.2; }
  else if (ST.mode === 'cast') { const n0 = 14, look = [150, 260]; // two arcs on the plaza, each piece turned toward the lens and nudged by the prime
    CAST.forEach(([key, h], i) => { const row = i < n0 ? 0 : 1, k = row ? i - n0 : i, n = row ? CAST.length - n0 : n0, x = (k - (n - 1) / 2) * (row ? 30 : 17) + (paperPrime(i) - 0.5) * 5, y = row ? -40 + Math.abs(k - (n - 1) / 2) * 5 : 10 + Math.abs(k - (n - 1) / 2) * 3;
      put(key, h, x, y, Math.atan2(-(look[0] - x), look[1] - y) + (paperPrime(i + 50) - 0.5) * 0.6, paperPrime(i + 99) < 0.3); });
    put(STALKER[0], STALKER[1], -30, -95, 0.3, false); focus = [-20, -25, 12]; radius = 155; R = 420; }
  else { const S = SPRITE_POLYS.sprites[ST.sprite], h = 24 * S.rect[3] / 85, w = put(ST.sprite, h, 0, 0, 0, false), hi = ST.mode === 'start' && !MINE.img; focus = [0, 0, hi ? -h * 0.32 : h / 2]; radius = Math.max(h, w) * (hi ? 2.5 : 1.9); shadow = w * 0.55; R = Math.max(h, w) * 4.2; }
  stage(R, shadow);
  tris = Object.values(per).reduce((n, v) => n + v.length / 21, 0);
  for (const g of groups) gl.deleteBuffer(g.b);
  groups = Object.entries(per).map(([at, v]) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), at === 'rig' || at === 'prop' || at === 'mod' ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return { at, b, n: v.length / 7 }; });
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
  const M = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += P[k * 4 + j] * V[i * 4 + k]; M[i * 4 + j] = s; }
  for (let i = 0; i < 4; i++) { M[i * 4] *= view.k; M[i * 4 + 1] = view.k * M[i * 4 + 1] + view.s * M[i * 4 + 3]; } return M; } // lifted (and shrunk) into the space an open panel leaves free
const view = { s: 0, k: 1 }; // the picture's centre, lifted into the free space above an open panel (s, in clip units) and shrunk to fit it (k)
function freeSpace() { const rc = cv.getBoundingClientRect(), bar = $('tabs').getBoundingClientRect(), pn = ST.tool && $(PANELS[ST.tool]), top = rc.top + 84, b0 = bar.height ? bar.top - 8 : rc.bottom, sh = [$('sheet'), $('saveSheet')].find(x => x && !x.hidden);
  const b1 = sh ? sh.getBoundingClientRect().top - 8 : pn && !pn.hidden ? pn.getBoundingClientRect().top - 8 : b0; return { rc, top, b0, b1: Math.max(top + 120, Math.min(b0, b1)) }; } // between the title bar and whatever covers the bottom
function viewTarget() { const { rc, top, b0, b1 } = freeSpace(); return [1 - ((top + b1) / 2 - rc.top) * 2 / rc.height, Math.max(0.3, Math.min(1, (b1 - top) / Math.max(1, b0 - top)))]; } // the figure's centre at the free space's centre, shrunk with it
function fitFigure() { if (!MINE.fold) return; const { rc, top, b1 } = freeSpace(), [, k] = viewTarget(); cam.zoom = MINE.fold.hh * 1.12 * k * rc.height / (2 * Math.tan(0.4) * (b1 - top)); } // the whole figure filling the free space (Pose, Edit joints)
const unview = (nx, ny) => [nx / view.k, (ny - view.s) / view.k]; // a screen point back through the lift, for rays
let last = 0;
function frame(now) { requestAnimationFrame(frame); if (gl.isContextLost()) return; try { frameBody(now); } catch (e) { if (!frame.err) { frame.err = 1; console.warn(e); toast('Something went wrong. Tap Papercraft (top left) to start again.'); } } }
function frameBody(now) {
  const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
  if (cam.to) { const k = 1 - Math.exp(-dt * 9); let dy = ((cam.to.yaw - cam.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; cam.yaw += dy * k; cam.pitch += (cam.to.pitch - cam.pitch) * k; if (Math.abs(dy) + Math.abs(cam.to.pitch - cam.pitch) < 0.002) { cam.yaw = cam.to.yaw; cam.pitch = cam.to.pitch; } }
  else if ($('spin').checked && !held && ST.tool !== 'cut' && !paintLive()) cam.yaw += dt * 0.3;
  { const [ts, tk] = viewTarget(), q = 1 - Math.exp(-dt * 10); view.s += (ts - view.s) * q; view.k += (tk - view.k) * q; }
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth * dpr | 0, h = cv.clientHeight * dpr | 0; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const ps1 = ST.look === 'ps1', sc = ps1 ? [0.55, 0.62, 0.7] : rgb(css('--scene'));
  gl.viewport(0, 0, w, h); gl.clearColor(sc[0], sc[1], sc[2], 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); // faces are wound counter-clockwise seen from outside, and this camera does not mirror the world
  if (rigLive()) { const tt = window.FREEZE_T != null ? window.FREEZE_T : now / 1000; /* (the checks can hold the clock) */ PH.on = !ST.editJ; if (PH.on && !window.PH_MANUAL) stepPhysics(tt, dt); /* (and step the physics by hand) */ applyPose(tt); joints(tt); } else { $('joints').innerHTML = ''; $('skel').innerHTML = ''; BONES = []; JOINT_AT = []; }
  const M = matrix(w, h); gl.useProgram(prog); for (let i = 0; i < 3; i++) gl.enableVertexAttribArray(i);
  gl.uniformMatrix4fv(gl.getUniformLocation(prog, 'uM'), false, M); const U = n => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('uSheet'), 7); gl.uniform1f(U('uAmb'), 0.9); gl.uniform1f(U('uFogD'), 5); gl.uniform1f(U('uZc'), 0); gl.uniform1f(U('uGlow'), 0); gl.uniform1f(U('uDS'), w / 240); gl.uniform2f(U('uRes'), w, h);
  gl.uniform1f(U('uTime'), now / 1000 % 1000); gl.uniform3f(U('uTint'), 1, 1, 1); gl.uniform1f(U('uDesat'), 0.2); gl.uniform1f(U('uGrade'), ps1 ? 1 : 0); gl.uniform3f(U('uFogC'), sc[0], sc[1], sc[2]); gl.uniform3fv(U('uLW[0]'), new Float32Array(24));
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1); gl.activeTexture(gl.TEXTURE7);
  const draw = (b, n) => { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 28, 20); gl.drawArrays(gl.TRIANGLES, 0, n); };
  gl.disable(gl.CULL_FACE); gl.bindTexture(gl.TEXTURE_2D, TEX.ground); draw(gbuf, gN); gl.enable(gl.CULL_FACE);
  for (const g of groups) if (TEX[g.at]) { if (g.at === 'rig' || g.at === 'prop' || g.at === 'mod') gl.disable(gl.CULL_FACE); gl.bindTexture(gl.TEXTURE_2D, TEX[g.at]); draw(g.b, g.n); gl.enable(gl.CULL_FACE); } // a rig part is open where it meets its neighbour: its inside shows there (paper has two sides), never the sky
  gl.disable(gl.POLYGON_OFFSET_FILL);
  if ($('wire').checked && wire) { gl.useProgram(wprog); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.uniformMatrix4fv(gl.getUniformLocation(wprog, 'uM'), false, M); gl.uniform3fv(gl.getUniformLocation(wprog, 'uC'), rgb(css('--wire'))); gl.bindBuffer(gl.ARRAY_BUFFER, wire); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.drawArrays(gl.LINES, 0, wireN); }
  }
// ---------- the rig in motion: each part turns about its pivot, in the picture's plane (Paper Mario) or swinging forward and back (Minecraft) ----------
const LOOP = { idle: 4, walk: 0.9, run: 0.62, wave: 1.4, jump: 1.1, swing: 1.2, draw: 2.6 }; // seconds per loop (what the saved animations use)
function poseNow(t, an0) { if (!an0 && PH.A && PH.on) return PH; const key = an0 || animKey(); if (key.includes('+')) return poseLayered(t, key); // live: the rig's physics (stepPhysics) carries the pose; an explicit motion (the saved animations) stays pure // per part: th (turn in the picture's plane, counter-clockwise as seen from the front), ph (swing forward / back); plus the body's bob
  const G = MINE.geo, A = {}; let bob = 0; for (const g of G) A[g.name] = { th: ST.pose[g.name] || 0, ph: 0 }; const hh = MINE.fold.hh, an = key, has = n => A[n];
  const hang = k => has(k) ? -G.find(g => g.name === k).dir * 0.9 : 0; // arms out (a T-pose) come down to hang by the sides when walking
  if (an === 'idle') { const b = Math.sin(t * 2 * Math.PI / 2); bob = (b * 0.5 + 0.5) * 0.012 * hh; if (has('head')) A.head.th += 0.06 * Math.sin(t * 2 * Math.PI / 4); if (has('armL')) A.armL.th -= 0.05 * b; if (has('armR')) A.armR.th += 0.05 * b;
    if (has('foreL')) A.foreL.th -= 0.04 * b; if (has('foreR')) A.foreR.th += 0.04 * b; A.torso.th += 0.015 * Math.sin(t * 2 * Math.PI / 4); } // loops every 4 s
  if (an === 'walk') { const p = t * 2 * Math.PI / 0.9, w = Math.sin(p), c = Math.cos(p); bob = Math.abs(c) * 0.025 * hh;
    if (has('legL')) { A.legL.ph += 0.55 * w; A.legR.ph -= 0.55 * w; } if (has('shinL')) { A.shinL.ph -= 0.75 * Math.max(0, c); A.shinR.ph -= 0.75 * Math.max(0, -c); } // the knee folds as the leg swings through
    if (has('armL')) { A.armL.ph -= 0.45 * w; A.armR.ph += 0.45 * w; A.armL.th += hang('armL'); A.armR.th += hang('armR'); } if (has('foreL')) { A.foreL.ph += 0.35 + 0.2 * Math.max(0, -w); A.foreR.ph += 0.35 + 0.2 * Math.max(0, w); }
    if (has('head')) A.head.th += 0.04 * Math.sin(p * 2); }
  if (an === 'wave') { const q = Math.sin(t * 2 * Math.PI / 0.7); if (has('armR')) A.armR.th += hang('armR') + (has('foreR') ? 1.9 : 2.55 + 0.38 * q); if (has('foreR')) A.foreR.th += 0.55 + 0.55 * q; // the forearm waves from the elbow
    if (has('armL')) A.armL.th += hang('armL') * 0.5; if (has('head')) A.head.th += 0.08 * Math.sin(t * 2 * Math.PI / 1.4); bob = 0.006 * hh * q; }
  if (an === 'jump') { const u = (t % 1.1) / 1.1, sm = x => x * x * (3 - 2 * x), dip = u < 0.25 ? sm(u / 0.25) : u < 0.4 ? 1 - sm((u - 0.25) / 0.15) : u < 0.7 ? 0 : u < 0.82 ? sm((u - 0.7) / 0.12) : 1 - sm((u - 0.82) / 0.18); // crouch, spring, fly, land, stand
    const air = u >= 0.4 && u < 0.7 ? Math.sin(Math.PI * (u - 0.4) / 0.3) : 0, tuck = air * 0.6 + dip; bob = air * 0.32 * hh - dip * 0.07 * hh;
    if (has('legL')) { A.legL.ph += 0.55 * tuck; A.legR.ph += 0.55 * tuck; } if (has('shinL')) { A.shinL.ph -= 1.0 * tuck; A.shinR.ph -= 1.0 * tuck; } // knees bend: thigh forward, shin back
    if (has('armL')) { const up = air * 1.9, back = dip * 0.5; A.armL.th += hang('armL') * (1 - air) - up; A.armR.th += hang('armR') * (1 - air) + up; A.armL.ph -= back; A.armR.ph -= back; } // arms swing back in the crouch, up in the air
    if (has('head')) A.head.ph = 0.1 * dip; A.torso.ph = -0.16 * dip; } // the crouch leans in (an upright part leans forward with -ph), the head stays level
  if (an === 'swing') { const u = (t % 1.2) / 1.2, sm = x => x * x * (3 - 2 * x); let r, f; // wind up slowly, strike fast, follow through, return
    if (u < 0.4) { r = sm(u / 0.4) * 2.5; f = 0; } else if (u < 0.52) { const k = sm((u - 0.4) / 0.12); r = 2.5 - 2.9 * k; f = k; } else if (u < 0.75) { r = -0.4; f = 1; } else { const k = sm((u - 0.75) / 0.25); r = -0.4 * (1 - k); f = 1 - k; }
    if (has('armR')) { A.armR.th += hang('armR') + r; A.armR.ph += 0.7 * f; } if (has('foreR')) A.foreR.th += 0.5 * Math.max(0, r) / 2.5 - 0.2 * f; // the forearm trails, then snaps straight
    if (has('armL')) { A.armL.th += hang('armL') * 0.6 - 0.25 * f; A.armL.ph -= 0.3 * f; } A.torso.th += 0.1 * (r / 2.5) - 0.12 * f; A.torso.ph = -0.14 * f; if (has('head')) A.head.th -= 0.05 * f;
    if (has('legL')) { A.legL.ph -= 0.25 * f; A.legR.ph += 0.3 * f; } if (has('shinR')) A.shinR.ph -= 0.3 * f; bob = -0.03 * hh * f; } // a step into the blow
  if (an === 'run') { const p = t * 2 * Math.PI / 0.62, w = Math.sin(p), c = Math.cos(p); bob = Math.abs(c) * 0.05 * hh; // a run: longer strides, high knees, bent arms pumping, the body leaning into it
    A.torso.ph -= 0.24; A.torso.th += 0.035 * w; if (has('head')) { A.head.ph += 0.16; A.head.th -= 0.03 * w; } // lean in, eyes ahead
    if (has('legL')) { A.legL.ph += 0.95 * w; A.legR.ph -= 0.95 * w; } if (has('shinL')) { A.shinL.ph -= 0.25 + 1.25 * Math.max(0, c); A.shinR.ph -= 0.25 + 1.25 * Math.max(0, -c); }
    if (has('armL')) { A.armL.ph -= 0.85 * w; A.armR.ph += 0.85 * w; A.armL.th += hang('armL'); A.armR.th += hang('armR'); } if (has('foreL')) { A.foreL.ph += 1.35; A.foreR.ph += 1.35; } }
  if (an === 'draw') { const L = LOOP.draw, u = (t % L) / L, sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }; // reach over the shoulder, grip, draw out to a guard, hold, sheathe, let go
    const r = u < 0.2 ? sm(u / 0.2) : u < 0.84 ? 1 : 1 - sm((u - 0.84) / 0.16), k = u < 0.26 ? 0 : u < 0.46 ? sm((u - 0.26) / 0.2) : u < 0.62 ? 1 : u < 0.8 ? 1 - sm((u - 0.62) / 0.18) : 0, up = r * (1 - k);
    const sd = MINE.prop && MINE.prop.side === 'L' ? 'L' : 'R', sg = sd === 'R' ? 1 : -1, arm = 'arm' + sd, fore = 'fore' + sd, off = 'arm' + (sd === 'R' ? 'L' : 'R');
    if (has(arm)) { A[arm].th += hang(arm) * (1 - r) + up * sg * 2.25 + k * (hang(arm) * 0.55 + sg * 0.3); A[arm].ph += 0.1 * up + 0.95 * k; } if (has(fore)) A[fore].ph += -2.1 * up + 0.85 * k; /* a raised limb swings back with +ph: the elbow up, the forearm folded behind the head to the grip */ // the hand behind the head, then out in front
    if (has(off)) { A[off].th += hang(off) * 0.8; A[off].ph += 0.3 * k; } A.torso.th += sg * 0.1 * k; A.torso.ph -= 0.08 * k; if (has('head')) A.head.ph -= 0.1 * up;
    if (has('legL')) { A.legL.ph += 0.3 * k; A.legR.ph -= 0.25 * k; } if (has('shinL')) { A.shinL.ph -= 0.25 * k; A.shinR.ph -= 0.25 * k; } bob = -0.02 * hh * k + 0.004 * hh * k * Math.sin(t * 5); }
  if (A.torso.ph && has('legL')) { A.legL.ph -= A.torso.ph; A.legR.ph -= A.torso.ph; } // the legs keep to the ground when the body leans
  return { A, bob }; }
// ---------- the rig's physics: every part follows its motion through a spring (so motions blend, and limbs swing on, Mega Man Legends style),
// pushed by how its joint is moving (a limb lags behind when its shoulder is jerked, then catches up); Ragdoll loosens the springs and adds
// gravity, so the figure is a doll you pick up by the body and drop. Turns in the picture's plane (th) swing; swings out of it (ph) blend.
// Joint limits (the skeleton's, stage 7) hold every turn. The saved animations never go through here: they stay exact.
const PH = { on: true, A: null, bob: 0, root: { x: 0, z: 0 }, S: null, rv: { x: 0, z: 0 }, carry: null };
const LIMB = { armL: 'SHOULDER', armR: 'SHOULDER', foreL: 'ELBOW', foreR: 'ELBOW', legL: 'HIP', legR: 'HIP', shinL: 'KNEE', shinR: 'KNEE', head: 'HEAD' };
// ---------- motions stack: a Move (the legs: Still, Idle, Walk, Run) and an Act on top (Wave, Jump, Swing, Draw): run and draw, run and swing,
// run and jump. An Act takes over the limbs it uses (the drawing arm, both arms in a jump) and adds its twist, its bounce and its leg tuck to
// the Move's; everything else keeps moving with the Move. A key 'run+draw' names a stack (saved in the .glb as its own animation too).
const MOVES = ['still', 'idle', 'walk', 'run'], ACTS = { wave: { own: ['armR', 'foreR'], add: ['head'] }, swing: { own: ['armR', 'foreR', 'armL'], add: ['torso', 'head'] },
  draw: { own: s => ['arm' + s, 'fore' + s], add: ['torso', 'head'] }, jump: { own: ['armL', 'armR'], add: ['legL', 'legR', 'shinL', 'shinR', 'torso', 'head'], bob: true } };
const animKey = () => ST.act && MOVES.includes(ST.anim) && ST.anim !== 'still' ? ST.anim + '+' + ST.act : ST.act || ST.anim;
function poseLayered(t, key) { const [mv, ac] = key.split('+'), M = poseNow(t, mv), X = poseNow(t, ac), S = poseNow(t, 'still'), R = ACTS[ac], sd = MINE.prop && MINE.prop.side === 'L' ? 'L' : 'R';
  const own = typeof R.own === 'function' ? R.own(sd) : R.own, A = {}; for (const k in M.A) A[k] = { th: M.A[k].th, ph: M.A[k].ph };
  for (const k of R.add) if (A[k]) { A[k].th += X.A[k].th - S.A[k].th; A[k].ph += X.A[k].ph - S.A[k].ph; } // the act's twist, nod and tuck, on top of the move's
  for (const k of own) if (A[k]) A[k] = { th: X.A[k].th, ph: X.A[k].ph }; // the limbs the act uses are the act's
  return { A, bob: R.bob ? M.bob + X.bob - S.bob : M.bob }; }
function stepPhysics(t, dt) { const G = MINE.geo; if (!G || !G.length) return; const T = poseNow(t, animKey()), rag = !!ST.rag, hh = MINE.fold.hh, gU = 9.8 * hh / 1.6; // gravity in world units (the figure ~1.6 m tall)
  if (!PH.S || PH.S.length !== G.length) { PH.S = G.map(g => ({ th: T.A[g.name].th, w: 0, ph: T.A[g.name].ph, wp: 0, p: null, v: [0, 0], a: [0, 0] })); PH.root = { x: 0, z: 0 }; PH.rv = { x: 0, z: 0 }; PH.bob = T.bob; }
  const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n; let F = null;
  for (let it = 0; it < n; it++) { // the root: carried by the finger, or falling back to the floor
    if (PH.carry) { const k = 1 - Math.exp(-h * 30), nx = PH.root.x + (PH.carry.x - PH.root.x) * k, nz = PH.root.z + (PH.carry.z - PH.root.z) * k; PH.rv = { x: (nx - PH.root.x) / h, z: (nz - PH.root.z) / h }; PH.root = { x: nx, z: nz }; }
    else if (PH.root.z > 0 || PH.rv.z > 0 || Math.abs(PH.rv.x) > 0.01) { PH.rv.z -= gU * h; PH.root.z += PH.rv.z * h; PH.root.x += PH.rv.x * h; if (PH.root.z <= 0) { PH.root.z = 0; PH.rv.z = Math.abs(PH.rv.z) > 8 ? -PH.rv.z * 0.3 : 0; PH.rv.x *= 0.6; } } // a little bounce, then it settles
    { const lim = 0.6 * hh; if (Math.abs(PH.root.x) > lim) { PH.root.x = Math.sign(PH.root.x) * lim; PH.rv.x = 0; } PH.root.z = Math.min(PH.root.z, 0.8 * hh); } // it stays on the stage
    if (!rag && !PH.carry) { PH.root.x *= 1 - Math.min(1, h * 3); PH.root.z = Math.max(0, PH.root.z * (1 - Math.min(1, h * 3))); } // out of ragdoll it walks back to its place
    PH.A = Object.fromEntries(G.map((g, k) => [g.name, { th: PH.S[k].th, ph: PH.S[k].ph }])); PH.bob += (T.bob - PH.bob) * (1 - Math.exp(-h * 40)); F = frames(t); // where everything is now
    G.forEach((g, k) => { const S = PH.S[k], tg = T.A[g.name], P = F[g.parent < 0 ? k : g.parent], q = g.pv, pw = [0, 2].map(i => P.M[i * 3] * q[0] + P.M[i * 3 + 1] * q[1] + P.M[i * 3 + 2] * q[2] + P.v[i]); // the joint, in the picture plane (x, z)
      if (S.p) { const v = [(pw[0] - S.p[0]) / h, (pw[1] - S.p[1]) / h]; S.a = [S.a[0] * 0.7 + 0.3 * (v[0] - S.v[0]) / h, S.a[1] * 0.7 + 0.3 * (v[1] - S.v[1]) / h]; S.v = v; } S.p = pw;
      const held = grab && grab.nm === g.name; if (g.parent < 0 && !rag) { S.th = tg.th; S.w = 0; S.ph = tg.ph; S.wp = 0; return; } // the body is the base
      const K = held ? 0 : g.name === 'head' ? (rag ? 60 : 160) : g.parent < 0 ? (rag ? 30 : 160) : rag ? 7 : 140, Z = rag ? 0.28 : 0.6, C = 2 * Math.sqrt(Math.max(K, 1)) * Z;
      const lean = g.parent < 0 ? Math.max(-0.5, Math.min(0.5, PH.rv.x * 0.003)) : 0; let acc = K * (tg.th + lean - S.th) - C * S.w; // carried sideways, the body leans back against the motion
      if (g.parent >= 0) { const M = F[k].M, tp = [0, 2].map(i => M[i * 3] * (g.tip[0] - q[0]) + M[i * 3 + 1] * (g.tip[1] - q[1]) + M[i * 3 + 2] * (g.tip[2] - q[2])), L = Math.max(0.5, Math.hypot(tp[0], tp[1])), phi = Math.atan2(tp[0], -tp[1]); // the limb's swing, as a pendulum hung from a moving joint
        acc += -((rag ? gU : 0) + S.a[1]) * Math.sin(phi) / L * (rag ? 1 : 0.35) - S.a[0] * Math.cos(phi) / L * (rag ? 1 : 0.35); }
      if (held) { S.w = (tg.th - S.th) / h; S.th = tg.th; } else { S.w += acc * h; S.th += S.w * h; }
      const lim = LIMB[g.name] && PAPER_SKELETON.LIMITS[LIMB[g.name]]; if (lim && !held) { const lo = lim.th[0] * Math.PI / 180, hi = lim.th[1] * Math.PI / 180, rel = S.th; // the turn away from the drawn pose (th 0) stays within the joint's limits
        if (rel < lo) { S.th = lo; S.w = Math.max(0, S.w); } else if (rel > hi) { S.th = hi; S.w = Math.min(0, S.w); } }
      const Kp = rag ? 20 : 140, Cp = 2 * Math.sqrt(Kp) * 0.7; S.wp += (Kp * (tg.ph - S.ph) - Cp * S.wp) * h; S.ph += S.wp * h; }); }
  PH.A = Object.fromEntries(G.map((g, k) => [g.name, { th: PH.S[k].th, ph: PH.S[k].ph }])); window.PH_STEPS = (window.PH_STEPS || 0) + 1; }
window.stepPhysics = stepPhysics;
function frames(t, pose) { // every part's place in the world: x' = M x + v; a part turns about its own pivot, then moves with its parent (the torso also bobs)
  const G = MINE.geo, { A, bob, root } = pose || poseNow(t), F = []; // pose: a given one (else the live one)
  G.forEach((g, k) => { const a = A[g.name], c = Math.cos(a.th), sn = Math.sin(a.th), cp = Math.cos(a.ph), sp = Math.sin(a.ph), Ri = [c, 0, -sn, 0, 1, 0, sn, 0, c], Rs = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
    const mm = (X, Y) => [0, 1, 2].flatMap(i => [0, 1, 2].map(j => X[i * 3] * Y[j] + X[i * 3 + 1] * Y[3 + j] + X[i * 3 + 2] * Y[6 + j])), mv = (X, v) => [0, 1, 2].map(i => X[i * 3] * v[0] + X[i * 3 + 1] * v[1] + X[i * 3 + 2] * v[2]);
    const Rk = mm(Rs, Ri), p = g.pv, rp = mv(Rk, p), lv = [p[0] - rp[0] + (g.parent < 0 && root ? root.x : 0), p[1] - rp[1], p[2] - rp[2] + (g.parent < 0 ? bob + (root ? root.z : 0) : 0)];
    if (g.parent < 0) F.push({ M: Rk, v: lv }); else { const P = F[g.parent], M = mm(P.M, Rk), v = mv(P.M, lv); F.push({ M, v: [v[0] + P.v[0], v[1] + P.v[1], v[2] + P.v[2]] }); } });
  return F; }
// ---------- a prop (a sword): its own piece, carried in a socket: on the back (between the shoulders, the grip above the drawing hand's shoulder,
// the blade across to the other hip) or in the hand (at the fist, the blade forward from it). Draw moves it from one to the other; Swing holds it.
function propSockets() { const G = MINE.geo, P = MINE.prop, by = n => G.findIndex(g => g.name === n); if (!P || !G) return null; const sd = P.side === 'L' ? 'L' : 'R', k = { torso: 0, arm: by('arm' + sd), fore: by('fore' + sd), hip: by('leg' + (sd === 'R' ? 'L' : 'R')), head: by('head') };
  if (k.arm < 0 || k.fore < 0) return null; const tor = G[0], T = Math.max(1, (k.head >= 0 ? G[k.head].pv[2] : tor.pv[2] + 10) - tor.pv[2]); let back = 0; for (let i = 1; i < tor.V.length; i += 7) back = Math.min(back, tor.V[i]);
  const unit = v => { const l = Math.hypot(...v) || 1; return v.map(c => c / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sh = G[k.arm].pv, hip = k.hip >= 0 ? G[k.hip].pv : tor.pv, O1 = reachOf(k, back, T) || [sh[0] * 1.15, back * 0.85 - 0.12 * T, sh[2] + 0.3 * T], z1 = unit([hip[0] - O1[0], 0, hip[2] - O1[2]]), y1 = [0, -1, 0], x1 = cross(y1, z1);
  const f = G[k.fore], d = unit([f.tip[0] - f.pv[0], 0, f.tip[2] - f.pv[2]]), len = Math.hypot(f.tip[0] - f.pv[0], f.tip[2] - f.pv[2]), O2 = [f.tip[0] - d[0] * 0.15 * len, f.tip[1], f.tip[2] - d[2] * 0.15 * len], z2 = [0, 1, 0], y2 = d, x2 = cross(y2, z2); // the blade forward from the fist, its flat along the forearm (it faces you in a guard)
  return { T, back: { part: 0, O: O1, B: [x1, y1, z1] }, hand: { part: k.fore, O: O2, B: [x2, y2, z2] } }; }
function reachOf(k, back, T) { // where the hand is at the grip in Draw, in the body's own frame: the sheathed grip goes there, so the hand always meets it
  const f = MINE.geo[k.fore], d = [f.tip[0] - f.pv[0], f.tip[2] - f.pv[2]], len = Math.hypot(...d) || 1, hand = [f.tip[0] - d[0] / len * 0.15 * len, f.tip[1], f.tip[2] - d[1] / len * 0.15 * len];
  const F = frames(0, poseNow(0.215 * LOOP.draw, 'draw')), M = F[k.fore].M, v = F[k.fore].v, w = [0, 1, 2].map(r => M[r * 3] * hand[0] + M[r * 3 + 1] * hand[1] + M[r * 3 + 2] * hand[2] + v[r]), M0 = F[0].M, v0 = F[0].v, q = w.map((c, i) => c - v0[i]);
  const l = [0, 1, 2].map(c => M0[c] * q[0] + M0[3 + c] * q[1] + M0[6 + c] * q[2]); l[1] = Math.min(l[1], back * 0.85 - 0.05 * T); return l; } // (never inside the body)
function propHeld(t) { const an = ST.act || ST.anim; if (an === 'swing') return [1, 1]; if (an !== 'draw') return [0, 0]; const u = (t % LOOP.draw) / LOOP.draw, sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  const pos = u < 0.19 ? 0 : u < 0.24 ? sm((u - 0.19) / 0.05) : u < 0.79 ? 1 : u < 0.84 ? 1 - sm((u - 0.79) / 0.05) : 0; // the grip goes to the hand (and back to the sheath)
  const rot = u < 0.3 ? 0 : u < 0.38 ? sm((u - 0.3) / 0.08) : u < 0.66 ? 1 : u < 0.74 ? 1 - sm((u - 0.66) / 0.08) : 0; // the blade keeps the sheath's line until it clears it, then turns to the hand's
  return [pos, rot]; }
const q4 = { of(m) { const [a, b, c, d, e, f, g, h, i] = m, tr = a + e + i; let x, y, z, w; // a rotation matrix (rows) -> a quaternion
    if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; w = 0.25 * S; x = (h - f) / S; y = (c - g) / S; z = (d - b) / S; } else if (a > e && a > i) { const S = Math.sqrt(1 + a - e - i) * 2; w = (h - f) / S; x = 0.25 * S; y = (b + d) / S; z = (c + g) / S; }
    else if (e > i) { const S = Math.sqrt(1 + e - a - i) * 2; w = (c - g) / S; x = (b + d) / S; y = 0.25 * S; z = (f + h) / S; } else { const S = Math.sqrt(1 + i - a - e) * 2; w = (d - b) / S; x = (c + g) / S; y = (f + h) / S; z = 0.25 * S; } return [x, y, z, w]; },
  slerp(p, q, t) { let d = p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3]; if (d < 0) { q = q.map(v => -v); d = -d; } if (d > 0.9995) { const r = p.map((v, i) => v + (q[i] - v) * t), l = Math.hypot(...r); return r.map(v => v / l); }
    const th = Math.acos(d), s0 = Math.sin((1 - t) * th) / Math.sin(th), s1 = Math.sin(t * th) / Math.sin(th); return p.map((v, i) => v * s0 + q[i] * s1); },
  mat([x, y, z, w]) { return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]; } };
function sockWorld(sk, F) { const M = F[sk.part].M, v = F[sk.part].v, B = sk.B, R = [0, 1, 2].flatMap(r => [0, 1, 2].map(c => M[r * 3] * B[c][0] + M[r * 3 + 1] * B[c][1] + M[r * 3 + 2] * B[c][2])), O = sk.O; // the socket's frame in the world (rows), and its origin
  return { R, o: [0, 1, 2].map(r => M[r * 3] * O[0] + M[r * 3 + 1] * O[1] + M[r * 3 + 2] * O[2] + v[r]) }; }
function propPose(t, F) { const P = MINE.prop, S = MINE.propSock; if (!P || !S) return; const [wp, wr] = propHeld(t), A = sockWorld(S.back, F), Bh = sockWorld(S.hand, F), out = P.dyn, rest = P.rest;
  const R = wr <= 0 ? A.R : wr >= 1 ? Bh.R : q4.mat(q4.slerp(q4.of(A.R), q4.of(Bh.R), wr)), o = A.o.map((c, i) => c + (Bh.o[i] - c) * wp); // the grip where the hand has it; the blade turned as far as it has cleared
  for (let k = 0; k < rest.length; k += 7) { const x = rest[k], y = rest[k + 1], z = rest[k + 2]; out[k] = R[0] * x + R[1] * y + R[2] * z + o[0]; out[k + 1] = R[3] * x + R[4] * y + R[5] * z + o[1]; out[k + 2] = R[6] * x + R[7] * y + R[8] * z + o[2]; }
  const gr = groups.find(q => q.at === 'prop'); if (gr) { gl.bindBuffer(gl.ARRAY_BUFFER, gr.b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, out); } window.PROP_HELD = wp; }
function makeProp(kind, src) { // kind 'sword' (drawn from scratch) or 'picture' (src: an image, cut out and folded thin)
  const side = MINE.prop ? MINE.prop.side : 'R'; MINE.prop = null; if (kind === 'none' || !MINE.geo) { build(); return; } MINE.prop = { kind, side, rest: null }; const sk = propSockets(); if (!sk) { MINE.prop = null; toast('A prop needs arms: Pose > Edit joints first.'); return; }
  const L = 1.3 * sk.T, V = []; let tex;
  if (kind === 'sword') { paperSword(V, L); tex = { px: new Uint8ClampedArray(PAPER_SWORD_TEX.flatMap(c => [...c, 255])), w: 4, h: 1 }; }
  else { const C = paperCutout(src, { max: 256, tol: ST.tol, one: true }), I = paperProp(C.px, C.w, [0, 0, C.w, C.h]); if (!I) { MINE.prop = null; toast('No prop found in that picture.'); return; }
    const s = L / I.length; paperFacet(V, C.px, C.w, C.h, [0, 0, C.w, C.h], { s, depth: Math.max(0.15, I.width * s * 0.1), anchor: I.grip, budget: 160, cover: 0.985, flat: true }); // a thin shape: the picture's own outline
    const ax = I.axis[0], az = -I.axis[1], th = Math.atan2(ax, az), c = Math.cos(th), sn = Math.sin(th); for (let o = 0; o < V.length; o += 7) { const x = V[o], z = V[o + 2]; V[o] = x * c - z * sn; V[o + 2] = x * sn + z * c; } // the blade along +z
    tex = C; MINE.prop.info = I; }
  MINE.prop.rest = Float32Array.from(V); MINE.prop.dyn = Float32Array.from(V); MINE.propSock = sk; TEX.prop = texOf(tex, false, TEX.prop); build(); window.PROP_READY = (window.PROP_READY || 0) + 1; }
// ---------- modules, the Gummi Ship way: a piece taken from another picture (its head, by that picture's own rig, or the whole picture when it
// has none) is folded at this figure's scale (its head as tall as this one's) and snapped onto this rig's socket for it (the neck); the part it
// replaces is hidden. It moves with the rig like any part. MINE.mods = { head: { rest, dyn } } (its own texture: TEX.mod).
function makeModule(slot, img) { const G = MINE.geo, k = G ? G.findIndex(g => g.name === slot) : -1; if (k < 0) { toast('This figure has no ' + slot + ' to swap: Pose > Edit joints first.'); return; }
  const C = paperCutout(img, { max: 256, tol: ST.tol, one: true }), R = paperRig(C.px, C.w, [0, 0, C.w, C.h]), hp = R.humanoid && R.parts.find(q => q.name === slot), n = C.w * C.h;
  const mask = hp ? hp.mask : Uint8Array.from({ length: n }, (_, i) => C.px[i * 4 + 3] >= 128 ? 1 : 0), px = new Uint8ClampedArray(C.px); for (let i = 0; i < n; i++) if (!mask[i]) px[i * 4 + 3] = 0;
  const rows = (m, w, H, ok) => { let a = H, b = -1; for (let i = 0; i < m.length; i++) if (m[i] && ok(i)) { const y = (i / w) | 0; a = Math.min(a, y); b = Math.max(b, y); } return Math.max(1, b - a + 1); };
  const mine = MINE.rig.parts.find(q => q.name === slot), myH = rows(mine.mask, MINE.w, MINE.h, i => MINE.px[i * 4 + 3] >= 128) * MINE.fold.s, theirH = rows(mask, C.w, C.h, i => C.px[i * 4 + 3] >= 128);
  let piv = hp ? hp.pivot : null; if (!piv) { let x0 = C.w, x1 = 0, y1 = 0; for (let i = 0; i < n; i++) if (mask[i] && C.px[i * 4 + 3] >= 128) { const x = i % C.w, y = (i / C.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } piv = [(x0 + x1 + 1) / 2, y1 + 1]; } // a lone head: it sits on its lowest point
  const s = myH / theirH, V = []; paperFacet(V, px, C.w, C.h, [0, 0, C.w, C.h], { s, depth: depth() * MINE.fold.hh * 0.05, anchor: piv, budget: Math.max(80, Math.round(ST.budget * 0.4)), cover: 0.985, flat: ST.abs !== 'smooth' });
  if (!V.length) { toast('No ' + slot + ' found in that picture.'); return; } MINE.mods = { [slot]: { part: k, rest: Float32Array.from(V), dyn: Float32Array.from(V) } }; TEX.mod = texOf({ px, w: C.w, h: C.h }, ST.abs === 'smooth' ? 'smooth' : false, TEX.mod);
  build(); window.MODULE_READY = (window.MODULE_READY || 0) + 1; }
function modulePose(F) { for (const nm in MINE.mods || {}) { const m = MINE.mods[nm], g = MINE.geo[m.part], { M, v } = F[m.part], o = g.pv, r = m.rest, d = m.dyn;
    for (let i = 0; i < r.length; i += 7) { const x = r[i] + o[0], y = r[i + 1] + o[1], z = r[i + 2] + o[2]; d[i] = M[0] * x + M[1] * y + M[2] * z + v[0]; d[i + 1] = M[3] * x + M[4] * y + M[5] * z + v[1]; d[i + 2] = M[6] * x + M[7] * y + M[8] * z + v[2]; }
    const gr = groups.find(q => q.at === 'mod'); if (gr) { gl.bindBuffer(gl.ARRAY_BUFFER, gr.b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, d); } } }
function applyPose(t) { // rest mesh -> posed mesh
  const G = MINE.geo, F = frames(t), out = MINE.dyn, rest = MINE.rest; let o = 0;
  const hide = new Set(Object.values(MINE.mods || {}).map(m => m.part));
  G.forEach((g, k) => { const { M, v } = F[k]; if (hide.has(k)) { for (let i = 0; i < g.n; i++, o += 7) { out[o] = v[0]; out[o + 1] = v[1]; out[o + 2] = v[2]; } return; } /* swapped out: folded to a point */ for (let i = 0; i < g.n; i++, o += 7) { const x = rest[o], y = rest[o + 1], z = rest[o + 2];
    out[o] = M[0] * x + M[1] * y + M[2] * z + v[0]; out[o + 1] = M[3] * x + M[4] * y + M[5] * z + v[1]; out[o + 2] = M[6] * x + M[7] * y + M[8] * z + v[2]; } });
  const gr = groups.find(q => q.at === 'rig'); if (gr) { gl.bindBuffer(gl.ARRAY_BUFFER, gr.b); gl.bufferSubData(gl.ARRAY_BUFFER, 0, out); } if (MINE.prop) propPose(t, F); if (MINE.mods) modulePose(F); }
const pivotNow = (name, t) => { const G = MINE.geo, k = G.findIndex(q => q.name === name), g = G[k], F = frames(t), P = g.parent < 0 ? F[k] : F[g.parent], p = g.pv; // a pivot moves with its parent
  return [0, 1, 2].map(i => P.M[i * 3] * p[0] + P.M[i * 3 + 1] * p[1] + P.M[i * 3 + 2] * p[2] + P.v[i]); };
function toScreen(P) { const rc = cv.getBoundingClientRect(), M = matrix(rc.width, rc.height), q = [0, 1, 2, 3].map(j => P[0] * M[j] + P[1] * M[4 + j] + P[2] * M[8 + j] + M[12 + j]); return [rc.left + (q[0] / q[3] + 1) / 2 * rc.width, rc.top + (1 - q[1] / q[3]) / 2 * rc.height]; }
const rigLive = () => ST.mode === 'mine' && MINE.geo && ST.tool !== 'cut' && groups.some(g => g.at === 'rig');
function joints(t) { // the rig drawn over the figure: a see-through ragdoll skeleton (bones from joint to joint, out to the hands, feet and crown) and a dot per joint
  const box = $('joints'), sk = $('skel'); if (!(rigLive() && ST.tool === 'pose' && (MINE.rig.humanoid || ST.editJ))) { box.innerHTML = ''; sk.innerHTML = ''; BONES = []; JOINT_AT = []; return; }
  const G = MINE.geo, F = frames(t), at = (k, p) => toScreen([0, 1, 2].map(i => F[k].M[i * 3] * p[0] + F[k].M[i * 3 + 1] * p[1] + F[k].M[i * 3 + 2] * p[2] + F[k].v[i]));
  const piv = G.map((g, k) => jdrag && jdrag.name === g.name ? jdrag.at : at(g.parent < 0 ? k : g.parent, g.pv)), idx = n => G.findIndex(g => g.name === n), bones = [];
  G.forEach((g, k) => { const kids = G.map((c, j) => c.parent === k ? j : -1).filter(j => j >= 0);
    if (g.parent < 0) { const hd = idx('head'), top = hd >= 0 ? piv[hd] : at(k, g.tip); bones.push([piv[k], top, k]); for (const j of kids) if (j !== hd) bones.push([/^arm/.test(G[j].name) ? top : piv[k], piv[j], -1]); if (!kids.length) bones.push([piv[k], at(k, g.tip), k]); } // spine, collarbones, pelvis
    else { for (const j of kids) bones.push([piv[k], piv[j], k]); if (!kids.length) bones.push([piv[k], at(k, g.tip), k]); } }); // upper limb to elbow / knee; forearm, shin, head out to their tips
  BONES = bones; const held = grab ? idx(grab.nm) : -2, ln = (w, c, only) => bones.filter(q => only == null || q[2] === only).map(([a, b]) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`).join('');
  sk.innerHTML = ln(ST.editJ ? 8 : 7, 'rgba(0,0,0,.22)') + ln(ST.editJ ? 4.5 : 3.5, 'rgba(255,255,255,.78)') + (held >= 0 ? ln(5.5, css('--tint'), held) : ''); // the bone in your hand, tinted
  while (box.children.length < G.length) { const d = document.createElement('div'); d.className = 'joint'; box.appendChild(d); } while (box.children.length > G.length) box.lastChild.remove();
  const EV = { torso: 'TORSO', head: 'HEAD', armL: 'SHOULDER_R', armR: 'SHOULDER_L', foreL: 'ELBOW_R', foreR: 'ELBOW_L', legL: 'HIP_R', legR: 'HIP_L', shinL: 'KNEE_R', shinR: 'KNEE_L' }, ev = n => { const j = MINE.skel && MINE.skel.joints.find(q => q.name === EV[n]); return j ? ' ev-' + j.evidence : ''; }; // the picture's left arm is the character's right
  G.forEach((g, k) => { const d = box.children[k]; d.className = 'joint' + (ST.editJ ? ' edit ' + g.name + ev(g.name) : '') + (jdrag && jdrag.name === g.name ? ' drag' : ''); d.dataset.name = g.name; d.title = g.name; d.style.left = piv[k][0] + 'px'; d.style.top = piv[k][1] + 'px'; });
  JOINT_AT = G.map((g, k) => [g.name, piv[k]]); }
let JOINT_AT = [], BONES = []; // BONES: [screen a, screen b, the part that turns it (-1: none)] // where each joint was drawn last (Edit joints picks the nearest to the finger)
let jdrag = null; // a joint being moved by hand
function screenToPicture(x, y) { // the point of the picture (px) under the finger: a ray from the lens to the card's plane
  if (!MINE.S || !MINE.fold) return null; const rc = cv.getBoundingClientRect(), [nx, ny] = unview((x - rc.left) / rc.width * 2 - 1, 1 - (y - rc.top) / rc.height * 2), a = rc.width / rc.height, { e, f, r, u } = eye();
  const d = [0, 1, 2].map(i => f[i] + r[i] * nx * a / FOV + u[i] * ny / FOV); if (Math.abs(d[1]) < 1e-6) return null; const l = -e[1] / d[1], X = e[0] + l * d[0], Z = e[2] + l * d[2], s = MINE.fold.s, A = MINE.S.anchor;
  return l > 0 ? [X / s + A[0], A[1] - Z / s] : null; }
function worldAt(x, y) { const p = screenToPicture(x, y); if (!p) return null; const s = MINE.fold.s, A = MINE.S.anchor; return [(p[0] - A[0]) * s, (A[1] - p[1]) * s]; } // the point of the picture plane under the finger, in world units (x right, z up)
function placeJoint(x, y) { const p = screenToPicture(x, y), nm = jdrag.name; jdrag = null; if (!p) return; // place the joint, and rebuild the rig round it
  const J = MINE.joints = MINE.joints || {}; for (const g of MINE.geo) if (!J[g.name]) { const q = MINE.rig.parts.find(r => r.name === g.name); if (q) J[g.name] = q.pivot.slice(); } J[nm] = p; // the others are held where they are, so only this one moves
  MINE.confirmed = [...new Set([...(MINE.confirmed || []), nm])]; rigMine(true, true); build(); if (ST.editJ) skelHint(); window.JOINT_MOVED = (window.JOINT_MOVED || 0) + 1; }
function bodyView() { if (!MINE.rigTex || !MINE.rig) return; const on = ST.tool === 'pose' && ST.editJ && ST.bodyBrush, w = MINE.w, h = MINE.h, W2 = MINE.rigW, P = MINE.rig.parts.length, tex = on ? new Uint8ClampedArray(MINE.rigTex) : MINE.rigTex;
  if (on && MINE.body) for (let k = 0; k < P; k++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (MINE.body[y * w + x]) { const o = ((k * h + y) * W2 + x) * 4; tex[o] = tex[o] * 0.45 + 224 * 0.55; tex[o + 1] = tex[o + 1] * 0.45 + 164 * 0.55; tex[o + 2] = tex[o + 2] * 0.45 + 71 * 0.55; } // amber: stays with the body
  TEX.rig = texOf({ px: tex, w: W2, h: h * P }, ST.abs === 'smooth' ? 'smooth' : false, TEX.rig); }
$('bodyBtn').onclick = () => { ST.bodyBrush = !ST.bodyBrush; $('bodyBtn').setAttribute('aria-pressed', ST.bodyBrush); $('poseHint').textContent = ST.bodyBrush ? 'Brush over what should stay with the body (a cape, a pack, a sheathed sword): it turns amber, and the arms let go of it.' : ''; if (!ST.bodyBrush) skelHint(); bodyView(); };
function skelHint() { const P = MINE.skel && MINE.skel.humanoid && MINE.skel.profile; $('poseHint').textContent = 'Drag a joint to where it is. Filled: yours. Ringed: seen. Dashed: estimated.' + (P ? ` Head ${P.head.toFixed(2)}, arm ${(P.upperArm + P.forearm).toFixed(2)}, leg ${(P.upperLeg + P.lowerLeg).toFixed(2)} torsos.` : ''); }
const nearestJoint = (x, y) => { let best = null, bd = 34 * 34; for (const [nm, q] of JOINT_AT) { const d = (q[0] - x) ** 2 + (q[1] - y) ** 2; if (d < bd) { bd = d; best = nm; } } return best; }; // the finger needs no exact hit: the nearest joint within 34 px
let grab = null; // a part being posed by a drag
function pickPart(x, y) { if (BONES.length) { let best = null, bd = 30 * 30; for (const [a, b, k] of BONES) { if (k < 0) continue; const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)); // the nearest bone under the finger
    if (MINE.geo[k].parent < 0 && !ST.rag) continue; /* the torso is the base the limbs hang from: it is not grabbed (a drag near the spine turns the view) */ const d = (a[0] + u * dx - x) ** 2 + (a[1] + u * dy - y) ** 2; if (d < bd) { bd = d; best = MINE.geo[k].name; } } return best; } return pickMesh(x, y); }
function pickMesh(x, y) { const rc = cv.getBoundingClientRect(), M = matrix(rc.width, rc.height), G = MINE.geo, out = MINE.dyn; let best = null, bd = 44 * 44, o = 0;
  G.forEach(g => { for (let i = 0; i < g.n; i++, o += 7) { if (i % 3) continue; const q = [0, 1, 2, 3].map(j => out[o] * M[j] + out[o + 1] * M[4 + j] + out[o + 2] * M[8 + j] + M[12 + j]), sx = rc.left + (q[0] / q[3] + 1) / 2 * rc.width, sy = rc.top + (1 - q[1] / q[3]) / 2 * rc.height, d = (sx - x) ** 2 + (sy - y) ** 2 + (g.name === 'torso' ? 400 : 0); /* limbs win over the torso when both are near the finger */
    if (d < bd) { bd = d; best = g.name; } } }); return best; }
// ---------- touch: drag to turn, pinch or wheel to zoom, tap to keep / remove (in Cut), double-tap to reset ----------
const pts = new Map(); let held = false, pd = 0, down = null, lastTap = 0;
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); if (ST.editJ && !ST.bodyBrush && rigLive() && !pts.size) { const nm = nearestJoint(e.clientX, e.clientY); if (nm) { jdrag = { name: nm, at: [e.clientX, e.clientY], id: e.pointerId }; return; } }
  pts.set(e.pointerId, [e.clientX, e.clientY]); held = true; cam.to = null; grab = null;
  if (paintLive() && pts.size === 1) { stroke = { at: [e.clientX, e.clientY] }; dab(e.clientX, e.clientY); if (ST.tool === 'pose') bodyView(); else depthUI(); } else stroke = null;
  if (ST.rag && ST.tool === 'pose' && rigLive() && pts.size === 1) { const nm = pickPart(e.clientX, e.clientY), w = worldAt(e.clientX, e.clientY); if (w && (!nm || MINE.geo.find(g => g.name === nm).parent < 0)) { PH.carry = { x: PH.root.x, z: PH.root.z, from: w, root: { ...PH.root } }; grab = null; down = null; return; } } // Ragdoll: pick the body up
  if (ST.tool === 'pose' && !stroke && rigLive() && MINE.rig.humanoid && pts.size === 1) { const nm = pickPart(e.clientX, e.clientY); if (nm) { const [px, py] = toScreen(pivotNow(nm, performance.now() / 1000)); grab = { nm, a: Math.atan2(-(e.clientY - py), e.clientX - px) }; } } if (pts.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() }; else down = null; closeSheet(); });
cv.addEventListener('pointermove', e => { if (jdrag && jdrag.id === e.pointerId) { jdrag.at = [e.clientX, e.clientY]; return; } const p = pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
  if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pd) cam.zoom = Math.max(10, Math.min(3000, (cam.zoom || radius * 1.6) * pd / d)); pd = d; return; }
  if (stroke && pts.size === 1) { strokeTo(e.clientX, e.clientY); return; }
  if (PH.carry && pts.size === 1) { const w = worldAt(e.clientX, e.clientY); if (w) { PH.carry.x = PH.carry.root.x + w[0] - PH.carry.from[0]; PH.carry.z = Math.max(0, PH.carry.root.z + w[1] - PH.carry.from[1]); } return; }
  if (grab && pts.size === 1) { const [px, py] = toScreen(pivotNow(grab.nm, performance.now() / 1000)), a = Math.atan2(-(e.clientY - py), e.clientX - px); let d = a - grab.a; d = Math.atan2(Math.sin(d), Math.cos(d)); ST.pose[grab.nm] = (ST.pose[grab.nm] || 0) + (Math.cos(cam.yaw) >= 0 ? d : -d); grab.a = a; return; }
  if (ST.tool === 'cut') return; cam.yaw -= dx * 0.006; cam.pitch = Math.max(0.02, Math.min(1.45, cam.pitch + dy * 0.005)); });
const up = e => { if (PH.carry) { PH.carry = null; pts.delete(e.pointerId); held = pts.size > 0; down = null; window.DROPPED = (window.DROPPED || 0) + 1; return; } // let go: it keeps its swing, and falls
  if (jdrag && jdrag.id === e.pointerId) { if (e.type === 'pointerup') placeJoint(e.clientX, e.clientY); else jdrag = null; return; } pts.delete(e.pointerId); pd = 0; if (!pts.size) { held = false; if (grab) { grab = null; down = null; return; } if (stroke) { stroke = null; down = null; if (ST.tool === 'pose') { rigMine(true, true); build(); bodyView(); window.BODY_PAINTED = (window.BODY_PAINTED || 0) + 1; return; } build(); depthUI(); window.PAINTED = (window.PAINTED || 0) + 1; return; } }
  if (down && e.type === 'pointerup' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 400) {
    if (ST.tool === 'cut') markAt(e.clientX, e.clientY); else if (ST.tool === 'depth' && ST.layersOn && rigLive() && MINE.rig.humanoid) layerTap(e.clientX, e.clientY); else { const t = performance.now(); if (t - lastTap < 320) { cam.zoom = 0; cam.to = { yaw: 0.5, pitch: 0.22 }; } lastTap = t; } }
  down = null; };
function layerTap(x, y) { const nm = pickPart(x, y); if (!nm) return; const L = MINE.layers = MINE.layers || {}, now = L[nm] != null ? L[nm] : (LAYER[nm] ?? 1); L[nm] = (now + 1) % 5; build(); toast(nm.replace(/L$/, ' (left)').replace(/R$/, ' (right)') + ': layer ' + L[nm] + ', ' + LAYER_NAME[L[nm]]); window.LAYERED = (window.LAYERED || 0) + 1; }
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
cv.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = Math.max(10, Math.min(3000, (cam.zoom || radius * 1.6) * (1 + e.deltaY * 0.001))); }, { passive: false });
function markAt(x, y) { // cast a ray from the tap onto the picture's face: that spot is to keep, or to remove
  if (ST.mode !== 'mine' || !MINE.S || !MINE.fold) return; const rc = cv.getBoundingClientRect(), [nx, ny] = unview((x - rc.left) / rc.width * 2 - 1, 1 - (y - rc.top) / rc.height * 2), a = rc.width / rc.height, { e, f, r, u } = eye();
  const d = [0, 1, 2].map(i => f[i] + r[i] * nx * a / FOV + u[i] * ny / FOV), yp = (e[1] >= 0 ? 1 : -1) * MINE.fold.th / 2; if (Math.abs(d[1]) < 1e-6) return;
  const l = (yp - e[1]) / d[1], X = e[0] + l * d[0], Z = e[2] + l * d[2], s = MINE.fold.s, A = MINE.S.anchor, U = (X / s + A[0]) / MINE.w, V = (A[1] - Z / s) / MINE.h;
  if (l <= 0 || U < 0 || V < 0 || U > 1 || V > 1) return; const rp = document.createElement('div'); rp.className = 'ripple'; rp.style.left = x + 'px'; rp.style.top = y + 'px'; document.body.appendChild(rp); setTimeout(() => rp.remove(), 600);
  MINE.marks.push([U, V, MINE.mark === 'keep']); $('undo').disabled = false; makeMine(); }
window.screenOf = (U, V) => { // where a point of your picture's front face is on screen (used by the tests)
  const s = MINE.fold.s, A = MINE.S.anchor, P = [(U * MINE.w - A[0]) * s, MINE.fold.th / 2, (A[1] - V * MINE.h) * s, 1], rc = cv.getBoundingClientRect(), M = matrix(rc.width, rc.height), o = [0, 1, 2, 3].map(j => P[0] * M[j] + P[1] * M[4 + j] + P[2] * M[8 + j] + P[3] * M[12 + j]);
  return [rc.left + (o[0] / o[3] + 1) / 2 * rc.width, rc.top + (1 - o[1] / o[3]) / 2 * rc.height]; };
// ---------- the tools: Photo, Cut, Depth, Look (one panel at a time) ----------
const PANELS = { cut: 'pCut', depth: 'pDepth', views: 'pViews', pose: 'pPose', look: 'pLook' }, TABS = { cut: 'tCut', depth: 'tDepth', views: 'tViews', pose: 'tPose', look: 'tLook' };
function setTool(t) { if (ST.tool === t) t = null; const was = ST.tool; ST.tool = t; if (was === 'pose' && t !== 'pose' && ST.editJ) $('editJ').click(); for (const k in PANELS) { $(PANELS[k]).hidden = k !== t; $(TABS[k]).setAttribute('aria-pressed', k === t); }
  if (t === 'views' && MINE.img && ST.mode !== 'mine') { ST.mode = 'mine'; build(); }
  if (t === 'pose' && MINE.img) { if (ST.mode !== 'mine') { ST.mode = 'mine'; build(); } cam.zoom = 0; cam.to = { yaw: 0, pitch: 0.12 }; setTimeout(fitFigure, 40); }
  if (t === 'cut' && MINE.img) { ST.mode = 'mine'; cam.zoom = 0; cam.to = { yaw: 0, pitch: 0.06 }; $('undo').disabled = !MINE.marks.length; }
  if (t === 'depth' && ST.dsrc === 'paint' && MINE.img) { if (ST.mode !== 'mine') { ST.mode = 'mine'; build(); } cam.zoom = 0; cam.to = { yaw: 0, pitch: 0.06 }; }
  if ((t === 'depth') !== (was === 'depth')) depthUI();
  if ((t === 'cut') !== (was === 'cut') && MINE.img) build(); // Cut shows the whole picture, with what is removed dimmed
  refreshHello(); }
for (const b of document.querySelectorAll('[data-mark]')) b.onclick = () => { MINE.mark = b.dataset.mark; document.querySelectorAll('[data-mark]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('cutHint').textContent = MINE.mark === 'keep' ? 'Tap the person or thing you want to keep.' : 'Tap what you want removed.'; };
$('tCut').onclick = () => setTool('cut'); $('tPose').onclick = () => setTool('pose');
for (const b of document.querySelectorAll('[data-anim]')) b.onclick = () => { const a = b.dataset.anim; if (ST.editJ && a !== 'still') $('editJ').click(); /* a motion ends Edit joints */
  if (MOVES.includes(a)) ST.anim = a; else { ST.act = ST.act === a ? null : a; if (!MOVES.includes(ST.anim)) ST.anim = 'still'; } // an act stacks on the move (tap it again to stop it)
  document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x.dataset.anim === ST.anim || x.dataset.anim === ST.act)); window.ANIM_KEY = animKey();
  if (a === 'walk') { cam.zoom = 0; cam.to = { yaw: 0.9, pitch: 0.18 }; } if (a === 'draw' && ST.act === 'draw') { cam.zoom = 0; cam.to = { yaw: MINE.prop && MINE.prop.side === 'L' ? -2.3 : 2.3, pitch: 0.2 }; } /* the draw is seen from behind the drawing shoulder */ };
$('ragBtn').onclick = () => { ST.rag = !ST.rag; $('ragBtn').setAttribute('aria-pressed', ST.rag); if (ST.editJ) $('editJ').click(); $('poseHint').textContent = ST.rag ? 'Ragdoll: drag the body to pick it up, a limb to swing it. Let go and it drops.' : 'Drag an arm, a leg or the head to pose it.'; window.RAG = ST.rag; };
$('reset').onclick = () => { ST.pose = {}; PH.root = { x: 0, z: 0 }; PH.rv = { x: 0, z: 0 }; PH.carry = null; if (PH.S) for (const S of PH.S) { S.w = 0; S.wp = 0; } if (ST.editJ && (MINE.joints || MINE.forceRig || MINE.body)) { MINE.joints = null; MINE.confirmed = null; MINE.body = null; rigMine(true, true); build(); skelHint(); bodyView(); } };
$('editJ').onclick = () => { ST.editJ = !ST.editJ; $('editJ').classList.toggle('tinted', ST.editJ); $('editJ').textContent = ST.editJ ? 'Done' : 'Edit joints';
  if (ST.editJ && MINE.rig && !MINE.rig.humanoid) { MINE.forceRig = true; rigMine(true, true); build(); } // no rig found: start from the usual proportions, to be placed by hand
  $('bodyBtn').hidden = !ST.editJ; if (!ST.editJ && ST.bodyBrush) { ST.bodyBrush = false; $('bodyBtn').setAttribute('aria-pressed', false); bodyView(); }
  if (ST.editJ) { ST.animBefore = ST.anim; ST.actBefore = ST.act; ST.anim = 'still'; ST.act = null; ST.pose = {}; cam.to = { yaw: 0, pitch: 0.05 }; skelHint(); setTimeout(fitFigure, 40); }
  else { ST.anim = ST.animBefore || 'idle'; ST.act = ST.actBefore || null; $('poseHint').textContent = MINE.rig && MINE.rig.humanoid ? 'Drag an arm, a leg or the head to pose it.' : 'No arms or legs found: Edit joints to place them.'; }
  document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x.dataset.anim === ST.anim || x.dataset.anim === ST.act)); };
for (const b of document.querySelectorAll('[data-prop]')) b.onclick = () => { const k = b.dataset.prop; if (k === 'picture') { $('fileProp').click(); return; } makeProp(k); propUI(); };
$('fileProp').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); im.onload = () => { toast('Folding the prop…', true); setTimeout(() => { makeProp('picture', im); hideToast(); propUI(); }, 30); }; im.onerror = () => toast('That file could not be opened as a picture.'); im.src = URL.createObjectURL(f); e.target.value = ''; };
for (const b of document.querySelectorAll('[data-head]')) b.onclick = () => { if (b.dataset.head === 'swap') { $('fileHead').click(); return; } MINE.mods = null; build(); document.querySelectorAll('[data-head]').forEach(x => x.setAttribute('aria-pressed', x.dataset.head === 'own')); };
$('fileHead').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); im.onload = () => { toast('Fitting the head…', true); setTimeout(() => { makeModule('head', im); hideToast(); document.querySelectorAll('[data-head]').forEach(x => x.setAttribute('aria-pressed', (x.dataset.head === 'swap') === !!MINE.mods)); }, 30); }; im.src = URL.createObjectURL(f); e.target.value = ''; };
$('propHand').onclick = () => { if (!MINE.prop) return; MINE.prop.side = MINE.prop.side === 'L' ? 'R' : 'L'; MINE.propSock = propSockets(); propUI(); };
function propUI() { const k = MINE.prop ? MINE.prop.kind : 'none'; document.querySelectorAll('[data-prop]').forEach(x => x.setAttribute('aria-pressed', x.dataset.prop === k)); $('propHand').hidden = !MINE.prop;
  if (MINE.prop) $('viewsHint').textContent = 'The ' + (k === 'sword' ? 'sword' : 'prop') + ' rides on the back. Pose > Draw pulls it out over the ' + (MINE.prop.side === 'L' ? 'left' : 'right') + ' shoulder (as you look at it); Swing swings it.'; }
$('tViews').onclick = () => setTool('views'); $('turn').onclick = () => { cam.zoom = 0; cam.to = { yaw: Math.cos(cam.yaw) > 0 ? Math.PI : 0, pitch: 0.12 }; };
for (const b of document.querySelectorAll('[data-back]')) b.onclick = () => { if (b.dataset.back === 'picture' && !MINE.backC) { $('fileBack').click(); return; } MINE.backMode = b.dataset.back; rigMine(true); build(); };
for (const b of document.querySelectorAll('[data-side]')) b.onclick = () => { if (b.dataset.side === 'picture') { if (!MINE.sides.length) { $('fileSide').click(); return; } MINE.sideMode = 'picture'; } else MINE.sideMode = 'round'; rigMine(true); build(); };
$('flipSide').onclick = () => { const sd = MINE.sides[MINE.sides.length - 1], F = MINE.sideFit && MINE.sideFit.panels[MINE.sides.length - 1]; sd.facing = F && F.facing === 'right' ? 'left' : 'right'; rigMine(true); build(); };
$('otherSide').onclick = () => { MINE.addSide = true; $('fileSide').click(); };
$('fileSide').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); im.onload = () => { toast('Fitting the side view…', true); setTimeout(() => {
  const C = paperCutout(im, { max: ST.detail, tol: ST.tol, one: true, method: ST.method }); MINE.sides = MINE.addSide && MINE.sides.length ? [MINE.sides[0], { C, facing: null }] : [{ C, facing: null }]; MINE.addSide = false; MINE.sideMode = 'picture'; rigMine(true); build(); hideToast(); cam.zoom = 0;
  { const q = MINE.sideFit && MINE.sideFit.panels[MINE.sides.length - 1]; cam.to = { yaw: q && q.east ? Math.PI / 2 - 0.2 : -Math.PI / 2 + 0.2, pitch: 0.12 }; } window.SIDE_DONE = (window.SIDE_DONE || 0) + 1; }, 30); };
  im.onerror = () => toast('That file could not be opened as a picture.'); im.src = URL.createObjectURL(f); e.target.value = ''; };
$('fileBack').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); im.onload = () => { toast('Fitting the back view…', true); setTimeout(() => {
  MINE.backImg = im; MINE.backC = paperCutout(im, { max: ST.detail, tol: ST.tol, one: true, method: ST.method }); MINE.backMode = 'picture'; rigMine(true); build(); hideToast(); cam.zoom = 0; cam.to = { yaw: Math.PI, pitch: 0.12 }; window.BACK_DONE = (window.BACK_DONE || 0) + 1; }, 30); };
  im.onerror = () => toast('That file could not be opened as a picture.'); im.src = URL.createObjectURL(f); e.target.value = ''; }; $('tDepth').onclick = () => setTool('depth'); $('tLook').onclick = () => setTool('look'); $('done').onclick = () => setTool(null);
$('undo').onclick = () => { MINE.marks.pop(); $('undo').disabled = !MINE.marks.length; makeMine(); };
$('thick').oninput = build;
// ---------- Depth: from the outline (Shape), the painting's colour regions (Planes), or painted by hand (Paint: Near / Middle / Far, or a grey Map) ----------
const paintLive = () => (ST.tool === 'depth' && ST.dsrc === 'paint' || ST.tool === 'pose' && ST.editJ && ST.bodyBrush) && ST.mode === 'mine' && !!MINE.img && !!MINE.rig;
function depthView() { // while you paint, the figure's front shows the depth map (white near, black far) over a faint trace of the painting
  const w = MINE.w, h = MINE.h, W2 = MINE.rigW, out = new Uint8ClampedArray(MINE.rigTex), M = MINE.depthMap;
  for (let k = 0; k < MINE.rig.parts.length; k++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = ((k * h + y) * W2 + x) * 4, l = 0.299 * out[o] + 0.587 * out[o + 1] + 0.114 * out[o + 2], v = (M ? M[y * w + x] : 128) * 0.8 + l * 0.2; out[o] = out[o + 1] = out[o + 2] = v; }
  return out; }
function depthUI() { document.querySelectorAll('[data-dsrc]').forEach(x => x.setAttribute('aria-pressed', x.dataset.dsrc === ST.dsrc)); document.querySelectorAll('[data-brush]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.brush === ST.brush));
  const paint = ST.dsrc === 'paint'; $('layersBtn').setAttribute('aria-pressed', ST.layersOn); $('brushRow').hidden = !paint; $('dclear').disabled = !MINE.depthMap; // painting: the brush takes the shape rows' place, so the figure stays in view
  $('shapeSeg').hidden = $('thickRow').hidden = paint; $('geoSeg').hidden = paint || ST.shape !== 'facets';
  const hint = (paint ? (MINE.img ? 'Near comes toward you, Far goes back. Map: a grey picture, white near.' : 'Choose a picture first, then paint its depth.') : ST.dsrc === 'planes' ? 'Each colour region becomes one plane.' : '')
    + (ST.layersOn ? (MINE.rig && MINE.rig.humanoid ? ' Tap a part to bring it a layer forward (0 back to 4 front).' : ' Layers need a rig with arms and legs.') : ''); $('depthHint').textContent = hint.trim(); $('depthHint').hidden = !hint;
  if (TEX.rig && MINE.rigTex && MINE.rig) TEX.rig = texOf({ px: paintLive() ? depthView() : MINE.rigTex, w: MINE.rigW, h: MINE.h * MINE.rig.parts.length }, ST.abs === 'smooth' ? 'smooth' : false, TEX.rig); }
function providerButtons() { const seg = $('dsrcSeg'); seg.querySelectorAll('[data-dsrc^="p:"]').forEach(b => b.remove()); for (const pr of PAPER_DEPTH.providers) { const b = document.createElement('button'); b.dataset.dsrc = 'p:' + pr.name; b.textContent = pr.name; b.setAttribute('aria-pressed', 'false'); seg.appendChild(b); } }
window.addDepthProvider = (name, fn) => { PAPER_DEPTH.register(name, fn); providerButtons(); }; // an optional depth estimate (a neural model, say) plugs in here; Papercraft never needs one
async function runProvider(name) { const pr = PAPER_DEPTH.providers.find(p => p.name === name); if (!pr || !MINE.img) return; toast('Estimating depth (' + name + ')…', true);
  try { const m = await pr.fn({ px: MINE.px, w: MINE.w, h: MINE.h }); if (!m || m.length !== MINE.w * MINE.h) throw 0; MINE.depthMap = Uint8Array.from(m); ST.dsrc = 'paint'; hideToast(); build(); depthUI(); window.DEPTH_DONE = (window.DEPTH_DONE || 0) + 1; }
  catch (_) { toast('That depth estimate did not work. Shape, Planes and Paint still do.'); } }
$('dsrcSeg').onclick = e => { const b = e.target.closest('[data-dsrc]'); if (!b) return; const v = b.dataset.dsrc; if (v.startsWith('p:')) { runProvider(v.slice(2)); return; }
  ST.dsrc = v; if (v === 'paint' && MINE.img) { if (ST.mode !== 'mine') ST.mode = 'mine'; cam.zoom = 0; cam.to = { yaw: 0, pitch: 0.06 }; } build(); depthUI(); };
for (const b of document.querySelectorAll('[data-brush]')) b.onclick = () => { ST.brush = +b.dataset.brush; depthUI(); };
$('layersBtn').onclick = () => { ST.layersOn = !ST.layersOn; build(); depthUI(); };
$('dclear').onclick = () => { MINE.depthMap = null; build(); depthUI(); };
$('dmap').onclick = () => $('fileDepth').click();
$('fileDepth').onchange = e => { const f = e.target.files[0]; if (!f || !MINE.img) return; const im = new Image(); im.onload = () => { // a grey picture the size and framing of your picture: white near, black far
    const c = document.createElement('canvas'); c.width = MINE.w; c.height = MINE.h; const x = c.getContext('2d'); x.drawImage(im, 0, 0, MINE.w, MINE.h); const d = x.getImageData(0, 0, MINE.w, MINE.h).data, M = new Uint8Array(MINE.w * MINE.h);
    for (let i = 0; i < M.length; i++) M[i] = d[i * 4 + 3] < 128 ? 128 : Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]); MINE.depthMap = M; ST.dsrc = 'paint'; build(); depthUI(); window.DEPTH_DONE = (window.DEPTH_DONE || 0) + 1; };
  im.onerror = () => toast('That file could not be opened as a picture.'); im.src = URL.createObjectURL(f); e.target.value = ''; };
let stroke = null, paintT = 0; // a brush stroke in progress
function dab(x, y) { const p = screenToPicture(x, y); if (!p) return; const w = MINE.w, h = MINE.h;
  if (ST.tool === 'pose') { if (!MINE.body || MINE.body.length !== w * h) MINE.body = new Uint8Array(w * h); const r = Math.max(2, Math.round(Math.max(w, h) * 0.03)); // the body brush: what it touches stays with the body
    for (let yy = Math.floor(p[1] - r); yy <= p[1] + r; yy++) for (let xx = Math.floor(p[0] - r); xx <= p[0] + r; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h && (xx + 0.5 - p[0]) ** 2 + (yy + 0.5 - p[1]) ** 2 <= r * r && MINE.px[(yy * w + xx) * 4 + 3] >= 128) MINE.body[yy * w + xx] = 1; return; } if (!MINE.depthMap || MINE.depthMap.length !== w * h) MINE.depthMap = new Uint8Array(w * h).fill(128);
  const M = MINE.depthMap, r = Math.max(2, Math.round(Math.max(w, h) * 0.035)), t = ST.brush;
  for (let yy = Math.floor(p[1] - r); yy <= p[1] + r; yy++) for (let xx = Math.floor(p[0] - r); xx <= p[0] + r; xx++) { if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const d = Math.hypot(xx + 0.5 - p[0], yy + 0.5 - p[1]) / r; if (d > 1) continue; const i = yy * w + xx; M[i] = Math.round(M[i] + (t - M[i]) * 0.35 * (1 - d * d)); } }
function strokeTo(x, y) { if (ST.tool === 'pose') { const [x0, y0] = stroke.at, n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 6)); for (let i = 1; i <= n; i++) dab(x0 + (x - x0) * i / n, y0 + (y - y0) * i / n); stroke.at = [x, y]; bodyView(); return; }
  const [x0, y0] = stroke.at, n = Math.max(1, Math.ceil(Math.hypot(x - x0, y - y0) / 6)); for (let i = 1; i <= n; i++) dab(x0 + (x - x0) * i / n, y0 + (y - y0) * i / n); stroke.at = [x, y];
  const now = performance.now(); if (now - paintT > 220) { paintT = now; build(); depthUI(); } else depthUI(); }
for (const b of document.querySelectorAll('[data-shape]')) b.onclick = () => { ST.shape = b.dataset.shape; document.querySelectorAll('[data-shape]').forEach(x => x.setAttribute('aria-pressed', x === b)); build(); depthUI(); };
for (const b of document.querySelectorAll('[data-budget]')) b.onclick = () => { ST.budget = +b.dataset.budget; document.querySelectorAll('[data-budget]').forEach(x => x.setAttribute('aria-pressed', x === b)); build(); };
for (const b of document.querySelectorAll('[data-abs]')) b.onclick = () => { ST.abs = b.dataset.abs; document.querySelectorAll('[data-abs]').forEach(x => x.setAttribute('aria-pressed', x === b)); for (const at of names) if (TEX[at]) { gl.bindTexture(gl.TEXTURE_2D, TEX[at]); const f = ST.abs === 'smooth' ? gl.LINEAR : gl.NEAREST; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f); } /* Smooth: soft shading across faces, the painting filtered, the outline straight-cut */ if (MINE.rig) rigMine(true); build(); };
for (const b of document.querySelectorAll('[data-look]')) b.onclick = () => { ST.look = b.dataset.look; document.querySelectorAll('[data-look]').forEach(x => x.setAttribute('aria-pressed', x === b)); build(); };
// ---------- Options sheet ----------
function openSheet() { info(); $('sheet').hidden = $('scrim').hidden = false; } function closeSheet() { $('sheet').hidden = $('scrim').hidden = true; }
$('more').onclick = openSheet; $('close').onclick = closeSheet; $('scrim').onclick = closeSheet;
for (const b of document.querySelectorAll('[data-detail]')) b.onclick = () => { ST.detail = +b.dataset.detail; document.querySelectorAll('[data-detail]').forEach(x => x.setAttribute('aria-pressed', x === b)); makeMine(); };
for (const b of document.querySelectorAll('[data-method]')) b.onclick = () => { ST.method = b.dataset.method; document.querySelectorAll('[data-method]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('tolRow').hidden = ST.method === 'photo'; makeMine(); }; // a photo has no backdrop to be tolerant of
let redo = 0; $('tol').oninput = () => { ST.tol = +$('tol').value; clearTimeout(redo); redo = setTimeout(makeMine, 120); }; $('one').onclick = () => { ST.one = !ST.one; $('one').setAttribute('aria-pressed', ST.one); makeMine(); };
$('cast').onclick = () => { ST.mode = 'cast'; setTool(null); cam.zoom = 0; cam.to = { yaw: 0.5, pitch: 0.42 }; build(); closeSheet(); };
{ const sel = $('spr'); for (const at of names) { const og = document.createElement('optgroup'); og.label = at; for (const k of Object.keys(SPRITE_POLYS.sprites)) if (k.startsWith(at + '/')) { const o = document.createElement('option'); o.value = k; o.textContent = k.split('/')[1]; og.appendChild(o); } sel.appendChild(og); }
  sel.value = ST.sprite; sel.onchange = () => { ST.sprite = sel.value; ST.mode = 'one'; setTool(null); cam.zoom = 0; build(); closeSheet(); }; }
// ---------- the rig of your picture (paperRig): its parts, laid out one under another in a texture of their own ----------
function backNow() { // the back, in the front's own pixels: a back view fitted to the front (gaps filled by the guess), the guess, or none (Mirror)
  if (MINE.backMode === 'mirror') return null; const head = MINE.rig && MINE.rig.humanoid ? MINE.rig.parts.find(q => q.name === 'head').mask : null, guess = paperGuessBack(MINE.px, MINE.w, MINE.h, head);
  if (MINE.backMode !== 'picture' || !MINE.backC) return guess;
  const fit = paperFitView(MINE.px, MINE.w, MINE.h, MINE.backC.px, MINE.backC.w, MINE.backC.h, { mirror: true }); let hit = 0, all = 0;
  for (let i = 0; i < MINE.w * MINE.h; i++) { if (MINE.px[i * 4 + 3] < 128) continue; all++; if (fit[i * 4 + 3]) hit++; else for (let c = 0; c < 4; c++) fit[i * 4 + c] = guess[i * 4 + c]; } MINE.backFit = all ? hit / all : 0; return fit; }
function sideNow() { // each side view fitted to the front's rows and turned to face right, its empty pixels filled from the nearest paint (side faces must never sample air)
  if (MINE.sideMode !== 'picture' || !MINE.sides.length) return null; const h = MINE.h, panels = [];
  for (const sd of MINE.sides) { const F = paperFitSide(MINE.px, MINE.w, MINE.h, sd.C.px, sd.C.w, sd.C.h, { facing: sd.facing }); if (!F) continue;
    const { px, ws } = F, rowOn = y => { for (let x = 0; x < ws; x++) if (px[(y * ws + x) * 4 + 3]) return true; return false; };
    for (let y = 0; y < h; y++) { if (!rowOn(y)) continue; let last = -1; for (let x = 0; x < ws; x++) { const o = (y * ws + x) * 4; if (px[o + 3]) last = o; else if (last >= 0) { px[o] = px[last]; px[o + 1] = px[last + 1]; px[o + 2] = px[last + 2]; px[o + 3] = 255; } }
      let first = -1; for (let x = 0; x < ws; x++) if (px[(y * ws + x) * 4 + 3]) { first = (y * ws + x) * 4; break; } for (let x = 0; x < ws; x++) { const o = (y * ws + x) * 4; if (px[o + 3]) break; px[o] = px[first]; px[o + 1] = px[first + 1]; px[o + 2] = px[first + 2]; px[o + 3] = 255; } }
    let near = -1; const rows = []; for (let y = 0; y < h; y++) rows.push(rowOn(y)); for (let y = 0; y < h; y++) { if (rows[y]) { near = y; continue; } let src = near; for (let yy = y + 1; yy < h && src < 0; yy++) if (rows[yy]) src = yy; if (src >= 0) px.copyWithin(y * ws * 4, src * ws * 4, (src + 1) * ws * 4); }
    F.east = F.facing === 'left'; panels.push(F); } // a view facing left shows the figure's east (+x) side; facing right, its west side
  if (!panels.length) return null; if (panels.length === 2 && panels[0].east === panels[1].east) panels[1].east = !panels[0].east; // two views: one for each side
  const W = panels.find(q => !q.east) || panels[0], E = panels.find(q => q.east) || panels[0];
  return { panels, W, E, ws: panels.reduce((n, q) => n + q.ws, 0), depth: y => { let f = 0, b = 0; for (const q of panels) { const [a, c] = q.depth(y); f += a; b += c; } return [f / panels.length, b / panels.length]; } }; }
function rigMine(keepRig, rerig) { const R = MINE.rig = keepRig && MINE.rig && !rerig ? MINE.rig : paperRig(MINE.px, MINE.w, [0, 0, MINE.w, MINE.h], { joints: MINE.joints, force: MINE.forceRig, body: MINE.body && MINE.body.length === MINE.w * MINE.h ? MINE.body : null }), P = R.parts.length, w = MINE.w, h = MINE.h, SD = MINE.sideFit = sideNow(), ws = SD ? SD.ws : 0, W2 = 2 * w + ws, px = new Uint8ClampedArray(W2 * h * 4 * P);
  if (!keepRig) MINE.backMode = MINE.backMode || (R.humanoid ? 'guess' : 'mirror'); const B = backNow(); MINE.backDU = 0; // texture: each part one row, front on the left half, back on the right
  R.parts.forEach((pt, k) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, o = ((k * h + y) * W2 + x) * 4, ob = o + w * 4, a = pt.mask[i] && MINE.px[i * 4 + 3] >= 128 ? 255 : 0;
    px[o] = MINE.px[i * 4]; px[o + 1] = MINE.px[i * 4 + 1]; px[o + 2] = MINE.px[i * 4 + 2]; px[o + 3] = a; const src = B || MINE.px; px[ob] = src[i * 4]; px[ob + 1] = src[i * 4 + 1]; px[ob + 2] = src[i * 4 + 2]; px[ob + 3] = a; }
    if (SD) { let x0 = 2 * w; for (const q of SD.panels) { q.x0 = x0; for (let y = 0; y < h; y++) px.set(q.px.subarray(y * q.ws * 4, (y + 1) * q.ws * 4), ((k * h + y) * W2 + x0) * 4); x0 += q.ws; } } }); // and the side views, the same in every row of parts
  let tex = px; if (ST.abs === 'polygon') { tex = new Uint8ClampedArray(px); for (let k = 0; k < P; k++) for (const x0 of [0, w]) { // Polygon: each part's paint spread outward over its half, so no face is cut by the alpha (the facets are the outline); the geometry still reads the real alpha
    const q = [], at = (x, y) => (((k * h + y) * W2) + x0 + x) * 4; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (tex[at(x, y) + 3]) q.push(x, y);
    for (let hd = 0; hd < q.length; hd += 2) { const x = q[hd], y = q[hd + 1], o = at(x, y); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const n = at(xx, yy); if (tex[n + 3]) continue; tex[n] = tex[o]; tex[n + 1] = tex[o + 1]; tex[n + 2] = tex[o + 2]; tex[n + 3] = 255; q.push(xx, yy); } } } }
  PH.S = null; PH.carry = null; // a new rig: its physics starts from rest
  MINE.skel = paperSkeleton(R, { joints: MINE.joints, confirmed: MINE.confirmed }); // the rig measured as a proportional skeleton (torso = 1): saved with the file and the model
  MINE.backDU = B ? w / W2 : 0; MINE.rigPx = px; MINE.rigTex = tex; MINE.rigW = W2; MINE.rigS = R.parts.map((pt, k) => paperTrace(px, W2, [0, k * h, w, h])); TEX.rig = texOf({ px: paintLive() ? depthView() : tex, w: W2, h: h * P }, ST.abs === 'smooth' ? 'smooth' : false, TEX.rig);
  document.querySelectorAll('[data-back]').forEach(x => x.setAttribute('aria-pressed', x.dataset.back === MINE.backMode)); $('tViews').disabled = false;
  document.querySelectorAll('[data-side]').forEach(x => x.setAttribute('aria-pressed', x.dataset.side === (SD ? 'picture' : 'round'))); $('flipSide').hidden = $('otherSide').hidden = !SD;
  $('viewsHint').textContent = SD ? (SD.panels.length > 1 ? 'Both side views in: each side painted from its own view, depth from both. ' : `Side view in (facing ${SD.panels[0].facing}): depth from its outline, its paint on both sides. Other side adds the opposite view. `) + (MINE.backMode === 'picture' && MINE.backC ? 'Back from your back view.' : MINE.backMode === 'guess' ? 'Back guessed.' : 'Back mirrored.') : MINE.backMode === 'mirror' ? 'The back shows the front, mirrored and darker.' : MINE.backMode === 'guess' ? 'The back is guessed from the front: hair over the head, clothes without the details.' : MINE.backC ? `Your back view, fitted to the front (${Math.round((MINE.backFit || 0) * 100)}% matched; the rest is guessed).` : 'Choose a back view: the same figure, from behind.';
  $('tPose').disabled = false; if (!ST.editJ) $('poseHint').textContent = R.humanoid ? 'Drag an arm, a leg or the head to pose it.' : 'No arms or legs found: Edit joints to place them.'; ST.pose = {}; }
// ---------- your picture: cut out (paperCutout), traced (paperTrace), folded (paperSprite), all on this device ----------
let toastT = 0; function toast(m, stay) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toastT); if (!stay) toastT = setTimeout(hideToast, 3400); } function hideToast() { $('toast').classList.remove('on'); }
let busy = 0, again = false;
function makeMine(first) { if (!MINE.img) return; if (busy) { again = true; return; } busy = 1; // the cut can take a second on a phone: say so, let the screen paint, then work
  toast('Finding the subject…', true); setTimeout(() => { try { cutNow(first); } finally { busy = 0; if (again) { again = false; makeMine(); } else hideToast(); window.CUT_DONE = (window.CUT_DONE || 0) + 1; } }, 30); }
function cutNow(first) { const t0 = performance.now();
  const C = paperCutout(MINE.img, { max: ST.detail, tol: ST.tol, one: ST.one, keep: MINE.marks.filter(m => m[2]).map(m => [m[0], m[1]]), drop: MINE.marks.filter(m => !m[2]).map(m => [m[0], m[1]]), method: ST.method });
  MINE.S = paperTrace(C.px, C.w, [0, 0, C.w, C.h]); if (MINE.S) { const P = MINE.S.pts; let x0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < P.length; i += 2) { x0 = Math.min(x0, P[i]); x1 = Math.max(x1, P[i]); y1 = Math.max(y1, P[i + 1]); } MINE.S.anchor = [(x0 + x1) / 2, y1]; } // it stands on its lowest painted pixel
  if (MINE.pend) { const r = MINE.pend; MINE.pend = null; if (r.depthMap) { const b = atob(r.depthMap); if (b.length === C.w * C.h) MINE.depthMap = Uint8Array.from(b, c => c.charCodeAt(0)); } if (r.depthFrom) ST.dsrc = r.depthFrom; if (r.layers) { ST.layersOn = true; MINE.layers = r.layers; } if (r.joints) MINE.joints = r.joints; if (r.confirmed) MINE.confirmed = r.confirmed; } // a saved Papercraft file: its depth
  if (MINE.depthMap && MINE.depthMap.length !== C.w * C.h) MINE.depthMap = null; MINE.w = C.w; MINE.px = C.px; MINE.h = C.h; MINE.area = 0; for (let i = 3; i < C.px.length; i += 4) if (C.px[i] >= 128) MINE.area++; rigMine(); MINE.ms = performance.now() - t0; MINE.method = C.method; TEX.mine = texOf(C, false, TEX.mine);
  { const v = new Uint8ClampedArray(C.full); for (let i = 0; i < C.w * C.h; i++) { if (!C.px[i * 4 + 3]) { const l = 0.299 * v[i * 4] + 0.587 * v[i * 4 + 1] + 0.114 * v[i * 4 + 2], k = ((i % C.w) + ((i / C.w) | 0)) % 6 < 3 ? 0.22 : 0.3; v[i * 4] = v[i * 4 + 1] = v[i * 4 + 2] = l * k + 18; } v[i * 4 + 3] = 255; } /* the Cut view: removed parts dark, grey and lightly striped */
    TEX.cutview = texOf({ px: v, w: C.w, h: C.h }, false, TEX.cutview); MINE.fullS = paperTrace(new Uint8ClampedArray(C.w * C.h * 4).fill(255), C.w, [0, 0, C.w, C.h]); }
  let air = 0; for (let i = 3; i < C.px.length; i += 4) if (!C.px[i]) air++;
  if (!MINE.S) { toast('Everything was removed. Tap Undo, or tap Keep on what you want.'); groups = []; tris = 0; return; }
  if (first && (!air || C.method === 'photo')) setTimeout(() => toast(C.method === 'photo' ? 'Not quite right? Tap Cut, then tap what to keep or remove.' : 'No background found. Tap Cut, then Remove, and tap it.'), 400);
  ST.mode = 'mine'; $('save').disabled = false; build(); depthUI(); }
$('file').onchange = e => { const f = e.target.files[0]; if (!f) return; const im = new Image(); MINE.name = (f.name || 'papercraft').replace(/\\.papercraft\\.json$|\\.[^.]+$/, '').replace(/[^\\w-]+/g, '-').slice(0, 40) || 'papercraft';
  if (/json/.test(f.type) || /\\.json$/i.test(f.name)) { f.text().then(t => { try { const r = JSON.parse(t); if (!r.picture) throw 0; MINE.pend = r; im.src = r.picture; if (r.shape) { ST.shape = r.shape; document.querySelectorAll('[data-shape]').forEach(x => x.setAttribute('aria-pressed', x.dataset.shape === ST.shape)); document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x.dataset.anim === ST.anim)); } if (r.depth != null) $('thick').value = r.depth; } catch (_) { toast('That is not a Papercraft file.'); } }); e.target.value = ''; }
  im.onload = () => { if (!MINE.pend) { MINE.depthMap = null; MINE.layers = null; MINE.prop = null; MINE.mods = null; propUI(); } MINE.img = im; MINE.marks = []; MINE.joints = null; MINE.confirmed = null; MINE.body = null; MINE.forceRig = false; MINE.backMode = null; MINE.backC = null; MINE.backImg = null; MINE.sideMode = null; MINE.sides = []; MINE.addSide = false; $('tCut').disabled = false; setTool(null); cam.zoom = 0; cam.to = { yaw: 0.5, pitch: 0.22 }; makeMine(true); refreshHello(); window.MINE_READY = (window.MINE_READY || 0) + 1; };
  im.onerror = () => toast('That file could not be opened as a picture.'); if (!im.src) im.src = URL.createObjectURL(f); e.target.value = ''; };
cv.addEventListener('webglcontextlost', e => { e.preventDefault(); toast('The phone paused the 3D view. It comes back by itself; if not, tap Papercraft.', true); }); // e.g. low memory, or the app went to the background
cv.addEventListener('webglcontextrestored', () => { initGL(); for (const k in TEX) if (TEX[k] && TEX[k]._src) TEX[k] = texOf(TEX[k]._src, TEX[k]._rep); gbuf = gl.createBuffer(); wire = null; groups = []; build(); if (MINE.rig) depthUI(); hideToast(); window.GL_RESTORED = (window.GL_RESTORED || 0) + 1; });
function goHome() { // the wordmark: back to the start, whatever state things are in (a stuck tool, a lost 3D view)
  if (gl.isContextLost()) { location.reload(); return; } frame.err = 0; if (ST.editJ) $('editJ').click(); setTool(null); closeSheet(); $('saveSheet').hidden = true; stroke = null; grab = null; jdrag = null;
  Object.assign(MINE, { img: null, px: null, S: null, fullS: null, rig: null, geo: null, marks: [], joints: null, confirmed: null, skel: null, prop: null, mods: null, forceRig: false, backMode: null, backC: null, backImg: null, sideMode: null, sides: [], addSide: false, depthMap: null, layers: null, pend: null });
  ST.mode = 'start'; ST.pose = {}; ST.anim = 'idle'; ST.rag = false; $('ragBtn').setAttribute('aria-pressed', false); PH.S = null; PH.A = null; PH.carry = null; PH.root = { x: 0, z: 0 }; ST.dsrc = 'shape'; ST.layersOn = false; document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x.dataset.anim === 'idle'));
  for (const id of ['tCut', 'tViews', 'tPose', 'save']) $(id).disabled = true; cam.zoom = 0; cam.to = { yaw: 0.5, pitch: 0.22 }; hideToast(); build(); depthUI(); refreshHello(); window.HOME = (window.HOME || 0) + 1; }
$('home').onclick = goHome;
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
  if (ST.mode === 'mine' && MINE.S && MINE.geo) return { parts: MINE.geo.map(g => ({ name: g.name, parent: g.parent, pv: g.pv, V: g.V })), hh: MINE.fold.hh, px: MINE.rigTex || MINE.rigPx, w: MINE.rigW, h: MINE.h * MINE.rig.parts.length, name: MINE.name || 'papercraft', rig: true };
  if (ST.mode === 'one' || ST.mode === 'start') { const key = ST.sprite, S = SPRITE_POLYS.sprites[key], at = key.split('/')[0], A = SPRITE_POLYS.atlases[at].size, hh = 24 * S.rect[3] / 85, s = hh / S.rect[3], th = depth(), V = [];
    if (ST.shape === 'facets') paperFacet(V, ATLAS_PX[at], A[0], A[1], S.rect, { s, depth: th * hh * 0.05, anchor: S.anchor, budget: ST.budget }); else if (ST.shape === 'round') paperPuff(V, ATLAS_PX[at], A[0], A[1], S.rect, { s, depth: th * hh * 0.05, anchor: S.anchor }); else paperSprite(V, S, A, { s, thick: th * hh / 24, anchor: S.anchor });
    return { parts: [{ name: key.split('/')[1], parent: -1, pv: [0, 0, 0], V }], hh, px: ATLAS_PX[at], w: A[0], h: A[1], name: key.split('/')[1], rig: false }; }
  return null; }
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const G3 = (p, k) => [p[0] * k, p[2] * k, p[1] * k]; // world (x east, y south, z up) -> glTF (x, y up, z toward the viewer), metres; also turns left- into right-handed
async function modelZip(m) { // glTF 2.0 binary: a node per part at its pivot (a rig), its mesh around that pivot, Idle / Walk / Run / Wave / Jump / Swing / Draw as animations; plus an .obj of the rest pose
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
  if (m.rig) for (const an of ['idle', 'walk', 'run', 'wave', 'jump', 'swing', 'draw']) { const L = LOOP[an], F = Math.round(L * 24), times = new Float32Array(F + 1); for (let f = 0; f <= F; f++) times[f] = f / 24 * L / (F / 24);
    const tIn = accessor(times, 'SCALAR', { anim: true, mm: { min: [0], max: [times[F]] } }), channels = [], samplers = [];
    m.parts.forEach((pt, i) => { const rot = new Float32Array((F + 1) * 4), tr = pt.parent < 0 ? new Float32Array((F + 1) * 3) : null, n0 = nodes[1 + i].translation;
      for (let f = 0; f <= F; f++) { const { A, bob } = poseNow(times[f], an), a = A[pt.name] || { th: 0, ph: 0 }, qz = [0, 0, Math.sin(a.th / 2), Math.cos(a.th / 2)], qx = [Math.sin(-a.ph / 2), 0, 0, Math.cos(-a.ph / 2)], q = qmul(qx, qz);
        rot.set(q, f * 4); if (tr) tr.set([n0[0], n0[1] + bob * k, n0[2]], f * 3); }
      samplers.push({ input: tIn, output: accessor(rot, 'VEC4', { anim: true }), interpolation: 'LINEAR' }); channels.push({ sampler: samplers.length - 1, target: { node: 1 + i, path: 'rotation' } });
      if (tr) { samplers.push({ input: tIn, output: accessor(tr, 'VEC3', { anim: true }), interpolation: 'LINEAR' }); channels.push({ sampler: samplers.length - 1, target: { node: 1 + i, path: 'translation' } }); } });
    animations.push({ name: an[0].toUpperCase() + an.slice(1), channels, samplers }); }
  const imgView = view(png);
  const gltf = { asset: { version: '2.0', generator: 'Papercraft (Saga of Koto)' }, extensionsUsed: ['KHR_materials_unlit'], scene: 0, scenes: [{ nodes: [0], ...(MINE.skel && m.rig ? { extras: { papercraftSkeleton: MINE.skel } } : {}) }], nodes, meshes, ...(animations.length ? { animations } : {}),
    materials: [{ name: 'paper', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 }, alphaMode: 'MASK', alphaCutoff: 0.5, doubleSided: true, extensions: { KHR_materials_unlit: {} } }],
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
  const blob = data instanceof Blob ? data : new Blob([data]), installed = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone; // the home-screen app: the share sheet (Save to Files, AirDrop, Messages)
  if (installed && navigator.canShare) { const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' }); if (navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: filename }); } catch (e) { if (e && e.name !== 'AbortError') toast('That could not be shared.'); } return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('Saved ' + filename + '.'); }
function openSave() { const m = meshNow(); $('saveInfo').textContent = m ? `${m.name}: ${m.parts.reduce((n, q) => n + q.V.length / 21, 0)} triangles, ${ST.shape === 'facets' ? 'facets (' + ({ 40: 'PS1 Low', 100: 'PS1', 300: 'PS2 Low', 800: 'PS2' }[ST.budget] || ST.budget) + ')' : ST.shape}${m.rig ? ', rigged: ' + m.parts.length + ' parts, Idle / Walk / Run / Wave / Jump / Swing / Draw' : ''}.` : '';
  document.querySelector('[data-save=png]').disabled = document.querySelector('[data-save=json]').disabled = !(ST.mode === 'mine' && MINE.S); document.querySelector('[data-save=model]').disabled = !m;
  closeSheet(); setTool(null); $('saveSheet').hidden = $('scrim').hidden = false; }
function closeSave() { $('saveSheet').hidden = true; if ($('sheet').hidden) $('scrim').hidden = true; }
$('save').onclick = openSave; $('saveClose').onclick = closeSave; $('scrim').addEventListener('click', closeSave);
for (const b of document.querySelectorAll('[data-save]')) b.onclick = async () => { const kind = b.dataset.save; closeSave(); toast('Preparing…', true);
  try { if (kind === 'model') { const m = meshNow(); await offer(m.name + '-papercraft.zip', await modelZip(m)); }
    else if (kind === 'png') { const p = await cutoutPng(); if (p) await offer((MINE.name || 'cutout') + '.png', p); else toast('Nothing to save: everything was removed.'); }
    else { const png = await pngOf(MINE.px, MINE.w, MINE.h); let bin = ''; for (let i = 0; i < png.length; i += 32768) bin += String.fromCharCode.apply(null, png.subarray(i, i + 32768));
      const S = MINE.S, rec = { papercraft: 1, name: MINE.name || 'papercraft', prime: PAPER.PRIME, picture: 'data:image/png;base64,' + btoa(bin), size: [MINE.w, MINE.h], sprite: { rect: S.rect, anchor: S.anchor, pts: S.pts, rings: S.rings, tris: S.tris, ein: S.ein }, shape: ST.shape, depth: depth(), depthFrom: ST.dsrc.startsWith('p:') ? 'paint' : ST.dsrc, depthMap: MINE.depthMap ? btoa(Array.from(MINE.depthMap, c => String.fromCharCode(c)).join('')) : null, layers: ST.layersOn ? Object.assign({}, MINE.layers) : null, joints: MINE.joints || null, confirmed: MINE.confirmed || null, skeleton: MINE.skel || null };
      await offer(rec.name + '.papercraft.json', JSON.stringify(rec)); } }
  catch (e) { toast('Could not save: ' + (e && e.message || e)); } };
// ---------- start ----------
if (Q.get('t')) $('thick').value = Q.get('t'); $('wire').checked = Q.get('wire') === '1'; $('spin').checked = Q.get('spin') !== '0';
providerButtons(); depthUI(); document.querySelectorAll('[data-look]').forEach(x => x.setAttribute('aria-pressed', x.dataset.look === ST.look)); document.querySelectorAll('[data-shape]').forEach(x => x.setAttribute('aria-pressed', x.dataset.shape === ST.shape)); document.querySelectorAll('[data-anim]').forEach(x => x.setAttribute('aria-pressed', x.dataset.anim === ST.anim)); document.querySelectorAll('[data-budget]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.budget === ST.budget)); document.querySelectorAll('[data-abs]').forEach(x => x.setAttribute('aria-pressed', x.dataset.abs === ST.abs)); $('geoSeg').hidden = ST.shape !== 'facets';
const retheme = () => { if (loaded === names.length) build(); }; matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme); new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
$('save').disabled = false;
for (const at of names) { const im = new Image(); im.onload = () => { TEX[at] = texOf(im); { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); ATLAS_PX[at] = g.getImageData(0, 0, im.width, im.height).data; } /* pixels, for Round */ if (++loaded === names.length) { build(); refreshHello(); requestAnimationFrame(frame); window.READY = true; } }; im.src = $('atlas-' + at).textContent.trim(); }
</script></body></html>'''
if '--artifact' in sys.argv:  # the same page without its own document wrapper (the artifact host adds one)
    body = re.sub(r'^<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport"[^>]*>', '', html).replace('</style></head><body>', '</style>', 1).replace('</body></html>', '')
    dst = sys.argv[sys.argv.index('--artifact') + 1]; open(dst, 'w', encoding='utf-8').write(body); print('wrote', dst)
# ---------- the home-screen app (a PWA): the same page with a manifest, an icon and an offline copy; served from papercraft/ (GitHub Pages) ----------
import hashlib, shutil
PWA_HEAD = ('<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/papercraft-180.png"><link rel="icon" href="icons/papercraft-192.png">'
            '<meta name="theme-color" content="#ececf1" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#1b1b1f" media="(prefers-color-scheme: dark)">'
            '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Papercraft"><meta name="apple-mobile-web-app-status-bar-style" content="default">')
PWA_SW = "<script>if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>"
app = re.sub(r'(<meta name="viewport"[^>]*>)', lambda m: m.group(1) + PWA_HEAD, html, count=1).replace('</body></html>', PWA_SW + '</body></html>')
out = os.path.join(ROOT, 'papercraft/sprite-viewer.html'); open(out, 'w', encoding='utf-8', newline='').write(app); print('wrote', out, round(len(app) / 1024), 'KB')
PC = os.path.join(ROOT, 'papercraft'); os.makedirs(os.path.join(PC, 'icons'), exist_ok=True)
ICONS = ['papercraft-180.png', 'papercraft-192.png', 'papercraft-512.png', 'papercraft-maskable-512.png']
for f in ICONS: shutil.copy(os.path.join(ROOT, 'assets/icons', f), os.path.join(PC, 'icons', f))
open(os.path.join(PC, 'manifest.webmanifest'), 'w').write(json.dumps({
    'name': 'Papercraft', 'short_name': 'Papercraft', 'description': 'Turn any picture into a paper model: cut out, folded into low-poly 3D, rigged and posed, all on your phone.',
    'id': './', 'start_url': 'sprite-viewer.html', 'scope': './', 'display': 'standalone', 'orientation': 'portrait', 'background_color': '#ececf1', 'theme_color': '#ececf1',
    'icons': [{'src': 'icons/papercraft-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icons/papercraft-512.png', 'sizes': '512x512', 'type': 'image/png'},
              {'src': 'icons/papercraft-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}, indent=2) + '\n')
ver = hashlib.sha1(app.encode()).hexdigest()[:10]
SW = """/* Papercraft service worker (made by tools/make_sprite_viewer.py): the app page is fetched fresh whenever you are online, so every new build
   shows up, and the last good copy is kept so the app opens with no connection. Everything Papercraft does happens on the phone: nothing is sent anywhere. */
const VERSION = 'papercraft-@VER@';
const CORE = ['sprite-viewer.html', 'manifest.webmanifest', @ICONS@];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('papercraft-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') { // the app page: network first, the saved copy when offline
    e.respondWith(fetch(req, { cache: 'no-store' }).then(r => { if (r.ok && /sprite-viewer\\.html$/.test(new URL(req.url).pathname)) { const copy = r.clone(); caches.open(VERSION).then(c => c.put('sprite-viewer.html', copy)); } return r; })
      .catch(() => caches.match('sprite-viewer.html')));
    return; }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
"""
open(os.path.join(PC, 'sw.js'), 'w').write(SW.replace('@VER@', ver).replace('@ICONS@', ', '.join("'icons/" + f + "'" for f in ICONS)))
open(os.path.join(PC, 'index.html'), 'w').write('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Papercraft</title>'
    '<meta http-equiv="refresh" content="0; url=sprite-viewer.html"><link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="icons/papercraft-180.png"></head>'
    '<body style="font:15px -apple-system,system-ui,sans-serif;background:#ececf1;color:#1d1d1f;text-align:center;padding:40px">Opening <a href="sprite-viewer.html">Papercraft</a>...</body></html>\n')
print('wrote the app: papercraft/{index.html, manifest.webmanifest, sw.js, icons/} (version', ver + ')')
