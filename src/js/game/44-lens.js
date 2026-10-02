        // ================= LENS (the magnifier, top-left): an empty framework for inspecting the world =================
        // Nothing is defined yet. Later, fill the arrays: LENS.addTarget({ map, x, y, text, clue, important, once }) or LENS.register(ctx => text | null).
        const LENS = {
            filters: [],  // (ctx) => false blocks the lens (for example during a cutscene)
            handlers: [], // (ctx) => text | null; the first text returned is shown
            targets: [],  // fixed inspectable spots; empty for now
            seen: new Set(),
            register(fn) { this.handlers.push(fn); },
            addTarget(t) { this.targets.push(t); },
            context() {
                const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[player.dir] || [0, 1];
                return { map: currentMapName, x: player.gridX, y: player.gridY, dir: player.dir, fx: player.gridX + v[0], fy: player.gridY + v[1] };
            },
            use() {
                if (!gameStarted || gameState !== 'PLAYING' || inDialogue) return;
                const c = this.context();
                if (this.filters.some(f => f(c) === false)) return;
                let text = null;
                for (const t of this.targets) {
                    if (t.map === c.map && t.x === c.fx && t.y === c.fy && !(t.once && this.seen.has(t))) {
                        this.seen.add(t); text = t.text;
                        if (t.clue) logClue(t.clue, t.important ? 'IMPORTANT CLUE' : 'CLUE');
                        break;
                    }
                }
                for (let i = 0; text === null && i < this.handlers.length; i++) text = this.handlers[i](c) ?? null;
                if (text) showDialogue(text); else showFluidMessage('LENS: nothing to inspect here yet.');
            }
        };
        document.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('lens-btn'); if (b) b.addEventListener('click', () => LENS.use()); });
        LENS.register(c => { const r = riteSiteAt(c.map, c.fx, c.fy) || riteSiteAt(c.map, c.x, c.y); return r ? r.lens : null; });

        // ---- LENS content: line-pools keyed by tile id per map; the same tile always reads the same line
        const pickLine = (lines, x, y) => lines[Math.abs((x * 374761393 + y * 668265263) | 0) % lines.length];
        const LENS_LINES = {
            overworld: {
                9: ["A sun-bleached dead tree, roots clawing at the sand.", "The tree died standing. Something in the soil, maybe."],
                10: ["A weather-worn gravestone. Whatever name was carved here has faded to nothing.", "A grave marker, half swallowed by sand. No one has tended it in years."],
                11: ["A cluster of rocks and old fence posts, half-buried in drifting sand."],
                13: () => isNight() ? "The lamp burns steady, holding the dark at bay." : "The lamp stands unlit, waiting for dusk.",
                8: ["A power crystal glints faintly, humming just below hearing."]
            },
            wolf_hollow: {
                1: ["Tangled, leafless branches crowd the hollow.", "A dead tree, bark peeling in long dry strips."],
                2: ["A living tree, one of the few still green out here."],
                11: ["Broken branches, snapped low as if something large forced through."],
                12: ["A patch of cold fog clings to the ground, unmoved by the wind."],
                15: ["Moss-covered stones, worn smooth by rain that rarely falls here."]
            },
            cave: { 1: ["The cave wall is damp and cold to the touch."], 2: ["The torch crackles, throwing wild shadows across the stone."] },
            tomb: { 1: ["Sand-worn carvings line the wall, too faded to make out."], 6: ["A carved stone pillar, chipped by centuries of blown sand."] },
            waking: {
                1: ["Funerary carvings: rows of heads, each one crowned. Near the floor they are left unfinished.", "The wall is carved with a procession of Heads moving toward a single light."],
                2: ["The torch should have burned out long ago. Something is still feeding it."],
                5: ["Old bones, laid out with care. Someone was buried properly here, once."],
                6: ["A pillar carved as a standing figure whose face has been chiselled away."],
                10: ["The funeral slab you woke on. The stone is still cold where you lay."],
                11: ["An empty niche where the Head was kept. The power that placed it has gone quiet."]
            }
        };
        LENS.register(c => {
            const pool = LENS_LINES[c.map]; if (!pool) return null;
            let t;
            if (c.map === 'overworld') { if (c.fx < 0 || c.fy < 0 || c.fx >= MAP_COLS || c.fy >= MAP_ROWS) return null; t = MAP_DATA[c.fy][c.fx]; }
            else if (c.map === 'wolf_hollow') { if (c.fx < 0 || c.fy < 0 || c.fy >= WOLF_HOLLOW_MAP.length || c.fx >= WOLF_HOLLOW_MAP[0].length) return null; t = WOLF_HOLLOW_MAP[c.fy][c.fx]; }
            else { const z = ZONES[c.map]; if (!z || c.fx < 0 || c.fy < 0 || c.fy >= z.data.length || c.fx >= z.data[0].length) return null; t = z.data[c.fy][c.fx]; }
            const entry = pool[t]; if (entry == null) return null;
            return typeof entry === 'function' ? entry(c) : pickLine(entry, c.fx, c.fy);
        });
        LENS.register(c => { // a locked door hints at what would open it
            if (c.map !== 'overworld' || c.fx < 0 || c.fy < 0 || c.fx >= MAP_COLS || c.fy >= MAP_ROWS) return null;
            if (MAP_DATA[c.fy][c.fx] !== 5 || apartmentRented) return null;
            return "The door is locked. Perhaps its owner would rent the place out.";
        });

