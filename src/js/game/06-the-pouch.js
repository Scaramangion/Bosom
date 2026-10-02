        // ================= THE POUCH: hold B (or Q / the bag button) for a ring of your gear above his head; he digs in the bag as you turn it =================
        const POUCH = { state: null, t0: 0, sel: 0, rumT: 0, pick: null, items: ['axe', 'sword', 'torch', 'lens', 'staff', 'rope', 'none'], viaHold: false, lastStick: 0 };
        const POUCH_LABELS = { axe: 'TIMBER AXE', torch: 'TORCH', lens: 'TRUTH LENS', staff: 'PRIESTESS STAFF', rope: 'LASSO ROPE', sword: 'SHORT SWORD', none: 'EMPTY HANDS' };
        function openPouch(viaHold) {
            if (POUCH.state || HORSE.mounted || inDialogue || !gameStarted || gameState === 'INVENTORY' || rollAnim > 0 || jumpTimer > 0 || player.inBlink) return false;
            POUCH.state = 'opening'; POUCH.t0 = performance.now(); POUCH.viaHold = !!viaHold;
            POUCH.sel = Math.max(0, POUCH.items.indexOf(equippedItem));
            buildPouchRing(); pouchRingLoop();
            audio.playTone(330, 'triangle', 0.12, 0.04);
            return true;
        }
        function pouchTurn(d) {
            if (POUCH.state !== 'opening' && POUCH.state !== 'browse') return;
            POUCH.sel = (POUCH.sel + d + POUCH.items.length) % POUCH.items.length; POUCH.rumT = performance.now();
            if (POUCH.state === 'opening') POUCH.state = 'browse';
            updatePouchRing(); audio.playTone(520 + POUCH.sel * 40, 'sine', 0.08, 0.035);
        }
        function confirmPouch(i) {
            if (POUCH.state !== 'opening' && POUCH.state !== 'browse') return;
            if (typeof i === 'number') POUCH.sel = i;
            POUCH.pick = POUCH.items[POUCH.sel]; POUCH.state = 'retrieve'; POUCH.t0 = performance.now();
            hidePouchRing();
            setTimeout(() => { const it = POUCH.pick; if (it !== equippedItem) { if (it === 'none') selectInventoryItem(equippedItem); else selectInventoryItem(it); } POUCH.state = 'closing'; POUCH.t0 = performance.now(); setTimeout(() => { if (POUCH.state === 'closing') POUCH.state = null; }, 260); }, POUCH.pick === 'axe' ? 620 : 460);
        }
        function cancelPouch() { if (!POUCH.state || POUCH.state === 'retrieve') return; hidePouchRing(); POUCH.state = 'closing'; POUCH.t0 = performance.now(); setTimeout(() => { if (POUCH.state === 'closing') POUCH.state = null; }, 260); }
        function pouchPose(now) {
            const at = (a, q) => a[Math.min(a.length - 1, Math.max(0, Math.floor(q * a.length)))];
            const OPEN = ['pouch_open0', 'pouch_open1', 'pouch_open2', 'pouch_open3'], RUM = ['pouch_rum0', 'pouch_rum1', 'pouch_rum2', 'pouch_rum3'];
            let name = 'pouch_open3';
            if (POUCH.state === 'opening') name = at(OPEN, (now - POUCH.t0) / 380);
            else if (POUCH.state === 'browse') name = now - POUCH.rumT < 440 ? at(RUM, (now - POUCH.rumT) / 440) : 'pouch_rum0';
            else if (POUCH.state === 'retrieve') name = POUCH.pick === 'axe' ? at(['pouch_ret0', 'pouch_ret1', 'pouch_ret2', 'pouch_ret3'], (now - POUCH.t0) / 620) : at(['pouch_rum1', 'pouch_rum2', 'pouch_rum3', 'pouch_open3'], (now - POUCH.t0) / 460);
            else if (POUCH.state === 'closing') name = at(OPEN.slice().reverse(), (now - POUCH.t0) / 260);
            return { name, flip: false, bob: 0, rot: 0, view: 'down', pouch: true };
        }
        function pouchIcon(item, size) { // a small picture of each thing in the bag
            const cv = document.createElement('canvas'); cv.width = cv.height = size; const c = cv.getContext('2d'), S = size / 26;
            c.translate(size / 2, size / 2);
            if (item === 'staff') { c.translate(0, size * 0.16); c.rotate(0.35); HELD_ITEMS.staff.draw(c, size / 30); }
            else if (item === 'torch') { c.translate(0, size * 0.18); c.rotate(0.3); HELD_ITEMS.torch.draw(c, size / 14, 0.4); }
            else if (item === 'axe') { const f = HERO_FRAMES.tool_axe, im = (heroHD.img && heroHD.img.complete) ? heroHD.img : heroAtlas2D;
                if (f && im.complete) { const k = size * 0.86 / f[3]; c.rotate(-0.55); c.drawImage(im, f[0], f[1], f[2], f[3], -f[2] * k / 2, -f[3] * k / 2, f[2] * k, f[3] * k); } }
            else if (item === 'sword') { c.rotate(-0.75); c.lineCap = 'round';
                c.fillStyle = '#e2e8f0'; c.beginPath(); c.moveTo(-1.4 * S, 3 * S); c.lineTo(-1.4 * S, -9 * S); c.lineTo(0, -11.5 * S); c.lineTo(1.4 * S, -9 * S); c.lineTo(1.4 * S, 3 * S); c.fill();
                c.fillStyle = '#94a3b8'; c.fillRect(-0.3 * S, -9 * S, 0.6 * S, 11 * S);
                c.fillStyle = '#b45309'; c.fillRect(-4.5 * S, 3 * S, 9 * S, 1.6 * S); c.fillStyle = '#5b3a22'; c.fillRect(-1 * S, 4.6 * S, 2 * S, 4.5 * S);
                c.fillStyle = '#38bdf8'; c.beginPath(); c.arc(0, 3.8 * S, 0.9 * S, 0, 7); c.fill(); }
            else if (item === 'rope') { c.lineCap = 'round';
                c.strokeStyle = '#6b4423'; c.lineWidth = 3.4 * S; for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(-1.5 * S, -2 * S + k * 1.6 * S, 6.2 * S, 4.2 * S, -0.25, 0, 7); c.stroke(); }
                c.strokeStyle = '#c8a26b'; c.lineWidth = 1.2 * S; for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(-1.5 * S, -2 * S + k * 1.6 * S, 6.2 * S, 4.2 * S, -0.25, 3.6, 5.6); c.stroke(); }
                c.strokeStyle = '#6b4423'; c.lineWidth = 2.6 * S; c.beginPath(); c.moveTo(4 * S, 2 * S); c.quadraticCurveTo(8 * S, 6 * S, 5 * S, 9.5 * S); c.stroke(); }
            else if (item === 'lens') { c.strokeStyle = '#94a3b8'; c.lineWidth = 2.2 * S; c.beginPath(); c.arc(-2 * S, -2 * S, 6.5 * S, 0, 7); c.stroke(); c.fillStyle = 'rgba(56,189,248,.45)'; c.fill();
                c.strokeStyle = '#78350f'; c.lineWidth = 3 * S; c.beginPath(); c.moveTo(3 * S, 3 * S); c.lineTo(9 * S, 9 * S); c.stroke(); }
            else { c.strokeStyle = 'rgba(226,232,240,.8)'; c.lineWidth = 2 * S; c.beginPath(); c.arc(0, 0, 7 * S, 0, 7); c.moveTo(-5 * S, 5 * S); c.lineTo(5 * S, -5 * S); c.stroke(); }
            return cv;
        }
        function buildPouchRing() {
            let el = document.getElementById('pouch-ring');
            if (!el) { el = document.createElement('div'); el.id = 'pouch-ring'; const host = canvas.parentElement; if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; host.appendChild(el); }
            el.innerHTML = '<div class="pr-disc"></div>' + POUCH.items.map((it, i) => `<button class="pr-slot" data-i="${i}" aria-label="${POUCH_LABELS[it]}"></button>`).join('') + '<div class="pr-label"></div>';
            el.querySelectorAll('.pr-slot').forEach(b => { const i = +b.dataset.i; b.appendChild(pouchIcon(POUCH.items[i], 44)); b.addEventListener('click', e => { e.stopPropagation(); if (i === POUCH.sel) confirmPouch(i); else { pouchTurn((i - POUCH.sel + POUCH.items.length) % POUCH.items.length <= 2 ? (i - POUCH.sel + POUCH.items.length) % POUCH.items.length : -((POUCH.sel - i + POUCH.items.length) % POUCH.items.length)); } }); });
            el.style.display = 'block'; requestAnimationFrame(() => el.classList.add('on'));
            updatePouchRing();
        }
        function updatePouchRing() {
            const el = document.getElementById('pouch-ring'); if (!el) return;
            const n = POUCH.items.length, R = 44;
            el.querySelectorAll('.pr-slot').forEach(b => {
                const i = +b.dataset.i; let d = ((i - POUCH.sel) % n + n) % n; if (d > n / 2) d -= n;
                const a = -Math.PI / 2 + d * (Math.PI * 2 / n), x = Math.cos(a) * R, y = Math.sin(a) * R * 0.62, sel = d === 0;
                b.style.transform = `translate(${x}px, ${y}px) scale(${sel ? 1.18 : 0.78})`; b.style.opacity = sel ? '1' : '0.55'; b.style.zIndex = String(10 - Math.abs(d)); b.classList.toggle('sel', sel);
                if (POUCH.items[i] === equippedItem) b.classList.add('held'); else b.classList.remove('held');
            });
            el.querySelector('.pr-label').textContent = POUCH_LABELS[POUCH.items[POUCH.sel]] + (POUCH.items[POUCH.sel] === equippedItem ? ' (HELD)' : '');
        }
        function hidePouchRing() { const el = document.getElementById('pouch-ring'); if (!el) return; el.classList.remove('on'); setTimeout(() => { if (!POUCH.state || POUCH.state === 'retrieve' || POUCH.state === 'closing') el.style.display = 'none'; }, 180); }
        function pouchRingLoop() { // keep the ring floating over his head
            const el = document.getElementById('pouch-ring'); if (!el || !(POUCH.state === 'opening' || POUCH.state === 'browse')) return;
            let px, py;
            if (heroHD.active() && heroHD.lastP) { px = heroHD.lastP[0]; py = heroHD.lastP[1] - 33 * ((heroHD.lastP[2] || 1) - 1); }
            else { px = player.pixelX + 8 - lastCamX; py = player.pixelY + 15 - lastCamY; }
            const cv = (FX_GL.ok && FX_GL.cv) ? FX_GL.cv : canvas, r = cv.getBoundingClientRect(), hr = cv.parentElement.getBoundingClientRect();
            const sx = r.width / GAME_WIDTH, sy = r.height / GAME_HEIGHT;
            el.style.left = (r.left - hr.left + px * sx) + 'px'; el.style.top = (r.top - hr.top + (py - 33) * sy) + 'px';
            // the stick turns the ring: a flick left or right, then back to centre, moves one slot
            if (joystickState.active) { const jx = joystickState.x, s = jx > 0.55 ? 1 : jx < -0.55 ? -1 : 0; if (s && s !== POUCH.lastStick) pouchTurn(s); POUCH.lastStick = s; } else POUCH.lastStick = 0;
            requestAnimationFrame(pouchRingLoop);
        }


