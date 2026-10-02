// Village props: plaza, well, lanes, fields + crops, fences, dry-stone walls,
// windmill, bridge, barrels, crates, hay, carts, lanterns, laundry, woodpiles.
import * as THREE from 'three';
import { mat, box, cyl, lathe, quad, gable } from './kit.js';
import { fbm, noise2 } from '../world/layout.js';

const PI = Math.PI;
function P(M, key, g, base, local, opts) { M.add(key, g, local ? base.clone().multiply(local) : base, opts); }

// ---------- ground ribbons ----------
function smoothLine(pts, step = 1) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export function ribbon(M, key, pts, width, heightAt, { lift = 0.05, uScale = 0.25, color = 0xffffff, skip } = {}) {
  const line = smoothLine(pts, 0.8);
  const pos = [], uv = [], idx = [];
  let dist = 0;
  const across = 5;
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    if (i > 0) dist += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    const wv = width * (1 + 0.18 * noise2(line[i][0] * 0.2, line[i][1] * 0.2));
    for (let k = 0; k < across; k++) {
      const f = k / (across - 1) - 0.5;
      const x = line[i][0] - tz * f * wv, z = line[i][1] + tx * f * wv;
      pos.push(x, heightAt(x, z) + lift, z);
      uv.push(dist * uScale, k / (across - 1));
    }
  }
  for (let i = 0; i < line.length - 1; i++) for (let k = 0; k < across - 1; k++) {
    const a = i * across + k, b = a + 1, c = a + across, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  M.add(key, g, null, { color });
}

// draped grid patch (fields, plaza)
function drape(cx, cz, rot, w, d, heightAt, lift, uvFn, res = 1) {
  const nx = Math.max(2, Math.ceil(w / res)), nz = Math.max(2, Math.ceil(d / res));
  const c = Math.cos(rot), s = Math.sin(rot);
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const lx = (i / nx - 0.5) * w, lz = (j / nz - 0.5) * d;
    const x = cx + lx * c + lz * s, z = cz - lx * s + lz * c;
    pos.push(x, heightAt(x, z) + lift, z);
    const [u, v] = uvFn(lx, lz); uv.push(u, v);
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, cc = a + nx + 1, d2 = cc + 1;
    idx.push(a, cc, b, b, cc, d2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function plaza(M, sq, heightAt, R) {
  const segs = 64, rings = 10;
  const pos = [], uv = [], idx = [];
  const rad = a => sq.r * (1 + 0.1 * Math.sin(a * 3 + 1) + 0.06 * Math.sin(a * 7));
  pos.push(sq.x, heightAt(sq.x, sq.z) + 0.06, sq.z); uv.push(sq.x * 0.28, sq.z * 0.28);
  for (let r = 1; r <= rings; r++) for (let k = 0; k < segs; k++) {
    const a = k / segs * PI * 2, rr = rad(a) * r / rings;
    const x = sq.x + Math.cos(a) * rr, z = sq.z + Math.sin(a) * rr;
    pos.push(x, heightAt(x, z) + 0.06, z); uv.push(x * 0.28, z * 0.28);
  }
  for (let k = 0; k < segs; k++) idx.push(0, 1 + ((k + 1) % segs), 1 + k);
  for (let r = 1; r < rings; r++) for (let k = 0; k < segs; k++) {
    const a = 1 + (r - 1) * segs + k, b = 1 + (r - 1) * segs + (k + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  M.add('cobble', g, null, {});
  // curb stones
  for (let k = 0; k < 90; k++) {
    const a = k / 90 * PI * 2, rr = rad(a) + 0.15;
    const x = sq.x + Math.cos(a) * rr, z = sq.z + Math.sin(a) * rr;
    P(M, 'stone', box(0.55 + R() * 0.2, 0.3, 0.3, 0.6, 'wall', R), mat(x, heightAt(x, z) + 0.02, z, (R() - 0.5) * 0.08, -a, (R() - 0.5) * 0.08), null, { color: new THREE.Color().setHSL(0.08, 0.06, 0.75 + R() * 0.3) });
  }
}

// ---------- well ----------
export function well(M, w, heightAt, R, out) {
  const y = heightAt(w.x, w.z) + 0.05;
  const B = mat(w.x, y, w.z, 0, 0.4, 0);
  const sc = new THREE.Color(0xd8d0c0);
  P(M, 'stone', cyl(1.15, 1.22, 1.0, 20, 0.55, true), B, mat(0, 0.5, 0), { color: sc, wall: [y, y + 3] });
  const inner = cyl(0.88, 0.88, 1.0, 20, 0.55, true); inner.scale(-1, 1, 1);
  P(M, 'stone', inner, B, mat(0, 0.5, 0), { color: sc.clone().multiplyScalar(0.6) });
  const rim = new THREE.RingGeometry(0.82, 1.3, 24, 1); rim.rotateX(-PI / 2);
  const ruv = rim.attributes.uv; const rp = rim.attributes.position;
  for (let i = 0; i < ruv.count; i++) ruv.setXY(i, rp.getX(i) * 0.6, rp.getZ(i) * 0.6);
  P(M, 'stone', rim, B, mat(0, 1.0, 0), { color: sc });
  P(M, 'stone', cyl(1.3, 1.3, 0.12, 24, 0.55, true), B, mat(0, 0.95, 0), { color: sc });
  const water = new THREE.CircleGeometry(0.88, 20); water.rotateX(-PI / 2);
  P(M, 'water', water, B, mat(0, 0.35, 0));
  for (const sd of [-1, 1]) {
    P(M, 'wood', box(0.2, 2.4, 0.2, 0.5, 'grain', R), B, mat(sd * 1.05, 1.0 + 1.2, 0));
    P(M, 'wood', box(0.12, 0.6, 0.12, 0.5, 'grain', R), B, mat(sd * 0.85, 2.85, 0, 0, 0, sd * 0.7));
  }
  P(M, 'wood', box(2.5, 0.16, 0.16, 0.5, 'grain', R), B, mat(0, 3.25, 0));
  // crank axle + rope + bucket
  const ax = cyl(0.09, 0.09, 2.3, 8, 1); ax.rotateZ(PI / 2); P(M, 'woodLight', ax, B, mat(0, 2.2, 0));
  const rp2 = cyl(0.13, 0.13, 0.5, 10, 1); rp2.rotateZ(PI / 2); P(M, 'rope', rp2, B, mat(0, 2.2, 0));
  P(M, 'iron', box(0.05, 0.4, 0.05, 1), B, mat(1.25, 2.0, 0)); P(M, 'iron', box(0.3, 0.05, 0.05, 1), B, mat(1.32, 1.8, 0.0));
  P(M, 'rope', cyl(0.015, 0.015, 0.9, 4, 1), B, mat(0, 1.7, 0.12));
  const bucket = lathe([[0, 0], [0.18, 0], [0.2, 0.02], [0.23, 0.35], [0.21, 0.36]], 12, 3);
  P(M, 'plank', bucket, B, mat(0, 1.0, 0.12), { color: 0xc8a888 });
  const hoop = new THREE.TorusGeometry(0.225, 0.015, 4, 16); hoop.rotateX(PI / 2);
  P(M, 'iron', hoop, B, mat(0, 1.25, 0.12));
  // little roof
  const th = 0.6, S = 1.25 / Math.cos(th), L = 3.0;
  for (const side of [0, 1]) {
    const SM = B.clone().multiply(mat(0, 3.33 + 0.08, 0, 0, side * PI + PI / 2, 0)).multiply(mat(0, 0.75, 0, th, 0, 0, 1, 1, 1, 'XYZ'));
    P(M, 'shingle', box(L, 0.1, S, 1 / 3, 'top', R), SM, mat(0, -0.05, S / 2));
  }
  out.colliders.push({ type: 'cylinder', x: w.x, z: w.z, r: 1.3, h: 1.05 });
}

// ---------- fences / walls ----------
export function fence(M, pts, heightAt, R, colliders, { closed = false } = {}) {
  const P2 = closed ? [...pts, pts[0]] : pts;
  const col = new THREE.Color().setHSL(0.08, 0.15, 0.85);
  for (let i = 0; i < P2.length - 1; i++) {
    const [ax, az] = P2[i], [bx, bz] = P2[i + 1];
    const L = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(L / 2.4));
    const yaw = Math.atan2(bx - ax, bz - az);
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = heightAt(x, z);
      const lean = (R() - 0.5) * 0.08;
      P(M, 'woodLight', box(0.16, 1.35, 0.16, 0.6, 'grain', R), mat(x, y + 0.55, z, lean, R() * 3, lean), null, { color: col });
      if (prev) {
        for (const ry of [0.45, 0.95]) {
          const dx = x - prev[0], dz = z - prev[1], dy = y - prev[2];
          const len = Math.hypot(dx, dz);
          P(M, 'woodLight', box(0.07, 0.12, len + 0.2, 0.6, 'grain', R), mat((x + prev[0]) / 2, (y + prev[2]) / 2 + ry + (R() - 0.5) * 0.05, (z + prev[1]) / 2, -Math.atan2(dy, len), yaw, (R() - 0.5) * 0.05), null, { color: col });
        }
      }
      prev = [x, z, y];
    }
    colliders.push({ type: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hw: 0.12, hd: L / 2, rot: yaw, h: 1.1, camera: false });
  }
}
export function stoneWall(M, pts, heightAt, R, colliders) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    for (let row = 0; row < 3; row++) {
      let t = R() * 0.3;
      const rh = 0.28 + R() * 0.06, depth = 0.75 - row * 0.12;
      while (t < L) {
        const sl = 0.4 + R() * 0.45;
        const c = t + sl / 2; if (c > L) break;
        const x = ax + dx * c, z = az + dz * c, y = heightAt(x, z) - 0.1 + row * 0.27;
        P(M, 'stone', box(depth + (R() - 0.5) * 0.1, rh, sl - 0.03, 0.6, 'wall', R), mat(x + (R() - 0.5) * 0.05, y + rh / 2, z, (R() - 0.5) * 0.1, yaw + (R() - 0.5) * 0.08, (R() - 0.5) * 0.1), null, { color: new THREE.Color().setHSL(0.09, 0.07, 0.65 + R() * 0.35), wall: [y - row * 0.27 + 0.1, 1e4] });
        t += sl;
      }
    }
    // upright coping stones
    for (let t = 0.15; t < L; t += 0.24 + R() * 0.06) {
      const x = ax + dx * t, z = az + dz * t, y = heightAt(x, z) + 0.72;
      P(M, 'stone', box(0.5, 0.32, 0.14, 0.6, 'wall', R), mat(x, y + 0.16, z, 0, yaw + PI / 2 + (R() - 0.5) * 0.2, (R() - 0.5) * 0.25), null, { color: new THREE.Color().setHSL(0.09, 0.07, 0.6 + R() * 0.35) });
    }
    colliders.push({ type: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hw: 0.4, hd: L / 2, rot: yaw, h: 0.95 });
  }
}

// ---------- small props ----------
const barrelGeo = (() => {
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([0.36 + Math.sin(t * PI) * 0.07, t * 1.0]); }
  return pts;
})();
export function barrel(M, x, z, heightAt, R, colliders, s = 1, yOff = 0) {
  const y = heightAt(x, z) + yOff;
  const B = mat(x, y, z, 0, R() * 6, 0, s, s, s);
  P(M, 'plank', lathe(barrelGeo, 16, 1.4), B, null, { color: new THREE.Color().setHSL(0.07, 0.3, 0.7 + R() * 0.3) });
  const lid = new THREE.CircleGeometry(0.37, 16); lid.rotateX(-PI / 2); P(M, 'plank', lid, B, mat(0, 0.985, 0), { color: 0xa08060 });
  for (const hy of [0.12, 0.38, 0.62, 0.88]) {
    const r = 0.36 + Math.sin(hy * PI) * 0.07 + 0.01;
    const t = new THREE.TorusGeometry(r, 0.018, 4, 18); t.rotateX(PI / 2); P(M, 'iron', t, B, mat(0, hy, 0));
  }
  if (colliders) colliders.push({ type: 'cylinder', x, z, r: 0.45 * s, h: 1.0 * s + yOff });
}
export function crate(M, x, z, y, yaw, sz, R, colliders) {
  const B = mat(x, y + sz / 2, z, 0, yaw, 0);
  P(M, 'plank', box(sz - 0.04, sz - 0.04, sz - 0.04, 1.2, 'wall', R), B, null, { color: new THREE.Color().setHSL(0.08, 0.3, 0.75 + R() * 0.25) });
  const e = 0.07;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    P(M, 'woodLight', box(e, sz, e, 1, 'grain', R), B, mat(a * (sz / 2 - e / 2), 0, b * (sz / 2 - e / 2)));
    P(M, 'woodLight', box(sz, e, e, 1, 'grain', R), B, mat(0, a * (sz / 2 - e / 2), b * (sz / 2 - e / 2)));
    P(M, 'woodLight', box(e, e, sz, 1, 'grain', R), B, mat(a * (sz / 2 - e / 2), b * (sz / 2 - e / 2), 0));
  }
  if (colliders) colliders.push({ type: 'box', x, z, hw: sz / 2, hd: sz / 2, rot: yaw, h: sz, y });
}
export function hayRound(M, x, z, heightAt, R, colliders) {
  const y = heightAt(x, z);
  const g = cyl(0.78, 0.78, 1.25, 18, 0.7); g.rotateZ(PI / 2);
  const yaw = R() * PI;
  P(M, 'hay', g, mat(x, y + 0.72, z, 0, yaw, 0), null, { color: new THREE.Color().setHSL(0.11, 0.35, 0.8 + R() * 0.2) });
  // twine
  for (const o of [-0.35, 0.35]) { const t = new THREE.TorusGeometry(0.79, 0.015, 4, 24); t.rotateY(PI / 2); P(M, 'rope', t, mat(x, y + 0.72, z, 0, yaw, 0), mat(o, 0, 0)); }
  if (colliders) colliders.push({ type: 'box', x, z, hw: 0.62, hd: 0.78, rot: yaw, h: 1.5 });
}
export function hayBale(M, x, y, z, yaw, R) {
  const B = mat(x, y + 0.25, z, 0, yaw, 0);
  P(M, 'hay', box(1.0, 0.48, 0.52, 1.3, 'grain', R), B, null, { color: new THREE.Color().setHSL(0.11, 0.4, 0.8 + R() * 0.2) });
  for (const o of [-0.25, 0.25]) P(M, 'rope', box(0.03, 0.5, 0.54, 1), B, mat(o, 0, 0));
}
export function sack(M, x, y, z, R, col = 0xc8b088) {
  const g = new THREE.IcosahedronGeometry(0.32, 1); g.scale(1, 1.3, 0.85);
  P(M, 'cloth', g, mat(x, y + 0.36, z, (R() - 0.5) * 0.3, R() * 6, (R() - 0.5) * 0.3), null, { color: col, wall: [0, 0] });
}
export function cart(M, x, z, yaw, heightAt, R, colliders, load = 'hay') {
  const y = heightAt(x, z);
  const B = mat(x, y, z, 0, yaw, 0.04);
  const wc = new THREE.Color().setHSL(0.07, 0.25, 0.85);
  P(M, 'plank', box(1.6, 0.1, 2.6, 0.5, 'top', R), B, mat(0, 0.95, 0), { color: wc });
  for (const sd of [-1, 1]) P(M, 'plank', box(0.06, 0.45, 2.6, 0.5, 'wall', R), B, mat(sd * 0.8, 1.2, 0), { color: wc });
  P(M, 'plank', box(1.6, 0.45, 0.06, 0.5, 'wall', R), B, mat(0, 1.2, -1.3), { color: wc });
  for (const sd of [-1, 1]) {
    P(M, 'wood', box(0.1, 0.1, 2.4, 0.5, 'grain', R), B, mat(sd * 0.35, 0.82, 2.1, -0.38, 0, 0));
    // wheel
    const rim = new THREE.TorusGeometry(0.6, 0.06, 6, 20); rim.rotateY(PI / 2);
    P(M, 'wood', rim, B, mat(sd * 0.92, 0.62, -0.3));
    const hub = cyl(0.12, 0.12, 0.25, 10, 1); hub.rotateZ(PI / 2); P(M, 'wood', hub, B, mat(sd * 0.92, 0.62, -0.3));
    for (let k = 0; k < 8; k++) P(M, 'wood', box(0.04, 1.15, 0.05, 1, 'grain', R), B, mat(sd * 0.92, 0.62, -0.3, k * PI / 8, 0, 0));
  }
  const ld = B.clone().multiply(mat(0, 1.0, 0));
  if (load === 'hay') {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const bb = box(0.72, 0.42, 0.75, 1.3, 'grain', R); P(M, 'hay', bb, ld, mat(-0.38 + i * 0.76, 0.22 + (j === 1 && i === 0 ? 0.42 : 0), -0.85 + j * 0.85), { color: 0xe8d8a0 }); }
  } else {
    for (let k = 0; k < 5; k++) { const g = new THREE.IcosahedronGeometry(0.3, 1); g.scale(1, 0.8, 1.2); P(M, 'cloth', g, ld, mat((R() - 0.5) * 0.9, 0.3, -0.9 + k * 0.45, 0, R() * 3, 0), { color: 0xc8b088, wall: [0, 0] }); }
  }
  colliders.push({ type: 'box', x, z, hw: 0.95, hd: 1.4, rot: yaw, h: 1.5 });
}
export function lanternPost(M, x, z, heightAt, R, lamps, colliders, yaw = R() * 6) {
  const y = heightAt(x, z);
  const B = mat(x, y, z, 0, yaw, 0);
  P(M, 'wood', box(0.18, 3.0, 0.18, 0.5, 'grain', R), B, mat(0, 1.5, 0));
  P(M, 'stone', box(0.45, 0.3, 0.45, 0.6, 'wall', R), B, mat(0, 0.1, 0));
  P(M, 'iron', box(0.05, 0.05, 0.75, 1), B, mat(0, 2.85, 0.35));
  P(M, 'iron', box(0.04, 0.5, 0.04, 1), B, mat(0, 2.6, 0.2, -0.8, 0, 0));
  lantern(M, B, 0, 2.45, 0.68, lamps);
  colliders.push({ type: 'cylinder', x, z, r: 0.18, h: 3, camera: false });
}
export function lantern(M, B, x, y, z, lamps) {
  P(M, 'iron', box(0.3, 0.04, 0.3, 1), B, mat(x, y + 0.3, z));
  P(M, 'iron', cyl(0.02, 0.15, 0.14, 4, 1), B, mat(x, y + 0.38, z, 0, PI / 4, 0));
  P(M, 'iron', box(0.26, 0.04, 0.26, 1), B, mat(x, y - 0.12, z));
  for (const a of [-1, 1]) for (const b of [-1, 1]) P(M, 'iron', box(0.03, 0.42, 0.03, 1), B, mat(x + a * 0.12, y + 0.09, z + b * 0.12));
  P(M, 'lamp', box(0.2, 0.34, 0.2, 1), B, mat(x, y + 0.09, z));
  P(M, 'iron', box(0.02, 0.2, 0.02, 1), B, mat(x, y + 0.5, z));
  lamps.push(new THREE.Vector3(x, y + 0.09, z).applyMatrix4(B));
}
export function laundry(M, ax, az, bx, bz, heightAt, R) {
  const ya = heightAt(ax, az), yb = heightAt(bx, bz);
  const yaw = Math.atan2(bx - ax, bz - az);
  for (const [x, z, y] of [[ax, az, ya], [bx, bz, yb]]) {
    P(M, 'woodLight', box(0.12, 2.3, 0.12, 0.6, 'grain', R), mat(x, y + 1.15, z, 0, yaw, 0));
    P(M, 'woodLight', box(0.6, 0.08, 0.08, 0.6, 'grain', R), mat(x, y + 2.2, z, 0, yaw, 0));
  }
  const L = Math.hypot(bx - ax, bz - az);
  const n = 10;
  const rope = []; for (let i = 0; i <= n; i++) { const t = i / n; rope.push([ax + (bx - ax) * t, ya + (yb - ya) * t + 2.18 - Math.sin(t * PI) * 0.25, az + (bz - az) * t]); }
  for (let i = 0; i < n; i++) {
    const a = rope[i], b = rope[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = cyl(0.012, 0.012, len, 4, 1); g.rotateX(PI / 2);
    P(M, 'rope', g, mat((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, -Math.atan2(b[1] - a[1], Math.hypot(b[0] - a[0], b[2] - a[2])), yaw, 0));
  }
  const cols = [0xf4efe4, 0xc8d8e8, 0xb04a3a, 0xe8d8a8, 0x6a8ab0, 0xf4efe4, 0x7a9a5a, 0xe0b0b8];
  let t = 0.08;
  while (t < 0.9) {
    const cw = 0.5 + R() * 0.7, ch = 0.6 + R() * 0.6;
    const tm = t + cw / L / 2;
    const x = ax + (bx - ax) * tm, z = az + (bz - az) * tm;
    const y = ya + (yb - ya) * tm + 2.18 - Math.sin(tm * PI) * 0.25;
    const g = new THREE.PlaneGeometry(cw, ch, 4, 4);
    P(M, 'cloth', g, mat(x, y - ch / 2, z, 0, yaw + PI / 2, 0), null, { color: cols[Math.floor(R() * cols.length)] });
    t += cw / L + 0.06;
  }
}
export function woodpile(M, x, z, yaw, heightAt, R) {
  const y = heightAt(x, z);
  const B = mat(x, y, z, 0, yaw, 0);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 9 - row; i++) {
    const g = cyl(0.13, 0.13, 0.9, 7, 1.5); g.rotateX(PI / 2);
    P(M, 'woodLight', g, B, mat(-1.0 + i * 0.26 + row * 0.13, 0.14 + row * 0.23, (R() - 0.5) * 0.1), { color: new THREE.Color().setHSL(0.08, 0.3, 0.75 + R() * 0.3) });
  }
  // small lean-to shelter
  P(M, 'wood', box(0.12, 1.6, 0.12, 0.5, 'grain', R), B, mat(-1.3, 0.8, -0.5));
  P(M, 'wood', box(0.12, 1.6, 0.12, 0.5, 'grain', R), B, mat(1.3, 0.8, -0.5));
  P(M, 'shingle', box(3.0, 0.08, 1.4, 1 / 3, 'top', R), B, mat(0, 1.62, 0.05, 0.25, 0, 0, 1, 1, 1, 'XYZ'));
  // chopping block + axe
  P(M, 'woodLight', cyl(0.3, 0.32, 0.5, 10, 1.4), B, mat(1.9, 0.25, 0.6));
  P(M, 'wood', box(0.05, 0.05, 0.8, 1, 'grain', R), B, mat(1.9, 0.75, 0.6, 0.9, 0, 0));
  P(M, 'iron', box(0.04, 0.18, 0.22, 1), B, mat(1.9, 0.52, 0.42, 0.9, 0, 0));
}

// ---------- windmill ----------
export function windmill(ctx, M, Mrot, wm, heightAt, R, out) {
  const y = heightAt(wm.x, wm.z) - 0.3;
  const yaw = Math.atan2(55 - wm.x, 30 - wm.z); // sails face the village
  const B = mat(wm.x, y, wm.z, 0, yaw, 0);
  const prof = []; const Ht = 10.5;
  const rAt = h => 3.3 - (h / Ht) * 1.0;
  for (let i = 0; i <= 8; i++) { const h = i / 8 * Ht; prof.push([rAt(h), h]); }
  P(M, 'stone', lathe(prof, 20, 0.45), B, null, { color: 0xe6ddcc, wall: [y + 0.3, y + Ht] });
  // white-washed upper band
  // cap
  const cap = lathe([[2.75, 0], [2.85, 0.15], [2.6, 0.9], [1.9, 2.0], [0.9, 2.8], [0.15, 3.15], [0, 3.2]], 20, 0.35);
  P(M, 'shingle', cap, B, mat(0, Ht - 0.05, 0));
  P(M, 'wood', cyl(2.85, 2.85, 0.3, 20, 0.5, true), B, mat(0, Ht + 0.0, 0));
  // gallery ring
  const gal = new THREE.TorusGeometry(2.8, 0.06, 4, 32); gal.rotateX(PI / 2);
  P(M, 'wood', gal, B, mat(0, Ht - 1.4, 0));
  for (let k = 0; k < 24; k++) { const a = k / 24 * PI * 2; P(M, 'wood', box(0.06, 0.9, 0.06, 1, 'grain', R), B, mat(Math.cos(a) * 2.8, Ht - 1.85, Math.sin(a) * 2.8)); }
  const deck = new THREE.RingGeometry(rAt(Ht - 2.3), 2.9, 24, 1); deck.rotateX(-PI / 2);
  { const u = deck.attributes.uv, p = deck.attributes.position; for (let i = 0; i < u.count; i++) u.setXY(i, p.getX(i) * 0.5, p.getZ(i) * 0.5); }
  P(M, 'plankGrey', deck, B, mat(0, Ht - 2.3, 0));
  const deckU = deck.clone(); deckU.rotateX(PI); P(M, 'plankGrey', deckU, B, mat(0, Ht - 2.32, 0));
  // door + windows on the tower facing the village
  const dz = rAt(0.5);
  P(M, 'plank', box(1.2, 2.2, 0.15, 0.9, 'wall', R), B, mat(0, 1.4, dz - 0.02), { color: 0x6a4428 });
  P(M, 'stone', box(1.6, 0.35, 0.5, 0.6, 'wall', R), B, mat(0, 2.65, dz - 0.05), { color: 0xd8d0c0 });
  for (const [hh, a] of [[5, 0.5], [7.2, -0.6], [4.2, 2.6]]) {
    const r = rAt(hh);
    const FM = B.clone().multiply(mat(Math.sin(a) * r, hh, Math.cos(a) * r, 0, a, 0));
    P(M, 'window', quad(0.6, 0.8), FM, mat(0, 0, 0.02), { wall: [0.9, 0] });
    P(M, 'stone', box(0.9, 0.18, 0.3, 0.6, 'wall', R), FM, mat(0, 0.5, 0), { color: 0xd8d0c0 });
    P(M, 'stone', box(0.9, 0.12, 0.35, 0.6, 'wall', R), FM, mat(0, -0.46, 0.04), { color: 0xd8d0c0 });
  }
  // rotor (separate merger so it can spin)
  const hubPos = new THREE.Vector3(0, Ht + 1.0, rAt(Ht) + 1.2);
  const rotor = new THREE.Group();
  rotor.position.copy(hubPos).applyMatrix4(B);
  rotor.rotation.set(0, yaw, 0, 'YXZ');
  const spin = new THREE.Group(); rotor.add(spin);
  rotor.rotation.x = -0.12;
  // axle from cap to hub
  const axle = cyl(0.22, 0.25, 2.0, 10, 1); axle.rotateX(PI / 2);
  P(M, 'wood', axle, B, mat(0, Ht + 1.0, rAt(Ht) + 0.3, -0.12, 0, 0));
  const hub = cyl(0.42, 0.42, 0.6, 12, 1); hub.rotateX(PI / 2);
  P(Mrot, 'wood', hub, new THREE.Matrix4());
  for (let k = 0; k < 4; k++) {
    const A = mat(0, 0, 0.1, 0, 0, k * PI / 2);
    P(Mrot, 'wood', box(0.24, 9.2, 0.22, 0.5, 'grain', R), A, mat(0, 4.6, 0));
    for (let s = 1.4; s < 9.0; s += 0.62) P(Mrot, 'woodLight', box(2.0, 0.06, 0.07, 0.6, 'grain', R), A, mat(0.75, s, 0.12));
    P(Mrot, 'woodLight', box(0.07, 7.8, 0.07, 0.6, 'grain', R), A, mat(1.72, 5.1, 0.12));
    const reef = k === 3 ? 0.45 : 1;
    const sl = 7.4 * reef;
    const sail = new THREE.PlaneGeometry(1.6, sl, 2, 6);
    P(Mrot, 'canvas', sail, A, mat(0.82, 1.5 + sl / 2, 0.16), { color: k % 2 ? 0xf2ead8 : 0xe8dcc4 });
    const back = sail.clone(); back.rotateY(PI); P(Mrot, 'canvas', back, A, mat(0.82, 1.5 + sl / 2, 0.15), { color: 0xd8ccb4 });
  }
  out.colliders.push({ type: 'cylinder', x: wm.x, z: wm.z, r: 3.3, h: Ht });
  ctx.scene.add(rotor);
  return { rotor, spin };
}

// ---------- bridge ----------
export function bridge(M, br, heightAt, R, colliders) {
  const dx = br.x1 - br.x0, dz = br.z1 - br.z0, L = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, dz);
  const h0 = heightAt(br.x0, br.z0), h1 = heightAt(br.x1, br.z1);
  const yEnd = Math.max(h0, h1) + 0.25, arch = 1.4;
  const yAt = t => yEnd + (h0 - yEnd) * 0 + arch * Math.sin(t * PI);
  const at = t => [br.x0 + dx * t, br.z0 + dz * t];
  const W = br.w;
  // deck boards across
  const nb = Math.round(L / 0.33);
  for (let i = 0; i < nb; i++) {
    const t = (i + 0.5) / nb; const [x, z] = at(t);
    const slope = Math.atan2(arch * PI * Math.cos(t * PI), L);
    P(M, 'plankGrey', box(W + (R() - 0.5) * 0.12, 0.09, 0.3, 0.7, 'grain', R), mat(x, yAt(t) - 0.05, z, -slope, yaw, (R() - 0.5) * 0.02), null, { color: new THREE.Color().setHSL(0.08, 0.15, 0.75 + R() * 0.3) });
  }
  // stringers + rails as segment chains
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const [x0, z0] = at(t0), [x1, z1] = at(t1);
    const y0 = yAt(t0), y1 = yAt(t1);
    const len = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
    const pitch = -Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0));
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, cy = (y0 + y1) / 2;
    const Bm = mat(cx, cy, cz, 0, yaw, 0);
    for (const o of [-W / 2 + 0.2, 0, W / 2 - 0.2]) P(M, 'wood', box(0.22, 0.32, len + 0.05, 0.5, 'grain', R), Bm, mat(o, -0.27, 0, pitch, 0, 0));
    for (const sd of [-1, 1]) {
      P(M, 'wood', box(0.12, 0.12, len + 0.05, 0.5, 'grain', R), Bm, mat(sd * (W / 2 - 0.05), 1.05, 0, pitch, 0, 0));
      P(M, 'wood', box(0.07, 0.09, len + 0.05, 0.5, 'grain', R), Bm, mat(sd * (W / 2 - 0.05), 0.55, 0, pitch, 0, 0));
    }
    colliders.push({ type: 'box', x: cx, z: cz, hw: W / 2, hd: len / 2 + 0.05, rot: yaw, h: 0.35, y: cy - 0.35 });
  }
  for (let i = 0; i <= segs; i += 2) {
    const t = i / segs; const [x, z] = at(t); const y = yAt(t);
    for (const sd of [-1, 1]) {
      const Bm = mat(x, y, z, 0, yaw, 0);
      P(M, 'wood', box(0.18, 1.25, 0.18, 0.5, 'grain', R), Bm, mat(sd * (W / 2 - 0.05), 0.55, 0));
      colliders.push({ type: 'box', x: x + Math.cos(yaw) * sd * (W / 2), z: z - Math.sin(yaw) * sd * (W / 2), hw: 0.1, hd: L / segs, rot: yaw, h: 1.1, y, camera: false });
    }
  }
  // trestle piers in the stream
  for (const t of [0.34, 0.66]) {
    const [x, z] = at(t); const y = yAt(t); const g = heightAt(x, z) - 0.6;
    const Bm = mat(x, 0, z, 0, yaw, 0);
    for (const o of [-W / 2 + 0.25, W / 2 - 0.25]) {
      P(M, 'wood', box(0.3, y - g, 0.3, 0.5, 'grain', R), Bm, mat(o, (y + g) / 2 - 0.3, 0));
      P(M, 'wood', box(0.12, (y - g) * 0.9, 0.12, 0.5, 'grain', R), Bm, mat(o * 0.4, (y + g) / 2 - 0.3, 0, 0, 0, Math.sign(o) * 0.25));
    }
    P(M, 'wood', box(W + 0.4, 0.25, 0.3, 0.5, 'grain', R), Bm, mat(0, y - 0.55, 0));
    P(M, 'wood', box(W, 0.18, 0.25, 0.5, 'grain', R), Bm, mat(0, (y + g) / 2, 0));
  }
  // stone abutments
  for (const [t, hh] of [[0, h0], [1, h1]]) {
    const [x, z] = at(t);
    const Bm = mat(x, 0, z, 0, yaw, 0);
    const base = hh - 1.6, top = yEnd - 0.35;
    P(M, 'stone', box(W + 1.4, top - base, 2.4, 0.5, 'wall', R), Bm, mat(0, (top + base) / 2, t === 0 ? 0.6 : -0.6), { color: 0xd0c8b8, wall: [hh, top] });
    for (const sd of [-1, 1]) P(M, 'stone', box(0.6, 1.0, 0.6, 0.6, 'wall', R), Bm, mat(sd * (W / 2 + 0.4), top + 0.5, t === 0 ? -0.2 : 0.2), { color: 0xd0c8b8 });
    colliders.push({ type: 'box', x, z, hw: W / 2 + 0.7, hd: 1.2, rot: yaw, h: top - hh, y: hh });
  }
}

// ---------- fields ----------
export function fieldSoil(M, f, heightAt) {
  const g = drape(f.x, f.z, f.rot, f.w, f.d, heightAt, 0.06, (lx, lz) => [lx / 5.6, lz / 5.6], 1);
  M.add('soil', g, null, {});
}
// crossed-quad plant geometry, origin at the base
export function plantGeo(w, h) {
  const a = new THREE.PlaneGeometry(w, h); a.translate(0, h / 2, 0);
  const b = a.clone(); b.rotateY(PI / 2);
  const c = a.clone(); c.rotateY(PI / 4);
  const g = new THREE.BufferGeometry();
  const geos = [a, b, c];
  const pos = [], nrm = [], uv = [], idx = []; let off = 0;
  for (const q of geos) {
    pos.push(...q.attributes.position.array); uv.push(...q.attributes.uv.array);
    for (let i = 0; i < q.attributes.position.count; i++) nrm.push(0, 1, 0); // up-facing normals: soft foliage shading
    idx.push(...Array.from(q.index.array, v => v + off)); off += q.attributes.position.count;
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
export function cropInstances(fields, heightAt, R) {
  const res = { wheat: [], veg: [] };
  for (const f of fields) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const rowGap = f.kind === 'wheat' ? 0.7 : 0.7, step = f.kind === 'wheat' ? 0.32 : 0.6;
    for (let lz = -f.d / 2 + 0.5; lz <= f.d / 2 - 0.4; lz += rowGap) {
      for (let lx = -f.w / 2 + 0.4; lx <= f.w / 2 - 0.4; lx += step * (0.8 + R() * 0.4)) {
        const jx = lx + (R() - 0.5) * 0.1, jz = lz + (R() - 0.5) * 0.12;
        const x = f.x + jx * c + jz * s, z = f.z - jx * s + jz * c;
        // ragged edges: occasionally skip
        if (R() < 0.04) continue;
        res[f.kind].push({ x, y: heightAt(x, z) + 0.04, z, yaw: R() * PI, s: f.kind === 'wheat' ? 0.85 + R() * 0.35 : 0.8 + R() * 0.4, c: R() });
      }
    }
  }
  return res;
}
