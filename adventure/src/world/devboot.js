// Dev-only boot (terrain builder): same as main.js but tolerant of other systems failing mid-development.
// Engine entry. Every system is a module exporting `init(ctx)` which may return
// { update(dt, t) } and may attach services onto ctx (ctx.terrain, ctx.hero ...).
// Order matters: terrain first (others query heights), post-FX last.
import * as THREE from 'three';
import { createContext } from '../core/context.js';
import * as input from '../core/input.js';
import * as terrain from '../world/terrain.js';
import * as foliage from '../world/foliage.js';
import * as sky from '../env/sky.js';
import * as lighting from '../env/lighting.js';
import * as water from '../env/water.js';
import * as village from '../village/village.js';
import * as hero from '../hero/hero.js';
import * as physics from '../core/physics.js';
import * as camera from '../core/camera.js';
import * as enemies from '../combat/enemies.js';
import * as hud from '../ui/hud.js';
import * as audio from '../ui/audio.js';
import * as postfx from '../env/postfx.js';
import { applyShotMode } from '../core/shots.js';

const SYSTEMS = [input, lighting, sky, terrain, water, foliage, village, physics, hero, camera, enemies, hud, audio, postfx];

async function boot() {
  const ctx = createContext();
  const updaters = [];
  for (const sys of SYSTEMS) {
    let r=null; try { r = await sys.init(ctx); } catch (e) { console.warn("[devboot] init failed", e && e.message); }
    if (r && r.update) updaters.push(r);
  }
  applyShotMode(ctx);
  let last = performance.now();
  let t = 0;
  function frame() {
    const now = performance.now(); const dt = Math.min((now - last) / 1000, 1 / 20); last = now;
    // ctx.timeScale: hitstop / slow-mo (combat sets it briefly; ctx.realDt stays unscaled for UI/camera)
    const sdt = dt * (ctx.timeScale ?? 1);
    ctx.realDt = dt;
    t += sdt;
    ctx.time = t;
    for (const u of updaters) u.update(sdt, t);
    if (ctx.render) ctx.render(dt); else ctx.renderer.render(ctx.scene, ctx.camera);
    ctx.frames++;
    requestAnimationFrame(frame);
  }
  window.__ctx = ctx;
  window.__ready = true;
  requestAnimationFrame(frame);
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f88;position:fixed;top:0">${e.stack}</pre>`); window.__error = String(e.stack); });
