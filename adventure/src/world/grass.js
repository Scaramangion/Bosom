// GPU grass + wildflowers. Each layer is ONE instanced draw of blades whose
// local offsets live in a square tile of size S; the vertex shader wraps every
// blade to the copy nearest the camera (stable in world space), reads height /
// density / path data from the baked terrain data texture, and applies wind +
// hero push. Blades shrink away with distance so the field melts into the
// terrain splat colour.
import * as THREE from 'three';
import { DATA_GLSL } from './terrainData.js';
import { noiseTexture } from './textures.js';

export const grassUniforms = {
  uTime: { value: 0 },
  uCam: { value: new THREE.Vector3() },
  uHero: { value: new THREE.Vector3(1e5, 0, 1e5) },
  uBend: { value: new THREE.Vector4(1e5, 1e5, 1e5, 1e5) }, // extra push points (x,z, x,z)
  uWind: { value: new THREE.Vector2(0.92, 0.38) },
  uSunDirW: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
  uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
};

const COMMON_VERT = /* glsl */`
${DATA_GLSL}
uniform sampler2D uNoise;
uniform float uTime, uS, uFade0, uFade1, uInner0, uInner1, uHeight, uWidth;
uniform vec3 uCam, uHero; uniform vec4 uBend; uniform vec2 uWind;
attribute vec4 aOff;
varying float vT; varying vec3 vTint; varying vec3 vWPos2; varying float vKind;
float hash1(float n){ return fract(sin(n) * 43758.5453); }
`;

// compute blade placement; leaves world position in gPos, normal in objectNormal
const PLACE = /* glsl */`
  vec2 lp = aOff.xy;
  vec2 wp = lp + modelMatrix[3].xz; // tile shift (set on the CPU, keeps frustum culling per tile)
  vec4 TD = tData(wp);
  float dist = length(wp - uCam.xz);
  float keep = step(aOff.z, TD.g * DENS_MUL);
  float fade = (1.0 - smoothstep(uFade0, uFade1, dist)) * smoothstep(uInner0, uInner1, dist);
  vec4 nz = texture2D(uNoise, wp * 0.0043);
  vec4 nz2 = texture2D(uNoise, wp * 0.031 + 0.17);
  float tall = mix(0.55, 1.25, nz2.r) * mix(0.6, 1.0, smoothstep(0.1, 0.6, TD.g));
  float hgt = uHeight * (0.55 + 0.6 * aOff.w) * tall * keep * smoothstep(0.0, 0.35, fade);
  float wid = uWidth * (0.7 + 0.6 * hash1(aOff.z * 91.7)) * mix(1.0, 1.6, 1.0 - fade);
  float yaw = aOff.w * 37.0 + aOff.z * 11.0;
  vec2 fw = vec2(cos(yaw), sin(yaw));
  vec2 side = vec2(-fw.y, fw.x);
  float t = position.y; vT = t;
  // wind: big rolling gusts + small flutter
  float gust = texture2D(uNoise, wp * 0.012 - uTime * uWind * 0.035).r;
  float sway = (gust - 0.35) * 1.35 + sin(uTime * 2.3 + dot(wp, vec2(0.37, 0.21)) + aOff.z * 6.28) * 0.12;
  vec2 bend = uWind * sway + fw * (0.25 + 0.35 * hash1(aOff.w * 13.1));
  // hero / actor push
  vec2 dh = wp - uHero.xz; float hd = length(dh);
  float push = (1.0 - smoothstep(0.25, 1.3, hd)) * step(abs(uHero.y - TD.r), 2.5);
  bend += normalize(dh + 1e-4) * push * 2.2;
  vec2 dh2 = wp - uBend.xy; float p2 = 1.0 - smoothstep(0.25, 1.2, length(dh2)); bend += normalize(dh2 + 1e-4) * p2 * 2.0;
  float bl = length(bend); bend /= max(1.0, bl * 0.8);
  float k = t * t;
  vec3 gPos;
  gPos.xz = wp + side * position.x * wid * (1.0 - t * 0.85) + bend * k * hgt * 0.75;
  gPos.y = TD.r + t * hgt * (1.0 - 0.28 * min(1.0, dot(bend, bend)) * k) - 0.03;
  // soft "field" normal: mostly up, a little blade facing
  objectNormal = normalize(vec3(0.0, 1.0, 0.0) + vec3(fw.x, 0.0, fw.y) * position.x * 0.6 + vec3(bend.x, 0.0, bend.y) * 0.25);
  // colour variation shared with the terrain splat
  vec3 tint = mix(uGLush, uGDry, smoothstep(0.42, 0.85, nz.r));
  tint = mix(tint, uGDeep, smoothstep(0.45, 0.8, nz.g) * 0.75);
  tint *= 0.85 + 0.3 * nz2.g;
  tint = mix(tint, uGDry * 1.15, step(0.93, hash1(aOff.z * 7.3)) * 0.6); // a few straw blades
  vTint = tint;
  vWPos2 = gPos;
`;

function makeLayerMaterial(opts) {
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.62, metalness: 0 });
  const u = Object.assign({}, grassUniforms, {
    uTData: opts.uTData, uNoise: { value: noiseTexture() },
    uS: { value: opts.S }, uFade0: { value: opts.fade0 }, uFade1: { value: opts.fade1 },
    uInner0: { value: opts.inner0 }, uInner1: { value: opts.inner1 },
    uHeight: { value: opts.height }, uWidth: { value: opts.width },
    uGLush: opts.colors.lush, uGDry: opts.colors.dry, uGDeep: opts.colors.deep,
    uRoot: { value: new THREE.Color('#1d2f0e') },
  });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n#define DENS_MUL ${opts.densMul.toFixed(2)}\nuniform vec3 uGLush, uGDry, uGDeep;\n${COMMON_VERT}`)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal;\n${PLACE}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = gPos - modelMatrix[3].xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vT; varying vec3 vTint; varying vec3 vWPos2;
        uniform vec3 uRoot, uSunDirW, uSunCol;`)
      .replace('#include <color_fragment>', `
        vec3 gc = mix(uRoot, vTint, smoothstep(0.0, 0.55, vT));
        gc = mix(gc, vTint * vec3(1.25, 1.2, 0.85), smoothstep(0.6, 1.0, vT)); // sun-bleached tips
        diffuseColor.rgb = gc;`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif')
      .replace('#include <opaque_fragment>', `
        vec3 vdW = normalize(cameraPosition - vWPos2);
        float back = pow(max(dot(-vdW, uSunDirW), 0.0), 3.0) * smoothstep(0.2, 1.0, vT);
        outgoingLight += uSunCol * diffuseColor.rgb * back * 0.9 * max(uSunDirW.y + 0.15, 0.0);
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'grass-' + opts.key;
  return mat;
}

function bladeGeometry(segs) {
  const pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    if (i < segs) { pos.push(-0.5, t, 0, 0.5, t, 0); } else pos.push(0, 1, 0);
  }
  for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const l = (segs - 1) * 2; idx.push(l, l + 1, l + 2);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function rngf(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

// Split a wrapped field of size S into n x n tiles; each tile is its own draw
// with a bounding sphere, shifted (via its model matrix) to the copy nearest the
// camera, so frustum culling + distance culling skip most of the work.
const tiledFields = [];
function tiledField(ctx, proto, material, S, n, count, seed, maxDist, name) {
  const R = rngf(seed);
  const T = S / n, per = Math.ceil(count / (n * n));
  const tiles = [];
  for (let tj = 0; tj < n; tj++) for (let ti = 0; ti < n; ti++) {
    const g = new THREE.InstancedBufferGeometry();
    for (const k of Object.keys(proto.attributes)) g.setAttribute(k, proto.attributes[k]);
    g.setIndex(proto.index);
    const a = new Float32Array(per * 4), m = Math.ceil(Math.sqrt(per)), cell = T / m;
    const x0 = -S / 2 + ti * T, z0 = -S / 2 + tj * T;
    for (let i = 0; i < per; i++) {
      a[i * 4] = x0 + ((i % m) + R()) * cell; a[i * 4 + 1] = z0 + (Math.floor(i / m) + R()) * cell;
      a[i * 4 + 2] = R(); a[i * 4 + 3] = R();
    }
    g.setAttribute('aOff', new THREE.InstancedBufferAttribute(a, 4));
    g.instanceCount = per;
    const cx = x0 + T / 2, cz = z0 + T / 2;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, 0, cz), T * 0.75 + 2);
    const mesh = new THREE.Mesh(g, material);
    mesh.receiveShadow = true; mesh.castShadow = false; mesh.name = name;
    ctx.scene.add(mesh);
    tiles.push({ mesh, cx, cz });
  }
  const f = { tiles, S, T, maxDist };
  tiledFields.push(f);
  return f;
}
export function updateFields(cam, heightFn) {
  for (const f of tiledFields) for (const t of f.tiles) {
    const sx = Math.round((cam.x - t.cx) / f.S) * f.S, sz = Math.round((cam.z - t.cz) / f.S) * f.S;
    const wx = t.cx + sx, wz = t.cz + sz;
    const dx = Math.max(0, Math.abs(wx - cam.x) - f.T / 2), dz = Math.max(0, Math.abs(wz - cam.z) - f.T / 2);
    t.mesh.visible = dx * dx + dz * dz < f.maxDist * f.maxDist;
    t.mesh.position.set(sx, 0, sz);
    t.mesh.geometry.boundingSphere.center.y = heightFn(wx, wz);
  }
}
export function qualityScale(ctx) {
  const q = ctx.params.get('grass'); if (q) return +q;
  try {
    const gl = ctx.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    if (/swiftshader|llvmpipe|software/i.test(r)) return 0.45;
  } catch (e) { /* ignore */ }
  return 1;
}

export function buildGrass(ctx, dataTex, colors) {
  const uTData = { value: dataTex };
  const col = { lush: { value: new THREE.Color(colors.lush) }, dry: { value: new THREE.Color(colors.dry) }, deep: { value: new THREE.Color(colors.deep) } };
  const mul = qualityScale(ctx), wmul = 1 / Math.sqrt(Math.max(mul, 0.2));
  const layers = [
    { key: 'near', S: 44, n: 6, count: Math.round(100000 * mul), segs: 4, height: 0.62, width: 0.075 * wmul, fade0: 15, fade1: 21, inner0: -1, inner1: 0, densMul: 1.0 },
    { key: 'mid', S: 120, n: 8, count: Math.round(80000 * mul), segs: 3, height: 0.7, width: 0.16 * wmul, fade0: 42, fade1: 58, inner0: 14, inner1: 18, densMul: 1.0 },
  ];
  const fields = [];
  for (const L of layers) {
    const mat = makeLayerMaterial({ ...L, uTData, colors: col });
    fields.push(tiledField(ctx, bladeGeometry(L.segs), mat, L.S, L.n, L.count, 1234 + L.count, L.fade1 + 1, 'grass-' + L.key));
  }
  return { fields };
}

// ---------------------------------------------------------------- wildflowers
export function buildFlowers(ctx, dataTex) {
  // geometry: stem quad + 5 petals + centre, vertex colour channel marks parts
  const pos = [], part = [], idx = [];
  const quad = (pts, p) => { const b = pos.length / 3; for (const q of pts) { pos.push(...q); part.push(p); } idx.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  quad([[-0.012, 0, 0], [0.012, 0, 0], [0.012, 1, 0], [-0.012, 1, 0]], 0);
  quad([[0, 0, -0.012], [0, 0, 0.012], [0, 1, 0.012], [0, 1, -0.012]], 0);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), c2 = Math.cos(a + 0.5), s2 = Math.sin(a + 0.5), c3 = Math.cos(a - 0.5), s3 = Math.sin(a - 0.5);
    const b = pos.length / 3;
    pos.push(0, 1, 0, c3 * 0.6, 1.02, s3 * 0.6, c, 1.06, s, c2 * 0.6, 1.02, s2 * 0.6); part.push(2, 1, 1, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx);
  const S = 64, count = Math.round(14000 * qualityScale(ctx));
  const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.55 });
  const u = Object.assign({}, grassUniforms, { uTData: { value: dataTex }, uNoise: { value: noiseTexture() }, uS: { value: S } });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      ${DATA_GLSL}
      uniform sampler2D uNoise; uniform float uTime, uS; uniform vec3 uCam, uHero; uniform vec2 uWind;
      attribute vec4 aOff; attribute float aPart;
      varying float vPart; varying vec3 vFCol;
      float hash1(float n){ return fract(sin(n) * 43758.5453); }`)
      .replace('#include <beginnormal_vertex>', `
      vec2 lp = aOff.xy;
      vec2 wp = lp + modelMatrix[3].xz;
      vec4 TD = tData(wp);
      float dist = length(wp - uCam.xz);
      vec4 pn = texture2D(uNoise, wp * 0.021 + 3.7);
      float patchy = smoothstep(0.52, 0.78, pn.b) ;
      float keep = step(aOff.z, patchy * TD.g * 0.9) * (1.0 - smoothstep(24.0, 30.0, dist));
      float hgt = (0.28 + 0.3 * aOff.w) * keep;
      float sc = 0.075 + 0.04 * hash1(aOff.w * 3.1);
      float yaw = aOff.z * 50.0;
      float gust = texture2D(uNoise, wp * 0.012 - uTime * uWind * 0.035).r;
      vec2 sway = uWind * ((gust - 0.35) * 0.9 + sin(uTime * 2.6 + aOff.z * 30.0) * 0.08);
      vec2 dh = wp - uHero.xz; sway += normalize(dh + 1e-4) * (1.0 - smoothstep(0.2, 1.0, length(dh))) * 1.5;
      vec3 p = position;
      vec3 gPos;
      float cy = cos(yaw), sy = sin(yaw);
      vec2 rxz = vec2(p.x * cy - p.z * sy, p.x * sy + p.z * cy);
      float yy = min(p.y, 1.0);
      gPos.xz = wp + (aPart > 0.5 ? rxz * sc : rxz) * keep + sway * yy * yy * hgt;
      gPos.y = TD.r + p.y * hgt - 0.02;
      vec3 objectNormal = aPart > 0.5 ? vec3(0.0, 1.0, 0.0) : normalize(vec3(cy, 0.4, sy));
      // palette: white, butter yellow, violet, soft blue, coral
      float pick = floor(fract(pn.r * 7.0 + aOff.w * 0.35) * 5.0);
      vec3 fc = pick < 1.0 ? vec3(0.95, 0.93, 0.86) : pick < 2.0 ? vec3(1.0, 0.82, 0.18) : pick < 3.0 ? vec3(0.62, 0.38, 0.9) : pick < 4.0 ? vec3(0.45, 0.6, 1.0) : vec3(1.0, 0.45, 0.38);
      vFCol = fc; vPart = aPart;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = gPos - modelMatrix[3].xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vPart; varying vec3 vFCol;')
      .replace('#include <color_fragment>', `
        vec3 fcl = pow(vFCol, vec3(2.2));
        diffuseColor.rgb = vPart < 0.5 ? vec3(0.06, 0.13, 0.03) : vPart < 1.5 ? fcl : vec3(0.9, 0.62, 0.08);`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n#ifdef DOUBLE_SIDED\n normal *= faceDirection;\n#endif');
  };
  mat.customProgramCacheKey = () => 'flowers';
  return tiledField(ctx, g, mat, S, 4, count, 777, 31, 'flowers');
}
