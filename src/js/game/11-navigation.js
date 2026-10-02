        // ================= NAVIGATION: minimap, a guide arrow toward your course, and the full map with places you can set a course to =================
        const NAV_NAMES = { overworld: "BRENNAN'S THEME", wolf_hollow: "WOLF'S HOLLOW", waking: 'TOMB OF WAKING', wastes: 'THE WASTES', cave: 'HOLLOW CAVE', tomb: 'SUN TOMB',
            trail: 'THE LONG TRAIL', haven: 'HAVEN', shop: 'TIGER SHOP', shop_upstairs: 'TIGER SHOP UPSTAIRS', tellhouse: 'THE TELL HOUSE', '@mission': 'THE LANTERN HOUSE', '@farm': 'RAHJAI FARM' };
        const NAV_GRAPH = { overworld: ['wolf_hollow', 'wastes', 'shop', 'tellhouse'], wolf_hollow: ['overworld'], waking: ['wolf_hollow'], wastes: ['overworld', 'cave', 'tomb', 'trail'],
            cave: ['wastes'], tomb: ['wastes'], trail: ['haven', 'wastes'], haven: ['trail'], shop: ['overworld', 'shop_upstairs'], shop_upstairs: ['shop'], tellhouse: ['overworld'] };
        const NAV_ORDER = ['overworld', '@farm', 'shop', 'tellhouse', 'wolf_hollow', 'wastes', 'cave', 'tomb', 'trail', 'haven', '@mission'];
        const NAV = { key: '', dist: null, cols: 0, rows: 0, base: null, baseKey: '', t: 0, guide: null, arrived: '' };
        function navGrid(map) { // [data, cols, rows, colour-of-tile]
            if (ZONES[map]) { const z = ZONES[map]; return [z.data, z.cols, z.rows, t => z.exits[t] || t === 23 ? 2 : z.solid.has(t) ? 1 : 0]; }
            if (map === 'overworld') return [MAP_DATA, MAP_COLS, MAP_ROWS, t => t === 14 || t === 16 || t === 5 ? 2 : [1, 2, 3, 4, 6, 9, 10, 11, TILE_BUMPER].includes(t) ? 1 : 0];
            if (map === 'wolf_hollow') return [WOLF_HOLLOW_MAP, WOLF_HOLLOW_MAP[0].length, WOLF_HOLLOW_MAP.length, t => t === 14 ? 2 : [1, 2, 11, 15, 16].includes(t) ? 1 : 0];
            if (map === 'tellhouse') return [TELLHOUSE_MAP, 10, 9, t => t === 5 ? 2 : [1, 20, 21].includes(t) ? 1 : 0];
            if (map === 'shop') return [SHOP_MAP_DATA, 10, 10, t => t === 5 || t === 10 ? 2 : [1, 3, 11].includes(t) ? 1 : 0];
            if (map === 'shop_upstairs') return [SHOP_UPSTAIRS_MAP, 10, 9, t => [1, 13, 14, 15].includes(t) ? 1 : 0];
            return null;
        }
        function navExits(map) { // every doorway on this map and where it leads
            const out = [], g = navGrid(map); if (!g) return out; const [data] = g;
            data.forEach((row, y) => row.forEach((t, x) => {
                let to = null, label = null;
                if (ZONES[map]) { const e = ZONES[map].exits[t]; if (e) to = e.to; else if (map === 'haven' && t === 23) to = '@mission'; }
                else if (map === 'overworld') { if (t === 14) to = 'wolf_hollow'; else if (t === 16) to = 'wastes'; else if (t === 5) { const gx = x >= 30 ? 59 - x : x; if (gx === 7 && y === 4) to = 'shop'; else if (gx === 3 && y === 14) to = 'tellhouse'; else if (gx === 15 && y === 7) { to = 'shop'; label = 'SAFEHOUSE'; } } }
                else if (map === 'wolf_hollow' && t === 14) to = 'overworld';
                else if (map === 'tellhouse' && t === 5) to = 'overworld';
                else if (map === 'shop') { if (t === 5) to = 'overworld'; else if (t === 10) to = 'shop_upstairs'; }
                if (to) out.push({ x, y, to, label: label || NAV_NAMES[to] || to });
            }));
            if (map === 'shop_upstairs') out.push({ x: 8, y: 1, to: 'shop', label: 'STAIRS DOWN' });
            if (map === 'overworld') out.push({ x: FARM_STALL[0], y: FARM_STALL[1], to: '@farm', label: 'RAHJAI FARM' });
            return out;
        }
        function navDest() { // where the guide leads: the course you set, otherwise the current objective
            if (zoneFlags.navDest && zoneFlags.navDest !== 'none') return zoneFlags.navDest;
            if (zoneFlags.navDest === 'none') return null;
            return zoneFlags.princessMission ? null : '@mission'; // first objective: the lantern house in Haven
        }
        function navNextHop(from, dest) { // breadth-first over the world graph; '@mission' lives in Haven
            const goalMap = dest === '@mission' ? 'haven' : dest === '@farm' ? 'overworld' : dest; if (from === goalMap) return dest[0] === '@' ? dest : null;
            const prev = { [from]: null }, q = [from];
            while (q.length) { const m = q.shift(); for (const n of NAV_GRAPH[m] || []) if (!(n in prev)) { prev[n] = m; if (n === goalMap) { let c = n; while (prev[c] !== from) c = prev[c]; return c; } q.push(n); } }
            return undefined; // no known way
        }
        function navField(map, targets) { // steps-to-target from every open tile (breadth-first from the doorway tiles)
            const g = navGrid(map); if (!g) return null; const [, cols, rows] = g, D = new Int32Array(cols * rows).fill(-1), q = [];
            const tset = new Set(targets.map(e => e.y * cols + e.x)); for (const k of tset) { D[k] = 0; q.push(k); }
            const open = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && (tset.has(y * cols + x) || !isSolidTile(x, y) || (player.gridX === x && player.gridY === y));
            for (let h = 0; h < q.length; h++) { const k = q[h], x = k % cols, y = (k / cols) | 0;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, nk = ny * cols + nx; if (open(nx, ny) && D[nk] < 0) { D[nk] = D[k] + 1; q.push(nk); } } }
            return { D, cols, rows };
        }
        function navRoute(n) { // the first n tiles of the way from where he stands
            const F = NAV.dist; if (!F) return []; const { D, cols, rows } = F; let x = player.gridX, y = player.gridY; const out = [];
            if (x < 0 || y < 0 || x >= cols || y >= rows || D[y * cols + x] < 0) return out;
            for (let i = 0; i < n; i++) { const d = D[y * cols + x]; if (d <= 0) break; let best = null;
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const v = D[ny * cols + nx]; if (v >= 0 && v < d && (!best || v < best[2])) best = [nx, ny, v]; }
                if (!best) break; x = best[0]; y = best[1]; out.push([x, y]); }
            return out;
        }
        function navInPlay() { return gameStarted && !cinematicMode && !document.body.classList.contains('intro-ride') && (gameState === 'PLAYING' || gameState === 'INVENTORY'); }
        function navStep() { // a few times a second: work out the next doorway and point at it
            const now = performance.now(); if (now - NAV.t < 220) return; NAV.t = now;
            const mini = document.getElementById('nav-mini'), gd = document.getElementById('nav-guide'); if (!mini || !gd) return;
            if (!mini.dataset.wired) { mini.dataset.wired = '1'; mini.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (gameState === 'PLAYING' && !inDialogue) { toggleInventory(); menuTab('quest'); } }); }
            const show = navInPlay() && gameState === 'PLAYING'; mini.classList.toggle('visible', show);
            if (!show) { gd.classList.remove('visible'); return; }
            const seen = zoneFlags.navSeen || (zoneFlags.navSeen = []); if (!seen.includes(currentMapName)) seen.push(currentMapName);
            const dest = navDest(); let hop = dest ? navNextHop(currentMapName, dest) : null, text = '', ang = null;
            if (dest === '@farm' && currentMapName === 'overworld' && Math.max(Math.abs(player.gridX - FARM_STALL[0]), Math.abs(player.gridY - FARM_STALL[1])) <= 1) hop = null; // at the stall
            if (dest && hop === null) { // he's arrived
                if (NAV.arrived !== dest) { NAV.arrived = dest; showFluidMessage('You have reached ' + (NAV_NAMES[dest] || dest) + '.', 1800); if (zoneFlags.navDest === dest) zoneFlags.navDest = ''; }
                NAV.dist = null; NAV.key = '';
            } else if (dest && hop) {
                const targets = navExits(currentMapName).filter(e => e.to === hop && e.label !== 'SAFEHOUSE'), key = currentMapName + '>' + hop + '|' + (Math.floor(now / 3000));
                if (key !== NAV.key) { NAV.key = key; NAV.dist = targets.length ? navField(currentMapName, targets) : null; NAV.targets = targets; }
                const r = navRoute(7), F = NAV.dist, steps = F && F.D[player.gridY * F.cols + player.gridX];
                let tx, ty; if (r.length) [tx, ty] = r[r.length - 1]; else if (NAV.targets && NAV.targets.length) { tx = NAV.targets[0].x; ty = NAV.targets[0].y; }
                if (tx != null) ang = Math.atan2(tx - player.gridX, -(ty - player.gridY)) - camYaw(); // screen-relative: the arrow points where to push the stick
                const goal = NAV_NAMES[dest] || dest, via = hop !== dest && hop !== '@mission' ? NAV_NAMES[hop] : null;
                text = (via ? via + ' › ' : '') + goal + (steps > 0 ? ' · ' + steps : '');
            } else if (dest && hop === undefined) text = (NAV_NAMES[dest] || dest) + ': NO KNOWN WAY';
            gd.classList.toggle('visible', !!text);
            if (text) { document.getElementById('nav-text').textContent = text; const ar = document.getElementById('nav-arrow'); ar.style.visibility = ang == null ? 'hidden' : 'visible'; if (ang != null) ar.style.transform = 'rotate(' + ang + 'rad)'; }
            drawNavMini(mini);
        }
        function navBase(map) { // the whole map, one pixel a tile: dark walls, sand floor, cyan doorways
            if (NAV.baseKey === map && NAV.base) return NAV.base;
            const g = navGrid(map); if (!g) return null; const [data, cols, rows, kind] = g, cv = document.createElement('canvas'); cv.width = cols; cv.height = rows;
            const c = cv.getContext('2d'), im = c.createImageData(cols, rows), pal = [[201, 178, 128], [38, 33, 30], [34, 211, 238]];
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const k = kind(data[y][x]), o = (y * cols + x) * 4, col = pal[k]; im.data[o] = col[0]; im.data[o + 1] = col[1]; im.data[o + 2] = col[2]; im.data[o + 3] = 255; }
            c.putImageData(im, 0, 0); NAV.base = cv; NAV.baseKey = map; return cv;
        }
        function navArrowPath(c, x, y, a, s) { c.save(); c.translate(x, y); c.rotate(a); c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.72, s * 0.75); c.lineTo(0, s * 0.35); c.lineTo(-s * 0.72, s * 0.75); c.closePath(); c.restore(); }
        const NAV_FACE = { up: 0, up_right: Math.PI / 4, right: Math.PI / 2, down_right: 3 * Math.PI / 4, down: Math.PI, down_left: -3 * Math.PI / 4, left: -Math.PI / 2, up_left: -Math.PI / 4 };
        function drawNavMini(cv) { // a north-up window around him, 24 tiles across, with the way ahead dotted in yellow
            const c = cv.getContext('2d'), W = cv.width, base = navBase(currentMapName); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, W);
            if (!base) return; const span = 24, k = W / span, px = player.pixelX / TILE_SIZE + 0.5, py = player.pixelY / TILE_SIZE + 0.5;
            c.save(); c.beginPath(); c.arc(W / 2, W / 2, W / 2, 0, 7); c.clip(); c.imageSmoothingEnabled = false;
            c.drawImage(base, (px - span / 2), (py - span / 2), span, span, 0, 0, W, W);
            c.fillStyle = 'rgba(11,18,32,.18)'; c.fillRect(0, 0, W, W);
            const T = (x, y) => [(x + 0.5 - px) * k + W / 2, (y + 0.5 - py) * k + W / 2];
            const r = navRoute(60); if (r.length) { c.fillStyle = '#facc15'; r.forEach(([x, y], i) => { if (i % 2) return; const [sx, sy] = T(x, y); c.beginPath(); c.arc(sx, sy, 2.4, 0, 7); c.fill(); }); }
            for (const e of navExits(currentMapName)) { const [sx, sy] = T(e.x, e.y); if (sx < -8 || sy < -8 || sx > W + 8 || sy > W + 8) continue; c.fillStyle = e.to === navNextHop(currentMapName, navDest() || '') ? '#facc15' : '#22d3ee'; c.fillRect(sx - k / 2, sy - k / 2, k, k); }
            if (HORSE.map === currentMapName && !HORSE.mounted) { const [hx, hy] = T(HORSE.x, HORSE.y); c.fillStyle = '#e5e7eb'; c.beginPath(); c.arc(hx, hy, 4, 0, 7); c.fill(); }
            const yw = camYaw(); c.fillStyle = 'rgba(253,230,138,.16)'; c.beginPath(); c.moveTo(W / 2, W / 2); c.arc(W / 2, W / 2, W * 0.48, yw - Math.PI / 2 - 0.5, yw - Math.PI / 2 + 0.5); c.closePath(); c.fill(); // what the camera sees
            c.restore();
            c.fillStyle = '#ef4444'; c.strokeStyle = '#fff'; c.lineWidth = 2; navArrowPath(c, W / 2, W / 2, NAV_FACE[player.face8 || player.dir] || 0, 11); c.fill(); c.stroke();
            c.fillStyle = 'rgba(253,230,138,.9)'; c.font = 'bold 18px monospace'; c.textAlign = 'center'; c.fillText('N', W / 2, 18);
        }
        function drawMiniMap(cv) { // the full map in the menu: the whole place, its doorways named, you, and the way to your course
            const c = cv.getContext('2d'), W = cv.width, H = cv.height, base = navBase(currentMapName); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#0b1220'; c.fillRect(0, 0, W, H);
            if (!base) { c.fillStyle = '#64748b'; c.font = '16px monospace'; c.fillText('NO MAP HERE', 20, H / 2); return; }
            const cols = base.width, rows = base.height; let k = Math.min(W / cols, H / rows), ox = (W - cols * k) / 2, oy = (H - rows * k) / 2, vy = 0;
            if (rows * k < H * 0.5 && cols > rows * 3) { /* very wide: fine */ }
            if (rows / cols > 3) { k = W / 2 / cols; ox = (W - cols * k) / 2; const ph = rows * k; vy = Math.max(0, Math.min(ph - H, (player.gridY + 0.5) * k - H / 2)); oy = -vy; } // the long trail: follow him
            c.imageSmoothingEnabled = false; c.drawImage(base, ox, oy, cols * k, rows * k);
            const T = (x, y) => [ox + (x + 0.5) * k, oy + (y + 0.5) * k], hop = navNextHop(currentMapName, navDest() || '');
            const r = navRoute(400); c.fillStyle = '#facc15'; r.forEach(([x, y], i) => { if (i % 2) return; const [sx, sy] = T(x, y); c.beginPath(); c.arc(sx, sy, Math.max(1.5, k * 0.22), 0, 7); c.fill(); });
            const groups = {}; for (const e of navExits(currentMapName)) { const g = groups[e.label] || (groups[e.label] = { n: 0, x: 0, y: 0, to: e.to }); g.n++; g.x += e.x; g.y += e.y; }
            c.font = 'bold 15px monospace'; c.textAlign = 'center';
            for (const [label, g] of Object.entries(groups)) { const [sx, sy] = T(g.x / g.n, g.y / g.n), on = g.to === hop;
                c.fillStyle = on ? '#facc15' : '#22d3ee'; c.beginPath(); c.arc(sx, sy, 6, 0, 7); c.fill();
                const tw = c.measureText(label).width + 10, lx = Math.max(tw / 2 + 2, Math.min(W - tw / 2 - 2, sx)), ly = sy < 30 ? sy + 22 : sy - 12;
                c.fillStyle = 'rgba(11,18,32,.85)'; c.fillRect(lx - tw / 2, ly - 14, tw, 19); c.fillStyle = on ? '#fde68a' : '#a5f3fc'; c.fillText(label, lx, ly); }
            const [mx, my] = T(player.gridX, player.gridY); c.fillStyle = '#ef4444'; c.strokeStyle = '#fff'; c.lineWidth = 2; navArrowPath(c, mx, my, NAV_FACE[player.face8 || player.dir] || 0, 10); c.fill(); c.stroke();
            c.textAlign = 'left'; c.font = 'bold 16px monospace'; c.fillStyle = '#fde68a'; c.fillText((NAV_NAMES[currentMapName] || currentMapName) + '   N↑', 8, H - 8);
            renderNavPlaces();
        }
        function renderNavPlaces() { // places you know, each one a tap to set your course
            const box = document.getElementById('mn-nav-places'); if (!box) return; const seen = zoneFlags.navSeen || [], dest = navDest(), html = [];
            const isKnown = id => id === '@farm' ? seen.includes('overworld') : id === '@mission' ? !zoneFlags.princessMission && seen.includes('haven') || seen.includes(id) : seen.includes(id) || seen.some(m => (NAV_GRAPH[m] || []).includes(id));
            for (const id of [...NAV_ORDER.filter(isKnown), ...NAV_ORDER.filter(i => !isKnown(i))]) { // places you know first
                const known = id === '@mission' ? !zoneFlags.princessMission && seen.includes('haven') || seen.includes(id) : seen.includes(id) || (seen.some(m => (NAV_GRAPH[m] || []).includes(id)));
                const here = id === currentMapName, isDest = id === dest, name = known ? NAV_NAMES[id] : '???';
                const tag = here ? 'YOU ARE HERE' : isDest ? 'COURSE SET' : known ? 'SET COURSE' : '';
                html.push('<div class="nav-place' + (here ? ' here' : '') + (isDest ? ' dest' : '') + (known ? '' : ' unk') + '" data-id="' + id + '"><span>' + name + '</span><b>' + tag + '</b></div>');
            }
            html.push('<div class="nav-place" data-id="none"><span>CLEAR COURSE</span><b>' + (dest ? '' : 'OFF') + '</b></div>');
            const out = html.join(''); if (box.dataset.html === out) return; box.dataset.html = out; box.innerHTML = out;
            box.querySelectorAll('.nav-place').forEach(el => el.onclick = () => { const id = el.dataset.id; if (el.classList.contains('unk') || id === currentMapName) return;
                zoneFlags.navDest = id === 'none' ? 'none' : id; NAV.key = ''; NAV.arrived = ''; audio.playSelect(); renderNavPlaces(); drawMiniMap(document.getElementById('mn-map-big'));
                showFluidMessage(id === 'none' ? 'Course cleared.' : 'Course set: ' + NAV_NAMES[id] + '.', 1400); });
        }
        function drawAtlasFrame(cv, name, w, h) { // paint an atlas frame into a small canvas, feet at the bottom
            const c = cv.getContext('2d'), f = HERO_FRAMES[name]; c.clearRect(0, 0, cv.width, cv.height);
            if (!f || !heroHD.img || !heroHD.ready) return;
            const k = Math.min(w / f[2], h / f[3]); c.imageSmoothingEnabled = true;
            c.drawImage(heroHD.img, f[0], f[1], f[2], f[3], (cv.width - f[2] * k) / 2, cv.height - f[3] * k, f[2] * k, f[3] * k);
        }
        const HEAD_CACHE = {};
        function drawHeadPortrait(cv, name) { // just the head: found from the frame's own pixels, squared up and drawn crisp
            const c = cv.getContext('2d'), f = HERO_FRAMES[name]; c.clearRect(0, 0, cv.width, cv.height);
            if (!f || !heroHD.img || !heroHD.ready) return;
            let box = HEAD_CACHE[name];
            if (!box) {
                const t = document.createElement('canvas'); t.width = f[2]; t.height = f[3]; const tc = t.getContext('2d'); tc.drawImage(heroHD.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
                const a = tc.getImageData(0, 0, f[2], f[3]).data, op = (x, y) => a[(y * f[2] + x) * 4 + 3] > 100;
                let top = 0; while (top < f[3] && ![...Array(f[2]).keys()].some(x => op(x, top))) top++;
                const hh = Math.round(f[3] * 0.42); let l = f[2], r = 0;                   // the head: the top ~42% of a chibi body
                for (let y = top; y < Math.min(f[3], top + hh); y++) for (let x = 0; x < f[2]; x++) if (op(x, y)) { if (x < l) l = x; if (x > r) r = x; }
                const side = Math.max(r - l + 1, hh) * 1.12, cx = (l + r + 1) / 2, cy = top + hh / 2 + hh * 0.04;
                box = HEAD_CACHE[name] = [cx - side / 2, cy - side / 2, side];
            }
            c.imageSmoothingEnabled = false; const [bx, by, sd] = box, pad = cv.width * 0.06;
            c.save(); c.beginPath(); c.arc(cv.width / 2, cv.height / 2, cv.width / 2 - 1, 0, 7); c.clip();
            c.drawImage(heroHD.img, f[0] + bx, f[1] + by, sd, sd, pad, pad + cv.height * 0.04, cv.width - pad * 2, cv.height - pad * 2); c.restore();
        }
        function renderGear() {
            const box = document.getElementById('mn-outfits'); if (!box) return; box.innerHTML = '';
            Object.keys(HERO_OUTFITS).forEach(id => {
                const o = HERO_OUTFITS[id], d = document.createElement('div'); d.className = 'mn-out' + (id === heroHD.outfit ? ' on' : '');
                const cv = document.createElement('canvas'); cv.width = cv.height = 96; d.appendChild(cv); d.appendChild(document.createTextNode(o.label));
                d.onclick = () => { if (!heroHD.active()) { showFluidMessage('Outfits need WebGL on this device.'); return; } heroHD.setOutfit(id); audio.playSelect(); };
                box.appendChild(d); drawHeadPortrait(cv, o.idle.down || o.idle.right);
            });
        }
        function refreshOutfitUI() {
            const l = document.getElementById('outfit-label'); if (l) l.textContent = 'OUTFIT: ' + HERO_OUTFITS[heroHD.outfit].label;
            const ic = document.getElementById('outfit-icon'); if (ic) { const c = ic.getContext('2d'), cl = { child: ['#6b7280', '#374151'], starter: ['#60a5fa', '#1e3a8a'], basic: ['#3b82f6', '#dc2626'], kael: ['#f59e0b', '#7c2d12'], koto: ['#be123c', '#1e3a8a'], rahjai: ['#7c3aed', '#7f1d1d'] }[heroHD.outfit] || ['#9ca3af', '#374151'];
                c.clearRect(0, 0, 16, 16); c.fillStyle = cl[0]; c.fillRect(4, 3, 8, 10); c.fillRect(1, 4, 3, 5); c.fillRect(12, 4, 3, 5); c.fillStyle = cl[1]; c.fillRect(4, 9, 8, 2); c.fillRect(6, 3, 4, 2); }
            renderGear();
        }
        function menuSaveNow() { const gs = gameState; gameState = 'PLAYING'; saveArmed = true; saveGame(); gameState = gs; showFluidMessage('Game saved.'); }
