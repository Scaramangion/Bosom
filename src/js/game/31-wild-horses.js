        // ===== WILD HORSES: feral, saddled strays that graze the same plains the wolves prowl. Same art as the
        // tame horse waiting at the Sun Tomb, just recolored per-coat at load time (no new art, no atlas growth). =====
        const HORSE_COATS = [
            { id: 'bay', label: 'Bay', weight: 35 }, // the original artwork, untouched
            { id: 'sand', label: 'Sand Dun', hue: 42, sat: 0.50, lightMul: 1.18, weight: 30 },
            { id: 'chestnut', label: 'Chestnut', hue: 16, sat: 0.55, lightMul: 0.92, weight: 20 },
            { id: 'grey', label: 'Dapple Grey', hue: 210, sat: 0.05, lightMul: 1.30, weight: 12 },
            { id: 'black', label: 'Black', hue: 0, sat: 0.0, lightMul: 0.40, weight: 3 }, // ultra rare
        ];
        function pickHorseCoat() {
            const total = HORSE_COATS.reduce((s, c) => s + c.weight, 0);
            let r = Math.random() * total;
            for (const c of HORSE_COATS) { r -= c.weight; if (r <= 0) return c; }
            return HORSE_COATS[0];
        }
        function recolorCoatPixels(imgData, coat) { // colorize: keep each pixel's own lightness (so the art's baked-in
            if (coat.id === 'bay') return imgData;   // shading survives), swap in the coat's hue/saturation
            const d = imgData.data;
            const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
            for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] === 0) continue;
                const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
                let l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
                l = Math.min(1, Math.max(0, l * coat.lightMul));
                const s = coat.sat, h = coat.hue / 360;
                let r2, g2, b2;
                if (s === 0) { r2 = g2 = b2 = l; }
                else { const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r2 = hue2rgb(p, q, h + 1 / 3); g2 = hue2rgb(p, q, h); b2 = hue2rgb(p, q, h - 1 / 3); }
                d[i] = Math.round(r2 * 255); d[i + 1] = Math.round(g2 * 255); d[i + 2] = Math.round(b2 * 255);
            }
            return imgData;
        }
        const WILD_HORSE_DIR_FRAME = { down: 'horse_front', up: 'horse_rear', left: 'horse_side_b', right: 'horse_side_a', up_left: 'horse_q_bl', up_right: 'horse_q_br', down_left: 'horse_q_fl', down_right: 'horse_q_fr' };
        const wildHorseCoatCanvas = {}; // coat.id -> { canvas, dx: {frameName: xOffset} } — a small packed strip, built once
        let wildHorseCoatsBuilt = false;
        function buildWildHorseCoats() {
            if (wildHorseCoatsBuilt) return;
            if (!heroAtlas2D.complete || !heroAtlas2D.naturalWidth) { if (!buildWildHorseCoats.waiting) { buildWildHorseCoats.waiting = true; heroAtlas2D.addEventListener('load', () => { buildWildHorseCoats.waiting = false; buildWildHorseCoats(); }, { once: true }); } return; }
            wildHorseCoatsBuilt = true;
            const names = Object.values(WILD_HORSE_DIR_FRAME);
            let x = 0, maxH = 0; const dx = {};
            for (const n of names) { const f = HERO_FRAMES[n]; if (!f) continue; dx[n] = x; x += f[2] + 2; maxH = Math.max(maxH, f[3]); }
            for (const coat of HORSE_COATS) {
                if (coat.id === 'bay' || !x) continue;
                const cv = document.createElement('canvas'); cv.width = x; cv.height = maxH;
                const cx = cv.getContext('2d');
                for (const n of names) { const f = HERO_FRAMES[n]; if (!f) continue; cx.drawImage(heroAtlas2D, f[0], f[1], f[2], f[3], dx[n], 0, f[2], f[3]); }
                try { const id = cx.getImageData(0, 0, x, maxH); recolorCoatPixels(id, coat); cx.putImageData(id, 0, 0); } catch (e) { /* file:// canvas taint on some setups — falls back to bay art */ }
                wildHorseCoatCanvas[coat.id] = { canvas: cv, dx };
            }
        }

        const wildHorses = [];
        const WILD_HORSE_MAX = 3;
        let lastWildHorseSpawnCheck = 0;
        let wildHorseIdSeq = 0;
        function spawnWildHorse() {
            let gx, gy, tries = 0;
            do { gx = WOLF_FIELD_COLS[Math.floor(Math.random() * WOLF_FIELD_COLS.length)]; gy = WOLF_FIELD_ROWS[Math.floor(Math.random() * WOLF_FIELD_ROWS.length)]; tries++; } while (isSolidTile(gx, gy) && tries < 20);
            if (isSolidTile(gx, gy)) return;
            wildHorses.push({ id: 'wildHorse_' + (++wildHorseIdSeq), gridX: gx, gridY: gy, pixelX: gx * TILE_SIZE, pixelY: gy * TILE_SIZE, targetX: gx * TILE_SIZE, targetY: gy * TILE_SIZE, dir: 'down', isMoving: false, animFrame: 0, moveTimer: Math.floor(Math.random() * 80), alive: true, captured: false, coat: pickHorseCoat() });
        }
        function updateWildHorses() {
            for (let i = wildHorses.length - 1; i >= 0; i--) if (wildHorses[i].gridY < FIELD_TOP) wildHorses.splice(i, 1);
            if (currentMapName !== 'overworld' || gameState !== 'PLAYING' || cinematicMode) return;
            if (!wildHorseCoatsBuilt) buildWildHorseCoats();
            if (Date.now() - lastWildHorseSpawnCheck > 9000) {
                lastWildHorseSpawnCheck = Date.now();
                if (wildHorses.filter(w => w.alive).length < WILD_HORSE_MAX && Math.random() < 0.5) spawnWildHorse();
            }
            for (const w of wildHorses) {
                if (!w.alive) continue;
                if (!FileDex.isActive(Math.floor(w.pixelX / TILE_SIZE), Math.floor(w.pixelY / TILE_SIZE))) continue;
                if (!w.isMoving) {
                    w.moveTimer++;
                    const distToPlayer = Math.hypot(w.gridX - player.gridX, w.gridY - player.gridY);
                    const spooked = distToPlayer <= 2.5; // skittish: trots off if you get close, no combat
                    if (spooked && w.moveTimer > 18) {
                        w.moveTimer = 0;
                        const stepX = Math.sign(w.gridX - player.gridX) || (Math.random() < 0.5 ? -1 : 1);
                        const stepY = Math.sign(w.gridY - player.gridY) || (Math.random() < 0.5 ? -1 : 1);
                        for (const m of [{ dx: stepX, dy: 0 }, { dx: 0, dy: stepY }]) {
                            const nx = w.gridX + m.dx, ny = w.gridY + m.dy;
                            if (fieldOpen(nx, ny, true)) { w.dir = m.dx < 0 ? 'left' : (m.dx > 0 ? 'right' : (m.dy < 0 ? 'up' : 'down')); w.gridX = nx; w.gridY = ny; w.targetX = nx * TILE_SIZE; w.targetY = ny * TILE_SIZE; w.isMoving = true; break; }
                        }
                    } else if (!spooked && w.moveTimer > 140) {
                        w.moveTimer = 0;
                        if (Math.random() < 0.4) {
                            const dirs = [{ dx: 0, dy: -1, n: 'up' }, { dx: 0, dy: 1, n: 'down' }, { dx: -1, dy: 0, n: 'left' }, { dx: 1, dy: 0, n: 'right' }];
                            const d = dirs[Math.floor(Math.random() * dirs.length)], nx = w.gridX + d.dx, ny = w.gridY + d.dy;
                            if (fieldOpen(nx, ny, true)) { w.dir = d.n; w.gridX = nx; w.gridY = ny; w.targetX = nx * TILE_SIZE; w.targetY = ny * TILE_SIZE; w.isMoving = true; }
                        }
                    }
                }
                if (w.isMoving) {
                    const sp = 2.2;
                    if (w.pixelX < w.targetX) w.pixelX = Math.min(w.pixelX + sp, w.targetX);
                    if (w.pixelX > w.targetX) w.pixelX = Math.max(w.pixelX - sp, w.targetX);
                    if (w.pixelY < w.targetY) w.pixelY = Math.min(w.pixelY + sp, w.targetY);
                    if (w.pixelY > w.targetY) w.pixelY = Math.max(w.pixelY - sp, w.targetY);
                    w.animFrame += 0.1;
                    if (w.pixelX === w.targetX && w.pixelY === w.targetY) w.isMoving = false;
                }
            }
        }
        function drawWildHorse(w) {
            const fx = w.pixelX + 8, fy = w.pixelY + 15, name = WILD_HORSE_DIR_FRAME[w.dir] || 'horse_front', f = HERO_FRAMES[name];
            if (!f || !heroAtlas2D.complete) return;
            ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(fx, fy, 11, 3, 0, 0, 7); ctx.fill();
            const k = HERO_TARGET_H / 88, sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
            const dx = fx - f[4] * k, dy = fy - f[5] * k, dw = f[2] * k, dh = f[3] * k;
            const tc = w.coat.id !== 'bay' && wildHorseCoatCanvas[w.coat.id];
            if (tc) ctx.drawImage(tc.canvas, tc.dx[name], 0, f[2], f[3], dx, dy, dw, dh);
            else ctx.drawImage(heroAtlas2D, f[0], f[1], f[2], f[3], dx, dy, dw, dh);
            ctx.imageSmoothingEnabled = sm;
        }

