// Procedural creature rigging: bone chains + swept "tube" skins with smooth
// multi-bone weights, rigid attachments, and shell-fur geometry replication.
// Everything is merged so a creature is ~3 draw calls (skin, fur shells, hard parts).
import * as THREE from 'three';

const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const herm = s => s * s * (3 - 2 * s);

export function srgb(hex) { return new THREE.Color(hex); } // THREE.Color(hex) converts sRGB -> linear working space

class Acc {
  constructor() {
    this.pos = []; this.nrm = []; this.uv = []; this.col = []; this.si = []; this.sw = []; this.fur = []; this.idx = [];
    this.seams = [];
  }
  get count() { return this.pos.length / 3; }
  vert(p, uvx, uvy, c, weights, fur) {
    this.pos.push(p.x, p.y, p.z); this.nrm.push(0, 1, 0); this.uv.push(uvx, uvy);
    this.col.push(c.r, c.g, c.b); this.fur.push(fur);
    const w = weights.slice().sort((a, b) => b[1] - a[1]).slice(0, 4);
    let tot = 0; for (const x of w) tot += x[1];
    for (let i = 0; i < 4; i++) { this.si.push(w[i] ? w[i][0] : 0); this.sw.push(w[i] ? w[i][1] / tot : 0); }
    return this.count - 1;
  }
  build(computeNormals = true) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('furUv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setAttribute('furLen', new THREE.Float32BufferAttribute(this.fur, 1));
    g.setAttribute('shell', new THREE.Float32BufferAttribute(new Float32Array(this.count), 1));
    g.setIndex(this.idx);
    if (computeNormals) {
      g.computeVertexNormals();
      const n = g.attributes.normal;
      for (const [i, j] of this.seams) {
        _a.fromBufferAttribute(n, i).add(_b.fromBufferAttribute(n, j)).normalize();
        n.setXYZ(i, _a.x, _a.y, _a.z); n.setXYZ(j, _a.x, _a.y, _a.z);
      }
    }
    return g;
  }
}

export class Rig {
  constructor() {
    this.bones = []; this.map = {}; this.rest = {};
    this.skin = new Acc(); this.hard = new Acc();
  }
  bone(name, parent, x, y, z) {
    const b = new THREE.Bone(); b.name = name;
    const wp = new THREE.Vector3(x, y, z);
    this.rest[name] = wp;
    if (parent) { b.position.copy(wp).sub(this.rest[parent]); this.map[parent].add(b); }
    else b.position.copy(wp);
    b.userData.i = this.bones.length;
    this.bones.push(b); this.map[name] = b;
    return b;
  }
  bi(name) { const b = this.map[name]; if (!b) throw new Error('no bone ' + name); return b.userData.i; }

  // Swept tube. pts: [{p:[x,y,z], b:'bone', r:[rx, ryA, ryB]}]
  // up: reference vector defining the ry axis (ryA on +up side, ryB on -up side).
  tube(o) {
    const acc = o.acc === 'hard' ? this.hard : this.skin;
    const P = o.pts.map(q => new THREE.Vector3(...q.p));
    const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
    const rings = o.rings || 32, segs = o.segs || 20, blend = o.blend ?? 0.35;
    const up = (o.up || new THREE.Vector3(0, 1, 0)).clone().normalize();
    const colorFn = o.color, furFn = o.fur || (() => 0);
    const sq = o.square ?? 0; // superellipse squareness
    const base = acc.count;
    let arc = 0; const prev = new THREE.Vector3();
    const tan = new THREE.Vector3(), side = new THREE.Vector3(), upv = new THREE.Vector3(), c = new THREE.Vector3();
    const ringInfo = [];
    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      curve.getPointAt(t, c); curve.getTangentAt(t, tan);
      if (i > 0) arc += c.distanceTo(prev); prev.copy(c);
      side.crossVectors(up, tan); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
      upv.crossVectors(tan, side).normalize();
      // project to polyline for radii + weights
      let bk = 0, bs = 0, bd = 1e9;
      for (let k = 0; k < P.length - 1; k++) {
        _a.subVectors(P[k + 1], P[k]); const L2 = _a.lengthSq();
        const s = Math.max(0, Math.min(1, _b.subVectors(c, P[k]).dot(_a) / L2));
        const d = _v.copy(P[k]).addScaledVector(_a, s).distanceToSquared(c);
        if (d < bd) { bd = d; bk = k; bs = s; }
      }
      const r0 = o.pts[bk].r, r1 = o.pts[bk + 1].r, h = herm(bs);
      const rx = r0[0] + (r1[0] - r0[0]) * h, ra = r0[1] + (r1[1] - r0[1]) * h, rb = (r0[2] ?? r0[1]) + ((r1[2] ?? r1[1]) - (r0[2] ?? r0[1])) * h;
      const oy = (o.pts[bk].oy || 0) + ((o.pts[bk + 1].oy || 0) - (o.pts[bk].oy || 0)) * h;
      // weights
      const W = new Map();
      const add = (bn, w) => { const id = this.bi(bn); W.set(id, (W.get(id) || 0) + w); };
      const bCur = o.pts[bk].b, bPrev = o.pts[Math.max(0, bk - 1)].b, bNext = o.pts[bk + 1].b;
      let wPrev = bk > 0 ? 0.5 * (1 - sstep(0, blend, bs)) : 0;
      let wNext = 0.5 * sstep(1 - blend, 1, bs);
      if (bk + 1 === P.length - 1 && !o.endBlend) wNext = 0; // last point usually only a shape point
      add(bCur, 1 - wPrev - wNext); if (wPrev > 0) add(bPrev, wPrev); if (wNext > 0) add(bNext, wNext);
      const weights = [...W.entries()];
      ringInfo.push({ c: c.clone(), tan: tan.clone() , rmin: Math.min(rx, ra, rb) });
      const perim = Math.PI * (rx + (ra + rb) * 0.5);
      for (let j = 0; j <= segs; j++) {
        const th = j / segs * Math.PI * 2;
        let ct = Math.cos(th), st = Math.sin(th);
        if (sq) { ct = Math.sign(ct) * Math.pow(Math.abs(ct), 1 - sq); st = Math.sign(st) * Math.pow(Math.abs(st), 1 - sq); }
        const ry = ct > 0 ? ra : rb;
        _v.copy(c).addScaledVector(side, rx * st).addScaledVector(upv, ry * ct + oy);
        _a.copy(side).multiplyScalar(st / Math.max(rx, 1e-3)).addScaledVector(upv, ct / Math.max(ry, 1e-3)).normalize();
        const col = colorFn ? colorFn(_v, _a, t, th) : new THREE.Color(1, 1, 1);
        acc.vert(_v, (j / segs) * perim, arc, col, weights, furFn(_v, _a, t, th));
      }
      acc.seams.push([acc.count - segs - 1, acc.count - 1]);
    }
    const S = segs + 1;
    for (let i = 0; i < rings - 1; i++) for (let j = 0; j < segs; j++) {
      const a = base + i * S + j, b = a + 1, d = a + S, e = d + 1;
      acc.idx.push(a, d, b, b, d, e);
    }
    // caps: pole vertex pushed outward along tangent
    const capAt = (ri, dir) => {
      const R = ringInfo[ri];
      const pole = R.c.clone().addScaledVector(R.tan, dir * R.rmin * (o.capRound ?? 0.7));
      const rbase = base + ri * S;
      const W = acc.si.slice(rbase * 4, rbase * 4 + 4).map((id, k) => [id, acc.sw[rbase * 4 + k]]).filter(x => x[1] > 0);
      const col = new THREE.Color(acc.col[rbase * 3], acc.col[rbase * 3 + 1], acc.col[rbase * 3 + 2]);
      const pi = acc.vert(pole, 0, acc.uv[rbase * 2 + 1] + dir * 0.02, col, W, acc.fur[rbase]);
      for (let j = 0; j < segs; j++) {
        if (dir > 0) acc.idx.push(rbase + j, pi, rbase + j + 1); else acc.idx.push(rbase + j + 1, pi, rbase + j);
      }
    };
    if (o.capStart !== false) capAt(0, -1);
    if (o.capEnd !== false) capAt(rings - 1, 1);
  }

  // Rigid geometry fully bound to one bone. m: Matrix4 (in model/bind space).
  part(geom, boneName, m, { acc = 'skin', color = new THREE.Color(1, 1, 1), fur = 0 } = {}) {
    const A = acc === 'hard' ? this.hard : this.skin;
    const g = geom.index ? geom : geom; const pos = g.attributes.position, nrm = g.attributes.normal;
    const base = A.count; const id = this.bi(boneName);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m);
      _a.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
      const c = typeof color === 'function' ? color(_v, _a) : color;
      const f = typeof fur === 'function' ? fur(_v, _a) : fur;
      A.vert(_v, (_v.x + _v.z) * 1.0, _v.y, c, [[id, 1]], f);
      const k = A.count - 1; A.nrm[k * 3] = _a.x; A.nrm[k * 3 + 1] = _a.y; A.nrm[k * 3 + 2] = _a.z;
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) A.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) A.idx.push(base + i);
    A.rigid = A.rigid || []; A.rigid.push([base, A.count]);
  }

  // Build skinned meshes. Returns { group, skeleton, skin, fur, hard, bones }
  build({ skinMat, hardMat, shells = 10, castShadow = true }) {
    const group = new THREE.Group();
    const root = this.bones[0];
    group.add(root);
    group.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(this.bones);
    const identity = new THREE.Matrix4();

    // skin: compute normals, but keep rigid-part normals (computeVertexNormals would smooth them anyway; fine)
    const skinGeo = this.skin.build(true);
    const skin = new THREE.SkinnedMesh(skinGeo, skinMat);
    skin.bind(skeleton, identity); skin.castShadow = castShadow; skin.receiveShadow = true;
    group.add(skin);

    let fur = null;
    if (shells > 0) {
      const furGeo = makeShells(skinGeo, shells);
      if (furGeo) {
        fur = new THREE.SkinnedMesh(furGeo, skinMat);
        fur.bind(skeleton, identity); fur.castShadow = false; fur.receiveShadow = true;
        group.add(fur);
      }
    }
    let hard = null;
    if (this.hard.count) {
      const hg = this.hard.build(true);
      hard = new THREE.SkinnedMesh(hg, hardMat);
      hard.bind(skeleton, identity); hard.castShadow = castShadow; hard.receiveShadow = true;
      group.add(hard);
    }
    for (const m of [skin, fur, hard]) if (m) m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.6);
    return { group, skeleton, skin, fur, hard, bones: this.map };
  }
}

// Replicate triangles that carry fur into N shell layers (shell attr 1/N .. 1).
function makeShells(g, N) {
  const idx = g.index.array, fur = g.attributes.furLen.array;
  const keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    if (fur[idx[i]] > 0.003 || fur[idx[i + 1]] > 0.003 || fur[idx[i + 2]] > 0.003) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  if (!keep.length) return null;
  // compact used verts
  const remap = new Map(); const used = [];
  for (const v of keep) if (!remap.has(v)) { remap.set(v, used.length); used.push(v); }
  const V = used.length;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv', 'furUv', 'color', 'skinIndex', 'skinWeight', 'furLen']) {
    const src = g.attributes[name]; const isz = src.itemSize;
    const arr = new src.array.constructor(V * N * isz);
    for (let s = 0; s < N; s++) for (let k = 0; k < V; k++) {
      const o = (s * V + k) * isz, iv = used[k] * isz;
      for (let c = 0; c < isz; c++) arr[o + c] = src.array[iv + c];
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, isz));
  }
  const sh = new Float32Array(V * N);
  for (let s = 0; s < N; s++) sh.fill((s + 1) / N, s * V, (s + 1) * V);
  out.setAttribute('shell', new THREE.BufferAttribute(sh, 1));
  const ix = new Uint32Array(keep.length * N);
  for (let s = 0; s < N; s++) for (let i = 0; i < keep.length; i++) ix[s * keep.length + i] = remap.get(keep[i]) + s * V;
  out.setIndex(new THREE.BufferAttribute(ix, 1));
  return out;
}

// Small helpers
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export function mtx(pos, euler = [0, 0, 0], scale = [1, 1, 1]) {
  return new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler)), new THREE.Vector3(...scale));
}
// curved thorn cone: bends tip backwards along -Z in its local frame
export function thornGeo(len, rad, bend = 0.4, seg = 6) {
  const g = new THREE.ConeGeometry(rad, len, seg, 4, false);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / len; p.setZ(i, p.getZ(i) - bend * len * y * y); }
  g.computeVertexNormals();
  return g;
}
