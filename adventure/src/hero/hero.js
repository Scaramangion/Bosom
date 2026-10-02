// Koto, the hero. Procedurally modelled + rigged character (see model.js — the
// shipped koto.glb is a ~1.1 m blockout whose node hierarchy is broken: several
// joints list themselves as children, so it can't be animated properly), a
// two-layer AnimationMixer state machine with speed-matched locomotion, a verlet
// cape, sword & shield with back-carry / draw, and procedural extras: lean into
// turns, head look-at, slope foot IK, slash trail.
//
// ctx.hero = { root, position, velocity, state, health, maxHealth, facing, yaw, grounded,
//              swordDrawn, invulnerable, lockTarget, attackHitbox(), hurt(dmg, fromDir), heal(n) }
// Events: 'swing' {combo, position, dir}, 'footstep' {position, side, speed, run},
//         'hero-hurt' {damage, health, dir}, 'block' {position}, 'jump', 'land' {fallSpeed},
//         'roll', 'hero-dead', 'hero-respawn', 'sword-draw', 'sword-sheathe'
import * as THREE from 'three';
import * as layout from '../world/layout.js';
import { buildSkeleton } from './rig.js';
import { buildMaterials, makeEnv, heroUniforms } from './materials.js';
import { buildBody } from './model.js';
import { buildSword, buildScabbard, buildShield, buildTrail, BLADE_LEN, SHIELD_R } from './gear.js';
import { buildCape } from './cape.js';
import { buildClips } from './anims.js';

const TAU = Math.PI * 2;
const wrapA = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const ss = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

const RUN_SPEED = 5.4, SPRINT_SPEED = 7.8, WALK_GUARD = 2.0;
const JUMP_V = 7.4, GRAV = 22;

export async function init(ctx) {
  const { scene } = ctx;
  const env = makeEnv(ctx.renderer);
  const M = buildMaterials(env);
  const rig = buildSkeleton();
  const body = buildBody(rig, M);

  // hierarchy: root (world pos/yaw) -> lean pivot -> model (bones + skinned meshes)
  const root = new THREE.Group(); root.name = 'hero';
  const lean = new THREE.Group(); root.add(lean);
  const model = new THREE.Group(); lean.add(model);
  model.add(rig.root); model.add(body.group);
  scene.add(root);
  const B = rig.byName;

  // gear
  const sword = buildSword(M), scabbard = buildScabbard(M), shield = buildShield(M);
  const trail = buildTrail(scene);
  // back-carry: scabbard diagonal (hilt over left shoulder), shield over it
  const backSword = new THREE.Object3D(), backShield = new THREE.Object3D(), handSword = new THREE.Object3D(), armShield = new THREE.Object3D();
  B.chest.add(backSword, backShield); B.hand_R.add(handSword); B.lowerArm_L.add(armShield);
  B.chest.add(scabbard);
  {
    // chest-local frame (bind: chest origin at y=1.21)
    const hilt = new THREE.Vector3(0.13, 0.23, -0.2), tip = new THREE.Vector3(-0.27, -0.42, -0.21);
    const dir = tip.clone().sub(hilt).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    scabbard.quaternion.copy(q).multiply(flip); scabbard.position.copy(hilt).addScaledVector(dir, 0.0);
    backSword.quaternion.copy(scabbard.quaternion); backSword.position.copy(hilt).addScaledVector(dir, -0.005);
    // sword in back: blade (+Y) points down the scabbard
    backShield.position.set(0.015, -0.12, -0.25);
    backShield.rotation.set(-0.08, Math.PI, 0.25);
    // in hand: grip axis along hand-local +Z, fist centre
    handSword.position.set(-0.004, -0.048, 0.012 + 0.05);
    handSword.rotation.set(Math.PI / 2, 0, 0);
  }
  // shield-on-arm attach solved so that in the guard pose the shield faces forward in front of the forearm
  backSword.add(sword); backShield.add(shield);
  const clips = buildClips(rig);
  {
    const { POSES } = await import('./anims.js');
    const g = { ...POSES.combatIdlePose(0), ...POSES.guardUpper() };
    POSES.applyPose(rig, g);
    const fw = new THREE.Matrix4().copy(B.lowerArm_L.matrixWorld);
    const desired = new THREE.Matrix4().compose(new THREE.Vector3(0.0, 1.23, 0.36), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1));
    // place shield centre ~8cm in front of the forearm midpoint
    const mid = new THREE.Vector3(0, -0.13, 0).applyMatrix4(fw);
    desired.setPosition(mid.x, mid.y, mid.z + 0.085);
    const local = fw.clone().invert().multiply(desired);
    local.decompose(armShield.position, armShield.quaternion, armShield.scale);
    POSES.applyPose(rig, { hips: [0, 0, 0] });
  }

  // cape
  const cape = buildCape(M.cape);
  scene.add(cape.mesh);

  // ---------------- mixer / layers ----------------
  const mixer = new THREE.AnimationMixer(rig.root);
  const acts = {};
  for (const [name, c] of Object.entries(clips)) {
    const lo = mixer.clipAction(c.lo), up = mixer.clipAction(c.up);
    for (const a of [lo, up]) {
      a.setLoop(c.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true; a.enabled = true; a.setEffectiveWeight(0); a.play();
    }
    acts[name] = { lo, up, clip: c, wLo: 0, wUp: 0 };
  }
  const LOCO = ['idle', 'combatIdle', 'walk', 'run', 'sprint'];
  const MANUAL_TIME = new Set(['walk', 'run', 'sprint']);
  for (const n of MANUAL_TIME) { acts[n].lo.timeScale = 0; acts[n].up.timeScale = 0; }

  // ---------------- state ----------------
  const pos = root.position, vel = new THREE.Vector3();
  const facing = new THREE.Vector3(0, 0, 1);
  const H = {
    root, position: pos, velocity: vel, facing, yaw: 0, state: 'idle',
    health: 12, maxHealth: 12, grounded: true, swordDrawn: false, invulnerable: false, iframes: 0,
    lockTarget: null, combo: 0, model, skeleton: rig.skeleton, bones: B,
    attackHitbox, hurt, heal(n) { H.health = Math.min(H.maxHealth, H.health + n); },
  };
  ctx.hero = H;

  let yaw = 0, yawVel = 0, phase = 0, speedSm = 0;
  let action = null; // { name, t, dur, ... } one-shot full-body or upper action
  let upperAction = null; // draw/sheathe/attack while moving
  let queued = false, swingId = 0, comboTimer = 0;
  let combatTimer = 0, hurtFlash = 0, deadTimer = 0;
  let airTime = 0, landTimer = 0, rollDir = new THREE.Vector3();
  let lastFootY = { L: 0, R: 0 }, footArmed = { L: true, R: true };
  let shotMode = null;
  const lookYP = { y: 0, p: 0 };

  function heightAt(x, z) { return ctx.physics?.heightAt ? ctx.physics.heightAt(x, z) : ctx.terrain?.heightAt ? ctx.terrain.heightAt(x, z) : layout.heightAt(x, z); }
  function groundAt(x, z, fromY) { return ctx.physics?.raycastGround ? ctx.physics.raycastGround(x, z, fromY) : heightAt(x, z); }

  // spawn
  {
    const sx = 0, sz = 0;
    pos.set(sx, heightAt(sx, sz), sz);
  }

  function setSword(drawn) {
    if (H.swordDrawn === drawn) return;
    H.swordDrawn = drawn;
    (drawn ? handSword : backSword).add(sword);
    (drawn ? armShield : backShield).add(shield);
    ctx.emit(drawn ? 'sword-draw' : 'sword-sheathe', { position: pos.clone() });
  }

  function placeAt(x, z, y0) {
    pos.set(x, groundAt(x, z, (y0 ?? 1e4)), z);
    vel.set(0, 0, 0);
  }

  ctx.on('shot', (s) => {
    shotMode = s;
    if (s.hero) placeAt(s.hero[0], s.hero[2]);
    yaw = s.yaw || 0; root.rotation.y = yaw;
    if (s.enemiesNear) setSword(true);
  });
  if (ctx.params?.get('shot')) shotMode = { name: ctx.params.get('shot'), pending: true };

  // ---------------- actions ----------------
  function startAction(name, opts = {}) {
    const a = acts[name];
    a.lo.reset(); a.up.reset(); a.lo.timeScale = a.up.timeScale = opts.speed || 1;
    const st = { name, t: 0, dur: a.clip.dur / (opts.speed || 1), upperOnly: !!opts.upperOnly, ...opts };
    if (opts.upperOnly) upperAction = st; else action = st;
    return a;
  }
  function attack(chain = false) {
    setSword(true); combatTimer = 0; upperAction = null;
    H.combo = ((chain || comboTimer > 0) && H.combo < 3) ? H.combo + 1 : 1;
    const n = H.combo;
    swingId++;
    // soft auto-aim toward nearest enemy in front within 3.5 m
    const tgt = H.lockTarget || nearestEnemy(3.5, 0.2);
    if (tgt) { const tp = tgt.position || tgt.root?.position; yaw = Math.atan2(tp.x - pos.x, tp.z - pos.z); }
    else if (moveDir.lengthSq() > 0.01) yaw = Math.atan2(moveDir.x, moveDir.z);
    startAction('attack' + n, { speed: n === 3 ? 1.0 : 1.08 });
    action.combo = n; action.swing = swingId; action.active = acts['attack' + n].clip.active.map(x => x / (n === 3 ? 1 : 1.08));
    H.state = 'attack'; queued = false; comboTimer = 0;
    ctx.emit('swing', { combo: n, position: pos.clone(), dir: facing.clone() });
  }
  function nearestEnemy(range, minDot = -1) {
    let best = null, bd = range;
    for (const e of ctx.enemies || []) {
      if (!e || e.alive === false || e.dead) continue;
      const p = e.position || e.root?.position; if (!p) continue;
      const dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz);
      if (d > bd) continue;
      if (minDot > -1 && d > 0.5 && (dx * facing.x + dz * facing.z) / d < minDot) continue;
      best = e; bd = d;
    }
    return best;
  }

  const hitbox = { center: new THREE.Vector3(), radius: 0.6, id: 0, damage: 1, dir: new THREE.Vector3(), base: new THREE.Vector3(), tip: new THREE.Vector3(), strong: false };
  function attackHitbox() {
    if (!action || !action.name.startsWith('attack') || !action.active) return null;
    if (action.t < action.active[0] || action.t > action.active[1]) return null;
    bladeWorld(hitbox.base, hitbox.tip);
    hitbox.center.lerpVectors(hitbox.base, hitbox.tip, 0.6);
    hitbox.radius = action.combo === 3 ? 0.75 : 0.62;
    hitbox.id = action.swing; hitbox.damage = action.combo === 3 ? 2 : 1; hitbox.strong = action.combo === 3;
    hitbox.dir.copy(facing);
    return hitbox;
  }
  const _b = new THREE.Vector3(0, 0.05, 0), _t = new THREE.Vector3(0, BLADE_LEN, 0);
  function bladeWorld(base, tip) {
    sword.updateWorldMatrix(true, false);
    base.copy(_b).applyMatrix4(sword.matrixWorld); tip.copy(_t).applyMatrix4(sword.matrixWorld);
  }

  function hurt(dmg = 1, fromDir) {
    if (H.state === 'dead' || H.iframes > 0 || H.invulnerable) return false;
    const dir = fromDir ? new THREE.Vector3(fromDir.x, 0, fromDir.z) : facing.clone().negate();
    if (dir.lengthSq() < 1e-6) dir.copy(facing).negate(); dir.normalize();
    // guarding with shield toward the attack (dir points from attacker toward hero)
    const guarding = H.state === 'guard' || (ctx.input?.down?.('guard') && H.swordDrawn && !action);
    if (guarding && -(dir.x * facing.x + dir.z * facing.z) > 0.25) {
      vel.x += dir.x * 3; vel.z += dir.z * 3;
      ctx.emit('block', { position: pos.clone().add(new THREE.Vector3(facing.x * 0.4, 1.2, facing.z * 0.4)), dir });
      ctx.cameraRig?.shake?.(0.15);
      return false;
    }
    H.health = Math.max(0, H.health - dmg);
    H.iframes = 0.9; hurtFlash = 1;
    vel.x = dir.x * 6; vel.z = dir.z * 6;
    yaw = Math.atan2(-dir.x, -dir.z);
    setSword(true);
    upperAction = null;
    startAction('hurt'); H.state = 'hurt';
    ctx.cameraRig?.shake?.(0.35);
    ctx.input?.vibrate?.(0.6, 180);
    ctx.emit('hero-hurt', { damage: dmg, health: H.health, dir });
    if (H.health <= 0) { H.state = 'dead'; deadTimer = 0; ctx.emit('hero-dead', { position: pos.clone() }); }
    return true;
  }

  // ---------------- per-frame ----------------
  const moveDir = new THREE.Vector3(), camF = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const qTmp = new THREE.Quaternion(), qTmp2 = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  const capsules = Array.from({ length: 8 }, () => [new THREE.Vector3(), new THREE.Vector3(), 0]);
  const disk = { c: new THREE.Vector3(), n: new THREE.Vector3(), r: SHIELD_R };
  const capeBack = { right: new THREE.Vector3(), dir: new THREE.Vector3() };
  const wind = new THREE.Vector3();
  let prevPos = pos.clone(), firstFrame = true;

  function readInput() {
    const inp = ctx.input;
    const has = inp && inp.enabled !== false && !shotMode;
    const mv = has && inp.move ? inp.move : null;
    moveDir.set(0, 0, 0);
    let mag = 0;
    if (mv && mv.lengthSq() > 0.0025) {
      if (ctx.cameraRig?.moveToWorld) { ctx.cameraRig.moveToWorld(mv, moveDir); moveDir.y = 0; }
      else {
        ctx.camera.getWorldDirection(camF); camF.y = 0; if (camF.lengthSq() < 1e-6) camF.set(0, 0, -1); camF.normalize();
        moveDir.set(-camF.z * mv.x + camF.x * mv.y, 0, camF.x * mv.x + camF.z * mv.y);
      }
      mag = Math.min(1, mv.length());
      if (moveDir.lengthSq() > 1e-6) moveDir.normalize().multiplyScalar(mag);
    }
    return {
      has, mag,
      sprint: has && inp.down?.('sprint'), guard: has && inp.down?.('guard'),
      attack: has && inp.pressed?.('attack'), jump: has && inp.pressed?.('jump'), roll: has && inp.pressed?.('roll'),
    };
  }

  function update(dtRaw) {
    const dt = Math.min(dtRaw, 1 / 20);
    if (dt <= 0) return;
    const I = readInput();
    H.lockTarget = ctx.cameraRig?.lockTarget && ctx.cameraRig.lockTarget.alive !== false ? ctx.cameraRig.lockTarget : null;
    H.iframes = Math.max(0, H.iframes - dt);
    comboTimer = Math.max(0, comboTimer - dt);
    hurtFlash = Math.max(0, hurtFlash - dt * 3);
    heroUniforms.uHurtFlash.value = hurtFlash * hurtFlash;

    // shot mode: frozen, staged poses
    let shotRun = 0;
    if (shotMode) {
      if (shotMode.pending && ctx.shot) { /* handled by event */ }
      if (shotMode.hero && firstFrame) placeAt(shotMode.hero[0], shotMode.hero[2]);
      if (shotMode.name === 'trail') shotRun = 4.6;
      if (shotMode.enemiesNear) {
        setSword(true);
        const e = nearestEnemy(30);
        if (e) { const p = e.position || e.root.position; const want = Math.atan2(p.x - pos.x, p.z - pos.z); yaw = wrapA(yaw + wrapA(want - yaw) * Math.min(1, dt * 4)); }
      }
    }

    // ---------- state logic ----------
    const grounded = H.grounded;
    let targetSpeed = 0, wantDir = moveDir;
    if (action) action.t += dt;
    if (upperAction) upperAction.t += dt;
    if (upperAction && upperAction.t >= upperAction.dur) {
      if (upperAction.name === 'sheathe') setSword(false);
      upperAction = null;
    }
    if (upperAction?.name === 'draw' && upperAction.t > 0.17) setSword(true);
    if (upperAction?.name === 'sheathe' && upperAction.t > 0.2) setSword(false);

    if (H.state === 'dead') {
      deadTimer += dt;
      if (deadTimer > 3.5) {
        H.health = H.maxHealth; H.state = 'idle'; action = null;
        placeAt(layout.LANDMARKS.spawn.x, layout.LANDMARKS.spawn.z);
        ctx.emit('hero-respawn', { position: pos.clone() });
      }
    } else if (action) {
      const n = action.name;
      if (n.startsWith('attack')) {
        if (I.attack && action.t > 0.12) queued = true;
        // lunge
        const lunge = action.t < (action.active?.[1] ?? 0.3) ? (action.combo === 3 ? 3.2 : 2.4) * (1 - action.t / 0.4) : 0;
        targetSpeed = Math.max(0, lunge); wantDir = facing;
        const doneAt = action.dur * (queued ? 0.62 : 1);
        if (queued && action.t >= (action.active?.[1] ?? 0.3) && action.combo < 3) { attack(true); }
        else if (action.t >= doneAt) { const cb = action.combo; action = null; comboTimer = cb === 3 ? 0 : 0.3; H.state = 'idle'; }
        if (I.roll && action && action.t > (action.active?.[1] ?? 0.3)) { action = null; startRoll(); }
      } else if (n === 'roll') {
        const k = action.t / action.dur;
        H.invulnerable = k > 0.05 && k < 0.7;
        vel.x = rollDir.x * (7.2 - 4.0 * k); vel.z = rollDir.z * (7.2 - 4.0 * k);
        if (action.t >= action.dur) { action = null; H.invulnerable = false; H.state = 'idle'; }
      } else if (n === 'hurt') {
        vel.x = damp(vel.x, 0, 6, dt); vel.z = damp(vel.z, 0, 6, dt);
        if (action.t >= action.dur) { action = null; H.state = 'idle'; }
      } else if (n === 'land') {
        targetSpeed = I.mag * RUN_SPEED * 0.6;
        if (action.t >= action.dur * 0.7 || I.mag > 0.5 && action.t > 0.12) { action = null; H.state = 'idle'; }
      } else if (n === 'jump') {
        targetSpeed = I.mag * (I.sprint ? SPRINT_SPEED : RUN_SPEED);
        if (action.t >= action.dur) action = null;
      }
    }
    if (!action && H.state !== 'dead') {
      // free movement
      const guard = I.guard && grounded;
      if (guard && !H.swordDrawn) setSword(true);
      targetSpeed = I.mag * (guard ? WALK_GUARD : (I.sprint && !H.lockTarget ? SPRINT_SPEED : RUN_SPEED));
      if (I.attack && grounded) attack();
      else if (I.roll && grounded) startRoll();
      else if (I.jump && grounded) {
        vel.y = JUMP_V; H.grounded = false; startAction('jump'); H.state = 'jump';
        ctx.emit('jump', { position: pos.clone() });
      }
      if (!action) {
        if (!grounded) H.state = 'fall';
        else if (guard) H.state = 'guard';
        else {
          const sp = Math.hypot(vel.x, vel.z);
          H.state = sp > 6.5 ? 'sprint' : sp > 3 ? 'run' : sp > 0.3 ? 'walk' : 'idle';
        }
      }
    }

    // combat readiness: auto draw when enemies are close, sheathe when calm
    const threat = H.lockTarget || nearestEnemy(9);
    if (threat || action?.name?.startsWith('attack') || H.state === 'guard') combatTimer = 0; else combatTimer += dt;
    if (!shotMode && H.state !== 'dead') {
      if (threat && !H.swordDrawn && !upperAction && !action && grounded) startAction('draw', { upperOnly: true });
      if (H.swordDrawn && combatTimer > 7 && !upperAction && !action && grounded && H.state !== 'sprint') startAction('sheathe', { upperOnly: true });
    }

    // ---------- facing / velocity ----------
    const lockP = H.lockTarget ? (H.lockTarget.position || H.lockTarget.root?.position) : null;
    if (!shotMode) {
      if (lockP && (!action || action.name !== 'roll')) {
        const want = Math.atan2(lockP.x - pos.x, lockP.z - pos.z);
        const nyaw = wrapA(yaw + wrapA(want - yaw) * (1 - Math.exp(-12 * dt)));
        yawVel = wrapA(nyaw - yaw) / dt; yaw = nyaw;
      } else if ((!action || action.name === 'jump' || action.name === 'land') && wantDir.lengthSq() > 0.01) {
        const want = Math.atan2(wantDir.x, wantDir.z);
        const rate = grounded ? (speedSm > 5 ? 8 : 13) : 4;
        const nyaw = wrapA(yaw + wrapA(want - yaw) * (1 - Math.exp(-rate * dt)));
        yawVel = wrapA(nyaw - yaw) / dt; yaw = nyaw;
      } else yawVel = damp(yawVel, 0, 10, dt);
    }
    root.rotation.y = yaw;
    facing.set(Math.sin(yaw), 0, Math.cos(yaw));
    H.yaw = yaw;

    if (!action || !['roll', 'hurt'].includes(action.name)) {
      if (H.state !== 'dead') {
        const dirV = lockP || (action && action.name.startsWith('attack')) ? (moveDir.lengthSq() > 0.01 && !action ? moveDir : facing) : facing;
        const tvx = dirV.x / (dirV.length() || 1) * targetSpeed, tvz = dirV.z / (dirV.length() || 1) * targetSpeed;
        const accel = grounded ? (targetSpeed > Math.hypot(vel.x, vel.z) ? 26 : 20) : 6;
        const dvx = tvx - vel.x, dvz = tvz - vel.z, dl = Math.hypot(dvx, dvz), mx = accel * dt;
        if (dl > mx) { vel.x += dvx / dl * mx; vel.z += dvz / dl * mx; } else { vel.x = tvx; vel.z = tvz; }
      } else { vel.x = damp(vel.x, 0, 5, dt); vel.z = damp(vel.z, 0, 5, dt); }
    }

    // ---------- physics ----------
    if (!shotMode) {
      const wasG = H.grounded;
      if (ctx.physics?.move) {
        const r = ctx.physics.move(pos, vel, 0.35, dt, { height: 1.7, gravity: GRAV });
        H.grounded = r.grounded; H.swimming = r.swimming; H.groundNormal = r.groundNormal;
        if (r.landed || (!wasG && r.grounded)) onLand(r.fallSpeed || airFall);
      } else {
        vel.y -= GRAV * dt;
        pos.addScaledVector(vel, dt);
        const g = heightAt(pos.x, pos.z);
        if (pos.y <= g + 0.02 || (wasG && vel.y <= 0 && pos.y - g < 0.35)) { if (!wasG) onLand(-vel.y); pos.y = g; vel.y = Math.max(0, vel.y); H.grounded = true; }
        else H.grounded = false;
        const R = layout.WORLD_SIZE / 2 - 6; pos.x = Math.max(-R, Math.min(R, pos.x)); pos.z = Math.max(-R, Math.min(R, pos.z));
      }
      if (!H.grounded) { airTime += dt; airFall = Math.max(airFall, -vel.y); } else { airTime = 0; }
    } else {
      H.grounded = true; vel.set(0, 0, 0);
      if (shotRun) vel.set(facing.x * shotRun, 0, facing.z * shotRun); // velocity for anim/cape only
    }

    const spd = Math.hypot(vel.x, vel.z);
    speedSm = damp(speedSm, spd, 10, dt);

    // ---------- animation weights ----------
    const tgtLo = {}, tgtUp = {};
    const locoW = locomotionWeights(speedSm);
    let fade = 10;
    const fullAction = action && H.state !== 'dead' ? action.name : null;
    if (H._force) {
      const f = H._force; tgtLo[f.name] = 1; tgtUp[f.upper || f.name] = 1; fade = 1e4;
      if (f.speed !== undefined) { speedSm = f.speed; }
    } else if (H.state === 'dead') { tgtLo.land = 1; tgtUp.hurt = 1; }
    else if (fullAction) {
      const moving = speedSm > 1.2 && fullAction.startsWith('attack');
      if (moving) { Object.assign(tgtLo, locoW); } else tgtLo[fullAction] = 1;
      tgtUp[fullAction] = 1;
      fade = fullAction === 'roll' ? 25 : fullAction === 'hurt' ? 30 : 18;
    } else if (!H.grounded && airTime > 0.08) {
      tgtLo.fall = 1; tgtUp.fall = 1; fade = 6;
    } else {
      Object.assign(tgtLo, locoW);
      if (H.state === 'guard') tgtUp.guard = 1;
      else if (upperAction) tgtUp[upperAction.name] = 1;
      else Object.assign(tgtUp, locoW);
    }
    // phase for locomotion
    let strideW = 0, wsum = 0;
    for (const n of ['walk', 'run', 'sprint']) { const w = locoW[n] || 0; strideW += w * acts[n].clip.stride; wsum += w; }
    let dirSign = 1;
    if (lockP && spd > 0.2) dirSign = (vel.x * facing.x + vel.z * facing.z) < -0.2 * spd ? -1 : 1;
    if (wsum > 0.001) phase += dirSign * dt * spd / (strideW / wsum);
    phase = ((phase % 1) + 1) % 1;
    for (const n of MANUAL_TIME) { const d = acts[n].clip.dur; acts[n].lo.time = phase * d; acts[n].up.time = phase * d; }

    for (const [n, a] of Object.entries(acts)) {
      const k = 1 - Math.exp(-fade * dt);
      a.wLo += ((tgtLo[n] || 0) - a.wLo) * k;
      a.wUp += ((tgtUp[n] || 0) - a.wUp) * k;
      if (a.wLo < 0.002) a.wLo = 0; if (a.wUp < 0.002) a.wUp = 0;
    }
    // normalise per layer
    let sLo = 0, sUp = 0; for (const a of Object.values(acts)) { sLo += a.wLo; sUp += a.wUp; }
    for (const a of Object.values(acts)) {
      a.lo.setEffectiveWeight(sLo > 0 ? a.wLo / sLo : 0);
      a.up.setEffectiveWeight(sUp > 0 ? a.wUp / sUp : 0);
    }
    // keep looping idles in sync, upper copies of lower one-shots
    if (upperAction) { const ua = acts[upperAction.name].up; ua.time = Math.min(upperAction.t, acts[upperAction.name].clip.dur); }
    if (action) { const a = acts[action.name]; const tt = Math.min(action.t * (a.lo.timeScale || 1), a.clip.dur); a.lo.time = tt; a.up.time = tt; }
    if (H._force && H._force.t !== undefined) {
      const a = acts[H._force.name], u = acts[H._force.upper || H._force.name];
      a.lo.time = Math.min(H._force.t, a.clip.dur); u.up.time = Math.min(H._force.t, u.clip.dur);
      a.lo.paused = u.up.paused = true;
    }
    mixer.update(dt);
    // mixer.update advanced action times by dt*timeScale for non-manual; we drive one-shots ourselves
    if (action) { const a = acts[action.name]; const tt = Math.min(action.t * (a.lo.timeScale || 1), a.clip.dur); a.lo.time = tt; a.up.time = tt; }

    // ---------- procedural layer ----------
    // lean into turns + acceleration pitch
    const leanZ = THREE.MathUtils.clamp(-yawVel * speedSm * 0.035, -0.32, 0.32);
    lean.rotation.z = damp(lean.rotation.z, (H.grounded && (!action || action.name.startsWith('attack'))) ? leanZ : 0, 8, dt);
    // strafing: rotate lower body toward movement when locked on
    if (lockP && spd > 0.4 && !action) {
      let rel = wrapA(Math.atan2(vel.x, vel.z) - yaw);
      if (Math.abs(rel) > Math.PI / 2) rel = wrapA(rel + Math.PI);
      const r = THREE.MathUtils.clamp(rel, -1.1, 1.1) * 0.75;
      qTmp.setFromAxisAngle(Y, r); B.hips.quaternion.premultiply(qTmp);
      qTmp.setFromAxisAngle(Y, -r * 0.8); B.spine.quaternion.premultiply(qTmp);
    }
    // body twist toward attack target is authored; extra head look-at:
    root.updateMatrixWorld(true);
    headLook(dt, lockP);
    // foot IK on slopes
    if (H.grounded && (!action || !['roll', 'jump'].includes(action.name)) && H.state !== 'dead') footIK(dt);
    root.updateMatrixWorld(true);

    // footsteps
    for (const s of ['L', 'R']) {
      tmp.set(0, -0.07, 0.04).applyMatrix4(B['foot_' + s].matrixWorld);
      const h = tmp.y - pos.y;
      if (footArmed[s] && h < 0.035 && lastFootY[s] >= h && spd > 0.6 && H.grounded) {
        footArmed[s] = false;
        ctx.emit('footstep', { position: tmp.clone(), side: s, speed: spd, run: spd > 3 });
      }
      if (h > 0.07) footArmed[s] = true;
      lastFootY[s] = h;
    }

    // ---------- cape ----------
    const BM = (n, out) => out.setFromMatrixPosition(B[n].matrixWorld);
    const C = capsules;
    const side = tmp2.set(1, 0, 0).transformDirection(B.chest.matrixWorld);
    BM('spine', C[0][0]).addScaledVector(side, 0.065); BM('neck', C[0][1]).addScaledVector(side, 0.075); C[0][2] = 0.115;
    BM('spine', C[1][0]).addScaledVector(side, -0.065); BM('neck', C[1][1]).addScaledVector(side, -0.075); C[1][2] = 0.115;
    BM('hips', C[2][0]).addScaledVector(side, 0.06); BM('upperLeg_L', C[2][1]).lerp(BM('lowerLeg_L', tmp), 0.5); C[2][2] = 0.185;
    BM('hips', C[3][0]).addScaledVector(side, -0.06); BM('upperLeg_R', C[3][1]).lerp(BM('lowerLeg_R', tmp), 0.5); C[3][2] = 0.185;
    BM('lowerLeg_L', C[4][0]); BM('upperLeg_L', C[4][1]); C[4][2] = 0.1;
    BM('lowerLeg_R', C[5][0]); BM('upperLeg_R', C[5][1]); C[5][2] = 0.1;
    BM('lowerLeg_L', C[6][0]); BM('foot_L', C[6][1]); C[6][2] = 0.08;
    BM('lowerLeg_R', C[7][0]); BM('foot_R', C[7][1]); C[7][2] = 0.08;
    let diskOn = null;
    if (!H.swordDrawn) {
      shield.updateWorldMatrix(true, false);
      disk.c.setFromMatrixPosition(shield.matrixWorld);
      disk.n.set(0, 0, 1).transformDirection(shield.matrixWorld);
      diskOn = disk;
    }
    // wind: ambient breeze + air drag from moving
    const tw = ctx.time || 0;
    wind.set(1.5 + Math.sin(tw * 0.3) * 1.2, 0.3, 0.8 + Math.sin(tw * 0.21 + 1) * 0.8);
    if (shotRun) wind.addScaledVector(facing, -shotRun * 9);
    capeBack.right.copy(side); capeBack.dir.set(0, 0, -1).transformDirection(B.chest.matrixWorld);
    if (firstFrame) { cape.reset(B.chest, capeBack); if (shotRun) for (let i = 0; i < 90; i++) cape.update(B.chest, { caps: C, disk: diskOn, ground: pos.y }, wind, 1 / 60, capeBack); }
    const teleported = prevPos.distanceTo(pos) > 3;
    if (teleported) cape.reset(B.chest, capeBack);
    cape.update(B.chest, { caps: C, disk: diskOn, ground: pos.y }, wind, dt, capeBack);
    prevPos.copy(pos);

    // ---------- trail ----------
    bladeWorld(tmp, tmp2);
    const trailOn = !!(action && action.name.startsWith('attack') && action.t > action.active[0] - 0.05 && action.t < action.active[1] + 0.02);
    trail.update(tmp, tmp2, trailOn, dt);
    firstFrame = false;
  }

  let airFall = 0;
  function onLand(fallSpeed) {
    airFall = 0;
    ctx.emit('land', { position: pos.clone(), fallSpeed });
    if (fallSpeed > 6 && (!action || action.name === 'jump')) { startAction('land'); H.state = 'land'; }
    else if (action?.name === 'jump') action = null;
  }
  function startRoll() {
    rollDir.copy(moveDir.lengthSq() > 0.01 ? moveDir : facing).setY(0).normalize();
    if (!H.lockTarget) yaw = Math.atan2(rollDir.x, rollDir.z);
    startAction('roll'); H.state = 'roll';
    ctx.emit('roll', { position: pos.clone() });
  }

  function locomotionWeights(s) {
    const w = {};
    const idleName = H.swordDrawn ? 'combatIdle' : 'idle';
    const kWalk = ss((s - 0.05) / 0.55), kRun = ss((s - 2.2) / 1.6), kSprint = ss((s - 5.8) / 1.4);
    w[idleName] = 1 - kWalk;
    w.walk = kWalk * (1 - kRun);
    w.run = kWalk * kRun * (1 - kSprint);
    w.sprint = kWalk * kRun * kSprint;
    for (const k of Object.keys(w)) if (w[k] < 1e-4) delete w[k];
    return w;
  }

  // ---------- head look-at ----------
  const lookTarget = new THREE.Vector3(), invQ = new THREE.Quaternion();
  function headLook(dt, lockP) {
    let have = false;
    if (lockP) { lookTarget.copy(lockP); have = true; }
    else {
      const e = nearestEnemy(10, -0.2);
      if (e) { lookTarget.copy(e.position || e.root.position); have = true; }
      else if (!shotMode && ctx.camera) {
        ctx.camera.getWorldDirection(camF);
        lookTarget.copy(pos).add(new THREE.Vector3(0, 1.55, 0)).addScaledVector(camF, 10);
        have = true;
      }
    }
    let ty = 0, tp = 0;
    if (have && (!action || action.name.startsWith('attack')) && H.state !== 'dead') {
      tmp.copy(lookTarget);
      B.neck.parent.worldToLocal(tmp);
      tmp.sub(B.neck.position);
      ty = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -1.1, 1.1);
      tp = THREE.MathUtils.clamp(Math.atan2(-tmp.y + 0.1, Math.hypot(tmp.x, tmp.z)), -0.45, 0.35);
      if (Math.abs(Math.atan2(tmp.x, tmp.z)) > 2.2) ty = 0; // behind: don't snap
    }
    lookYP.y = damp(lookYP.y, ty, 6, dt); lookYP.p = damp(lookYP.p, tp, 6, dt);
    qTmp.setFromAxisAngle(Y, lookYP.y * 0.35); B.neck.quaternion.premultiply(qTmp);
    qTmp.setFromAxisAngle(Y, lookYP.y * 0.55); qTmp2.setFromAxisAngle(X, lookYP.p * 0.7); qTmp.multiply(qTmp2);
    B.head.quaternion.premultiply(qTmp);
    void invQ;
  }

  // ---------- two-bone foot IK for slopes ----------
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), t = new THREE.Vector3(), nrm = new THREE.Vector3();
  const hipOff = { v: 0 };
  function rotateBoneWorld(bone, axis, angle) {
    if (Math.abs(angle) < 1e-5 || !isFinite(angle)) return;
    bone.parent.getWorldQuaternion(qTmp);
    qTmp2.setFromAxisAngle(axis, angle);
    // local = inv(P) * delta * P * local
    const inv = qTmp.clone().invert();
    bone.quaternion.premultiply(qTmp).premultiply(qTmp2).premultiply(inv);
    bone.updateMatrixWorld(true);
  }
  function footIK(dt) {
    const offs = {};
    let minOff = 0;
    for (const s of ['L', 'R']) {
      c.setFromMatrixPosition(B['foot_' + s].matrixWorld);
      const g = heightAt(c.x, c.z);
      offs[s] = THREE.MathUtils.clamp(g - pos.y, -0.35, 0.35);
      minOff = Math.min(minOff, offs[s]);
    }
    hipOff.v = damp(hipOff.v, minOff, 12, dt);
    B.hips.position.y += hipOff.v;
    root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) {
      const thigh = B['upperLeg_' + s], shin = B['lowerLeg_' + s], foot = B['foot_' + s];
      a.setFromMatrixPosition(thigh.matrixWorld); b.setFromMatrixPosition(shin.matrixWorld); c.setFromMatrixPosition(foot.matrixWorld);
      // only adjust feet that are close to the ground (stance)
      const lift = c.y - (pos.y + 0.092 + hipOff.v);
      const w = 1 - ss((lift - 0.04) / 0.1);
      const delta = (offs[s] - hipOff.v) * w + 0; // amount the foot must move vertically relative to the lowered hips
      if (Math.abs(delta) < 0.003) continue;
      t.copy(c); t.y += delta;
      twoBone(thigh, shin, a, b, c, t);
      // align foot to ground normal
      layout.normalAt(c.x, c.z, nrm);
      const ang = Math.acos(THREE.MathUtils.clamp(nrm.y, -1, 1)) * w;
      if (ang > 0.01) { tmp.set(nrm.z, 0, -nrm.x).normalize(); rotateBoneWorld(foot, tmp, ang * 0.8); }
    }
  }
  function twoBone(thigh, shin, a, b, c, t) {
    const lab = b.distanceTo(a), lcb = c.distanceTo(b);
    const lat = THREE.MathUtils.clamp(t.distanceTo(a), 0.05, lab + lcb - 0.002);
    const ac = tmp.subVectors(c, a).normalize(), ab = new THREE.Vector3().subVectors(b, a).normalize();
    const ba = new THREE.Vector3().subVectors(a, b).normalize(), bc = new THREE.Vector3().subVectors(c, b).normalize();
    const at = new THREE.Vector3().subVectors(t, a).normalize();
    const acab0 = Math.acos(THREE.MathUtils.clamp(ac.dot(ab), -1, 1));
    const babc0 = Math.acos(THREE.MathUtils.clamp(ba.dot(bc), -1, 1));
    const acat0 = Math.acos(THREE.MathUtils.clamp(ac.dot(at), -1, 1));
    const acab1 = Math.acos(THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
    const babc1 = Math.acos(THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
    const axis0 = new THREE.Vector3().crossVectors(ac, ab);
    if (axis0.lengthSq() < 1e-8) axis0.set(1, 0, 0).transformDirection(root.matrixWorld);
    axis0.normalize();
    const axis1 = new THREE.Vector3().crossVectors(ac, at);
    rotateBoneWorld(thigh, axis0, acab1 - acab0);
    rotateBoneWorld(shin, axis0, babc1 - babc0);
    if (axis1.lengthSq() > 1e-8) rotateBoneWorld(thigh, axis1.normalize(), acat0);
  }

  // first pose
  mixer.update(0);
  return { update };
}
