// Geometry kit: world-scaled UV primitives + a per-material merger so the
// whole village renders in a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

export function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, order = 'YXZ') {
  _e.set(rx, ry, rz, order); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_v.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// Re-project the UVs of any geometry from its local positions, choosing the projection
// plane per-vertex from the dominant normal axis. mode:
//  'wall'  : u = horizontal, v = vertical (plaster, stone, plank doors)
//  'grain' : u follows the longest box dimension (beams: grain runs along the member)
//  'top'   : u = x, v = z on every face (roofs built as slabs, decks)
export function projectUV(geo, s = 0.5, mode = 'wall', dims = null, off = [0, 0]) {
  geo.computeBoundingBox();
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const bb = geo.boundingBox; const size = bb.getSize(new THREE.Vector3());
  const d = dims || [size.x, size.y, size.z];
  const longAxis = d[0] >= d[1] && d[0] >= d[2] ? 0 : d[1] >= d[2] ? 1 : 2;
  for (let i = 0; i < pos.count; i++) {
    const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const n = [Math.abs(nrm.getX(i)), Math.abs(nrm.getY(i)), Math.abs(nrm.getZ(i))];
    const ax = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2;
    let a, b; // in-plane axes
    if (ax === 0) { a = 2; b = 1; } else if (ax === 1) { a = 0; b = 2; } else { a = 0; b = 1; }
    if (mode === 'grain') { if (b === longAxis) { const t = a; a = b; b = t; } }
    else if (mode === 'top') { if (ax === 0) { a = 2; b = 1; } else if (ax === 2) { a = 0; b = 1; } }
    else if (mode === 'vgrain') { if (a === longAxis) { const t = a; a = b; b = t; } }
    uv[i * 2] = p[a] * s + off[0]; uv[i * 2 + 1] = p[b] * s + off[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function box(w, h, d, s = 0.5, mode = 'wall', R = Math.random) {
  const g = new THREE.BoxGeometry(w, h, d);
  return projectUV(g, s, mode, [w, h, d], [R() * 7, R() * 7]);
}
// box whose bottom sits at y=0
export function boxB(w, h, d, s, mode, R) { const g = box(w, h, d, s, mode, R); g.translate(0, h / 2, 0); return g; }

export function cyl(rt, rb, h, seg = 12, s = 0.5, open = false, hs = 1) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, hs, open);
  const uv = g.attributes.uv; const circ = Math.PI * 2 * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ * s, uv.getY(i) * h * s);
  return g;
}

// Triangular gable: base width w (x), apex height h (y), at z=0, two faces (both sides) plus thickness t
export function gable(w, h, t = 0.2, s = 0.5) {
  const hw = w / 2, ht = t / 2;
  const P = [
    // front (+z)
    -hw, 0, ht, hw, 0, ht, 0, h, ht,
    // back (-z)
    hw, 0, -ht, -hw, 0, -ht, 0, h, -ht,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.computeVertexNormals();
  const uv = []; for (let i = 0; i < 6; i++) uv.push(P[i * 3] * s, P[i * 3 + 1] * s);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// Quad facing +z centred at origin, 0..1 UVs
export function quad(w, h) { return new THREE.PlaneGeometry(w, h); }

// Lathe with world-scaled UVs
export function lathe(points, seg = 12, s = 0.5) {
  const g = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), seg);
  let len = 0; const L = [0]; for (let i = 1; i < points.length; i++) { len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); L.push(len); }
  const maxR = Math.max(...points.map(p => p[0]));
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const j = i % points.length;
    uv.setXY(i, uv.getX(i) * Math.PI * 2 * maxR * s, L[j] * s);
  }
  return g;
}

const WHITE = new THREE.Color(1, 1, 1);
export class Merger {
  constructor() { this.groups = new Map(); }
  // opts: { color: THREE.Color|hex, wall: [baseY, topY] }
  add(key, geo, matrix, opts = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (matrix) g.applyMatrix4(matrix);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3), wall = new Float32Array(n * 2);
    const c = opts.color !== undefined ? (opts.color.isColor ? opts.color : new THREE.Color(opts.color)) : WHITE;
    const wb = opts.wall ? opts.wall[0] : -1e4, wt = opts.wall ? opts.wall[1] : 1e4;
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; wall[i * 2] = wb; wall[i * 2 + 1] = wt; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aWall', new THREE.BufferAttribute(wall, 2));
    g.morphAttributes = {};
    if (!this.groups.has(key)) this.groups.set(key, []);
    this.groups.get(key).push(g);
    return g;
  }
  build(materials, parent, { castShadow = true, receiveShadow = true } = {}) {
    const meshes = {};
    for (const [key, list] of this.groups) {
      if (!list.length) continue;
      const geo = mergeGeometries(list, false);
      if (!geo) { console.warn('[village] merge failed for', key); continue; }
      geo.computeBoundingSphere();
      const m = materials[key];
      if (!m) { console.warn('[village] no material', key); continue; }
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = castShadow && !m.userData.noShadow; mesh.receiveShadow = receiveShadow;
      mesh.name = 'village-' + key;
      parent.add(mesh); meshes[key] = mesh;
    }
    this.groups.clear();
    return meshes;
  }
}
