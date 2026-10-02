// Foliage: GPU wind grass + wildflowers, instanced stylized trees (old forest,
// foothill woods, lone field oaks), bushes, ferns and boulders. Pushes tree /
// rock colliders into ctx.colliders. Exposes ctx.foliage = { setGrassBend(x,z) }.
import * as THREE from 'three';
import { LANDMARKS, pathDist, riverDist, smoothstep, noise2, fbm } from './layout.js';
import { getTerrainData } from './terrainData.js';
import { buildGrass, buildFlowers, grassUniforms, updateFields } from './grass.js';
import { buildTrees, foliageUniforms, leafMaterial } from './trees.js';
import { buildRocks } from './rocks.js';
import { leafCard } from './textures.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const GRASS_COLORS = { lush: '#5f9431', dry: '#a5a843', deep: '#3c6e27' };

export function init(ctx) {
  const D = ctx.terrain?.data || getTerrainData();
  const colors = ctx.terrain?.grassColors || GRASS_COLORS;
  const H = (x, z) => D.height(x, z);
  const slopeAt = (x, z) => { const k = (Math.round(z + 400) * D.N + Math.round(x + 400)) * 3; return 1 - (D.normals[k + 1] ?? 1); };
  const inWorld = (x, z) => Math.abs(x) < 398 && Math.abs(z) < 398;
  const V = LANDMARKS.village, Sh = LANDMARKS.shrine;
  const clearOf = (x, z) => {
    if (Math.hypot(x - V.x, z - V.z) < 38) return false;
    if (Math.hypot(x - Sh.x, z - Sh.z) < 26) return false;
    if (Math.hypot(x, z) < 9) return false;
    if (riverDist(x, z) < 13) return false;
    return true;
  };

  // ------------------------------------------------------------ tree placement
  const R = rng(4242);
  const trees = [];
  const add = (kind, x, z, s, collide = true) => {
    const y = H(x, z);
    trees.push({ kind, x, y: y - 0.05, z, s, rot: R() * Math.PI * 2, v: Math.floor(R() * 6), sy: 0.9 + R() * 0.2 });
  };
  // composed hero trees framing the trail / meadow (Twilight-Princess style lone oaks)
  for (const [x, z, s, k] of [[-11, -62, 1.25, 'gnarled'], [27, -57, 1.15, 'oak'], [-16, 18, 1.1, 'oak'], [24, -24, 0.95, 'oak'], [-24, -4, 1.0, 'fir'], [38, -88, 1.05, 'gnarled'], [-6, -104, 1.1, 'fir'], [-30, -12, 1.2, 'fir'], [33, -36, 0.9, 'tall']]) add(k, x, z, s);
  const CELL = 4.2;
  for (let gz = -398; gz < 398; gz += CELL) for (let gx = -398; gx < 398; gx += CELL) {
    const x = gx + R() * CELL, z = gz + R() * CELL;
    const f = D.forestAt(x, z);
    const h = H(x, z);
    const r = Math.hypot(x, z);
    let p;
    if (f > 0.05) p = f * (r < 150 ? 0.55 : 0.2);           // old forest dense, foothill woods sparser per cell
    else p = 0.0035 * smoothstep(20, 60, r);                 // lone field trees
    if (R() > p) continue;
    if (h < 0.7 || !inWorld(x, z) || !clearOf(x, z)) continue;
    if (pathDist(x, z) < 3.5) continue;
    const sl = slopeAt(x, z);
    if (sl > 0.35) continue;
    let kind;
    const hi = smoothstep(25, 70, h);
    if (r > 150) kind = R() < 0.55 + hi * 0.4 ? 'fir' : (R() < 0.5 ? 'tall' : 'oak');
    else if (f > 0.05) { const u = R(); kind = u < 0.32 ? 'tall' : u < 0.52 ? 'oak' : u < 0.68 ? 'gnarled' : 'fir'; }
    else { const u = R(); kind = u < 0.5 ? 'oak' : u < 0.7 ? 'gnarled' : u < 0.85 ? 'fir' : 'tall'; }
    if (sl > 0.22 && kind !== 'fir') kind = 'fir';
    add(kind, x, z, kind === 'fir' ? 0.7 + R() * 0.8 : 0.7 + R() * 0.6);
  }
  // bushes: forest understory + edges, hedges along field noise bands
  const bushes = [];
  for (let i = 0; i < 9000 && bushes.length < 900; i++) {
    const x = (R() - 0.5) * 520, z = (R() - 0.5) * 520;
    const f = D.forestAt(x, z), h = H(x, z);
    const edge = f > 0.05 && f < 0.95 ? 1 : f > 0.95 ? 0.35 : 0;
    const hedge = smoothstep(0.55, 0.65, fbm(x * 0.03 + 9, z * 0.03, 2) + 0.5) * 0.08;
    if (R() > edge * 0.7 + hedge) continue;
    if (h < 0.6 || !clearOf(x, z) || pathDist(x, z) < 2.8 || slopeAt(x, z) > 0.3) continue;
    trees.push({ kind: 'bush', x, y: h - 0.15, z, s: 0.7 + R() * 0.8, rot: R() * 6.28, v: Math.floor(R() * 2), sy: 0.8 + R() * 0.4 });
    bushes.push(1);
  }
  const treeSys = buildTrees(ctx, trees);

  // ------------------------------------------------------------ rocks
  const rocks = [];
  const addRock = (x, z, s, moss, opts = {}) => {
    // sample the lowest ground under the footprint so nothing floats on slopes
    const rr = s * 0.9;
    const y = Math.min(H(x, z), H(x + rr, z), H(x - rr, z), H(x, z + rr), H(x, z - rr));
    const sl = slopeAt(x, z);
    rocks.push({ x, y: y - s * (0.2 + R() * 0.15 + sl * 0.6), z, s, sy: 0.7 + R() * 0.5, sz: 0.8 + R() * 0.4, rot: R() * 6.28, tilt: (R() - 0.5) * 0.3, tilt2: (R() - 0.5) * 0.3, v: Math.floor(R() * 4), moss, ...opts });
  };
  // hero boulders near the meadow/trail
  for (const [x, z, s] of [[-14, -40, 1.6], [17, -46, 1.1], [-20, 10, 1.3], [12, 18, 0.9], [30, -70, 1.8], [-4, -78, 0.8]]) addRock(x, z, s, true);
  for (let i = 0; i < 4000 && rocks.length < 520; i++) {
    const x = (R() - 0.5) * 790, z = (R() - 0.5) * 790;
    const h = H(x, z), sl = slopeAt(x, z), f = D.forestAt(x, z), r = Math.hypot(x, z);
    if (!clearOf(x, z) || h < -1.5) continue;
    let s = 0, moss = false;
    if (f > 0.3 && R() < 0.25) { s = 0.5 + R() * 1.4; moss = true; }               // mossy forest rocks
    else if (r > 200 && sl < 0.3 && R() < 0.35) { s = 1.5 + R() * 3.5; moss = R() < 0.4; } // foothill boulders
    else if (sl > 0.18 && sl < 0.5 && R() < 0.4) { s = 0.8 + R() * 2.0; }           // outcrops on slopes
    else if (Math.abs(h) < 0.8 && R() < 0.6) { s = 0.4 + R() * 1.2; }               // shore stones
    else if (R() < 0.04) { s = 0.6 + R() * 1.6; moss = R() < 0.5; }                  // field boulders
    if (!s) continue;
    if (pathDist(x, z) < 2.5 + s) continue;
    addRock(x, z, s, moss);
  }
  // pebbles at path edges
  for (let i = 0; i < 6000 && rocks.length < 900; i++) {
    const x = (R() - 0.5) * 300, z = (R() - 0.5) * 340 - 30;
    const pd = pathDist(x, z);
    if (pd < 1.5 || pd > 2.6 || !clearOf(x, z)) continue;
    if (R() < 0.6) addRock(x, z, 0.12 + R() * 0.25, false, { pebble: true });
  }
  buildRocks(ctx, rocks);

  // ------------------------------------------------------------ ferns (forest floor)
  buildFerns(ctx, D, R, clearOf);

  // ------------------------------------------------------------ colliders
  if (!ctx.colliders) ctx.colliders = [];
  for (const t of trees) {
    if (t.kind === 'bush' || !inWorld(t.x, t.z) || Math.hypot(t.x, t.z) > 330) continue;
    ctx.colliders.push({ type: 'cylinder', x: t.x, z: t.z, r: (t.kind === 'fir' ? 0.45 : 0.6) * t.s, h: 6, y: t.y, camera: false, src: 'tree' });
  }
  for (const r of rocks) {
    if (r.pebble || r.s < 0.6 || Math.hypot(r.x, r.z) > 330) continue;
    ctx.colliders.push({ type: 'cylinder', x: r.x, z: r.z, r: r.s * 1.05, h: r.s * r.sy * 0.75, y: r.y, src: 'rock' });
  }
  ctx.collidersDirty = true;

  // ------------------------------------------------------------ grass + flowers
  const grass = buildGrass(ctx, D.dataTex, colors);
  buildFlowers(ctx, D.dataTex);

  const bend = grassUniforms.uBend.value;
  ctx.foliage = {
    setGrassBend(x, z) { bend.set(x, z, 1e5, 1e5); },
    trees, rocks, grass,
  };
  const camPos = new THREE.Vector3();
  treeSys.update(ctx.camera.position, true);
  return {
    update(dt, t) {
      grassUniforms.uTime.value = t; foliageUniforms.uTime.value = t;
      ctx.camera.getWorldPosition(camPos);
      grassUniforms.uCam.value.copy(camPos);
      const hp = ctx.hero?.position || ctx.hero?.root?.position;
      if (hp) grassUniforms.uHero.value.copy(hp);
      if (ctx.sunDir) { grassUniforms.uSunDirW.value.copy(ctx.sunDir); foliageUniforms.uSunDirW.value.copy(ctx.sunDir); }
      if (ctx.sun) {
        grassUniforms.uSunCol.value.copy(ctx.sun.color).multiplyScalar(Math.min(1.5, ctx.sun.intensity / 3));
        foliageUniforms.uSunCol.value.copy(grassUniforms.uSunCol.value);
      }
      treeSys.update(camPos, false);
      updateFields(camPos, H);
    },
  };
}

function buildFerns(ctx, D, R, clearOf) {
  // fern = 7 arching fronds, each a 4-segment strip textured with the fern card
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const F = 7;
  for (let f = 0; f < F; f++) {
    const a = f / F * Math.PI * 2 + R() * 0.4, len = 0.9 + R() * 0.4, w = 0.32;
    const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const b = pos.length / 3;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4, rr = t * len, y = Math.sin(t * 2.2) * 0.55 * len - t * t * 0.25;
      for (const s of [-1, 1]) {
        pos.push(dx * rr + sx * s * w * 0.5, y, dz * rr + sz * s * w * 0.5);
        nrm.push(dx * 0.3, 1, dz * 0.3); uv.push(s < 0 ? 0 : 1, t);
        const ao = 0.45 + 0.55 * t; col.push(ao, ao, ao);
      }
      if (i < 4) { const k = b + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const list = [];
  for (let i = 0; i < 30000 && list.length < 2600; i++) {
    const x = -140 + R() * 150, z = -10 + R() * 140; // around the old forest
    const f = D.forestAt(x, z);
    if (R() > f * 0.9 || !clearOf(x, z)) continue;
    const h = D.height(x, z); if (h < 0.6) continue;
    if (pathDist(x, z) < 2) continue;
    list.push([x, h - 0.05, z, 0.7 + R() * 0.8, R() * 6.28]);
  }
  const m = new THREE.InstancedMesh(g, leafMaterial(leafCard('fern'), 0xd6e6b0, 'fern'), list.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion();
  list.forEach(([x, y, z, s, r], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r); M.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s)); m.setMatrixAt(i, M); });
  m.receiveShadow = true; m.castShadow = false; m.computeBoundingSphere();
  ctx.scene.add(m);
}
