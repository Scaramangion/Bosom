        // ================= PERSPECTIVE ROOM MODULE: one-point-perspective interiors on a square 10x10 logic grid =================
        // The room photo is ONE flat picture drawn on ROOM_FRAME. The grid (SHOP_MAP_DATA etc.) stays the truth for movement and collision;
        // this module only decides where a grid cell appears on screen and how large a sprite is there. Every room reuses it.
        // ROOM_FRAME is normalized to the 160x144 window: floor far edge (top), floor near edge (bottom), back-wall top, and the black foreground ledge.
        const ROOM_FRAME = { farY: 0.42, farL: 0.32, farR: 0.68, nearY: 0.86, nearL: 0.04, nearR: 0.96, backTop: 0.06, ledgeY: 0.885 };
        const SHOW_GRID = location.hash.includes('grid'); // add #grid to the URL to see the 10x10 floor grid over the room
        const ROOMS = {
            emporium: { map: 'shop', frame: ROOM_FRAME, cols: 10, rows: 10,
                occluders: [{ x0: 1, x1: 8, row: 2, h: 0.9 }],  // the counter: hides sprites standing behind it (rows above `row`)
                lights: [[36, 44, 34], [124, 44, 34]],          // wall lamps [x, y, radius] in screen px
                actors: () => [{ gx: 4, gy: 1, draw: () => drawTigerNPC(0, 0, 'papa') }].concat(companion.active ? [] : [{ gx: 6, gy: 1, draw: () => drawDogSprite(0, 0, 'down', 0) }]) }
        };
        const roomOfMap = m => Object.values(ROOMS).find(r => r.map === m) || null;
        function roomProject(room, gx, gy, W = GAME_WIDTH, H = GAME_HEIGHT) { // grid (0..cols, 0..rows; row 0 = far) -> screen px + depth scale s (1 = near edge)
            const f = room.frame, g = room.g || (room.g = (() => {
                const r = (f.farR - f.farL) / (f.nearR - f.nearL);
                return { r, vy: (f.farY - r * f.nearY) / (1 - r), vx: (f.nearL + f.nearR) / 2, wn: f.nearR - f.nearL };
            })());
            const s = g.r / (1 - (1 - g.r) * (gy / room.rows));
            return { x: (g.vx + (gx / room.cols - 0.5) * g.wn * s) * W, y: (g.vy + (f.nearY - g.vy) * s) * H, s, tile: g.wn * s * W / room.cols };
        }
        function roomOccluderPoly(room, o, W = GAME_WIDTH, H = GAME_HEIGHT) { // silhouette of a box standing on cells x0..x1 of `row`
            const a = roomProject(room, o.x0, o.row, W, H), b = roomProject(room, o.x1, o.row, W, H), c = roomProject(room, o.x1, o.row + 1, W, H), d = roomProject(room, o.x0, o.row + 1, W, H);
            const hb = o.h * a.tile, hf = o.h * d.tile;
            return { front: [[d.x, d.y], [c.x, c.y], [c.x, c.y - hf], [d.x, d.y - hf]], top: [[d.x, d.y - hf], [c.x, c.y - hf], [b.x, b.y - hb], [a.x, a.y - hb]],
                     all: [[d.x, d.y], [c.x, c.y], [c.x, c.y - hf], [b.x, b.y - hb], [a.x, a.y - hb], [d.x, d.y - hf]] };
        }
        function fillPolyHard(pts, color) { // crisp scanline fill (no anti-aliasing), used for the shader's occluder key
            const ys = pts.map(p => p[1]); ctx.fillStyle = color;
            for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++) {
                const yc = y + 0.5, xs = [];
                for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + (yc - y1) * (x2 - x1) / (y2 - y1)); }
                if (xs.length > 1) { xs.sort((p, q) => p - q); const x0 = Math.round(xs[0]); ctx.fillRect(x0, y, Math.round(xs[xs.length - 1]) - x0, 1); }
            }
        }
        function roomBackdrop(room) { // stand-in picture, drawn on the frame, used until a real photo (<script id="bg-emporium">) is supplied
            if (room.backdrop) return room.backdrop;
            const K = 3, W = GAME_WIDTH * K, H = GAME_HEIGHT * K, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
            const c = cv.getContext('2d'), f = room.frame, P = (x, y) => roomProject(room, x, y, W, H);
            const poly = (pts, fill) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill(); };
            const line = (a, b, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); };
            const fl = P(0, 0), fr = P(10, 0), nl = P(0, 10), nr = P(10, 10), bt = f.backTop * H;
            c.fillStyle = '#24160d'; c.fillRect(0, 0, W, H);
            const wall = c.createLinearGradient(0, bt, 0, fl.y); wall.addColorStop(0, '#ecd0a2'); wall.addColorStop(1, '#c48d58');
            poly([[fl.x, bt], [fr.x, bt], [fr.x, fl.y], [fl.x, fl.y]], wall);
            poly([[0, 0], [W, 0], [fr.x, bt], [fl.x, bt]], '#3a2314');
            poly([[0, 0], [fl.x, bt], [fl.x, fl.y], [nl.x, nl.y], [0, nl.y]], '#7d4e2a');
            poly([[W, 0], [fr.x, bt], [fr.x, fl.y], [nr.x, nr.y], [W, nr.y]], '#6f4324');
            for (let i = 1; i < 6; i++) { const t = i / 6, ly = bt + (fl.y - bt) * t; line({ x: fl.x, y: ly }, { x: 0, y: ly * 0.55 + nl.y * 0.0 - 0 }, 'rgba(40,20,8,.22)', 2); line({ x: fr.x, y: ly }, { x: W, y: ly * 0.55 }, 'rgba(40,20,8,.22)', 2); }
            const flr = c.createLinearGradient(0, fl.y, 0, nl.y); flr.addColorStop(0, '#a5703e'); flr.addColorStop(1, '#cf9a62');
            poly([[fl.x, fl.y], [fr.x, fl.y], [nr.x, nr.y], [nl.x, nl.y]], flr);
            for (let i = 0; i <= 20; i++) line(P(i / 2, 0), P(i / 2, 10), i % 2 ? 'rgba(80,40,14,.30)' : 'rgba(255,225,180,.12)', 2);
            for (let r = 1; r < 10; r++) line(P(0, r), P(10, r), 'rgba(80,40,14,.16)', 1);
            const wallH = fl.y - bt;                                       // shelves with bottles on the back wall
            for (let i = 0; i < 3; i++) {
                const sy = bt + wallH * (0.38 + i * 0.22); c.fillStyle = '#7a4a24'; c.fillRect(fl.x + 6, sy, fr.x - fl.x - 12, 4);
                ['#38bdf8', '#f43f5e', '#facc15', '#34d399', '#a78bfa'].forEach((col, j) => { for (let x = fl.x + 12 + j * 9; x < fr.x - 14; x += 45) { c.fillStyle = col; c.fillRect(x, sy - 13, 6, 13); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x + 1, sy - 12, 1, 8); } });
            }
            c.fillStyle = '#dc2626'; c.beginPath(); c.arc((fl.x + fr.x) / 2 - 3, bt + wallH * 0.17, 8, 0, 7); c.arc((fl.x + fr.x) / 2 + 3, bt + wallH * 0.17, 8, 0, 7); c.fill();  // apple sign
            c.fillStyle = '#16a34a'; c.fillRect((fl.x + fr.x) / 2, bt + wallH * 0.17 - 14, 6, 4);
            const st = [P(8, 0), P(9, 0)]; c.fillStyle = '#2b1a0e'; c.fillRect(st[0].x + 2, st[0].y - st[0].tile * 1.5, st[1].x - st[0].x - 4, st[0].tile * 1.5);      // stair doorway at (8,0)
            for (let i = 0; i < 3; i++) { c.fillStyle = ['#fbbf24', '#f59e0b', '#d97706'][i]; c.fillRect(st[0].x + 4, st[0].y - 5 - i * 5, st[1].x - st[0].x - 8, 3); }
            const mat = [P(4, 9), P(6, 9), P(6, 10), P(4, 10)]; poly(mat.map(p => [p.x, p.y]), '#e11d48');                                                          // door mat at (4..5, 9)
            const o = roomOccluderPoly(room, room.occluders[0], W, H);                                                                                                // counter
            poly(o.front, '#6b4423'); poly(o.top, '#9a6a3a');
            c.fillStyle = '#050505'; c.fillRect(0, f.ledgeY * H, W, H); c.fillStyle = '#1a1a1a'; c.fillRect(f.nearL * W, f.ledgeY * H, (f.nearR - f.nearL) * W, 4);
            return (room.backdrop = cv);
        }
        function spriteScaleAt(room, p) { const r = room.g.r, k = (p.s - r) / (1 - r); return 0.72 + 0.38 * k; } // sprites shrink less than true perspective so they stay readable
        function renderRoom(room) {
            lastCamX = 0; lastCamY = 0;
            if (FX_GL.ok && FX_GL.photoFor(room)) ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            else ctx.drawImage(roomBackdrop(room), 0, 0, GAME_WIDTH, GAME_HEIGHT);
            roomProject(room, 0, 0);
            const list = room.actors();
            if (gameState === "PLAYING" && hero) list.push({ gx: player.pixelX / TILE_SIZE, gy: player.pixelY / TILE_SIZE, draw: () => drawSprite('hero', 0, 0) });
            if (companion.active) list.push({ gx: companion.pixelX / TILE_SIZE, gy: companion.pixelY / TILE_SIZE, draw: () => drawDogSprite(0, 0, companion.dir, companion.animFrame) });
            list.sort((a, b) => a.gy - b.gy);
            for (const a of list) {
                const p = roomProject(room, a.gx + 0.5, a.gy + 0.85), sc = spriteScaleAt(room, p);
                ctx.save(); ctx.translate(p.x - 8 * sc, p.y - 16 * sc); ctx.scale(sc, sc);
                ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(2, 14, 12, 2);
                a.draw(); ctx.restore();
            }
            if (SHOW_GRID) {
                ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.5;
                for (let i = 0; i <= 10; i++) { const a = roomProject(room, i, 0), b = roomProject(room, i, 10), c2 = roomProject(room, 0, i), d2 = roomProject(room, 10, i); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(c2.x, c2.y); ctx.lineTo(d2.x, d2.y); ctx.stroke(); }
            }
            for (const o of room.occluders) { // a sprite standing behind a box is hidden by it: the box silhouette shows the photo again
                if (!list.some(a => a.gy + 0.85 < o.row)) continue;
                const poly = roomOccluderPoly(room, o).all;
                if (FX_GL.ok && FX_GL.photoFor(room)) fillPolyHard(poly, '#ff00ff');
                else { ctx.save(); ctx.beginPath(); poly.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.clip(); ctx.drawImage(roomBackdrop(room), 0, 0, GAME_WIDTH, GAME_HEIGHT); ctx.restore(); }
            }
        }

        function renderShopMapInternal() { renderRoom(ROOMS.emporium); }

        function renderUpstairsMapInternal() {
            const cols = 10;
            const rows = 9;
            const shopWidth = cols * TILE_SIZE;
            const shopHeight = rows * TILE_SIZE;

            const offsetX = Math.floor((GAME_WIDTH - shopWidth) / 2);
            const offsetY = Math.floor((GAME_HEIGHT - shopHeight) / 2);

            ctx.save();
            ctx.translate(offsetX, offsetY);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const tile = SHOP_UPSTAIRS_MAP[r][c];
                    const tx = c * TILE_SIZE;
                    const ty = r * TILE_SIZE;

                    if (tile === 0) {
                        ctx.fillStyle = '#ffe4e6';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#f43f5e';
                        ctx.fillRect(tx + 2, ty + 2, 12, 12);
                    } else if (tile === 1) { 
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                    } else if (tile === 12) {
                        ctx.fillStyle = '#b45309';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#0f172a';
                        ctx.fillRect(tx + 2, ty + 2, 12, 12);
                    } else if (tile === 13) {
                        ctx.fillStyle = '#f43f5e';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(tx + 2, ty + 2, 12, 4);
                    } else if (tile === 14) {
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                    } else if (tile === 15) {
                        ctx.fillStyle = '#ffe4e6';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#16a34a';
                        ctx.fillRect(tx + 4, ty + 2, 8, 8);
                        ctx.fillStyle = '#b45309';
                        ctx.fillRect(tx + 5, ty + 10, 6, 5);
                    }
                }
            }

            drawTigerNPC(2 * TILE_SIZE, 1 * TILE_SIZE, 'mama');
            drawTigerNPC(5 * TILE_SIZE, 1 * TILE_SIZE, 'daughter');

            if (gameState === "PLAYING" && hero) {
                hero.render();
            }

            if (companion.active) {
                drawDogSprite(companion.pixelX, companion.pixelY, camDir(companion.dir), companion.animFrame);
            }

            ctx.restore();
        }

        const SIM_HZ = 60, SIM_STEP = 1000 / SIM_HZ; // the game was tuned for 60 updates per second (change SIM_HZ to speed up or slow down everything)
        let simLast = 0, simAcc = 0;
        function syncMenuTheme() { // the theme plays on the title screen, during the intro crawl, and (optionally) in the START menu
            const want = menuScreen === 'title' || menuScreen === 'crawl' || menuScreen === 'slots' || (MENU_THEME.inventory && gameState === 'INVENTORY');
            if (want && !audio.themeOn) audio.startMenuTheme(); else if (!want && audio.themeOn) audio.stopMenuTheme();
        }
        ['pointerup', 'touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, function unlock() { // phones only allow sound after a tap
            try { audio.init(); if (audio.ctx) audio.ctx.resume(); if (audio.ctx && audio.ctx.state === 'running') ['pointerup', 'touchend', 'click', 'keydown'].forEach(e2 => window.removeEventListener(e2, unlock)); } catch (e) {}
        }, { passive: true }));
        function gameLoop(now = performance.now()) {
            try {
                syncMenuTheme();
                if (!simLast) simLast = now;
                simAcc += Math.min(now - simLast, 100); simLast = now; // clamp long pauses (tab switch) so nothing teleports
                let steps = 0;
                while (simAcc >= SIM_STEP && steps < 4) { updateGame(); diorama.step(); combatStep(); camStep(); trailStep(); cineStep(); navStep(); farmStep(); stepAnimals(); lifeTrail(); placeWrongFig(); townStep(); stalkStep(); simAcc -= SIM_STEP; steps++; }
                if (steps === 4) simAcc = 0;
                if (steps > 0) { // draw at most once per simulation step: 60 fps cap saves battery on 120 Hz screens
                    clearScreen();
                    if (gameState === "CRAWL") {
                        drawCrawlText();
                    } else if (gameState === "PLAYING" || gameState === "INVENTORY") {
                        drawMap();
                    }
                    FX_GL.render();
                }
            } catch (err) {
                console.error("Game loop error:", err);
            }
            requestAnimationFrame(gameLoop);
        }

