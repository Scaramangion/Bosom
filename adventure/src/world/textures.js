// Procedural texture factory for terrain + foliage (no network assets).
// Every texture is generated once and cached. Albedo textures carry a height
// channel in alpha (used for height-blended splatting); normal maps are derived
// from those heights.
import * as THREE from 'three';

const cache = {};
function once(key, fn) { return cache[key] || (cache[key] = fn()); }

// ---- tileable noise helpers -------------------------------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function h2(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function tnoise(x, y, p, s) { // periodic value noise with period p
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = h2(x0, y0, s), b = h2(x1, y0, s), c = h2(x0, y1, s), d = h2(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function tfbm(x, y, p, oct, s) { let t = 0, a = 0.5, n = 0; for (let i = 0; i < oct; i++) { t += a * tnoise(x, y, p, s + i * 31); n += a; x *= 2; y *= 2; p *= 2; a *= 0.5; } return t / n; }
// periodic cellular (worley) F1/F2 distance
function worley(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % p) + p) % p, wy = ((cy % p) + p) % p;
    const px = cx + h2(wx, wy, s), py = cy + h2(wx, wy, s + 7);
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}

function makeTex(data, size, { srgb = true, repeat = true, mips = true } = {}) {
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = mips; t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter; t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
// normal map (tangent space, +Y = +v) from a height field
function normalFromHeight(hf, size, strength) {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const l = hf[y * size + ((x - 1 + size) % size)], r = hf[y * size + ((x + 1) % size)];
    const u = hf[((y - 1 + size) % size) * size + x], d = hf[((y + 1) % size) * size + x];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const il = 1 / Math.hypot(nx, ny, nz); nx *= il; ny *= il; nz *= il;
    const i = (y * size + x) * 4;
    out[i] = (nx * 0.5 + 0.5) * 255; out[i + 1] = (ny * 0.5 + 0.5) * 255; out[i + 2] = (nz * 0.5 + 0.5) * 255; out[i + 3] = 255;
  }
  return out;
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function put(buf, i, r, g, b, a) { buf[i] = clamp01(r) * 255; buf[i + 1] = clamp01(g) * 255; buf[i + 2] = clamp01(b) * 255; buf[i + 3] = clamp01(a) * 255; }

// ---- macro noise: RGBA independent tileable fbm channels (linear) ----------
export function noiseTexture() {
  return once('noise', () => {
    const S = 256, d = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, i = (y * S + x) * 4;
      d[i] = tfbm(u * 8, v * 8, 8, 5, 1) * 255;
      d[i + 1] = tfbm(u * 4, v * 4, 4, 5, 2) * 255;
      d[i + 2] = tfbm(u * 16, v * 16, 16, 4, 3) * 255;
      d[i + 3] = tnoise(u * 32, v * 32, 32, 4) * 255;
    }
    // stretch contrast so channels use the full range
    for (let c = 0; c < 4; c++) {
      let mn = 255, mx = 0; for (let i = c; i < d.length; i += 4) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); }
      for (let i = c; i < d.length; i += 4) d[i] = (d[i] - mn) / (mx - mn) * 255;
    }
    return makeTex(d, S, { srgb: false });
  });
}

// ---- grass ground: dense painterly blade strokes ----------------------------
export function grassGround() {
  return once('grass', () => {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); const R = rng(11);
    g.fillStyle = '#4a6a26'; g.fillRect(0, 0, S, S);
    // soft clumps
    for (let i = 0; i < 400; i++) {
      const x = R() * S, y = R() * S, r = 10 + R() * 30, l = 30 + R() * 25;
      g.fillStyle = `hsla(${78 + R() * 22},${40 + R() * 20}%,${l}%,0.18)`;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }
    }
    g.lineCap = 'round';
    for (let i = 0; i < 22000; i++) {
      const x = R() * S, y = R() * S, len = 4 + R() * 10, ang = -Math.PI / 2 + (R() - 0.5) * 1.6;
      const l = 22 + R() * 38;
      g.strokeStyle = `hsl(${72 + R() * 30},${45 + R() * 25}%,${l}%)`; g.lineWidth = 0.8 + R() * 1.4;
      const dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        if (x + ox < -20 || x + ox > S + 20 || y + oy < -20 || y + oy > S + 20) continue;
        g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + dx * 0.3 + (R() - .5) * 3, y + oy + dy * 0.5, x + ox + dx, y + oy + dy); g.stroke();
      }
    }
    return finishCanvas(c, S, 3.0, 'grassN');
  });
}
function finishCanvas(c, S, nStrength, nKey) {
  const img = c.getContext('2d').getImageData(0, 0, S, S).data;
  const d = new Uint8Array(S * S * 4), hf = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const r = img[i * 4], g = img[i * 4 + 1], b = img[i * 4 + 2];
    const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255; hf[i] = lum;
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = lum * 255;
  }
  cache[nKey] = makeTex(normalFromHeight(hf, S, nStrength), S, { srgb: false });
  return makeTex(d, S);
}

// ---- dirt path: packed earth, pebbles, cracks --------------------------------
export function dirtGround() {
  return once('dirt', () => {
    const S = 512, d = new Uint8Array(S * S * 4), hf = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 8, v = y / S * 8;
      const n = tfbm(u, v, 8, 6, 21), m = tfbm(u * 0.5, v * 0.5, 4, 3, 22);
      const [f1, f2] = worley(u * 3, v * 3, 24, 23);
      const pebble = Math.max(0, 1 - f1 * 3.2); // round pebbles
      const crack = 1 - Math.min(1, (f2 - f1) * 9);
      const [p1] = worley(u * 9, v * 9, 72, 24);
      const grit = Math.max(0, 1 - p1 * 3.5);
      let hgt = 0.45 + n * 0.25 + pebble * 0.45 + grit * 0.15 - crack * 0.25 * (m > 0.45 ? 1 : 0.3);
      hf[y * S + x] = hgt;
      let r = 0.42 + n * 0.16 + m * 0.06, g = 0.32 + n * 0.12 + m * 0.03, b = 0.21 + n * 0.08;
      const pc = 0.85 + h2(Math.floor(u * 3), Math.floor(v * 3), 5) * 0.3;
      r = r * (1 - pebble * 0.6) + pebble * 0.58 * pc; g = g * (1 - pebble * 0.6) + pebble * 0.54 * pc; b = b * (1 - pebble * 0.6) + pebble * 0.48 * pc;
      r += grit * 0.06; g += grit * 0.05; b += grit * 0.04;
      r *= 1 - crack * 0.3; g *= 1 - crack * 0.3; b *= 1 - crack * 0.3;
      put(d, (y * S + x) * 4, r, g, b, hgt);
    }
    cache.dirtN = makeTex(normalFromHeight(hf, S, 5), S, { srgb: false });
    return makeTex(d, S);
  });
}

// ---- rock: layered strata, fractures, lichen ---------------------------------
export function rockSurface() {
  return once('rock', () => {
    const S = 512, d = new Uint8Array(S * S * 4), hf = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 4, v = y / S * 4;
      const n = tfbm(u, v, 4, 6, 31);
      const warp = tfbm(u * 0.7 + 3, v * 0.7, 4, 3, 32) * 2.5;
      const strata = 0.5 + 0.5 * Math.sin((v * 6 + warp + n * 1.5) * Math.PI);
      const [f1, f2] = worley(u * 2 + n, v * 2, 8, 33);
      const crack = Math.pow(1 - Math.min(1, (f2 - f1) * 5), 3);
      const lichen = Math.max(0, tfbm(u * 2, v * 2, 8, 4, 34) - 0.58) * 4;
      let hgt = 0.35 + n * 0.45 + strata * 0.18 - crack * 0.45 + (f1 * 0.15);
      hf[y * S + x] = hgt;
      let base = 0.36 + n * 0.28 + strata * 0.07;
      let r = base * 1.0, g = base * 0.97, b = base * 0.92;
      r *= 1 - crack * 0.55; g *= 1 - crack * 0.55; b *= 1 - crack * 0.5;
      const lc = Math.min(1, lichen);
      r = r * (1 - lc) + lc * (0.50 + n * .1); g = g * (1 - lc) + lc * (0.52 + n * .1); b = b * (1 - lc) + lc * 0.32;
      put(d, (y * S + x) * 4, r, g, b, hgt);
    }
    cache.rockN = makeTex(normalFromHeight(hf, S, 7), S, { srgb: false });
    return makeTex(d, S);
  });
}

// ---- sand / shore: fine grain + ripples --------------------------------------
export function sandGround() {
  return once('sand', () => {
    const S = 256, d = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S * 4, v = y / S * 4;
      const n = tfbm(u, v, 4, 5, 41), grain = h2(x, y, 42);
      const rip = 0.5 + 0.5 * Math.sin((u * 3 + v * 1.2 + n * 2.0) * Math.PI * 2);
      const hgt = 0.4 + rip * 0.25 + n * 0.25 + grain * 0.1;
      const l = 0.62 + n * 0.12 + grain * 0.08 - rip * 0.05;
      put(d, (y * S + x) * 4, l * 1.0, l * 0.9, l * 0.72, hgt);
    }
    return makeTex(d, S);
  });
}
export function normalMap(key) { return cache[key]; }

// ---- bark: vertical fissures -------------------------------------------------
export function bark() {
  return once('bark', () => {
    const S = 256, d = new Uint8Array(S * S * 4), hf = new Float32Array(S * S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const n = tfbm(u * 8, v * 2, 8, 5, 51);
      const [f1, f2] = worley(u * 6 + n * 0.8, v * 1.5, 6, 52); // elongated plates
      const fiss = Math.pow(1 - Math.min(1, (f2 - f1) * 3.5), 2);
      const moss = Math.max(0, tfbm(u * 4, v * 4, 4, 3, 53) - 0.55) * 3;
      const hgt = 0.6 + n * 0.3 - fiss * 0.6;
      hf[y * S + x] = hgt;
      let l = 0.30 + n * 0.22 - fiss * 0.2;
      let r = l * 1.0, g = l * 0.82, b = l * 0.66;
      const mc = Math.min(1, moss); r = r * (1 - mc) + mc * 0.30; g = g * (1 - mc) + mc * 0.38; b = b * (1 - mc) + mc * 0.15;
      put(d, (y * S + x) * 4, r, g, b, 1);
    }
    cache.barkN = makeTex(normalFromHeight(hf, S, 6), S, { srgb: false });
    return makeTex(d, S);
  });
}

// ---- leaf cluster card (alpha cutout). kind: 'broad' | 'needle' | 'fern' ----
export function leafCard(kind = 'broad') {
  return once('leaf_' + kind, () => {
    const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'); const R = rng(kind === 'broad' ? 61 : kind === 'needle' ? 62 : 63);
    if (kind === 'broad') {
      const N = 70;
      for (let i = 0; i < N; i++) {
        const a = R() * Math.PI * 2, rr = Math.pow(R(), 0.6) * S * 0.36;
        const x = S / 2 + Math.cos(a) * rr, y = S / 2 + Math.sin(a) * rr;
        const len = 20 + R() * 16, w = len * 0.45, ang = a + (R() - 0.5) * 1.2;
        const l = 30 + R() * 30 + (1 - rr / (S * 0.36)) * 0;
        g.save(); g.translate(x, y); g.rotate(ang);
        g.fillStyle = `hsl(${85 + R() * 25},${45 + R() * 20}%,${l}%)`;
        g.beginPath(); g.moveTo(-len / 2, 0); g.quadraticCurveTo(0, -w, len / 2, 0); g.quadraticCurveTo(0, w, -len / 2, 0); g.fill();
        g.strokeStyle = `rgba(30,50,10,0.35)`; g.lineWidth = 1; g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
        g.restore();
      }
    } else if (kind === 'needle') {
      g.lineCap = 'round';
      for (let b = 0; b < 7; b++) {
        const y0 = S * (0.2 + b * 0.1), x0 = S * 0.5;
        const dir = b % 2 ? 1 : -1;
        for (let i = 0; i < 70; i++) {
          const t = R(), x = x0 + dir * t * S * 0.42, y = y0 + t * S * 0.12;
          const l = 22 + R() * 25;
          g.strokeStyle = `hsl(${120 + R() * 30},${30 + R() * 20}%,${l}%)`; g.lineWidth = 2.2;
          const a = (R() - 0.5) * 2.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14 + 6); g.stroke();
        }
      }
      for (let i = 0; i < 260; i++) {
        const x = S * (0.12 + R() * 0.76), y = S * (0.15 + R() * 0.75), l = 20 + R() * 25;
        g.strokeStyle = `hsl(${120 + R() * 30},${30 + R() * 20}%,${l}%)`; g.lineWidth = 2;
        const a = Math.PI / 2 + (R() - 0.5) * 2.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); g.stroke();
      }
    } else { // fern frond pointing up (base at bottom)
      g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const t = i / 26, y = S * (0.95 - t * 0.9), x = S / 2 + Math.sin(t * 3) * 6;
        const len = S * 0.42 * Math.sin(Math.PI * (0.15 + t * 0.85)) * (1 - t * 0.3);
        for (const s of [-1, 1]) {
          g.fillStyle = `hsl(${88 + R() * 20},${50 + R() * 15}%,${28 + R() * 18}%)`;
          g.save(); g.translate(x, y); g.rotate(s * (1.1 - t * 0.4)); g.beginPath(); g.ellipse(0, -len / 2, len * 0.11, len / 2, 0, 0, 7); g.fill(); g.restore();
        }
      }
      g.strokeStyle = 'hsl(90,40%,25%)'; g.lineWidth = 3; g.beginPath(); g.moveTo(S / 2, S); g.lineTo(S / 2, S * 0.05); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  });
}
