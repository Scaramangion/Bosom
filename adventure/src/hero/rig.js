// Koto's skeleton. Bind pose = identity rotations, model faces +Z, character's
// LEFT is +X. Positions are world-space bind heads (metres, feet at y=0, 1.7 m tall).
import * as THREE from 'three';

export const BONES = [
  // name, parent, head [x,y,z], tail [x,y,z]
  ['root', null, [0, 0, 0], [0, 0.1, 0]],
  ['hips', 'root', [0, 0.95, 0], [0, 1.05, 0]],
  ['spine', 'hips', [0, 1.05, 0], [0, 1.21, 0]],
  ['chest', 'spine', [0, 1.21, 0], [0, 1.42, -0.005]],
  ['neck', 'chest', [0, 1.42, -0.005], [0, 1.49, 0]],
  ['head', 'neck', [0, 1.49, 0], [0, 1.70, 0.0]],
  ['clavicle_L', 'chest', [0.035, 1.38, 0], [0.17, 1.38, -0.01]],
  ['upperArm_L', 'clavicle_L', [0.17, 1.375, -0.01], [0.205, 1.10, -0.02]],
  ['lowerArm_L', 'upperArm_L', [0.205, 1.10, -0.02], [0.228, 0.855, 0.0]],
  ['hand_L', 'lowerArm_L', [0.228, 0.855, 0.0], [0.236, 0.77, 0.01]],
  ['clavicle_R', 'chest', [-0.035, 1.38, 0], [-0.17, 1.38, -0.01]],
  ['upperArm_R', 'clavicle_R', [-0.17, 1.375, -0.01], [-0.205, 1.10, -0.02]],
  ['lowerArm_R', 'upperArm_R', [-0.205, 1.10, -0.02], [-0.228, 0.855, 0.0]],
  ['hand_R', 'lowerArm_R', [-0.228, 0.855, 0.0], [-0.236, 0.77, 0.01]],
  ['upperLeg_L', 'hips', [0.095, 0.905, 0], [0.10, 0.50, 0.012]],
  ['lowerLeg_L', 'upperLeg_L', [0.10, 0.50, 0.012], [0.105, 0.092, -0.012]],
  ['foot_L', 'lowerLeg_L', [0.105, 0.092, -0.012], [0.108, 0.025, 0.13]],
  ['upperLeg_R', 'hips', [-0.095, 0.905, 0], [-0.10, 0.50, 0.012]],
  ['lowerLeg_R', 'upperLeg_R', [-0.10, 0.50, 0.012], [-0.105, 0.092, -0.012]],
  ['foot_R', 'lowerLeg_R', [-0.105, 0.092, -0.012], [-0.108, 0.025, 0.13]],
];

export const UPPER = new Set(['spine', 'chest', 'neck', 'head', 'clavicle_L', 'upperArm_L', 'lowerArm_L', 'hand_L', 'clavicle_R', 'upperArm_R', 'lowerArm_R', 'hand_R']);
export const ARM_BONES = new Set(['clavicle_L', 'upperArm_L', 'lowerArm_L', 'hand_L', 'clavicle_R', 'upperArm_R', 'lowerArm_R', 'hand_R']);

export function buildSkeleton() {
  const bones = [], byName = {}, info = {};
  BONES.forEach(([name, parent, head, tail], i) => {
    const b = new THREE.Bone(); b.name = name;
    const ph = parent ? BONES.find(x => x[0] === parent)[2] : [0, 0, 0];
    b.position.set(head[0] - ph[0], head[1] - ph[1], head[2] - ph[2]);
    // arms use YXZ so raise (X) happens before swing (Y) - intuitive for slashes
    if (name.startsWith('upperArm') || name.includes('clavicle')) b.rotation.order = 'YXZ';
    if (name.startsWith('lowerArm')) b.rotation.order = 'XZY'; // twist (Y) innermost, elbow (X) last
    if (parent) byName[parent].add(b);
    bones.push(b); byName[name] = b;
    info[name] = { index: i, head: new THREE.Vector3(...head), tail: new THREE.Vector3(...tail) };
  });
  bones[0].updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  return { bones, byName, info, skeleton, root: bones[0] };
}

// segments for skinning a part: names with optional bias
export function segs(info, list) {
  return list.map(e => {
    const [n, bias] = Array.isArray(e) ? e : [e, 1];
    const I = info[n];
    return { index: I.index, a: I.head, b: I.tail, bias };
  });
}
