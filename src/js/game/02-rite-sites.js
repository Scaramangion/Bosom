        // ================= RITE SITES: carved seals where the restorative rites will be performed (boss -> bell -> cleansing, later) =================
        // decal = [tileX, tileY, widthTiles, heightTiles] of the seal picture on the ground; area = the tiles that count as standing on it
        const RITE_SITES = [
            { id: 'sun_seal', map: 'wastes', name: 'SUN RITE SEAL', decal: [16.4, 59.05, 7.2, 3.75], area: [17, 59, 23, 62],
              first: 'A rite seal, carved into the ground before the tomb. Its lines are dead now, but you can feel where power once ran.',
              lens: 'The seal is cut in rings of triangles around a single diamond. A place for a restorative rite. Not yet.' }
        ];
        const riteSeen = new Set();
        function riteSiteAt(map, x, y) { return RITE_SITES.find(r => r.map === map && x >= r.area[0] && x <= r.area[2] && y >= r.area[1] && y <= r.area[3]) || null; }
        function onRiteSite() { return !!(gameStarted && riteSiteAt(currentMapName, player.gridX, player.gridY)); }
        function makeRiteSealCanvas() { // drawn once in code: a worn stone plate seen at an angle, triangle border, nested diamonds
            const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
            const P = (u, v) => { const w = (0.7 + 0.3 * v) * (W - 16); return [W / 2 + (u - 0.5) * w, 10 + v * (H - 24)]; };
            const poly = (pts, fill, stroke, lw) => { c.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 2; c.stroke(); } };
            const rect = (a, b, e, f) => [[a, b], [e, b], [e, f], [a, f]];
            c.shadowColor = 'rgba(40,24,8,.55)'; c.shadowBlur = 14; c.shadowOffsetY = 6; poly(rect(0, 0, 1, 1), '#8f8270'); c.shadowColor = 'transparent';
            poly(rect(0, 0, 1, 1), null, '#3d342a', 5);
            poly(rect(.05, .09, .95, .91), '#7c705f', '#4a4036', 3);
            for (let i = 0; i < 14; i++) { const a = .05 + i * .9 / 14, b = a + .9 / 14;            // triangle band, top and bottom
                poly([[a, .09], [b, .09], [(a + b) / 2, .2]], i % 2 ? '#9b8d76' : '#5f5446'); poly([[a, .91], [b, .91], [(a + b) / 2, .8]], i % 2 ? '#9b8d76' : '#5f5446'); }
            for (let i = 0; i < 6; i++) { const a = .2 + i * .6 / 6, b = a + .6 / 6;                 // and the sides
                poly([[.05, a], [.05, b], [.11, (a + b) / 2]], i % 2 ? '#9b8d76' : '#5f5446'); poly([[.95, a], [.95, b], [.89, (a + b) / 2]], i % 2 ? '#9b8d76' : '#5f5446'); }
            poly(rect(.16, .24, .84, .76), '#6c6152', '#40372d', 3);
            poly([[.5, .27], [.8, .5], [.5, .73], [.2, .5]], '#5a4f42', '#b3a386', 3);
            poly([[.5, .34], [.68, .5], [.5, .66], [.32, .5]], '#4d4338', '#9e8f74', 2);
            poly([[.5, .42], [.58, .5], [.5, .58], [.42, .5]], '#b8964f', '#e2c07a', 2);
            [[.2, .5, .32, .5], [.8, .5, .68, .5], [.5, .27, .5, .34], [.5, .73, .5, .66]].forEach(([a, b, e, f]) => { const p = P(a, b), q = P(e, f); c.strokeStyle = '#b3a386'; c.lineWidth = 2; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); });
            let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            c.save(); poly(rect(0, 0, 1, 1)); c.clip();
            for (let i = 0; i < 900; i++) { const p = P(rnd(), rnd()); c.fillStyle = rnd() < .5 ? 'rgba(20,14,8,.10)' : 'rgba(255,240,210,.08)'; c.fillRect(p[0], p[1], 2 + rnd() * 4, 1 + rnd() * 2); }
            c.strokeStyle = 'rgba(30,22,14,.6)'; c.lineWidth = 1.5;                                           // cracks
            for (let k = 0; k < 7; k++) { let p = P(rnd(), rnd()); c.beginPath(); c.moveTo(p[0], p[1]); for (let j = 0; j < 5; j++) { p = [p[0] + (rnd() - .5) * 40, p[1] + (rnd() - .5) * 18]; c.lineTo(p[0], p[1]); } c.stroke(); }
            for (let i = 0; i < 26; i++) { const p = P(rnd(), rnd() < .5 ? rnd() * .15 : .85 + rnd() * .15), r = 8 + rnd() * 24; // drifted sand over the edges
                const g = c.createRadialGradient(p[0], p[1], 1, p[0], p[1], r); g.addColorStop(0, 'rgba(222,190,140,.85)'); g.addColorStop(1, 'rgba(222,190,140,0)'); c.fillStyle = g; c.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); }
            c.restore();
            return cv;
        }
        function drawRiteEmbers(fx, fy) { // warm pool at the feet + embers rising, on the 2D canvas in world space
            const t = performance.now() / 1000;
            const g = ctx.createRadialGradient(fx, fy, 1, fx, fy, 20); g.addColorStop(0, 'rgba(255,170,60,.35)'); g.addColorStop(1, 'rgba(255,170,60,0)');
            ctx.fillStyle = g; ctx.fillRect(fx - 20, fy - 20, 40, 40);
            for (let i = 0; i < 16; i++) {
                const ph = (t * 0.45 + i * 0.137) % 1, x = fx + Math.sin(i * 12.9 + t * 1.7) * (4 + i % 5), y = fy - 1 - ph * 30;
                ctx.globalAlpha = (1 - ph) * 0.95; ctx.fillStyle = i % 3 === 0 ? '#fde68a' : i % 3 === 1 ? '#fcd34d' : '#fb923c';
                ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
            }
            ctx.globalAlpha = 1;
        }
        function drawSprite(spriteName, x, y) {
            if (onRiteSite()) {
                drawRiteEmbers(x + 8, y + 15);
                const r = riteSiteAt(currentMapName, player.gridX, player.gridY);
                if (!riteSeen.has(r.id)) { riteSeen.add(r.id); showFluidMessage(r.first, 3200); }
            }
            drawHorseWorld();
            drawTeleportFx();
            if (playerInvincible && rollAnim <= 0 && !player.inBlink && invincibleTimer > 0 && TP_FX.length === 0 && Math.floor(performance.now() / 90) % 2 === 0) return; // brief flicker for any i-frames left after the tumble (never mid-roll, so the tumble stays visible)
            if (heroHD.active()) { heroHD.request(x, y); return; } // the HD hero is drawn by the WebGL layer
            drawPlayerSprite(ctx, x, y, hero.dir || 'down', hero.animFrame || 0, actionTimer > 0, {
                heroHair: pal.heroHair,
                heroCape: pal.heroCape
            }, equippedItem);
        }

