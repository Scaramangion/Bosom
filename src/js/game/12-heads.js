        // ================= HEADS: the protagonist IS the Head system. Every Head is data; true Heads get added here later =================
        const HEAD_DEFS = {
            provisional: { name: 'UNFINISHED HEAD', title: 'tep en seshta', vision: true, color: '#9ca3af',
                desc: 'Hastily set in place by the funerary power that lingered in the temple. Vision is muted. Authority is weak. Neither fully mortal nor yet sah.' }
        };
        const heads = { owned: [], equipped: null };
        function grantHead(id, equip = true) { if (!heads.owned.includes(id)) heads.owned.push(id); if (equip) heads.equipped = id; renderHeadsUI(); }
        function renderHeadsUI() {
            document.querySelectorAll('.mn-heads em').forEach((em, i) => {
                const id = heads.owned[i], h = id && HEAD_DEFS[id];
                em.className = h ? ('on' + (heads.equipped === id ? ' eq' : '')) : '';
                em.title = h ? h.name + ' (' + h.title + ')' : '';
                em.innerHTML = h ? '<svg viewBox="0 0 10 10" width="100%" height="100%"><path d="M2 8V4.5C2 2.6 3.4 1.5 5 1.5S8 2.6 8 4.5V8Z" fill="' + h.color + '"/><path d="M5 1.8 4.4 4 5.4 5.2" stroke="#374151" stroke-width=".6" fill="none"/><rect x="3.2" y="4.6" width="1" height=".8" fill="#67e8f9"/><rect x="5.8" y="4.6" width="1" height=".8" fill="#67e8f9"/></svg>' : '';
            });
        }
        let visionShown = null;
        function updateHeadVision() { // the unfinished Head mutes sight: a dim, desaturated edge on the play screen
            const on = !!(gameStarted && gameState === 'PLAYING' && heads.equipped && HEAD_DEFS[heads.equipped].vision);
            if (on === visionShown) return; visionShown = on;
            const el = document.getElementById('head-vision'); if (el) el.style.display = on ? 'block' : 'none';
        }
        function refreshMenu(force) {
            const now = performance.now(); if (!force && now - menuLast < 250) return; menuLast = now;
            renderHeadsUI();
            const q = id => document.getElementById(id), held = equippedItem !== 'none';
            q('mn-hand').textContent = held ? '(HELD)' : '(SHEATHED)'; q('mn-clock').textContent = menuClock(); q('mn-gems').textContent = player.gemsCollected + '/' + player.totalGems;
            q('mn-key').style.opacity = zoneFlags.sunKey ? '1' : '0.4'; q('mn-key').querySelector('span').textContent = zoneFlags.sunKey ? 'SUN KEY' : 'KEY';
            const hp = playerHealth.current / playerHealth.max; q('mn-hp').style.width = Math.round(hp * 100) + '%'; q('mn-exp').style.width = Math.round(player.gemsCollected / player.totalGems * 100) + '%';
            q('mn-hearts').innerHTML = Array.from({ length: 5 }, (_, i) => '<i class="' + (hp * 5 > i ? '' : 'off') + '"></i>').join('');
            q('mn-weapon').textContent = held ? equippedItem.toUpperCase() : 'EMPTY';
            if (!held) { q('inv-item-name').textContent = 'NO ITEM EQUIPPED'; q('inv-item-desc').textContent = 'Hands are empty. Click any item icon above to equip or switch items.'; }
            drawAtlasFrame(q('axe-icon'), 'tool_axe', 20, 24);
            if (!q('mn-quest').classList.contains('mn-off')) {
                drawMiniMap(q('mn-map-big'));
                const ic = journal.importantClues.length, cl = journal.clues.length, ru = journal.rumors.length;
                q('mn-quest-list').innerHTML = 'CRYSTALS <b>' + player.gemsCollected + '/' + player.totalGems + '</b><br>IMPORTANT CLUES <b>' + ic + '</b> &nbsp; CLUES <b>' + cl + '</b> &nbsp; RUMORS <b>' + ru + '</b>' + (journal.importantClues.length ? '<br>LATEST: ' + journal.importantClues[journal.importantClues.length - 1].toString().slice(0, 70) : '');
            } else drawMiniMap(q('mn-map'));
        }

        function clearScreen() {
            ctx.fillStyle = pal.bg;
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }

        function drawCrawlText() {
            ctx.fillStyle = '#030712';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
            ctx.fillStyle = '#38bdf8';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText("PREPARING OOT INVENTORY V11.1...", GAME_WIDTH / 2, GAME_HEIGHT / 2);
        }

        function drawMap() {
            if (currentMapName === 'shop') {
                renderShopMapInternal();
            } else if (currentMapName === 'shop_upstairs') {
                renderUpstairsMapInternal();
            } else if (ZONES[currentMapName]) {
                renderZone();
            } else if (currentMapName === 'wolf_hollow') {
                renderWolfHollowInternal();
            } else if (currentMapName === 'tellhouse') {
                renderTellhouseInternal();
            } else {
                renderTileMapInternal();
            }
        }

        function updateGame() {
            if (gameState === "CRAWL") {
                if (crawlIsFinished || userPressedSkip) {
                    transitionToGameplay();
                }
            } else if (gameState === "PLAYING") {
                if (actionTimer > 0) actionTimer--;
                if (jumpTimer > 0) jumpTimer--;
                if (rollTimer > 0) rollTimer--;
                if (rollAnim > 0) rollAnim--;
                if (invincibleTimer > 0) { invincibleTimer--; if (invincibleTimer === 0) playerInvincible = false; }
                if (hero && typeof hero.update === 'function') {
                    hero.update();
                }
                updatePlayerMovement();
                FileDex.updateActive(player.gridX, player.gridY);
                updateHeadVision();
                updateWolves();
                updateWildHorses();
            } else if (gameState === "INVENTORY") {
                updateHeadVision();
                refreshMenu();
                menuHeroCtx.fillStyle = '#020617';
                menuHeroCtx.fillRect(0, 0, 64, 64);
                if (heroHD.active()) heroHD.drawPreview(menuHeroCtx);
                else {
                    menuHeroCtx.save();
                    menuHeroCtx.scale(2.5, 2.5);
                    drawPlayerSprite(menuHeroCtx, 6, 6, 'down', Date.now() / 200, false, {
                        heroHair: pal.heroHair,
                        heroCape: pal.heroCape
                    }, equippedItem);
                    menuHeroCtx.restore();
                }
            }
        }

        function transitionToGameplay() {
            gameState = "PLAYING";
            if (!audio.bgmPlaying && !audio.userPadOff) audio.startAmbientPad(); // in-game music starts here
            gameStarted = true;
            hero = {
                x: 23 * TILE_SIZE,
                y: 21 * TILE_SIZE,
                dir: 'up',
                animFrame: 0,
                sprite: loadSprite("hero_down"),
                update: function() {
                    this.x = player.pixelX;
                    this.y = player.pixelY;
                    this.dir = player.dir;
                    // anything that sets player.dir directly (map entry, lock-on, cutscenes) also turns the 8-way facing
                    if (!player.face8 || cardinalOf(player.face8) !== player.dir) player.face8 = player.dir;
                    this.face8 = player.face8;
                    this.animFrame = player.animFrame;
                },
                render: function() {
                    drawSprite(this.sprite, this.x, this.y);
                }
            };
        }

        let crawlIsFinished = false;
        let userPressedSkip = false;
        let crawlStarted = false;

