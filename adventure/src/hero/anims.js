// Procedural animation authoring. Each clip is a pose function f(t) -> {bone: [x,y,z] euler, hips:[dx,dy,dz]}
// baked at 30 fps into AnimationClips, split into a lower-body (hips + legs) and
// upper-body (spine up + arms) clip so the AnimationMixer can layer e.g. a guard
// or slash over running legs. Poses flagged `ground` are auto-planted: hips height
// is solved so the lowest sole point touches y=0. Locomotion clips get their
// stride (metres per cycle) measured from the planted foot so playback can be
// speed-matched with no foot sliding.
import * as THREE from 'three';
import { UPPER } from './rig.js';

const TAU = Math.PI * 2;
const ss = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const env = (t, a, b) => ss((t - a) / (b - a));
const L = (a, b, t) => a + (b - a) * t;
const pos = x => Math.max(0, x);
// keyframe helper for authored actions: keys [[t, value]] smooth-interpolated
function K(keys) {
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t <= t1) { const k = ss((t - t0) / (t1 - t0)); return Array.isArray(v0) ? v0.map((x, j) => L(x, v1[j], k)) : L(v0, v1, k); }
    }
    return keys[keys.length - 1][1];
  };
}
function blendPose(a, b, k) {
  const out = { hips: [0, 0, 0] };
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const n of names) {
    if (n === 'hips' || n === 'ground') continue;
    const x = a[n] || [0, 0, 0], y = b[n] || [0, 0, 0];
    out[n] = [L(x[0], y[0], k), L(x[1], y[1], k), L(x[2], y[2], k)];
  }
  const ha = a.hips || [0, 0, 0], hb = b.hips || [0, 0, 0];
  out.hips = [L(ha[0], hb[0], k), L(ha[1], hb[1], k), L(ha[2], hb[2], k)];
  return out;
}
// keep foot level with ground given chain pitch
const flatFoot = (thigh, knee, hipsX = 0, extra = 0) => -(thigh + knee + hipsX) + extra;

// ---------------- poses ----------------
export function idlePose(t, T = 2.8) {
  const b = Math.sin(t / T * TAU), b2 = Math.sin(t / T * TAU * 2 + 1);
  return {
    hips_r: [0.0, 0.03, 0.015 * b], hips: [0.008 * b, 0, 0],
    spine: [0.02 + 0.008 * b2, -0.02, -0.01 * b], chest: [0.015 * b2, 0.03, 0.008 * b], neck: [-0.02, 0.02, 0], head: [-0.03 + 0.02 * b, -0.08 + 0.05 * Math.sin(t / T * TAU + 2), 0.02 * b],
    clavicle_L: [0, 0, -0.03 * b2], clavicle_R: [0, 0, 0.03 * b2],
    upperArm_L: [0.06, 0, 0.12 + 0.01 * b2], lowerArm_L: [-0.28, 0.2, 0], hand_L: [0.1, 0, -0.1],
    upperArm_R: [0.04, 0, -0.12 - 0.01 * b2], lowerArm_R: [-0.3, -0.2, 0], hand_R: [0.1, 0, 0.1],
    upperLeg_L: [-0.06, -0.12, 0.05], lowerLeg_L: [0.1, 0, 0], foot_L: [-0.04, 0.12, -0.05],
    upperLeg_R: [0.05, 0.05, -0.02], lowerLeg_R: [0.06, 0, 0], foot_R: [-0.11, -0.05, 0.02],
    ground: true,
  };
}

// sword-drawn ready stance
export function combatIdlePose(t, T = 1.6) {
  const b = Math.sin(t / T * TAU);
  const tl = -0.42, kl = 0.55, tr = 0.32, kr = 0.42;
  return {
    hips_r: [0.06, -0.35, 0], hips: [0, 0, 0.0],
    spine: [0.08 + 0.01 * b, 0.12, 0], chest: [0.04 + 0.015 * b, 0.12, 0], neck: [0, 0.05, 0], head: [-0.08, 0.06, 0],
    clavicle_L: [0, 0, 0], clavicle_R: [0, 0, 0],
    upperArm_L: [-0.55, -0.2, 0.25], lowerArm_L: [-1.25, -0.3, 0], hand_L: [0, 0, 0],
    upperArm_R: [-0.4, 0.2, -0.3], lowerArm_R: [-0.95, -0.35, 0], hand_R: [1.05, 0.0, 0.15],
    upperLeg_L: [tl, 0.25, 0.1], lowerLeg_L: [kl + 0.02 * b, 0, 0], foot_L: [flatFoot(tl, kl, 0.06), 0, -0.1],
    upperLeg_R: [tr, 0.45, -0.12], lowerLeg_R: [kr + 0.02 * b, 0, 0], foot_R: [flatFoot(tr, kr, 0.06), 0, 0.12],
    ground: true,
  };
}

export function guardUpper() {
  return {
    spine: [0.12, 0.25, 0], chest: [0.08, 0.15, 0], neck: [0, -0.15, 0], head: [-0.05, -0.2, 0],
    upperArm_L: [-1.05, -0.55, 0.15], lowerArm_L: [-1.35, -0.0, 0.0], hand_L: [0, 0, 0],
    upperArm_R: [-0.25, 0.1, -0.45], lowerArm_R: [-1.1, -0.2, 0], hand_R: [0.6, 0, 0],
  };
}

function locomotion(p, A) {
  const ph = p * TAU, s = Math.sin(ph), c = Math.cos(ph);
  const tL = -A.thigh * s - A.bias, tR = A.thigh * s - A.bias;
  const kneeOf = (phase) => A.knee0 + A.knee * Math.pow(pos(Math.cos(phase + A.kneeLag)), A.kneeSharp) + A.strike * Math.pow(pos(Math.cos(phase - 1.9)), 6);
  const kL = kneeOf(ph), kR = kneeOf(ph + Math.PI);
  const hipsX = A.lean;
  const footOf = (th, kn, phase) => flatFoot(th, kn, hipsX) + A.push * Math.pow(pos(Math.cos(phase + 2.2)), 4) - A.toeUp * Math.pow(pos(Math.cos(phase - 0.5)), 3);
  const arm = A.arm, armBias = A.armBias;
  return {
    hips_r: [hipsX, -A.hipYaw * s, A.hipRoll * c], hips: [-A.sway * c, A.bounce * (-Math.cos(2 * ph)) , 0],
    spine: [A.spineLean, A.hipYaw * 0.5 * s, 0], chest: [0.02 + A.breath * Math.sin(ph * 2), A.hipYaw * 1.0 * s, -A.hipRoll * 0.5 * c], neck: [-A.lean * 0.4, 0, 0],
    head: [-A.spineLean * 0.6 - A.lean * 0.5, -A.hipYaw * 0.4 * s, -A.hipRoll * 0.4 * c],
    clavicle_L: [0, A.clav * s, 0], clavicle_R: [0, A.clav * s, 0],
    upperArm_L: [arm * s + armBias, 0, 0.1 + A.armOut], lowerArm_L: [-A.elbow - A.elbowSwing * pos(-s), 0.2, 0], hand_L: [0.1, 0, -0.05],
    upperArm_R: [-arm * s + armBias, 0, -0.1 - A.armOut], lowerArm_R: [-A.elbow - A.elbowSwing * pos(s), -0.2, 0], hand_R: [0.1, 0, 0.05],
    upperLeg_L: [tL, 0, 0.02], lowerLeg_L: [kL, 0, 0], foot_L: [footOf(tL, kL, ph), 0, 0],
    upperLeg_R: [tR, 0, -0.02], lowerLeg_R: [kR, 0, 0], foot_R: [footOf(tR, kR, ph + Math.PI), 0, 0],
    ground: true, airLift: A.air ? A.air * pos(-Math.cos(2 * ph + A.airPh)) : 0,
  };
}
const WALK = { thigh: 0.36, bias: 0.04, knee0: 0.06, knee: 0.95, kneeLag: 0.45, kneeSharp: 1.8, strike: 0.12, push: 0.35, toeUp: 0.25, lean: 0.03, hipYaw: 0.09, hipRoll: 0.035, sway: 0.016, bounce: 0.0, spineLean: 0.03, breath: 0.0, clav: 0.03, arm: 0.28, armBias: 0.02, armOut: 0.0, elbow: 0.25, elbowSwing: 0.25 };
const RUN = { thigh: 0.62, bias: 0.16, knee0: 0.28, knee: 1.75, kneeLag: 0.55, kneeSharp: 1.3, strike: 0.1, push: 0.5, toeUp: 0.25, lean: 0.12, hipYaw: 0.14, hipRoll: 0.05, sway: 0.01, bounce: 0.0, spineLean: 0.1, breath: 0.02, clav: 0.08, arm: 0.62, armBias: -0.05, armOut: 0.04, elbow: 1.2, elbowSwing: 0.25, air: 0.05, airPh: 0 };
const SPRINT = { ...RUN, thigh: 0.78, bias: 0.22, knee: 2.0, lean: 0.2, spineLean: 0.14, arm: 0.85, elbow: 1.35, hipYaw: 0.16, air: 0.08 };

function jumpPose(t) { // 0..0.3 takeoff
  const crouch = K([[0, 0], [0.08, 1], [0.2, -0.3], [0.3, -0.1]])(t);
  const th = -0.6 * crouch - 0.2 * pos(-crouch) * 0, kn = 1.1 * pos(crouch);
  return {
    hips_r: [0.25 * pos(crouch) + 0.05, 0, 0], hips: [0, -0.22 * pos(crouch), 0],
    spine: [0.15 * crouch, 0, 0], chest: [0.05, 0, 0], head: [-0.15 * crouch - 0.1, 0, 0],
    upperArm_L: [L(0.4, -1.6, pos(-crouch) * 3), 0, 0.35], lowerArm_L: [-0.5, 0, 0],
    upperArm_R: [L(0.4, -1.4, pos(-crouch) * 3), 0, -0.35], lowerArm_R: [-0.5, 0, 0],
    upperLeg_L: [th - 0.25 * pos(-crouch) * 2, 0, 0.05], lowerLeg_L: [kn + 0.4 * pos(-crouch), 0, 0], foot_L: [flatFoot(th, kn, 0.2) + 0.5 * pos(-crouch), 0, 0],
    upperLeg_R: [th + 0.1, 0, -0.05], lowerLeg_R: [kn + 0.2, 0, 0], foot_R: [flatFoot(th, kn, 0.2) + 0.5 * pos(-crouch), 0, 0],
  };
}
function fallPose(t, T = 0.9) {
  const s = Math.sin(t / T * TAU);
  return {
    hips_r: [0.05, 0, 0.03 * s], hips: [0, 0, 0],
    spine: [0.05, 0, 0], chest: [-0.05, 0, 0.03 * s], head: [0.1, 0, 0],
    upperArm_L: [-0.5 + 0.15 * s, 0, 0.9 + 0.1 * s], lowerArm_L: [-0.6, 0, 0], hand_L: [0, 0, 0.3],
    upperArm_R: [-0.5 - 0.15 * s, 0, -0.9 - 0.1 * s], lowerArm_R: [-0.6, 0, 0], hand_R: [0, 0, -0.3],
    upperLeg_L: [-0.6 + 0.15 * s, 0, 0.08], lowerLeg_L: [0.9 - 0.15 * s, 0, 0], foot_L: [0.3, 0, 0],
    upperLeg_R: [-0.1 - 0.15 * s, 0, -0.08], lowerLeg_R: [0.6 + 0.15 * s, 0, 0], foot_R: [0.4, 0, 0],
  };
}
function landPose(t) {
  const k = K([[0, 0.3], [0.07, 1], [0.35, 0]])(t);
  const th = -0.75 * k, kn = 1.5 * k;
  return {
    hips_r: [0.35 * k, 0, 0], hips: [0, 0, 0],
    spine: [0.25 * k, 0, 0], chest: [0.1 * k, 0, 0], head: [-0.3 * k, 0, 0],
    upperArm_L: [-0.3 * k, 0, 0.12 + 0.4 * k], lowerArm_L: [-0.3 - 0.5 * k, 0.2, 0],
    upperArm_R: [-0.3 * k, 0, -0.12 - 0.4 * k], lowerArm_R: [-0.3 - 0.5 * k, -0.2, 0],
    upperLeg_L: [th, -0.1, 0.06 * k], lowerLeg_L: [kn, 0, 0], foot_L: [flatFoot(th, kn, 0.35 * k), 0.1, 0],
    upperLeg_R: [th + 0.1, 0.1, -0.06 * k], lowerLeg_R: [kn, 0, 0], foot_R: [flatFoot(th + 0.1, kn, 0.35 * k), -0.1, 0],
    ground: true,
  };
}
function hurtPose(t) {
  const k = K([[0, 0], [0.06, 1], [0.2, 0.7], [0.5, 0]])(t);
  const base = combatIdlePose(0);
  const hit = {
    ...base,
    hips_r: [-0.15, -0.35, 0.05], spine: [-0.3, 0.15, 0.1], chest: [-0.25, 0.1, 0.05], head: [-0.4, 0.2, 0.15],
    upperArm_L: [-0.9, -0.2, 0.7], lowerArm_L: [-0.9, 0, 0], upperArm_R: [-0.6, 0, -0.9], lowerArm_R: [-0.6, 0, 0],
  };
  const p = blendPose(base, hit, k); p.ground = true; p.hips_r = blendPose({ x: base.hips_r }, { x: hit.hips_r }, k).x;
  for (const n of ['upperLeg_L', 'lowerLeg_L', 'foot_L', 'upperLeg_R', 'lowerLeg_R', 'foot_R']) p[n] = base[n];
  return p;
}
function rollPose(t, T = 0.62) {
  const u = t / T;
  const spin = TAU * ss((u - 0.06) / 0.78);
  const tuck = Math.sin(Math.PI * Math.min(1, u * 1.15)) ;
  const th = -2.0 * tuck, kn = 2.3 * tuck;
  return {
    hips_r: [spin, 0, 0], hips: [0, -0.36 * Math.sin(Math.PI * ss(u * 1.05)), 0.1 * Math.sin(Math.PI * u)],
    spine: [0.55 * tuck, 0, 0], chest: [0.35 * tuck, 0, 0], neck: [0.3 * tuck, 0, 0], head: [0.45 * tuck, 0, 0],
    upperArm_L: [-0.9 * tuck, -0.3 * tuck, 0.2], lowerArm_L: [-1.4 * tuck, 0, 0],
    upperArm_R: [-0.9 * tuck, 0.3 * tuck, -0.2], lowerArm_R: [-1.4 * tuck, 0, 0],
    upperLeg_L: [th, 0, 0.1 * tuck], lowerLeg_L: [kn, 0, 0], foot_L: [0.4 * tuck, 0, 0],
    upperLeg_R: [th + 0.15 * tuck, 0, -0.1 * tuck], lowerLeg_R: [kn, 0, 0], foot_R: [0.4 * tuck, 0, 0],
  };
}

// 3-hit combo. Each returns pose for t in seconds.
function attackPose(kind) {
  const ci = combatIdlePose(0);
  const legsLunge = (k, side = 1) => {
    const tl = -0.42 - 0.35 * k, kl = 0.55 + 0.25 * k, tr = 0.32 + 0.25 * k, kr = 0.42;
    return {
      upperLeg_L: [tl, 0.25 * side, 0.1], lowerLeg_L: [kl, 0, 0], foot_L: [flatFoot(tl, kl, 0.06 + 0.1 * k), 0, -0.1],
      upperLeg_R: [tr, 0.45, -0.12], lowerLeg_R: [kr, 0, 0], foot_R: [flatFoot(tr, kr, 0.06 + 0.1 * k), 0, 0.12],
    };
  };
  if (kind === 1) { // horizontal right->left slash
    const D = 0.5;
    const ua = K([[0, ci.upperArm_R], [0.11, [-1.25, -1.35, -0.2]], [0.17, [-1.45, -0.6, -0.1]], [0.26, [-1.35, 0.95, 0.0]], [D, ci.upperArm_R]]);
    const la = K([[0, ci.lowerArm_R], [0.11, [-1.3, -0.4, 0]], [0.17, [-0.6, -0.6, 0]], [0.26, [-0.15, -1.0, 0]], [D, ci.lowerArm_R]]);
    const hd = K([[0, ci.hand_R], [0.11, [1.2, 0.0, -0.4]], [0.26, [1.35, 0.0, 0.25]], [D, ci.hand_R]]);
    const tw = K([[0, 0], [0.11, -0.65], [0.17, -0.2], [0.26, 0.6], [D, 0]]);
    const lu = K([[0, 0], [0.12, 0.2], [0.26, 1], [D, 0]]);
    return { dur: D, active: [0.14, 0.27], f: t => ({ ...ci, ...legsLunge(lu(t)), hips_r: [0.08 + 0.1 * lu(t), -0.35 + tw(t) * 0.45, 0], spine: [0.1, 0.12 + tw(t) * 0.45, 0], chest: [0.06, 0.12 + tw(t) * 0.6, -0.1 * tw(t)], head: [-0.08, 0.06 - tw(t) * 0.9, 0], upperArm_R: ua(t), lowerArm_R: la(t), hand_R: hd(t), upperArm_L: [-0.7, -0.2 - tw(t) * 0.3, 0.45], ground: true }) };
  }
  if (kind === 2) { // backhand left->right rising
    const D = 0.5;
    const ua = K([[0, ci.upperArm_R], [0.11, [-1.0, 1.05, 0.0]], [0.16, [-1.1, 0.5, 0]], [0.26, [-1.75, -1.25, -0.2]], [D, ci.upperArm_R]]);
    const la = K([[0, ci.lowerArm_R], [0.11, [-1.7, 0.2, 0]], [0.16, [-1.0, -0.3, 0]], [0.26, [-0.15, -0.6, 0]], [D, ci.lowerArm_R]]);
    const hd = K([[0, ci.hand_R], [0.11, [1.3, 0, 0.6]], [0.26, [1.1, 0, -0.2]], [D, ci.hand_R]]);
    const tw = K([[0, 0], [0.11, 0.65], [0.16, 0.3], [0.26, -0.7], [D, 0]]);
    const lu = K([[0, 0], [0.12, 0.3], [0.26, 1], [D, 0]]);
    return { dur: D, active: [0.13, 0.27], f: t => ({ ...ci, ...legsLunge(lu(t)), hips_r: [0.08, -0.35 + tw(t) * 0.45, 0], spine: [0.1, 0.12 + tw(t) * 0.45, 0], chest: [0.02, 0.12 + tw(t) * 0.6, 0.12 * tw(t)], head: [-0.06, 0.06 - tw(t) * 0.9, 0], upperArm_R: ua(t), lowerArm_R: la(t), hand_R: hd(t), upperArm_L: [-0.6, -0.4 - tw(t) * 0.3, 0.6], ground: true }) };
  }
  // 3: leaping overhead finisher
  const D = 0.78;
  const ua = K([[0, ci.upperArm_R], [0.2, [-2.75, 0.2, -0.15]], [0.3, [-2.2, 0.15, -0.1]], [0.38, [-0.75, 0.15, -0.1]], [0.55, [-0.65, 0.15, -0.1]], [D, ci.upperArm_R]]);
  const la = K([[0, ci.lowerArm_R], [0.2, [-1.6, 0, 0]], [0.3, [-0.7, 0, 0]], [0.38, [-0.1, 0, 0]], [D, ci.lowerArm_R]]);
  const hd = K([[0, ci.hand_R], [0.2, [1.3, 0, 0]], [0.38, [0.9, 0, 0]], [D, ci.hand_R]]);
  const bend = K([[0, 0], [0.2, -0.35], [0.3, -0.1], [0.38, 0.55], [0.55, 0.5], [D, 0]]);
  const lu = K([[0, 0], [0.2, 0.3], [0.38, 1.2], [0.55, 1.1], [D, 0]]);
  return { dur: D, active: [0.3, 0.42], f: t => ({ ...ci, ...legsLunge(lu(t)), hips_r: [0.06 + bend(t) * 0.4, -0.15, 0], spine: [0.08 + bend(t) * 0.5, 0.02, 0], chest: [0.04 + bend(t) * 0.35, 0.0, 0], head: [-bend(t) * 0.6, 0, 0], upperArm_R: ua(t), lowerArm_R: la(t), hand_R: hd(t), upperArm_L: K([[0, ci.upperArm_L], [0.2, [-2.4, -0.3, 0.1]], [0.38, [-0.4, 0, 0.7]], [D, ci.upperArm_L]])(t), lowerArm_L: K([[0, ci.lowerArm_L], [0.2, [-1.4, 0, 0]], [0.38, [-0.5, 0, 0]], [D, ci.lowerArm_L]])(t), ground: true }) };
}

function drawPose(t, D = 0.42) { // upper body: reach over left shoulder, pull out to ready
  const ci = combatIdlePose(0), id = idlePose(0);
  const ua = K([[0, id.upperArm_R], [0.16, [-2.5, 0.75, -0.1]], [0.26, [-1.6, 0.2, -0.4]], [D, ci.upperArm_R]]);
  const la = K([[0, id.lowerArm_R], [0.16, [-1.9, -0.4, 0]], [0.26, [-0.6, -0.4, 0]], [D, ci.lowerArm_R]]);
  const hd = K([[0, id.hand_R], [0.16, [0.2, 0, 0]], [D, ci.hand_R]]);
  const tw = K([[0, 0], [0.16, 0.35], [0.3, -0.15], [D, 0]]);
  return { ...ci, upperArm_R: ua(t), lowerArm_R: la(t), hand_R: hd(t), chest: [0.04, tw(t) + 0.12, 0], head: [-0.1, -0.2 * tw(t), 0], upperArm_L: K([[0, id.upperArm_L], [D, ci.upperArm_L]])(t), lowerArm_L: K([[0, id.lowerArm_L], [D, ci.lowerArm_L]])(t) };
}
function sheathePose(t, D = 0.5) {
  const p = drawPose((1 - t / D) * 0.42);
  const id = idlePose(0), k = ss((t / D - 0.6) / 0.4);
  return blendPose(p, id, k);
}

// ---------------- baking ----------------
export const FPS = 30;
const heelOff = new THREE.Vector3(0, -0.075, -0.06), toeOff = new THREE.Vector3(0, -0.07, 0.14), tmp = new THREE.Vector3();

function applyPose(rig, p) {
  const { byName, info } = rig;
  for (const n of Object.keys(byName)) {
    if (n === 'root') continue;
    const r = n === 'hips' ? p.hips_r : p[n];
    const b = byName[n];
    if (r) b.rotation.set(r[0], r[1], r[2]); else b.rotation.set(0, 0, 0);
  }
  const h = p.hips || [0, 0, 0];
  byName.hips.position.set(info.hips.head.x + h[0], info.hips.head.y + h[1], info.hips.head.z + h[2]);
  rig.root.updateMatrixWorld(true);
}
function soleMin(rig) {
  let m = Infinity;
  for (const s of ['L', 'R']) {
    const f = rig.byName['foot_' + s];
    for (const o of [heelOff, toeOff]) { tmp.copy(o).applyMatrix4(f.matrixWorld); m = Math.min(m, tmp.y); }
  }
  return m;
}
function footInfo(rig, side) {
  const f = rig.byName['foot_' + side];
  tmp.copy(heelOff).add(toeOff).multiplyScalar(0.5).applyMatrix4(f.matrixWorld);
  return tmp.clone();
}

function bake(rig, name, f, dur, { loop = true } = {}) {
  const n = Math.max(2, Math.round(dur * FPS) + 1);
  const times = [], tracksLo = {}, tracksUp = {}, hipsPos = [];
  const q = new THREE.Quaternion();
  const names = Object.keys(rig.byName).filter(x => x !== 'root');
  for (const b of names) (UPPER.has(b) ? tracksUp : tracksLo)[b] = [];
  const feet = [];
  for (let i = 0; i < n; i++) {
    const t = loop ? (i / (n - 1)) * dur : Math.min(dur, i / FPS);
    times.push(t);
    const p = f(loop ? t % dur : t);
    applyPose(rig, p);
    if (p.ground) {
      const m = soleMin(rig);
      rig.byName.hips.position.y -= m - (p.airLift || 0);
      rig.root.updateMatrixWorld(true);
    }
    for (const b of names) { q.copy(rig.byName[b].quaternion); (UPPER.has(b) ? tracksUp : tracksLo)[b].push(q.x, q.y, q.z, q.w); }
    const hp = rig.byName.hips.position; hipsPos.push(hp.x, hp.y, hp.z);
    feet.push({ L: footInfo(rig, 'L'), R: footInfo(rig, 'R') });
  }
  // fix quaternion sign continuity
  for (const tr of [tracksLo, tracksUp]) for (const b of Object.keys(tr)) {
    const a = tr[b];
    for (let i = 4; i < a.length; i += 4) {
      const d = a[i] * a[i - 4] + a[i + 1] * a[i - 3] + a[i + 2] * a[i - 2] + a[i + 3] * a[i - 1];
      if (d < 0) for (let k = 0; k < 4; k++) a[i + k] = -a[i + k];
    }
  }
  const mk = (tr, extra) => {
    const tracks = Object.keys(tr).map(b => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, tr[b]));
    if (extra) tracks.push(extra);
    return new THREE.AnimationClip(name, dur, tracks);
  };
  const lo = mk(tracksLo, new THREE.VectorKeyframeTrack('hips.position', times, hipsPos));
  const up = mk(tracksUp);
  lo.name = name + '_lo'; up.name = name + '_up';
  // stride: distance travelled by the planted (lower) foot backwards per cycle
  let stride = 0;
  for (let i = 1; i < feet.length; i++) {
    const a = feet[i - 1], b = feet[i];
    const s = a.L.y < a.R.y ? 'L' : 'R';
    stride += Math.max(0, a[s].z - b[s].z);
  }
  return { lo, up, dur, stride, loop };
}

export function buildClips(rig) {
  const C = {};
  C.idle = bake(rig, 'idle', t => idlePose(t), 2.8);
  C.combatIdle = bake(rig, 'combatIdle', t => combatIdlePose(t), 1.6);
  C.walk = bake(rig, 'walk', t => locomotion(t / 1.05, WALK), 1.05);
  C.run = bake(rig, 'run', t => locomotion(t / 0.68, RUN), 0.68);
  C.sprint = bake(rig, 'sprint', t => locomotion(t / 0.6, SPRINT), 0.6);
  C.jump = bake(rig, 'jump', jumpPose, 0.3, { loop: false });
  C.fall = bake(rig, 'fall', t => fallPose(t), 0.9);
  C.land = bake(rig, 'land', landPose, 0.35, { loop: false });
  C.hurt = bake(rig, 'hurt', hurtPose, 0.5, { loop: false });
  C.roll = bake(rig, 'roll', t => rollPose(t), 0.62, { loop: false });
  C.guard = bake(rig, 'guard', () => ({ ...combatIdlePose(0), ...guardUpper(), ground: true }), 1, {});
  C.draw = bake(rig, 'draw', t => ({ ...drawPose(t), ground: true }), 0.42, { loop: false });
  C.sheathe = bake(rig, 'sheathe', t => ({ ...sheathePose(t), ground: true }), 0.5, { loop: false });
  for (const k of [1, 2, 3]) {
    const a = attackPose(k);
    C['attack' + k] = bake(rig, 'attack' + k, a.f, a.dur, { loop: false });
    C['attack' + k].active = a.active;
  }
  // reset rig to bind
  applyPose(rig, { hips: [0, 0, 0] });
  return C;
}
export const POSES = { idlePose, combatIdlePose, guardUpper, locomotion, WALK, RUN, SPRINT, applyPose };
