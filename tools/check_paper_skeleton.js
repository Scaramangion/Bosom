// Green/red check for paperSkeleton (24-papercraft.js), the rig as a proportional skeleton: on Koto (from his sheet), an original T-pose figure
// and townsfolk from the game's atlases, every skeleton must have its 15 joints with their prime IDs, a parent tree rooted at the torso, the
// torso as the unit (hips at 0,0, neck at 0,1), sane bone ratios, valid evidence states (joints placed by hand become USER_CONFIRMED), six
// left/right pairs, and limits on every moving joint. And the point of it: the same character twice the size gives the same proportions.
// Run from the repo root: node tools/check_paper_skeleton.js
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const src = fs.readFileSync('src/js/game/24-papercraft.js', 'utf8'), lib = new Function(src.slice(src.indexOf('        // ---- a rig for a standing figure'), src.indexOf('        // ---- the GPU half')) + '; return { paperRig, paperSkeleton, PAPER_SKELETON };')();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skel-')); let n = 0;
const load = (file, crop, scale = 1, key = false) => { const out = path.join(tmp, 'p' + n++); const wh = execFileSync('python3', ['-c', `
from PIL import Image
import numpy as np
im = Image.open(${JSON.stringify(file)}).convert('RGBA')
import json; crop = json.loads(${JSON.stringify(JSON.stringify(crop || null))})
if crop: im = im.crop((crop[0], crop[1], crop[0] + crop[2], crop[1] + crop[3]))
a = np.array(im).astype(int)
if ${key ? 'True' : 'False'}: c = a[1, 1, :3]; a[np.abs(a[..., :3] - c).sum(-1) < 40, 3] = 0   # a plain backdrop keyed out
im = Image.fromarray(a.astype(np.uint8))
if ${scale} != 1: im = im.resize((im.width * ${scale}, im.height * ${scale}), Image.NEAREST)
open(${JSON.stringify(out)}, 'wb').write(im.tobytes()); print(im.width, im.height)`]).toString().trim().split(' ').map(Number); return { px: fs.readFileSync(out), w: wh[0], h: wh[1] }; };
const db = JSON.parse(fs.readFileSync('assets/papercraft/sprite-polys.json', 'utf8')), atlas = k => { const at = k.split('/')[0]; return [db.atlases[at].file, db.sprites[k].rect]; };
const CASES = [['Koto', 'tools/fixtures/koto-front.png', null, true], ['T-pose', 'tools/fixtures/tpose.png', null, false], ['farmer', ...atlas('farm/f_farmer'), false], ['elder', ...atlas('farm/f_elder'), false], ['Sudashorn', ...atlas('sud/stand'), false]];
let bad = 0; const red = (...m) => { bad++; console.log('RED', ...m); }, S = lib.PAPER_SKELETON;
const skel = (c, scale, joints) => { const I = load(c[1], c[2], scale, c[3]); const rig = lib.paperRig(I.px, I.w, [0, 0, I.w, I.h], { joints }); return { rig, sk: lib.paperSkeleton(rig, { joints }) }; };
for (const c of CASES) { const { rig, sk } = skel(c, 1), J = sk.joints, id = Object.fromEntries(J.map(j => [j.name, j]));
  if (J.length !== 15 || new Set(J.map(j => j.id)).size !== 15) red(c[0], 'joints', J.length);
  for (const j of J) { if (![2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47].includes(j.id)) red(c[0], j.name, 'id', j.id); if (!(j.evidence in S.CONFIDENCE)) red(c[0], j.name, 'evidence', j.evidence);
    let k = j, hops = 0; while (k.parent && hops < 20) { k = J.find(q => q.id === k.parent); hops++; if (!k) { red(c[0], j.name, 'parent missing'); break; } } if (k && k.name !== 'TORSO') red(c[0], j.name, 'not rooted at the torso');
    if (/^(HEAD|SHOULDER|ELBOW|HIP|KNEE)/.test(j.name) && j.name !== 'HEAD_TOP' && !j.limits) red(c[0], j.name, 'no limits'); }
  if (Math.hypot(...id.TORSO.pos) > 1e-6 || Math.abs(id.HEAD.pos[1] - 1) > 1e-3 || Math.abs(id.HEAD.pos[0]) > 1e-3) red(c[0], 'torso is not the unit', id.TORSO.pos, id.HEAD.pos);
  for (const bn of sk.bones) if (!(bn.ratio > 0.05 && bn.ratio < 2.5)) red(c[0], bn.name, 'ratio', bn.ratio);
  if (sk.symmetry.length !== 6) red(c[0], 'pairs', sk.symmetry.length);
  if (rig.humanoid && !(id.SHOULDER_L.px[0] > id.SHOULDER_R.px[0])) red(c[0], 'the character\'s left should be on the picture\'s right');
  // the same character twice the size: the same proportions
  const { sk: big } = skel(c, 2), keys = ['head', 'upperArm', 'forearm', 'upperLeg', 'lowerLeg', 'shoulders', 'hips'], drift = Math.max(...keys.map(k => Math.abs(big.profile[k] - sk.profile[k]))), allow = Math.max(0.03, 3 / sk.torsoPx); // in torso units: a pixel or three of the small picture is all it may move
  const ev = {}; for (const j of J) ev[j.evidence] = (ev[j.evidence] || 0) + 1;
  console.log(`${c[0].padEnd(9)} ${rig.humanoid ? 'humanoid' : 'one piece'} torso ${sk.torsoPx}px | head ${sk.profile.head} arm ${sk.profile.upperArm}+${sk.profile.forearm} leg ${sk.profile.upperLeg}+${sk.profile.lowerLeg} | x2: moved ${drift.toFixed(3)} (allowed ${allow.toFixed(3)}) | ${JSON.stringify(ev)}`);
  if (drift > allow) red(c[0], 'proportions change with size by', drift.toFixed(3), 'torso heights');
  if (rig.humanoid) { // a knee placed by hand: USER_CONFIRMED, and the profile follows it
    const knee = rig.parts.find(q => q.name === 'shinL').pivot, moved = { shinL: [knee[0], knee[1] - 6] }, { sk: hand } = skel(c, 1, moved), kj = hand.joints.find(j => j.name === 'KNEE_R');
    if (kj.evidence !== 'USER_CONFIRMED' || kj.confidence !== 1) red(c[0], 'a knee placed by hand is', kj.evidence); } }
fs.rmSync(tmp, { recursive: true, force: true }); console.log(bad ? 'RED' : 'GREEN', CASES.length, 'characters measured into proportional skeletons,', bad, 'problems'); process.exit(bad ? 1 : 0);
