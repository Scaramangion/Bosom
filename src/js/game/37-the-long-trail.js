        // ===== THE LONG TRAIL: drawing, the herd, the figure in the fog, the camp, and the (dormant) wolf chase =====
        function drawTrailProp(pr, fx, fy) {
            const K = TRAIL_KINDS[pr.kind];
            ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(fx, fy, Math.min(14, K.h * 0.3), 2.5, 0, 0, 7); ctx.fill();
            if (K.w) { const f = WORLD_FRAMES[K.w]; if (f) drawWorldFrame(ctx, K.w, fx, fy, K.h / f[3], f[2] / 2, f[3], pr.flip); return; }
            const f = TRAIL_FRAMES[pr.kind]; if (!trailArt.ready || !f) return;
            const k = K.h / f[3], w = f[2] * k;
            ctx.save(); ctx.imageSmoothingEnabled = true; if (pr.flip) { ctx.translate(fx, 0); ctx.scale(-1, 1); ctx.translate(-fx, 0); }
            ctx.drawImage(trailArt.img, f[0], f[1], f[2], f[3], fx - w / 2, fy - K.h, w, K.h); ctx.restore();
        }
        function drawTrail() {
            const gy = player.pixelY / TILE_SIZE, ready = trailArt.ready && worldArt.ready;
            for (const pr of TRAIL.props) {
                if (pr.y < gy - 22 || pr.y > gy + 4) continue; // what the fog can show
                const fx = pr.x * TILE_SIZE + 8, fy = pr.y * TILE_SIZE + 15;
                asCard(fx, fy, () => drawTrailProp(pr, fx, fy), ready ? pr.kind + (pr.flip ? '~' : '') : null);
            }
            const f = TRAIL.figure;
            if (!f.gone && Math.abs(f.y - gy) < 24) asCard(f.x * TILE_SIZE + 8, f.y * TILE_SIZE + 15, () => {
                ctx.globalAlpha = Math.max(0, f.a); drawWorldFrame(ctx, 'boxelder', f.x * TILE_SIZE + 8, f.y * TILE_SIZE + 15, 0.41, 19, 63); ctx.globalAlpha = 1; });
            for (const h of TRAIL.herd) if (h.alive) asCard(h.pixelX + 8, h.pixelY + 15, () => {
                const b = h.isMoving ? Math.abs(Math.sin(h.animFrame * 3)) * 1.5 : 0; ctx.save(); ctx.translate(0, -b); const d0 = h.dir; h.dir = camDir(d0); drawWildHorse(h); h.dir = d0; ctx.restore(); });
            for (const w of TRAIL.chase.wolves) asCard(w.pixelX + 8, w.pixelY + 15, () => drawWolfSprite(w.pixelX, w.pixelY, camDir(w.dir), w.animFrame, isNight()));
        }
        function trailStep() { // once per simulation step
            if (currentMapName !== 'trail' || !gameStarted || OP.on) return;
            if (!TRAIL.campSeen && Math.abs(player.gridY - TRAIL.camp[1]) <= 3) { TRAIL.campSeen = true; showFluidMessage('A cold camp beside the trail. The embers are still warm.  [A] at the fire to rest.', 3400); }
            const f = TRAIL.figure;
            if (!f.gone) { if (!f.fading && Math.abs(player.gridY - f.y) <= 7) f.fading = true; if (f.fading && (f.a -= 1 / 75) <= 0) f.gone = true; }
            for (const h of TRAIL.herd) { // wild horses keep pace for a stretch, then peel away into the fog
                if (!h.alive) continue;
                if (!h.peel && player.gridY < 205) h.peel = true;
                const tx = h.peel ? (h.lane < 240 ? -90 : 570) : h.lane, ty = h.peel ? h.pixelY - 40 : player.pixelY + h.off;
                const dx = tx - h.pixelX, dy = ty - h.pixelY, dist = Math.hypot(dx, dy), sp = h.peel ? 3.4 : Math.min(5, 0.5 + dist * 0.07);
                h.isMoving = dist > 2.5;
                if (h.isMoving) { const m = Math.min(sp, dist); h.pixelX += dx / dist * m; h.pixelY += dy / dist * m; h.animFrame += 0.12;
                    h.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); }
                if (h.pixelX < -70 || h.pixelX > 550) h.alive = false;
            }
            const C = TRAIL.chase; // dormant until a quest calls armTrailChase()
            if (C.armed && !C.active) {
                C.active = true; C.wolves = [-22, -8, 8, 22].map((lane, i) => ({ lane, pixelX: player.pixelX + lane, pixelY: Math.min((TRAIL_ROWS - 3) * TILE_SIZE, player.pixelY + (12 + i) * TILE_SIZE), dir: 'up', animFrame: 0, bite: 0 }));
                showFluidMessage('Howls, close behind. Something has picked up your trail.  RIDE!', 2800);
            }
            if (C.active) for (const w of C.wolves) {
                const dx = player.pixelX + w.lane * 0.5 - w.pixelX, dy = player.pixelY + 8 - w.pixelY, dist = Math.hypot(dx, dy) || 1, m = Math.min(3.9, dist);
                w.pixelX = Math.max(5 * TILE_SIZE, Math.min(24 * TILE_SIZE, w.pixelX + dx / dist * m)); w.pixelY += dy / dist * m; w.animFrame += 0.25;
                w.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
                if (dist < 12 && performance.now() > w.bite) { w.bite = performance.now() + 1200; if (!playerInvincible) { damagePlayer(6); showFluidMessage("A wolf snaps at the horse's legs! [-6 HP]", 1200); } }
            }
        }
        function armTrailChase() { TRAIL.chase.armed = true; } // the hook for the quest that wakes the chase
        function trailLeaving(to) {
            const C = TRAIL.chase;
            if (C.active) { C.active = false; C.armed = false; C.wolves = []; if (to === 'haven') setTimeout(() => showFluidMessage('The howls fall away behind the walls of Haven.', 2600), 2900); }
            TRAIL.herd = [];
            if (to === 'haven') { CINE.mag = 1.05; cineShot(1.05, 150); }
            if (window.__introRide && to === 'haven') endIntroRide();
        }
        function startIntroRide() { // a new game opens here: riding north on the long trail while the credits roll
            try { heroHD.setOutfit('koto'); } catch (e) {}
            grantHead('provisional');
            window.__introRide = true; document.body.classList.add('intro-ride');
            enterZone('trail', 15, 352); player.dir = 'up'; player.face8 = 'up'; player.isMoving = false;
            Object.assign(HORSE, { map: 'trail', x: 15, y: 352, face: 'right', mounted: true, mountStart: 0, mountUntil: 0 });
            companion.active = false; gameStarted = true; cinematicMode = false;
            buildWildHorseCoats();
            TRAIL.herd = [[9 * TILE_SIZE, -40], [20 * TILE_SIZE, -14], [11 * TILE_SIZE, 26]].map(([lane, off]) => ({ lane, off, pixelX: lane, pixelY: player.pixelY + off, alive: true, peel: false, coat: pickHorseCoat(), dir: 'up', isMoving: false, animFrame: 0 }));
            TRAIL.figure = { x: 22, y: 110, a: 1, fading: false, gone: false }; TRAIL.campSeen = false;
            showIntroCredits();
        }
        function showIntroCredits() {
            let el = document.getElementById('intro-credits');
            if (!el) {
                el = document.createElement('div'); el.id = 'intro-credits';
                el.innerHTML = '<div class="ic-studio"><span class="ic-a">A</span><span class="ic-name">WONDER WORKS PRODUCTIONS</span></div><div class="ic-title">SAGA OF KOTO</div>';
                const host = canvas.parentElement; if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(el);
            }
            const st = el.querySelector('.ic-studio'), ti = el.querySelector('.ic-title'); st.classList.remove('show'); ti.classList.remove('show'); el.style.display = 'block';
            const at = (ms, fn) => setTimeout(() => { if (window.__introRide) fn(); }, ms);
            at(1500, () => st.classList.add('show')); at(6400, () => st.classList.remove('show'));
            at(8800, () => ti.classList.add('show')); at(15000, () => ti.classList.remove('show'));
            at(16800, () => { document.body.classList.remove('intro-ride'); showFluidMessage('The trail runs north to Haven.  Push the stick all the way to gallop.', 3400); });
        }
        function endIntroRide() {
            window.__introRide = false; document.body.classList.remove('intro-ride');
            const el = document.getElementById('intro-credits'); if (el) el.style.display = 'none';
        }
