        // ===== THE LASSO: equip the LASSO ROPE (pouch) and hold A facing a wild horse. lassoAttempt() stays a pure mechanic:
        // it returns { success, horseId } / { success: false, reason } and the caller decides what to show. =====
        const tamedWildHorses = []; // captured horses live here until there's a UI (a second stable slot, a swap prompt, etc.)
        function nearestLassoableHorse(reach = 4) { // along the way you face, up to `reach` tiles out, with a tile of slack either side
            if (currentMapName !== 'overworld') return null;
            const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.dir] || [0, 1];
            let best = null, bestD = Infinity;
            for (const w of wildHorses) {
                if (!w.alive || w.captured) continue;
                const rx = w.gridX - player.gridX, ry = w.gridY - player.gridY;
                const along = rx * d[0] + ry * d[1], side = Math.abs(rx * d[1] - ry * d[0]);
                if (along >= 1 && along <= reach && side <= 1 && along < bestD) { best = w; bestD = along; }
            }
            return best;
        }
        function lassoAttempt() { // pure capture mechanic — presentation (animation, sound, HUD toast) hangs off the
            const w = nearestLassoableHorse();          // returned result, never gets baked into this function itself
            if (!w) return { success: false, reason: 'NO_TARGET' };
            w.captured = true; w.alive = false;
            // id-keyed dedupe: a horse can only ever end up tamed once, no matter how many times its capture is retried
            if (!tamedWildHorses.some(h => h.id === w.id)) {
                tamedWildHorses.push({ id: w.id, coat: w.coat, tamedAt: Date.now() });
            }
            showFluidMessage(`You loop the lasso and settle the ${w.coat.label.toLowerCase()} horse down. It's yours now.`);
            return { success: true, horseId: w.id };
        }

        function drawVillagerNPC(x, y, variant = 'drunk') {
            ctx.save();
            ctx.translate(x, y);

            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(2, 14, 12, 2);

            if (variant === 'drunk') {
                ctx.fillStyle = '#78716c';
                ctx.fillRect(3, 8, 10, 7);
                ctx.fillStyle = '#a16207';
                ctx.fillRect(3, 8, 10, 2);
                ctx.fillStyle = '#fde68a';
                ctx.fillRect(5, 2, 6, 6);
                ctx.fillStyle = '#78350f';
                ctx.fillRect(4, 0, 8, 3);
            } else {
                ctx.fillStyle = '#7e22ce';
                ctx.fillRect(3, 8, 10, 7);
                ctx.fillStyle = '#f5d0a9';
                ctx.fillRect(5, 2, 6, 6);
                ctx.fillStyle = '#451a03';
                ctx.fillRect(4, 0, 8, 4);
                ctx.fillRect(3, 2, 2, 5);
                ctx.fillRect(11, 2, 2, 5);
            }

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(6, 5, 1, 1);
            ctx.fillRect(9, 5, 1, 1);

            ctx.restore();
        }

        function drawTigerNPC(x, y, variant = 'papa') {
            ctx.save();
            ctx.translate(x, y);

            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(2, 14, 12, 2);

            if (variant === 'papa') {
                ctx.fillStyle = '#059669'; 
                ctx.fillRect(3, 8, 10, 7);
                ctx.fillStyle = '#34d399';
                ctx.fillRect(6, 8, 4, 7);
            } else if (variant === 'mama') {
                ctx.fillStyle = '#e11d48'; 
                ctx.fillRect(3, 8, 10, 7);
                ctx.fillStyle = '#ffe4e6'; 
                ctx.fillRect(5, 9, 6, 6);
            } else if (variant === 'daughter') {
                ctx.fillStyle = '#0284c7'; 
                ctx.fillRect(3, 9, 10, 6);
                ctx.fillStyle = '#fef08a'; 
                ctx.fillRect(3, 13, 10, 2);
            }

            ctx.fillStyle = '#f97316';
            ctx.fillRect(3, 2, 10, 7);

            ctx.fillStyle = '#ea580c';
            ctx.fillRect(2, 0, 3, 3);
            ctx.fillRect(11, 0, 3, 3);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(2, 0, 3, 1);
            ctx.fillRect(11, 0, 3, 1);
            ctx.fillStyle = '#fed7aa';
            ctx.fillRect(3, 1, 1, 2);
            ctx.fillRect(12, 1, 1, 2);

            if (variant === 'daughter') {
                ctx.fillStyle = '#f43f5e';
                ctx.fillRect(1, -2, 4, 3);
            }

            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(4, 6, 8, 3);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(7, 6, 2, 1);

            ctx.fillStyle = '#facc15';
            ctx.fillRect(4, 4, 3, 2);
            ctx.fillRect(9, 4, 3, 2);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(5, 4, 1, 2);
            ctx.fillRect(10, 4, 1, 2);

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(7, 2, 2, 2);
            ctx.fillRect(3, 4, 1, 2);
            ctx.fillRect(12, 4, 1, 2);

            ctx.restore();
        }

        const keys = {};
        const joystickState = { x: 0, y: 0, active: false };

        window.addEventListener('keydown', (e) => {
            keys[e.key.toLowerCase()] = true;
            if (!gameStarted && !cinematicMode) {
                if (e.key === 'z' || e.key === 'Enter') startCrawl();
                return;
            }
            if (e.key === ' ' || e.key.toLowerCase() === 's') {
                toggleInventory();
                return;
            }
            if (cinematicMode || gameState === "INVENTORY") return; 
            if (e.key === 'z' || e.key === 'Enter') handleAButton();
            if (e.key === 'x' || e.key === 'Escape') handleBButton();
            if (POUCH.state === 'opening' || POUCH.state === 'browse') {
                const kk = e.key.toLowerCase();
                if (kk === 'a' || kk === 'arrowleft') { pouchTurn(-1); return; }
                if (kk === 'd' || kk === 'arrowright') { pouchTurn(1); return; }
                if (kk === 'q' && !e.repeat) { confirmPouch(); return; }
            } else if (!e.repeat && e.key.toLowerCase() === 'q') { openPouch(false); return; }
            if (!e.repeat && e.key.toLowerCase() === 'm') { handlePlayButton(); return; }
            if (!e.repeat && (e.key === ',' || e.key === '.')) handleDpad(e.key === ',' ? 'left' : 'right');
            if (!e.repeat && e.key.toLowerCase() === 'v') handleDpad('down');
            if (!e.repeat && e.key.toLowerCase() === 'j') handleJumpButton();
            if (!e.repeat && e.key.toLowerCase() === 'r') handleRollButton();
            if (!e.repeat && e.key.toLowerCase() === 't') handleTeleportButton();
            if (e.key.toLowerCase() === 'c') {
                useEquippedToolAction();
            }
        });

        window.addEventListener('keyup', (e) => {
            keys[e.key.toLowerCase()] = false;
        });

        const joystickZone = document.getElementById('joystick-zone');
        const joystickStick = document.getElementById('joystick-stick');
        let joystickCenter = { x: 0, y: 0 };

        function handleJoystickStart(e) {
            if (cinematicMode || gameState === "INVENTORY") return;
            joystickState.active = true; joystickZone.classList.add('live');
            joystickState.touchId = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].identifier : null; // the finger on the stick; other fingers (X, ▲, A...) don't move or release it
            const rect = joystickZone.getBoundingClientRect();
            joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            handleJoystickMove(e);
        }

        function handleJoystickMove(e) {
            if (!joystickState.active || cinematicMode || gameState === "INVENTORY") return;
            let pt = e;
            if (e.touches) { pt = null; for (const t of e.touches) if (t.identifier === joystickState.touchId) pt = t; if (!pt) return; }
            const clientX = pt.clientX, clientY = pt.clientY;

            const deltaX = clientX - joystickCenter.x;
            const deltaY = clientY - joystickCenter.y;
            const dist = Math.hypot(deltaX, deltaY);
            const maxDist = joystickZone.clientWidth / 2 - joystickStick.clientWidth / 2 + 2; // the knob travels to the plate's edge

            const angle = Math.atan2(deltaY, deltaX);
            const moveDist = Math.min(dist, maxDist);

            const stickX = Math.cos(angle) * moveDist;
            const stickY = Math.sin(angle) * moveDist;

            joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

            const tilt = moveDist / maxDist; // lean the knob the way it's pushed, and light the direction it snaps to
            joystickStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px)) scale(${1 - tilt * 0.04})`;
            const seg = tilt > 0.25 ? ((Math.round((angle + Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8 : -1;
            if (seg !== joystickState.seg) { for (let i = 0; i < 8; i++) { const w = document.getElementById('js-seg-' + i); if (w) w.classList.toggle('on', i === seg); } joystickState.seg = seg; }
            joystickState.x = stickX / maxDist;
            joystickState.y = stickY / maxDist;
        }

        function handleJoystickEnd(e) {
            if (e && e.changedTouches && joystickState.touchId != null) { // only the stick's own finger lifting lets go of the stick
                let mine = false; for (const t of e.changedTouches) if (t.identifier === joystickState.touchId) mine = true;
                if (!mine) return;
            }
            joystickState.touchId = null;
            joystickState.active = false;
            joystickState.x = 0;
            joystickState.y = 0;
            joystickStick.style.transform = `translate(-50%, -50%)`; joystickZone.classList.remove('live');
            for (let i = 0; i < 8; i++) { const w = document.getElementById('js-seg-' + i); if (w) w.classList.remove('on'); } joystickState.seg = -1;
        }

        joystickZone.addEventListener('touchstart', handleJoystickStart, { passive: true });
        window.addEventListener('touchmove', handleJoystickMove, { passive: true });
        window.addEventListener('touchend', handleJoystickEnd); window.addEventListener('touchcancel', handleJoystickEnd);
        joystickZone.addEventListener('mousedown', handleJoystickStart);
        window.addEventListener('mousemove', handleJoystickMove);
        window.addEventListener('mouseup', handleJoystickEnd);

        // A is now the only "use" button: a quick tap talks/interacts/mounts/advances dialogue (handleAButton),
        // holding it swings the axe or uses whatever's equipped (what B used to do for a tap). The pouch stays
        // reachable via the dedicated pouch button above the screen, or Q.
        let aDownHandled = false, aHoldTimer = null, aHoldFired = false;
        const btnA = document.getElementById('btn-a');
        btnA.addEventListener('pointerdown', e => {
            if (!inPlay()) return;
            aDownHandled = true; aHoldFired = false; clearTimeout(aHoldTimer);
            aHoldTimer = setTimeout(() => {
                aHoldFired = true;
                if (POUCH.state) return; // still picking in the pouch — don't fire the tool underneath it
                if (HORSE.mounted && !inDialogue) { showFluidMessage('Not from the saddle. [A] to get down.', 1600); return; }
                if (COMBAT.on && !inDialogue) { sheatheSword(); return; }
                useEquippedToolAction();
            }, 320);
        });
        btnA.addEventListener('pointerup', () => {
            clearTimeout(aHoldTimer);
            if (aDownHandled) { if (!aHoldFired) handleAButton(); aDownHandled = false; }
        });
        btnA.addEventListener('pointercancel', () => { clearTimeout(aHoldTimer); aDownHandled = false; });
        btnA.addEventListener('click', () => {
            if (aDownHandled || aHoldFired) { aDownHandled = false; aHoldFired = false; return; }
            if (!gameStarted && !cinematicMode) { startCrawl(); return; }
            if (!cinematicMode && gameState !== "INVENTORY") handleAButton();
        });
        ['btn-a', 'btn-b', 'btn-x', 'btn-y', 'btn-start', 'btn-play', 'dp-up', 'dp-down', 'dp-left', 'dp-right'].forEach(id => { const el = document.getElementById(id); if (!el) return;
            el.addEventListener('pointerdown', () => { el.classList.add('down'); try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} });
            ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => el.addEventListener(t, () => el.classList.remove('down'))); });
        document.getElementById('pouch-btn').addEventListener('pointerdown', e => { e.preventDefault(); if (cinematicMode || gameState === "INVENTORY") return; if (POUCH.state === 'opening' || POUCH.state === 'browse') confirmPouch(); else openPouch(false); });
        // Action buttons fire on pointerdown, not click: phones never send a click for a second finger while the
        // first one is holding the stick, which is what made jumping or rolling on the move impossible.
        const inPlay = () => gameStarted && !cinematicMode && gameState !== "INVENTORY" && !OP.on;
        document.getElementById('btn-x').addEventListener('pointerdown', e => { if (inPlay()) { e.preventDefault(); handleJumpButton(); } });
        document.getElementById('btn-y').addEventListener('pointerdown', e => { if (inPlay()) { e.preventDefault(); handleTriangleButton(); } });
        document.getElementById('btn-b').addEventListener('pointerdown', e => { if (inPlay()) { e.preventDefault(); handleBButton(); } });
        function handlePlayButton() { // Start: straight to the map
            if (!gameStarted && !cinematicMode) { startCrawl(); return; }
            if (cinematicMode) return;
            const inv = document.getElementById('inventory-screen');
            if (inv.classList.contains('hidden')) { toggleInventory(); menuTab('quest'); } else toggleInventory();
        }
        document.getElementById('btn-play').addEventListener('pointerdown', e => { e.preventDefault(); handlePlayButton(); });
        function cycleItem(d) { // D-pad left/right: switch what's in hand without opening the bag
            const list = POUCH.items; let i = list.indexOf(equippedItem); if (i < 0) i = list.length - 1;
            const next = list[(i + d + list.length) % list.length];
            if (COMBAT.on) sheatheSword(true);
            if (next === 'none') { if (equippedItem !== 'none') selectInventoryItem(equippedItem); } else selectInventoryItem(next);
            if (typeof updateToolButtonIcon === 'function') updateToolButtonIcon();
            showFluidMessage(POUCH_LABELS[next] || next, 800);
        }
        function handleDpad(k) {
            if (!inPlay() || inDialogue) return;
            const open = POUCH.state === 'opening' || POUCH.state === 'browse';
            if (k === 'up') { if (open) confirmPouch(); else if (!POUCH.state) openPouch(false); }
            else if (k === 'down') { if (open) cancelPouch(); else { camRecenter(); showFluidMessage('Camera behind you.', 700); } }
            else { const d = k === 'left' ? -1 : 1; if (open) pouchTurn(d); else if (!POUCH.state) cycleItem(d); }
        }
        ['up', 'down', 'left', 'right'].forEach(k => document.getElementById('dp-' + k).addEventListener('pointerdown', e => { e.preventDefault(); handleDpad(k); }));
        // the right stick: orbit (x) and pull in or out (y)
        const CAMSTICK = { id: null, cx: 0, cy: 0 }, camZone = document.getElementById('cam-zone'), camKnob = document.getElementById('cam-stick');
        function camStickMove(e) {
            if (CAMSTICK.id == null) return; let pt = e;
            if (e.touches) { pt = null; for (const t of e.touches) if (t.identifier === CAMSTICK.id) pt = t; if (!pt) return; }
            let dx = pt.clientX - CAMSTICK.cx, dy = pt.clientY - CAMSTICK.cy; const m = Math.hypot(dx, dy), R = 36; if (m > R) { dx *= R / m; dy *= R / m; }
            camKnob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))'; CAM.rx = dx / R; CAM.ry = dy / R; if (e.cancelable) e.preventDefault();
        }
        function camStickStart(e) {
            if (!inPlay()) return; const t = e.changedTouches ? e.changedTouches[0] : e; CAMSTICK.id = e.changedTouches ? t.identifier : 'mouse';
            const r = camZone.getBoundingClientRect(); CAMSTICK.cx = r.left + r.width / 2; CAMSTICK.cy = r.top + r.height / 2; camZone.classList.add('live'); camStickMove(e); if (e.cancelable) e.preventDefault();
        }
        function camStickEnd(e) {
            if (CAMSTICK.id == null) return;
            if (e && e.changedTouches) { let mine = false; for (const t of e.changedTouches) if (t.identifier === CAMSTICK.id) mine = true; if (!mine) return; }
            CAMSTICK.id = null; CAM.rx = CAM.ry = 0; camKnob.style.transform = 'translate(-50%, -50%)'; camZone.classList.remove('live');
        }
        camZone.addEventListener('touchstart', camStickStart, { passive: false }); window.addEventListener('touchmove', camStickMove, { passive: false });
        window.addEventListener('touchend', camStickEnd); window.addEventListener('touchcancel', camStickEnd);
        camZone.addEventListener('mousedown', camStickStart); window.addEventListener('mousemove', e => { if (CAMSTICK.id === 'mouse') camStickMove(e); }); window.addEventListener('mouseup', e => { if (CAMSTICK.id === 'mouse') camStickEnd(e); });
        document.getElementById('tp-btn').addEventListener('pointerdown', e => { if (inPlay()) { e.preventDefault(); handleTeleportButton(); } });

        let inDialogue = false;

        function showDialogue(text, showPrompt = true) {
            inDialogue = true;
            audio.playSelect();
            const box = document.getElementById('dialogue-box');
            const textEl = document.getElementById('dialogue-text');
            const promptEl = document.getElementById('dialogue-continue-prompt');
            box.classList.remove('hidden');
            typeDialogue(textEl, text); // letter by letter, with the speaker's little voice
            if (showPrompt) {
                promptEl.classList.remove('hidden');
            } else {
                promptEl.classList.add('hidden');
            }
        }

        function hideDialogue() {
            finishTyping(false);
            inDialogue = false;
            document.getElementById('dialogue-box').classList.add('hidden');
            document.getElementById('dialogue-actions').classList.add('hidden');
            document.getElementById('shop-buy-actions').classList.add('hidden');
            document.getElementById('npc-dialogue-actions').classList.add('hidden');
        }

        function handleBButton() { // a stray error here must never throw the player back to the start screen
            try { handleBButtonInner(); } catch (err) { console.warn('B button:', err); try { hideDialogue(); } catch (e2) { /* nothing to close */ } }
        }
        function handleBButtonInner() {
            if (!gameStarted) return;
            if (POUCH.state) { cancelPouch(); return; }
            if (HORSE.mounted && !inDialogue) { showFluidMessage('Not from the saddle. [A] to get down.', 1600); return; }
            if (inDialogue && dialogueTyping()) finishTyping(true); // first press: show the whole line
            else if (inDialogue) hideDialogue();
            else if (COMBAT.on) sheatheSword();
            else useEquippedToolAction();
        }

        function isTreeTile(tile) {
            return tile === 1 || tile === 2 || tile === 9 || tile === 11;
        }

        const JUMP_FRAMES = 32; // ~0.53 s: crouch, leap, tuck, land
        const ROLL_ANIM_FRAMES = 22; // the tumble: about the time two tiles take at ROLL_SPEED
        const ROLL_INVINCIBLE_FRAMES = 24; // i-frame window; a little longer than the tumble so a mistimed roll still forgives a hit
        // X: jump. A hop in place that never pushes him forward; if he was already walking or running he carries on
        // at the same pace through the air (and keeps going that way even if the stick is let go mid-jump).
        function handleJumpButton() {
            if (inDialogue || !gameStarted || gameState === "INVENTORY" || jumpTimer > 0 || rollAnim > 0 || HORSE.mounted) return;
            if (POUCH.state) { cancelPouch(); return; }
            jumpTimer = JUMP_FRAMES;
            const moving = player.isMoving || (player.lastInput && performance.now() - player.lastInput < 120);
            player.jumpDir = moving ? (DIR8_VEC[player.face8] || null) : null; player.jumpRun = !!player.isRunning;
            audio.playTone(392, 'triangle', 0.12, 0.04);
        }
        // TELEPORT (the button beside the lens): a short blink forward, up to 3 tiles in the facing direction.
        // It stops at the first wall and can't cut corners; doors and exits it passes onto still work.
        const TELEPORT_TILES = 3, TELEPORT_COOLDOWN_MS = 1200, TELEPORT_SPEED = 16;
        let teleportReadyAt = 0; const TP_FX = [];
        function handleTeleportButton() {
            if (inDialogue || !gameStarted || gameState === "INVENTORY" || cinematicMode || HORSE.mounted || POUCH.state) return;
            const now = performance.now(); if (now < teleportReadyAt || player.blinkSteps > 0) return;
            const dir = player.face8 || player.dir || 'down', v = DIR8_VEC[dir] || [0, 1];
            if (!tryStepDir(v[0], v[1])) { audio.playBump(); return; }
            teleportReadyAt = now + TELEPORT_COOLDOWN_MS; tpButtonCooldown();
            TP_FX.push({ x: player.pixelX + 8, y: player.pixelY + 8, t0: now, from: true });
            player.blinkDir = dir; player.blinkSteps = TELEPORT_TILES; player.rollSteps = 0;
            if (player.isMoving) { player.pixelX = player.targetX; player.pixelY = player.targetY; player.gridX = Math.round(player.pixelX / TILE_SIZE); player.gridY = Math.round(player.pixelY / TILE_SIZE); player.isMoving = false; }
            playerInvincible = true; invincibleTimer = Math.max(invincibleTimer, 14);
            startBlinkStep();
            try { audio.playTone(880, 'sine', 0.18, 0.05); setTimeout(() => audio.playTone(1318.5, 'sine', 0.22, 0.04), 60); } catch (e) {}
        }
        function startBlinkStep() {
            const v = DIR8_VEC[player.blinkDir] || [0, 1], st = tryStepDir(v[0], v[1]);
            player.blinkSteps = Math.max(0, player.blinkSteps - 1);
            if (!st) { player.blinkSteps = 0; blinkLanded(); return; } // a wall ends it; a blocked diagonal glances along the wall
            player.targetX = (player.gridX + st[0]) * TILE_SIZE; player.targetY = (player.gridY + st[1]) * TILE_SIZE; player.isMoving = true; player.inBlink = true;
        }
        function blinkLanded() { player.inBlink = false; TP_FX.push({ x: player.pixelX + 8, y: player.pixelY + 8, t0: performance.now(), from: false }); }
        function tpButtonCooldown() {
            const b = document.getElementById('tp-btn'); if (!b) return;
            b.style.opacity = '0.35'; setTimeout(() => { b.style.opacity = '1'; }, TELEPORT_COOLDOWN_MS);
        }
        function drawTeleportFx() { // a cold flash where he left and where he lands
            const now = performance.now();
            for (let i = TP_FX.length - 1; i >= 0; i--) {
                const f = TP_FX[i], q = (now - f.t0) / 420; if (q >= 1) { TP_FX.splice(i, 1); continue; }
                ctx.save(); ctx.globalAlpha = 1 - q;
                const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 6 + q * 10); g.addColorStop(0, 'rgba(186,230,253,.9)'); g.addColorStop(1, 'rgba(56,189,248,0)');
                ctx.fillStyle = g; ctx.fillRect(f.x - 18, f.y - 18, 36, 36);
                ctx.strokeStyle = 'rgba(224,242,254,.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, 4 + q * 9, 1.5 + q * 3, 0, 0, 7); ctx.stroke();
                for (let k = 0; k < 6; k++) { const a = k * 1.047 + f.t0, r = 3 + q * 12; ctx.fillStyle = '#e0f2fe'; ctx.fillRect(Math.round(f.x + Math.cos(a) * r), Math.round(f.y + Math.sin(a) * r - q * 6), 1, 1); }
                ctx.restore();
            }
        }
        // TRIANGLE: roll. A two-tile tumble in any of the 8 directions, with a short window where nothing can hurt him.
        function handleRollButton() {
            if (inDialogue || !gameStarted || gameState === "INVENTORY" || rollAnim > 0 || player.blinkSteps > 0 || HORSE.mounted || POUCH.state) return;
            rollAnim = ROLL_ANIM_FRAMES;
            playerInvincible = true;
            invincibleTimer = ROLL_INVINCIBLE_FRAMES;
            player.rollDir = player.face8 || player.dir || 'down';
            audio.playTone(523.25, 'square', 0.09, 0.05); // a short high blip, distinct from the axe/talk sounds
            if (player.isMoving) { player.inRollStep = true; player.rollSteps = 1; } // speed up the step in progress, then one more
            else { player.rollSteps = 2; startRollStep(true); }
        }

