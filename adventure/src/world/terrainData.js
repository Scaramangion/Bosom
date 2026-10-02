// Baked terrain data shared by terrain rendering + GPU foliage.
// 1 m height grid over the 800 x 800 world and an RGBA half-float data texture:
//   R = height (m), G = grass density 0..1, B = path distance (m, 0 = centre, ~1.8 = dirt edge, cap 12), A = forest density 0..1
import * as THREE from 'three';
import { heightAt, pathDist, forestDensity, riverDist, smoothstep, noise2, fbm, LANDMARKS, WORLD_SIZE } from './layout.js';

let DATA = null;
export const GRID_N = WORLD_SIZE + 1; // 801 samples, 1 m spacing
export const HALF = WORLD_SIZE / 2;

export function getTerrainData() {
  if (DATA) return DATA;
  const N = GRID_N;
  const heights = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) heights[j * N + i] = heightAt(i - HALF, j - HALF);
  const H = (i, j) => heights[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  const normals = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const nx = H(i - 1, j) - H(i + 1, j), nz = H(i, j - 1) - H(i, j + 1), ny = 2;
    const l = Math.hypot(nx, ny, nz), k = (j * N + i) * 3;
    normals[k] = nx / l; normals[k + 1] = ny / l; normals[k + 2] = nz / l;
  }
  const tex = new Uint16Array(N * N * 4);
  const pathMask = new Float32Array(N * N), grass = new Float32Array(N * N), forest = new Float32Array(N * N);
  const toH = THREE.DataUtils.toHalfFloat;
  const V = LANDMARKS.village;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i - HALF, z = j - HALF, k = j * N + i;
    const h = heights[k], ny = normals[k * 3 + 1];
    const slope = 1 - ny;
    const pd = pathDist(x, z) + noise2(x * 0.35, z * 0.35) * 0.45;
    const pm = 1 - smoothstep(1.1, 2.4, pd);
    const f = forestDensity(x, z);
    let g = smoothstep(0.3, 0.75, h);                 // no grass under water / on wet shore
    g *= 1 - smoothstep(0.16, 0.32, slope);          // none on rock slopes
    g *= 1 - 0.95 * (1 - smoothstep(0.7, 2.0, pd));   // thin on paths
    g *= 1 - 0.7 * f;                                 // sparse under canopy
    g *= 1 - smoothstep(70, 120, h);                  // none on the high rim
    const rd = riverDist(x, z); g *= smoothstep(10, 13, rd);
    const dv = Math.hypot(x - V.x, z - V.z); g *= 0.45 + 0.55 * smoothstep(8, 30, dv);
    g *= 0.72 + 0.28 * smoothstep(-0.3, 0.3, fbm(x * 0.06, z * 0.06, 3));
    pathMask[k] = pm; grass[k] = g; forest[k] = f;
    tex[k * 4] = toH(h); tex[k * 4 + 1] = toH(g); tex[k * 4 + 2] = toH(Math.max(0, pd)); tex[k * 4 + 3] = toH(f);
  }
  const dataTex = new THREE.DataTexture(tex, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  dataTex.minFilter = THREE.LinearFilter; dataTex.magFilter = THREE.LinearFilter;
  dataTex.wrapS = dataTex.wrapT = THREE.ClampToEdgeWrapping;
  dataTex.generateMipmaps = false; dataTex.needsUpdate = true;
  function sample(arr, x, z) { // bilinear
    const fx = Math.min(N - 1.001, Math.max(0, x + HALF)), fz = Math.min(N - 1.001, Math.max(0, z + HALF));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * N + i;
    return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + N] * (1 - u) + arr[k + N + 1] * u) * v;
  }
  DATA = {
    N, heights, normals, dataTex, pathMask, grass, forest,
    height: (x, z) => sample(heights, x, z),
    grassAt: (x, z) => sample(grass, x, z),
    pathAt: (x, z) => sample(pathMask, x, z),
    forestAt: (x, z) => sample(forest, x, z),
  };
  return DATA;
}

// GLSL helper: world xz -> data texture uv
export const DATA_GLSL = /* glsl */`
uniform sampler2D uTData;
vec2 tdUV(vec2 xz) { return (xz + ${HALF.toFixed(1)} + 0.5) / ${GRID_N.toFixed(1)}; }
vec4 tData(vec2 xz) { return texture2D(uTData, tdUV(xz)); }
`;
