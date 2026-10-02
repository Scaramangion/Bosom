// Procedural texture factory for Brennan's Hollow + the shrine.
// Every generator builds a tileable height field + albedo on the CPU, then derives
// a tangent-space normal map (Sobel, wrapped) and a roughness map from them.
import * as THREE from 'three';

// ---------- deterministic RNG / periodic noise ----------
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function ihash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const sm = t => t * t * (3 - 2 * t);
// periodic value noise, period p lattice cells
export function pnoise(x, y, p, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
  const a = ihash(x0, y0, s), b = ihash(x1, y0, s), c = ihash(x0, y1, s), d = ihash(x1, y1, s);
  const u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// fbm in [0,1]; u,v in [0,1) tile coords; base period (cells per tile)
export function pfbm(u, v, base, oct = 5, s = 0) {
  let sum = 0, amp = 0.5, tot = 0, f = base;
  for (let i = 0; i < oct; i++) { sum += amp * pnoise(u * f, v * f, f, s + i * 17); tot += amp; amp *= 0.5; f *= 2; }
  return sum / tot;
}
// anisotropic periodic noise: separate x/y frequencies, each must be integer to tile
function anoise(u, v, fx, fy, s) {
  const x = u * fx, y = v * fy;
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const x0 = ((xi % fx) + fx) % fx, y0 = ((yi % fy) + fy) % fy, x1 = (x0 + 1) % fx, y1 = (y0 + 1) % fy;
  const a = ihash(x0, y0, s), b = ihash(x1, y0, s), c = ihash(x0, y1, s), d = ihash(x1, y1, s);
  const uu = sm(xf), vv = sm(yf);
  return a + (b - a) * uu + (c - a) * vv + (a - b - c + d) * uu * vv;
}
export function afbm(u, v, fx, fy, oct = 4, s = 0) {
  let sum = 0, amp = 0.5, tot = 0;
  for (let i = 0; i < oct; i++) { sum += amp * anoise(u, v, fx, fy, s + i * 31); tot += amp; amp *= 0.5; fx *= 2; fy *= 2; }
  return sum / tot;
}

// ---------- map assembly ----------
function canvasFrom(size, fill) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const img = g.createImageData(size, size);
  fill(img.data); g.putImageData(img, 0, 0); return c;
}
function texFrom(canvas, srgb, repeat = true) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}
function normalFromHeight(H, size, strength) {
  return canvasFrom(size, d => {
    for (let y = 0; y < size; y++) {
      const ym = ((y - 1 + size) % size) * size, y0 = y * size, yp = ((y + 1) % size) * size;
      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size, xp = (x + 1) % size;
        const dx = (H[ym + xp] + 2 * H[y0 + xp] + H[yp + xp]) - (H[ym + xm] + 2 * H[y0 + xm] + H[yp + xm]);
        const dy = (H[yp + xm] + 2 * H[yp + x] + H[yp + xp]) - (H[ym + xm] + 2 * H[ym + x] + H[ym + xp]);
        let nx = -dx * strength, ny = dy * strength, nz = 1;
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const i = (y0 + x) * 4;
        d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
      }
    }
  });
}
// gen(u, v, x, y) -> writes into out = [r,g,b,height,rough] (rgb 0..1)
function build(size, gen, { normal = 2, alpha = false } = {}) {
  const H = new Float32Array(size * size);
  const out = [0, 0, 0, 0, 0.8, 1];
  const rough = new Uint8ClampedArray(size * size);
  const alb = canvasFrom(size, d => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      out[5] = 1;
      gen(x / size, y / size, x, y, out);
      const i = y * size + x;
      H[i] = out[3]; rough[i] = out[4] * 255;
      const j = i * 4;
      d[j] = Math.pow(Math.min(1, Math.max(0, out[0])), 1 / 2.2) * 255;
      d[j + 1] = Math.pow(Math.min(1, Math.max(0, out[1])), 1 / 2.2) * 255;
      d[j + 2] = Math.pow(Math.min(1, Math.max(0, out[2])), 1 / 2.2) * 255;
      d[j + 3] = alpha ? out[5] * 255 : 255;
    }
  });
  const nrm = normalFromHeight(H, size, normal);
  const rgh = canvasFrom(size, d => { for (let i = 0; i < size * size; i++) { const v = rough[i]; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } });
  return { map: texFrom(alb, true), normalMap: texFrom(nrm, false), roughnessMap: texFrom(rgh, false) };
}
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function mix3(o, a, b, t) { o[0] = lerp(a[0], b[0], t); o[1] = lerp(a[1], b[1], t); o[2] = lerp(a[2], b[2], t); }
// linear-space colours
const C = hex => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }; // THREE.Color(hex) is converted to linear

const cache = {};
const memo = (k, f) => cache[k] || (cache[k] = f());

// ---------- WOOD (beams): grain along U ----------
export const woodTex = (variant = 'dark') => memo('wood' + variant, () => {
  const dark = variant === 'dark';
  const A = dark ? C('#4a3220') : C('#8a6440'), B = dark ? C('#2a1b10') : C('#5e4128');
  const tmp = [0, 0, 0];
  return build(1024, (u, v, x, y, o) => {
    const warp = afbm(u, v, 2, 8, 3, 3) * 0.6;
    const g = afbm(u, v + warp * 0.08, 4, 64, 4, 7);           // long fibres
    const rings = 0.5 + 0.5 * Math.sin((v * 24 + warp * 3 + afbm(u, v, 3, 6, 2, 9) * 2) * Math.PI * 2);
    const fine = afbm(u, v, 64, 512, 2, 11);
    const knotN = pnoise(u * 6, v * 6, 6, 41);
    const t = clamp01(0.25 + g * 0.6 + rings * 0.22 - fine * 0.12);
    mix3(tmp, A, B, t);
    const crack = sstep(0.72, 0.8, afbm(u, v, 3, 40, 3, 13)) * sstep(0.6, 0.9, g);
    const k = 1 - crack * 0.6 - sstep(0.85, 0.95, knotN) * 0.3;
    const weather = 0.88 + 0.24 * pfbm(u, v, 4, 3, 77);
    o[0] = tmp[0] * k * weather; o[1] = tmp[1] * k * weather; o[2] = tmp[2] * k * weather * (dark ? 1 : 0.95);
    o[3] = g * 0.5 + rings * 0.15 + fine * 0.2 - crack * 0.8;
    o[4] = 0.72 + fine * 0.2;
  }, { normal: 3 });
});

// ---------- PLANKS: vertical boards (grain along V), 8 boards per tile ----------
export const plankTex = (variant = 'warm') => memo('plank' + variant, () => {
  const pal = variant === 'grey' ? [C('#7d7468'), C('#4f483f')] : variant === 'red' ? [C('#8e3424'), C('#5c2116')] : [C('#8c6440'), C('#5a3c22')];
  const tmp = [0, 0, 0];
  const N = 8;
  return build(1024, (u, v, x, y, o) => {
    const bi = Math.floor(u * N), bu = u * N - bi;
    const seed = bi * 7 + 3;
    const off = ihash(bi, 0, 5);
    const g = afbm(u * 0 + bu / N + bi / N, (v + off) % 1, 32, 4, 4, seed);   // fibres along v
    const gg = afbm(u, (v + off) % 1, 128, 6, 3, seed + 1);
    const rings = 0.5 + 0.5 * Math.sin((bu * 3 + gg * 2.5 + off * 9) * Math.PI * 2);
    const tint = 0.82 + 0.3 * ihash(bi, 1, 9);
    mix3(tmp, pal[0], pal[1], clamp01(g * 0.7 + rings * 0.25 + gg * 0.2 - 0.15));
    const edge = Math.min(bu, 1 - bu);
    const gap = sstep(0.0, 0.045, edge);
    // plank end joint
    const jv = (v + off) % 1, jd = Math.min(Math.abs(jv - 0.5), Math.abs(jv), Math.abs(1 - jv));
    const joint = ihash(bi, 2, 3) > 0.5 ? sstep(0.0, 0.006, Math.abs(jv - 0.5)) : 1;
    // nails near joint
    const nail = (Math.hypot((bu - 0.5) * 0.12, Math.abs(jv - 0.5) - 0.012) < 0.004 && ihash(bi, 2, 3) > 0.5) ? 0.35 : 1;
    const dirt = 0.85 + 0.15 * pfbm(u, v, 3, 4, 2);
    const k = tint * (0.3 + 0.7 * gap) * (0.4 + 0.6 * joint) * nail * dirt;
    o[0] = tmp[0] * k; o[1] = tmp[1] * k; o[2] = tmp[2] * k;
    o[3] = gap * 0.6 + joint * 0.2 + g * 0.25 + rings * 0.05 - (1 - nail) * 0.2 + (Math.sin(bu * Math.PI) * 0.12);
    o[4] = 0.78 + 0.15 * gg;
  }, { normal: 3 });
});

// ---------- PLASTER (lime render), dirt handled in shader ----------
export const plasterTex = () => memo('plaster', () => {
  const A = C('#e8dcc4'), B = C('#cbbb9b');
  const tmp = [0, 0, 0];
  return build(1024, (u, v, x, y, o) => {
    const n = pfbm(u, v, 6, 6, 3);
    const blot = pfbm(u, v, 3, 4, 21);
    const fine = pfbm(u, v, 64, 3, 5);
    mix3(tmp, A, B, clamp01(blot * 1.4 - 0.4 + fine * 0.15));
    const crackN = Math.abs(pfbm(u, v, 5, 5, 99) - 0.5);
    const crack = (1 - sstep(0.0, 0.012, crackN)) * sstep(0.55, 0.7, pfbm(u, v, 2, 3, 123));
    const stain = sstep(0.55, 0.85, pfbm(u, v * 0.5 + 0.0, 4, 4, 55)) * 0.12;
    const k = (1 - crack * 0.45) * (1 - stain) * (0.95 + fine * 0.1);
    o[0] = tmp[0] * k; o[1] = tmp[1] * k; o[2] = tmp[2] * k * 0.98;
    o[3] = n * 0.6 + fine * 0.35 - crack * 0.5;
    o[4] = 0.9;
  }, { normal: 1.6 });
});

// ---------- MASONRY: ashlar/rubble blocks in courses ----------
function masonry(key, { rows = 8, colsMin = 2, colsMax = 4, pal, mortar, bevel = 0.06, seed = 1, rough = 0.85, lichen = 0 }) {
  return memo(key, () => {
    const R = rng(seed);
    const rowsDef = [];
    for (let r = 0; r < rows; r++) {
      const n = colsMin + Math.floor(R() * (colsMax - colsMin + 1));
      const cuts = []; let acc = R();
      const ws = []; let tot = 0; for (let i = 0; i < n; i++) { const w = 0.6 + R() * 0.8; ws.push(w); tot += w; }
      for (let i = 0; i < n; i++) { cuts.push(acc % 1); acc += ws[i] / tot; }
      cuts.sort((a, b) => a - b);
      rowsDef.push(cuts);
    }
    const tmp = [0, 0, 0];
    return build(1024, (u, v, x, y, o) => {
      const jit = (pfbm(u, v, 8, 3, seed + 3) - 0.5) * 0.02;
      const rv = (v + jit) * rows, ri = ((Math.floor(rv) % rows) + rows) % rows, fv = rv - Math.floor(rv);
      const cuts = rowsDef[ri];
      const uu = (u + jit * 0.7 + 1) % 1;
      let k = 0; while (k < cuts.length && cuts[k] <= uu) k++;
      const c0 = k === 0 ? cuts[cuts.length - 1] - 1 : cuts[k - 1];
      const c1 = k === cuts.length ? cuts[0] + 1 : cuts[k];
      const id = ri * 31 + k;
      const wU = (c1 - c0), fu = (uu - c0) / wU;
      // distance to stone edge in "uv units" (aspect-correct)
      const ex = Math.min(fu, 1 - fu) * wU, ey = Math.min(fv, 1 - fv) / rows;
      const e = Math.min(ex, ey);
      const shapeN = (pfbm(u, v, 16, 3, seed + 9) - 0.5) * 0.012;
      const ed = e + shapeN;
      const inside = sstep(0.003, 0.003 + bevel * 0.05, ed);
      const sv = ihash(id, 7, seed), sv2 = ihash(id, 9, seed);
      const surf = pfbm(u, v, 24, 4, seed + 13);
      const chip = sstep(0.68, 0.75, pfbm(u, v, 20, 3, seed + 5)) * (1 - sstep(0.0, 0.02, ed));
      mix3(tmp, pal[0], pal[1], clamp01(sv * 0.9 + surf * 0.3 - 0.1));
      if (sv2 > 0.75) mix3(tmp, tmp, pal[2] || pal[1], 0.5);
      const shade = 0.75 + surf * 0.45;
      let r = tmp[0] * shade, g = tmp[1] * shade, b = tmp[2] * shade;
      if (lichen) { const l = sstep(0.62, 0.75, pfbm(u, v, 10, 4, seed + 17)) * lichen; r = lerp(r, 0.30, l * 0.5); g = lerp(g, 0.32, l * 0.5); b = lerp(b, 0.18, l * 0.6); }
      mix3(o, [r, g, b], mortar, 1 - inside);
      o[3] = inside * (0.55 + 0.25 * Math.sqrt(sstep(0, bevel * 0.4, ed))) + surf * 0.25 - chip * 0.3 + sv * 0.05;
      o[4] = lerp(0.95, rough, inside) - surf * 0.1;
    }, { normal: 4 });
  });
}
export const stoneTex = () => masonry('stone', { rows: 7, colsMin: 2, colsMax: 4, pal: [C('#8f877a'), C('#6a6257'), C('#8a7f6a')], mortar: C('#5b554b'), seed: 3, lichen: 0.6 });
export const ruinTex = () => masonry('ruin', { rows: 4, colsMin: 1, colsMax: 3, pal: [C('#b9b2a2'), C('#958d7e'), C('#a8a08a')], mortar: C('#6d675b'), bevel: 0.1, seed: 11, rough: 0.9, lichen: 1 });

// ---------- COBBLES (Voronoi) ----------
export const cobbleTex = () => memo('cobble', () => {
  const G = 14; // cells per tile
  const pts = [];
  const R = rng(42);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([(i + 0.15 + R() * 0.7) / G, (j + 0.15 + R() * 0.7) / G, R(), R()]);
  const pal = [C('#8c8478'), C('#6e675c'), C('#9a8e78')];
  const tmp = [0, 0, 0];
  return build(1024, (u, v, x, y, o) => {
    const ci = Math.floor(u * G), cj = Math.floor(v * G);
    let d1 = 9, d2 = 9, best = null;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = ci + di, jj = cj + dj;
      const p = pts[(((jj % G) + G) % G) * G + (((ii % G) + G) % G)];
      const px = p[0] + Math.floor(ii / G) , py = p[1] + Math.floor(jj / G);
      const dx = (u - px) * G, dy = (v - py) * G;
      const d = Math.hypot(dx * (0.9 + p[3] * 0.2), dy);
      if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
    }
    const edge = d2 - d1;
    const inside = sstep(0.04, 0.22, edge);
    const n = pfbm(u, v, 32, 3, 8);
    mix3(tmp, pal[0], pal[1], best[2]);
    if (best[3] > 0.8) mix3(tmp, tmp, pal[2], 0.6);
    const dome = Math.sqrt(clamp01(edge * 1.6));
    const sh = 0.7 + n * 0.4 + dome * 0.15;
    const gr = pfbm(u, v, 12, 3, 31);
    const grout = [lerp(0.11, 0.13, gr), lerp(0.10, 0.16, gr), lerp(0.07, 0.06, gr)]; // dirt/moss between stones
    mix3(o, [tmp[0] * sh, tmp[1] * sh, tmp[2] * sh], grout, 1 - inside);
    o[3] = dome * 0.9 + n * 0.15;
    o[4] = lerp(1, 0.7, inside);
  }, { normal: 3.5 });
});

// ---------- THATCH (fibrous straw courses), drawn with canvas strokes ----------
export const thatchTex = () => memo('thatch', () => {
  const S = 1024;
  const R = rng(7);
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const ca = mk(), ch = mk();
  const a = ca.getContext('2d'), h = ch.getContext('2d');
  a.fillStyle = '#4a3a22'; a.fillRect(0, 0, S, S);
  h.fillStyle = '#000'; h.fillRect(0, 0, S, S);
  const courses = 6;
  const draw = (x0, y0, x1, y1, col, hv, w) => {
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (Math.max(x0, x1) + ox < -4 || Math.min(x0, x1) + ox > S + 4 || Math.max(y0, y1) + oy < -4 || Math.min(y0, y1) + oy > S + 4) continue;
      a.strokeStyle = col; a.lineWidth = w; a.beginPath(); a.moveTo(x0 + ox, y0 + oy); a.lineTo(x1 + ox, y1 + oy); a.stroke();
      h.strokeStyle = hv; h.lineWidth = w; h.beginPath(); h.moveTo(x0 + ox, y0 + oy); h.lineTo(x1 + ox, y1 + oy); h.stroke();
    }
  };
  a.lineCap = h.lineCap = 'round';
  // course by course from top to bottom so lower courses overlap upper ones
  for (let c = 0; c < courses; c++) {
    const yTop = (c / courses) * S, len = S / courses * 1.35;
    for (let i = 0; i < 9000; i++) {
      const x = R() * S, y = yTop + R() * len * 0.5;
      const L = len * (0.5 + R() * 0.6);
      const ang = (R() - 0.5) * 0.18;
      const t = R();
      const age = pnoise(x / S * 6, y / S * 6, 6, 3);
      const r = 150 + t * 70 - age * 70, g = 118 + t * 55 - age * 55, b = 62 + t * 30 - age * 25;
      const along = (y - yTop) / len;
      const hv = Math.floor(90 + along * 120 + t * 40);
      draw(x, y, x + Math.sin(ang) * L, y + Math.cos(ang) * L, `rgb(${r | 0},${g | 0},${b | 0})`, `rgb(${hv},${hv},${hv})`, 1 + R() * 1.8);
    }
    // shadowed bottom lip of each course
    const grad = a.createLinearGradient(0, yTop + len * 0.85, 0, yTop + len);
    grad.addColorStop(0, 'rgba(20,14,6,0)'); grad.addColorStop(1, 'rgba(20,14,6,0.35)');
  }
  // moss / age patches
  const img = a.getImageData(0, 0, S, S), hd = h.getImageData(0, 0, S, S);
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    const m = sstep(0.6, 0.78, pfbm(x / S, y / S, 5, 4, 61));
    img.data[i] = lerp(img.data[i], 92, m * 0.6); img.data[i + 1] = lerp(img.data[i + 1], 98, m * 0.6); img.data[i + 2] = lerp(img.data[i + 2], 52, m * 0.6);
    H[y * S + x] = hd.data[i] / 255;
  }
  a.putImageData(img, 0, 0);
  const nrm = normalFromHeight(H, S, 5);
  const rough = mk(); const rg = rough.getContext('2d'); rg.fillStyle = '#e6e6e6'; rg.fillRect(0, 0, S, S);
  return { map: texFrom(ca, true), normalMap: texFrom(nrm, false), roughnessMap: texFrom(rough, false) };
});

// ---------- SHINGLES / SLATE: staggered overlapping rows (rows along U, slope along V) ----------
function shingles(key, { rows = 10, cols = 8, pal, seed, gapCol, wood = true }) {
  return memo(key, () => {
    const tmp = [0, 0, 0];
    return build(1024, (u, v, x, y, o) => {
      const rv = v * rows, ri = Math.floor(rv), fv = rv - ri;
      const shift = (ri % 2) * 0.5 + ihash(ri, 0, seed) * 0.2;
      const cu = u * cols + shift, ci = Math.floor(cu), fu = cu - ci;
      const id = ((ci % cols) + cols) % cols + ri * 101;
      const wv = ihash(id, 1, seed), lenJ = ihash(id, 2, seed) * 0.12;
      const bottom = 0.92 - lenJ;
      const gapU = Math.min(fu, 1 - fu);
      const inside = sstep(0.0, 0.04, gapU) * (fv < bottom ? 1 : 0);
      const grain = wood ? afbm(u, v, 64, 8, 3, seed + id % 7) : pfbm(u, v, 48, 3, seed);
      mix3(tmp, pal[0], pal[1], clamp01(wv * 0.8 + grain * 0.4 - 0.1));
      if (ihash(id, 3, seed) > 0.85) mix3(tmp, tmp, pal[2], 0.6);
      const moss = sstep(0.62, 0.8, pfbm(u, v, 4, 4, seed + 40)) * 0.6;
      const sh = (0.6 + 0.5 * fv) * (0.85 + grain * 0.3);
      let r = tmp[0] * sh, g = tmp[1] * sh, b = tmp[2] * sh;
      r = lerp(r, 0.10, moss * 0.6); g = lerp(g, 0.14, moss * 0.6); b = lerp(b, 0.05, moss * 0.6);
      const k = inside;
      o[0] = lerp(gapCol[0], r, k); o[1] = lerp(gapCol[1], g, k); o[2] = lerp(gapCol[2], b, k);
      o[3] = k * (0.3 + fv * 0.6) + grain * 0.12;
      o[4] = wood ? 0.85 : lerp(0.9, 0.55, k);
    }, { normal: 4 });
  });
}
export const shingleTex = () => shingles('shingle', { rows: 12, cols: 9, pal: [C('#7a5a3e'), C('#4b3626'), C('#8a7a66')], seed: 5, gapCol: C('#1a120b') });
export const slateTex = () => shingles('slate', { rows: 12, cols: 7, pal: [C('#4f6378'), C('#33414f'), C('#5d6670')], seed: 9, gapCol: C('#11161b'), wood: false });
export const redTileTex = () => shingles('redtile', { rows: 12, cols: 8, pal: [C('#a4503a'), C('#7a3324'), C('#9a6a4a')], seed: 13, gapCol: C('#2a120c'), wood: false });

// ---------- DIRT path (alpha edges across V) ----------
export const pathTex = () => memo('path', () => {
  const tmp = [0, 0, 0];
  const A = C('#8a7356'), B = C('#5e4c36');
  return build(1024, (u, v, x, y, o) => {
    const n = pfbm(u, v, 8, 5, 4);
    const pb = pfbm(u, v, 96, 2, 6);
    mix3(tmp, A, B, clamp01(n * 1.2 - 0.1));
    const pebble = sstep(0.72, 0.78, pb);
    const rut = Math.exp(-Math.pow((v - 0.32) * 22, 2)) + Math.exp(-Math.pow((v - 0.68) * 22, 2));
    const sh = (0.85 + n * 0.3) * (1 - rut * 0.12) * (1 + pebble * 0.25);
    o[0] = tmp[0] * sh; o[1] = tmp[1] * sh; o[2] = tmp[2] * sh;
    const edge = Math.min(v, 1 - v) * 2; // 0 at sides, 1 centre
    const ragged = edge + (pfbm(u, v, 12, 4, 19) - 0.5) * 0.6;
    o[5] = sstep(0.12, 0.45, ragged);
    // grass creeping in at the very edge
    const gr = 1 - sstep(0.2, 0.5, ragged);
    o[0] = lerp(o[0], 0.09, gr * 0.6); o[1] = lerp(o[1], 0.13, gr * 0.6); o[2] = lerp(o[2], 0.04, gr * 0.6);
    o[3] = n * 0.5 + pebble * 0.4 - rut * 0.3;
    o[4] = 0.95;
  }, { normal: 2, alpha: true });
});

// ---------- tilled soil with furrows along U ----------
export const soilTex = () => memo('soil', () => {
  const tmp = [0, 0, 0];
  const A = C('#5a4029'), B = C('#3a2818');
  return build(1024, (u, v, x, y, o) => {
    const n = pfbm(u, v, 16, 5, 12);
    const f = 0.5 + 0.5 * Math.cos(v * 8 * Math.PI * 2 + (pfbm(u, v, 4, 2, 3) - 0.5) * 1.5);
    mix3(tmp, A, B, clamp01((1 - f) * 0.7 + n * 0.5 - 0.1));
    const clod = sstep(0.6, 0.7, pfbm(u, v, 64, 2, 17));
    const sh = 0.7 + f * 0.4 + clod * 0.15;
    o[0] = tmp[0] * sh; o[1] = tmp[1] * sh; o[2] = tmp[2] * sh;
    o[3] = f * 0.8 + n * 0.2 + clod * 0.15;
    o[4] = 0.95;
  }, { normal: 3 });
});

// ---------- WINDOW (non-repeating): panes + mullions + warm interior ----------
export const windowTex = () => memo('window', () => {
  const W = 256, Hh = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d');
  // interior: warm glow with darker silhouettes (curtain sides)
  const gr = g.createRadialGradient(W * 0.5, Hh * 0.62, 10, W * 0.5, Hh * 0.6, W * 0.7);
  gr.addColorStop(0, '#ffd890'); gr.addColorStop(0.5, '#e69a48'); gr.addColorStop(1, '#6b3a1a');
  g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
  g.fillStyle = 'rgba(120,40,30,0.75)'; g.fillRect(0, 0, W * 0.16, Hh); g.fillRect(W * 0.84, 0, W * 0.16, Hh);
  g.fillStyle = 'rgba(40,20,10,0.5)'; g.fillRect(W * 0.3, Hh * 0.72, W * 0.4, Hh * 0.28);
  // mullions
  g.fillStyle = '#2b1d12';
  const m = 14;
  g.fillRect(0, 0, W, m); g.fillRect(0, Hh - m, W, m); g.fillRect(0, 0, m, Hh); g.fillRect(W - m, 0, m, Hh);
  g.fillRect(W / 2 - m / 2, 0, m, Hh); g.fillRect(0, Hh / 2 - m / 2, W, m);
  for (const fx of [0.25, 0.75]) g.fillRect(W * fx - 3, 0, 6, Hh);
  for (const fy of [0.25, 0.75]) g.fillRect(0, Hh * fy - 3, W, 6);
  const t = texFrom(c, true, false);
  // glass reflection/day map
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = Hh; const g2 = c2.getContext('2d');
  const gr2 = g2.createLinearGradient(0, 0, W, Hh); gr2.addColorStop(0, '#5f7385'); gr2.addColorStop(0.45, '#26303a'); gr2.addColorStop(0.55, '#3d4c5a'); gr2.addColorStop(1, '#1a2028');
  g2.fillStyle = gr2; g2.fillRect(0, 0, W, Hh);
  g2.globalAlpha = 0.55; g2.drawImage(c, 0, 0); g2.globalAlpha = 1;
  g2.fillStyle = '#2b1d12';
  g2.fillRect(0, 0, W, m); g2.fillRect(0, Hh - m, W, m); g2.fillRect(0, 0, m, Hh); g2.fillRect(W - m, 0, m, Hh);
  g2.fillRect(W / 2 - m / 2, 0, m, Hh); g2.fillRect(0, Hh / 2 - m / 2, W, m);
  for (const fx of [0.25, 0.75]) g2.fillRect(W * fx - 3, 0, 6, Hh);
  for (const fy of [0.25, 0.75]) g2.fillRect(0, Hh * fy - 3, W, 6);
  return { glow: t, day: texFrom(c2, true, false) };
});

// ---------- Inn sign ----------
export const signTex = () => memo('sign', () => {
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // board
  const wood = g.createLinearGradient(0, 0, 0, H); wood.addColorStop(0, '#5a3a20'); wood.addColorStop(1, '#3c2412');
  g.fillStyle = wood; g.fillRect(0, 0, W, H);
  const R = rng(3);
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${20 + R() * 40},${10 + R() * 20},0,${0.15 + R() * 0.2})`; g.lineWidth = 1 + R() * 2; const y = R() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (R() - 0.5) * 10, W * 0.6, y + (R() - 0.5) * 10, W, y + (R() - 0.5) * 8); g.stroke(); }
  // painted border
  g.strokeStyle = '#c99a3c'; g.lineWidth = 14; g.strokeRect(26, 26, W - 52, H - 52);
  g.strokeStyle = '#2a170a'; g.lineWidth = 4; g.strokeRect(44, 44, W - 88, H - 88);
  // tankard emblem
  g.save(); g.translate(W / 2, 175);
  g.fillStyle = '#d9b25c'; g.strokeStyle = '#2a170a'; g.lineWidth = 6;
  g.beginPath(); g.roundRect(-55, -70, 110, 130, 12); g.fill(); g.stroke();
  g.beginPath(); g.arc(70, -5, 34, -Math.PI / 2, Math.PI / 2); g.lineWidth = 16; g.strokeStyle = '#d9b25c'; g.stroke(); g.lineWidth = 6; g.strokeStyle = '#2a170a'; g.stroke();
  g.fillStyle = '#f4ecd8'; g.beginPath(); g.ellipse(0, -72, 64, 22, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  for (const x of [-30, 0, 30]) { g.fillStyle = '#2a170a'; g.fillRect(x - 3, -40, 6, 90); }
  g.restore();
  g.fillStyle = '#f0d58a'; g.strokeStyle = '#20120a'; g.lineWidth = 10; g.textAlign = 'center';
  g.font = 'italic bold 104px Georgia, "Times New Roman", serif';
  g.strokeText("Brennan's Theme", W / 2, 360); g.fillText("Brennan's Theme", W / 2, 360);
  g.font = 'bold 44px Georgia, serif'; g.fillStyle = '#d7c39a'; g.lineWidth = 6;
  g.strokeText('~  T E L L H O U S E  ~', W / 2, 432); g.fillText('~  T E L L H O U S E  ~', W / 2, 432);
  // wear
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(40,25,10,${R() * 0.25})`; g.fillRect(R() * W, R() * H, 1 + R() * 4, 1 + R() * 2); }
  return texFrom(c, true, false);
});

// ---------- alpha cards for plants ----------
export const cropTex = (kind) => memo('crop' + kind, () => {
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const R = rng(kind === 'wheat' ? 5 : kind === 'veg' ? 9 : 13);
  g.lineCap = 'round';
  if (kind === 'wheat') {
    for (let i = 0; i < 26; i++) {
      const x0 = W * (0.2 + R() * 0.6), lean = (R() - 0.5) * 60, top = H * (0.05 + R() * 0.25);
      const col = R();
      g.strokeStyle = `rgb(${150 + col * 50},${130 + col * 40},${60 + col * 20})`; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + lean * 0.3, H * 0.6, x0 + lean, top + 30); g.stroke();
      // ear
      g.fillStyle = `rgb(${200 + col * 40},${165 + col * 40},${80 + col * 20})`;
      for (let k = 0; k < 7; k++) { g.beginPath(); g.ellipse(x0 + lean + (k % 2 ? 4 : -4), top + 30 - k * 6, 4, 7, (k % 2 ? 0.5 : -0.5), 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(230,210,150,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + lean, top - 10); g.lineTo(x0 + lean + (R() - 0.5) * 8, top - 30); g.stroke();
    }
  } else if (kind === 'veg') {
    // leafy cabbage/lettuce rosette seen from the side
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.4, L = 70 + R() * 60;
      const cx = W / 2, cy = H - 20;
      const gx = cx + Math.cos(a) * L, gy = cy + Math.sin(a) * L;
      const col = R();
      g.fillStyle = `rgb(${40 + col * 50},${100 + col * 70},${30 + col * 30})`;
      g.beginPath(); g.moveTo(cx, cy);
      g.quadraticCurveTo(cx + Math.cos(a - 0.5) * L * 0.8, cy + Math.sin(a - 0.5) * L * 0.8, gx, gy);
      g.quadraticCurveTo(cx + Math.cos(a + 0.5) * L * 0.8, cy + Math.sin(a + 0.5) * L * 0.8, cx, cy); g.fill();
      g.strokeStyle = 'rgba(200,230,160,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(gx, gy); g.stroke();
    }
    g.fillStyle = '#a6c96a'; g.beginPath(); g.arc(W / 2, H - 40, 34, 0, Math.PI * 2); g.fill();
  } else { // flowers/weeds for shrine
    for (let i = 0; i < 30; i++) {
      const x0 = W * R(), top = H * (0.3 + R() * 0.5), col = R();
      g.strokeStyle = `rgb(${50 + col * 30},${90 + col * 50},${30})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + (R() - 0.5) * 40, (H + top) / 2, x0 + (R() - 0.5) * 30, top); g.stroke();
    }
    for (let i = 0; i < 14; i++) { g.fillStyle = R() > 0.5 ? '#f2e6c4' : '#c7a6e0'; g.beginPath(); g.arc(W * (0.1 + R() * 0.8), H * (0.3 + R() * 0.4), 5 + R() * 4, 0, Math.PI * 2); g.fill(); }
  }
  return texFrom(c, true, false);
});

// soft round sprite for smoke
export const smokeTex = () => memo('smoke', () => {
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = rng(4);
  for (let i = 0; i < 9; i++) {
    const x = S / 2 + (R() - 0.5) * 40, y = S / 2 + (R() - 0.5) * 40, r = 25 + R() * 25;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  return texFrom(c, false, false);
});

// cloth weave (tileable, greyscale-ish; tinted by vertex colour)
export const clothTex = () => memo('cloth', () => build(256, (u, v, x, y, o) => {
  const w = 0.5 + 0.25 * Math.sin(x * Math.PI / 2) + 0.25 * Math.sin(y * Math.PI / 2);
  const n = pfbm(u, v, 8, 3, 2);
  const s = 0.85 + w * 0.1 + n * 0.1;
  o[0] = o[1] = o[2] = s; o[3] = w * 0.3 + n * 0.3; o[4] = 0.95;
}, { normal: 1 }));
