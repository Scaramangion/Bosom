// Screenshot mode for the critic: ?shot=<name> freezes gameplay input and places
// the hero + camera at a canned viewpoint. Systems may read ctx.shot.
export const SHOTS = {
  // name: hero position/yaw, camera override (null = gameplay follow camera), time of day 0..1
  hero:    { hero: [0, 0, 0], yaw: 2.6, cam: null, tod: 0.42 },
  field:   { hero: [0, 0, 0], yaw: 0.6, cam: { pos: [-6, 4, 12], look: [30, 8, -80] }, tod: 0.40 },
  village: { hero: [40, 0, 30], yaw: 0, cam: { pos: [28, 9, 58], look: [55, 4, 0] }, tod: 0.36 },
  water:   { hero: [-40, 0, -30], yaw: 1, cam: { pos: [-20, 6, -10], look: [-70, 0, -70] }, tod: 0.30 },
  sunset:  { hero: [0, 0, 0], yaw: 3.6, cam: { pos: [8, 5, 10], look: [-60, 10, -80] }, tod: 0.72 },
  combat:  { hero: [10, 0, -10], yaw: 0, cam: null, tod: 0.45, enemiesNear: true },
  // matches the user's Twilight Princess field reference: behind the hero on a dirt path, landmark ahead
  trail:   { hero: [8, 0, -40], yaw: 3.04, cam: { pos: [9, 2.6, -33.5], look: [18, 8, -140] }, tod: 0.42 },
  forest:  { hero: [-60, 0, 50], yaw: 2, cam: { pos: [-55, 3, 62], look: [-80, 6, 20] }, tod: 0.4 },
};
export function applyShotMode(ctx) {
  const name = ctx.params.get('shot');
  if (!name || !SHOTS[name]) return;
  const s = SHOTS[name];
  ctx.shot = { name, ...s };
  ctx.emit('shot', ctx.shot);
}
