        // ================= TOWNSFOLK: people who live in the world, not pins on the map =================
        // FOLK above is the database (who someone is). TOWN.live holds the instance (what they're doing right now).
        // A schedule says where each hour of the day finds them; the path finder walks them there over the tile map; a small
        // state machine runs the rest (walk, idle, work, talk, sleep, and after dark for a few of them: prowl).
        // Level of detail: near the hero they walk every step; far away, or while you're elsewhere, they simply arrive.
        const TOWN_LOC = { // named spots on Brennan's Theme (tiles)
            fountain: [30, 12], fountainW: [26, 9], fountainE: [34, 9], marketW: [24, 3], marketE: [35, 3], marketS: [29, 14],
            shop: [52, 6], houseW: [15, 9], houseE: [44, 9], cottageW: [3, 16], cottageE: [56, 16], gate: [29, 16],
            avenueW: [9, 12], avenueE: [60, 12], forecourt: [55, 6], plazaN: [30, 4],
            field: [7, 20], well: [20, 22], stall: [18, 19], guide: [7, 18], barn: [35, 20]
        };
        const TOWN_SCHED = { // [from hour, to hour, activity, place]; 'sleep' = indoors at that door, 'prowl' = up to no good (some nights)
            elder: [[6, 9, 'idle', 'houseW'], [9, 13, 'idle', 'fountainW'], [13, 17, 'idle', 'plazaN'], [17, 21, 'stroll', 'avenueW'], [21, 6, 'sleep', 'houseW']],
            child: [[7, 12, 'play', 'fountain'], [12, 14, 'idle', 'cottageW'], [14, 19, 'play', 'gate'], [19, 7, 'sleep', 'cottageW']],
            clito: [[8, 12, 'work', 'marketW'], [12, 17, 'idle', 'houseE'], [17, 22, 'idle', 'fountainE'], [22, 2, 'prowl', 'avenueE'], [2, 8, 'sleep', 'houseE']],
            franz: [[6, 10, 'stroll', 'avenueE'], [10, 16, 'work', 'shop'], [16, 21, 'idle', 'cottageE'], [21, 24, 'prowl', 'avenueW'], [0, 6, 'sleep', 'cottageE']],
            sudashorn: [[7, 11, 'idle', 'fountain'], [11, 15, 'work', 'marketE'], [15, 19, 'stroll', 'gate'], [19, 21, 'idle', 'plazaN'], [21, 7, 'sleep', 'houseW']],
            farmer: [[5, 12, 'work', 'field'], [12, 14, 'idle', 'well'], [14, 19, 'work', 'field'], [19, 5, 'sleep', 'cottageW']],
            merchant: [[6, 21, 'work', 'stall'], [21, 6, 'sleep', 'shop']],
            guide: [[0, 24, 'idle', 'guide']]
        };
        const TOWN = { live: {}, map: null };
        function townSlot(id, h) { const S = TOWN_SCHED[id]; if (!S) return null; for (const s of S) { const a = s[0], b = s[1]; if (a < b ? h >= a && h < b : h >= a || h < b) return s; } return S[0]; }
        function townOpen(x, y) { return x > 0 && y > 0 && x < MAP_COLS - 1 && y < MAP_ROWS - 1 && [0, 8, 12].includes(MAP_DATA[y][x]) && !FARM_SOLID.has(x + ',' + y) && !FARM_PLOTS.some(p => p[0] === x && p[1] === y); }
        function townPath(x0, y0, x1, y1) { // breadth-first over the street grid (every step costs the same, so this is A* with a flat heuristic); [] if unreachable
            if (x0 === x1 && y0 === y1) return [];
            const W = MAP_COLS, prev = new Int32Array(W * MAP_ROWS).fill(-1), q = [y0 * W + x0], goal = y1 * W + x1; prev[q[0]] = q[0];
            for (let h = 0; h < q.length; h++) { const k = q[h]; if (k === goal) break; const x = k % W, y = (k / W) | 0;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nk = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= MAP_ROWS || prev[nk] >= 0 || !(townOpen(nx, ny) || nk === goal)) continue; prev[nk] = k; q.push(nk); } }
            if (prev[goal] < 0) return [];
            const out = []; for (let k = goal; k !== y0 * W + x0; k = prev[k]) out.push([k % W, (k / W) | 0]); return out.reverse();
        }
        function townSpot(place, id, taken) { // the nearest free street tile to a named place (people don't stand in each other)
            const at = TOWN_LOC[place] || [30, 12], q = [at], seen = new Set();
            while (q.length && seen.size < 500) { const [x, y] = q.shift(), k = x + ',' + y; if (seen.has(k)) continue; seen.add(k);
                if (townOpen(x, y) && !taken.has(k)) return [x, y]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.push([x + dx, y + dy]); }
            return at;
        }
        function townLive(f) {
            let n = TOWN.live[f.id]; if (n) return n;
            const s = townSlot(f.id, gameHour()); if (!s) return null;
            const p = townSpot(s[3], f.id, new Set(Object.values(TOWN.live).map(o => o.x + ',' + o.y)));
            n = TOWN.live[f.id] = { id: f.id, x: p[0], y: p[1], px: p[0] * 16, py: p[1] * 16, state: s[2] === 'sleep' ? 'sleep' : 'idle', activity: s[2], place: s[3], path: [], wait: 0, flip: false, talkT: 0, prowl: null, step: 0 };
            return n;
        }
        function townPlan(n, s, near) { // a new hour, a new errand: where to, and how
            const taken = new Set(Object.values(TOWN.live).filter(o => o !== n).map(o => o.x + ',' + o.y));
            n.activity = s[2]; n.place = s[3]; n.prowl = null;
            if (s[2] === 'prowl' && !(hash1(gameDay() * 31 + n.id.length * 7) < 0.45)) n.activity = 'sleep'; // not every night: most nights they sleep like decent folk
            const dest = townSpot(n.activity === 'sleep' ? s[3] : s[3], n.id, taken);
            if (!near) { n.x = dest[0]; n.y = dest[1]; n.px = n.x * 16; n.py = n.y * 16; n.path = []; n.state = n.activity === 'sleep' ? 'sleep' : n.activity === 'prowl' ? 'prowl' : 'idle'; if (n.state === 'prowl') n.prowl = { mode: 'skulk', stole: 0, moves: 0 }; return; }
            n.path = townPath(n.x, n.y, dest[0], dest[1]); n.state = 'walk';
        }
        function townStep() { // once per simulation step
            const h = gameHour(), here = currentMapName === 'overworld', F = farmState();
            for (const f of FOLK) {
                if (!TOWN_SCHED[f.id] || F.spouse === f.id) continue;
                const n = townLive(f); if (!n) continue;
                const s = townSlot(f.id, h), near = here && Math.max(Math.abs(n.x - player.gridX), Math.abs(n.y - player.gridY)) < 16;
                if (s && (s[2] !== n.activity || s[3] !== n.place) && !(n.activity === 'sleep' && s[2] === 'prowl' && n.place === s[3])) {
                    if (n.state === 'sleep' && near && s[2] !== 'sleep') { const d = townSpot(n.place, n.id, new Set()); n.x = d[0]; n.y = d[1]; n.px = n.x * 16; n.py = n.y * 16; } // out the door
                    townPlan(n, s, near);
                }
                if (n.talkT > 0) { n.talkT--; continue; }
                const sp = n.state === 'prowl' && n.prowl && n.prowl.mode === 'flee' ? 2.4 : n.state === 'prowl' ? 0.8 : 1.1;
                if (n.px !== n.x * 16 || n.py !== n.y * 16) { const dx = n.x * 16 - n.px, dy = n.y * 16 - n.py, d = Math.hypot(dx, dy), m = Math.min(d, sp); n.px += dx / d * m; n.py += dy / d * m; n.step++; continue; }
                if (n.state === 'walk') {
                    if (!n.path.length) { n.state = n.activity === 'sleep' ? 'sleep' : n.activity === 'prowl' ? 'prowl' : 'idle'; if (n.state === 'prowl') n.prowl = { mode: 'skulk', stole: 0, moves: 0 }; continue; }
                    const [nx, ny] = n.path[0];
                    if ((nx === player.gridX && ny === player.gridY) || (!townOpen(nx, ny) && n.path.length > 1)) { if (++n.wait > 90) { n.wait = 0; const last = n.path[n.path.length - 1]; n.path = townPath(n.x, n.y, last[0], last[1]); } continue; }
                    n.wait = 0; n.path.shift(); if (nx !== n.x) n.flip = nx < n.x; n.x = nx; n.y = ny; continue;
                }
                if ((n.activity === 'play' || n.activity === 'stroll') && n.state === 'idle' && Math.random() < (n.activity === 'play' ? 0.012 : 0.005)) { // little wanders round their spot
                    const base = TOWN_LOC[n.place], d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(Math.random() * 4) | 0], nx = n.x + d[0], ny = n.y + d[1];
                    if (townOpen(nx, ny) && Math.abs(nx - base[0]) + Math.abs(ny - base[1]) <= (n.activity === 'play' ? 4 : 6) && !(nx === player.gridX && ny === player.gridY) && !townFolkAt(nx, ny, n)) { if (d[0]) n.flip = d[0] < 0; n.x = nx; n.y = ny; }
                }
                if (n.state === 'prowl') prowlStep(n, f, here);
            }
        }
        function townFolkAt(x, y, except) { for (const id in TOWN.live) { const o = TOWN.live[id]; if (o !== except && o.state !== 'sleep' && o.x === x && o.y === y) return o; } return null; }
        // ---- the neighbours up to no good: after dark a hooded figure sneaks up for your coin pouch; catch them and they hand it back ----
        function prowlStep(n, f, here) {
            const P = n.prowl; if (!P) return;
            if (!here || player.gridY >= FIELD_TOP - 1) { if (P.mode === 'flee' && ++P.moves > 40) n.state = 'sleep'; return; } // he only bothers you in town
            const dx = player.gridX - n.x, dy = player.gridY - n.y, cheb = Math.max(Math.abs(dx), Math.abs(dy)), F = farmState();
            if (cheb <= 1 && P.mode === 'skulk' && !P.done) {
                const v = DIR8_VEC[player.face8 || player.dir] || [0, 1], facing = v[0] === -Math.sign(dx) && v[1] === -Math.sign(dy);
                if (facing) { P.done = true; P.mode = 'flee'; showFluidMessage(f.name + ' freezes, hood half off. "I was... just admiring your boots." Off he scurries, red-faced.', 3200); }
                else { const k = Math.min(F.coins || 0, 2 + ((Math.random() * 4) | 0)); F.coins = (F.coins || 0) - k; P.stole = k; P.done = true; P.mode = 'flee'; P.grace = 45; n.wait = 99; updateFarmHud();
                    showFluidMessage(k ? 'Someone bumps you in the dark. Your pouch is ' + k + ' coins lighter. A hooded figure is running: catch him!' : 'A hand slips into your pouch and finds it empty. The hooded figure hisses and bolts.', 3400); }
                return;
            }
            if (P.grace > 0) P.grace--;
            if (cheb <= 1 && P.mode === 'flee' && P.stole && !(P.grace > 0)) { F.coins = (F.coins || 0) + P.stole; updateFarmHud(); showFluidMessage('Caught! It\'s ' + f.name + '. "Alright, alright, here!" (+' + P.stole + ' coins back)', 3200); P.stole = 0; return; }
            if (n.px !== n.x * 16 || n.py !== n.y * 16) return;
            if (++n.wait < (P.mode === 'flee' ? 6 : 24)) return; n.wait = 0;
            const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([ax, ay]) => [n.x + ax, n.y + ay]).filter(([x, y]) => townOpen(x, y) && y < FIELD_TOP - 1 && !(x === player.gridX && y === player.gridY) && !townFolkAt(x, y, n));
            if (!opts.length) return;
            const dist = ([x, y]) => Math.hypot(x - player.gridX, y - player.gridY), fv = DIR8_VEC[player.face8 || player.dir] || [0, 1], bx = player.gridX - fv[0], by = player.gridY - fv[1], behind = ([x, y]) => Math.hypot(x - bx, y - by) + (Math.abs(x - player.gridX) + Math.abs(y - player.gridY) < 2 && !(x === bx && y === by) ? 1.5 : 0);
            let pick;
            if (P.mode === 'flee') { opts.sort((a, b) => dist(b) - dist(a)); pick = opts[0]; if (++P.moves > 16 || dist(pick) > 13) { n.state = 'sleep'; n.prowl = null; if (P.stole) showFluidMessage('The hooded figure slips into an alley with ' + P.stole + ' of your coins.', 2800); return; } }
            else if (dist([n.x, n.y]) < 10 && Math.random() < 0.8) { opts.sort((a, b) => behind(a) - behind(b)); pick = opts[0]; } // creeping up behind you
            else pick = opts[(Math.random() * opts.length) | 0];
            if (pick[0] !== n.x) n.flip = pick[0] < n.x; n.x = pick[0]; n.y = pick[1];
        }
        // ---- Sudashorn's own sprite sheet: standing, a run cycle, and a little twirl (she spins round to face you when you talk) ----
        const SUD_ART = { img: new Image(), F: {"spin0": [0, 23, 97, 77], "spin1": [99, 22, 96, 78], "spin2": [197, 18, 88, 82], "spin3": [287, 13, 85, 87], "spin4": [374, 15, 82, 85], "spin5": [458, 6, 80, 94], "stand": [540, 4, 48, 96], "run0": [590, 3, 102, 97], "run1": [694, 0, 105, 100], "run2": [801, 3, 101, 97]}, ready: false };
        { const el = document.getElementById('sud-atlas'); if (el) { SUD_ART.img.onload = () => { SUD_ART.ready = true; }; SUD_ART.img.src = el.textContent.trim(); } }
        function drawSud(cx, fy, flip, mode, step, spinT) { // frames face right; flip for left. Drawn at Koto's scale.
            const F = SUD_ART.F, name = mode === 'spin' ? (spinT >= 1 ? 'stand' : 'spin' + Math.min(5, Math.floor(spinT * 6))) : mode === 'walk' ? 'run' + (Math.floor(step / 7) % 3) : 'stand', r = F[name], k = FOLK_SIZE.human / F.stand[3];
            const w = r[2] * k, h = r[3] * k, sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.save(); ctx.translate(cx, fy); if (flip) ctx.scale(-1, 1);
            ctx.drawImage(SUD_ART.img, r[0], r[1], r[2], r[3], -w / 2, -h, w, h); ctx.restore(); ctx.imageSmoothingEnabled = sm;
        }
        function townDraw(f, n, T) { // the standing card for a townsperson (hooded when prowling)
            const cx = n.px + 8, fy = n.py + 15, walking = n.px !== n.x * 16 || n.py !== n.y * 16, bob = walking ? Math.abs(Math.sin(n.step * 0.35)) * 1.2 : 0, hood = n.state === 'prowl';
            if (!hood && f.id === 'sudashorn' && SUD_ART.ready) { const spinT = n.spinAt ? (performance.now() - n.spinAt) / 650 : 1; asCard(cx, fy, () => drawSud(cx, fy, n.flip, spinT < 1 ? 'spin' : walking ? 'walk' : 'stand', n.step, spinT), walking || spinT < 1 ? null : 'sud_' + (n.flip ? 'l' : 'r')); return; }
            if (!hood) { asCard(cx, fy, () => farmSprite(f.art, cx, fy - bob, folkWidth(f), n.flip), walking ? null : 'fo_' + f.id + (n.flip ? '_f' : '')); return; }
            asCard(cx, fy, () => {
                farmSprite(f.art, cx, fy - bob, folkWidth(f), n.flip);
                if (cardMode()) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(14,12,26,0.74)'; ctx.fillRect(0, 0, 128, 128); ctx.restore(); }
                const fr = FARM_ART.F[f.art], hh = fr ? 1.15 * T * fr[3] / fr[2] : 26, top = fy - bob - hh;
                ctx.fillStyle = '#16121f'; ctx.beginPath(); ctx.moveTo(cx - 6, top + hh * 0.42); ctx.quadraticCurveTo(cx - 6.5, top + hh * 0.05, cx, top - 2.5); ctx.quadraticCurveTo(cx + 6.5, top + hh * 0.05, cx + 6, top + hh * 0.42); ctx.closePath(); ctx.fill();
                ctx.fillStyle = '#e9d17a'; ctx.fillRect(cx - 2.5, top + hh * 0.2, 1, 1); ctx.fillRect(cx + 1.5, top + hh * 0.2, 1, 1); // two glints under the hood
            });
        }
