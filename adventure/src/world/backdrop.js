// Far mountain ranges beyond the playable rim: three concentric ridged rings,
// progressively taller / bluer / hazier so they read as layered silhouettes
// over the province's own cliff rim. Lit by the sun (MeshStandard) and fogged by
// the global atmospheric fog; an extra per-layer haze and valley mist keeps the
// layers separating even when the scene fog is thin.
import * as THREE from 'three';
import { ridged, fbm, smoothstep } from './layout.js';

const LAYERS = [
  { r0: 470, r1: 900, peak: 360, base: 60, freq: 1 / 260, seed: 1, haze: 0.10, tint: '#59605a' },
  { r0: 800, r1: 1400, peak: 620, base: 120, freq: 1 / 380, seed: 2, haze: 0.22, tint: '#5f6a78' },
  { r0: 1250, r1: 2100, peak: 900, base: 200, freq: 1 / 520, seed: 3, haze: 0.36, tint: '#6c7a8e' },
];

export function buildBackdrop(ctx) {
  const group = new THREE.Group(); group.name = 'backdrop';
  const mats = [];
  for (const L of LAYERS) {
    const AS = 720, RS = 26;
    const pos = new Float32Array((AS + 1) * (RS + 1) * 3), col = new Float32Array((AS + 1) * (RS + 1) * 3);
    const tint = new THREE.Color(L.tint);
    const snow = new THREE.Color('#e8eef8');
    let p = 0;
    for (let j = 0; j <= RS; j++) for (let i = 0; i <= AS; i++) {
      const a = i / AS * Math.PI * 2, t = j / RS;
      const r = L.r0 + (L.r1 - L.r0) * t;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const rg = ridged(x * L.freq + L.seed * 31, z * L.freq - L.seed * 17, 6);
      const massif = 0.55 + 0.45 * smoothstep(-0.4, 0.5, fbm(x * L.freq * 0.35 + L.seed, z * L.freq * 0.35, 3));
      const prof = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7; // rises then falls back
      let h = (L.base + L.peak * rg * massif) * prof - (1 - prof) * 30;
      pos[p * 3] = x; pos[p * 3 + 1] = h; pos[p * 3 + 2] = z;
      const hn = h / (L.base + L.peak);
      const c = tint.clone().multiplyScalar(0.85 + 0.3 * rg);
      const sn = smoothstep(0.42, 0.6, hn + fbm(x * 0.01, z * 0.01, 3) * 0.15);
      c.lerp(snow, sn);
      col[p * 3] = c.r; col[p * 3 + 1] = c.g; col[p * 3 + 2] = c.b;
      p++;
    }
    const idx = [];
    for (let j = 0; j < RS; j++) for (let i = 0; i < AS; i++) {
      const a = j * (AS + 1) + i, b = a + 1, c = a + AS + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    // snow only on gentler faces: recolour steep faces to rock
    const n = geo.attributes.normal;
    for (let k = 0; k < n.count; k++) {
      const steep = smoothstep(0.75, 0.55, n.getY(k));
      if (steep > 0) {
        col[k * 3] += (tint.r * 0.9 - col[k * 3]) * steep; col[k * 3 + 1] += (tint.g * 0.9 - col[k * 3 + 1]) * steep; col[k * 3 + 2] += (tint.b * 0.9 - col[k * 3 + 2]) * steep;
      }
    }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.FrontSide });
    const uni = { uHaze: { value: L.haze }, uPeak: { value: L.base + L.peak }, uHazeCol: { value: new THREE.Color('#b9c8d8') } };
    mat.userData.uniforms = uni;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, uni);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBH;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBH = position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBH; uniform float uHaze, uPeak; uniform vec3 uHazeCol;')
        .replace('#include <fog_fragment>', `#include <fog_fragment>
          float mist = uHaze * (1.0 + 1.2 * (1.0 - smoothstep(0.0, uPeak * 0.55, vBH)));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeCol, clamp(mist, 0.0, 0.85));`);
    };
    mat.customProgramCacheKey = () => 'backdrop-v1';
    mats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false; mesh.renderOrder = -1;
    group.add(mesh);
  }
  ctx.scene.add(group);
  const tmp = new THREE.Color();
  return {
    group,
    update() {
      // follow the scene fog / sky horizon colour so the haze matches time of day
      const f = ctx.scene.fog;
      if (f && f.color) { tmp.copy(f.color); for (const m of mats) m.userData.uniforms.uHazeCol.value.copy(tmp); }
    },
  };
}
