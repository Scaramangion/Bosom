// Time of day, sun/moon key light with camera-tracking high-res shadows,
// sky/ground fill and atmospheric fog. Owned by the atmosphere builder.
//
// ctx.tod        0..1  (0.25 sunrise, 0.5 noon, 0.75 sunset). Driven by ctx.shot.tod when present.
// ctx.setTod(v)  jump to a time; ctx.todSpeed = cycles per second (0 freezes).
// ctx.sun        DirectionalLight (the sun by day, moonlight by night)
// ctx.sunDir     Vector3 towards the sun (may be below horizon)
// ctx.atmo       shared atmosphere state consumed by sky.js / water.js
import * as THREE from 'three';
import { sunTransmittance, skyRadiance } from './atmosphere.js';
import { installFog, fogUniforms } from './fog.js';

const DAY_SECONDS = 16 * 60;           // full real-time cycle
const TILT = THREE.MathUtils.degToRad(36);
// sun path: rises along +EAST, sets along -EAST (towards the lake / west-north-west)
const EAST = new THREE.Vector3(0.6, 0, 0.8).normalize();
const SOUTH = new THREE.Vector3(0.8, 0, -0.6).normalize();
const UP = new THREE.Vector3(0, 1, 0);

export function sunDirForTod(tod, out = new THREE.Vector3()) {
  const th = (tod - 0.25) * Math.PI * 2;
  const c = Math.cos(th), s = Math.sin(th);
  out.copy(EAST).multiplyScalar(c)
    .addScaledVector(UP, s * Math.cos(TILT))
    .addScaledVector(SOUTH, s * Math.sin(TILT));
  return out.normalize();
}

export function init(ctx) {
  const { scene, renderer } = ctx;
  installFog();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft is removed in r18x (warns)

  ctx.tod = 0.4;
  ctx.todSpeed = 1 / DAY_SECONDS;
  ctx.setTod = v => { ctx.tod = ((v % 1) + 1) % 1; };

  // ---- key light ----------------------------------------------------------
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  const maxTex = renderer.capabilities.maxTextureSize || 4096;
  const SM = Math.min(4096, maxTex);
  const HALF = 42; // half-extent of the tracked shadow box (m)
  sun.castShadow = true;
  sun.shadow.mapSize.set(SM, SM);
  const sc = sun.shadow.camera;
  sc.left = -HALF; sc.right = HALF; sc.top = HALF; sc.bottom = -HALF;
  sc.near = 1; sc.far = 600;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = 2.2;
  sun.shadow.intensity = 1.0;
  scene.add(sun, sun.target);

  // sky / ground fill (env map from sky.js provides most of the ambient; this adds bounce)
  const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x5a5030, 0.35);
  scene.add(hemi);

  scene.fog = new THREE.FogExp2(0xbcd0e0, 0.0022);
  fogUniforms.fogHeight.value.set(0.016, 0.0);

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  ctx.sun = sun;
  ctx.sunDir = sunDir;
  const atmo = ctx.atmo = {
    sunDir, moonDir,
    sunT: new THREE.Color(),       // sunlight colour reaching the ground (0..1, fades at night)
    moonT: new THREE.Color(),
    day: 1, night: 0,              // factors
    fogColor: scene.fog.color,
    fogSunColor: fogUniforms.fogSunColor.value,
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    version: 0,
  };

  const tmpV = new THREE.Vector3();
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  const center = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const lightRight = new THREE.Vector3(), lightUp = new THREE.Vector3();

  function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  function updateAtmosphere() {
    sunDirForTod(ctx.tod, sunDir);
    // moon roughly opposite the sun, slightly offset so it's not exactly antipodal
    moonDir.copy(sunDir).negate().addScaledVector(SOUTH, 0.25).add(tmpV.set(0, 0.12, 0)).normalize();
    const day = smooth(-0.12, 0.06, sunDir.y);
    const night = 1 - smooth(-0.22, -0.02, sunDir.y);
    atmo.day = day; atmo.night = night;
    sunTransmittance(sunDir.y, atmo.sunT).multiplyScalar(day);
    // moonlight: cool, dim
    sunTransmittance(Math.max(moonDir.y, 0), atmo.moonT).multiplyScalar(0.03 * night * smooth(-0.05, 0.15, moonDir.y));
    atmo.moonT.lerp(tmpC.setRGB(0.6, 0.75, 1.0).multiplyScalar(atmo.moonT.r + atmo.moonT.g + atmo.moonT.b), 0.6);

    // fog = average horizon radiance, plus a sun-ward lobe
    const fc = atmo.fogColor.setRGB(0, 0, 0);
    const elev = 0.06;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      tmpV.set(Math.cos(a), elev, Math.sin(a)).normalize();
      skyRadiance(tmpV, sunDir, atmo.sunT, tmpC); fc.add(tmpC);
      skyRadiance(tmpV, moonDir, atmo.moonT, tmpC); fc.add(tmpC);
    }
    fc.multiplyScalar(1 / 8);
    // night floor so silhouettes never go pitch black
    fc.r += 0.006 * night; fc.g += 0.009 * night; fc.b += 0.018 * night;
    // a touch of haze desaturation
    const lum = fc.r * 0.3 + fc.g * 0.55 + fc.b * 0.15;
    fc.lerp(tmpC.setRGB(lum, lum, lum), 0.18);
    atmo.horizon.copy(fc);
    tmpV.set(sunDir.x, Math.max(sunDir.y, 0.06), sunDir.z).normalize();
    skyRadiance(tmpV, sunDir, atmo.sunT, tmpC);
    atmo.fogSunColor.copy(tmpC).sub(fc);
    atmo.fogSunColor.r = Math.max(0, atmo.fogSunColor.r) * 0.8;
    atmo.fogSunColor.g = Math.max(0, atmo.fogSunColor.g) * 0.8;
    atmo.fogSunColor.b = Math.max(0, atmo.fogSunColor.b) * 0.8;
    fogUniforms.fogSunDir.value.copy(sunDir);
    skyRadiance(UP, sunDir, atmo.sunT, atmo.zenith);
    skyRadiance(UP, moonDir, atmo.moonT, tmpC); atmo.zenith.add(tmpC);
    atmo.zenith.r += 0.002 * night; atmo.zenith.g += 0.004 * night; atmo.zenith.b += 0.01 * night;

    // denser, warmer haze near dawn/dusk; crisp at noon
    const golden = 1 - smooth(0.12, 0.5, Math.abs(sunDir.y));
    scene.fog.density = 0.0017 + 0.0011 * golden + 0.0008 * night;

    // key light: sun by day, moon by night
    const useMoon = sunDir.y < -0.04;
    const L = useMoon ? atmo.moonT : atmo.sunT;
    const ldir = useMoon ? moonDir : sunDir;
    const m = Math.max(L.r, L.g, L.b, 1e-5);
    sun.color.setRGB(L.r / m, L.g / m, L.b / m);
    // golden key: slight warm push
    sun.color.lerp(tmpC.setRGB(1.0, 0.86, 0.66), useMoon ? 0 : 0.18);
    sun.intensity = useMoon ? m * 12 : m * 3.4 * smooth(-0.02, 0.05, sunDir.y);
    sun.userData.dir = ldir;
    sun.castShadow = sun.intensity > 0.02;

    // hemisphere fill: sky from zenith radiance, ground = warm grass bounce
    const zl = atmo.zenith;
    hemi.color.copy(zl).lerp(fc, 0.5);
    const hm = Math.max(hemi.color.r, hemi.color.g, hemi.color.b, 1e-5);
    hemi.intensity = Math.min(0.6, hm * 0.35) + 0.04;
    hemi.color.multiplyScalar(1 / hm);
    tmpC2.setRGB(0.42, 0.38, 0.2).multiply(tmpC.copy(atmo.sunT).multiplyScalar(0.8)).add(tmpC.copy(fc).multiplyScalar(0.2));
    const gm = Math.max(tmpC2.r, tmpC2.g, tmpC2.b, 1e-5);
    hemi.groundColor.copy(tmpC2).multiplyScalar(1 / gm);
  }

  function updateShadowFrustum() {
    const cam = ctx.camera;
    const ldir = sun.userData.dir || sunDir;
    // focus: the hero if present, else ~25 m ahead of the camera on the ground plane
    cam.getWorldDirection(fwd);
    fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    center.copy(cam.position).addScaledVector(fwd, HALF * 0.62);
    const hp = ctx.hero?.position || ctx.hero?.root?.position;
    if (hp && hp.distanceTo(cam.position) < HALF * 0.9) center.lerp(hp, 0.35);
    const hAt = ctx.terrain?.heightAt;
    center.y = hAt ? hAt(center.x, center.z) : cam.position.y - 2;
    // snap to shadow texel grid in light space to kill shimmering
    lightUp.set(0, 1, 0);
    if (Math.abs(ldir.y) > 0.99) lightUp.set(0, 0, 1);
    lightRight.crossVectors(lightUp, ldir).normalize();
    lightUp.crossVectors(ldir, lightRight).normalize();
    const texel = (HALF * 2) / SM;
    const r = center.dot(lightRight), u = center.dot(lightUp), f = center.dot(ldir);
    center.copy(lightRight).multiplyScalar(Math.round(r / texel) * texel)
      .addScaledVector(lightUp, Math.round(u / texel) * texel)
      .addScaledVector(ldir, f);
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(ldir, 300);
    sun.target.updateMatrixWorld();
    sun.updateMatrixWorld();
  }

  // Shot-mode camera fallback: if the camera system hasn't claimed the camera yet,
  // honour the critic viewpoint so screenshots stay meaningful.
  function shotCameraFallback() {
    const s = ctx.shot;
    if (!s || !s.cam || ctx.cameraRig) return;
    ctx.camera.position.set(...s.cam.pos);
    ctx.camera.lookAt(...s.cam.look);
  }

  updateAtmosphere();
  let lastTod = -1;
  return {
    update(dt) {
      if (ctx.shot && typeof ctx.shot.tod === 'number') ctx.tod = ctx.shot.tod;
      else {
        // nights pass a bit faster than days
        const speed = ctx.todSpeed * (sunDir.y < -0.1 ? 2.0 : 1.0);
        ctx.tod = (ctx.tod + dt * speed) % 1;
      }
      if (Math.abs(ctx.tod - lastTod) > 1e-5) { updateAtmosphere(); lastTod = ctx.tod; atmo.version++; }
      shotCameraFallback();
      updateShadowFrustum();
    },
  };
}
