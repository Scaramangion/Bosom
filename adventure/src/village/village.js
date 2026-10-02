// Brennan's Hollow — the farming village at LANDMARKS.village — plus the Old Shrine
// vista landmark and the river bridge. Everything static is merged per material
// (one draw call per material per chunk); crops/weeds are InstancedMeshes.
//
// Exposes ctx.village = { center, interactables:[{position,label,onInteract}], isOccupied(x,z,pad), shrine:{position, top} }
import * as THREE from 'three';
import * as layout from '../world/layout.js';
import { rng, loadBakedManifest } from './tex.js';
import { Merger, mat } from './kit.js';
import { makeMaterials, plantMaterial, shared } from './materials.js';
import { HOUSES, WINDMILL, WELL, SQUARE, ROADS, FIELDS, BRIDGE, SHRINE, CENTER, isOccupied } from './plan.js';
import { buildHouse, addBench } from './house.js';
import * as PR from './props.js';
import { buildShrine } from './shrine.js';
import { villager, LOOKS } from './npc.js';
import { smokeTex } from './tex.js';

const PI = Math.PI;

export async function init(ctx) {
  const __t0 = performance.now(); const __lap = (n) => console.log("[village] " + n + " " + Math.round(performance.now() - __t0));
  const heightAt = ctx.terrain?.heightAt || layout.heightAt;
  const R = rng(113);
  await loadBakedManifest();
  const M = makeMaterials();
  patchWindow(M.window); __lap("materials");
  const root = new THREE.Group(); root.name = 'village';
  ctx.scene.add(root);
  const colliders = [];
  const lamps = [];
  const chimneys = [];
  const interactables = [];
  const toast = (msg) => { ctx.emit && ctx.emit('toast', { text: msg }); if (ctx.hud?.toast) ctx.hud.toast(msg); };

  // ---------------- village chunk ----------------
  const MV = new Merger();
  const houseOut = {};
  for (const h of HOUSES) {
    const o = buildHouse(MV, h, heightAt, R);
    houseOut[h.id] = o;
    colliders.push(...o.colliders);
    chimneys.push(...o.chimneys);
    lamps.push(...o.lamps.map(p => p));
  }
  // door lanterns (positions came back from the facades)
  const doorLamps = lamps.splice(0);
  for (const p of doorLamps) {
    PR.lantern(MV, new THREE.Matrix4(), p.x, p.y, p.z, lamps);
  }
  PR.plaza(MV, SQUARE, heightAt, R);
  PR.well(MV, WELL, heightAt, R, { colliders });
  for (const r of ROADS) PR.ribbon(MV, 'path', r, r === ROADS[4] ? 2.6 : 2.4, heightAt, { lift: 0.07 });
  // short footpaths from each door to the nearest lane / square
  for (const h of HOUSES) {
    const o = houseOut[h.id]; const d = o.doorWorld;
    const tx = SQUARE.x + (d.x - SQUARE.x) * 0.55, tz = SQUARE.z + (d.z - SQUARE.z) * 0.55;
    const [fx, fz] = o.toW(0, h.d / 2 + 0.3);
    PR.ribbon(MV, 'path', [[fx, fz], [d.x, d.z], [(d.x + tx) / 2, (d.z + tz) / 2], [tx, tz]], 1.5, heightAt, { lift: 0.06 });
  }

  // --- inn dressing: barrels, crates, sign, benches ---
  const inn = houseOut.inn, innH = HOUSES[0];
  {
    const W = (lx, lz) => inn.toW(lx, lz);
    const sideX = innH.w / 2 + 0.9;
    for (const [lx, lz] of [[sideX, innH.d / 2 + 0.6], [sideX + 0.85, innH.d / 2 + 0.3], [sideX + 0.4, innH.d / 2 + 1.3]]) { const [x, z] = W(lx, lz); PR.barrel(MV, x, z, heightAt, R, colliders); }
    { const [x, z] = W(sideX + 0.45, innH.d / 2 + 0.75); PR.barrel(MV, x, z, heightAt, R, null, 0.95, 1.0); }
    for (const [lx, lz, sz, yo] of [[-sideX, innH.d / 2 + 0.5, 0.9, 0], [-sideX - 0.95, innH.d / 2 + 0.4, 0.8, 0], [-sideX - 0.4, innH.d / 2 + 0.5, 0.65, 0.9]]) {
      const [x, z] = W(lx, lz); PR.crate(MV, x, z, heightAt(x, z) - 0.02 + yo, innH.rot + R() * 0.3, sz, R, yo ? null : colliders);
    }
    // outdoor tables
    for (const lx of [-3, 3]) {
      const [x, z] = W(lx, innH.d / 2 + 4.6);
      const y = heightAt(x, z);
      const TB = mat(x, y, z, 0, innH.rot, 0);
      MV.add('plank', PR_box(1.9, 0.08, 0.9), TB.clone().multiply(mat(0, 0.78, 0)));
      for (const sx of [-0.8, 0.8]) MV.add('wood', PR_box(0.1, 0.76, 0.7), TB.clone().multiply(mat(sx, 0.38, 0)));
      addBench(MV, TB, 0, 0.85, 0, R, new THREE.Color(0xffffff));
      addBench(MV, TB, 0, -0.85, 0, R, new THREE.Color(0xffffff));
      PR.barrel(MV, ...W(lx + 1.6, innH.d / 2 + 5.2), heightAt, R, colliders, 0.6);
      colliders.push({ type: 'box', x, z, hw: 1.0, hd: 1.2, rot: innH.rot, h: 0.8 });
    }
  }
  // sign: iron bracket from the inn's front corner, board swings (separate small object)
  const sign = buildSign(ctx, M, inn, innH, R, MV);

  // --- market stall on the square ---
  stall(MV, SQUARE.x - 5.5, SQUARE.z - 3.0, 0.9, heightAt, R, colliders);
  { const B = mat(SQUARE.x + 4.8, heightAt(SQUARE.x + 4.8, SQUARE.z + 4.5), SQUARE.z + 4.5, 0, -2.3, 0); addBench(MV, B, 0, 0, 0, R, new THREE.Color(0xffffff)); }
  { const B = mat(SQUARE.x - 2.5, heightAt(SQUARE.x - 2.5, SQUARE.z + 6.2), SQUARE.z + 6.2, 0, PI + 0.3, 0); addBench(MV, B, 0, 0, 0, R, new THREE.Color(0xffffff)); }

  // --- lantern posts along the lanes ---
  for (const [x, z] of [[46, 13.2], [49, 23.5], [60, 26], [62.5, 15.5], [52.5, 7], [50, -6], [71, 24.5], [36, 20], [26, 34], [79, -3], [54, 34]]) PR.lanternPost(MV, x, z, heightAt, R, lamps, colliders);

  // --- domestic clutter ---
  {
    const h1 = houseOut.h1, H1 = HOUSES[1];
    const [wx, wz] = h1.toW(H1.w / 2 + 1.2, -0.5); PR.woodpile(MV, wx, wz, H1.rot + PI / 2, heightAt, R);
    const h4 = houseOut.h4, H4 = HOUSES[4];
    const [ax, az] = h4.toW(-H4.w / 2 - 1.3, 0.5); PR.woodpile(MV, ax, az, H4.rot - PI / 2, heightAt, R);
    const h2 = houseOut.h2, H2 = HOUSES[2];
    const [l0x, l0z] = h2.toW(H2.w / 2 + 1.6, 2.5), [l1x, l1z] = h2.toW(H2.w / 2 + 1.6, -4.0);
    PR.laundry(MV, l0x, l0z, l1x, l1z, heightAt, R);
    const h5 = houseOut.h5, H5 = HOUSES[5];
    for (let i = 0; i < 3; i++) { const [x, z] = h5.toW(-H5.w / 2 - 0.9, 1 - i * 0.95); PR.barrel(MV, x, z, heightAt, R, colliders); }
    const h3 = houseOut.h3, H3 = HOUSES[3];
    { const [x, z] = h3.toW(H3.w / 2 + 1.0, H3.d / 2 - 0.2); PR.crate(MV, x, z, heightAt(x, z), H3.rot, 0.8, R, colliders); PR.sack(MV, x + 0.9, heightAt(x + 0.9, z), z, R); PR.sack(MV, x + 0.6, heightAt(x, z + 0.7), z + 0.7, R); }
    const h6 = houseOut.h6, H6 = HOUSES[6];
    { const [x, z] = h6.toW(-H6.w / 2 - 2.5, 1.5); PR.cart(MV, x, z, H6.rot + 1.2, heightAt, R, colliders, 'sacks'); }
    const h7 = houseOut.h7, H7 = HOUSES[7];
    { const [x, z] = h7.toW(H7.w / 2 + 1.2, 1.2); PR.woodpile(MV, x, z, H7.rot + PI / 2, heightAt, R); }
  }
  // --- barn yard: cart, hay, fences (paddock) ---
  {
    const b = houseOut.barn, BH = HOUSES[8];
    { const [x, z] = b.toW(-3.5, BH.d / 2 + 4.5); PR.cart(MV, x, z, BH.rot + 0.5, heightAt, R, colliders, 'hay'); }
    for (const [lx, lz] of [[BH.w / 2 + 1.6, 4], [BH.w / 2 + 1.6, 2.4], [BH.w / 2 + 1.6, 0.8]]) {
      const [x, z] = b.toW(lx, lz); const y = heightAt(x, z);
      PR.hayBale(MV, x, y, z, BH.rot, R); PR.hayBale(MV, x, y + 0.48, z + 0.05, BH.rot + 0.05, R);
    }
    colliders.push({ type: 'box', x: b.toW(BH.w / 2 + 1.6, 2.4)[0], z: b.toW(BH.w / 2 + 1.6, 2.4)[1], hw: 0.55, hd: 2.4, rot: BH.rot, h: 1.0 });
    const pts = [[-BH.w / 2 - 1, -BH.d / 2 + 1], [-BH.w / 2 - 9, -BH.d / 2 + 1], [-BH.w / 2 - 9, BH.d / 2 - 2], [-BH.w / 2 - 1, BH.d / 2 - 2]].map(([a, c]) => b.toW(a, c));
    PR.fence(MV, pts, heightAt, R, colliders);
  }
  // --- fields: soil, fences, hay, stone walls ---
  for (const f of FIELDS) {
    PR.fieldSoil(MV, f, heightAt);
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const W = (lx, lz) => [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
    const hw = f.w / 2 + 0.8, hd = f.d / 2 + 0.8;
    // fence with a gate gap on the village side
    PR.fence(MV, [W(-hw + 3, -hd), W(hw, -hd), W(hw, hd), W(-hw, hd), W(-hw, -hd)], heightAt, R, colliders);
  }
  for (const [x, z] of [[89, 26.5], [91.5, 27.2], [113.5, 28], [96, 52.5], [70.5, 55]]) PR.hayRound(MV, x, z, heightAt, R, colliders);
  PR.stoneWall(MV, [[16, 46], [24, 49], [36, 50], [44, 53]], heightAt, R, colliders);
  PR.stoneWall(MV, [[70, -8], [62, -20], [58, -30]], heightAt, R, colliders);
  PR.stoneWall(MV, [[100, 12], [114, 14], [118, 24]], heightAt, R, colliders);
  PR.stoneWall(MV, [[26, -2], [30, -16], [36, -24]], heightAt, R, colliders);
  // --- windmill ---
  const MR = new Merger();
  const mill = PR.windmill(ctx, MV, MR, WINDMILL, heightAt, R, { colliders });
  MR.build(M, mill.spin);
  PR.ribbon(MV, 'path', [[WINDMILL.x - 2, WINDMILL.z + 3.5], [WINDMILL.x, WINDMILL.z + 4.2]], 2, heightAt);
  MV.build(M, root); __lap("village");

  // ---------------- bridge chunk ----------------
  const MB = new Merger();
  PR.bridge(MB, BRIDGE, heightAt, R, colliders);
  MB.build(M, root);

  // ---------------- shrine chunk ----------------
  const MS = new Merger();
  const shrine = buildShrine(MS, SHRINE, heightAt, R, colliders);
  MS.build(M, root); __lap("shrine");

  // ---------------- crops + weeds (instanced) ----------------
  const crops = PR.cropInstances(FIELDS, heightAt, R);
  const instances = [];
  const mkInst = (kind, list, w, h, colA, colB) => {
    if (!list.length) return;
    const m = new THREE.InstancedMesh(PR.plantGeo(w, h), plantMaterial(kind), list.length);
    const dummy = new THREE.Object3D(); const c = new THREE.Color();
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.yaw, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, c.set(colA).lerp(new THREE.Color(colB), p.c));
    });
    m.castShadow = false; m.receiveShadow = true;
    m.computeBoundingSphere();
    root.add(m); instances.push(m);
  };
  mkInst('wheat', crops.wheat, 0.9, 1.15, 0xffffff, 0xd8c890);
  mkInst('veg', crops.veg, 0.75, 0.55, 0xffffff, 0xc0e0a0);
  // weeds around the shrine and along the village walls
  const weeds = [];
  for (let i = 0; i < 900; i++) {
    const a = R() * PI * 2, rr = 3 + Math.sqrt(R()) * 16;
    const x = SHRINE.x + Math.cos(a) * rr, z = SHRINE.z + Math.sin(a) * rr;
    let y = heightAt(x, z);
    const top = shrine.T;
    if (rr < 8.8) y = top; else if (rr < 12.6) y = top - 1.2;
    weeds.push({ x, y, z, yaw: R() * PI, s: 0.5 + R() * 0.7, c: R() });
  }
  mkInst('weed', weeds, 0.9, 0.7, 0xffffff, 0xb0c080);

  // ---------------- chimney smoke ----------------
  const smoke = makeSmoke(chimneys);
  root.add(smoke.points);

  // ---------------- villagers ----------------
  const npcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const npcs = [];
  const spots = [
    { p: [SQUARE.x + 2.5, SQUARE.z + 4.5], face: [40, 30], label: 'Talk to Old Brennan', line: "Old Brennan: \"Koto! The Tellhouse has a fire going. Folk say the shrine stones hum at dusk.\"" },
    { p: inn.toW(-1.8, innH.d / 2 + 3.2), face: [40, 30], label: 'Talk to Maren', line: "Maren: \"Sudashorn was asking after you. Something about the old monolith on the hill.\"" },
    { p: [93, 25.5], face: [70, 20], label: 'Talk to Farmer Tobin', line: "Tobin: \"Best wheat in the Hollow this year. Mind the wolves past the fence line.\"" },
  ];
  spots.forEach((s, i) => {
    const g = villager(LOOKS[i]);
    const m = new THREE.Mesh(g, npcMat);
    m.castShadow = true; m.receiveShadow = true;
    const y = heightAt(s.p[0], s.p[1]);
    m.position.set(s.p[0], y, s.p[1]);
    m.rotation.y = Math.atan2(s.face[0] - s.p[0], s.face[1] - s.p[1]);
    m.userData.base = y; m.userData.phase = i * 1.7;
    root.add(m); npcs.push(m);
    colliders.push({ type: 'cylinder', x: s.p[0], z: s.p[1], r: 0.35, h: 1.8 });
    interactables.push({ position: m.position.clone().setY(y + 1.6), label: s.label, onInteract: () => toast(s.line), npc: m });
  });
  interactables.push({ position: inn.doorWorld.clone().setY(inn.doorWorld.y + 1), label: "Enter Brennan's Theme", onInteract: () => toast("Brennan's Theme — the Tellhouse. Laughter and fiddle music spill from inside.") });
  interactables.push({ position: new THREE.Vector3(WELL.x, heightAt(WELL.x, WELL.z) + 1, WELL.z), label: 'Draw water', onInteract: () => toast('Cold, clear water from the Hollow well.') });
  interactables.push({ position: shrine.monolith.clone(), label: 'Read the Monolith', onInteract: () => toast('The runes glow faintly: "What the Bosom keeps, the wilds return."') });

  for (const c of colliders) ctx.colliders.push(c);
  ctx.collidersDirty = true;
  ctx.village = {
    center: new THREE.Vector3(CENTER.x, heightAt(CENTER.x, CENTER.z), CENTER.z),
    interactables, isOccupied,
    shrine: { position: shrine.interact.clone(), top: shrine.top },
    root,
  };

  // ---------------- per-frame ----------------
  const tmp = new THREE.Vector3();
  return {
    update(dt, t) {
      shared.uTime.value = t;
      // dusk/night factor from the sun
      const sy = ctx.sunDir ? ctx.sunDir.y : (ctx.shot?.tod ? Math.sin((ctx.shot.tod - 0.25) * PI * 2) : 0.6);
      const night = 1 - THREE.MathUtils.smoothstep(sy, 0.0, 0.28);
      shared.uNight.value = night;
      M.window.emissiveIntensity = night * 2.4;
      M.lamp.emissiveIntensity = 0.15 + night * 4.0;
      M.glyph.emissiveIntensity = 0.8 + night * 2.5 + Math.sin(t * 1.3) * 0.25;
      mill.spin.rotation.z -= dt * 0.55;
      sign.rotation.x = Math.sin(t * 1.4) * 0.06 + Math.sin(t * 0.53) * 0.04;
      smoke.update(dt, t, night);
      for (const n of npcs) {
        const ph = t * 1.6 + n.userData.phase;
        n.position.y = n.userData.base + Math.abs(Math.sin(ph)) * 0.015;
        n.scale.set(1, 1 + Math.sin(ph * 2) * 0.008, 1);
        n.rotation.z = Math.sin(t * 0.7 + n.userData.phase) * 0.02;
      }
      // face the hero when close
      if (ctx.hero?.position) for (const n of npcs) {
        tmp.copy(ctx.hero.position).sub(n.position);
        if (tmp.lengthSq() < 36) {
          const target = Math.atan2(tmp.x, tmp.z);
          let d = target - n.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
          n.rotation.y += d * Math.min(1, dt * 3);
        }
      }
    },
  };
}

import { box as kbox } from './kit.js';
function PR_box(w, h, d) { return kbox(w, h, d, 0.6, 'top'); }

function patchWindow(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aWall; varying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aWall.x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;');
  };
  m.customProgramCacheKey = () => 'vwin';
}

function stall(M, x, z, yaw, heightAt, R, colliders) {
  const y = heightAt(x, z);
  const B = mat(x, y, z, 0, yaw, 0);
  M.add('plank', PR_box(2.8, 0.9, 1.0), B.clone().multiply(mat(0, 0.45, 0)), { color: 0xd8b890 });
  M.add('plank', PR_box(3.0, 0.08, 1.2), B.clone().multiply(mat(0, 0.94, 0)));
  for (const a of [-1.4, 1.4]) for (const b of [-0.5, 0.9]) M.add('wood', PR_box(0.12, b > 0 ? 2.5 : 2.1, 0.12), B.clone().multiply(mat(a, (b > 0 ? 2.5 : 2.1) / 2, b)));
  // striped canopy
  for (let i = 0; i < 8; i++) {
    const g = new THREE.PlaneGeometry(3.4 / 8, 2.0); g.rotateX(-PI / 2);
    M.add('canvas', g, B.clone().multiply(mat(-1.7 + (i + 0.5) * 3.4 / 8, 2.32, 0.2, -0.22, 0, 0, 1, 1, 1, 'XYZ')), { color: i % 2 ? 0xf0e8d8 : 0xb03a2e });
  }
  // valance
  for (let i = 0; i < 8; i++) { const g = new THREE.PlaneGeometry(3.4 / 8, 0.3); M.add('canvas', g, B.clone().multiply(mat(-1.7 + (i + 0.5) * 3.4 / 8, 1.95, 1.2)), { color: i % 2 ? 0xf0e8d8 : 0xb03a2e }); }
  // produce baskets
  const fruitCols = [0xc8322a, 0xe8a030, 0x6a9a3a, 0x8a4a9a];
  for (let k = 0; k < 4; k++) {
    const bx = -1.1 + k * 0.72;
    M.add('woodLight', new THREE.CylinderGeometry(0.3, 0.24, 0.18, 12, 1, true), B.clone().multiply(mat(bx, 1.07, 0.1)));
    for (let j = 0; j < 9; j++) {
      const g = new THREE.IcosahedronGeometry(0.075, 1);
      M.add('flower', g, B.clone().multiply(mat(bx + (R() - 0.5) * 0.36, 1.13 + R() * 0.07, 0.1 + (R() - 0.5) * 0.36)), { color: fruitCols[k] });
    }
  }
  PR.crate(M, ...[x - 1.0, z + 1.8].map((v, i) => v), y, yaw + 0.3, 0.6, R, null);
  colliders.push({ type: 'box', x, z, hw: 1.5, hd: 0.6, rot: yaw, h: 1.0 });
}

function buildSign(ctx, M, inn, innH, R, MV) {
  // bracket on the front-right corner of the upper storey
  const lx = innH.w / 2 - 0.2, lz = innH.d / 2 + 0.4 + 0.12, ly = 2.55;
  const base = inn.B.clone().multiply(mat(lx, ly, lz, 0, PI / 2, 0));
  MV.add('iron', PR_box(1.6, 0.07, 0.07), base.clone().multiply(mat(0, 0, 0.8 - 0.8, 0, PI / 2, 0)).multiply(mat(0, 0, 0)));
  MV.add('iron', PR_box(0.07, 0.07, 1.7), base.clone().multiply(mat(0, 0, 0.85)));
  MV.add('iron', PR_box(0.05, 0.05, 1.2), base.clone().multiply(mat(0, -0.45, 0.45, -0.75, 0, 0)));
  const g = new THREE.Group();
  const p = new THREE.Vector3(0, 0, 1.15).applyMatrix4(base);
  g.position.copy(p);
  g.rotation.set(0, innH.rot + PI / 2, 0, 'YXZ');
  const swing = new THREE.Group(); g.add(swing);
  const board = new THREE.Mesh(PR_box(0.08, 0.72, 1.35), M.plank); board.position.y = -0.55; board.castShadow = true;
  const face1 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.66), M.sign); face1.rotation.y = PI / 2; face1.position.set(0.045, -0.55, 0);
  const face2 = face1.clone(); face2.rotation.y = -PI / 2; face2.position.x = -0.045;
  for (const m of [board, face1, face2]) { m.geometry = m.geometry.clone(); ensureAttrs(m.geometry); swing.add(m); }
  for (const sz of [-0.5, 0.5]) { const ch = new THREE.Mesh(PR_box(0.02, 0.22, 0.02), M.iron); ensureAttrs(ch.geometry); ch.position.set(0, -0.1, sz); swing.add(ch); }
  ctx.scene.add(g);
  return swing;
}
function ensureAttrs(g) {
  const n = g.attributes.position.count;
  if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  if (!g.attributes.aWall) { const a = new Float32Array(n * 2); for (let i = 0; i < n; i++) { a[i * 2] = -1e4; a[i * 2 + 1] = 1e4; } g.setAttribute('aWall', new THREE.BufferAttribute(a, 2)); }
}

function makeSmoke(sources) {
  const PER = 26, N = sources.length * PER;
  const pos = new Float32Array(N * 3), colA = new Float32Array(N * 4), size = new Float32Array(N);
  const life = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { life[i] = Math.random(); seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colA, 4));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.PointsMaterial({ map: smokeTex(), size: 1, sizeAttenuation: true, transparent: true, depthWrite: false, vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSize;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
  };
  const points = new THREE.Points(g, m);
  points.frustumCulled = false;
  points.renderOrder = 2;
  const wind = new THREE.Vector3(0.9, 0, -0.35);
  return {
    points,
    update(dt, t, night) {
      const shade = 0.75 - night * 0.45;
      for (let s = 0; s < sources.length; s++) {
        const src = sources[s];
        for (let k = 0; k < PER; k++) {
          const i = s * PER + k;
          life[i] += dt / (7 + seed[i] * 3);
          if (life[i] > 1) { life[i] -= 1; seed[i] = Math.random(); }
          const L = life[i];
          const rise = L * 7.5;
          const drift = L * L * 6;
          pos[i * 3] = src.x + wind.x * drift + Math.sin(t * 0.7 + seed[i] * 20 + L * 4) * 0.4 * L;
          pos[i * 3 + 1] = src.y + rise;
          pos[i * 3 + 2] = src.z + wind.z * drift + Math.cos(t * 0.6 + seed[i] * 17 + L * 3) * 0.4 * L;
          size[i] = 0.6 + L * 3.8;
          const a = Math.min(1, L * 6) * (1 - L) * 0.55;
          colA[i * 4] = shade * (0.95 + seed[i] * 0.05); colA[i * 4 + 1] = shade * 0.96; colA[i * 4 + 2] = shade * 0.94; colA[i * 4 + 3] = a;
        }
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.aSize.needsUpdate = true;
    },
  };
}
