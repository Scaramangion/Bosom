// Static plan of Brennan's Hollow (pure data, no three.js) so other systems
// (foliage scatter, terrain path painting, enemies) can import it at init time:
//   import { isOccupied, ROADS } from '../village/plan.js'
import { LANDMARKS } from '../world/layout.js';

export const CENTER = { x: LANDMARKS.village.x, z: LANDMARKS.village.z };
export const SQUARE = { x: 55, z: 20, r: 8.5 };

// front of each building faces local +z rotated by `rot` (radians about +y)
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
// NB: layout.PATHS already paints spawn->square (from the west) and square->shrine
// (leaving south-ish past x~56, z 2..-18); buildings keep clear of both.
export const HOUSES = [
  { id: 'inn', x: 66, z: 4, rot: face(66, 4, 50, 22), w: 12, d: 8, floors: 2, roof: 'slate', ridge: 'x', pitch: 0.72, jetty: true, porch: true, chimneys: [-1, 1], tint: 0xf3e6cc, label: "Brennan's Theme" },
  { id: 'h1', x: 34, z: 25, rot: face(34, 25, 48, 18), w: 7, d: 6, floors: 1, roof: 'thatch', ridge: 'x', pitch: 0.85, porch: true, chimneys: [1], tint: 0xf0e2c6 },
  { id: 'h2', x: 50, z: 37, rot: face(50, 37, 55, 22), w: 7.5, d: 6, floors: 2, roof: 'shingle', ridge: 'z', pitch: 0.75, jetty: true, chimneys: [-1], tint: 0xeadcc0, laundry: true },
  { id: 'h3', x: 40, z: 3, rot: face(40, 3, 52, 15), w: 6.5, d: 5.5, floors: 1, roof: 'slate', ridge: 'z', pitch: 0.8, stone: true, chimneys: [1], tint: 0xe8dfcc },
  { id: 'h4', x: 72, z: 31, rot: face(72, 31, 57, 21), w: 8, d: 6, floors: 1, roof: 'thatch', ridge: 'x', pitch: 0.82, porch: true, chimneys: [-1], tint: 0xf2e4c4 },
  { id: 'h5', x: 75, z: 16, rot: face(75, 16, 57, 19), w: 6.5, d: 6, floors: 2, roof: 'redtile', ridge: 'z', pitch: 0.7, stone: true, chimneys: [1], tint: 0xece0c8 },
  { id: 'h6', x: 43, z: -10, rot: face(43, -10, 54, 6), w: 7, d: 5.5, floors: 1, roof: 'shingle', ridge: 'x', pitch: 0.8, chimneys: [1], tint: 0xefe3c9 },
  { id: 'h7', x: 64, z: 46, rot: face(64, 46, 56, 26), w: 6.5, d: 5.5, floors: 1, roof: 'thatch', ridge: 'z', pitch: 0.85, chimneys: [1], tint: 0xf4e8d0 },
  { id: 'barn', x: 92, z: 3, rot: face(92, 3, 75, 10), w: 9, d: 12, floors: 1, roof: 'shingle', ridge: 'z', pitch: 0.78, barn: true, chimneys: [], tint: 0xffffff },
];
export const WINDMILL = { x: 84, z: -20, r: 3.4 };
export const WELL = { x: SQUARE.x + 1.5, z: SQUARE.z + 2, r: 1.4 };

// secondary lanes (rendered by the village as dirt ribbons; main paths come from layout.PATHS)
export const ROADS = [
  [[SQUARE.x, SQUARE.z], [62, 12], [75, -6], [WINDMILL.x - 2, WINDMILL.z + 3.5]],
  [[SQUARE.x, SQUARE.z], [66, 21], [80, 23], [94, 22], [104, 24]],
  [[SQUARE.x, SQUARE.z], [53, 29], [57, 46], [60, 62]],
  [[75, -6], [86, -2], [90, 0]],
  [[-27, 44], [-34, 45.6], [-42, 44], [-52, 42], [-62, 40], [-74, 41]],
];

export const FIELDS = [
  { kind: 'wheat', x: 102, z: 36, w: 22, d: 13, rot: 0.05 },
  { kind: 'veg', x: 86, z: 47, w: 12, d: 9, rot: -0.1 },
  { kind: 'wheat', x: 77, z: 62, w: 16, d: 10, rot: 0.25 },
];
export const BRIDGE = { x0: -53.5, z0: 41.7, x1: -30.5, z1: 46.3, w: 3.2 };

export const SHRINE = { x: LANDMARKS.shrine.x, z: LANDMARKS.shrine.z, r: 22 };

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function roadDist(x, z) {
  let best = 1e9;
  for (const r of ROADS) for (let i = 0; i < r.length - 1; i++) best = Math.min(best, segDist(x, z, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]));
  return best;
}
// true if (x,z) is inside a building/field/plaza/road footprint (+pad metres)
export function isOccupied(x, z, pad = 1) {
  if (Math.hypot(x - SQUARE.x, z - SQUARE.z) < SQUARE.r + pad) return true;
  if (Math.hypot(x - WINDMILL.x, z - WINDMILL.z) < WINDMILL.r + 2 + pad) return true;
  for (const h of HOUSES) {
    const c = Math.cos(h.rot), s = Math.sin(h.rot);
    const lx = (x - h.x) * c - (z - h.z) * s, lz = (x - h.x) * s + (z - h.z) * c;
    if (Math.abs(lx) < h.w / 2 + 1.5 + pad && Math.abs(lz) < h.d / 2 + 3 + pad) return true;
  }
  for (const f of FIELDS) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot);
    const lx = (x - f.x) * c - (z - f.z) * s, lz = (x - f.x) * s + (z - f.z) * c;
    if (Math.abs(lx) < f.w / 2 + 1 + pad && Math.abs(lz) < f.d / 2 + 1 + pad) return true;
  }
  if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < 16 + pad) return true;
  return roadDist(x, z) < 1.8 + pad;
}
