// Stylized procedural trees: thick barked trunks with root flare + branches,
// canopies of layered alpha-cutout leaf cards with spherical "soft canopy"
// normals, baked AO in vertex colour, GPU wind and sun translucency.
// Instanced per variant with a near / far LOD swap driven by camera distance.
import * as THREE from 'three';
import { bark, normalMap, leafCard } from './textures.js';

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const V3 = THREE.Vector3;

// ---------------------------------------------------------------- tube builder
function tube(out, pts, radii, segs, flare, R) {
  const base = out.pos.length / 3;
  const rings = pts.length;
  let vacc = 0;
  for (let i = 0; i < rings; i++) {
    const p = pts[i];
    const dir = (i < rings - 1 ? pts[i + 1].clone().sub(p) : p.clone().sub(pts[i - 1])).normalize();
    const ref = Math.abs(dir.y) < 0.9 ? new V3(0, 1, 0) : new V3(1, 0, 0);
    const t1 = new V3().crossVectors(dir, ref).normalize(), t2 = new V3().crossVectors(dir, t1).normalize();
    if (i > 0) vacc += pts[i].distanceTo(pts[i - 1]);
    for (let s = 0; s <= segs; s++) {
      const a = s / segs * Math.PI * 2;
      let r = radii[i];
      if (flare && i < 3) { const k = (3 - i) / 3; r *= 1 + flare * k * k * (0.7 + 0.5 * Math.max(0, Math.sin(a * 5 + R * 6))); }
      const n = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a));
      const v = p.clone().addScaledVector(n, r);
      out.pos.push(v.x, v.y, v.z); out.nrm.push(n.x, n.y, n.z);
      out.uv.push(s / segs * Math.max(1, Math.round(radii[0] * 6)), vacc * 0.5);
      // moss on the lower trunk + root AO
      const moss = Math.max(0, 1 - v.y / 2.2) * (0.5 + 0.5 * n.y + 0.3);
      const ao = 0.55 + 0.45 * Math.min(1, v.y / 1.2 + 0.2);
      out.col.push(ao * (1 - moss * 0.35), ao * (1 + moss * 0.15), ao * (1 - moss * 0.45));
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let s = 0; s < segs; s++) {
    const a = base + i * (segs + 1) + s, b = a + 1, c = a + segs + 1, d = c + 1;
    out.idx.push(a, c, b, b, c, d);
  }
}
function curve(start, dir, len, n, wobble, R, up = 0) {
  const pts = [start.clone()]; const d = dir.clone().normalize();
  for (let i = 1; i <= n; i++) {
    d.x += (R() - 0.5) * wobble; d.z += (R() - 0.5) * wobble; d.y += up; d.normalize();
    pts.push(pts[i - 1].clone().addScaledVector(d, len / n));
  }
  return pts;
}

// ---------------------------------------------------------------- leaf cards
function cards(out, clumps, crownC, R, opt) {
  const tmp = new V3();
  for (const c of clumps) {
    const n = Math.round(opt.density * c.r * c.r);
    for (let i = 0; i < n; i++) {
      // point biased to the clump shell
      const dir = new V3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1); if (dir.lengthSq() < 1e-4) dir.set(0, 1, 0); dir.normalize();
      dir.y = dir.y * 0.8 + (opt.droop ? -0.25 : 0.1); dir.normalize();
      const rr = c.r * (0.45 + 0.55 * Math.cbrt(R()));
      const q = c.p.clone().addScaledVector(dir, rr);
      const s = opt.size * (0.75 + 0.5 * R());
      // card faces mostly outward with randomness
      const nn = dir.clone().add(new V3(R() - 0.5, R() - 0.5, R() - 0.5).multiplyScalar(1.4)).normalize();
      const ref = Math.abs(nn.y) < 0.95 ? new V3(0, 1, 0) : new V3(1, 0, 0);
      const t1 = new V3().crossVectors(nn, ref).normalize(), t2 = new V3().crossVectors(nn, t1).normalize();
      const rot = R() * Math.PI * 2, cr = Math.cos(rot), sr = Math.sin(rot);
      const a1 = t1.clone().multiplyScalar(cr).addScaledVector(t2, sr), a2 = t1.clone().multiplyScalar(-sr).addScaledVector(t2, cr);
      // soft canopy normal: blend clump + crown sphere normals
      const sn = q.clone().sub(c.p).normalize().multiplyScalar(0.55).add(tmp.copy(q).sub(crownC).normalize().multiplyScalar(0.45)).normalize();
      const shell = rr / c.r;
      const hRel = (q.y - (crownC.y - opt.crownH * 0.5)) / opt.crownH;
      const ao = Math.min(1.1, 0.32 + 0.45 * shell + 0.4 * Math.max(0, Math.min(1, hRel)) + 0.15 * Math.max(0, sn.y));
      const hue = c.hue;
      const b = out.pos.length / 3;
      const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]];
      for (const [x, y, u, v] of corners) {
        const p = q.clone().addScaledVector(a1, x * s * 0.5).addScaledVector(a2, y * s * 0.5);
        out.pos.push(p.x, p.y, p.z); out.nrm.push(sn.x, sn.y, sn.z); out.uv.push(u, v);
        out.col.push(ao * hue[0], ao * hue[1], ao * hue[2]);
      }
      out.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
}

function toGeo(o) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  g.setIndex(o.idx);
  g.computeBoundingSphere();
  return g;
}
const newOut = () => ({ pos: [], nrm: [], uv: [], col: [], idx: [] });

// ---------------------------------------------------------------- variants
function fir(seed) {
  const R = rng(seed);
  const H = 11 + R() * 5;
  const near = newOut(), far = newOut(), trunkO = newOut(), farTrunk = newOut();
  const pts = curve(new V3(0, -0.4, 0), new V3(0, 1, 0), H + 0.4, 6, 0.04, R);
  tube(trunkO, pts, pts.map((_, i) => 0.42 * (1 - 0.85 * i / 6)), 9, 0.6, R());
  tube(farTrunk, [pts[0], pts[6]], [0.5, 0.06], 5, 0, 0);
  const tiers = 9;
  const clumps = [];
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y = H * (0.22 + 0.78 * t);
    const rad = (1 - t) * 3.1 + 0.4;
    const n = Math.max(1, Math.round(rad * 2.2));
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + i * 0.7;
      clumps.push({ p: new V3(Math.cos(a) * rad * 0.55, y, Math.sin(a) * rad * 0.55), r: rad * 0.55 + 0.35, hue: [0.78, 0.92, 0.95] });
    }
  }
  const crownC = new V3(0, H * 0.55, 0);
  cards(near, clumps, crownC, R, { density: 13, size: 1.3, crownH: H, droop: true });
  cards(far, clumps, crownC, R, { density: 2.2, size: 2.6, crownH: H, droop: true });
  return { trunk: toGeo(trunkO), leaves: toGeo(near), far: toGeo(far), farTrunk: toGeo(farTrunk), height: H, r: 0.42 };
}

function broad(seed, kind) {
  // build trunk & leaves separately so each gets its own material
  const R = rng(seed);
  const tall = kind === 'tall';
  const H = tall ? 8.5 + R() * 3 : 3.6 + R() * 1.4;
  const r0 = tall ? 0.48 : 0.58 + R() * 0.15;
  const trunkO = newOut(), near = newOut(), far = newOut(), farTrunk = newOut();
  const lean = new V3((R() - 0.5) * 0.3, 1, (R() - 0.5) * 0.3);
  const trunkPts = curve(new V3(0, -0.5, 0), lean, H + 0.5, 8, 0.14, R, 0.02);
  const radii = trunkPts.map((_, i) => r0 * (1 - 0.5 * i / (trunkPts.length - 1)));
  tube(trunkO, trunkPts, radii, 12, 1.0, R());
  tube(farTrunk, [trunkPts[0], trunkPts[4], trunkPts[8]], [radii[0] * 1.25, radii[4], radii[8] * 0.8], 6, 0, 0);
  const top = trunkPts[trunkPts.length - 1];
  const crownR = tall ? 2.9 : 2.5 + R() * 0.4;
  const hues = [[1, 1, 1], [1.1, 1.06, 0.82], [0.88, 1.0, 0.98]];
  const clumps = [{ p: top.clone().add(new V3(0, crownR * 0.7, 0)), r: crownR * 1.05, hue: hues[0] }];
  const nb = 5 + Math.floor(R() * 3);
  for (let i = 0; i < nb; i++) {
    const t = (tall ? 0.55 : 0.4) + R() * 0.5;
    const k = Math.min(trunkPts.length - 2, Math.floor(t * (trunkPts.length - 1)));
    const a = i / nb * Math.PI * 2 + R() * 0.8;
    const dir = new V3(Math.cos(a), tall ? 0.8 + R() * 0.4 : 0.35 + R() * 0.45, Math.sin(a));
    const len = (tall ? 2.8 : 3.6) + R() * 1.6;
    const bp = curve(trunkPts[k], dir, len, 4, 0.3, R, 0.1);
    tube(trunkO, bp, bp.map((_, j) => radii[k] * (0.5 - 0.38 * j / 4)), 6, 0, 0);
    const tip = bp[bp.length - 1];
    clumps.push({ p: tip.clone().add(new V3(0, 0.5, 0)), r: crownR * (0.72 + R() * 0.35), hue: hues[i % 3] });
    // secondary twig clump halfway
    if (R() < 0.6) clumps.push({ p: bp[2].clone().add(new V3(0, 0.8, 0)), r: crownR * 0.6, hue: hues[(i + 1) % 3] });
  }
  const crownC = new V3(); for (const c of clumps) crownC.add(c.p); crownC.multiplyScalar(1 / clumps.length);
  const crownH = 2 * crownR + 3;
  cards(near, clumps, crownC, R, { density: 10, size: 1.45, crownH });
  cards(far, clumps, crownC, R, { density: 1.0, size: 3.8, crownH });
  return { trunk: toGeo(trunkO), leaves: toGeo(near), far: toGeo(far), farTrunk: toGeo(farTrunk), height: crownC.y + crownR, r: r0 };
}

function bushGeo(seed) {
  const R = rng(seed);
  const near = newOut(), far = newOut();
  const clumps = [];
  const n = 3 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const a = R() * Math.PI * 2, d = R() * 0.9;
    clumps.push({ p: new V3(Math.cos(a) * d, 0.55 + R() * 0.4, Math.sin(a) * d), r: 0.8 + R() * 0.45, hue: i % 2 ? [1, 1, 1] : [0.9, 1.02, 0.95] });
  }
  const c = new V3(0, 0.5, 0);
  cards(near, clumps, c, R, { density: 16, size: 0.9, crownH: 2 });
  cards(far, clumps, c, R, { density: 3, size: 1.6, crownH: 2 });
  return { trunk: null, leaves: toGeo(near), far: toGeo(far), farTrunk: null, height: 1.6, r: 0.8 };
}

// ---------------------------------------------------------------- materials
export const foliageUniforms = {
  uTime: { value: 0 }, uWind: { value: new THREE.Vector2(0.92, 0.38) },
  uSunDirW: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
};
export function leafMaterial(tex, tint, key) {
  const m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, vertexColors: true, roughness: 0.72, color: tint });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, foliageUniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec2 uWind; varying vec3 vLW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float ph = dot(ip.xz, vec2(0.13, 0.17));
        float hk = max(position.y - 1.5, 0.0) * 0.05;
        float gust = sin(uTime * 0.9 + ph) * 0.6 + sin(uTime * 2.1 + ph * 1.7) * 0.25;
        transformed.xz += uWind * gust * hk * 0.6;
        transformed += vec3(sin(uTime * 4.3 + position.x * 2.1 + ph), sin(uTime * 3.7 + position.z * 2.3), cos(uTime * 4.1 + position.y * 1.9)) * 0.035 * min(hk * 6.0, 1.0);`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vLW = (modelMatrix * ${'#ifdef USE_INSTANCING\n instanceMatrix * \n#endif\n'} vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunDirW, uSunCol; varying vec3 vLW;')
      // sharpen alpha so distant mips don't erode canopy coverage
      .replace('#include <alphatest_fragment>', `diffuseColor.a = clamp((diffuseColor.a - 0.42) / max(fwidth(diffuseColor.a), 1e-4) + 0.5, 0.0, 1.0);
        if (diffuseColor.a < 0.5) discard;`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif')
      .replace('#include <opaque_fragment>', `
        vec3 vdW = normalize(cameraPosition - vLW);
        float back = pow(max(dot(-vdW, uSunDirW), 0.0), 2.5);
        outgoingLight += uSunCol * diffuseColor.rgb * back * 1.1 * max(uSunDirW.y + 0.1, 0.0);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'leaf-' + key;
  return m;
}
function barkMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: bark(), normalMap: normalMap('barkN'), normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true, roughness: 0.92, color: 0xd8cfc4 });
  return m;
}

// ---------------------------------------------------------------- system
export function buildTrees(ctx, placements) {
  // placements: [{ kind:'oak'|'tall'|'fir'|'bush', x, y, z, s, rot }]
  const variants = {
    oak: [broad(11, 'oak'), broad(23, 'oak'), broad(37, 'oak')],
    tall: [broad(41, 'tall'), broad(53, 'tall')],
    fir: [fir(61), fir(73)],
    bush: [bushGeo(81), bushGeo(97)],
  };
  const tints = { oak: 0xffffff, tall: 0xe6f0d8, fir: 0xc8d8c4, bush: 0xf2f8e0 };
  const texKind = { oak: 'broad', tall: 'broad', fir: 'needle', bush: 'broad' };
  const barkMat = barkMaterial();
  const groups = [];
  for (const kind of Object.keys(variants)) {
    variants[kind].forEach((v, vi) => {
      const list = placements.filter(p => p.kind === kind && p.v % variants[kind].length === vi);
      if (!list.length) return;
      const lm = leafMaterial(leafCard(texKind[kind]), tints[kind], kind);
      const mk = (geo, mat, cast) => {
        if (!geo) return null;
        const m = new THREE.InstancedMesh(geo, mat, list.length);
        m.castShadow = cast; m.receiveShadow = true; m.count = 0; m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        ctx.scene.add(m); return m;
      };
      const g = {
        list, mats: list.map(p => new THREE.Matrix4().compose(new V3(p.x, p.y, p.z), new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), p.rot), new V3(p.s, p.s * (p.sy || 1), p.s))),
        trunk: mk(v.trunk, barkMat, true), leaves: mk(v.leaves, lm, true),
        farTrunk: mk(v.farTrunk, barkMat, false), far: mk(v.far, lm, false),
      };
      groups.push(g);
    });
  }
  const last = new V3(1e9, 0, 0);
  const NEAR = 75;
  function update(cam, force) {
    if (!force && cam.distanceToSquared(last) < 9) return;
    last.copy(cam);
    for (const g of groups) {
      let n = 0, f = 0;
      for (let i = 0; i < g.list.length; i++) {
        const p = g.list[i];
        const dx = p.x - cam.x, dz = p.z - cam.z, d2 = dx * dx + dz * dz;
        if (d2 < NEAR * NEAR) {
          if (g.trunk) g.trunk.setMatrixAt(n, g.mats[i]);
          g.leaves.setMatrixAt(n, g.mats[i]); n++;
        } else {
          if (g.farTrunk) g.farTrunk.setMatrixAt(f, g.mats[i]);
          g.far.setMatrixAt(f, g.mats[i]); f++;
        }
      }
      for (const [m, c] of [[g.trunk, n], [g.leaves, n], [g.farTrunk, f], [g.far, f]]) {
        if (!m) continue; m.count = c; m.instanceMatrix.needsUpdate = true;
      }
    }
  }
  return { update, groups, variants };
}
