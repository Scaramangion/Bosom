        // ================= THE GROW HOLLOW: every plant grown from its own seed as a little 3D skeleton, never the same twice =================
        (function widenHollow() { // the old hollow stays at the top; a wide glade opens out below it
            const W = 40, H = 30, old = WOLF_HOLLOW_MAP.map(r => r.slice()); WOLF_HOLLOW_MAP.length = 0;
            const h = (x, y) => { let n = x * 374761393 + y * 668265263; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
            for (let y = 0; y < H; y++) { const row = []; for (let x = 0; x < W; x++) {
                let t = 0;
                if (y < 12 && x < 16) t = old[y][x];
                else if (x === 0 || y === 0 || x === W - 1 || y === H - 1) t = 1;
                else { const edge = Math.min(x, y - 12 < 0 ? 99 : 99, W - 1 - x, H - 1 - y); const inGlade = y >= 13 && y <= 27 && x >= 3 && x <= 36;
                    if (!inGlade && h(x, y) < (edge <= 2 ? 0.5 : 0.12)) t = h(x + 7, y) < 0.8 ? 2 : 15; }
                row.push(t); } WOLF_HOLLOW_MAP.push(row); }
            for (let x = 5; x <= 10; x++) WOLF_HOLLOW_MAP[11][x] = 0;   // the old south wall opens onto the glade
            for (let y = 8; y <= 10; y++) WOLF_HOLLOW_MAP[y][15] = 0;   // and its east wall onto the woods
            for (let y = 12; y <= 13; y++) for (let x = 4; x <= 11; x++) if (WOLF_HOLLOW_MAP[y][x] !== 1) WOLF_HOLLOW_MAP[y][x] = 0;
        })();
        const HOLLOW_W = () => WOLF_HOLLOW_MAP[0].length, HOLLOW_H = () => WOLF_HOLLOW_MAP.length;
        const GLADE = [3, 13, 36, 27]; // where things can be planted
        const BENCH = [8, 14];
        function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
        const SPECIES = {
            broadleaf: { name: 'BROADLEAF', days: 4, yields: 'fruit', every: 2, tree: true },
            flowering: { name: 'FLOWERING TREE', days: 3, yields: 'blossoms', every: 2, tree: true },
            conifer: { name: 'CONIFER', days: 5, yields: 'resin', every: 3, tree: true },
            grass: { name: 'TALL GRASS', days: 1, yields: 'hay', every: 1 },
            wildflower: { name: 'WILDFLOWER', days: 2, yields: 'flowers', every: 2 },
            meadow: { name: 'MEADOW PATCH', days: 1, yields: 'herbs', every: 2 }
        };
        const HOLLOW_GOODS = { fruit: { name: 'HOLLOW FRUIT', sell: 6 }, blossoms: { name: 'BLOSSOMS', sell: 5 }, resin: { name: 'PINE RESIN', sell: 8 }, hay: { name: 'HAY', sell: 2 }, flowers: { name: 'WILDFLOWERS', sell: 4 } };
        const GROW_DEFAULT = { leaf: 0.5, spread: 0.5, droop: 0.35, vary: 0.5 };
        // build a plant: segments [x0,y0,z0,x1,y1,z1,width,colour] and leaves [x,y,z,r,colour,kind] in world px, y up
        function growPlant(sp, seed, prm) {
            const R = rngOf(seed), r = (a, b) => a + (b - a) * R(), v = prm.vary, segs = [], leaves = [];
            const jit = (x, amt) => x * (1 + (R() - 0.5) * amt * v * 1.6);
            const hue = (h, s, l) => 'hsl(' + Math.round(h) + ',' + Math.round(s) + '%,' + Math.round(l) + '%)';
            const leafHue = r(88, 128), bark = hue(r(20, 32), 35, r(18, 28));
            const rot = (d, ax, ang) => { // rotate vector d around axis ax (unit)
                const c = Math.cos(ang), s = Math.sin(ang), [x, y, z] = d, [u, w, q] = ax, dot = u * x + w * y + q * z;
                return [x * c + (w * z - q * y) * s + u * dot * (1 - c), y * c + (q * x - u * z) * s + w * dot * (1 - c), z * c + (u * y - w * x) * s + q * dot * (1 - c)]; };
            const norm = d => { const l = Math.hypot(d[0], d[1], d[2]) || 1; return [d[0] / l, d[1] / l, d[2] / l]; };
            const branch = (p, d, len, wd, depth, flowers) => {
                d = norm([d[0], d[1] - prm.droop * 0.35 * (3 - depth) * 0.4, d[2]]);
                const e = [p[0] + d[0] * len, p[1] + d[1] * len, p[2] + d[2] * len]; segs.push([...p, ...e, wd, bark]);
                if (depth <= 0 || len < 3) {
                    const n = Math.round(r(4, 7)), lr = (1.6 + prm.leaf * 2.6);
                    for (let i = 0; i < n; i++) leaves.push([e[0] + r(-3, 3) * (0.6 + prm.spread), e[1] + r(-2, 3), e[2] + r(-3, 3) * (0.6 + prm.spread), jit(lr, 1), hue(leafHue + r(-12, 12) * v, r(45, 65), r(26, 40)), 'leaf']);
                    if (flowers) for (let i = 0; i < 2; i++) leaves.push([e[0] + r(-3, 3), e[1] + r(-1, 3), e[2] + r(-3, 3), r(0.9, 1.4), flowers, 'bloom']);
                    return;
                }
                const kids = R() < 0.35 ? 3 : 2, side = norm(Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]);
                for (let i = 0; i < kids; i++) {
                    const az = (i / kids) * Math.PI * 2 + r(-0.6, 0.6) * v, ax = norm(rot(norm([d[1] * side[2] - d[2] * side[1], d[2] * side[0] - d[0] * side[2], d[0] * side[1] - d[1] * side[0]]), d, az));
                    const nd = rot(d, ax, (0.35 + prm.spread * 0.75) * jit(1, 1));
                    branch(e, nd, len * jit(0.72, 0.8), wd * 0.66, depth - 1, flowers);
                }
            };
            if (sp === 'broadleaf' || sp === 'flowering') {
                const H = r(12, 17), fl = sp === 'flowering' ? hue(R() < 0.5 ? r(320, 350) : r(40, 55), 75, r(72, 86)) : null;
                branch([0, 0, 0], [r(-0.1, 0.1) * v, 1, r(-0.1, 0.1) * v], H, 2.6, 3, fl);
            } else if (sp === 'conifer') {
                const H = r(30, 42), tiers = Math.round(r(5, 8)); segs.push([0, 0, 0, 0, H, 0, 2.4, bark]);
                for (let t = 0; t < tiers; t++) { const y = H * (0.22 + 0.74 * t / tiers), L = (H * 0.42) * (1 - t / tiers) * (0.6 + prm.spread * 0.8) + 2, n = Math.round(r(5, 7));
                    for (let i = 0; i < n; i++) { const az = i / n * Math.PI * 2 + r(-0.4, 0.4) * v + t * 0.7, dx = Math.cos(az), dz = Math.sin(az), dy = -(0.15 + prm.droop * 0.6);
                        const e = [dx * L, y + dy * L, dz * L]; segs.push([0, y, 0, ...e, 1.1, bark]);
                        for (let k = 1; k <= 4; k++) { const f = k / 4; leaves.push([dx * L * f, y + dy * L * f + 0.5, dz * L * f, (1.2 + prm.leaf * 1.6) * (1.2 - f * 0.4), hue(r(130, 155), r(30, 45), r(16, 26)), 'needle']); } } }
                leaves.push([0, H + 1.5, 0, 1.6 + prm.leaf, hue(140, 40, 22), 'needle']);
            } else if (sp === 'grass' || sp === 'meadow') {
                const n = sp === 'grass' ? Math.round(r(10, 18)) : Math.round(r(18, 30)), rad = sp === 'grass' ? 2 + prm.spread * 3 : 5 + prm.spread * 7;
                for (let i = 0; i < n; i++) { const a = r(0, Math.PI * 2), d0 = Math.sqrt(R()) * rad, bx = Math.cos(a) * d0, bz = Math.sin(a) * d0, h = (sp === 'grass' ? r(8, 15) : r(4, 9)) * (0.8 + prm.leaf * 0.5);
                    const lean = r(0, Math.PI * 2), dr = prm.droop * r(0.3, 1.2), col = hue(r(70, 105) - (sp === 'grass' ? R() * 30 * v : 0), r(40, 60), r(28, 46));
                    let p = [bx, 0, bz]; for (let s = 1; s <= 3; s++) { const f = s / 3, q = [bx + Math.cos(lean) * dr * h * f * f * 0.6, h * f * (1 - dr * 0.25 * f), bz + Math.sin(lean) * dr * h * f * f * 0.6]; segs.push([...p, ...q, 0.9 - s * 0.2, col]); p = q; }
                    if (sp === 'meadow' && R() < 0.25) leaves.push([p[0], p[1] + 0.5, p[2], r(0.7, 1.1), hue([50, 0, 280, 200][Math.floor(R() * 4)], 70, r(65, 80)), 'bloom']); }
            } else if (sp === 'wildflower') {
                const n = Math.round(r(2, 5)), fh = R() < 0.3 ? r(0, 20) : R() < 0.5 ? r(260, 300) : r(40, 60);
                for (let i = 0; i < n; i++) { const a = r(0, Math.PI * 2), h = r(8, 14) * (0.8 + prm.spread * 0.3), lean = (prm.droop * 0.5 + 0.1) * v * 2;
                    const top = [Math.cos(a) * h * lean * 0.4, h, Math.sin(a) * h * lean * 0.4]; segs.push([0, 0, 0, top[0] * 0.5, h * 0.55, top[2] * 0.5, 0.7, hue(leafHue, 45, 30)]); segs.push([top[0] * 0.5, h * 0.55, top[2] * 0.5, ...top, 0.6, hue(leafHue, 45, 32)]);
                    leaves.push([top[0] * 0.3, h * 0.3, top[2] * 0.3, 1.2 + prm.leaf * 1.2, hue(leafHue, 50, 34), 'leaf']);
                    const pr = 1.2 + prm.leaf * 1.4; for (let k = 0; k < 5; k++) { const pa = k / 5 * Math.PI * 2; leaves.push([top[0] + Math.cos(pa) * pr * 0.7, top[1], top[2] + Math.sin(pa) * pr * 0.7, pr * 0.62, hue(fh + r(-8, 8), 75, r(60, 74)), 'bloom']); }
                    leaves.push([top[0], top[1] + 0.3, top[2], pr * 0.45, hue(48, 90, 55), 'bloom']); }
            }
            return { segs, leaves, stats: { branches: segs.length, leaves: leaves.length, tris: segs.length * 2 + leaves.length * 6, verts: segs.length * 4 + leaves.length * 7 } };
        }
        function drawPlant(c, P, cx, fy, yaw, scl, fruit) { // project the skeleton for this camera angle, back to front
            const cs = Math.cos(yaw), sn = Math.sin(yaw), items = [];
            const pr = (x, y, z) => { const X = x * cs - z * sn, D = x * sn + z * cs; return [cx + X * scl, fy - (y + D * 0.25) * scl, D]; };
            for (const s of P.segs) { const a = pr(s[0], s[1], s[2]), b = pr(s[3], s[4], s[5]); items.push([(a[2] + b[2]) / 2 - 0.01, 0, a, b, s[6], s[7]]); }
            for (const l of P.leaves) { const p = pr(l[0], l[1], l[2]); items.push([p[2], 1, p, null, l[3], l[4], l[5]]); }
            if (fruit) for (let i = 0; i < P.leaves.length; i += 6) { const l = P.leaves[i]; const p = pr(l[0], l[1] - 1, l[2]); items.push([p[2] - 0.5, 1, p, null, 1.3, fruit, 'fruit']); }
            items.sort((u, w) => w[0] - u[0]); // far first
            c.lineCap = 'round';
            for (const it of items) {
                if (!it[1]) { c.strokeStyle = it[5]; c.lineWidth = Math.max(0.6, it[4] * scl); c.beginPath(); c.moveTo(it[2][0], it[2][1]); c.lineTo(it[3][0], it[3][1]); c.stroke(); continue; }
                const [x, y, d] = it[2], rr = it[4] * scl, kind = it[6], shade = Math.max(-14, Math.min(10, -d * 1.3));
                c.fillStyle = it[5]; c.beginPath();
                if (kind === 'needle') { c.moveTo(x, y - rr * 1.3); c.lineTo(x + rr, y + rr * 0.6); c.lineTo(x - rr, y + rr * 0.6); c.closePath(); }
                else c.ellipse(x, y, rr, rr * (kind === 'leaf' ? 0.72 : 1), 0, 0, Math.PI * 2);
                c.fill(); if (shade < -4) { c.fillStyle = 'rgba(0,0,0,' + (-shade / 40).toFixed(2) + ')'; c.fill(); } else if (shade > 3 && kind !== 'fruit') { c.fillStyle = 'rgba(255,255,230,' + (shade / 60).toFixed(2) + ')'; c.fill(); }
            }
        }
        // ---- the grove: what you've planted ----
        const GROW_MEM = {};
        function grove() { const F = farmState(); F.grove = F.grove || []; F.hollowGoods = F.hollowGoods || { fruit: 0, blossoms: 0, resin: 0, hay: 0, flowers: 0 }; return F.grove; }
        function plantAt(gx, gy) { return grove().find(p => p.x === gx && p.y === gy) || null; }
        function plantGrowth(p) { const S = SPECIES[p.sp]; return Math.min(1, (gameDay() - p.day) / S.days); }
        function plantReady(p) { const S = SPECIES[p.sp]; return plantGrowth(p) >= 1 && gameDay() - (p.cut == null ? p.day + S.days - S.every : p.cut) >= S.every; }
        function plantModel(p) { return GROW_MEM[p.id] || (GROW_MEM[p.id] = growPlant(p.sp, p.seed, p.prm)); }
        function growSolid(gx, gy) { if (currentMapName !== 'wolf_hollow') return false; const p = plantAt(gx, gy); return !!(p && SPECIES[p.sp].tree && plantGrowth(p) > 0.25) || (gx === BENCH[0] && gy === BENCH[1]); }
        function inGlade(gx, gy) { return gx >= GLADE[0] && gx <= GLADE[2] && gy >= GLADE[1] && gy <= GLADE[3]; }
        const FRUIT_COL = { broadleaf: '#e0442c', flowering: '#f9a8d4', conifer: '#a16207' };
        function drawGrove() { // in the hollow: field dressing on the ground, plants and the bench standing up
            const T = TILE_SIZE, yb = ((Math.round(camYaw() / (Math.PI / 4)) % 8) + 8) % 8, yaw = yb * Math.PI / 4;
            for (let y = 12; y < HOLLOW_H() - 1; y++) for (let x = 1; x < HOLLOW_W() - 1; x++) { // wild grass, dry stalks, small stones
                if (WOLF_HOLLOW_MAP[y][x] !== 0 || plantAt(x, y)) continue; let n = (x * 73856093) ^ (y * 19349663); n = (n ^ (n >>> 13)) >>> 0;
                const tx = x * T, ty = y * T, k = n % 7;
                if (k < 3) { ctx.strokeStyle = k === 0 ? '#3f6b2e' : '#4d7c34'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 3; i++) { const bx = tx + 3 + ((n >> (i * 3)) & 7) + i, by = ty + 12 - ((n >> 9) & 3); ctx.moveTo(bx, by); ctx.lineTo(bx + (i - 1), by - 3 - i); } ctx.stroke(); }
                else if (k === 3) { ctx.strokeStyle = '#a58a55'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx + 9, ty + 13); ctx.lineTo(tx + 10, ty + 7); ctx.moveTo(tx + 10, ty + 9); ctx.lineTo(tx + 12, ty + 8); ctx.stroke(); }
                else if (k === 4) { ctx.fillStyle = '#6b6b63'; ctx.beginPath(); ctx.ellipse(tx + 6 + (n & 3), ty + 11, 1.6, 1.1, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#8a8a80'; ctx.fillRect(tx + 5 + (n & 3), ty + 10, 1, 1); }
            }
            { const cx = BENCH[0] * T + 8, fy = BENCH[1] * T + 15; asCard(cx, fy, () => drawBench(cx, fy), 'gr_bench'); }
            const px = player.gridX, py = player.gridY;
            for (const p of grove()) {
                if (Math.abs(p.x - px) > 12 || Math.abs(p.y - py) > 12) continue;
                const g = plantGrowth(p), st = Math.min(4, Math.floor(g * 4)), ready = plantReady(p), cx = p.x * T + 8, fy = p.y * T + 15;
                const key = 'gp_' + p.id + '_' + yb + '_' + st + (ready ? 'r' : ''), mem = GROW_MEM[p.id + ':k'];
                if (mem && mem !== key && CARD_CACHE[mem]) { const old = CARD_CACHE[mem]; if (old.tex && FX_GL.gl) FX_GL.gl.deleteTexture(old.tex); delete CARD_CACHE[mem]; }
                GROW_MEM[p.id + ':k'] = key;
                const P = plantModel(p), scl = 0.3 + 0.7 * g;
                ctx.fillStyle = 'rgba(40,28,16,.55)'; ctx.beginPath(); ctx.ellipse(cx, fy - 1, 4 + 3 * g, 1.6 + g, 0, 0, 7); ctx.fill(); // its patch of turned earth
                asCard(cx, fy, () => { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; drawPlant(ctx, P, cx, fy - 1, yaw, scl, ready && SPECIES[p.sp].tree ? FRUIT_COL[p.sp] : null); ctx.imageSmoothingEnabled = sm;
                    if (ready) { ctx.fillStyle = '#fef9c3'; ctx.fillRect(cx - 1, fy - 3 - 30 * scl, 2, 2); } }, key);
            }
        }
        function drawBench(cx, fy) { // a potting bench: where the catalog lives
            const r = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(cx + a, fy + b, w, h); };
            r(-9, -9, 18, 3, '#8b5a2b'); r(-9, -6, 18, 1, '#5b3a22'); r(-8, -6, 2, 6, '#5b3a22'); r(6, -6, 2, 6, '#5b3a22');
            r(-7, -14, 4, 5, '#b45309'); r(-6, -18, 2, 4, '#4d7c0f'); r(-8, -19, 2, 2, '#65a30d'); r(-4, -19, 2, 2, '#65a30d');
            r(-1, -13, 4, 4, '#9a3412'); r(0, -16, 1, 3, '#4d7c0f'); r(1, -18, 2, 2, '#f472b6');
            r(5, -12, 4, 3, '#a16207'); r(6, -13, 2, 1, '#fde68a'); r(-9, -22, 18, 1, '#6b4423'); r(-3, -26, 6, 4, '#d6b98c'); r(-2, -25, 4, 1, '#6b4423');
        }
        // ---- the catalog: pick a species, shape it, shuffle it, plant it ----
        const CAT = { sp: 'broadleaf', seed: 1, prm: Object.assign({}, GROW_DEFAULT), yaw: 0.6, target: null, raf: 0, drag: null };
        function openCatalog(target) {
            const el = document.getElementById('grow-cat'); if (!el) return;
            CAT.target = target || null; CAT.seed = (Math.random() * 4294967296) >>> 0; inDialogue = true;
            el.classList.add('on'); renderCatalogUI(); spinCatalog();
        }
        function closeCatalog() { const el = document.getElementById('grow-cat'); el.classList.remove('on'); cancelAnimationFrame(CAT.raf); setTimeout(() => { inDialogue = false; }, 60); }
        function renderCatalogUI() {
            const el = document.getElementById('grow-cat');
            el.querySelector('.gc-species').innerHTML = Object.entries(SPECIES).map(([k, S]) => '<button data-sp="' + k + '" class="' + (k === CAT.sp ? 'on' : '') + '">' + S.name + '</button>').join('');
            el.querySelectorAll('.gc-species button').forEach(b => b.onclick = () => { CAT.sp = b.dataset.sp; CAT.seed = (Math.random() * 4294967296) >>> 0; audio.playSelect(); renderCatalogUI(); }); // re-checks the spot for the new species
            ['leaf', 'spread', 'droop', 'vary'].forEach(k => { const s = el.querySelector('input[data-k="' + k + '"]'); s.value = Math.round(CAT.prm[k] * 100); s.oninput = () => { CAT.prm[k] = s.value / 100; }; });
            const S = SPECIES[CAT.sp]; el.querySelector('.gc-info').textContent = S.name + '  ·  GROWS IN ' + S.days + ' DAY' + (S.days > 1 ? 'S' : '') + '  ·  GIVES ' + (S.yields === 'herbs' ? 'HERBS' : HOLLOW_GOODS[S.yields].name) + '  ·  PLANTED: ' + grove().length;
            el.querySelector('.gc-plant').style.display = CAT.target ? '' : 'none';
            const why = CAT.target ? PLACER.check('wolf_hollow', CAT.target[0], CAT.target[1], CAT.sp) : null, btn = el.querySelector('.gc-plant');
            btn.disabled = !!why; btn.style.opacity = why ? 0.45 : 1;
            let note = el.querySelector('.gc-spot'); if (!note) { note = document.createElement('div'); note.className = 'gc-spot'; el.querySelector('.gc-info').after(note); }
            if (!CAT.target) note.textContent = 'BROWSING. FACE OPEN GROUND IN THE GLADE AND PRESS A TO PLANT.';
            else if (!why) note.innerHTML = '<span style="color:#bef264">\u2714 GOOD SPOT</span>';
            else { const alt = PLACER.nearest('wolf_hollow', CAT.target[0], CAT.target[1], CAT.sp); note.innerHTML = '<span style="color:#fca5a5">\u2716 ' + why.toUpperCase() + '</span>' + (alt ? ' <button class="gc-alt">USE NEAREST GOOD SPOT</button>' : '');
                const b2 = note.querySelector('.gc-alt'); if (b2) b2.onclick = () => { CAT.target = alt; audio.playSelect(); renderCatalogUI(); }; }
        }
        function spinCatalog() {
            const el = document.getElementById('grow-cat'), cv = el.querySelector('canvas'), c = cv.getContext('2d');
            const tick = () => {
                if (!el.classList.contains('on')) return;
                if (!CAT.drag) CAT.yaw += 0.008;
                const P = growPlant(CAT.sp, CAT.seed, CAT.prm);
                c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
                const g = c.createRadialGradient(cv.width / 2, cv.height * 0.85, 10, cv.width / 2, cv.height * 0.6, cv.width * 0.7); g.addColorStop(0, '#26402a'); g.addColorStop(1, '#0b140d'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
                c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cv.width / 2, cv.height * 0.86, 46, 10, 0, 0, 7); c.fill();
                const big = SPECIES[CAT.sp].tree ? (CAT.sp === 'conifer' ? 4.2 : 4.6) : 7; drawPlant(c, P, cv.width / 2, cv.height * 0.86, CAT.yaw, big);
                el.querySelector('.gc-stats').textContent = 'SEED ' + CAT.seed.toString(16).toUpperCase().padStart(8, '0') + '   BRANCHES ' + P.stats.branches + '   LEAVES ' + P.stats.leaves + '   TRIS ' + P.stats.tris + '   VERTS ' + P.stats.verts;
                CAT.raf = requestAnimationFrame(tick);
            };
            cancelAnimationFrame(CAT.raf); tick();
        }
        (function wireCatalogDrag() { const go = () => { const cv = document.querySelector('#grow-cat canvas'); if (!cv) return setTimeout(go, 300);
            cv.addEventListener('pointerdown', e => { CAT.drag = e.clientX; cv.setPointerCapture(e.pointerId); });
            cv.addEventListener('pointermove', e => { if (CAT.drag != null) { CAT.yaw += (e.clientX - CAT.drag) * 0.02; CAT.drag = e.clientX; } });
            ['pointerup', 'pointercancel'].forEach(t => cv.addEventListener(t, () => { CAT.drag = null; })); }; go(); })();
        function catalogShuffle() { CAT.seed = (Math.random() * 4294967296) >>> 0; audio.playSelect(); }
        function catalogPlant() {
            if (!CAT.target) return; const why = PLACER.check('wolf_hollow', CAT.target[0], CAT.target[1], CAT.sp); if (why) { showFluidMessage('Not here: ' + why + '.', 1800); return; }
            const F = farmState(), id = (F.groveSeq = (F.groveSeq || 0) + 1);
            grove().push({ id, sp: CAT.sp, seed: CAT.seed, prm: Object.assign({}, CAT.prm), x: CAT.target[0], y: CAT.target[1], day: gameDay(), cut: null });
            audio.playClue && audio.playClue(); closeCatalog(); showFluidMessage('Planted a ' + SPECIES[CAT.sp].name.toLowerCase() + ' that has never existed before.  (' + grove().length + ' in the hollow)', 2400); updateFarmHud();
        }
        function growInteract() { // A in the hollow
            if (currentMapName !== 'wolf_hollow' || inDialogue || POUCH.state || HORSE.mounted) return false;
            const v = DIR8_VEC[player.dir] || [0, 1], fx = player.gridX + v[0], fy = player.gridY + v[1], F = farmState();
            if (fx === BENCH[0] && fy === BENCH[1]) { openCatalog(null); return true; }
            const p = plantAt(fx, fy) || plantAt(player.gridX, player.gridY);
            if (p) {
                const S = SPECIES[p.sp];
                if (plantReady(p)) { p.cut = gameDay(); const n = 1 + (rngOf(p.seed + gameDay())() < 0.35 ? 1 : 0);
                    if (S.yields === 'herbs') F.pantry.herbs += n; else F.hollowGoods[S.yields] += n;
                    audio.playClue && audio.playClue(); showFluidMessage('Gathered ' + n + ' ' + (S.yields === 'herbs' ? 'herbs' : HOLLOW_GOODS[S.yields].name.toLowerCase()) + '. Carry it up to town; the merchant buys it.', 2400); }
                else { const g = plantGrowth(p); showFluidMessage(S.name + ' #' + p.seed.toString(16).toUpperCase().slice(0, 4) + (g < 1 ? '  ·  growing, ' + Math.ceil((1 - g) * S.days) + ' day(s) to go' : '  ·  resting; it gives again soon'), 1800); }
                updateFarmHud(); return true;
            }
            if (inGlade(fx, fy) && WOLF_HOLLOW_MAP[fy][fx] === 0 && !(player.gridX === fx && player.gridY === fy)) { openCatalog([fx, fy]); return true; }
            return false;
        }
