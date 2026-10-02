        // ===== COMBAT STANCE: tap A with nothing to interact with -> draw the sword (the game is always in third person; see combatStep).
        // While drawn: tap A swings, hold A (or B / X key) sheathes. The camera eases back to flat when he sheathes, goes indoors,
        // or anything else takes over (dialogue, the pouch, the saddle). Movement and controls are unchanged (north stays "up").
        const COMBAT = { on: false, prevItem: 'none', amt: 0, fx: 0, fy: 0, sx: 0, sy: 0, shake: 0, sparks: [] };
        function drawSword() {
            if (COMBAT.on) return;
            COMBAT.on = true; COMBAT.prevItem = 'sword'; equippedItem = 'sword';
            updateToolButtonIcon(); audio.playActionSound(); showFluidMessage('You draw your sword.  [A] swing  [hold A] sheathe', 1500);
        }
        function sheatheSword(quiet) {
            if (!COMBAT.on) return;
            COMBAT.on = false; // still equipped: back over his shoulder
            updateToolButtonIcon(); if (!quiet) showFluidMessage('You sheathe your sword.', 900);
        }
