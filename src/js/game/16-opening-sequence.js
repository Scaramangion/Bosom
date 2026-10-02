        // ================= OPENING SEQUENCE (Project K): temple at night -> the guard falls -> he wakes in the Tomb of Waking =================
        // Drawn in code on its own 160x144 canvas, so it costs no image data. Tap / A / Enter advances, SKIP ends it.
        const OP = { c: null, x: null, i: 0, t0: 0, on: false, replay: false, mission: false, ret: null, timer: null };
        const OPC = { sky1: '#0b1030', sky2: '#1c1640', wall: '#29223a', wallHi: '#3a3052', pillar: '#4b4060', pillarHi: '#6b5b88', floor: '#171223' };
        function opR(x, y, w, h, col) { OP.x.fillStyle = col; OP.x.fillRect(Math.round(x), Math.round(y), w, h); }
        // Temple of the Heads: real painted tiles (architecture + priestess), packed into one small atlas image.
        // Self-calibrating like the hero HD renderer: frame rects come from the atlas's own pixel dimensions, never a
        // hardcoded scale, so drawImage always samples 1:1 from source px to whatever dw/dh we ask for here.
        const TEMPLE_FRAMES = {"staff":[0,0,129,346],"column_tall":[130,0,88,330],"door":[219,0,213,241],"priestess_front":[433,0,126,238],"priestess_side":[0,347,117,238],"column_short":[118,347,75,235],"niche_lit":[194,347,224,203],"niche_unlit":[0,586,224,150],"plain_cane":[225,586,129,119],"head_pile":[355,586,124,107],"bust_alcove":[480,586,100,95],"floor_plain":[0,737,236,93],"floor_lined":[237,737,224,93],"head_glow_icon":[462,737,124,86]};
        const templeAtlas = { img: new Image(), ready: false };
        templeAtlas.img.onload = () => { templeAtlas.ready = true; };
        templeAtlas.img.src = document.getElementById('temple-atlas').textContent.trim();
        function opSprite(name, dx, dy, dw, dh) {
            if (!templeAtlas.ready) return false;
            const f = TEMPLE_FRAMES[name]; if (!f) return false;
            OP.x.drawImage(templeAtlas.img, f[0], f[1], f[2], f[3], Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
            return true;
        }
        function opTemple(t) {
            const x = OP.x, g = x.createLinearGradient(0, 0, 0, 110); g.addColorStop(0, OPC.sky1); g.addColorStop(1, OPC.sky2); x.fillStyle = g; x.fillRect(0, 0, 160, 144);
            for (let i = 0; i < 26; i++) { const sx = (i * 53) % 160, sy = (i * 31) % 40; if ((i + Math.floor(t * 2)) % 7) opR(sx, sy, 1, 1, '#cbd5e1'); }
            const mg = x.createRadialGradient(131, 17, 2, 131, 17, 18); mg.addColorStop(0, 'rgba(253,230,160,.22)'); mg.addColorStop(1, 'rgba(253,230,160,0)'); x.fillStyle = mg; x.fillRect(110, 0, 44, 38);
            if (!drawWorldFrame(x, 't_moon', 122, 7, 0.55)) { x.fillStyle = '#e5e7eb'; x.beginPath(); x.arc(130, 18, 8, 0, 7); x.fill(); }
            opR(0, 44, 160, 68, OPC.wall); opR(0, 44, 160, 3, OPC.wallHi);
            opR(0, 110, 160, 34, OPC.floor);
            if (worldArt.ready) { // carved flagstones, two rows, a fixed pattern of variants
                const tiles = ['t_floor00', 't_floor01', 't_floor03', 't_floor02', 't_floor09', 't_floor13'];
                for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) {
                    const n = c === 4 || c === 5 ? (r ? 't_floor08' : 't_floor06') : tiles[(c * 7 + r * 3) % tiles.length], f = WORLD_FRAMES[n];
                    x.imageSmoothingEnabled = true; x.drawImage(worldArt.img, f[0], f[1], f[2], f[3], c * 16, 112 + r * 16, 16, 16); x.imageSmoothingEnabled = false;
                }
                x.fillStyle = 'rgba(8,6,20,.35)'; x.fillRect(0, 112, 160, 3);
            } else if (!opSprite('floor_lined', 0, 112, 160, 32)) { for (let i = 0; i < 160; i += 16) opR(i, 110, 1, 34, '#221b31'); }
            // lit doorway (far left): where the Agent comes in
            if (!drawWorldFrame(x, 't_arch_lit', 18, 112, 0.48, 28, 96)) opSprite('door', 4, 64, 42, 48);
            const gl = x.createRadialGradient(100, 90, 2, 100, 90, 50); gl.addColorStop(0, 'rgba(251,189,101,.30)'); gl.addColorStop(1, 'rgba(251,189,101,0)'); x.fillStyle = gl; x.fillRect(50, 44, 100, 70);
            if (!drawWorldFrame(x, 't_pillar_tall_carved', 61, 112, 0.68, 19, 108)) opSprite('column_tall', 54, 38, 20, 74);   // left column
            if (!opSprite('niche_lit', 76, 68, 48, 44)) { opR(68, 98, 24, 12, '#5b4a70'); const f = Math.sin(t * 12) > 0; opR(77, 91, 6, 7, f ? '#f97316' : '#fb923c'); }  // the Heads' shrine
            if (!drawWorldFrame(x, 't_pillar_tall_carved', 139, 112, 0.68, 19, 108)) opSprite('column_tall', 126, 38, 20, 74); // right column
            const fl = 0.62 + Math.sin(t * 13) * 0.04;
            drawWorldFrame(x, 't_brazier', 41, 112, fl, 13, 48); drawWorldFrame(x, 't_brazier', 155, 112, fl, 13, 48);      // braziers by the pillars
        }
        function opTomb(t, dark = 0) {
            const x = OP.x; x.fillStyle = '#120e0c'; x.fillRect(0, 0, 160, 144);
            opR(0, 0, 160, 54, '#221a15'); for (let r = 8; r < 54; r += 9) opR(0, r, 160, 1, '#171210'); opR(0, 54, 160, 2, '#34291f');
            [18, 142].forEach(tx => { opR(tx - 2, 30, 4, 10, '#44403c'); opR(tx - 2, 23, 4, 7, Math.sin(t * 11 + tx) > 0 ? '#f97316' : '#fb923c'); opR(tx - 1, 25, 2, 3, '#fde047');
                const gl = x.createRadialGradient(tx, 28, 1, tx, 28, 40); gl.addColorStop(0, 'rgba(251,146,60,.30)'); gl.addColorStop(1, 'rgba(251,146,60,0)'); x.fillStyle = gl; x.fillRect(tx - 40, 0, 80, 90); });
            opR(40, 76, 80, 5, '#a8977f'); opR(40, 81, 80, 14, '#7a6a58'); opR(46, 95, 6, 12, '#5c4f42'); opR(108, 95, 6, 12, '#5c4f42');   // funeral slab
            if (dark) { x.fillStyle = 'rgba(0,0,0,' + dark + ')'; x.fillRect(0, 0, 160, 144); }
        }
        function opVignette(a) { const x = OP.x, g = x.createRadialGradient(80, 80, 20, 80, 80, 110); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(6,4,14,' + a + ')'); x.fillStyle = g; x.fillRect(0, 0, 160, 144); }
        function opPriestess(px, py, ghost, alpha = 1) {
            const x = OP.x; x.globalAlpha = (ghost ? 0.28 : 1) * alpha;
            const gl = x.createRadialGradient(px, py - 12, 1, px, py - 12, 16); gl.addColorStop(0, 'rgba(253,230,138,.35)'); gl.addColorStop(1, 'rgba(253,230,138,0)'); x.fillStyle = gl; x.fillRect(px - 16, py - 30, 32, 32);
            const dh = 34, dw = 18; // priestess_front is 126x238 native; drawn at a fixed small on-screen size, bottom-aligned on (px, py)
            if (!opSprite('priestess_front', px - dw / 2, py - dh, dw, dh)) {
                opR(px - 5, py - 14, 10, 14, '#e5e7eb'); opR(px - 6, py - 4, 12, 4, '#e5e7eb'); opR(px - 5, py - 14, 10, 2, '#fbbf24');
                opR(px - 3, py - 20, 6, 6, '#8b5a3c'); opR(px - 4, py - 23, 8, 3, '#fbbf24'); opR(px - 1, py - 25, 2, 2, '#fde047');
            }
            x.globalAlpha = 1;
        }
        function opKoto(name, px, py, opt = {}) { // a Koto frame from the hero atlas, feet at (px, py), about the priestess's height
            const f = HERO_FRAMES[name]; if (!f || !heroAtlas2D.complete || !heroAtlas2D.naturalWidth) return false;
            const k = 32 / 110, x = OP.x; x.save(); x.imageSmoothingEnabled = true; x.translate(px, py);
            if (opt.rot) x.rotate(opt.rot); if (opt.flip) x.scale(-1, 1);
            const sh = f[3] * (opt.clip || 1);
            x.drawImage(heroAtlas2D, f[0], f[1], f[2], sh, -f[4] * k, -f[5] * k, f[2] * k, sh * k);
            x.restore(); return true;
        }
        function opGuard(px, py, head = 'own', pose = 'stand') {
            const kotoPose = { spear: ['kt_sw_idle_r', { flip: true }], thrust: ['kt_swr1', { flip: true }], stand: ['kt_down', {}],
                sit: ['kt_down', { clip: 0.62 }], lie: ['kt_down', { rot: -Math.PI / 2 }] }[pose];
            if (kotoPose) {
                let [n, o] = kotoPose, x = px, y = py;
                if (pose === 'thrust') x -= 4;                        // lunging in
                if (pose === 'sit') y = py - 6 + (HERO_FRAMES.kt_down ? HERO_FRAMES.kt_down[3] : 123) * (1 - o.clip) * (32 / 110); // the slab hides his legs: the cut edge sits on the slab
                if (pose === 'lie') { x = px + 26; y = py - 1; }      // laid along the slab, head to the left
                if (opKoto(n, x, y, o)) {
                    if (head === 'provisional' && pose !== 'lie') { const t = performance.now() / 1000; opR(x - 2, y - 26, 1, 1, 'rgba(103,232,249,' + (0.5 + Math.sin(t * 3) * 0.3).toFixed(2) + ')'); opR(x + 2, y - 26, 1, 1, 'rgba(103,232,249,' + (0.5 + Math.sin(t * 3) * 0.3).toFixed(2) + ')'); } // the provisional Head's faint eye-glow
                    return;
                }
            }
            if (pose === 'lie') { // lying on the slab, head at the left
                opR(px, py - 5, 22, 5, '#1e3a5f'); opR(px + 6, py - 5, 8, 5, '#b45309'); opR(px + 20, py - 4, 6, 3, '#3f2a1e');
                if (head === 'provisional') { opR(px - 6, py - 6, 6, 6, '#9ca3af'); opR(px - 5, py - 5, 1, 4, '#4b5563'); } return;
            }
            const sit = pose === 'sit', by = sit ? py - 6 : py;
            if (!sit) { opR(px - 4, by - 7, 3, 7, '#3f2a1e'); opR(px + 1, by - 7, 3, 7, '#3f2a1e'); } else { opR(px - 2, py - 8, 14, 4, '#3f2a1e'); }
            opR(px - 5, by - 16, 10, 10, '#1e3a5f'); opR(px - 5, by - 12, 10, 2, '#b45309'); opR(px - 6, by - 16, 12, 2, '#b45309');
            if (pose === 'spear') { opR(px + 7, by - 30, 1, 30, '#a8a29e'); opR(px + 6, by - 33, 3, 4, '#e5e7eb'); }
            if (pose === 'thrust') { opR(px - 22, by - 13, 18, 1, '#a8a29e'); opR(px - 25, by - 14, 4, 3, '#e5e7eb'); }
            if (head === 'own') { opR(px - 3, by - 22, 6, 6, '#6b3f26'); opR(px - 3, by - 23, 6, 2, '#0f172a'); }
            if (head === 'provisional') { opR(px - 3, by - 22, 6, 6, '#9ca3af'); opR(px - 3, by - 23, 6, 1, '#d1d5db'); opR(px - 1, by - 22, 1, 3, '#4b5563'); opR(px, by - 20, 1, 2, '#4b5563');
                opR(px - 2, by - 20, 1, 1, '#67e8f9'); opR(px + 1, by - 20, 1, 1, '#67e8f9'); }
        }
        function opAgent(px, py, a = 1, anim = 'idle', t = 0, loop = true) { // the Agent of the Malignant Principles, feet at (px, py), facing right
            const x = OP.x; x.globalAlpha = a;
            const A = AGENT_ANIMS[anim] || AGENT_ANIMS.idle, k = anim === 'transform' ? 0.62 : 0.6;
            if (!drawWorldFrame(x, agentFrame(anim, t, loop), px, py, k, A.anchor[0], A.anchor[1])) {
                opR(px - 6, py - 26, 12, 26, '#0a0a0f'); opR(px - 5, py - 31, 10, 7, '#0a0a0f'); opR(px - 3, py - 28, 2, 1, '#ef4444'); opR(px + 1, py - 28, 2, 1, '#ef4444');
            }
            x.globalAlpha = 1;
        }
        function opMotes(t) { for (let i = 0; i < 14; i++) { const mx = 50 + (i * 37) % 60, my = 90 - ((t * 14 + i * 13) % 70); opR(mx + Math.sin(t * 2 + i) * 3, my, 1, 1, i % 3 ? '#fcd34d' : '#fde68a'); } }
        const OPENING_BEATS = [
            { d: 5200, draw: t => { opTemple(t); opPriestess(80, 110); opGuard(126, 112, 'own', 'spear'); }, text: 'Night. The Temple of the Heads. Here the princess keeps the balance between the divine Heads and the land.' },
            { d: 5200, draw: t => { opTemple(t); opPriestess(80, 110); opGuard(126, 112, 'own', 'spear'); opAgent(18 + Math.min(1, t / 3) * 14, 112, Math.min(1, t / 1.2), t < 3 ? 'walk' : 'idle', t); }, text: 'Something crosses the threshold uninvited: an agent of the Malignant Principles, walking in a body.' },
            { d: 5200, draw: t => { opTemple(t); opAgent(56 + Math.min(1, t / 1.4) * 14, 112, 1, t < 1.4 ? 'walk' : 'idle', t); opPriestess(82, 110); opGuard(112, 112, 'own', 'spear'); }, text: 'He seizes the princess. Her sworn guard stands between him and the door.' },
            { d: 3600, draw: t => { const k = Math.sin(t * 40) * 1.5; OP.x.save(); OP.x.translate(k, 0); opTemple(t); opPriestess(62, 110); opAgent(74, 112, 1, 'attack', t); opGuard(98, 112, 'own', 'thrust');
                if (Math.floor(t * 8) % 2) { opR(84, 96, 3, 1, '#fff'); opR(85, 95, 1, 3, '#fff'); } OP.x.restore(); }, text: 'Steel meets steel.' },
            { d: 2600, draw: t => { opTemple(t); opPriestess(62, 110); opAgent(74, 112, 1, 'attack', 0.3 + t, false); opGuard(98, 112, 'own', 'thrust'); const w = Math.min(1, t / 0.35);
                OP.x.fillStyle = t < 0.9 ? 'rgba(255,255,255,' + w + ')' : '#000'; OP.x.fillRect(0, 0, 160, 144); }, text: 'A single stroke.' },
            { d: 4200, draw: t => { opTemple(t); OP.x.fillStyle = 'rgba(0,0,10,.45)'; OP.x.fillRect(0, 0, 160, 144); opGuard(92, 112, 'own', 'lie'); // he unravels into shadow and takes her with him
                const gone = Math.max(0, Math.min(1, (t - 1.4) / 1.4)); opPriestess(64 + gone * 4, 110 - gone * 3, false, 1 - gone); OP.x.globalAlpha = 1; opAgent(72, 112, 1 - gone, 'transform', t, false);
                OP.x.fillStyle = 'rgba(0,0,0,' + Math.min(1, Math.max(0, (t - 2.6) / 1.2)) + ')'; OP.x.fillRect(0, 0, 160, 144); }, text: 'He fled into the night, and took the princess with him.' },
            { d: 5000, draw: t => { opTomb(t, Math.max(0, 0.8 - t / 3)); opGuard(52, 81, 'provisional', 'lie'); opVignette(0.7); }, text: 'Stone. Cold. You wake on a funeral slab, in a tomb beneath the temple.' },
            { d: 6200, draw: t => { opTomb(t); opGuard(66, 84, 'provisional', 'sit'); opVignette(0.7); }, text: 'Your body is whole again. Your head is not your own. In its place sits a provisional Head, a tep en seshta, hastily set by whatever funerary power still lingered here.' },
            { d: 5600, draw: t => { opTomb(t); opGuard(66, 84, 'provisional', 'sit'); opVignette(0.85 + Math.sin(t * 2) * 0.05); }, text: 'You can feel that it is incomplete. Vision is muted. Authority is weak. You are no longer fully mortal, and not yet sah.' },
            { d: 5400, voice: true, draw: t => { opTomb(t); opGuard(66, 84, 'provisional', 'sit'); opPriestess(84, 60, true); opMotes(t); opVignette(0.7); }, text: '“The princess still lives. She has been taken into blighted land.”' },
            { d: 6400, voice: true, draw: t => { opTomb(t); opGuard(66, 84, 'provisional', 'sit'); opPriestess(84, 60, true); opMotes(t); opVignette(0.7); }, text: '“Only by completing true Heads and performing the restorative rites can you reach her, and oppose the Principles that now move openly.”' },
            { d: 5200, voice: true, draw: t => { opTomb(t); opGuard(66, 84, 'provisional', 'sit'); opPriestess(84, 60, true); opMotes(t); opVignette(0.7); }, text: '“Your unfinished Head is a wound. It is also a beginning.”' },
            { d: 4800, draw: t => { opTomb(t); opGuard(128, 106, 'provisional', 'stand'); opVignette(0.7); if (t > 3.6) { OP.x.fillStyle = 'rgba(0,0,0,' + Math.min(1, (t - 3.6) / 1.1) + ')'; OP.x.fillRect(0, 0, 160, 144); } }, text: 'You rise, and take the unfinished Head as your own.' }
        ];
        function opFrame() {
            if (!OP.on) return;
            const beat = OPENING_BEATS[OP.i], t = (performance.now() - OP.t0) / 1000;
            try { beat.draw(t); } catch (e) { console.warn('opening draw', e); }
            if (t * 1000 > beat.d) { opNext(); return; }
            requestAnimationFrame(opFrame);
        }
        function opShow(i) {
            OP.i = i; OP.t0 = performance.now();
            const cap = document.getElementById('opening-caption'), b = OPENING_BEATS[i];
            cap.textContent = b.text; cap.classList.toggle('voice', !!b.voice);
            if (b.voice) audio.playTone(659.25, 'sine', 1.2, 0.05);
        }
        function opNext() { if (!OP.on) return; if (OP.i + 1 >= OPENING_BEATS.length) { endOpening(); return; } opShow(OP.i + 1); requestAnimationFrame(opFrame); }
        function runOpening(replay) {
            OP.c = document.getElementById('opening-canvas'); OP.x = OP.c.getContext('2d'); OP.x.imageSmoothingEnabled = false;
            OP.on = true; OP.replay = !!replay; gameStarted = false;
            document.getElementById('opening-screen').style.display = 'block';
            opShow(0); requestAnimationFrame(opFrame);
        }
        function endOpening() {
            if (!OP.on) return;
            OP.on = false; document.getElementById('opening-screen').style.display = 'none';
            gameStarted = true;
            if (OP.replay) return;
            if (OP.mission) { finishMissionCutscene(); return; }
            try { heroHD.setOutfit('koto'); } catch (e) {} // a new game always starts as Koto
            grantHead('provisional');
            ["The priestess still lives. She has been taken into blighted land.",
             "Only by completing true Heads and performing the restorative rites can you reach her and oppose the Malignant Principles.",
             "Your unfinished Head is both a wound and a beginning."].forEach(c => { if (!journal.importantClues.includes(c)) journal.importantClues.push(c); });
            ["Who was the agent that took the priestess?", "Where does the blighted land begin?", "How is a true Head completed?"].reverse().forEach(q => { if (!journal.questions.includes(q)) journal.questions.unshift(q); });
            enterZone('waking', 7, 4);
            player.dir = 'down';
            showFluidMessage('You rise from the slab. The way out lies south.', 2600);
        }
        document.addEventListener('DOMContentLoaded', () => {
            const scr = document.getElementById('opening-screen');
            scr.addEventListener('click', e => { if (e.target.id === 'opening-skip') return; opNext(); });
            document.getElementById('opening-skip').addEventListener('click', e => { e.stopPropagation(); endOpening(); });
            ['btn-a', 'btn-x'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', () => { if (OP.on) opNext(); }); });
            const lbl = document.getElementById('mn-build'); if (lbl) lbl.textContent = 'BUILD ' + BUILD_VERSION;
        });
        window.addEventListener('keydown', e => { if (OP.on && (e.key === 'Enter' || e.key === ' ' || e.key === 'z')) { e.preventDefault(); opNext(); } });
        function replayOpening() { closeInventory(); runOpening(true); }

        function toggleBGM() { try { audio.toggleBGM(); } catch (e) { console.warn('toggleBGM', e); } }
        window.toggleBGM = toggleBGM;
        function showCredits() { audio.playSelect(); document.getElementById('credits-modal').classList.remove('hidden'); }
        function hideCredits() { audio.playSelect(); document.getElementById('credits-modal').classList.add('hidden'); }

        const PALETTES = {
            gb: { bg: '#8fb072', light: '#8fb072', midLight: '#5f8a96', midDark: '#5f7050', dark: '#152315', grass: '#4d8a44', tree: '#2f5a30', roof: '#56684f', heroHair: '#2563eb', heroCape: '#dc2626' },
            desert: { bg: '#e6c695', light: 'rgba(0,0,0,0)', midLight: '#2f5f8f', midDark: '#8c6d59', dark: '#2a1b12', grass: '#66743a', tree: '#4e5c2c', roof: '#725247', heroHair: '#2563eb', heroCape: '#dc2626' }
        };

        let currentPaletteKey = 'desert';
        let pal = PALETTES[currentPaletteKey];


        const MAP_DATA = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1,4,4,4,4,1,0,0,0,0,2,2,2,2,2,1,8,0,0,1,0,10,0,1],
            [1,0,2,2,2,0,1,3,3,3,3,1,0,8,0,0,2,2,2,8,2,1,0,0,0,1,11,0,0,1],
            [1,0,2,2,2,0,7,3,3,3,3,1,0,0,0,0,2,2,2,2,2,1,0,0,0,1,0,0,10,1],
            [1,0,0,0,0,0,0,5,0,0,0,0,9,9,0,9,9,2,2,2,2,1,0,0,0,1,0,12,0,1],
            [1,1,7,1,0,0,0,0,0,0,0,0,0,1,4,4,4,1,1,1,0,1,0,0,0,1,10,0,11,1],
            [1,0,0,0,0,0,0,6,6,6,6,0,0,1,3,3,3,1,1,1,0,1,1,1,1,1,0,0,0,1],
            [1,0,8,0,0,6,6,6,6,6,6,6,0,0,3,5,3,1,1,1,0,0,0,0,0,1,0,13,0,1],
            [1,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,8,0,0,1,10,0,0,1],
            [1,1,1,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,12,1],
            [1,6,6,0,6,6,6,6,6,6,6,6,0,0,7,0,0,8,0,0,0,1,1,1,1,1,0,11,0,1],
            [1,6,6,0,0,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,10,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,2,2,0,0,0,1,0,0,0,0,13,0,0,1],
            [1,0,4,4,4,1,0,8,0,0,0,0,0,0,2,2,2,2,0,0,0,1,0,0,0,0,0,10,0,1],
            [1,0,3,5,3,1,0,0,0,1,1,0,0,0,2,2,8,2,0,0,0,1,0,0,0,0,0,0,11,1],
            [1,0,0,0,0,0,0,0,0,1,1,0,0,0,2,2,2,2,0,0,0,1,0,0,0,0,12,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,10,1],
            [1,9,9,9,9,0,9,9,9,9,9,9,9,9,9,9,9,9,9,9,0,1,0,8,0,1,0,11,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,10,0,12,1],
            [1,0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0,1,0,0,0,1,0,0,0,1],
            [1,0,2,2,2,2,8,2,2,2,2,2,2,2,2,2,2,2,2,2,0,1,0,0,0,1,0,13,10,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,11,0,0,1],
            [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,10,0,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,14,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ];

