        // ================= VOICES: little musical squiggles while someone talks (no words, no audio files) =================
        // One reusable Web Audio synth. Each speaker has a profile: pitch, range, waveform, vowel colour, cadence, blip length.
        // While the dialogue types out, updateDialogueVoice() is called per revealed character and fires a blip every 30-90 ms.
        const VOICE = (() => { let s = {}; try { s = JSON.parse(localStorage.getItem('bosom-voice') || '{}'); } catch (e) {} return Object.assign({ voiceEnabled: true, voiceVolume: 0.55, voicePitch: 1, voiceSpeed: 1 }, s); })();
        let voiceEnabled = VOICE.voiceEnabled, voiceVolume = VOICE.voiceVolume, voicePitch = VOICE.voicePitch, voiceSpeed = VOICE.voiceSpeed;
        function saveVoice() { VOICE.voiceEnabled = voiceEnabled; VOICE.voiceVolume = voiceVolume; VOICE.voicePitch = voicePitch; VOICE.voiceSpeed = voiceSpeed; try { localStorage.setItem('bosom-voice', JSON.stringify(VOICE)); } catch (e) {} }
        // formants (two bands) for the vowel colour of a blip
        const VOWELS = { a: [800, 1200], e: [500, 1900], i: [320, 2400], o: [520, 900], u: [350, 750], y: [400, 2000] };
        const VOICE_PROFILES = {
            // humans: base Hz, range in semitones, wave, blip ms [min,max], gap ms [min,max], glide [min,max] (pitch end/start), vowels they lean on,
            //         noise (breath/rasp 0-1), vib [rate Hz, depth cents], skip chance, long (chance of a drawn-out blip), lp (soft top end)
            SUDASHORN: { base: 540, range: 5, wave: 'sine', dur: [45, 66], gap: [52, 82], glide: [0.9, 1.12], vowels: 'ooaue', noise: 0, vib: [7, 35], skip: 0.14, long: 0.06, lp: 2200, warm: 0.5 },
            APOLLYON: { base: 300, range: 6, wave: 'triangle', dur: [28, 44], gap: [38, 58], glide: [1.0, 1.28], vowels: 'aeiao', noise: 0.03, vib: [11, 18], skip: 0.12, long: 0.03, lp: 4200, warm: 0.2 },
            ELDER: { base: 150, range: 3, wave: 'sawtooth', dur: [55, 90], gap: [78, 112], glide: [0.86, 1.02], vowels: 'ouaoe', noise: 0.28, vib: [5, 45], skip: 0.2, long: 0.14, lp: 950, warm: 0.6 },
            MERCHANT: { base: 350, range: 7, wave: 'square', dur: [24, 40], gap: [30, 46], glide: [0.85, 1.25], vowels: 'eaeia', noise: 0.02, vib: [14, 20], skip: 0.1, long: 0.02, lp: 2600, nasal: 1400 },
            PIP: { base: 920, range: 8, wave: 'sine', dur: [20, 32], gap: [30, 44], glide: [1.08, 1.42], vowels: 'iieia', noise: 0, vib: [16, 30], skip: 0.12, long: 0.02, lp: 5000, warm: 0 },
            FRANZ: { base: 220, range: 5, wave: 'triangle', dur: [40, 60], gap: [55, 80], glide: [0.92, 1.1], vowels: 'aoeau', noise: 0.08, vib: [6, 25], skip: 0.15, long: 0.08, lp: 1700, warm: 0.4 },
            CLITO: { base: 270, range: 6, wave: 'square', dur: [30, 48], gap: [42, 62], glide: [0.9, 1.2], vowels: 'aeoae', noise: 0.05, vib: [9, 20], skip: 0.14, long: 0.04, lp: 1500, warm: 0.3 },
            FARMER: { base: 175, range: 4, wave: 'sawtooth', dur: [45, 72], gap: [62, 92], glide: [0.9, 1.05], vowels: 'aouae', noise: 0.18, vib: [5, 30], skip: 0.18, long: 0.1, lp: 1100, warm: 0.5 },
            GUIDE: { base: 380, range: 5, wave: 'triangle', dur: [32, 50], gap: [44, 64], glide: [0.95, 1.15], vowels: 'eioae', noise: 0.02, vib: [8, 15], skip: 0.12, long: 0.03, lp: 3000, warm: 0.2 },
            DRUNK: { base: 200, range: 9, wave: 'sawtooth', dur: [50, 85], gap: [60, 110], glide: [0.75, 1.3], vowels: 'aouoa', noise: 0.15, vib: [4, 80], skip: 0.25, long: 0.2, lp: 1200, warm: 0.5 },
            TIGER: { base: 250, range: 5, wave: 'sawtooth', dur: [40, 64], gap: [52, 80], glide: [0.85, 1.1], vowels: 'aoaua', noise: 0.22, vib: [7, 30], skip: 0.15, long: 0.1, lp: 1300, warm: 0.4 },
            VILLAGER: { base: 320, range: 5, wave: 'triangle', dur: [32, 52], gap: [44, 70], glide: [0.92, 1.15], vowels: 'aeiou', noise: 0.03, vib: [8, 20], skip: 0.14, long: 0.04, lp: 2400, warm: 0.3 },
            // animals: a different instrument entirely
            HORSE: { animal: 'horse' }, COW: { animal: 'cow' }, CHICKEN: { animal: 'chicken' }, DOG: { animal: 'dog' }, CAT: { animal: 'cat' }, SHEEP: { animal: 'sheep' }
        };
        const VOICE_NAMES = [ // who's speaking, from the first words of the dialogue
            [/^(SUDASHORN|YOUR WIFE)/, 'SUDASHORN'], [/^(APOLLYON|KOTO|YOU:|YOU SAY)/, 'APOLLYON'], [/^ELDER/, 'ELDER'], [/^(MERCHANT|SHOPKEEPER|TIGER SHOPKEEPER)/, 'MERCHANT'],
            [/^PIP/, 'PIP'], [/^FRANZ/, 'FRANZ'], [/^CLITO/, 'CLITO'], [/^OLD FARMER/, 'FARMER'], [/^GUIDE/, 'GUIDE'], [/^DRUNK/, 'DRUNK'], [/^TIGER/, 'TIGER'],
            [/^(HONEYDUNKIN|YOUR HORSE|THE HORSE)/, 'HORSE'], [/^(MARIGOLD|THE COW)/, 'COW'], [/^(THE HEN|CHICKEN)/, 'CHICKEN'], [/^(BISCUIT|THE DOG)/, 'DOG'], [/^(THE CAT)/, 'CAT'], [/^(THE SHEEP)/, 'SHEEP'],
            [/^[A-Z][A-Z' .]{1,20}:/, 'VILLAGER']
        ];
        function voiceFor(text) { const t = String(text || '').trim(); for (const [re, id] of VOICE_NAMES) if (re.test(t)) return id; return null; } // narration stays silent
        const VOX = { live: [], last: 0, prof: null, bus: null, noiseBuf: null, alt: 1 };
        function voiceCtx() { // only once the player has touched the screen (iOS keeps audio locked until then)
            const c = audio.ctx; if (!c) return null; if (c.state === 'suspended') { try { c.resume(); } catch (e) {} } return c.state === 'running' ? c : null;
        }
        function voiceBus(c) {
            if (!VOX.bus || VOX.bus.context !== c) { VOX.bus = c.createGain(); VOX.bus.connect(c.destination);
                const n = c.sampleRate * 0.4, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; VOX.noiseBuf = b; }
            VOX.bus.gain.value = voiceVolume * 0.32; return VOX.bus;
        }
        function vNode(o, t1, t0) { VOX.live.push(o); o.onended = () => { const i = VOX.live.indexOf(o); if (i >= 0) VOX.live.splice(i, 1); }; o.start(t0 || 0); o.stop(t1); }
        function playVoiceBlip(npc, character, at) { // npc: a profile name (or profile); character: the letter just revealed; at: optional start time
            if (!voiceEnabled) return; const c = voiceCtx(); if (!c) return;
            const P = typeof npc === 'string' ? VOICE_PROFILES[npc] : npc; if (!P) return;
            const bus = voiceBus(c), t0 = (at != null ? at : c.currentTime) + 0.005, rnd = (a, b) => a + Math.random() * (b - a);
            if (P.animal) { animalBlip(c, bus, P.animal, t0); return; }
            const ch = String(character || 'a').toLowerCase(), vow = VOWELS[ch] ? ch : P.vowels[(Math.random() * P.vowels.length) | 0];
            let dur = rnd(P.dur[0], P.dur[1]) / 1000; if (Math.random() < P.long) dur *= 1.9;
            const semis = (Math.random() - 0.5) * P.range + (VOWELS[ch] ? 1.2 : 0) * (ch === 'i' || ch === 'e' ? 1 : -0.5), f0 = P.base * voicePitch * Math.pow(2, semis / 12), f1 = f0 * rnd(P.glide[0], P.glide[1]);
            const osc = c.createOscillator(); osc.type = P.wave; osc.frequency.setValueAtTime(f0, t0); osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t0 + dur);
            const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = P.vib[0] * rnd(0.8, 1.25); lg.gain.value = f0 * (Math.pow(2, P.vib[1] / 1200) - 1); lfo.connect(lg); lg.connect(osc.frequency); // the squiggle
            const env = c.createGain(), pk = 0.9; env.gain.value = 0.0001; env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(pk, t0 + Math.min(0.008, dur * 0.25)); env.gain.setValueAtTime(pk, t0 + dur * 0.45); env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            const [F1, F2] = VOWELS[vow], b1 = c.createBiquadFilter(), b2 = c.createBiquadFilter(), lp = c.createBiquadFilter(), mix = c.createGain();
            b1.type = 'bandpass'; b1.frequency.value = F1 * rnd(0.92, 1.08); b1.Q.value = 3.2; b2.type = 'bandpass'; b2.frequency.value = (P.nasal || F2) * rnd(0.92, 1.08); b2.Q.value = P.nasal ? 6 : 4;
            lp.type = 'lowpass'; lp.frequency.value = P.lp; mix.gain.value = 1;
            const dry = c.createGain(); dry.gain.value = 0.35 + (P.warm || 0) * 0.5; // some of the plain tone keeps it musical rather than speechy
            osc.connect(b1); osc.connect(b2); osc.connect(dry); b1.connect(mix); b2.connect(mix); dry.connect(mix); mix.connect(lp); lp.connect(env); env.connect(bus);
            if (P.noise > 0) { const n = c.createBufferSource(), ng = c.createGain(), nf = c.createBiquadFilter(); n.buffer = VOX.noiseBuf; nf.type = 'bandpass'; nf.frequency.value = F2; nf.Q.value = 1.2; ng.gain.value = P.noise * 0.9; n.connect(nf); nf.connect(ng); ng.connect(env); vNode(n, t0 + dur, t0); }
            vNode(osc, t0 + dur + 0.01, t0); vNode(lfo, t0 + dur + 0.01, t0);
        }
        function animalBlip(c, bus, kind, t0) { // whinnies, moos, clucks, yips, mews, bleats
            const tone = (type, a, b, d, vol, vibR, vibD, lpF) => { const o = c.createOscillator(), e = c.createGain(), l = c.createBiquadFilter(); o.type = type; o.frequency.setValueAtTime(a, t0); o.frequency.exponentialRampToValueAtTime(b, t0 + d);
                if (vibR) { const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = vibR; vg.gain.value = vibD; v.connect(vg); vg.connect(o.frequency); vNode(v, t0 + d, t0); }
                l.type = 'lowpass'; l.frequency.value = lpF || 3000; e.gain.value = 0.0001; e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(vol * 2.2, t0 + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(l); l.connect(e); e.connect(bus); vNode(o, t0 + d + 0.01, t0); };
            const puff = (d, f, vol) => { const n = c.createBufferSource(), e = c.createGain(), l = c.createBiquadFilter(); n.buffer = VOX.noiseBuf; l.type = 'bandpass'; l.frequency.value = f; l.Q.value = 0.8; e.gain.value = 0.0001; e.gain.setValueAtTime(vol * 2.2, t0); e.gain.exponentialRampToValueAtTime(0.0001, t0 + d); n.connect(l); l.connect(e); e.connect(bus); vNode(n, t0 + d, t0); };
            const r = Math.random();
            if (kind === 'horse') { if (r < 0.55) tone('sawtooth', 900 * voicePitch, 380, 0.07, 0.5, 28, 60, 2200); else puff(0.06, 500, 0.8); } // a whinny flutter or a snort
            else if (kind === 'cow') tone('sawtooth', 140 * voicePitch, 115, 0.09, 0.6, 5, 4, 700);
            else if (kind === 'chicken') { tone('square', 1300 * voicePitch, 900, 0.025, 0.35, 0, 0, 3500); if (r < 0.4) puff(0.015, 2500, 0.5); }
            else if (kind === 'dog') tone('triangle', 700 * voicePitch, 1100, 0.04, 0.55, 0, 0, 3000);
            else if (kind === 'cat') tone('sine', 650 * voicePitch, 900, 0.07, 0.45, 9, 20, 2600);
            else if (kind === 'sheep') tone('sawtooth', 420 * voicePitch, 400, 0.08, 0.4, 22, 25, 1800);
        }
        function stopVoiceBlip() { const c = audio.ctx; for (const o of VOX.live.slice()) { try { o.stop(c ? c.currentTime : 0); } catch (e) {} } VOX.live.length = 0; VOX.prof = null; }
        function updateDialogueVoice(character) { // the typewriter calls this for every visible character it reveals
            const P = VOX.prof && VOICE_PROFILES[VOX.prof]; if (!P || !voiceEnabled) return;
            if (!/[A-Za-z0-9]/.test(character || '')) return;                                  // never on spaces or punctuation
            const now = performance.now(), gap = (P.gap ? P.gap[0] + Math.random() * (P.gap[1] - P.gap[0]) : 70) / voiceSpeed;
            if (now - VOX.last < gap) return;                                                  // too fast: let the cadence breathe
            if (Math.random() < (P.skip || 0.12)) { VOX.last = now - gap * 0.5; return; }      // the odd swallowed syllable
            VOX.last = now; playVoiceBlip(VOX.prof, character);
        }
        // ---- the typewriter: dialogue reveals letter by letter, the voice riding along ----
        const TYPE = { timer: null, el: null, full: '', i: 0 };
        function typeDialogue(el, text) {
            finishTyping(false); const full = String(text); TYPE.el = el; TYPE.full = full; TYPE.i = 0; VOX.prof = voiceFor(full); VOX.last = 0;
            const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
            const step = () => {
                if (TYPE.el !== el) return;
                const n = Math.max(1, Math.round(1.6 * voiceSpeed)); // a couple of letters a tick
                for (let k = 0; k < n && TYPE.i < full.length; k++) { const ch = full[TYPE.i++]; if (k === n - 1 || /[aeiou]/i.test(ch)) updateDialogueVoice(ch); }
                el.innerHTML = esc(full.slice(0, TYPE.i)) + '<span style="visibility:hidden">' + esc(full.slice(TYPE.i)) + '</span>';
                if (TYPE.i >= full.length) { finishTyping(true); return; }
                const pause = /[.!?…]/.test(full[TYPE.i - 1]) ? 140 : /[,;:\n]/.test(full[TYPE.i - 1]) ? 70 : 24;
                TYPE.timer = setTimeout(step, pause / voiceSpeed);
            };
            step();
        }
        function finishTyping(done) { // reveal the rest at once and stop the voice right there
            if (TYPE.timer) clearTimeout(TYPE.timer); TYPE.timer = null;
            if (TYPE.el && TYPE.i < TYPE.full.length) TYPE.el.innerText = TYPE.full;
            TYPE.i = TYPE.full.length; TYPE.el = null; stopVoiceBlip();
        }
        function dialogueTyping() { return !!TYPE.timer; }
        function toggleVoices() { voiceEnabled = !voiceEnabled; saveVoice(); const b = document.getElementById('voice-btn'); if (b) b.innerHTML = '<i class="fa-solid fa-comment-dots"></i> VOICES: ' + (voiceEnabled ? 'ON' : 'OFF'); if (voiceEnabled) setTimeout(() => playVoiceBlip('APOLLYON', 'a'), 30); }
        window.toggleVoices = toggleVoices; document.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('voice-btn'); if (b && !voiceEnabled) b.innerHTML = '<i class="fa-solid fa-comment-dots"></i> VOICES: OFF'; }); window.VOICE_PROFILES = VOICE_PROFILES;

        function setActiveScreen(screen) {
            menuScreen = screen;
            const titleEl = document.getElementById('title-screen');
            const crawlEl = document.getElementById('crawl-screen');
            const slotsEl = document.getElementById('slot-select-screen');

            if (titleEl) titleEl.classList.toggle('hidden', screen !== 'title');
            if (screen === 'title') titleStart(); else titleStop();
            if (crawlEl) crawlEl.classList.toggle('hidden', screen !== 'crawl');
            if (slotsEl) slotsEl.classList.toggle('hidden', screen !== 'slots');
        }

        function startCrawl() {
            if (crawlStarted) return;
            crawlStarted = true;

            audio.init();
            audio.playSelect(); // the title theme keeps playing through the crawl; the in-game music starts when gameplay begins
            
            setActiveScreen('crawl');
            const crawlText = document.getElementById('crawl-text'), box = document.getElementById('crawl-screen');
            // the story rolls up the screen at a reading pace; lightning breaks over the bridge as its line passes the middle
            const H = box.clientHeight || 320, T = crawlText.offsetHeight || 900, dist = H + T, secs = Math.max(28, dist / 17);
            crawlText.style.transition = 'none'; crawlText.style.transform = 'translateY(0)';
            const card = document.getElementById('title-card'), CARD = card ? 6400 : 0; // WHEELHOUSE / BOSOM over grandmother's cottage, like the opening of an old film
            const vid = document.getElementById('title-video'), mp4ok = vid && vid.canPlayType('video/mp4; codecs="avc1.42E01E"'), vsrc = document.getElementById(mp4ok ? 'opening-video' : 'opening-video-webm');
            if (vid && vsrc) { try { const d = vsrc.textContent.trim(), bin = atob(d.slice(d.indexOf(',') + 1)), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
                vid.src = URL.createObjectURL(new Blob([u8], { type: mp4ok ? 'video/mp4' : 'video/webm' })); vid.currentTime = 0; const pl = vid.play(); if (pl && pl.catch) pl.catch(() => {});
                setTimeout(() => { vid.style.opacity = '1'; }, 100); setTimeout(() => { vid.style.opacity = '0'; }, 5400); } catch (e) {} }
            const cr = document.getElementById('tc-credit'); if (card) { setTimeout(() => { card.style.opacity = '1'; if (cr) cr.style.opacity = '.55'; }, 900); setTimeout(() => { card.style.opacity = '0'; if (cr) cr.style.opacity = '0'; }, 5000); }
            setTimeout(() => requestAnimationFrame(() => { crawlText.style.transition = 'transform ' + secs + 's linear'; crawlText.style.transform = 'translateY(' + (-dist) + 'px)'; }), CARD);
            const ln = document.getElementById('crawl-lightning'), fl = document.getElementById('crawl-flash');
            if (ln && fl) { const at = CARD + (ln.offsetTop + H / 2) / dist * secs * 1000; setTimeout(() => { if (!crawlStarted || !fl.isConnected) return; [0, 260, 520].forEach((d, k) => setTimeout(() => { fl.style.transition = k === 1 ? 'opacity .05s' : 'opacity .6s'; fl.style.opacity = k === 1 ? '0.12' : k === 0 ? '0.35' : '0'; }, d)); audio.playTone && audio.playTone(55, 'sawtooth', 1.6, 0.05); }, at); }

            crawlTimeout = setTimeout(() => {
                userPressedSkip = true;
                crawlIsFinished = true;
                beginCinematicIntroFromCrawl();
            }, CARD + secs * 1000 + 600);
        }

        function beginCinematicIntroFromCrawl() {
            if (crawlTimeout) clearTimeout(crawlTimeout);
            setActiveScreen('game');
            document.getElementById('hud-bar').classList.remove('hidden');
            document.getElementById('hero-hud-corner').classList.remove('hidden');
            document.getElementById('journal-btn').classList.remove('hidden');
            document.getElementById('v2-hud').classList.add('visible');
            startV2HudTick();
            updateHealthBar();
            spawnInitialWolves();
            for (let i = 0; i < 2; i++) spawnWildHorse();

            userPressedSkip = true;
            crawlIsFinished = true;
            transitionToGameplay();
            if (hasSavedGame()) { // returning player: no walk-in, no gate speech, resume where you left off
                saveArmed = false; restoreSave(); gameStarted = true; cinematicMode = false; player.isMoving = false;
                return;
            }
            saveArmed = true;

            // a new game begins at grandmother's farmhouse, the first night: he has just arrived and been through every room
            // (the Project K opening and the ride along the Long Trail are still here: runOpening(), startIntroRide())
            cinematicMode = false; companion.active = false;
            currentMapName = 'overworld'; savedOverworldX = 23 * TILE_SIZE; savedOverworldY = 20 * TILE_SIZE;
            player.gridX = 23; player.gridY = 20; player.pixelX = player.targetX = 23 * TILE_SIZE; player.pixelY = player.targetY = 20 * TILE_SIZE;
            player.dir = 'down'; player.face8 = 'down'; player.isMoving = false; CAM.yaw = 0; CAM.ctrl = 0;
            { const want = (22.4 - 6) / 24 * DAY_MS; zoneFlags.timeOff = (zoneFlags.timeOff || 0) + ((want - gameNow() % DAY_MS + DAY_MS) % DAY_MS); } // late on the first night
            HORSE.map = 'overworld'; HORSE.mounted = false; HORSE.x = HORSE_HOME[0]; HORSE.y = HORSE_HOME[1]; // the horse is already in the stable
            zoneFlags.arrived = true;
            setTimeout(() => { if (currentMapName !== 'overworld' || inDialogue) return;
                openNpcConversation('THE FARMHOUSE\nYou got in at dusk, after the long bridge. Since then you have been through every room with the lamp: the kitchen, the cold stove, her bed still made, the trapdoor to the basement.\nNobody has lived here for a long time. Outside, the field is very quiet.',
                    [{ label: 'LOOK AROUND THE HOUSE', handler: openHome }, { label: 'STEP OUTSIDE', handler: () => { hideDialogue(); showFluidMessage('Grandmother\'s farm. Rahjai, at night.', 2600); } }]); }, 900);
        }

