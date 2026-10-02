        // ================= PAPERCRAFT: Brennan's Theme folded up into real 3D =================
        // Flat pictures, folded. Every piece of the town is one painted cell on a single sheet (a wall with a window, a door, a run of roof
        // tiles, a fence panel, a tree line). The code folds those cells along the tile map, which stays the blueprint: every solid block
        // becomes a row of houses, every fence tile a fence, every lamp tile a lamp. To reskin, replace a cell on the sheet; the folding stays.
        const PAPER = {
            on: true, mesh: null, sheet: null, HT: null,
            PRIME: 113,                          // the master prime: the deterministic identity of this paper town (change it and the whole town reshuffles)
            GRID: { X: 3, Y: 13, U: 3 },         // sheet pixels per world unit (U)
            TILE: { X: 16, Y: 6 },
            SIZE: { X: 3 * 16, Y: 13 * 6 },      // one painted cell: 48 x 78 sheet pixels
            HEIGHT: { STORY: 2 * 13,             // 26: a storey as painted on the sheet
                      FLOOR: 2 * 17,             // 34: a storey as built (the painted cell is stretched to it, so the town stands tall)
                      TREE: 4 * 14,              // 56: the tree line
                      FENCE: 13 },
            n: 0,                                // procedural counter (paperInt / paperChoose without an explicit n)
            verts: 0                             // vertices in the folded mesh
        };
        // deterministic prime-based numbers: same PRIME + same n = same result every time
        function paperPrime(n = 0) { const x = Math.sin((PAPER.PRIME + n) * PAPER.PRIME) * 43758.5453123; return x - Math.floor(x); }
        function paperInt(min, max, n = PAPER.n++) { return Math.floor(paperPrime(n) * (max - min + 1)) + min; }
        function paperChoose(array, n = PAPER.n++) { if (!array.length) return null; return array[Math.floor(paperPrime(n) * array.length)]; }
        const PAPER_X = PAPER.SIZE.X, PAPER_Y = PAPER.SIZE.Y, PAPER_STORY = PAPER.HEIGHT.STORY, PAPER_TREE = PAPER.HEIGHT.TREE, PAPER_FENCE = PAPER.HEIGHT.FENCE;
        // the pieces, by name -> [column, row] on the sheet. Materials 0-6 are rows 0-6 with these columns:
        const PAPER_CELLS = { gPlain: 0, gWindow: 1, gDoor: 2, uPlain: 3, uWindow: 4, uFlowers: 5, gShop: 6, roofs: 7,
            treeA: [0, 8], treeB: [1, 8], fence: [2, 8], iron: [3, 8], lantern: [4, 8], stone: [5, 8], planter: [6, 8], bush: [7, 8], sign: [8, 8], wood: [9, 8], chimney: [10, 8], crown: [11, 8], water: [12, 8], awningRed: [13, 8], goods: [14, 8], awningGreen: [15, 8] };
        // pieces cut from the painted asset sheet (timber walls, doors, windows, two roofs): material 9 on row 9, roofs 5 and 6 on the roof row. Used sparingly.
        const PAPER_PIECES = new Image(); { const el = document.getElementById('paper-pieces'); if (el) PAPER_PIECES.src = el.textContent.trim(); }
        function paperPiecesReady() { return PAPER_PIECES.complete && PAPER_PIECES.naturalWidth > 0; }
        // ---- the cottage from the opening film, folded from its orthographic sheet: five painted faces plus roofs, wings and a shed ----
        const COTTAGE_IMG = new Image(); { const el = document.getElementById('cottage-tex'); if (el) COTTAGE_IMG.src = el.textContent.trim(); }
        function cottageReady() { return COTTAGE_IMG.complete && COTTAGE_IMG.naturalWidth > 0; }
        const COTTAGE_TEX = { FC: [0, 780, 143, 224], FWL: [146, 780, 92, 90], FWR: [240, 780, 92, 90], BC: [336, 780, 144, 219], BWL: [484, 780, 78, 80], BWR: [566, 780, 78, 80], ROOF: [648, 780, 120, 156], SHEDROOF: [772, 780, 96, 96], SHEDFRAME: [872, 780, 150, 103], CHIM: [572, 866, 33, 53], WIN: [610, 866, 44, 48], PLASTER: [660, 940, 64, 64], WOOD: [730, 940, 64, 40], STONE: [800, 940, 80, 24] }; // the strip made by tools/make_cottage_tex.py
        const COTTAGE = { X0: 23.5 * 16, YF: 18 * 16, DEPTH: 66, WALL: 46.95, APEX: 67.05 }; // door centre x, the front wall plane (south edge of tile row 17), the main block's depth and heights (world units)
        function paperCottage(V) { // appends the cottage's triangles to the folded mesh. local x: east of the door; d: north of the front wall; z: up
            const C = COTTAGE, X0 = C.X0, YF = C.YF, W = 21.45, WW = 49.05, WD = 58, WZ = 27, SH = { S: 1.0, W: 0.9, E: 0.8, N: 0.7 };
            const P = (lx, d, z) => [X0 + lx, YF - d, z];
            const emit = (pts, uv, shade, mirror) => { if (mirror) { pts = pts.slice().reverse(); uv = uv.slice().reverse(); }
                for (const i of pts.length === 4 ? [0, 1, 2, 0, 2, 3] : pts.length === 5 ? [0, 1, 2, 0, 2, 3, 0, 3, 4] : [0, 1, 2]) V.push(pts[i][0], pts[i][1], pts[i][2], uv[i][0] / 1024, uv[i][1] / 1024, shade, 0); };
            const T = COTTAGE_TEX;
            const rect = (a, b, c, d, r, sh, m, sub) => { const x0 = r[0] + (sub ? sub[0] : 0), y0 = r[1] + (sub ? sub[1] : 0), x1 = x0 + (sub ? sub[2] : r[2]), y1 = y0 + (sub ? sub[3] : r[3]); emit([a, b, c, d], [[x0, y1], [x1, y1], [x1, y0], [x0, y0]], sh, m); }; // BL, BR, TR, TL painted with a rect (or part of one)
            // the main block: front and back gables, plastered sides
            const fp = (d, tex, sh, back) => { const pts = back ? [P(W, d, 0), P(-W, d, 0), P(-W, d, C.WALL), P(0, d, C.APEX), P(W, d, C.WALL)] : [P(-W, d, 0), P(W, d, 0), P(W, d, C.WALL), P(0, d, C.APEX), P(-W, d, C.WALL)];
                const r = tex, bw = r[2], by = back ? 214 : 223.5, wt = back ? 74 : 67, ap = back ? 2 : 0, u = [[0, by], [bw, by], [bw, wt], [bw / 2, ap], [0, wt]].map(q => [r[0] + q[0], r[1] + q[1]]); emit(pts, u, sh); };
            fp(0, T.FC, SH.S, false); fp(C.DEPTH, T.BC, SH.N, true);
            rect(P(W, 0, 0), P(W, C.DEPTH, 0), P(W, C.DEPTH, C.WALL), P(W, 0, C.WALL), T.PLASTER, SH.E, false); rect(P(-W, C.DEPTH, 0), P(-W, 0, 0), P(-W, 0, C.WALL), P(-W, C.DEPTH, C.WALL), T.PLASTER, SH.W, false);
            const ov = 2.5, ex = W + ov, ez = C.WALL - ov * (C.APEX - C.WALL) / W, R = T.ROOF; // roof: two slopes, the slate cut from the plan view
            emit([P(ex, -ov, ez), P(ex, C.DEPTH + ov, ez), P(0, C.DEPTH + ov, C.APEX), P(0, -ov, C.APEX)], [[R[0] + 120, R[1] + 156], [R[0] + 120, R[1]], [R[0] + 60, R[1]], [R[0] + 60, R[1] + 156]], 0.86);
            emit([P(-ex, C.DEPTH + ov, ez), P(-ex, -ov, ez), P(0, -ov, C.APEX), P(0, C.DEPTH + ov, C.APEX)], [[R[0], R[1]], [R[0], R[1] + 156], [R[0] + 60, R[1] + 156], [R[0] + 60, R[1]]], 1.0);
            // the two wings: plastered, stone-footed, with a hipped roof leaning on the main block
            for (const sg of [-1, 1]) { const X = a => sg * a, fw = sg < 0 ? T.FWL : T.FWR, bw = sg < 0 ? T.BWL : T.BWR;
                emit([P(sg < 0 ? -WW : W, 0, 0), P(sg < 0 ? -W : WW, 0, 0), P(sg < 0 ? -W : WW, 0, WZ), P(sg < 0 ? -WW : W, 0, WZ)], [[fw[0], fw[1] + 90], [fw[0] + 92, fw[1] + 90], [fw[0] + 92, fw[1]], [fw[0], fw[1]]], SH.S);                 // front wall
                emit([P(sg < 0 ? -W : WW, WD, 0), P(sg < 0 ? -WW : W, WD, 0), P(sg < 0 ? -WW : W, WD, WZ), P(sg < 0 ? -W : WW, WD, WZ)], [[bw[0], bw[1] + 80], [bw[0] + 78, bw[1] + 80], [bw[0] + 78, bw[1]], [bw[0], bw[1]]], SH.N);   // back wall
                const o = X(WW), pl = T.PLASTER, st = T.STONE; // the outer side wall: plaster over a stone foot
                emit(sg < 0 ? [P(o, WD, 0), P(o, 0, 0), P(o, 0, 4), P(o, WD, 4)] : [P(o, 0, 0), P(o, WD, 0), P(o, WD, 4), P(o, 0, 4)], [[st[0], st[1] + 24], [st[0] + 80, st[1] + 24], [st[0] + 80, st[1]], [st[0], st[1]]], sg < 0 ? SH.W : SH.E);
                emit(sg < 0 ? [P(o, WD, 4), P(o, 0, 4), P(o, 0, WZ), P(o, WD, WZ)] : [P(o, 0, 4), P(o, WD, 4), P(o, WD, WZ), P(o, 0, WZ)], [[pl[0], pl[1] + 64], [pl[0] + 64, pl[1] + 64], [pl[0] + 64, pl[1]], [pl[0], pl[1]]], sg < 0 ? SH.W : SH.E);
                const e = WW + ov, ez2 = WZ - ov * 15 / (WW - W), ro = T.ROOF, uvq = [[ro[0] + 120, ro[1] + 156], [ro[0] + 120, ro[1]], [ro[0], ro[1]], [ro[0], ro[1] + 156]], uvt = [[ro[0] + 120, ro[1] + 156], [ro[0] + 120, ro[1]], [ro[0], ro[1] + 78]];
                const A = P(X(e), -ov, ez2), B = P(X(e), WD + ov, ez2), Cc = P(X(W), 50, WZ + 15), D = P(X(W), 8, WZ + 15); // outer slope, then the front and back hips
                emit(sg < 0 ? [B, A, D, Cc] : [A, B, Cc, D], sg < 0 ? uvq : uvq, sg < 0 ? 1.0 : 0.86);
                emit(sg < 0 ? [A, P(X(W), -ov, ez2), D] : [P(X(W), -ov, ez2), A, D], uvt, SH.S * 1.02);
                emit(sg < 0 ? [P(X(W), WD + ov, ez2), B, Cc] : [B, P(X(W), WD + ov, ez2), Cc], uvt, SH.N * 1.1); }
            // the shed on the east: open to the south, timber frame, brown shingle
            const S0 = WW, S1 = WW + 39, D0 = 24, D1 = 64, SZ = 18.9, SA = 30.9, F = T.SHEDFRAME, SR = T.SHEDROOF;
            emit([P(S0, D0, 0), P(S1, D0, 0), P(S1, D0, SZ), P(S0, D0, SZ)], [[F[0], F[1] + 103], [F[0] + 150, F[1] + 103], [F[0] + 150, F[1] + 40], [F[0], F[1] + 40]], SH.S);
            emit([P(S1, D0, 0), P(S1, D1, 0), P(S1, D1, SZ), P(S1, (D0 + D1) / 2, SA), P(S1, D0, SZ)], [[F[0], F[1] + 103], [F[0] + 150, F[1] + 103], [F[0] + 150, F[1] + 40], [F[0] + 75, F[1]], [F[0], F[1] + 40]], SH.E);
            rect(P(S1, D1, 0), P(S0, D1, 0), P(S0, D1, SZ), P(S1, D1, SZ), T.WOOD, SH.N, false);
            const sm = (D1 - D0) / 2 + D0, sz = SZ - 2;
            emit([P(S0 - 1, D0 - 3, sz), P(S1 + 2, D0 - 3, sz), P(S1 + 2, sm, SA), P(S0 - 1, sm, SA)], [[SR[0], SR[1] + 96], [SR[0] + 96, SR[1] + 96], [SR[0] + 96, SR[1]], [SR[0], SR[1]]], 1.05);
            emit([P(S1 + 2, D1 + 3, sz), P(S0 - 1, D1 + 3, sz), P(S0 - 1, sm, SA), P(S1 + 2, sm, SA)], [[SR[0], SR[1] + 96], [SR[0] + 96, SR[1] + 96], [SR[0] + 96, SR[1]], [SR[0], SR[1]]], 0.72);
            // the chimney, standing through the back of the ridge
            const cm = T.CHIM, cx0 = -3, cx1 = 3, cd0 = 46, cd1 = 52, cz0 = 60, cz1 = 80, cuv = [[cm[0], cm[1] + 53], [cm[0] + 33, cm[1] + 53], [cm[0] + 33, cm[1]], [cm[0], cm[1]]];
            emit([P(cx0, cd0, cz0), P(cx1, cd0, cz0), P(cx1, cd0, cz1), P(cx0, cd0, cz1)], cuv, SH.S); emit([P(cx1, cd0, cz0), P(cx1, cd1, cz0), P(cx1, cd1, cz1), P(cx1, cd0, cz1)], cuv, SH.E);
            emit([P(cx1, cd1, cz0), P(cx0, cd1, cz0), P(cx0, cd1, cz1), P(cx1, cd1, cz1)], cuv, SH.N); emit([P(cx0, cd1, cz0), P(cx0, cd0, cz0), P(cx0, cd0, cz1), P(cx0, cd1, cz1)], cuv, SH.W);
            emit([P(cx0, cd1, cz1), P(cx1, cd1, cz1), P(cx1, cd0, cz1), P(cx0, cd0, cz1)], [[cm[0] + 2, cm[1] + 2], [cm[0] + 30, cm[1] + 2], [cm[0] + 30, cm[1] + 8], [cm[0] + 2, cm[1] + 8]], 1.1);
        }
        function paperLive() { return PAPER.on && FX_GL.ok && currentMapName === 'overworld' && COMBAT.amt > 0.97 && (gameState === 'PLAYING' || gameState === 'INVENTORY'); }
        function paperSheet() {
            if (PAPER.sheet) return PAPER.sheet;
            const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
            const U = PAPER.GRID.U, CW = PAPER_X, CH = PAPER_Y, KEY = '#00ffff';
            let R = rngOf(4242);
            const cell = (c, r, paint) => { g.save(); g.translate(c * CW, r * CH); g.beginPath(); g.rect(0, 0, CW, CH); g.clip(); R = rngOf(c * 131 + r * 977 + 7); paint(); g.restore(); };
            // inside a cell, in world units: x 0..16 left to right, y 0..26 from the ground UP. Snapped to whole pixels (no soft edges: the glass key stays exact)
            const box = (x, y, w, h, col) => { const x0 = Math.round(x * U), x1 = Math.round((x + w) * U), y0 = Math.round(CH - (y + h) * U), y1 = Math.round(CH - y * U); if (x1 <= x0 || y1 <= y0) return; g.fillStyle = col; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
            const speck = (n, cols, y0 = 0, y1 = 26) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(R() * cols.length) | 0]; g.fillRect((R() * 16 * U) | 0, (CH - (y0 + R() * (y1 - y0)) * U) | 0, R() < 0.3 ? 2 : 1, 1); } };
            const MATS = PAPER.MATS = [
                { wall: '#e4d6b8', hi: '#efe4cc', lo: '#c9b590', trim: '#4a3426', base: '#8b8378', shut: '#3f5e3a', kind: 'timber' },
                { wall: '#ece5d6', hi: '#f6f1e6', lo: '#d2c7b1', trim: '#9e9282', base: '#8f897f', shut: '#3d5a7a', kind: 'plaster' },
                { wall: '#9a4a33', hi: '#b2604a', lo: '#7a3826', trim: '#d8c4a6', base: '#6e675f', shut: '#2f4b38', kind: 'brick' },
                { wall: '#8e8a82', hi: '#a29e95', lo: '#6e6a63', trim: '#d0c8b8', base: '#646059', shut: '#6b2e24', kind: 'stone' },
                { wall: '#a2b3bd', hi: '#b8c7cf', lo: '#8496a2', trim: '#ece7da', base: '#7c776f', shut: '#7a3b2a', kind: 'plaster' },
                { wall: '#d1a160', hi: '#e0b77c', lo: '#b5864a', trim: '#f0e1c2', base: '#7e766b', shut: '#3d5a7a', kind: 'plaster' },
                { wall: '#b3302a', hi: '#c94a3e', lo: '#8e221e', trim: '#f3e6d0', base: '#6e5a4a', shut: '#3f6a34', kind: 'plaster' } // 6: the Tiger Emporium, the apple
            ];
            const wallBg = (M, ground) => {
                box(0, 0, 16, 26, M.wall);
                if (M.kind === 'brick') { for (let y = 0; y < 26; y += 1.5) { box(0, y, 16, 0.34, M.lo); const off = (Math.round(y / 1.5) % 2) * 2; for (let x = off; x < 16; x += 4) box(x, y, 0.34, 1.5, M.lo); } speck(70, [M.hi, M.lo]); }
                else if (M.kind === 'stone') { let y = 0; while (y < 26) { const hh = 2.4 + R() * 1.6; let x = -R() * 3; while (x < 16) { const ww = 3 + R() * 3.5; box(x + 0.3, y + 0.3, ww - 0.6, hh - 0.6, R() < 0.5 ? M.wall : (R() < 0.5 ? M.hi : '#86827a')); x += ww; } y += hh; } speck(40, [M.lo, M.hi]); }
                else { speck(160, [M.hi, M.lo, M.hi]); for (let i = 0; i < 6; i++) box(R() * 16, R() * 26, 2 + R() * 5, 1 + R() * 3, 'rgba(60,40,20,0.06)'); } // plaster: blotches and grime
                if (ground) { box(0, 0, 16, 3, M.base); box(0, 3, 16, 0.6, '#5a554e'); for (let x = 0; x < 16; x += 3.2) box(x + (R() - 0.5) * 0.6, 0, 0.4, 3, '#5a554e'); speck(24, ['#a49d92', '#6a645c'], 0, 3); }
                const gr = g.createLinearGradient(0, CH, 0, CH - 9 * U); gr.addColorStop(0, ground ? 'rgba(40,30,20,.32)' : 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
                const gt = g.createLinearGradient(0, 0, 0, 4 * U); gt.addColorStop(0, 'rgba(0,0,0,.26)'); gt.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gt; g.fillRect(0, 0, CW, 4 * U);
                box(0, 24.8, 16, 1.2, M.trim); // floor band / cornice
                if (M.kind === 'timber') { box(0, 0, 1.1, 26, M.trim); box(15, 0, 1, 26, M.trim); if (ground) box(0, 3, 16, 1, M.trim); else { for (let k = 0; k < 9; k++) { box(1 + k * 0.6, 10 - k * 1.1, 0.9, 1.1, M.trim); box(14.1 - k * 0.6, 10 - k * 1.1, 0.9, 1.1, M.trim); } } }
            };
            const windowAt = (M, cx, y, w, h, opt = {}) => {
                const x = cx - w / 2;
                if (opt.shutters) { box(x - 2.8, y, 2.4, h, M.shut); box(x + w + 0.4, y, 2.4, h, M.shut); for (let k = 0.8; k < h; k += 1.4) { box(x - 2.6, y + k, 2, 0.34, 'rgba(0,0,0,.28)'); box(x + w + 0.6, y + k, 2, 0.34, 'rgba(0,0,0,.28)'); } }
                box(x - 0.8, y - 0.8, w + 1.6, h + 1.6, M.trim);
                if (opt.arch) { box(x - 0.8, y + h, w + 1.6, 1.4, M.trim); box(x + 0.2, y + h + 1.2, w - 0.4, 1.2, M.trim); }
                box(x, y, w, h, KEY);
                if (opt.arch) { box(x + 0.6, y + h, w - 1.2, 0.8, KEY); box(x + 1.4, y + h + 0.8, w - 2.8, 0.7, KEY); }
                box(x + w / 2 - 0.3, y, 0.6, h + (opt.arch ? 1.4 : 0), M.trim); box(x, y + h * 0.55, w, 0.6, M.trim);
                box(x - 1.2, y - 1.5, w + 2.4, 0.9, '#7d766c');
                if (opt.flowers) { box(x - 0.6, y - 3.2, w + 1.2, 1.9, '#6b4a2e'); for (let i = 0; i < 16; i++) box(x - 0.4 + R() * (w + 0.4), y - 1.6 + R() * 1.6, 0.9, 0.8, R() < 0.5 ? '#4f7a36' : ['#d8434b', '#f0c24a', '#e98bb0', '#f2f0e8'][(R() * 4) | 0]); }
            };
            const doorAt = (M, cx, w = 9, h = 17, col = '#5b3a24') => {
                const x = cx - w / 2;
                box(x - 1.1, 0, w + 2.2, h + 1.3, '#6f685e');
                box(x, 0, w, h, col);
                for (let k = 1.5; k < w; k += 1.8) box(x + k, 0, 0.4, h, 'rgba(0,0,0,.28)');
                box(x, h - 0.7, w, 0.7, 'rgba(255,255,255,.12)'); box(x, 4.5, w, 0.7, '#3a2616'); box(x, h - 5, w, 0.7, '#3a2616');
                box(cx + w / 2 - 2, 8, 1, 1, '#e2b84a');
                box(cx - 2.8, h + 1.6, 5.6, 2.6, M.trim); box(cx - 2.2, h + 2, 4.4, 1.8, KEY);
                box(x - 1.6, 0, w + 3.2, 0.7, '#4b463f');
            };
            const shopAt = (M, awn) => {
                box(1.4, 3.2, 13.2, 11, M.trim); box(2.2, 4, 11.6, 9.4, KEY); box(7.7, 4, 0.6, 9.4, M.trim);
                for (let i = 0; i < 7; i++) box(2.6 + R() * 10, 4.3, 1.2, 1 + R() * 2.4, ['#c0392b', '#e6b450', '#7a9a4a', '#9b6a3c'][(R() * 4) | 0]);
                for (let i = 0; i < 8; i++) box(i * 2, 15, 2, 3.6, i % 2 ? '#f1ebe0' : awn);
                for (let i = 0; i < 8; i++) box(i * 2 + 0.4, 14.3, 1.2, 0.8, i % 2 ? '#f1ebe0' : awn);
                box(0, 18.6, 16, 0.5, 'rgba(0,0,0,.3)');
            };
            MATS.forEach((M, r) => {
                cell(0, r, () => wallBg(M, true));
                cell(1, r, () => { wallBg(M, true); windowAt(M, 8, 7.5, 6, 8, { shutters: M.kind !== 'stone' }); });
                cell(2, r, () => { wallBg(M, true); doorAt(M, 8, 9, 17, r === 6 ? '#3f6a34' : r % 2 ? '#4a3a2a' : '#5b3a24'); });
                cell(3, r, () => wallBg(M, false));
                cell(4, r, () => { wallBg(M, false); windowAt(M, 8, 9, 5.6, 9, { shutters: true }); });
                cell(5, r, () => { wallBg(M, false); windowAt(M, 8, 9, 5.6, 8.4, { flowers: true, arch: true }); });
                cell(6, r, () => { wallBg(M, true); shopAt(M, ['#a83a2c', '#2f5d7a', '#3f6a34', '#a83a2c', '#7a3b2a', '#2f5d7a', '#3f6a34'][r]); });
            });
            const ROOFS = PAPER.ROOFS = [['#b4542f', '#cf6e45', '#8a3b1f'], ['#55606e', '#6c7886', '#3c4450'], ['#7e2f25', '#9a4334', '#5c2018'], ['#6d4c36', '#87624a', '#4e3626'], ['#4d6a3e', '#64854f', '#36502c']];
            ROOFS.forEach((P, i) => cell(i, PAPER_CELLS.roofs, () => {
                box(0, 0, 16, 26, P[2]);
                for (let row = 0, y = 0; y < 26; row++, y += 2.6) for (let x = -(row % 2) * 2; x < 16; x += 4) {
                    const sh = R(); box(x + 0.3, y + 0.4, 3.4, 2.3, sh < 0.25 ? P[1] : sh > 0.86 ? P[2] : P[0]);
                    box(x + 0.3, y + 0.4, 3.4, 0.5, 'rgba(0,0,0,.35)'); box(x + 0.7, y + 2.1, 2.6, 0.4, 'rgba(255,255,255,.13)');
                }
                box(0, 0, 16, 0.9, 'rgba(0,0,0,.45)'); speck(30, ['rgba(255,255,255,.15)', 'rgba(0,0,0,.2)']);
                if (i === 4 || i === 3) for (let k = 0; k < 10; k++) box(R() * 16, R() * 26, 1.5 + R() * 2, 0.8, 'rgba(120,150,70,.55)'); // moss
            }));
            const treeline = k => { const cols = ['#1f3324', '#284330', '#31503a', '#1a2a1e', '#2c4a2a'];
                for (let i = 0; i < 3; i++) box(1 + i * 5.5 + R() * 2, 0, 1.2, 10, '#2a1f17');
                for (let i = 0; i < 80; i++) { const x = R() * 18 - 1, top = 17 + 5 * Math.sin(x * 0.7 + k * 3) + 3 * Math.sin(x * 1.9 + k), yy = 4 + R() * top, r = 1.8 + R() * 3.2;
                    g.fillStyle = cols[(R() * cols.length) | 0]; g.beginPath(); g.ellipse(x * U, CH - yy * U, r * U, r * U / 2.15 * 1.3, 0, 0, Math.PI * 2); g.fill(); }
                for (let i = 0; i < 30; i++) box(R() * 16, 6 + R() * 15, 0.8, 0.5, 'rgba(150,180,110,.45)'); };
            cell(0, 8, () => treeline(0)); cell(1, 8, () => treeline(1));
            cell(2, 8, () => { // fence panel in the lower half (13 units tall)
                for (let x = 0.6; x < 16; x += 2.7) { box(x, 0, 1.5, 10.5, '#8a6a48'); box(x + 0.3, 10.5, 0.9, 0.8, '#8a6a48'); box(x, 0, 0.4, 10.5, '#5e4630'); }
                box(0, 3, 16, 1.1, '#6b4f34'); box(0, 7.6, 16, 1.1, '#6b4f34'); box(0, 3.8, 16, 0.3, '#4a3624'); box(0, 8.4, 16, 0.3, '#4a3624');
                box(0, 0, 1.6, 12.4, '#4a3426'); box(0, 12.4, 1.6, 0.6, '#6b4f34'); });
            cell(3, 8, () => { box(0, 0, 16, 26, '#2b2b2e'); box(6, 0, 2, 26, '#4a4a52'); box(0, 25, 16, 1, '#55555e'); });
            cell(4, 8, () => { box(0, 0, 16, 26, '#2b2b2e'); box(2.2, 3, 11.6, 19, KEY); box(7.4, 3, 1.2, 19, '#2b2b2e'); box(2.2, 12, 11.6, 1, '#2b2b2e'); box(0, 23, 16, 3, '#3a3a40'); });
            cell(5, 8, () => { box(0, 0, 16, 26, '#8d877d'); for (let y = 0; y < 26; y += 4.3) { box(0, y, 16, 0.4, '#6c675f'); box(((y * 7) % 11) + 2, y, 0.4, 4.3, '#6c675f'); } speck(60, ['#a29c92', '#77716a']); box(0, 24.6, 16, 1.4, '#a8a297'); });
            cell(6, 8, () => { box(0, 0, 16, 26, '#837b6f'); for (let y = 0; y < 26; y += 6.5) box(0, y, 16, 0.6, '#5e574e'); speck(50, ['#9c9488', '#6a645b']); box(0, 22, 16, 4, '#4a3828'); speck(20, ['#2e2218', '#5c4632'], 22, 26); });
            cell(7, 8, () => { const cols = ['#3d6b33', '#4f8240', '#2f5428', '#5f9446'];
                for (let i = 0; i < 70; i++) { const a = R() * Math.PI, rr = R(), x = 8 + Math.cos(a) * rr * 7.2, yy = 1 + Math.sin(a) * rr * 18; g.fillStyle = cols[(R() * 4) | 0]; g.beginPath(); g.ellipse(x * U, CH - yy * U, (1.2 + R() * 1.6) * U, (1 + R() * 1.4) * U, 0, 0, Math.PI * 2); g.fill(); }
                for (let i = 0; i < 9; i++) box(3 + R() * 10, 4 + R() * 12, 1, 1, ['#e9e4d4', '#e7b84b', '#d65a6a'][(R() * 3) | 0]); });
            cell(8, 8, () => { box(0, 0, 16, 26, '#7a5232'); box(0, 0, 16, 1.2, '#4a3220'); box(0, 24.8, 16, 1.2, '#4a3220'); box(0, 0, 1, 26, '#4a3220'); box(15, 0, 1, 26, '#4a3220');
                for (let y = 0; y < 26; y += 3.2) box(1, y, 14, 0.3, 'rgba(0,0,0,.18)'); box(4, 9, 8, 2, '#e8d9b0'); box(5, 14, 6, 2, '#e8d9b0'); box(3.5, 19, 9, 1.5, '#e8d9b0'); });
            cell(9, 8, () => { box(0, 0, 16, 26, '#6b4a2e'); for (let x = 1; x < 16; x += 2.3) box(x, 0, 0.4, 26, 'rgba(0,0,0,.22)'); speck(30, ['#7d5a3a', '#523822']); });
            cell(10, 8, () => { box(0, 0, 16, 26, '#8a3c2a'); for (let y = 0; y < 26; y += 1.6) { box(0, y, 16, 0.35, '#5e2a1e'); for (let x = (Math.round(y / 1.6) % 2) * 2; x < 16; x += 4) box(x, y, 0.35, 1.6, '#5e2a1e'); } box(0, 23.5, 16, 2.5, '#4a4540'); });
            cell(11, 8, () => { const cols = ['#3c6a2e', '#4d7e38', '#2e5426', '#5d8f42', '#6f9e4c']; // a tree crown (stretched 1.35x tall when folded)
                for (let i = 0; i < 120; i++) { const a = R() * Math.PI * 2, rr = Math.sqrt(R()), x = 8 + Math.cos(a) * rr * 5.2, yy = 15.5 + Math.sin(a) * rr * 7.6, lit = (x - 8) * -0.1 + (yy - 15) * 0.12 + R() * 0.6;
                    g.fillStyle = cols[Math.max(0, Math.min(4, Math.round(1.5 + lit * 1.6)))]; g.beginPath(); g.ellipse(x * U, CH - yy * U, (1 + R() * 1.4) * U, (1 + R() * 1.4) * U / 1.2, 0, 0, Math.PI * 2); g.fill(); }
                box(7.3, 0, 1.4, 7, '#4a3426'); box(7.6, 0, 0.5, 7, '#6b4f34'); });
            cell(12, 8, () => { box(0, 0, 16, 26, '#3f6f7c'); for (let i = 0; i < 40; i++) { const x = R() * 16, y = R() * 26; box(x, y, 1.5 + R() * 3, 0.5, R() < 0.5 ? '#7fb3bd' : '#2c5560'); } speck(40, ['#9fd0d6', '#356570']); }); // fountain water
            const awning = (a, b) => { for (let i = 0; i < 8; i++) box(i * 2, 4, 2, 22, i % 2 ? b : a); for (let i = 0; i < 8; i++) { box(i * 2 + 0.3, 2.6, 1.4, 1.4, i % 2 ? b : a); box(i * 2 + 0.7, 1.6, 0.6, 1, i % 2 ? b : a); } for (let y = 6; y < 26; y += 5) box(0, y, 16, 0.4, 'rgba(0,0,0,.12)'); box(0, 24.5, 16, 1.5, 'rgba(0,0,0,.25)'); };
            cell(13, 8, () => awning('#b2382c', '#f1e9da')); cell(15, 8, () => awning('#3f6a34', '#efe4c6'));
            cell(14, 8, () => { box(0, 0, 16, 26, '#6b4a2e'); for (let k = 0; k < 4; k++) { const x0 = 0.5 + k * 3.9; box(x0, 1, 3.4, 24, '#8a6a48'); box(x0, 1, 3.4, 0.6, '#4a3424');
                const col = [['#c0392b', '#e05a44'], ['#7aa84a', '#5d8a36'], ['#d9a650', '#b98436'], ['#e8c25a', '#c99a2e']][k]; for (let i = 0; i < 22; i++) { const x = x0 + 0.3 + R() * 2.6, y = 2 + R() * 22; box(x, y, 1.1, 1.1, col[(R() * 2) | 0]); box(x + 0.2, y + 0.7, 0.4, 0.3, 'rgba(255,255,255,.4)'); } } }); // goods on the counter: apples, cabbages, loaves, lemons
            if (cottageReady()) { g.imageSmoothingEnabled = false; g.drawImage(COTTAGE_IMG, 0, 780); } // the cottage's strip, below the town's painted rows
            if (paperPiecesReady()) { g.imageSmoothingEnabled = false;
                for (let i = 0; i < 7; i++) g.drawImage(PAPER_PIECES, i * 48, 0, 48, 78, i * CW, 9 * CH, CW, CH);
                g.drawImage(PAPER_PIECES, 7 * 48, 0, 48, 78, 5 * CW, PAPER_CELLS.roofs * CH, CW, CH); g.drawImage(PAPER_PIECES, 8 * 48, 0, 48, 78, 6 * CW, PAPER_CELLS.roofs * CH, CW, CH); }
            // the glass key becomes dark glass with a glint (alpha 179 marks it, so the night can light it); everything else is cut sharp
            const im = g.getImageData(0, 0, S, S), d = im.data;
            for (let i = 0, p = 0; i < d.length; i += 4, p++) {
                if (d[i] === 0 && d[i + 1] === 255 && d[i + 2] === 255 && d[i + 3] === 255) { const x = p % S, y = (p / S) | 0, gl = ((x - y) % 23 + 23) % 23 < 3 ? 1 : 0;
                    d[i] = 46 + gl * 50; d[i + 1] = 58 + gl * 52; d[i + 2] = 76 + gl * 52; d[i + 3] = 179; }
                else d[i + 3] = d[i + 3] >= 128 ? 255 : 0;
            }
            g.putImageData(im, 0, 0);
            return PAPER.sheet = cv;
        }
        function paperHash(a, b, c) { let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c || 0, 1274126177) + Math.imul(PAPER.PRIME, 2654435761)) | 0; /* a positional hash, seeded by the master prime */ n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
        function paperKind(x, y) { // what a tile of the blueprint folds into: h = a house, d = its doorway, b = town block, t = tree line ('' = open ground)
            if (x < 0 || y < 0 || x >= MAP_COLS || y >= MAP_ROWS) return 'out'; const t = MAP_DATA[y][x];
            const k = x + ',' + y; if (PAPER_STALLS.has(k)) return 's'; if (PAPER_FOUNT.has(k)) return 'w';
            if (t === 3 || t === 4) return 'h'; if (t === 5) return 'd'; if (t === TILE_BUMPER) return y >= 17 ? 't' : 'b'; return '';
        }
        function paperBuild() {
            if (PAPER.mesh) return PAPER.mesh;
            const cols = MAP_COLS, rows = MAP_ROWS, T = PAPER.TILE.X, ST = PAPER.HEIGHT.FLOOR, H = paperHash, kind = paperKind;
            const roofK = (x, y) => { const k = kind(x, y); if (k === 'd') return [[0, -1], [1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => kind(x + dx, y + dy) === 'h') ? 'h' : ''; return k === 'h' || k === 'b' ? k : ''; };
            // 1) cut the solid blocks into house-sized rectangles (each its own height, walls and roof)
            const rid = new Int32Array(cols * rows).fill(-1), rects = [];
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                const k = roofK(x, y); if (!k || rid[y * cols + x] >= 0) continue;
                const free = (xx, yy) => xx < cols && yy < rows && roofK(xx, yy) === k && rid[yy * cols + xx] < 0;
                const maxW = k === 'h' ? 8 : 3 + Math.floor(H(x, y, 1) * 4), maxD = k === 'h' ? 4 : 2 + Math.floor(H(x, y, 2) * 3);
                let w = 1; while (w < maxW && free(x + w, y)) w++;
                let d = 1; while (d < maxD) { let ok = true; for (let i = 0; i < w; i++) if (!free(x + i, y + d)) { ok = false; break; } if (!ok) break; d++; }
                const r = { x, y, w, d, k, i: rects.length };
                let doorOnly = true; for (let yy = y; yy < y + d; yy++) for (let xx = x; xx < x + w; xx++) { rid[yy * cols + xx] = r.i; if (kind(xx, yy) !== 'd') doorOnly = false; }
                const s = H(x, y, 3), apple = k === 'h' && x >= 48 && x <= 53 && y <= 4;
                r.st = doorOnly ? 0.75 : k === 'h' ? 3 : s < 0.08 ? 3 : s < 0.45 ? 4 : s < 0.8 ? 5 : 6; /* tall: the town towers over him */ r.h = Math.round(r.st * ST); r.porch = doorOnly;
                r.alongX = w >= d; const span = (r.alongX ? d : w) * T / 2; r.rise = Math.min(42, span * (0.68 + H(x, y, 4) * 0.4));
                const sheet = paperPiecesReady(), pm = paperInt(0, 6, x * PAPER.PRIME + y + 7); r.mat = apple ? 6 : k === 'h' ? paperChoose(sheet ? [0, 2, 5, 1, 9] : [0, 2, 5, 1], x * PAPER.PRIME + y) : pm === 6 ? (sheet ? 9 : 0) : pm;
                r.roof = apple ? 4 : paperChoose(sheet ? [0, 0, 1, 2, 3, 4, 5, 6] : [0, 0, 1, 2, 3, 4], y * PAPER.PRIME + x + 13);
                rects.push(r);
            }
            const HT = PAPER.HT = new Float32Array(cols * rows);
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const k = kind(x, y); HT[y * cols + x] = k === 't' ? PAPER_TREE : (k === 'h' || k === 'b') && rid[y * cols + x] >= 0 ? rects[rid[y * cols + x]].h : 0; }
            PAPER.rects = rects; PAPER.rid = rid;
            // 2) fold: every face is a quad (physically counter-clockwise seen from outside: bottom-left, bottom-right, top-right, top-left)
            const V = []; const CWn = PAPER_X / 1024, CHn = PAPER_Y / 1024, e = 0.5 / 1024;
            const poly = (P, cr, UV, shade, em) => { // UV: [u 0..1, height within the cell in units 0..26] per corner
                const u0 = cr[0] * CWn, v0 = cr[1] * CHn, at = i => [u0 + e + (CWn - 2 * e) * UV[i][0], v0 + e + (CHn - 2 * e) * (1 - UV[i][1] / 26)];
                for (const i of P.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]) { const t = at(i); V.push(P[i][0], P[i][1], P[i][2], t[0], t[1], shade, em); }
            };
            const QUV = (y0, y1) => [[0, y0], [1, y0], [1, y1], [0, y1]];
            const SH = { '0,1': 1.0, '-1,0': 0.9, '1,0': 0.8, '0,-1': 0.7 };
            const vert = (x0, y0, x1, y1, h0, h1, cr, yU, shade, em) => poly([[x0, y0, h0], [x1, y1, h0], [x1, y1, h1], [x0, y0, h1]], cr, QUV(yU[0], yU[1]), shade, em);
            const boxF = (x0, y0, x1, y1, h0, h1, cr, o = {}) => { const yU = o.yU || [0, 26], s = o.shade || 1, em = o.em || 0;
                vert(x0, y1, x1, y1, h0, h1, cr, yU, s, em); vert(x1, y1, x1, y0, h0, h1, cr, yU, 0.8 * s, em); vert(x1, y0, x0, y0, h0, h1, cr, yU, 0.7 * s, em); vert(x0, y0, x0, y1, h0, h1, cr, yU, 0.9 * s, em);
                if (o.top) poly([[x0, y1, h1], [x1, y1, h1], [x1, y0, h1], [x0, y0, h1]], o.top, QUV(0, 26), 1.12 * s, 0); };
            const card2 = (cx, cy, wd, h0, h1, cr, ang) => { const dx = Math.cos(ang) * wd / 2, dy = Math.sin(ang) * wd / 2; // a two-sided standing cut-out
                vert(cx - dx, cy - dy, cx + dx, cy + dy, h0, h1, cr, [0, 26], 1, 0); vert(cx + dx, cy + dy, cx - dx, cy - dy, h0, h1, cr, [0, 26], 0.85, 0); };
            // walls of houses, blocks and the tree line
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                const k = kind(x, y); if (k !== 'h' && k !== 'b' && k !== 't') continue;
                const hS = HT[y * cols + x], r = rects[rid[y * cols + x]];
                for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
                    const nk = kind(x + dx, y + dy); if (nk === 'out') continue;
                    const nh = nk === 'h' || nk === 'b' || nk === 't' ? HT[(y + dy) * cols + x + dx] : 0; if (nh >= hS) continue;
                    const cx = x * T + 8 + dx * 8, cy = y * T + 8 + dy * 8, rx = dy * 8, ry = -dx * 8, ax = cx - rx, ay = cy - ry, bx = cx + rx, by = cy + ry, sh = SH[dx + ',' + dy];
                    if (k === 't') { vert(ax, ay, bx, by, 0, PAPER_TREE, H(x, y, 9) < 0.5 ? PAPER_CELLS.treeA : PAPER_CELLS.treeB, [0, 26], sh * 0.95, 0); continue; }
                    const door = nk === 'd' && dy === 1, open = nk === '';
                    for (let s = Math.floor(nh / ST); s * ST < hS; s++) {
                        const lo = Math.max(nh, s * ST), hi = Math.min(hS, (s + 1) * ST); if (hi - lo < 0.5) continue;
                        const q = H(x * 3 + dx, y * 3 + dy, s + 11); let c, em = 0;
                        if (s === 0) { c = door ? PAPER_CELLS.gDoor : !open || nh > 0 ? PAPER_CELLS.gPlain : r.k === 'h' ? (q < 0.7 ? PAPER_CELLS.gWindow : PAPER_CELLS.gPlain) : q < 0.08 ? PAPER_CELLS.gDoor : q < 0.2 ? PAPER_CELLS.gShop : q < 0.66 ? PAPER_CELLS.gWindow : PAPER_CELLS.gPlain; }
                        else c = q < 0.5 ? PAPER_CELLS.uWindow : q < 0.72 ? PAPER_CELLS.uFlowers : PAPER_CELLS.uPlain;
                        if (c !== PAPER_CELLS.gPlain && c !== PAPER_CELLS.uPlain) em = H(x, y, s * 7 + dx + 31) < 0.45 ? 1 : 0;
                        vert(ax, ay, bx, by, lo, hi, [c, r.mat], [(lo - s * ST) * PAPER_STORY / ST, (hi - s * ST) * PAPER_STORY / ST], sh, em); // one painted cell per storey, however tall the storey
                    }
                }
            }
            // roofs: a gable over every rectangle, its ends filled with wall
            for (const r of rects) {
                const X0 = r.x * T, Y0 = r.y * T, X1 = (r.x + r.w) * T, Y1 = (r.y + r.d) * T, h = r.h, o = 2.4, hr = h + r.rise, half = (r.alongX ? Y1 - Y0 : X1 - X0) / 2, he = h - o * r.rise / half;
                const rc = [r.roof, PAPER_CELLS.roofs], gc = [PAPER_CELLS.uPlain, r.mat], top = x => Math.min(PAPER_STORY, x * PAPER_STORY / ST);
                if (r.alongX) {
                    const ym = (Y0 + Y1) / 2;
                    for (let k = 0; k < r.w; k++) { const xa = X0 + k * T - (k === 0 ? 1.5 : 0), xb = X0 + (k + 1) * T + (k === r.w - 1 ? 1.5 : 0);
                        poly([[xa, Y1 + o, he], [xb, Y1 + o, he], [xb, ym, hr], [xa, ym, hr]], rc, QUV(0, 26), 1.08, 0);
                        poly([[xb, Y0 - o, he], [xa, Y0 - o, he], [xa, ym, hr], [xb, ym, hr]], rc, QUV(0, 26), 0.72, 0); }
                    for (let k = 0; k < r.d; k++) { // the gable ends, cut in tile-wide strips so the wall texture keeps its size
                        const ya = Y0 + k * T, yb = ya + T, ht = yy => h + r.rise * (1 - Math.abs(yy - ym) / half);
                        poly([[X1, yb, h], [X1, ya, h], [X1, ya, ht(ya)], [X1, yb, ht(yb)]], gc, [[0, 0], [1, 0], [1, top(ht(ya) - h)], [0, top(ht(yb) - h)]], 0.8, 0);
                        poly([[X0, ya, h], [X0, yb, h], [X0, yb, ht(yb)], [X0, ya, ht(ya)]], gc, [[0, 0], [1, 0], [1, top(ht(yb) - h)], [0, top(ht(ya) - h)]], 0.9, 0); }
                } else {
                    const xm = (X0 + X1) / 2;
                    for (let k = 0; k < r.d; k++) { const ya = Y0 + k * T - (k === 0 ? 1.5 : 0), yb = Y0 + (k + 1) * T + (k === r.d - 1 ? 1.5 : 0);
                        poly([[X1 + o, yb, he], [X1 + o, ya, he], [xm, ya, hr], [xm, yb, hr]], rc, QUV(0, 26), 0.86, 0);
                        poly([[X0 - o, ya, he], [X0 - o, yb, he], [xm, yb, hr], [xm, ya, hr]], rc, QUV(0, 26), 1.0, 0); }
                    for (let k = 0; k < r.w; k++) {
                        const xa = X0 + k * T, xb = xa + T, ht = xx => h + r.rise * (1 - Math.abs(xx - xm) / half);
                        poly([[xa, Y1, h], [xb, Y1, h], [xb, Y1, ht(xb)], [xa, Y1, ht(xa)]], gc, [[0, 0], [1, 0], [1, top(ht(xb) - h)], [0, top(ht(xa) - h)]], 1.0, 0);
                        poly([[xb, Y0, h], [xa, Y0, h], [xa, Y0, ht(xa)], [xb, Y0, ht(xb)]], gc, [[0, 0], [1, 0], [1, top(ht(xa) - h)], [0, top(ht(xb) - h)]], 0.7, 0); }
                }
                if (!r.porch && r.st >= 2 && H(r.x, r.y, 7) < 0.4) { // a chimney
                    const cx = r.alongX ? X0 + 5 + H(r.x, r.y, 8) * (X1 - X0 - 10) : (X0 + X1) / 2 + 3, cy = r.alongX ? (Y0 + Y1) / 2 + 3 : Y0 + 5 + H(r.x, r.y, 8) * (Y1 - Y0 - 10);
                    boxF(cx - 2.5, cy - 2.5, cx + 2.5, cy + 2.5, h, hr + 8, PAPER_CELLS.chimney, { yU: [0, 26] });
                }
            }
            // street furniture from the blueprint tiles
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                const t = MAP_DATA[y][x], cx = x * T + 8, cy = y * T + 8;
                if (t === 13) { boxF(cx - 1, cy - 1, cx + 1, cy + 1, 0, 25, PAPER_CELLS.iron); boxF(cx - 2.6, cy - 2.6, cx + 2.6, cy + 2.6, 25, 31.5, PAPER_CELLS.lantern, { em: 2 }); boxF(cx - 3.2, cy - 3.2, cx + 3.2, cy + 3.2, 31.5, 33, PAPER_CELLS.iron, { top: PAPER_CELLS.iron }); boxF(cx - 2.2, cy - 2.2, cx + 2.2, cy + 2.2, 0, 2, PAPER_CELLS.stone, { top: PAPER_CELLS.stone }); }
                else if (t === 10) { // an avenue tree in a stone ring
                    boxF(cx - 5, cy - 5, cx + 5, cy + 5, 0, 2.5, PAPER_CELLS.stone, { top: PAPER_CELLS.planter, yU: [0, 3] }); boxF(cx - 1.4, cy - 1.4, cx + 1.4, cy + 1.4, 2.5, 16, PAPER_CELLS.wood);
                    const a0 = paperHash(x, y, 12) * Math.PI; for (let k = 0; k < 3; k++) card2(cx, cy, 26, 8, 42, PAPER_CELLS.crown, a0 + k * Math.PI / 3); }
                else if (t === 11) { boxF(cx - 6, cy - 6, cx + 6, cy + 6, 0, 6, PAPER_CELLS.planter, { top: PAPER_CELLS.planter, yU: [0, 26] }); card2(cx, cy, 15, 4, 22, PAPER_CELLS.bush, 0.35); card2(cx, cy, 15, 4, 22, PAPER_CELLS.bush, 0.35 + Math.PI / 2); }
                else if (t === 7) { boxF(cx - 0.8, cy - 0.8, cx + 0.8, cy + 0.8, 0, 21, PAPER_CELLS.wood); boxF(cx - 7, cy - 0.9, cx + 7, cy + 0.9, 12, 21, PAPER_CELLS.sign, { top: PAPER_CELLS.wood }); }
                else if (t === 9) boxF(x * T, cy - 0.7, x * T + T, cy + 0.7, 0, PAPER_FENCE, PAPER_CELLS.fence, { yU: [0, 13] });
            }
            // market stalls: a counter of goods under a striped canvas, on four posts
            for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
                if (kind(x, y) !== 's' || kind(x - 1, y) === 's') continue; let w = 1; while (kind(x + w, y) === 's') w++;
                const X0 = x * T + 1, X1 = (x + w) * T - 1, Y0 = y * T + 1, Y1 = y * T + 15, aw = H(x, y, 21) < 0.5 ? PAPER_CELLS.awningRed : PAPER_CELLS.awningGreen;
                boxF(X0 + 1, Y0 + 6, X1 - 1, Y1 - 1, 0, 9, PAPER_CELLS.wood, { top: PAPER_CELLS.goods, yU: [0, 26] });
                for (const [px, py] of [[X0, Y0], [X1 - 1.4, Y0], [X0, Y1 - 1.4], [X1 - 1.4, Y1 - 1.4]]) boxF(px, py, px + 1.4, py + 1.4, 0, py > Y0 ? 18 : 22, PAPER_CELLS.wood);
                for (let k = 0; k < w; k++) { const xa = X0 - 1 + k * T + (k ? 1 : 0), xb = Math.min(X1 + 1, X0 - 1 + (k + 1) * T + (k ? 1 : 0));
                    const top = [[xa, Y1 + 3, 17.5], [xb, Y1 + 3, 17.5], [xb, Y0 - 1, 22.5], [xa, Y0 - 1, 22.5]];
                    poly(top, aw, QUV(4, 26), 1.05, 0); poly([top[1], top[0], top[3], top[2]], aw, QUV(4, 26), 0.6, 0);         // the canvas, both faces
                    vert(xa, Y1 + 3, xb, Y1 + 3, 13.5, 17.5, aw, [0, 5], 1, 0); vert(xb, Y1 + 3, xa, Y1 + 3, 13.5, 17.5, aw, [0, 5], 0.7, 0); // its scalloped valance
                    vert(xa, Y0, xb, Y0, 9, 22, aw, [4, 26], 0.75, 0); vert(xb, Y0, xa, Y0, 9, 22, aw, [4, 26], 0.75, 0); }      // the back cloth
            }
            // the fountain: an eight-sided stone basin of water, a pedestal with an upper bowl and a spout
            if (PAPER_FOUNT.size) {
                let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const k of PAPER_FOUNT) { const [fx, fy] = k.split(',').map(Number); x0 = Math.min(x0, fx); y0 = Math.min(y0, fy); x1 = Math.max(x1, fx); y1 = Math.max(y1, fy); }
                const cx = (x0 + x1 + 1) * T / 2, cy = (y0 + y1 + 1) * T / 2, Ro = Math.min(x1 - x0 + 1, y1 - y0 + 1) * T / 2 - 1.5, Ri = Ro - 3.5, hR = 7, hW = 4.5, st = PAPER_CELLS.stone, wa = PAPER_CELLS.water;
                const at = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
                for (let i = 0; i < 8; i++) { const a0 = (i + 0.5) * Math.PI / 4, a1 = (i + 1.5) * Math.PI / 4, o0 = at(Ro, a0), o1 = at(Ro, a1), n0 = at(Ri, a0), n1 = at(Ri, a1), sh = 0.78 + 0.22 * Math.sin((a0 + a1) / 2);
                    vert(o1[0], o1[1], o0[0], o0[1], 0, hR, st, [0, hR], sh, 0);                                            // outer wall
                    vert(n0[0], n0[1], n1[0], n1[1], hW, hR, st, [hW, hR], sh * 0.8, 0);                                   // inner wall above the water
                    poly([[o1[0], o1[1], hR], [o0[0], o0[1], hR], [n0[0], n0[1], hR], [n1[0], n1[1], hR]], st, QUV(22, 26), 1.1, 0); // the rim you could sit on
                    poly([[cx, cy, hW], [n1[0], n1[1], hW], [n0[0], n0[1], hW]], wa, [[0.5, 13], [1, 0], [0, 0]], 1.05, 0); }  // the water
                boxF(cx - 3.5, cy - 3.5, cx + 3.5, cy + 3.5, hW, 15, st);
                boxF(cx - 9, cy - 9, cx + 9, cy + 9, 15, 18, st, { top: wa, yU: [22, 26] });
                boxF(cx - 2, cy - 2, cx + 2, cy + 2, 18, 27, st); boxF(cx - 3, cy - 3, cx + 3, cy + 3, 27, 29, st, { top: st });
                for (let k = 0; k < 4; k++) card2(cx, cy, 20, hW, 15.5, wa, k * Math.PI / 4);                                   // the falling sheet of water
            }
            PAPER.cottage = cottageReady(); if (PAPER.cottage) paperCottage(V);
            PAPER.verts = V.length / 7;
            return PAPER.mesh = new Float32Array(V);
        }
        function paperGroundStep(ms) { // advance the street painting for up to ms; true once it's done
            if (GEN_CACHE.overworld) return true; const job = PAPER.job || (PAPER.job = paperGround()), t0 = performance.now();
            while (performance.now() - t0 < ms) { const r = job.next(); if (r.done) { GEN_CACHE.overworld = r.value; PAPER.job = null; return true; } }
            return false;
        }
        function* paperGround() { // (a job: run a slice at a time so it never stalls a frame) the street, painted: cobbles in town, flagstones down the avenue, grass and worn lanes in Rahjai, with the houses' shadows baked in
            const cols = MAP_COLS, rows = MAP_ROWS, K = 2, W = cols * 16 * K, Hh = rows * 16 * K;
            paperBuild(); const HT = PAPER.HT, rects = PAPER.rects, rid = PAPER.rid;
            const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const c = cv.getContext('2d'), im = c.createImageData(W, Hh), px = im.data;
            const n1 = vnoise(51), n2 = vnoise(63), n3 = vnoise(77), H = paperHash;
            // effective heights (walls + some roof) and a shadow mask at one sample per world unit; the sun sits low in the south-west
            const EH = new Float32Array(cols * rows); for (let i = 0; i < EH.length; i++) EH[i] = HT[i] + (rid[i] >= 0 && HT[i] > 0 ? rects[rid[i]].rise * 0.6 : 0);
            const WU = cols * 16, HU = rows * 16, SHD = new Float32Array(WU * HU), sx = -0.55, sy = 0.835, tanE = 0.95;
            const ehAt = (x, y) => { const tx = x >> 4, ty = y >> 4; return tx < 0 || ty < 0 || tx >= cols || ty >= rows ? 0 : EH[ty * cols + tx]; };
            for (let y = 0; y < HU; y++) for (let x = 0; x < WU; x++) {
                if (ehAt(x, y) > 0) { SHD[y * WU + x] = 1; continue; } let s = 0;
                for (let d = 2; d < 170; d += 3) { const h = ehAt((x + sx * d) | 0, (y + sy * d) | 0); if (h > d * tanE) { s = Math.min(1, 0.55 + (h - d * tanE) / 30); break; } }
                SHD[y * WU + x] = s;
                if (x === WU - 1 && y % 24 === 23) yield;
            }
            // distance to the nearest wall (tiles) for the dark seam at the foot of every wall
            const D = new Float32Array(cols * rows).fill(99), q = []; for (let i = 0; i < D.length; i++) if (HT[i] > 0) { D[i] = 0; q.push(i); }
            for (let h = 0; h < q.length; h++) { const k = q[h], x = k % cols, y = (k / cols) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue; const nk = ny * cols + nx; if (D[nk] > D[k] + 1) { D[nk] = D[k] + 1; q.push(nk); } } }
            const wallNear = (wx, wy) => { let m = 9; const tx = Math.floor(wx / 16), ty = Math.floor(wy / 16); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || HT[ny * cols + nx] <= 0) continue;
                const ex = Math.max(nx * 16 - wx, 0, wx - nx * 16 - 16), ey = Math.max(ny * 16 - wy, 0, wy - ny * 16 - 16); m = Math.min(m, Math.hypot(ex, ey)); } return m; };
            // Rahjai's lanes: from the town's avenue down to a lane along the field, out to the east road and the two trails
            const LANES = [[[29.5, 17], [29.5, 22.35]], [[5.5, 22.35], [64, 22.35]], [[64, 22.35], [67.5, 19.5], [70, 18.5]], [[12.5, 22.35], [12.5, 24]], [[47.5, 22.35], [47.5, 24]]];
            const laneD = (wx, wy) => { let m = 99; const p = [wx / 16, wy / 16]; for (const L of LANES) for (let i = 0; i < L.length - 1; i++) { const [ax, ay] = L[i], [bx, by] = L[i + 1], vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / (vx * vx + vy * vy))); m = Math.min(m, Math.hypot(p[0] - ax - vx * t, p[1] - ay - vy * t)); } return m; };
            const YARDS = [[23, 20.6, 2.3], [37.5, 20.4, 2.6], [18.5, 21.4, 1.6]];
            const STONES = [[163, 155, 141], [176, 168, 153], [150, 141, 126], [168, 160, 146], [139, 133, 122]];
            for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4, wx = x / K, wy = y / K, tx = Math.floor(wx / 16), ty = Math.floor(wy / 16), t = MAP_DATA[Math.min(rows - 1, ty)][Math.min(cols - 1, tx)];
                const m = n1(wx / 21, wy / 21) * 0.6 + n2(wx / 6, wy / 6) * 0.3 + n3(wx / 1.7, wy / 1.7) * 0.1;
                const field = wy / 16 + (n2(wx / 9, 3) - 0.5) * 0.7 > 17.6;
                let r, g, b;
                if (!field) {
                    const avenue = wx >= 22 * 16 && wx < 38 * 16 && wy >= 16; // the market square: big flagstones
                    const cw = avenue ? 9 : 4.3, ch = avenue ? 7 : 3.5, row = Math.floor(wy / ch), off = (row % 2) * cw * 0.5 + H(row, 3) * 1.7, col = Math.floor((wx + off) / cw);
                    const lx = (wx + off) - col * cw - cw / 2, ly = wy - row * ch - ch / 2, hs = H(col, row, avenue ? 5 : 1);
                    const ex = cw / 2 - (avenue ? 0.35 : 0.42) - hs * 0.25, ey = ch / 2 - (avenue ? 0.35 : 0.4), pw = avenue ? 8 : 4, dd = Math.pow(Math.abs(lx) / ex, pw) + Math.pow(Math.abs(ly) / ey, pw);
                    const base = avenue ? [182, 174, 160] : STONES[(hs * STONES.length) | 0];
                    if (dd < 1) { const k = (0.86 + m * 0.28) * (1 - 0.1 * lx / ex - 0.14 * ly / ey) * (0.94 + hs * 0.1); r = base[0] * k; g = base[1] * k; b = base[2] * k; }
                    else { const k = 0.55 + m * 0.2; r = 92 * k + 20; g = 82 * k + 18; b = 66 * k + 14; }
                    if (n3(wx / 2.4 + 9, wy / 2.4) > 0.78) { r += 10; g += 9; b += 6; }      // dust and wear
                    if (n1(wx / 13 + 40, wy / 13) > 0.74) { r -= 14; g -= 10; b -= 12; }    // damp patches
                    if (t === 12) { const fx = (wx % 16) - 8, fy = (wy % 16) - 8; if (Math.abs(fx) < 6.5 && Math.abs(fy) < 6.5) { r = 74 + m * 30; g = 58 + m * 20; b = 40; const fl = H(Math.floor(wx), Math.floor(wy), 9);
                        if (fl < 0.3) { r = 70; g = 120 + m * 30; b = 52; } else if (fl < 0.38) { r = 230; g = 90; b = 100; } else if (fl < 0.44) { r = 240; g = 205; b = 90; } else if (fl < 0.48) { r = 236; g = 232; b = 220; } } }
                } else {
                    r = 84 + m * 34; g = 110 + m * 38; b = 56 + m * 18;                      // grass
                    const bl = n3(wx / 0.9, wy / 0.9 + 7); if (bl > 0.7) { r += 18; g += 22; b += 6; } else if (bl < 0.2) { r -= 14; g -= 14; b -= 8; }
                    if (n1(wx / 30 + 5, wy / 30) > 0.68) { r += 14; g += 6; b -= 4; }         // drier patches
                    let lane = Math.max(0, Math.min(1, 1.25 - laneD(wx, wy) * 2.6 + (n2(wx / 4, wy / 4) - 0.5) * 0.6));
                    for (const [yx, yy, yr] of YARDS) lane = Math.max(lane, Math.max(0, Math.min(1, (yr - Math.hypot(wx / 16 - yx, (wy / 16 - yy) * 1.4)) * 1.4 + (n2(wx / 5, wy / 5) - 0.5))));
                    if (lane > 0) { const pr = 132 + m * 24, pg = 104 + m * 18, pb = 72 + m * 12; r += (pr - r) * lane; g += (pg - g) * lane; b += (pb - b) * lane; if (lane > 0.6 && n3(wx * 1.3, wy * 1.3) > 0.8) { r += 26; g += 24; b += 20; } }
                    if (tx >= 9 && tx <= 16 && ty >= 18 && ty <= 22) { const u = Math.max(0, Math.min(1, 1 - Math.max(Math.abs(wx / 16 - 13) - 3.2, Math.abs(wy / 16 - 20.5) - 1.7) * 1.5)); r += (88 - r) * u; g += (62 - g) * u; b += (40 - b) * u; } // tilled ground round the plots
                    if (ty === 17 && t === 9) { r = r * 0.85 + 14; g = g * 0.85 + 8; } // worn under the fence
                }
                const dT = D[Math.min(rows - 1, ty) * cols + Math.min(cols - 1, tx)], wn = dT <= 1 ? wallNear(wx, wy) : 9; if (wn < 5) { const k = 1 - 0.42 * (1 - wn / 5) * (1 - wn / 5); r *= k; g *= k; b *= k; } // the dark seam where wall meets ground
                const sh = SHD[(Math.min(HU - 1, wy | 0)) * WU + Math.min(WU - 1, wx | 0)]; if (sh > 0) { const k = 1 - sh * 0.4; r *= k; g *= k * 1.01; b *= k * 1.07; }
                px[o] = Math.max(0, Math.min(255, r)); px[o + 1] = Math.max(0, Math.min(255, g)); px[o + 2] = Math.max(0, Math.min(255, b)); px[o + 3] = 255;
                if (x === W - 1 && y % 6 === 5) yield;
            }
            c.putImageData(im, 0, 0);
            return cv;
        }

        // ---- the tracer, in the browser: the same cut as tools/sprite_poly.py, step for step (so any picture can be traced on a phone, and the
        // same picture traced here or there gives the same polygon). px: RGBA bytes of a whole image W px wide; rect [x, y, w, h] the part to trace.
        // Returns one sprite record { rect, anchor, pts, rings, tris, ein } (the format paperSprite folds), or null if the rect holds no paint.
        const PAPER_TRACE = { ALPHA: 128, GROW: 1, EPS: 1, MIN_AREA: 12, NEAR: 4 };
        function paperTrace(px, W, rect, o = {}) {
            const C = Object.assign({}, PAPER_TRACE, o), [X0, Y0, w, h] = rect, a = new Uint8Array(w * h), cxs = [], cys = [];
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[((Y0 + y) * W + X0 + x) * 4 + 3] >= C.ALPHA) { a[y * w + x] = 1; cxs.push(x + 0.5); cys.push(y + 0.5); } // painted pixel centres, row by row
            if (!cxs.length) return null;
            let g = a; for (let r = 0; r < C.GROW; r++) { const m = new Uint8Array(w * h); // grow the paper 1 px (a 3 x 3 brush, clipped to the rect)
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < h && xx < w && g[yy * w + xx]) { v = 1; break; } } m[y * w + x] = v; } g = m; }
            const PW = w + 2, P = new Uint8Array(PW * (h + 2)); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) P[(y + 1) * PW + x + 1] = g[y * w + x]; // padded by one px of air
            for (;;) { const fill = []; // unpinch: fill one pixel of every diagonal-only touch (all found first, then filled), until none are left
                for (let y = 0; y < h + 1; y++) for (let x = 0; x < w + 1; x++) { const A = P[y * PW + x], B = P[y * PW + x + 1], Cc = P[(y + 1) * PW + x], D = P[(y + 1) * PW + x + 1];
                    if (A && D && !B && !Cc) fill.push((y + 1) * PW + x); else if (B && Cc && !A && !D) fill.push(y * PW + x); }
                if (!fill.length) break; for (const i of fill) P[i] = 1; }
            const f = (x, y) => P[(y + 1) * PW + x + 1], K = w + 1, key = (x, y) => y * K + x, nxt = new Map(), add = (s, e) => { const k = key(s[0], s[1]); (nxt.get(k) || nxt.set(k, []).get(k)).push(e); };
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (!f(x, y)) continue; // every pixel edge with air beyond it, run with the paper on the left (y up)
                if (!f(x, y - 1)) add([x + 1, y], [x, y]); if (!f(x - 1, y)) add([x, y], [x, y + 1]); if (!f(x, y + 1)) add([x, y + 1], [x + 1, y + 1]); if (!f(x + 1, y)) add([x + 1, y + 1], [x + 1, y]); }
            const lt = (p, q) => p[0] < q[0] || (p[0] === q[0] && p[1] < q[1]), raw = [];
            while (nxt.size) { let sk = Infinity; for (const k of nxt.keys()) if (k < sk) sk = k; // the top-most, then left-most corner still unused
                const start = [sk % K, (sk / K) | 0], ring = []; let cur = start, pd = null;
                for (;;) { const ck = key(cur[0], cur[1]), outs = nxt.get(ck); let e = null, ei = -1;
                    if (outs.length === 1 || !pd) { for (let i = 0; i < outs.length; i++) if (!e || lt(outs[i], e)) { e = outs[i]; ei = i; } }
                    else { let bc = 0; for (let i = 0; i < outs.length; i++) { const q = outs[i], c = pd[0] * (q[1] - cur[1]) - pd[1] * (q[0] - cur[0]); if (!e || c < bc || (c === bc && lt(q, e))) { e = q; ei = i; bc = c; } } } // a pinch: hug the pixel we came along
                    outs.splice(ei, 1); if (!outs.length) nxt.delete(ck); ring.push(cur); pd = [e[0] - cur[0], e[1] - cur[1]]; cur = e;
                    if (cur[0] === start[0] && cur[1] === start[1]) break; }
                raw.push(ring); }
            const area2 = r => { let s = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; s += p[0] * q[1] - q[0] * p[1]; } return s; };
            const cr = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
            const outside = (r, X, Y) => { const ins = new Uint8Array(X.length); for (let i = 0; i < r.length; i++) { const [x0, y0] = r[i], [x1, y1] = r[(i + 1) % r.length]; if (y0 === y1) continue; const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
                for (let k = 0; k < X.length; k++) if (Y[k] >= lo && Y[k] < hi && X[k] < x0 + (Y[k] - y0) * (x1 - x0) / (y1 - y0)) ins[k] ^= 1; } return ins; }; // even-odd: 0 = outside
            const dp = (pts, eps) => { const keep = new Set([0, pts.length - 1]), st = [[0, pts.length - 1]]; // Douglas-Peucker on an open chain: the kept indices
                while (st.length) { const [i, j] = st.pop(), [ax, ay] = pts[i], [bx, by] = pts[j], dx = bx - ax, dy = by - ay, L = Math.sqrt(dx * dx + dy * dy); let best = -1, bk = -1;
                    for (let k = i + 1; k < j; k++) { const [qx, qy] = pts[k], d = L ? Math.abs(dx * (ay - qy) - dy * (ax - qx)) / L : Math.sqrt((qx - ax) ** 2 + (qy - ay) ** 2); if (d > best) { best = d; bk = k; } }
                    if (best > eps) { keep.add(bk); st.push([i, bk], [bk, j]); } }
                return [...keep].sort((p, q) => p - q); };
            const simplify = (r, eps) => { if (eps <= 0 || r.length < 5) return r.map((_, i) => i); const a0 = r[0]; let far = 0, fd = -1;
                for (let k = 0; k < r.length; k++) { const d = (r[k][0] - a0[0]) ** 2 + (r[k][1] - a0[1]) ** 2; if (d > fd) { fd = d; far = k; } }
                const s = new Set(dp(r.slice(0, far + 1), eps)); for (const i of dp(r.slice(far).concat([r[0]]), eps)) if (far + i < r.length) s.add(far + i); return [...s].sort((p, q) => p - q); };
            const hold = (r, keep, X, Y) => { keep = new Set(keep); // put corners back until every painted pixel centre this ring owns is inside it
                for (let n = 0; n < r.length; n++) { const kk = [...keep].sort((p, q) => p - q), out = outside(kk.map(i => r[i]), X, Y); let m = -1; for (let k = 0; k < X.length; k++) if (!out[k]) { m = k; break; }
                    if (m < 0) break; let bi = -1, bd = Infinity; for (let i = 0; i < r.length; i++) if (!keep.has(i)) { const d = (r[i][0] - X[m]) ** 2 + (r[i][1] - Y[m]) ** 2; if (d < bd) { bd = d; bi = i; } }
                    if (bi < 0) break; keep.add(bi); }
                return [...keep].sort((p, q) => p - q); };
            const segX = (p1, p2, p3, p4) => { const o = (p, q, r) => Math.sign(cr(p, q, r)), d1 = o(p3, p4, p1), d2 = o(p3, p4, p2), d3 = o(p1, p2, p3), d4 = o(p1, p2, p4); if (d1 * d2 < 0 && d3 * d4 < 0) return true;
                const on = (p, q, r) => Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) && Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
                return (!d1 && on(p3, p4, p1)) || (!d2 && on(p3, p4, p2)) || (!d3 && on(p1, p2, p3)) || (!d4 && on(p1, p2, p4)); };
            const simple = r => { const n = r.length; if (new Set(r.map(p => p[0] + ',' + p[1])).size !== n) return false;
                for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { if (j === i + 1 || (i === 0 && j === n - 1)) continue; if (segX(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return false; } return true; };
            const earclip = r => { const idx = r.map((_, i) => i), tris = [], same = (p, q) => p[0] === q[0] && p[1] === q[1]; let guard = 0; // the fattest ear first (ties: the first in ring order)
                while (idx.length > 3 && guard < 10 * r.length * r.length) { guard++; const n = idx.length; let bq = -1, bk = -1;
                    for (let k = 0; k < n; k++) { const i0 = idx[(k - 1 + n) % n], i1 = idx[k], i2 = idx[(k + 1) % n], A = r[i0], B = r[i1], Cc = r[i2], ar = -cr(A, B, Cc); if (ar <= 0) continue;
                        let blocked = false; for (const m of idx) { if (m === i0 || m === i1 || m === i2) continue; const p = r[m]; if (same(p, A) || same(p, B) || same(p, Cc)) continue; if (cr(A, B, p) <= 0 && cr(B, Cc, p) <= 0 && cr(Cc, A, p) <= 0) { blocked = true; break; } }
                        if (blocked) continue; const q = ar / ((A[0] - B[0]) ** 2 + (A[1] - B[1]) ** 2 + (B[0] - Cc[0]) ** 2 + (B[1] - Cc[1]) ** 2 + (Cc[0] - A[0]) ** 2 + (Cc[1] - A[1]) ** 2); if (bk < 0 || q > bq) { bq = q; bk = k; } }
                    if (bk < 0) return null; tris.push([idx[(bk - 1 + n) % n], idx[bk], idx[(bk + 1) % n]]); idx.splice(bk, 1); }
                if (idx.length === 3) tris.push(idx.slice()); return tris; };
            const near = (x, y) => { let best = null; for (let py = Math.max(0, y - C.NEAR); py < Math.min(h, y + C.NEAR); py++) for (let qx = Math.max(0, x - C.NEAR); qx < Math.min(w, x + C.NEAR); qx++) if (a[py * w + qx]) { // the nearest painted pixel (the edge ribbon samples it)
                const d = (qx + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2; if (!best || d < best[0] || (d === best[0] && (py < best[1] || (py === best[1] && qx < best[2])))) best = [d, py, qx]; }
                return best ? [best[2], best[1]] : [Math.min(w - 1, Math.max(0, x)), Math.min(h - 1, Math.max(0, y))]; };
            const pts = [], rings = [], tris = [], ein = [];
            for (let ring of raw) {
                const A2 = area2(ring); if (A2 >= 0 || -A2 / 2 < C.MIN_AREA) continue;                     // holes and specks are left to the alpha cut
                ring = ring.filter((b, i) => cr(ring[(i - 1 + ring.length) % ring.length], b, ring[(i + 1) % ring.length]) !== 0); // drop straight-through corners
                const ins = outside(ring, cxs, cys), X = [], Y = []; for (let k = 0; k < cxs.length; k++) if (ins[k]) { X.push(cxs[k]); Y.push(cys[k]); }
                let s = null, t = null;
                for (const eps of [C.EPS, C.EPS * 0.75, C.EPS * 0.5, 0]) { s = hold(ring, simplify(ring, eps), X, Y).map(i => ring[i]); t = s.length >= 3 && area2(s) < 0 && simple(s) ? earclip(s) : null; if (t) break; }
                if (!t) return null;
                const b = pts.length / 2; for (const p of s) { pts.push(p[0], p[1]); const e = near(p[0], p[1]); ein.push(e[0], e[1]); } rings.push(s.length); for (const q of t) tris.push(b + q[0], b + q[1], b + q[2]);
            }
            return { rect: [X0, Y0, w, h], anchor: o.anchor || [w / 2, h], pts, rings, tris, ein };
        }

        // ---- any picture -> a cut-out ready for paperTrace. Shrunk so its long side is at most o.max px (an area average done here, not by the
        // browser, so the same pixels give the same cut on every device). A picture with its own transparency keeps it; any other picture has its
        // background keyed out: a flood fill from the border through every pixel within o.tol (0..441, RGB distance) of any of the border's main colours
        // (up to six, each at least 4% of the border: one for a plain backdrop, a few for a grid, a check or a pattern).
        // o.seeds [[u, v], ...] (0..1 across the picture): extra spots to key out (tap to erase). From each one the fill spreads while the colour changes
        // smoothly (each step within 0.6 tol of the last pixel) and stays within 3 tol of the tapped colour, so a shaded or vignetted backdrop goes in one tap.
        // o.one keeps one subject: the biggest piece and whatever lies within a few px of it. Alpha ends up 0 or 255. Returns { cv (a canvas to use as the texture), px (its RGBA), w, h, keyed }.
        function paperFlood(px, w, h, seeds, ok) { // 4-connected flood fill from the seed pixels through every pixel j that ok(j, from) accepts
            const seen = new Uint8Array(w * h), q = []; for (const i of seeds) if (!seen[i]) { seen[i] = 1; q.push(i); }
            for (let hd = 0; hd < q.length; hd++) { const i = q[hd], x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !seen[j] && ok(j, i)) { seen[j] = 1; q.push(j); } }
            return seen;
        }
        function paperCutout(src, o = {}) {
            const MAX = o.max || 160, tol = o.tol == null ? 48 : o.tol, W0 = src.naturalWidth || src.width, H0 = src.naturalHeight || src.height, k0 = Math.min(1, 4096 / Math.max(W0, H0));
            const sw = Math.max(1, Math.round(W0 * k0)), sh = Math.max(1, Math.round(H0 * k0)), big = document.createElement('canvas'); big.width = sw; big.height = sh;
            const bg = big.getContext('2d'); bg.drawImage(src, 0, 0, sw, sh); const S = bg.getImageData(0, 0, sw, sh).data;
            const k = Math.min(1, MAX / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k)), px = new Uint8ClampedArray(w * h * 4);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { // area average, colour weighted by alpha
                const xa = Math.floor(x * sw / w), xb = Math.max(xa + 1, Math.floor((x + 1) * sw / w)), ya = Math.floor(y * sh / h), yb = Math.max(ya + 1, Math.floor((y + 1) * sh / h)); let A = 0, R = 0, G = 0, B = 0, n = 0;
                for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) { const i = (yy * sw + xx) * 4, al = S[i + 3]; A += al; R += S[i] * al; G += S[i + 1] * al; B += S[i + 2] * al; n++; }
                const o4 = (y * w + x) * 4; if (A) { px[o4] = R / A; px[o4 + 1] = G / A; px[o4 + 2] = B / A; } px[o4 + 3] = A / n; }
            let air = 0, paper = 0; for (let i = 3; i < px.length; i += 4) px[i] >= 128 ? paper++ : air++;
            const keyed = !(air && paper);
            if (keyed) { // no transparency of its own: key the background out from the border
                const border = []; for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x); for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
                const bins = new Map(); for (const i of border) { const q = (px[i * 4] >> 4) << 8 | (px[i * 4 + 1] >> 4) << 4 | px[i * 4 + 2] >> 4, b = bins.get(q) || [0, 0, 0, 0, q]; b[0]++; b[1] += px[i * 4]; b[2] += px[i * 4 + 1]; b[3] += px[i * 4 + 2]; bins.set(q, b); }
                const keys = [...bins.values()].sort((p, q) => q[0] - p[0] || p[4] - q[4]).filter((b, n) => n === 0 || (n < 6 && b[0] >= Math.max(3, border.length * 0.04))).map(b => [b[1] / b[0], b[2] / b[0], b[3] / b[0]]); // the border's palette: a plain backdrop has one colour, a grid or a pattern a few
                const near = i => keys.some(c => (px[i * 4] - c[0]) ** 2 + (px[i * 4 + 1] - c[1]) ** 2 + (px[i * 4 + 2] - c[2]) ** 2 <= tol * tol);
                const seen = paperFlood(px, w, h, border.filter(near), near); for (let i = 0; i < w * h; i++) px[i * 4 + 3] = seen[i] ? 0 : 255;
            } else for (let i = 3; i < px.length; i += 4) px[i] = px[i] >= 128 ? 255 : 0;
            for (const [u, v] of o.seeds || []) { const i0 = Math.min(h - 1, Math.max(0, Math.floor(v * h))) * w + Math.min(w - 1, Math.max(0, Math.floor(u * w))); if (!px[i0 * 4 + 3]) continue; // tap to erase
                const d2 = (i, j) => (px[i * 4] - px[j * 4]) ** 2 + (px[i * 4 + 1] - px[j * 4 + 1]) ** 2 + (px[i * 4 + 2] - px[j * 4 + 2]) ** 2, step = (0.6 * tol) ** 2, far = (3 * tol) ** 2;
                const near = (j, i) => px[j * 4 + 3] > 0 && d2(j, i) <= step && d2(j, i0) <= far;
                const seen = paperFlood(px, w, h, [i0], near); for (let i = 0; i < w * h; i++) if (seen[i]) px[i * 4 + 3] = 0; }
            if (o.one) { // one subject: the biggest piece, plus any piece within a few px of it (a handle split off by a dark seam, a held spear); a second figure standing apart is dropped
                const lab = new Int32Array(w * h), size = [0]; let best = 0;
                for (let s0 = 0; s0 < w * h; s0++) { if (!px[s0 * 4 + 3] || lab[s0]) continue; const id = size.length, q = [s0]; lab[s0] = id;
                    for (let hd = 0; hd < q.length; hd++) { const i = q[hd], x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy, j = yy * w + xx; if (xx >= 0 && yy >= 0 && xx < w && yy < h && px[j * 4 + 3] && !lab[j]) { lab[j] = id; q.push(j); } } }
                    size.push(q.length); if (q.length > size[best]) best = id; }
                const keep = new Uint8Array(size.length); keep[best] = 1; const gap = Math.max(2, Math.round(0.02 * Math.max(w, h))), min = size[best] * 0.01;
                for (let pass = 0; pass < 3; pass++) { const near = new Uint8Array(w * h); // grow what is kept by `gap` px, take in every piece it reaches
                    for (let i = 0; i < w * h; i++) if (keep[lab[i]] && lab[i]) { const x = i % w, y = (i / w) | 0; for (let yy = Math.max(0, y - gap); yy <= Math.min(h - 1, y + gap); yy++) for (let xx = Math.max(0, x - gap); xx <= Math.min(w - 1, x + gap); xx++) near[yy * w + xx] = 1; }
                    let added = 0; for (let i = 0; i < w * h; i++) if (near[i] && lab[i] && !keep[lab[i]] && size[lab[i]] >= min) { keep[lab[i]] = 1; added++; } if (!added) break; }
                for (let i = 0; i < w * h; i++) if (!keep[lab[i]]) px[i * 4 + 3] = 0; }
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
            return { cv, px, w, h, keyed };
        }

        // ---- sprites folded into paper: an outline traced by tools/sprite_poly.py (assets/papercraft/sprite-polys.json) becomes a standing
        // cut-out with the sprite painted on the front, a darker mirror of it on the back and, when it has thickness, a card edge between them.
        // S: one sprite record { rect, anchor, pts, rings, tris, ein }. A: its atlas size [w, h] (the UVs are for that texture, not the paper sheet).
        // o: x, y = where it stands (world px), ang = the way it faces (0 = south, toward +y; PI/2 = west), s = world units per sprite px,
        //    thick = card thickness in world units (0 = paper-thin), flip = mirrored left to right, shade = [front, back, edge], glow.
        function paperSprite(V, S, A, o = {}) {
            const s = o.s || 0.25, th = o.thick || 0, fl = o.flip ? -1 : 1, a = o.ang || 0, Rx = Math.cos(a), Ry = Math.sin(a), Nx = -Ry, Ny = Rx;
            const sh = o.shade || [1, 0.62, 0.74], em = o.glow || 0, P = S.pts, E = S.ein, ax = S.anchor[0], ay = S.anchor[1], ox = S.rect[0], oy = S.rect[1];
            const at = (i, d) => { const u = (P[i * 2] - ax) * s * fl; return [(o.x || 0) + Rx * u + Nx * d, (o.y || 0) + Ry * u + Ny * d, (ay - P[i * 2 + 1]) * s]; };
            const uv = (x, y) => [(ox + x) / A[0], (oy + y) / A[1]];
            const tri = (p, t, shade, out) => { // the world is left-handed (x east, y south, z up): a face is front when (B-A)x(C-A) points INTO it
                const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
                const k = (uy * vz - uz * vy) * out[0] + (uz * vx - ux * vz) * out[1] + (ux * vy - uy * vx) * out[2], ord = k > 0 ? [0, 2, 1] : [0, 1, 2];
                for (const i of ord) V.push(p[i][0], p[i][1], p[i][2], t[i][0], t[i][1], shade, em); };
            const front = [Nx, Ny, 0], back = [-Nx, -Ny, 0], T = S.tris;
            for (let k = 0; k < T.length; k += 3) { const i = T[k], j = T[k + 1], m = T[k + 2], t = [uv(P[i * 2], P[i * 2 + 1]), uv(P[j * 2], P[j * 2 + 1]), uv(P[m * 2], P[m * 2 + 1])];
                tri([at(i, th / 2), at(j, th / 2), at(m, th / 2)], t, sh[0], front);              // the painted front
                tri([at(i, -th / 2), at(j, -th / 2), at(m, -th / 2)], t, sh[1], back); }          // the back: the same paint seen through, darker
            if (th > 0) for (let r = 0, b = 0; r < S.rings.length; b += S.rings[r++]) for (let n = S.rings[r], q = 0; q < n; q++) { // the card edge, one strip per outline segment
                const i = b + q, j = b + (q + 1) % n, dx = P[j * 2] - P[i * 2], dy = P[j * 2 + 1] - P[i * 2 + 1], c = uv(E[i * 2] + 0.5, E[i * 2 + 1] + 0.5), t = [c, c, c];
                const out = [Rx * -dy * fl, Ry * -dy * fl, -dx]; /* the outline runs counter-clockwise as seen, so outward is to its right: (-dy, dx) in sprite px, z flips */
                const f0 = at(i, th / 2), f1 = at(j, th / 2), b0 = at(i, -th / 2), b1 = at(j, -th / 2);
                tri([f0, f1, b1], t, sh[2], out); tri([f0, b1, b0], t, sh[2], out); }
            return V;
        }

        // ---- the GPU half: the shaders that draw the folded mesh (the game's camera in the vertex stage, the paper look in the fragment stage) ----
        // Vertex layout, 7 floats: aP = x y z (world px, z up), aT = u v (sheet), aS = shade, glow. Drawn with a depth buffer, back faces culled, sheet on texture unit 7, NEAREST filtering.
        const PAPER_GLSL = {
            vert: `attribute vec3 aP;attribute vec2 aT;attribute vec2 aS;uniform vec2 uA,uCS;uniform float uMag,uZ0,uHY;varying vec2 vT;varying vec3 vW;varying float vZ,vSh,vEm;
                    void main(){vec2 d=aP.xy-uA;float lx=d.x*uCS.x+d.y*uCS.y,ly=-d.x*uCS.y+d.y*uCS.x,z=uZ0-ly;
                      float n=3.,F=1400.,A=(F+n)/(F-n),B=-2.*F*n/(F-n);
                      gl_Position=vec4(lx*uMag*110./80.,z*(1.-uHY/72.)-((112.-uHY)*uZ0-uMag*110.*aP.z)/72.,A*z+B,z);
                      vT=aT;vW=aP;vZ=z;vSh=aS.x;vEm=aS.y;}`,
            frag: `precision mediump float;uniform sampler2D uSheet;uniform float uAmb,uFogD,uZc,uGlow,uGrade,uDS,uDesat,uTime;uniform vec3 uFogC,uTint;uniform vec3 uLW[8];uniform vec2 uRes;
                    varying vec2 vT;varying vec3 vW;varying float vZ,vSh,vEm;
                    float b2(vec2 a){a=floor(a);return fract(dot(a,vec2(.5,a.y*.75)));}float bayer(vec2 a){return b2(.5*a)*.25+b2(a);}
                    void main(){
                      vec4 t=texture2D(uSheet,vT);if(t.a<.5)discard;
                      vec2 gp=vec2(gl_FragCoord.x/uRes.x*160.,(1.-gl_FragCoord.y/uRes.y)*144.);float hd=length((gp-vec2(80.,90.))/vec2(44.,58.)),by=bayer(gl_FragCoord.xy/uDS);
                      if(vZ<uZc-8.&&by<clamp((1.-hd)*2.4,0.,1.)+(vZ<uZc*.6?.35:0.))discard; // anything between the lens and the hero fades away round him (and thins everywhere close to the lens)
                      if(vZ<uZc*.45&&by<.5)discard;                                       // right up against the lens: stippled away
                      float glass=step(t.a,.85),lantern=step(1.5,vEm),lamp=glass*min(vEm,1.)*uGlow;
                      vec2 sUv=vec2(gl_FragCoord.x/uRes.x,1.-gl_FragCoord.y/uRes.y);
                      vec3 c=t.rgb*vSh*mix(vec3(1.04,.98,.9),vec3(.9,.95,1.),sUv.y);
                      vec3 lit=vec3(0.);
                      for(int i=0;i<8;i++){vec3 L=uLW[i];if(L.z>0.){float f=smoothstep(L.z*1.3,0.,distance(vW,vec3(L.xy,i==7?14.:27.)));lit+=vec3(1.,.74,.38)*f*f;}}
                      lit*=mix(.3,1.,uGlow);                                              // lamps and the lantern only really tell on walls after dark
                      c=c*(vec3(uAmb)+lit*1.15)+lit*.05;
                      c=mix(c,vec3(1.,.76,.42)*(.9+.3*t.g)*(1.+lantern*.7),lamp);c+=vec3(1.,.7,.35)*.35*lantern*uGlow*(1.-glass); // a lamp behind the glass; street lanterns blaze
                      float zf=vZ-uZc+110.;
                      c=mix(c,uFogC,clamp(.10+(1.-uFogD)*.5+smoothstep(110.*1.02*uFogD,110.*3.4*uFogD,zf)*.95,0.,1.)*(1.-lamp*.55));
                      if(uGrade>.5){float l=dot(c,vec3(.299,.587,.114));c=mix(c,vec3(l)*vec3(.94,.98,1.04),uDesat);c*=uTint;c=pow(max(c,0.),vec3(1.12));
                        float g=fract(sin(dot(floor(sUv*vec2(480.,432.))+floor(uTime*24.)*vec2(7.,13.),vec2(12.9898,78.233)))*43758.5453);c+=(g-.5)*.055;}
                      c*=1.-smoothstep(.36,.86,distance(sUv,vec2(.5)))*mix(.35,.62,uGrade);
                      if(uGrade>.5)c=floor(clamp(c,0.,1.)*31.+bayer(gl_FragCoord.xy/uDS))/31.;
                      gl_FragColor=vec4(c,1.);}`
        };
