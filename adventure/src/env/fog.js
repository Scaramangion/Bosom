// Atmospheric height fog with sun in-scattering (aerial perspective).
// Replaces three's fog chunks globally so EVERY material (built-in or ShaderMaterial
// with fog:true) gets the same fog as the sky horizon. Must be installed before any
// material compiles (env/lighting.js init runs first).
//
// scene.fog must be a THREE.FogExp2: fogDensity = extinction per metre at height
// fogHeight.y; fog thins exponentially with altitude (falloff fogHeight.x).
import * as THREE from 'three';

function shared(v) { v.clone = function () { return this; }; return v; }
export const fogUniforms = {
  fogSunDir: { value: shared(new THREE.Vector3(0, 1, 0)) },
  fogSunColor: { value: shared(new THREE.Color(0, 0, 0)) },
  fogHeight: { value: shared(new THREE.Vector2(0.018, 0.0)) }, // x: falloff /m, y: base height
};

let installed = false;
export function installFog() {
  if (installed) return fogUniforms;
  installed = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogWorldPos;
#endif`;
  C.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogWorldPos = transpose( mat3( viewMatrix ) ) * mvPosition.xyz + cameraPosition;
#endif`;
  C.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  uniform vec3 fogSunColor;
  uniform vec3 fogSunDir;
  uniform vec2 fogHeight;
  varying float vFogDepth;
  varying vec3 vFogWorldPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  vec3 atmosFog( vec3 col ) {
    vec3 fogRay = vFogWorldPos - cameraPosition;
    float fogDist = length( fogRay );
    vec3 fogDir = fogRay / max( fogDist, 1e-4 );
    #ifdef FOG_EXP2
      float fk = fogHeight.x;
      float od;
      if ( fk > 0.0 ) {
        float y0 = max( cameraPosition.y - fogHeight.y, -30.0 );
        float dy = fogRay.y * fk;
        float ht = abs( dy ) > 1e-3 ? ( 1.0 - exp( - dy ) ) / dy : 1.0 - 0.5 * dy;
        od = fogDensity * exp( - fk * y0 ) * ht * fogDist;
      } else {
        od = fogDensity * fogDist;
      }
      float fogFactor = 1.0 - exp( - od );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    float sunAmt = pow( max( dot( fogDir, fogSunDir ), 0.0 ), 6.0 );
    vec3 fc = fogColor + fogSunColor * sunAmt;
    return mix( col, fc, fogFactor );
  }
#endif`;
  C.fog_fragment = /* glsl */`
#ifdef USE_FOG
  gl_FragColor.rgb = atmosFog( gl_FragColor.rgb );
#endif`;
  // attach shared extra uniforms to every built-in shader that has fog
  Object.assign(THREE.UniformsLib.fog, fogUniforms);
  for (const k of Object.keys(THREE.ShaderLib)) {
    const u = THREE.ShaderLib[k].uniforms;
    if (u && u.fogColor) Object.assign(u, fogUniforms);
  }
  return fogUniforms;
}
