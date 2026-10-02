// Creature materials: one physical "skin" shader that renders both the base skin
// and the shell-fur layers (shell attribute), plus a hard-part material
// (thorns, teeth, club). Both support hit flash, telegraph glow and a noise
// dissolve with an ember edge for deaths.
import * as THREE from 'three';

const NOISE = /* glsl */`
float cbHash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float cbHash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float cbNoise3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(cbHash13(i), cbHash13(i+vec3(1,0,0)), f.x), mix(cbHash13(i+vec3(0,1,0)), cbHash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(cbHash13(i+vec3(0,0,1)), cbHash13(i+vec3(1,0,1)), f.x), mix(cbHash13(i+vec3(0,1,1)), cbHash13(i+vec3(1,1,1)), f.x), f.y), f.z); }
float cbFbm(vec3 p){ return 0.55*cbNoise3(p) + 0.3*cbNoise3(p*2.07) + 0.15*cbNoise3(p*4.3); }
`;

function common(shader, u) {
  Object.assign(shader.uniforms, u);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
attribute float shell; attribute float furLen; attribute vec2 furUv;
uniform vec3 uComb; uniform float uFurScale;
varying float vShell; varying float vFurLen; varying vec2 vFurUv; varying vec3 vBindPos;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vShell = shell; vFurLen = furLen; vFurUv = furUv; vBindPos = position;
{ float fl = furLen * uFurScale; transformed += normal * (shell * fl) + uComb * (shell * shell * fl); }`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform float uDissolve; uniform vec3 uFlash; uniform vec3 uEdge; uniform float uDensity; uniform float uGlow; uniform vec3 uGlowColor; uniform float uHard;
varying float vShell; varying float vFurLen; varying vec2 vFurUv; varying vec3 vBindPos;
${NOISE}`)
    .replace('#include <color_fragment>', `#include <color_fragment>
#ifdef USE_AOMAP
  diffuseColor.rgb *= mix(1.0, texture2D(aoMap, vAoMapUv).r, 0.75);
#endif
float cbEdge = 0.0;
if (uDissolve > 0.0) {
  float dn = cbFbm(vBindPos * 7.0);
  float th = uDissolve * 1.15 - 0.05;
  if (dn < th) discard;
  cbEdge = 1.0 - smoothstep(0.0, 0.07, dn - th);
}
if (uHard < 0.5) {
  float hgt = vShell;
  if (hgt > 0.0) {
    if (vFurLen < 0.003) discard;
    vec2 st = vFurUv * uDensity;
    // coarse clumps warp the strand grid so fur reads as locks, not a lattice
    vec2 cl = vec2(cbNoise3(vec3(vFurUv * 9.0, 1.0)), cbNoise3(vec3(vFurUv * 9.0, 7.0))) - 0.5;
    st += cl * 2.2;
    vec2 cell = floor(st); vec2 f = fract(st) - 0.5;
    float r1 = cbHash12(cell);
    vec2 jit = (vec2(cbHash12(cell + 17.3), cbHash12(cell + 41.7)) - 0.5) * 0.45;
    float len = 0.45 + 0.55 * r1;
    if (hgt > len) discard;
    float rad = 0.74 * (1.0 - pow(hgt / len, 1.6));
    if (length(f - jit) > rad) discard;
    diffuseColor.rgb *= mix(0.82, 1.18, r1);
    diffuseColor.rgb *= mix(1.0, 1.25, smoothstep(0.6, 1.0, hgt / len)); // sun-bleached tips
  }
  float aoK = smoothstep(0.004, 0.04, vFurLen);
  diffuseColor.rgb *= mix(1.0, mix(0.38, 1.0, hgt), aoK);
}`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += uEdge * cbEdge * 6.0 + uFlash;
if (uHard > 0.5) totalEmissiveRadiance += uGlowColor * uGlow * vFurLen;`);
}

export function creatureMaterials({ density = 140, comb = [0, -0.35, -0.6], furScale = 1, roughness = 0.82, sheen = 0.8, sheenColor = 0xc9c2b4, normalMap = null, aoMap = null, normalScale = 0.6, hardRoughness = 0.55 } = {}) {
  const u = {
    uDissolve: { value: 0 }, uFlash: { value: new THREE.Vector3() }, uEdge: { value: new THREE.Color(1.0, 0.35, 0.9) },
    uDensity: { value: density }, uComb: { value: new THREE.Vector3(...comb) }, uFurScale: { value: furScale },
    uGlow: { value: 0 }, uGlowColor: { value: new THREE.Color(1.0, 0.35, 0.08) }, uHard: { value: 0 },
  };
  const skin = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness, metalness: 0, sheen, sheenColor: new THREE.Color(sheenColor), sheenRoughness: 0.55, normalMap, aoMap, aoMapIntensity: 1, normalScale: new THREE.Vector2(normalScale, normalScale) });
  skin.onBeforeCompile = sh => common(sh, u);
  skin.customProgramCacheKey = () => 'cbSkin' + (normalMap ? 'N' : '') + (aoMap ? 'A' : '');
  const hu = { ...u, uHard: { value: 1 } };
  const hard = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: hardRoughness, metalness: 0.05 });
  hard.onBeforeCompile = sh => common(sh, hu);
  hard.customProgramCacheKey = () => 'cbHard';
  return { skin, hard, uniforms: u };
}

// Tileable overlapping-scale normal map (reptilian/goblin hide), 1024².
let _scales = null;
export function scaleNormalMap() {
  if (_scales) return _scales;
  const N = 1024, h = new Float32Array(N * N);
  const rnd = (i, j, s) => { let x = (i * 374761393 + j * 668265263 + s * 1442695041) | 0; x = (x ^ (x >>> 13)) * 1274126177 | 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967295; };
  const COLS = 16, ROWS = 24; // scale grid (tileable)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fy = y / N * ROWS; const row = Math.floor(fy);
    let best = -1, bestRow = -1e9;
    for (let dr = -1; dr <= 1; dr++) {
      const r = row + dr; const shift = (((r % 2) + 2) % 2) * 0.5;
      const fx = x / N * COLS - shift; const col = Math.floor(fx);
      for (let dc = -1; dc <= 1; dc++) {
        const c = col + dc;
        const jr = rnd(((c % COLS) + COLS) % COLS, ((r % ROWS) + ROWS) % ROWS, 9) * 0.15;
        const lx = (fx - (c + 0.5)) / 0.62, ly = (fy - (r + 0.25 + jr)) / 0.95;
        const d = lx * lx + ly * ly;
        if (d < 1 && r > bestRow) { bestRow = r; best = (1 - d) * (0.6 + 0.4 * Math.min(1, (ly + 1))) ; }
      }
    }
    const fine = rnd(x, y, 3) * 0.04;
    h[y * N + x] = Math.max(0, best) * 0.9 + fine;
  }
  _scales = { normal: heightToNormal(h, N, 2.6, [1.5, 1.5]), ao: heightToAO(h, N, [1.5, 1.5]) };
  return _scales;
}
function heightToAO(h, N, rep) {
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { const v = Math.min(1, 0.35 + Math.pow(Math.min(1, h[i] / 0.55), 0.6) * 0.65) * 255; data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.repeat.set(rep[0], rep[1]); t.needsUpdate = true;
  return t;
}
function heightToNormal(h, N, s, rep) {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = h[y * N + ((x - 1 + N) % N)], r = h[y * N + ((x + 1) % N)], d = h[((y - 1 + N) % N) * N + x], u = h[((y + 1) % N) * N + x];
    const nx = (l - r) * s, ny = (d - u) * s, nz = 1; const L = Math.hypot(nx, ny, nz);
    const o = (y * N + x) * 4;
    data[o] = (nx / L * 0.5 + 0.5) * 255; data[o + 1] = (ny / L * 0.5 + 0.5) * 255; data[o + 2] = (nz / L * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.repeat.set(rep[0], rep[1]); t.needsUpdate = true;
  return t;
}

// Tileable leathery hide normal map (1024²): warts + creases + fine pores.
let _hide = null;
export function hideNormalMap() {
  if (_hide) return _hide;
  const N = 1024;
  const h = new Float32Array(N * N);
  const rnd = (i, j, s) => { let x = (i * 374761393 + j * 668265263 + s * 1442695041) | 0; x = (x ^ (x >>> 13)) * 1274126177 | 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967295; };
  // periodic value noise
  const vn = (x, y, P, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const w = (a, b) => rnd(((a % P) + P) % P, ((b % P) + P) % P, s);
    return (w(xi, yi) * (1 - u) + w(xi + 1, yi) * u) * (1 - v) + (w(xi, yi + 1) * (1 - u) + w(xi + 1, yi + 1) * u) * v;
  };
  // cellular (warts): periodic worley
  const C = 18; const pts = [];
  for (let i = 0; i < C; i++) for (let j = 0; j < C; j++) pts.push([(i + rnd(i, j, 3)) / C, (j + rnd(i, j, 4)) / C]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const px = x / N, py = y / N;
    const ci = Math.floor(px * C), cj = Math.floor(py * C);
    let d1 = 9, d2 = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const ii = ci + a, jj = cj + b; const p = pts[(((ii % C) + C) % C) * C + (((jj % C) + C) % C)];
      const dx = p[0] + Math.floor(ii / C) - px, dy = p[1] + Math.floor(jj / C) - py; const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const cell = Math.sqrt(d2) - Math.sqrt(d1);
    let v = Math.min(1, cell * C * 1.6) * 0.6;
    v += vn(px * 8, py * 8, 8, 1) * 0.5 + vn(px * 32, py * 32, 32, 2) * 0.25 + vn(px * 128, py * 128, 128, 5) * 0.12;
    h[y * N + x] = v;
  }
  const data = new Uint8Array(N * N * 4);
  const s = 3.0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = h[y * N + ((x - 1 + N) % N)], r = h[y * N + ((x + 1) % N)], d = h[((y - 1 + N) % N) * N + x], u = h[((y + 1) % N) * N + x];
    let nx = (l - r) * s, ny = (d - u) * s, nz = 1; const L = Math.hypot(nx, ny, nz);
    const o = (y * N + x) * 4;
    data[o] = (nx / L * 0.5 + 0.5) * 255; data[o + 1] = (ny / L * 0.5 + 0.5) * 255; data[o + 2] = (nz / L * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.repeat.set(1.6, 1.6); t.needsUpdate = true;
  _hide = t; return t;
}
