// Combat VFX: pooled GPU point particles (additive sparks/glints/rings and
// alpha-blended dust/motes) + billboard enemy health bars.
import * as THREE from 'three';

const VS = /* glsl */`
attribute float size; attribute vec4 col; attribute float shape; attribute float spin;
uniform float uScale;
varying vec4 vCol; varying float vShape; varying float vSpin;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(size * uScale / max(0.1, -mv.z), 1.0, 256.0);
  gl_Position = projectionMatrix * mv;
  vCol = col; vShape = shape; vSpin = spin;
}`;
const FS = /* glsl */`
varying vec4 vCol; varying float vShape; varying float vSpin;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float cs = cos(vSpin), sn = sin(vSpin); c = mat2(cs, -sn, sn, cs) * c;
  float d = length(c);
  float a;
  if (vShape < 0.5) a = smoothstep(0.5, 0.0, d);                                  // soft disc
  else if (vShape < 1.5) a = smoothstep(0.06, 0.0, abs(d - 0.40)) * smoothstep(0.5, 0.42, d); // ring
  else if (vShape < 2.5) {                                                           // 4-point glint
    float s = max(smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)), smoothstep(0.08, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)));
    a = max(s, smoothstep(0.18, 0.0, d));
  } else {                                                                           // puffy dust (noisy edge)
    float n = sin(atan(c.y, c.x) * 5.0 + vSpin * 3.0) * 0.04;
    a = smoothstep(0.5 + n, 0.15, d) * 0.85;
  }
  if (a < 0.003) discard;
  gl_FragColor = vec4(vCol.rgb, vCol.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class Pool {
  constructor(scene, max, blending) {
    this.max = max; this.n = 0; this.p = [];
    const g = new THREE.BufferGeometry();
    this.aPos = new Float32Array(max * 3); this.aCol = new Float32Array(max * 4); this.aSize = new Float32Array(max); this.aShape = new Float32Array(max); this.aSpin = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.aPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('col', new THREE.BufferAttribute(this.aCol, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.aSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('shape', new THREE.BufferAttribute(this.aShape, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('spin', new THREE.BufferAttribute(this.aSpin, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.uniforms = { uScale: { value: 500 } };
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uniforms, transparent: true, depthWrite: false, blending });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false;
    this.points.renderOrder = blending === THREE.AdditiveBlending ? 20 : 19;
    scene.add(this.points); this.geo = g;
  }
  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({
      pos: o.pos.clone(), vel: o.vel ? o.vel.clone() : new THREE.Vector3(), life: 0, max: o.life || 1,
      s0: o.size ?? 0.2, s1: o.size1 ?? o.size ?? 0.2, c: o.color || new THREE.Color(1, 1, 1), a0: o.alpha ?? 1,
      g: o.gravity ?? 0, drag: o.drag ?? 0, shape: o.shape ?? 0, spin: o.spin ?? Math.random() * 6.28, spinV: o.spinV ?? 0,
      fadeIn: o.fadeIn ?? 0, ground: o.ground,
    });
  }
  update(dt, camera, renderer) {
    const h = renderer.domElement.height || 900;
    this.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    let k = 0;
    for (let i = 0; i < this.p.length; i++) {
      const q = this.p[i]; q.life += dt;
      if (q.life >= q.max) continue;
      q.vel.y -= q.g * dt; q.vel.multiplyScalar(Math.max(0, 1 - q.drag * dt));
      q.pos.addScaledVector(q.vel, dt); q.spin += q.spinV * dt;
      if (q.ground && q.pos.y < q.ground(q.pos.x, q.pos.z) + 0.02) { q.pos.y = q.ground(q.pos.x, q.pos.z) + 0.02; q.vel.y *= -0.3; q.vel.x *= 0.6; q.vel.z *= 0.6; }
      const t = q.life / q.max;
      let a = q.a0 * (1 - t) * (1 - t * 0.3);
      if (q.fadeIn) a *= Math.min(1, q.life / q.fadeIn);
      this.p[k++] = q;
      const o = k - 1;
      this.aPos[o * 3] = q.pos.x; this.aPos[o * 3 + 1] = q.pos.y; this.aPos[o * 3 + 2] = q.pos.z;
      this.aCol[o * 4] = q.c.r; this.aCol[o * 4 + 1] = q.c.g; this.aCol[o * 4 + 2] = q.c.b; this.aCol[o * 4 + 3] = a;
      this.aSize[o] = q.s0 + (q.s1 - q.s0) * Math.sqrt(t); this.aShape[o] = q.shape; this.aSpin[o] = q.spin;
    }
    this.p.length = k;
    this.geo.setDrawRange(0, k);
    for (const n of ['position', 'col', 'size', 'shape', 'spin']) { const a = this.geo.attributes[n]; a.needsUpdate = true; }
  }
}

const C = (r, g, b) => new THREE.Color(r, g, b);
const rv = (s = 1) => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * s);

export class VFX {
  constructor(ctx, groundFn) {
    this.ctx = ctx; this.ground = groundFn;
    this.add = new Pool(ctx.scene, 1400, THREE.AdditiveBlending);
    this.alpha = new Pool(ctx.scene, 900, THREE.NormalBlending);
  }
  update(dt) { this.add.update(dt, this.ctx.camera, this.ctx.renderer); this.alpha.update(dt, this.ctx.camera, this.ctx.renderer); }

  // Sword impact: hot white-gold core flash, expanding ring, glints and gravity sparks.
  impact(p, dir, strong = false) {
    const A = this.add;
    A.spawn({ pos: p, life: 0.14, size: 0.5, size1: strong ? 1.6 : 1.1, color: C(4, 3.2, 2.2), alpha: 1 });
    A.spawn({ pos: p, life: 0.28, size: 0.3, size1: strong ? 2.6 : 1.8, color: C(2.2, 1.5, 0.8), alpha: 0.9, shape: 1 });
    A.spawn({ pos: p, life: 0.22, size: 0.9, size1: 1.4, color: C(3, 2.6, 2), alpha: 1, shape: 2, spin: Math.random() });
    const n = strong ? 34 : 22;
    for (let i = 0; i < n; i++) {
      const v = rv(1).normalize().multiplyScalar(4 + Math.random() * 7);
      if (dir) v.addScaledVector(dir, 3);
      v.y += 2.5;
      A.spawn({ pos: p, vel: v, life: 0.25 + Math.random() * 0.35, size: 0.06 + Math.random() * 0.05, size1: 0.02, color: C(3.5, 2.0 + Math.random(), 0.7), gravity: 14, drag: 2.5, ground: this.ground });
    }
    for (let i = 0; i < 5; i++) this.alpha.spawn({ pos: p.clone().add(rv(0.15)), vel: rv(0.8), life: 0.6 + Math.random() * 0.3, size: 0.35, size1: 1.0, color: C(0.9, 0.86, 0.8), alpha: 0.35, drag: 3, shape: 3, spinV: 1 });
  }
  // Ground dust puff ring (footfalls, landings, brute club slams)
  dust(p, scale = 1, n = 10, color = C(0.55, 0.47, 0.36)) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + Math.random() * 0.5;
      const v = new THREE.Vector3(Math.cos(a), 0.25 + Math.random() * 0.4, Math.sin(a)).multiplyScalar((1.2 + Math.random() * 1.5) * scale);
      this.alpha.spawn({ pos: p.clone().add(new THREE.Vector3(Math.cos(a) * 0.2 * scale, 0.1, Math.sin(a) * 0.2 * scale)), vel: v, life: 0.8 + Math.random() * 0.8, size: 0.4 * scale, size1: 1.5 * scale, color, alpha: 0.5, drag: 2.5, shape: 3, spinV: (Math.random() - 0.5) * 2, gravity: -0.3 });
    }
  }
  // Shockwave for heavy slams
  slam(p) {
    this.add.spawn({ pos: p.clone().setY(p.y + 0.15), life: 0.35, size: 0.6, size1: 6, color: C(2.0, 1.2, 0.5), alpha: 0.8, shape: 1 });
    this.dust(p, 1.8, 22);
    for (let i = 0; i < 16; i++) {
      const v = rv(1); v.y = Math.abs(v.y) * 2 + 2.5; v.multiplyScalar(2.2);
      this.alpha.spawn({ pos: p.clone().add(rv(0.4)).setY(p.y + 0.1), vel: v, life: 0.9, size: 0.07, size1: 0.05, color: C(0.22, 0.17, 0.12), alpha: 1, gravity: 14, ground: this.ground });
    }
  }
  // Telegraph glint (eye flare)
  glint(p, color = C(4, 1.4, 0.4)) {
    this.add.spawn({ pos: p, life: 0.45, size: 0.25, size1: 0.9, color, alpha: 1, shape: 2, spinV: 3 });
  }
  // Death: dark motes rising + violet embers + soft burst
  deathBurst(center, radius = 0.6) {
    this.add.spawn({ pos: center, life: 0.35, size: 0.5, size1: 3.2 * radius, color: C(1.2, 0.4, 1.6), alpha: 0.8, shape: 1 });
    this.add.spawn({ pos: center, life: 0.25, size: 1.0, size1: 2.2, color: C(1.6, 0.7, 2.0), alpha: 0.9 });
    this.motes(center, radius, 40);
  }
  motes(center, radius = 0.6, n = 6) {
    for (let i = 0; i < n; i++) {
      const p = center.clone().add(rv(radius));
      const v = rv(0.6); v.y = 0.8 + Math.random() * 1.4;
      this.alpha.spawn({ pos: p, vel: v, life: 1.4 + Math.random() * 1.4, size: 0.07 + Math.random() * 0.1, size1: 0.02, color: C(0.03, 0.02, 0.05), alpha: 0.95, drag: 0.6, gravity: -0.4, fadeIn: 0.15 });
      if (Math.random() < 0.5) this.add.spawn({ pos: p, vel: v.clone().multiplyScalar(1.1), life: 1.0 + Math.random(), size: 0.05 + Math.random() * 0.05, size1: 0.0, color: C(1.4, 0.45, 2.2), alpha: 1, drag: 0.6, gravity: -0.5, shape: Math.random() < 0.3 ? 2 : 0 });
    }
  }
  sparkle(p, color) {
    for (let i = 0; i < 10; i++) this.add.spawn({ pos: p.clone().add(rv(0.2)), vel: rv(1.5).setY(1 + Math.random() * 2), life: 0.5 + Math.random() * 0.3, size: 0.12, size1: 0.0, color, alpha: 1, drag: 2, shape: 2 });
    this.add.spawn({ pos: p, life: 0.3, size: 0.2, size1: 1.2, color, alpha: 0.9, shape: 1 });
  }
}

// ---- health bars ---------------------------------------------------------
const BAR_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const BAR_FS = `
uniform float uHp; uniform float uLag; uniform float uAlpha; uniform vec3 uCol; varying vec2 vUv;
void main(){
  vec2 p = vUv; vec2 px = vec2(p.x * 12.0, p.y);
  // rounded outer frame
  vec2 q = abs(vec2(p.x - 0.5, p.y - 0.5) * vec2(12.0, 1.0)) - vec2(5.6, 0.1);
  float outer = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.38;
  if (outer > 0.0) discard;
  vec3 c = vec3(0.04, 0.03, 0.05);
  float inner = outer + 0.12;
  if (inner < 0.0) {
    float x = (p.x - 0.04) / 0.92;
    vec3 fill = uCol * (0.75 + 0.5 * smoothstep(0.2, 0.9, p.y));
    if (x < uHp) c = fill; else if (x < uLag) c = vec3(1.0, 0.9, 0.7); else c = vec3(0.12, 0.1, 0.12);
    // segment notches
    c *= 0.85 + 0.15 * step(0.08, fract(x * 8.0));
  } else c = mix(vec3(0.85, 0.75, 0.5), c, 0.35);
  gl_FragColor = vec4(c, uAlpha);
  #include <colorspace_fragment>
}`;
export function makeHealthBar(color = 0xd84a2a) {
  const m = new THREE.ShaderMaterial({
    vertexShader: BAR_VS, fragmentShader: BAR_FS, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uHp: { value: 1 }, uLag: { value: 1 }, uAlpha: { value: 0 }, uCol: { value: new THREE.Color(color) } },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.075), m);
  mesh.renderOrder = 999; mesh.frustumCulled = false; mesh.visible = false;
  return mesh;
}
