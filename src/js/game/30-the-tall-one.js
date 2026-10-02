        // ================= THE TALL ONE: a stalker in the shape of a neighbour, kept at the old, oversized scale and gone to shadow =================
        // Townsfolk now stand at Koto's scale. The old, larger scale is kept here (FOLK_SIZE.big) and given to one figure only.
        // Some nights (the 113 seed picks which) it follows you through Brennan's Theme and Rahjai: always behind, never close.
        // It never attacks. The longer it follows, the more your NERVE drains; with no nerve left, your health starts to go.
        // Street lamps hold it off (stand in their light and it stops), it melts away if you turn and walk at it, and dawn ends it.
        const FOLK_SIZE = { human: 24, child: 18, big: 1.15 * 16 * 1.35 }; // px tall at Koto's scale; the stalker keeps the old width (x1.35)
        function folkWidth(f) { const fr = FARM_ART.F[f.art], h = f.id === 'child' ? FOLK_SIZE.child : FOLK_SIZE.human; return fr ? h * fr[2] / fr[3] : 1.15 * 16; }
        const playerNerve = { current: 100, max: 100 };
        const STALK = { on: false, night: -1, x: 0, y: 0, px: 0, py: 0, wait: 0, steps: 0, back: 0, followT: 0, told: 0, gone: 0, art: 'f_farmer' };
        function stalkLampNear() { const lamps = FX_GL.lamps || []; const hx = player.pixelX + 8, hy = player.pixelY + 8; return lamps.some(l => Math.hypot(l[0] - hx, l[1] - hy) < 40); }
        function stalkStep() { // once per simulation step
            if (!gameStarted || gameState !== 'PLAYING') return;
            const here = currentMapName === 'overworld', night = isNight(), day = gameDay() - (gameHour() < 6 ? 1 : 0), now = performance.now();
            if (!night && STALK.on) { STALK.on = false; showFluidMessage('Morning. Whatever was following you is gone.', 2600); }
            const stalked = STALK.on && here && Math.hypot(STALK.x - player.gridX, STALK.y - player.gridY) < 13, lit = stalked && stalkLampNear();
            // nerve: drains while followed (faster the longer it goes on), comes back in lamplight, by day, or indoors
            if (stalked && !lit) { STALK.followT++; playerNerve.current = Math.max(0, playerNerve.current - (0.006 + STALK.followT * 0.0000015)); }
            else playerNerve.current = Math.min(playerNerve.max, playerNerve.current + (lit ? 0.03 : 0.012));
            if (playerNerve.current <= 0 && stalked && now > (STALK.hurtT || 0)) { STALK.hurtT = now + 4000; if (playerHealth.current > 15) { playerHealth.current--; updateHealthBar && updateHealthBar(); } }
            if (stalked && playerNerve.current < 50 && STALK.told === 1) { STALK.told = 2; showFluidMessage('Your hands won\'t stop shaking. Find a lamp.', 2800); }
            if (!here || !night) return;
            if (!STALK.on) { // a night it chooses, after half past nine, once a night
                if (STALK.night === day || gameHour() < 21.5 && gameHour() > 6 || now < STALK.gone) return;
                if (paperHash(day, PAPER.PRIME, 7) >= 0.4) { STALK.night = day; return; }
                const fv = DIR8_VEC[player.face8 || player.dir] || [0, 1], spot = townSpotNear(player.gridX - fv[0] * 12, player.gridY - fv[1] * 12);
                if (!spot) return; STALK.on = true; STALK.night = day; STALK.x = spot[0]; STALK.y = spot[1]; STALK.px = STALK.x * 16; STALK.py = STALK.y * 16; STALK.followT = 0;
                if (!STALK.told) { STALK.told = 1; setTimeout(() => showFluidMessage('Footsteps behind you. They stop when yours do.', 3000), 2500); }
                return;
            }
            if (STALK.px !== STALK.x * 16 || STALK.py !== STALK.y * 16) { const dx = STALK.x * 16 - STALK.px, dy = STALK.y * 16 - STALK.py, d = Math.hypot(dx, dy), m = Math.min(d, 0.9); STALK.px += dx / d * m; STALK.py += dy / d * m; return; }
            const d = Math.hypot(STALK.x - player.gridX, STALK.y - player.gridY);
            if (d < 3.2) { STALK.on = false; STALK.gone = now + 25000; STALK.night = -1; showFluidMessage('There\'s nobody there.', 2000); return; } // walk at it and it isn't there
            if (stalkLampNear()) return;                                                   // it won't come into the light
            if (++STALK.wait < 26) return; STALK.wait = 0;
            const fv = DIR8_VEC[player.face8 || player.dir] || [0, 1], tx = player.gridX - fv[0] * 6, ty = player.gridY - fv[1] * 6; // always a little way behind you
            const path = townPath(STALK.x, STALK.y, tx, ty); const nx = path.length ? path[0] : null;
            if (!nx || Math.max(Math.abs(nx[0] - player.gridX), Math.abs(nx[1] - player.gridY)) < 4) return;
            STALK.flip = nx[0] < STALK.x ? true : nx[0] > STALK.x ? false : STALK.flip; STALK.x = nx[0]; STALK.y = nx[1];
            if (++STALK.steps % 3 === 0 && audio.playTone) audio.playTone(46 + Math.random() * 6, 'sine', 0.5, 0.025); // a footfall you feel more than hear
        }
        function townSpotNear(x, y) { const q = [[Math.round(x), Math.round(y)]], seen = new Set(); while (q.length && seen.size < 300) { const [a, b] = q.shift(), k = a + ',' + b; if (seen.has(k)) continue; seen.add(k); if (townOpen(a, b)) return [a, b]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.push([a + dx, b + dy]); } return null; }
        function drawStalker() { // the old big scale, gone to shadow, two pale points where eyes would be
            if (!STALK.on || currentMapName !== 'overworld') return; const cx = STALK.px + 8, fy = STALK.py + 15, w = FOLK_SIZE.big, fr = FARM_ART.F[STALK.art], hh = fr ? w * fr[3] / fr[2] : 40;
            asCard(cx, fy, () => {
                farmSprite(STALK.art, cx, fy, w, STALK.flip);
                if (cardMode()) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(5,4,9,0.93)'; ctx.fillRect(0, 0, 128, 128); ctx.restore(); }
                ctx.fillStyle = 'rgba(214,220,235,.85)'; ctx.fillRect(cx - 2.5, fy - hh * 0.86, 1, 1); ctx.fillRect(cx + 1.5, fy - hh * 0.86, 1, 1);
            });
        }
        function nerveGrade(R) { const k = 1 - playerNerve.current / playerNerve.max; if (k > 0.01 && R) { R.ds = Math.min(1, (R.ds || 0) + k * 0.55); } return R; } // fear drains the colour out
        function folkAt(gx, gy) { if (currentMapName !== 'overworld') return null; for (const f of FOLK) { const p = folkWhere(f); if (p && p[0] === gx && p[1] === gy && f.id !== 'sister') return f; } return null; }
        function hearts(n) { const k = Math.round(n / 10); return '♥'.repeat(k) + '♡'.repeat(10 - k); }
        function friendOf(id) { const F = farmState(); return F.friends[id] || (F.friends[id] = { pts: 0, talked: -1 }); }
        function talkFolk(f) {
            const F = farmState(), fr = friendOf(f.id), today = gameDay();
            { const n = TOWN.live[f.id]; if (n) { n.talkT = 360; n.flip = player.gridX < n.x; if (f.id === 'sudashorn') n.spinAt = performance.now(); } } // they stop to talk (Sudashorn twirls round to face you)
            if (f.stall) { openFarmStall(f); return; }
            if (fr.talked !== today) { fr.talked = today; fr.pts = Math.min(100, fr.pts + 3); }
            const best = fr.pts >= 100, married = F.spouse === f.id;
            const line = married ? spouseLine() : f.lines[Math.min(f.lines.length - 1, Math.floor(fr.pts / (100 / f.lines.length)))];
            const head = f.name + (married ? '  (YOUR WIFE)' : best ? '  (BEST FRIEND)' : '') + '\n' + hearts(fr.pts) + '\n' + line;
            const ch = [{ label: 'GIVE A GIFT', handler: () => giftMenu(f) }];
            if (f.spouse && best && !F.spouse) ch.push({ label: 'ASK HER TO MARRY YOU', handler: () => propose(f) });
            if (married) ch.push(F.follow ? { label: 'GO HOME AND REST', handler: () => { F.follow = false; openNpcConversation(f.name + ': "I\'ll have the lamp lit when you get back."', [{ label: 'LEAVE', handler: hideDialogue }]); } }
                                          : { label: 'COME ADVENTURE WITH ME', handler: () => { if (F.pregnant) { openNpcConversation(f.name + ': "Not now, love. The baby and I are staying close to home."', [{ label: 'LEAVE', handler: hideDialogue }]); return; } F.follow = true; LIFE.trail = []; openNpcConversation(f.name + ': "Finally. Lead the way."', [{ label: 'LEAVE', handler: hideDialogue }]); } });
            ch.push({ label: 'GOODBYE', handler: hideDialogue });
            openNpcConversation(head, ch);
        }
        function spouseLine() { const h = gameHour(); return h < 10 ? '"Morning. I fed the hens already. Go on, the field is waiting."' : h < 17 ? '"Bring me back something strange from out there. And yourself."' : '"Supper is warm. Come inside before the fog does."'; }
        function giftMenu(f) {
            const F = farmState(), fr = friendOf(f.id), opts = [];
            const give = (label, take, pts, reply) => opts.push({ label, handler: () => { take(); fr.pts = Math.min(100, fr.pts + pts); audio.playSelect(); updateFarmHud();
                const best = fr.pts >= 100 && !fr.best; if (best) fr.best = true;
                openNpcConversation(f.name + '\n' + hearts(fr.pts) + '\n' + reply + (best ? '\n\n★ ' + f.name + ' IS NOW YOUR BEST FRIEND.' + (f.spouse && !F.spouse ? ' (You could ask her to marry you.)' : '') : ''), [{ label: 'LEAVE', handler: hideDialogue }]); } });
            if (F.pantry.dish > 0) give('BUTTER GARLIC HERB CHICKEN PASTA', () => F.pantry.dish--, 100, f.name + ' takes one bite and goes quiet.\n"...You made this? For me?"');
            for (const k of Object.keys(CROPS)) if (F.crops[k] > 0) give(CROPS[k].name, () => F.crops[k]--, 6, '"Fresh from Rahjai? Thank you."');
            for (const k of Object.keys(GOODS)) if (F.goods[k] > 0) give(GOODS[k].name, () => F.goods[k]--, 5, '"For me? That\'s kind of you."');
            if (F.pantry.herbs > 0) give('HERBS', () => F.pantry.herbs--, 3, '"They smell like the field after rain."');
            grove(); if (F.hollowGoods.flowers > 0) give('WILDFLOWERS', () => F.hollowGoods.flowers--, 8, '"From the hollow? Nobody brings me flowers."');
            if (F.hollowGoods.fruit > 0) give('HOLLOW FRUIT', () => F.hollowGoods.fruit--, 5, '"It tastes like the woods smell."');
            if (F.hollowGoods.blossoms > 0) give('BLOSSOMS', () => F.hollowGoods.blossoms--, 6, '"I\'ll put them in water."');
            opts.push({ label: 'NEVER MIND', handler: () => talkFolk(f) });
            openNpcConversation(opts.length > 1 ? 'What will you give ' + f.name + '?' : 'You have nothing to give yet. Farm, forage, or cook something.', opts);
        }
        function propose(f) {
            const F = farmState(); F.spouse = f.id; F.follow = false; F.wedDay = gameDay(); audio.playClue && audio.playClue();
            openNpcConversation(f.name + ' covers her mouth with both hands.\n"Yes. Yes, of course yes."\n\nShe will live with you at the farmhouse in Rahjai, or come with you into the outlands when you ask.', [{ label: 'HOLD HER HAND', handler: hideDialogue }]);
        }
        // ---- the stall: the merchant buys your harvest and sells seeds and chicken ----
        function openFarmStall(f) {
            const F = farmState(), ch = [];
            grove(); const HG = F.hollowGoods;
            const worth = Object.keys(CROPS).reduce((a, k) => a + F.crops[k] * CROPS[k].sell, 0) + Object.keys(GOODS).reduce((a, k) => a + F.goods[k] * GOODS[k].sell, 0) + Object.keys(HOLLOW_GOODS).reduce((a, k) => a + HG[k] * HOLLOW_GOODS[k].sell, 0);
            if (worth) ch.push({ label: 'SELL THE BASKET  (+' + worth + ' COINS)', handler: () => { Object.keys(CROPS).forEach(k => F.crops[k] = 0); Object.keys(GOODS).forEach(k => F.goods[k] = 0); Object.keys(HOLLOW_GOODS).forEach(k => HG[k] = 0); F.coins += worth; audio.playClue && audio.playClue(); updateFarmHud(); openFarmStall(f); } });
            for (const k of Object.keys(CROPS)) { const c = CROPS[k]; ch.push({ label: 'BUY ' + c.name + ' SEED  ' + c.seed + 'c  (' + c.days + ' DAYS, SELLS ' + c.sell + 'c)  HAVE ' + F.seeds[k], handler: () => {
                if (F.coins < c.seed) { showFluidMessage('Not enough coins.', 1000); return; } F.coins -= c.seed; F.seeds[k]++; F.seedPick = k; audio.playSelect(); updateFarmHud(); openFarmStall(f); } }); }
            ch.push({ label: 'BUY A CHICKEN FOR THE POT  5c  HAVE ' + F.pantry.chicken, handler: () => { if (F.coins < 5) { showFluidMessage('Not enough coins.', 1000); return; } F.coins -= 5; F.pantry.chicken++; audio.playSelect(); updateFarmHud(); openFarmStall(f); } });
            if (!F.can) ch.push({ label: 'WIDE WATERING CAN  15c  (WATERS THREE PLOTS)', handler: () => { if (F.coins < 15) { showFluidMessage('Not enough coins.', 1000); return; } F.coins -= 15; F.can = 1; audio.playSelect(); updateFarmHud(); openFarmStall(f); } });
            ch.push({ label: 'LEAVE', handler: hideDialogue });
            const intro = F.met ? '' : 'Rahjai is good ground. Plant, water, sell your harvest here.\n'; F.met = true;
            openNpcConversation('MERCHANT\n' + intro + 'COINS ' + F.coins + '   NEXT SEED: ' + CROPS[F.seedPick].name, ch);
        }
        // ---- home: sleep, the kitchen, the pantry ----
        function openHome() {
            const F = farmState(), sp = F.spouse && FOLK.find(x => x.id === F.spouse);
            const ch = [{ label: 'SLEEP UNTIL MORNING', handler: sleepUntilMorning }, { label: 'THE KITCHEN', handler: openKitchen }, { label: 'THE BASEMENT', handler: openBasement }, { label: 'LEAVE', handler: hideDialogue }];
            const who = sp && !F.follow ? sp.name + (isNight() ? ' is by the stove. "There you are."' : ' is out in the yard.') : 'The house is small and quiet. It smells like woodsmoke.';
            openNpcConversation('HOME\n' + who + (F.pregnant ? '\n(' + sp.name + ' is resting. The baby is coming soon.)' : ''), ch);
        }
        function openBasement() { // under the farmhouse: what great-grandmother left behind
            const F = farmState(), first = !F.scrollRead;
            openNpcConversation(first ? 'THE BASEMENT\nYou lift the trapdoor. Cold air, dust, jars of something long gone to vinegar. Under a sheet, a cedar chest, and in it a scroll tied with faded red thread.'
                                      : 'THE BASEMENT\nThe cedar chest, the jars, the cold. Great-grandmother\'s scroll is where you left it.',
                [{ label: first ? 'UNTIE THE SCROLL' : 'READ THE SCROLL AGAIN', handler: readScroll }, { label: 'GO BACK UP', handler: hideDialogue }]);
        }
        function readScroll() {
            const F = farmState(); hideDialogue(); const el = document.getElementById('scroll-screen'); if (el) el.style.display = 'flex'; audio.playSelect && audio.playSelect();
            if (!F.scrollRead) { F.scrollRead = true; const c = "Great-grandmother's scroll: in every age the Supreme Spirit sends a dew drop of its power to one human. In this age it is a child."; if (!journal.importantClues.includes(c)) journal.importantClues.push(c); }
        }
        function closeScroll() { const el = document.getElementById('scroll-screen'); if (el) el.style.display = 'none'; const F = farmState(); if (F.scrollRead && !F.scrollTold) { F.scrollTold = true; showFluidMessage('[Journal updated: IMPORTANT CLUE] Great-grandmother knew.', 2600); } }
        window.closeScroll = closeScroll;
        function pantryText() { const F = farmState(); return Object.keys(PANTRY).filter(k => k !== 'dish').map(k => PANTRY[k] + ' ' + F.pantry[k]).join('   ') + '   MILK ' + F.goods.milk + '   EMBERWHEAT ' + F.crops.emberwheat + (F.pantry.dish ? '\nDISHES READY: ' + F.pantry.dish : ''); }
        function openKitchen() {
            const F = farmState(), P = F.pantry, ch = [];
            ch.push({ label: 'CHURN BUTTER  (2 MILK)', handler: () => { if (F.goods.milk < 2) { showFluidMessage('You need 2 milk. Marigold and Pepper give milk.', 1600); return; } F.goods.milk -= 2; P.butter++; audio.playSelect(); openKitchen(); } });
            ch.push({ label: 'MAKE PASTA  (1 EMBERWHEAT)', handler: () => { if (F.crops.emberwheat < 1) { showFluidMessage('You need emberwheat from the field.', 1600); return; } F.crops.emberwheat--; P.pasta++; audio.playSelect(); openKitchen(); } });
            ch.push({ label: 'COOK BUTTER GARLIC HERB CHICKEN PASTA', handler: () => {
                const need = ['butter', 'garlic', 'herbs', 'chicken', 'pasta'].filter(k => P[k] < 1);
                if (need.length) { showFluidMessage('Still missing: ' + need.map(k => PANTRY[k]).join(', ') + '.', 2200); return; }
                ['butter', 'garlic', 'herbs', 'chicken', 'pasta'].forEach(k => P[k]--); P.dish++; audio.playClue && audio.playClue();
                openNpcConversation('The kitchen fills with butter and garlic and something green and bright.\n\nYou made BUTTER GARLIC HERB CHICKEN PASTA. Someone special should taste this.', [{ label: 'BACK', handler: hideDialogue }]); } });
            ch.push({ label: 'BACK', handler: hideDialogue });
            openNpcConversation('THE KITCHEN\n' + pantryText(), ch);
        }
        function sleepUntilMorning() {
            hideDialogue(); const F = farmState(), ms = DAY_MS - (gameNow() % DAY_MS) + 1500; // to six in the morning
            const fade = document.getElementById('sleep-fade'); if (fade) { fade.textContent = ''; fade.classList.add('on'); }
            setTimeout(() => {
                zoneFlags.timeOff = (zoneFlags.timeOff || 0) + ms; playerHealth.current = playerHealth.max; updateHealthBar && updateHealthBar();
                farmT = 0; farmStep(); saveGame();
                if (fade) { fade.textContent = 'DAY ' + F.lived + '  ·  ' + WEATHER_TAG[weatherNow()]; setTimeout(() => fade.classList.remove('on'), 1500); }
            }, 900);
        }
        // ---- foraging: wild herbs and garlic come up along the field edges every morning ----
        const FORAGE = [{ k: 'herbs', at: [7, 22] }, { k: 'herbs', at: [27, 21] }, { k: 'herbs', at: [52, 20] }, { k: 'garlic', at: [6, 19] }, { k: 'garlic', at: [30, 22] }, { k: 'herbs', at: [44, 18] }];
        FORAGE.forEach(n => { n.pos = null; });
        function forageLive(n) { if (!n.pos) n.pos = folkPos({ id: 'fg' + n.at, at: n.at }); return farmState().forage[n.at] === gameDay() ? null : n.pos; }
        function forageAt(gx, gy) { if (currentMapName !== 'overworld') return null; return FORAGE.find(n => { const p = forageLive(n); return p && p[0] === gx && p[1] === gy; }) || null; }
        // ---- A on anything here ----
        function farmInteract() {
            if (currentMapName !== 'overworld' || inDialogue || POUCH.state || HORSE.mounted) return false;
            const v = DIR8_VEC[player.dir] || [0, 1], fx = player.gridX + v[0], fy = player.gridY + v[1], F = farmState(), say = (t, ms) => showFluidMessage(t, ms || 1600);
            const fo = folkAt(fx, fy); if (fo) { talkFolk(fo); return true; }
            const house = HOMESTEAD[0]; if ((fx === house.door[0] && fy === house.door[1]) || (player.gridX === house.door[0] && player.gridY === house.door[1])) { enterFarmhouse(); return true; }
            if (FARM_SOLID.has(fx + ',' + fy) && HOMESTEAD[1].solid.some(([x, y]) => x === fx && y === fy)) { const m = FOLK.find(x => x.stall); openFarmStall(m); return true; }
            const an = animalAt(fx, fy); if (an) { petAnimal(an); return true; }
            const fg = forageAt(fx, fy) || forageAt(player.gridX, player.gridY); if (fg) { F.forage[fg.at] = gameDay(); F.pantry[fg.k]++; audio.playClue && audio.playClue(); say('You gather wild ' + PANTRY[fg.k].toLowerCase() + '.  (' + F.pantry[fg.k] + ' in the pantry)'); updateFarmHud(); return true; }
            if (player.gridY < FIELD_TOP - 1) return false;
            let x = fx, y = fy, p = plotAt(x, y); if (!p) { x = player.gridX; y = player.gridY; p = plotAt(x, y); } if (!p) return false;
            const C = p.c && CROPS[p.c]; audio.playActionSound();
            if (p.s === 'wild') { p.s = 'tilled'; say('You break the hard Rahjai ground. [A] again to plant.'); }
            else if (p.s === 'tilled') {
                const k = F.seeds[F.seedPick] > 0 ? F.seedPick : Object.keys(CROPS).find(c => F.seeds[c] > 0);
                if (!k) say('No seeds left. The merchant at the stall sells them.', 2200);
                else { F.seeds[k]--; Object.assign(p, { s: 'planted', c: k, g: 0, w: weatherNow() === 'rain' || weatherNow() === 'storm' }); say('Planted ' + CROPS[k].name + '.' + (p.w ? ' The rain will water it.' : ' Water it, [A] again.') + '  (' + F.seeds[k] + ' seeds left)', 2000); }
            } else if (cropRipe(p)) { F.crops[p.c]++; say('Harvested ' + C.name + '!  (' + F.crops[p.c] + ' in the basket)', 2000); Object.assign(p, { s: 'tilled', c: null, g: 0, w: false }); }
            else if (!p.w) { let n = 0; for (const dx of F.can ? [-1, 0, 1] : [0]) { const q = plotAt(x + dx, y); if (q && q.s === 'planted' && !q.w && !cropRipe(q)) { q.w = true; n++; } }
                say(n > 1 ? 'You water ' + n + ' plots. They grow at dawn.' : 'Watered. It grows at dawn.', 1800); }
            else { const d = C.days - p.g; say(C.name + ': ripe in ' + d + ' dawn' + (d > 1 ? 's' : '') + '.'); }
            updateFarmHud(); return true;
        }
        function petAnimal(a) {
            const F = farmState(), st = F.animals[a.id] || (F.animals[a.id] = { love: 0, pet: -1, got: -9 }), today = gameDay(), s = animalLive(a);
            let msg = '';
            if (st.pet !== today) { st.pet = today; st.love = Math.min(10, st.love + 1); msg = a.lines[Math.min(2, Math.floor(st.love / 4))] + '  ♥ ' + st.love + '/10'; }
            else msg = a.name + ' is content.  ♥ ' + st.love + '/10';
            if (a.gives && today - st.got >= a.every && st.love >= 1) { st.got = today; const n = st.love >= 7 ? 2 : 1; F.goods[a.gives] += n; msg += '   +' + n + ' ' + GOODS[a.gives].name; }
            s.bob = 1; audio.playSelect(); showFluidMessage(msg, 2400); updateFarmHud();
        }
        function updateFarmHud() {
            const el = document.getElementById('farm-hud'); if (!el) return;
            const hollow = currentMapName === 'wolf_hollow', show = (hollow || (currentMapName === 'overworld' && player.gridY >= FIELD_TOP - 2)) && gameState === 'PLAYING' && !cinematicMode; el.classList.toggle('visible', show); if (!show) return;
            if (hollow) { const G = grove(), HG = farmState().hollowGoods, carry = Object.values(HG).reduce((a, b) => a + b, 0), ready = G.filter(plantReady).length;
                const h2 = '<b>GROW HOLLOW</b> ' + G.length + ' PLANTS · ' + ready + ' READY · CARRYING ' + carry; if (el.dataset.h !== h2) { el.dataset.h = h2; el.innerHTML = h2; } return; }
            const F = farmState(), basket = Object.values(F.crops).reduce((a, b) => a + b, 0) + Object.values(F.goods).reduce((a, b) => a + b, 0);
            const raid = F.raid ? '  ☾ WOLF MOON: ' + wolves.filter(w => w.alive && w.raider).length : '';
            const html = '<b>RAHJAI</b> DAY ' + F.lived + ' · ' + WEATHER_TAG[weatherNow()] + ' · ' + F.coins + 'c · BASKET ' + basket + raid;
            if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
        }
        // ---- the life tick ----
        const LIFE = { sister: null, wrong: null, trail: [], flashT: 0, nextFlash: 0, horseHome: -1 };
        let farmT = 0;
        function farmStep() {
            const now = performance.now(); if (now - farmT < 200 || !gameStarted) return; farmT = now;
            const F = farmState(), night = isNight(), day = gameDay(), h = gameHour(), wx = weatherNow();
            const planted = FARM_PLOTS.map(([x, y]) => [x, y, F.plots[x + ',' + y]]).filter(q => q[2] && q[2].s === 'planted');
            for (const [x, y] of FARM_PLOTS) { // crops are something the wolves will go for, but only when the wolf moon is up
                const p = F.plots[x + ',' + y], id = 'crop_' + x + '_' + y, t = GUARD_TARGETS.get(id);
                if (p && p.s === 'planted') {
                    if (!t) registerGuardTarget({ id, map: 'overworld', gridX: x, gridY: y, hp: 40, maxHp: 40, radius: 1.5, name: 'The ' + CROPS[p.c].name, draw: () => {},
                        onDestroyed: () => { const q = F.plots[x + ',' + y]; if (q && q.s === 'planted') { showFluidMessage('The wolves tore up the ' + CROPS[q.c].name + '!', 1800); Object.assign(q, { s: 'tilled', c: null, g: 0, w: false }); } unregisterGuardTarget(id); } });
                    else t.radius = F.raid ? 18 : 1.5;
                } else if (t) unregisterGuardTarget(id);
            }
            if (day !== F.day) { // dawn
                const steps = Math.min(3, day - F.day); F.day = day; let grew = 0, lost = 0;
                if (F.away && F.raid && planted.length) for (const [, , p] of planted) if (Math.random() < 0.4) { Object.assign(p, { s: 'tilled', c: null, g: 0, w: false }); lost++; }
                for (const [, , p] of planted) if (p.s === 'planted') { if (p.w && p.g < CROPS[p.c].days) { p.g++; grew++; } p.w = false; }
                const nw = weatherOf(day); if (nw === 'rain' || nw === 'storm') for (const [, , p] of planted) if (p.s === 'planted') p.w = true; // rain does the watering
                let wife = ''; // married, and she stayed home: she keeps the farm going through the night
                if (F.spouse && !F.follow) { const nm = (FOLK.find(f => f.id === F.spouse) || {}).name || 'Your wife', got = {};
                    for (const [, , p] of planted) if (p.s === 'planted' && cropRipe(p)) { F.crops[p.c] = (F.crops[p.c] || 0) + 1; got[p.c] = (got[p.c] || 0) + 1; Object.assign(p, { s: 'tilled', c: null, g: 0, w: false }); }
                    for (const [, , p] of planted) if (p.s === 'planted') p.w = true;
                    F.goods.milk = (F.goods.milk || 0) + 1; F.goods.eggs = (F.goods.eggs || 0) + 2;
                    const hv = Object.entries(got).map(([c, n]) => n + ' ' + CROPS[c].name).join(', ');
                    wife = nm + (hv ? ' harvested ' + hv + ',' : '') + ' watered the field and fed the animals (+1 milk, +2 eggs). '; }
                { const P = farmState().patrol; if (P && P.echo) { wife += P.echo + ' ' + (F.spouse && !F.follow && P.wife ? ((FOLK.find(f => f.id === F.spouse) || {}).name || 'She') + ': "' + P.wife + '" ' : ''); { const c = 'Morning after the patrol: ' + P.echo; if (!journal.clues.includes(c)) journal.clues.push(c); } P.echo = null; P.wife = null; } }
                const held = planted.filter(q => q[2].s === 'planted').length;
                if (F.raid && !F.away) { F.nights++; F.coins += held; }
                for (const w of wolves) if (w.alive && w.raider && !w.fleeing) { w.fleeing = true; w.fleeTimer = 0; }
                if (currentMapName === 'overworld') showFluidMessage('MORNING IN RAHJAI. ' + WEATHER_TAG[nw] + '. ' + (F.raid && !F.away ? 'You held the field: ' + held + ' crops made it (+' + held + ' coins). ' : '') + (lost ? lost + ' crops lost to the wolves. ' : '') + (grew ? grew + ' crops grew. ' : '') + wife, wife ? 6400 : 3600);
                F.raid = 0; F.away = false; F.lived += Math.max(1, steps); LIFE.wrong = null; LIFE.sister = null; LIFE.horseHome = -1;
                if (F.spouse && F.wedDay != null && !F.pregnant && day - F.wedDay >= 7 && hash1(day * 5 + 1) < 0.15) { F.pregnant = day; } // the family grows (more of this to come)
            }
            if (night && !F.wasNight) { // dusk
                if (HORSE.map === 'overworld' && !HORSE.mounted) { HORSE.x = HORSE_HOME[0]; HORSE.y = HORSE_HOME[1]; HORSE.face = 'left'; if (currentMapName === 'overworld') showFluidMessage('Dusk. Your horse wanders home to the stable.', 2400); }
                if (wolfMoon(day) && planted.length) {
                    if (currentMapName === 'overworld') {
                        F.raid = 1; const n = Math.min(6, 2 + Math.floor(F.nights / 2));
                        for (let i = 0; i < n; i++) { spawnWolf(i === n - 1 && F.nights >= 2 ? 'boxelder' : 'wolf'); const w = wolves[wolves.length - 1]; if (!w) continue;
                            const side = i % 2 ? 24 + (i % 3) * 2 : 5 + (i % 3); let gy = FIELD_TOP + (i * 2) % 5; if (!fieldOpen(side, gy, true)) gy = FIELD_TOP + 1;
                            if (fieldOpen(side, gy, true)) { w.gridX = side; w.gridY = gy; w.pixelX = w.targetX = side * TILE_SIZE; w.pixelY = w.targetY = gy * TILE_SIZE; } w.raider = true; }
                        showFluidMessage('A howl rolls across Rahjai. Biscuit won\'t stop growling. WOLF MOON: ' + n + ' wolves are coming for the crops. ' + (equippedItem === 'sword' ? 'Draw your sword!' : 'Take up your sword (D-pad →)!'), 3800);
                    } else { F.raid = 1; F.away = true; }
                }
            }
            if (night && F.raid && currentMapName !== 'overworld') F.away = true;
            F.wasNight = night;
            // the wrongness: rare, at night, out in the open. The horse knows first.
            const outside = currentMapName === 'overworld' || currentMapName === 'wastes' || currentMapName === 'trail';
            if (night && outside && !LIFE.wrong && (h >= 21 || h < 3) && hash1(day * 17 + 5) < 0.3 && Math.random() < 0.004) startWrongness();
            if (LIFE.sister && Math.hypot(LIFE.sister[0] - player.gridX, LIFE.sister[1] - player.gridY) < 5) { LIFE.sister = null; showFluidMessage('...she\'s gone. There are no footprints.', 2600); }
            if (wx === 'storm' && outside && now > LIFE.nextFlash) { LIFE.nextFlash = now + 7000 + Math.random() * 16000; lightning(); }
            patrolStep(); updateFarmHud(); updateWeatherFx();
        }
        function startWrongness() {
            if (currentMapName === 'overworld' && player.gridY < FIELD_TOP - 1) return; // no monsters in town: only the neighbours, up to no good
            LIFE.wrong = { t: performance.now() };
            if (HORSE.map === currentMapName) { audio.playTone && (audio.playTone(523, 'square', 0.08, 0.05), setTimeout(() => audio.playTone(392, 'square', 0.12, 0.05), 120)); showFluidMessage('Your horse stamps and pulls back. It is staring into the fog.', 2600); }
            const kind = currentMapName === 'overworld' && Math.random() < 0.5 ? 'sister' : 'giant';
            setTimeout(() => {
                if (kind === 'sister') { const sx = Math.random() < 0.5 ? 6 : 52; LIFE.sister = [sx, 20]; setTimeout(() => { LIFE.sister = null; }, 14000); }
                else { const g = document.getElementById('wrong-fig'); if (g) { g.dataset.bearing = String(camYaw() + (Math.random() - 0.5) * 0.9); g.classList.add('on'); setTimeout(() => g.classList.remove('on'), 9000); } if (weatherNow() !== 'storm') setTimeout(lightning, 2500); }
            }, 3200);
        }
        function lightning() {
            const fl = document.getElementById('lightning'); if (!fl) return; fl.classList.remove('on'); void fl.offsetWidth; fl.classList.add('on');
            const g = document.getElementById('wrong-fig'); if (g) { g.classList.add('lit'); setTimeout(() => g.classList.remove('lit'), 160); }
            setTimeout(() => audio.playTone && audio.playTone(48, 'sawtooth', 0.9, 0.06), 400 + Math.random() * 900);
        }
        function updateWeatherFx() {
            const r = document.getElementById('rain-fx'); if (!r) return;
            const wx = weatherNow(), on = (wx === 'rain' || wx === 'storm') && FX_GL.curMode === 1 && gameState === 'PLAYING';
            r.classList.toggle('on', on);
        }
        function placeWrongFig() { // the giant keeps its bearing in the world as the camera turns
            const g = document.getElementById('wrong-fig'); if (!g || !g.classList.contains('on')) return;
            let d = parseFloat(g.dataset.bearing || '0') - camYaw(); d = Math.atan2(Math.sin(d), Math.cos(d));
            g.style.left = (50 + d / 1.2 * 100) + '%'; g.style.top = (CINE.hY / 144 * 100 - 31) + '%';
        }
        // ---- drawing ----
        function drawFarmGround() { // flat on the ground: the plots, with the painted crop tiles on them
            if (currentMapName !== 'overworld') return; const F = farmState(), T = TILE_SIZE;
            const [x0, y0] = FARM_PLOTS[0], [x1, y1] = FARM_PLOTS[FARM_PLOTS.length - 1];
            ctx.fillStyle = 'rgba(91,58,34,.35)'; ctx.fillRect(x0 * T - 2, y0 * T - 2, (x1 - x0 + 1) * T + 4, (y1 - y0 + 1) * T + 4);
            const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
            for (const [x, y] of FARM_PLOTS) {
                const p = F.plots[x + ',' + y], tx = x * T, ty = y * T;
                if (!p || p.s === 'wild') { ctx.fillStyle = 'rgba(120,90,55,.35)'; ctx.fillRect(tx + 2, ty + 2, T - 4, T - 4); continue; }
                if (p.s === 'planted' && FARM_ART.img.complete) {
                    const q = p.g / CROPS[p.c].days, st = cropRipe(p) ? 4 : p.g === 0 ? 0 : q < 0.34 ? 1 : q < 0.67 ? 2 : 3, f = FARM_ART.F['c_' + p.c + st];
                    if (f) ctx.drawImage(FARM_ART.img, f[0], f[1], f[2], f[3], tx, ty, T, T);
                    if (p.w) { ctx.fillStyle = 'rgba(30,50,90,.22)'; ctx.fillRect(tx, ty, T, T); }
                    if (cropRipe(p) && (Date.now() / 300 + x + y) % 8 < 1) { ctx.fillStyle = '#fff'; ctx.fillRect(tx + 4, ty + 3, 1, 1); ctx.fillRect(tx + 11, ty + 6, 1, 1); }
                    continue;
                }
                ctx.fillStyle = p.w ? '#3a2414' : '#5b3b22'; ctx.fillRect(tx + 1, ty + 1, T - 2, T - 2);
                ctx.fillStyle = p.w ? '#2a190d' : '#47301c'; for (let r = 3; r < T - 2; r += 4) ctx.fillRect(tx + 2, ty + r, T - 4, 1);
            }
            ctx.imageSmoothingEnabled = sm;
        }
        function stepAnimals() { // wander inside their pens
            if (currentMapName !== 'overworld') return; const now = performance.now();
            for (const a of ANIMALS) {
                const s = animalLive(a);
                if (s.px !== s.tx || s.py !== s.ty) { const dx = s.tx - s.px, dy = s.ty - s.py, d = Math.hypot(dx, dy), m = Math.min(d, 0.55); s.px += dx / d * m; s.py += dy / d * m; continue; }
                if (now < s.t) continue; s.t = now + 1800 + Math.random() * 4200;
                if (isNight() && a.kind !== 'dog' && Math.random() < 0.7) continue; // they settle down after dark
                const [x0, y0, x1, y1] = a.pen, dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]], [dx, dy] = dirs[Math.floor(Math.random() * 4)], nx = s.gx + dx, ny = s.gy + dy;
                if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue;
                if (MAP_DATA[ny][nx] && [1, 2, 3, 4, 6, 9, 10, 11, TILE_BUMPER].includes(MAP_DATA[ny][nx])) continue;
                if (FARM_SOLID.has(nx + ',' + ny) || (player.gridX === nx && player.gridY === ny) || ANIMALS.some(b => b !== a && AN[b.id] && AN[b.id].gx === nx && AN[b.id].gy === ny) || folkAt(nx, ny)) continue;
                if (dx) s.flip = (dx > 0) !== (a.face > 0); s.gx = nx; s.gy = ny; s.tx = nx * TILE_SIZE; s.ty = ny * TILE_SIZE;
            }
        }
        function drawFarmCards() { // buildings, animals, people and wild herbs stand up off the ground
            if (currentMapName !== 'overworld' || !FARM_ART.img.complete) return; const T = TILE_SIZE;
            for (const b of HOMESTEAD) { if (b.art === 'cottage' && paperLive() && PAPER.cottage) continue; /* the folded 3D cottage stands in its place */ const cx = b.x * T + 8, fy = b.y * T + 15; asCard(cx, fy, () => farmSprite(b.art, cx, fy, b.w * T), 'fa_' + b.art + '_' + b.x, { size: b.big ? 256 : 128, orient: b.fixed }); }
            for (const a of ANIMALS) { const s = animalLive(a), cx = s.px + 8, fy = s.py + 15, hop = s.bob > 0 ? Math.sin(s.bob * Math.PI) * 3 : 0; if (s.bob > 0) s.bob = Math.max(0, s.bob - 0.06);
                const moving = s.px !== s.tx || s.py !== s.ty, step = moving ? Math.abs(Math.sin(performance.now() / 90)) * 0.8 : 0;
                asCard(cx, fy, () => farmSprite(a.kind === 'dog' || a.kind === 'cat' ? a.kind : a.kind, cx, fy - hop - step, a.w * T, s.flip)); }
            for (const f of FOLK) { const n = TOWN_SCHED[f.id] && farmState().spouse !== f.id ? townLive(f) : null; if (n) { if (n.state !== 'sleep') townDraw(f, n, T); continue; }
                const p = folkWhere(f); if (!p) continue; const cx = p[0] * T + 8, fy = p[1] * T + 15, ghost = f.id === 'sister';
                asCard(cx, fy, () => f.id === 'sudashorn' && SUD_ART.ready ? drawSud(cx, fy, player.gridX < p[0], 'stand', 0, 1) : farmSprite(f.art, cx, fy, folkWidth(f), false, ghost ? 0.55 + 0.25 * Math.sin(performance.now() / 300) : null), ghost ? null : 'fo_' + f.id); }
            for (const n of FORAGE) { const p = forageLive(n); if (!p) continue; const cx = p[0] * T + 8, fy = p[1] * T + 15;
                asCard(cx, fy, () => { if (n.k === 'herbs') farmSprite('i_herbs', cx, fy, 0.9 * T); else { ctx.fillStyle = '#f5f0e1'; ctx.fillRect(cx - 3, fy - 5, 6, 5); ctx.fillStyle = '#d9cfb4'; ctx.fillRect(cx - 1, fy - 8, 2, 3); ctx.fillStyle = '#4d7c0f'; ctx.fillRect(cx - 4, fy - 11, 1, 6); ctx.fillRect(cx + 3, fy - 12, 1, 7); } }, 'fg_' + n.k); }
        }
        function drawFollower() { // your wife, when she comes with you
            const F = farmState(); if (!F.spouse || !F.follow) return; const f = FOLK.find(x => x.id === F.spouse); if (!f) return;
            const tr = LIFE.trail; if (!tr.length || tr[tr.length - 1][2] !== currentMapName) return;
            const k = Math.max(0, tr.length - 14), [px, py] = tr[k], cx = px + 8, fy = py + 15;
            asCard(cx, fy, () => f.id === 'sudashorn' && SUD_ART.ready ? drawSud(cx, fy, LIFE.trail.length > 1 && tr[k][0] > tr[Math.min(tr.length - 1, k + 1)][0], player.isMoving ? 'walk' : 'stand', Math.floor(performance.now() / 18), 1) : farmSprite(f.art, cx, fy, folkWidth(f)), f.id === 'sudashorn' ? null : 'fo_' + f.id);
        }
        function lifeTrail() { const tr = LIFE.trail, last = tr[tr.length - 1]; if (!last || last[0] !== player.pixelX || last[1] !== player.pixelY || last[2] !== currentMapName) { if (last && last[2] !== currentMapName) tr.length = 0; tr.push([player.pixelX, player.pixelY, currentMapName]); if (tr.length > 40) tr.shift(); } }
        // the rhythm of the day: what colour the world is at this hour (outdoors)
        const RHYTHM = [ // hour, tint, fog, desaturation
            [3, [0.55, 0.61, 0.86], [0.06, 0.07, 0.12], 0.45], [5.2, [0.62, 0.66, 0.86], [0.14, 0.15, 0.22], 0.45], [6.5, [1.12, 0.96, 0.78], [0.86, 0.74, 0.58], 0.32],
            [9, [1.07, 1.02, 0.91], [0.82, 0.79, 0.72], 0.28], [13, [1.03, 1.04, 1.02], [0.76, 0.79, 0.80], 0.2], [16.5, [1.10, 0.98, 0.86], [0.80, 0.70, 0.58], 0.26],
            [18, [1.18, 0.83, 0.66], [0.74, 0.48, 0.36], 0.3], [19.5, [0.78, 0.80, 1.02], [0.22, 0.25, 0.38], 0.38], [22, [0.56, 0.62, 0.86], [0.06, 0.07, 0.12], 0.45], [27, [0.55, 0.61, 0.86], [0.06, 0.07, 0.12], 0.45]];
        function rhythmNow() {
            let h = gameHour(); if (h < 3) h += 24; let a = RHYTHM[0], b = RHYTHM[RHYTHM.length - 1];
            for (let i = 0; i < RHYTHM.length - 1; i++) if (h >= RHYTHM[i][0] && h < RHYTHM[i + 1][0]) { a = RHYTHM[i]; b = RHYTHM[i + 1]; break; }
            const u = (h - a[0]) / Math.max(0.001, b[0] - a[0]), L = (p, q) => p.map((v, i) => v + (q[i] - v) * u);
            let tint = L(a[1], b[1]), fog = L(a[2], b[2]), ds = a[3] + (b[3] - a[3]) * u; const wx = weatherNow();
            if (wx === 'rain' || wx === 'storm') { tint = tint.map(v => v * 0.86); ds += 0.12; fog = fog.map(v => v * 0.8); } else if (wx === 'fog') ds += 0.08;
            return { tint, fog, ds };
        }

        function isNight() {
            if (window.__introRide) return false; // the opening ride is always by day
            return gameNow() % DAY_MS >= DAY_MS / 2; // 18:00 to 06:00
        }

        function spawnWolf(kind = 'wolf') {
            let gx, gy, tries = 0;
            do {
                gx = WOLF_FIELD_COLS[Math.floor(Math.random() * WOLF_FIELD_COLS.length)];
                gy = WOLF_FIELD_ROWS[Math.floor(Math.random() * WOLF_FIELD_ROWS.length)];
                tries++;
            } while (isSolidTile(gx, gy) && tries < 20);
            if (isSolidTile(gx, gy)) return;
            wolves.push({
                gridX: gx, gridY: gy,
                pixelX: gx * TILE_SIZE, pixelY: gy * TILE_SIZE,
                targetX: gx * TILE_SIZE, targetY: gy * TILE_SIZE,
                dir: 'down', isMoving: false, animFrame: 0, moveTimer: 0,
                alive: true, fleeing: false, fleeTimer: 0,
                lastBiteTime: 0, kind
            });
        }

        function spawnInitialWolves() {
            for (let i = 0; i < 4; i++) spawnWolf();
        }

        function drawWolfSprite(x, y, dir, frame, night) {
            if (dir === 'left' && CardBook.get('animal.wolf').mirrorFacing) { // canonical asset faces right; left is the mirror
                ctx.save(); ctx.translate(x + 16, y); ctx.scale(-1, 1);
                drawWolfSprite(0, 0, 'right', frame, night);
                ctx.restore();
                return;
            }
            ctx.save();
            ctx.translate(x, y);

            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(1, 12, 14, 3);

            ctx.fillStyle = '#44403c';
            ctx.fillRect(2, 6, 12, 7);
            ctx.fillStyle = '#292524';
            ctx.fillRect(2, 10, 12, 3);

            const legShift = Math.floor(frame) % 2 === 1 ? 1 : 0;
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(3, 12 + legShift, 2, 3 - legShift);
            ctx.fillRect(10, 12 - legShift, 2, 3 + legShift);

            ctx.fillStyle = '#57534e';
            if (dir === 'left') {
                ctx.fillRect(0, 4, 5, 5);
                ctx.fillStyle = '#292524';
                ctx.fillRect(0, 2, 2, 3);
            } else if (dir === 'right') {
                ctx.fillRect(11, 4, 5, 5);
                ctx.fillStyle = '#292524';
                ctx.fillRect(14, 2, 2, 3);
            } else if (dir === 'up') {
                ctx.fillRect(4, 3, 8, 5);
                ctx.fillStyle = '#292524';
                ctx.fillRect(3, 1, 2, 3);
                ctx.fillRect(11, 1, 2, 3);
            } else {
                ctx.fillRect(4, 3, 8, 5);
                ctx.fillStyle = '#292524';
                ctx.fillRect(3, 1, 2, 3);
                ctx.fillRect(11, 1, 2, 3);
            }

            if (dir !== 'up') {
                ctx.fillStyle = night ? '#fde047' : '#0f172a';
                if (dir === 'left') {
                    ctx.fillRect(1, 5, 1, 1);
                } else if (dir === 'right') {
                    ctx.fillRect(14, 5, 1, 1);
                } else {
                    ctx.fillRect(5, 5, 1, 1);
                    ctx.fillRect(10, 5, 1, 1);
                }
                if (night) {
                    ctx.fillStyle = 'rgba(253,224,71,0.35)';
                    ctx.beginPath();
                    ctx.arc(dir === 'left' ? 1 : (dir === 'right' ? 14 : 7), 5, 3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            const tailWag = Math.floor(frame) % 2 === 0 ? 0 : 2;
            ctx.fillStyle = '#44403c';
            if (dir === 'left') {
                ctx.fillRect(12, 6 + tailWag, 3, 2);
            } else if (dir === 'right') {
                ctx.fillRect(0, 6 + tailWag, 3, 2);
            } else {
                ctx.fillRect(6, 11 + tailWag, 3, 2);
            }

            ctx.restore();
        }

        function drawBoxelder(w) { // tall and thin, about 1.6 tiles; sways as it walks, glowing red eyes; smears away when it flees
            const t = performance.now() / 1000, fx = w.pixelX + 8, fy = w.pixelY + 15, fade = w.fleeing ? Math.max(0, 1 - w.fleeTimer / 1400) : 1;
            if (fade <= 0) return;
            ctx.save(); ctx.globalAlpha = fade;
            ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(fx, fy, 6, 2, 0, 0, 7); ctx.fill();
            const sway = Math.sin(t * 2.2 + w.gridX) * 0.6 + (w.isMoving ? Math.sin(w.animFrame * 3) * 0.8 : 0);
            if (w.fleeing) { ctx.globalAlpha = fade * 0.5; drawWorldFrame(ctx, 'boxelder', fx + sway - (1 - fade) * 6, fy, 0.41, 19, 63); ctx.globalAlpha = fade; }
            if (!drawWorldFrame(ctx, 'boxelder', fx + sway, fy, 0.41, 19, 63, w.dir === 'left')) { ctx.fillStyle = '#050505'; ctx.fillRect(fx - 4, fy - 24, 8, 24); }
            const ex = fx + sway - 1.6, ey = fy - 22, g = ctx.createRadialGradient(ex, ey, 0.3, ex, ey, 3.5); // a faint glow round the eyes
            g.addColorStop(0, 'rgba(255,50,40,.28)'); g.addColorStop(1, 'rgba(255,50,40,0)'); ctx.fillStyle = g; ctx.fillRect(ex - 4, ey - 4, 8, 8);
            ctx.restore();
        }

        function updateWolves() {
            if (currentMapName === 'overworld') for (let i = wolves.length - 1; i >= 0; i--) if (wolves[i].gridY < FIELD_TOP || (!wolves[i].raider && wolves[i].gridX < WILD_EDGE - 1 && !wolves[i].fleeing)) { if (lockedWolf === wolves[i]) lockedWolf = null; wolves.splice(i, 1); }
            if (currentMapName !== 'overworld' || gameState !== 'PLAYING' || cinematicMode) return;

            if (Date.now() - lastWolfSpawnCheck > 8000) {
                lastWolfSpawnCheck = Date.now();
                const aliveCount = wolves.filter(w => w.alive && w.kind !== 'boxelder').length;
                if (aliveCount < 4 && Math.random() < 0.6) spawnWolf();
                // BOXELDERS: shadow stalkers that only walk at night, and come apart at dawn
                const shades = wolves.filter(w => w.alive && w.kind === 'boxelder').length;
                if (isNight() && shades < 2 && Math.random() < 0.5) spawnWolf('boxelder');
            }
            if (!isNight()) for (const w of wolves) if (w.alive && w.kind === 'boxelder' && !w.fleeing) { w.fleeing = true; w.fleeTimer = 0; }

            const moveSpeed = CardBook.get('animal.wolf').speed;
            const heldLight = !!(HELD_ITEMS[equippedItem] && HELD_ITEMS[equippedItem].light);
            for (const wolf of wolves) {
                if (!wolf.alive) continue;
                const shade = wolf.kind === 'boxelder';
                if (!FileDex.isActive(Math.floor(wolf.pixelX / TILE_SIZE), Math.floor(wolf.pixelY / TILE_SIZE))) continue; // sleeps outside nearby chunks

                if (wolf.fleeing) {
                    wolf.fleeTimer += 16;
                    const fleeDx = wolf.gridX - player.gridX;
                    const fleeDy = wolf.gridY - player.gridY;
                    if (!wolf.isMoving) {
                        const stepX = fleeDx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(fleeDx);
                        const stepY = fleeDy === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(fleeDy);
                        const tryMoves = [{dx: stepX, dy: 0}, {dx: 0, dy: stepY}, {dx: stepX, dy: stepY}];
                        for (const m of tryMoves) {
                            const nx = wolf.gridX + m.dx, ny = wolf.gridY + m.dy;
                            if (fieldOpen(nx, ny, wolf.raider)) {
                                wolf.dir = m.dx < 0 ? 'left' : (m.dx > 0 ? 'right' : (m.dy < 0 ? 'up' : 'down'));
                                wolf.gridX = nx; wolf.gridY = ny;
                                wolf.targetX = nx * TILE_SIZE; wolf.targetY = ny * TILE_SIZE;
                                wolf.isMoving = true;
                                break;
                            }
                        }
                    }
                    if (wolf.fleeTimer > 2600) wolf.alive = false;
                } else if (!wolf.isMoving) {
                    wolf.moveTimer++;
                    const distToPlayer = Math.hypot(wolf.gridX - player.gridX, wolf.gridY - player.gridY);
                    // Pick whichever's nearer and in range: the player, or a guard target planted on this map.
                    let focus = { gx: player.gridX, gy: player.gridY, isPlayer: true, dist: distToPlayer, range: shade ? 5 : 4 };
                    for (const t of guardTargetsOnMap(currentMapName)) {
                        const d = Math.hypot(wolf.gridX - t.gridX, wolf.gridY - t.gridY), rad = String(t.id).startsWith('crop_') && !wolf.raider ? 1.5 : t.radius; // only the raid hunts the crops from afar
                        if (d <= rad && d < focus.dist) focus = { gx: t.gridX, gy: t.gridY, isPlayer: false, dist: d, range: rad };
                    }
                    const atBay = shade && heldLight && focus.isPlayer && distToPlayer <= 2.5; // a Boxelder won't come into the light of a torch or the staff: it backs off
                    // objects sit on their own tile, so a wolf stops adjacent to it rather than trying to stand on top of it
                    const closeEnough = focus.isPlayer ? (focus.dist <= focus.range) : (focus.dist <= focus.range && focus.dist > 1);
                    if ((closeEnough || atBay) && wolf.moveTimer > (shade ? 34 : 25)) {
                        wolf.moveTimer = 0;
                        const stepX = Math.sign(focus.gx - wolf.gridX) * (atBay ? -1 : 1);
                        const stepY = Math.sign(focus.gy - wolf.gridY) * (atBay ? -1 : 1);
                        const tryMoves = [{dx: stepX, dy: 0}, {dx: 0, dy: stepY}];
                        for (const m of tryMoves) {
                            if (m.dx === 0 && m.dy === 0) continue;
                            const nx = wolf.gridX + m.dx, ny = wolf.gridY + m.dy;
                            if (fieldOpen(nx, ny, wolf.raider) && (focus.isPlayer || Math.hypot(nx - focus.gx, ny - focus.gy) >= 1)) {
                                wolf.dir = m.dx < 0 ? 'left' : (m.dx > 0 ? 'right' : (m.dy < 0 ? 'up' : 'down'));
                                wolf.gridX = nx; wolf.gridY = ny;
                                wolf.targetX = nx * TILE_SIZE; wolf.targetY = ny * TILE_SIZE;
                                wolf.isMoving = true;
                                break;
                            }
                        }
                    } else if (wolf.moveTimer > 100) {
                        wolf.moveTimer = 0;
                        if (Math.random() < 0.5) {
                            const dirs = [{dx:0,dy:-1,n:'up'},{dx:0,dy:1,n:'down'},{dx:-1,dy:0,n:'left'},{dx:1,dy:0,n:'right'}];
                            const d = dirs[Math.floor(Math.random() * dirs.length)];
                            const nx = wolf.gridX + d.dx, ny = wolf.gridY + d.dy;
                            if (fieldOpen(nx, ny, wolf.raider)) {
                                wolf.dir = d.n;
                                wolf.gridX = nx; wolf.gridY = ny;
                                wolf.targetX = nx * TILE_SIZE; wolf.targetY = ny * TILE_SIZE;
                                wolf.isMoving = true;
                            }
                        }
                    }
                }

                if (wolf.isMoving) {
                    if (wolf.pixelX < wolf.targetX) wolf.pixelX = Math.min(wolf.pixelX + (shade ? moveSpeed * 0.8 : moveSpeed), wolf.targetX);
                    if (wolf.pixelX > wolf.targetX) wolf.pixelX = Math.max(wolf.pixelX - (shade ? moveSpeed * 0.8 : moveSpeed), wolf.targetX);
                    if (wolf.pixelY < wolf.targetY) wolf.pixelY = Math.min(wolf.pixelY + (shade ? moveSpeed * 0.8 : moveSpeed), wolf.targetY);
                    if (wolf.pixelY > wolf.targetY) wolf.pixelY = Math.max(wolf.pixelY - (shade ? moveSpeed * 0.8 : moveSpeed), wolf.targetY);
                    wolf.animFrame += 0.18;
                    if (wolf.pixelX === wolf.targetX && wolf.pixelY === wolf.targetY) {
                        wolf.isMoving = false;
                    }
                }

                if (!wolf.fleeing && wolf.gridX === player.gridX && wolf.gridY === player.gridY) {
                    const now = Date.now();
                    if (now - wolf.lastBiteTime > 1000) {
                        wolf.lastBiteTime = now;
                        if (playerInvincible) {
                            showFluidMessage(shade ? "You roll out from under its claws!" : "You roll clear of the bite!");
                        } else if (shade) {
                            damagePlayer(10);
                            showFluidMessage("A Boxelder's claws rake you! [-10 HP]");
                        } else {
                            damagePlayer(8);
                            showFluidMessage("A wolf bites you! [-8 HP]");
                        }
                    }
                }

                if (!wolf.fleeing) {
                    for (const t of guardTargetsOnMap(currentMapName)) {
                        if (Math.max(Math.abs(wolf.gridX - t.gridX), Math.abs(wolf.gridY - t.gridY)) > 1) continue;
                        if (String(t.id).startsWith('crop_') && !isNight() && !wolf.raider) continue; // by day the field wolves leave the crops alone
                        const now = Date.now();
                        if (now - wolf.lastBiteTime > 1000) {
                            wolf.lastBiteTime = now;
                            const dmg = shade ? 14 : 10;
                            damageGuardTarget(t, dmg, wolf);
                            if (t.alive && (!String(t.id).startsWith('crop_') || now - (window.__cropMsgT || 0) > 2500)) { window.__cropMsgT = now; showFluidMessage(`${t.name} is attacked! [-${dmg}]`); }
                        }
                        break;
                    }
                }
            }
        }

        function tryAttackWolfWithAxe() {
            let dgx = player.gridX, dgy = player.gridY;
            if (player.dir === 'up') dgy--;
            else if (player.dir === 'down') dgy++;
            else if (player.dir === 'left') dgx--;
            else if (player.dir === 'right') dgx++;

            for (const wolf of wolves) {
                if (wolf.alive && !wolf.fleeing && wolf.gridX === dgx && wolf.gridY === dgy) {
                    wolf.fleeing = true;
                    wolf.fleeTimer = 0;
                    const wpn = equippedItem === 'sword' ? 'sword' : 'axe';
                    showFluidMessage(wolf.kind === 'boxelder' ? `Your ${wpn} cuts through the Boxelder. It tears apart into shadow.` : `You swing your ${wpn}! The wolf bolts away.`);
                    return true;
                }
            }
            return false;
        }

        function tryScareWolvesWithTorch() {
            const shades = wolves.filter(w => w.alive && !w.fleeing && w.kind === 'boxelder' && Math.hypot(w.gridX - player.gridX, w.gridY - player.gridY) <= 5);
            if (shades.length) { // shadow can't stand a raised flame, however many there are
                shades.forEach(w => { w.fleeing = true; w.fleeTimer = 0; });
                showFluidMessage("You thrust the torch at the dark. The Boxelders come apart like smoke.");
                if (!wolves.some(w => w.alive && !w.fleeing && w.kind !== 'boxelder')) return true;
            }
            const aliveWolves = wolves.filter(w => w.alive && !w.fleeing && w.kind !== 'boxelder');
            if (aliveWolves.length === 0) return false;

            if (!isNight()) {
                showFluidMessage("The torch's glow is too faint to scare anything off in daylight.");
                return true;
            }
            if (aliveWolves.length > 3) {
                showFluidMessage("Too many wolves! The torch alone won't scare off a whole pack.");
                return true;
            }
            for (const wolf of aliveWolves) {
                wolf.fleeing = true;
                wolf.fleeTimer = 0;
            }
            showFluidMessage("Your torch blazes bright! The wolves flee into the dark.");
            return true;
        }

