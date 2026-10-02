import * as THREE from 'three';

// Shared engine context. Services other systems attach (contract):
//  ctx.terrain   { heightAt(x,z), normalAt(x,z, out), size, mesh }       (world/terrain.js)
//  ctx.water     { level, isWater(x,z) }                                  (env/water.js)
//  ctx.sun       DirectionalLight; ctx.sunDir Vector3 (towards sun)       (env/lighting.js)
//  ctx.colliders [{ type:'cylinder'|'box', ... }] static collision list  (village, foliage add)
//  ctx.physics   { move(pos, vel, radius, dt) -> {grounded} }             (core/physics.js)
//  ctx.hero      { root: Object3D, position, state, health, maxHealth }   (hero/hero.js)
//  ctx.input     { move:Vector2, cameraDelta:Vector2, pressed(name), down(name) } (core/input.js)
//  ctx.cameraRig { yaw, pitch, distance, lockTarget }                     (core/camera.js)
//  ctx.enemies   [] live enemies with { position, hurt(dmg, dir), alive } (combat/enemies.js)
//  ctx.events    EventTarget: 'hit', 'enemy-killed', 'hero-hurt', 'swing', 'footstep', 'rupee'
//  ctx.render    optional override set by env/postfx.js (composer)
export function createContext() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 3000);
  camera.position.set(0, 10, 20);

  const ctx = {
    THREE, renderer, scene, camera,
    time: 0, frames: 0,
    colliders: [],
    enemies: [],
    events: new EventTarget(),
    emit(name, detail) { ctx.events.dispatchEvent(new CustomEvent(name, { detail })); },
    on(name, fn) { ctx.events.addEventListener(name, e => fn(e.detail)); },
    params: new URLSearchParams(location.search),
    resizeHandlers: [],
  };
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    for (const h of ctx.resizeHandlers) h(window.innerWidth, window.innerHeight);
  });
  return ctx;
}
