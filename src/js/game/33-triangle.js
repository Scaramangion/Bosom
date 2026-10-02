        // ================= TRIANGLE (top face button): an empty framework, same shape as the LENS one =================
        // Nothing is bound yet. Later: TRIANGLE_ACTION.register(ctx => true | false) to claim the button for something
        // (a dodge-roll, a shield block, a second tool...); the first handler that returns true "handles" the press.
        const TRIANGLE_ACTION = { handlers: [(_ctx) => { handleRollButton(); return true; }] }; // ▲ = roll
        function handleTriangleButton() {
            if (inDialogue || !gameStarted || gameState === "INVENTORY") return;
            const ctx = { map: currentMapName, x: player.gridX, y: player.gridY, dir: player.dir };
            for (const h of TRIANGLE_ACTION.handlers) { if (h(ctx)) return; }
            showFluidMessage('\u25B2 not yet available.');
        }

        function useEquippedToolAction() {
            if (inDialogue || !gameStarted || gameState === "INVENTORY" || HORSE.mounted || POUCH.state) return;
            const oA = HERO_OUTFITS[heroHD.outfit] || {}, longSword = equippedItem === 'sword' && oA.swordAttackFrames;
            if (longSword && actionTimer > actionTotal * 0.2) return; // no cancelling a cut halfway; the next one can be queued as this one recovers
            actionTotal = longSword ? oA.swordAttackFrames : ACTION_FRAMES; actionTimer = actionTotal;
            audio.playActionSound();

            let targetGX = player.gridX;
            let targetGY = player.gridY;
            if (player.dir === 'up') targetGY--;
            if (player.dir === 'down') targetGY++;
            if (player.dir === 'left') targetGX--;
            if (player.dir === 'right') targetGX++;

            if (equippedItem === 'axe') {
                if (currentMapName === 'overworld') {
                    if (!tryAttackWolfWithAxe() && targetGX >= 0 && targetGX < MAP_COLS && targetGY >= 0 && targetGY < MAP_ROWS) {
                        const tile = MAP_DATA[targetGY][targetGX];
                        if (isTreeTile(tile)) {
                            MAP_DATA[targetGY][targetGX] = (Math.random() < 0.6) ? 8 : 0;
                        }
                    }
                }
            } else if (equippedItem === 'torch') {
                if (currentMapName === 'overworld') {
                    tryScareWolvesWithTorch();
                }
            } else if (equippedItem === 'sword') {
                if (currentMapName === 'overworld') {
                    const hit = () => { if (COMBAT.on) trySwordHit(); else tryAttackWolfWithAxe(); };
                    if (longSword) setTimeout(() => { if (gameStarted && equippedItem === 'sword') hit(); }, oA.swordImpact * actionTotal * 1000 / 60); else hit(); // the wolf takes the blow when the blade lands
                }
            } else if (equippedItem === 'rope') {
                const r = lassoAttempt(); // success message comes from the capture itself
                if (!r.success) showFluidMessage(wildHorses.some(w => w.alive) && currentMapName === 'overworld' ? 'The loop falls short. Get closer and face the horse.' : 'The loop falls on empty ground.', 1400);
            } else if (equippedItem === 'lens') {
                // Fluid action: No talk box displayed! Just lens sound feedback.
            } else if (equippedItem === 'none') {
                // Hands are empty, no action triggered.
            }
        }

