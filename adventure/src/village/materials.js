// Village material library. All materials use vertex colours (per-piece tint) and a
// shared "weathering" shader patch: rising damp / dirt near the wall base (aWall.x),
// soot under the eaves (aWall.y), and moss creeping over up-facing surfaces.
import * as THREE from 'three';
import * as T from './tex.js';

export const shared = { uTime: { value: 0 }, uNight: { value: 0 }, uWind: { value: 1 } };

const NOISE = /* glsl */`
float vh_hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vh_noise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(vh_hash(i+vec3(0,0,0)),vh_hash(i+vec3(1,0,0)),f.x),mix(vh_hash(i+vec3(0,1,0)),vh_hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(vh_hash(i+vec3(0,0,1)),vh_hash(i+vec3(1,0,1)),f.x),mix(vh_hash(i+vec3(0,1,1)),vh_hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
float vh_fbm(vec3 p){ return vh_noise(p)*0.5+vh_noise(p*2.07)*0.3+vh_noise(p*4.3)*0.2; }
`;

// w = { dirt, eave, moss, mossCol, dirtCol, sway }
export function weather(m, w = {}) {
  const u = {
    uDirt: { value: w.dirt ?? 0 }, uEave: { value: w.eave ?? 0 }, uMoss: { value: w.moss ?? 0 },
    uMossCol: { value: new THREE.Color(w.mossCol ?? 0x4c5e22) }, uDirtCol: { value: new THREE.Color(w.dirtCol ?? 0x3d2e1e) },
    uTime: shared.uTime, uWind: shared.uWind,
  };
  m.userData.weather = u;
  const sway = w.sway || 0; // 1 = cloth sway (by uv.y), 2 = plant sway (by local y, instanced)
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec2 aWall; varying vec2 vWall; varying vec3 vWPos; varying vec3 vWNrm;
uniform float uTime; uniform float uWind;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
${sway === 1 ? `{ float k = clamp(1.0 - uv.y, 0.0, 1.0); k = k*k;
  vec4 wq = modelMatrix * vec4(position,1.0);
  float ph = wq.x*0.7 + wq.z*0.5;
  transformed.x += sin(uTime*2.3 + ph)*0.10*k*uWind; transformed.z += (sin(uTime*3.1 + ph*1.3)*0.18 + 0.12)*k*uWind; }` : ''}
${sway === 2 ? `{ float k = max(position.y, 0.0); k = k*k;
  #ifdef USE_INSTANCING
  vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
  #else
  vec3 ip = vec3(0.0);
  #endif
  float ph = ip.x*0.35 + ip.z*0.25;
  float wv = sin(uTime*1.7 + ph) * 0.6 + sin(uTime*3.7 + ph*2.1)*0.25;
  transformed.x += wv*0.12*k*uWind; transformed.z += wv*0.07*k*uWind; }` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 wp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  #endif
  wp = modelMatrix * wp; vWPos = wp.xyz;
  vec3 on = objectNormal;
  #ifdef USE_INSTANCING
  on = mat3(instanceMatrix) * on;
  #endif
  vWNrm = normalize(mat3(modelMatrix) * on); vWall = aWall; }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vWall; varying vec3 vWPos; varying vec3 vWNrm;
uniform float uDirt; uniform float uEave; uniform float uMoss; uniform vec3 uMossCol; uniform vec3 uDirtCol;
${NOISE}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  float n1 = vh_fbm(vWPos*1.3);
  float n2 = vh_fbm(vWPos*0.35 + 11.0);
  float hb = vWPos.y - vWall.x;
  float dirt = (1.0 - smoothstep(0.0, 1.4, hb + (n1-0.5)*0.9)) * uDirt;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*uDirtCol*2.2, dirt);
  float eave = smoothstep(-1.6, 0.0, vWPos.y - vWall.y) * uEave;
  diffuseColor.rgb *= 1.0 - eave*0.45*(0.7+0.6*n2);
  float up = vWNrm.y;
  float moss = smoothstep(0.35, 0.85, up + (n2-0.5)*0.9 + (n1-0.5)*0.4) * uMoss;
  moss += (1.0 - smoothstep(0.0, 0.9, hb + (n1-0.5)*1.2)) * uMoss * 0.6;
  moss = clamp(moss * smoothstep(0.35, 0.6, n2 + 0.15), 0.0, 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, uMossCol*(0.7+0.6*n1), moss);
}`);
  };
  m.customProgramCacheKey = () => 'vw' + sway + (w.dirt ? 'd' : '') + (w.moss ? 'm' : '') + (w.eave ? 'e' : '');
  return m;
}

function std(t, extra = {}) {
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, vertexColors: true, ...extra });
}

export function makeMaterials() {
  const M = {};
  M.wood = weather(std(T.woodTex('dark'), { normalScale: new THREE.Vector2(0.9, 0.9) }), { dirt: 0.5, moss: 0.25 });
  M.woodLight = weather(std(T.woodTex('light')), { dirt: 0.4, moss: 0.2 });
  M.plank = weather(std(T.plankTex('warm')), { dirt: 0.6, moss: 0.25 });
  M.plankGrey = weather(std(T.plankTex('grey')), { dirt: 0.6, moss: 0.35 });
  M.plankRed = weather(std(T.plankTex('red')), { dirt: 0.7, moss: 0.2 });
  M.plaster = weather(std(T.plasterTex(), { normalScale: new THREE.Vector2(0.7, 0.7) }), { dirt: 1.0, eave: 0.8, moss: 0.15 });
  M.stone = weather(std(T.stoneTex(), { normalScale: new THREE.Vector2(1.2, 1.2) }), { dirt: 0.4, moss: 0.6 });
  M.ruin = weather(std(T.ruinTex(), { normalScale: new THREE.Vector2(1.3, 1.3) }), { dirt: 0.5, moss: 1.0, mossCol: 0x4a5c20 });
  M.cobble = weather(std(T.cobbleTex(), { normalScale: new THREE.Vector2(1.2, 1.2) }), { moss: 0.12 });
  M.thatch = weather(std(T.thatchTex(), { normalScale: new THREE.Vector2(1.4, 1.4) }), { moss: 0.12, mossCol: 0x55602a });
  M.shingle = weather(std(T.shingleTex()), { moss: 0.3 });
  M.slate = weather(std(T.slateTex(), { normalScale: new THREE.Vector2(1.1, 1.1) }), { moss: 0.25 });
  M.redtile = weather(std(T.redTileTex()), { moss: 0.3 });
  M.soil = weather(std(T.soilTex(), { normalScale: new THREE.Vector2(1.5, 1.5) }), {});
  M.hay = weather(std(T.thatchTex()), {});
  M.flower = weather(new THREE.MeshStandardMaterial({ roughness: 0.8, vertexColors: true }), {});
  M.water = new THREE.MeshStandardMaterial({ color: 0x0c1a18, roughness: 0.05, metalness: 0.0, vertexColors: true });
  M.canvas = new THREE.MeshStandardMaterial({ map: T.clothTex().map, normalMap: T.clothTex().normalMap, roughness: 0.95, vertexColors: true, side: THREE.DoubleSide });
  M.iron = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.55, metalness: 0.75, vertexColors: true });
  M.rope = new THREE.MeshStandardMaterial({ color: 0x8a7550, roughness: 1, vertexColors: true });
  const cl = T.clothTex();
  M.cloth = weather(new THREE.MeshStandardMaterial({ map: cl.map, normalMap: cl.normalMap, roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }), { sway: 1 });
  M.cloth.userData.noShadow = false;
  const p = T.pathTex();
  M.path = new THREE.MeshStandardMaterial({ map: p.map, normalMap: p.normalMap, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, vertexColors: true });
  M.path.userData.noShadow = true;
  const w = T.windowTex();
  M.window = new THREE.MeshStandardMaterial({ map: w.day, emissiveMap: w.glow, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.15, metalness: 0.3, vertexColors: true });
  M.window.userData.noShadow = true;
  M.lamp = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb050, emissiveIntensity: 0.3, roughness: 0.4, vertexColors: true });
  M.lamp.userData.noShadow = true;
  M.sign = new THREE.MeshStandardMaterial({ map: T.signTex(), roughness: 0.8, vertexColors: true });
  M.glyph = new THREE.MeshStandardMaterial({ color: 0x102030, emissive: 0x6fd8ff, emissiveIntensity: 1.6, roughness: 0.4, vertexColors: true });
  M.glyph.userData.noShadow = true;
  return M;
}

export function plantMaterial(kind) {
  const m = new THREE.MeshStandardMaterial({ map: T.cropTex(kind), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, vertexColors: false });
  return weather(m, { sway: 2 });
}
