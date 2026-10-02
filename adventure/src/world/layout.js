// Shared world layout + analytic height function. Every system may import this
// (terrain renders it; physics, foliage, village, enemies query it).
// The terrain builder owns this file and may refine the shape, but must keep the
// exported names and keep the landmarks below roughly where they are.
//
// World: 800 x 800 units, 1 unit = 1 metre. Hero is ~1.7 m tall. Water level y = 0.
// Landmarks (x, z):
//   SPAWN        (0, 0)      grassy meadow on a gentle rise, Koto's start
//   VILLAGE      (55, 20)    "Brennan's Hollow" farming village on flat ground, radius ~35
//   LAKE         (-60, -60)  lake, radius ~40, with a shore and shallows
//   FOREST       (-70, 60)   dense old forest, radius ~50
//   CLIFFS       ring of tall mountains/cliffs at radius > 260 boxing in the province
//   RIVER        from the north mountains down into the LAKE
//   SHRINE       (20, -140)  ruined temple on a hill, the far vista landmark
// Extra exports (terrain builder): PATHS, pathDist(x,z), forestDensity(x,z), smoothstep.
export const WORLD_SIZE = 800;
export const WATER_LEVEL = 0;
export const LANDMARKS = {
  spawn: { x: 0, z: 0 },
  village: { x: 55, z: 20, r: 35 },
  lake: { x: -60, z: -60, r: 40 },
  forest: { x: -70, z: 60, r: 50 },
  shrine: { x: 20, z: -140, r: 25 },
};

// --- deterministic value noise ---
function hash(x, z) {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
export function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
export function noise2(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
export function fbm(x, z, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}
// ridged multifractal 0..~1 : sharp crests for mountain silhouettes
export function ridged(x, z, oct = 5) {
  let s = 0, a = 0.5, f = 1, w = 1;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise2(x * f + i * 17.3, z * f - i * 9.1));
    n *= n; n *= w; w = Math.min(1, n * 1.6);
    s += n * a; f *= 2.1; a *= 0.5;
  }
  return s;
}
function bump(x, z, cx, cz, r) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : smooth(1 - d);
}
const RIVER_PTS = [[-20, 330], [-35, 220], [-10, 140], [-45, 60], [-35, 10], [-55, -30]];
function riverDist(x, z) {
  // polyline from north mountains to lake
  const pts = RIVER_PTS;
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

// --- dirt path network (spawn -> village -> shrine, spawn -> lake, spawn -> forest edge)
const PATH_CTRL = [
  [[0, 0], [10, 6], [22, 8], [34, 15], [46, 17], [55, 20]],
  [[55, 20], [56, 2], [50, -18], [40, -42], [33, -68], [34, -92], [27, -114], [21, -130], [20, -140]],
  [[0, 0], [-7, -9], [-13, -16], [-22, -21], [-29, -29]],
  [[0, 0], [-8, 10], [-14, 22], [-22, 33], [-27, 44]],
];
function catmull(pts, sub) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < sub; s++) {
      const t = s / sub, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      let x = f(p0[0], p1[0], p2[0], p3[0]), z = f(p0[1], p1[1], p2[1], p3[1]);
      // organic wobble
      x += noise2(x * 0.09 + 3.1, z * 0.09) * 1.3; z += noise2(x * 0.09, z * 0.09 + 8.7) * 1.3;
      out.push([x, z]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export const PATHS = PATH_CTRL.map(c => {
  const pts = catmull(c, 6);
  let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
  for (const [x, z] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
  return { pts, minx: minx - 12, maxx: maxx + 12, minz: minz - 12, maxz: maxz + 12 };
});
// distance (m) to the nearest path centre line (capped at 12)
export function pathDist(x, z) {
  let best = 12;
  for (const p of PATHS) {
    if (x < p.minx || x > p.maxx || z < p.minz || z > p.maxz) continue;
    const pts = p.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i][0], az = pts[i][1], dx = pts[i + 1][0] - ax, dz = pts[i + 1][1] - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz + 1e-9)));
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) best = d;
    }
  }
  return best;
}

// 0..1 tree density: the old forest + woods on the mountain foothills
export function forestDensity(x, z) {
  const d = Math.hypot(x - LANDMARKS.forest.x, z - LANDMARKS.forest.z) + noise2(x * 0.05, z * 0.05) * 10;
  let f = smoothstep(58, 34, d);
  const r = Math.hypot(x, z);
  const band = smoothstep(170, 215, r) * (1 - smoothstep(330, 370, r));
  const patch = smoothstep(-0.05, 0.25, fbm(x * 0.012 + 40, z * 0.012 - 13, 3));
  f = Math.max(f, band * patch);
  // keep landmarks clear
  f *= smoothstep(48, 70, Math.hypot(x - LANDMARKS.village.x, z - LANDMARKS.village.z));
  f *= smoothstep(30, 55, Math.hypot(x - LANDMARKS.shrine.x, z - LANDMARKS.shrine.z));
  f *= smoothstep(45, 60, Math.hypot(x - LANDMARKS.lake.x, z - LANDMARKS.lake.z));
  f *= smoothstep(28, 45, Math.hypot(x, z));
  return f;
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 7.5 + fbm(x * 0.008, z * 0.008) * 9 + fbm(x * 0.04, z * 0.04, 3) * 1.2;
  // mountain rim: foothills then craggy ridged peaks, capped so the corners stay sane
  const rt = smoothstep(215, 345, r);
  if (rt > 0) {
    const rg = ridged(x * 0.0065 + 3, z * 0.0065 - 5);
    const cliff = smoothstep(0.35, 0.6, rt); // steep cliff band
    h += rt * 30 + cliff * (55 + 150 * rg) + rt * rt * 40 * fbm(x * 0.02, z * 0.02, 3);
  }
  // shrine hill
  h += bump(x, z, 20, -140, 70) * 22;
  // flatten village
  const vb = bump(x, z, 55, 20, 55);
  h = h * (1 - vb) + 5 * vb;
  // spawn meadow gentle rise
  const sb = bump(x, z, 0, 0, 40);
  h = h * (1 - sb) + (6 + fbm(x * 0.03, z * 0.03) * 0.8) * sb;
  // lake basin
  const lb = bump(x, z, -60, -60, 70);
  h = h * (1 - lb) + (-6) * lb * lb;
  // dirt paths: worn slightly into the ground
  const pd = pathDist(x, z);
  if (pd < 3.5) h -= 0.16 * smooth(1 - pd / 3.5);
  // river carve
  const rd = riverDist(x, z);
  if (rd < 18) { const k = smooth(1 - rd / 18); h = h * (1 - k) + (-2.0) * k; }
  return h;
}

export function normalAt(x, z, out) {
  const e = 0.5;
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  out.set(-hx, 2 * e, -hz).normalize();
  return out;
}
export { riverDist };
