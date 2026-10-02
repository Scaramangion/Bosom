// Shared static-collider geometry, used by core/physics.js (character controller)
// and core/camera.js (camera occlusion). No ctx access here — pure functions.
//
// COLLIDER FORMATS (entries pushed onto ctx.colliders by any system):
//
//   Cylinder  { type:'cylinder', x, z, r, h, y? }
//     Vertical cylinder centred on (x, z) with radius r. It spans from its base
//     y (defaults to the terrain height at (x, z)) up to base + h.
//
//   Box       { type:'box', x, z, hw, hd, rot?, h, y? }
//     Oriented box on the ground. (x, z) is its centre; hw / hd are HALF extents
//     along the box's local X / local Z axes; rot is a rotation about +Y in
//     radians using the same convention as THREE.Object3D.rotation.y (so a mesh
//     with rotation.y = rot and a BoxGeometry(2*hw, h, 2*hd) matches exactly).
//     It spans from base y (defaults to terrain height at the centre) to base + h.
//
//   `type` may be omitted: an entry with `r` is a cylinder, one with `hw` a box.
//   Optional flags: `walkable:false` stops characters from standing on the top
//   (default: tops are walkable, e.g. crates, steps, low walls);
//   `camera:false` lets the camera pass through (e.g. thin fences, foliage).
//
// The list may grow at any time (systems add colliders during init or later);
// ColliderGrid rebuilds itself lazily when the array length changes, or when
// `ctx.collidersDirty = true` is set after mutating entries in place.

export function colliderKind(c) {
  if (c.type === 'box' || (c.type !== 'cylinder' && c.hw !== undefined)) return 'box';
  return 'cylinder';
}

export class ColliderGrid {
  constructor(heightAt, cell = 8) {
    this.heightAt = heightAt;
    this.cell = cell;
    this.map = new Map();
    this.count = -1;
    this.src = null;
    this.stamp = 0;
    this._seen = new Set();
    this._out = [];
  }
  ensure(list, force) {
    if (!force && list === this.src && list.length === this.count) return;
    this.src = list; this.count = list.length; this.map.clear();
    for (const c of list) {
      if (!c) continue;
      const kind = colliderKind(c);
      c._kind = kind;
      if (c.y === undefined || c._autoY) { c.y = this.heightAt(c.x, c.z); c._autoY = true; }
      if (kind === 'box') {
        const rot = c.rot || 0; c._cos = Math.cos(rot); c._sin = Math.sin(rot);
        c._br = Math.hypot(c.hw, c.hd);
      } else c._br = c.r;
      const x0 = Math.floor((c.x - c._br) / this.cell), x1 = Math.floor((c.x + c._br) / this.cell);
      const z0 = Math.floor((c.z - c._br) / this.cell), z1 = Math.floor((c.z + c._br) / this.cell);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
        const k = i * 100003 + j; let a = this.map.get(k);
        if (!a) this.map.set(k, a = []);
        a.push(c);
      }
    }
  }
  // Colliders whose cells overlap the AABB [x0,x1]x[z0,z1]. Reuses an internal array.
  query(x0, z0, x1, z1) {
    const out = this._out; out.length = 0; const seen = this._seen; seen.clear();
    const i0 = Math.floor(x0 / this.cell), i1 = Math.floor(x1 / this.cell);
    const j0 = Math.floor(z0 / this.cell), j1 = Math.floor(z1 / this.cell);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 400) { // huge query: scan everything
      for (const c of this.src || []) if (c) out.push(c);
      return out;
    }
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const a = this.map.get(i * 100003 + j); if (!a) continue;
      for (const c of a) if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }
}

// Box local coords: inverse of Object3D.rotation.y
function toLocal(c, dx, dz, out) {
  out[0] = dx * c._cos - dz * c._sin;
  out[1] = dx * c._sin + dz * c._cos;
  return out;
}
function toWorld(c, lx, lz, out) {
  out[0] = lx * c._cos + lz * c._sin;
  out[1] = -lx * c._sin + lz * c._cos;
  return out;
}
const L = [0, 0], W = [0, 0];

// Is the horizontal point (x,z) inside the collider footprint (shrunk by pad)?
export function footprintContains(c, x, z, pad = 0) {
  if (c._kind === 'box') {
    toLocal(c, x - c.x, z - c.z, L);
    return Math.abs(L[0]) <= c.hw + pad && Math.abs(L[1]) <= c.hd + pad;
  }
  const dx = x - c.x, dz = z - c.z, r = c.r + pad;
  return dx * dx + dz * dz <= r * r;
}

// Push a circle (x,z,radius) out of a collider footprint.
// Returns null when not overlapping, else { x, z, nx, nz } (resolved position + push normal).
const PUSH = { x: 0, z: 0, nx: 0, nz: 0 };
export function pushOut(c, x, z, radius) {
  if (c._kind === 'box') {
    toLocal(c, x - c.x, z - c.z, L);
    const lx = L[0], lz = L[1];
    const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz));
    let dx = lx - cx, dz = lz - cz; const d2 = dx * dx + dz * dz;
    let nlx, nlz, plx, plz;
    if (d2 > 1e-10) {
      if (d2 >= radius * radius) return null;
      const d = Math.sqrt(d2); nlx = dx / d; nlz = dz / d;
      plx = cx + nlx * radius; plz = cz + nlz * radius;
    } else { // centre inside the box: exit through the nearest face
      const ex = c.hw - Math.abs(lx), ez = c.hd - Math.abs(lz);
      if (ex < ez) { nlx = Math.sign(lx) || 1; nlz = 0; plx = nlx * (c.hw + radius); plz = lz; }
      else { nlx = 0; nlz = Math.sign(lz) || 1; plx = lx; plz = nlz * (c.hd + radius); }
    }
    toWorld(c, plx, plz, W); PUSH.x = c.x + W[0]; PUSH.z = c.z + W[1];
    toWorld(c, nlx, nlz, W); PUSH.nx = W[0]; PUSH.nz = W[1];
    return PUSH;
  }
  const dx = x - c.x, dz = z - c.z, rr = c.r + radius, d2 = dx * dx + dz * dz;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2);
  const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
  PUSH.x = c.x + nx * rr; PUSH.z = c.z + nz * rr; PUSH.nx = nx; PUSH.nz = nz;
  return PUSH;
}

// First hit fraction t in [0,1] of segment a->b (3D, arrays or Vector3-likes)
// against the collider inflated by pad, or Infinity.
export function segmentHit(c, ax, ay, az, bx, by, bz, pad = 0) {
  const dx = bx - ax, dz = bz - az, dy = by - ay;
  let t0 = 0, t1 = 1;
  if (c._kind === 'box') {
    toLocal(c, ax - c.x, az - c.z, L); const ox = L[0], oz = L[1];
    toLocal(c, dx, dz, L); const vx = L[0], vz = L[1];
    const hx = c.hw + pad, hz = c.hd + pad;
    // slab test
    if (Math.abs(vx) < 1e-9) { if (Math.abs(ox) > hx) return Infinity; }
    else { let a = (-hx - ox) / vx, b = (hx - ox) / vx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (Math.abs(vz) < 1e-9) { if (Math.abs(oz) > hz) return Infinity; }
    else { let a = (-hz - oz) / vz, b = (hz - oz) / vz; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (t0 > t1) return Infinity;
  } else {
    const ox = ax - c.x, oz = az - c.z, r = c.r + pad;
    const A = dx * dx + dz * dz, B = 2 * (ox * dx + oz * dz), C = ox * ox + oz * oz - r * r;
    if (A < 1e-12) { if (C > 0) return Infinity; }
    else {
      const disc = B * B - 4 * A * C; if (disc < 0) return Infinity;
      const s = Math.sqrt(disc);
      t0 = Math.max(t0, (-B - s) / (2 * A)); t1 = Math.min(t1, (-B + s) / (2 * A));
      if (t0 > t1) return Infinity;
    }
  }
  // vertical slab
  const y0 = c.y - pad, y1 = c.y + c.h + pad;
  if (Math.abs(dy) < 1e-9) { if (ay < y0 || ay > y1) return Infinity; }
  else { let a = (y0 - ay) / dy, b = (y1 - ay) / dy; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
  if (t0 > t1) return Infinity;
  return t0;
}
