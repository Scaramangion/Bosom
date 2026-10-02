// Hero close-up harness: /src/hero/debug/index.html?pose=walk&t=0.3&cam=front&dist=3&h=1.2
import * as THREE from 'three';
import { createContext } from '../../core/context.js';
import * as hero from '../hero.js';
import * as layout from '../../world/layout.js';

const ctx = createContext();
const P = ctx.params;
ctx.scene.background = new THREE.Color(0x8fb4d8);
ctx.scene.fog = new THREE.Fog(0x9fbfdc, 30, 160);
const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
const sunDir = new THREE.Vector3(...(P.get('sun') || '0.5,0.75,0.45').split(',').map(Number)).normalize();
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
ctx.scene.add(sun, sun.target);
ctx.scene.add(new THREE.HemisphereLight(0xbcd6ff, 0x6a5a3a, 1.1));
ctx.sun = sun;
const g = new THREE.Mesh(new THREE.PlaneGeometry(200, 200, 200, 200), new THREE.MeshStandardMaterial({ color: 0x5f7a3a, roughness: 0.95 }));
g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
const ga = g.geometry.attributes.position;
for (let i = 0; i < ga.count; i++) { const x = ga.getX(i), z = -ga.getY(i); ga.setZ(i, layout.heightAt(x, z)); }
g.geometry.computeVertexNormals();
ctx.scene.add(g);

async function main() {
  const r = await hero.init(ctx);
  const H = ctx.hero;
  const pose = P.get('pose');
  if (P.get('drawn')) H.__setSword?.(true);
  if (pose) H._force = { name: pose, t: P.get('t') !== null ? +P.get('t') : undefined, upper: P.get('upper') || undefined, speed: P.get('speed') !== null ? +P.get('speed') : undefined };
  const yaw = +(P.get('yaw') || 0);
  H.root.rotation.y = yaw;
  const camMode = P.get('cam') || 'front';
  const dist = +(P.get('dist') || 3.2), ch = +(P.get('h') || 1.0), look = +(P.get('look') || ch);
  const camAng = { front: 0, back: Math.PI, left: Math.PI / 2, right: -Math.PI / 2, q: 0.6, q2: -0.7, bq: Math.PI - 0.6 }[camMode] ?? +camMode;
  let t = 0;
  function frame() {
    const dt = 1 / 60; t += dt; ctx.time = t;
    r.update(dt, t);
    const hp = H.position;
    const a = camAng + (+(P.get('yaw') || 0));
    ctx.camera.position.set(hp.x + Math.sin(a) * dist, hp.y + ch, hp.z + Math.cos(a) * dist);
    ctx.camera.lookAt(hp.x, hp.y + look, hp.z);
    sun.position.copy(hp).addScaledVector(sunDir, 20); sun.target.position.copy(hp);
    ctx.renderer.render(ctx.scene, ctx.camera);
    ctx.frames++;
    requestAnimationFrame(frame);
  }
  // pre-roll
  for (let i = 0; i < +(P.get('pre') || 30); i++) { t += 1 / 60; ctx.time = t; r.update(1 / 60, t); }
  window.__ctx = ctx; window.__ready = true;
  frame();
}
main().catch(e => { console.error(e); window.__error = String(e.stack); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0">${e.stack}</pre>`); });
