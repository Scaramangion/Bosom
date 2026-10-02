        // ================= TERRAIN: common-sense placement + painted ground for the tile-built places (the hollow, the cave, the tombs) =================
        // PLACER: every object has a footprint and a clearance. Trees never crowd each other, paths/doors/benches stay clear,
        // and nothing solid may cut a place in two (a flood fill from the entrance has to reach everywhere it reached before).
        const PLACER = {
            keepClear: { wolf_hollow: () => [[8, 1, 2], [BENCH[0], BENCH[1], 2], [3, 6, 2], [15, 9, 1]] }, // [x, y, radius]: doorways, the bench, the campfire
            entry: { wolf_hollow: [8, 1] },
            path: {}, // tiles reserved for walking, per map
            isTree(map, x, y) { if (map !== 'wolf_hollow') return false; const t = WOLF_HOLLOW_MAP[y] && WOLF_HOLLOW_MAP[y][x]; if (t === 2) return true; const p = plantAt(x, y); return !!(p && SPECIES[p.sp].tree); },
            reach(map, block) { // flood fill from the entrance over walkable tiles, treating `block` (x,y) as solid
                const g = navGrid(map); if (!g) return null; const [data, cols, rows] = g, [ex, ey] = this.entry[map] || [1, 1], seen = new Uint8Array(cols * rows), q = [ey * cols + ex]; seen[q[0]] = 1;
                const open = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !(block && block[0] === x && block[1] === y) && ![1, 2, 11, 15, 16].includes(data[y][x]) && !(map === 'wolf_hollow' && growSolid(x, y));
                for (let h = 0; h < q.length; h++) { const k = q[h], x = k % cols, y = (k / cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nk = ny * cols + nx; if (!seen[nk] && open(nx, ny)) { seen[nk] = 1; q.push(nk); } } }
                return q.length;
            },
            check(map, x, y, kind) { // -> null if fine, or a plain reason
                const tree = SPECIES[kind] && SPECIES[kind].tree, kc = (this.keepClear[map] || (() => []))();
                for (const [cx, cy, r] of kc) if (Math.max(Math.abs(cx - x), Math.abs(cy - y)) <= r) return 'keep the way clear around the ' + (cx === BENCH[0] && cy === BENCH[1] ? 'bench' : cx === 3 && cy === 6 ? 'campfire' : 'path in');
                if ((this.path[map] || new Set()).has(x + ',' + y)) return 'that is the footpath';
                if (tree) {
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && this.isTree(map, x + dx, y + dy)) return 'too close to another tree; trees need room for their crowns';
                    const before = this.reach(map, null), after = this.reach(map, [x, y]);
                    if (after < before - 1) return 'a tree here would wall off part of the hollow';
                } else { const p = plantAt(x + 0, y + 0); if (p) return 'something is already growing here'; }
                return null;
            },
            nearest(map, x, y, kind) { // the closest spot that passes
                for (let r = 1; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const nx = x + dx, ny = y + dy;
                    if (inGlade(nx, ny) && WOLF_HOLLOW_MAP[ny][nx] === 0 && !plantAt(nx, ny) && !this.check(map, nx, ny, kind)) return [nx, ny]; }
                return null;
            }
        };
        (function layHollowPaths() { // the footpath: the way in, past the bench, into the glade; and the old trail east
            const pts = [[8, 1], [8, 12], [8, 15], [14, 18], [20, 20]], pts2 = [[9, 9], [15, 9], [22, 9]], S = PLACER.path.wolf_hollow = new Set();
            const walk = list => { for (let i = 0; i < list.length - 1; i++) { let [x, y] = list[i]; const [tx, ty] = list[i + 1]; while (x !== tx || y !== ty) { S.add(x + ',' + y); if (Math.abs(tx - x) > Math.abs(ty - y)) x += Math.sign(tx - x); else y += Math.sign(ty - y); } S.add(tx + ',' + ty); } };
            walk(pts); walk(pts2);
            // re-scatter the woods with spacing (blue noise): no two trees touching, rocks apart, the path kept clear
            const W = WOLF_HOLLOW_MAP[0].length, H = WOLF_HOLLOW_MAP.length, placed = [];
            for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { if (y < 12 && x < 16) continue; if ([2, 15].includes(WOLF_HOLLOW_MAP[y][x])) WOLF_HOLLOW_MAP[y][x] = 0; }
            const h = (x, y) => { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
            const cand = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) cand.push([h(x, y), x, y]); cand.sort((a, b) => a[0] - b[0]);
            for (const [, x, y] of cand) {
                if (y < 12 && x < 16) continue; if (inGlade(x, y)) continue; if (WOLF_HOLLOW_MAP[y][x] !== 0) continue;
                let nearPath = false; for (let dy = -1; dy <= 1 && !nearPath; dy++) for (let dx = -1; dx <= 1; dx++) if (S.has((x + dx) + ',' + (y + dy))) { nearPath = true; break; }
                if (nearPath) continue;
                const edge = Math.min(x, y - 11, W - 1 - x, H - 1 - y), want = edge <= 2 ? 0.75 : 0.35, rock = h(y, x) < 0.18;
                if (h(x + 3, y + 5) > want) continue;
                const minD = rock ? 1.8 : 2.2; if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < minD)) continue;
                WOLF_HOLLOW_MAP[y][x] = rock ? 15 : 2; placed.push([x, y]);
            }
        })();
        // ---- painted ground ----
        function vnoise(seed) { const R = rngOf(seed), N = 64, g = new Float32Array(N * N); for (let i = 0; i < g.length; i++) g[i] = R();
            return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, s = t => t * t * (3 - 2 * t), at = (a, b) => g[((b & 63) * 64) + (a & 63)];
                const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1), u = s(fx), v = s(fy); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }; }
        const GEN_CACHE = {};
        function genGround(map) {
            if (GEN_CACHE[map]) return GEN_CACHE[map];
            if (map === 'overworld') { while (!paperGroundStep(1000)); return GEN_CACHE[map]; }
            const z = ZONES[map], data = map === 'wolf_hollow' ? WOLF_HOLLOW_MAP : z.data, cols = data[0].length, rows = data.length, W = cols * 16, H = rows * 16;
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'), im = c.createImageData(W, H), px = im.data;
            const n1 = vnoise(11), n2 = vnoise(23), n3 = vnoise(37), T = (x, y) => (data[Math.min(rows - 1, Math.max(0, y >> 4))] || [])[Math.min(cols - 1, Math.max(0, x >> 4))];
            const hollow = map === 'wolf_hollow', P = PLACER.path[map] || new Set();
            const pal = hollow ? null : z.pal.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
            // distance-to-path / distance-to-wall fields (in px) for soft edges
            const dist = (test) => { const D = new Float32Array(cols * rows).fill(99); const q = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (test(x, y)) { D[y * cols + x] = 0; q.push(y * cols + x); }
                for (let h = 0; h < q.length; h++) { const k = q[h], x = k % cols, y = (k / cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const nk = ny * cols + nx; if (D[nk] > D[k] + 1) { D[nk] = D[k] + 1; q.push(nk); } } } return D; };
            const Dp = dist((x, y) => P.has(x + ',' + y)), Dw = dist((x, y) => data[y][x] === 1);
            const field = (D, x, y) => { const gx = x / 16 - 0.5, gy = y / 16 - 0.5, x0 = Math.max(0, Math.min(cols - 1, Math.floor(gx))), y0 = Math.max(0, Math.min(rows - 1, Math.floor(gy))), x1 = Math.min(cols - 1, x0 + 1), y1 = Math.min(rows - 1, y0 + 1), fx = Math.min(1, Math.max(0, gx - x0)), fy = Math.min(1, Math.max(0, gy - y0));
                const a = D[y0 * cols + x0], b = D[y0 * cols + x1], cc = D[y1 * cols + x0], d = D[y1 * cols + x1]; return (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + d * fx) * fy; };
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4, t = T(x, y), m = n1(x / 23, y / 23) * 0.6 + n2(x / 7, y / 7) * 0.3 + n3(x / 2.3, y / 2.3) * 0.1;
                let r, g, b;
                if (hollow) {
                    const glade = inGlade(x >> 4, y >> 4) ? 1 : 0, wall = Math.max(0, 1 - field(Dw, x, y) / 1.6);
                    r = 34 + m * 22 + glade * 14; g = 50 + m * 30 + glade * 22; b = 28 + m * 12 + glade * 6;               // moss and floor
                    const litter = n3(x / 1.7 + 50, y / 1.7); if (litter > 0.72) { r += 40; g += 22; b += 4; } else if (litter < 0.12) { r -= 10; g -= 12; b -= 8; } // leaf litter, dark soil
                    const pd = field(Dp, x, y), pk = Math.max(0, Math.min(1, 1.15 - pd)) * (0.75 + 0.25 * n2(x / 5, y / 5));            // the worn path, soft at the edges
                    r += (96 + m * 26 - r) * pk; g += (78 + m * 18 - g) * pk; b += (54 + m * 10 - b) * pk;
                    r -= wall * 22; g -= wall * 30; b -= wall * 18;                                                                       // the thicket closing in
                    if (glade && n1(x / 9 + 9, y / 9) > 0.7) { r += 18; g += 20; b += 4; }                                               // dapples of light in the glade
                } else {
                    const [F, Wc, Hi] = pal, wall = Math.max(0, 1 - field(Dw, x, y) / 1.25);
                    const hm = z.home, sx = hm ? (x + ((y / 7 | 0) % 2) * 13) % 27 : (x + ((y >> 3) % 2) * 5) % 11, sy = hm ? y % 7 : y % 9, mortar = sx === 0 || sy === 0;   // flagstones; floorboards in the farmhouse                                  // irregular flagstones
                    const k = 0.78 + m * 0.42 + (rngOf(((x / 11) | 0) * 131 + ((y / 9) | 0) * 977)() - 0.5) * 0.18;
                    r = F[0] * k; g = F[1] * k; b = F[2] * k; if (mortar) { r *= 0.55; g *= 0.55; b *= 0.55; }
                    if (n3(x / 3, y / 3) > 0.8 && !mortar) { r += (Hi[0] - r) * 0.3; g += (Hi[1] - g) * 0.3; b += (Hi[2] - b) * 0.3; }    // dust and wear
                    r *= 1 - wall * 0.55; g *= 1 - wall * 0.55; b *= 1 - wall * 0.55;                                                     // shadow at the foot of the walls
                    if (t === 1 || t === 2 || t === 8 || t === 11) { r = Wc[0] * (0.5 + m * 0.3); g = Wc[1] * (0.5 + m * 0.3); b = Wc[2] * (0.5 + m * 0.3); }
                }
                px[o] = Math.max(0, Math.min(255, r)); px[o + 1] = Math.max(0, Math.min(255, g)); px[o + 2] = Math.max(0, Math.min(255, b)); px[o + 3] = 255;
            }
            c.putImageData(im, 0, 0);
            if (hollow) { // little things on the floor: pebbles along the path, twigs, clover
                const R = rngOf(77); for (let i = 0; i < W * H / 220; i++) { const x = R() * W, y = R() * H, t = T(x | 0, y | 0); if (t === 1) continue; const k = R();
                    if (k < 0.35) { c.fillStyle = 'rgba(150,140,120,.55)'; c.fillRect(x, y, 1.5, 1); } else if (k < 0.6) { c.strokeStyle = 'rgba(70,48,28,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x, y); c.lineTo(x + R() * 4 - 2, y + R() * 2); c.stroke(); }
                    else if (k < 0.8) { c.fillStyle = 'rgba(110,150,70,.5)'; c.fillRect(x, y, 1, 1); c.fillRect(x + 1, y + 1, 1, 1); } }
            }
            return GEN_CACHE[map] = cv;
        }
        // ---- standing things for the tile-built places ----
        function hollowTreeModel(x, y) { const k = 'ht' + x + ',' + y; return GROW_MEM[k] || (GROW_MEM[k] = growPlant(((x * 7 + y * 13) % 5) < 3 ? 'conifer' : 'broadleaf', (x * 92821 + y * 68917) >>> 0, { leaf: 0.55, spread: 0.55, droop: 0.4, vary: 0.6 })); }
        function drawRock(cx, fy, seed, s) { const R = rngOf(seed), n = 7, pts = []; for (let i = 0; i < n; i++) { const a = Math.PI + i / (n - 1) * Math.PI, r = (5 + R() * 3) * s; pts.push([cx + Math.cos(a) * r * 1.2, fy - 1 + Math.sin(a) * r * 0.9]); }
            ctx.fillStyle = '#3f4040'; ctx.beginPath(); ctx.moveTo(cx - 7 * s, fy); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(cx + 7 * s, fy); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#5c5d5a'; ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); for (let i = 2; i < n - 2; i++) ctx.lineTo(pts[i][0], pts[i][1] + 1.5 * s); ctx.lineTo(cx, fy - 2 * s); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(120,160,80,.5)'; ctx.fillRect(cx - 3 * s, pts[3][1] + 1, 3 * s, 1); }
        function drawHollowStanding() { // trees and rocks of the woods, and the dark tree-line at the edges
            if (!cardMode()) return; const T = TILE_SIZE, px = player.gridX, py = player.gridY, yb = ((Math.round(camYaw() / (Math.PI / 4)) % 8) + 8) % 8, yaw = yb * Math.PI / 4;
            const W = WOLF_HOLLOW_MAP[0].length, H = WOLF_HOLLOW_MAP.length;
            for (let y = Math.max(0, py - 12); y <= Math.min(H - 1, py + 12); y++) for (let x = Math.max(0, px - 12); x <= Math.min(W - 1, px + 12); x++) {
                const t = WOLF_HOLLOW_MAP[y][x], cx = x * T + 8, fy = y * T + 15;
                if (t === 2 || (t === 1 && (x + y) % 2 === 0 && !(x === 8 && y === 0))) { const P = hollowTreeModel(x, y), dark = t === 1;
                    asCard(cx, fy, () => { const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; drawPlant(ctx, P, cx, fy - 1, yaw, dark ? 1.05 : 0.95); if (dark) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(5,12,8,.45)'; ctx.fillRect(cx - 40, fy - 70, 80, 72); ctx.globalCompositeOperation = 'source-over'; } ctx.imageSmoothingEnabled = sm; }, 'ht_' + x + '_' + y + '_' + yb); }
                else if (t === 15) asCard(cx, fy, () => drawRock(cx, fy, x * 31 + y, 1), 'hr_' + x + '_' + y);
                else if (t === 11) asCard(cx, fy, () => { ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(cx, fy); ctx.lineTo(cx - 1, fy - 10); ctx.lineTo(cx - 5, fy - 15); ctx.moveTo(cx - 1, fy - 7); ctx.lineTo(cx + 4, fy - 12); ctx.stroke(); }, 'hb_' + x + '_' + y);
            }
        }
        function drawWallFaces(z) { // dungeon walls stand up: a stone face on every wall edge that meets the floor, fixed in the world
            if (!cardMode()) return; const T = TILE_SIZE, d = z.data, rows = d.length, cols = d[0].length, px = player.gridX, py = player.gridY;
            const solidW = t => t === 1 || t === 2 || t === 8 || t === 11, open = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !solidW(d[y][x]);
            const [F, Wc, Hi] = z.pal;
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                const t = d[y][x]; if (!solidW(t) || Math.abs(x - px) > 11 || Math.abs(y - py) > 11) continue;
                for (const [dx, dy, ex, ey, orient] of [[0, 1, 8, 16, 0], [0, -1, 8, 0, 0], [1, 0, 16, 8, Math.PI / 2], [-1, 0, 0, 8, Math.PI / 2]]) {
                    if (!open(x + dx, y + dy)) continue;
                    const fx = x * T + ex, fy = y * T + ey, torch = t === 2 && dy === 1, door = t === 8, niche = t === 11;
                    asCard(fx, fy, () => { const r = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(fx + a, fy + b, w, h); }, Rr = rngOf(x * 977 + y * 131 + dx * 7 + dy * 3);
                        r(-8, -26, 16, 26, Wc);
                        if (z.home) { for (let k = -8; k < 8; k += 4) r(k, -26, 0.7, 26, F); r(-8, -9, 16, 1, F); r(-8, -2, 16, 2, Hi); } else
                        for (let row = 0; row < 5; row++) { const yy = -26 + row * 5.2, off = row % 2 ? 4 : 0; r(-8, yy, 16, 0.7, F); for (let k = -8 + off; k < 8; k += 8) r(k, yy, 0.7, 5.2, F); for (let k = 0; k < 2; k++) r(-7 + Rr() * 13, yy + 1 + Rr() * 3, 2, 1, 'rgba(255,255,255,.06)'); }
                        r(-8, -27, 16, 2, Hi); r(-8, -1, 16, 1, 'rgba(0,0,0,.4)');
                        if (torch) { r(-1.5, -16, 3, 5, '#44403c'); r(-2, -21, 4, 5, '#f97316'); r(-1, -22, 2, 3, '#fde68a'); }
                        if (door) { r(-6, -22, 12, 22, '#2a1d12'); r(-5, -21, 10, 1, '#5b3a22'); r(-1, -12, 2, 3, '#facc15'); }
                        if (niche) { r(-5, -20, 10, 11, '#0a0806'); r(-3, -17, 6, 6, 'rgba(252,211,77,.35)'); }
                    }, 'wf_' + currentMapName + '_' + x + '_' + y + '_' + dx + '_' + dy, { orient });
                }
            }
        }

