        // ================= HELD ITEMS: separate art pinned to the hero's hand, moving with the walk, run and roll =================
        // Each item draws itself with its grip at (0, 0), pointing up, at S canvas px per game px. Parts drawn at alpha 1 glow
        // (flame, orb) and skip the scene lighting; parts at alpha 0.8 are lit like the hero.
        const itemAtlas = { img: new Image(), ready: false };
        itemAtlas.img.onload = () => { itemAtlas.ready = true; drawItemIcons(); };
        itemAtlas.img.src = document.getElementById('item-atlas').textContent.trim();
        const ITEM_FRAMES = { staff: [0, 0, 73, 310, 36, 192, 82] }; // x, y, w, h, gripX, gripY, bottom of the glowing orb + halo
        const HELD_ITEMS = {
            axe: { label: 'TIMBER AXE', len: 12, tilt: 0.18, lean: 0.08, light: 0, rest: 0.6,
                draw(c, S) {
                    const f = HERO_FRAMES.tool_axe, im = (heroHD.img && heroHD.img.complete) ? heroHD.img : heroAtlas2D;
                    if (!f || !im || !im.complete) return false;
                    const k = this.len * S / f[3], w = f[2] * k, h = f[3] * k; // the art has the head at the bottom: flip it, grip near the haft's end, head up
                    c.save(); c.scale(1, -1); c.imageSmoothingEnabled = true; c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h * 0.16, w, h); c.restore(); return true;
                } },
            sword: { label: 'SHORT SWORD', len: 14, tilt: 0.16, lean: 0.06, light: 0, rest: 0.45,
                draw(c, S) {
                    const f = HERO_FRAMES.rj_sword, im = (heroHD.img && heroHD.img.complete) ? heroHD.img : heroAtlas2D;
                    if (f && im && im.complete) { // the same blade he wears on his back, grip in the fist (grip sits 85% down the art)
                        const k = 11.5 * S / f[3], w = f[2] * k, h = f[3] * k; c.imageSmoothingEnabled = true;
                        c.drawImage(im, f[0], f[1], f[2], f[3], -w / 2, -h * 0.85, w, h); return true;
                    }
                    const r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x * S, y * S, w * S, h * S); };
                    r(-0.5, 0.2, 1, 2.6, '#5b3a22'); r(-0.8, 2.6, 1.6, 0.9, '#b45309');               // grip + pommel
                    r(-2.6, -0.6, 5.2, 0.9, '#b45309'); r(-0.4, -0.5, 0.8, 0.7, '#38bdf8');           // guard + stone
                    r(-0.75, -11.5, 1.5, 11, '#e2e8f0'); r(-0.15, -11.5, 0.3, 11, '#94a3b8');         // blade
                    c.fillStyle = '#e2e8f0'; c.beginPath(); c.moveTo(-0.75 * S, -11.5 * S); c.lineTo(0, -13 * S); c.lineTo(0.75 * S, -11.5 * S); c.fill(); return true;
                } },
            lens: { label: 'TRUTH LENS', len: 8, tilt: 0.1, lean: 0.04, light: 0, rest: -0.35,
                draw(c, S) {
                    c.fillStyle = '#5b3a22'; c.fillRect(-0.35 * S, -0.8 * S, 0.7 * S, 2.4 * S);
                    c.strokeStyle = '#94a3b8'; c.lineWidth = 0.55 * S; c.beginPath(); c.arc(0, -2.3 * S, 1.5 * S, 0, 7); c.stroke();
                    c.fillStyle = 'rgba(56,189,248,.5)'; c.fill(); c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(-0.8 * S, -3.1 * S, 0.5 * S, 0.5 * S); return true;
                } },
            rope: { label: 'LASSO ROPE', len: 6, tilt: 0.25, lean: 0.05, light: 0,
                draw(c, S) { // a coil hanging from the fist
                    c.lineWidth = 0.6 * S; c.strokeStyle = '#7c4f2c';
                    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, (1.6 + i * 0.35) * S, 1.5 * S, 1.15 * S, 0, 0, 7); c.stroke(); }
                    c.strokeStyle = '#c8a26b'; c.lineWidth = 0.3 * S; c.beginPath(); c.ellipse(0, 1.6 * S, 1.5 * S, 1.15 * S, 0, 3.4, 5.8); c.stroke(); return true;
                } },
            staff: { label: 'PRIESTESS STAFF', len: 24, tilt: 0.12, lean: 0.06, light: 44,
                draw(c, S) {
                    if (!itemAtlas.ready) return false;
                    const f = ITEM_FRAMES.staff, kk = this.len * S / f[3], x0 = -f[4] * kk, y0 = -f[5] * kk;
                    c.globalAlpha = 0.8; c.drawImage(itemAtlas.img, f[0], f[1], f[2], f[3], x0, y0, f[2] * kk, f[3] * kk);
                    c.globalAlpha = 1; c.drawImage(itemAtlas.img, f[0], f[1], f[2], f[6], x0, y0, f[2] * kk, f[6] * kk);
                    return true;
                } },
            torch: { label: 'DARKNESS TORCH', len: 10, tilt: 0.22, lean: 0.1, light: 52,
                draw(c, S, t) {
                    const e = (x, y, rx, ry, col) => { c.fillStyle = col; c.beginPath(); c.ellipse(x * S, y * S, rx * S, ry * S, 0, 0, 7); c.fill(); };
                    c.globalAlpha = 0.8;
                    c.fillStyle = '#5b3a22'; c.fillRect(-0.7 * S, -6.5 * S, 1.4 * S, 9.5 * S);           // handle
                    c.fillStyle = '#7c4f2c'; c.fillRect(-0.7 * S, -6.5 * S, 0.5 * S, 9.5 * S);           // lit edge
                    c.fillStyle = '#3f2a1e'; c.fillRect(-1.2 * S, -8.3 * S, 2.4 * S, 2.2 * S);           // wrapped head
                    c.fillStyle = '#8b5a2b'; c.fillRect(-1.2 * S, -7.5 * S, 2.4 * S, 0.45 * S);
                    c.globalAlpha = 1;
                    const fl = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08, wob = Math.sin(t * 9) * 0.35;
                    e(wob * 0.5, -10.2, 1.8, 2.9 * fl, '#f97316'); e(wob * 0.7, -10.0, 1.2, 2.1 * fl, '#fbbf24'); e(wob, -9.6, 0.6, 1.2 * fl, '#fef9c3');
                    return true;
                } }
        };
        // Where the grip sits, in the frame's local coords (x from the feet, y up negative). Per-frame data (HERO_HANDS) wins;
        // otherwise a per-view anchor, as a fraction of frame height, with the arm swinging through the stride.
        const HAND_VIEW = { right: [0.03, -0.32], down: [-0.12, -0.32], up: [0.14, -0.34] };
        function heroHandLocal(fr, f) {
            const h = f[3], ax = f[4], own = HERO_HANDS[fr.name];
            let x, y;
            const HV = (HERO_OUTFITS[heroHD.outfit] && HERO_OUTFITS[heroHD.outfit].hands) || HAND_VIEW, vk = String(fr.view);
            let leftDrawn = false;
            if (own) { x = own[0] - ax; y = own[1] - h; }
            else {
                const v = HV[vk.indexOf('down') === 0 ? 'down' : vk.indexOf('up') === 0 ? 'up' : 'right'];
                leftDrawn = vk.endsWith('left'); // a view drawn facing left: its front hand is on the other side
                const sw = fr.moving ? Math.sin(fr.p * Math.PI * 2) : 0, sideView = !(fr.view === 'down' || fr.view === 'up');
                x = (v[0] + (sideView ? sw * 0.07 : 0)) * h; y = (v[1] + (sideView ? -Math.abs(sw) * 0.015 : sw * 0.02)) * h;
            }
            return [(fr.flip !== leftDrawn) ? -x : x, y];
        }
        // A rigged swing with no swing frames: the hand travels an arc around the shoulder (wind-up behind the head, a fast
        // chop forward and down, a held follow-through, recover), the blade continues the line of the arm, and a slash trail
        // follows the strike. Angles: 0 = straight up, positive = toward the way he faces. Coordinates are frame px from the feet.
        const SWING_KEYS = [[0, Math.PI], [0.28, 2 * Math.PI - 0.55], [0.46, 2 * Math.PI + 2.35], [0.72, 2 * Math.PI + 2.5], [1, 3 * Math.PI]];
        function swingAngle(q) {
            q = Math.max(0, Math.min(1, q));
            for (let i = 1; i < SWING_KEYS.length; i++) { const [q1, a1] = SWING_KEYS[i], [q0, a0] = SWING_KEYS[i - 1]; if (q <= q1) {
                let u = (q - q0) / (q1 - q0);
                u = i === 1 ? Math.sin(u * Math.PI / 2) : i === 2 ? u * u * (1.6 - 0.6 * u) : i === 4 ? u * u * (3 - 2 * u) : u; // ease out of the wind-up, snap through the cut
                return a0 + (a1 - a0) * u; } }
            return 3 * Math.PI;
        }
        function swingPose(q, vk, sideV, sgn, h) {
            const front = vk.startsWith('down'), s = sideV ? sgn : front ? 1 : -1;            // facing the camera his sword arm is on screen-left; it sweeps left-high to right-low
            const ctr = sideV ? [0.03 * h * s, -0.66 * h] : [(front ? -0.06 : 0.06) * h, -0.64 * h], r = (sideV ? 0.27 : 0.25) * h, fx = sideV ? 1 : 0.85;
            const a = swingAngle(q), blend = Math.min(1, q / 0.1, (1 - q) / 0.2);           // the blade eases from its resting angle into the arm line and back
            const hand = [ctr[0] + s * r * Math.sin(a) * fx, ctr[1] - r * Math.cos(a)];
            const restAng = sideV ? -0.45 * s : 0, ang = restAng + (s * a - restAng) * Math.max(0, blend);
            const out = { hand, ang: ((ang + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI, ctr, r };
            if (q > 0.3 && q < 0.66) { const a0 = swingAngle(Math.max(0.28, q - 0.13)); out.trail = [s * a0, s * a]; out.trailA = q < 0.5 ? 1 : 1 - (q - 0.5) / 0.16; }
            return out;
        }
        function drawItemIcons() { // menu slot icon for the staff
            ['sword', 'rope'].forEach(it => { const cv = document.getElementById(it + '-icon'); if (!cv || cv.dataset.done) return; const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = true; c.drawImage(pouchIcon(it, 40), -10, -8, 40, 40); cv.dataset.done = '1'; });
            const cv = document.getElementById('staff-icon'); if (!cv || !itemAtlas.ready) return;
            const c = cv.getContext('2d'), f = ITEM_FRAMES.staff, kk = cv.height / f[3];
            c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = true;
            c.drawImage(itemAtlas.img, f[0], f[1], f[2], f[3], (cv.width - f[2] * kk) / 2, 0, f[2] * kk, cv.height);
        }

