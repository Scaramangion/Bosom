        // ================= RAHJAI: a small life under an enormous world =================
        // A day here is twenty real minutes. Farm, tend animals, forage, cook, make friends; now and then, something is wrong.
        const DAY_MS = 20 * 60 * 1000;
        function gameNow() { let off = 0; try { off = zoneFlags.timeOff || 0; } catch (e) {} return Date.now() + off; }
        function gameHour() { return (6 + (gameNow() % DAY_MS) / DAY_MS * 24) % 24; }
        function gameDay() { return Math.floor(gameNow() / DAY_MS); }
        const FARM_ART = { img: new Image(), F: {"coop":[0,0,135,115],"house":[137,0,121,113],"cottage":[0,299,224,180],"stall":[260,0,119,110],"barn":[381,0,128,109],"stable":[511,0,163,108],"well":[676,0,82,99],"f_elder":[760,0,43,85],"f_farmer":[805,0,42,85],"f_franz":[849,0,40,85],"f_merchant":[891,0,43,84],"f_sudashorn":[936,0,42,84],"f_clito":[980,0,40,83],"f_sister":[0,117,41,81],"fence":[43,117,120,80],"f_guide":[165,117,41,79],"farmhorse":[208,117,84,78],"cow":[294,117,82,66],"goat":[378,117,55,65],"f_child":[435,117,33,58],"i_herbs":[470,117,45,57],"rooster":[517,117,55,57],"c_emberwheat4":[574,117,45,55],"dog":[621,117,63,55],"c_emberwheat3":[686,117,44,53],"c_sunroot4":[732,117,45,53],"goose":[779,117,34,53],"c_duskbean4":[815,117,45,52],"c_emberwheat1":[862,117,44,52],"c_duskbean3":[908,117,44,51],"c_emberwheat2":[954,117,45,50],"i_seeds":[0,200,45,50],"sheep":[47,200,58,50],"i_basket":[107,200,51,49],"i_milk":[160,200,30,49],"c_sunroot3":[192,200,44,48],"i_can":[238,200,50,48],"i_hammer":[290,200,49,48],"i_hoe":[341,200,50,48],"i_rod":[393,200,49,48],"c_duskbean2":[444,200,45,47],"c_emberwheat0":[491,200,45,47],"c_emberwheat5":[538,200,45,47],"cat":[585,200,48,47],"duck":[635,200,37,47],"i_axe":[674,200,49,47],"i_eggs":[725,200,52,47],"i_gift":[779,200,44,47],"c_duskbean1":[825,200,44,46],"c_duskbean5":[871,200,45,46],"c_sunroot1":[918,200,44,46],"c_sunroot2":[964,200,45,46],"c_sunroot5":[0,252,45,46],"c_duskbean0":[47,252,45,45],"i_food":[94,252,50,45],"i_pick":[146,252,45,45],"pig":[193,252,54,45],"c_sunroot0":[249,252,45,44],"chicken":[296,252,37,42],"i_wool":[335,252,49,39],"i_fish":[386,252,57,38]} };
        FARM_ART.img.src = document.getElementById('farm-atlas').textContent.trim();
        function farmSprite(name, cx, footY, w, flip, alpha) { // world coords: centred on cx, standing on footY, w world px wide
            const f = FARM_ART.F[name]; if (!f || !FARM_ART.img.complete) return; const h = w * f[3] / f[2];
            const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; if (alpha != null) ctx.globalAlpha = alpha;
            if (flip) { ctx.save(); ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.drawImage(FARM_ART.img, f[0], f[1], f[2], f[3], -w / 2, footY - h, w, h); ctx.restore(); }
            else ctx.drawImage(FARM_ART.img, f[0], f[1], f[2], f[3], cx - w / 2, footY - h, w, h);
            ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = sm;
        }
        // ---- the homestead (tile coordinates in Brennan's Theme; the field south of the fence is Rahjai) ----
        const FARM_PLOTS = []; for (let y = 19; y <= 21; y++) for (let x = 10; x <= 15; x++) FARM_PLOTS.push([x, y]);
        const FARM_STALL = [17, 20];
        const HOMESTEAD = [ // art, centre tile x, foot row, width in tiles, solid tiles
            { art: 'cottage', x: 24.57, y: 19, w: 7, big: true, solid: [[21, 17], [22, 17], [24, 17], [25, 17], [26, 17], [21, 16], [22, 16], [23, 16], [24, 16], [25, 16], [26, 16], [21, 15], [22, 15], [23, 15], [24, 15], [25, 15], [26, 15], [26, 18], [27, 18], [27, 17]], door: [23, 17] }, // walk into the door to go home
            { art: 'stall', x: 18, y: 20, w: 2.5, solid: [[17, 20], [18, 20]] },
            { art: 'well', x: 19.5, y: 21.6, w: 1.5, solid: [[19, 21]] },
            { art: 'barn', x: 35.5, y: 19, w: 3.3, solid: [[34, 19], [35, 19], [36, 19], [34, 18], [35, 18], [36, 18]] },
            { art: 'stable', x: 40.5, y: 19, w: 3.7, solid: [[39, 19], [40, 19], [41, 19], [39, 18], [40, 18], [41, 18]] },
            { art: 'coop', x: 46, y: 20, w: 2.9, solid: [[45, 20], [46, 20], [47, 20], [45, 19], [46, 19], [47, 19]] },
            { art: 'fence', x: 11.2, y: 22.7, w: 2.6, solid: [], fixed: 0 }, { art: 'fence', x: 14, y: 22.7, w: 2.6, solid: [], fixed: 0 }
        ];
        const FARM_SOLID = new Set(); HOMESTEAD.forEach(b => b.solid.forEach(([x, y]) => FARM_SOLID.add(x + ',' + y)));
        const HORSE_HOME = [40, 20];
        const CROPS = {
            sunroot: { name: 'SUNROOT', days: 2, seed: 1, sell: 3 },
            duskbean: { name: 'DUSKBEAN', days: 3, seed: 2, sell: 6 },
            emberwheat: { name: 'EMBERWHEAT', days: 4, seed: 3, sell: 10 }
        };
        const GOODS = { milk: { name: 'MILK', sell: 4 }, eggs: { name: 'EGGS', sell: 2 }, wool: { name: 'WOOL', sell: 6 } };
        const PANTRY = { herbs: 'HERBS', garlic: 'GARLIC', chicken: 'CHICKEN', butter: 'BUTTER', pasta: 'PASTA', dish: 'BUTTER GARLIC HERB CHICKEN PASTA' };
        function farmState() { // lives in zoneFlags, so it saves with everything else
            const F = zoneFlags.farm || (zoneFlags.farm = { plots: {}, coins: 6, seeds: { sunroot: 4, duskbean: 0, emberwheat: 0 }, crops: { sunroot: 0, duskbean: 0, emberwheat: 0 },
                nights: 0, day: gameDay(), wasNight: isNight(), raid: 0, away: false, seedPick: 'sunroot', can: 0, met: false });
            if (F.dayMs !== DAY_MS) { F.dayMs = DAY_MS; F.day = gameDay(); F.wasNight = isNight(); } // the clock changed length (old saves)
            F.goods = F.goods || { milk: 0, eggs: 0, wool: 0 }; F.pantry = F.pantry || { herbs: 0, garlic: 0, chicken: 0, butter: 0, pasta: 0, dish: 0 };
            F.animals = F.animals || {}; F.friends = F.friends || {}; F.forage = F.forage || {}; F.lived = F.lived || 1;
            return F;
        }
        function plotAt(x, y) { if (!FARM_PLOTS.some(p => p[0] === x && p[1] === y)) return null; const P = farmState().plots, k = x + ',' + y; return P[k] || (P[k] = { s: 'wild' }); }
        function inRahjai() { return currentMapName === 'overworld' && player.gridY >= FIELD_TOP; }
        function farmSolid(gx, gy) { return FARM_SOLID.has(gx + ',' + gy) || !!folkAt(gx, gy) || !!animalAt(gx, gy); }
        function cropRipe(p) { return p && p.s === 'planted' && p.g >= CROPS[p.c].days; }
        // ---- weather: one kind per day, chosen by the day itself ----
        function hash1(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }
        function weatherOf(day) { const r = hash1(day * 7 + 3); return r < 0.55 ? 'clear' : r < 0.73 ? 'fog' : r < 0.93 ? 'rain' : 'storm'; }
        function weatherNow() { return weatherOf(gameDay()); }
        function wolfMoon(day) { return day % 997 > 2 && hash1(day * 13 + 11) < 0.16; } // roughly one night in six, never the first nights
        const WEATHER_TAG = { clear: '☀ CLEAR', fog: '☁ FOG', rain: '☂ RAIN', storm: '⚡ STORM' };
        // ---- animals: named, each with a temper; pet them daily, collect what they give ----
        const ANIMALS = [
            { id: 'marigold', kind: 'cow', name: 'MARIGOLD', w: 1.7, face: 1, pen: [33, 20, 39, 21], gives: 'milk', every: 1, lines: ['Marigold flicks an ear at you. She has not decided about you yet.', 'Marigold leans her heavy head against your shoulder.', 'Marigold lows softly the moment she sees you.'] },
            { id: 'thistle', kind: 'sheep', name: 'THISTLE', w: 1.2, face: -1, pen: [33, 20, 39, 21], gives: 'wool', every: 3, lines: ['Thistle backs away, then comes back to sniff your boots.', 'Thistle lets you bury your hands in her wool.', 'Thistle trots after you like a cloud with legs.'] },
            { id: 'pepper', kind: 'goat', name: 'PEPPER', w: 1.15, face: -1, pen: [33, 20, 39, 21], gives: 'milk', every: 2, lines: ['Pepper tries to eat your sleeve.', 'Pepper headbutts you, gently. Mostly gently.', 'Pepper climbs onto the trough just to be closer to you.'] },
            { id: 'turnip', kind: 'pig', name: 'TURNIP', w: 1.15, face: -1, pen: [33, 20, 39, 21], lines: ['Turnip snorts and ignores you.', 'Turnip rolls over for a belly scratch.', 'Turnip squeals with joy and follows you to the fence.'] },
            { id: 'hen', kind: 'chicken', name: 'HETTY', w: 0.8, face: 1, pen: [42, 21, 49, 22], gives: 'eggs', every: 1, lines: ['Hetty clucks suspiciously.', 'Hetty settles down beside your feet.', 'Hetty runs to you whenever you come home.'] },
            { id: 'rooster', kind: 'rooster', name: 'SIR CROWSWORTH', w: 1.0, face: -1, pen: [42, 21, 49, 22], lines: ['Sir Crowsworth puffs up at you.', 'Sir Crowsworth allows you to stand nearby.', 'Sir Crowsworth crows at dawn just for you. Probably.'] },
            { id: 'puddle', kind: 'duck', name: 'PUDDLE', w: 0.85, face: -1, pen: [42, 21, 49, 22], gives: 'eggs', every: 2, lines: ['Puddle quacks once and waddles off.', 'Puddle nibbles your fingers.', 'Puddle follows you in a little line of one.'] },
            { id: 'duchess', kind: 'goose', name: 'DUCHESS', w: 0.9, face: -1, pen: [42, 21, 49, 22], lines: ['Duchess hisses. Duchess hisses at everyone.', 'Duchess hisses, but softer.', 'Duchess guards the farm gate like it is hers.'] },
            { id: 'biscuit', kind: 'dog', name: 'BISCUIT', w: 1.2, face: -1, pen: [19, 20, 26, 21], lines: ['Biscuit wags so hard his whole body wags.', 'Biscuit brings you a stick. It is mostly a root.', 'Biscuit sleeps across the doorway, keeping watch.'] },
            { id: 'soot', kind: 'cat', name: 'SOOT', w: 0.95, face: -1, pen: [19, 20, 26, 21], lines: ['Soot watches you from a safe distance.', 'Soot winds once around your ankles.', 'Soot sleeps on the warm windowsill and purrs when you pass.'] }
        ];
        const AN = {}; // live positions
        function animalLive(a) {
            let s = AN[a.id]; if (s) return s;
            const [x0, y0, x1, y1] = a.pen; let gx = x0 + Math.floor(hash1(a.id.length * 97 + x0) * (x1 - x0 + 1)), gy = y0 + Math.floor(hash1(a.id.charCodeAt(0) * 31) * (y1 - y0 + 1));
            s = AN[a.id] = { gx, gy, px: gx * TILE_SIZE, py: gy * TILE_SIZE, tx: gx * TILE_SIZE, ty: gy * TILE_SIZE, flip: false, t: performance.now() + Math.random() * 3000, bob: 0 }; return s;
        }
        function animalAt(gx, gy) { if (currentMapName !== 'overworld') return null; for (const a of ANIMALS) { const s = AN[a.id]; if (s && s.gx === gx && s.gy === gy) return a; } return null; }
        // ---- people: the folk of Brennan's Theme and Rahjai ----
        const FOLK = [
            { id: 'sudashorn', art: 'f_sudashorn', name: 'SUDASHORN', at: [30, 15], spouse: true,
              lines: ['Oh! You are the one living out past the fence? It must be so quiet out there.', 'I walked out to Rahjai at sunset yesterday. The whole sky looked like it was holding its breath.', 'You always smell like rain and hay. I like it.', 'Stay for a little while? I like hearing about your animals.'] },
            { id: 'merchant', art: 'f_merchant', name: 'MERCHANT', at: [18, 19], stall: true, lines: ['Seeds, chickens, a fair price for your harvest. That is the whole business.'] },
            { id: 'farmer', art: 'f_farmer', name: 'OLD FARMER', at: [7, 20],
              lines: ['Rain does the watering for you. Do not fight the sky, son.', 'Emberwheat takes four dawns. Mill it into pasta in your kitchen.', 'Wild garlic and herbs come up along the field edges every morning.', 'When the wolves sing at the moon, keep your crops close and your sword closer.'] },
            { id: 'elder', art: 'f_elder', name: 'ELDER', at: [26, 11],
              lines: ['The ruins on the horizon were old when this town was a single tent.', 'Some nights something stands out in the fog, taller than the hills. Do not walk toward it.', 'A home is a small thing. That is why it matters.'] },
            { id: 'child', art: 'f_child', name: 'PIP', at: [20, 13], lines: ['Can I pet your horse? Just once? Twice?', 'I saw a lady in the field last night. She did not have a lantern.', 'Biscuit is the best dog in the whole world.'] },
            { id: 'clito', art: 'f_clito', name: 'CLITO', at: [40, 12], lines: ['Brennan\'s Theme pours a fine dark ale. Do not tell the Elder I said so.', 'People talk at the Tellhouse. Most of it is even true.'] },
            { id: 'franz', art: 'f_franz', name: 'FRANZ YOSEF', at: [46, 14], lines: ['A butcher in Haven sells good chicken. Herbs, garlic, butter... now that is a supper.', 'I courted my wife with a single plate of pasta. Never underestimate a good meal.'] },
            { id: 'guide', art: 'f_guide', name: 'GUIDE', at: [7, 18], lines: ['East is the Wastes. North past the canyon, the long trail to Haven.', 'Lost? Tap your map. Set a course. The arrow will not lie to you.'] },
            { id: 'sister', art: 'f_sister', name: '???', night: true, lines: ['...'] }
        ];
        const FOLK_POS = {};
        function folkPos(f) { // the nearest open tile to where they like to stand
            if (FOLK_POS[f.id]) return FOLK_POS[f.id]; if (!f.at) return null;
            const open = (x, y) => x > 0 && y > 0 && x < MAP_COLS - 1 && y < MAP_ROWS - 1 && ![1, 2, 3, 4, 6, 9, 10, 11, 14, 16, 5, TILE_BUMPER].includes(MAP_DATA[y][x]) && !FARM_SOLID.has(x + ',' + y) && !(FARM_PLOTS.some(p => p[0] === x && p[1] === y));
            const q = [[f.at[0], f.at[1]]], seen = new Set();
            while (q.length) { const [x, y] = q.shift(), k = x + ',' + y; if (seen.has(k)) continue; seen.add(k); if (open(x, y)) return FOLK_POS[f.id] = [x, y]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (seen.size < 400) q.push([x + dx, y + dy]); }
            return null;
        }
        function spouseHomeSpot() { return [25, 20]; }
        function folkWhere(f) { // where this person is right now (or null: not here)
            const F = farmState();
            if (f.id === 'sister') return LIFE.sister && currentMapName === 'overworld' ? LIFE.sister : null;
            if (F.spouse === f.id) { if (F.follow) return null; if (currentMapName !== 'overworld' || isNight()) return null; return spouseHomeSpot(); } // married: lives at the farmhouse (inside after dark)
            if (currentMapName !== 'overworld') return null;
            const n = TOWN_SCHED[f.id] ? townLive(f) : null; if (n) return n.state === 'sleep' || n.state === 'prowl' ? null : [n.x, n.y]; // indoors, or not wanting to be seen
            return folkPos(f);
        }
