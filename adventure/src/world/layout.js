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
function bump(x, z, cx, cz, r) {
  const d = Math.hypot(x - cx, z - cz) / r;
  return d >= 1 ? 0 : smooth(1 - d);
}
function riverDist(x, z) {
  // polyline from north mountains to lake
  const pts = [[-20, 330], [-35, 220], [-10, 140], [-45, 60], [-35, 10], [-55, -30]];
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let h = 4 + fbm(x * 0.008, z * 0.008) * 10 + fbm(x * 0.04, z * 0.04, 3) * 1.2;
  // mountain rim
  const rim = Math.max(0, (r - 230) / 90);
  h += rim * rim * 70 * (0.7 + 0.5 * fbm(x * 0.01 + 7, z * 0.01));
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
  h = h * (1 - lb) + (-6) * lb * lb + h * 0 ;
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
