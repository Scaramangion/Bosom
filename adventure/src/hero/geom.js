// Geometry helpers: parametric surfaces with seam-welded normals, and
// distance-to-bone-segment smooth skinning.
import * as THREE from 'three';

// fn(u, v, outVec3) with u,v in [0,1]. Returns BufferGeometry (indexed) with uv = (u*uS, v*vS).
export function paramSurface(nu, nv, fn, { closedU = false, uS = 1, vS = 1, flip = false, uvFn = null, orient = true } = {}) {
  const pos = [], uv = [], idx = [];
  const p = new THREE.Vector3();
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      fn(u, v, p);
      pos.push(p.x, p.y, p.z);
      if (uvFn) { const q = uvFn(u, v); uv.push(q[0], q[1]); } else uv.push(u * uS, v * vS);
    }
  }
  const row = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (orient && !flip) {
    // make normals point away from the centroid (closed-ish shapes)
    let cx = 0, cy = 0, cz = 0; const n = pos.length / 3;
    for (let i = 0; i < pos.length; i += 3) { cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2]; }
    cx /= n; cy /= n; cz /= n;
    const N = g.attributes.normal.array; let d = 0;
    for (let i = 0; i < pos.length; i += 3) d += (pos[i] - cx) * N[i] + (pos[i + 1] - cy) * N[i + 1] + (pos[i + 2] - cz) * N[i + 2];
    if (d < 0) {
      for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
      g.setIndex(idx); g.computeVertexNormals();
    }
  }
  weldNormals(g);
  return g;
}

// Average normals of coincident vertices (seams, poles) so surfaces shade smoothly.
export function weldNormals(g, eps = 1e-5) {
  const P = g.attributes.position, N = g.attributes.normal;
  const map = new Map();
  const key = i => `${Math.round(P.getX(i) / eps)},${Math.round(P.getY(i) / eps)},${Math.round(P.getZ(i) / eps)}`;
  for (let i = 0; i < P.count; i++) { const k = key(i); let a = map.get(k); if (!a) map.set(k, a = []); a.push(i); }
  const n = new THREE.Vector3();
  for (const a of map.values()) {
    if (a.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of a) n.x += N.getX(i), n.y += N.getY(i), n.z += N.getZ(i);
    n.normalize();
    for (const i of a) N.setXYZ(i, n.x, n.y, n.z);
  }
  N.needsUpdate = true;
  return g;
}

function segDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t, p.z - a.z - abz * t);
}

// segs: [{ index, a:Vector3, b:Vector3, bias?:number }]
// Smooth weights w = bias / (d + eps)^power, top-4, normalised.
export function skinBySegments(g, segs, { power = 4, eps = 0.012 } = {}) {
  const P = g.attributes.position, n = P.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const p = new THREE.Vector3();
  const tmp = segs.map(() => ({ i: 0, w: 0 }));
  for (let v = 0; v < n; v++) {
    p.fromBufferAttribute(P, v);
    for (let s = 0; s < segs.length; s++) {
      const S = segs[s];
      const d = segDist(p, S.a, S.b);
      const b = typeof S.bias === 'function' ? S.bias(p) : (S.bias ?? 1);
      tmp[s].i = S.index; tmp[s].w = b / Math.pow(d + eps, power);
    }
    tmp.sort((x, y) => y.w - x.w);
    let tot = 0; for (let k = 0; k < 4 && k < tmp.length; k++) tot += tmp[k].w;
    for (let k = 0; k < 4; k++) {
      if (k < tmp.length) { si[v * 4 + k] = tmp[k].i; sw[v * 4 + k] = tmp[k].w / tot; }
    }
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}

// Rigid: all vertices to one bone.
export function skinRigid(g, index) {
  const n = g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) { si[v * 4] = index; sw[v * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}

export const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// piecewise-smooth interpolation through [[x, ...vals]] keys (Catmull-Rom on values)
export function curve(keys) {
  return (x) => {
    if (x <= keys[0][0]) return keys[0].slice(1);
    const L = keys.length;
    if (x >= keys[L - 1][0]) return keys[L - 1].slice(1);
    let i = 0; while (keys[i + 1][0] < x) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(L - 1, i + 2)];
    const t = (x - k1[0]) / (k2[0] - k1[0]);
    const out = [];
    for (let c = 1; c < k1.length; c++) {
      const p0 = k0[c], p1 = k1[c], p2 = k2[c], p3 = k3[c];
      const t2 = t * t, t3 = t2 * t;
      out.push(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
    }
    return out;
  };
}

// Orthonormal frame helpers for tubes along a polyline
export function tubeAlong(points, radiusFn, { radial = 16, segs = 24, shape = null, uS = 1, vS = 1, caps = false } = {}) {
  // points: array of Vector3 (smooth path via CatmullRomCurve3)
  const crv = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const frames = crv.computeFrenetFrames(segs, false);
  const len = crv.getLength();
  const P = new THREE.Vector3();
  return paramSurface(radial, segs, (u, v, out) => {
    const j = Math.round(v * segs);
    crv.getPointAt(v, P);
    const N = frames.normals[j], B = frames.binormals[j];
    const th = u * Math.PI * 2;
    let [rx, ry] = radiusFn(v, th);
    if (caps && (v === 0 || v === 1)) { rx = ry = 0; }
    let cx = Math.cos(th), cy = Math.sin(th);
    if (shape) [cx, cy] = shape(cx, cy, v, th);
    out.copy(P).addScaledVector(N, cx * rx).addScaledVector(B, cy * ry);
  }, { closedU: true, uS, vS: vS * len });
}
