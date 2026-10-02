        // ================= IN-GAME MUSIC: a generative, fog-bound score (no audio files; made live with Web Audio) =================
        // Slow minor chords that swell and fade over each other, a low drone that glides between roots, sparse detuned piano notes
        // lost in echo and a long reverb, tape hiss and wind, and now and then a distant metallic groan. Nothing repeats on a loop:
        // every phrase is picked fresh. Night leans darker (lower filter, a borrowed Eb chord, more of the metal).
        class FogScore {
            constructor(engine, mode) { this.e = engine; this.c = engine.ctx; this.on = false; this.built = false; this.timer = null; this.mode = mode || 'game'; }
            mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
            noiseBuffer(sec, brown) {
                const c = this.c, n = Math.floor(c.sampleRate * sec), buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
                let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
                return buf;
            }
            build() {
                const c = this.c;
                this.master = c.createGain(); this.master.gain.value = 0;
                this.tone = c.createBiquadFilter(); this.tone.type = 'lowpass'; this.tone.frequency.value = 2600; this.tone.Q.value = 0.3;
                const comp = c.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3; comp.attack.value = 0.08; comp.release.value = 0.6;
                this.master.connect(this.tone); this.tone.connect(comp); comp.connect(c.destination);
                // long dark reverb: decaying stereo noise, smoothed so the tail is soft rather than hissy
                const len = Math.floor(c.sampleRate * 5.5), ir = c.createBuffer(2, len, c.sampleRate);
                for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
                this.verb = c.createConvolver(); this.verb.buffer = ir;
                this.wet = c.createGain(); this.wet.gain.value = 0.9; this.verb.connect(this.wet); this.wet.connect(this.master);
                this.dry = c.createGain(); this.dry.gain.value = 0.55; this.dry.connect(this.master); this.dry.connect(this.verb);
                // tape-style echo for the piano
                this.delay = c.createDelay(2); this.delay.delayTime.value = 0.68;
                const fb = c.createGain(); fb.gain.value = 0.38; const dl = c.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1500;
                this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.verb); dl.connect(this.dry);
                this.echoIn = c.createGain(); this.echoIn.gain.value = 0.45; this.echoIn.connect(this.delay);
                // drone: two detuned saws through a slowly breathing low-pass
                this.droneF = c.createBiquadFilter(); this.droneF.type = 'lowpass'; this.droneF.frequency.value = 320; this.droneF.Q.value = 2;
                const dLfo = c.createOscillator(), dLg = c.createGain(); dLfo.frequency.value = 0.045; dLg.gain.value = 140; dLfo.connect(dLg); dLg.connect(this.droneF.frequency); dLfo.start();
                this.droneG = c.createGain(); this.droneG.gain.value = 0.026; this.droneF.connect(this.droneG); this.droneG.connect(this.dry);
                this.drones = [0, 1].map(i => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.mtof(38) * (i ? 1.004 : 1); o.connect(this.droneF); o.start(); return o; });
                // air: tape hiss up high, wind and rumble down low, both swelling slowly
                const hiss = c.createBufferSource(); hiss.buffer = this.noiseBuffer(3, false); hiss.loop = true;
                const hb = c.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 5200; hb.Q.value = 0.5; const hg = c.createGain(); hg.gain.value = 0.006;
                hiss.connect(hb); hb.connect(hg); hg.connect(this.master); hiss.start();
                const wind = c.createBufferSource(); wind.buffer = this.noiseBuffer(6, true); wind.loop = true;
                const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.7; this.windG = c.createGain(); this.windG.gain.value = 0.03;
                const wl = c.createOscillator(), wlg = c.createGain(); wl.frequency.value = 0.03; wlg.gain.value = 0.022; wl.connect(wlg); wlg.connect(this.windG.gain); wl.start();
                const wfl = c.createOscillator(), wflg = c.createGain(); wfl.frequency.value = 0.07; wflg.gain.value = 180; wfl.connect(wflg); wflg.connect(wf.frequency); wfl.start();
                wind.connect(wf); wf.connect(this.windG); this.windG.connect(this.dry); wind.start();
                this.built = true;
            }
            // chords as MIDI: [bass root, pad voices...]. Mostly D minor colours; night may borrow the Eb for unease.
            chords(night) {
                const day = [[38, 50, 57, 60, 64], [34, 50, 53, 57, 62], [43, 50, 55, 58, 57], [45, 52, 57, 59, 64], [41, 48, 53, 57, 62], [38, 50, 53, 57, 60]];
                return night ? day.concat([[39, 51, 55, 58, 57], [37, 49, 52, 56, 61]]) : day;
            }
            padVoice(m, t0, dur, lvl) {
                const c = this.c, f = this.mtof(m), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = this.night ? 650 : 950; lp.Q.value = 0.5;
                const oscs = [-7, 6].map(ct => { const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = ct + (Math.random() * 4 - 2); o.connect(lp); return o; });
                const atk = 4 + Math.random() * 2, rel = 7;
                g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(lvl, t0 + atk); g.gain.setValueAtTime(lvl, t0 + dur); g.gain.linearRampToValueAtTime(0.0001, t0 + dur + rel);
                lp.connect(g); g.connect(this.dry);
                oscs.forEach(o => { o.start(t0); o.stop(t0 + dur + rel + 0.1); });
            }
            piano(m, t0, lvl) { // a soft, slightly out-of-tune felt piano: FM bell with a fast-decaying brightness
                const c = this.c, f = this.mtof(m) * (1 + (Math.random() - 0.5) * 0.004), car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
                car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f * 2.0;
                mg.gain.setValueAtTime(f * 1.4, t0); mg.gain.exponentialRampToValueAtTime(f * 0.05, t0 + 1.2);
                mod.connect(mg); mg.connect(car.frequency); car.connect(g);
                g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(lvl, t0 + 0.018); g.gain.exponentialRampToValueAtTime(lvl * 0.25, t0 + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.5);
                g.connect(this.dry); g.connect(this.echoIn);
                [car, mod].forEach(o => { o.start(t0); o.stop(t0 + 5.6); });
            }
            metal(t0) { // a distant groan of metal: inharmonic partials, swelling in and dying into the reverb only
                const c = this.c, base = 70 + Math.random() * 90, g = c.createGain(), lvl = this.night ? 0.03 : 0.018;
                g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(lvl, t0 + 1.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 8);
                g.connect(this.verb);
                [1, 2.76, 5.4, 8.93, 13.3].forEach((r, i) => { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(base * r, t0); o.frequency.linearRampToValueAtTime(base * r * (0.985 + Math.random() * 0.01), t0 + 8);
                    og.gain.value = 1 / (i + 1.3); o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + 8.1); });
            }
            bell(t0, m) { // a church bell: hum, prime, minor-third tierce, quint, nominal, each ringing down at its own rate
                const c = this.c, f = this.mtof(m), g = c.createGain(); g.gain.value = 1; g.connect(this.verb); const dg = c.createGain(); dg.gain.value = 0.35; g.connect(dg); dg.connect(this.dry);
                [[0.5, 0.5, 9], [1, 0.9, 7], [1.19, 0.55, 5], [1.5, 0.35, 4], [2, 0.5, 3.2], [2.52, 0.25, 2.2], [3.01, 0.18, 1.6]].forEach(([r, a, d]) => {
                    const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f * r * (1 + (Math.random() - 0.5) * 0.003);
                    og.gain.setValueAtTime(0.0001, t0); og.gain.linearRampToValueAtTime(0.06 * a, t0 + 0.012); og.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
                    o.connect(og); og.connect(g); o.start(t0); o.stop(t0 + d + 0.1); });
            }
            heart(t0, v = 1) { // one low, muffled thump
                const c = this.c, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
                o.frequency.setValueAtTime(62, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.22);
                g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.16 * v, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
                o.connect(g); g.connect(this.dry); o.start(t0); o.stop(t0 + 0.4);
            }
            thunder(delay = 0.5) { // a rolling crack of thunder, mostly reverb
                if (!this.built || !this.playing) return;
                const c = this.c, t0 = c.currentTime + delay, src = c.createBufferSource(); src.buffer = this.thunderBuf || (this.thunderBuf = this.noiseBuffer(4, true));
                const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t0); lp.frequency.exponentialRampToValueAtTime(120, t0 + 3.2);
                const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.9, t0 + 0.05); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.6);
                src.connect(lp); lp.connect(g); g.connect(this.verb); g.connect(this.dry); src.start(t0); src.stop(t0 + 3.8);
            }
            start() {
                if (!this.c) return;
                if (!this.built) this.build();
                this.on = true; const now = this.c.currentTime;
                this.nextChord = this.nextChord && this.nextChord > now ? this.nextChord : now + 0.3;
                this.nextPhrase = now + 6 + Math.random() * 4; this.nextMetal = now + 25 + Math.random() * 30;
                this.deg = 4; this.playing = false;
                if (!this.timer) this.tick();
            }
            stop() {
                this.on = false; if (this.timer) { clearTimeout(this.timer); this.timer = null; }
                if (this.built) { const t = this.c.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(0, t, 0.8); }
                this.playing = false;
            }
            tick() {
                this.timer = setTimeout(() => this.tick(), 250);
                const c = this.c; if (!this.on) return;
                if (c.state !== 'running') { c.resume(); return; }
                this.step(c.currentTime);
            }
            step(now) { // everything due at audio time `now` (split out so the score can also be rendered offline)
                // quiet under anything that isn't the game world (title, crawl, slot select); fades rather than cuts
                const title = this.mode === 'title', want = title ? (menuScreen === 'title' || menuScreen === 'crawl' || menuScreen === 'slots') : menuScreen === 'game';
                const target = want ? (title ? 0.85 : 0.7) : 0;
                if ((target > 0) !== this.playing) { this.master.gain.cancelScheduledValues(now); this.master.gain.setTargetAtTime(target, now, target ? 2.5 : 0.7); this.playing = target > 0; }
                if (!this.playing) return;
                this.night = title || (typeof isNight === 'function' && isNight());
                if (title) { // the title's own layer: a great bell tolling far off, a slow heartbeat underneath
                    if (!this.nextBell) { this.nextBell = now + 1.5; this.nextBeat = now + 5; }
                    if (now >= this.nextBell) { this.bell(now + 0.05, Math.random() < 0.7 ? 43 : 41); this.nextBell = now + 7 + Math.random() * 5; }
                    if (now >= this.nextBeat) { this.heart(now + 0.05); this.heart(now + 0.4, 0.7); this.nextBeat = now + 5.5 + Math.random() * 4; }
                }
                this.tone.frequency.setTargetAtTime(this.night ? 1700 : 2600, now, 3);
                if (now >= this.nextChord - 0.2) { // a new chord every 14-19 s, each fading in over the last
                    const set = this.chords(this.night); let ch; do { ch = set[Math.floor(Math.random() * set.length)]; } while (ch === this.chord && set.length > 1);
                    this.chord = ch; const dur = 14 + Math.random() * 5, t0 = Math.max(now + 0.1, this.nextChord);
                    this.drones.forEach((o, i) => o.frequency.setTargetAtTime(this.mtof(ch[0]) * (i ? 1.004 : 1), t0, 2.2));
                    ch.slice(1).forEach((m, i) => this.padVoice(m, t0 + i * 0.35, dur, 0.026));
                    this.nextChord = t0 + dur;
                }
                if (now >= this.nextPhrase && this.chord) { // a few lonely piano notes, wandering the scale near the chord
                    const scale = [50, 52, 53, 55, 57, 58, 60, 62, 64, 65, 67, 69, 70, 72, 74, 76], n = 2 + Math.floor(Math.random() * 4);
                    let t = now + 0.1;
                    for (let i = 0; i < n; i++) {
                        this.deg = Math.max(5, Math.min(scale.length - 1, this.deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
                        let m = scale[this.deg]; if (Math.random() < 0.35) { const tones = this.chord.slice(1).map(x => x + 12); m = tones[Math.floor(Math.random() * tones.length)]; }
                        this.piano(m, t, 0.08 + Math.random() * 0.03); if (Math.random() < 0.18) this.piano(m - 12, t + 0.03, 0.04);
                        t += 0.5 + Math.random() * 0.75;
                    }
                    this.nextPhrase = t + (this.night ? 7 : 5) + Math.random() * 9;
                }
                if (now >= this.nextMetal) { this.metal(now + 0.1); this.nextMetal = now + (this.night ? 22 : 40) + Math.random() * 40; }
            }
        }

        class DetectiveAmbientAudioEngine {
            constructor() {
                this.ctx = null;
                this.lastBump = 0;
                this.bgmPlaying = false;
                this.bgmTimer = null;
                this.chordIndex = 0;
                this.themeOn = false; this.themeTimer = null; this.themeGain = null; this.userPadOff = false;
            }
            init() {
                if (!this.ctx) {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (AudioContextClass) {
                        this.ctx = new AudioContextClass();
                    }
                }
            }
            playTone(freq, type = 'sine', duration = 0.8, vol = 0.08) {
                this.init();
                try {
                    if (this.ctx) {
                        if (this.ctx.state === 'suspended') {
                            this.ctx.resume();
                        }
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = type;
                        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                        
                        gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
                        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.3);
                        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
                        
                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start();
                        osc.stop(this.ctx.currentTime + duration);
                    }
                } catch (e) {}
            }
            playActionSound() {
                this.init();
                try {
                    if (this.ctx) {
                        if (this.ctx.state === 'suspended') this.ctx.resume();
                        const osc = this.ctx.createOscillator();
                        const gain = this.ctx.createGain();
                        osc.type = equippedItem === 'torch' ? 'triangle' : (equippedItem === 'lens' ? 'sine' : 'sawtooth');
                        osc.frequency.setValueAtTime(equippedItem === 'torch' ? 300 : (equippedItem === 'lens' ? 520 : 180), this.ctx.currentTime);
                        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);

                        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
                        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

                        osc.connect(gain);
                        gain.connect(this.ctx.destination);
                        osc.start();
                        osc.stop(this.ctx.currentTime + 0.15);
                    }
                } catch(e) {}
            }
            fluteNote(freq, when, dur) { // sine body + soft octave overtone + gentle vibrato, breathy attack and release
                const c = this.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), g2 = c.createGain();
                o1.type = 'sine'; o2.type = 'triangle'; o1.frequency.value = freq; o2.frequency.value = freq * 2; g2.gain.value = 0.22;
                lfo.frequency.value = 5.2; lg.gain.value = freq * 0.005; lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
                o1.connect(g); o2.connect(g2); g2.connect(g);
                const v = MENU_THEME.vol, end = when + dur;
                g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(v, when + 0.07);
                g.gain.setValueAtTime(v, Math.max(when + 0.08, end - 0.12)); g.gain.linearRampToValueAtTime(0.0001, end);
                g.connect(this.themeGain);
                [o1, o2, lfo].forEach(o => { o.start(when); o.stop(end + 0.05); });
            }
            startMenuTheme() { // the title: the fog score in its darkest mode, with a tolling bell, a heartbeat and thunder
                this.init();
                if (!this.ctx || this.themeOn) return;
                this.themeOn = true;
                if (!this.titleScore) this.titleScore = new FogScore(this, 'title');
                this.titleScore.start();
            }
            menuThemeLoop() {
                if (!this.themeOn) return;
                try {
                    if (this.ctx.state !== 'running') { this.ctx.resume(); this.themeTimer = setTimeout(() => this.menuThemeLoop(), 400); return; } // waits for the first tap on phones
                    const beat = 60 / MENU_THEME.bpm, len = MENU_THEME.noteBeats * beat;
                    let t = this.ctx.currentTime + 0.05;
                    MENU_THEME.notes.forEach(m => { this.fluteNote(440 * Math.pow(2, (m - 69) / 12), t, len * 0.96); t += len; });
                    this.themeTimer = setTimeout(() => this.menuThemeLoop(), (t - this.ctx.currentTime + MENU_THEME.restBeats * beat) * 1000);
                } catch (e) { this.themeOn = false; }
            }
            stopMenuTheme() {
                this.themeOn = false;
                if (this.titleScore) { this.titleScore.stop(); return; }
                if (this.themeTimer) clearTimeout(this.themeTimer);
                try { const g = this.themeGain, t = this.ctx.currentTime; g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.35); setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 500); } catch (e) {}
                this.themeGain = null;
            }
            startAmbientPad() {
                this.init();
                this.bgmPlaying = true; this.userPadOff = false;
                const btn = document.getElementById('bgm-btn');
                if (btn) btn.innerHTML = '<i class="fa-solid fa-music"></i> AMBIENT: ON';
                if (!this.ctx) return;
                if (!this.score) this.score = new FogScore(this);
                this.score.start();
            }
            toggleBGM() {
                try {
                    this.init();
                    // Browsers keep audio suspended until a tap; if music is flagged ON but blocked, this tap unlocks it.
                    if (this.ctx && this.ctx.state === 'suspended') {
                        this.ctx.resume();
                        if (this.bgmPlaying) return;
                    }
                    if (this.bgmPlaying) { this.stopBGM(); } else { this.startAmbientPad(); }
                } catch (e) { console.warn('Ambient toggle failed:', e); }
            }
            stopBGM() {
                this.bgmPlaying = false; this.userPadOff = true;
                if (this.bgmTimer) clearTimeout(this.bgmTimer);
                if (this.score) this.score.stop();
                const btn = document.getElementById('bgm-btn');
                if(btn) btn.innerHTML = '<i class="fa-solid fa-music"></i> AMBIENT: OFF';
            }
            playBump() { 
                const now = Date.now();
                if (now - this.lastBump > 250) {
                    this.playTone(75, 'sine', 0.2, 0.06);
                    this.lastBump = now;
                }
            }
            playSelect() { this.playTone(440, 'triangle', 0.2, 0.08); }
            playClue() {
                this.playTone(329.63, 'sine', 0.4, 0.08);
                setTimeout(() => this.playTone(493.88, 'sine', 0.5, 0.09), 150);
            }
            playCollect() { 
                this.playTone(392.00, 'sine', 0.3, 0.09); 
                setTimeout(() => this.playTone(523.25, 'sine', 0.4, 0.1), 150);
                setTimeout(() => this.playTone(659.25, 'sine', 0.6, 0.12), 300);
            }
            playBark() {
                this.playTone(196.00, 'triangle', 0.15, 0.07);
            }
        }
        const audio = new DetectiveAmbientAudioEngine();

