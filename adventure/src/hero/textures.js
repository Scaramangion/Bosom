// Procedural texture kit for Koto: tileable value-noise, height->normal, and
// per-material generators (cloth weave, wool, linen wraps, leather, skin+face,
// hair strands, wood planks + painted crest, brushed metal, eyes).
import * as THREE from 'three';

// ---------- periodic noise ----------
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = t => t * t * (3 - 2 * t);
export function pnoise(x, y, P, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const m = v => ((v % P) + P) % P;
  const a = hash2(m(xi), m(yi), seed), b = hash2(m(xi + 1), m(yi), seed);
  const c = hash2(m(xi), m(yi + 1), seed), d = hash2(m(xi + 1), m(yi + 1), seed);
  const u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// u,v in 0..1, base period P cells, tileable. Backed by cached lookup tables so
// per-pixel cost is one bilinear fetch instead of 4+ hashed noise evaluations.
const _tabs = new Map();
function fbmTable(P, oct, seed) {
  const key = P + ':' + oct + ':' + seed;
  let t = _tabs.get(key);
  if (t) return t;
  const N = Math.max(64, Math.min(512, 1 << Math.ceil(Math.log2(P * 6))));
  const d = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    let s = 0, a = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) { s += a * pnoise(u * P * f, v * P * f, P * f, seed + i * 17); n += a; a *= 0.5; f *= 2; }
    d[y * N + x] = s / n;
  }
  t = { N, d }; _tabs.set(key, t);
  return t;
}
export function pfbm(u, v, P, oct = 4, seed = 0) {
  const { N, d } = fbmTable(P, oct, seed);
  let x = u * N, y = v * N;
  x -= Math.floor(x / N) * N; y -= Math.floor(y / N) * N;
  const xi = x | 0, yi = y | 0, xf = x - xi, yf = y - yi;
  const x1 = (xi + 1) % N, y1 = (yi + 1) % N;
  const a = d[yi * N + xi], b = d[yi * N + x1], c = d[y1 * N + xi], e = d[y1 * N + x1];
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + e) * xf * yf;
}

// Generic generator: fn(u, v, out) fills out.r,g,b (0..1 linear-ish sRGB values), out.h (height 0..1), out.ro (roughness 0..1)
export function genMaps(size, fn, { normalStrength = 2.0, wrap = true, sizeY = size } = {}) {
  const W = size, H = sizeY;
  const col = new Uint8ClampedArray(W * H * 4);
  const rough = new Uint8ClampedArray(W * H * 4);
  const hgt = new Float32Array(W * H);
  const o = { r: 0, g: 0, b: 0, h: 0.5, ro: 0.8, m: 0 };
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W;
      o.h = 0.5; o.ro = 0.8; o.m = 0;
      fn(u, v, o);
      const i = (y * W + x) * 4;
      col[i] = o.r * 255; col[i + 1] = o.g * 255; col[i + 2] = o.b * 255; col[i + 3] = 255;
      rough[i] = 255; rough[i + 1] = o.ro * 255; rough[i + 2] = o.m * 255; rough[i + 3] = 255; // G = roughness, B = metalness (glTF convention)
      hgt[y * W + x] = o.h;
    }
  }
  const nrm = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xl = wrap ? (x - 1 + W) % W : Math.max(0, x - 1), xr = wrap ? (x + 1) % W : Math.min(W - 1, x + 1);
    const yu = wrap ? (y - 1 + H) % H : Math.max(0, y - 1), yd = wrap ? (y + 1) % H : Math.min(H - 1, y + 1);
    const dx = (hgt[y * W + xr] - hgt[y * W + xl]) * normalStrength * (W / 256);
    const dy = (hgt[yd * W + x] - hgt[yu * W + x]) * normalStrength * (H / 256);
    let nx = -dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * W + x) * 4;
    nrm[i] = (nx * 0.5 + 0.5) * 255; nrm[i + 1] = (ny * 0.5 + 0.5) * 255; nrm[i + 2] = (nz * 0.5 + 0.5) * 255; nrm[i + 3] = 255;
  }
  const mk = (data, srgb) => {
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8; t.flipY = false; t.needsUpdate = true;
    return t;
  };
  return { map: mk(col, true), normalMap: mk(nrm, false), roughnessMap: mk(rough, false) };
}

const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
function mix3(o, c, t) { o.r = lerp(o.r, c[0], t); o.g = lerp(o.g, c[1], t); o.b = lerp(o.b, c[2], t); }
function set3(o, c, k = 1) { o.r = c[0] * k; o.g = c[1] * k; o.b = c[2] * k; }

// ---------- cloth: twill weave ----------
export function clothTex(base, { size = 1024, P = 48, seed = 1, wear = 0.25, trim = null } = {}) {
  const c0 = hex(base);
  return genMaps(size, (u, v, o) => {
    // twill: diagonal ribs + thread crossing
    const tu = u * P * 8, tv = v * P * 8;
    const diag = Math.sin((tu + tv) * Math.PI * 0.5) * 0.5 + 0.5;
    const warp = Math.sin(tu * Math.PI) * 0.5 + 0.5, weft = Math.sin(tv * Math.PI) * 0.5 + 0.5;
    const thread = (Math.floor(tu) + Math.floor(tv)) % 2 ? warp : weft;
    const fib = pnoise(u * 900, v * 60, 900, seed) * 0.5 + pnoise(u * 60, v * 900, 60, seed + 3) * 0.5;
    const blotch = pfbm(u, v, 6, 4, seed + 9);
    const k = 0.82 + 0.16 * thread + 0.06 * diag + 0.1 * (fib - 0.5) + (blotch - 0.5) * 0.22;
    set3(o, c0, k);
    // faded / worn
    const w = clamp01((pfbm(u, v, 3, 4, seed + 20) - 0.55) * 4) * wear;
    mix3(o, [c0[0] * 1.35 + 0.05, c0[1] * 1.3 + 0.05, c0[2] * 1.2 + 0.05], w);
    o.h = 0.45 * thread + 0.35 * diag + 0.2 * fib;
    o.ro = 0.86 + 0.08 * (1 - thread);
    if (trim) trim(u, v, o);
  }, { normalStrength: 1.2 });
}

// ---------- red wool (cape + scarf), with a hem band embroidery near v>hem ----------
export function woolTex(base, { size = 1024, seed = 4, hem = true } = {}) {
  const c0 = hex(base), dark = c0.map(x => x * 0.55), gold = hex(0xc9a24a);
  return genMaps(size, (u, v, o) => {
    const tu = u * 260, tv = v * 260;
    const weave = (Math.sin(tu * Math.PI) * Math.sin(tv * Math.PI)) * 0.5 + 0.5;
    const fuzz = pfbm(u, v, 128, 3, seed);
    const blot = pfbm(u, v, 5, 4, seed + 5);
    set3(o, c0, 0.8 + 0.18 * weave + 0.25 * (fuzz - 0.5) + 0.3 * (blot - 0.5));
    o.h = 0.6 * weave + 0.4 * fuzz; o.ro = 0.95;
    if (hem) {
      // v: 0 top .. 1 bottom. Darker border band with gold running-stitch motif
      const b0 = 0.86, b1 = 0.955;
      if (v > b0 - 0.006 && v < b1 + 0.006) {
        const inside = v > b0 && v < b1;
        mix3(o, dark, inside ? 0.85 : 0.5);
        const cy = (v - b0) / (b1 - b0);
        // diamond chain motif
        const px = (u * 24) % 1, d = Math.abs(px - 0.5) * 2 + Math.abs(cy - 0.5) * 2.4;
        const ring = Math.abs(d - 0.7) < 0.09 && inside;
        const line = (Math.abs(cy - 0.08) < 0.035 || Math.abs(cy - 0.92) < 0.035);
        if (ring || line) { set3(o, gold, 0.85 + 0.2 * fuzz); o.h = 0.95; o.ro = 0.6; }
      }
      if (v > 0.985) { o.h = 0.3 + 0.4 * Math.sin(u * 900) ; mix3(o, dark, 0.5); } // frayed edge
    }
    // grime at bottom
    mix3(o, [0.18, 0.12, 0.08], clamp01((v - 0.75) * 2.0) * 0.35 * blot);
  }, { normalStrength: 1.5 });
}

// ---------- linen wraps (diagonal bands) ----------
export function linenTex({ size = 512, seed = 7 } = {}) {
  const c0 = hex(0xd9cbb0), c1 = hex(0xb9a684);
  return genMaps(size, (u, v, o) => {
    // v along limb (scaled), u around. Bands slant.
    const band = ((v * 9 + u * 1.0) % 1 + 1) % 1;
    const edge = Math.min(band, 1 - band);
    const ridge = sm(clamp01(edge * 9));
    const fib = pnoise(u * 400, v * 40, 400, seed);
    const dirt = pfbm(u, v, 4, 4, seed + 1);
    set3(o, c0, 0.86 + 0.12 * fib);
    mix3(o, c1, (1 - ridge) * 0.6 + (dirt - 0.5) * 0.6);
    o.h = ridge * 0.8 + fib * 0.2; o.ro = 0.9;
  }, { normalStrength: 2.5 });
}

// ---------- leather ----------
export function leatherTex(base, { size = 1024, seed = 11, stitch = false } = {}) {
  const c0 = hex(base);
  return genMaps(size, (u, v, o) => {
    const cell = pfbm(u, v, 64, 3, seed);
    const pores = pnoise(u * 300, v * 300, 300, seed + 2);
    const big = pfbm(u, v, 4, 4, seed + 4);
    const scuff = clamp01((pfbm(u * 1, v * 1, 9, 4, seed + 8) - 0.6) * 5);
    set3(o, c0, 0.75 + 0.35 * big + 0.12 * (cell - 0.5));
    mix3(o, [c0[0] * 1.6 + 0.08, c0[1] * 1.5 + 0.06, c0[2] * 1.4 + 0.05], scuff * 0.5);
    o.h = 0.6 * (1 - Math.abs(cell - 0.5) * 2) ** 3 + 0.25 * pores;
    o.ro = 0.55 + 0.25 * cell - 0.2 * scuff;
    if (stitch) {
      const sv = (v * 12) % 1, su = (u * 40) % 1;
      if (Math.abs(sv - 0.06) < 0.012 && su < 0.6) { set3(o, [0.78, 0.68, 0.5]); o.h = 0.9; o.ro = 0.8; }
    }
  }, { normalStrength: 2.0 });
}

// ---------- skin (head has painted face; u=0.5 is facing +Z) ----------
export function skinTex({ size = 1024, seed = 13, face = false } = {}) {
  const base = hex(0x8c6450), warm = hex(0xa0605a), deep = hex(0x5e3a26), lip = hex(0x7a3d32), brow = hex(0x1a1420);
  return genMaps(size, (u, v, o) => {
    const n = pfbm(u, v, 24, 4, seed), f = pnoise(u * 500, v * 500, 500, seed + 1);
    set3(o, base, 0.93 + 0.12 * (n - 0.5) + 0.04 * (f - 0.5));
    o.h = 0.5 + 0.1 * f; o.ro = 0.55 + 0.1 * n;
    if (face) {
      // head param: u around (0.5 = front), v top(0)->bottom(1). Face region ~ u 0.38..0.62, v 0.4..0.8
      const fx = (u - 0.5) * 2 * Math.PI, fy = v; // fx radians from front
      // cheek blush
      for (const s of [-1, 1]) {
        const d = Math.hypot((fx - s * 0.55) * 1.0, (fy - 0.66) * 3.2);
        mix3(o, warm, clamp01(1 - d / 0.32) * 0.35);
      }
      // lips (mouth at v~0.765)
      const lx = fx / 0.23, ly = (fy - 0.775) / 0.018;
      if (Math.abs(lx) < 1) {
        const w = 1 - lx * lx;
        const upper = ly > -1.3 * w && ly < 0;
        const lower = ly >= 0 && ly < 1.4 * w;
        if (upper || lower) mix3(o, lip, (upper ? 0.55 : 0.4) * sm(w));
        if (Math.abs(ly) < 0.22 && w > 0.15) { mix3(o, deep, 0.75 * sm(w)); o.h = 0.2; }
        if (lower && ly > 0.3) o.ro = 0.4;
      }
      // brows (thick, dark, slightly angled - determined look) at v ~0.505
      for (const s of [-1, 1]) {
        const bx = (fx * s - 0.32) / 0.2; // -1..1 across brow (inner -> outer)
        if (Math.abs(bx) < 1) {
          const cy = 0.502 - 0.012 * bx + 0.01 * bx * bx;
          const th = 0.011 * (1.0 - 0.45 * (bx + 1) / 2);
          const d = Math.abs(fy - cy);
          if (d < th) { mix3(o, brow, 0.92 * sm(clamp01((th - d) / th * 3)) * sm(clamp01((1 - Math.abs(bx)) * 4))); o.h = 0.6; o.ro = 0.8; }
        }
      }
      // eye socket shading (soft)
      for (const s of [-1, 1]) {
        const d = Math.hypot(fx * s - 0.31, (fy - 0.56) * 2.6);
        mix3(o, deep, clamp01(1 - d / 0.26) * 0.22);
      }
      // nose shading
      { const d = Math.hypot(fx * 1.6, (fy - 0.71) * 6); mix3(o, deep, clamp01(1 - d / 0.25) * 0.2); }
    }
  }, { normalStrength: 0.8 });
}

// ---------- hair strands (v along clump, u across) ----------
export function hairTex({ size = 512, seed = 21 } = {}) {
  const c0 = hex(0x141a33), c1 = hex(0x2e4a9c), c2 = hex(0x0b0e1c);
  return genMaps(size, (u, v, o) => {
    const s = pnoise(u * 96, v * 3, 96, seed) * 0.6 + pnoise(u * 230, v * 5, 230, seed + 1) * 0.4;
    const streak = sm(clamp01((pnoise(u * 7, v * 1, 7, seed + 3) - 0.45) * 3));
    set3(o, c0, 0.8 + 0.4 * s);
    mix3(o, c1, streak * 0.75 * (0.4 + 0.6 * v));
    mix3(o, c2, (1 - v) * 0.5); // darker at roots (v=0 root)
    o.h = s; o.ro = 0.42 + 0.2 * (1 - s);
  }, { normalStrength: 3 });
}

// ---------- shield face: wood planks, iron rim, painted crest (original "hollow-oak leaf" crest) ----------
export function shieldTex({ size = 1024, seed = 31 } = {}) {
  const wood = hex(0x7a5232), woodD = hex(0x4a2f1b), paint = hex(0x9c2a22), cream = hex(0xd8c79c), iron = hex(0x55565a);
  return genMaps(size, (u, v, o) => {
    const x = u * 2 - 1, y = v * 2 - 1, r = Math.hypot(x, y);
    // planks run vertically
    const pw = 0.33, px = (x + 1) / pw, pi = Math.floor(px), pf = px - pi;
    const grain = pnoise(x * 6 + pi * 13.1, y * 70 + pnoise(x * 3, y * 3, 64, seed) * 4, 4096, seed + pi);
    const ring = Math.sin((y * 16 + pnoise(x * 2 + pi, y * 2, 64, seed + 3) * 9) * 3.0) * 0.5 + 0.5;
    set3(o, wood, 0.75 + 0.25 * grain + 0.1 * ring);
    const gap = Math.min(pf, 1 - pf);
    if (gap < 0.03) { mix3(o, woodD, 0.85); }
    o.h = 0.5 + 0.2 * grain - (gap < 0.03 ? 0.4 : 0); o.ro = 0.7 + 0.15 * grain;
    // painted crest: a stylised leaf/flame within a ring, worn
    const wearN = pfbm(u, v, 12, 4, seed + 7);
    const paintMask = (() => {
      // outer ring band
      if (r > 0.62 && r < 0.72) return 1;
      // leaf: vesica shape vertical
      const lx = x / 0.36, ly = (y + 0.02) / 0.52;
      const leaf = lx * lx + ly * ly * 0.9 < 1 && Math.abs(lx) < (1 - Math.abs(ly) ** 1.6);
      // vein cutouts
      const vein = Math.abs(x) < 0.025 && Math.abs(y) < 0.45;
      const side = Math.abs((y - 0.05) - Math.abs(x) * 0.9 + 0.0) % 0.22 < 0.03 && Math.abs(x) < 0.25 && Math.abs(y) < 0.4;
      if (leaf && !vein && !side) return 2;
      return 0;
    })();
    if (paintMask && wearN > 0.38) {
      mix3(o, paintMask === 1 ? cream : paint, 0.92); o.ro = 0.6; o.h += 0.04;
    }
    // iron rim + rivets
    if (r > 0.9) { set3(o, iron, 0.8 + 0.3 * pnoise(u * 80, v * 80, 80, seed + 9)); o.ro = 0.45; o.m = 1; o.h = 0.8; }
    const ang = Math.atan2(y, x), rv = Math.abs(r - 0.94) < 0.025 && Math.abs(((ang / (Math.PI * 2) * 16) % 1 + 1) % 1 - 0.5) < 0.12;
    if (rv) { set3(o, iron, 1.2); o.h = 1; o.m = 1; o.ro = 0.35; }
    // boss
    if (r < 0.16) { set3(o, iron, 0.9 + 0.2 * pnoise(u * 100, v * 100, 100, seed)); o.m = 1; o.ro = 0.35; o.h = 0.9; }
    // grime & scratches
    const scr = pnoise(u * 3 + v * 120, v * 3 - u * 120, 4096, seed + 12);
    if (scr > 0.93) { mix3(o, [0.6, 0.55, 0.45], 0.4); o.h -= 0.1; }
    mix3(o, [0.12, 0.09, 0.07], clamp01(r - 0.6) * 0.5 * wearN);
  }, { normalStrength: 2.0, wrap: false });
}

// ---------- brushed metal (blade): u across, v along ----------
export function metalTex(tint = 0xc9ced6, { size = 512, seed = 41, rough = 0.28 } = {}) {
  const c0 = hex(tint);
  return genMaps(size, (u, v, o) => {
    const brush = pnoise(u * 300, v * 4, 300, seed) * 0.6 + pnoise(u * 900, v * 8, 900, seed + 1) * 0.4;
    const smudge = pfbm(u, v, 5, 4, seed + 2);
    set3(o, c0, 0.9 + 0.12 * brush - 0.12 * smudge);
    o.h = brush * 0.3; o.ro = rough + 0.12 * smudge + 0.06 * brush; o.m = 1;
  }, { normalStrength: 0.6 });
}

// ---------- eye: iris + pupil + highlight, u around, v top->bottom on a sphere facing +Z (front at u=0.5,v=0.5) ----------
export function eyeTex({ size = 512 } = {}) {
  const sclera = hex(0xf2ece4), iris0 = hex(0x3b5a3a), iris1 = hex(0x8a7a3a), limbal = hex(0x101510), pupil = hex(0x060606);
  return genMaps(size, (u, v, o) => {
    const ax = (u - 0.5) * 2 * Math.PI, ay = (v - 0.5) * Math.PI;
    const r = Math.hypot(ax, ay * 1.0);
    set3(o, sclera, 0.95); o.ro = 0.08;
    mix3(o, [0.85, 0.6, 0.55], clamp01((r - 0.9) * 1.2) * 0.4);
    const R = 0.56;
    if (r < R) {
      const t = r / R, ang = Math.atan2(ay, ax);
      const fib = pnoise(ang * 30 / Math.PI, t * 4, 60, 3);
      set3(o, iris0, 0.8 + 0.5 * fib); mix3(o, iris1, (1 - t) * 0.7);
      mix3(o, limbal, sm(clamp01((t - 0.78) * 5)));
      if (t < 0.4) set3(o, pupil);
      o.h = 0.3;
    }
    o.h = r < R ? 0.3 : 0.5;
  }, { normalStrength: 0.3, wrap: false });
}

// ---------- brass/gold for guard, buckle ----------
export function brassTex({ size = 256, seed = 51 } = {}) {
  const c0 = hex(0xc49a4a);
  return genMaps(size, (u, v, o) => {
    const n = pfbm(u, v, 8, 4, seed);
    set3(o, c0, 0.8 + 0.35 * n); o.ro = 0.3 + 0.25 * n; o.m = 1; o.h = n * 0.3;
    mix3(o, [0.25, 0.2, 0.12], clamp01((n - 0.62) * 4) * 0.6);
  }, { normalStrength: 0.8 });
}
