// Hero materials: PBR with generated maps, plus a shared onBeforeCompile that adds
// a soft view-space rim light (character pop against busy backgrounds, TP-HD style)
// and, for skin, wrap-lit subsurface warmth.
import * as THREE from 'three';
import * as T from './textures.js';

export const heroUniforms = {
  uRimColor: { value: new THREE.Color(1.0, 0.92, 0.78) },
  uRimStrength: { value: 0.35 },
  uHurtFlash: { value: 0 },
};

function patch(mat, { sss = 0, rim = 1, sssColor = 0xff6a3d, sheen = 0 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = heroUniforms.uRimColor;
    sh.uniforms.uRimStrength = heroUniforms.uRimStrength;
    sh.uniforms.uHurtFlash = heroUniforms.uHurtFlash;
    sh.uniforms.uSss = { value: sss };
    sh.uniforms.uRimK = { value: rim };
    sh.uniforms.uSssColor = { value: new THREE.Color(sssColor) };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uRimColor; uniform float uRimStrength; uniform float uHurtFlash; uniform float uSss; uniform float uRimK; uniform vec3 uSssColor;`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{
  vec3 Vv = normalize(vViewPosition);
  float ndv = clamp(dot(normal, Vv), 0.0, 1.0);
  float rim = pow(1.0 - ndv, 3.0);
  float sunUp = 1.0;
  vec3 sunCol = vec3(1.0);
  float wrapL = 0.0;
  #if NUM_DIR_LIGHTS > 0
    sunCol = directionalLights[0].color;
    vec3 Ld = directionalLights[0].direction;
    float nl = dot(normal, Ld);
    wrapL = clamp((nl + 0.5) / 1.5, 0.0, 1.0) - clamp(nl, 0.0, 1.0);
    // rim strongest on the side facing the light (back/side-lit edges glow)
    float facing = 0.45 + 0.55 * clamp(dot(-Vv, Ld) * 0.5 + 0.5 + nl * 0.5, 0.0, 1.0);
    rim *= facing;
  #endif
  reflectedLight.directDiffuse += uSss * wrapL * sunCol * uSssColor * diffuseColor.rgb * 0.9;
  reflectedLight.indirectDiffuse += rim * uRimStrength * uRimK * uRimColor * (0.35 + 0.65 * diffuseColor.rgb) * (0.6 + 0.4 * length(sunCol) / 1.7);
  reflectedLight.indirectDiffuse += uHurtFlash * vec3(1.0, 0.15, 0.1) * (0.4 + rim);
}`);
  };
  mat.customProgramCacheKey = () => `hero_${sss}_${rim}`;
  return mat;
}

function std(maps, extra = {}, fx = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: maps.map, normalMap: maps.normalMap, roughnessMap: maps.roughnessMap,
    roughness: 1, metalness: 0, ...extra,
  });
  return patch(m, fx);
}

export function buildMaterials(envMap) {
  const navy = T.clothTex(0x2b3a6e, { seed: 1, wear: 0.35 });
  const red = T.woolTex(0x9b2620, { seed: 4 });
  const linen = T.linenTex({ size: 256 });
  const leather = T.leatherTex(0x5a3a22, { seed: 11, size: 512 });
  const skinF = T.skinTex({ face: true, seed: 13 });
  const skinB = T.skinTex({ face: false, seed: 14, size: 256 });
  const hair = T.hairTex({ size: 256 });
  const steel = T.metalTex(0xc8ced8, { rough: 0.22, size: 256 });
  const iron = T.metalTex(0x6d7076, { seed: 44, rough: 0.45, size: 128 });
  const brass = T.brassTex({ size: 128 });
  const shield = T.shieldTex();
  const eye = T.eyeTex({ size: 256 });
  const navyD = navy, redPlain = red, leatherD = leather;
  const M = {
    tunic: std(navy, { side: THREE.DoubleSide }, { rim: 1 }),
    trousers: std(navyD, { color: 0x8890a8 }, { rim: 0.8 }),
    cape: std(red, { side: THREE.DoubleSide }, { rim: 1.2, sss: 0.25, sssColor: 0xff3020 }),
    scarf: std(redPlain, {}, { rim: 1.2, sss: 0.2, sssColor: 0xff3020 }),
    linen: std(linen, {}, { rim: 1, sss: 0.15, sssColor: 0xffd0a0 }),
    leather: std(leather, {}, { rim: 0.7 }),
    leatherDark: std(leatherD, { color: 0x8a7a70 }, { rim: 0.6 }),
    skinFace: std(skinF, {}, { sss: 0.3, rim: 0.7, sssColor: 0xff8a5a }),
    skin: std(skinB, {}, { sss: 0.3, rim: 0.7, sssColor: 0xff8a5a }),
    hair: std(hair, { side: THREE.DoubleSide }, { rim: 1.4 }),
    steel: std(steel, { metalnessMap: steel.roughnessMap, metalness: 1, envMap, envMapIntensity: 1.3 }, { rim: 0.3 }),
    iron: std(iron, { metalnessMap: iron.roughnessMap, metalness: 1, envMap, envMapIntensity: 1.0 }, { rim: 0.4 }),
    brass: std(brass, { metalnessMap: brass.roughnessMap, metalness: 1, envMap, envMapIntensity: 1.2 }, { rim: 0.4 }),
    shield: std(shield, { metalnessMap: shield.roughnessMap, metalness: 1, envMap, envMapIntensity: 1.0 }, { rim: 0.7 }),
    eye: patch(new THREE.MeshPhysicalMaterial({ map: eye.map, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, envMap, envMapIntensity: 0.6 }), { rim: 0.2 }),
    lash: patch(new THREE.MeshStandardMaterial({ color: 0x0d0a10, roughness: 0.7 }), { rim: 0.2 }),
    mouthDark: new THREE.MeshStandardMaterial({ color: 0x2a1410, roughness: 0.9 }),
  };
  return M;
}

// Small gradient sky/ground environment so metals read well even before the
// sky system provides scene.environment.
export function makeEnv(renderer) {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vP; void main(){ vec3 d = normalize(vP);
      vec3 sky = mix(vec3(0.95,0.92,0.85), vec3(0.35,0.55,0.9), smoothstep(0.0,0.6,d.y));
      vec3 gnd = mix(vec3(0.32,0.30,0.22), vec3(0.18,0.2,0.12), smoothstep(0.0,-0.5,d.y));
      vec3 c = d.y > 0.0 ? sky : gnd;
      c += vec3(3.0,2.6,2.0) * pow(max(dot(d, normalize(vec3(0.5,0.6,0.4))),0.0), 64.0);
      gl_FragColor = vec4(c,1.0);}`,
  });
  scene.add(new THREE.Mesh(geo, mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(scene, 0.02);
  pm.dispose(); geo.dispose(); mat.dispose();
  return rt.texture;
}
