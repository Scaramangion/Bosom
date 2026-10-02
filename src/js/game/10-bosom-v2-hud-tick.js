        // ===== BOSOM V2 HUD tick =====
        let v2HudInterval = null;
        const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        function updateV2Hud() {
            // In-game clock (Rahjai time)
            const hrs = gameHour(); // Rahjai time: twenty real minutes a day
            const h = Math.floor(hrs), m = Math.floor((hrs - h) * 60);
            const period = h >= 6 && h < 12 ? 'Morning' : h >= 12 && h < 18 ? 'Afternoon' : h >= 18 && h < 22 ? 'Evening' : 'Night';
            const hDisp = String(h).padStart(2,'0'), mDisp = String(m).padStart(2,'0');
            const real = new Date();
            const dateStr = DAY_NAMES[real.getDay()] + ', ' + real.getDate() + ' ' + MONTH_NAMES[real.getMonth()];
            const el = id => document.getElementById(id);
            if (el('v2-period')) el('v2-period').textContent = period;
            if (el('v2-time')) el('v2-time').textContent = hDisp + ':' + mDisp;
            if (el('v2-date')) el('v2-date').textContent = dateStr;
            // HP
            if (typeof playerHealth !== 'undefined') {
                const hpPct = Math.round(playerHealth.current / playerHealth.max * 100);
                if (el('v2-hp-fill')) el('v2-hp-fill').style.width = hpPct + '%';
                if (el('v2-hp-num')) el('v2-hp-num').textContent = playerHealth.current + '/' + playerHealth.max;
            }
            // Nerve: drains while something follows you (see THE TALL ONE), comes back in lamplight and by day
            {
                const enPct = Math.round(playerNerve.current / playerNerve.max * 100);
                if (el('v2-en-fill')) el('v2-en-fill').style.width = enPct + '%';
                if (el('v2-en-num')) el('v2-en-num').textContent = Math.round(playerNerve.current) + '/' + playerNerve.max;
            }
            // Gems
            if (typeof player !== 'undefined' && el('v2-gem-count')) {
                el('v2-gem-count').textContent = player.gemsCollected || 0;
            }
            // Track name (use location name as proxy if no audio track)
            if (el('v2-track-name')) {
                const loc = el('location-name');
                const track = inRahjai() ? 'RAHJAI' : (loc ? loc.textContent : '') || "Brennan's Theme";
                el('v2-track-name').textContent = track;
            }
        }
        function startV2HudTick() {
            if (v2HudInterval) return;
            updateV2Hud();
            v2HudInterval = setInterval(updateV2Hud, 5000);
        }
        function id(x) { return document.getElementById(x); }

        function menuClock() { // in-game clock: a 90 s cycle = 24 h, matching the day/night flip (day 06:00-18:00, night 18:00-06:00)
            const hrs = gameHour(), h = Math.floor(hrs), m = Math.floor((hrs - h) * 60);
            return 'DAY ' + (zoneFlags.farm ? zoneFlags.farm.lived : 1) + ', ' + (h < 12 ? 'AM' : 'PM') + ' ' + String(((h + 11) % 12) + 1).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }
        function menuTab(id) {
            document.querySelectorAll('#inventory-screen .mn-tab[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === id));
            ['items', 'gear', 'quest', 'save'].forEach(p => document.getElementById('mn-' + p).classList.toggle('mn-off', p !== id));
            audio.playSelect(); menuLast = 0; if (id === 'gear') renderGear(); if (id === 'save') { const el = document.getElementById('mn-slot-num'); if (el) el.textContent = currentSlot; } refreshMenu(true);
        }
