// Timber-frame / stone farmhouses, the inn and the barn, emitted into a Merger.
import * as THREE from 'three';
import { mat, box, boxB, cyl, gable, quad } from './kit.js';

const PI = Math.PI;
const SHUTTERS = [0x3f6a52, 0x2f5a78, 0x8a3a2a, 0x5c6d3a, 0x6b4a7a, 0x355f6a];
const DOORS = [0x6a4428, 0x3c5a6e, 0x7a3326, 0x4b5e34, 0x5a3a22];
const FLOWERS = [0xd8434a, 0xf2c94c, 0xe88fb4, 0xffffff, 0x8e6bd1, 0xff8a3a];

// put geometry `g` into merger with matrix = base * local
function P(M, key, g, base, local, opts) { const m = local ? base.clone().multiply(local) : base; M.add(key, g, m, opts); }

export function buildHouse(M, h, heightAt, R) {
  const out = { chimneys: [], colliders: [], doorWorld: null, lamps: [], windows: 0 };
  const barn = !!h.barn, stone = !!h.stone;
  const H1 = barn ? 4.2 : 2.9, H2 = 2.6;
  const floors = h.floors || 1;
  const J = h.jetty && floors > 1 ? 0.4 : 0;
  const c = Math.cos(h.rot), s = Math.sin(h.rot);
  const toW = (lx, lz) => [h.x + lx * c + lz * s, h.z - lx * s + lz * c];
  // ground under the footprint
  let gMin = 1e9, gMax = -1e9;
  for (let i = -1; i <= 1; i += 0.5) for (let j = -1; j <= 1.6; j += 0.5) {
    const [wx, wz] = toW(i * h.w / 2, j * h.d / 2);
    const g = heightAt(wx, wz); gMin = Math.min(gMin, g); gMax = Math.max(gMax, g);
  }
  const F = gMax + (barn ? 0.15 : 0.45);
  const B = mat(h.x, F, h.z, 0, h.rot, 0);
  const shutterCol = new THREE.Color(SHUTTERS[Math.floor(R() * SHUTTERS.length)]);
  const doorCol = new THREE.Color(DOORS[Math.floor(R() * DOORS.length)]);
  const plasterCol = new THREE.Color(h.tint || 0xf0e4c8);
  const woodCol = new THREE.Color().setHSL(0.07, 0.25, 0.8 + R() * 0.25);
  const stoneCol = new THREE.Color().setHSL(0.09, 0.08, 0.85 + R() * 0.2);
  const wallMat = barn ? 'plankRed' : stone ? 'stone' : 'plaster';
  const wallCol = barn ? new THREE.Color(1, 1, 1) : stone ? stoneCol : plasterCol;
  const wallS = barn ? 0.45 : 0.5;

  // ---- foundation plinth ----
  const fh = F - gMin + 0.6;
  P(M, 'stone', box(h.w + 0.35, fh, h.d + 0.35, 0.5, 'wall', R), B, mat(0, -fh / 2 + 0.02, 0), { color: stoneCol, wall: [gMin, F + 3] });

  // ---- walls per floor ----
  const floorsDef = [{ y0: 0, y1: H1, d: h.d }];
  if (floors > 1) floorsDef.push({ y0: H1, y1: H1 + H2, d: h.d + 2 * J });
  const Y = floorsDef[floorsDef.length - 1].y1;
  for (let fi = 0; fi < floorsDef.length; fi++) {
    const f = floorsDef[fi];
    const hgt = f.y1 - f.y0;
    // stone houses: masonry ground floor, timber upper floor
    const isStone = stone && fi === 0;
    const mtl = barn ? 'plankRed' : isStone ? 'stone' : 'plaster';
    const col = barn ? wallCol : isStone ? stoneCol : plasterCol;
    P(M, mtl, box(h.w - 0.08, hgt, f.d - 0.08, wallS, barn ? 'wall' : 'wall', R), B, mat(0, f.y0 + hgt / 2, 0), { color: col, wall: [F - (fi ? 0 : 0), F + Y] });
    if (fi === 1 && J > 0) {
      // jetty: floor beam + joist ends under the overhang
      for (const sd of [1, -1]) {
        P(M, 'wood', box(h.w + 0.1, 0.26, 0.22, 0.5, 'grain', R), B, mat(0, f.y0 + 0.02, sd * (f.d / 2 - 0.08)), { color: woodCol });
        for (let u = -h.w / 2 + 0.3; u <= h.w / 2 - 0.2; u += 0.55)
          P(M, 'wood', box(0.16, 0.18, J + 0.25, 0.5, 'grain', R), B, mat(u, f.y0 - 0.16, sd * (h.d / 2 + (J + 0.25) / 2 - 0.1)), { color: woodCol });
      }
    }
    const faces = [
      { yaw: 0, len: h.w, off: f.d / 2, front: true },
      { yaw: PI / 2, len: f.d, off: h.w / 2 },
      { yaw: PI, len: h.w, off: f.d / 2 },
      { yaw: -PI / 2, len: f.d, off: h.w / 2 },
    ];
    for (const fc of faces) {
      const FM = B.clone().multiply(mat(0, 0, 0, 0, fc.yaw, 0)).multiply(mat(0, 0, fc.off));
      buildFace(M, FM, fc, f, fi, { barn, stone: isStone, timber: !isStone && !barn, R, shutterCol, doorCol, woodCol, stoneCol, F, out, sideFace: fc.yaw !== 0 && fc.yaw !== PI, gableSide: h.ridge === 'z' ? (fc.yaw === 0 || fc.yaw === PI) : (fc.yaw !== 0 && fc.yaw !== PI) });
    }
    // floor band between storeys
    if (fi === 1 && J === 0) P(M, 'wood', box(h.w + 0.12, 0.24, f.d + 0.12, 0.5, 'grain', R), B, mat(0, f.y0, 0), { color: woodCol });
  }

  // ---- roof ----
  const roofKey = h.roof === 'thatch' ? 'thatch' : h.roof;
  const ridgeX = h.ridge !== 'z';
  const topD = floorsDef[floorsDef.length - 1].d;
  const rw = ridgeX ? h.w : topD, rd = ridgeX ? topD : h.w;
  const RF = B.clone().multiply(mat(0, Y, 0, 0, ridgeX ? 0 : PI / 2, 0));
  const th = h.pitch || 0.8;
  const thatch = roofKey === 'thatch';
  const hs = rd / 2, o = thatch ? 0.75 : 0.55, gO = thatch ? 0.55 : 0.4, t = thatch ? 0.55 : 0.16;
  const L = rw + 2 * gO, S = (hs + o) / Math.cos(th);
  const rise = hs * Math.tan(th);
  const ridgeY = rise + t / Math.cos(th);
  const roofS = 1 / 3;
  for (const side of [0, 1]) {
    const SM = RF.clone().multiply(mat(0, 0, 0, 0, side * PI, 0)).multiply(mat(0, ridgeY, 0, th, 0, 0, 1, 1, 1, 'XYZ'));
    P(M, roofKey, box(L, t, S, roofS, 'top', R), SM, mat(0, -t / 2, S / 2));
    if (thatch) {
      // rounded eave roll + tucked gable edges
      const roll = cyl(t * 0.55, t * 0.55, L, 10, roofS); roll.rotateZ(PI / 2);
      P(M, 'thatch', roll, SM, mat(0, -t * 0.5, S - 0.05));
      for (const gx of [-1, 1]) { const e = cyl(t * 0.5, t * 0.5, S, 8, roofS); e.rotateX(PI / 2); P(M, 'thatch', e, SM, mat(gx * (L / 2 - 0.02), -t * 0.5, S / 2)); }
    } else {
      // bargeboards, fascia, rafter tails
      for (const gx of [-1, 1]) P(M, 'wood', box(0.07, 0.3, S + 0.05, 0.5, 'grain', R), SM, mat(gx * (L / 2 - 0.02), -t - 0.05, S / 2), { color: woodCol });
      P(M, 'wood', box(L, 0.22, 0.07, 0.5, 'grain', R), SM, mat(0, -t - 0.04, S - 0.02), { color: woodCol });
      const ol = o / Math.cos(th) + 0.25;
      for (let u = -rw / 2 + 0.2; u <= rw / 2; u += 0.62) P(M, 'wood', box(0.12, 0.15, ol, 0.5, 'grain', R), SM, mat(u, -t - 0.08, S - ol / 2 - 0.02), { color: woodCol });
    }
  }
  // ridge cap
  if (thatch) {
    const rc = cyl(0.42, 0.42, L + 0.1, 12, roofS); rc.rotateZ(PI / 2); rc.scale(1, 0.75, 1);
    P(M, 'thatch', rc, RF, mat(0, ridgeY - 0.12, 0));
    // decorative ridge pegs (spars)
    for (let u = -L / 2 + 0.4; u < L / 2; u += 0.5) for (const sd of [-1, 1]) {
      const sp = box(0.04, 0.04, 0.6, 1, 'grain', R);
      P(M, 'woodLight', sp, RF, mat(u, ridgeY - 0.2, sd * 0.35, sd * 0.5, 0, 0));
    }
  } else {
    const rc = cyl(0.13, 0.13, L + 0.06, 8, roofS); rc.rotateZ(PI / 2);
    P(M, roofKey, rc, RF, mat(0, ridgeY + 0.02, 0));
  }
  // gable walls + gable framing
  for (const gx of [-1, 1]) {
    const gm = barn ? 'plankRed' : stone && floors === 1 ? 'stone' : 'plaster';
    const gc = barn ? wallCol : stone && floors === 1 ? stoneCol : plasterCol;
    const gg = gable(rd - 0.08, rise, 0.1, wallS); gg.rotateY(PI / 2);
    P(M, gm, gg, RF, mat(gx * (rw / 2 - 0.08), 0, 0), { color: gc, wall: [F - 10, F + Y + rise] });
    if (!barn && gm === 'plaster') {
      const GF = RF.clone().multiply(mat(gx * (rw / 2 - 0.02), 0, 0, 0, gx * PI / 2, 0));
      P(M, 'wood', box(rd + 0.1, 0.22, 0.14, 0.5, 'grain', R), GF, mat(0, 0.08, 0), { color: woodCol });
      P(M, 'wood', box(0.2, rise * 0.92, 0.14, 0.5, 'grain', R), GF, mat(0, rise * 0.46, 0), { color: woodCol });
      const cw = rd * (1 - 0.5) - 0.2;
      P(M, 'wood', box(cw, 0.18, 0.14, 0.5, 'grain', R), GF, mat(0, rise * 0.5, 0), { color: woodCol });
      // struts
      for (const sd of [-1, 1]) {
        const a = Math.atan2(rise * 0.5, rd * 0.25);
        P(M, 'wood', box(Math.hypot(rd * 0.25, rise * 0.5), 0.16, 0.13, 0.5, 'grain', R), GF, mat(sd * rd * 0.125, rise * 0.25, 0, 0, 0, sd * a), { color: woodCol });
      }
      // little gable vent/window
      if (R() > 0.4) addWindow(M, GF, 0, rise * 0.22 + 0.15, 0.6, 0.55, { R, shutterCol, woodCol, out, noShutter: true });
    }
    if (barn) {
      // hay loft door
      const GF = RF.clone().multiply(mat(gx * (rw / 2 - 0.02), 0, 0, 0, gx * PI / 2, 0));
      P(M, 'plank', box(1.6, 1.4, 0.08, 0.5, 'wall', R), GF, mat(0, rise * 0.3, 0.03), { color: 0xd9cfc0 });
      P(M, 'wood', box(1.8, 0.14, 0.12, 0.5, 'grain', R), GF, mat(0, rise * 0.3 + 0.75, 0.05), { color: woodCol });
    }
  }
  // ---- chimneys ----
  for (const cs of (h.chimneys || [])) {
    const cx = cs * (rw / 2 - 0.75), cz = -hs * 0.3;
    const yTop = ridgeY + 0.9;
    const y0 = -0.2;
    P(M, 'stone', box(0.8, yTop - y0, 0.8, 0.6, 'wall', R), RF, mat(cx, (yTop + y0) / 2, cz), { color: stoneCol, wall: [-1e4, F + Y + yTop] });
    P(M, 'stone', box(1.0, 0.16, 1.0, 0.6, 'wall', R), RF, mat(cx, yTop + 0.02, cz), { color: stoneCol });
    const pot = cyl(0.16, 0.2, 0.45, 10, 1); P(M, 'redtile', pot, RF, mat(cx + 0.12, yTop + 0.3, cz + 0.05), { color: 0xc07a5a });
    const pw = new THREE.Vector3(cx + 0.12, yTop + 0.55, cz + 0.05).applyMatrix4(RF);
    out.chimneys.push(pw);
  }
  // ---- porch / steps ----
  const front = h.d / 2;
  if (h.porch) {
    const pd = 2.1, pw = Math.min(h.w - 0.6, 7);
    const deckTop = 0;
    P(M, 'plankGrey', box(pw, 0.16, pd, 0.5, 'top', R), B, mat(0, deckTop - 0.08, front + pd / 2), { color: 0xffffff });
    // under-deck stone supports
    const [fx, fz] = toW(0, front + pd);
    const gF = heightAt(fx, fz);
    const drop = F - gF;
    for (const u of [-pw / 2 + 0.2, pw / 2 - 0.2]) P(M, 'stone', box(0.35, drop + 0.5, 0.35, 0.5, 'wall', R), B, mat(u, -0.16 - (drop + 0.5) / 2 + 0.1, front + pd - 0.2), { color: stoneCol });
    const roofed = floors > 1 || !ridgeX;
    const postH = roofed ? 2.55 : (Y - (o * 0.6) * Math.tan(th) - 0.15);
    for (const u of [-pw / 2 + 0.15, pw / 2 - 0.15]) {
      P(M, 'wood', box(0.2, postH, 0.2, 0.5, 'grain', R), B, mat(u, postH / 2, front + pd - 0.2), { color: woodCol });
      // knee braces
      P(M, 'wood', box(0.1, 0.7, 0.1, 0.5, 'grain', R), B, mat(u - Math.sign(u) * 0.22, postH - 0.35, front + pd - 0.2, 0, 0, Math.sign(u) * 0.7), { color: woodCol });
    }
    P(M, 'wood', box(pw, 0.22, 0.22, 0.5, 'grain', R), B, mat(0, postH, front + pd - 0.2), { color: woodCol });
    if (roofed) {
      const a = 0.32, len = (pd + 0.4) / Math.cos(a);
      P(M, roofKey, box(pw + 0.6, thatch ? 0.3 : 0.12, len, roofS, 'top', R), B, mat(0, postH + 0.32, front + (pd + 0.4) / 2, a, 0, 0, 1, 1, 1, 'XYZ'));
      P(M, 'wood', box(pw + 0.3, 0.18, 0.18, 0.5, 'grain', R), B, mat(0, postH + 0.75, front + 0.1), { color: woodCol });
    }
    // railing on the sides
    for (const u of [-pw / 2 + 0.06, pw / 2 - 0.06]) {
      P(M, 'wood', box(0.08, 0.08, pd - 0.3, 0.5, 'grain', R), B, mat(u, 0.9, front + pd / 2), { color: woodCol });
      for (let k = 0; k < 4; k++) P(M, 'wood', box(0.06, 0.9, 0.06, 0.5, 'grain', R), B, mat(u, 0.45, front + 0.3 + k * (pd - 0.6) / 3), { color: woodCol });
    }
    addSteps(M, B, 0, front + pd, drop, 1.6, R, stoneCol, 'plankGrey');
    out.colliders.push({ type: 'box', x: toW(0, front + pd / 2)[0], z: toW(0, front + pd / 2)[1], hw: pw / 2, hd: pd / 2, rot: h.rot, h: drop, y: gF });
    // bench on the porch
    addBench(M, B, pw / 2 - 1.2, front + 0.45, 0, R, woodCol);
  } else if (!barn) {
    const [fx, fz] = toW(0, front + 0.5);
    addSteps(M, B, 0, front + 0.05, F - heightAt(fx, fz), 1.5, R, stoneCol, 'stone');
  }
  const [dx, dz] = toW(0, front + (h.porch ? 2.6 : 1.4));
  out.doorWorld = new THREE.Vector3(dx, heightAt(dx, dz), dz);
  out.colliders.push({ type: 'box', x: h.x, z: h.z, hw: h.w / 2 + 0.15, hd: h.d / 2 + J + 0.15, rot: h.rot, h: F - gMin + Y + rise, y: gMin });
  out.F = F; out.Y = Y; out.toW = toW; out.B = B; out.woodCol = woodCol; out.stoneCol = stoneCol;
  return out;
}

function addSteps(M, B, u, z0, drop, width, R, col, key) {
  if (drop < 0.12) return;
  const n = Math.max(1, Math.round(drop / 0.2)), rh = drop / n;
  for (let i = 0; i < n; i++) {
    const top = -rh * (i + 1) + 0.02;
    P(M, key, box(width + (key === 'stone' ? R() * 0.15 : 0), rh * (i + 1) + 0.3, 0.34, 0.5, key === 'stone' ? 'wall' : 'top', R), B, mat(u + (key === 'stone' ? (R() - 0.5) * 0.06 : 0), top + rh - (rh * (i + 1) + 0.3) / 2, z0 + 0.17 + i * 0.34, 0, (R() - 0.5) * 0.04, 0), { color: col });
  }
}

export function addBench(M, B, x, z, y, R, woodCol, yaw = 0) {
  const BM = B.clone().multiply(mat(x, y, z, 0, yaw, 0));
  P(M, 'plank', box(1.7, 0.08, 0.4, 0.6, 'top', R), BM, mat(0, 0.46, 0), { color: 0xffffff });
  for (const sx of [-0.7, 0.7]) P(M, 'wood', box(0.08, 0.44, 0.34, 0.5, 'grain', R), BM, mat(sx, 0.22, 0), { color: woodCol });
}

function addWindow(M, FM, u, yb, ww, wh, o) {
  const { R, shutterCol, woodCol, out } = o;
  const glow = R() < 0.72 ? 0.6 + R() * 0.6 : 0.05;
  const g = quad(ww, wh);
  P(M, 'window', g, FM, mat(u, yb + wh / 2, 0.04), { wall: [glow, 0] });
  out.windows++;
  const ft = 0.1;
  P(M, 'wood', box(ww + ft * 2, ft, 0.14, 0.5, 'grain', R), FM, mat(u, yb + wh + ft / 2, 0.07), { color: woodCol });
  P(M, 'wood', box(ww + 0.36, 0.08, 0.24, 0.5, 'grain', R), FM, mat(u, yb - 0.04, 0.1), { color: woodCol });
  for (const sd of [-1, 1]) P(M, 'wood', box(ft, wh, 0.14, 0.5, 'grain', R), FM, mat(u + sd * (ww / 2 + ft / 2), yb + wh / 2, 0.07), { color: woodCol });
  if (!o.noShutter && R() < 0.65) {
    for (const sd of [-1, 1]) {
      const sw = ww / 2 + 0.05;
      const ang = sd * (0.15 + R() * 0.25);
      P(M, 'plank', box(sw, wh + 0.05, 0.05, 0.9, 'wall', R), FM, mat(u + sd * (ww / 2 + ft + sw / 2) + 0.0, yb + wh / 2, 0.1 + Math.abs(ang) * 0.3, 0, ang, 0), { color: shutterCol });
    }
  }
  if (!o.noShutter && R() < 0.45) {
    // flower box
    P(M, 'plank', box(ww + 0.2, 0.22, 0.24, 0.8, 'wall', R), FM, mat(u, yb - 0.2, 0.22), { color: 0x9a7a5a });
    const fc = new THREE.Color(FLOWERS[Math.floor(R() * FLOWERS.length)]);
    for (let k = 0; k < 7; k++) {
      const b = new THREE.IcosahedronGeometry(0.09 + R() * 0.05, 0);
      P(M, 'flower', b, FM, mat(u - ww / 2 + 0.05 + (k + 0.5) * (ww + 0.1) / 7, yb - 0.04 + R() * 0.08, 0.22 + (R() - 0.5) * 0.1), { color: k % 2 ? 0x3e6a2a : fc });
    }
  }
}

function buildFace(M, FM, fc, f, fi, o) {
  const { R, woodCol, out } = o;
  const len = fc.len, y0 = f.y0, y1 = f.y1, hgt = y1 - y0;
  const n = Math.max(2, Math.round(len / (o.barn ? 3 : 1.55)));
  const pw = len / n;
  const slots = new Array(n).fill('plain');
  if (fc.front && fi === 0) slots[Math.floor((n - 1) / 2 + (n % 2 === 0 ? 0.5 : 0))] = 'door';
  for (let i = 0; i < n; i++) {
    if (slots[i] !== 'plain') continue;
    const corner = i === 0 || i === n - 1;
    if (o.barn) { slots[i] = corner ? 'plain' : 'plain'; continue; }
    if (fc.front) slots[i] = (fi === 1 || !corner || n <= 3) ? (i % 2 === 0 || fi === 1 ? 'window' : 'brace') : 'brace';
    else slots[i] = (i % 2 === 1 && R() < 0.85) || (n === 2 && i === 1) ? 'window' : corner ? 'brace' : 'plain';
    if (corner && slots[i] === 'window' && fc.front && fi === 0 && n > 3) slots[i] = 'brace';
  }
  const timber = o.timber;
  const proud = 0.05;
  if (timber) {
    P(M, 'wood', box(len + 0.06, 0.22, 0.16, 0.5, 'grain', R), FM, mat(0, y0 + 0.11, proud), { color: woodCol });
    P(M, 'wood', box(len + 0.06, 0.2, 0.16, 0.5, 'grain', R), FM, mat(0, y1 - 0.1, proud), { color: woodCol });
    for (let i = 0; i <= n; i++) {
      const u = -len / 2 + i * pw;
      const w = i === 0 || i === n ? 0.24 : 0.17;
      P(M, 'wood', box(w, hgt, 0.15, 0.5, 'grain', R), FM, mat(u + (i === 0 ? 0.08 : i === n ? -0.08 : 0), y0 + hgt / 2, proud), { color: woodCol });
    }
  } else if (o.stone) {
    // quoins
    for (const sd of [-1, 1]) for (let y = y0 + 0.15; y < y1 - 0.2; y += 0.55) {
      const big = Math.round((y - y0) / 0.55) % 2 === 0;
      P(M, 'stone', box(big ? 0.7 : 0.45, 0.5, 0.12, 0.6, 'wall', R), FM, mat(sd * (len / 2 - (big ? 0.3 : 0.18)), y + 0.25, 0.04), { color: o.stoneCol.clone().multiplyScalar(1.12) });
    }
  } else if (o.barn) {
    // barn: framed corners + white trim
    for (const sd of [-1, 1]) P(M, 'plank', box(0.25, hgt, 0.08, 0.5, 'wall', R), FM, mat(sd * (len / 2 - 0.1), y0 + hgt / 2, 0.04), { color: 0xe8e0d0 });
    P(M, 'plank', box(len, 0.22, 0.08, 0.5, 'wall', R), FM, mat(0, y1 - 0.11, 0.04), { color: 0xe8e0d0 });
  }
  for (let i = 0; i < n; i++) {
    const uc = -len / 2 + (i + 0.5) * pw;
    const sl = slots[i];
    if (sl === 'door') {
      const dw = o.barn ? Math.min(pw * 0.85, 3.2) : 1.1, dh = o.barn ? 3.2 : 2.05;
      P(M, 'plank', box(dw, dh, 0.08, o.barn ? 0.5 : 0.9, 'wall', R), FM, mat(uc, y0 + dh / 2, 0.02), { color: o.barn ? 0xffffff : o.doorCol });
      if (o.barn) {
        // white X bracing on barn doors
        for (const sd of [-1, 1]) {
          const hw = dw / 4;
          P(M, 'plank', box(0.16, Math.hypot(dw / 2, dh) - 0.2, 0.06, 0.5, 'wall', R), FM, mat(uc + sd * hw, y0 + dh / 2, 0.08, 0, 0, Math.atan2(dw / 2, dh) * sd), { color: 0xe8e0d0 });
        }
        P(M, 'plank', box(dw, 0.16, 0.06, 0.5, 'wall', R), FM, mat(uc, y0 + dh / 2, 0.09), { color: 0xe8e0d0 });
      } else {
        // strap hinges + ring
        for (const yy of [0.4, 1.6]) P(M, 'iron', box(0.55, 0.05, 0.02, 1, 'wall', R), FM, mat(uc - dw / 2 + 0.3, y0 + yy, 0.075));
        const ring = new THREE.TorusGeometry(0.06, 0.012, 6, 12); P(M, 'iron', ring, FM, mat(uc + dw / 2 - 0.18, y0 + 1.0, 0.08));
        // lantern beside door
        out.lamps.push(new THREE.Vector3(uc + dw / 2 + 0.45, y0 + 2.05, 0.22).applyMatrix4(FM));
      }
      const ft = 0.14;
      P(M, 'wood', box(dw + ft * 2 + 0.1, ft + 0.04, 0.2, 0.5, 'grain', R), FM, mat(uc, y0 + dh + ft / 2, 0.08), { color: woodCol });
      for (const sd of [-1, 1]) P(M, 'wood', box(ft, dh, 0.18, 0.5, 'grain', R), FM, mat(uc + sd * (dw / 2 + ft / 2), y0 + dh / 2, 0.07), { color: woodCol });
    } else if (sl === 'window') {
      const ww = Math.min(pw - 0.5, fi === 0 ? 1.0 : 0.9), wh = fi === 0 ? 1.1 : 1.0;
      if (ww > 0.35) addWindow(M, FM, uc, y0 + (fi === 0 ? 1.0 : 0.8), ww, wh, o);
      if (timber) P(M, 'wood', box(pw, 0.15, 0.14, 0.5, 'grain', R), FM, mat(uc, y0 + (fi === 0 ? 0.9 : 0.7), proud), { color: woodCol });
    } else if (sl === 'brace' && timber) {
      const a0 = y0 + 0.2, a1 = y1 - 0.2;
      const dir = i < n / 2 ? 1 : -1;
      const ang = Math.atan2(a1 - a0, pw - 0.15) * dir;
      P(M, 'wood', box(Math.hypot(pw - 0.15, a1 - a0), 0.15, 0.14, 0.5, 'grain', R), FM, mat(uc, (a0 + a1) / 2, proud, 0, 0, ang), { color: woodCol });
    } else if (sl === 'plain' && timber) {
      P(M, 'wood', box(pw, 0.15, 0.14, 0.5, 'grain', R), FM, mat(uc, y0 + hgt * 0.45, proud), { color: woodCol });
    }
  }
}
