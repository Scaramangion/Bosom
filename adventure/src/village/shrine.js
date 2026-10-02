// The Old Shrine on the hill (LANDMARKS.shrine): a tiered ruined sanctuary with a
// great arched gate, a ring of broken fluted columns, overgrown stairs and a tall
// rune-cut monolith — built to read as the vista landmark from across the province.
import * as THREE from 'three';
import { mat, box, cyl } from './kit.js';

const PI = Math.PI;
function P(M, key, g, base, local, opts) { M.add(key, g, local ? base.clone().multiply(local) : base, opts); }
const stoneC = (R, l = 0.8) => new THREE.Color().setHSL(0.1, 0.07, l + (R() - 0.5) * 0.18);

function flutedDrum(r, h, R, broken = false) {
  const g = new THREE.CylinderGeometry(r, r * 1.02, h, 40, 2, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
    const a = Math.atan2(z, x), rr = Math.hypot(x, z);
    if (rr > 0.01) {
      const k = 1 - 0.05 * Math.pow(Math.abs(Math.cos(a * 10)), 0.6);
      p.setX(i, x * k); p.setZ(i, z * k);
    }
    if (broken && y > 0) {
      const n = Math.sin(a * 3 + 1.3) * 0.35 + Math.sin(a * 7) * 0.15 + (rr < 0.01 ? -0.1 : 0);
      p.setY(i, y - Math.max(0, n + 0.25) * h * 0.6);
    }
  }
  g.computeVertexNormals();
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * PI * r * 0.35, uv.getY(i) * h * 0.35);
  return g;
}

function column(M, x, y, z, height, R, colliders, broken) {
  const r = 0.55;
  const B = mat(x, y, z, 0, R() * 6, 0);
  P(M, 'ruin', box(1.6, 0.35, 1.6, 0.35, 'wall', R), B, mat(0, 0.17, 0), { color: stoneC(R) });
  const base = new THREE.CylinderGeometry(r * 1.25, r * 1.35, 0.3, 24); P(M, 'ruin', base, B, mat(0, 0.5, 0), { color: stoneC(R) });
  let yy = 0.65; const dh = 1.1;
  while (yy < height - 0.01) {
    const h = Math.min(dh, height - yy);
    const last = yy + h >= height - 0.01;
    P(M, 'ruin', flutedDrum(r, h - 0.03, R, last && broken), B, mat((R() - 0.5) * 0.04, yy + h / 2, (R() - 0.5) * 0.04, 0, R() * 6, (R() - 0.5) * 0.01), { color: stoneC(R), wall: [y, 1e4] });
    yy += h;
  }
  if (!broken) {
    const ech = new THREE.CylinderGeometry(r * 1.35, r * 1.0, 0.35, 24); P(M, 'ruin', ech, B, mat(0, yy + 0.17, 0), { color: stoneC(R) });
    P(M, 'ruin', box(1.5, 0.3, 1.5, 0.35, 'wall', R), B, mat(0, yy + 0.5, 0), { color: stoneC(R) });
  }
  colliders.push({ type: 'cylinder', x, z, r: 0.75, h: height, y });
}

export function buildShrine(M, S, heightAt, R, colliders) {
  const out = { glyphs: [], interact: null, top: 0 };
  let hMax = -1e9;
  for (let a = 0; a < 16; a++) for (const rr of [0, 6, 12]) hMax = Math.max(hMax, heightAt(S.x + Math.cos(a / 16 * PI * 2) * rr, S.z + Math.sin(a / 16 * PI * 2) * rr));
  const T = hMax + 0.6; // lower terrace top
  const yaw = Math.atan2(25 - S.x, -112 - S.z); // face down the stairs toward the trail
  const B = mat(S.x, T, S.z, 0, yaw, 0);
  // ---- terraces: retaining walls of big blocks ----
  const tiers = [{ hw: 13, h: 7, y: 0 }, { hw: 9, h: 1.2, y: 1.2 }];
  for (const tr of tiers) {
    P(M, 'ruin', box(tr.hw * 2 - 0.6, tr.h, tr.hw * 2 - 0.6, 0.3, 'wall', R), B, mat(0, tr.y - tr.h / 2, 0), { color: stoneC(R, 0.72), wall: [T - 6, 1e4] });
    // coping/edge blocks with relief, some missing
    for (let side = 0; side < 4; side++) {
      const SB = B.clone().multiply(mat(0, 0, 0, 0, side * PI / 2, 0));
      let u = -tr.hw;
      while (u < tr.hw - 0.3) {
        const bw = 1.2 + R() * 1.2;
        if (R() > 0.12) {
          const hh = 0.55 + R() * 0.15;
          P(M, 'ruin', box(Math.min(bw, tr.hw - u) - 0.06, hh, 1.0, 0.3, 'wall', R), SB, mat(u + bw / 2, tr.y - hh / 2 + 0.05 + (R() - 0.5) * 0.06, tr.hw - 0.5, (R() - 0.5) * 0.04, (R() - 0.5) * 0.04, (R() - 0.5) * 0.05), { color: stoneC(R, 0.82) });
          // second course below
          P(M, 'ruin', box(Math.min(bw * 0.8, tr.hw - u) - 0.06, 0.6, 0.4, 0.3, 'wall', R), SB, mat(u + bw * 0.45, tr.y - 0.95, tr.hw - 0.1, 0, 0, 0), { color: stoneC(R, 0.74) });
        }
        u += bw;
      }
    }
    colliders.push({ type: 'box', x: S.x, z: S.z, hw: tr.hw - 0.2, hd: tr.hw - 0.2, rot: yaw, h: tr.y + 0.05 + 4, y: T + tr.y - 4 });
  }
  // flagstone top of upper tier
  const TT = 1.2;
  // ---- great gate: two pylons + arch ----
  const gz = 2.5, span = 7.0, pw = 3.2, pd = 2.8;
  const B2 = B.clone().multiply(mat(0, TT, 0));
  const pyl = (px, h, br) => {
    const PB = B2.clone().multiply(mat(px, 0, gz));
    let yy = 0, ci = 0; const course = 0.85;
    while (yy < h) {
      const top = yy + course > h; const n = ci % 2 ? 2 : 3; const taper = 1 - (yy / h) * 0.07;
      for (let k = 0; k < n; k++) {
        if (br && top && R() < 0.5) continue;
        const bw = (pw * taper) / n, hh = course - 0.05 - (br && top ? R() * 0.4 : 0);
        P(M, 'ruin', box(bw - 0.06, hh, pd * taper - R() * 0.08, 0.3, 'wall', R), PB, mat(-pw * taper / 2 + bw * (k + 0.5) + (R() - 0.5) * 0.05, yy + hh / 2, (R() - 0.5) * 0.06, 0, (R() - 0.5) * 0.025, (R() - 0.5) * 0.012), { color: stoneC(R), wall: [T + TT, 1e4] });
      }
      if (ci % 5 === 4 && !top) P(M, 'ruin', box(pw * taper + 0.35, 0.28, pd * taper + 0.35, 0.3, 'wall', R), PB, mat(0, yy + course - 0.12, 0), { color: stoneC(R, 0.68) });
      yy += course; ci++;
    }
    colliders.push({ type: 'box', x: new THREE.Vector3().setFromMatrixPosition(PB).x, z: new THREE.Vector3().setFromMatrixPosition(PB).z, hw: pw / 2, hd: pd / 2, rot: yaw, h, y: T + TT });
    return yy;
  };
  const hL = pyl(-span / 2 - pw / 2, 12.75, false);
  const hR = pyl(span / 2 + pw / 2, 12.75, false);
  // arch springing at top of pylons
  const springY = Math.min(hL, hR) - 0.2;
  const rIn = span / 2, rOut = span / 2 + 1.6, nv = 15;
  for (let i = 0; i < nv; i++) {
    if (i === 9 || i === 10) continue; // collapsed voussoirs → broken silhouette
    const a0 = PI - i / nv * PI, a1 = PI - (i + 1) / nv * PI, am = (a0 + a1) / 2;
    const rm = (rIn + rOut) / 2, len = rm * (a0 - a1) - 0.07;
    const sag = i > 10 ? -0.12 * (i - 10) : 0;
    P(M, 'ruin', box(len, rOut - rIn, pd - 0.2, 0.3, 'wall', R), B2, mat(Math.cos(am) * rm, springY + Math.sin(am) * rm + sag, gz, 0, 0, am - PI / 2), { color: stoneC(R, 0.85) });
  }
  // entablature stub atop left side
  P(M, 'ruin', box(pw + 2.5, 0.9, pd + 0.4, 0.3, 'wall', R), B2, mat(-span / 2 - pw / 2 + 0.6, springY + rOut + 0.1, gz, 0, 0, 0.04), { color: stoneC(R, 0.78) });
  P(M, 'ruin', box(2.0, 1.4, pd, 0.3, 'wall', R), B2, mat(-span / 2 - pw / 2 + 0.2, springY + rOut + 1.2, gz, 0, 0, -0.06), { color: stoneC(R, 0.8) });
  // ---- monolith behind the gate ----
  {
    const mh = 19, mw = 2.8, md = 1.1;
    const g = new THREE.BoxGeometry(mw, mh, md, 1, 6, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + mh / 2) / mh; const k = 1 - t * 0.28; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * (1 - t * 0.15)); if (t > 0.99) p.setY(i, p.getY(i) + (p.getX(i) > 0 ? -0.9 : 0.3)); }
    g.computeVertexNormals();
    const uvA = g.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, p.getX(i) * 0.3 + p.getZ(i) * 0.3, p.getY(i) * 0.3);
    const MB = B2.clone().multiply(mat(0, 0, -5.5, 0.05, 0.1, 0.035));
    P(M, 'ruin', g, MB, mat(0, mh / 2 - 0.3, 0), { color: new THREE.Color(0x8a8f96), wall: [T + TT, 1e4] });
    P(M, 'ruin', box(4.2, 0.9, 2.6, 0.3, 'wall', R), MB, mat(0, 0.2, 0), { color: stoneC(R, 0.7) });
    // rune glyphs on both faces
    for (const sd of [1, -1]) {
      let y = 2.0;
      while (y < mh - 3.5) {
        const k = 1 - (y / mh) * 0.28;
        const gw = mw * k * 0.5;
        const GB = MB.clone().multiply(mat(0, y, sd * (md * (1 - (y / mh) * 0.15) / 2 + 0.005), 0, sd > 0 ? 0 : PI, 0));
        const strokes = 2 + Math.floor(R() * 3);
        for (let s = 0; s < strokes; s++) {
          const vertical = R() < 0.5;
          const L = vertical ? 0.3 + R() * 0.45 : gw * (0.4 + R() * 0.6);
          P(M, 'glyph', box(vertical ? 0.07 : L, vertical ? L : 0.07, 0.03, 1), GB, mat((R() - 0.5) * gw * 0.6, (R() - 0.5) * 0.4, 0, 0, 0, R() < 0.25 ? 0.6 : 0));
        }
        out.glyphs.push(y);
        y += 0.95;
      }
    }
    const mp = new THREE.Vector3().setFromMatrixPosition(MB);
    colliders.push({ type: 'box', x: mp.x, z: mp.z, hw: 1.6, hd: 0.8, rot: yaw + 0.1, h: mh, y: T + TT });
    out.monolith = mp.clone().setY(T + TT + 2);
    out.top = T + TT + mh;
  }
  // ---- ring of columns ----
  const nc = 12, rc = 7.6;
  for (let i = 0; i < nc; i++) {
    const a = i / nc * PI * 2 + PI / nc;
    const lx = Math.cos(a) * rc, lz = Math.sin(a) * rc;
    if (Math.abs(lx) < 6.5 && lz > 0.5) continue; // keep the gate clear
    const wp = new THREE.Vector3(lx, TT, lz).applyMatrix4(B);
    const roll = R();
    if (roll < 0.18) continue; // gone entirely
    const intact = roll > 0.72;
    const hgt = intact ? 7.8 : 2 + R() * 5.5;
    column(M, wp.x, wp.y, wp.z, hgt, R, colliders, !intact);
  }
  // lintel across two intact neighbours (fake: a beam fragment resting on one)
  // ---- fallen drums and blocks ----
  for (let i = 0; i < 16; i++) {
    const a = R() * PI * 2, rr = 4 + R() * 9;
    const lx = Math.cos(a) * rr, lz = Math.sin(a) * rr;
    const wp = new THREE.Vector3(lx, 0, lz).applyMatrix4(B);
    const onTop = rr < 8.6;
    const gy = onTop ? T + TT : Math.max(heightAt(wp.x, wp.z), rr < 12.5 ? T : -1e3);
    if (R() < 0.55) {
      const d = flutedDrum(0.55, 1.05, R); d.rotateZ(PI / 2);
      P(M, 'ruin', d, mat(wp.x, gy + 0.45, wp.z, 0, R() * 6, (R() - 0.5) * 0.2), null, { color: stoneC(R), wall: [gy, 1e4] });
    } else {
      const s = 0.8 + R() * 1.2;
      P(M, 'ruin', box(s * 1.4, s * 0.8, s, 0.3, 'wall', R), mat(wp.x, gy + s * 0.3, wp.z, (R() - 0.5) * 0.5, R() * 6, (R() - 0.5) * 0.5), null, { color: stoneC(R), wall: [gy, 1e4] });
    }
  }
  // ---- grand stairs down the north slope toward the trail ----
  {
    const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const start = new THREE.Vector3(S.x, 0, S.z).addScaledVector(dir, 13);
    const W = 5.5;
    let prevTop = T;
    for (let i = 0; i < 70; i++) {
      const d = i * 0.55;
      const p = start.clone().addScaledVector(dir, d);
      const g = heightAt(p.x, p.z);
      if (prevTop - g < 0.05 && i > 3) break;
      const top = Math.max(g + 0.12, Math.min(prevTop - 0.02, prevTop - 0.1 > g ? prevTop - Math.min(0.32, (prevTop - g) * 0.5 + 0.12) : g + 0.12));
      prevTop = top;
      const missing = R() < 0.08;
      const cracked = R() < 0.25;
      if (!missing) {
        const hh = top - g + 0.6;
        for (let part = 0; part < (cracked ? 2 : 1); part++) {
          const pw2 = cracked ? W / 2 - 0.05 : W;
          const off = cracked ? (part ? 1 : -1) * W / 4 : 0;
          P(M, 'ruin', box(pw2, hh, 0.62, 0.3, 'wall', R), mat(p.x + dir.z * off, top - hh / 2 - (cracked ? R() * 0.06 : 0), p.z - dir.x * off, (R() - 0.5) * (cracked ? 0.08 : 0.02), yaw + (R() - 0.5) * 0.03, (R() - 0.5) * (cracked ? 0.06 : 0.02)), null, { color: stoneC(R, 0.78), wall: [top - 0.25, 1e4] });
        }
        colliders.push({ type: 'box', x: p.x, z: p.z, hw: W / 2, hd: 0.3, rot: yaw, h: top - g + 0.3, y: g - 0.3 });
      }
      // cheek walls with occasional plinths
      if (i % 2 === 0) for (const sd of [-1, 1]) {
        if (R() < 0.2) continue;
        const q = p.clone().add(new THREE.Vector3(dir.z * sd * (W / 2 + 0.45), 0, -dir.x * sd * (W / 2 + 0.45)));
        const hh = top - heightAt(q.x, q.z) + 0.9 + (i % 10 === 0 ? 1.0 : 0);
        P(M, 'ruin', box(0.85, hh + 0.4, 1.12, 0.3, 'wall', R), mat(q.x, top + 0.9 - (hh + 0.4) / 2 + (i % 10 === 0 ? 1 : 0), q.z, 0, yaw, (R() - 0.5) * 0.04), null, { color: stoneC(R, 0.74), wall: [top, 1e4] });
      }
    }
  }
  out.T = T + TT; out.B = B;
  out.interact = new THREE.Vector3().setFromMatrixPosition(B).setY(T + TT);
  return out;
}
