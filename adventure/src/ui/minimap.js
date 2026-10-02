// Painted minimap base image, generated progressively from the analytic height field.
// Looks like a watercolour survey map: hillshade, contour hints, water, forests, village ground.
import { LANDMARKS, WATER_LEVEL, fbm, noise2 } from '../world/layout.js';

const RES = 512;           // pixels
const HALF = 320;          // metres from centre to edge
const MPP = (HALF * 2) / RES;

export function buildMinimapImage({ heightAt, sync = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = RES;
  const g = canvas.getContext('2d');
  g.fillStyle = '#4c5e3a'; g.fillRect(0, 0, RES, RES);
  const H = new Float32Array(RES * RES);
  let row = 0, done = false;

  function heightsRow(v) {
    const z = -HALF + (v + 0.5) * MPP;
    for (let u = 0; u < RES; u++) H[v * RES + u] = heightAt(-HALF + (u + 0.5) * MPP, z);
  }
  function compose() {
    const img = g.createImageData(RES, RES);
    const d = img.data;
    const L = [-0.55, 0.62, -0.56]; // light from north-west, high
    const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    const F = LANDMARKS.forest, V = LANDMARKS.village;
    for (let v = 0; v < RES; v++) {
      for (let u = 0; u < RES; u++) {
        const i = v * RES + u;
        const h = H[i];
        const hl = H[v * RES + Math.max(0, u - 1)], hr = H[v * RES + Math.min(RES - 1, u + 1)];
        const hu = H[Math.max(0, v - 1) * RES + u], hd = H[Math.min(RES - 1, v + 1) * RES + u];
        let nx = -(hr - hl), ny = 2 * MPP, nz = -(hd - hu);
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const shade = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        const x = -HALF + (u + 0.5) * MPP, z = -HALF + (v + 0.5) * MPP;
        const n1 = noise2(x * 0.09, z * 0.09), n2 = fbm(x * 0.02 + 3, z * 0.02 - 5, 3);
        let r, gg, b;
        if (h < WATER_LEVEL) {
          const depth = Math.min(1, (WATER_LEVEL - h) / 5);
          r = 92 - depth * 40; gg = 150 - depth * 52; b = 160 - depth * 38;
          // shoreline foam ring
          if (depth < 0.12) { r += 40; gg += 32; b += 22; }
        } else if (h < WATER_LEVEL + 0.7) {
          r = 196; gg = 182; b = 136;
        } else {
          // grass, warmer on higher meadows
          const t = Math.min(1, Math.max(0, (h - 2) / 16));
          r = 104 + t * 30 + n2 * 14; gg = 138 + t * 12 + n2 * 10; b = 70 + t * 4;
          // rock as it steepens / rises
          const slope = 1 - ny;
          const rock = Math.min(1, Math.max(0, (slope - 0.18) * 4) + Math.max(0, (h - 26) / 30));
          r = r * (1 - rock) + (146 + n1 * 8) * rock; gg = gg * (1 - rock) + (134 + n1 * 8) * rock; b = b * (1 - rock) + (112 + n1 * 6) * rock;
          const snow = Math.min(1, Math.max(0, (h - 62) / 20));
          r = r * (1 - snow) + 232 * snow; gg = gg * (1 - snow) + 230 * snow; b = b * (1 - snow) + 222 * snow;
          // forest canopy
          const fd = Math.hypot(x - F.x, z - F.z) / (F.r * (1.05 + 0.25 * n2));
          if (fd < 1) {
            const k = Math.min(1, (1 - fd) * 4) * (0.78 + 0.22 * (n1 > 0.25 ? 1 : 0));
            r = r * (1 - k) + 52 * k; gg = gg * (1 - k) + 86 * k; b = b * (1 - k) + 48 * k;
          }
          // village ground
          const vd = Math.hypot(x - V.x, z - V.z) / (V.r * (0.9 + 0.15 * n2));
          if (vd < 1) {
            const k = Math.min(1, (1 - vd) * 3) * 0.55;
            r = r * (1 - k) + 178 * k; gg = gg * (1 - k) + 152 * k; b = b * (1 - k) + 104 * k;
          }
        }
        // hillshade + contour hints
        const lit = 0.55 + shade * 0.62;
        r *= lit; gg *= lit; b *= lit;
        if (h > WATER_LEVEL + 0.7) {
          const c = (h / 6) % 1;
          if (c < 0.06) { r *= 0.86; gg *= 0.86; b *= 0.84; }
        }
        // paper grain
        const grain = 1 + n1 * 0.04;
        d[i * 4] = Math.min(255, r * grain * 1.02 + 6);
        d[i * 4 + 1] = Math.min(255, gg * grain);
        d[i * 4 + 2] = Math.min(255, b * grain * 0.94);
        d[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    done = true;
  }
  function step(budgetMs = 5) {
    if (done) return true;
    const t0 = performance.now();
    while (row < RES && performance.now() - t0 < budgetMs) heightsRow(row++);
    if (row >= RES) compose();
    return done;
  }
  if (sync) { while (row < RES) heightsRow(row++); compose(); }
  return { canvas, metresPerPixel: MPP, halfExtent: HALF, step, get done() { return done; } };
}
