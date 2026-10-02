// Stylised villagers: one merged, vertex-coloured mesh each, idle bob + breathing.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const PI = Math.PI;
function col(g, c) {
  g = g.index ? g.toNonIndexed() : g;
  const n = g.attributes.position.count, a = new Float32Array(n * 3), cc = new THREE.Color(c);
  for (let i = 0; i < n; i++) { a[i * 3] = cc.r; a[i * 3 + 1] = cc.g; a[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
const T = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1, sy = s, sz = s) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, sy, sz))); return g; };

export function villager(look) {
  const parts = [];
  const skin = look.skin, cloth = look.cloth, trousers = look.trousers, hair = look.hair;
  const dress = look.dress;
  // legs / boots
  for (const sd of [-1, 1]) {
    parts.push(col(T(new THREE.CylinderGeometry(0.075, 0.065, 0.75, 8), sd * 0.1, 0.5, 0), trousers));
    parts.push(col(T(new THREE.BoxGeometry(0.14, 0.12, 0.26), sd * 0.1, 0.06, 0.04), 0x3a2618));
  }
  // tunic / dress (lathe)
  const prof = dress
    ? [[0.0, 0.25], [0.36, 0.25], [0.3, 0.6], [0.22, 0.95], [0.2, 1.15], [0.23, 1.35], [0.15, 1.45], [0.0, 1.46]]
    : [[0.0, 0.72], [0.26, 0.72], [0.24, 0.95], [0.21, 1.1], [0.24, 1.35], [0.15, 1.45], [0.0, 1.46]];
  parts.push(col(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 14), cloth));
  // apron / belt
  parts.push(col(T(new THREE.TorusGeometry(0.215, 0.025, 4, 16), 0, 1.0, 0, PI / 2), look.belt || 0x5a3a1e));
  if (look.apron) parts.push(col(T(new THREE.PlaneGeometry(0.32, 0.5), 0, 0.78, 0.24, -0.12), look.apron));
  // arms
  for (const sd of [-1, 1]) {
    const arm = new THREE.CylinderGeometry(0.06, 0.055, 0.58, 8);
    parts.push(col(T(arm, sd * 0.28, 1.12, 0.02, 0.08, 0, sd * 0.18), cloth));
    parts.push(col(T(new THREE.SphereGeometry(0.06, 8, 6), sd * 0.33, 0.82, 0.05), skin));
  }
  // neck + head
  parts.push(col(T(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), 0, 1.5, 0), skin));
  parts.push(col(T(new THREE.SphereGeometry(0.17, 16, 12), 0, 1.68, 0, 0, 0, 0, 1, 1.08, 1), skin));
  parts.push(col(T(new THREE.SphereGeometry(0.035, 6, 5), 0, 1.66, 0.17), look.nose || skin));
  for (const sd of [-1, 1]) {
    parts.push(col(T(new THREE.SphereGeometry(0.025, 6, 5), sd * 0.065, 1.71, 0.145), 0x1a1410));
    parts.push(col(T(new THREE.SphereGeometry(0.04, 6, 5), sd * 0.17, 1.67, 0), skin)); // ears
  }
  // hair
  parts.push(col(T(new THREE.SphereGeometry(0.185, 14, 10, 0, PI * 2, 0, PI * 0.55), 0, 1.69, -0.015, -0.25), hair));
  if (look.bun) parts.push(col(T(new THREE.SphereGeometry(0.08, 8, 6), 0, 1.78, -0.16), hair));
  if (look.beard) parts.push(col(T(new THREE.SphereGeometry(0.12, 10, 8), 0, 1.57, 0.08, 0, 0, 0, 1, 0.9, 0.7), hair));
  if (look.hat) {
    parts.push(col(T(new THREE.CylinderGeometry(0.36, 0.38, 0.03, 18), 0, 1.82, 0), look.hat));
    parts.push(col(T(new THREE.CylinderGeometry(0.14, 0.18, 0.18, 14), 0, 1.92, 0), look.hat));
    parts.push(col(T(new THREE.TorusGeometry(0.17, 0.02, 4, 16), 0, 1.86, 0, PI / 2), 0x7a3326));
  }
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}

export const LOOKS = [
  { skin: 0xe0b08a, cloth: 0x7a8a4a, trousers: 0x5a4a3a, hair: 0x5a3a20, hat: 0xd8c080, beard: true, belt: 0x4a2a14 },
  { skin: 0xf0c8a8, cloth: 0x8a3a3a, trousers: 0x4a3a30, hair: 0x9a5a2a, dress: true, apron: 0xf0e8d8, bun: true },
  { skin: 0xc89070, cloth: 0x3f5a7a, trousers: 0x3a3a3a, hair: 0x2a2018, belt: 0x6a4a2a },
];
