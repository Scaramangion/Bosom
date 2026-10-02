        // ================= TITLE: a live night scene. Fog, ash, a bleeding moon, ruins on the horizon, lightning, and something standing out there =================
        const TITLE = { on: false, t0: 0, last: 0, nextBolt: 0, flash: 0, bolt: null, shade: 0, fog: null, grain: null, sil: null, ash: [] };
        function titleBuild() {
            const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
            let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
            TITLE.fog = mk(640, 150); const f = TITLE.fog.getContext('2d');
            for (let i = 0; i < 90; i++) { const x = rnd() * 640, y = 30 + rnd() * 100, r = 20 + rnd() * 55, g = f.createRadialGradient(x, y, 0, x, y, r);
                g.addColorStop(0, 'rgba(120,110,135,.13)'); g.addColorStop(1, 'rgba(120,110,135,0)'); f.fillStyle = g; f.fillRect(x - r, y - r, r * 2, r * 2);
                if (x < 60) { f.fillStyle = g; f.save(); f.translate(640, 0); f.fillRect(x - r, y - r, r * 2, r * 2); f.restore(); } }
            TITLE.grain = mk(160, 144); const gc = TITLE.grain.getContext('2d'), id = gc.createImageData(160, 144);
            for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 22; } gc.putImageData(id, 0, 0);
            TITLE.ash = Array.from({ length: 70 }, () => ({ x: rnd() * 320, y: rnd() * 288, v: 4 + rnd() * 9, w: rnd() * 6.28, s: rnd() < 0.2 ? 2 : 1 }));
        }
        function titleSilhouettes() { // the ruins, cut out in black from the temple art, built once the art has decoded
            if (TITLE.sil || !worldArt.ready) return;
            const c = document.createElement('canvas'); c.width = 320; c.height = 120; const x = c.getContext('2d');
            const put = (n, px, k, ax, ay) => drawWorldFrame(x, n, px, 118, k, ax, ay);
            put('t_pillar_stump', 22, 0.55, 18, 56); put('t_pillar_tall_carved', 58, 0.72, 19, 108); put('t_arch_open', 112, 0.62, 43, 103); put('t_obelisk', 168, 0.55, 18, 90);
            put('t_pillar_tall_vine', 250, 0.8, 18, 109); put('t_pillar_block', 286, 0.6, 18, 51); put('t_pillar_diamond', 212, 0.5, 19, 80);
            x.globalCompositeOperation = 'source-in'; x.fillStyle = '#05030a'; x.fillRect(0, 0, 320, 120);
            TITLE.sil = c;
        }
        function titleStart() { if (TITLE.on) return; if (!TITLE.fog) titleBuild(); TITLE.on = true; TITLE.t0 = TITLE.last = performance.now(); TITLE.nextBolt = TITLE.t0 + 4200; TITLE.shade = 0; requestAnimationFrame(titleFrame); }
        function titleStop() { TITLE.on = false; }
        function titleFrame(now) {
            if (!TITLE.on) return; requestAnimationFrame(titleFrame);
            const cv = document.getElementById('title-canvas'); if (!cv) return; const c = cv.getContext('2d'), W = 320, H = 288;
            const t = (now - TITLE.t0) / 1000, dt = Math.min(0.1, (now - TITLE.last) / 1000); TITLE.last = now; titleSilhouettes();
            if (now > TITLE.nextBolt) { // lightning: a jagged stroke, a white-out, and thunder a beat later
                TITLE.flash = 1; TITLE.nextBolt = now + 7000 + Math.random() * 7000; TITLE.shade = Math.min(5, TITLE.shade + 1);
                const pts = [[60 + Math.random() * 200, 0]]; while (pts[pts.length - 1][1] < 200) { const p = pts[pts.length - 1]; pts.push([p[0] + (Math.random() - 0.5) * 34, p[1] + 12 + Math.random() * 22]); } TITLE.bolt = pts;
                try { const sc = audio.titleScore; if (sc) sc.thunder(0.45 + Math.random() * 0.5); } catch (e) {}
            }
            TITLE.flash = Math.max(0, TITLE.flash - dt * 2.6);
            const fl = TITLE.flash > 0.55 ? 1 : TITLE.flash > 0.4 ? 0.2 : TITLE.flash > 0.25 ? 0.8 : TITLE.flash; // the double flicker of real lightning
            document.getElementById('title-screen').classList.toggle('lit', fl > 0.6);
            c.save(); const push = 1 + 0.035 * Math.sin(t / 18); c.translate(W / 2, H * 0.62); c.scale(push, push); c.translate(-W / 2, -H * 0.62);
            const sky = c.createLinearGradient(0, 0, 0, 210); sky.addColorStop(0, '#020208'); sky.addColorStop(0.55, '#0b0714'); sky.addColorStop(1, '#261018'); c.fillStyle = sky; c.fillRect(-20, -20, W + 40, 240);
            for (let i = 0; i < 40; i++) { const sx = (i * 97) % W, sy = (i * 53) % 150; if ((i * 7 + Math.floor(t * 1.3)) % 11) { c.fillStyle = `rgba(200,200,220,${0.15 + (i % 4) * 0.08})`; c.fillRect(sx, sy, 1, 1); } }
            const mx = 252, my = 132, mr = 24, halo = c.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 3.2); // the moon, faintly bloodied
            halo.addColorStop(0, 'rgba(150,40,40,.28)'); halo.addColorStop(1, 'rgba(150,40,40,0)'); c.fillStyle = halo; c.fillRect(mx - 110, my - 110, 220, 220);
            const mg = c.createRadialGradient(mx - 8, my - 9, 4, mx, my, mr); mg.addColorStop(0, '#efe6d2'); mg.addColorStop(0.7, '#c9b7a0'); mg.addColorStop(1, '#8c6f62'); c.fillStyle = mg; c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fill();
            c.fillStyle = 'rgba(90,60,60,.25)'; [[-9, -6, 6], [8, 5, 8], [-4, 12, 4], [12, -10, 3]].forEach(([dx, dy, r]) => { c.beginPath(); c.arc(mx + dx, my + dy, r, 0, 7); c.fill(); });
            const fx = (t * 6) % 640; c.globalAlpha = 0.6; c.drawImage(TITLE.fog, -fx, 60); c.drawImage(TITLE.fog, 640 - fx, 60); c.globalAlpha = 1; // high cloud over the moon
            if (TITLE.bolt && TITLE.flash > 0.3) { c.strokeStyle = `rgba(235,240,255,${TITLE.flash})`; c.lineWidth = 1.5; c.beginPath(); TITLE.bolt.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }
            const hz = c.createLinearGradient(0, 150, 0, 215); hz.addColorStop(0, 'rgba(120,20,30,0)'); hz.addColorStop(1, `rgba(120,20,30,${0.22 + 0.08 * Math.sin(t * 0.7)})`); c.fillStyle = hz; c.fillRect(-20, 150, W + 40, 65);
            if (TITLE.sil) c.drawImage(TITLE.sil, 0, 100);
            // the thing among the ruins: barely there, a little nearer after every flash
            const bk = 0.36 + TITLE.shade * 0.045, bx = 147 + Math.sin(t * 0.3) * 1.5, by = 218 + TITLE.shade * 4;
            c.globalAlpha = 0.45 + fl * 0.55; drawWorldFrame(c, 'boxelder', bx, by, bk, 19, 63); c.globalAlpha = 1;
            const eg = 0.55 + 0.45 * Math.sin(t * 1.7), ey = Math.round(by - 54 * bk); c.fillStyle = `rgba(255,40,30,${0.45 + eg * 0.55})`;
            c.fillRect(Math.round(bx - 6 * bk), ey, 1, 1); c.fillRect(Math.round(bx - 1 * bk), ey, 1, 1);
            const eyG = c.createRadialGradient(bx - 3.5 * bk, ey, 0, bx - 3.5 * bk, ey, 5); eyG.addColorStop(0, `rgba(255,30,20,${0.25 * eg})`); eyG.addColorStop(1, 'rgba(255,30,20,0)'); c.fillStyle = eyG; c.fillRect(bx - 10, ey - 6, 14, 12);
            const gr = c.createLinearGradient(0, 212, 0, H); gr.addColorStop(0, '#07040b'); gr.addColorStop(1, '#000'); c.fillStyle = gr; c.fillRect(-20, 217, W + 40, 90);
            const f2 = (t * 13) % 640; c.globalAlpha = 0.55; c.drawImage(TITLE.fog, -f2, 150); c.drawImage(TITLE.fog, 640 - f2, 150); // ground fog, rolling
            const f3 = (t * 21) % 640; c.globalAlpha = 0.45; c.drawImage(TITLE.fog, -f3, 190, 640, 110); c.drawImage(TITLE.fog, 640 - f3, 190, 640, 110); c.globalAlpha = 1;
            c.fillStyle = 'rgba(200,190,190,.5)'; TITLE.ash.forEach(a => { a.y += a.v * dt; a.x += Math.sin(t * 0.8 + a.w) * 6 * dt - 3 * dt; if (a.y > H) { a.y = -4; a.x = Math.random() * W; } if (a.x < -4) a.x = W; c.fillRect(Math.round(a.x), Math.round(a.y), a.s, a.s); });
            c.restore();
            if (fl > 0) { c.fillStyle = `rgba(225,232,255,${fl * 0.55})`; c.fillRect(0, 0, W, H); }
            const vg = c.createRadialGradient(W / 2, H * 0.45, 60, W / 2, H * 0.5, 230); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
            c.globalAlpha = 0.5; c.drawImage(TITLE.grain, Math.floor(Math.random() * -40), Math.floor(Math.random() * -40), 400, 360); c.globalAlpha = 1;
            if (t < 2.5) { c.fillStyle = `rgba(0,0,0,${1 - t / 2.5})`; c.fillRect(0, 0, W, H); } // rise out of black
        }

