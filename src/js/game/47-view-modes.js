        // ================= VIEW MODES: the camera button next to the lens =================
        // Tap it to cycle: NORMAL -> FIRST PERSON -> INSPECT -> NORMAL.
        //  FIRST PERSON: the lens moves into Koto's head and looks the way he faces (he isn't drawn). Same controls; the view
        //    swings round to follow him when he turns.
        //  INSPECT (a test mode): Koto stands still and a see-through shadow circle walks instead. A readout says what is under
        //    it: the tile, whether it's solid, and any door, person, animal, wolf or building there.
        const VIEW = { mode: 'normal', ix: 0, iy: 0, info: '', infoKey: '', FP_Z: 34, FP_HY: 56, FP_MAG: 1.0, RANGE: 112 };
        function viewCan3D() { return FX_GL.ok && COMBAT.amt > 0.5 && (gameState === 'PLAYING' || gameState === 'INVENTORY'); }
        function viewCycle() {
            const next = { normal: 'first', first: 'inspect', inspect: 'normal' }[VIEW.mode] || 'normal';
            if (next === 'first' && !viewCan3D()) { VIEW.mode = 'first'; return viewCycle(); } // no 3D view here: skip straight to inspect
            VIEW.mode = next;
            if (next === 'inspect') { VIEW.ix = player.pixelX + 8; VIEW.iy = player.pixelY + 12; VIEW.infoKey = ''; player.isMoving = player.isMoving && false; }
            if (next === 'first') camRecenter();
            const el = document.getElementById('view-info'); if (el) el.style.display = next === 'inspect' ? 'block' : 'none';
            const b = document.getElementById('cam-btn'); if (b) b.dataset.mode = next;
            showFluidMessage(next === 'first' ? 'FIRST PERSON. Tap the camera again for the inspect circle.' : next === 'inspect' ? 'INSPECT: move the circle to read what is under it.' : 'Normal view.', 1500);
            try { audio.playSelect(); } catch (e) {}
        }
        function viewFirst() { return VIEW.mode === 'first' && viewCan3D(); }
        function viewAnchorShift() { // first person: the third-person anchor slides ahead so the lens (z0 behind it) sits in his head
            if (VIEW.mode === 'inspect') return [VIEW.ix - (player.pixelX + 8), VIEW.iy - (player.pixelY + 15)];
            if (!viewFirst()) return [0, 0];
            const yw = camYaw(); return [Math.sin(yw) * VIEW.FP_Z, -Math.cos(yw) * VIEW.FP_Z];
        }
        // STREET: the town's everyday camera, down at street level close behind him (the direction art: art-source/direction/03-street-level-town.jpg)
        const STREET = { on: true, z0: 70, mag: 2.0, hY: 20 };
        function viewStreet() { return STREET.on && VIEW.mode === 'normal' && currentMapName === 'overworld' && paperLive(); }
        function viewApply() { // each drawn frame, before the 3D layer reads the lens settings
            if (viewStreet()) { CINE.hY = STREET.hY; CINE.mag = STREET.mag + CAM.zoom * 0.6; return; }
            if (!viewFirst()) return;
            CINE.hY = VIEW.FP_HY; CINE.mag = VIEW.FP_MAG;
            if (!player.isMoving && CAM.back == null) { const v = DIR8_VEC[player.face8 || player.dir] || [0, -1], want = Math.atan2(v[0], -v[1]); let d = want - CAM.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 0.01) CAM.back = want; }
            else if (player.isMoving) camRecenter(); // the view keeps turning to wherever he walks
        }
        function viewInspectMove(dx, dy, fast) { // the circle walks instead of Koto
            const sp = fast ? 2.2 : 1.1; VIEW.ix += dx * sp; VIEW.iy += dy * sp;
            const hx = player.pixelX + 8, hy = player.pixelY + 12, ox = VIEW.ix - hx, oy = VIEW.iy - hy, d = Math.hypot(ox, oy);
            if (d > VIEW.RANGE) { VIEW.ix = hx + ox / d * VIEW.RANGE; VIEW.iy = hy + oy / d * VIEW.RANGE; } // stays within reach of him
            viewInspectRead();
        }
        function viewInspectRead() {
            const gx = Math.floor(VIEW.ix / TILE_SIZE), gy = Math.floor(VIEW.iy / TILE_SIZE), key = currentMapName + gx + ',' + gy;
            if (key === VIEW.infoKey) return; VIEW.infoKey = key;
            const L = [currentMapName.toUpperCase() + '  tile ' + gx + ',' + gy];
            try { L.push(isSolidTile(gx, gy) ? 'SOLID (blocks walking)' : 'open ground'); } catch (e) {}
            try { const k = currentMapName === 'overworld' ? paperKind(gx, gy) : ''; if (k) L.push({ h: 'house wall', d: 'house doorway', b: 'town block', t: 'tree line' }[k] || k); } catch (e) {}
            try { const ex = navExits(currentMapName).find(e => e.x === gx && e.y === gy); if (ex) L.push('DOOR to ' + ex.to); } catch (e) {}
            try { if (currentMapName === 'overworld') { const n = npcAt(gx, gy); if (n) L.push('PERSON: ' + n.name); } } catch (e) {}
            try { (wolves || []).forEach(w => { if (w.alive && w.gridX === gx && w.gridY === gy) L.push((w.kind === 'boxelder' ? 'BOXELDER' : 'WOLF') + (w.hp != null ? ' hp ' + w.hp : '')); }); } catch (e) {}
            try { if (currentMapName === 'overworld') HOMESTEAD.forEach(b => { if ((b.solid || []).some(s => s[0] === gx && s[1] === gy) || (Math.abs(b.x - gx) < 0.6 && b.y === gy)) L.push('BUILDING: ' + b.art); }); } catch (e) {}
            try { if (HORSE.map === currentMapName && HORSE.x === gx && HORSE.y === gy) L.push('THE HORSE'); } catch (e) {}
            try { if (player.gridX === gx && player.gridY === gy) L.push('KOTO'); } catch (e) {}
            VIEW.info = L.join('\n'); const el = document.getElementById('view-info'); if (el) el.textContent = VIEW.info;
        }
        function drawInspectCircle() { // a see-through shadow on the ground, with a faint ring so it reads on dark ground too
            if (VIEW.mode !== 'inspect') return;
            const fx = VIEW.ix, fy = VIEW.iy + 3, t = performance.now() / 600;
            asCard(fx, fy, () => {
                ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.beginPath(); ctx.ellipse(fx, fy, 7, 2.6, 0, 0, 7); ctx.fill();
                ctx.strokeStyle = 'rgba(186,230,253,' + (0.5 + 0.3 * Math.sin(t)) + ')'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.ellipse(fx, fy, 7.5, 2.9, 0, 0, 7); ctx.stroke();
                ctx.fillStyle = 'rgba(186,230,253,0.85)'; ctx.fillRect(fx - 0.5, fy - 1, 1, 1); ctx.restore();
            });
        }
        document.addEventListener('DOMContentLoaded', () => {
            const b = document.getElementById('cam-btn'); if (b) b.addEventListener('click', e => { e.stopPropagation(); viewCycle(); });
            window.addEventListener('keydown', e => { if ((e.key === 'g' || e.key === 'G') && gameStarted) viewCycle(); });
        });
