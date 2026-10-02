// Unified input: keyboard + mouse (pointer lock), Gamepad API (standard mapping),
// and touch (floating left joystick, right-side drag look, on-screen buttons).
//
// ctx.input = {
//   move: Vector2        x = right, y = forward, |move| <= 1 (camera-relative intent)
//   cameraDelta: Vector2 this frame's look delta in radians:
//                          x > 0 = look right, y > 0 = look up
//   zoom: number         this frame's zoom delta (+ = zoom out), mouse wheel / d-pad
//   down(name), pressed(name)   names: attack jump roll lock guard sprint interact pause
//   released(name)       edge-triggered release
//   source: 'kbm' | 'pad' | 'touch'   last used device (for HUD button prompts)
//   isTouch: boolean
//   enabled: boolean     set false to ignore all input (menus, cutscenes)
//   vibrate(strength, ms)  gamepad rumble if supported
// }
// pressed/released are latched from events so taps shorter than a frame are never
// lost; they're cleared at the START of the next input update (input runs first).
import * as THREE from 'three';

const ACTIONS = ['attack', 'jump', 'roll', 'lock', 'guard', 'sprint', 'interact', 'pause'];
const KEYMAP = {
  Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint',
  ControlLeft: 'roll', ControlRight: 'roll', AltLeft: 'roll', AltRight: 'roll', KeyC: 'roll',
  KeyQ: 'lock', KeyE: 'interact', KeyF: 'attack', KeyR: 'guard',
  Escape: 'pause', KeyP: 'pause', Tab: 'lock',
};
const MOVEKEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};
// Standard gamepad mapping (Xbox labels): A jump, B roll, X attack, Y interact,
// LB guard, RB attack, LT lock-on (Z-target), RT sprint, L3 sprint, R3 lock, Start pause.
const PADMAP = { 0: 'jump', 1: 'roll', 2: 'attack', 3: 'interact', 4: 'guard', 5: 'attack', 6: 'lock', 7: 'sprint', 10: 'sprint', 11: 'lock', 9: 'pause' };
const MOUSE_SENS = 0.0024;
const PAD_LOOK = { yaw: 3.4, pitch: 2.1 };
const TOUCH_LOOK = 0.0062;

export function init(ctx) {
  const move = new THREE.Vector2(), cameraDelta = new THREE.Vector2();
  // per-source "held" sets, merged each frame
  const keysHeld = new Set();          // KeyboardEvent.code
  const kbmDown = new Set(), touchDown = new Set();
  let padDown = new Set();
  let downNow = new Set(), downPrev = new Set();
  let latchPress = new Set(), latchRelease = new Set();
  let pressedFrame = new Set(), releasedFrame = new Set();
  let mouseDX = 0, mouseDY = 0, wheel = 0, touchLookX = 0, touchLookY = 0;
  const touchMove = new THREE.Vector2();
  const canvas = ctx.renderer?.domElement;
  const isTouch = ctx.params?.get('touch') === '1' ||
    (typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia?.('(pointer: coarse)').matches);

  const api = {
    move, cameraDelta, zoom: 0, source: isTouch ? 'touch' : 'kbm', isTouch, enabled: true,
    down: n => downNow.has(n),
    pressed: n => pressedFrame.has(n),
    released: n => releasedFrame.has(n),
    vibrate(strength = 0.5, ms = 120) {
      for (const p of navigator.getGamepads?.() || []) {
        p?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch?.(() => {});
      }
    },
    ACTIONS,
  };
  ctx.input = api;
  const press = (set, name) => { if (!set.has(name)) { set.add(name); latchPress.add(name); } };
  const release = (set, name) => { if (set.has(name)) { set.delete(name); latchRelease.add(name); } };
  const frozen = () => !!ctx.shot || !api.enabled;

  // ---------------- keyboard ----------------
  const recomputeKeyActions = () => {
    const want = new Set();
    for (const c of keysHeld) if (KEYMAP[c]) want.add(KEYMAP[c]);
    for (const b of mouseButtons) want.add(b);
    for (const n of ACTIONS) { if (want.has(n)) press(kbmDown, n); else release(kbmDown, n); }
  };
  addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
    if (KEYMAP[e.code] || MOVEKEYS[e.code]) e.preventDefault();
    if (e.repeat) return;
    keysHeld.add(e.code); api.source = 'kbm'; recomputeKeyActions();
  });
  addEventListener('keyup', e => { keysHeld.delete(e.code); recomputeKeyActions(); });
  // Esc while pointer-locked is swallowed by the browser; treat lock loss as pause intent only if it wasn't us
  const clearAll = () => { keysHeld.clear(); mouseButtons.clear(); recomputeKeyActions(); for (const n of [...touchDown]) release(touchDown, n); touchMove.set(0, 0); };
  addEventListener('blur', clearAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearAll(); });

  // ---------------- mouse ----------------
  const mouseButtons = new Set();
  const MB = { 0: 'attack', 1: 'lock', 2: 'guard' };
  const locked = () => document.pointerLockElement === canvas;
  if (canvas) {
    canvas.addEventListener('mousedown', e => {
      if (api.source === 'touch' && e.sourceCapabilities?.firesTouchEvents) return;
      api.source = 'kbm';
      if (!locked() && !isTouch) {
        try { const r = canvas.requestPointerLock?.({ unadjustedMovement: true }); r?.catch?.(() => canvas.requestPointerLock?.()); } catch { /* not available */ }
        if (e.button === 0) return; // first click only captures the mouse
      }
      if (MB[e.button]) { mouseButtons.add(MB[e.button]); recomputeKeyActions(); }
      if (e.button === 1) e.preventDefault();
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { wheel += Math.sign(e.deltaY) * 0.6; e.preventDefault(); }, { passive: false });
  }
  addEventListener('mouseup', e => { if (MB[e.button]) { mouseButtons.delete(MB[e.button]); recomputeKeyActions(); } });
  addEventListener('mousemove', e => {
    if (!locked()) return;
    // ignore spurious giant deltas some browsers emit on lock
    if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
    mouseDX += e.movementX; mouseDY += e.movementY;
  });
  let hadLock = false;
  document.addEventListener('pointerlockchange', () => {
    if (!locked()) {
      mouseButtons.clear(); recomputeKeyActions();
      // Esc while pointer-locked never reaches keydown: treat the unlock as a pause request
      if (hadLock && document.hasFocus() && !frozen()) latchPress.add('pause');
    }
    hadLock = locked();
  });

  // ---------------- touch ----------------
  let touchUI = null;
  if (isTouch) touchUI = buildTouchUI();
  addEventListener('touchstart', () => { api.source = 'touch'; if (!touchUI) touchUI = buildTouchUI(); touchUI.root.style.display = ''; }, { passive: true, once: true });

  function buildTouchUI() {
    const ui = document.getElementById('ui') || document.body;
    const css = document.createElement('style');
    css.textContent = `
.tc-root{position:fixed;inset:0;pointer-events:none;z-index:20;font-family:"Cinzel","Palatino Linotype","Book Antiqua",Georgia,serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.tc-zone{position:absolute;pointer-events:auto;touch-action:none}
.tc-left{left:0;top:0;bottom:0;width:45%}
.tc-right{right:0;top:0;bottom:0;width:55%}
.tc-stick{position:absolute;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;
  background:radial-gradient(circle at 50% 50%,rgba(255,248,230,.05) 0 55%,rgba(255,248,230,.12) 70%,rgba(255,248,230,.02) 71%);
  border:1.5px solid rgba(255,236,196,.38);box-shadow:0 0 24px rgba(0,0,0,.25),inset 0 0 18px rgba(255,240,210,.08);
  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);transition:opacity .35s ease;opacity:.55;pointer-events:none}
.tc-stick.on{opacity:1;transition:opacity .08s}
.tc-stick::after{content:"";position:absolute;inset:14px;border-radius:50%;border:1px dashed rgba(255,236,196,.18)}
.tc-knob{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;
  background:radial-gradient(circle at 38% 32%,rgba(255,252,240,.55),rgba(236,214,170,.28) 55%,rgba(120,96,60,.25));
  border:1.5px solid rgba(255,244,220,.65);box-shadow:0 4px 14px rgba(0,0,0,.35)}
.tc-btns{position:absolute;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));width:230px;height:230px;pointer-events:none}
.tc-btn{position:absolute;border-radius:50%;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;flex-direction:column;
  color:rgba(255,246,226,.92);text-shadow:0 1px 3px rgba(0,0,0,.6);letter-spacing:.06em;
  background:radial-gradient(circle at 40% 30%,rgba(255,250,236,.22),rgba(40,32,22,.28) 70%);
  border:1.5px solid rgba(255,232,186,.5);box-shadow:0 6px 18px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.25);
  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);transition:transform .08s ease,background .12s}
.tc-btn b{font-size:22px;font-weight:600;line-height:1}
.tc-btn small{font-size:9px;opacity:.75;margin-top:3px;text-transform:uppercase;font-family:system-ui,sans-serif;letter-spacing:.12em}
.tc-btn.on{transform:scale(.9);background:radial-gradient(circle at 40% 30%,rgba(255,236,190,.55),rgba(120,90,40,.4) 70%)}
.tc-btn.a{width:92px;height:92px;right:8px;bottom:8px;border-color:rgba(255,214,140,.75)}
.tc-btn.a b{font-size:30px}
.tc-btn.b{width:66px;height:66px;right:118px;bottom:14px}
.tc-btn.j{width:66px;height:66px;right:22px;bottom:116px}
.tc-btn.z{width:58px;height:58px;right:120px;bottom:104px}
.tc-btn.z.active{border-color:rgba(255,200,90,.95);box-shadow:0 0 18px rgba(255,190,80,.55),inset 0 1px 0 rgba(255,255,255,.25)}
@media (max-height:420px){.tc-btns{transform:scale(.82);transform-origin:100% 100%}}
`;
    document.head.appendChild(css);
    const root = document.createElement('div'); root.className = 'tc-root';
    const left = document.createElement('div'); left.className = 'tc-zone tc-left';
    const right = document.createElement('div'); right.className = 'tc-zone tc-right';
    const stick = document.createElement('div'); stick.className = 'tc-stick';
    const knob = document.createElement('div'); knob.className = 'tc-knob'; stick.appendChild(knob);
    const btns = document.createElement('div'); btns.className = 'tc-btns';
    root.append(left, right, stick, btns); ui.appendChild(root);
    const restStick = () => {
      stick.style.left = `max(${96}px, calc(env(safe-area-inset-left) + 96px))`;
      stick.style.top = `calc(100% - ${110}px - env(safe-area-inset-bottom))`;
      knob.style.transform = ''; stick.classList.remove('on');
    };
    restStick();
    const RADIUS = 56;
    let stickId = null, sx = 0, sy = 0;
    left.addEventListener('pointerdown', e => {
      if (stickId !== null) return; stickId = e.pointerId; left.setPointerCapture?.(e.pointerId);
      sx = e.clientX; sy = e.clientY; stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on');
      api.source = 'touch'; e.preventDefault();
    });
    left.addEventListener('pointermove', e => {
      if (e.pointerId !== stickId) return;
      let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy);
      if (d > RADIUS) { // drag the base along so the stick never "runs out"
        const k = (d - RADIUS) / d; sx += dx * k; sy += dy * k; dx = e.clientX - sx; dy = e.clientY - sy;
        stick.style.left = sx + 'px'; stick.style.top = sy + 'px';
      }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      touchMove.set(dx / RADIUS, -dy / RADIUS);
      // sprint when pushed hard to the edge for a moment is handled by magnitude (hero decides)
    });
    const endStick = e => { if (e.pointerId !== stickId) return; stickId = null; touchMove.set(0, 0); restStick(); };
    left.addEventListener('pointerup', endStick); left.addEventListener('pointercancel', endStick);

    const look = new Map();
    right.addEventListener('pointerdown', e => { look.set(e.pointerId, [e.clientX, e.clientY]); right.setPointerCapture?.(e.pointerId); api.source = 'touch'; e.preventDefault(); });
    right.addEventListener('pointermove', e => {
      const p = look.get(e.pointerId); if (!p) return;
      touchLookX += e.clientX - p[0]; touchLookY += e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
    });
    const endLook = e => look.delete(e.pointerId);
    right.addEventListener('pointerup', endLook); right.addEventListener('pointercancel', endLook);

    const mk = (cls, glyph, label, action) => {
      const b = document.createElement('div'); b.className = 'tc-btn ' + cls;
      b.innerHTML = `<b>${glyph}</b><small>${label}</small>`;
      const ids = new Set();
      b.addEventListener('pointerdown', e => { ids.add(e.pointerId); b.setPointerCapture?.(e.pointerId); b.classList.add('on'); press(touchDown, action); api.source = 'touch'; e.preventDefault(); e.stopPropagation(); });
      const up = e => { ids.delete(e.pointerId); if (!ids.size) { b.classList.remove('on'); release(touchDown, action); } };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      btns.appendChild(b); return b;
    };
    mk('a', 'A', 'attack', 'attack');
    mk('b', 'B', 'roll', 'roll');
    mk('j', '⤒', 'jump', 'jump');
    const zb = mk('z', '◎', 'lock', 'lock');
    root.addEventListener('contextmenu', e => e.preventDefault());
    return { root, setLockActive: on => zb.classList.toggle('active', !!on) };
  }

  // ---------------- gamepad ----------------
  const radial = (x, y, dz = 0.18) => {
    const m = Math.hypot(x, y); if (m < dz) return [0, 0];
    const k = Math.min(1, (m - dz) / (1 - dz)) / m; return [x * k, y * k];
  };
  function pollPad(dt) {
    const pads = navigator.getGamepads?.(); const next = new Set();
    let mx = 0, my = 0, lx = 0, ly = 0, z = 0, active = false;
    if (pads) for (const p of pads) {
      if (!p || !p.connected) continue;
      const [ax, ay] = radial(p.axes[0] || 0, p.axes[1] || 0);
      const [bx, by] = radial(p.axes[2] || 0, p.axes[3] || 0, 0.15);
      if (ax || ay) { mx = ax; my = -ay; active = true; }
      if (bx || by) {
        // response curve: precise near centre, fast at the edge
        const m = Math.hypot(bx, by), c = m * m * 0.7 + m * 0.3;
        lx = bx / m * c; ly = by / m * c; active = true;
      }
      p.buttons.forEach((b, i) => {
        const v = typeof b === 'object' ? (b.pressed || b.value > 0.4) : b > 0.4;
        if (!v) return; active = true;
        if (PADMAP[i]) next.add(PADMAP[i]);
        if (i === 12) z -= 1; if (i === 13) z += 1; // d-pad up/down zoom
      });
    }
    for (const n of ACTIONS) { if (next.has(n) && !padDown.has(n)) latchPress.add(n); if (!next.has(n) && padDown.has(n)) latchRelease.add(n); }
    padDown = next;
    if (active) api.source = 'pad';
    return { mx, my, lx: lx * PAD_LOOK.yaw * dt, ly: -ly * PAD_LOOK.pitch * dt, z: z * dt * 6 };
  }

  return {
    update(dt) {
      // edges latched since last frame become this frame's pressed/released
      pressedFrame = latchPress; latchPress = new Set();
      releasedFrame = latchRelease; latchRelease = new Set();
      const pad = pollPad(dt);
      downPrev = downNow; downNow = new Set([...kbmDown, ...touchDown, ...padDown]);
      // keyboard move
      let kx = 0, ky = 0;
      for (const c of keysHeld) { const m = MOVEKEYS[c]; if (m) { kx += m[0]; ky += m[1]; } }
      move.set(kx, ky);
      if (move.lengthSq() > 1) move.normalize();
      if (touchMove.lengthSq() > 0.0001) { move.copy(touchMove); if (move.length() > 1) move.normalize(); }
      if (pad.mx || pad.my) move.set(pad.mx, pad.my);
      // look: mouse + stick + touch
      cameraDelta.set(
        mouseDX * MOUSE_SENS + pad.lx + touchLookX * TOUCH_LOOK,
        -mouseDY * MOUSE_SENS + pad.ly - touchLookY * TOUCH_LOOK * 0.8,
      );
      api.zoom = wheel + pad.z;
      mouseDX = mouseDY = touchLookX = touchLookY = wheel = 0;
      if (frozen()) {
        move.set(0, 0); cameraDelta.set(0, 0); api.zoom = 0;
        pressedFrame.clear(); releasedFrame.clear(); downNow.clear();
        if (touchUI && ctx.shot) touchUI.root.style.display = 'none';
      }
      if (touchUI) touchUI.setLockActive(!!(ctx.cameraRig?.lockTarget || ctx.hero?.lockTarget));
    },
  };
}
