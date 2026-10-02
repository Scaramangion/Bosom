// Thornback brute: hunched bipedal goblin-kin with scaled hide, leather straps,
// bark pauldron, thorn ridge and a thorned club. Slow, telegraphed overhead slam.
import * as THREE from 'three';
import { Rig, srgb, mtx, thornGeo } from './rig.js';
import { creatureMaterials, scaleNormalMap } from './materials.js';
import { makeHalo } from './wolf.js';
import { noise2 } from '../world/layout.js';

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// torso profile (shared by skin tube and the straps that wrap it)
const TORSO = [
  { y: 0.80, z: 0.00, r: [0.25, 0.19, 0.19], b: 'pelvis' },
  { y: 1.00, z: 0.00, r: [0.31, 0.25, 0.23], b: 'pelvis' },
  { y: 1.27, z: 0.05, r: [0.35, 0.35, 0.26], b: 'spine' },
  { y: 1.58, z: 0.11, r: [0.45, 0.30, 0.36], b: 'chest' },
  { y: 1.79, z: 0.19, r: [0.40, 0.24, 0.33], b: 'chest' },
  { y: 1.93, z: 0.31, r: [0.19, 0.16, 0.20], b: 'neck' },
  { y: 2.00, z: 0.38, r: [0.11, 0.10, 0.10], b: 'neck' },
];
function torsoAt(y) {
  let i = 0; while (i < TORSO.length - 2 && TORSO[i + 1].y < y) i++;
  const a = TORSO[i], b = TORSO[i + 1]; const t = Math.min(1, Math.max(0, (y - a.y) / (b.y - a.y))); const h = t * t * (3 - 2 * t);
  return { z: lerp(a.z, b.z, h), rx: lerp(a.r[0], b.r[0], h), rf: lerp(a.r[1], b.r[1], h), rb: lerp(a.r[2], b.r[2], h), b: t < 0.5 ? a.b : b.b };
}
// point on torso surface at height y, angle th (0 = front, +pi/2 = +x side)
function torsoSurf(y, th, out = 0.02) {
  const T = torsoAt(y); const c = Math.cos(th), s = Math.sin(th);
  const rz = c > 0 ? T.rf : T.rb;
  return { p: [s * (T.rx + out), y, T.z + c * (rz + out)], b: T.b };
}

function buildBruteModel() {
  const cBack = srgb(0x3d4a2e), cSide = srgb(0x637048), cBelly = srgb(0xa49a6a), cDark = srgb(0x232a1a), cWart = srgb(0x7c6a3c);
  const cLeather = srgb(0x4a2c18), cLeatherDk = srgb(0x2a170c), cBark = srgb(0x3b2a1c), cBarkLt = srgb(0x6d5236), cIvory = srgb(0xddcfa8), cIron = srgb(0x55524c), cMouth = srgb(0x40141a), cThorn = srgb(0x2d1912), cThornTip = srgb(0x8a6844);
  const T = new THREE.Color();
  const skinColor = (p, n) => {
    const nv = noise2(p.x * 6.0, p.y * 6.0 + p.z * 3.0) * 0.5 + 0.5;
    const nv2 = noise2(p.x * 1.7 + 40, p.y * 2.3) * 0.5 + 0.5;
    const backness = ss(0.1, -0.8, n.z) * ss(1.1, 1.5, p.y);
    T.copy(cSide).lerp(cBack, Math.max(ss(0.2, 0.9, n.y), backness) * 0.8);
    // tiger-ish darker bands across the back
    if (backness > 0.2) T.lerp(cDark, ss(0.55, 0.75, Math.sin(p.y * 22 + nv2 * 3) * 0.5 + 0.5) * 0.55 * backness);
    // pale gut & throat & inner arms
    if (n.z > 0.2 && p.y > 0.9 && p.y < 2.0 && Math.abs(p.x) < 0.32) T.lerp(cBelly, ss(0.2, 0.8, n.z) * 0.75);
    if (p.y < 0.5) T.lerp(cDark, ss(0.5, 0.1, p.y) * 0.35);
    T.lerp(cWart, ss(0.72, 0.9, nv) * 0.5);
    T.lerp(cDark, ss(0.55, 0.75, nv2) * 0.45); // mottling
    // ochre war-paint slashes across shoulders and brow
    const paint = Math.sin((p.x * 1.4 + p.y * 1.0) * 26) * 0.5 + 0.5;
    if ((p.y > 1.7 && p.y < 1.9 && Math.abs(p.x) > 0.3) || (p.y > 2.05 && p.z > 0.5)) T.lerp(srgb(0x8a2a12), ss(0.75, 0.9, paint) * 0.8);
    T.multiplyScalar(0.82 + nv * 0.3);
    return T.clone();
  };
  const mane = (p, n) => (p.y > 1.45 && n.z < -0.35 && Math.abs(p.x) < 0.3) ? 0.07 * ss(1.45, 1.75, p.y) : (p.z > 0.25 && p.y > 2.05 && n.y > 0.5 ? 0.05 : 0);

  const R = new Rig();
  R.bone('root', null, 0, 0, 0);
  R.bone('pelvis', 'root', 0, 1.0, 0);
  R.bone('spine', 'pelvis', 0, 1.3, 0.04);
  R.bone('chest', 'spine', 0, 1.62, 0.12);
  R.bone('neck', 'chest', 0, 1.88, 0.30);
  R.bone('head', 'neck', 0, 1.98, 0.42);
  R.bone('jaw', 'head', 0, 1.93, 0.42);
  for (const [k, s] of [['l', 1], ['r', -1]]) {
    R.bone(k + '_sh', 'chest', s * 0.46, 1.76, 0.15);
    R.bone(k + '_el', k + '_sh', s * 0.6, 1.32, 0.15);
    R.bone(k + '_wr', k + '_el', s * 0.64, 0.92, 0.24);
    R.bone(k + '_hand', k + '_wr', s * 0.65, 0.80, 0.27);
    R.bone(k + '_hip', 'pelvis', s * 0.2, 0.96, 0.02);
    R.bone(k + '_kn', k + '_hip', s * 0.25, 0.56, 0.10);
    R.bone(k + '_an', k + '_kn', s * 0.25, 0.13, -0.02);
    R.bone(k + '_ear', 'head', s * 0.16, 2.05, 0.42);
  }
  const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  R.tube({ up: Z, rings: 44, segs: 32, blend: 0.45, color: skinColor, fur: mane, capRound: 0.6, pts: TORSO.map(q => ({ p: [0, q.y, q.z], b: q.b, r: q.r })) });
  // head (forward-thrust skull) + heavy underbite jaw
  R.tube({
    up: Y, rings: 26, segs: 24, blend: 0.3, color: skinColor, fur: mane, pts: [
      { p: [0, 2.01, 0.28], b: 'head', r: [0.15, 0.16, 0.13] },
      { p: [0, 2.05, 0.42], b: 'head', r: [0.175, 0.17, 0.13] },
      { p: [0, 2.03, 0.55], b: 'head', r: [0.15, 0.115, 0.1] },
      { p: [0, 1.98, 0.65], b: 'head', r: [0.105, 0.09, 0.07] },
      { p: [0, 1.965, 0.71], b: 'head', r: [0.065, 0.055, 0.04] },
    ],
  });
  R.tube({
    up: Y, rings: 16, segs: 20, blend: 0.3, color: (p, n) => n.y > 0.5 && p.z > 0.4 ? cMouth.clone() : skinColor(p, n), pts: [
      { p: [0, 1.91, 0.33], b: 'jaw', r: [0.15, 0.05, 0.08] },
      { p: [0, 1.89, 0.52], b: 'jaw', r: [0.14, 0.05, 0.075] },
      { p: [0, 1.895, 0.66], b: 'jaw', r: [0.10, 0.045, 0.055] },
    ],
  });
  const sph = new THREE.SphereGeometry(1, 16, 12);
  // nose, cheekbones, brow ridge (angry V), warts
  R.part(sph, 'head', mtx([0, 1.975, 0.715], [0.3, 0, 0], [0.06, 0.04, 0.045]), { color: skinColor });
  for (const s of [-1, 1]) {
    R.part(sph, 'head', mtx([s * 0.085, 2.085, 0.575], [0.2, s * 0.3, -s * 0.42], [0.085, 0.032, 0.05]), { color: (p, n) => skinColor(p, n).multiplyScalar(0.7) });
    R.part(sph, 'head', mtx([s * 0.11, 1.99, 0.56], [0, 0, 0], [0.06, 0.045, 0.06]), { color: skinColor });
    // eye socket (dark) behind the glowing eye
    R.part(sph, 'head', mtx([s * 0.07, 2.035, 0.585], [0, 0, 0], [0.04, 0.028, 0.03]), { acc: 'hard', color: srgb(0x120c08) });
    // tusks
    R.part(thornGeo(0.12, 0.024, -0.35, 8), 'jaw', mtx([s * 0.085, 1.915, 0.63], [-0.15, 0, -s * 0.25]), { acc: 'hard', color: (p) => cIvory.clone().multiplyScalar(0.7 + (p.y - 1.9) * 2.5) });
    // lower teeth row
    for (let i = 0; i < 3; i++) R.part(new THREE.ConeGeometry(0.012, 0.035, 5).translate(0, 0.017, 0), 'jaw', mtx([s * (0.025 + i * 0.022), 1.925, 0.66 - i * 0.012], [0, 0, 0]), { acc: 'hard', color: cIvory });
    // long goblin ears
    const ear = new THREE.ConeGeometry(0.06, 0.34, 10, 4); ear.scale(1, 1, 0.35); ear.translate(0, 0.17, 0);
    R.part(ear, s > 0 ? 'l_ear' : 'r_ear', mtx([s * 0.15, 2.05, 0.42], [0.3, 0, -s * 1.25]), { color: (p, n) => skinColor(p, n).lerp(cMouth, n.z > 0.5 ? 0.35 : 0) });
    // shoulder & trapezius mass
    R.part(sph, s > 0 ? 'l_sh' : 'r_sh', mtx([s * 0.46, 1.79, 0.13], [0, 0, s * 0.4], [0.2, 0.17, 0.19]), { color: skinColor, fur: mane });
    R.part(sph, 'chest', mtx([s * 0.22, 1.83, 0.08], [0, 0, s * 0.5], [0.2, 0.13, 0.2]), { color: skinColor, fur: (p, n) => n.z < -0.3 ? 0.06 : 0 });
    // pecs
    R.part(sph, 'chest', mtx([s * 0.15, 1.66, 0.3], [0.1, 0, s * 0.25], [0.21, 0.12, 0.07]), { color: skinColor });
  }
  for (const [k, s] of [['l', 1], ['r', -1]]) {
    R.tube({
      up: Z, rings: 34, segs: 18, blend: 0.3, color: skinColor, fur: () => 0, pts: [
        { p: [s * 0.3, 1.82, 0.12], b: 'chest', r: [0.13, 0.13, 0.13] },
        { p: [s * 0.48, 1.72, 0.15], b: k + '_sh', r: [0.15, 0.15, 0.15] },
        { p: [s * 0.6, 1.32, 0.15], b: k + '_el', r: [0.11, 0.11, 0.11] },
        { p: [s * 0.625, 1.13, 0.19], b: k + '_el', r: [0.135, 0.125, 0.125] },
        { p: [s * 0.64, 0.92, 0.24], b: k + '_wr', r: [0.08, 0.075, 0.075] },
        { p: [s * 0.645, 0.86, 0.26], b: k + '_wr', r: [0.075, 0.07, 0.07] },
      ],
    });
    // fist: palm + knuckles + thumb
    const hp = R.rest[k + '_hand'];
    R.part(sph, k + '_hand', mtx([hp.x, hp.y, hp.z + 0.01], [0, 0, 0], [0.085, 0.1, 0.1]), { color: skinColor });
    for (let i = 0; i < 4; i++) R.part(sph, k + '_hand', mtx([hp.x - s * 0.01, hp.y + 0.05 - i * 0.034, hp.z + 0.085], [0, 0, 0], [0.05, 0.022, 0.035]), { color: (p, n) => skinColor(p, n).multiplyScalar(0.9) });
    R.part(sph, k + '_hand', mtx([hp.x - s * 0.06, hp.y + 0.02, hp.z + 0.06], [0.4, 0, 0], [0.03, 0.05, 0.03]), { color: skinColor });
    // leather bracer with iron studs
    const brac = new THREE.CylinderGeometry(0.14, 0.11, 0.24, 18, 1, true);
    const ep = R.rest[k + '_el'], wp = R.rest[k + '_wr'];
    const mid = ep.clone().lerp(wp, 0.55); const dir = wp.clone().sub(ep).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.negate());
    const bm = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
    R.part(brac, k + '_el', bm, { acc: 'hard', color: (p, n) => cLeather.clone().multiplyScalar(0.8 + noise2(p.y * 40, p.x * 40) * 0.15) });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; R.part(sph, k + '_el', new THREE.Matrix4().multiplyMatrices(bm, mtx([Math.cos(a) * 0.135, 0.07, Math.sin(a) * 0.135], [0, 0, 0], [0.016, 0.016, 0.016])), { acc: 'hard', color: cIron }); }
    // legs
    R.tube({
      up: Z, rings: 32, segs: 18, blend: 0.3, color: skinColor, fur: () => 0, pts: [
        { p: [s * 0.15, 1.06, 0.0], b: 'pelvis', r: [0.16, 0.16, 0.16] },
        { p: [s * 0.21, 0.92, 0.03], b: k + '_hip', r: [0.175, 0.18, 0.17] },
        { p: [s * 0.25, 0.56, 0.10], b: k + '_kn', r: [0.11, 0.12, 0.11] },
        { p: [s * 0.25, 0.37, 0.03], b: k + '_kn', r: [0.115, 0.095, 0.13] },
        { p: [s * 0.25, 0.13, -0.02], b: k + '_an', r: [0.075, 0.07, 0.075] },
        { p: [s * 0.25, 0.08, 0.0], b: k + '_an', r: [0.07, 0.07, 0.07] },
      ],
    });
    // splayed three-toed foot with claws
    R.part(sph, k + '_an', mtx([s * 0.25, 0.07, 0.04], [0, 0, 0], [0.1, 0.07, 0.14]), { color: skinColor });
    for (let i = -1; i <= 1; i++) {
      R.part(sph, k + '_an', mtx([s * 0.25 + i * 0.055, 0.045, 0.17 - Math.abs(i) * 0.02], [0, i * 0.3, 0], [0.035, 0.035, 0.07]), { color: skinColor });
      R.part(thornGeo(0.05, 0.014, 0.9, 5), k + '_an', mtx([s * 0.25 + i * 0.055, 0.04, 0.23 - Math.abs(i) * 0.02], [1.5, 0, 0]), { acc: 'hard', color: srgb(0x1c1610) });
    }
  }
  // ---- leather harness: diagonal baldric (L shoulder -> R hip), belt, buckle, loincloth
  const leatherCol = (p, n) => { const k = noise2(p.x * 30 + p.y * 10, p.z * 30) * 0.5 + 0.5; return cLeather.clone().lerp(cLeatherDk, k * 0.5); };
  {
    const pts = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // front side: from left shoulder (high, +x) down to right hip (-x); wrap over the shoulder at t=0
      const y = lerp(1.86, 1.02, t), th = lerp(0.95, -1.35, t);
      const s = torsoSurf(y, th, 0.03 + Math.sin(t * Math.PI) * 0.012);
      pts.push({ p: s.p, b: s.b, r: [0.014, 0.05, 0.05] });
    }
    R.tube({ acc: 'hard', up: Y, rings: 40, segs: 8, blend: 0.45, square: 0.6, color: leatherCol, pts });
    const pb = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; const y = lerp(1.86, 1.02, t), th = lerp(0.95, 2.0 + Math.PI * 0.5, t); const s = torsoSurf(y, th, 0.03); pb.push({ p: s.p, b: s.b, r: [0.014, 0.05, 0.05] }); }
    R.tube({ acc: 'hard', up: Y, rings: 30, segs: 8, blend: 0.45, square: 0.6, color: leatherCol, pts: pb });
    // belt ring around the waist
    const belt = [];
    for (let i = 0; i <= 24; i++) { const th = i / 24 * Math.PI * 2; const s = torsoSurf(1.04, th, 0.03); belt.push({ p: s.p, b: 'pelvis', r: [0.016, 0.07, 0.07] }); }
    R.tube({ acc: 'hard', up: Y, rings: 60, segs: 8, blend: 0.3, square: 0.6, color: leatherCol, capStart: false, capEnd: false, pts: belt });
    // iron buckle + studs on the baldric
    const fs = torsoSurf(1.04, 0, 0.06);
    R.part(new THREE.TorusGeometry(0.06, 0.014, 6, 16), 'pelvis', mtx(fs.p, [0, 0, 0], [1, 0.8, 1]), { acc: 'hard', color: cIron });
    for (let i = 1; i < 8; i++) { const t = i / 8; const s = torsoSurf(lerp(1.86, 1.02, t), lerp(0.95, -1.35, t), 0.05); R.part(sph, s.b, mtx(s.p, [0, 0, 0], [0.018, 0.018, 0.018]), { acc: 'hard', color: cIron }); }
    // trophy: a small bone talisman hanging on the strap
    const ts = torsoSurf(1.5, 0.25, 0.07);
    R.part(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), 'chest', mtx(ts.p, [0, 0, 0.3]), { acc: 'hard', color: cIvory });
    // loincloth flaps (front/back) – ragged hide
    const flap = new THREE.BoxGeometry(0.34, 0.42, 0.025, 4, 6, 1);
    const fp = flap.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i); const x = fp.getX(i); if (y < -0.15) fp.setY(i, y - (noise2(x * 18, 3) * 0.06)); fp.setZ(i, fp.getZ(i) + (y + 0.21) * (y + 0.21) * -0.15 + x * x * -0.5); }
    flap.computeVertexNormals();
    const hide = srgb(0x6b5236);
    R.part(flap, 'pelvis', mtx([0, 0.86, 0.24], [0.08, 0, 0]), { acc: 'hard', color: (p) => hide.clone().multiplyScalar(0.75 + noise2(p.x * 25, p.y * 25) * 0.2) });
    R.part(flap, 'pelvis', mtx([0, 0.86, -0.22], [-0.08, Math.PI, 0], [1.2, 1, 1]), { acc: 'hard', color: (p) => hide.clone().multiplyScalar(0.7 + noise2(p.x * 25, p.y * 25) * 0.2) });
  }
  // ---- bark pauldron on the left shoulder (strapped), thorn ridge down the back
  {
    const pg = new THREE.SphereGeometry(0.26, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const n = noise2(x * 18, z * 18) * 0.02; pp.setXYZ(i, x * (1 + n * 4), y * 0.75 + n, z); }
    pg.computeVertexNormals();
    const barkCol = (p, n) => { const k = Math.abs(Math.sin(p.y * 70 + noise2(p.x * 10, p.z * 10) * 4)); return cBark.clone().lerp(cBarkLt, ss(0.7, 1.0, k) * 0.6).multiplyScalar(0.8 + noise2(p.x * 20, p.z * 20) * 0.2); };
    R.part(pg, 'l_sh', mtx([0.5, 1.83, 0.13], [0, 0, -0.55]), { acc: 'hard', color: barkCol });
    R.part(pg, 'l_sh', mtx([0.6, 1.72, 0.14], [0, 0, -1.05], [0.75, 0.8, 0.85]), { acc: 'hard', color: barkCol });
    for (let i = 0; i < 4; i++) R.part(thornGeo(0.13 - i * 0.02, 0.025, 0.4, 6), 'l_sh', mtx([0.46 + i * 0.06, 1.97 - i * 0.07, 0.04 + i * 0.03], [-0.6, 0, -0.7 - i * 0.2]), { acc: 'hard', color: (p) => cThorn.clone().lerp(cThornTip, ss(1.9, 2.05, p.y)), fur: 0.3 });
    // ridge
    const ridge = [[1.95, 0.20, 0.14], [1.84, 0.08, 0.24], [1.72, -0.03, 0.30], [1.58, -0.1, 0.30], [1.44, -0.12, 0.26], [1.3, -0.11, 0.2], [1.17, -0.11, 0.14]];
    for (const [y, z, L] of ridge) {
      const T0 = torsoAt(y);
      for (const s of [-1, 0, 1]) {
        const len = s === 0 ? L : L * 0.6;
        const bz = T0.z - T0.rb + 0.04;
        R.part(thornGeo(len, len * 0.16, 0.6, 6), T0.b, mtx([s * 0.1, y, bz + Math.abs(s) * 0.02], [-1.9, 0, -s * 0.5]), { acc: 'hard', color: (p) => cThorn.clone().lerp(cThornTip, ss(0.0, 1.0, (bz - p.z) / len)), fur: (p) => ss(0.2, 0.0, (bz - p.z) / len) * 0.8 });
      }
    }
  }
  // ---- thorned club in the right hand
  {
    const hp = R.rest.r_hand;
    const tip = new THREE.Vector3(hp.x - 0.04, hp.y - 0.12, hp.z + 1.25);
    const tail = new THREE.Vector3(hp.x + 0.0, hp.y + 0.03, hp.z - 0.16);
    const L = (k) => tail.clone().lerp(tip, k).toArray();
    const woodCol = (p, n) => { const k = Math.sin((p.x * 3 + p.y * 4) * 40 + noise2(p.z * 8, p.y * 8) * 6) * 0.5 + 0.5; return cBark.clone().lerp(cBarkLt, k * 0.55).multiplyScalar(0.85 + noise2(p.z * 30, p.x * 30) * 0.2); };
    R.tube({
      acc: 'hard', up: Y, rings: 30, segs: 14, blend: 0.3, color: woodCol, pts: [
        { p: L(0), b: 'r_hand', r: [0.06, 0.06, 0.06] },
        { p: L(0.18), b: 'r_hand', r: [0.055, 0.055, 0.055] },
        { p: L(0.45), b: 'r_hand', r: [0.09, 0.09, 0.09] },
        { p: L(0.7), b: 'r_hand', r: [0.15, 0.14, 0.15] },
        { p: L(0.88), b: 'r_hand', r: [0.2, 0.19, 0.2] },
        { p: L(1.0), b: 'r_hand', r: [0.13, 0.13, 0.13] },
      ],
    });
    // leather grip wrap
    for (let i = 0; i < 5; i++) R.part(new THREE.TorusGeometry(0.062, 0.013, 6, 14), 'r_hand', new THREE.Matrix4().compose(new THREE.Vector3(...L(0.04 + i * 0.045)), new THREE.Quaternion().setFromUnitVectors(Z, tip.clone().sub(tail).normalize()), new THREE.Vector3(1, 1, 1)), { acc: 'hard', color: cLeatherDk });
    // iron band + spikes
    R.part(new THREE.TorusGeometry(0.155, 0.022, 6, 18), 'r_hand', new THREE.Matrix4().compose(new THREE.Vector3(...L(0.72)), new THREE.Quaternion().setFromUnitVectors(Z, tip.clone().sub(tail).normalize()), new THREE.Vector3(1, 1, 1)), { acc: 'hard', color: cIron });
    const ax = tip.clone().sub(tail).normalize();
    for (let i = 0; i < 14; i++) {
      const k = 0.74 + (i % 4) * 0.07; const a = i * 2.4;
      const c = new THREE.Vector3(...L(k));
      const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0); radial.sub(ax.clone().multiplyScalar(radial.dot(ax))).normalize();
      const rr = 0.13 + (k - 0.7) * 0.5;
      const q = new THREE.Quaternion().setFromUnitVectors(Y, radial);
      R.part(thornGeo(0.14, 0.025, 0.2, 5), 'r_hand', new THREE.Matrix4().compose(c.addScaledVector(radial, rr * 0.8), q, new THREE.Vector3(1, 1, 1)), { acc: 'hard', color: (p) => cThorn.clone().lerp(cThornTip, 0.3), fur: 0.9 });
    }
  }

  const sm = scaleNormalMap();
  const mats = creatureMaterials({ density: 120, comb: [0, -0.6, -0.3], sheen: 0.25, sheenColor: 0x99a080, roughness: 0.68, normalMap: sm.normal, aoMap: sm.ao, normalScale: 1.0, hardRoughness: 0.7 });
  const built = R.build({ skinMat: mats.skin, hardMat: mats.hard, shells: 10 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 2.2, 0.4) });
  const hr = R.rest.head;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), eyeMat);
    e.scale.set(1.2, 0.7, 1);
    e.position.set(s * 0.074 - hr.x, 2.035 - hr.y, 0.612 - hr.z);
    e.rotation.z = -s * 0.3;
    built.bones.head.add(e);
  }
  const halo = makeHalo(new THREE.Color(1.0, 0.6, 0.15));
  halo.position.set(0, 2.04 - hr.y, 0.63 - hr.z); halo.scale.setScalar(0.4);
  built.bones.head.add(halo);
  for (const m of [built.skin, built.fur, built.hard]) if (m) m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.3, 0), 3.4);
  return { ...built, mats, eyeMat, halo, rest: R.rest };
}

let BRUTE_ID = 100;
export class Brute {
  constructor(mgr, x, z, opts = {}) {
    this.mgr = mgr; this.id = BRUTE_ID++; this.type = 'brute';
    this.m = buildBruteModel(); this.root = this.m.group; this.b = this.m.bones;
    this.scale = opts.scale ?? 1.05; this.root.scale.setScalar(this.scale);
    this.root.rotation.order = 'YXZ';
    mgr.ctx.scene.add(this.root);
    this.ground = new THREE.Vector3(x, mgr.heightAt(x, z), z); this.home = this.ground.clone();
    this.position = new THREE.Vector3(); this.radius = 0.85 * this.scale; this.lockHeight = 1.35 * this.scale;
    this.heading = opts.heading ?? Math.random() * 6.28; this.speed = 0; this.knock = new THREE.Vector3();
    this.phase = 0; this.maxHealth = 8; this.health = 8; this.alive = true; this.poise = 0;
    this.state = 'prowl'; this.st = 0; this.cool = 1.5;
    this.w = { windup: 0, smash: 0, stagger: 0, dead: 0, roar: 0, alert: 0 };
    this.flash = 0; this.lastSwing = -1; this.lastDamaged = -99; this.look = new THREE.Vector2(); this.turnRate = 0;
    this.hurt = this.hurt.bind(this); this._tmp = new THREE.Vector3(); this.frozen = false; this.air = 0;
    this.b.head.scale.setScalar(1.28);
    this.update(0);
  }
  get healthFrac() { return this.health / this.maxHealth; }
  setState(s) { this.state = s; this.st = 0; }
  hurt(dmg = 1, dir) {
    if (!this.alive) return false;
    this.health -= dmg; this.lastDamaged = this.mgr.now; this.flash = 1;
    const d = (dir ? dir.clone() : new THREE.Vector3().subVectors(this.ground, this.mgr.heroPos() || this.ground)).setY(0);
    if (d.lengthSq() < 1e-6) d.set(0, 0, -1); d.normalize();
    if (this.health <= 0) { this.alive = false; this.knock.copy(d).multiplyScalar(3); this.setState('dying'); this.mgr.onKilled(this); return true; }
    this.poise += dmg;
    this.knock.copy(d).multiplyScalar(this.state === 'windup' ? 4.5 : 2.2);
    if (this.state === 'windup' || this.poise >= 3) { this.poise = 0; this.setState('stagger'); this.staggerSide = Math.random() < 0.5 ? -1 : 1; }
    this.mgr.emit('enemy-hurt', { enemy: this });
    return true;
  }
  clubTip() { const p = new THREE.Vector3(); const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); p.copy(this.ground).addScaledVector(f, 2.0 * this.scale); p.y = this.mgr.heightAt(p.x, p.z); return p; }

  think(dt) {
    const M = this.mgr, hero = M.heroPos(); this.st += dt;
    const dist = hero ? Math.hypot(hero.x - this.ground.x, hero.z - this.ground.z) : 1e9;
    const alive = hero && M.heroAlive();
    let want = null, spd = 0, face = null;
    this.poise = Math.max(0, this.poise - dt * 0.4);
    switch (this.state) {
      case 'prowl':
        if (!this.wt || this.ground.distanceTo(this.wt) < 1 || this.st > 12) { const a = Math.random() * 6.28; this.wt = new THREE.Vector3(this.home.x + Math.cos(a) * 4, this.ground.y, this.home.z + Math.sin(a) * 4); this.st = 0; }
        want = this.st > 3 ? this.wt : null; spd = 0.9;
        if (alive && dist < 20) { this.setState('roar'); }
        break;
      case 'roar':
        face = hero; if (this.st > 1.3) this.setState('approach');
        break;
      case 'approach':
        face = hero; want = hero; spd = dist > 6 ? 2.0 : 1.4;
        if (!alive || dist > 30) this.setState('prowl');
        this.cool -= dt;
        if (dist < 3.3 && this.cool <= 0) { this.setState('windup'); M.emit('enemy-telegraph', { enemy: this }); }
        break;
      case 'windup':
        face = hero;
        if (this.st > 0.1 && this.st - dt <= 0.1) M.vfx.glint(this.position.clone().setY(this.ground.y + 2.1 * this.scale), new THREE.Color(4, 2.5, 0.6));
        if (this.st > 0.95) { this.setState('smash'); M.emit('enemy-attack', { enemy: this }); }
        break;
      case 'smash':
        if (!this.slammed && this.st > 0.16) {
          this.slammed = true;
          const tip = this.clubTip();
          M.vfx.slam(tip); M.emit('shake', { amount: 0.6, position: tip });
          if (hero) {
            const to = new THREE.Vector3(hero.x - this.ground.x, 0, hero.z - this.ground.z); const dd = to.length(); to.normalize();
            const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
            if ((dd < 3.0 * this.scale && f.dot(to) > 0.35) || hero.distanceTo(tip) < 1.4) M.heroHurt(4, to, this);
          }
        }
        if (this.st > 0.3) { this.slammed = false; this.setState('recover'); }
        break;
      case 'recover':
        if (this.st > 1.0) { this.cool = 1.2 + Math.random(); this.setState('approach'); }
        break;
      case 'stagger':
        if (this.st > 1.15) { this.cool = 0.8; this.setState('approach'); }
        break;
      case 'dying':
        if (this.st > 1.0 && !this.burst) { this.burst = true; M.vfx.deathBurst(this.position.clone(), 1.0); M.dropShards(this.ground, 6 + Math.floor(Math.random() * 3)); M.vfx.dust(this.ground, 1.5, 16); }
        if (this.st > 0.8) this.dissolve = Math.min(1, (this.st - 0.8) / 1.4);
        if (this.st > 0.8 && Math.random() < 0.8) M.vfx.motes(this.position, 0.8, 3);
        if (this.st > 2.3) this.dead = true;
        break;
      case 'roarPose':
        face = hero; break;
    }
    let desired = 0, dh = this.heading;
    if (want) { const d = new THREE.Vector3(want.x - this.ground.x, 0, want.z - this.ground.z); const L = d.length(); if (L > 1.8 || (want !== hero && L > 0.3)) { desired = spd; dh = Math.atan2(d.x, d.z); } }
    if (!want && face) dh = Math.atan2(face.x - this.ground.x, face.z - this.ground.z);
    if (want === hero && face) dh = Math.atan2(face.x - this.ground.x, face.z - this.ground.z);
    if (this.state !== 'smash' && this.state !== 'dying' && this.state !== 'stagger') {
      const turnK = this.state === 'windup' ? 0.9 : 1.6;
      const d = wrapA(dh - this.heading), mt = turnK * dt; const tr = Math.max(-mt, Math.min(mt, d));
      this.heading = wrapA(this.heading + tr); this.turnRate = damp(this.turnRate, tr / Math.max(dt, 1e-4), 5, dt);
    }
    this.speed = damp(this.speed, desired, 3, dt);
    this.lookTarget = face;
  }

  update(dt) {
    const M = this.mgr;
    if (!this.frozen) this.think(dt); else { this.st += dt; this.lookTarget = M.heroPos(); }
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    if (!this.frozen) this.ground.addScaledVector(fwd, this.speed * dt);
    if (this.knock.lengthSq() > 1e-4) { this.ground.addScaledVector(this.knock, dt); this.knock.multiplyScalar(Math.exp(-6 * dt)); }
    M.collide(this, dt);
    this.ground.y = M.heightAt(this.ground.x, this.ground.z);
    const s = this.state, W = this.w;
    const wu = s === 'windup' ? ss(0, 0.75, this.st) : 0;
    W.windup = s === 'roarPose' ? 0.55 : damp(W.windup, wu, 14, dt);
    W.smash = damp(W.smash, s === 'smash' ? 1 : s === 'recover' ? Math.max(0, 1 - this.st * 1.2) : 0, s === 'smash' ? 30 : 6, dt);
    W.stagger = damp(W.stagger, s === 'stagger' ? 1 : 0, 10, dt);
    W.dead = damp(W.dead, s === 'dying' ? 1 : 0, 3.5, dt);
    W.roar = damp(W.roar, s === 'roar' || s === 'roarPose' ? 1 : 0, 6, dt);
    W.alert = damp(W.alert, s === 'prowl' ? 0 : 1, 3, dt);
    this.flash = Math.max(0, this.flash - dt * 6);
    this.pose(dt);
    this.root.position.set(this.ground.x, this.ground.y, this.ground.z);
    this.root.rotation.set(-W.dead * 1.35, this.heading, 0);
    this.position.set(this.ground.x, this.ground.y + this.lockHeight * (1 - W.dead * 0.7), this.ground.z);
    const u = this.m.mats.uniforms; const f = this.flash * this.flash;
    u.uFlash.value.set(f * 2.0, f * 1.8, f * 1.5);
    u.uDissolve.value = this.dissolve || 0;
    const tele = s === 'windup' ? ss(0.1, 0.8, this.st) : s === 'roarPose' ? 0.6 : 0;
    u.uGlow.value = 0.25 + tele * 4.5;
    const eg = (1 - W.dead) * (1 + tele * 1.8 + W.roar * 0.6);
    this.m.eyeMat.color.setRGB(3.5 * eg, 2.0 * eg, 0.4 * eg);
    this.m.halo.material.opacity = 0.3 * eg; this.m.halo.scale.setScalar(0.35 + tele * 0.4);
  }

  pose(dt) {
    const B = this.b, W = this.w, t = this.mgr.now;
    for (const k in B) if (k !== 'root') B[k].rotation.set(0, 0, 0);
    B.pelvis.position.set(0, 1.0, 0);
    const v = this.speed; const mk = Math.min(1, v / 0.5);
    this.phase += v / 1.5 * dt;
    const ph = this.phase * Math.PI * 2;
    // heavy lumbering walk
    for (const [k, o] of [['l', 0], ['r', Math.PI]]) {
      const sw = Math.sin(ph + o), lift = Math.max(0, Math.cos(ph + o));
      B[k + '_hip'].rotation.x = -sw * 0.45 * mk - 0.12;
      B[k + '_kn'].rotation.x = (lift * 0.75 + 0.18) * mk + 0.18 * (1 - mk);
      B[k + '_an'].rotation.x = -lift * 0.3 * mk - 0.06;
      B[k + '_hip'].rotation.z = (k === 'l' ? -0.06 : 0.06);
      // footfall dust
      const prev = this.lastFoot?.[k] ?? 0; const cur = Math.sin(ph + o + Math.PI / 2);
      if (mk > 0.5 && prev > 0 && cur <= 0) {
        const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); const side = new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(k === 'l' ? 0.25 : -0.25);
        const fp = this.ground.clone().add(side).addScaledVector(f, 0.2); this.mgr.vfx.dust(fp, 0.45, 4); this.mgr.emit('footstep', { position: fp, heavy: true, enemy: this });
      }
      (this.lastFoot ||= {})[k] = cur;
    }
    B.pelvis.position.y += -Math.abs(Math.cos(ph)) * 0.05 * mk - 0.04;
    B.pelvis.rotation.y = Math.sin(ph) * 0.12 * mk;
    B.pelvis.rotation.z = Math.sin(ph) * 0.05 * mk;
    B.spine.rotation.y = -Math.sin(ph) * 0.1 * mk;
    B.spine.rotation.x = 0.12 + 0.06 * mk;
    B.chest.rotation.x = 0.06 + Math.sin(t * 1.6) * 0.02;
    B.chest.rotation.z = -Math.sin(ph) * 0.05 * mk;
    // arms: hang heavy, swing opposite
    B.l_sh.rotation.x = Math.sin(ph) * 0.35 * mk - 0.1; B.l_sh.rotation.z = 0.12;
    B.r_sh.rotation.x = -Math.sin(ph) * 0.25 * mk - 0.35; B.r_sh.rotation.z = -0.1;
    B.l_el.rotation.x = -0.35; B.r_el.rotation.x = -0.25;
    B.r_wr.rotation.x = 0.35; // club tip angled down
    // breathing
    const br = Math.sin(t * 1.8 + this.id);
    B.chest.position.y = 0.32 + br * 0.008;
    // head look
    let ly = 0, lp = 0;
    if (this.lookTarget && this.alive) { const d = new THREE.Vector3().subVectors(this.lookTarget, this.ground); ly = Math.max(-1, Math.min(1, wrapA(Math.atan2(d.x, d.z) - this.heading))); lp = Math.max(-0.3, Math.min(0.3, Math.atan2(d.y - 0.5, Math.hypot(d.x, d.z)))); }
    this.look.x = damp(this.look.x, ly, 5, dt); this.look.y = damp(this.look.y, lp, 5, dt);
    B.neck.rotation.y = this.look.x * 0.4; B.head.rotation.y = this.look.x * 0.5;
    B.neck.rotation.x = -this.look.y * 0.5 - 0.1; B.head.rotation.x = -this.look.y * 0.4;
    B.jaw.rotation.x = 0.06 + Math.max(0, br) * 0.04;
    B.l_ear.rotation.z = Math.sin(t * 1.3) * 0.05; B.r_ear.rotation.z = -Math.sin(t * 1.3 + 1) * 0.05;
    // roar: chest out, head up, jaw wide, arms flared
    const ro = W.roar;
    if (ro > 0.01) {
      const tr = Math.sin(t * 30) * 0.03 * ro;
      B.spine.rotation.x -= 0.12 * ro; B.chest.rotation.x -= 0.1 * ro; B.neck.rotation.x += 0.12 * ro - tr; B.head.rotation.x -= 0.08 * ro;
      B.jaw.rotation.x += 0.5 * ro; B.l_sh.rotation.z += 0.5 * ro; B.r_sh.rotation.z -= 0.35 * ro; B.l_el.rotation.x -= 0.6 * ro;
      B.l_ear.rotation.x -= 0.4 * ro; B.r_ear.rotation.x -= 0.4 * ro;
    }
    // windup: club raised overhead, torso coiled back
    const wu = W.windup;
    if (wu > 0.01) {
      B.spine.rotation.x -= 0.38 * wu; B.spine.rotation.y -= 0.25 * wu; B.chest.rotation.x -= 0.12 * wu;
      B.r_sh.rotation.x += -2.55 * wu; B.r_sh.rotation.z += -0.25 * wu; B.r_el.rotation.x += -0.9 * wu; B.r_wr.rotation.x += 0.5 * wu;
      B.l_sh.rotation.x += -0.9 * wu; B.l_sh.rotation.z += 0.45 * wu; B.l_el.rotation.x += -0.8 * wu;
      B.head.rotation.x += 0.1 * wu; B.jaw.rotation.x += 0.3 * wu;
      for (const k of ['l', 'r']) { B[k + '_hip'].rotation.x -= 0.2 * wu; B[k + '_kn'].rotation.x += 0.35 * wu; }
      B.pelvis.position.y -= 0.08 * wu;
      // trembling with effort
      B.r_sh.rotation.z += Math.sin(t * 40) * 0.015 * wu;
    }
    // smash: torso slams forward, club down to the ground
    const sm = W.smash;
    if (sm > 0.01) {
      B.spine.rotation.x += 0.42 * sm; B.chest.rotation.x += 0.2 * sm; B.spine.rotation.y += 0.15 * sm;
      B.r_sh.rotation.x += -1.15 * sm; B.r_el.rotation.x += 0.0; B.r_wr.rotation.x += 0.45 * sm;
      B.l_sh.rotation.x += -0.5 * sm; B.l_sh.rotation.z += 0.3 * sm;
      for (const k of ['l', 'r']) { B[k + '_hip'].rotation.x -= 0.4 * sm; B[k + '_kn'].rotation.x += 0.55 * sm; B[k + '_an'].rotation.x -= 0.15 * sm; }
      B.pelvis.position.y -= 0.16 * sm; B.jaw.rotation.x += 0.4 * sm;
    }
    // stagger: reel back, arms flung
    const sg = W.stagger;
    if (sg > 0.01) {
      const wob = Math.sin(this.st * 9) * 0.1;
      B.spine.rotation.x -= (0.35 + wob) * sg; B.spine.rotation.z += 0.2 * sg * (this.staggerSide || 1); B.head.rotation.x -= 0.3 * sg; B.jaw.rotation.x += 0.4 * sg;
      B.l_sh.rotation.z += 0.7 * sg; B.r_sh.rotation.z -= 0.6 * sg; B.r_sh.rotation.x += 0.3 * sg;
      for (const k of ['l', 'r']) B[k + '_kn'].rotation.x += 0.35 * sg;
      B.pelvis.position.y -= 0.1 * sg;
      B.head.rotation.z = Math.sin(this.st * 14) * 0.15 * sg; // dazed
    }
    const dd = W.dead;
    if (dd > 0.01) { B.l_sh.rotation.z += 1.0 * dd; B.r_sh.rotation.z -= 1.0 * dd; B.head.rotation.x -= 0.4 * dd; B.jaw.rotation.x += 0.4 * dd; B.pelvis.position.y -= 0.6 * dd; }
  }
  dispose() { this.root.parent?.remove(this.root); this.root.traverse(o => o.geometry?.dispose()); this.m.mats.skin.dispose(); this.m.mats.hard.dispose(); }
}
