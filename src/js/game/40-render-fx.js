        // ================= RENDER FX (visual only; never touches game state) =================
        const RenderFX = {
            motes: Array.from({ length: 22 }, (_, i) => ({ x: (i * 47) % 160, y: (i * 29) % 144, d: 0.15 + (i % 4) * 0.12 })), // d = depth/parallax
            draw() {
                const t = Date.now() / 1000;
                ctx.fillStyle = 'rgba(255,255,235,0.45)';
                this.motes.forEach(m => {
                    const px = (((m.x - lastCamX * m.d + t * 5 * m.d) % 160) + 160) % 160;
                    const py = (((m.y - lastCamY * m.d + Math.sin(t + m.x) * 3) % 144) + 144) % 144;
                    ctx.fillRect(Math.floor(lastCamX + px), Math.floor(lastCamY + py), 1, 1);
                });
            }
        };

        function isSolidTile(gx, gy) {
            if (!HORSE.mounted && HORSE.map === currentMapName && gx === HORSE.x && gy === HORSE.y) return true; // the waiting horse
            if (ZONES[currentMapName]) return zoneSolid(gx, gy);
            if (currentMapName === 'tellhouse') {
                if (gx < 0 || gx >= 10 || gy < 0 || gy >= 9) return true;
                const t = TELLHOUSE_MAP[gy][gx];
                return t === 1 || t === 20 || t === 21;
            } else if (currentMapName === 'wolf_hollow') {
                if (gx < 0 || gx >= WOLF_HOLLOW_MAP[0].length || gy < 0 || gy >= WOLF_HOLLOW_MAP.length) return true;
                const t = WOLF_HOLLOW_MAP[gy][gx];
                return t === 1 || t === 2 || t === 11 || t === 15 || t === 16 || growSolid(gx, gy);
            } else if (currentMapName === 'shop') {
                if (gx < 0 || gx >= 10 || gy < 0 || gy >= 10) return true;
                const t = SHOP_MAP_DATA[gy][gx];
                return t === 1 || t === 3 || t === 11;
            } else if (currentMapName === 'shop_upstairs') {
                if (gx < 0 || gx >= 10 || gy < 0 || gy >= 9) return true;
                const t = SHOP_UPSTAIRS_MAP[gy][gx];
                if (gx === 2 && gy === 1) return true; 
                if (gx === 5 && gy === 1) return true; 
                return t === 1 || t === 13 || t === 14 || t === 15;
            }

            if (gx < 0 || gx >= MAP_COLS || gy < 0 || gy >= MAP_ROWS) return true;
            const t = MAP_DATA[gy][gx];
            return t === 1 || t === 2 || t === 3 || t === 4 || t === 6 || t === 9 || t === 10 || t === 11 || t === TILE_BUMPER || !!npcAt(gx, gy) || farmSolid(gx, gy);
        }

        const WALK_SPEED = 2.0, RUN_SPEED = 3.2, ROLL_SPEED = 3.0; // px per frame along the path
        const RUN_STICK_PUSH = 0.85; // how far the stick must be pushed (0..1) before walking turns into running
        // One grid step in (dx, dy). Diagonals may not cut a corner: both side tiles must be open too.
        // If a diagonal is blocked, slide along the wall on whichever axis is free. Returns [dx, dy] or null.
        function tryStepDir(dx, dy) {
            const gx = player.gridX, gy = player.gridY;
            if (dx && dy) {
                if (!isSolidTile(gx + dx, gy + dy) && !isSolidTile(gx + dx, gy) && !isSolidTile(gx, gy + dy)) return [dx, dy];
                if (!isSolidTile(gx + dx, gy)) return [dx, 0];
                if (!isSolidTile(gx, gy + dy)) return [0, dy];
                return null;
            }
            return isSolidTile(gx + dx, gy + dy) ? null : [dx, dy];
        }
        function startRollStep(first) { // one tile of the roll, in the direction he faced when the roll began
            const v = DIR8_VEC[player.rollDir] || [0, 1], s = tryStepDir(v[0], v[1]);
            player.rollSteps = Math.max(0, (player.rollSteps || 0) - 1);
            if (!s) { player.rollSteps = 0; if (first) audio.playBump(); return; }
            player.targetX = (player.gridX + s[0]) * TILE_SIZE; player.targetY = (player.gridY + s[1]) * TILE_SIZE;
            player.isMoving = true; player.inRollStep = true;
        }

        function updatePlayerMovement() {
            if (!gameStarted && !cinematicMode) return;

            const currentGX = Math.round(player.pixelX / TILE_SIZE);
            const currentGY = Math.round(player.pixelY / TILE_SIZE);
            const coordsEl = document.getElementById('coords-display');
            if (coordsEl) {
                coordsEl.innerText = `X:${currentGX < 10 ? '0' + currentGX : currentGX} Y:${currentGY < 10 ? '0' + currentGY : currentGY}`;
            }

            if (cinematicMode) {
                const moveSpeed = 1.5;
                if (player.pixelY > player.targetY) {
                    player.pixelY -= moveSpeed;
                    player.dir = 'up';
                    player.animFrame += 0.15;
                } else {
                    cinematicMode = false;
                    gameStarted = true;
                    player.isMoving = false;
                    player.animFrame = 0;
                    player.gridX = Math.round(player.pixelX / TILE_SIZE);
                    player.gridY = Math.round(player.pixelY / TILE_SIZE);
                    const gateLocationEl = document.getElementById('location-name');
                    if (gateLocationEl) gateLocationEl.innerText = "TOWN GATE";
                    showDialogue("Detective, you've reached the town gate. The Tiger Shop is up ahead — head inside when you're ready to gear up.");
                }
                return;
            }

            if (inDialogue || gameState === "INVENTORY") return;
            if (diorama.lockFrames > 0) return; // 2-frame input lock after a snap cut

            // walk, run (full stick push or Shift) and roll speeds, in px per frame along the path
            const pathSpeed = player.inBlink ? TELEPORT_SPEED : HORSE.mounted ? (player.isRunning ? HORSE_GALLOP : HORSE_TROT) : player.inRollStep ? ROLL_SPEED : player.isRunning ? RUN_SPEED : WALK_SPEED;
            const diagStep = player.isMoving && player.pixelX !== player.targetX && player.pixelY !== player.targetY;
            const moveSpeed = diagStep ? pathSpeed * Math.SQRT1_2 : pathSpeed; // a diagonal step covers the same ground per frame as a straight one

            if (player.isMoving) {
                if (player.pixelX < player.targetX) player.pixelX = Math.min(player.pixelX + moveSpeed, player.targetX);
                if (player.pixelX > player.targetX) player.pixelX = Math.max(player.pixelX - moveSpeed, player.targetX);
                if (player.pixelY < player.targetY) player.pixelY = Math.min(player.pixelY + moveSpeed, player.targetY);
                if (player.pixelY > player.targetY) player.pixelY = Math.max(player.pixelY - moveSpeed, player.targetY);

                player.animFrame += 0.2;

                if (companion.active && companion.isMoving) {
                    if (companion.pixelX < companion.targetX) companion.pixelX = Math.min(companion.pixelX + moveSpeed, companion.targetX);
                    if (companion.pixelX > companion.targetX) companion.pixelX = Math.max(companion.pixelX - moveSpeed, companion.targetX);
                    if (companion.pixelY < companion.targetY) companion.pixelY = Math.min(companion.pixelY + moveSpeed, companion.targetY);
                    if (companion.pixelY > companion.targetY) companion.pixelY = Math.max(companion.pixelY - moveSpeed, companion.targetY);
                    companion.animFrame += 0.2;
                }

                if (player.pixelX === player.targetX && player.pixelY === player.targetY) {
                    player.isMoving = false;
                    player.animFrame = 0;
                    player.gridX = Math.round(player.pixelX / TILE_SIZE);
                    player.gridY = Math.round(player.pixelY / TILE_SIZE);
                    player.inRollStep = false;
                    const stepMap = currentMapName, stepGX = player.gridX, stepGY = player.gridY;

                    if (companion.active && companion.pixelX === companion.targetX && companion.pixelY === companion.targetY) {
                        companion.isMoving = false;
                        companion.gridX = Math.round(companion.pixelX / TILE_SIZE);
                        companion.gridY = Math.round(companion.pixelY / TILE_SIZE);
                    }

                    if (currentMapName === 'overworld') {
                        const hd = HOMESTEAD[0].door;
                        if (player.gridX === hd[0] && player.gridY === hd[1] && !HORSE.mounted) { // stepped through the farmhouse door: home, then back out onto the porch
                            player.isMoving = false; enterFarmhouse();
                        } else if (MAP_DATA[player.gridY][player.gridX] === 5) {
                            enterBuilding(player.gridX, player.gridY);
                        } else if (MAP_DATA[player.gridY][player.gridX] === 14) {
                            enterWolfHollow();
                        } else if (MAP_DATA[player.gridY][player.gridX] === 16) {
                            enterZone('wastes', 2, 34, 'The cobble road runs out into open desert. Far ahead, a canyon splits the horizon.');
                        }
                    } else if (ZONES[currentMapName]) {
                        zoneStep();
                    } else if (currentMapName === 'wolf_hollow') {
                        if (WOLF_HOLLOW_MAP[player.gridY][player.gridX] === 14) {
                            exitWolfHollow();
                        }
                    } else if (currentMapName === 'tellhouse') {
                        if (TELLHOUSE_MAP[player.gridY][player.gridX] === 5) {
                            exitBuilding();
                        }
                    } else if (currentMapName === 'shop') {
                        if (SHOP_MAP_DATA[player.gridY][player.gridX] === 5) {
                            exitBuilding();
                        } else if (SHOP_MAP_DATA[player.gridY][player.gridX] === 10) {
                            goToUpstairs();
                        }
                    } else if (currentMapName === 'shop_upstairs') {
                        if (SHOP_UPSTAIRS_MAP[player.gridY][player.gridX] === 12) {
                            goToDownstairs();
                        }
                    }
                    // a roll carries on for its second tile, unless that step took him through a door or into dialogue
                    if (HORSE.mounted && currentMapName !== stepMap) { // the horse comes along outdoors; at a door it waits outside where you stepped off
                        if (HORSE_OUTDOOR.has(currentMapName)) HORSE.map = currentMapName;
                        else { HORSE.mounted = false; horsePark(stepMap, player.stepFromX ?? stepGX, player.stepFromY ?? stepGY, stepGX, stepGY); showFluidMessage('You leave the horse outside.'); }
                    }
                    const stillHere = !player.isMoving && !inDialogue && currentMapName === stepMap && player.gridX === stepGX && player.gridY === stepGY;
                    if (player.inBlink) { if (player.blinkSteps > 0 && stillHere) startBlinkStep(); else { player.blinkSteps = 0; blinkLanded(); } }
                    else if (player.rollSteps > 0 && stillHere) startRollStep(false);
                    else player.rollSteps = 0;
                }
                return;
            }

            if (companion.active && !companion.isMoving) {
                companion.moveTimer++;
                if (companion.moveTimer > 180) {
                    companion.moveTimer = 0;
                    if (Math.random() < 0.5) {
                        const dirs = [
                            { dx: 0, dy: -1, name: 'up' },
                            { dx: 0, dy: 1, name: 'down' },
                            { dx: -1, dy: 0, name: 'left' },
                            { dx: 1, dy: 0, name: 'right' }
                        ];
                        const randomDir = dirs[Math.floor(Math.random() * dirs.length)];
                        const nextDogGX = companion.gridX + randomDir.dx;
                        const nextDogGY = companion.gridY + randomDir.dy;

                        const distToPlayer = Math.hypot(nextDogGX - player.gridX, nextDogGY - player.gridY);
                        if (distToPlayer <= 2.2 && !isSolidTile(nextDogGX, nextDogGY)) {
                            companion.dir = randomDir.name;
                            companion.targetX = nextDogGX * TILE_SIZE;
                            companion.targetY = nextDogGY * TILE_SIZE;
                            companion.gridX = nextDogGX;
                            companion.gridY = nextDogGY;
                            companion.isMoving = true;
                            if (Math.random() < 0.2) {
                                audio.playBark();
                            }
                        }
                    }
                }
            }

            if (POUCH.state || performance.now() < HORSE.mountUntil) { player.isRunning = false; return; } // digging in the pouch, or climbing into the saddle
            // 8-way input: keys combine (W+D = up-right); the stick snaps to the nearest of 8 directions.
            // A light push walks, a full push (or Shift) runs.
            let dx = 0, dy = 0, push = 0;
            if (keys['w'] || keys['arrowup']) dy -= 1;
            if (keys['s'] || keys['arrowdown']) dy += 1;
            if (keys['a'] || keys['arrowleft']) dx -= 1;
            if (keys['d'] || keys['arrowright']) dx += 1;
            if (dx || dy) push = 0.5;
            if (dx || dy) { const [wx, wy] = camInput(dx, dy), v = DIR8_VEC[['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'][(Math.round(Math.atan2(wy, wx) / (Math.PI / 4)) + 8) % 8]]; dx = v[0]; dy = v[1]; }
            if (joystickState.active) {
                const [jx, jy] = camInput(joystickState.x, joystickState.y), m = Math.hypot(jx, jy);
                if (m > 0.25) { const v = DIR8_VEC[['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'][(Math.round(Math.atan2(jy, jx) / (Math.PI / 4)) + 8) % 8]]; dx = v[0]; dy = v[1]; push = m; }
            }
            if (dx || dy) player.lastInput = performance.now();
            player.isRunning = !!(dx || dy) && (!!keys['shift'] || push >= RUN_STICK_PUSH);
            if (!dx && !dy && jumpTimer > 0 && player.jumpDir) { dx = player.jumpDir[0]; dy = player.jumpDir[1]; player.isRunning = player.jumpRun; } // airborne: momentum carries him on
            if (jumpTimer <= 0) player.jumpDir = null;
            // letting go of a diagonal almost never releases both keys on the same frame; don't turn that into a stray straight step
            const nowT = performance.now();
            if (dx && dy) player.lastDiag = [dx, dy, nowT];
            else if ((dx || dy) && player.lastDiag && nowT - player.lastDiag[2] < 90 && (dx === player.lastDiag[0] || dy === player.lastDiag[1]) && !player.isMoving) { dx = 0; dy = 0; }

            if (!player.isMoving && (dx !== 0 || dy !== 0)) {
                const want = dir8FromVec(dx, dy), step = tryStepDir(dx, dy);
                player.face8 = step ? dir8FromVec(step[0], step[1]) : want; // sliding along a wall faces the way he actually goes
                player.dir = cardinalOf(player.face8);
                if (step) { dx = step[0]; dy = step[1]; player.stepFromX = player.gridX; player.stepFromY = player.gridY; }
                const nextGX = player.gridX + dx;
                const nextGY = player.gridY + dy;

                if (step) {
                    const oldPlayerGX = player.gridX;
                    const oldPlayerGY = player.gridY;

                    player.targetX = nextGX * TILE_SIZE;
                    player.targetY = nextGY * TILE_SIZE;
                    player.isMoving = true;

                    if (companion.active) {
                        let compNextGX = oldPlayerGX;
                        let compNextGY = oldPlayerGY;

                        if (dy > 0) {
                            compNextGX = oldPlayerGX + 1;
                            compNextGY = oldPlayerGY;
                            if (isSolidTile(compNextGX, compNextGY)) {
                                compNextGX = oldPlayerGX - 1;
                            }
                        }

                        if (compNextGX < companion.gridX) companion.dir = 'left';
                        else if (compNextGX > companion.gridX) companion.dir = 'right';
                        else if (compNextGY < companion.gridY) companion.dir = 'up';
                        else if (compNextGY > companion.gridY) companion.dir = 'down';

                        companion.targetX = compNextGX * TILE_SIZE;
                        companion.targetY = compNextGY * TILE_SIZE;
                        companion.gridX = compNextGX;
                        companion.gridY = compNextGY;
                        companion.isMoving = true;
                    }
                } else {
                    audio.playBump();
                }
            }

            if (lockedWolf) {
                if (!lockedWolf.alive || lockedWolf.fleeing) {
                    lockedWolf = null;
                } else {
                    const ddx = lockedWolf.gridX - player.gridX;
                    const ddy = lockedWolf.gridY - player.gridY;
                    if (Math.hypot(ddx, ddy) > 6) {
                        lockedWolf = null;
                        showFluidMessage("Target lost.");
                    } else if (ddx !== 0 || ddy !== 0) {
                        player.dir = Math.abs(ddx) > Math.abs(ddy)
                            ? (ddx > 0 ? 'right' : 'left')
                            : (ddy > 0 ? 'down' : 'up');
                    }
                }
            }

            if (companion.active && companion.isMoving) {
                if (companion.pixelX < companion.targetX) companion.pixelX = Math.min(companion.pixelX + moveSpeed, companion.targetX);
                if (companion.pixelX > companion.targetX) companion.pixelX = Math.max(companion.pixelX - moveSpeed, companion.targetX);
                if (companion.pixelY < companion.targetY) companion.pixelY = Math.min(companion.pixelY + moveSpeed, companion.targetY);
                if (companion.pixelY > companion.targetY) companion.pixelY = Math.max(companion.pixelY - moveSpeed, companion.targetY);
                companion.animFrame += 0.2;

                if (companion.pixelX === companion.targetX && companion.pixelY === companion.targetY) {
                    companion.isMoving = false;
                    companion.gridX = Math.round(companion.pixelX / TILE_SIZE);
                    companion.gridY = Math.round(companion.pixelY / TILE_SIZE);
                }
            }
        }

        function fillCircle(cx, cy, r, color) {
            ctx.fillStyle = color;
            for (let dy = -r; dy <= r; dy++) {
                const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
                ctx.fillRect(cx - hw, cy + dy, hw * 2, 1);
            }
        }

        function drawAppleShop() {
            const gr = pal.light;
            ctx.fillStyle = 'rgba(21,35,21,0.35)'; ctx.fillRect(114, 62, 56, 3);
            fillCircle(128, 42, 19, '#7f1414'); fillCircle(144, 42, 19, '#7f1414'); ctx.fillRect(128, 23, 16, 38);
            fillCircle(128, 42, 18, '#c81e1e'); fillCircle(144, 42, 18, '#c81e1e'); ctx.fillStyle = '#c81e1e'; ctx.fillRect(128, 24, 16, 36);
            fillCircle(150, 46, 12, '#a11818'); fillCircle(148, 50, 8, '#8f1414');
            fillCircle(136, 21, 5, gr);
            fillCircle(122, 32, 5, '#f26b6b'); ctx.fillStyle = '#fdd0d0'; ctx.fillRect(119, 29, 3, 2);
            ctx.fillStyle = '#4a3320'; ctx.fillRect(135, 12, 3, 9);
            ctx.fillStyle = '#4d8a44'; ctx.fillRect(138, 14, 9, 3); ctx.fillRect(141, 12, 7, 2);
            ctx.fillStyle = '#78b060'; ctx.fillRect(139, 14, 4, 1);
            ctx.fillStyle = '#f5d9a8'; ctx.fillRect(118, 49, 10, 13);
            ctx.fillStyle = '#4a3222'; ctx.fillRect(119, 50, 8, 12);
            ctx.fillStyle = '#e8c070'; ctx.fillRect(125, 56, 1, 1);
        }

        function drawHouseSprite() {
            const x = 224, y = 80;
            const HC = currentPaletteKey === 'desert' ? { line:'#2a1b12', roof:'#6b4a3f', roofDk:'#4a3229', roofHi:'#8f6a58', wall:'#b0603f', mortar:'#7a3b28', glass:'#f0dca0', glassDk:'#5a3a1e' } : { line:'#1a3320', roof:'#56684f', roofDk:'#34443a', roofHi:'#7c8f6a', wall:'#9aab86', mortar:'#6b7d5c', glass:'#c7d9b0', glassDk:'#2f5a30' };
            ctx.fillStyle = pal.light; ctx.fillRect(x, y, 48, 48);
            for (let i = 0; i < 20; i++) {
                const inset = Math.floor(9 - i * 9 / 19);
                const l = x + inset, w = 48 - inset * 2;
                ctx.fillStyle = HC.line; ctx.fillRect(l, y + 2 + i, w, 1);
                ctx.fillStyle = (i % 4 === 3) ? HC.roofDk : HC.roof; ctx.fillRect(l + 1, y + 2 + i, w - 2, 1);
                if (i % 4 === 0 && i < 19) { ctx.fillStyle = HC.roofHi; ctx.fillRect(l + 2, y + 2 + i, 6, 1); }
            }
            ctx.fillStyle = HC.line; ctx.fillRect(x + 1, y + 21, 46, 1);
            ctx.fillStyle = HC.roofHi; ctx.fillRect(x + 4, y + 8, 2, 12);
            ctx.fillStyle = HC.line; ctx.fillRect(x + 3, y + 22, 42, 26);
            ctx.fillStyle = HC.wall; ctx.fillRect(x + 4, y + 22, 40, 25);
            ctx.fillStyle = HC.mortar;
            for (let yy = 25; yy < 48; yy += 4) ctx.fillRect(x + 4, y + yy, 40, 1);
            for (let yy = 22; yy < 48; yy += 4) for (let xx = 6 + ((yy / 4) % 2) * 4; xx < 44; xx += 8) ctx.fillRect(x + xx, y + yy, 1, 3);
            for (const wx of [8, 32]) {
                ctx.fillStyle = HC.line; ctx.fillRect(x + wx, y + 26, 10, 9);
                ctx.fillStyle = HC.glass; ctx.fillRect(x + wx + 1, y + 27, 8, 7);
                ctx.fillStyle = HC.glassDk; ctx.fillRect(x + wx + 4, y + 27, 1, 7); ctx.fillRect(x + wx + 1, y + 30, 8, 1);
            }
            ctx.fillStyle = HC.line; ctx.fillRect(x + 16, y + 31, 16, 17);
            ctx.fillStyle = apartmentRented ? '#4a3222' : '#334155'; ctx.fillRect(x + 17, y + 32, 14, 16);
            ctx.fillStyle = '#e8c070'; ctx.fillRect(x + 28, y + 40, 1, 2);
        }

        function drawDesertTile(tile, c, r, tx, ty) { // the photo is the ground; only fallback fills, debug bumpers and generic buildings draw here
            if (tile === TILE_BUMPER) { if (SHOW_BUMPERS) { ctx.fillStyle = 'rgba(255,40,40,0.35)'; ctx.fillRect(tx, ty, 16, 16); } return true; }
            if (tile !== 0 && tile !== 3 && tile !== 4) return false;
            const cm = c >= 30 ? 59 - c : c;
            const inBlock = (cm >= 7 && cm <= 10 && r >= 1 && r <= 3) || (cm >= 14 && cm <= 16 && r >= 5 && r <= 7); // apple + house are sprites
            if (!FX_GL.ok) { ctx.fillStyle = '#e2c08c'; ctx.fillRect(tx, ty, 16, 16); }
            if (tile !== 0 && !inBlock) {
                const wall = tile === 3;
                ctx.fillStyle = wall ? '#b0603f' : '#6b4a3f'; ctx.fillRect(tx, ty, 16, 16);
                ctx.fillStyle = wall ? '#7a3b28' : '#4a3229';
                for (let y = 3; y < 16; y += 4) ctx.fillRect(tx, ty + y, 16, 1);
                if (wall) for (let y = 0; y < 16; y += 4) ctx.fillRect(tx + 3 + (y / 4 % 2) * 4, ty + y, 1, 3);
            }
            return true;
        }

        function renderTileMapInternal() {
            if (currentPaletteKey === 'desert' && FX_GL.ok) ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT); // the WebGL layer paints the ground
            else { ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }

            let targetCamX = player.pixelX - GAME_WIDTH / 2 + TILE_SIZE / 2;
            let targetCamY = player.pixelY - GAME_HEIGHT / 2 + TILE_SIZE / 2 - 44 * COMBAT.amt;

            let maxCamX = MAP_COLS * TILE_SIZE - GAME_WIDTH;
            let maxCamY = MAP_ROWS * TILE_SIZE - GAME_HEIGHT;

            let camX = Math.max(0, Math.min(targetCamX, maxCamX));
            let camY = Math.max(0, Math.min(targetCamY, maxCamY));

            if (cinematicMode) {
                cinematicCameraY += (camY - cinematicCameraY) * 0.08;
                camY = cinematicCameraY;
            }

            lastCamX = camX;
            lastCamY = camY;

            ctx.save();
            ctx.translate(-Math.floor(camX), -Math.floor(camY));

            const c0 = Math.max(0, Math.floor(camX / TILE_SIZE)), c1 = Math.min(MAP_COLS - 1, Math.ceil((camX + GAME_WIDTH) / TILE_SIZE));
            const r0 = Math.max(0, Math.floor(camY / TILE_SIZE)), r1 = Math.min(MAP_ROWS - 1, Math.ceil((camY + GAME_HEIGHT) / TILE_SIZE)), P3 = paperLive();
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    const tile = MAP_DATA[r][c];
                    const tx = c * TILE_SIZE;
                    const ty = r * TILE_SIZE;
                    if (P3 && tile !== 8 && tile !== 14 && tile !== 6) continue; // folded up in 3D (or painted into the street)

                    if (drawDesertTile(tile, c, r, tx, ty)) {
                    } else if (tile === 0) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        if (currentPaletteKey === 'desert') {
                            const h = ((c * 73856093) ^ (r * 19349663)) >>> 0;
                            const o = h % 5;
                            ctx.fillStyle = '#d2ac78';
                            ctx.fillRect(tx + 1 + o, ty + 4, 7, 1);
                            ctx.fillRect(tx + 6 - o, ty + 11, 8, 1);
                            ctx.fillStyle = '#efd8a8';
                            ctx.fillRect(tx + 2 + o, ty + 5, 5, 1);
                            ctx.fillRect(tx + 7 - o, ty + 12, 6, 1);
                            if (h % 11 === 0) { ctx.fillStyle = '#9a8a6a'; ctx.fillRect(tx + 9, ty + 8, 2, 1); ctx.fillRect(tx + 11, ty + 9, 1, 1); }
                            if (h % 13 === 0) { ctx.fillStyle = '#66743a'; ctx.fillRect(tx + 4, ty + 9, 1, 3); ctx.fillRect(tx + 6, ty + 10, 1, 2); ctx.fillRect(tx + 5, ty + 8, 1, 2); }
                        }
                    } else if (tile === 1) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        if (currentPaletteKey === 'desert') { ctx.fillStyle = 'rgba(70,40,15,0.28)'; ctx.fillRect(tx - 5, ty + 11, 12, 4); }
                        ctx.fillStyle = '#92400e'; 
                        ctx.fillRect(tx + 6, ty + 6, 4, 10);
                        ctx.fillStyle = pal.grass; 
                        ctx.fillRect(tx + 2, ty + 1, 12, 6);
                        ctx.fillRect(tx + 4, ty + 0, 8, 8);
                    } else if (tile === 2) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(tx + 6, ty + 8, 4, 8);
                        ctx.fillStyle = pal.tree;
                        ctx.fillRect(tx + 2, ty + 2, 12, 8);
                        ctx.fillStyle = currentPaletteKey === 'desert' ? '#8a9c4c' : '#22c55e';
                        ctx.fillRect(tx + 4, ty + 4, 8, 4);
                    } else if (tile === 3) {
                        ctx.fillStyle = '#f97316';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#c2410c';
                        ctx.fillRect(tx, ty + 14, TILE_SIZE, 2);
                    } else if (tile === 4) {
                        ctx.fillStyle = pal.roof;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = 'rgba(0,0,0,0.3)';
                        ctx.fillRect(tx, ty + 12, TILE_SIZE, 4);
                    } else if (tile === 5) {
                        ctx.fillStyle = (c === 15 && r === 7 && !apartmentRented) ? '#334155' : '#78350f';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = (c === 15 && r === 7 && !apartmentRented) ? '#1e293b' : '#451a03';
                        ctx.fillRect(tx + 3, ty + 3, 10, 13);
                    } else if (tile === 6) {
                        ctx.fillStyle = '#0284c7';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#38bdf8';
                        ctx.fillRect(tx + ((Date.now() / 200) % 8), ty + 4, 6, 2);
                    } else if (tile === 7) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#b45309';
                        ctx.fillRect(tx + 3, ty + 2, 10, 8);
                        ctx.fillRect(tx + 7, ty + 10, 2, 6);
                    } else if (tile === 8) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#38bdf8';
                        ctx.beginPath();
                        ctx.arc(tx + 8, ty + 8, 5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#e0f2fe';
                        ctx.fillRect(tx + 6, ty + 6, 3, 3);
                    } else if (tile === 9) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(tx, ty + 6, TILE_SIZE, 4);
                        ctx.fillRect(tx + 3, ty + 2, 3, 12);
                        ctx.fillRect(tx + 10, ty + 2, 3, 12);
                    } else if (tile === 10) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = 'rgba(0,0,0,0.25)';
                        ctx.fillRect(tx + 4, ty + 14, 8, 2);
                        ctx.fillStyle = '#64748b';
                        ctx.fillRect(tx + 4, ty + 6, 8, 9);
                        ctx.beginPath();
                        ctx.arc(tx + 8, ty + 6, 4, Math.PI, 0);
                        ctx.fill();
                        ctx.fillStyle = '#334155';
                        ctx.fillRect(tx + 6, ty + 9, 4, 1);
                        ctx.fillRect(tx + 7, ty + 7, 2, 5);
                    } else if (tile === 11) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#1c1917';
                        ctx.fillRect(tx + 7, ty + 9, 2, 7);
                        ctx.fillRect(tx + 3, ty + 3, 2, 7);
                        ctx.fillRect(tx + 11, ty + 4, 2, 6);
                        ctx.fillRect(tx + 6, ty + 2, 2, 6);
                        ctx.fillRect(tx + 2, ty + 8, 3, 2);
                        ctx.fillRect(tx + 11, ty + 8, 3, 2);
                    } else if (tile === 12) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        const fogDrift = Math.sin(Date.now() / 900 + tx) * 2;
                        ctx.fillStyle = 'rgba(226,232,240,0.35)';
                        ctx.beginPath();
                        ctx.ellipse(tx + 8 + fogDrift, ty + 11, 7, 3, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = 'rgba(226,232,240,0.2)';
                        ctx.beginPath();
                        ctx.ellipse(tx + 8 - fogDrift, ty + 6, 6, 2.5, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (tile === 13) {
                        ctx.fillStyle = pal.light;
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#292524';
                        ctx.fillRect(tx + 7, ty + 8, 2, 8);
                        ctx.fillStyle = '#44403c';
                        ctx.fillRect(tx + 5, ty + 6, 6, 2);
                        const flicker = 0.6 + Math.abs(Math.sin(Date.now() / 180 + tx)) * 0.4;
                        ctx.fillStyle = `rgba(251,191,36,${flicker})`;
                        ctx.fillRect(tx + 6, ty + 2, 4, 4);
                        ctx.fillStyle = `rgba(251,191,36,${flicker * 0.3})`;
                        ctx.beginPath();
                        ctx.arc(tx + 8, ty + 4, 6, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (tile === 14) {
                        ctx.fillStyle = '#1c1917';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#44403c';
                        ctx.fillRect(tx + 3, ty + 3, TILE_SIZE - 6, TILE_SIZE - 6);
                        ctx.fillStyle = '#78716c';
                        ctx.fillRect(tx + 5, ty + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                    }
                }
            }

            if ((currentPaletteKey === 'gb' || currentPaletteKey === 'desert') && !P3) {
                drawHouseSprite(); // the west Emporium is hidden; only the mirrored (east) one is drawn
                ctx.save(); ctx.translate(60 * TILE_SIZE, 0); ctx.scale(-1, 1);
                drawAppleShop(); drawHouseSprite();
                ctx.restore();
            }
            drawFarmGround(); drawPatrolGround();
            drawNpcs();
            RenderFX.draw();

            if (gameState === "PLAYING" && hero) {
                hero.render();
            }

            if (companion.active) {
                asCard(companion.pixelX + 8, companion.pixelY + 15, () => drawDogSprite(companion.pixelX, companion.pixelY, camDir(companion.dir), companion.animFrame));
            }

            const nightNow = isNight();
            for (const wolf of wolves) {
                if (!wolf.alive) continue;
                asCard(wolf.pixelX + 8, wolf.pixelY + 15, () => {
                    if (wolf.kind === 'boxelder') drawBoxelder(wolf);
                    else drawWolfSprite(wolf.pixelX, wolf.pixelY, camDir(wolf.dir), wolf.animFrame, nightNow);
                    cardFlash((wolf.hitT || 0) / 10);
                });
            }

            if (currentMapName === 'overworld') for (const w of wildHorses) { if (w.alive) asCard(w.pixelX + 8, w.pixelY + 15, () => { const d0 = w.dir; w.dir = camDir(d0); drawWildHorse(w); w.dir = d0; }); }
            drawFarmCards(); drawFollower(); drawPatrolCards(); drawStalker();
            drawSparks();

            for (const t of guardTargetsOnMap(currentMapName)) {
                const cx = t.gridX * TILE_SIZE + TILE_SIZE / 2, cy = t.gridY * TILE_SIZE + TILE_SIZE / 2;
                if (t.draw) t.draw(t, ctx, cx, cy);
                else { // default: a small pulsing ring so an undressed guard target is still visible
                    ctx.save(); ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.arc(cx, cy, 7 + Math.sin(Date.now() / 300) * 1, 0, Math.PI * 2); ctx.stroke();
                    ctx.restore();
                }
                if (t.hp < t.maxHp) { // HP bar above whatever's being defended
                    const w = 16, x = t.gridX * TILE_SIZE, y = t.gridY * TILE_SIZE - 5;
                    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, w, 3);
                    ctx.fillStyle = t.hp / t.maxHp > 0.3 ? '#4ade80' : '#f87171';
                    ctx.fillRect(x, y, Math.max(0, w * (t.hp / t.maxHp)), 3);
                }
            }

            if (lockedWolf && lockedWolf.alive) {
                const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
                const cx = lockedWolf.pixelX + TILE_SIZE / 2;
                const cy = lockedWolf.pixelY + TILE_SIZE / 2;
                const r = 10 * pulse;
                ctx.strokeStyle = '#f87171';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx - r - 3, cy);
                ctx.lineTo(cx - r + 1, cy);
                ctx.moveTo(cx + r - 1, cy);
                ctx.lineTo(cx + r + 3, cy);
                ctx.moveTo(cx, cy - r - 3);
                ctx.lineTo(cx, cy - r + 1);
                ctx.moveTo(cx, cy + r - 1);
                ctx.lineTo(cx, cy + r + 3);
                ctx.stroke();
            }

            if (nightNow && !FX_GL.ok) {
                ctx.fillStyle = 'rgba(10,10,35,0.38)';
                ctx.fillRect(camX, camY, GAME_WIDTH, GAME_HEIGHT);
            }

            ctx.restore();
        }

        function renderWolfHollowInternal() {
            const cols = WOLF_HOLLOW_MAP[0].length, rows = WOLF_HOLLOW_MAP.length;
            const mapWidth = cols * TILE_SIZE;
            const mapHeight = rows * TILE_SIZE;

            let targetCamX = player.pixelX - GAME_WIDTH / 2 + TILE_SIZE / 2;
            let targetCamY = player.pixelY - GAME_HEIGHT / 2 + TILE_SIZE / 2 - 44 * COMBAT.amt;
            let maxCamX = Math.max(0, mapWidth - GAME_WIDTH);
            let maxCamY = Math.max(0, mapHeight - GAME_HEIGHT);
            let camX = Math.max(0, Math.min(targetCamX, maxCamX));
            let camY = Math.max(0, Math.min(targetCamY, maxCamY));
            lastCamX = camX; lastCamY = camY; // the 3D view and the lights are built around this camera

            const glG = FX_GL.ok && FX_GL.bgKey === 'gen:wolf_hollow' && FX_GL.bgReady; // the GPU paints the floor; the canvas carries only what moves
            if (glG) ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT); else { ctx.fillStyle = '#0c1a12'; ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }

            ctx.save();
            ctx.translate(-Math.floor(camX), -Math.floor(camY));

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const tile = WOLF_HOLLOW_MAP[r][c];
                    const tx = c * TILE_SIZE;
                    const ty = r * TILE_SIZE;
                    if (glG && tile !== 12 && tile !== 14 && tile !== 16) continue;
                    if (glG) { /* fog puffs, the way out and the old camp still draw on the ground */ } else {
                    ctx.fillStyle = '#1e3324';
                    ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    if ((r + c) % 2 === 0) ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                    }

                    if (glG && (tile === 1 || tile === 2 || tile === 11 || tile === 15)) { /* standing versions are cards */ }
                    else if (tile === 1) {
                        ctx.fillStyle = '#111827';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#1f2937';
                        ctx.fillRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                    } else if (tile === 2) {
                        ctx.fillStyle = '#14532d';
                        ctx.fillRect(tx + 2, ty, TILE_SIZE - 4, TILE_SIZE - 2);
                        ctx.fillStyle = '#166534';
                        ctx.fillRect(tx + 4, ty + 2, TILE_SIZE - 8, TILE_SIZE - 8);
                        ctx.fillStyle = '#422006';
                        ctx.fillRect(tx + 6, ty + TILE_SIZE - 4, 4, 4);
                    } else if (tile === 11) {
                        ctx.fillStyle = '#1c1917';
                        ctx.fillRect(tx + 7, ty + 6, 2, 10);
                        ctx.fillRect(tx + 3, ty + 2, 2, 6);
                        ctx.fillRect(tx + 11, ty + 3, 2, 6);
                    } else if (tile === 12) {
                        const fogDrift = Math.sin(Date.now() / 900 + tx) * 2;
                        ctx.fillStyle = 'rgba(226,232,240,0.22)';
                        ctx.beginPath();
                        ctx.ellipse(tx + 8 + fogDrift, ty + 11, 7, 3, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (tile === 15) {
                        ctx.fillStyle = '#57534e';
                        ctx.beginPath();
                        ctx.ellipse(tx + 8, ty + 10, 6, 4, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#78716c';
                        ctx.beginPath();
                        ctx.ellipse(tx + 6, ty + 8, 3, 2, 0, 0, Math.PI * 2);
                        ctx.fill();
                    } else if (tile === 14) {
                        ctx.fillStyle = '#44403c';
                        ctx.fillRect(tx + 3, ty + 3, TILE_SIZE - 6, TILE_SIZE - 6);
                        ctx.fillStyle = '#78716c';
                        ctx.fillRect(tx + 5, ty + 5, TILE_SIZE - 10, TILE_SIZE - 10);
                    } else if (tile === 16) {
                        ctx.fillStyle = '#292524';
                        ctx.beginPath();
                        ctx.arc(tx + 8, ty + 10, 4, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = hollowCluesFound.abandonedCamp ? '#57534e' : '#f97316';
                        ctx.fillRect(tx + 6, ty + 8, 4, 2);
                        ctx.fillStyle = '#44403c';
                        ctx.fillRect(tx + 3, ty + 4, 2, 6);
                        ctx.fillRect(tx + 11, ty + 5, 2, 5);
                    }
                }
            }

            drawGrove(); drawHollowStanding();
            if (!glG) { ctx.fillStyle = 'rgba(5,10,8,0.3)'; ctx.fillRect(camX, camY, GAME_WIDTH, GAME_HEIGHT); }

            if (gameState === "PLAYING" && hero) {
                hero.render();
            }

            if (companion.active) {
                drawDogSprite(companion.pixelX, companion.pixelY, camDir(companion.dir), companion.animFrame);
            }

            ctx.restore();
        }

        function renderTellhouseInternal() {
            const cols = 10, rows = 9;
            const w = cols * TILE_SIZE, h = rows * TILE_SIZE;
            const offsetX = Math.floor((GAME_WIDTH - w) / 2);
            const offsetY = Math.floor((GAME_HEIGHT - h) / 2);

            ctx.save();
            ctx.translate(offsetX, offsetY);

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const tile = TELLHOUSE_MAP[r][c];
                    const tx = c * TILE_SIZE, ty = r * TILE_SIZE;

                    if (tile === 0) {
                        ctx.fillStyle = '#92400e';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(tx, ty + 15, TILE_SIZE, 1);
                    } else if (tile === 1) {
                        ctx.fillStyle = '#44403c';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#292524';
                        ctx.fillRect(tx, ty + 14, TILE_SIZE, 2);
                    } else if (tile === 5) {
                        ctx.fillStyle = '#f43f5e';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                    } else if (tile === 20) {
                        ctx.fillStyle = '#92400e';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#5c2e0a';
                        ctx.fillRect(tx + 2, ty + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                        ctx.fillStyle = '#fbbf24';
                        ctx.fillRect(tx + 5, ty + 5, 3, 3);
                    } else if (tile === 21) {
                        ctx.fillStyle = '#78350f';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                        ctx.fillStyle = '#a16207';
                        ctx.fillRect(tx, ty, TILE_SIZE, 4);
                    } else {
                        ctx.fillStyle = '#92400e';
                        ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
                    }
                }
            }

            drawVillagerNPC(2 * TILE_SIZE, 3 * TILE_SIZE, 'drunk');
            drawVillagerNPC(5 * TILE_SIZE, 3 * TILE_SIZE, 'woman');

            if (gameState === "PLAYING" && hero) {
                hero.render();
            }

            if (companion.active) {
                drawDogSprite(companion.pixelX, companion.pixelY, camDir(companion.dir), companion.animFrame);
            }

            ctx.restore();
        }

