// Combat system: Bramble wolves + Thornback brute, hit detection, hitstop,
// VFX, health bars and Bosom shard drops.
//
// Exposes ctx.enemies (live array, mutated in place) of objects with:
//   { position:Vector3 (body centre, lock-on point), ground:Vector3 (feet),
//     alive, radius, hurt(dmg, dir) -> bool, root:Object3D, type:'wolf'|'brute',
//     health, maxHealth, lockHeight }
// Also ctx.combat = { spawnWolf(x,z), spawnBrute(x,z), vfx, shards, wolves, brutes }.
// Events emitted: 'hit' {position, enemy}, 'enemy-hurt', 'enemy-telegraph', 'enemy-attack',
//   'enemy-killed' {enemy, position}, 'rupee' {value, position}, 'shake' {amount, position},
//   'footstep' {position, heavy, enemy}, 'hero-hurt' (only if the hero has no hurt()).
// Hitstop: sets ctx.timeScale = 0.05 for 60 ms (real time) on every connecting hit;
//   main.js scales dt by ctx.timeScale.
import * as THREE from 'three';
import { heightAt as layoutHeight } from '../world/layout.js';
import { Wolf } from './wolf.js';
import { Brute } from './brute.js';
import { VFX, makeHealthBar } from './vfx.js';
import { Shards } from './shards.js';

export function init(ctx) {
  const heightAt = (x, z) => (ctx.terrain?.heightAt ? ctx.terrain.heightAt(x, z) : layoutHeight(x, z));
  ctx.enemies = ctx.enemies || [];
  const mgr = {
    ctx, now: 0, heightAt, wolves: [], brutes: [], token: null, tokenCool: 0,
    emit: (n, d) => ctx.emit(n, d),
    heroPos() {
      const h = ctx.hero; const p = h?.position || h?.root?.position;
      if (p) return p;
      if (ctx.shot?.hero) return (mgr._shotHero ||= new THREE.Vector3(ctx.shot.hero[0], heightAt(ctx.shot.hero[0], ctx.shot.hero[2]), ctx.shot.hero[2]));
      return null;
    },
    heroAlive() { const h = ctx.hero; return !!h && (h.health === undefined || h.health > 0) && !ctx.shot; },
    takeToken(e) {
      if (mgr.token && mgr.token !== e && mgr.token.alive) return false;
      if (mgr.tokenCool > 0) return false;
      mgr.token = e; return true;
    },
    releaseToken(e) { if (mgr.token === e) { mgr.token = null; mgr.tokenCool = 0.6 + Math.random() * 0.8; } },
    heroHurt(dmg, dir, src) {
      const h = ctx.hero; if (!h) return;
      const dodging = h.invulnerable || h.isInvulnerable?.() || h.state === 'dodge' || h.state === 'roll' || h.state === 'dead' || h.iframes > 0;
      if (dodging) { ctx.emit('dodged', { enemy: src }); return; }
      if (typeof h.hurt === 'function') h.hurt(dmg, dir, src);
      else ctx.emit('hero-hurt', { damage: dmg, dir, enemy: src });
      const hp = h.position || h.root?.position;
      if (hp) mgr.vfx.impact(hp.clone().add(new THREE.Vector3(0, 1.0, 0)), dir, false);
    },
    onKilled(e) {
      mgr.releaseToken(e);
      ctx.emit('enemy-killed', { enemy: e, position: e.position.clone() });
    },
    dropShards(at, n) { mgr.shards.drop(at, n); },
    collide(e, dt) {
      // soft separation from other enemies and the hero
      for (const o of ctx.enemies) {
        if (o === e || !o.alive) continue;
        const dx = e.ground.x - o.ground.x, dz = e.ground.z - o.ground.z, d = Math.hypot(dx, dz), m = (e.radius + o.radius) * 0.9;
        if (d < m && d > 1e-4) { const k = (m - d) * 0.5; e.ground.x += dx / d * k; e.ground.z += dz / d * k; }
      }
      const hp = mgr.heroPos();
      if (hp && e.alive && e.state !== 'lunge') {
        const dx = e.ground.x - hp.x, dz = e.ground.z - hp.z, d = Math.hypot(dx, dz), m = e.radius + 0.35;
        if (d < m && d > 1e-4) { e.ground.x = hp.x + dx / d * m; e.ground.z = hp.z + dz / d * m; }
      }
      // static colliders + ground via the shared character controller
      const P = ctx.physics;
      if (P?.move && e._prev && dt > 0) {
        const vel = (e._vel ||= new THREE.Vector3());
        vel.x = (e.ground.x - e._prev.x) / dt; vel.z = (e.ground.z - e._prev.z) / dt;
        e.ground.x = e._prev.x; e.ground.z = e._prev.z;
        try { P.move(e.ground, vel, e.radius * 0.8, dt, { height: e.type === 'brute' ? 2.2 : 1.0, stepHeight: 0.5 }); }
        catch (err) { e.ground.y = heightAt(e.ground.x, e.ground.z); }
        e.groundY = e.ground.y;
      }
      (e._prev ||= new THREE.Vector3()).copy(e.ground);
    },
  };
  mgr.vfx = new VFX(ctx, heightAt);
  mgr.shards = new Shards(mgr);

  function register(e) {
    e.bar = makeHealthBar(e.type === 'brute' ? 0xe0662a : 0xd84a2a);
    e.bar.scale.setScalar(e.type === 'brute' ? 1.25 : 0.85);
    ctx.scene.add(e.bar); e.barLag = 1; e.barAlpha = 0;
    ctx.enemies.push(e);
    (e.type === 'wolf' ? mgr.wolves : mgr.brutes).push(e);
    return e;
  }
  const spawnWolf = (x, z, o) => register(new Wolf(mgr, x, z, o));
  const spawnBrute = (x, z, o) => register(new Brute(mgr, x, z, o));

  // ---- the field pack (south-east meadow, raiding toward Brennan's Hollow)
  spawnWolf(19, -21, { variant: 0, slot: 0 });
  spawnWolf(24.5, -27, { variant: 1, slot: 2.1 });
  spawnWolf(15.5, -29, { variant: 2, slot: 4.2 });
  spawnBrute(30, -35, { heading: -2.5 });

  // ---- critic shot setup
  let shotDone = false;
  function setupShot() {
    if (shotDone || !ctx.shot) return; shotDone = true;
    const S = ctx.shot;
    for (const e of ctx.enemies) e.frozen = true;
    if (S.name === 'field') {
      // a living tableau: one trotting, one sniffing, one watching, brute ambling
      const [a, b, c] = mgr.wolves;
      a.heading = -2.4; a.speed = 3.4; a.state = 'stalk';
      b.heading = -1.0; b.state = 'prowl';
      c.heading = -0.4; c.state = 'circle';
      mgr.brutes[0].heading = -0.6; mgr.brutes[0].speed = 1.4;
    }
    if (!S.enemiesNear) return;
    const hp = mgr.heroPos();
    const yaw = S.yaw ?? 0;
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    if (ctx.hero?.root) { const q = ctx.hero.root.getWorldQuaternion(new THREE.Quaternion()); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q).setY(0); if (f.lengthSq() > 0.1) fwd.copy(f.normalize()); }
    placeNear(hp, fwd);
  }
  let nearSet = null;
  function placeNear(hp, fwd) {
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    if (!nearSet) {
      nearSet = [spawnWolf(0, 0, { variant: 0, scale: 1.04 }), spawnWolf(0, 0, { variant: 2, scale: 1.0 }), spawnBrute(0, 0, {})];
    }
    const spots = [[4.3, -1.9], [5.3, 2.0], [7.0, 0.2]];
    nearSet.forEach((e, i) => {
      const p = hp.clone().addScaledVector(fwd, spots[i][0]).addScaledVector(right, spots[i][1]);
      e.ground.set(p.x, heightAt(p.x, p.z), p.z); e._prev = e.ground.clone();
      e.heading = Math.atan2(hp.x - p.x, hp.z - p.z) + (i === 0 ? 0.35 : i === 1 ? -0.3 : 0);
      e.frozen = true; e.speed = 0;
      e.setState(e.type === 'wolf' ? 'snarlPose' : 'roarPose');
      e.look.set(0, 0);
    });
  }
  ctx.on('shot', setupShot);

  ctx.combat = { spawnWolf, spawnBrute, vfx: mgr.vfx, shards: mgr.shards, wolves: mgr.wolves, brutes: mgr.brutes, mgr };

  // ---- hit detection state
  let swingId = 0, hadBox = false, hitstopEnd = 0, ownTimeScale = false;
  const tmp = new THREE.Vector3();

  function hitstop(ms) {
    ctx.timeScale = 0.05; ownTimeScale = true; hitstopEnd = Math.max(hitstopEnd, performance.now() + ms);
  }

  // Dev-only inspection cameras (window.__combatCam = 'wolf'|'brute'|'pack'|'side'); inert otherwise.
  function debugCam() {
    const c = typeof window !== 'undefined' && window.__combatCam; if (!c) return;
    const pick = c === 'brute' ? mgr.brutes[mgr.brutes.length - 1] : c === 'pack' ? mgr.wolves[0] : (nearSet ? nearSet[0] : mgr.wolves[0]);
    if (!pick) return;
    const g = pick.ground, h = pick.heading;
    const f = new THREE.Vector3(Math.sin(h), 0, Math.cos(h)), r = new THREE.Vector3(-f.z, 0, f.x);
    const d = c === 'brute' ? 4.2 : c === 'pack' ? 9 : 2.6;
    const side = c === 'side' ? 1.0 : 0.55;
    const pos = g.clone().addScaledVector(f, d * (1 - side * 0.5)).addScaledVector(r, d * side); pos.y += c === 'brute' ? 1.6 : c === 'pack' ? 3 : 1.0;
    ctx.camera.position.copy(pos); ctx.camera.lookAt(pick.position.x, pick.position.y + (c === 'brute' ? 0.2 : 0), pick.position.z);
    ctx.camera.updateMatrixWorld();
  }

  ctx.combat.debugView = name => { window.__combatCam = name; debugCam(); };

  return {
    update(dt) {
      if (ctx.paused) return;
      if (ctx.shot && !shotDone) setupShot();
      mgr.now += dt; mgr.tokenCool = Math.max(0, mgr.tokenCool - dt);
      if (ownTimeScale && performance.now() > hitstopEnd) { ctx.timeScale = 1; ownTimeScale = false; }
      // the shot camera may disagree with the hero's facing convention; keep posed foes in view
      if (nearSet && ctx.shot && !mgr._shotChecked && mgr.now > 0.4) {
        mgr._shotChecked = true;
        const hp = mgr.heroPos(); const cf = ctx.camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
        const toE = nearSet[2].ground.clone().sub(hp).setY(0).normalize();
        if (cf.dot(toE) < 0.2 && !ctx.shot.cam) placeNear(hp, cf);
      }

      // ---- hero sword vs enemies
      const box = ctx.hero?.attackHitbox?.();
      if (box && !hadBox) swingId++;
      hadBox = !!box;
      if (box) {
        const sid = box.id ?? swingId;
        const hp = mgr.heroPos();
        for (const e of ctx.enemies) {
          if (!e.alive || e.lastSwing === sid) continue;
          const d = box.center.distanceTo(e.position);
          if (d < box.radius + e.radius) {
            e.lastSwing = sid;
            const dir = tmp.subVectors(e.ground, hp || box.center).setY(0);
            if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
            const dmg = box.damage ?? 1;
            const killed = e.hurt(dmg, dir.clone()) && !e.alive;
            const contact = box.center.clone().lerp(e.position, Math.min(1, e.radius / Math.max(d, 1e-3)) * 0.5 + 0.25);
            mgr.vfx.impact(contact, dir, killed || !!box.strong);
            mgr.vfx.dust(e.ground, e.type === 'brute' ? 0.7 : 0.5, 5);
            ctx.emit('hit', { position: contact, enemy: e, damage: dmg, killed });
            ctx.emit('shake', { amount: killed ? 0.35 : 0.2, position: contact });
            hitstop(killed ? 90 : 60);
          }
        }
      }

      // ---- enemies
      for (let i = ctx.enemies.length - 1; i >= 0; i--) {
        const e = ctx.enemies[i];
        if (!(e instanceof Wolf) && !(e instanceof Brute)) continue; // foreign enemies update themselves
        e.update(dt);
        // LOD: fur shells + shadow casting only near the camera
        const cd = ctx.camera.position.distanceTo(e.position);
        if (e.m.fur) e.m.fur.visible = cd < 30;
        e.m.skin.castShadow = cd < 45; if (e.m.hard) e.m.hard.castShadow = cd < 45;
        // health bar
        const locked = ctx.cameraRig?.lockTarget === e;
        const recent = mgr.now - e.lastDamaged < 4;
        const show = e.alive && (locked || recent);
        e.barAlpha = THREE.MathUtils.damp(e.barAlpha, show ? 1 : 0, 8, dt);
        const hf = Math.max(0, e.health / e.maxHealth);
        e.barLag = e.barLag > hf ? Math.max(hf, e.barLag - dt * 0.6 * (mgr.now - e.lastDamaged > 0.5 ? 1 : 0)) : hf;
        const bu = e.bar.material.uniforms; bu.uHp.value = hf; bu.uLag.value = e.barLag; bu.uAlpha.value = e.barAlpha;
        e.bar.visible = e.barAlpha > 0.02;
        if (e.bar.visible) {
          e.bar.position.copy(e.position); e.bar.position.y += (e.type === 'brute' ? 1.25 : 0.75) * e.scale;
          e.bar.quaternion.copy(ctx.camera.quaternion);
        }
        if (e.dead) {
          ctx.enemies.splice(i, 1);
          const L = e.type === 'wolf' ? mgr.wolves : mgr.brutes; const j = L.indexOf(e); if (j >= 0) L.splice(j, 1);
          e.bar.parent?.remove(e.bar); e.dispose();
          if (ctx.cameraRig?.lockTarget === e) ctx.cameraRig.lockTarget = null;
        }
      }
      mgr.shards.update(dt);
      mgr.vfx.update(dt);
      debugCam();
    },
  };
}
