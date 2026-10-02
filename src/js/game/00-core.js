
        let equippedItem = 'axe'; // 'axe', 'torch', 'lens', 'staff', 'none'

        const TOOL_ICONS = { // the left face button shows what's in your hand
            axe: '<path d="M5 21 15.5 7.5"/><path d="M12.6 5.6c2-2.4 5.6-3 8.4-1.4-.7 3.2-3.2 5.9-6.6 6.6z" fill="currentColor"/><path d="M13 5.9 11.4 4.2" stroke-width="2.6"/>',
            torch: '<path d="M10.5 21.5 13 11"/><path d="M13.5 10.5c-2.6-.6-3.6-3.3-2.2-5.4.4 1.5 1.3 1.9 1.9 1.4-.5-1.8.5-3.8 2.3-4.5-.5 2.4 2.2 3.4 1.6 6-.4 1.7-1.9 2.7-3.6 2.5z" fill="currentColor"/>',
            lens: '<circle cx="10" cy="10" r="6"/><path d="m14.5 14.5 6 6"/>',
            staff: '<path d="M9 22 14.5 8"/><circle cx="16" cy="5" r="3" fill="currentColor"/>',
            sword: '<path d="M4 20 15 9"/><path d="M14 10 20 4l.5 2.5L18 9"/><path d="M6.5 14.5l3 3" stroke-width="2.4"/>',
            rope: '<ellipse cx="11" cy="9" rx="7" ry="5"/><ellipse cx="11" cy="11.5" rx="7" ry="5"/><path d="M17 14c2.5 2 1.5 5-1 7"/>',
            none: '<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5v-1a1.5 1.5 0 0 1 3 0V11m0-4a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 16l-1.6-3.3a1.5 1.5 0 0 1 2.6-1.5L8 14"/>' };
        function updateToolButtonIcon() { const el = document.getElementById('b-btn-svg'); if (el) el.innerHTML = TOOL_ICONS[equippedItem] || TOOL_ICONS.none; }
        document.addEventListener('DOMContentLoaded', updateToolButtonIcon);
        function selectInventoryItem(item) {
            // If clicking the currently equipped item, toggle it to 'none' so he doesn't hold anything
            if (equippedItem === item) {
                equippedItem = 'none';
            } else {
                equippedItem = item;
            }
            audio.playSelect();
            menuLast = 0;
            document.querySelectorAll('.mn-slot[id^="slot-"]').forEach(el => el.classList.remove('selected'));
            if (equippedItem !== 'none') { const sl = document.getElementById(`slot-${equippedItem}`); if (sl) sl.classList.add('selected'); }

            // either may be missing from the current layout: write into a stand-in instead of throwing
            const nameEl = document.getElementById('inv-item-name') || {};
            const descEl = document.getElementById('inv-item-desc') || {};

            if (equippedItem === 'axe') {
                nameEl.innerText = "TIMBER AXE";
                descEl.innerText = "Heavy timber axe used for clearing forest overgrowth and chopping secret crystal paths.";
            } else if (equippedItem === 'torch') {
                nameEl.innerText = "DARKNESS TORCH";
                descEl.innerText = "Magical torch radiating warm light to illuminate shadowed areas and cold caves.";
            } else if (equippedItem === 'lens') {
                nameEl.innerText = "TRUTH LENS";
                descEl.innerText = "Magnifier of truth used to inspect hidden clues, secret signs, and spirits.";
            } else if (equippedItem === 'staff') {
                nameEl.innerText = "PRIESTESS STAFF";
                descEl.innerText = "The priestess's staff. Its orb still holds a little of the temple's light.";
            } else if (equippedItem === 'sword') {
                nameEl.innerText = "SHORT SWORD";
                descEl.innerText = "A plain short sword with a blue-stoned guard. Hold A to swing; it drives off a wolf in front of you.";
            } else if (equippedItem === 'rope') {
                nameEl.innerText = "LASSO ROPE";
                descEl.innerText = "A braided lasso. Face a wild horse within a few paces and hold A to throw the loop. A caught horse is yours to tame.";
            } else if (equippedItem === 'none') {
                nameEl.innerText = "NO ITEM EQUIPPED (SHEATHED)";
                descEl.innerText = "Hands are empty. Click any item icon above to equip or switch items.";
            }
            updateToolButtonIcon();
        }

        function toggleInventory() {
            const invScreen = document.getElementById('inventory-screen');
            if (invScreen.classList.contains('hidden')) {
                audio.playSelect();
                invScreen.classList.remove('hidden');
                gameState = "INVENTORY";
            } else {
                closeInventory();
            }
        }

        function handleStartButton() {
            if (!gameStarted && !cinematicMode) {
                startCrawl();
            } else {
                toggleInventory();
            }
        }

        function closeInventory() {
            audio.playSelect();
            document.getElementById('inventory-screen').classList.add('hidden');
            if (gameState === "INVENTORY") {
                gameState = "PLAYING";
            }
        }

        function drawPlayerSprite(ctx, x, y, dir = 'down', frame = 0, isActioning = false, customColors = {}, activeTool = 'axe') {
            const pal = {
                heroHair: customColors.heroHair || '#2563eb',
                heroCape: customColors.heroCape || '#dc2626',
                skinTone: customColors.skinTone || '#7c4a2d',
                tunic: customColors.tunic || '#2563eb',
                pants: customColors.pants || '#334155'
            };

            ctx.save();
            ctx.translate(x, y);

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(3, 14, 10, 2);

            ctx.fillStyle = pal.skinTone;
            ctx.fillRect(4, 3, 8, 6);

            ctx.fillStyle = pal.skinTone;
            ctx.fillRect(1, 4, 3, 2);
            ctx.fillRect(12, 4, 3, 2);
            ctx.fillRect(1, 3, 1, 1);
            ctx.fillRect(14, 3, 1, 1);

            ctx.fillStyle = '#ffffff';
            if (dir === 'down' || dir === 'left') ctx.fillRect(5, 5, 2, 2);
            if (dir === 'down' || dir === 'right') ctx.fillRect(9, 5, 2, 2);
            ctx.fillStyle = '#0f172a';
            if (dir === 'down' || dir === 'left') ctx.fillRect(6, 5, 1, 2);
            if (dir === 'down' || dir === 'right') ctx.fillRect(9, 5, 1, 2);

            ctx.fillStyle = pal.heroHair;
            ctx.fillRect(4, 8, 8, 5);

            ctx.fillStyle = pal.heroCape;
            ctx.fillRect(4, 11, 8, 2);

            ctx.fillStyle = pal.pants;
            const legOffset = (Math.floor(frame) % 2 === 1) ? 1 : 0;
            ctx.fillRect(4, 13 - legOffset, 3, 3);
            ctx.fillRect(9, 13 + legOffset, 3, 3);

            ctx.fillStyle = pal.heroCape;
            if (dir === 'down') {
                ctx.fillRect(3, 8, 2, 6);
                ctx.fillRect(11, 8, 2, 6);
            } else if (dir === 'up') {
                ctx.fillRect(3, 7, 10, 7);
            } else if (dir === 'left') {
                ctx.fillRect(10, 7, 3, 7);
            } else if (dir === 'right') {
                ctx.fillRect(3, 7, 3, 7);
            }

            const darkHair = '#0f172a';
            const midHair = pal.heroHair;
            const highlightHair = '#38bdf8';

            ctx.fillStyle = midHair;
            ctx.fillRect(3, 1, 10, 4);

            ctx.fillStyle = darkHair;
            ctx.fillRect(2, -2, 3, 4);
            ctx.fillStyle = highlightHair;
            ctx.fillRect(2, -2, 2, 2);

            ctx.fillStyle = midHair;
            ctx.fillRect(6, -3, 3, 5);
            ctx.fillStyle = highlightHair;
            ctx.fillRect(7, -3, 2, 2);

            ctx.fillStyle = darkHair;
            ctx.fillRect(10, -2, 3, 4);
            ctx.fillStyle = highlightHair;
            ctx.fillRect(11, -2, 2, 2);

            ctx.fillStyle = midHair;
            ctx.fillRect(0, 1, 3, 4);
            ctx.fillRect(13, 1, 3, 4);
            ctx.fillStyle = highlightHair;
            ctx.fillRect(0, 1, 1, 2);
            ctx.fillRect(15, 1, 1, 2);

            // Render Active Tool in hand if activeTool is not 'none'
            if (activeTool !== 'none') {
                let toolX = 0, toolY = 0;
                if (dir === 'down') { toolX = 12; toolY = isActioning ? 12 : 6; }
                else if (dir === 'up') { toolX = 2; toolY = isActioning ? 0 : 4; }
                else if (dir === 'left') { toolX = isActioning ? -4 : 0; toolY = 8; }
                else if (dir === 'right') { toolX = isActioning ? 16 : 12; toolY = 8; }

                if (activeTool === 'axe') {
                    ctx.fillStyle = '#cbd5e1';
                    ctx.fillRect(toolX, toolY, 4, 4);
                    ctx.fillStyle = '#78350f';
                    if (dir === 'down') ctx.fillRect(toolX + 1, toolY + 2, 2, 6);
                    else if (dir === 'up') ctx.fillRect(toolX + 1, toolY - 4, 2, 6);
                    else if (dir === 'left') ctx.fillRect(toolX + 2, toolY + 1, 6, 2);
                    else if (toolX >= 12) ctx.fillRect(toolX - 4, toolY + 1, 6, 2);
                } else if (activeTool === 'torch') {
                    ctx.fillStyle = '#78350f';
                    ctx.fillRect(toolX, toolY, 3, 6);
                    ctx.fillStyle = '#f97316';
                    ctx.fillRect(toolX - 1, toolY - 4, 5, 5);
                    ctx.fillStyle = '#fef08a';
                    ctx.fillRect(toolX, toolY - 3, 3, 3);
                } else if (activeTool === 'lens') {
                    ctx.fillStyle = '#334155';
                    ctx.fillRect(toolX, toolY, 5, 5);
                    ctx.fillStyle = '#38bdf8';
                    ctx.fillRect(toolX + 1, toolY + 1, 3, 3);
                }
            }

            ctx.restore();
        }

        const canvas = document.getElementById('game-canvas');
        let ctx = canvas.getContext('2d'); // 'let': in third person, creatures are briefly drawn onto standing cards instead (see asCard)

        const menuHeroCanvas = document.getElementById('menu-hero-canvas');
        const menuHeroCtx = menuHeroCanvas.getContext('2d');
        menuHeroCanvas.width = 64;
        menuHeroCanvas.height = 64;

        const GAME_WIDTH = 160;
        const GAME_HEIGHT = 144;
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;

        const TILE_SIZE = 16;
        const MAP_COLS = 70; // 60 mirrored columns + a 10-column east camp strip

        canvas.addEventListener('click', handleCanvasTap);
        function handleCanvasTap(e) {
            if (currentMapName !== 'overworld' || gameState !== 'PLAYING' || cinematicMode || inDialogue) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = GAME_WIDTH / rect.width;
            const scaleY = GAME_HEIGHT / rect.height;
            const tapX = (e.clientX - rect.left) * scaleX + lastCamX;
            const tapY = (e.clientY - rect.top) * scaleY + lastCamY;

            let tappedWolf = null;
            for (const wolf of wolves) {
                if (!wolf.alive) continue;
                if (tapX >= wolf.pixelX - 2 && tapX <= wolf.pixelX + TILE_SIZE + 2 &&
                    tapY >= wolf.pixelY - 2 && tapY <= wolf.pixelY + TILE_SIZE + 2) {
                    tappedWolf = wolf;
                    break;
                }
            }

            if (tappedWolf) {
                if (lockedWolf === tappedWolf) {
                    lockedWolf = null;
                    showFluidMessage("Target lock released.");
                } else {
                    lockedWolf = tappedWolf;
                    showFluidMessage("Target locked!");
                }
            } else if (lockedWolf) {
                lockedWolf = null;
                showFluidMessage("Target lock released.");
            }
        }
        const MAP_ROWS = 24;

        let gameStarted = false;
        let cinematicMode = false;
        let cinematicCameraY = 0; 
        let crawlTimeout = null;

        let gameState = "CRAWL";
        let hero = null;
        let actionTimer = 0, actionTotal = 20; // actionTotal: the length of the current action (a drawn sword attack runs longer than an axe chop)
        let jumpTimer = 0; // counts down from JUMP_FRAMES while the hop animation plays
        let rollTimer = 0; // frames of speed-boosted movement left (the dash part of the dodge-roll)
        let rollAnim = 0;  // frames left in the roll's tumble animation (counts down from ROLL_ANIM_FRAMES)

