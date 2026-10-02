        // ================= NIGHT PATROL: by night you walk (or ride) the sleeping town and look into what isn't right =================
        // One report a night. You gather clues rather than fight; whatever you find out tends to leave a mark on the farm by morning.
        const PATROL_KINDS = {
            footprints: { teaser: 'Someone heard bare feet on the cobbles near the fountain.', from: [30, 13], to: [22, 6],
                clue: 'Bare footprints, wet, from the fountain to a blank wall on the west side of the square. They stop at the stones. There is no door.',
                echo: 'Muddy bare footprints circle the farmhouse twice, then stop at the well.', wife: 'I found footprints in the mud by the north field. Small ones. Bare.' },
            missing: { teaser: 'Clito\'s lantern has gone missing from his door.', at: [33, 7],
                clue: 'Clito\'s lantern, sitting on the rim of the fountain, still lit. Nobody in town admits to carrying it there. The oil is full.',
                echo: 'Your scarecrow\'s hat is gone. Hung on the post in its place: a lantern, still burning.', wife: 'There was a lantern on the scarecrow this morning. I didn\'t light it. Did you?' },
            sound: { teaser: 'A knocking from the empty market stalls.', at: [24, 3],
                clue: 'Knocking from under the canvas of the west stall. You lift it: nothing but turnips, set out in a perfect circle. The knocking stops when you look.',
                echo: 'Turnips you never planted have come up overnight, in a perfect circle.', wife: 'There are turnips in a ring by the fence. I didn\'t sow those.' },
            sighting: { teaser: 'Somebody\'s standing in the street where nobody should be.', at: [66, 12],
                clue: 'A figure at the far end of the avenue, perfectly still, facing the wall. You came close and there was nothing. Not even breath on the air.',
                echo: 'The irrigation ditch is flowing backward.', wife: 'The ditch is running the wrong way. Water doesn\'t do that.' }
        };
        const PATROL = { prints: null, told: -1 };
        function patrolState() { const F = farmState(); return F.patrol || (F.patrol = { day: -1, kind: null, done: false, echo: null, wife: null }); }
        function patrolTonight() { // the report for this night (night belongs to the day it started on)
            const P = patrolState(), h = gameHour(), d = gameDay() - (h < 6 ? 1 : 0);
            if (P.day !== d) { P.day = d; P.done = false; const ks = Object.keys(PATROL_KINDS); P.kind = ks[Math.floor(hash1(d * 97 + 13) * ks.length)]; PATROL.prints = null; }
            return P;
        }
        function patrolLive() { return currentMapName === 'overworld' && isNight() && gameStarted && player.gridY < FIELD_TOP; }
        function patrolPrints() { // the trail of footprints, laid along the streets
            if (PATROL.prints) return PATROL.prints; const K = PATROL_KINDS.footprints, path = [K.from].concat(townPath(K.from[0], K.from[1], K.to[0], K.to[1])), out = [];
            for (let i = 0; i < path.length; i++) { const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)]; out.push({ x: path[i][0], y: path[i][1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]), side: i % 2 }); }
            return PATROL.prints = out;
        }
        function patrolTarget() { const P = patrolTonight(); if (P.done || !P.kind) return null; if (P.kind === 'footprints') { const pr = patrolPrints(); return pr.length ? [pr[pr.length - 1].x, pr[pr.length - 1].y] : null; } return PATROL_KINDS[P.kind].at; }
        function patrolResolve(P) { const K = PATROL_KINDS[P.kind]; P.done = true; P.echo = K.echo; P.wife = K.wife; logClue(K.clue, 'CLUE'); }
        function patrolStep() { // every farm tick
            if (!patrolLive()) return; const P = patrolTonight();
            if (PATROL.told !== P.day && !P.done) { PATROL.told = P.day; showFluidMessage('NIGHT PATROL. The shops are shut. A report: ' + PATROL_KINDS[P.kind].teaser, 4200); }
            const t = patrolTarget(); if (!t || P.done) return; const d = Math.hypot(t[0] - player.gridX, t[1] - player.gridY);
            if (P.kind === 'sighting' && d < 6) { patrolResolve(P); showDialogue('...nothing. There is nobody there.\n' + PATROL_KINDS.sighting.clue); return; }
            if (P.kind === 'sound' && d < 9 && performance.now() > (PATROL.knock || 0)) { PATROL.knock = performance.now() + 2600; const v = 0.03 + 0.09 * (1 - d / 9); audio.playTone && (audio.playTone(95, 'square', 0.09, v), setTimeout(() => audio.playTone(88, 'square', 0.09, v), 170)); }
        }
        function patrolInteract() { // [A] beside whatever the report was about
            if (!patrolLive()) return false; const P = patrolTonight(), t = patrolTarget(); if (!t || P.done || P.kind === 'sighting') return false;
            if (Math.max(Math.abs(t[0] - player.gridX), Math.abs(t[1] - player.gridY)) > 1) return false;
            patrolResolve(P); showDialogue(PATROL_KINDS[P.kind].clue); return true;
        }
        function drawPatrolGround() { // flat on the street: the footprints, faintly luminous
            if (!patrolLive()) return; const P = patrolTonight(); if (P.kind !== 'footprints' || P.done) return;
            for (const s of patrolPrints()) { const cx = s.x * 16 + 8, cy = s.y * 16 + 8, n = [-Math.sin(s.ang), Math.cos(s.ang)], o = s.side ? 2.5 : -2.5;
                ctx.save(); ctx.translate(cx + n[0] * o, cy + n[1] * o); ctx.rotate(s.ang + Math.PI / 2); ctx.scale(1.8, 1.8); ctx.fillStyle = 'rgba(120,200,255,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 4.4, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(225,246,255,.97)';
                ctx.beginPath(); ctx.ellipse(0, 0.8, 1.5, 2.4, 0, 0, 7); ctx.fill(); for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(k * 1.1, -2.4, 0.55, 0, 7); ctx.fill(); }
                ctx.restore(); }
        }
        function drawPatrolCards() { // standing things: the lantern on the rim, the figure in the street
            if (!patrolLive()) return; const P = patrolTonight(); if (P.done) return; const K = PATROL_KINDS[P.kind];
            if (P.kind === 'missing') { const cx = K.at[0] * 16 + 8, fy = K.at[1] * 16 + 15, fl = 0.75 + 0.25 * Math.sin(performance.now() / 120);
                asCard(cx, fy, () => { ctx.fillStyle = 'rgba(255,190,90,' + (0.25 * fl).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(cx, fy - 5, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#2b2b2e'; ctx.fillRect(cx - 2.5, fy - 9, 5, 1); ctx.fillRect(cx - 2, fy - 1, 4, 1); ctx.fillRect(cx - 0.5, fy - 11, 1, 2);
                    ctx.fillStyle = 'rgba(255,214,120,' + fl.toFixed(2) + ')'; ctx.fillRect(cx - 2, fy - 8, 4, 7); ctx.fillStyle = '#2b2b2e'; ctx.fillRect(cx - 0.3, fy - 8, 0.6, 7); }); }
            if (P.kind === 'sighting') { const cx = K.at[0] * 16 + 8, fy = K.at[1] * 16 + 15;
                asCard(cx, fy, () => { ctx.fillStyle = 'rgba(96,104,130,.92)'; ctx.beginPath(); ctx.ellipse(cx, fy - 25, 2.6, 3.2, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - 3.2, fy - 21); ctx.lineTo(cx + 3.2, fy - 21); ctx.lineTo(cx + 4, fy); ctx.lineTo(cx - 4, fy); ctx.closePath(); ctx.fill(); }); }
        }
