        // ===== CAMERA: the right stick orbits the third-person camera (x) and pulls it in or out (y); D-pad down swings it back behind him =====
        const CAM = { yaw: 0, zoom: 0, rx: 0, ry: 0, back: null, ctrl: 0, idleT: 0 };
        function camYaw() { return COMBAT.amt > 0.5 && FX_GL.curMode !== 3 ? CAM.yaw : 0; }
        const DIR8_ORDER = ['up', 'up_right', 'right', 'down_right', 'down', 'down_left', 'left', 'up_left'];
        function camDir(d, eight) { // a world facing as the camera sees it
            const yw = camYaw(); if (!yw || !d) return d; const i = DIR8_ORDER.indexOf(d); if (i < 0) return d;
            const st = eight ? Math.round(yw / (Math.PI / 4)) : Math.round(yw / (Math.PI / 2)) * 2; let j = ((i - st) % 8 + 8) % 8;
            if (!eight && j % 2) j = (j + 1) % 8; return DIR8_ORDER[j];
        }
        function camInput(dx, dy) { // a screen-space push into world space, using the view you settled on (not the one you're mid-turn through)
            const yw = COMBAT.amt > 0.5 && FX_GL.curMode !== 3 ? CAM.ctrl : 0; if (!yw) return [dx, dy]; const c = Math.cos(yw), s = Math.sin(yw); return [dx * c - dy * s, dx * s + dy * c];
        }
        function camRecenter() { const v = DIR8_VEC[player.face8 || player.dir] || [0, -1]; CAM.back = Math.atan2(v[0], -v[1]); }
        function camStep() {
            if (CAM.map !== currentMapName) { CAM.map = currentMapName; CAM.yaw = 0; CAM.back = null; CAM.ctrl = 0; }
            const mv = gameStarted && player.isMoving; if (mv !== CAM.mv) { CAM.mv = mv; clearTimeout(CAM.mvT); if (mv) document.body.classList.add('moving'); else CAM.mvT = setTimeout(() => document.body.classList.remove('moving'), 900); }
            const k = keys || {}; let rx = CAM.rx, ry = CAM.ry;
            if (k['[']) rx -= 1; if (k[']']) rx += 1; if (k['-']) ry += 1; if (k['=']) ry -= 1;
            if (Math.abs(rx) > 0.15) { CAM.yaw += rx * Math.abs(rx) * 0.036; CAM.back = null; } // eased: a light push turns slowly
            if (Math.abs(ry) > 0.15) CAM.zoom = Math.max(-0.55, Math.min(0.65, CAM.zoom - ry * 0.018)); // push up: wider, pull down: closer
            if (CAM.back != null) { let d = CAM.back - CAM.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); CAM.yaw += d * 0.14; if (Math.abs(d) < 0.003) { CAM.yaw = CAM.back; CAM.back = null; } }
            CAM.yaw = Math.atan2(Math.sin(CAM.yaw), Math.cos(CAM.yaw));
            const turning = Math.abs(rx) > 0.15 || CAM.back != null, pushing = joystickState.active && Math.hypot(joystickState.x, joystickState.y) > 0.25 || k['w'] || k['a'] || k['s'] || k['d'] || k['arrowup'] || k['arrowdown'] || k['arrowleft'] || k['arrowright'];
            if (turning) CAM.idleT = 0; else if (++CAM.idleT > 6 && !pushing) CAM.ctrl = CAM.yaw; // let go of the camera (and the walk) and 'up' becomes 'away from the camera'
        }
        function tpAnchor() { // the point the third-person camera is built around (canvas px): the hero, nudged toward a locked target, plus shake
            const v = viewAnchorShift(); // first person / inspect move the anchor (see 47-view-modes.js)
            return [player.pixelX + 8 - lastCamX + COMBAT.fx + COMBAT.sx + v[0], player.pixelY + 15 - lastCamY + COMBAT.fy + COMBAT.sy + v[1]];
        }
        function spawnSparks(x, y) {
            const parts = Array.from({ length: 9 }, (_, i) => { const a = i / 9 * Math.PI * 2 + Math.random() * 0.5, v = 0.7 + Math.random() * 0.9; return { x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5 }; });
            COMBAT.sparks.push({ x, y, t: 0, parts });
        }
        function drawSparks() {
            for (const b of COMBAT.sparks) asCard(b.x, b.y + 6, () => {
                const k = b.t / 16;
                for (const q of b.parts) { ctx.fillStyle = k < 0.4 ? '#fffbe6' : k < 0.7 ? '#fde68a' : '#f59e0b'; const sz = k < 0.5 ? 2 : 1; ctx.fillRect(b.x + q.x - sz / 2, b.y + q.y - sz / 2, sz, sz); }
                if (b.t < 4) { ctx.fillStyle = 'rgba(255,255,240,0.85)'; ctx.fillRect(b.x - 3, b.y - 0.5, 6, 1); ctx.fillRect(b.x - 0.5, b.y - 3, 1, 6); }
            });
        }
        function trySwordHit() { // sword in combat stance: hits the locked wolf (or any wolf right beside him), knocks it back
            const near = w => Math.max(Math.abs(w.gridX - player.gridX), Math.abs(w.gridY - player.gridY)) <= 1;
            let w = lockedWolf && lockedWolf.alive && !lockedWolf.fleeing && near(lockedWolf) ? lockedWolf : null;
            if (!w) w = wolves.find(x => x.alive && !x.fleeing && near(x)) || null;
            if (!w) return false;
            const dx = w.gridX - player.gridX, dy = w.gridY - player.gridY;
            player.dir = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down'); player.face8 = player.dir; // turn to the target
            if (w.hp == null) w.hp = w.kind === 'boxelder' ? 2 : 3;
            w.hp--; w.hitT = 10; COMBAT.shake = 7;
            spawnSparks((w.pixelX + player.pixelX) / 2 + 8, (w.pixelY + player.pixelY) / 2 + 9);
            const nx = w.gridX + Math.sign(dx), ny = w.gridY + Math.sign(dy);
            if (!isSolidTile(nx, ny)) { w.gridX = nx; w.gridY = ny; w.targetX = nx * TILE_SIZE; w.targetY = ny * TILE_SIZE; w.isMoving = true; }
            w.moveTimer = -45; // staggered: it needs a moment before it comes back at you
            if (w.hp <= 0) {
                w.fleeing = true; w.fleeTimer = 0; if (lockedWolf === w) lockedWolf = null;
                showFluidMessage(w.kind === 'boxelder' ? 'The Boxelder tears apart into shadow.' : 'The wolf yelps and bolts away.', 1200);
            }
            return true;
        }
