// Procedural boulders / rocks: noise-displaced icosahedra with object-space
// triplanar rock texture + normal detail, moss on upward faces, dark contact
// band at the base. Instanced per shape variant.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise2 } from './layout.js';
import { rockSurface, normalMap, noiseTexture } from './textures.js';

function n3(x, y, z) { return (noise2(x + z * 0.71, y - z * 0.37) + noise2(y + 13.1, z + x * 0.53)) * 0.5; }
function rockGeo(seed, flat) {
  let g = new THREE.IcosahedronGeometry(1, 4);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const s = seed * 7.3;
    let d = 1 + 0.32 * n3(v.x * 1.3 + s, v.y * 1.3, v.z * 1.3) + 0.12 * n3(v.x * 3.1, v.y * 3.1 + s, v.z * 3.1) + 0.05 * n3(v.x * 7, v.y * 7, v.z * 7 + s);
    // faceted planes: quantise a little for chiselled look
    v.multiplyScalar(d);
    const cut = 0.55 + 0.25 * Math.abs(noise2(seed, 3.3));
    if (v.y > cut) v.y = cut + (v.y - cut) * 0.35;
    v.x *= 1.25; v.z *= 1.0 + 0.2 * Math.sin(seed); v.y *= flat;
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.4;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function rockMaterial() {
  const m = new THREE.MeshStandardMaterial({ map: rockSurface(), normalMap: normalMap('rockN'), roughness: 0.85, color: 0xe8e2d8 });
  const u = { uMoss: { value: new THREE.Color('#4f6a24') }, uNoise: { value: noiseTexture() } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; varying vec3 vON; varying vec3 vWN; varying float vWY;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vOP = position; vON = normal;
        #ifdef USE_INSTANCING
          vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vWN = normalize(mat3(modelMatrix) * normal);
        #endif
        vWY = position.y;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vOP; varying vec3 vON; varying vec3 vWN; varying float vWY; uniform vec3 uMoss; uniform sampler2D uNoise;`)
      .replace('#include <map_fragment>', `
        vec3 bw = pow(abs(normalize(vON)), vec3(4.0)); bw /= bw.x + bw.y + bw.z;
        vec3 P = vOP * 0.55;
        vec4 tc = texture2D(map, P.zy) * bw.x + texture2D(map, P.xz) * bw.y + texture2D(map, P.xy) * bw.z;
        float mn = texture2D(uNoise, P.xz * 0.6 + P.y * 0.3).r;
        float moss = smoothstep(0.45, 0.8, normalize(vWN).y + (mn - 0.5) * 0.6 + (tc.a - 0.5) * 0.4);
        vec3 rc = tc.rgb * mix(vec3(1.0), vec3(0.75, 0.72, 0.68), smoothstep(0.0, -0.25, vWY));
        diffuseColor.rgb *= mix(rc, uMoss * (0.6 + 0.6 * tc.a), moss * MOSS_AMT);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 tnx = texture2D(normalMap, P.zy).xyz * 2.0 - 1.0, tny = texture2D(normalMap, P.xz).xyz * 2.0 - 1.0, tnz = texture2D(normalMap, P.xy).xyz * 2.0 - 1.0;
        vec3 pertO = vec3(0.0, tnx.y, tnx.x) * bw.x + vec3(tny.x, 0.0, tny.y) * bw.y + vec3(tnz.x, tnz.y, 0.0) * bw.z;
        normal = normalize(normal + (viewMatrix * vec4(pertO * 0.8, 0.0)).xyz);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.82, 0.95, moss * MOSS_AMT);');
    sh.fragmentShader = '#define MOSS_AMT ' + (m.userData.moss ?? 1).toFixed(2) + '\n' + sh.fragmentShader;
  };
  m.customProgramCacheKey = () => 'rock-' + (m.userData.moss ?? 1);
  return m;
}

export function buildRocks(ctx, placements) {
  // placements: [{x,y,z,s,sy,rot,v,moss}]
  const geos = [rockGeo(1, 0.75), rockGeo(2, 0.6), rockGeo(3, 0.9), rockGeo(4, 0.5)];
  const mats = [0.35, 1].map(mo => { const m = rockMaterial(); m.userData.moss = mo; return m; });
  const q = new THREE.Quaternion(), e = new THREE.Euler(), M = new THREE.Matrix4();
  const meshes = [];
  for (let gi = 0; gi < geos.length; gi++) for (let mi = 0; mi < 2; mi++) {
    const list = placements.filter(p => p.v % geos.length === gi && (p.moss ? 1 : 0) === mi);
    if (!list.length) continue;
    const m = new THREE.InstancedMesh(geos[gi], mats[mi], list.length);
    list.forEach((p, i) => {
      e.set((p.tilt || 0), p.rot, (p.tilt2 || 0)); q.setFromEuler(e);
      M.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s, p.s * (p.sy || 1), p.s * (p.sz || 1)));
      m.setMatrixAt(i, M);
    });
    m.castShadow = true; m.receiveShadow = true;
    m.computeBoundingSphere();
    ctx.scene.add(m); meshes.push(m);
  }
  return meshes;
}
