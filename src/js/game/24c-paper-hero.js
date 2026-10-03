        // ================= PAPER HERO: a rigged Papercraft .glb, played inside the paper pass =================
        // A Papercraft export is one node per body part (torso, head, arms, legs, forearms, shins), each at its pivot, with looping clips
        // (Idle, Walk, Wave, Jump, Swing). This reads that .glb straight from the page, poses it every frame, and hands the triangles to the
        // paper shader, so he stands in the folded town as real geometry instead of a flat card. Swap the .glb and the hero changes.
        const PAPER_HERO = {
            on: true, ready: false, nodes: [], parts: [], clips: {}, img: null, buf: null, tex: null, out: null,
            H: 25,                    // his height in world px (the sprite hero is HERO_TARGET_H = 23; the town is stretched a little, so a touch taller)
            yaw: 0, clip: 'Idle', t: 0, last: 0, blend: 1, lastClip: 'Idle', verts: 0
        };
        function paperHeroLoad() {
            const el = document.getElementById('paper-hero'); if (!el || PAPER_HERO.nodes.length) return;
            try {
                const s = atob(el.textContent.trim().split(',')[1]), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
                const dv = new DataView(b.buffer), jl = dv.getUint32(12, true), J = JSON.parse(new TextDecoder().decode(b.subarray(20, 20 + jl))), bo = 20 + jl + 8;
                const acc = i => { const a = J.accessors[i], v = J.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] * a.count, o = bo + (v.byteOffset || 0) + (a.byteOffset || 0); return new Float32Array(b.buffer.slice(o, o + n * 4)); };
                PAPER_HERO.nodes = J.nodes.map((n, i) => ({ name: n.name, mesh: n.mesh, t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], kids: n.children || [], parent: -1 }));
                PAPER_HERO.nodes.forEach((n, i) => n.kids.forEach(k => PAPER_HERO.nodes[k].parent = i));
                PAPER_HERO.parts = J.meshes.map(m => { const p = m.primitives[0].attributes; return { pos: acc(p.POSITION), uv: acc(p.TEXCOORD_0), col: p.COLOR_0 != null ? acc(p.COLOR_0) : null }; });
                (J.animations || []).forEach(a => { const ch = a.channels.map(c => { const sm = a.samplers[c.sampler]; return { node: c.target.node, path: c.target.path, t: acc(sm.input), v: acc(sm.output) }; }); PAPER_HERO.clips[a.name] = { len: ch.reduce((m, c) => Math.max(m, c.t[c.t.length - 1]), 0), ch }; });
                PAPER_HERO.total = PAPER_HERO.nodes.reduce((m, n) => m + (n.mesh != null ? PAPER_HERO.parts[n.mesh].pos.length / 3 : 0), 0);
                                const im = J.images && J.images[0], v = im && J.bufferViews[im.bufferView];
                if (v) { PAPER_HERO.img = new Image(); PAPER_HERO.img.onload = () => { PAPER_HERO.ready = true; }; PAPER_HERO.img.src = URL.createObjectURL(new Blob([b.subarray(bo + (v.byteOffset || 0), bo + (v.byteOffset || 0) + v.byteLength)], { type: im.mimeType })); }
                { const ai = PAPER_HERO.nodes.findIndex(n => n.name === 'armL'), am = ai >= 0 ? PAPER_HERO.parts[PAPER_HERO.nodes[ai].mesh] : null; // a T-pose export (arms reach out sideways) gets its arms lowered while he stands
                  if (am) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < am.pos.length; i += 3) { x0 = Math.min(x0, am.pos[i]); x1 = Math.max(x1, am.pos[i]); y0 = Math.min(y0, am.pos[i + 1]); y1 = Math.max(y1, am.pos[i + 1]); } PAPER_HERO.tpose = x1 - x0 > y1 - y0; } }
                { const N = PAPER_HERO.nodes, at = i => i < 0 ? [0, 0, 0] : at(N[i].parent).map((v, k) => v + N[i].t[k]); let y0 = 1e9, y1 = -1e9; // rest-pose height, so every export stands PAPER_HERO.H px tall, feet on the ground
                  N.forEach((n, i) => { if (n.mesh == null) return; const o = at(i), p = PAPER_HERO.parts[n.mesh].pos; for (let j = 1; j < p.length; j += 3) { y0 = Math.min(y0, o[1] + p[j]); y1 = Math.max(y1, o[1] + p[j]); } });
                  PAPER_HERO.y0 = y0 < 1e9 ? y0 : 0; PAPER_HERO.h = y1 > y0 ? y1 - y0 : 1; }
                PAPER_HERO.out = new Float32Array(PAPER_HERO.total * 7);
            } catch (e) { console.warn('paper hero disabled:', e); PAPER_HERO.on = false; }
        }
        function paperHeroSample(clip, t, node, path, out) { // a clip's value for one node and channel at time t (looping, linear; rotations slerp-free nlerp)
            const c = clip && clip.ch.find(k => k.node === node && k.path === path); if (!c) return false;
            const n = c.t.length, w = path === 'rotation' ? 4 : 3, tt = clip.len ? t % clip.len : 0; let i = 0; while (i < n - 2 && c.t[i + 1] <= tt) i++;
            const f = Math.min(1, Math.max(0, (tt - c.t[i]) / Math.max(1e-6, c.t[i + 1] - c.t[i]))), j = Math.min(n - 1, i + 1);
            for (let k = 0; k < w; k++) out[k] = c.v[i * w + k] + (c.v[j * w + k] - c.v[i * w + k]) * f;
            if (w === 4) { const l = Math.hypot(out[0], out[1], out[2], out[3]) || 1; for (let k = 0; k < 4; k++) out[k] /= l; }
            return true;
        }
        function paperHeroTurn(ph) { // a flat figure seen edge-on is a sliver, so side views turn only 3/4 toward the side (like a paper doll); facing away is a full turn
            const a = Math.abs(ph), h = Math.PI / 2, k = 0.55, e = h * k; return (ph < 0 ? -1 : 1) * (a <= h ? a * k : e + (a - h) * (Math.PI - e) / h);
        }
        function paperHeroPose() { // the world: x east, y south, z up (px). Returns the vertex array for this frame
            const P = PAPER_HERO, now = performance.now(), dt = Math.min(0.1, (now - (P.last || now)) / 1000); P.last = now;
            const moving = player.isMoving, running = !!player.isRunning;
            const want = jumpTimer > 0 && P.clips.Jump ? 'Jump' : actionTimer > 0 && P.clips.Swing && (equippedItem === 'sword' || equippedItem === 'axe') ? 'Swing' : moving ? 'Walk' : 'Idle';
            if (want !== P.clip) { P.lastClip = P.clip; P.clip = want; P.blend = 0; P.t = 0; }
            P.t += dt * (want === 'Walk' && running ? 1.6 : 1); P.blend = Math.min(1, P.blend + dt * 8);
            const v = DIR8_VEC[player.face8 || player.dir || 'down'] || [0, 1], tw = Math.atan2(v[0], v[1]), yw = camYaw(); // world heading: 0 = facing south (+y)
            let ph = Math.atan2(Math.sin(tw + yw), Math.cos(tw + yw)); // relative to the lens: 0 faces it, +-90 deg is side-on, 180 faces away
            const target = -yw + paperHeroTurn(ph);
            let dy = target - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * Math.min(1, dt * 14);
            const F = [Math.sin(P.yaw), Math.cos(P.yaw)], R = [F[1], -F[0]], S = P.H / (P.h || 1), ox = player.pixelX + 8, oy = player.pixelY + 15;
            const M = new Array(P.nodes.length), tr = [0, 0, 0];
            const mul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
            const clip = P.clips[P.clip], prev = P.clips[P.lastClip], q = [0, 0, 0, 1], q2 = [0, 0, 0, 1], t2 = [0, 0, 0];
            P.nodes.forEach((n, i) => {
                let r = n.r, t = n.t;
                if (paperHeroSample(clip, P.t, i, 'rotation', q)) { r = q.slice(); if (P.blend < 1 && paperHeroSample(prev, P.t, i, 'rotation', q2)) { for (let k = 0; k < 4; k++) r[k] = q2[k] + (r[k] - q2[k]) * P.blend; } }
                if (paperHeroSample(clip, P.t, i, 'translation', tr)) { t = tr.slice(); if (P.blend < 1 && paperHeroSample(prev, P.t, i, 'translation', t2)) { for (let k = 0; k < 3; k++) t[k] = t2[k] + (t[k] - t2[k]) * P.blend; } }
                if (P.tpose && P.clip === 'Idle' && /^(arm|fore)[LR]$/.test(n.name) && P.clips.Walk && paperHeroSample(P.clips.Walk, 0, i, 'rotation', q)) r = q.slice(); // the export rests in a T-pose: let the arms hang (the Walk clip's first frame) while he stands
                const l = Math.hypot(r[0], r[1], r[2], r[3]) || 1, x = r[0] / l, y = r[1] / l, z = r[2] / l, w = r[3] / l;
                const L = new Float32Array([1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0, 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0, 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, t[0], t[1], t[2], 1]);
                M[i] = n.parent < 0 ? L : mul(M[n.parent], L);
            });
            const o = P.out; let k = 0;
            P.nodes.forEach((n, i) => {
                if (n.mesh == null) return; const m = M[i], pt = P.parts[n.mesh], pos = pt.pos, uv = pt.uv, col = pt.col;
                for (let j = 0; j < pos.length / 3; j++) {
                    const x = pos[j * 3], y = pos[j * 3 + 1], z = pos[j * 3 + 2];
                    const gx = m[0] * x + m[4] * y + m[8] * z + m[12], gy = m[1] * x + m[5] * y + m[9] * z + m[13], gz = m[2] * x + m[6] * y + m[10] * z + m[14]; // model space: x right, y up, z front
                    o[k++] = ox + (R[0] * gx + F[0] * gz) * S; o[k++] = oy + (R[1] * gx + F[1] * gz) * S; o[k++] = (gy - (P.y0 || 0)) * S;
                    o[k++] = uv[j * 2]; o[k++] = uv[j * 2 + 1]; o[k++] = col ? Math.min(1.1, col[j * 3]) : 1; o[k++] = 0;
                }
            });
            P.verts = k / 7; return o;
        }
        // is the paper hero standing in for the sprite right now? (the horse, the pouch and the roll still use the flat hero)
        function paperHeroLive() { return PAPER_HERO.on && PAPER_HERO.ready && paperLive() && !HORSE.mounted && !POUCH.state && !(rollAnim > 0) && !!player; }
        paperHeroLoad();
