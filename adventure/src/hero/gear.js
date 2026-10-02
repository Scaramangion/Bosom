// Koto's gear: a steel arming sword (fullered blade, brass guard & pommel, wrapped
// grip), leather scabbard with brass fittings, and a round plank shield with iron
// rim, boss, rivets and a painted crest. Plus a swept slash-trail ribbon.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paramSurface, curve, tubeAlong } from './geom.js';

const TAU = Math.PI * 2;
export const BLADE_LEN = 0.78;

function lathe(profile, seg = 20) { // [[y, r]]
  const pts = profile.map(([y, r]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, seg);
}

export function buildSword(M) {
  const g = new THREE.Group(); g.name = 'sword';
  // blade (y from 0.03 up), lens/diamond section with a fuller
  const wP = curve([[0, 0.026], [0.06, 0.025], [0.7, 0.019], [0.86, 0.015], [0.96, 0.006], [1, 0.0005]]);
  const blade = paramSurface(16, 40, (u, v, o) => {
    const th = u * TAU, c = Math.cos(th), s = Math.sin(th);
    const w = wP(v)[0];
    let t = 0.0042 * (1 - 0.6 * v) + 0.0006;
    const fuller = v < 0.72 ? 1 - 0.55 * Math.exp(-(c * c) / 0.05) * Math.min(1, (0.72 - v) * 8) : 1;
    const z = t * Math.sign(s) * Math.pow(Math.abs(s), 0.9) * (1 - Math.pow(Math.abs(c), 3)) * fuller;
    o.set(w * c, 0.03 + v * (BLADE_LEN - 0.03), z);
  }, { uvFn: (u, v) => [u, v * 2] });
  const bm = new THREE.Mesh(blade, M.steel); g.add(bm);
  // crossguard: curved bar with flared ends
  const gpts = []; for (let i = 0; i <= 10; i++) { const x = (i / 10 - 0.5) * 0.19; gpts.push(new THREE.Vector3(x, 0.012 + 22 * Math.pow(Math.abs(x), 2.4), 0)); }
  const guard = tubeAlong(gpts, (v) => { const e = Math.abs(v - 0.5) * 2; const r = 0.0085 + 0.004 * Math.pow(e, 6); return [r, r * 1.25]; }, { radial: 10, segs: 20 });
  const gc = new THREE.SphereGeometry(0.016, 14, 10); gc.scale(1.3, 1.1, 0.9); gc.translate(0, 0.012, 0);
  const ends = [-1, 1].map(s => { const e = new THREE.SphereGeometry(0.0115, 10, 8); e.translate(s * 0.095, 0.012 + 22 * Math.pow(0.095, 2.4), 0); return e; });
  g.add(new THREE.Mesh(mergeGeometries([guard.toNonIndexed(), gc.toNonIndexed(), ...ends.map(e => e.toNonIndexed())]), M.brass));
  // grip: leather wrap with spiral ridges
  const grip = paramSurface(14, 24, (u, v, o) => {
    const th = u * TAU, r = 0.0135 + 0.0016 * Math.sin(th * 1 + v * 28 * Math.PI) * Math.sin(Math.PI * v) + 0.002 * Math.sin(Math.PI * v);
    o.set(r * Math.cos(th), -v * 0.115, r * Math.sin(th) * 0.85);
  }, { uS: 0.5, vS: 1 });
  g.add(new THREE.Mesh(grip, M.leatherDark));
  // pommel
  const pom = lathe([[-0.112, 0], [-0.116, 0.012], [-0.124, 0.02], [-0.135, 0.021], [-0.146, 0.016], [-0.152, 0.008], [-0.154, 0]]);
  g.add(new THREE.Mesh(pom, M.brass));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildScabbard(M) {
  const g = new THREE.Group(); g.name = 'scabbard';
  const L = BLADE_LEN + 0.03;
  const body = paramSurface(16, 20, (u, v, o) => {
    const th = u * TAU, c = Math.cos(th), s = Math.sin(th);
    const taper = 1 - 0.35 * v * v;
    const w = 0.032 * taper, t = 0.013 * taper;
    const e = v > 0.97 ? Math.sqrt(Math.max(0, 1 - (v - 0.97) / 0.03)) : 1;
    o.set(w * Math.sign(c) * Math.pow(Math.abs(c), 0.7) * e, 0.0 + v * L, t * s * e);
  }, { uS: 1, vS: 3 });
  g.add(new THREE.Mesh(body, M.leather));
  // throat and chape and a mid band (brass)
  for (const [y0, y1, sc] of [[0, 0.06, 1.12], [0.32, 0.345, 1.08], [L - 0.12, L - 0.005, 1.0]]) {
    const band = paramSurface(16, 3, (u, v, o) => {
      const th = u * TAU, c = Math.cos(th), s = Math.sin(th), y = y0 + v * (y1 - y0);
      const taper = (1 - 0.35 * (y / L) ** 2) * sc;
      o.set(0.034 * taper * Math.sign(c) * Math.pow(Math.abs(c), 0.7), y, 0.0145 * taper * s);
    });
    g.add(new THREE.Mesh(band, M.brass));
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export const SHIELD_R = 0.27;
// ensure a disk's normals point toward sign*Z
function fixFacing(g, sign) {
  const N = g.attributes.normal.array; let d = 0;
  for (let i = 2; i < N.length; i += 3) d += N[i];
  if (d * sign < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.index.needsUpdate = true; g.computeVertexNormals();
  }
}
export function buildShield(M) {
  const g = new THREE.Group(); g.name = 'shield';
  const R = SHIELD_R, dome = 0.04;
  const face = paramSurface(56, 14, (u, v, o) => {
    const a = u * TAU, r = v * R;
    o.set(Math.cos(a) * r, Math.sin(a) * r, dome * (1 - (r / R) ** 2) + 0.012);
  }, { uvFn: (u, v) => [0.5 + Math.cos(u * TAU) * v * 0.5, 0.5 - Math.sin(u * TAU) * v * 0.5], orient: false });
  fixFacing(face, 1);
  g.add(new THREE.Mesh(face, M.shield));
  // back: darker wood dish
  const back = paramSurface(40, 6, (u, v, o) => {
    const a = u * TAU, r = v * R;
    o.set(Math.cos(a) * r, Math.sin(a) * r, dome * 0.6 * (1 - (r / R) ** 2) - 0.004);
  }, { uvFn: (u, v) => [0.5 + Math.cos(u * TAU) * v * 0.5, 0.5 - Math.sin(u * TAU) * v * 0.5], orient: false });
  fixFacing(back, -1);
  g.add(new THREE.Mesh(back, M.leatherDark));
  // iron rim (tube around edge)
  const rim = paramSurface(64, 8, (u, v, o) => {
    const a = u * TAU, b = v * TAU;
    const rr = R + 0.006 * Math.cos(b), z = 0.006 + 0.012 * Math.sin(b);
    o.set(Math.cos(a) * rr, Math.sin(a) * rr, z);
  });
  g.add(new THREE.Mesh(rim, M.iron));
  // boss
  const boss = new THREE.SphereGeometry(0.058, 24, 12, 0, TAU, 0, Math.PI / 2);
  boss.rotateX(Math.PI / 2); boss.scale(1, 1, 0.55); boss.translate(0, 0, dome + 0.01);
  const flange = new THREE.CylinderGeometry(0.075, 0.078, 0.008, 28); flange.rotateX(Math.PI / 2); flange.translate(0, 0, dome + 0.012);
  g.add(new THREE.Mesh(mergeGeometries([boss, flange.toNonIndexed().index ? flange : flange]), M.iron));
  // rivets
  const rv = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = R * 0.94; const s = new THREE.SphereGeometry(0.0075, 8, 6); s.scale(1, 1, 0.6); s.translate(Math.cos(a) * r, Math.sin(a) * r, dome * (1 - 0.94 ** 2) + 0.016); rv.push(s); }
  g.add(new THREE.Mesh(mergeGeometries(rv), M.iron));
  // straps on the back
  for (const y of [-0.06, 0.06]) {
    const s = new THREE.BoxGeometry(0.34, 0.032, 0.008); s.translate(0, y, -0.012);
    g.add(new THREE.Mesh(s, M.leather));
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Slash trail: ribbon between blade base and tip samples, additive, fades.
export function buildTrail(scene) {
  const N = 16;
  const pos = new Float32Array(N * 2 * 3), alpha = new Float32Array(N * 2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
  const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.92, 0.75) } },
    vertexShader: 'attribute float alpha; varying float vA; varying float vS; void main(){ vA = alpha; vS = mod(float(gl_VertexID),2.0); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 uColor; varying float vA; varying float vS; void main(){ float e = smoothstep(0.0,0.6,vS); gl_FragColor = vec4(uColor * vA * e * 0.9, 1.0); }',
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 10;
  scene.add(mesh);
  const hist = [];
  let strength = 0;
  return {
    mesh,
    update(base, tip, active, dt) {
      strength = active ? Math.min(1, strength + dt * 20) : Math.max(0, strength - dt * 6);
      hist.unshift([base.clone(), tip.clone()]);
      if (hist.length > N) hist.pop();
      for (let i = 0; i < N; i++) {
        const h = hist[Math.min(i, hist.length - 1)];
        pos.set([h[0].x, h[0].y, h[0].z], i * 6); pos.set([h[1].x, h[1].y, h[1].z], i * 6 + 3);
        const a = strength * Math.pow(1 - i / (N - 1), 1.6);
        alpha[i * 2] = a * 0.15; alpha[i * 2 + 1] = a;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
      mesh.visible = strength > 0.01;
    },
  };
}
