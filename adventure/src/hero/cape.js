// Verlet-simulated cloth cape pinned across Koto's shoulders (chest bone space).
// Collides with capsules derived from the live skeleton (back, skirt, legs), the
// back-carried shield disk and the scabbard. Wind gusts + inertia from motion.
import * as THREE from 'three';

const NC = 13, NR = 16;
const TOP_W = 0.36, BOT_W = 0.68, LEN = 0.98;

export function buildCape(material) {
  const n = NC * NR;
  const P = new Float32Array(n * 3), O = new Float32Array(n * 3);
  const anchorsLocal = []; // chest-local anchors for top row
  for (let i = 0; i < NC; i++) {
    const s = i / (NC - 1) * 2 - 1; // -1..1 across (character right .. left)
    const x = s * TOP_W / 2 * 1.05;
    // wrap around the shoulders: corners come forward over the shoulder
    const z = -0.11 + 0.07 * Math.pow(Math.abs(s), 2.2);
    const y = 0.20 - 0.035 * Math.pow(Math.abs(s), 2);
    anchorsLocal.push(new THREE.Vector3(x, y, z));
  }
  // rest lengths
  const restH = [], restV = LEN / (NR - 1);
  for (let j = 0; j < NR; j++) restH.push((TOP_W + (BOT_W - TOP_W) * Math.pow(j / (NR - 1), 0.8)) / (NC - 1));
  const cons = [];
  const id = (i, j) => j * NC + i;
  for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
    if (i < NC - 1) cons.push([id(i, j), id(i + 1, j), restH[j], 1]);
    if (j < NR - 1) cons.push([id(i, j), id(i, j + 1), restV, 1]);
    if (i < NC - 1 && j < NR - 1) {
      const d = Math.hypot((restH[j] + restH[j + 1]) / 2, restV);
      cons.push([id(i, j), id(i + 1, j + 1), d, 0.5]); cons.push([id(i + 1, j), id(i, j + 1), d, 0.5]);
    }
    if (j < NR - 2) cons.push([id(i, j), id(i, j + 2), restV * 2, 0.3]);
    if (i < NC - 2) cons.push([id(i, j), id(i + 2, j), restH[j] * 2, 0.15]);
  }
  // geometry
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3); posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  const uv = new Float32Array(n * 2);
  for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) { uv[id(i, j) * 2] = i / (NC - 1); uv[id(i, j) * 2 + 1] = j / (NR - 1); }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NC - 1; i++) { const a = id(i, j), b = id(i + 1, j), c = id(i, j + 1), d = id(i + 1, j + 1); idx.push(a, b, c, b, d, c); }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;

  const v3 = new THREE.Vector3(), w3 = new THREE.Vector3(), ab = new THREE.Vector3(), ap = new THREE.Vector3();
  let inited = false, acc = 0, time = 0;
  const STEP = 1 / 90;
  const anchorsW = anchorsLocal.map(() => new THREE.Vector3());

  function reset(chest, back) {
    for (let i = 0; i < NC; i++) anchorsW[i].copy(anchorsLocal[i]).applyMatrix4(chest.matrixWorld);
    for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
      const k = id(i, j) * 3, a = anchorsW[i];
      const spread = (i / (NC - 1) - 0.5) * (BOT_W - TOP_W) * (j / (NR - 1));
      v3.set(a.x, a.y - j * restV, a.z).addScaledVector(back.right, spread).addScaledVector(back.dir, 0.05 * j / NR);
      P[k] = O[k] = v3.x; P[k + 1] = O[k + 1] = v3.y; P[k + 2] = O[k + 2] = v3.z;
    }
    inited = true;
  }

  function collideCapsule(k, a, b, r) {
    ab.subVectors(b, a); ap.set(P[k] - a.x, P[k + 1] - a.y, P[k + 2] - a.z);
    let t = ap.dot(ab) / Math.max(1e-6, ab.lengthSq()); t = Math.max(0, Math.min(1, t));
    v3.copy(a).addScaledVector(ab, t);
    w3.set(P[k] - v3.x, P[k + 1] - v3.y, P[k + 2] - v3.z);
    const d = w3.length();
    if (d < r && d > 1e-6) { w3.multiplyScalar((r - d) / d); P[k] += w3.x; P[k + 1] += w3.y; P[k + 2] += w3.z; }
  }

  // colliders: { caps: [[a,b,r]...], disk: {c, n, r} | null, ground: y }
  function step(chest, cols, wind, dt) {
    if (!inited) return;
    time += dt;
    for (let i = 0; i < NC; i++) anchorsW[i].copy(anchorsLocal[i]).applyMatrix4(chest.matrixWorld);
    const drag = 0.985;
    const gy = -9.8 * STEP * STEP;
    for (let p = 0; p < NR * NC; p++) {
      const k = p * 3, j = Math.floor(p / NC);
      if (j === 0) continue;
      const gust = 0.6 + 0.4 * Math.sin(time * 1.7 + p * 0.13) * Math.sin(time * 0.63 + (p % NC) * 0.4);
      const vx = (P[k] - O[k]) * drag, vy = (P[k + 1] - O[k + 1]) * drag, vz = (P[k + 2] - O[k + 2]) * drag;
      O[k] = P[k]; O[k + 1] = P[k + 1]; O[k + 2] = P[k + 2];
      const wk = STEP * STEP * gust * (j / NR);
      P[k] += vx + wind.x * wk; P[k + 1] += vy + gy + wind.y * wk; P[k + 2] += vz + wind.z * wk;
    }
    for (let it = 0; it < 6; it++) {
      for (let i = 0; i < NC; i++) { const k = i * 3; P[k] = anchorsW[i].x; P[k + 1] = anchorsW[i].y; P[k + 2] = anchorsW[i].z; }
      for (const [a, b, rest, stiff] of cons) {
        const ka = a * 3, kb = b * 3;
        const dx = P[kb] - P[ka], dy = P[kb + 1] - P[ka + 1], dz = P[kb + 2] - P[ka + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        // cloth resists stretching strongly, compresses freely-ish
        const diff = (d - rest) / d * (d > rest ? 0.5 : 0.5 * 0.4) * stiff;
        const fa = a < NC ? 0 : 1, fb = b < NC ? 0 : 1, tot = fa + fb || 1;
        P[ka] += dx * diff * 2 * fa / tot; P[ka + 1] += dy * diff * 2 * fa / tot; P[ka + 2] += dz * diff * 2 * fa / tot;
        P[kb] -= dx * diff * 2 * fb / tot; P[kb + 1] -= dy * diff * 2 * fb / tot; P[kb + 2] -= dz * diff * 2 * fb / tot;
      }
      for (let p = NC; p < NR * NC; p++) {
        const k = p * 3;
        for (const c of cols.caps) collideCapsule(k, c[0], c[1], c[2]);
        if (cols.disk) {
          const D = cols.disk;
          w3.set(P[k] - D.c.x, P[k + 1] - D.c.y, P[k + 2] - D.c.z);
          const h = w3.dot(D.n);
          const rad = Math.sqrt(Math.max(0, w3.lengthSq() - h * h));
          if (rad < D.r + 0.03 && h > -0.03 && h < 0.06) { const push = -0.03 - h; P[k] += D.n.x * push; P[k + 1] += D.n.y * push; P[k + 2] += D.n.z * push; }
        }
        if (P[k + 1] < cols.ground + 0.02) P[k + 1] = cols.ground + 0.02;
      }
    }
  }

  return {
    mesh, anchorsLocal,
    reset,
    update(chest, cols, wind, dt, back) {
      if (!inited || dt > 0.25) { reset(chest, back); }
      acc = Math.min(acc + dt, STEP * 6);
      while (acc >= STEP) { step(chest, cols, wind, STEP); acc -= STEP; }
      let ok = true;
      for (let k = 0; k < P.length; k += 7) if (!Number.isFinite(P[k])) { ok = false; break; }
      if (!ok) reset(chest, back);
      posAttr.array.set(P); posAttr.needsUpdate = true;
      geo.computeVertexNormals();
      if (!geo.boundingSphere) geo.boundingSphere = new THREE.Sphere();
      geo.boundingSphere.center.set(P[0], P[1], P[2]); geo.boundingSphere.radius = 2;
    },
    teleport(dx, dy, dz) { for (let k = 0; k < P.length; k += 3) { P[k] += dx; O[k] += dx; P[k + 1] += dy; O[k + 1] += dy; P[k + 2] += dz; O[k + 2] += dz; } },
  };
}
