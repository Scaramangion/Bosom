        // ===== STANDING CARDS: in third person, creatures are drawn onto small offscreen cards (same drawing code, nothing redrawn)
        // and stood upright in the 3D view by the GL layer, scaled by distance and sorted around the hero. Flat view: drawn as before.
        const CARDS = { list: [], pool: [] };
        function cardMode() { return FX_GL.ok && COMBAT.amt > 0.02; }
        const CARD_CACHE = {};
        function asCard(fx, fy, draw, key, opt) { // fx, fy = feet in world px; key = a static look that can be drawn once and reused
            // opt.size: card canvas px (default 128 = 64 world px across); opt.orient: stand fixed in the world along this angle instead of turning to face the camera
            if (!cardMode()) { draw(); return null; }
            if (key) {
                const S = (opt && opt.size) || 128;
                let c = CARD_CACHE[key];
                if (!c) { const cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'); cx.imageSmoothingEnabled = false;
                    cx.setTransform(2, 0, 0, 2, S / 2 - fx * 2, S - 8 - fy * 2); const prev = ctx; ctx = cx; try { draw(); } finally { ctx = prev; }
                    c = CARD_CACHE[key] = { cv, tex: null }; }
                c.used = performance.now(); // for the sweep: cards out of sight for a while are let go (see cardSweep)
                const e = { fx, fy, cv: c.cv, cached: c, S, orient: opt && opt.orient != null ? opt.orient : null }; CARDS.list.push(e); return e;
            }
            let e = CARDS.pool[CARDS.list.length];
            if (!e) { const cv = document.createElement('canvas'); cv.width = cv.height = 128; e = { cv, c: cv.getContext('2d') }; CARDS.pool.push(e); }
            const c = e.c; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, 128, 128); c.imageSmoothingEnabled = false;
            c.setTransform(2, 0, 0, 2, 64 - fx * 2, 120 - fy * 2); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
            const prev = ctx; ctx = c; try { draw(); } finally { ctx = prev; }
            e.fx = fx; e.fy = fy; CARDS.list.push(e); return e;
        }
        function cardSweep(gl) { // the Minecraft trick: keep only what's near. A static card nobody has drawn for 12 s (another zone, the far end of town) frees its canvas and texture; it is redrawn if it comes back into view
            const now = performance.now(); if (now - (CARDS.swept || 0) < 3000) return; CARDS.swept = now;
            for (const k in CARD_CACHE) { const c = CARD_CACHE[k]; if (now - (c.used || 0) > 12000) { if (c.tex && gl) gl.deleteTexture(c.tex); c.cv.width = c.cv.height = 0; delete CARD_CACHE[k]; } }
        }
        function cardFlash(amount) { // inside an asCard draw: tint just what was drawn on the card
            if (!cardMode() || amount <= 0) return;
            ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,236,214,${Math.min(0.85, amount).toFixed(2)})`; ctx.fillRect(0, 0, 128, 128); ctx.restore();
        }
        // cinematic lens: the third-person camera breathes with the place. Riding between great pillars and statues it eases
        // wider so they tower in frame; inside a fog bank it tightens and the fog closes in. Control never leaves the player.
        const CINE = { mag: 1.7, fogD: 1, hold: 0, holdMag: 1.7, fogBank: 0, hY: 14, vista: 0, z0: 110 };
        const CINE_BIG = new Set(['pillar', 'statue', 'arch', 'obelisk', 'block', 'stump']);
        const CINE_FOG = { trail: [[96, 128], [268, 292], [40, 52]] }; // rows of standing fog per map
        function cineWide() { // 0..1: how strongly great landmarks flank the hero right now
            if (currentMapName !== 'trail') return 0;
            let L = 0, R = 0;
            for (const p of TRAIL.props) {
                if (!CINE_BIG.has(p.kind)) continue;
                const dy = p.y - player.gridY; if (dy < -3 || dy > 5) continue; // just ahead or alongside
                const w = 1 - Math.max(0, Math.abs(dy - 1) - 1) / 4;
                if (p.x < player.gridX) L = Math.max(L, w); else if (p.x > player.gridX) R = Math.max(R, w); else { L = Math.max(L, w * 0.8); R = Math.max(R, w * 0.8); }
            }
            return Math.min(L, R) * 0.7 + Math.max(L, R) * 0.3;
        }
        function cineFog() { // 0..1 inside a bank, feathered at its edges
            const B = CINE_FOG[currentMapName]; if (!B) return 0;
            let f = 0; for (const [a, b] of B) f = Math.max(f, Math.min(1, Math.max(0, Math.min(player.gridY - a + 1, b - player.gridY + 1) / 4)));
            return f;
        }
        function cineShot(mag, frames) { CINE.holdMag = mag; CINE.hold = frames; } // a held framing (arrivals), then ease back
        function cineStep() {
            const lockClose = COMBAT.amt < 0.9; // fights keep their own framing
            const wide = lockClose ? 0 : cineWide(), fog = lockClose ? 0 : cineFog(); CINE.fogBank = fog;
            let tMag = 1.7 - wide * 0.5 + fog * 0.45 + CAM.zoom, tFog = (1 - fog * 0.45) * (FX_GL.curMode === 1 ? ({ fog: 0.62, rain: 0.85, storm: 0.8 }[weatherNow()] || 1) : 1);
            if (CINE.hold > 0) { CINE.hold--; tMag = CINE.holdMag; }
            CINE.mag += (tMag - CINE.mag) * (CINE.hold > 0 ? 0.03 : 0.022); CINE.fogD += (tFog - CINE.fogD) * 0.02;
            const vis = currentMapName === 'overworld' && FX_GL.vistaReady ? 1 : 0; // Brennan's Theme: a higher horizon with the vista always in view
            CINE.vista += (vis - CINE.vista) * 0.05; CINE.hY += ((vis ? 46 : 14) - CINE.hY) * 0.05;
            if (Math.abs(CINE.vista - vis) < 0.002) CINE.vista = vis; if (Math.abs(CINE.hY - (vis ? 46 : 14)) < 0.01) CINE.hY = vis ? 46 : 14;
        }
