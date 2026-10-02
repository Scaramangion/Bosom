// "Bosom shards": glowing faceted gems dropped by slain enemies. They pop out,
// bounce on the terrain, hover and spin, and are collected by hero proximity.
import * as THREE from 'three';
import { makeHalo } from './wolf.js';

const KINDS = [
  { value: 1, color: 0x3fe0a0, glow: [0.2, 1.0, 0.6] },   // verdant
  { value: 5, color: 0x58a8ff, glow: [0.3, 0.6, 1.0] },   // azure
  { value: 20, color: 0xff5a8a, glow: [1.0, 0.3, 0.55] }, // rose
];

export class Shards {
  constructor(mgr) {
    this.mgr = mgr; this.list = [];
    const g = new THREE.OctahedronGeometry(0.11, 0);
    g.scale(0.75, 1.7, 0.75);
    // bevel-ish: split into flat facets
    this.geo = g.toNonIndexed(); this.geo.computeVertexNormals();
    this.mats = KINDS.map(k => new THREE.MeshPhysicalMaterial({
      color: k.color, emissive: k.color, emissiveIntensity: 0.9, roughness: 0.08, metalness: 0.1,
      clearcoat: 1, clearcoatRoughness: 0.05, flatShading: true, iridescence: 0.6, iridescenceIOR: 1.6,
    }));
  }
  drop(at, n) {
    for (let i = 0; i < n; i++) {
      const r = Math.random(); const ki = r < 0.72 ? 0 : r < 0.95 ? 1 : 2;
      const m = new THREE.Mesh(this.geo, this.mats[ki]); m.castShadow = true;
      const halo = makeHalo(new THREE.Color(...KINDS[ki].glow)); halo.scale.setScalar(0.6); halo.material.opacity = 0.45; m.add(halo);
      m.position.copy(at).add(new THREE.Vector3(0, 0.7, 0));
      this.mgr.ctx.scene.add(m);
      const a = Math.random() * Math.PI * 2, sp = 1.5 + Math.random() * 2.2;
      this.list.push({ m, kind: ki, vel: new THREE.Vector3(Math.cos(a) * sp, 4.5 + Math.random() * 2.5, Math.sin(a) * sp), t: 0, settled: false, spin: Math.random() * 6, collecting: 0 });
    }
  }
  update(dt) {
    const M = this.mgr, hero = M.heroPos();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i]; s.t += dt;
      const p = s.m.position;
      if (s.collecting > 0) {
        s.collecting += dt;
        const tgt = hero ? hero.clone().add(new THREE.Vector3(0, 1.0, 0)) : p;
        p.lerp(tgt, Math.min(1, dt * 14)); s.m.scale.setScalar(Math.max(0.1, 1 - s.collecting * 2.5));
        if (s.collecting > 0.22 || p.distanceTo(tgt) < 0.2) {
          M.vfx.sparkle(p.clone(), new THREE.Color(...KINDS[s.kind].glow).multiplyScalar(3));
          M.emit('rupee', { value: KINDS[s.kind].value, position: p.clone() });
          this.remove(i);
        }
        continue;
      }
      const gy = M.heightAt(p.x, p.z) + 0.32;
      if (!s.settled) {
        s.vel.y -= 16 * dt; p.addScaledVector(s.vel, dt);
        if (p.y < gy) { p.y = gy; if (Math.abs(s.vel.y) < 1.2) { s.settled = true; s.base = gy; } s.vel.y *= -0.45; s.vel.x *= 0.55; s.vel.z *= 0.55; }
      } else {
        p.y = gy + 0.08 + Math.sin(s.t * 2.6 + s.spin) * 0.06;
      }
      s.m.rotation.y += dt * 2.2;
      // collect
      if (hero && s.t > 0.45 && Math.hypot(hero.x - p.x, hero.z - p.z) < 1.6 && Math.abs(hero.y + 0.8 - p.y) < 2) s.collecting = 1e-4;
      // expiry blink
      if (s.t > 40) s.m.visible = Math.sin(s.t * 20) > 0;
      if (s.t > 46) this.remove(i);
    }
  }
  remove(i) { const s = this.list[i]; s.m.parent?.remove(s.m); s.m.children[0]?.material.dispose(); this.list.splice(i, 1); }
}
