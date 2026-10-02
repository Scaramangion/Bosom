        // ===== the mission: the house west of Haven's fountain holds the memory of that night =====
        function enterMissionHouse() {
            player.gridY = 13; player.pixelY = player.targetY = 13 * TILE_SIZE; player.isMoving = false; player.dir = 'down'; player.face8 = 'down'; // back out on the step
            if (zoneFlags.princessMission) { showDialogue('The house is quiet. Her room is just as she left it.'); return; }
            OP.mission = true; runOpening(false);
        }
        function finishMissionCutscene() {
            OP.mission = false; zoneFlags.princessMission = true;
            ['MISSION: Rescue the princess. An agent of the Malignant Principles carried her off into blighted land.',
             'Only by completing true Heads and performing the restorative rites can you reach her.'].forEach(c => { if (!journal.importantClues.includes(c)) journal.importantClues.push(c); });
            ['Who was the agent that took the princess?', 'Where does the blighted land begin?', 'How is a true Head completed?'].reverse().forEach(q => { if (!journal.questions.includes(q)) journal.questions.unshift(q); });
            showFluidMessage('MISSION: Rescue the princess.', 3400);
        }
        function combatStep() { // once per simulation step: drop the stance if something else took over, and ease the camera
            if (COMBAT.on && (equippedItem !== 'sword' || HORSE.mounted || gameState !== 'PLAYING' || !gameStarted)) sheatheSword(true);
            const lc = COMBAT.on && lockedWolf && lockedWolf.alive && !lockedWolf.fleeing && Math.max(Math.abs(lockedWolf.pixelX - player.pixelX), Math.abs(lockedWolf.pixelY - player.pixelY)) <= 2.2 * TILE_SIZE;
            // close quarters: the camera rises partway back toward overhead so the hero doesn't hide what he's fighting
            const want = FX_GL.ok && gameStarted && FX_GL.curMode !== 3 ? (lc && !(PAPER.on && currentMapName === 'overworld') ? 0.45 : 1) : 0; // third person everywhere but the fixed-camera rooms
            COMBAT.amt += (want - COMBAT.amt) * 0.075; if (Math.abs(want - COMBAT.amt) < 0.002) COMBAT.amt = want;
            // lock-on: the nearest wolf in range while the sword is out; the camera leans toward it so both stay in frame
            if (COMBAT.on && currentMapName === 'overworld') {
                const dist = w => Math.hypot(w.gridX - player.gridX, w.gridY - player.gridY);
                if (!lockedWolf || !lockedWolf.alive || lockedWolf.fleeing || dist(lockedWolf) > 9) {
                    let best = null; for (const w of wolves) if (w.alive && !w.fleeing && dist(w) <= 7 && (!best || dist(w) < dist(best))) best = w;
                    lockedWolf = best;
                }
            } else if (!COMBAT.on && COMBAT.amt === 0 && lockedWolf && lockedWolf.autoLock) lockedWolf = null;
            if (lockedWolf && COMBAT.on) lockedWolf.autoLock = true;
            const lw = COMBAT.on && lockedWolf && lockedWolf.alive && !lockedWolf.fleeing ? lockedWolf : null;
            const tfx = lw ? (lw.pixelX - player.pixelX) * 0.45 : 0, tfy = lw ? (lw.pixelY - player.pixelY) * 0.45 : 0;
            COMBAT.fx += (tfx - COMBAT.fx) * 0.08; COMBAT.fy += (tfy - COMBAT.fy) * 0.08;
            if (COMBAT.shake > 0) { COMBAT.shake--; COMBAT.sx = (Math.random() - 0.5) * COMBAT.shake * 0.7; COMBAT.sy = (Math.random() - 0.5) * COMBAT.shake * 0.5; } else { COMBAT.sx = COMBAT.sy = 0; }
            for (const w of wolves) if (w.hitT > 0) w.hitT--;
            for (const b of COMBAT.sparks) { b.t++; for (const q of b.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.09; } }
            COMBAT.sparks = COMBAT.sparks.filter(b => b.t < 16);
        }
        function aButtonSnapshot() { return [inDialogue, currentMapName, player.gemsCollected, HORSE.mounted, HORSE.mountUntil, gameState, POUCH.state, document.querySelectorAll('.hidden').length].join('|'); }
        function handleAButton() { // A = interact. Only when there's nothing to interact with does it use a weapon, and only one that's equipped
            if (HORSE.mounted && !POUCH.state && !inDialogue && gameStarted && performance.now() >= HORSE.mountUntil) { // get down, even mid-stride
                if (player.isMoving) { player.pixelX = player.targetX; player.pixelY = player.targetY; player.isMoving = false; }
                dismountHorse(); return;
            }
            if (!inDialogue && !POUCH.state && (patrolInteract() || farmInteract() || growInteract())) return;
            const before = aButtonSnapshot();
            handleAButtonBase();
            if (!gameStarted || gameState !== 'PLAYING' || inDialogue || POUCH.state || HORSE.mounted || cinematicMode || aButtonSnapshot() !== before) return;
            if (equippedItem === 'sword') { if (!COMBAT.on) drawSword(); else useEquippedToolAction(); }
            else if (equippedItem === 'axe') useEquippedToolAction();
        }
        function handleAButtonBase() {
            if (POUCH.state) { confirmPouch(); return; }
            if (!inDialogue && gameStarted && !player.isMoving && performance.now() >= HORSE.mountUntil) {
                if (HORSE.mounted) { dismountHorse(); return; }
                if (horseNear()) { mountHorse(); return; }
            }
            if (inDialogue && dialogueTyping()) { finishTyping(true); return; }
            if (inDialogue) {
                if (!document.getElementById('dialogue-actions').classList.contains('hidden') ||
                    !document.getElementById('shop-buy-actions').classList.contains('hidden') ||
                    !document.getElementById('npc-dialogue-actions').classList.contains('hidden')) {
                    return;
                }
                hideDialogue();
                return;
            }

            let targetGX = player.gridX;
            let targetGY = player.gridY;
            if (player.dir === 'up') targetGY--;
            if (player.dir === 'down') targetGY++;
            if (player.dir === 'left') targetGX--;
            if (player.dir === 'right') targetGX++;

            if (currentMapName === 'shop') {
                if (targetGY === 2 && targetGX >= 1 && targetGX <= 7) {
                    showTigerShopMenu();
                } else if (targetGX === 8 && targetGY === 0) {
                    goToUpstairs();
                }
            } else if (currentMapName === 'shop_upstairs') {
                if (targetGX === 8 && targetGY === 1) {
                    goToDownstairs();
                } else if (targetGX === 2 && targetGY === 1) {
                    showDialogue("TIGER MAMA: 'Welcome detective! Open your Inventory [START/S] to equip your Torch or Truth Lens.'");
                } else if (targetGX === 5 && targetGY === 1) {
                    showDialogue("TORA: 'Detective Beausoleil, keep swinging your axe or inspect with the Truth Lens!'");
                }
            } else if (currentMapName === 'tellhouse') {
                if (targetGX === 2 && targetGY === 3) {
                    talkToDrunkMan();
                } else if (targetGX === 5 && targetGY === 3) {
                    talkToWoman();
                }
            } else if (currentMapName === 'wolf_hollow') {
                if (targetGX >= 0 && targetGX < 16 && targetGY >= 0 && targetGY < 12) {
                    const tile = WOLF_HOLLOW_MAP[targetGY][targetGX];
                    if (tile === 16) {
                        if (!hollowCluesFound.abandonedCamp) {
                            hollowCluesFound.abandonedCamp = true;
                            logClue("An abandoned campsite in Wolf's Hollow — the fire's long cold, but someone left in a hurry.", 'CLUE');
                            showDialogue("An old campsite, half-collapsed. Whoever was here left in a hurry — gear's still scattered around the cold fire pit.");
                        } else {
                            showDialogue("The abandoned campsite. Still no sign of who left it behind.");
                        }
                    }
                }
            } else if (ZONES[currentMapName]) {
                zoneInteract(targetGX, targetGY);
            } else {
                const npcHit = npcAt(targetGX, targetGY);
                if (npcHit) {
                    talkToNpc(npcHit);
                } else if (targetGX >= 0 && targetGX < MAP_COLS && targetGY >= 0 && targetGY < MAP_ROWS) {
                    const tile = MAP_DATA[targetGY][targetGX];
                    if (tile === 7) {
                        const sx = targetGX >= 30 && targetGX < 60 ? 59 - targetGX : targetGX;
                        const signText = SIGN_TEXTS[sx + ',' + targetGY] ?? SIGN_TEXTS.default;
                        if (signText) showDialogue("SIGN: '" + signText + "'");
                    } else if (tile === 5) {
                        enterBuilding(targetGX, targetGY);
                    } else if (tile === 8) {
                        MAP_DATA[targetGY][targetGX] = 0;
                        player.gemsCollected++;
                        document.getElementById('gem-count').innerText = `${player.gemsCollected}/${player.totalGems}`; const _vc=document.getElementById('v2-gem-count'); if(_vc) _vc.textContent=player.gemsCollected;
                        audio.playCollect();
                        if(companion.active) audio.playBark();
                        showDialogue(`Discovered a POWER CRYSTAL! (${player.gemsCollected}/${player.totalGems}) Detective deduction level increased!`);
                    }
                }
            }
        }

        function openNpcConversation(text, choices) {
            inDialogue = true;
            audio.playSelect();
            document.getElementById('dialogue-box').classList.remove('hidden');
            typeDialogue(document.getElementById('dialogue-text'), text);
            document.getElementById('dialogue-actions').classList.add('hidden');
            document.getElementById('shop-buy-actions').classList.add('hidden');
            const npcActionsEl = document.getElementById('npc-dialogue-actions');
            npcActionsEl.innerHTML = '';
            npcActionsEl.classList.remove('hidden');
            choices.forEach(choice => {
                const btn = document.createElement('button');
                btn.innerText = choice.label;
                btn.className = "bg-slate-700 hover:bg-slate-600 py-1.5 px-2 rounded text-[8px] text-white active:scale-95 border border-slate-500 text-left";
                btn.onclick = choice.handler;
                npcActionsEl.appendChild(btn);
            });
        }

        function talkToDrunkMan() {
            drunkManTalkCount++;
            audio.playSelect();
            if (drunkManTalkCount === 1) {
                openNpcConversation("DRUNK MAN: \"I'm telling you, I heard it from the north road!\"", [
                    { label: "What did you hear?", handler: () => {
                        logRumor("A drunk man at the Tellhouse claims he heard something from the north road.");
                        openNpcConversation("DRUNK MAN: \"A howling, low and long. Not like any wolf I've heard before. Gave me chills.\"", [
                            { label: "Never mind", handler: hideDialogue }
                        ]);
                    }},
                    { label: "Were you really awake?", handler: () => {
                        openNpcConversation("DRUNK MAN: \"'Course I was! ...Mostly.\" (The woman nearby scoffs loudly.)", [
                            { label: "Never mind", handler: hideDialogue }
                        ]);
                    }},
                    { label: "Never mind", handler: hideDialogue }
                ]);
            } else if (drunkManTalkCount === 2) {
                openNpcConversation("DRUNK MAN: \"You're still asking about that? Fine. The noise came from near the old road bridge — past the hollow.\"", [
                    { label: "Near Wolf's Hollow?", handler: () => {
                        logRumor("The drunk man says the strange howling came from near the old bridge, past Wolf's Hollow.");
                        openNpcConversation("DRUNK MAN: \"Aye. Wouldn't catch me out there after dark, detective.\"", [
                            { label: "Never mind", handler: hideDialogue }
                        ]);
                    }},
                    { label: "Never mind", handler: hideDialogue }
                ]);
            } else {
                openNpcConversation("DRUNK MAN: \"Look... I didn't want to say anything before, but I saw someone near the hollow that night.\"", [
                    { label: "Who did you see?", handler: () => {
                        logClue("The drunk man admits he saw someone near Wolf's Hollow the night of the disturbance — tall, moved fast, face unseen.", 'IMPORTANT CLUE');
                        openNpcConversation("DRUNK MAN: \"Couldn't tell you. Tall. Moved fast. Dark cloak, maybe. That's all I got, and that's all I'm saying.\"", [
                            { label: "Never mind", handler: hideDialogue }
                        ]);
                    }},
                    { label: "Never mind", handler: hideDialogue }
                ]);
            }
        }

        function talkToWoman() {
            womanTalkCount++;
            audio.playSelect();
            if (womanTalkCount === 1) {
                openNpcConversation("WOMAN: \"He was snoring by midnight, whatever he tells you. But... I did hear something myself, later.\"", [
                    { label: "What did you hear?", handler: () => {
                        logClue("The woman at the Tellhouse personally heard something outside, later that night.", 'OBSERVATION');
                        openNpcConversation("WOMAN: \"Footsteps. Slow ones, right past the window. I told myself it was nothing.\"", [
                            { label: "Never mind", handler: hideDialogue }
                        ]);
                    }},
                    { label: "Do you believe him?", handler: () => {
                        openNpcConversation("WOMAN: \"Half of it. He exaggerates. But he's not usually wrong about sounds — he's slept outside more nights than in.\"", [
                            { label: "Never mind", handler: hideDialogue }
                        ]);
                    }},
                    { label: "Never mind", handler: hideDialogue }
                ]);
            } else {
                openNpcConversation("WOMAN: \"Still poking around? Word is the shopkeeper's seen strange customers too. Might want to ask him.\"", [
                    { label: "Never mind", handler: () => {
                        logRumor("A Tellhouse regular suggests the Tiger Shopkeeper may have noticed unusual customers.");
                        hideDialogue();
                    }}
                ]);
            }
        }

        function showTigerShopMenu() {
            inDialogue = true;
            audio.playSelect();
            const box = document.getElementById('dialogue-box');
            const textEl = document.getElementById('dialogue-text');
            const actionsEl = document.getElementById('dialogue-actions');
            const buyActionsEl = document.getElementById('shop-buy-actions');
            const recruitBtn = document.getElementById('ghost-recruit-btn');
            
            box.classList.remove('hidden');
            actionsEl.classList.remove('hidden');
            buyActionsEl.classList.add('hidden');
            
            if (companion.active) {
                recruitBtn.innerText = "GHOST RECRUITED";
                recruitBtn.disabled = true;
                recruitBtn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                recruitBtn.innerText = "RECRUIT GHOST";
                recruitBtn.disabled = false;
                recruitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            }

            typeDialogue(textEl, companion.active 
                ? "TIGER SHOPKEEPER: 'Ghost is your loyal detective partner now! Open your Inventory to switch tools anytime!'"
                : "TIGER SHOPKEEPER: 'Welcome to the Emporium! Ghost is resting right here. Would you like to recruit him as your detective companion?'");
        }

        function handleShopChoice(choice) {
            const textEl = document.getElementById('dialogue-text');
            const actionsEl = document.getElementById('dialogue-actions');
            const buyActionsEl = document.getElementById('shop-buy-actions');
            audio.playSelect();

            if (choice === 'buy') {
                typeDialogue(textEl, "TIGER SHOPKEEPER: 'Exchange your Power Crystals for detective tools and apartment access!'");
                actionsEl.classList.add('hidden');
                buyActionsEl.classList.remove('hidden');
            } else if (choice === 'ghost') {
                if (!companion.active) {
                    companion.active = true;
                    companion.gridX = player.gridX;
                    companion.gridY = player.gridY + 1;
                    companion.pixelX = companion.gridX * TILE_SIZE;
                    companion.pixelY = companion.gridY * TILE_SIZE;
                    audio.playBark();
                    audio.playCollect();
                    typeDialogue(textEl, "TIGER SHOPKEEPER: 'Ghost accepted your detective commission! He will now accompany you across Brennan\\'s Theme.'");
                    document.getElementById('ghost-recruit-btn').innerText = "GHOST RECRUITED";
                    document.getElementById('ghost-recruit-btn').disabled = true;
                    document.getElementById('ghost-recruit-btn').classList.add('opacity-50', 'cursor-not-allowed');
                }
            } else if (choice === 'rumors') {
                shopkeeperTalkCount++;
                document.getElementById('dialogue-box').classList.remove('hidden');
                if (shopkeeperTalkCount === 1) {
                    openNpcConversation("TIGER SHOPKEEPER: \"Investigating, are you? Been a strange season, I'll say that much.\"", [
                        { label: "Noticed anything unusual?", handler: () => {
                            logRumor("The Tiger Shopkeeper mentions a few unusual customers lately.");
                            openNpcConversation("TIGER SHOPKEEPER: \"A few faces I didn't recognize, buying rope and lantern oil like they were headed somewhere far. Didn't ask where.\"", [
                                { label: "Never mind", handler: hideDialogue }
                            ]);
                        }},
                        { label: "Heard any strange noises?", handler: () => {
                            openNpcConversation("TIGER SHOPKEEPER: \"Can't say I have, but Tora swears she heard howling past the gate a few nights back.\"", [
                                { label: "Never mind", handler: hideDialogue }
                            ]);
                        }},
                        { label: "Never mind", handler: hideDialogue }
                    ]);
                } else if (shopkeeperTalkCount === 2) {
                    openNpcConversation("TIGER SHOPKEEPER: \"Back again? Must be serious.\"", [
                        { label: "Anyone from Wolf's Hollow come through?", handler: () => {
                            logClue("The shopkeeper recalls someone arriving from the direction of Wolf's Hollow, badly shaken.", 'CLUE');
                            openNpcConversation("TIGER SHOPKEEPER: \"Now that you mention it... someone came in from that direction a week back. Didn't buy anything. Just stood by the door, shaking.\"", [
                                { label: "Never mind", handler: hideDialogue }
                            ]);
                        }},
                        { label: "Never mind", handler: hideDialogue }
                    ]);
                } else {
                    openNpcConversation(`TIGER SHOPKEEPER: "Detective clue report: There are ${player.totalGems - player.gemsCollected} crystals remaining across chopped trees and sector quadrants."`, [
                        { label: "Never mind", handler: hideDialogue }
                    ]);
                }
            }
        }

        let shopkeeperTalkCount = 0;
        let playerPotions = 0;

        function updatePotionUI() {
            const countEl = document.getElementById('potion-owned-count');
            if (countEl) countEl.innerText = playerPotions > 0 ? `(have ${playerPotions})` : '';
            const slotCountEl = document.getElementById('potion-slot-count');
            if (slotCountEl) slotCountEl.innerText = playerPotions;
        }

        function buyItem(item) {
            const textEl = document.getElementById('dialogue-text');
            if (item === 'potion') {
                if (player.gemsCollected >= 1) {
                    player.gemsCollected--;
                    playerPotions++;
                    document.getElementById('gem-count').innerText = `${player.gemsCollected}/${player.totalGems}`; const _vc=document.getElementById('v2-gem-count'); if(_vc) _vc.textContent=player.gemsCollected;
                    updatePotionUI();
                    audio.playCollect();
                    typeDialogue(textEl, `TIGER SHOPKEEPER: 'One Potion, coming right up! You now have ${playerPotions}. Use it from your Inventory.'`);
                } else {
                    audio.playBump();
                    typeDialogue(textEl, "TIGER SHOPKEEPER: 'Sorry, detective — that'll cost at least 1 Power Crystal.'");
                }
            } else if (item === 'apartment') {
                if (apartmentRented) {
                    typeDialogue(textEl, "TIGER SHOPKEEPER: 'You already rented the detective apartment building at X:15 Y:7!'");
                } else if (player.gemsCollected >= 3) {
                    player.gemsCollected -= 3;
                    apartmentRented = true;
                    document.getElementById('gem-count').innerText = `${player.gemsCollected}/${player.totalGems}`; const _vc=document.getElementById('v2-gem-count'); if(_vc) _vc.textContent=player.gemsCollected;
                    audio.playCollect();
                    audio.playClue();
                    typeDialogue(textEl, "TIGER SHOPKEEPER: 'Apartment Rented successfully! Safehouse unlocked at X:15 Y:7.'");
                } else {
                    audio.playBump();
                    typeDialogue(textEl, `TIGER SHOPKEEPER: 'You need 3 Power Crystals to rent the safehouse. You have ${player.gemsCollected}.'`);
                }
            }
        }

        function enterBuilding(gx, gy) {
            if (gx >= 30) gx = 59 - gx; // mirrored east half uses the same doors
            if (gx === 7 && gy === 4) {
                audio.playSelect();
                savedOverworldX = player.pixelX;
                savedOverworldY = player.pixelY;
                
                currentMapName = 'shop';
                player.gridX = 4;
                player.gridY = 8;
                player.pixelX = 4 * TILE_SIZE;
                player.pixelY = 8 * TILE_SIZE;
                player.targetX = player.pixelX;
                player.targetY = player.pixelY;
                player.dir = 'up';

                if (companion.active) {
                    companion.gridX = 4;
                    companion.gridY = 9;
                    companion.pixelX = 4 * TILE_SIZE;
                    companion.pixelY = 9 * TILE_SIZE;
                    companion.targetX = companion.pixelX;
                    companion.targetY = companion.pixelY;
                }

                document.getElementById('location-name').innerText = "TIGER SHOP";
                showDialogue("Entered TIGER SHOP! Speak with the Tiger Shopkeeper to recruit Ghost.");
            } else if (gx === 15 && gy === 7) {
                if (apartmentRented) {
                    audio.playSelect();
                    savedOverworldX = player.pixelX;
                    savedOverworldY = player.pixelY;

                    currentMapName = 'shop';
                    player.gridX = 4;
                    player.gridY = 8;
                    player.pixelX = 4 * TILE_SIZE;
                    player.pixelY = 8 * TILE_SIZE;
                    player.targetX = player.pixelX;
                    player.targetY = player.pixelY;
                    player.dir = 'up';

                    document.getElementById('location-name').innerText = "DETECTIVE SAFEHOUSE";
                    showDialogue("Entered your Rented Safehouse! A quiet haven for your investigation.");
                } else {
                    audio.playBump();
                    showDialogue("This safehouse is locked! Rent it first at the Tiger Shop for 3 Crystals.");
                }
            } else if (gx === 3 && gy === 14) {
                audio.playSelect();
                savedOverworldX = player.pixelX;
                savedOverworldY = player.pixelY;

                currentMapName = 'tellhouse';
                player.gridX = 4;
                player.gridY = 7;
                player.pixelX = 4 * TILE_SIZE;
                player.pixelY = 7 * TILE_SIZE;
                player.targetX = player.pixelX;
                player.targetY = player.pixelY;
                player.dir = 'up';

                tellhouseVisitCount++;
                document.getElementById('location-name').innerText = "THE TELLHOUSE";
                if (tellhouseVisitCount === 1) {
                    showFluidMessage("[Overheard] \"I'm telling you, I heard it from the north road.\" — \"You heard nothing, you were asleep before midnight.\"");
                    logClue("Overheard an argument at the Tellhouse about something heard on the north road.", 'RUMOR');
                }
            } else {
                audio.playBump();
                showDialogue("The building is locked. Visit the Tiger Shop at X:07 Y:04!");
            }
        }

        function goToUpstairs() {
            audio.playClue();
            currentMapName = 'shop_upstairs';
            player.gridX = 7;
            player.gridY = 1;
            player.pixelX = 7 * TILE_SIZE;
            player.pixelY = 1 * TILE_SIZE;
            player.targetX = player.pixelX;
            player.targetY = player.pixelY;
            player.dir = 'left';

            if (companion.active) {
                companion.gridX = 8;
                companion.gridY = 1;
                companion.pixelX = 8 * TILE_SIZE;
                companion.pixelY = 1 * TILE_SIZE;
                companion.targetX = companion.pixelX;
                companion.targetY = companion.pixelY;
            }

            document.getElementById('location-name').innerText = "TIGER FAMILY QUARTERS";
            showDialogue("Upstairs in the Tiger Family residence. Discuss leads with Tiger Mama & Tora.");
        }

        function goToDownstairs() {
            audio.playClue();
            currentMapName = 'shop';
            player.gridX = 8;
            player.gridY = 1;
            player.pixelX = 8 * TILE_SIZE;
            player.pixelY = 1 * TILE_SIZE;
            player.targetX = player.pixelX;
            player.targetY = player.pixelY;
            player.dir = 'down';

            if (companion.active) {
                companion.gridX = 9;
                companion.gridY = 1;
                companion.pixelX = 9 * TILE_SIZE;
                companion.pixelY = 1 * TILE_SIZE;
                companion.targetX = companion.pixelX;
                companion.targetY = companion.pixelY;
            }

            document.getElementById('location-name').innerText = "TIGER SHOP";
        }

        function landOnOpenGround(gx, gy) { // nearest walkable tile (south first), skipping doors/trail triggers, in the current map
            const z = ZONES[currentMapName], cols = z ? z.cols : MAP_COLS, rows = z ? z.rows : MAP_ROWS;
            const trigger = (x, y) => currentMapName === 'overworld' && [5, 14, 16].includes(MAP_DATA[y][x]);
            for (let d = 0; d <= 8; d++) for (let dy = d; dy >= -d; dy--) for (let dx = -d; dx <= d; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
                const x = gx + dx, y = gy + dy;
                if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1) continue;
                if (!isSolidTile(x, y) && !trigger(x, y)) return [x, y];
            }
            return [gx, gy];
        }
        function exitBuilding() {
            audio.playSelect();
            currentMapName = 'overworld';
            player.pixelX = savedOverworldX;
            player.pixelY = savedOverworldY + TILE_SIZE;
            [player.gridX, player.gridY] = landOnOpenGround(Math.round(player.pixelX / TILE_SIZE), Math.round(player.pixelY / TILE_SIZE));
            player.pixelX = player.gridX * TILE_SIZE; player.pixelY = player.gridY * TILE_SIZE;
            player.targetX = player.pixelX;
            player.targetY = player.pixelY;
            player.dir = 'down';

            if (companion.active) {
                companion.pixelX = player.pixelX + TILE_SIZE;
                companion.pixelY = player.pixelY;
                companion.gridX = player.gridX + 1;
                companion.gridY = player.gridY;
                companion.targetX = companion.pixelX;
                companion.targetY = companion.pixelY;
            }

            document.getElementById('location-name').innerText = "BRENNAN'S THEME";
        }

        function enterWolfHollow() {
            audio.playClue();
            savedOverworldX = player.pixelX;
            savedOverworldY = player.pixelY;

            currentMapName = 'wolf_hollow';
            player.gridX = 8;
            player.gridY = 1;
            player.pixelX = 8 * TILE_SIZE;
            player.pixelY = 1 * TILE_SIZE;
            player.targetX = player.pixelX;
            player.targetY = player.pixelY;
            player.dir = 'down';

            document.getElementById('location-name').innerText = "WOLF'S HOLLOW";
            showFluidMessage("You leave the field behind. The trees close in around the old trail.");
        }

        function exitWolfHollow() {
            audio.playSelect();
            currentMapName = 'overworld'; // come out at the trail you went in by (west or east), not always the west one
            [player.gridX, player.gridY] = landOnOpenGround(Math.round(savedOverworldX / TILE_SIZE), Math.round(savedOverworldY / TILE_SIZE) - 1);
            player.pixelX = player.gridX * TILE_SIZE;
            player.pixelY = player.gridY * TILE_SIZE;
            player.targetX = player.pixelX;
            player.targetY = player.pixelY;
            player.dir = 'down';

            document.getElementById('location-name').innerText = "BRENNAN'S THEME";
        }

