// Atmospheric sky dome: analytic single-scattering sky (shared model in
// atmosphere.js), sun disc + halo, painted drifting cumulus + high cirrus,
// moon and stars at night. Also feeds scene.environment (PMREM of the sky)
// so PBR materials get matching image-based lighting.
import * as THREE from 'three';
import { ATMOSPHERE_GLSL, getNoiseTexture } from './atmosphere.js';

const vert = /* glsl */`
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  vec4 p = projectionMatrix * viewMatrix * wp;
  gl_Position = p.xyww;
  gl_Position.z = p.w * 0.99999;
}`;

const frag = /* glsl */`
${ATMOSPHERE_GLSL}
uniform vec3 uSunDir, uMoonDir, uSunT, uMoonT, uFogColor, uFogSunColor, uZenith;
uniform float uTime, uNight, uDay, uCover;
uniform vec2 uWind;
uniform sampler2D uNoise;
varying vec3 vDir;

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }

float cloudField(vec2 uv, float t) {
  // domain-warped layered noise; uv in "tile" units
  vec2 w = vec2(texture2D(uNoise, uv * 0.5 + vec2(t * 0.002, 0.0)).a, texture2D(uNoise, uv * 0.5 + vec2(0.37, 0.71)).b) - 0.5;
  uv += w * 0.18;
  float n = texture2D(uNoise, uv).r * 0.62;
  n += texture2D(uNoise, uv * 2.7 + vec2(t * 0.003, 0.11)).g * 0.26;
  n += texture2D(uNoise, uv * 7.9 - vec2(0.0, t * 0.004)).b * 0.12;
  return n;
}

void main() {
  vec3 v = normalize(vDir);
  float mu = dot(v, uSunDir);
  vec3 vs = normalize(vec3(v.x, max(v.y, 0.0) + 0.002, v.z));

  // ---- clear sky ----
  vec3 sky = atmSky(vs, uSunDir, uSunT) + atmSky(vs, uMoonDir, uMoonT);
  // night base: deep blue gradient with a faint galactic band
  vec3 nightCol = mix(vec3(0.010, 0.016, 0.034), vec3(0.003, 0.006, 0.016), sqrt(max(v.y, 0.0)));
  float band = texture2D(uNoise, vec2(atan(v.z, v.x) * 0.25, v.y * 0.6 + 0.3)).a;
  float bandMask = exp(-pow(dot(v, normalize(vec3(0.3, 0.55, -0.78))) * 3.2, 2.0));
  nightCol += vec3(0.010, 0.011, 0.016) * bandMask * smoothstep(0.35, 0.8, band);
  sky += nightCol * uNight;

  // horizon haze band identical to the scene fog so terrain melts into the sky
  vec3 hz = normalize(vec3(v.x, 0.0, v.z) + 1e-5);
  vec3 fogCol = uFogColor + uFogSunColor * pow(max(dot(hz, uSunDir), 0.0), 6.0);
  float hazeK = smoothstep(-0.03, 0.16, v.y);
  #ifdef ENV_MODE
    // ground for image-based lighting: grassy bounce
    vec3 ground = vec3(0.16, 0.17, 0.08) * (uSunT * 3.4 * max(uSunDir.y, 0.0) + uZenith * 1.8) / 3.14159 + fogCol * 0.05;
    sky = mix(mix(ground, fogCol, smoothstep(-0.25, 0.0, v.y)), sky, hazeK);
  #else
    sky = mix(fogCol, sky, hazeK);
  #endif

  // ---- stars ----
  if (uNight > 0.01 && v.y > 0.0) {
    vec3 sp = v * 320.0;
    vec3 cell = floor(sp);
    float h = hash13(cell);
    if (h > 0.985) {
      vec3 off = vec3(hash13(cell + 1.7), hash13(cell + 5.3), hash13(cell + 9.1)) * 0.6 + 0.2;
      float d = length(fract(sp) - off);
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 6.0) + h * 80.0);
      float b = smoothstep(0.16, 0.0, d) * pow((h - 0.985) / 0.015, 3.0) * tw;
      vec3 sc = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.85, 0.7), hash13(cell + 3.3));
      sky += sc * b * 1.6 * uNight * smoothstep(0.0, 0.2, v.y);
    }
  }

  // ---- sun disc + aureole ----
  #ifndef ENV_MODE
    float horizonFade = smoothstep(-0.01, 0.01, v.y);
    float disc = smoothstep(0.99985, 0.99993, mu);
    sky += uSunT * (disc * 90.0 + pow(max(mu, 0.0), 900.0) * 6.0 + pow(max(mu, 0.0), 90.0) * 0.7) * horizonFade;
    // moon
    float mm = dot(v, uMoonDir);
    float moon = smoothstep(0.99975, 0.99985, mm);
    float crater = texture2D(uNoise, v.xy * 40.0).g;
    sky += vec3(0.85, 0.9, 1.0) * moon * (0.9 + 0.5 * crater) * 1.4 * uNight * horizonFade;
    sky += vec3(0.5, 0.6, 0.85) * pow(max(mm, 0.0), 300.0) * 0.12 * uNight;
  #endif

  // ---- clouds ----
  if (v.y > 0.0) {
    float t = uTime;
    float inv = 1.0 / (v.y + 0.04);
    vec2 wp = v.xz * inv;              // position on the cloud plane (units of cloud height)
    vec2 uv = wp * 0.16 + uWind * t;
    float n = cloudField(uv, t);
    float cov = uCover;
    float dens = smoothstep(cov, cov + 0.26, n);
    // light march toward the sun across the plane
    vec2 sdir = uSunDir.xz / max(length(uSunDir.xz), 1e-3);
    float nS1 = cloudField(uv + sdir * 0.025, t);
    float nS2 = cloudField(uv + sdir * 0.06, t);
    float occl = max(nS1 - cov, 0.0) * 2.2 + max(nS2 - cov, 0.0) * 1.4;
    float lit = exp(-occl * 4.0);
    float powder = 1.0 - exp(-dens * 3.0);
    float hg = atmPhaseM(mu, 0.55) * 12.566;               // forward scattering (silver lining)
    vec3 sunLit = uSunT * 1.35 * (0.55 + 0.45 * hg) * mix(1.0, lit, 0.85) * mix(0.6, 1.0, powder);
    vec3 moonLit = uMoonT * 25.0 * lit;
    vec3 amb = uZenith * 0.75 + uFogColor * 0.45 + vec3(0.004, 0.006, 0.012) * uNight;
    // darker, cooler cores; bright warm rims
    vec3 cc = amb * mix(1.0, 0.65, dens) + sunLit + moonLit;
    // sunset: lift the undersides with a warm rose tone
    cc += uSunT * vec3(0.9, 0.45, 0.4) * 0.25 * (1.0 - uSunDir.y) * uDay * (1.0 - lit);

    // high cirrus
    vec2 uv2 = wp * vec2(0.035, 0.11) + uWind * t * 0.6 + vec2(0.3, 0.1);
    float ci = texture2D(uNoise, uv2).a * 0.7 + texture2D(uNoise, uv2 * 3.0).r * 0.3;
    float ciD = smoothstep(0.52, 0.85, ci) * 0.45 * (1.0 - dens);
    vec3 ciC = uSunT * 1.2 * (0.7 + 0.3 * hg) + amb;

    float fade = smoothstep(0.0, 0.18, v.y);
    // aerial perspective: distant clouds sink into the horizon haze
    float ap = 1.0 - exp(-max(inv - 1.0, 0.0) * 0.07);
    vec3 cloudCol = mix(cc, fogCol, ap * 0.85);
    vec3 cirrusCol = mix(ciC, fogCol, ap * 0.7);
    sky = mix(sky, cirrusCol, ciD * fade);
    sky = mix(sky, cloudCol, dens * fade * 0.97);
  }

  gl_FragColor = vec4(max(sky, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function init(ctx) {
  const { scene, renderer } = ctx;
  const atmo = ctx.atmo;
  const uniforms = {
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
    uSunT: { value: new THREE.Color(1, 1, 1) },
    uMoonT: { value: new THREE.Color(0, 0, 0) },
    uFogColor: { value: new THREE.Color(0.7, 0.8, 0.9) },
    uFogSunColor: { value: new THREE.Color(0, 0, 0) },
    uZenith: { value: new THREE.Color(0.3, 0.5, 0.9) },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uDay: { value: 1 },
    uCover: { value: 0.53 },
    uWind: { value: new THREE.Vector2(0.0011, 0.0004) },
    uNoise: { value: getNoiseTexture() },
  };
  const mkMat = (env) => new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag,
    side: THREE.BackSide, depthWrite: false, fog: false,
    defines: env ? { ENV_MODE: 1 } : {},
  });
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const mat = mkMat(false);
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'sky';
  dome.frustumCulled = false;
  dome.renderOrder = 10000;     // draw after opaque geometry -> cheap (early-z)
  dome.scale.setScalar(100);
  dome.onBeforeRender = (r, s, cam) => { dome.position.copy(cam.position); dome.updateMatrixWorld(); };
  scene.add(dome);
  ctx.sky = { mesh: dome, uniforms };

  // ---- environment (IBL) ----
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(geo, mkMat(true)));
  let envRT = null, lastEnvTod = -10, lastEnvTime = -100;
  scene.environmentIntensity = 0.85;
  function refreshEnv() {
    const rt = pmrem.fromScene(envScene, 0, 0.1, 10, { size: 128 });
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  }

  function sync() {
    if (!atmo) return;
    uniforms.uSunDir.value.copy(atmo.sunDir);
    uniforms.uMoonDir.value.copy(atmo.moonDir);
    uniforms.uSunT.value.copy(atmo.sunT);
    uniforms.uMoonT.value.copy(atmo.moonT);
    uniforms.uFogColor.value.copy(atmo.fogColor);
    uniforms.uFogSunColor.value.copy(atmo.fogSunColor);
    uniforms.uZenith.value.copy(atmo.zenith);
    uniforms.uNight.value = atmo.night;
    uniforms.uDay.value = atmo.day;
  }
  sync();

  return {
    update(dt, t) {
      uniforms.uTime.value = t;
      sync();
      const tod = ctx.tod ?? 0.4;
      let d = Math.abs(tod - lastEnvTod); d = Math.min(d, 1 - d);
      if (d > 0.0025 || (t - lastEnvTime > 20 && d > 0)) {
        refreshEnv(); lastEnvTod = tod; lastEnvTime = t;
      }
    },
  };
}
