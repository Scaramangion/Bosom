// Terrain: chunked LOD heightfield of layout.heightAt with skirts, a splat-shaded
// MeshStandardMaterial (grass hues / dirt paths / triplanar rock / sand / snow,
// procedural albedo + normal detail, macro variation) and layered far mountain
// ranges with aerial perspective beyond the playable rim.
// Exposes ctx.terrain = { heightAt, normalAt, size, mesh, data, dataTex, uniforms }.
import * as THREE from 'three';
import { heightAt, normalAt, WORLD_SIZE, ridged, fbm, smoothstep } from './layout.js';
import { getTerrainData, DATA_GLSL, HALF } from './terrainData.js';
import { noiseTexture, grassGround, dirtGround, rockSurface, sandGround, normalMap } from './textures.js';
import { buildBackdrop } from './backdrop.js';
import { devEnvironment } from './devenv.js';

export const GRASS_COLORS = { lush: '#5f9431', dry: '#a5a843', deep: '#3c6e27', forest: '#3d4a22' };

const CHUNK = 50;
const LODS = [{ step: 1, dist: 0 }, { step: 2, dist: 115 }, { step: 5, dist: 250 }];

export async function init(ctx) {
  devEnvironment(ctx);
  const D = getTerrainData();
  const N = D.N;
  const H = (i, j) => D.heights[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];

  const material = makeSplatMaterial(D);
  const group = new THREE.Group(); group.name = 'terrain';
  const per = WORLD_SIZE / CHUNK;
  const indexCache = {};
  for (let cj = 0; cj < per; cj++) for (let ci = 0; ci < per; ci++) {
    const lod = new THREE.LOD();
    const i0 = ci * CHUNK, j0 = cj * CHUNK; // grid index of chunk corner
    const cx = i0 - HALF + CHUNK / 2, cz = j0 - HALF + CHUNK / 2;
    lod.position.set(cx, 0, cz);
    for (const L of LODS) {
      const geo = chunkGeometry(i0, j0, L.step, cx, cz, H, D.normals, N, indexCache);
      const m = new THREE.Mesh(geo, material);
      m.receiveShadow = true; m.castShadow = L.step === 1 ? false : false;
      m.matrixAutoUpdate = false; m.updateMatrix();
      lod.addLevel(m, L.dist);
    }
    lod.matrixAutoUpdate = false; lod.updateMatrix();
    group.add(lod);
  }
  ctx.scene.add(group);

  const backdrop = buildBackdrop(ctx);

  ctx.terrain = {
    heightAt, normalAt, size: WORLD_SIZE, mesh: group,
    data: D, dataTex: D.dataTex, uniforms: material.userData.uniforms,
    grassColors: GRASS_COLORS,
  };
  return {
    update(dt, t) {
      material.userData.uniforms.uTime.value = t;
      backdrop.update(dt, t);
    },
  };
}

function chunkGeometry(i0, j0, step, cx, cz, H, normals, N, indexCache) {
  const segs = CHUNK / step, vs = segs + 1;
  const skirt = 4 * vs; // perimeter
  const total = vs * vs + skirt;
  const pos = new Float32Array(total * 3), nrm = new Float32Array(total * 3);
  let p = 0;
  for (let j = 0; j < vs; j++) for (let i = 0; i < vs; i++) {
    const gi = Math.min(N - 1, i0 + i * step), gj = Math.min(N - 1, j0 + j * step);
    pos[p * 3] = gi - HALF - cx; pos[p * 3 + 1] = H(gi, gj); pos[p * 3 + 2] = gj - HALF - cz;
    const k = (gj * N + gi) * 3; nrm[p * 3] = normals[k]; nrm[p * 3 + 1] = normals[k + 1]; nrm[p * 3 + 2] = normals[k + 2];
    p++;
  }
  // skirt ring: duplicate perimeter dropped down
  const perim = [];
  for (let i = 0; i < vs; i++) perim.push(i);                       // top row (j=0)
  for (let j = 0; j < vs; j++) perim.push(j * vs + segs);           // right col
  for (let i = segs; i >= 0; i--) perim.push(segs * vs + i);        // bottom row
  for (let j = segs; j >= 0; j--) perim.push(j * vs);               // left col
  const drop = 2 + step * 2.5;
  const skirtStart = p;
  for (const s of perim) {
    pos[p * 3] = pos[s * 3]; pos[p * 3 + 1] = pos[s * 3 + 1] - drop; pos[p * 3 + 2] = pos[s * 3 + 2];
    nrm[p * 3] = nrm[s * 3]; nrm[p * 3 + 1] = nrm[s * 3 + 1]; nrm[p * 3 + 2] = nrm[s * 3 + 2];
    p++;
  }
  const key = step;
  let index = indexCache[key];
  if (!index) {
    const idx = [];
    for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
      const a = j * vs + i, b = a + 1, c = a + vs, d = c + 1;
      // alternate diagonal for less directional artifacts
      if ((i + j) & 1) idx.push(a, c, b, b, c, d); else idx.push(a, c, d, a, d, b);
    }
    for (let k = 0; k < perim.length - 1; k++) {
      const a = perim[k], b = perim[k + 1], a2 = skirtStart + k, b2 = skirtStart + k + 1;
      if (a === b) continue;
      idx.push(a, a2, b, b, a2, b2, a, b, a2, b, b2, a2); // double sided skirt
    }
    index = indexCache[key] = new THREE.BufferAttribute(new Uint32Array(idx), 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  return geo;
}

function makeSplatMaterial(D) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  const u = {
    uTData: { value: D.dataTex },
    uNoise: { value: noiseTexture() },
    uGrass: { value: grassGround() }, uGrassN: { value: normalMap('grassN') },
    uDirt: { value: dirtGround() }, uDirtN: { value: normalMap('dirtN') },
    uRock: { value: rockSurface() }, uRockN: { value: normalMap('rockN') },
    uSand: { value: sandGround() },
    uGLush: { value: new THREE.Color(GRASS_COLORS.lush) },
    uGDry: { value: new THREE.Color(GRASS_COLORS.dry) },
    uGDeep: { value: new THREE.Color(GRASS_COLORS.deep) },
    uGForest: { value: new THREE.Color(GRASS_COLORS.forest) },
    uTime: { value: 0 },
  };
  mat.userData.uniforms = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform sampler2D uNoise, uGrass, uGrassN, uDirt, uDirtN, uRock, uRockN, uSand;
        uniform vec3 uGLush, uGDry, uGDeep, uGForest;
        uniform float uTime;
        ${DATA_GLSL}
        float lum(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
        vec3 tnrm(sampler2D t, vec2 uv){ return texture2D(t, uv).xyz * 2.0 - 1.0; }
      `)
      .replace('#include <map_fragment>', TERRAIN_SPLAT)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(tNrm, 0.0)).xyz);');
  };
  mat.customProgramCacheKey = () => 'terrain-splat-v1';
  return mat;
}

const TERRAIN_SPLAT = /* glsl */`
  vec3 P = vWPos; vec3 Ng = normalize(vWNrm);
  vec4 TD = tData(P.xz);
  float slope = 1.0 - Ng.y;
  float camD = length(P - cameraPosition);
  vec4 nzA = texture2D(uNoise, P.xz * 0.0043);
  vec4 nzB = texture2D(uNoise, P.xz * 0.019 + 0.5);
  vec4 nzC = texture2D(uNoise, P.xz * 0.11 + 0.21);
  // ---------- grass: two scales + rotated sample to break tiling
  vec2 gu1 = P.xz * 0.21; vec2 gu2 = mat2(0.8,-0.6,0.6,0.8) * P.xz * 0.067 + 0.37;
  vec4 g1 = texture2D(uGrass, gu1); vec4 g2 = texture2D(uGrass, gu2);
  float gDet = mix(lum(g1.rgb), lum(g2.rgb), 0.45) / 0.2;
  float gH = mix(g1.a, g2.a, 0.45);
  vec3 gTint = mix(uGLush, uGDry, smoothstep(0.42, 0.85, nzA.r));
  gTint = mix(gTint, uGDeep, smoothstep(0.45, 0.8, nzA.g) * 0.75);
  gTint *= 0.8 + 0.4 * nzB.b;
  vec3 grass = gTint * mix(1.0, gDet, 0.55) * 0.72;
  // forest floor: moss + leaf litter
  vec4 dS = texture2D(uDirt, P.xz * 0.33);
  vec3 litter = mix(dS.rgb * vec3(0.72, 0.56, 0.38), uGForest * 0.7, smoothstep(0.3, 0.7, nzC.r));
  litter = mix(litter, uGDeep * 0.55 * gDet, smoothstep(0.55, 0.75, nzB.g) * 0.6);
  float fw = smoothstep(0.15, 0.7, TD.a);
  vec3 col = mix(grass, litter, fw * 0.85);
  float baseH = mix(gH, dS.a, fw);
  vec3 pert = vec3(0.0);
  vec3 gn = tnrm(uGrassN, gu1); vec3 dn = tnrm(uDirtN, P.xz * 0.33);
  pert += vec3(gn.x, 0.0, gn.y) * (1.0 - fw) * 0.5 + vec3(dn.x, 0.0, dn.y) * fw * 0.6;
  float rough = 0.96;
  // ---------- dirt paths: height-blended against grass
  vec2 du = P.xz * 0.26;
  vec4 dP = texture2D(uDirt, du);
  float pm = TD.b + (nzC.g - 0.5) * 0.35;
  float pw = smoothstep(-0.12, 0.12, pm - 0.5 + (dP.a - baseH) * 0.5);
  vec3 dirt = dP.rgb * (0.85 + 0.3 * nzB.r) * vec3(1.02, 0.97, 0.9);
  // grassy edge darkening (worn wheel ruts & shadowed tufts)
  dirt *= 1.0 - 0.25 * smoothstep(0.35, 0.6, TD.b) * (1.0 - smoothstep(0.6, 0.95, TD.b));
  col = mix(col, dirt, pw);
  vec3 dpn = tnrm(uDirtN, du);
  pert = mix(pert, vec3(dpn.x, 0.0, dpn.y) * 0.9, pw);
  // ---------- sand / wet shore / lake bed
  vec2 su = P.xz * 0.3;
  vec4 sS = texture2D(uSand, su);
  float sh = P.y + (nzB.g - 0.5) * 1.1 + (sS.a - 0.5) * 0.4;
  float sw = 1.0 - smoothstep(0.75, 1.45, sh);
  vec3 sand = sS.rgb * vec3(1.0, 0.95, 0.85);
  sand = mix(sand, sand * vec3(0.48, 0.47, 0.4), smoothstep(0.35, -0.6, P.y));   // wet / submerged
  sand = mix(sand, vec3(0.13, 0.14, 0.08), smoothstep(-1.0, -4.0, P.y) * 0.7); // deep murky bed
  col = mix(col, sand, sw);
  rough = mix(rough, mix(0.9, 0.45, smoothstep(0.6, 0.0, P.y)), sw);
  // ---------- rock: triplanar
  vec3 bw = pow(abs(Ng), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
  float rs = 0.075;
  vec4 rx = texture2D(uRock, P.zy * rs), ry = texture2D(uRock, P.xz * rs * 1.3), rz = texture2D(uRock, P.xy * rs);
  vec4 rk = rx * bw.x + ry * bw.y + rz * bw.z;
  vec4 rk2 = texture2D(uRock, P.xz * 0.013 + P.y * 0.004);
  vec3 rock = rk.rgb * mix(0.75, 1.25, rk2.r) * vec3(1.04, 1.0, 0.94);
  rock = mix(rock, rock * vec3(0.85, 0.82, 0.95), smoothstep(40.0, 160.0, P.y)); // cooler high up
  float rw = smoothstep(0.24, 0.38, slope + (nzB.r - 0.5) * 0.16 + (rk.a - baseH) * 0.2);
  rw = max(rw, smoothstep(0.55, 0.8, smoothstep(70.0, 140.0, P.y) + (nzA.b - 0.5) * 0.6) );
  vec3 tx = tnrm(uRockN, P.zy * rs), ty = tnrm(uRockN, P.xz * rs * 1.3), tz = tnrm(uRockN, P.xy * rs);
  vec3 rpert = vec3(0.0, tx.y, tx.x) * bw.x + vec3(ty.x, 0.0, ty.y) * bw.y + vec3(tz.x, tz.y, 0.0) * bw.z;
  col = mix(col, rock, rw);
  pert = mix(pert, rpert * 1.3, rw);
  rough = mix(rough, 0.82, rw);
  // ---------- snow caps on the high rim (sits on ledges, slides off cliffs)
  float snowLine = 150.0 + (nzA.r - 0.5) * 50.0;
  float snw = smoothstep(snowLine, snowLine + 22.0, P.y) * (1.0 - smoothstep(0.42, 0.62, slope + (rk.a - 0.5) * 0.3));
  vec3 snow = vec3(0.86, 0.9, 0.97) * (0.9 + 0.1 * rk.a);
  col = mix(col, snow, snw);
  pert *= 1.0 - snw * 0.7;
  rough = mix(rough, 0.55, snw);
  // distance: fade detail normals to avoid shimmer
  pert *= 1.0 - smoothstep(60.0, 220.0, camD) * 0.8;
  vec3 tNrm = normalize(Ng + pert);
  float tRough = rough;
  // subtle macro value variation
  col *= 0.9 + 0.2 * nzA.a;
  diffuseColor = vec4(col, 1.0);
`;
