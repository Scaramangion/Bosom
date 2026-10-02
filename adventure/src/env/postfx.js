// Post-processing pipeline (owned by the atmosphere builder).
// HDR scene (half-float + depth texture) -> GTAO (half res, depth-reconstructed,
// so alpha-tested foliage is respected) -> soft bloom -> OutputPass (ACES + sRGB)
// -> colour grade / vignette / dither -> SMAA.
// URL flags: ?ao=0 disables AO, ?fx=0 disables the whole composer.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

// Renders the scene into whichever buffer is current and publishes its depth.
class ScenePass extends Pass {
  constructor(scene, camera, onDepth) {
    super();
    this.scene = scene; this.camera = camera; this.onDepth = onDepth;
    this.needsSwap = false;
  }
  render(renderer, writeBuffer, readBuffer) {
    const old = renderer.autoClear;
    renderer.autoClear = true;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = old;
    if (this.onDepth) this.onDepth(readBuffer.depthTexture);
  }
}

// Kills NaN/Inf (e.g. from broken skinned geometry or degenerate normals) and clamps
// HDR before bloom so a single bad pixel can never smear across the whole frame.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null }, uMax: { value: 48.0 } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uMax;
    varying vec2 vUv;
    bool bad(float x) { return isnan(x) || isinf(x) || !(x >= 0.0 || x <= 0.0) || abs(x) > 1e6; }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (bad(c.r) || bad(c.g) || bad(c.b)) c = vec3(0.0);
      c = clamp(c, vec3(0.0), vec3(uMax));
      gl_FragColor = vec4(c, 1.0);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Vector3(0.012, 0.010, 0.022) },
    uGamma: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    uGain: { value: new THREE.Vector3(1.03, 1.0, 0.95) },
    uSat: { value: 1.06 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.32 },
    uWarmHi: { value: new THREE.Vector3(1.03, 1.0, 0.93) },
    uCoolLo: { value: new THREE.Vector3(0.95, 1.0, 1.06) },
    uTime: { value: 0 },
    uAspect: { value: 1.6 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3 uLift, uGamma, uGain, uWarmHi, uCoolLo;
    uniform float uSat, uContrast, uVignette, uTime, uAspect;
    varying vec2 vUv;
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // lift / gamma / gain (display referred)
      c = c * uGain + uLift * (1.0 - c);
      c = pow(max(c, 0.0), 1.0 / uGamma);
      // gentle S-curve contrast around mid grey
      c = mix(vec3(0.5), c, uContrast);
      c = clamp(c, 0.0, 1.0);
      c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;
      // split tone: cool shadows, warm highlights
      float l = luma(c);
      c *= mix(uCoolLo, uWarmHi, smoothstep(0.1, 0.75, l));
      // saturation
      l = luma(c);
      c = mix(vec3(l), c, uSat);
      // vignette (elliptical, soft)
      vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0) / uAspect * 1.6;
      float v = 1.0 - uVignette * smoothstep(0.35, 1.25, dot(d, d) * 1.4);
      c *= v;
      // triangular dither kills banding in the sky gradients
      float n = fract(sin(dot(vUv * 1024.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      float n2 = fract(sin(dot(vUv * 1024.0 - uTime, vec2(39.3468, 11.135))) * 24634.6345);
      c += (n + n2 - 1.0) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function init(ctx) {
  const { renderer, scene, camera } = ctx;
  if (ctx.params.get('fx') === '0') return null;
  const useAO = ctx.params.get('ao') !== '0';

  const w = window.innerWidth, h = window.innerHeight;
  const pr = renderer.getPixelRatio();
  const rt = new THREE.WebGLRenderTarget(w * pr, h * pr, { type: THREE.HalfFloatType });
  rt.depthTexture = new THREE.DepthTexture(w * pr, h * pr);
  rt.depthTexture.type = THREE.UnsignedIntType;
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);

  let gtao = null;
  const scenePass = new ScenePass(scene, camera, (depth) => {
    if (!gtao || !depth || gtao.depthTexture === depth) return;
    gtao.depthTexture = depth;
    gtao.gtaoMaterial.uniforms.tDepth.value = depth;
    gtao.pdMaterial.uniforms.tDepth.value = depth;
  });
  composer.addPass(scenePass);

  if (useAO) {
    gtao = new GTAOPass(scene, camera, w * pr * 0.5, h * pr * 0.5);
    // r186 crashes if depthTexture is passed to the constructor; set it afterwards
    gtao.setGBuffer(rt.depthTexture);
    const baseSetSize = gtao.setSize.bind(gtao);
    gtao.setSize = (W, H) => baseSetSize(Math.max(1, W * 0.5), Math.max(1, H * 0.5));
    gtao.updateGtaoMaterial({ radius: 1.4, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 12, screenSpaceRadius: false });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    gtao.blendIntensity = 0.55;
    composer.addPass(gtao);
  }

  const sanitize = new ShaderPass(SanitizeShader);
  composer.addPass(sanitize);

  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.65, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  const smaa = new SMAAPass();
  composer.addPass(smaa);

  composer.setSize(w, h);
  ctx.composer = composer;
  ctx.postfx = { composer, bloom, gtao, grade };

  ctx.resizeHandlers.push((W, H) => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(W, H);
    grade.uniforms.uAspect.value = W / H;
  });
  grade.uniforms.uAspect.value = w / h;

  ctx.render = (dt) => composer.render(dt);

  return {
    update(dt, t) {
      grade.uniforms.uTime.value = t % 100;
      const night = ctx.atmo?.night ?? 0;
      const day = ctx.atmo?.day ?? 1;
      // eye adaptation by time of day
      renderer.toneMappingExposure = 1.0 + night * 1.4;
      bloom.strength = 0.2 + 0.14 * night + 0.06 * (1 - day);
      // cooler, less saturated grade at night
      grade.uniforms.uSat.value = 1.06 - 0.3 * night;
    },
  };
}
