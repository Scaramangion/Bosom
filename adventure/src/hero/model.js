// Procedural Koto: sculpted head (elf ears, painted face, spiky navy hair), layered
// outfit (navy tunic, cross strap, belt + pouches + brass buckle, red scarf, leather
// pauldron, linen forearm wraps, leather bracers, trousers, cuffed boots), all
// smooth-skinned to the rig in rig.js and merged per material into SkinnedMeshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paramSurface, skinBySegments, skinRigid, smooth, lerp, curve, tubeAlong } from './geom.js';
import { segs } from './rig.js';

const TAU = Math.PI * 2;
const G = (x, y) => Math.exp(-(x * x + y * y));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sgnPow = (x, p) => Math.sign(x) * Math.pow(Math.abs(x), p);

// ---------------- head ----------------
export const HEAD_C = new THREE.Vector3(0, 1.588, 0.012);
const HR = { x: 0.09, y: 0.115, z: 0.1 };
// u in 0..1 around (0.5 = facing +Z), v 0..1 top->bottom. off = extra outward offset.
export function headPoint(u, v, out, off = 0, features = true) {
  const a = (u - 0.5) * TAU, th = v * Math.PI;
  const st = Math.sin(th), ny = Math.cos(th);
  let x = HR.x * st * Math.sin(a), y = HR.y * ny, z = HR.z * st * Math.cos(a);
  const front = Math.max(0, Math.cos(a));
  // jaw taper
  if (ny < 0.12) {
    const k = smooth((0.12 - ny) / 1.12);
    x *= 1 - 0.30 * k;
    z *= z < 0 ? 1 - 0.5 * k : 1 - 0.06 * k;
  }
  // cranium: fuller at back/top
  if (z < 0) z *= 1 + 0.10 * smooth((ny + 0.3) / 0.8);
  if (ny > 0.3) { x *= 1 + 0.04 * (ny - 0.3); }
  // flatter face plane
  z -= 0.010 * Math.pow(front, 6) * smooth(1 - Math.abs(ny + 0.15) / 0.6);
  // chin point
  z += 0.004 * G((ny + 0.86) / 0.12, 0) * Math.pow(front, 8);
  y -= 0.006 * G((ny + 0.9) / 0.1, 0) * Math.pow(front, 4);
  let d = off;
  if (features) {
    const aa = Math.abs(a);
    d += 0.015 * G(a / 0.075, (v - 0.70) / 0.035);   // nose
    d += 0.004 * G(a / 0.05, (v - 0.64) / 0.05);                          // nose bridge
    d -= 0.008 * G((aa - 0.33) / 0.12, (v - 0.565) / 0.045);              // eye sockets
    d += 0.0045 * G((aa - 0.30) / 0.2, (v - 0.505) / 0.025);              // brow ridge
    d += 0.006 * G((aa - 0.55) / 0.18, (v - 0.65) / 0.06);                // cheekbones
    d += 0.0035 * G(a / 0.18, (v - 0.78) / 0.025);                        // lips
    d -= 0.002 * G(a / 0.2, (v - 0.775) / 0.006);                         // mouth line
  }
  const l = Math.hypot(x / HR.x, y / HR.y, z / HR.z) || 1;
  const nx = x / (HR.x * HR.x), nyy = y / (HR.y * HR.y), nz = z / (HR.z * HR.z), nl = Math.hypot(nx, nyy, nz) || 1;
  out.set(HEAD_C.x + x + nx / nl * d, HEAD_C.y + y + nyy / nl * d, HEAD_C.z + z + nz / nl * d);
  return out;
}

function headGeo() { return paramSurface(72, 56, (u, v, o) => headPoint(u, v, o)); }

function eyeGeo(side) {
  // eyeball with u=0.5 front; returns geometry already placed
  const u0 = 0.5 + side * 0.33 / TAU, v0 = 0.562;
  const c = headPoint(u0, v0, new THREE.Vector3(), 0, false);
  const R = 0.0165;
  c.z -= 0.0105; c.x -= side * 0.002;
  const yaw = side * 0.16;
  const g = paramSurface(24, 16, (u, v, o) => {
    const a = (u - 0.5) * TAU, th = v * Math.PI;
    o.set(R * 1.12 * Math.sin(th) * Math.sin(a), R * 1.2 * Math.cos(th), R * 0.75 * Math.sin(th) * Math.cos(a));
  }, { uvFn: (u, v) => [u, v] });
  g.rotateY(yaw); g.translate(c.x, c.y, c.z);
  // upper eyelid (skin) + lash line
  const lid = paramSurface(20, 8, (u, v, o) => {
    const a = (u - 0.5) * Math.PI * 1.25, th = v * Math.PI * 0.40 - 0.02;
    const r = R * 1.16;
    o.set(r * 1.12 * Math.sin(th) * Math.sin(a), r * 1.2 * Math.cos(th) + 0.0015, r * 0.78 * Math.sin(th) * Math.cos(a));
  });
  lid.rotateY(yaw); lid.translate(c.x, c.y, c.z);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, a = (t - 0.5) * Math.PI * 1.15, th = Math.PI * 0.40;
    const r = R * 1.2;
    const p = new THREE.Vector3(r * 1.12 * Math.sin(th) * Math.sin(a) * (1 + 0.1 * t * side), r * 1.2 * Math.cos(th) + 0.001 + 0.0012 * Math.sin(t * Math.PI), r * 0.8 * Math.sin(th) * Math.cos(a));
    p.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(c);
    pts.push(p);
  }
  // outer flick
  const last = pts[side > 0 ? pts.length - 1 : 0];
  const lash = tubeAlong(pts, (v) => { const k = side > 0 ? v : 1 - v; return [0.0011 + 0.0016 * k, 0.0011 + 0.0016 * k]; }, { radial: 6, segs: 16 });
  void last;
  return { ball: g, lid, lash };
}

function earGeo(side) {
  const root = headPoint(0.5 + side * 0.25, 0.565, new THREE.Vector3(), 0, false);
  root.x -= side * 0.012; root.z -= 0.004;
  const D = new THREE.Vector3(side * 0.86, 0.42, -0.42).normalize();
  const E0 = new THREE.Vector3(0, 1, 0.25);
  const E = E0.sub(D.clone().multiplyScalar(D.dot(E0))).normalize();
  const N = new THREE.Vector3().crossVectors(D, E).normalize();
  const L = 0.095;
  const g = paramSurface(14, 18, (u, v, o) => {
    const s = v, th = u * TAU;
    const w = 0.03 * (s < 0.28 ? 0.55 + 0.45 * Math.sqrt(s / 0.28) : 1 - Math.pow((s - 0.28) / 0.72, 1.25));
    const t = 0.006 * (1 - s) + 0.0015;
    const cu = Math.cos(th), si = Math.sin(th);
    const cup = -0.007 * (1 - cu * cu) * (1 - s * 0.7) * side;
    o.copy(root).addScaledVector(D, s * L)
      .addScaledVector(E, w * cu + 0.012 * s * s - 0.004 * s)
      .addScaledVector(N, t * si * side + cup);
  });
  return g;
}

function hairGeo() {
  const R = rng(7);
  const parts = [];
  const vmaxOf = (u) => { const a = (u - 0.5) * TAU, back = (1 - Math.cos(a)) / 2; return lerp(0.46, 0.86, Math.pow(back, 1.2)); };
  // cap: offset head surface, hairline lower at the back
  const cap = paramSurface(64, 40, (u, v, o) => {
    const a = (u - 0.5) * TAU, back = (1 - Math.cos(a)) / 2;
    const vmax = vmaxOf(u) - 0.03 + 0.03 * Math.sin(a * 9) * back;
    headPoint(u, v * vmax, o, 0.007 + 0.006 * (1 - v), false);
  }, { uvFn: (u, v) => [u * 6, v * 0.3] });
  parts.push(cap);
  const P = new THREE.Vector3(), Nn = new THREE.Vector3(), T = new THREE.Vector3(), Sd = new THREE.Vector3();
  // clump that follows the scalp from (u,v) by (du,dv) in head-param space, lifting off by `lift` at the tip
  const addClump = (u, v, du, dv, width, lift, twist = 0, tipOut = 0) => {
    const pts = [];
    const K = 6;
    for (let k = 0; k <= K; k++) {
      const s = k / K;
      const uu = u + du * s, vv = Math.min(0.97, v + dv * s);
      headPoint(((uu % 1) + 1) % 1, vv, P, 0.008 + 0.022 * Math.sin(Math.PI * Math.min(1, s * 1.3)) + lift * 1.4 * s * s, false);
      pts.push(P.clone());
    }
    // tip extension
    const last = pts[K], prev = pts[K - 1];
    const ext = last.clone().sub(prev).normalize();
    Nn.copy(last).sub(HEAD_C).normalize();
    pts.push(last.clone().addScaledVector(ext, 0.02 + tipOut * 0.5).addScaledVector(Nn, tipOut));
    const crv = new THREE.CatmullRomCurve3(pts);
    const NS = 12;
    const g = paramSurface(6, NS, (uu, vv, o) => {
      crv.getPoint(vv, o);
      crv.getTangent(vv, T);
      Nn.copy(o).sub(HEAD_C).normalize();
      Sd.crossVectors(T, Nn).normalize();
      const nn = new THREE.Vector3().crossVectors(Sd, T).normalize();
      const th = uu * TAU + twist * vv;
      const w = width * Math.pow(1 - vv, 0.75) * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.15 + vv * 2)));
      o.addScaledVector(Sd, Math.cos(th) * w).addScaledVector(nn, Math.sin(th) * w * 0.32);
    }, { uvFn: (uu, vv) => [uu * 0.3 + R(), vv] });
    parts.push(g);
  };
  // main mass: everything flows away from the crown pole (v = 0)
  for (let i = 0; i < 95; i++) {
    const u = R(), a = (u - 0.5) * TAU, back = (1 - Math.cos(a)) / 2;
    const vmax = vmaxOf(u);
    const v = R() * (vmax - 0.12);
    const reach = Math.min(vmax + 0.02 + R() * 0.05 * back, v + 0.22 + R() * 0.2);
    const dv = Math.max(0.06, reach - v);
    const sweep = (back < 0.35 ? -0.05 : 0) + (R() - 0.5) * 0.05;
    const lift = (0.01 + R() * 0.03) * (0.4 + back) + (v > vmax - 0.2 ? 0.015 : 0);
    addClump(u, v, sweep, dv, 0.034 + R() * 0.02, lift, (R() - 0.5) * 1.2, (R() * 0.025) * (0.3 + back));
  }
  // fringe: chunky locks over the brow, swept to the character's right
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const u = 0.5 + (t - 0.5) * 0.24;
    addClump(u, 0.12 + R() * 0.08, -0.045 - 0.02 * t, 0.36 - Math.abs(t - 0.45) * 0.12 + R() * 0.04, 0.03 + R() * 0.008, 0.012, (R() - 0.5), 0.004);
  }
  // side locks in front of the ears
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
    const u = 0.5 + sd * (0.15 + i * 0.03);
    addClump(u, 0.3 + R() * 0.06, sd * 0.01, 0.34 + R() * 0.05, 0.022, 0.006, (R() - 0.5), 0.0);
  }
  // nape spikes + crown cowlick (the messy silhouette from the concept art)
  for (let i = 0; i < 9; i++) {
    const u = (R() - 0.5) * 0.4 + 1.0, v = 0.6 + R() * 0.12;
    addClump(u % 1, v, (R() - 0.5) * 0.06, 0.18 + R() * 0.06, 0.024, 0.05, R(), 0.03);
  }
  for (let i = 0; i < 4; i++) addClump(0.0 + (R() - 0.5) * 0.1, 0.02, (R() - 0.5) * 0.1, 0.12, 0.018, 0.06, R(), 0.035);
  return mergeGeometries(parts);
}

// ---------------- torso ----------------
const torsoProf = curve([
  // y, W, D, z0
  [0.62, 0.218, 0.158, -0.004],
  [0.70, 0.205, 0.145, -0.004],
  [0.80, 0.182, 0.125, -0.002],
  [0.90, 0.162, 0.108, 0],
  [0.955, 0.150, 0.100, 0],
  [1.02, 0.138, 0.094, 0.002],
  [1.12, 0.148, 0.100, 0.008],
  [1.22, 0.160, 0.108, 0.012],
  [1.30, 0.172, 0.104, 0.006],
  [1.36, 0.170, 0.092, -0.004],
  [1.40, 0.130, 0.078, -0.006],
  [1.43, 0.075, 0.060, -0.004],
  [1.46, 0.055, 0.052, -0.004],
]);
export function torsoPoint(a, y, out, off = 0) {
  const [W, D, z0] = torsoProf(y);
  const n = y > 1.33 ? 3.2 : 2.6;
  const s = Math.sin(a), c = Math.cos(a);
  let x = (W + off) * sgnPow(s, 2 / n), z = z0 + (D + off) * sgnPow(c, 2 / n);
  // pecs / shoulder blades
  if (y > 1.1 && y < 1.34) {
    const k = Math.sin((y - 1.1) / 0.24 * Math.PI);
    z += c > 0 ? 0.008 * k * Math.pow(Math.abs(s), 0.5) * c : -0.006 * k * Math.abs(s);
  }
  return out.set(x, y, z);
}
const hemY = a => 0.635 + 0.07 * Math.pow(Math.abs(Math.sin(a)), 12) + 0.006 * Math.sin(a * 7);

function tunicGeo() {
  return paramSurface(64, 46, (u, v, o) => {
    const a = (u - 0.5) * TAU + Math.PI; // seam at back
    const y = lerp(1.46, hemY(a), v);
    torsoPoint(a, y, o);
    // hem flare ripples
    const k = smooth((0.85 - y) / 0.2);
    const r = 0.010 * k * Math.sin(a * 6 + 0.7);
    o.x += Math.sin(a) * r; o.z += Math.cos(a) * r;
  }, { uS: 3, vS: 2.4 });
}

// band on torso surface between yLo..yHi (or following a plane)
function bandGeo(yFn, half, off, nu = 64) {
  return paramSurface(nu, 4, (u, v, o) => {
    const a = u * TAU;
    const y0 = yFn(a);
    const t = v; // 0..1 across band: rounded section
    const y = y0 + (t - 0.5) * 2 * half;
    const bulge = off + 0.006 * Math.sin(t * Math.PI);
    torsoPoint(a, y, o, bulge);
  }, { uS: 6, vS: 0.3 });
}

function crossStrapY(a) {
  // diagonal strap: from left shoulder (front & back) to right hip; solve y = y0 + k*x
  let y = 1.15;
  for (let i = 0; i < 6; i++) { const [W] = torsoProf(y); const x = W * sgnPow(Math.sin(a), 2 / 2.6); y = 1.13 + 1.15 * x; }
  return y;
}

// ---------------- limbs ----------------
function limbTube(points, radii, opts = {}) {
  const r = curve(radii);
  return tubeAlong(points.map(p => new THREE.Vector3(...p)), (v, th) => {
    const [rx, ry] = r(v); return [rx, ry ?? rx];
  }, { radial: opts.radial || 18, segs: opts.segs || 22, uS: opts.uS || 1, vS: opts.vS || 3, shape: opts.shape, caps: opts.caps });
}

function bootFoot(side) {
  const cx = side * 0.106;
  const prof = curve([[0, 0.04, 0.08], [0.15, 0.05, 0.115], [0.35, 0.053, 0.125], [0.55, 0.056, 0.09], [0.72, 0.054, 0.07], [0.88, 0.044, 0.06], [1, 0.024, 0.045]]);
  const z0 = -0.078, z1 = 0.17;
  return paramSurface(22, 26, (u, v, o) => {
    const s = v, th = u * TAU;
    let [w, h] = prof(s);
    const e = Math.pow(1 - Math.pow(Math.abs(2 * s - 1), 6), 0.5);
    w *= e; const hh = h * Math.max(e, 0.35);
    const c = Math.cos(th), si = Math.sin(th);
    const y = si >= 0 ? 0.012 + (hh - 0.012) * Math.pow(si, 0.75) : 0.012 + 0.012 * si * e;
    o.set(cx + w * sgnPow(c, 0.7) * (1 + 0.04 * side * (s - 0.5)), y, lerp(z0, z1, s) + (si < 0 ? 0 : -0.006 * si * (1 - s)));
  }, { uS: 2, vS: 1 });
}
function soleGeo(side) {
  const cx = side * 0.106, z0 = -0.082, z1 = 0.176;
  const prof = curve([[0, 0.042], [0.2, 0.052], [0.5, 0.057], [0.7, 0.058], [0.88, 0.048], [1, 0.026]]);
  return paramSurface(24, 20, (u, v, o) => {
    const s = v, th = u * TAU;
    const e = Math.pow(1 - Math.pow(Math.abs(2 * s - 1), 6), 0.5);
    const [w] = prof(s);
    const c = Math.cos(th), si = Math.sin(th);
    o.set(cx + (w + 0.004) * e * sgnPow(c, 0.5), 0.0 + 0.012 * (si * 0.5 + 0.5) + (s > 0.85 ? (s - 0.85) * 0.12 : 0), lerp(z0, z1, s));
  });
}

function fistGeo(side, info) {
  const H = info[`hand_${side > 0 ? 'L' : 'R'}`].head;
  const c = new THREE.Vector3(H.x + side * 0.004, H.y - 0.048, H.z + 0.012);
  const parts = [];
  parts.push(paramSurface(20, 14, (u, v, o) => {
    const a = u * TAU, th = v * Math.PI;
    const sx = sgnPow(Math.sin(th) * Math.cos(a), 0.6), sy = sgnPow(Math.cos(th), 0.6), sz = sgnPow(Math.sin(th) * Math.sin(a), 0.6);
    o.set(c.x + sx * 0.031, c.y + sy * 0.046 * (sy < 0 ? 1 : 0.85), c.z + sz * 0.041);
  }));
  // finger rolls on the grip side (curled fingers wrap toward -X for L... palm faces inward)
  for (let i = 0; i < 4; i++) {
    const z = c.z + 0.03 - i * 0.02;
    const g = new THREE.CapsuleGeometry(0.0115, 0.04, 4, 8);
    g.rotateZ(Math.PI / 2);
    g.translate(c.x - side * 0.006, c.y - 0.04, z);
    parts.push(g);
  }
  // thumb wrapping over the front
  const t = new THREE.CapsuleGeometry(0.0115, 0.035, 4, 8);
  t.rotateX(0.5); t.rotateZ(side * 0.9);
  t.translate(c.x - side * 0.018, c.y - 0.022, c.z + 0.04);
  parts.push(t);
  return mergeGeometries(parts.map(g => { const n = g.index ? g : g; if (g.attributes.uv === undefined) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return n; }));
}

function pauldronGeo(info) {
  const C = info.upperArm_L.head.clone().add(new THREE.Vector3(-0.005, 0.02, 0));
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const r = 0.088 - k * 0.006, dy = -k * 0.038, dx = k * 0.012;
    parts.push(paramSurface(20, 8, (u, v, o) => {
      const a = (u - 0.5) * Math.PI * 1.45; // around front/back
      const th = 0.15 + v * (0.85 - k * 0.12); // from top outward-down
      o.set(C.x + dx + r * Math.sin(th) * 1.0 + 0.004, C.y + dy + r * Math.cos(th) * 0.8, C.z + r * 0.95 * Math.sin(th) * Math.sin(a) * 0.95);
      // curve the plate over the shoulder: x from cos(a)
      o.x = C.x + dx + r * Math.sin(th) * Math.cos(a) * 0.75 + 0.02;
      o.z = C.z + r * Math.sin(th) * Math.sin(a);
      o.y = C.y + dy + r * Math.cos(th) * 0.55 - 0.012 * Math.sin(th);
    }, { uS: 1, vS: 0.5 }));
  }
  return mergeGeometries(parts);
}

function buckleGeo() {
  const s = new THREE.Shape();
  const w = 0.03, h = 0.026, r = 0.008;
  s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r); s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const hole = new THREE.Path(); const iw = 0.019, ih = 0.015;
  hole.moveTo(-iw, -ih); hole.lineTo(-iw, ih); hole.lineTo(iw, ih); hole.lineTo(iw, -ih); hole.lineTo(-iw, -ih);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 });
  const [W, D, z0] = torsoProf(0.955);
  g.translate(0.0, 0.955, z0 + D + 0.016);
  // prong
  const p = new THREE.BoxGeometry(0.006, 0.034, 0.006); p.translate(0.004, 0.955, z0 + D + 0.026);
  g.deleteAttribute('normal'); g.computeVertexNormals();
  const gg = mergeGeometries([g.toNonIndexed(), p.toNonIndexed()]);
  void W;
  return gg;
}

function pouchGeo(a, y, w, h, d) {
  const P = torsoPoint(a, y, new THREE.Vector3(), 0.03);
  const g = paramSurface(16, 12, (u, v, o) => {
    const t = u * TAU, ph = v * Math.PI;
    const sx = sgnPow(Math.sin(ph) * Math.cos(t), 0.35), sy = sgnPow(Math.cos(ph), 0.35), sz = sgnPow(Math.sin(ph) * Math.sin(t), 0.45);
    o.set(sx * w, sy * h * (sy < 0 ? 1.05 : 1) - (sy < 0 ? 0.004 * (1 - Math.abs(sx)) : 0), sz * d);
  }, { uS: 1, vS: 1 });
  // flap
  const flap = paramSurface(10, 6, (u, v, o) => {
    const x = (u - 0.5) * 2 * w * 1.05, yy = h * 1.02 - v * h * 1.1;
    const curveZ = d * 1.02 * Math.cos(v * 0.4) + 0.002;
    o.set(x, yy + 0.01 * Math.cos(v * Math.PI * 0.5) - 0.01, curveZ * (1 - 0.15 * (x / w) ** 4));
  }, { uS: 0.3, vS: 0.3 });
  const m = mergeGeometries([g, flap]);
  m.rotateY(a); m.translate(P.x, P.y, P.z);
  return m;
}

// ---------------- assemble ----------------
export function buildBody(rig, M) {
  const { info, skeleton } = rig;
  const byMat = new Map();
  const add = (mat, g) => { if (!byMat.has(mat)) byMat.set(mat, []); byMat.get(mat).push(g); };
  const S = l => segs(info, l);
  const legFade = p => smooth((0.93 - p.y) / 0.16) * 0.9 + 0.02;
  const armFade = p => 0.15 + 0.85 * smooth((Math.abs(p.x) - 0.12) / 0.06);

  // head & face
  const head = skinBySegments(headGeo(), S(['head', ['neck', 0.02]]), { power: 6 });
  add(M.skinFace, head);
  for (const s of [1, -1]) {
    const e = eyeGeo(s);
    add(M.eye, skinRigid(e.ball, info.head.index));
    add(M.skinFace, skinRigid(e.lid, info.head.index));
    add(M.lash, skinRigid(e.lash, info.head.index));
    add(M.skin, skinRigid(earGeo(s), info.head.index));
  }
  add(M.hair, skinRigid(hairGeo(), info.head.index));
  // neck
  add(M.skin, skinBySegments(limbTube([[0, 1.36, -0.008], [0, 1.45, -0.004], [0, 1.53, 0.0]], [[0, 0.052], [0.5, 0.046], [1, 0.044]], { radial: 16, segs: 8 }), S(['chest', 'neck', 'head']), { power: 4 }));

  // tunic + cross strap + belt
  add(M.tunic, skinBySegments(tunicGeo(), S(['hips', 'spine', 'chest', ['neck', 0.4], ['clavicle_L', armFade], ['clavicle_R', armFade], ['upperLeg_L', legFade], ['upperLeg_R', legFade]]), { power: 4 }));
  add(M.leather, skinBySegments(bandGeo(crossStrapY, 0.022, 0.006, 80), S(['hips', 'spine', 'chest', ['clavicle_L', armFade], ['clavicle_R', armFade]]), { power: 4 }));
  add(M.scarf, skinBySegments(bandGeo(() => 0.975, 0.045, 0.004), S(['hips', ['spine', 0.7]]), { power: 4 }));
  add(M.leather, skinBySegments(bandGeo(() => 0.95, 0.024, 0.012), S(['hips', ['spine', 0.5]]), { power: 4 }));
  add(M.trousers, skinBySegments(bandGeo(a => hemY(a) + 0.018, 0.018, 0.003), S(['hips', ['upperLeg_L', legFade], ['upperLeg_R', legFade]]), { power: 4 }));
  add(M.brass, skinRigid(buckleGeo(), info.hips.index));
  // pouches at the hips
  add(M.leatherDark, skinBySegments(pouchGeo(1.25, 0.91, 0.04, 0.045, 0.022), S(['hips', ['upperLeg_L', 0.3]]), { power: 3 }));
  add(M.leatherDark, skinBySegments(pouchGeo(-1.05, 0.91, 0.035, 0.04, 0.02), S(['hips', ['upperLeg_R', 0.3]]), { power: 3 }));
  add(M.leatherDark, skinBySegments(pouchGeo(-2.3, 0.92, 0.03, 0.035, 0.018), S(['hips']), { power: 3 }));
  // scarf: two thick rolls around the neck
  for (const [y, R, r, ph] of [[1.405, 0.098, 0.038, 0], [1.455, 0.075, 0.03, 1.3]]) {
    const g = paramSurface(40, 12, (u, v, o) => {
      const a = u * TAU, b = v * TAU;
      const fold = 1 + 0.12 * Math.sin(a * 5 + ph) + 0.06 * Math.sin(a * 11 + ph * 2);
      const rr = r * fold;
      const RR = R + rr * Math.cos(b);
      o.set(Math.sin(a) * RR * 1.08, y + rr * 1.15 * Math.sin(b), Math.cos(a) * RR * 0.95 - 0.006);
    }, { uS: 3, vS: 0.75 });
    add(M.scarf, skinBySegments(g, S(['chest', ['neck', 0.6]]), { power: 3 }));
  }
  // pauldron on the left (shield-side) shoulder
  add(M.leather, skinBySegments(pauldronGeo(info), S(['clavicle_L', 'upperArm_L']), { power: 4 }));

  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const ua = info['upperArm_' + L], la = info['lowerArm_' + L], hd = info['hand_' + L];
    // sleeve
    const sh = [s * 0.12, 1.405, -0.012], el = [ua.tail.x - s * 0.002, 1.135, ua.tail.z];
    const mid = [(sh[0] + el[0]) / 2 + s * 0.02, (sh[1] + el[1]) / 2, -0.012];
    add(M.tunic, skinBySegments(limbTube([sh, mid, el], [[0, 0.07, 0.065], [0.25, 0.068], [0.8, 0.056], [1, 0.06]], { radial: 18, segs: 14, uS: 1, vS: 3 }),
      S(['chest', 'clavicle_' + L, 'upperArm_' + L]), { power: 4 }));
    // upper arm skin under sleeve (for elbow gap)
    add(M.linen, skinBySegments(limbTube([[ua.tail.x * 0.9 + ua.head.x * 0.1, 1.17, -0.018], [la.head.x, la.head.y, la.head.z], [la.head.x * 0.5 + hd.head.x * 0.5, (la.head.y + hd.head.y) / 2, -0.012], [hd.head.x, hd.head.y + 0.02, hd.head.z]],
      [[0, 0.047], [0.25, 0.046], [0.55, 0.042], [1, 0.033]], { radial: 16, segs: 20, vS: 3 }),
      S(['upperArm_' + L, 'lowerArm_' + L, ['hand_' + L, 0.3]]), { power: 5 }));
    // bracer
    add(M.leather, skinBySegments(limbTube([[lerp(la.head.x, hd.head.x, 0.55), lerp(la.head.y, hd.head.y, 0.55), -0.01], [hd.head.x, hd.head.y + 0.012, hd.head.z]],
      [[0, 0.046, 0.044], [0.15, 0.043], [0.85, 0.04], [1, 0.042]], { radial: 16, segs: 6, vS: 1 }),
      S(['lowerArm_' + L]), { power: 4 }));
    // fist
    add(M.skin, skinRigid(fistGeo(s, info), hd.index));

    // trousers
    const ul = info['upperLeg_' + L], ll = info['lowerLeg_' + L];
    add(M.trousers, skinBySegments(limbTube([[ul.head.x * 0.9, 0.96, 0], [lerp(ul.head.x, ll.head.x, 0.5) + s * 0.006, 0.72, 0.006], [ll.head.x, ll.head.y, ll.head.z + 0.004], [ll.tail.x, 0.3, 0], [ll.tail.x, 0.14, -0.01]],
      [[0, 0.1, 0.095], [0.2, 0.092], [0.46, 0.068], [0.55, 0.066], [0.7, 0.066], [1, 0.056]], { radial: 18, segs: 28, vS: 3 }),
      S([['hips', p => 0.05 + 0.8 * smooth((p.y - 0.88) / 0.1)], 'upperLeg_' + L, 'lowerLeg_' + L]), { power: 4 }));
    // boot shaft + cuff
    add(M.leather, skinBySegments(limbTube([[ll.tail.x * 0.98, 0.39, 0.0], [ll.tail.x, 0.26, -0.004], [ll.tail.x, 0.08, -0.012]],
      [[0, 0.076], [0.12, 0.076], [0.16, 0.07], [0.45, 0.066], [0.8, 0.06], [1, 0.061]], { radial: 18, segs: 16, vS: 2 }),
      S(['lowerLeg_' + L, ['foot_' + L, 0.4]]), { power: 5 }));
    // cuff fold (darker turned-down leather)
    add(M.leatherDark, skinBySegments(limbTube([[ll.tail.x * 0.98, 0.405, 0.0], [ll.tail.x * 0.99, 0.34, -0.002]],
      [[0, 0.072], [0.3, 0.081], [1, 0.083]], { radial: 18, segs: 4, vS: 1 }), S(['lowerLeg_' + L]), { power: 4 }));
    add(M.leather, skinBySegments(bootFoot(s), S(['foot_' + L, ['lowerLeg_' + L, p => 0.4 * smooth((p.y - 0.06) / 0.06)]]), { power: 5 }));
    add(M.leatherDark, skinRigid(soleGeo(s), info['foot_' + L].index));
  }

  const group = new THREE.Group();
  const meshes = [];
  for (const [mat, list] of byMat) {
    const clean = list.map(g => {
      const ng = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].includes(k)) ng.deleteAttribute(k);
      if (!ng.attributes.normal) ng.computeVertexNormals();
      return ng;
    });
    const g = mergeGeometries(clean);
    const m = new THREE.SkinnedMesh(g, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.frustumCulled = false;
    m.bind(skeleton, new THREE.Matrix4());
    group.add(m); meshes.push(m);
  }
  return { group, meshes };
}
