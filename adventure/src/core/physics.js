// Character controller + light rigid-ish helpers.
//
// ctx.physics = {
//   move(pos, vel, radius, dt, opts?) -> MoveResult
//       Integrates a vertical capsule whose FEET are at `pos` (Vector3, mutated).
//       `vel` (Vector3, mutated) is world velocity in m/s; the caller sets vel.x/z
//       from its own locomotion each frame and may set vel.y for a jump.
//       Gravity, ground snapping, step-up, slope limit, collider slide,
//       world bounds, wading and swimming are handled here.
//       opts: { height=1.7, stepHeight=0.45, gravity=22, snap=true }
//     MoveResult (reused object per pos — copy fields if you need to keep them):
//       { grounded, groundNormal:Vector3, groundHeight, inWater, waterDepth,
//         swimming, sliding, hitWall, wallNormal:Vector3, wadeFactor, landed, fallSpeed }
//   raycastGround(x, z, fromY=+inf) -> number   highest walkable surface y at (x,z)
//       (terrain or collider top) that is at/below fromY.
//   normalAt(x, z, out) -> Vector3   terrain normal
//   heightAt(x, z) -> number         terrain height only
//   knockback(obj, dir, force)       impulse + "ragdoll-lite" for enemies (see below)
//   segmentCast(a, b, pad) -> t      first collider hit fraction along a->b (Infinity if none)
//   waterLevel()                     current water level
// }
//
// Collider formats are documented in core/collide.js.
import * as THREE from 'three';
import * as layout from '../world/layout.js';
import { ColliderGrid, pushOut, footprintContains, segmentHit } from './collide.js';

const MAX_SLOPE_COS = Math.cos(THREE.MathUtils.degToRad(45));
const HALF = layout.WORLD_SIZE / 2 - 6;

export function init(ctx) {
  const heightAt = (x, z) => (ctx.terrain?.heightAt ? ctx.terrain.heightAt(x, z) : layout.heightAt(x, z));
  const normalAt = (x, z, out = new THREE.Vector3()) => {
    if (ctx.terrain?.normalAt) return ctx.terrain.normalAt(x, z, out);
    return layout.normalAt(x, z, out);
  };
  const waterLevel = () => (ctx.water?.level ?? layout.WATER_LEVEL);
  const grid = new ColliderGrid(heightAt);
  const sync = () => {
    const force = !!ctx.collidersDirty; ctx.collidersDirty = false;
    grid.ensure(ctx.colliders || (ctx.colliders = []), force);
  };

  // highest walkable surface at (x,z) not above fromY (+ small tolerance)
  function surfaceAt(x, z, fromY = Infinity, radius = 0, outInfo) {
    let y = heightAt(x, z), col = null;
    const list = grid.query(x - radius, z - radius, x + radius, z + radius);
    for (const c of list) {
      if (c.walkable === false) continue;
      const top = c.y + c.h;
      if (top <= y || top > fromY) continue;
      if (footprintContains(c, x, z, radius * 0.5)) { y = top; col = c; }
    }
    if (outInfo) outInfo.collider = col;
    return y;
  }

  const states = new WeakMap(); // per-pos persistent controller state
  function stateFor(pos) {
    let s = states.get(pos);
    if (!s) {
      s = { wasGrounded: false, slide: new THREE.Vector3(), res: {
        grounded: false, groundNormal: new THREE.Vector3(0, 1, 0), groundHeight: 0, inWater: false,
        waterDepth: 0, swimming: false, sliding: false, hitWall: false, wallNormal: new THREE.Vector3(),
        wadeFactor: 1, landed: false, fallSpeed: 0,
      } };
      states.set(pos, s);
    }
    return s;
  }
  const info = { collider: null };
  const tmpN = new THREE.Vector3();

  function move(pos, vel, radius = 0.4, dt = 1 / 60, opts = {}) {
    sync();
    const height = opts.height ?? 1.7, step = opts.stepHeight ?? 0.45;
    const g = opts.gravity ?? 22;
    const st = stateFor(pos), R = st.res;
    R.hitWall = false; R.landed = false; R.wallNormal.set(0, 0, 0);
    if (!isFinite(pos.x + pos.y + pos.z)) pos.set(0, heightAt(0, 0), 0);
    if (!isFinite(vel.x + vel.y + vel.z)) vel.set(0, 0, 0);
    dt = Math.min(dt, 0.1);

    // --- water state at current position
    const wl = waterLevel();
    const ground0 = heightAt(pos.x, pos.z);
    const wet = ctx.water?.isWater ? ctx.water.isWater(pos.x, pos.z) : ground0 < wl;
    const depth = wet ? Math.max(0, wl - ground0) : 0;
    const submerged = wet ? Math.max(0, wl - pos.y) : 0;
    R.inWater = submerged > 0.05; R.waterDepth = depth;
    const swimDepth = height * 0.72;
    R.swimming = wet && depth > swimDepth && submerged > height * 0.55;
    // wading slows walking: knee-deep ~25%, waist-deep ~50%
    R.wadeFactor = R.swimming ? 0.55 : 1 - 0.5 * Math.min(1, submerged / (height * 0.6));

    // --- horizontal motion (sub-stepped so thin colliders aren't tunneled)
    let dx = (vel.x * R.wadeFactor + st.slide.x) * dt, dz = (vel.z * R.wadeFactor + st.slide.z) * dt;
    const dist = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(dist / (radius * 0.5)));
    const sx = dx / n, sz = dz / n;
    let footY = pos.y;
    for (let i = 0; i < n; i++) {
      let nx = pos.x + sx, nz = pos.z + sz;
      // step-up / ledge: terrain or collider top that's too high to step onto acts as wall
      if (st.wasGrounded || R.swimming) {
        const terr = heightAt(nx, nz);
        if (terr > footY + step && !R.swimming) {
          // terrain cliff higher than a step: block uphill component
          normalAt(nx, nz, tmpN); tmpN.y = 0;
          if (tmpN.lengthSq() > 1e-6) {
            tmpN.normalize();
            const into = sx * tmpN.x + sz * tmpN.z;
            if (into < 0) { nx = pos.x + sx - tmpN.x * into; nz = pos.z + sz - tmpN.z * into; }
          } else { nx = pos.x; nz = pos.z; }
          R.hitWall = true; R.wallNormal.copy(tmpN);
        }
      }
      // collide against colliders the body overlaps vertically
      const list = grid.query(nx - radius - 0.1, nz - radius - 0.1, nx + radius + 0.1, nz + radius + 0.1);
      for (let iter = 0; iter < 3; iter++) {
        let any = false;
        for (const c of list) {
          const top = c.y + c.h;
          if (footY + step >= top && c.walkable !== false) continue; // we're on/above it, or can step onto it
          if (footY + height <= c.y) continue; // passing under (e.g. overhang)
          const p = pushOut(c, nx, nz, radius);
          if (p) { nx = p.x; nz = p.z; any = true; R.hitWall = true; R.wallNormal.set(p.nx, 0, p.nz); }
        }
        if (!any) break;
      }
      // world bounds (square map, soft margin)
      if (nx > HALF) { nx = HALF; R.hitWall = true; } else if (nx < -HALF) { nx = -HALF; R.hitWall = true; }
      if (nz > HALF) { nz = HALF; R.hitWall = true; } else if (nz < -HALF) { nz = -HALF; R.hitWall = true; }
      pos.x = nx; pos.z = nz;
      if (st.wasGrounded) footY = surfaceAt(nx, nz, footY + step); // follow ground so step checks stay relative
    }
    if (st.wasGrounded && footY > pos.y) pos.y = footY; // step up

    // --- vertical
    const surf = surfaceAt(pos.x, pos.z, pos.y + step, radius * 0.6, info);
    if (R.swimming) {
      // buoyancy: float so the head + shoulders stay above the surface
      const target = wl - height * 0.62;
      vel.y += ((target - pos.y) * 18 - vel.y * 6) * dt;
      if (vel.y > 3) vel.y = 3;
    } else {
      const buoy = R.inWater ? Math.min(1, submerged / height) * 0.6 : 0;
      vel.y -= g * (1 - buoy) * dt;
      if (R.inWater) vel.y *= Math.exp(-2.5 * dt); // water drag on falls/jumps
      if (vel.y < -55) vel.y = -55;
    }
    pos.y += vel.y * dt;

    let grounded = false;
    const fall = -vel.y;
    if (pos.y <= surf) {
      pos.y = surf; if (vel.y < 0) vel.y = 0; grounded = true;
    } else if (st.wasGrounded && vel.y <= 0.01 && !R.swimming) {
      // ground snapping: stick to downhill slopes / stairs instead of skipping off them
      const snapDist = 0.25 + Math.hypot(vel.x, vel.z) * dt * 1.2 + 0.3;
      if (opts.snap !== false && pos.y - surf <= snapDist) { pos.y = surf; vel.y = 0; grounded = true; }
    }
    if (R.swimming) grounded = false;

    // ground normal + slope limit
    if (info.collider && Math.abs(surf - (info.collider.y + info.collider.h)) < 1e-4) R.groundNormal.set(0, 1, 0);
    else normalAt(pos.x, pos.z, R.groundNormal);
    R.groundHeight = surf;
    R.sliding = false;
    if (grounded && R.groundNormal.y < MAX_SLOPE_COS) {
      // too steep: slide downhill, accelerating; not "grounded" for jumping purposes
      R.sliding = true; grounded = false;
      const k = 14 * (1 - R.groundNormal.y);
      st.slide.x += R.groundNormal.x * k * 9 * dt; st.slide.z += R.groundNormal.z * k * 9 * dt;
      // cancel walking up the slope
      const nh = Math.hypot(R.groundNormal.x, R.groundNormal.z) || 1;
      const ux = R.groundNormal.x / nh, uz = R.groundNormal.z / nh;
      const into = vel.x * ux + vel.z * uz;
      if (into < 0) { vel.x -= ux * into; vel.z -= uz * into; }
    } else {
      st.slide.multiplyScalar(Math.exp(-(grounded ? 10 : 1.5) * dt));
    }
    R.landed = grounded && !st.wasGrounded;
    R.fallSpeed = R.landed ? Math.max(0, fall) : 0;
    st.wasGrounded = grounded || R.sliding;
    R.grounded = grounded;
    // keep feet out of bedrock no matter what
    const terr = heightAt(pos.x, pos.z);
    if (pos.y < terr) pos.y = terr;
    return R;
  }

  function raycastGround(x, z, fromY = Infinity) { sync(); return surfaceAt(x, z, fromY); }

  function segmentCast(a, b, pad = 0) {
    sync();
    const list = grid.query(Math.min(a.x, b.x) - pad, Math.min(a.z, b.z) - pad, Math.max(a.x, b.x) + pad, Math.max(a.z, b.z) + pad);
    let best = Infinity;
    for (const c of list) {
      if (c.camera === false) continue;
      const t = segmentHit(c, a.x, a.y, a.z, b.x, b.y, b.z, pad);
      if (t > 1e-4 && t < best) best = t; // t==0: start is inside -> ignore
    }
    return best;
  }

  // --- knockback / ragdoll-lite --------------------------------------------
  // knockback(obj, dir, force):
  //   obj: { position:Vector3, velocity?:Vector3, root?|mesh?|object?:Object3D, alive?, radius? }
  //   dir: Vector3 (or {x,z}) direction of the hit (from attacker to obj). force: m/s impulse.
  // If obj.velocity exists the impulse is ADDED to it and the owner keeps integrating
  // (call physics.move with it). Otherwise physics integrates obj.position itself until
  // it settles. Either way the visual (root/mesh) gets a spring tilt away from the hit;
  // when obj.alive === false it topples over instead and stays down.
  const bodies = new Set();
  const up = new THREE.Vector3(0, 1, 0);
  function knockback(obj, dir, force = 6) {
    if (!obj || !obj.position) return;
    const d = new THREE.Vector3(dir?.x || 0, 0, dir?.z || 0);
    if (d.lengthSq() < 1e-6) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    d.normalize();
    let kb = obj.__kb;
    if (!kb) {
      kb = obj.__kb = { vel: new THREE.Vector3(), tilt: 0, tiltVel: 0, axis: new THREE.Vector3(1, 0, 0), q0: null, topple: 0 };
    }
    const lift = Math.min(force * 0.35, 4);
    if (obj.velocity && obj.velocity.isVector3) {
      obj.velocity.x += d.x * force; obj.velocity.z += d.z * force; obj.velocity.y = Math.max(obj.velocity.y, lift);
      kb.external = true;
    } else {
      kb.vel.x += d.x * force; kb.vel.z += d.z * force; kb.vel.y = Math.max(kb.vel.y, lift);
      kb.external = false;
    }
    kb.axis.crossVectors(up, d).normalize(); // tilt so the top leans along the hit
    kb.tiltVel += force * 0.9;
    bodies.add(obj);
  }
  const qTmp = new THREE.Quaternion();
  function updateBodies(dt) {
    for (const obj of bodies) {
      const kb = obj.__kb;
      const vis = obj.root || obj.mesh || obj.object || (obj.isObject3D ? obj : null);
      if (!kb.external) {
        const r = move(obj.position, kb.vel, obj.radius || 0.5, dt);
        const fr = r.grounded ? 7 : 0.6;
        kb.vel.x *= Math.exp(-fr * dt); kb.vel.z *= Math.exp(-fr * dt);
        if (vis && vis !== obj && vis.position && vis.position !== obj.position) vis.position.copy(obj.position);
      }
      // spring tilt (or topple when dead)
      const dead = obj.alive === false;
      const target = dead ? 1.45 : 0;
      const kS = dead ? 30 : 90, kD = dead ? 7 : 11;
      kb.tiltVel += ((target - kb.tilt) * kS - kb.tiltVel * kD) * dt;
      kb.tilt += kb.tiltVel * dt;
      if (dead && kb.tilt > 1.5) { kb.tilt = 1.5; kb.tiltVel *= -0.25; }
      if (vis && vis.quaternion) {
        if (!kb.q0 || kb.restDirty) kb.q0 = vis.quaternion.clone();
        // apply tilt on top of the owner's current orientation (owner may rewrite rotation each frame)
        const base = kb.prevApplied && vis.quaternion.equals(kb.prevApplied) ? kb.q0 : (kb.q0 = vis.quaternion.clone());
        qTmp.setFromAxisAngle(kb.axis, kb.tilt);
        vis.quaternion.copy(base).premultiply(qTmp);
        kb.prevApplied = (kb.prevApplied || new THREE.Quaternion()).copy(vis.quaternion);
      }
      const settled = Math.abs(kb.tiltVel) < 0.02 && Math.abs(kb.tilt - target) < 0.01 && (kb.external || kb.vel.lengthSq() < 0.01);
      if (settled && !dead) {
        if (vis && kb.q0) vis.quaternion.copy(kb.q0);
        kb.prevApplied = null; kb.q0 = null;
        bodies.delete(obj);
      }
      if (dead && settled) bodies.delete(obj); // stays toppled
    }
  }

  ctx.physics = {
    move, raycastGround, segmentCast, knockback,
    heightAt, normalAt, waterLevel,
    surfaceAt: (x, z, fromY) => { sync(); return surfaceAt(x, z, fromY); },
    gravity: 22,
  };
  return { update(dt) { if (bodies.size) updateBodies(dt); } };
}
