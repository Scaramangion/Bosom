        // ===== THE LONG TRAIL: canyon clearing -> Haven. A long ride north through fog. 21 = Haven at the top, 22 = back to the clearing,
        // 24 = the campfire halfway (rest). Props stand up as cards in third person; the ground is one seamless tile repeated by the shader.
        const TRAIL_ROWS = 360, TRAIL_COLS = 30;
        const TRAIL = { props: [], data: null, herd: [], figure: { x: 22, y: 110, a: 1, fading: false, gone: false },
            chase: { armed: false, active: false, wolves: [] }, campSeen: false, camp: [17, 180] };
        const TRAIL_FRAMES = {"palmA": [0, 0, 91, 92], "palmB": [93, 0, 60, 92], "skelA": [155, 0, 77, 54], "statue": [0, 94, 42, 48], "skelB": [44, 94, 82, 44], "rockA": [128, 94, 55, 41]};
        const trailArt = { img: new Image(), ready: false }; trailArt.img.onload = () => { trailArt.ready = true; }; trailArt.img.src = document.getElementById('trail-atlas').textContent.trim();
        const TRAIL_KINDS = { // world-px height to draw at; 'w:' = world-atlas frame
            palmA: { h: 46 }, palmB: { h: 44 }, rockA: { h: 15 }, skelA: { h: 12 }, skelB: { h: 10 }, statue: { h: 26 },
            obelisk: { w: 't_obelisk', h: 50 }, stump: { w: 't_pillar_stump', h: 24 }, block: { w: 't_pillar_block', h: 30 }, arch: { w: 't_arch_open', h: 52 },
            pillar: { w: 't_pillar_tall_carved', h: 56 }, brazier: { w: 't_brazier', h: 17 }, urn: { w: 't_urn', h: 9 }, urn2: { w: 't_urn2', h: 9 } };
        (function buildTrail() {
            const d = []; for (let r = 0; r < TRAIL_ROWS; r++) { const row = []; for (let c = 0; c < TRAIL_COLS; c++) row.push(c < 5 || c > 24 ? 15 : 0); d.push(row); }
            for (let c = 5; c < 25; c++) { d[0][c] = 21; d[TRAIL_ROWS - 1][c] = 22; }
            let sd = 7; const rnd = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
            const add = (x, y, kind, solid, flip) => { if (d[y][x] !== 0 && d[y][x] !== 15) return; TRAIL.props.push({ x, y, kind, flip: !!flip }); if (solid) d[y][x] = solid; };
            add(19, 300, 'obelisk', 15); add(10, 262, 'stump', 15); add(20, 262, 'block', 15); add(15, 230, 'arch', 0);
            add(17, 180, 'brazier', 24); add(16, 180, 'urn', 0); add(18, 181, 'urn2', 0); add(11, 140, 'statue', 15); add(19, 140, 'statue', 15, true);
            add(10, 60, 'pillar', 15); add(20, 60, 'pillar', 15, true); add(13, 22, 'obelisk', 15);
            for (let r = 5; r < TRAIL_ROWS - 4; r += 3) for (const side of [0, 1]) {
                if (rnd() > 0.78) continue;
                const x = side ? 21 + Math.floor(rnd() * 4) : 5 + Math.floor(rnd() * 4), y = r + Math.floor(rnd() * 3), k = rnd();
                add(x, y, k < 0.42 ? 'palmA' : k < 0.72 ? 'palmB' : 'rockA', 15, rnd() < 0.5);
            }
            for (let r = 12; r < TRAIL_ROWS - 8; r += 19 + Math.floor(rnd() * 10)) add(9 + Math.floor(rnd() * 12), r, rnd() < 0.5 ? 'skelA' : 'skelB', 0, rnd() < 0.5);
            TRAIL.data = d;
        })();
        (function havenDoor() { // carve the mission house's door and a short approach into Haven's collision rows
            const rows = HAVEN_ROWS.map(r => r.split(',').flatMap(t => { const [v, n] = t.split('x'); return Array(+(n || 1)).fill(+v); }));
            rows[13][17] = rows[13][18] = rows[13][19] = 0; rows[12][17] = 23;
            const rle = row => { const o = []; for (let i = 0; i < row.length;) { let j = i; while (j < row.length && row[j] === row[i]) j++; o.push(j - i > 1 ? row[i] + 'x' + (j - i) : String(row[i])); i = j; } return o.join(','); };
            rows.forEach((r, i) => { HAVEN_ROWS[i] = rle(r); });
        })();
        const DUNGEON_TILES = { '#': 1, '.': 0, T: 2, D: 3, C: 4, b: 5, p: 6, S: 7, L: 8, B: 10, A: 11, k: 12, e: 13, t: 14, r: 16, X: 17, c: 19 }; // 12 stove, 13 bed, 14 table, 16 rug (walkable), 17 trapdoor, 19 shelf: the farmhouse // ... 10 = funeral slab (walkable), 11 = empty Head niche // wall, floor, torch, exit, chest, bones, pillar, sarcophagus, locked door
        const zoneFlags = { sunKey: false, bones: false, tomb: false };
        const ZONES = {
            wastes: { name: 'THE WASTES', photo: true, cols: 30, rows: 84, solid: new Set([15]), exits: { 16: { to: 'overworld', x: 68, y: 18 }, 17: { to: 'cave', x: 7, y: 10, msg: 'Cold air breathes out of the rock. The cave swallows the light.' }, 18: { to: 'tomb', x: 7, y: 10, msg: 'Sand spills across the threshold. Someone has been here before you.' }, 19: { to: 'trail', x: 15, y: 355, dir: 'up', msg: 'The cleft opens onto a long trail running north into the fog.' } },
                data: WASTES_ROWS.map(r => r.split(',').flatMap(t => { const [v, n] = t.split('x'); return Array(+(n || 1)).fill(+v); })) },
            trail: { name: 'THE LONG TRAIL', photo: true, tile: [200, 200], cols: TRAIL_COLS, rows: TRAIL_ROWS, solid: new Set([15, 24]), data: TRAIL.data,
                exits: { 21: { to: 'haven', x: 31, y: 38, dir: 'up', msg: 'HAVEN. The oasis city at the end of the long trail.' }, 22: { to: 'wastes', x: 3, y: 72, dir: 'down', msg: 'The trail narrows into the cleft. The canyon clearing opens out around you.' } } },
            haven: { name: 'HAVEN', photo: true, cols: 60, rows: 40, solid: new Set([15]), exits: { 20: { to: 'trail', x: 15, y: 3, dir: 'down', msg: 'You ride out of the gate. The long trail runs south into the fog.' } },
                data: HAVEN_ROWS.map(r => r.split(',').flatMap(t => { const [v, n] = t.split('x'); return Array(+(n || 1)).fill(+v); })) },
            cave: { name: 'HOLLOW CAVE', dungeon: true, solid: new Set([1, 2, 4, 5, 9]), exits: { 3: { to: 'wastes', x: 14, y: 6 } }, pal: ['#1c1917', '#3b322c', '#57493d'],
                rows: ["################", "#T..........T..#", "#..b....##.....#", "#.......##..C..#", "###.#####......#", "#T..#....##.b..#", "#...#..b.#######", "#...#....T.....#", "#.b.####.......#", "#...#..#...b...#", "#T......#.....T#", "#######D########"] },
            tomb: { name: 'SUN TOMB', dungeon: true, solid: new Set([1, 2, 6, 7, 8]), exits: { 3: { to: 'wastes', x: 20, y: 59 } }, pal: ['#2a2218', '#6b5638', '#8f7648'],
                rows: ["################", "######T..T######", "######.S..######", "######....######", "#######L########", "#T............T#", "#..p........p..#", "#..............#", "#..p........p..#", "#..............#", "#T............T#", "#######D########"] },
            farmhouse: { name: 'THE FARMHOUSE', dungeon: true, home: true, solid: new Set([1, 2, 12, 13, 14, 17, 19]), exits: { 3: { to: 'overworld', x: 23, y: 18, dir: 'down', msg: 'Outside. Rahjai.' } }, pal: ['#7a5a3a', '#4a3322', '#a9835a'],
                rows: ["################", "#cc.kk.T..T.eee#", "#...........eee#", "#..............#", "#.tt...rrrr....#", "#......rrrr....#", "#..............#", "#.X............#", "#..............#", "#..............#", "#..............#", "#######D########"] },
            waking: { name: 'TOMB OF WAKING', dungeon: true, solid: new Set([1, 2, 5, 6, 11]), exits: { 3: { to: 'wolf_hollow', x: 8, y: 3, msg: 'You step out of the tomb into a world already beginning to rot.' } }, pal: ['#2e251e', '#5e4d3f', '#86705b'],
                rows: ["################", "#T.....AA.....T#", "#..............#", "#..p........p..#", "#......B.......#", "#......B.......#", "#..p........p..#", "#..............#", "#b............b#", "#T............T#", "#######..#######", "#######D########"] }
        };
        Object.values(ZONES).forEach(z => { if (Array.isArray(z.rows)) { z.data = z.rows.map(r => [...r].map(ch => DUNGEON_TILES[ch])); z.cols = 16; z.rows = z.data.length; }
            z.torches = []; z.data.forEach((row, r) => row.forEach((t, c) => { if (z.dungeon && t === 2) z.torches.push([c * TILE_SIZE + 8, r * TILE_SIZE + 6]); })); });
        ZONES.farmhouse.data.forEach((row, r) => row.forEach((t, c) => { if (t === 12) ZONES.farmhouse.torches.push([c * TILE_SIZE + 8, r * TILE_SIZE + 12, 34]); })); // the stove's glow
        ZONES.trail.torches.push([TRAIL.camp[0] * TILE_SIZE + 8, TRAIL.camp[1] * TILE_SIZE + 2, 44]); // the campfire

        // ---- the farmhouse: things you walk up to and press [A] on ----
        const HOME_LINES = ['Jars of preserves, the labels gone brown. Great-grandmother\'s handwriting, small and slanted.', 'Spools of red thread. A cracked teapot. A key that fits nothing you have found yet.', 'Dried herbs tied in bundles. They still smell like summer.', 'Plates, stacked for four people. Nobody has eaten here in years.'];
        function homeInteract(t, gx, gy) {
            if (t === 12) { openKitchen(); return true; }
            if (t === 13) { openNpcConversation('THE BED\nHer quilt, patched in a hundred colours.', [{ label: 'SLEEP UNTIL MORNING', handler: sleepUntilMorning }, { label: 'NOT YET', handler: hideDialogue }]); return true; }
            if (t === 14) { showDialogue('THE TABLE\n' + pantryText()); return true; }
            if (t === 17) { openBasement(); return true; }
            if (t === 19) { showDialogue('THE SHELF\n' + HOME_LINES[(gx * 7 + gy * 3) % HOME_LINES.length]); return true; }
            return false;
        }
        function drawHomeProps(z) { // upright furniture, the same way walls stand up
            const T = TILE_SIZE, d = z.data, px = player.gridX, py = player.gridY, now = Date.now();
            for (let y = 0; y < d.length; y++) for (let x = 0; x < d[0].length; x++) {
                const t = d[y][x]; if (t !== 12 && t !== 13 && t !== 14 && t !== 19) continue; if (Math.abs(x - px) > 11 || Math.abs(y - py) > 11) continue;
                const fx = x * T + 8, fy = y * T + 15, leftBed = t === 13 && d[y][x - 1] === 13, topBed = t === 13 && d[y - 1] && d[y - 1][x] === 13, fl = t === 12 ? 1 + (now / 140 + x) % 2 | 0 : 0;
                asCard(fx, fy, () => { const r = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(fx + a, fy + b, w, h); };
                    if (t === 19) { r(-8, -27, 16, 27, '#4a3322'); r(-7, -26, 14, 25, '#6b4a2b'); for (let k = 0; k < 4; k++) { r(-7, -25 + k * 6, 14, 1, '#3a281a'); r(-6 + (k * 3) % 5, -23 + k * 6, 2, 3, ['#9a4a3a', '#6d8b4a', '#c9a25a', '#7a6aa5'][k]); r(-1 + (k * 5) % 6, -23 + k * 6, 2, 3, ['#c9a25a', '#9a4a3a', '#7a6aa5', '#6d8b4a'][k]); } }
                    else if (t === 12) { r(-8, -16, 16, 16, '#26262a'); r(-8, -17, 16, 2, '#4a4a50'); r(-6, -12, 6, 7, '#0e0e10'); r(-5, -11, 4, 5, fl ? '#f97316' : '#fb923c'); r(-4, -9, 2, 3, '#fde047'); r(1, -12, 6, 3, '#3a3a40'); r(-2, -30, 4, 14, '#38383e'); r(-3, -31, 6, 2, '#4a4a50'); }
                    else if (t === 14) { r(-8, -11, 16, 3, '#9a6a3c'); r(-8, -8, 16, 1, '#5b3a22'); r(-7, -8, 2, 8, '#6b4a2b'); r(5, -8, 2, 8, '#6b4a2b'); r(-3, -14, 5, 3, '#d9d0bd'); r(-2, -15, 3, 1, '#b84a3a'); }
                    else { r(-8, -(topBed ? 7 : 11), 16, topBed ? 7 : 11, '#6b4a2b'); r(-8, -(topBed ? 7 : 11), 16, 1, '#8a6238'); r(-7, -(topBed ? 6 : 10), 14, topBed ? 5 : 8, '#d9d0bd'); r(-7, -(topBed ? 4 : 6), 14, topBed ? 3 : 5, '#4a6fa5'); if (!leftBed) { r(-7, -(topBed ? 6 : 10), 5, topBed ? 3 : 5, '#efe9d8'); r(-8, -(topBed ? 7 : 12), 1, topBed ? 7 : 12, '#4a3322'); } }
                }, 'hp_' + t + '_' + x + '_' + y + '_' + fl);
            }
        }
        function enterFarmhouse() { enterZone('farmhouse', 7, 10); player.dir = 'up'; player.face8 = 'up'; }
        function zoneSolid(gx, gy) {
            const z = ZONES[currentMapName];
            return gx < 0 || gy < 0 || gx >= z.cols || gy >= z.rows || z.solid.has(z.data[gy][gx]);
        }
        function enterZone(id, gx, gy, msg) {
            audio.playClue();
            currentMapName = id;
            player.gridX = gx; player.gridY = gy; player.pixelX = player.targetX = gx * TILE_SIZE; player.pixelY = player.targetY = gy * TILE_SIZE; player.dir = 'down';
            document.getElementById('location-name').innerText = id === 'overworld' ? "BRENNAN'S THEME" : id === 'wolf_hollow' ? "WOLF'S HOLLOW" : ZONES[id].name;
            if (companion.active) { companion.pixelX = companion.targetX = player.pixelX + TILE_SIZE; companion.pixelY = companion.targetY = player.pixelY; companion.gridX = gx + 1; companion.gridY = gy; }
            if (msg) showFluidMessage(msg);
        }
        function zoneStep() { // called when the hero lands on a tile
            const z = ZONES[currentMapName], t0 = z.data[player.gridY][player.gridX];
            if (currentMapName === 'haven' && t0 === 23) { enterMissionHouse(); return; }
            const go = z.exits[t0];
            if (go && currentMapName === 'trail') trailLeaving(go.to);
            if (go) { enterZone(go.to, go.x, go.y, go.msg); if (go.dir) { player.dir = go.dir; player.face8 = go.dir; } }
        }
        function zoneInteract(gx, gy) {
            const z = ZONES[currentMapName];
            if (gx < 0 || gy < 0 || gx >= z.cols || gy >= z.rows) return;
            const t = z.data[gy][gx];
            if (z.home && homeInteract(t, gx, gy)) return;
            if (currentMapName === 'trail' && t === 24) { playerHealth.current = playerHealth.max; updateHealthBar(); showDialogue('You rest by the embers a while. The fog moves, but nothing comes out of it. [Health restored]'); return; }
            if (currentMapName === 'waking' && t === 11) {
                showDialogue("The niche is silent now, but her words stay with you: the priestess lives, taken into blighted land. Complete true Heads. Perform the rites. Your unfinished Head is a wound, and a beginning.");
                return;
            }
            if (currentMapName === 'cave' && t === 4) {
                if (!zoneFlags.sunKey) { zoneFlags.sunKey = true; z.data[gy][gx] = 9; logClue("A gold sun-shaped key, hidden in a wolf-den chest. It is far older than any wolf.", 'IMPORTANT CLUE'); showDialogue("Inside the chest: a heavy gold key stamped with a sun. You take the SUN KEY."); }
                else showDialogue("The chest is empty now.");
            } else if (currentMapName === 'cave' && t === 5) {
                if (!zoneFlags.bones) { zoneFlags.bones = true; logClue("Gnawed bones deep in the cave. Some are too large to be wolf, and one has a rope tied around it.", 'CLUE'); }
                showDialogue("Gnawed bones. Some of them are far too big to belong to any wolf.");
            } else if (currentMapName === 'tomb' && t === 8) {
                if (zoneFlags.sunKey) { z.data[gy][gx] = 0; z.solid.delete(8); audio.playClue(); showDialogue("The SUN KEY turns. The stone door grinds open."); }
                else showDialogue("A sealed stone door. Its lock is shaped like a sun.");
            } else if (currentMapName === 'tomb' && t === 7) {
                if (!zoneFlags.tomb) { zoneFlags.tomb = true; logClue("The sarcophagus is empty and its dust is disturbed. Cloak threads and wolf hair are caught on the lid.", 'IMPORTANT CLUE'); }
                showDialogue("The lid is shifted aside. The tomb is empty. Cloak threads and grey wolf hair cling to the stone.");
            }
        }
        function renderZone() {
            const z = ZONES[currentMapName], W = z.cols * TILE_SIZE, H = z.rows * TILE_SIZE;
            const camX = Math.max(0, Math.min(player.pixelX - GAME_WIDTH / 2 + TILE_SIZE / 2, W - GAME_WIDTH));
            const camY = Math.max(0, Math.min(player.pixelY - GAME_HEIGHT / 2 + TILE_SIZE / 2 - 44 * COMBAT.amt, H - GAME_HEIGHT));
            lastCamX = camX; lastCamY = camY;
            const glG = !z.photo && FX_GL.ok && FX_GL.bgKey === 'gen:' + currentMapName && FX_GL.bgReady;
            if ((z.photo && FX_GL.ok) || glG) ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            else { ctx.fillStyle = z.photo ? '#e2c08c' : z.pal[0]; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }
            ctx.save();
            ctx.translate(-Math.floor(camX), -Math.floor(camY));
            const c0 = Math.max(0, Math.floor(camX / TILE_SIZE)), c1 = Math.min(z.cols - 1, Math.ceil((camX + GAME_WIDTH) / TILE_SIZE));
            const r0 = Math.max(0, Math.floor(camY / TILE_SIZE)), r1 = Math.min(z.rows - 1, Math.ceil((camY + GAME_HEIGHT) / TILE_SIZE));
            const now = Date.now();
            for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
                const t = z.data[r][c], x = c * TILE_SIZE, y = r * TILE_SIZE, h = ((c * 73856093) ^ (r * 19349663)) >>> 0;
                if (z.photo) { // the photo is the scenery; only debug bumpers (add #bumpers to the URL) and the no-WebGL fallback draw here
                    if (!FX_GL.ok) { ctx.fillStyle = '#e2c08c'; ctx.fillRect(x, y, 16, 16); }
                    if (t === 15 && SHOW_BUMPERS) { ctx.fillStyle = 'rgba(255,40,40,0.35)'; ctx.fillRect(x, y, 16, 16); }
                    continue;
                }
                const [floor, wall, hi] = z.pal;
                if (glG && (t === 0 || t === 1 || t === 2 || t === 8 || t === 11 || t === 3)) { if (t === 3) { ctx.fillStyle = 'rgba(226,192,140,.55)'; ctx.fillRect(x + 2, y, 12, 16); } continue; } // painted floor + standing walls take over
                if (!glG) { ctx.fillStyle = floor; ctx.fillRect(x, y, 16, 16); }
                if (!glG && (t === 0 || t === 5 || t === 4 || t === 9 || t === 7)) { ctx.fillStyle = hi; if (h % 5 === 0) ctx.fillRect(x + 3 + h % 8, y + 4 + h % 7, 2, 1); }
                if (t === 1 || t === 2 || t === 8) {
                    ctx.fillStyle = wall; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = floor;
                    for (let yy = 3; yy < 16; yy += 5) ctx.fillRect(x, y + yy, 16, 1);
                    ctx.fillRect(x + 4 + (h % 3) * 3, y, 1, 3); ctx.fillRect(x + 9 - (h % 2) * 3, y + 5, 1, 4);
                    ctx.fillStyle = hi; ctx.fillRect(x, y, 16, 1);
                }
                if (z.home && t === 16) { ctx.fillStyle = '#8c3b32'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#c9a25a'; ctx.fillRect(x, y, 16, 1); ctx.fillRect(x, y + 15, 16, 1); ctx.fillStyle = '#6e2a24'; ctx.fillRect(x + 3, y + 3, 10, 10); ctx.fillStyle = '#c9a25a'; ctx.fillRect(x + 7, y + 7, 2, 2); }
                if (z.home && t === 17) { ctx.fillStyle = '#2a1d12'; ctx.fillRect(x + 1, y + 1, 14, 14); ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x + 2, y + 2, 12, 12); ctx.fillStyle = '#4a3322'; for (let k = 5; k < 14; k += 4) ctx.fillRect(x + 2, y + k, 12, 1); ctx.fillStyle = '#c9a25a'; ctx.fillRect(x + 11, y + 7, 2, 3); }
                if (t === 10) { // funeral slab
                    ctx.fillStyle = '#0d0a08'; ctx.fillRect(x + 1, y + 3, 14, 13); ctx.fillStyle = '#8a7a68'; ctx.fillRect(x + 1, y + 1, 14, 12);
                    ctx.fillStyle = '#a8977f'; ctx.fillRect(x + 1, y + 1, 14, 2); ctx.fillStyle = '#6d5f50'; ctx.fillRect(x + 1, y + 12, 14, 1);
                }
                if (t === 11) { // empty Head niche
                    ctx.fillStyle = wall; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#0a0806'; ctx.fillRect(x + 3, y + 3, 10, 11);
                    ctx.fillStyle = hi; ctx.fillRect(x + 3, y + 3, 10, 1); ctx.fillStyle = 'rgba(252,211,77,' + (0.18 + 0.12 * Math.sin(now / 500 + c)).toFixed(2) + ')'; ctx.fillRect(x + 5, y + 6, 6, 6);
                }
                if (t === 2) { ctx.fillStyle = '#44403c'; ctx.fillRect(x + 6, y + 8, 4, 5); ctx.fillStyle = Math.floor(now / 140 + c) % 2 ? '#f97316' : '#fb923c'; ctx.fillRect(x + 6, y + 3, 4, 5); ctx.fillStyle = '#fde047'; ctx.fillRect(x + 7, y + 5, 2, 3); }
                else if (t === 3) { ctx.fillStyle = '#e2c08c'; ctx.fillRect(x + 2, y, 12, 16); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x + 4, y + 2, 8, 12); }
                else if (t === 4 || t === 9) { ctx.fillStyle = '#5a3820'; ctx.fillRect(x + 2, y + 5, 12, 9); ctx.fillStyle = '#7c4f2c'; ctx.fillRect(x + 2, y + (t === 9 ? 2 : 5), 12, 3); ctx.fillStyle = '#facc15'; ctx.fillRect(x + 7, y + 8, 2, 3); if (t === 9) { ctx.fillStyle = '#1c1917'; ctx.fillRect(x + 3, y + 8, 10, 4); } }
                else if (t === 5) { ctx.fillStyle = '#e7e5e4'; ctx.fillRect(x + 3, y + 9, 7, 2); ctx.fillRect(x + 9, y + 7, 2, 5); ctx.fillRect(x + 5, y + 5, 3, 3); ctx.fillStyle = '#1c1917'; ctx.fillRect(x + 6, y + 6, 1, 1); }
                else if (t === 6) { ctx.fillStyle = wall; ctx.fillRect(x + 3, y + 1, 10, 14); ctx.fillStyle = hi; ctx.fillRect(x + 3, y + 1, 10, 2); ctx.fillRect(x + 3, y + 13, 10, 2); ctx.fillStyle = floor; ctx.fillRect(x + 8, y + 3, 1, 10); }
                else if (t === 7) { ctx.fillStyle = wall; ctx.fillRect(x + 1, y + 2, 14, 13); ctx.fillStyle = hi; ctx.fillRect(x + 2, y + 3, 12, 11); ctx.fillStyle = '#facc15'; ctx.fillRect(x + 6, y + 6, 4, 4); ctx.fillStyle = wall; ctx.fillRect(x + 7, y + 7, 2, 2); }
                else if (t === 8) { ctx.fillStyle = '#facc15'; ctx.fillRect(x + 5, y + 5, 6, 6); ctx.fillStyle = wall; ctx.fillRect(x + 7, y + 7, 2, 2); }
            }
            if (currentMapName === 'trail') drawTrail();
            if (glG) drawWallFaces(z);
            if (z.home) drawHomeProps(z);
            if (gameState === "PLAYING" && hero) hero.render();
            if (companion.active) asCard(companion.pixelX + 8, companion.pixelY + 15, () => drawDogSprite(companion.pixelX, companion.pixelY, camDir(companion.dir), companion.animFrame)); drawFollower();
            ctx.restore();
        }

