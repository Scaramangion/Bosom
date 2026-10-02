// Lake + river water (owned by the atmosphere builder).
// - mesh generated only where terrain dips below the water level (lake basin + carved river)
// - baked data texture over the water bounds: R = depth below level, GB = flow vector, A = river mask
// - half-res planar reflection (oblique clip), fresnel, absorption-based transparency so the
//   bed shows through in the shallows, caustic sparkle, soft shoreline foam, flow-mapped river.
// ctx.water = { level, isWater(x,z), depthAt(x,z), mesh }
// URL flag ?refl=0 disables the planar reflection (falls back to analytic sky).
import * as THREE from 'three';
import { heightAt as layoutHeight, riverDist, LANDMARKS } from '../world/layout.js';
import { ATMOSPHERE_GLSL, getNoiseTexture } from './atmosphere.js';

const LEVEL = 0;
const RIVER_PTS = [[-20, 330], [-35, 220], [-10, 140], [-45, 60], [-35, 10], [-55, -30]];

function riverFlow(x, z) {
  let best = 1e9, fx = 0, fz = 0;
  for (let i = 0; i < RIVER_PTS.length - 1; i++) {
    const [ax, az] = RIVER_PTS[i], [bx, bz] = RIVER_PTS[i + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best) { best = d; const L = Math.sqrt(L2); fx = dx / L; fz = dz / L; }
  }
  return [fx, fz, best];
}

function makeNormalTexture() {
  // tileable normal map from the shared noise texture (two channels blended)
  const src = getNoiseTexture().image;
  const N = src.width, d = src.data;
  const H = (x, y) => {
    x = (x + N) % N; y = (y + N) % N; const k = (y * N + x) * 4;
    return d[k + 1] * 0.55 + d[k + 2] * 0.45;
  };
  const out = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) / 255, dy = (H(x, y + 1) - H(x, y - 1)) / 255;
    const k = (y * N + x) * 4;
    out[k] = Math.max(0, Math.min(255, 128 - dx * 128 * 6));
    out[k + 1] = Math.max(0, Math.min(255, 128 - dy * 128 * 6));
    out[k + 2] = 255; out[k + 3] = 255;
  }
  const t = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}

const vert = /* glsl */`
uniform mat4 uTexMat;
varying vec3 vWorld;
varying vec4 vReflCoord;
#include <fog_pars_vertex>
void main() {
  vec3 transformed = position;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vReflCoord = uTexMat * vec4(vWorld, 1.0);
  vec4 mvPosition = viewMatrix * vec4(vWorld, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */`
${ATMOSPHERE_GLSL}
uniform sampler2D uRefl, uData, uNormal, uNoise;
uniform vec4 uBox;
uniform float uTime, uReflOn, uLevel, uNight;
uniform vec3 uSunDir, uSunT, uMoonDir, uMoonT, uZenith, uSunLight, uSunSky, uMoonSky;
varying vec3 vWorld;
varying vec4 vReflCoord;
#include <fog_pars_fragment>

vec2 nrm(vec2 uv) { return texture2D(uNormal, uv).rg * 2.0 - 1.0; }

void main() {
  vec4 D = texture2D(uData, (vWorld.xz - uBox.xy) / uBox.zw);
  float depth = max(D.r, 0.0);
  vec2 flow = D.gb;
  float river = D.a;
  float t = uTime;
  vec2 p = vWorld.xz;

  // ---- normals: still-water swell + flow-mapped ripples ----
  vec2 n = nrm(p * 0.045 + vec2(t * 0.011, t * 0.006)) * 0.55
         + nrm(p * 0.13 + vec2(-t * 0.018, t * 0.021)) * 0.35
         + nrm(p * 0.41 + vec2(t * 0.03, -t * 0.025)) * 0.18;
  float ph0 = fract(t * 0.22), ph1 = fract(t * 0.22 + 0.5);
  float wf = abs(ph0 - 0.5) * 2.0;
  vec2 fl = flow * 1.4;
  vec2 nf = mix(nrm(p * 0.2 - fl * ph0), nrm(p * 0.2 - fl * ph1 + 0.37), wf);
  n = mix(n, nf * 0.9 + n * 0.3, river);
  float strength = 0.22 + 0.25 * river;
  // calm down ripples in very shallow water near the shore
  strength *= mix(0.45, 1.0, smoothstep(0.0, 1.2, depth));
  vec3 N = normalize(vec3(n.x * strength, 1.0, n.y * strength));

  vec3 toCam = cameraPosition - vWorld;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  float NdV = max(dot(N, V), 0.0);
  float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  F = clamp(F, 0.0, 1.0);

  // ---- reflection ----
  vec3 R = reflect(-V, N);
  vec3 Rs = normalize(vec3(R.x, max(R.y, 0.0) + 0.002, R.z));
  vec3 skyR = atmSky(Rs, uSunDir, uSunSky) + atmSky(Rs, uMoonDir, uMoonSky) + vec3(0.006, 0.01, 0.02) * uNight;
  vec3 refl = skyR;
  if (uReflOn > 0.5) {
    vec4 rc = vReflCoord;
    rc.xy += N.xz * (0.9 + 0.6 * river) * min(rc.w, 60.0) * 0.012;
    refl = texture2DProj(uRefl, rc).rgb;
  }

  // ---- sun glints ----
  vec3 H = normalize(uSunDir + V);
  float NdH = max(dot(N, H), 0.0);
  vec3 spec = uSunT * (pow(NdH, 1400.0) * 90.0 + pow(NdH, 160.0) * 2.2) * smoothstep(-0.02, 0.05, uSunDir.y);

  // ---- body colour (absorption) ----
  vec3 light = uSunLight * max(uSunDir.y, 0.0) * 0.35 + uZenith * 0.9 + uMoonT * 10.0;
  vec3 shallowC = vec3(0.10, 0.34, 0.27);
  vec3 deepC = vec3(0.010, 0.060, 0.070);
  vec3 body = mix(shallowC, deepC, smoothstep(0.3, 5.0, depth)) * light;
  float clarity = 0.42;                       // per-metre extinction
  float absorb = 1.0 - exp(-depth * clarity);
  // grazing angles see through more water
  absorb = 1.0 - (1.0 - absorb) * mix(0.35, 1.0, NdV);

  // caustic sparkle on the visible bed
  vec2 cp = p * 0.18 + N.xz * 0.3;
  float c1 = texture2D(uNoise, cp + vec2(t * 0.021, t * 0.013)).g;
  float c2 = texture2D(uNoise, cp * 1.3 - vec2(t * 0.017, -t * 0.019)).b;
  float ca = pow(1.0 - abs(c1 - c2) * 3.0, 6.0);
  ca = max(ca, 0.0) * smoothstep(0.0, 0.5, depth) * (1.0 - smoothstep(1.0, 4.0, depth));
  vec3 caust = uSunLight * ca * 0.25 * max(uSunDir.y, 0.0);

  // ---- shoreline foam ----
  float fn = texture2D(uNoise, p * 0.09 + vec2(t * 0.01, 0.0)).r * 0.6 + texture2D(uNoise, p * 0.35 - vec2(0.0, t * 0.03)).g * 0.4;
  float band = 1.0 - smoothstep(0.0, 0.45 + 0.25 * fn, depth);
  float wave = 0.5 + 0.5 * sin(depth * 14.0 - t * 1.6 + fn * 6.0);
  float foam = smoothstep(0.45, 0.75, fn * band + wave * band * 0.45) * band;
  // river rapids froth where it flows fast and shallow
  foam = max(foam, river * smoothstep(0.62, 0.9, fn) * (1.0 - smoothstep(0.3, 1.6, depth)) * 0.6);
  vec3 foamC = (uSunLight * max(uSunDir.y, 0.05) * 0.5 + uZenith * 1.2) * 0.85;

  // ---- composite (premultiplied against the already-rendered bed) ----
  float T = 1.0 - absorb;
  vec3 src = refl * F + (1.0 - F) * (body * absorb + caust * T) + spec;
  float a = 1.0 - (1.0 - F) * T;
  src = mix(src, foamC, foam * 0.9);
  a = mix(a, 1.0, foam * 0.9);
  // feather the waterline
  float edge = smoothstep(0.0, 0.08, depth);
  src *= edge; a *= edge;

  vec3 col = src;
  #ifdef USE_FOG
    vec3 fogged = atmosFog(col);
    vec3 fog0 = atmosFog(vec3(0.0));
    col = fogged - fog0 * (1.0 - a);
  #endif
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function init(ctx) {
  const { scene, renderer } = ctx;
  const hAt = (x, z) => (ctx.terrain?.heightAt || layoutHeight)(x, z);

  // ---- bake data over the water bounds (1 m) ----
  const L = LANDMARKS.lake;
  let x0 = L.x - L.r - 40, x1 = L.x + L.r + 40, z0 = L.z - L.r - 40, z1 = L.z + L.r + 40;
  for (const [x, z] of RIVER_PTS) { x0 = Math.min(x0, x - 25); x1 = Math.max(x1, x + 25); z0 = Math.min(z0, z - 25); z1 = Math.max(z1, z + 25); }
  x0 = Math.max(x0, -400); z0 = Math.max(z0, -400); x1 = Math.min(x1, 400); z1 = Math.min(z1, 400);
  const W = Math.ceil(x1 - x0) + 1, Hh = Math.ceil(z1 - z0) + 1;
  const heights = new Float32Array(W * Hh);
  const toH = THREE.DataUtils.toHalfFloat;
  const data = new Uint16Array(W * Hh * 4);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const x = x0 + i, z = z0 + j, k = j * W + i;
    const h = hAt(x, z); heights[k] = h;
    let fx = 0, fz = 0, rm = 0;
    if (h < LEVEL + 1.5) {
      const [dx, dz, rd] = riverFlow(x, z);
      const lakeD = Math.hypot(x - L.x, z - L.z);
      rm = (1 - Math.min(1, rd / 16)) * Math.min(1, Math.max(0, (lakeD - L.r * 0.85) / 18));
      const speed = 0.9 * rm;
      fx = dx * speed; fz = dz * speed;
    }
    data[k * 4] = toH(LEVEL - h); data[k * 4 + 1] = toH(fx); data[k * 4 + 2] = toH(fz); data[k * 4 + 3] = toH(rm);
  }
  const dataTex = new THREE.DataTexture(data, W, Hh, THREE.RGBAFormat, THREE.HalfFloatType);
  dataTex.minFilter = dataTex.magFilter = THREE.LinearFilter;
  dataTex.wrapS = dataTex.wrapT = THREE.ClampToEdgeWrapping;
  dataTex.needsUpdate = true;
  const box = new THREE.Vector4(x0 - 0.5, z0 - 0.5, W, Hh);

  // ---- geometry: 2 m cells wherever any corner is below level + margin ----
  const S = 2, CW = Math.floor((W - 1) / S), CH = Math.floor((Hh - 1) / S);
  const below = (i, j) => heights[Math.min(Hh - 1, j * S) * W + Math.min(W - 1, i * S)] < LEVEL + 0.35;
  const vid = new Int32Array((CW + 1) * (CH + 1)).fill(-1);
  const pos = [], idx = [];
  const V = (i, j) => {
    const k = j * (CW + 1) + i;
    if (vid[k] < 0) { vid[k] = pos.length / 3; pos.push(x0 + i * S, LEVEL, z0 + j * S); }
    return vid[k];
  };
  for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
    if (!(below(i, j) || below(i + 1, j) || below(i, j + 1) || below(i + 1, j + 1))) continue;
    const a = V(i, j), b = V(i + 1, j), c = V(i, j + 1), d = V(i + 1, j + 1);
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));

  // ---- reflection target ----
  const reflOn = ctx.params.get('refl') !== '0';
  const pr = renderer.getPixelRatio();
  const RS = 0.5;
  const reflRT = new THREE.WebGLRenderTarget(Math.max(1, window.innerWidth * pr * RS), Math.max(1, window.innerHeight * pr * RS), { type: THREE.HalfFloatType });
  ctx.resizeHandlers.push((w, h) => reflRT.setSize(Math.max(1, w * renderer.getPixelRatio() * RS), Math.max(1, h * renderer.getPixelRatio() * RS)));
  const texMat = new THREE.Matrix4();

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uRefl: { value: null }, uData: { value: null }, uNormal: { value: null }, uNoise: { value: null },
    uBox: { value: box }, uTime: { value: 0 }, uReflOn: { value: reflOn ? 1 : 0 }, uLevel: { value: LEVEL }, uNight: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunT: { value: new THREE.Color() },
    uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uMoonT: { value: new THREE.Color() },
    uZenith: { value: new THREE.Color() }, uSunSky: { value: new THREE.Color() }, uMoonSky: { value: new THREE.Color() }, uSunLight: { value: new THREE.Color() },
    uTexMat: { value: texMat },
  }]);
  uniforms.uRefl.value = reflRT.texture;
  uniforms.uData.value = dataTex;
  uniforms.uNormal.value = makeNormalTexture();
  uniforms.uNoise.value = getNoiseTexture();
  uniforms.uTexMat.value = texMat;
  uniforms.uBox.value = box;

  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert, fragmentShader: frag,
    transparent: true, depthWrite: true, fog: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  mesh.renderOrder = 1;
  scene.add(mesh);

  // ---- planar reflection (adapted from three's Reflector) ----
  const rcam = new THREE.PerspectiveCamera();
  const plane = new THREE.Plane(), clip = new THREE.Vector4(), q = new THREE.Vector4();
  const camPos = new THREE.Vector3(), rot = new THREE.Matrix4(), look = new THREE.Vector3(), target = new THREE.Vector3();
  const nrm = new THREE.Vector3(0, 1, 0), planePt = new THREE.Vector3(0, LEVEL, 0);
  let rendering = false;
  mesh.onBeforeRender = (r, s, camera) => {
    if (!reflOn || rendering || camera === rcam) return;
    camPos.setFromMatrixPosition(camera.matrixWorld);
    if (camPos.y < LEVEL) return;
    rendering = true;
    const view = camPos.clone(); view.y = 2 * LEVEL - view.y;
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.copy(look); target.y = 2 * LEVEL - target.y;
    rcam.position.copy(view);
    rcam.up.set(0, 1, 0).applyMatrix4(rot); rcam.up.y = -rcam.up.y;
    rcam.lookAt(target);
    rcam.far = camera.far; rcam.near = camera.near;
    rcam.updateMatrixWorld();
    rcam.projectionMatrix.copy(camera.projectionMatrix);
    texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    texMat.multiply(rcam.projectionMatrix).multiply(rcam.matrixWorldInverse);
    // oblique near plane = water plane (slightly lowered to avoid seams at the shore)
    plane.setFromNormalAndCoplanarPoint(nrm, planePt.set(0, LEVEL - 0.05, 0)).applyMatrix4(rcam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = rcam.projectionMatrix.elements;
    q.x = (Math.sign(clip.x) + pm[8]) / pm[0];
    q.y = (Math.sign(clip.y) + pm[9]) / pm[5];
    q.z = -1; q.w = (1 + pm[10]) / pm[14];
    clip.multiplyScalar(2 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1; pm[14] = clip.w;
    rcam.projectionMatrixInverse.copy(rcam.projectionMatrix).invert();

    mesh.visible = false;
    const prevRT = r.getRenderTarget();
    const prevShadow = r.shadowMap.autoUpdate;
    const prevXR = r.xr.enabled;
    r.xr.enabled = false; r.shadowMap.autoUpdate = false;
    r.setRenderTarget(reflRT);
    r.state.buffers.depth.setMask(true);
    r.clear();
    r.render(s, rcam);
    r.setRenderTarget(prevRT);
    r.shadowMap.autoUpdate = prevShadow; r.xr.enabled = prevXR;
    if (camera.viewport !== undefined) r.state.viewport(camera.viewport);
    mesh.visible = true;
    rendering = false;
  };

  ctx.water = {
    level: LEVEL, mesh,
    isWater: (x, z) => hAt(x, z) < LEVEL - 0.05,
    depthAt: (x, z) => Math.max(0, LEVEL - hAt(x, z)),
  };

  return {
    update(dt, t) {
      uniforms.uTime.value = t;
      const a = ctx.atmo;
      if (a) {
        uniforms.uSunDir.value.copy(a.sunDir);
        uniforms.uSunT.value.copy(a.sunT);
        uniforms.uMoonDir.value.copy(a.moonDir);
        uniforms.uMoonT.value.copy(a.moonT);
        uniforms.uZenith.value.copy(a.zenith);
        uniforms.uSunSky.value.copy(a.sunSky);
        uniforms.uMoonSky.value.copy(a.moonSky);
        uniforms.uNight.value = a.night;
        uniforms.uSunLight.value.copy(ctx.sun.color).multiplyScalar(ctx.sun.intensity);
      }
    },
  };
}
