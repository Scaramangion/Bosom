// Third-person follow camera with Z-targeting.
//
// ctx.cameraRig = {
//   yaw, pitch, distance        orbit state (radians / metres). Camera sits at
//                               pivot + (sin(yaw)cos(pitch), sin(pitch), cos(yaw)cos(pitch)) * distance,
//                               so yaw = 0 places the camera on +Z looking toward -Z.
//   lockTarget                  enemy currently Z-targeted (or null). Toggle with input 'lock';
//                               hero code may also set ctx.hero.lockTarget, which wins.
//   shake(intensity 0..1)       add trauma (decays smoothly)
//   forward(out) / right(out)   camera-relative flat basis vectors (Vector3, y = 0)
//   moveToWorld(v2, out)        convert ctx.input.move (x right, y forward) to a world XZ dir
//   fovBase, active
// }
// Shot mode: ctx.shot.cam {pos, look} -> exact static camera; ctx.shot.cam === null ->
// framed over-the-shoulder 3/4 view of the hero at shot.hero, facing shot.yaw
// (facing convention: (sin yaw, 0, cos yaw), same as Object3D.rotation.y on a +Z-facing model).
import * as THREE from 'three';
import * as layout from '../world/layout.js';

const PIVOT_H = 1.45;           // orbit pivot height above the hero's feet
const DIST_DEFAULT = 4.8, DIST_MIN = 2.2, DIST_MAX = 11;
const PITCH_MIN = -0.42, PITCH_MAX = 1.2, PITCH_DEFAULT = 0.12;
const RECENTER_DELAY = 1.5;
const LOCK_RANGE = 20, LOCK_BREAK = 26;
const CAM_RADIUS = 0.3;
const TAU = Math.PI * 2;
const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const damp = (a, b, lambda, dt) => a + (b - a) * (1 - Math.exp(-lambda * dt));

export function init(ctx) {
  const cam = ctx.camera;
  const heightAt = (x, z) => (ctx.terrain?.heightAt ? ctx.terrain.heightAt(x, z) : layout.heightAt(x, z));
  const waterLevel = () => ctx.water?.level ?? layout.WATER_LEVEL;
  const fovBase = cam.fov || 55;

  const pivot = new THREE.Vector3(), lookAhead = new THREE.Vector3();
  const heroPrev = new THREE.Vector3(), heroVel = new THREE.Vector3();
  const lookPoint = new THREE.Vector3(), desired = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const lockLook = new THREE.Vector3();
  let first = true, manualTimer = 99, collDist = DIST_DEFAULT, wantDist = DIST_DEFAULT;
  let trauma = 0, lockBlend = 0, fov = fovBase, lookYOffset = 0;

  const rig = {
    yaw: 0.5, pitch: PITCH_DEFAULT, distance: DIST_DEFAULT, lockTarget: null, fovBase, active: true,
    shake(intensity = 0.4) { trauma = Math.min(1, trauma + intensity); },
    forward(out = new THREE.Vector3()) { return out.set(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw)); },
    right(out = new THREE.Vector3()) { return out.set(Math.cos(rig.yaw), 0, -Math.sin(rig.yaw)); },
    moveToWorld(v, out = new THREE.Vector3()) {
      const s = Math.sin(rig.yaw), c = Math.cos(rig.yaw);
      return out.set(v.x * c - v.y * s, 0, -v.x * s - v.y * c);
    },
  };
  ctx.cameraRig = rig;
  // world events may request shake: ctx.emit('shake', { amount, position? }) — attenuated by distance
  ctx.on?.('shake', d => {
    let a = d?.amount ?? 0.3;
    if (d?.position) a *= THREE.MathUtils.clamp(1.4 - cam.position.distanceTo(d.position) / 25, 0, 1);
    if (a > 0.01) rig.shake(a);
  });

  // ---------- letterbox + lock reticle (DOM) ----------
  const ui = document.getElementById('ui') || document.body;
  const style = document.createElement('style');
  style.textContent = `
.cam-lb{position:fixed;left:0;right:0;height:10vh;background:#000;pointer-events:none;z-index:5;transition:transform .45s cubic-bezier(.3,.7,.2,1);will-change:transform}
.cam-lb.t{top:0;transform:translateY(-101%)} .cam-lb.b{bottom:0;transform:translateY(101%)}
.cam-lb.on{transform:translateY(0)}
.cam-ret{position:fixed;left:0;top:0;width:46px;height:46px;margin:-23px 0 0 -23px;pointer-events:none;z-index:6;opacity:0;transition:opacity .25s}
.cam-ret.on{opacity:1}
.cam-ret i{position:absolute;left:50%;top:50%;width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:12px solid #ffd77a;
  filter:drop-shadow(0 0 4px rgba(255,190,70,.9)) drop-shadow(0 1px 1px rgba(0,0,0,.6))}
`;
  document.head.appendChild(style);
  const lbTop = document.createElement('div'); lbTop.className = 'cam-lb t';
  const lbBot = document.createElement('div'); lbBot.className = 'cam-lb b';
  const ret = document.createElement('div'); ret.className = 'cam-ret';
  ret.innerHTML = '<i></i><i></i><i></i>';
  const arrows = [...ret.children];
  ui.append(lbTop, lbBot, ret);

  // ---------- collision ----------
  // returns the max safe distance from `from` along unit dir `dir` up to `maxD`
  const segA = new THREE.Vector3(), segB = new THREE.Vector3();
  function clearDistance(from, dir, maxD) {
    let best = maxD;
    // terrain: march, refine with bisection
    const steps = 14;
    let prevT = 0;
    for (let i = 1; i <= steps; i++) {
      const t = (i / steps) * maxD;
      const x = from.x + dir.x * t, y = from.y + dir.y * t, z = from.z + dir.z * t;
      if (y < heightAt(x, z) + 0.25) {
        let lo = prevT, hi = t;
        for (let k = 0; k < 5; k++) {
          const m = (lo + hi) / 2;
          const mx = from.x + dir.x * m, my = from.y + dir.y * m, mz = from.z + dir.z * m;
          if (my < heightAt(mx, mz) + 0.25) hi = m; else lo = m;
        }
        best = Math.min(best, lo);
        break;
      }
      prevT = t;
    }
    // static colliders
    if (ctx.physics?.segmentCast) {
      segA.copy(from); segB.copy(from).addScaledVector(dir, maxD);
      const t = ctx.physics.segmentCast(segA, segB, CAM_RADIUS);
      if (t < 1) best = Math.min(best, t * maxD - 0.05);
    }
    return Math.max(0.6, best);
  }

  // ---------- helpers ----------
  const heroPos = (out) => {
    const h = ctx.hero;
    if (h?.position) return out.copy(h.position);
    if (h?.root?.position) return out.copy(h.root.position);
    if (ctx.shot?.hero) { const [x, , z] = ctx.shot.hero; return out.set(x, heightAt(x, z), z); }
    return out.set(0, heightAt(0, 0), 0);
  };
  const enemyPos = (e, out) => out.copy(e.position || e.root?.position || e);
  const isAlive = e => e && e.alive !== false && !e.dead && (e.health === undefined || e.health > 0);
  function findLockTarget(hp) {
    let best = null, bestScore = Infinity;
    const fwd = rig.forward(tmp2);
    for (const e of ctx.enemies || []) {
      if (!isAlive(e)) continue;
      enemyPos(e, tmp);
      const dx = tmp.x - hp.x, dz = tmp.z - hp.z, d = Math.hypot(dx, dz);
      if (d > LOCK_RANGE) continue;
      // prefer enemies in front of the camera, then nearest
      const facing = d > 1e-3 ? (dx * fwd.x + dz * fwd.z) / d : 1;
      const score = d * (1.6 - facing * 0.6);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  const hp = new THREE.Vector3();
  const shakeOff = new THREE.Vector3();

  function update(dt, t) {
    const input = ctx.input;
    const shot = ctx.shot;
    heroPos(hp);

    // ----- exact static shot camera -----
    if (shot?.cam) {
      cam.position.set(...shot.cam.pos);
      cam.lookAt(...shot.cam.look);
      if (cam.fov !== fovBase) { cam.fov = fovBase; cam.updateProjectionMatrix(); }
      setLetterbox(false); ret.classList.remove('on');
      return;
    }

    // ----- hero velocity (finite difference, teleport-safe) -----
    if (first || hp.distanceToSquared(heroPrev) > 25) { heroVel.set(0, 0, 0); first = true; } // teleport -> snap
    else if (ctx.hero?.velocity?.isVector3) heroVel.copy(ctx.hero.velocity);
    else if (dt > 0) { tmp.subVectors(hp, heroPrev).divideScalar(dt); heroVel.lerp(tmp, 1 - Math.exp(-12 * dt)); }
    heroPrev.copy(hp);
    const speedXZ = Math.hypot(heroVel.x, heroVel.z);

    // ----- lock-on -----
    if (input?.pressed?.('lock')) {
      if (rig.lockTarget) rig.lockTarget = null;
      else {
        rig.lockTarget = findLockTarget(hp);
        if (!rig.lockTarget) { manualTimer = 99; recenterSnap = true; } // Zelda: Z with no target snaps behind hero
      }
    }
    if (shot && shot.enemiesNear && !rig.lockTarget) rig.lockTarget = findLockTarget(hp);
    if (rig.lockTarget) {
      enemyPos(rig.lockTarget, tmp);
      if (!isAlive(rig.lockTarget) || Math.hypot(tmp.x - hp.x, tmp.z - hp.z) > LOCK_BREAK) rig.lockTarget = null;
    }
    const target = (ctx.hero?.lockTarget && isAlive(ctx.hero.lockTarget)) ? ctx.hero.lockTarget : rig.lockTarget;
    lockBlend = damp(lockBlend, target ? 1 : 0, 6, dt);

    // ----- pivot: smooth follow + look-ahead -----
    const desiredPivotY = hp.y + PIVOT_H;
    if (first) {
      pivot.set(hp.x, desiredPivotY, hp.z); lookAhead.set(0, 0, 0);
      if (shot && !shot.cam) rig.yaw = (shot.yaw ?? 0) + Math.PI;
      else if (ctx.hero?.root) rig.yaw = ctx.hero.root.rotation.y + Math.PI;
      rig.pitch = PITCH_DEFAULT;
    } else {
      pivot.x = damp(pivot.x, hp.x, 14, dt);
      pivot.z = damp(pivot.z, hp.z, 14, dt);
      // vertical: follow quickly on the ground, lazily while airborne (jumps don't bob the frame)
      const grounded = ctx.hero?.grounded ?? true;
      pivot.y = damp(pivot.y, desiredPivotY, grounded ? 9 : 3, dt);
      if (Math.abs(pivot.y - desiredPivotY) > 3) pivot.y = desiredPivotY + Math.sign(pivot.y - desiredPivotY) * 3;
    }
    const leadK = Math.min(1, speedXZ / 6);
    tmp.set(heroVel.x, 0, heroVel.z).multiplyScalar(0.28);
    if (tmp.length() > 1.6) tmp.setLength(1.6);
    lookAhead.lerp(tmp.multiplyScalar(1 - lockBlend), 1 - Math.exp(-2.2 * dt));

    // ----- orbit control -----
    const cd = input?.cameraDelta;
    const manual = cd && (Math.abs(cd.x) + Math.abs(cd.y)) > 1e-5;
    if (manual) manualTimer = 0; else manualTimer += dt;
    if (input?.zoom) wantDist = THREE.MathUtils.clamp(wantDist + input.zoom, DIST_MIN + 1, DIST_MAX);

    if (shot && !shot.cam) {
      // ---- framed hero shot: over-the-shoulder 3/4, hero on the left third ----
      if (!target) {
        const fy = shot.yaw ?? 0;
        rig.yaw = fy + Math.PI + 0.38; rig.pitch = 0.11; rig.distance = 5.0;
      }
    } else if (target) {
      // Z-targeting: swing behind the hero, facing the target
      enemyPos(target, lockLook);
      const yawT = Math.atan2(hp.x - lockLook.x, hp.z - lockLook.z) + 0.32;
      rig.yaw += wrap(yawT - rig.yaw) * (1 - Math.exp(-5 * dt));
      rig.pitch = damp(rig.pitch, 0.24, 4, dt);
      if (manual) rig.pitch = THREE.MathUtils.clamp(rig.pitch - cd.y * 0.5, 0.05, 0.7);
    } else {
      if (manual) {
        rig.yaw -= cd.x;
        rig.pitch = THREE.MathUtils.clamp(rig.pitch - cd.y, PITCH_MIN, PITCH_MAX);
      }
      // auto-recentre behind the direction of travel
      if (recenterSnap && ctx.hero?.root) {
        const behind = ctx.hero.root.rotation.y + Math.PI;
        rig.yaw += wrap(behind - rig.yaw) * (1 - Math.exp(-10 * dt));
        rig.pitch = damp(rig.pitch, PITCH_DEFAULT, 8, dt);
        if (Math.abs(wrap(behind - rig.yaw)) < 0.02) recenterSnap = false;
        if (manual) recenterSnap = false;
      } else { recenterSnap = false; }
      if (!recenterSnap && manualTimer > RECENTER_DELAY && speedXZ > 1.2) {
        const behind = Math.atan2(-heroVel.x, -heroVel.z);
        const diff = wrap(behind - rig.yaw);
        // don't whip around when the hero runs toward the camera
        if (Math.abs(diff) < 2.5) {
          const ramp = Math.min(1, (manualTimer - RECENTER_DELAY) / 1.2);
          const rate = 1.15 * Math.min(1, speedXZ / 5) * ramp;
          rig.yaw += diff * (1 - Math.exp(-rate * dt));
          rig.pitch = damp(rig.pitch, PITCH_DEFAULT, 0.8 * ramp, dt);
        }
      }
    }
    rig.yaw = wrap(rig.yaw);

    // ----- distance -----
    let dist = wantDist;
    if (target) {
      const sep = Math.hypot(lockLook.x - hp.x, lockLook.z - hp.z);
      dist = THREE.MathUtils.clamp(wantDist + sep * 0.22, DIST_MIN, DIST_MAX);
    }
    if (shot && !shot.cam && !target) dist = rig.distance;
    rig.distance = damp(rig.distance, dist, 3, dt);
    if (first) rig.distance = dist;

    // ----- desired position -----
    const cp = Math.cos(rig.pitch);
    tmp.set(Math.sin(rig.yaw) * cp, Math.sin(rig.pitch), Math.cos(rig.yaw) * cp); // unit dir pivot -> camera
    const base = tmp2.copy(pivot).add(lookAhead);
    // shoulder offset in shot framing
    if (shot && !shot.cam && !target) {
      const fy = shot.yaw ?? 0;
      base.x += -Math.cos(fy) * 0.55; base.z += Math.sin(fy) * 0.55;
    }
    const safe = clearDistance(base, tmp, rig.distance);
    // pull in fast when obstructed, ease back out slowly
    if (first) collDist = safe;
    else collDist = safe < collDist ? damp(collDist, safe, 28, dt) : damp(collDist, safe, 2.5, dt);
    collDist = Math.min(collDist, rig.distance);
    desired.copy(base).addScaledVector(tmp, collDist);
    // never under ground or water surface
    const gmin = Math.max(heightAt(desired.x, desired.z), waterLevel()) + 0.45;
    if (desired.y < gmin) desired.y = gmin;

    // ----- look point -----
    lookPoint.copy(pivot).add(lookAhead);
    lookPoint.y += 0.15 - Math.min(0.35, Math.max(0, rig.pitch - 0.6) * 0.5);
    // close to the hero, look a bit higher so the hero isn't cut off by the bottom edge
    lookYOffset = damp(lookYOffset, collDist < 3 ? 0.25 : 0, 4, dt);
    lookPoint.y += lookYOffset;
    if (shot && !shot.cam && !target) {
      const fy = shot.yaw ?? 0;
      lookPoint.set(hp.x + Math.sin(fy) * 6 - Math.cos(fy) * 0.9, hp.y + 1.55, hp.z + Math.cos(fy) * 6 + Math.sin(fy) * 0.9);
    }
    if (lockBlend > 0.001 && target) {
      tmp.copy(lockLook); tmp.y += 1.0;
      tmp.lerpVectors(lookPoint, tmp, 0.42);
      lookPoint.lerp(tmp, lockBlend);
    }

    cam.position.copy(desired);
    cam.lookAt(lookPoint);

    // ----- shake (trauma^2, smooth multi-sine noise) -----
    if (trauma > 0) {
      const s = trauma * trauma;
      shakeOff.set(
        Math.sin(t * 37.1) * 0.6 + Math.sin(t * 61.7 + 1.3) * 0.4,
        Math.sin(t * 43.3 + 2.1) * 0.6 + Math.sin(t * 71.9) * 0.4,
        0).multiplyScalar(s * 0.22);
      cam.position.add(tmp.copy(shakeOff).applyQuaternion(cam.quaternion));
      cam.rotateZ(Math.sin(t * 29.3 + 0.7) * s * 0.035);
      trauma = Math.max(0, trauma - dt * 1.7);
    }

    // ----- FOV: widen on sprint -----
    const sprinting = ctx.hero?.state === 'sprint' || ((input?.down?.('sprint')) && (input?.move?.lengthSq?.() || 0) > 0.1 && speedXZ > 3) || speedXZ > 8.5;
    const fovT = fovBase + (sprinting ? 7 : 0) - lockBlend * 2;
    fov = first ? fovT : damp(fov, fovT, 3.2, dt);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }

    // ----- letterbox + reticle -----
    setLetterbox(!!target);
    if (target) {
      enemyPos(target, tmp); tmp.y += (target.height || 1.8) + 0.45;
      tmp.project(cam);
      const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      ret.classList.toggle('on', vis);
      const px = (tmp.x * 0.5 + 0.5) * innerWidth, py = (-tmp.y * 0.5 + 0.5) * innerHeight;
      ret.style.transform = `translate(${px}px,${py}px)`;
      const spin = t * 1.6, r = 15 + Math.sin(t * 5) * 2;
      arrows.forEach((a, i) => {
        const ang = spin + i * TAU / 3;
        a.style.transform = `translate(-50%,-50%) rotate(${ang}rad) translateY(${-r}px) rotate(180deg)`;
      });
    } else ret.classList.remove('on');

    first = false;
  }
  let recenterSnap = false;
  let lbOn = null;
  function setLetterbox(on) {
    if (on === lbOn) return; lbOn = on;
    lbTop.classList.toggle('on', on); lbBot.classList.toggle('on', on);
  }
  return { update };
}
