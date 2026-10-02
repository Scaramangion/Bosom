        // ---------- NPC SYSTEM (data-driven; half-sprites are mirrored to full width) ----------
        // Letters: K outline, H hair/hat, F skin, E eyes, A main clothes, B accent, P pants, S shoes, W white
        const NPC_HALF = {
            slim: ["........","...KKKKK","..KHHHHH","..KHHHHH","..KHFFFF","..KFFEFF","..KFFFFF","...KFFFF","....KAAA","..KAAAAA","..KAAAAB","..FAAAAA","..KAAAAB","...KPPP.","...KPPP.","...KSSS."],
            wide: ["........","...KKKKK","..KHHHHH","..KHHHHH","..KHFFFF","..KFFEFF","..KFFFFF","...KFFFF",".KKKAAAA","KAAAAAAA","KAAAAAAB","KFAAAAAB","KFAAAAAA",".KKPPPP.","..KPPPP.","..KSSSS."],
            robe: ["........","...KKKKK","..KHHHHH","..KHHHHH","..KHFFFF","..KFFEFF","..KFFFFF","...KFFFF","....KAAA","..KAAAAA","..KAABBB","..FAAAAA","..KAAAAA","..KAAAAA","..KAAAAA","..KBBBBB"]
        };
        const NPC_DEFS = [
            { name: 'NET KID', body: 'slim', gx: 10, gy: 9, pal: { K:'#1e1b2e', H:'#7a4a25', F:'#e8b48a', E:'#1e1b2e', A:'#f28a2e', B:'#c2611a', P:'#3f7f3f', S:'#5a3a1e' },
              extras: [[2,3,'#e8e2c8',3,1],[1,4,'#e8e2c8',1,2],[3,4,'#e8e2c8',1,2],[2,6,'#8a5a2e',1,8]],
              lines: ["Catching bugs by the gate. Something scared them all away last night.", "The howling started right after sundown. Even the crickets went quiet.", "I saw paw prints bigger than my net. Bigger than YOUR axe, detective!"],
              rumor: "The Net Kid says all the bugs vanished the night the howling began." },
            { name: 'DR. LAB', body: 'slim', gx: 19, gy: 10, pal: { K:'#1e1b2e', H:'#c9772e', F:'#f0c8a0', E:'#1e1b2e', A:'#f4f4f4', B:'#8fb0d8', P:'#4a5568', S:'#2d2d2d' },
              extras: [[13,9,'#8fd0f0',2,2]],
              lines: ["I study the local wildlife. These wolves are behaving... unnaturally.", "Normal packs hunt at dawn. These ones patrol at night, like they're guarding something.", "Bring me any strange fur samples and I might be able to tell you more."],
              clue: "Dr. Lab notes the wolves patrol at night as if guarding something." },
            { name: 'MADAME SUMI', body: 'robe', gx: 5, gy: 12, pal: { K:'#1e1b2e', H:'#2b1f3a', F:'#f0d0b0', E:'#1e1b2e', A:'#c9a8e8', B:'#f4e8ff' },
              extras: [[12,3,'#f4e8ff',2,2]],
              lines: ["Such a lovely evening, if not for all this talk of wolves.", "The Tellhouse regulars gossip more than the crows do. Listen carefully to who contradicts whom.", "Lies are like kimono knots, dear. Pull the right thread and they all come loose."] },
            { name: 'BRAWN', body: 'wide', gx: 13, gy: 17, pal: { K:'#1e1b2e', H:'#e8c860', F:'#e0a878', E:'#1e1b2e', A:'#5a6b3a', B:'#3f4d28', P:'#b8a074', S:'#3a2a1a' },
              extras: [[0,10,'#e0a878',1,3],[15,10,'#e0a878',1,3]],
              lines: ["Name's Brawn. I haul crates for the Emporium.", "Shopkeeper's been buying a LOT of rope lately. Not my business, but... strange.", "Beat a wolf once with my bare hands. Well, almost. Okay, no. I ran."] },
            { name: 'CAPTAIN', body: 'slim', gx: 38, gy: 9, pal: { K:'#1e1b2e', H:'#f4f4f4', F:'#e0a878', E:'#1e1b2e', A:'#1e2f5a', B:'#e8c860', P:'#1e2f5a', S:'#1e1b2e' },
              extras: [[3,4,'#f4f4f4',10,1],[7,2,'#e8c860',2,1]],
              lines: ["Captain of nothing but this dry dock, sadly. The river ran low years ago.", "I keep watch from the east side. Something moves near the hollow trail after dark.", "A cloaked figure crossed the old bridge two nights back. Tall. Didn't look back."],
              clue: "The Captain saw a tall cloaked figure cross the old bridge two nights ago." },
            { name: 'RUNNER', body: 'slim', gx: 50, gy: 12, pal: { K:'#1e1b2e', H:'#d83a3a', F:'#e8b48a', E:'#1e1b2e', A:'#f4f4f4', B:'#3a6ad8', P:'#3a6ad8', S:'#f4f4f4' },
              extras: [[3,4,'#d83a3a',10,1]],
              lines: ["I run laps around this town every morning. East side's quieter than the west.", "There's a second trail entrance on this side, same as the west one. Weird, right?", "Race you to the gate! ...No? Okay."] },
            { name: 'OLD TRADER', body: 'wide', gx: 44, gy: 16, pal: { K:'#1e1b2e', H:'#d8d8d8', F:'#d8a078', E:'#1e1b2e', A:'#8a5a2e', B:'#e8c860', P:'#4a3a2a', S:'#2d2d2d' },
              extras: [[0,10,'#8a5a2e',1,3],[15,10,'#8a5a2e',1,3]],
              lines: ["Forty years I've traded in this town. Never seen it this jumpy.", "The Tiger Emporium's prices haven't changed, but the customers sure have.", "Gems, wolves, cloaked strangers... this town's got more mysteries than customers."] }
        ];

        NPC_DEFS.forEach(d => { d.id = 'npc.' + d.name.toLowerCase().replace(/\W+/g, '_'); });
        CardBook.add('npc', NPC_DEFS);

        const NPC_SPRITES = NPC_DEFS.map(def => {
            const cv = document.createElement('canvas'); cv.width = cv.height = 16;
            const c = cv.getContext('2d');
            NPC_HALF[def.body].forEach((half, y) => {
                const row = half + half.split('').reverse().join(''); // mirror array: left half + reversed copy
                for (let x = 0; x < 16; x++) {
                    if (row[x] === '.') continue;
                    c.fillStyle = row[x] === 'W' ? '#ffffff' : (def.pal[row[x]] || '#000');
                    c.fillRect(x, y, 1, 1);
                }
            });
            (def.extras || []).forEach(([x, y, col, w = 1, h = 1]) => { c.fillStyle = col; c.fillRect(x, y, w, h); });
            return cv;
        });

        let npcsReady = false;
        function initNpcs() { // snap each NPC to the nearest open floor tile
            if (npcsReady) return; npcsReady = true;
            NPC_DEFS.forEach(def => {
                for (let d = 0; d < 6; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
                    const x = def.gx + dx, y = def.gy + dy;
                    if (!def.placed && y > 0 && y < MAP_ROWS - 1 && x > 0 && x < MAP_COLS - 1 && MAP_DATA[y][x] === 0 &&
                        !NPC_DEFS.some(o => o !== def && o.placed && o.gx === x && o.gy === y)) { def.gx = x; def.gy = y; def.placed = true; FileDex.register(def, x, y); }
                }
            });
        }
        function npcAt(gx, gy) { initNpcs(); return FileDex.at(gx, gy); }
        function talkToNpc(def) {
            def.talks = (def.talks || 0) + 1;
            showDialogue(`${def.name}: "${def.lines[Math.min(def.talks, def.lines.length) - 1]}"`);
            if (def.rumor && def.talks === 1) logRumor(def.rumor);
            if (def.clue && def.talks === 2) logClue(def.clue, 'CLUE');
        }
        function drawNpcs() { // one call draws every NPC; they turn (mirror) to face the player
            initNpcs();
            NPC_DEFS.forEach((def, i) => {
                if (!def.placed) return;
                const x = def.gx * TILE_SIZE, y = def.gy * TILE_SIZE;
                if (cardMode() ? (x < lastCamX - 120 || x > lastCamX + GAME_WIDTH + 120 || y < lastCamY - 420 || y > lastCamY + GAME_HEIGHT) : (x < lastCamX - 16 || x > lastCamX + GAME_WIDTH || y < lastCamY - 16 || y > lastCamY + GAME_HEIGHT)) return; // cull off-screen (third person sees much further ahead)
                const bob = Math.floor(Date.now() / 500 + i) % 2;
                asCard(x + 8, y + 15, () => {
                    ctx.fillStyle = 'rgba(21,35,21,0.35)'; ctx.fillRect(x + 3, y + 14, 10, 2);
                    ctx.save();
                    if (player.pixelX < x) { ctx.translate(x + 16, y + bob); ctx.scale(-1, 1); ctx.drawImage(NPC_SPRITES[i], 0, 0); }
                    else ctx.drawImage(NPC_SPRITES[i], x, y + bob);
                    ctx.restore();
                });
            });
        }

