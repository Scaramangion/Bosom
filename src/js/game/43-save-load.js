        // ================= SAVE / LOAD (localStorage: every 3 s while playing, when the app is hidden, and on exit) =================
        // Three independent save slots. currentSlot picks which localStorage key every save/load call below reads and writes.
        const SAVE_SLOTS = [1, 2, 3];
        let currentSlot = 1;
        function slotKey(n) { return 'bosom-save-v2-slot' + n; }
        const INITIAL_GEMS = []; MAP_DATA.forEach((row, r) => row.forEach((t, c) => { if (t === 8) INITIAL_GEMS.push(c + ',' + r); })); // gems that exist in a fresh world
        let saveArmed = false; // set once the restore attempt has finished, so a fresh session can never overwrite a save
        function collectSave() {
            const outside = currentMapName === 'overworld' || currentMapName === 'wolf_hollow' || !!ZONES[currentMapName]; // shop / Tellhouse: resume just outside the door
            return { v: 2, t: Date.now(), map: outside ? currentMapName : 'overworld',
                x: outside ? player.gridX : Math.round(savedOverworldX / TILE_SIZE), y: outside ? player.gridY : Math.round(savedOverworldY / TILE_SIZE), dir: player.dir,
                ox: savedOverworldX, oy: savedOverworldY, gems: player.gemsCollected, hp: playerHealth.current, potions: playerPotions, item: equippedItem, apt: apartmentRented, dog: companion.active,
                talk: { shop: shopkeeperTalkCount, tell: tellhouseVisitCount, drunk: drunkManTalkCount, woman: womanTalkCount, npc: Object.fromEntries(NPC_DEFS.filter(d => d.talks).map(d => [d.id, d.talks])) },
                hollow: hollowCluesFound, zone: zoneFlags, journal, heads, horse: { map: HORSE.map, x: HORSE.x, y: HORSE.y, face: HORSE.face, mounted: HORSE.mounted && outside },
                gemsLeft: INITIAL_GEMS.filter(k => { const [c, r] = k.split(',').map(Number); return MAP_DATA[r][c] === 8; }) };
        }
        function saveGame() {
            if (!saveArmed || !gameStarted || gameState !== 'PLAYING') return;
            try { localStorage.setItem(slotKey(currentSlot), JSON.stringify(collectSave())); } catch (e) { /* private mode or storage full: the game still plays */ }
        }
        function restoreSave() {
            try {
                const d = JSON.parse(localStorage.getItem(slotKey(currentSlot)) || 'null');
                if (d && d.v === 2) {
                    player.gemsCollected = d.gems; playerHealth.current = Math.min(d.hp, playerHealth.max); playerPotions = d.potions; equippedItem = d.item; apartmentRented = d.apt; updateToolButtonIcon();
                    shopkeeperTalkCount = d.talk.shop; tellhouseVisitCount = d.talk.tell; drunkManTalkCount = d.talk.drunk; womanTalkCount = d.talk.woman;
                    NPC_DEFS.forEach(n => { n.talks = d.talk.npc[n.id] || 0; });
                    Object.assign(hollowCluesFound, d.hollow); Object.assign(zoneFlags, d.zone);
                    heads.owned = (d.heads && d.heads.owned) || ['provisional']; heads.equipped = (d.heads && d.heads.equipped) || 'provisional'; // saves from before the opening existed start with the unfinished Head
                    ['clues', 'importantClues', 'rumors'].forEach(k => { journal[k] = d.journal[k] || []; });
                    journal.people = d.journal.people || {}; journal.questions = d.journal.questions || journal.questions;
                    INITIAL_GEMS.forEach(k => { if (!d.gemsLeft.includes(k)) { const [c, r] = k.split(',').map(Number); MAP_DATA[r][c] = 0; } });
                    document.getElementById('gem-count').innerText = `${player.gemsCollected}/${player.totalGems}`; const _vc=document.getElementById('v2-gem-count'); if(_vc) _vc.textContent=player.gemsCollected;
                    ['potion-owned-count', 'potion-slot-count'].forEach(id => { const e = document.getElementById(id); if (e) e.innerText = playerPotions; });
                    updateHealthBar();
                    currentMapName = d.map;
                    if (d.ox != null) { savedOverworldX = d.ox; savedOverworldY = d.oy; } // where the hollow's trail leads back to
                    [player.gridX, player.gridY] = landOnOpenGround(d.x, d.y); player.pixelX = player.targetX = player.gridX * TILE_SIZE; player.pixelY = player.targetY = player.gridY * TILE_SIZE; player.dir = d.dir || 'down';
                    if (d.horse) { Object.assign(HORSE, { map: d.horse.map, x: d.horse.x, y: d.horse.y, face: d.horse.face || 'left' }); HORSE.mounted = !!d.horse.mounted && d.horse.map === d.map; if (HORSE.mounted) { HORSE.x = player.gridX; HORSE.y = player.gridY; } }
                    document.getElementById('location-name').innerText = d.map === 'overworld' ? "BRENNAN'S THEME" : d.map === 'wolf_hollow' ? "WOLF'S HOLLOW" : ZONES[d.map].name;
                    if (d.dog) { companion.active = true; companion.gridX = player.gridX; companion.gridY = player.gridY; companion.pixelX = companion.targetX = player.pixelX; companion.pixelY = companion.targetY = player.pixelY; }
                    showFluidMessage('Progress restored.');
                }
            } catch (e) { console.warn('Could not restore save:', e); }
            saveArmed = true;
        }
        function hasSavedGame() { try { const d = JSON.parse(localStorage.getItem(slotKey(currentSlot)) || 'null'); return !!(d && d.v === 2); } catch (e) { return false; } }
        function resetSave() { try { localStorage.removeItem(slotKey(currentSlot)); } catch (e) {} saveArmed = false; location.reload(); }
        function peekSlot(n) { try { const d = JSON.parse(localStorage.getItem(slotKey(n)) || 'null'); return (d && d.v === 2) ? d : null; } catch (e) { return null; } }
        function slotSummary(d) {
            const loc = d.map === 'overworld' ? "Brennan's Theme" : d.map === 'wolf_hollow' ? "Wolf's Hollow" : (ZONES[d.map] ? ZONES[d.map].name : d.map);
            const when = d.t ? new Date(d.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
            return `${loc}${when ? ' &middot; ' + when : ''} &middot; ${d.gems || 0} gems`;
        }
        function renderSlotSelect() {
            const wrap = document.getElementById('slot-list'); if (!wrap) return;
            wrap.innerHTML = '';
            SAVE_SLOTS.forEach(n => {
                const d = peekSlot(n);
                const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:stretch;gap:4px';
                const main = document.createElement('button');
                main.style.cssText = 'flex:1;text-align:left;padding:8px 10px;font-size:8px;color:#fff;background:' + (d ? '#1e3a5f' : '#374151') + ';border:1px solid ' + (d ? '#38bdf8' : '#6b7280') + ';border-radius:4px;cursor:pointer';
                main.innerHTML = `<div style="font-weight:bold;letter-spacing:1px">SLOT ${n}</div><div style="opacity:.85;margin-top:2px">${d ? slotSummary(d) : 'NEW GAME'}</div>`;
                main.onclick = () => chooseSlot(n, !d);
                row.appendChild(main);
                if (d) {
                    const del = document.createElement('button'); del.textContent = '✕';
                    del.style.cssText = 'padding:0 10px;font-size:9px;color:#fecaca;background:#7f1d1d;border:1px solid #fca5a5;border-radius:4px;cursor:pointer';
                    del.onclick = (e) => { e.stopPropagation(); if (confirm(`Erase Slot ${n}? This cannot be undone.`)) { localStorage.removeItem(slotKey(n)); renderSlotSelect(); } };
                    row.appendChild(del);
                }
                wrap.appendChild(row);
            });
        }
        function showSlotSelect() { renderSlotSelect(); setActiveScreen('slots'); }
        function chooseSlot(n, isNew) {
            currentSlot = n;
            audio.init(); audio.playSelect();
            if (isNew) { crawlStarted = true; beginCinematicIntroFromCrawl(); } // a new game opens on the trail ride (the old text crawl is skipped)
            else { crawlStarted = true; beginCinematicIntroFromCrawl(); }
        }
        setInterval(saveGame, 3000);
        document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
        window.addEventListener('pagehide', saveGame);
        document.addEventListener('DOMContentLoaded', () => { // small "new game" control at the bottom of the Journal
            const m = document.getElementById('journal-modal'); if (!m) return;
            const b = document.createElement('button'); b.textContent = 'ERASE THIS SLOT & RESTART';
            b.style.cssText = 'flex-shrink:0;margin-top:6px;padding:6px 8px;font-size:7px;color:#fecaca;background:#7f1d1d;border:1px solid #fca5a5;border-radius:4px';
            b.onclick = () => { if (confirm('Erase this save slot and start over?')) resetSave(); };
            m.appendChild(b);
        });

