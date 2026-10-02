// Shared atmosphere model (owned by env/atmosphere builder).
// One analytic single-scattering sky model evaluated identically in JS (for
// light / fog / hemisphere colours) and in GLSL (sky dome, water reflections),
// so fog, sky horizon and light colour always agree.
import * as THREE from 'three';

// Rayleigh wavelength ratios (~ lambda^-4 for 680/550/440 nm, normalised to blue)
export const ATM = {
  BR: [0.07, 0.22, 1.0],
  TAUR: 0.30,   // zenith rayleigh optical depth (blue)
  TAUM: 0.015,  // zenith aerosol (mie) optical depth (grey)
  G: 0.78,      // mie anisotropy
  E: 12.0,      // sky radiance scale (scene-linear HDR)
  VCAP: 7.0,    // view-path airmass cap (keeps the horizon from bleaching out)
};

export const ATMOSPHERE_GLSL = /* glsl */`
const vec3 ATM_BR = vec3(${ATM.BR.map(v => v.toFixed(4)).join(',')});
const float ATM_TAUR = ${ATM.TAUR.toFixed(4)};
const float ATM_TAUM = ${ATM.TAUM.toFixed(4)};
const float ATM_G = ${ATM.G.toFixed(4)};
const float ATM_E = ${ATM.E.toFixed(4)};
const float ATM_VCAP = ${ATM.VCAP.toFixed(4)};
float atmAirmass(float c) { c = max(c, 0.0); return 1.0 / (c + 0.025 * exp(-11.0 * c)); }
float atmPhaseR(float mu) { return 0.0596831 * (1.0 + mu * mu); }
float atmPhaseM(float mu, float g) { float g2 = g * g; return 0.0795775 * (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * mu, 1e-4), 1.5); }
// radiance of clear sky in direction v (v.y >= 0) lit by a source of colour srcT from direction s
vec3 atmSky(vec3 v, vec3 s, vec3 srcT) {
  float mu = dot(v, s);
  vec3 sR = ATM_BR * ATM_TAUR;
  vec3 ext = sR + ATM_TAUM;
  vec3 od = ext * min(atmAirmass(max(v.y, 0.0)), ATM_VCAP);
  vec3 scat = (sR * atmPhaseR(mu) + ATM_TAUM * atmPhaseM(mu, ATM_G)) / ext * (1.0 - exp(-od));
  // cheap multiple-scattering fill so the sky never goes black-blue at the zenith
  vec3 ms = sR * 0.035 * (1.0 - exp(-od * 2.0)) / ext;
  return srcT * (scat + ms) * ATM_E;
}
`;

// ---- JS twin --------------------------------------------------------------
function airmass(c) { c = Math.max(c, 0); return 1 / (c + 0.025 * Math.exp(-11 * c)); }
function phaseR(mu) { return 0.0596831 * (1 + mu * mu); }
function phaseM(mu, g) { const g2 = g * g; return 0.0795775 * (1 - g2) / Math.pow(Math.max(1 + g2 - 2 * g * mu, 1e-4), 1.5); }

/** transmittance of sunlight arriving at elevation cosine c */
export function sunTransmittance(c, out = new THREE.Color()) {
  const m = airmass(c);
  out.r = Math.exp(-(ATM.BR[0] * ATM.TAUR + ATM.TAUM) * m);
  out.g = Math.exp(-(ATM.BR[1] * ATM.TAUR + ATM.TAUM) * m);
  out.b = Math.exp(-(ATM.BR[2] * ATM.TAUR + ATM.TAUM) * m);
  return out;
}

/** sky radiance (same as GLSL atmSky) */
export function skyRadiance(v, s, srcT, out = new THREE.Color()) {
  const mu = v.x * s.x + v.y * s.y + v.z * s.z;
  const am = Math.min(airmass(Math.max(v.y, 0)), ATM.VCAP);
  const pr = phaseR(mu), pm = phaseM(mu, ATM.G);
  const ch = ['r', 'g', 'b'];
  for (let i = 0; i < 3; i++) {
    const sR = ATM.BR[i] * ATM.TAUR, ext = sR + ATM.TAUM, od = ext * am;
    const scat = (sR * pr + ATM.TAUM * pm) / ext * (1 - Math.exp(-od));
    const ms = sR * 0.035 * (1 - Math.exp(-od * 2)) / ext;
    out[ch[i]] = srcT[ch[i]] * (scat + ms) * ATM.E;
  }
  return out;
}

// --- shared tileable noise texture (RGBA = 4 independent tileable value-noise fbm fields)
let _noiseTex = null;
export function getNoiseTexture() {
  if (_noiseTex) return _noiseTex;
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const lat = (p, seed) => { // periodic lattice hash
    const out = new Float32Array(p * p);
    let s = seed * 9301 + 49297;
    for (let i = 0; i < p * p; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; out[i] = s / 0x7fffffff; }
    return out;
  };
  const sm = t => t * t * t * (t * (t * 6 - 15) + 10);
  for (let c = 0; c < 4; c++) {
    const field = new Float32Array(N * N);
    let amp = 0.5, tot = 0;
    for (let o = 0; o < 5; o++) {
      const p = 4 << o; // 4..64 lattice cells, period N
      const L = lat(p, c * 31 + o * 7 + 1);
      for (let y = 0; y < N; y++) {
        const fy = y / N * p, yi = Math.floor(fy), ty = sm(fy - yi), y0 = yi % p, y1 = (yi + 1) % p;
        for (let x = 0; x < N; x++) {
          const fx = x / N * p, xi = Math.floor(fx), tx = sm(fx - xi), x0 = xi % p, x1 = (xi + 1) % p;
          const a = L[y0 * p + x0], b = L[y0 * p + x1], cc = L[y1 * p + x0], d = L[y1 * p + x1];
          field[y * N + x] += amp * ((a + (b - a) * tx) * (1 - ty) + (cc + (d - cc) * tx) * ty);
        }
      }
      tot += amp; amp *= 0.5;
    }
    for (let i = 0; i < N * N; i++) data[i * 4 + c] = Math.max(0, Math.min(255, Math.round(field[i] / tot * 255)));
  }
  // contrast-stretch each channel to full range
  for (let c = 0; c < 4; c++) {
    let lo = 255, hi = 0;
    for (let i = 0; i < N * N; i++) { const v = data[i * 4 + c]; if (v < lo) lo = v; if (v > hi) hi = v; }
    for (let i = 0; i < N * N; i++) data[i * 4 + c] = Math.round((data[i * 4 + c] - lo) / Math.max(1, hi - lo) * 255);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  _noiseTex = tex;
  return tex;
}
