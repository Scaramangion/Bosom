// Audio — WebAudio graph: day/night music crossfade, procedural ambience (wind, birds,
// crickets, water), synthesized positional SFX. Starts on the first user gesture and
// never throws when no audio device exists (headless).
// Service: ctx.audio { setVolume(bus, v), play(name, detail), unlocked, context }
import { heightAt as layoutHeightAt, riverDist, LANDMARKS, WATER_LEVEL, noise2 } from '../world/layout.js';

const BUSES = ['master', 'music', 'sfx', 'ambience'];

export function init(ctx) {
  const vols = { master: 0.8, music: 0.7, sfx: 1, ambience: 1 };
  try { for (const k of BUSES) { const v = JSON.parse(localStorage.getItem('koto.vol.' + k)); if (Number.isFinite(v)) vols[k] = v; } } catch { }

  let ac = null, out = null, bus = {}, reverb = null, musicLP = null;
  let music = null, wind = null, water = null;
  let noiseBuf = null, brownBuf = null;
  let birdTimer = 2, cricketTimer = 1, waterProbeT = 0, heartbeatT = 0;
  let paused = false, lowHealth = false, unlocked = false;

  const api = {
    get unlocked() { return unlocked; },
    get context() { return ac; },
    setVolume(k, v) {
      if (!(k in vols)) return;
      vols[k] = Math.max(0, Math.min(1, +v || 0));
      if (bus[k]) bus[k].gain.setTargetAtTime(busGain(k), ac.currentTime, 0.05);
    },
    play(name, detail) { try { SFX[name]?.(detail); } catch (e) { /* never break gameplay over audio */ } },
  };
  ctx.audio = api;
  const busGain = k => k === 'master' ? vols.master * vols.master : vols[k] * (k === 'music' ? 0.55 : 1);

  // ---------------- unlock on gesture ----------------
  function unlock() {
    if (unlocked) { if (ac?.state === 'suspended') ac.resume().catch(() => { }); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC({ latencyHint: 'interactive' });
      buildGraph();
      unlocked = true;
      ac.resume?.().catch?.(() => { });
      loadMusic();
      startAmbience();
      ctx.emit?.('audio-ready');
    } catch (e) { console.warn('[audio] disabled:', e?.message || e); ac = null; }
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });

  function buildGraph() {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
    comp.connect(ac.destination);
    bus.master = ac.createGain(); bus.master.gain.value = busGain('master'); bus.master.connect(comp);
    for (const k of ['music', 'sfx', 'ambience']) { bus[k] = ac.createGain(); bus[k].gain.value = busGain(k); }
    musicLP = ac.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 20000; musicLP.Q.value = 0.5;
    bus.music.connect(musicLP); musicLP.connect(bus.master);
    bus.sfx.connect(bus.master); bus.ambience.connect(bus.master);
    // synthetic hall reverb
    reverb = ac.createConvolver(); reverb.buffer = makeImpulse(2.6, 2.4);
    const rvOut = ac.createGain(); rvOut.gain.value = 0.42; reverb.connect(rvOut); rvOut.connect(bus.master);
    noiseBuf = makeNoise('white', 3); brownBuf = makeNoise('brown', 4);
    // listener defaults
    const L = ac.listener;
    if (L.forwardX) { L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
  }
  function makeNoise(kind, secs) {
    const n = Math.floor(ac.sampleRate * secs);
    const b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let last = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
      }
      // crossfade loop seam
      const f = Math.min(2048, n >> 3);
      for (let i = 0; i < f; i++) { const k = i / f; d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k; }
    }
    return b;
  }
  function makeImpulse(secs, decay) {
    const n = Math.floor(ac.sampleRate * secs);
    const b = ac.createBuffer(2, n, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) { const t = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (i < 200 ? i / 200 : 1); }
    }
    return b;
  }

  // ---------------- music ----------------
  async function loadMusic() {
    const load = async url => {
      const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
      const ab = await r.arrayBuffer();
      return await new Promise((res, rej) => { const p = ac.decodeAudioData(ab, res, rej); p?.then?.(res, rej); });
    };
    try {
      const [day, night] = await Promise.all([load('/fog_score_day.mp3'), load('/fog_score_night.mp3')]);
      const mk = buf => {
        const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
        const gn = ac.createGain(); gn.gain.value = 0; s.connect(gn); gn.connect(bus.music);
        return { s, g: gn };
      };
      const d = mk(day), n = mk(night);
      const t0 = ac.currentTime + 0.1;
      d.s.start(t0); n.s.start(t0);
      music = { day: d, night: n, mix: -1 };
    } catch (e) { console.warn('[audio] music unavailable:', e?.message || e); }
  }
  function nightness() {
    const t = getTod();
    // 0 at day, 1 at night with soft dusk/dawn transitions
    const s = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    return Math.max(1 - s(0.2, 0.3, t), s(0.72, 0.82, t));
  }
  function getTod() {
    const v = ctx.timeOfDay ?? ctx.tod ?? ctx.sky?.tod ?? ctx.lighting?.tod ?? ctx.shot?.tod;
    return Number.isFinite(v) ? v : 0.4;
  }

  // ---------------- ambience ----------------
  function loopNoise(buf, rate = 1) { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.loopStart = Math.random(); return s; }
  function startAmbience() {
    // wind: two brown-noise layers, bandpassed, panned apart
    const mkLayer = (freq, pan) => {
      const s = loopNoise(brownBuf, 0.9 + Math.random() * 0.2);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.7;
      const gn = ac.createGain(); gn.gain.value = 0;
      const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
      s.connect(bp); bp.connect(gn);
      if (p) { p.pan.value = pan; gn.connect(p); p.connect(bus.ambience); } else gn.connect(bus.ambience);
      s.start(ac.currentTime + Math.random() * 0.1, Math.random() * 2);
      return { bp, g: gn, p, base: freq };
    };
    const hiss = (() => { // airy high hiss for strong gusts
      const s = loopNoise(noiseBuf);
      const hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 5200; hp.Q.value = 0.4;
      const gn = ac.createGain(); gn.gain.value = 0; s.connect(hp); hp.connect(gn); gn.connect(bus.ambience); s.start();
      return { g: gn, bp: hp };
    })();
    wind = { a: mkLayer(380, -0.6), b: mkLayer(620, 0.6), hiss };

    // water: brown rumble + bubbly bandpassed white noise, positional
    const panner = mkPanner(12, 120);
    const wg = ac.createGain(); wg.gain.value = 0;
    const s1 = loopNoise(brownBuf, 1.3); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const s2 = loopNoise(noiseBuf); const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.6;
    const g2 = ac.createGain(); g2.gain.value = 0.18;
    s1.connect(lp); lp.connect(wg); s2.connect(bp); bp.connect(g2); g2.connect(wg);
    wg.connect(panner); panner.connect(bus.ambience);
    s1.start(); s2.start();
    water = { panner, g: wg, bp, g2, target: 0, pos: { x: 0, y: 0, z: 0 } };
  }
  function mkPanner(ref = 4, max = 80) {
    const p = ac.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = 1.1;
    return p;
  }
  function setPos(p, x, y, z) {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  }

  // ---------------- synthesis helpers ----------------
  function env(gainNode, t, a, peak, d, sustain = 0.0001) {
    const gp = gainNode.gain;
    gp.cancelScheduledValues(t); gp.setValueAtTime(0.0001, t);
    gp.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    gp.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
  }
  // destination for a one-shot: positional if position given (and not at the listener), plus reverb send
  function dest(position, rv = 0.2, ref = 3) {
    const g0 = ac.createGain();
    let tail = g0;
    if (position && Number.isFinite(position.x)) {
      const p = mkPanner(ref, 120); setPos(p, position.x, (position.y ?? 0) + 1, position.z);
      g0.connect(p); tail = p;
    }
    tail.connect(bus.sfx);
    if (rv > 0) { const s = ac.createGain(); s.gain.value = rv; tail.connect(s); s.connect(reverb); }
    // auto-disconnect after 3s
    setTimeout(() => { try { g0.disconnect(); tail.disconnect(); } catch { } }, 3000);
    return g0;
  }
  function noiseShot(t, dur, out, filters = [], buf = noiseBuf) {
    const s = ac.createBufferSource(); s.buffer = buf;
    let node = s;
    for (const f of filters) { node.connect(f); node = f; }
    const g = ac.createGain(); node.connect(g); g.connect(out);
    s.start(t, Math.random() * (buf.duration - dur - 0.05)); s.stop(t + dur + 0.05);
    return g;
  }
  function osc(type, t, dur, out, f0, f1) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
    return { o, g };
  }
  function biquad(type, f, q = 1) { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  let crunchCurve = null;
  function shaper() {
    if (!crunchCurve) { crunchCurve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; crunchCurve[i] = Math.tanh(x * 6) * 0.9; } }
    const w = ac.createWaveShaper(); w.curve = crunchCurve; w.oversample = '2x'; return w;
  }
  const posOf = d => d?.position || d?.point || d?.pos || (Number.isFinite(d?.x) ? d : null);
  const heroP = () => ctx.hero?.position || ctx.hero?.root?.position || null;

  function surfaceAt(p) {
    if (!p) return 'grass';
    const h = (ctx.terrain?.heightAt || layoutHeightAt)(p.x, p.z);
    const wl = ctx.water?.level ?? WATER_LEVEL;
    if (ctx.water?.isWater?.(p.x, p.z) || h < wl + 0.05) return 'water';
    const V = LANDMARKS.village;
    if (Math.hypot(p.x - V.x, p.z - V.z) < V.r * 0.8) return 'stone';
    const S = LANDMARKS.shrine;
    if (Math.hypot(p.x - S.x, p.z - S.z) < S.r) return 'stone';
    if (h > 40) return 'stone';
    return 'grass';
  }

  // ---------------- SFX ----------------
  const SFX = {
    footstep(d) {
      if (!ac) return;
      const t = ac.currentTime;
      const p = posOf(d);
      const surf = d?.surface || surfaceAt(p || heroP());
      const hp = heroP();
      const isHero = !p || !hp || Math.hypot(p.x - hp.x, p.z - hp.z) < 0.8;
      const o = dest(isHero ? null : p, 0.04, 2);
      const vol = (d?.volume ?? 1) * (isHero ? 0.55 : 0.8);
      const pitch = 0.85 + Math.random() * 0.3;
      if (surf === 'stone') {
        const g = noiseShot(t, 0.05, o, [biquad('highpass', 1400 * pitch), biquad('peaking', 3200, 2)]); env(g, t, 0.002, 0.35 * vol, 0.045);
        const th = osc('sine', t, 0.08, o, 140 * pitch, 60); env(th.g, t, 0.003, 0.5 * vol, 0.07);
      } else if (surf === 'water') {
        const bp = biquad('bandpass', 1800 * pitch, 1.2); bp.frequency.setValueAtTime(2200 * pitch, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.18);
        const g = noiseShot(t, 0.22, o, [bp]); env(g, t, 0.01, 0.6 * vol, 0.2);
      } else {
        // grass: soft brush + a few crunchy grains
        const g = noiseShot(t, 0.11, o, [biquad('bandpass', 2600 * pitch, 0.7), biquad('highshelf', 5000, 1)]); env(g, t, 0.012, 0.22 * vol, 0.1);
        for (let i = 0; i < 3; i++) {
          const tt = t + 0.008 + Math.random() * 0.05;
          const gg = noiseShot(tt, 0.02, o, [biquad('bandpass', 3500 + Math.random() * 3000, 3)]); env(gg, tt, 0.001, 0.18 * vol, 0.018);
        }
        const th = osc('sine', t, 0.06, o, 90 * pitch, 50); env(th.g, t, 0.004, 0.25 * vol, 0.05);
      }
    },
    swing(d) {
      if (!ac) return;
      const t = ac.currentTime;
      const o = dest(null, 0.12);
      const power = d?.power ?? d?.combo ?? 1;
      const dur = 0.26 + 0.04 * Math.min(2, power - 1);
      const bp = biquad('bandpass', 500, 2.2);
      bp.frequency.setValueAtTime(450, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.45); bp.frequency.exponentialRampToValueAtTime(700, t + dur);
      const g = noiseShot(t, dur, o, [bp]);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const sh = osc('sine', t + 0.03, 0.3, o, 2100 + Math.random() * 300, 1500); env(sh.g, t + 0.03, 0.01, 0.035, 0.28);
    },
    hit(d) {
      if (!ac) return;
      const t = ac.currentTime;
      const o = dest(posOf(d), 0.3, 4);
      const k = d?.crit ? 1.3 : 1;
      // body thump
      const th = osc('sine', t, 0.16, o, 170, 42); env(th.g, t, 0.002, 1.0 * k, 0.15);
      // crunch
      const cr = noiseShot(t, 0.09, o, [biquad('bandpass', 1700, 0.9), shaper(), biquad('lowpass', 6000)]); env(cr, t, 0.001, 0.7 * k, 0.08);
      // bright crack
      const ck = noiseShot(t, 0.03, o, [biquad('highpass', 3000)]); env(ck, t, 0.0008, 0.6, 0.025);
      // metallic ring
      for (const f of [1230, 1871, 2957]) { const m = osc('sine', t, 0.32, o, f * (0.97 + Math.random() * 0.06)); env(m.g, t, 0.002, 0.07, 0.3); }
    },
    rupee() {
      if (!ac) return;
      const t = ac.currentTime;
      const o = dest(null, 0.55);
      const notes = [1318.5, 1661.2, 1975.5, 2637];
      notes.forEach((f, i) => {
        const tt = t + i * 0.065;
        const a = osc('sine', tt, 0.7, o, f); env(a.g, tt, 0.004, 0.22, 0.65);
        const b = osc('sine', tt, 0.4, o, f * 2.756); env(b.g, tt, 0.002, 0.05, 0.35);
      });
      const sp = noiseShot(t + 0.2, 0.35, o, [biquad('highpass', 7000)]); env(sp, t + 0.2, 0.02, 0.08, 0.3);
    },
    hurt() {
      if (!ac) return;
      const t = ac.currentTime;
      const o = dest(null, 0.15);
      const th = osc('sine', t, 0.25, o, 240, 70); env(th.g, t, 0.003, 0.9, 0.24);
      const gr = osc('sawtooth', t, 0.18, o, 180, 120); const lp = biquad('lowpass', 900); gr.g.disconnect(); gr.g.connect(lp); lp.connect(o); env(gr.g, t, 0.005, 0.25, 0.16);
      const ns = noiseShot(t, 0.12, o, [biquad('lowpass', 1400), shaper()]); env(ns, t, 0.002, 0.5, 0.1);
      const st = osc('triangle', t + 0.02, 0.35, o, 622); env(st.g, t + 0.02, 0.005, 0.06, 0.33);
      const st2 = osc('triangle', t + 0.02, 0.35, o, 659); env(st2.g, t + 0.02, 0.005, 0.05, 0.33);
    },
    kill(d) {
      if (!ac) return;
      const t = ac.currentTime;
      const o = dest(posOf(d), 0.45, 5);
      const bp = biquad('bandpass', 2000, 0.8); bp.frequency.setValueAtTime(3000, t); bp.frequency.exponentialRampToValueAtTime(300, t + 0.5);
      const g = noiseShot(t, 0.55, o, [bp]); env(g, t, 0.01, 0.6, 0.5);
      const b = osc('sine', t, 0.4, o, 110, 38); env(b.g, t, 0.004, 0.8, 0.38);
      [880, 1108.7, 1318.5].forEach((f, i) => { const s = osc('sine', t + 0.18 + i * 0.05, 0.5, o, f); env(s.g, t + 0.18 + i * 0.05, 0.005, 0.06, 0.45); });
    },
    heartbeat() {
      if (!ac) return;
      const t = ac.currentTime;
      const o = dest(null, 0);
      for (const [dt, a] of [[0, 0.55], [0.22, 0.38]]) { const b = osc('sine', t + dt, 0.14, o, 75, 42); env(b.g, t + dt, 0.006, a, 0.13); }
    },
    uiOpen() {
      if (!ac) return;
      const t = ac.currentTime; const o = dest(null, 0.5);
      [659.3, 987.8].forEach((f, i) => { const s = osc('sine', t + i * 0.08, 0.6, o, f); env(s.g, t + i * 0.08, 0.006, 0.12, 0.55); });
    },
    uiClose() {
      if (!ac) return;
      const t = ac.currentTime; const o = dest(null, 0.5);
      [987.8, 659.3].forEach((f, i) => { const s = osc('sine', t + i * 0.07, 0.5, o, f); env(s.g, t + i * 0.07, 0.006, 0.1, 0.45); });
    },
    title() {
      if (!ac) return;
      const t = ac.currentTime; const o = dest(null, 0.8);
      [392, 587.3, 784, 1174.7].forEach((f, i) => {
        const s = osc('sine', t + i * 0.11, 1.6, o, f); env(s.g, t + i * 0.11, 0.01, 0.13, 1.5);
        const h = osc('triangle', t + i * 0.11, 0.8, o, f * 2); env(h.g, t + i * 0.11, 0.01, 0.025, 0.7);
      });
    },
  };

  // ---------------- birds & night creatures ----------------
  function bird(listenerPos, inForest) {
    const t = ac.currentTime;
    const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 26;
    const p = { x: listenerPos.x + Math.cos(a) * r, y: listenerPos.y + 4 + Math.random() * 9, z: listenerPos.z + Math.sin(a) * r };
    const o = ac.createGain(); o.gain.value = 0.55 * (inForest ? 1.2 : 1);
    const pan = mkPanner(6, 90); setPos(pan, p.x, p.y, p.z); o.connect(pan); pan.connect(bus.ambience);
    const s = ac.createGain(); s.gain.value = 0.18; pan.connect(s); s.connect(reverb);
    setTimeout(() => { try { o.disconnect(); pan.disconnect(); } catch { } }, 4000);
    const kind = Math.random();
    const base = 2400 + Math.random() * 1800;
    if (kind < 0.4) { // warbler: quick rising/falling notes
      const n = 3 + (Math.random() * 5 | 0);
      for (let i = 0; i < n; i++) {
        const tt = t + i * (0.07 + Math.random() * 0.05);
        const f0 = base * (0.85 + Math.random() * 0.4), f1 = f0 * (Math.random() < 0.5 ? 1.35 : 0.75);
        const v = osc('sine', tt, 0.07, o, f0, f1); env(v.g, tt, 0.006, 0.12, 0.06);
      }
    } else if (kind < 0.7) { // two-note whistle (fee-bee)
      const f = 3000 + Math.random() * 900;
      const a1 = osc('sine', t, 0.32, o, f, f * 0.98); env(a1.g, t, 0.03, 0.13, 0.28);
      const a2 = osc('sine', t + 0.38, 0.36, o, f * 0.84, f * 0.8); env(a2.g, t + 0.38, 0.03, 0.11, 0.32);
    } else { // trill
      const v = osc('sine', t, 0.6, o, base * 1.1, base * 0.9);
      const am = ac.createOscillator(); am.frequency.value = 26 + Math.random() * 14;
      const amg = ac.createGain(); amg.gain.value = 0.5; am.connect(amg); amg.connect(v.g.gain);
      v.g.gain.setValueAtTime(0.0001, t); v.g.gain.linearRampToValueAtTime(0.07, t + 0.08); v.g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      am.start(t); am.stop(t + 0.7);
    }
  }
  function cricket(listenerPos) {
    const t = ac.currentTime;
    const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 16;
    const o = ac.createGain(); o.gain.value = 0.5;
    const pan = mkPanner(3, 40); setPos(pan, listenerPos.x + Math.cos(a) * r, listenerPos.y - 1, listenerPos.z + Math.sin(a) * r);
    o.connect(pan); pan.connect(bus.ambience);
    setTimeout(() => { try { o.disconnect(); pan.disconnect(); } catch { } }, 3000);
    const f = 4300 + Math.random() * 700;
    const pulses = 3 + (Math.random() * 3 | 0);
    for (let i = 0; i < pulses; i++) { const tt = t + i * 0.05; const v = osc('sine', tt, 0.03, o, f); env(v.g, tt, 0.004, 0.05, 0.025); }
    if (Math.random() < 0.06) { // distant owl
      for (const dt of [0.5, 0.95]) { const v = osc('sine', t + dt, 0.4, o, 390, 360); env(v.g, t + dt, 0.06, 0.12, 0.33); }
    }
  }

  // ---------------- events ----------------
  const on = (n, fn) => ctx.on(n, d => { try { fn(d); } catch (e) { /* audio must never break gameplay */ } });
  on('footstep', d => SFX.footstep(d));
  on('swing', d => SFX.swing(d));
  on('hit', d => SFX.hit(d));
  on('rupee', d => SFX.rupee(d));
  on('hero-hurt', d => SFX.hurt(d));
  on('enemy-killed', d => SFX.kill(d));
  on('low-health', d => { lowHealth = !!d?.low; heartbeatT = 0.3; });
  on('title-dismissed', () => setTimeout(() => SFX.title(), 60));
  on('pause', d => {
    paused = !!d?.paused;
    if (!ac) return;
    const t = ac.currentTime;
    musicLP.frequency.setTargetAtTime(paused ? 700 : 20000, t, paused ? 0.15 : 0.3);
    bus.ambience.gain.setTargetAtTime(paused ? busGain('ambience') * 0.25 : busGain('ambience'), t, 0.2);
    (paused ? SFX.uiOpen : SFX.uiClose)();
  });

  // ---------------- per-frame ----------------
  const fwd = ctx.THREE ? new ctx.THREE.Vector3() : null;
  return {
    update(dt, t) {
      if (!ac || !unlocked) return;
      try {
        const now = ac.currentTime;
        const cam = ctx.camera;
        const L = ac.listener;
        const lp = heroP() || cam.position;
        // listener sits at the camera but slightly pulled toward the hero (third-person mix)
        const lx = cam.position.x * 0.6 + lp.x * 0.4, ly = cam.position.y * 0.6 + (lp.y + 1.5) * 0.4, lz = cam.position.z * 0.6 + lp.z * 0.4;
        cam.getWorldDirection(fwd);
        if (L.positionX) {
          L.positionX.setTargetAtTime(lx, now, 0.03); L.positionY.setTargetAtTime(ly, now, 0.03); L.positionZ.setTargetAtTime(lz, now, 0.03);
          L.forwardX.setTargetAtTime(fwd.x, now, 0.03); L.forwardY.setTargetAtTime(fwd.y, now, 0.03); L.forwardZ.setTargetAtTime(fwd.z, now, 0.03);
        } else { L.setPosition(lx, ly, lz); L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }

        // music crossfade
        if (music) {
          const n = nightness();
          if (Math.abs(n - music.mix) > 0.01) {
            music.mix = n;
            music.day.g.gain.setTargetAtTime(Math.cos(n * Math.PI / 2), now, 1.5);
            music.night.g.gain.setTargetAtTime(Math.sin(n * Math.PI / 2), now, 1.5);
          }
        }

        // wind: stronger with altitude, gusting
        const hy = lp.y ?? 0;
        const alt = Math.min(1, Math.max(0, (hy - 6) / 40));
        const gust = 0.5 + 0.5 * noise2(t * 0.18, 3.7) + 0.25 * noise2(t * 0.9, 9.1);
        const wv = (0.05 + 0.2 * alt) * (0.55 + 0.75 * gust);
        wind.a.g.gain.setTargetAtTime(wv, now, 0.4);
        wind.b.g.gain.setTargetAtTime(wv * 0.7, now, 0.5);
        wind.a.bp.frequency.setTargetAtTime(wind.a.base * (0.8 + 0.6 * gust + alt * 0.5), now, 0.5);
        wind.b.bp.frequency.setTargetAtTime(wind.b.base * (0.8 + 0.7 * gust + alt * 0.6), now, 0.5);
        if (wind.a.p) wind.a.p.pan.setTargetAtTime(-0.6 + 0.3 * Math.sin(t * 0.13), now, 0.5);
        wind.hiss.g.gain.setTargetAtTime(Math.max(0, gust - 0.75) * 0.06 * (0.4 + alt), now, 0.3);

        // water: probe around the hero for the nearest water at ~5 Hz
        waterProbeT -= dt;
        if (waterProbeT <= 0) {
          waterProbeT = 0.2;
          const hAt = ctx.terrain?.heightAt || layoutHeightAt;
          const wl = ctx.water?.level ?? WATER_LEVEL;
          let best = null, bd = 1e9;
          const isW = (x, z) => ctx.water?.isWater ? ctx.water.isWater(x, z) : hAt(x, z) < wl;
          if (isW(lp.x, lp.z)) { best = { x: lp.x, z: lp.z }; bd = 0; }
          else for (const r of [4, 9, 16, 26, 40]) {
            for (let i = 0; i < 12; i++) {
              const a = i / 12 * Math.PI * 2 + r;
              const x = lp.x + Math.cos(a) * r, z = lp.z + Math.sin(a) * r;
              if (isW(x, z)) { const d = r; if (d < bd) { bd = d; best = { x, z }; } }
            }
            if (best) break;
          }
          const rd = riverDist(lp.x, lp.z);
          const nearRiver = rd < 30;
          if (best) { water.pos = best; water.target = (nearRiver ? 0.9 : 0.55); }
          else water.target = 0;
          water.bp.frequency.setTargetAtTime(nearRiver ? 2600 : 1500, now, 0.5);
          water.g2.gain.setTargetAtTime(nearRiver ? 0.28 : 0.1, now, 0.5);
        }
        setPos(water.panner, water.pos.x, (ctx.water?.level ?? WATER_LEVEL) + 0.3, water.pos.z);
        water.g.gain.setTargetAtTime(paused ? 0 : water.target, now, 0.6);

        // birds by day, crickets by night
        if (!paused) {
          const n = nightness();
          const F = LANDMARKS.forest;
          const inForest = Math.hypot(lp.x - F.x, lp.z - F.z) < F.r;
          birdTimer -= dt * (1 - n) * (inForest ? 1.8 : 1) * (hy > 40 ? 0.3 : 1);
          if (birdTimer <= 0) { birdTimer = 1.2 + Math.random() * 5; bird(lp, inForest); }
          cricketTimer -= dt * n;
          if (cricketTimer <= 0) { cricketTimer = 0.25 + Math.random() * 0.9; cricket(lp); }
        }

        // low-health heartbeat
        if (lowHealth && !paused) { heartbeatT -= dt; if (heartbeatT <= 0) { heartbeatT = 1.05; SFX.heartbeat(); } }
      } catch (e) { /* keep the game loop alive */ }
    },
  };
}
