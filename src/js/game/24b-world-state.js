        // ================= WORLD STATE: where you are, health, the journal, the hero and his dog (lived beside the paper town in the 24 module; split out so the paper code stands alone) =================
        let currentMapName = 'overworld'; 
        let savedOverworldX = 23 * TILE_SIZE;
        let savedOverworldY = 21 * TILE_SIZE;
        let apartmentRented = false;

        let playerHealth = { current: 100, max: 100 };

        const WORLD_LOCATIONS = {
            "Temple of the Heads": "Where the priestess kept the balance between the divine Heads and the land. Where you fell.",
            "Tomb of Waking": "The tomb beneath the temple where you woke with an unfinished Head.",
            "Town Gate": "The fence-line threshold between Brennan's Theme and the wild field beyond.",
            "Brennan's Theme": "The town proper — home to the Tiger Emporium and the Tellhouse.",
            "Tiger Emporium": "General store run by the Tiger family. Potions, gear, and gossip.",
            "The Tellhouse": "A drinking house where rumor and truth get equally loud.",
            "Wolf's Hollow": "A wooded hollow beyond the field. Something happened here."
        };

        const journal = {
            clues: [],
            importantClues: [],
            rumors: [],
            people: {},
            questions: [
                "Who was at Town Gate the night of the disturbance?",
                "What happened in Wolf's Hollow?",
                "Why are people reluctant to talk about it?"
            ]
        };

        function logClue(text, tier) {
            if (tier === 'IMPORTANT CLUE') {
                if (!journal.importantClues.includes(text)) journal.importantClues.push(text);
            } else {
                if (!journal.clues.includes(text)) journal.clues.push(text);
            }
            showFluidMessage("[Journal updated: " + (tier || 'CLUE') + "]");
        }

        function logRumor(text) {
            if (!journal.rumors.includes(text)) journal.rumors.push(text);
            showFluidMessage("[Journal updated: RUMOR]");
        }

        function toggleJournal() {
            const modal = document.getElementById('journal-modal');
            if (!modal) return;
            const opening = modal.classList.contains('hidden');
            if (opening) {
                renderJournal();
                modal.classList.remove('hidden');
                audio.playSelect();
            } else {
                modal.classList.add('hidden');
            }
        }

        function renderJournal() {
            const body = document.getElementById('journal-body');
            if (!body) return;

            const caseText = journal.importantClues.length > 0
                ? "The disturbances are more than rumor now. Someone was seen near Wolf's Hollow the night things changed."
                : "Strange disturbances have unsettled Brennan's Theme. Something is happening near Town Gate and out past the fence.";

            let html = '';
            html += `<div class="mb-3"><div class="text-yellow-400 font-bold mb-1">CASE: The Strange Disturbances</div><div class="text-slate-300">${caseText}</div></div>`;

            html += `<div class="mb-3"><div class="text-red-400 font-bold mb-1">IMPORTANT CLUES</div>`;
            html += journal.importantClues.length
                ? journal.importantClues.map(c => `<div class="mb-1">• ${c}</div>`).join('')
                : `<div class="text-slate-500 italic">Nothing critical yet.</div>`;
            html += `</div>`;

            html += `<div class="mb-3"><div class="text-cyan-400 font-bold mb-1">CLUES</div>`;
            html += journal.clues.length
                ? journal.clues.map(c => `<div class="mb-1">• ${c}</div>`).join('')
                : `<div class="text-slate-500 italic">Nothing recorded yet.</div>`;
            html += `</div>`;

            html += `<div class="mb-3"><div class="text-amber-400 font-bold mb-1">RUMORS</div>`;
            html += journal.rumors.length
                ? journal.rumors.map(c => `<div class="mb-1">• ${c}</div>`).join('')
                : `<div class="text-slate-500 italic">No rumors heard yet.</div>`;
            html += `</div>`;

            html += `<div class="mb-3"><div class="text-emerald-400 font-bold mb-1">PLACES</div>`;
            html += Object.entries(WORLD_LOCATIONS).map(([name, desc]) => `<div class="mb-1">• <span class="text-white">${name}</span> — ${desc}</div>`).join('');
            html += `</div>`;

            html += `<div><div class="text-purple-400 font-bold mb-1">QUESTIONS</div>`;
            html += journal.questions.map(q => `<div class="mb-1">• ${q}</div>`).join('');
            html += `</div>`;

            body.innerHTML = html;
        }


        function updateHealthBar() {
            const fill = document.getElementById('hero-health-bar-fill');
            if (!fill) return;
            const pct = Math.max(0, Math.min(100, (playerHealth.current / playerHealth.max) * 100));
            const _v2hp=document.getElementById('v2-hp-fill'),_v2hn=document.getElementById('v2-hp-num');
            if(_v2hp){_v2hp.style.width=Math.round(pct)+'%';} if(_v2hn){_v2hn.textContent=playerHealth.current+'/'+playerHealth.max;}
            fill.style.width = pct + '%';
            fill.style.background = pct > 50 ? '#4ade80' : (pct > 20 ? '#facc15' : '#f87171');
        }

        function damagePlayer(amount) {
            playerHealth.current = Math.max(0, playerHealth.current - amount);
            updateHealthBar();
        }

        let fluidToastTimeout = null;
        function showFluidMessage(text, duration = 1600) {
            const el = document.getElementById('fluid-toast');
            if (!el) return;
            el.innerText = text;
            el.classList.add('show');
            if (fluidToastTimeout) clearTimeout(fluidToastTimeout);
            fluidToastTimeout = setTimeout(() => { el.classList.remove('show'); }, duration);
        }

        function healPlayer(amount) {
            playerHealth.current = Math.min(playerHealth.max, playerHealth.current + amount);
            updateHealthBar();
        }

        function usePotion() {
            if (gameState === "INVENTORY" && playerPotions > 0 && playerHealth.current < playerHealth.max) {
                playerPotions--;
                healPlayer(30);
                updatePotionUI();
                audio.playCollect();
                showFluidMessage("You drink a Potion. [+30 HP]");
            } else if (playerPotions <= 0) {
                audio.playBump();
                showFluidMessage("No Potions left — buy more at the Tiger Emporium.");
            } else if (playerHealth.current >= playerHealth.max) {
                showFluidMessage("Already at full health.");
            }
        }

        const player = {
            gridX: 23,
            gridY: 21,
            pixelX: 23 * TILE_SIZE,
            pixelY: 21 * TILE_SIZE,
            targetX: 23 * TILE_SIZE,
            targetY: 21 * TILE_SIZE,
            dir: 'up',
            isMoving: false,
            animFrame: 0,
            gemsCollected: 0,
            totalGems: 12,
            stateFlags: 0xFFFFFFFF
        };

        const companion = {
            active: false,
            gridX: 4,
            gridY: 3,
            pixelX: 4 * TILE_SIZE,
            pixelY: 3 * TILE_SIZE,
            targetX: 4 * TILE_SIZE,
            targetY: 3 * TILE_SIZE,
            dir: 'down',
            isMoving: false,
            animFrame: 0,
            name: 'Ghost',
            moveTimer: 0
        };

        function drawDogSprite(x, y, dir, frame) {
            ctx.save();
            ctx.translate(x + 2, y + 3);

            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(1, 10, 8, 3);

            ctx.fillStyle = '#1e293b';
            ctx.fillRect(2, 4, 8, 5);

            ctx.fillStyle = '#334155';
            if (dir === 'left') {
                ctx.fillRect(0, 3, 5, 5);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(0, 5, 1, 1);
            } else if (dir === 'right') {
                ctx.fillRect(7, 3, 5, 5);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(11, 5, 1, 1);
            } else {
                ctx.fillRect(3, 2, 6, 5);
                ctx.fillStyle = '#0f172a';
                ctx.fillRect(5, 5, 1, 1);
            }

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(2, 2, 2, 3);
            ctx.fillRect(8, 2, 2, 3);

            const tailWag = Math.floor(frame) % 2 === 0 ? 1 : 0;
            ctx.fillStyle = '#334155';
            if (dir === 'left') {
                ctx.fillRect(10, 3 + tailWag, 2, 2);
            } else if (dir === 'right') {
                ctx.fillRect(0, 3 + tailWag, 2, 2);
            } else {
                ctx.fillRect(5, 8 + tailWag, 2, 2);
            }

            ctx.fillStyle = '#0f172a';
            ctx.fillRect(3, 9, 1, 2);
            ctx.fillRect(8, 9, 1, 2);

            ctx.restore();
        }

        // ---- WOLVES: roam the open field south of the town gate ----
        const wolves = [];
        let lockedWolf = null;
        let lastCamX = 0;
        let lastCamY = 0;
        const WOLF_FIELD_ROWS = [18, 19, 20, 21, 22];
        const WOLF_FIELD_COLS = [51, 53, 55, 57, 59, 61];
        const FIELD_TOP = 18; // the fence (row 17) keeps the wild things out of town: wolves and wild horses live south of it
        const WILD_EDGE = 50; // east of here is wild; the homestead is west of it
        (function openRahjai() { for (let y = FIELD_TOP; y <= 22; y++) for (let x = 5; x <= 68; x++) if ([1, 2, 3, 4, 6, 9, 10, 11, 12, 13, 15].includes(MAP_DATA[y][x])) MAP_DATA[y][x] = 0; })();
