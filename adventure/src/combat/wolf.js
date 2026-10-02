// Bramble wolf: skinned procedural quadruped with shell fur, bramble thorns,
// glowing eyes, procedural gaits (walk/trot/gallop), pack AI.
import * as THREE from 'three';
import { Rig, srgb, mtx, thornGeo } from './rig.js';
import { creatureMaterials } from './materials.js';
import { noise2 } from '../world/layout.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const herm = s => s * s * (3 - 2 * s);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// ---------------------------------------------------------------- model
const PAL = [
  { back: 0x26221f, side: 0x5f554b, belly: 0xc4b59a, rust: 0x7d5434, dark: 0x1a1716 },  // slate
  { back: 0x2b2420, side: 0x6e5b48, belly: 0xc9b493, rust: 0x8d5a30, dark: 0x1c1714 },  // umber
  { back: 0x1f1f22, side: 0x4c4b4e, belly: 0xa9a49a, rust: 0x5e4c3e, dark: 0x141416 },  // ash
];

function buildWolfModel(variant = 0) {
  const P = PAL[variant % PAL.length];
  const cBack = srgb(P.back), cSide = srgb(P.side), cBelly = srgb(P.belly), cRust = srgb(P.rust), cDark = srgb(P.dark);
  const cMouth = srgb(0x3a1214), cNose = srgb(0x0d0b0b), cIvory = srgb(0xe6dac0), cThorn = srgb(0x3a2018), cThornTip = srgb(0x7a5a3a), cVine = srgb(0x2a1a12);
  const T = new THREE.Color();
  const furColor = (p, n) => {
    const nv = noise2(p.x * 9 + variant * 13, p.z * 9 + p.y * 7) * 0.5 + 0.5;
    const dors = ss(-0.15, 0.85, n.y);
    T.copy(cSide).lerp(cBack, dors * (0.65 + 0.35 * nv));
    // saddle: darkest over withers->loin
    if (p.z > -0.55 && p.z < 0.45) T.lerp(cDark, ss(0.55, 0.95, n.y) * 0.6);
    // pale underside / throat / inner legs
    const under = ss(-0.15, -0.75, n.y) * ss(0.45, 0.62, p.y + 0.0);
    T.lerp(cBelly, under * 0.9);
    if (p.z > 0.32 && p.z < 0.78 && p.y < 1.0 && n.z > -0.2) T.lerp(cBelly, ss(0.05, -0.6, n.y) * 0.85 + ss(0.2, 0.8, n.z) * ss(1.0, 0.86, p.y) * 0.6);
    // legs: rusty, paler toward paws on the front
    if (p.y < 0.6) { const k = ss(0.6, 0.3, p.y); T.lerp(cRust, k * 0.65); if (n.z > 0.2) T.lerp(cBelly, ss(0.3, 0.08, p.y) * 0.5); }
    // face mask: cream cheeks, dark brow & muzzle bridge
    if (p.z > 0.6) {
      T.lerp(cBelly, ss(0.2, -0.4, n.y) * 0.7 * ss(0.62, 0.75, p.z));
      if (n.y > 0.5 && p.z > 0.72) T.lerp(cDark, 0.55);
      if (p.z > 0.88) T.lerp(cNose, 0.8);
    }
    // tail: darker tip
    if (p.z < -0.95) T.lerp(cDark, ss(-0.95, -1.12, p.z));
    T.multiplyScalar(0.85 + nv * 0.3);
    return T.clone();
  };
  const furLen = (p, n) => {
    let f = 0.032;
    if (p.z > 0.15 && p.z < 0.58 && p.y > 0.7) f = lerp(0.032, 0.075, ss(0.15, 0.4, p.z) * ss(0.62, 0.5, p.z)); // neck ruff / mane
    if (p.z > 0.25 && p.z < 0.6 && n.y < 0 && p.y > 0.6) f = Math.max(f, 0.06); // chest ruff
    if (p.y < 0.55 && p.z > -0.62) f = lerp(0.012, f, ss(0.25, 0.55, p.y)); // legs short
    if (p.z > 0.58 && p.z < 0.68 && Math.abs(n.x) > 0.5) f = Math.max(f, 0.05); // cheek ruff
    if (p.z > 0.64) f = lerp(f, 0.008, ss(0.64, 0.72, p.z)); // face short
    if (p.z > 0.83) f = 0.0;
    if (p.z < -0.6 && p.y > 0.3) f = 0.085; // tail brush
    return f;
  };

  const R = new Rig();
  R.bone('root', null, 0, 0, 0);
  R.bone('spine', 'root', 0, 0.81, -0.12);
  R.bone('hips', 'spine', 0, 0.80, -0.44);
  R.bone('chest', 'spine', 0, 0.83, 0.20);
  R.bone('neck', 'chest', 0, 0.90, 0.42);
  R.bone('head', 'neck', 0, 1.00, 0.62);
  R.bone('jaw', 'head', 0, 0.965, 0.68);
  R.bone('ear_l', 'head', 0.08, 1.13, 0.6);
  R.bone('ear_r', 'head', -0.08, 1.13, 0.6);
  R.bone('tail0', 'hips', 0, 0.82, -0.60);
  R.bone('tail1', 'tail0', 0, 0.76, -0.76);
  R.bone('tail2', 'tail1', 0, 0.63, -0.92);
  R.bone('tail3', 'tail2', 0, 0.49, -1.03);
  for (const [k, s] of [['l', 1], ['r', -1]]) {
    R.bone('f' + k + '_sh', 'chest', s * 0.13, 0.74, 0.27);
    R.bone('f' + k + '_el', 'f' + k + '_sh', s * 0.13, 0.46, 0.20);
    R.bone('f' + k + '_wr', 'f' + k + '_el', s * 0.125, 0.16, 0.23);
    R.bone('f' + k + '_paw', 'f' + k + '_wr', s * 0.125, 0.05, 0.27);
    R.bone('h' + k + '_hip', 'hips', s * 0.13, 0.75, -0.44);
    R.bone('h' + k + '_kn', 'h' + k + '_hip', s * 0.14, 0.47, -0.30);
    R.bone('h' + k + '_ho', 'h' + k + '_kn', s * 0.135, 0.22, -0.50);
    R.bone('h' + k + '_paw', 'h' + k + '_ho', s * 0.13, 0.05, -0.46);
  }
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  // body: rump -> loin -> deep ribcage -> withers -> neck -> skull -> muzzle -> nose
  R.tube({
    up: Y, rings: 64, segs: 30, blend: 0.45, color: furColor, fur: furLen, capRound: 0.9, pts: [
      { p: [0, 0.80, -0.64], b: 'hips', r: [0.08, 0.07, 0.08] },
      { p: [0, 0.80, -0.52], b: 'hips', r: [0.16, 0.135, 0.165] },
      { p: [0, 0.80, -0.36], b: 'hips', r: [0.175, 0.145, 0.185] },
      { p: [0, 0.81, -0.10], b: 'spine', r: [0.16, 0.135, 0.155] },
      { p: [0, 0.83, 0.17], b: 'chest', r: [0.185, 0.145, 0.28] },
      { p: [0, 0.87, 0.34], b: 'chest', r: [0.18, 0.155, 0.26] },
      { p: [0, 0.96, 0.50], b: 'neck', r: [0.14, 0.14, 0.165] },
      { p: [0, 1.035, 0.62], b: 'head', r: [0.15, 0.12, 0.11] },
      { p: [0, 1.035, 0.70], b: 'head', r: [0.115, 0.09, 0.08] },
      { p: [0, 1.005, 0.78], b: 'head', r: [0.072, 0.06, 0.047] },
      { p: [0, 0.993, 0.855], b: 'head', r: [0.054, 0.047, 0.032] },
      { p: [0, 0.988, 0.90], b: 'head', r: [0.037, 0.033, 0.02] },
    ],
  });
  // lower jaw
  R.tube({
    up: Y, rings: 14, segs: 14, blend: 0.3, fur: (p) => p.z < 0.8 ? 0.012 : 0,
    color: (p, n) => n.y > 0.35 ? cMouth.clone() : furColor(p, n),
    pts: [
      { p: [0, 0.958, 0.68], b: 'jaw', r: [0.07, 0.02, 0.04] },
      { p: [0, 0.952, 0.78], b: 'jaw', r: [0.047, 0.017, 0.028] },
      { p: [0, 0.956, 0.875], b: 'jaw', r: [0.03, 0.012, 0.016] },
    ],
  });
  // legs
  for (const [k, s] of [['l', 1], ['r', -1]]) {
    R.tube({
      up: Z, rings: 30, segs: 16, blend: 0.3, color: furColor, fur: furLen, pts: [
        { p: [s * 0.10, 0.90, 0.26], b: 'chest', r: [0.06, 0.07, 0.07] },
        { p: [s * 0.13, 0.72, 0.27], b: 'f' + k + '_sh', r: [0.08, 0.095, 0.085] },
        { p: [s * 0.13, 0.46, 0.20], b: 'f' + k + '_el', r: [0.05, 0.056, 0.06] },
        { p: [s * 0.125, 0.16, 0.235], b: 'f' + k + '_wr', r: [0.029, 0.03, 0.028] },
        { p: [s * 0.125, 0.06, 0.27], b: 'f' + k + '_paw', r: [0.032, 0.036, 0.028] },
      ],
    });
    R.tube({
      up: Z, rings: 34, segs: 16, blend: 0.3, color: furColor, fur: furLen, pts: [
        { p: [s * 0.09, 0.90, -0.46], b: 'hips', r: [0.07, 0.08, 0.08] },
        { p: [s * 0.13, 0.72, -0.42], b: 'h' + k + '_hip', r: [0.1, 0.13, 0.11] },
        { p: [s * 0.14, 0.47, -0.31], b: 'h' + k + '_kn', r: [0.055, 0.06, 0.06] },
        { p: [s * 0.135, 0.22, -0.50], b: 'h' + k + '_ho', r: [0.03, 0.028, 0.034] },
        { p: [s * 0.13, 0.06, -0.46], b: 'h' + k + '_paw', r: [0.032, 0.036, 0.028] },
      ],
    });
    // paws (pads + toes)
    const sph = new THREE.SphereGeometry(1, 14, 10);
    for (const [bn, z] of [['f' + k + '_paw', 0.30], ['h' + k + '_paw', -0.43]]) {
      const x = s * (bn[0] === 'f' ? 0.125 : 0.13);
      R.part(sph, bn, mtx([x, 0.035, z], [0, 0, 0], [0.048, 0.032, 0.065]), { color: (p, n) => furColor(p, n), fur: 0.01 });
      for (let tI = -1.5; tI <= 1.5; tI += 1) R.part(sph, bn, mtx([x + tI * 0.019, 0.022, z + 0.05 - Math.abs(tI) * 0.012], [0, 0, 0], [0.013, 0.016, 0.02]), { color: (p, n) => furColor(p, n), fur: 0.006 });
      const claw = thornGeo(0.022, 0.005, 0.8, 5);
      for (let tI = -1.5; tI <= 1.5; tI += 1) R.part(claw, bn, mtx([x + tI * 0.019, 0.016, z + 0.065 - Math.abs(tI) * 0.012], [1.9, 0, 0]), { acc: 'hard', color: cDark });
    }
    // ears: thick fur-covered cones, inner pinkish dark
    const ear = new THREE.ConeGeometry(0.062, 0.17, 12, 3); ear.scale(1, 1, 0.42);
    R.part(ear, 'ear_' + k, mtx([s * 0.085, 1.205, 0.585], [-0.15, 0, -s * 0.32]), { color: (p, n) => (n.z > 0.4 ? cMouth.clone().lerp(cDark, 0.4) : furColor(p, n)), fur: (p, n) => n.z > 0.4 ? 0.0 : 0.014 });
    // eyelid / brow ridge for a scowl
    R.part(sph, 'head', mtx([s * 0.075, 1.078, 0.69], [0.35, s * 0.4, s * 0.55], [0.042, 0.016, 0.032]), { color: cDark, fur: 0.008 });
    // fangs
    const fang = new THREE.ConeGeometry(0.0085, 0.045, 6); fang.translate(0, -0.0225, 0);
    R.part(fang, 'head', mtx([s * 0.03, 0.968, 0.85], [0.1, 0, 0], [1.2, 1.2, 1.2]), { acc: 'hard', color: cIvory });
    R.part(fang, 'jaw', mtx([s * 0.024, 0.962, 0.835], [Math.PI - 0.15, 0, 0], [1.0, 0.9, 1.0]), { acc: 'hard', color: cIvory });
    for (let i = 0; i < 4; i++) {
      R.part(fang, 'head', mtx([s * (0.036 + i * 0.007), 0.972, 0.82 - i * 0.03], [0, 0, 0], [0.55, 0.4, 0.55]), { acc: 'hard', color: cIvory });
      R.part(fang, 'jaw', mtx([s * (0.03 + i * 0.007), 0.962, 0.81 - i * 0.03], [Math.PI, 0, 0], [0.55, 0.35, 0.55]), { acc: 'hard', color: cIvory });
    }
  }
  // nose leather
  R.part(new THREE.SphereGeometry(0.03, 12, 8), 'head', mtx([0, 0.997, 0.902], [0, 0, 0], [1.3, 0.9, 0.9]), { acc: 'hard', color: cNose });
  // bramble thorns along the dorsal line + a vine winding over the back
  const thornCol = (p) => { const t = ss(0.0, 1.0, (p.y - 0.85) / 0.12); return cThorn.clone().lerp(cThornTip, t); };
  const thornSpots = [[-0.5, 'hips', 0.93, 0.07], [-0.38, 'hips', 0.945, 0.10], [-0.24, 'spine', 0.94, 0.09], [-0.08, 'spine', 0.935, 0.11], [0.08, 'chest', 0.955, 0.12], [0.22, 'chest', 0.97, 0.15], [0.33, 'chest', 0.985, 0.17], [0.43, 'neck', 1.02, 0.13]];
  for (const [z, bn, y, len] of thornSpots) {
    for (const s of [-1, 0, 1]) {
      const L = s === 0 ? len : len * 0.55;
      const g = thornGeo(L, L * 0.17, 0.55, 6);
      R.part(g, bn, mtx([s * 0.07, y - 0.012 - Math.abs(s) * 0.03, z + s * 0.02], [-0.55, 0, -s * 0.6]), { acc: 'hard', color: thornCol, fur: (p) => ss(0.4, 0.0, (p.y - y) / L) * 0.6 });
    }
  }
  for (const [z, bn, y] of [[-0.68, 'tail0', 0.86], [-0.82, 'tail1', 0.79], [-0.95, 'tail2', 0.66]]) {
    const g = thornGeo(0.07, 0.012, 0.6, 5);
    R.part(g, bn, mtx([0, y, z], [-1.0, 0, 0]), { acc: 'hard', color: thornCol });
  }
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const z = lerp(-0.58, 0.5, i / 8);
      const bn = z < -0.3 ? 'hips' : z < 0.05 ? 'spine' : z < 0.42 ? 'chest' : 'neck';
      const yb = z < 0.3 ? 0.935 : lerp(0.94, 1.03, (z - 0.3) / 0.2);
      const a = i * 1.3 + (s > 0 ? 0 : Math.PI);
      pts.push({ p: [Math.sin(a) * 0.1, yb - 0.02 + Math.cos(a) * 0.012, z], b: bn, r: [0.011, 0.011, 0.011] });
    }
    R.tube({ acc: 'hard', up: new THREE.Vector3(0, 1, 0), rings: 48, segs: 6, blend: 0.4, color: () => cVine.clone(), fur: () => 1.0, pts });
  }

  const mats = creatureMaterials({ density: 150, comb: [0, -0.25, -0.75], sheenColor: 0xb8b0a2, roughness: 0.86 });
  const built = R.build({ skinMat: mats.skin, hardMat: mats.hard, shells: 11 });
  // eyes: HDR amber, parented to head bone
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.25) });
  const eyes = [];
  const headRest = R.rest.head;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 8), eyeMat);
    e.scale.set(1, 0.65, 1);
    e.position.set(s * 0.088 - headRest.x, 1.052 - headRest.y, 0.69 - headRest.z);
    e.rotation.z = s * 0.35;
    built.bones.head.add(e); eyes.push(e);
  }
  const halo = makeHalo(new THREE.Color(1.0, 0.45, 0.1));
  halo.position.set(0, 1.05 - headRest.y, 0.74 - headRest.z); halo.scale.setScalar(0.32);
  built.bones.head.add(halo);
  return { ...built, mats, eyeMat, halo, rest: R.rest };
}

let _haloTex = null;
export function makeHalo(color) {
  if (!_haloTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.15, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    _haloTex = new THREE.CanvasTexture(c); _haloTex.colorSpace = THREE.SRGBColorSpace;
  }
  const m = new THREE.SpriteMaterial({ map: _haloTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 });
  const s = new THREE.Sprite(m); s.renderOrder = 18;
  return s;
}

// ---------------------------------------------------------------- gait
const GAITS = {
  walk: { off: [0.25, 0.75, 0.0, 0.5], A: 0.32, duty: 0.66, stride: 0.95, lift: 0.8 },
  trot: { off: [0.0, 0.5, 0.5, 0.0], A: 0.5, duty: 0.48, stride: 1.55, lift: 1.0 },
  gallop: { off: [0.52, 0.62, 0.0, 0.1], A: 0.78, duty: 0.38, stride: 2.7, lift: 1.15 },
};
function cycle(p, duty) {
  p = p - Math.floor(p);
  if (p < duty) return [1 - 2 * (p / duty), 0];
  const s = (p - duty) / (1 - duty);
  return [-1 + 2 * herm(s), Math.sin(Math.PI * s)];
}

// ---------------------------------------------------------------- Wolf
let WOLF_ID = 0;
export class Wolf {
  constructor(mgr, x, z, opts = {}) {
    this.mgr = mgr; this.id = WOLF_ID++; this.type = 'wolf';
    const m = buildWolfModel(opts.variant ?? this.id);
    this.m = m; this.root = m.group; this.b = m.bones;
    const sc = (opts.scale ?? (0.95 + Math.random() * 0.12)) * 1.08;
    this.scale = sc; this.root.scale.setScalar(sc);
    this.root.rotation.order = 'YXZ';
    mgr.ctx.scene.add(this.root);
    this.ground = new THREE.Vector3(x, mgr.heightAt(x, z), z);
    this.home = this.ground.clone();
    this.position = new THREE.Vector3(); // body centre (lock-on / hit tests)
    this.radius = 0.55 * sc;
    this.lockHeight = 0.75 * sc;
    this.heading = opts.heading ?? Math.random() * Math.PI * 2;
    this.speed = 0; this.vel = new THREE.Vector3(); this.knock = new THREE.Vector3();
    this.phase = Math.random(); this.gaitW = { walk: 1, trot: 0, gallop: 0 };
    this.maxHealth = 3; this.health = 3; this.alive = true;
    this.state = 'prowl'; this.st = 0; this.cool = 1 + Math.random() * 2;
    this.slot = opts.slot ?? Math.random() * Math.PI * 2; this.circleDir = Math.random() < 0.5 ? 1 : -1;
    this.w = { crouch: 0, snarl: 0, lunge: 0, hurt: 0, dead: 0, alert: 0 };
    this.look = new THREE.Vector2(); this.turnRate = 0; this.lean = 0;
    this.flash = 0; this.lastSwing = -1; this.hurtFlash = 0; this.lastDamaged = -99;
    this.wanderTarget = null; this.air = 0; this.tailWag = Math.random() * 10;
    this.hurt = this.hurt.bind(this);
    this.frozen = false; this._tmp = new THREE.Vector3();
    this.update(0);
  }
  get healthFrac() { return this.health / this.maxHealth; }

  hurt(dmg = 1, dir) {
    if (!this.alive) return false;
    this.health -= dmg; this.lastDamaged = this.mgr.now;
    this.flash = 1;
    const d = (dir ? dir.clone() : new THREE.Vector3().subVectors(this.ground, this.mgr.heroPos() || this.ground)).setY(0);
    if (d.lengthSq() < 1e-6) d.set(Math.sin(this.heading), 0, Math.cos(this.heading)).negate();
    d.normalize();
    this.knock.copy(d).multiplyScalar(7.5);
    this.mgr.releaseToken(this);
    if (this.health <= 0) { this.die(d); return true; }
    this.setState('hurt');
    this.flinchSide = Math.sign(d.x * Math.cos(this.heading) - d.z * Math.sin(this.heading)) || 1;
    this.mgr.emit('enemy-hurt', { enemy: this });
    return true;
  }
  die(d) {
    this.alive = false; this.setState('dying');
    this.knock.copy(d).multiplyScalar(9); this.air = 0.0; this.vy = 3.2;
    this.mgr.onKilled(this);
  }
  setState(s) { this.state = s; this.st = 0; }

  // ------------------------------------------------------------ AI
  think(dt) {
    const M = this.mgr, hero = M.heroPos();
    const toHero = hero ? this._tmp.subVectors(hero, this.ground).setY(0) : null;
    const dist = toHero ? toHero.length() : 1e9;
    const heroAlive = hero && M.heroAlive();
    let want = null, spd = 0, face = null;
    this.st += dt;
    switch (this.state) {
      case 'prowl': {
        if (!this.wanderTarget || this.ground.distanceTo(this.wanderTarget) < 1.2 || this.st > 9) {
          const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6;
          this.wanderTarget = new THREE.Vector3(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r); this.st = 0;
          this.pause = Math.random() < 0.4 ? 1.5 + Math.random() * 2 : 0;
        }
        if (this.pause > 0) { this.pause -= dt; } else { want = this.wanderTarget; spd = 1.1; }
        if (heroAlive && dist < 22) this.setState('stalk');
        break;
      }
      case 'stalk':
        want = hero; spd = 1.5; face = hero; this.w.alert = 1;
        if (!heroAlive || dist > 34) this.setState('prowl');
        else if (dist < 10) this.setState('circle');
        break;
      case 'circle': {
        face = hero;
        if (!heroAlive) { this.setState('prowl'); break; }
        const R = 6.2 + Math.sin(this.id * 3.1 + M.now * 0.4) * 0.8;
        this.slot += this.circleDir * dt * 0.42;
        // spread the pack: slots repel each other
        for (const o of M.wolves) if (o !== this && o.alive) { const da = wrapA(this.slot - o.slot); if (Math.abs(da) < 1.3) this.slot += Math.sign(da || 1) * dt * 0.6; }
        want = new THREE.Vector3(hero.x + Math.cos(this.slot) * R, 0, hero.z + Math.sin(this.slot) * R);
        spd = Math.min(4.2, 1.2 + this.ground.distanceTo(want.setY(this.ground.y)) * 1.1);
        this.cool -= dt;
        if (this.cool <= 0 && dist < 9 && M.takeToken(this)) { this.setState('telegraph'); M.emit('enemy-telegraph', { enemy: this }); }
        if (dist > 16) this.setState('stalk');
        break;
      }
      case 'telegraph':
        face = hero; spd = 0;
        if (this.st > 0.05 && this.st - dt <= 0.05) M.vfx.glint(this.eyeWorld(), new THREE.Color(4, 1.6, 0.4));
        if (this.st > 0.72) {
          this.setState('lunge');
          const tgt = hero ? hero.clone() : this.ground.clone();
          const d = new THREE.Vector3().subVectors(tgt, this.ground).setY(0); const L = Math.min(7.5, Math.max(2, d.length() + 0.6));
          d.normalize(); this.heading = Math.atan2(d.x, d.z);
          this.lungeVel = d.multiplyScalar(L / 0.52); this.bit = false; this.vy = 3.6;
          M.vfx.dust(this.ground, 0.6, 6);
          M.emit('enemy-attack', { enemy: this });
        }
        break;
      case 'lunge': {
        this.ground.addScaledVector(this.lungeVel, dt);
        this.air += this.vy * dt; this.vy -= 14 * dt;
        if (!this.bit && this.st > 0.12 && hero) {
          const head = this.headWorld();
          const hc = hero.clone(); hc.y += 0.9;
          if (head.distanceTo(hc) < 1.05 * this.scale + 0.35) {
            this.bit = true;
            M.heroHurt(2, this.lungeVel.clone().setY(0).normalize(), this);
          }
        }
        if (this.st > 0.52 || this.air < 0) { this.air = 0; this.setState('recover'); M.vfx.dust(this.ground, 0.7, 8); }
        break;
      }
      case 'recover':
        face = hero; if (this.st > 0.45) { this.setState('retreat'); M.releaseToken(this); }
        break;
      case 'retreat': {
        face = hero;
        if (hero) { const away = this.ground.clone().sub(hero).setY(0).normalize(); want = this.ground.clone().addScaledVector(away, 3); spd = 3.2; }
        if (this.st > 1.1 || dist > 8) { this.setState('circle'); this.cool = 1.8 + Math.random() * 2.2; this.slot = hero ? Math.atan2(this.ground.z - hero.z, this.ground.x - hero.x) : this.slot; }
        break;
      }
      case 'hurt':
        if (this.st > 0.42) { this.setState('retreat'); }
        break;
      case 'dying':
        this.air = Math.max(0, this.air + this.vy * dt); this.vy -= 14 * dt;
        if (this.st > 0.55 && !this.burst) { this.burst = true; M.vfx.deathBurst(this.position.clone(), 0.6 * this.scale); M.dropShards(this.ground, 3 + Math.floor(Math.random() * 3)); }
        if (this.st > 0.55) this.dissolve = Math.min(1, (this.st - 0.55) / 1.1);
        if (this.st > 0.55 && Math.random() < 0.7) M.vfx.motes(this.position, 0.45 * this.scale, 2);
        if (this.st > 1.75) this.dead = true;
        break;
      case 'snarlPose':
        face = hero;
        break;
    }
    // steering
    let desired = 0, desiredHeading = this.heading;
    if (want) {
      const d = new THREE.Vector3(want.x - this.ground.x, 0, want.z - this.ground.z);
      const L = d.length();
      if (L > 0.3) { desired = spd * Math.min(1, L / 1.5); desiredHeading = Math.atan2(d.x, d.z); }
    }
    // when circling, face the hero but strafe? wolves look at the hero with head, body follows path
    if (!want && face && this.state !== 'lunge') { const d = new THREE.Vector3().subVectors(face, this.ground); desiredHeading = Math.atan2(d.x, d.z); }
    if (this.state !== 'lunge' && this.state !== 'dying' && this.state !== 'hurt') {
      const dh = wrapA(desiredHeading - this.heading);
      const maxTurn = (2.5 + this.speed * 0.6) * dt;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, dh));
      this.heading = wrapA(this.heading + turn);
      this.turnRate = damp(this.turnRate, turn / Math.max(dt, 1e-4), 6, dt);
      // slow down while turning hard
      desired *= 1 - Math.min(0.6, Math.abs(dh) / Math.PI);
    }
    this.speed = damp(this.speed, desired, 4, dt);
    this.lookTarget = face;
  }

  headWorld() { const p = new THREE.Vector3(); this.b.head.getWorldPosition(p); p.add(new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)).multiplyScalar(0.3 * this.scale)); return p; }
  eyeWorld() { const p = new THREE.Vector3(); this.m.halo.getWorldPosition(p); return p; }

  // ------------------------------------------------------------ update
  update(dt) {
    const M = this.mgr;
    if (!this.frozen) this.think(dt); else { this.st += dt; this.lookTarget = M.heroPos(); }
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (this.state !== 'lunge' && !this.frozen) this.ground.addScaledVector(fwd, this.speed * dt);
    // knockback
    if (this.knock.lengthSq() > 1e-4) { this.ground.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.exp(-7 * dt)); }
    M.collide(this, dt);
    this.ground.y = M.heightAt(this.ground.x, this.ground.z);

    // ---- pose weights
    const s = this.state, W = this.w;
    W.crouch = damp(W.crouch, s === 'telegraph' ? 1 : s === 'snarlPose' ? 0.75 : s === 'stalk' ? 0.35 : 0, 8, dt);
    W.snarl = damp(W.snarl, (s === 'telegraph' || s === 'snarlPose' || s === 'lunge' || s === 'recover') ? 1 : s === 'circle' ? 0.45 : s === 'stalk' ? 0.3 : 0, 6, dt);
    W.lunge = damp(W.lunge, s === 'lunge' ? 1 : 0, 14, dt);
    W.hurt = damp(W.hurt, s === 'hurt' ? 1 : 0, 18, dt);
    W.dead = damp(W.dead, s === 'dying' ? 1 : 0, 7, dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.pose(dt);

    // ---- transforms
    const hf = M.heightAt(this.ground.x + fwd.x * 0.55, this.ground.z + fwd.z * 0.55);
    const hb = M.heightAt(this.ground.x - fwd.x * 0.55, this.ground.z - fwd.z * 0.55);
    const pitch = -Math.atan2(hf - hb, 1.1);
    this.lean = damp(this.lean, Math.max(-0.35, Math.min(0.35, -this.turnRate * this.speed * 0.05)), 5, dt);
    this.root.position.set(this.ground.x, this.ground.y + this.air, this.ground.z);
    this.root.rotation.set(pitch * (1 - W.dead) + (s === 'lunge' ? -0.25 * Math.sin(Math.min(1, this.st / 0.52) * Math.PI) + 0.1 : 0), this.heading, this.lean + W.dead * 1.45 * (this.deathSide || 1));
    this.position.set(this.ground.x, this.ground.y + this.air + this.lockHeight * (1 - W.dead * 0.6), this.ground.z);

    // ---- material feedback
    const u = this.m.mats.uniforms;
    const f = this.flash * this.flash;
    u.uFlash.value.set(f * 2.2, f * 1.9, f * 1.6);
    u.uDissolve.value = this.dissolve || 0;
    const tele = s === 'telegraph' ? Math.min(1, this.st / 0.4) : s === 'lunge' ? 1 - this.st : 0;
    u.uGlow.value = 0.6 + tele * 5.0 + Math.sin(M.now * 3 + this.id) * 0.15;
    u.uFurScale.value = 1 + W.snarl * 0.25;
    const eg = (this.alive ? 1 : 1 - W.dead) * (1 + tele * 2.5);
    this.m.eyeMat.color.setRGB(3.2 * eg, 1.3 * eg, 0.25 * eg);
    this.m.halo.material.opacity = 0.35 * eg + tele * 0.4;
    this.m.halo.scale.setScalar(0.28 + tele * 0.35);
  }

  pose(dt) {
    const B = this.b, W = this.w, t = this.mgr.now;
    for (const k in B) { if (k !== 'root') B[k].rotation.set(0, 0, 0); }
    B.spine.position.set(0, 0.81, -0.12);
    // gait blend by speed
    const v = this.speed;
    const tw = { walk: v < 2.2 ? 1 : 0, trot: v >= 2.2 && v < 5.2 ? 1 : 0, gallop: v >= 5.2 ? 1 : 0 };
    for (const g in tw) this.gaitW[g] = damp(this.gaitW[g], tw[g], 5, dt);
    let stride = 0; for (const g in GAITS) stride += GAITS[g].stride * this.gaitW[g];
    this.phase += (v / stride) * dt;
    const moveK = Math.min(1, v / 0.6);
    const legs = [['fl', 0], ['fr', 1], ['hl', 2], ['hr', 3]];
    for (const [L, i] of legs) {
      let sw = 0, li = 0;
      for (const g in GAITS) {
        const G = GAITS[g], w = this.gaitW[g]; if (w < 1e-3) continue;
        const [a, b] = cycle(this.phase + G.off[i], G.duty);
        sw += a * G.A * w; li += b * G.lift * w;
      }
      sw *= moveK; li *= moveK;
      if (L[0] === 'f') {
        B[L + '_sh'].rotation.x = -sw * 0.9 - li * 0.15;
        B[L + '_el'].rotation.x = -li * 0.45 + Math.max(0, sw) * 0.15;
        B[L + '_wr'].rotation.x = li * 1.6;
        B[L + '_paw'].rotation.x = li * 0.5 - Math.max(0, -sw) * 0.4;
      } else {
        B[L + '_hip'].rotation.x = -sw * 0.85;
        B[L + '_kn'].rotation.x = li * 0.55 - sw * 0.2;
        B[L + '_ho'].rotation.x = -li * 1.0 + sw * 0.15;
        B[L + '_paw'].rotation.x = li * 0.9 - Math.max(0, sw) * 0.3;
      }
    }
    // body motion
    const ph = this.phase * Math.PI * 2;
    const gal = this.gaitW.gallop * moveK, tro = this.gaitW.trot * moveK, wal = this.gaitW.walk * moveK;
    B.spine.position.y += -Math.abs(Math.sin(ph * 2)) * 0.018 * tro + Math.sin(ph + 1.2) * 0.05 * gal - Math.abs(Math.sin(ph * 2)) * 0.01 * wal;
    B.spine.rotation.x = Math.sin(ph + 0.6) * 0.06 * gal;
    B.hips.rotation.x = Math.sin(ph) * 0.2 * gal;
    B.chest.rotation.x = -Math.sin(ph + 0.9) * 0.14 * gal;
    B.spine.rotation.z = Math.sin(ph) * 0.04 * (wal + tro);
    B.hips.rotation.y = Math.sin(ph) * 0.06 * (wal + tro);
    B.chest.rotation.y = -Math.sin(ph) * 0.05 * (wal + tro);
    // breathing
    const breath = Math.sin(t * (2.2 + W.snarl * 3) + this.id);
    B.chest.position.set(0, 0.02 + breath * 0.004, 0.32);
    // tail: lagged sway; raised when alert, low and stiff when snarling, tucked when hurt
    const tailLift = -0.1 + W.alert * 0.15 - W.snarl * 0.05 + gal * 0.35 - W.hurt * 0.4;
    for (let i = 0; i < 4; i++) {
      const tb = B['tail' + i];
      tb.rotation.y = Math.sin(t * (2.0 + v * 0.8) - i * 0.7 + this.tailWag) * (0.12 + i * 0.05) * (1 - W.snarl * 0.6) + this.turnRate * 0.05 * i;
      tb.rotation.x = tailLift * (i === 0 ? 1 : 0.4) + Math.sin(ph * 2 - i * 0.8) * 0.08 * (gal + tro);
    }
    // head look (yaw/pitch toward target in local frame)
    let ly = 0, lp = 0;
    if (this.lookTarget && this.alive) {
      const d = new THREE.Vector3().subVectors(this.lookTarget, this.ground);
      const yaw = wrapA(Math.atan2(d.x, d.z) - this.heading);
      ly = Math.max(-1.1, Math.min(1.1, yaw)); lp = Math.max(-0.4, Math.min(0.3, Math.atan2(d.y + 0.6, Math.hypot(d.x, d.z)) * 0.6));
    }
    this.look.x = damp(this.look.x, ly, 6, dt); this.look.y = damp(this.look.y, lp, 6, dt);
    B.neck.rotation.y = this.look.x * 0.45; B.head.rotation.y = this.look.x * 0.5;
    B.neck.rotation.x = -this.look.y * 0.4 + Math.sin(ph * 2) * 0.05 * tro; B.head.rotation.x = -this.look.y * 0.5;
    // ears: pricked forward, flattened back when snarling
    for (const [k, sd] of [['ear_l', 1], ['ear_r', -1]]) {
      B[k].rotation.x = -W.snarl * 0.5 + Math.sin(t * 0.7 + this.id + sd) * 0.05;
      B[k].rotation.z = -sd * W.snarl * 0.35;
    }
    // ---- snarl/crouch: head low, neck stretched, jaw open, shoulders hunched
    const c = W.crouch, sn = W.snarl;
    B.spine.position.y -= c * 0.13;
    B.spine.rotation.x += c * 0.06;
    B.neck.rotation.x += sn * 0.5 + c * 0.2;
    B.head.rotation.x += -sn * 0.5 - c * 0.12;
    B.jaw.rotation.x = sn * (0.24 + Math.sin(t * 13 + this.id) * 0.03 * sn) + W.lunge * 0.35 + W.dead * 0.3;
    // keep paws planted while crouched (approximate leg flex)
    for (const k of ['fl', 'fr']) { B[k + '_sh'].rotation.x += c * 0.42; B[k + '_el'].rotation.x += -c * 0.62; B[k + '_wr'].rotation.x += c * 0.28; }
    for (const k of ['hl', 'hr']) { B[k + '_hip'].rotation.x += -c * 0.4; B[k + '_kn'].rotation.x += c * 0.62; B[k + '_ho'].rotation.x += -c * 0.38; }
    // lunge: full extension
    const lg = W.lunge;
    if (lg > 0.01) {
      for (const k of ['fl', 'fr']) { B[k + '_sh'].rotation.x += -1.05 * lg; B[k + '_wr'].rotation.x += 0.3 * lg; }
      for (const k of ['hl', 'hr']) { B[k + '_hip'].rotation.x += 0.9 * lg; B[k + '_ho'].rotation.x += 0.4 * lg; }
      B.neck.rotation.x += -0.35 * lg; B.head.rotation.x += 0.15 * lg;
    }
    // hurt flinch
    const h = W.hurt;
    if (h > 0.01) { const sd = this.flinchSide || 1; B.spine.rotation.z += sd * 0.2 * h; B.neck.rotation.y += sd * 0.6 * h; B.head.rotation.x += 0.3 * h; B.spine.position.y -= 0.05 * h; }
    // death: limp
    const dd = W.dead;
    if (dd > 0.01) {
      for (const k of ['fl', 'fr', 'hl', 'hr']) { const bn = k[0] === 'f' ? k + '_sh' : k + '_hip'; B[bn].rotation.x += (k[0] === 'f' ? -0.5 : 0.5) * dd; B[bn].rotation.z += (k[1] === 'l' ? 0.2 : -0.2) * dd; }
      B.neck.rotation.x += 0.4 * dd; B.spine.position.y -= 0.35 * dd;
    }
  }

  dispose() {
    this.root.parent?.remove(this.root);
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.m.mats.skin.dispose(); this.m.mats.hard.dispose();
  }
}
