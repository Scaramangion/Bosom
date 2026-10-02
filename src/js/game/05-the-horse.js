        // ================= THE HORSE: waits by the Sun Tomb in the Wastes. A to mount or get down; carries you between outdoor maps =================
        const HORSE = { map: 'wastes', x: 26, y: 59, face: 'left', mounted: false, mountStart: 0, mountUntil: 0, req: null };
        const HORSE_OUTDOOR = new Set(['overworld', 'wastes', 'wolf_hollow', 'trail', 'haven']);
        const HORSE_MOUNT_MS = 1100, HORSE_TROT = 3.0, HORSE_GALLOP = 4.6;
        const heroAtlas2D = new Image(); heroAtlas2D.src = document.getElementById('hero-atlas').textContent.trim(); // for 2D drawing (menu icons, no-WebGL horse)
        function horseNear() { return !HORSE.mounted && HORSE.map === currentMapName && Math.max(Math.abs(player.gridX - HORSE.x), Math.abs(player.gridY - HORSE.y)) <= 1; }
        function mountHorse() {
            const now = performance.now();
            HORSE.mounted = true; HORSE.mountStart = now; HORSE.mountUntil = now + HORSE_MOUNT_MS;
            player.gridX = HORSE.x; player.gridY = HORSE.y; player.pixelX = player.targetX = HORSE.x * TILE_SIZE; player.pixelY = player.targetY = HORSE.y * TILE_SIZE; player.isMoving = false;
            player.face8 = HORSE.face; player.dir = HORSE.face;
            if (equippedItem !== 'none') { HORSE.stowed = equippedItem; } // hands on the reins
            audio.playTone(196, 'triangle', 0.25, 0.05); setTimeout(() => audio.playTone(147, 'triangle', 0.3, 0.04), 380);
            showFluidMessage('You climb into the saddle. [A] to get down.', 2200);
        }
        function dismountHorse() {
            const order = HORSE.face === 'left' ? [[0, 1], [1, 0], [-1, 0], [0, -1]] : [[0, 1], [-1, 0], [1, 0], [0, -1]];
            HORSE.mounted = false; // the horse stays on this tile; he steps off beside it
            const spot = order.find(([dx, dy]) => !isSolidTile(player.gridX + dx, player.gridY + dy) && !(dx === 0 && dy === 0));
            if (!spot) { HORSE.mounted = true; showFluidMessage('No room to get down here.'); return; }
            HORSE.map = currentMapName; HORSE.x = player.gridX; HORSE.y = player.gridY;
            player.gridX += spot[0]; player.gridY += spot[1]; player.pixelX = player.targetX = player.gridX * TILE_SIZE; player.pixelY = player.targetY = player.gridY * TILE_SIZE;
            player.isMoving = false; player.isRunning = false;
            audio.playTone(147, 'triangle', 0.25, 0.05);
        }
        function horsePark(map, gx, gy, doorX, doorY) { // tie it up beside the doorway, off the tile you'll come back out on
            const here = currentMapName; currentMapName = map; let spot = null;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [0, 2]]) { const x = gx + dx, y = gy + dy; if ((x !== doorX || y !== doorY) && !isSolidTile(x, y)) { spot = [x, y]; break; } }
            currentMapName = here; HORSE.map = map; [HORSE.x, HORSE.y] = spot || [gx, gy];
        }
        function horseRidePose(d8, moving, running, dt, now) {
            if (now < HORSE.mountUntil) { const q = (now - HORSE.mountStart) / HORSE_MOUNT_MS; return { name: 'mount' + (1 + Math.min(4, Math.floor(q * 5))), flip: false, bob: 0, rot: 0, view: 'ride', riding: true }; }
            const dir = cardinalOf(d8); if (dir === 'left' || dir === 'right') HORSE.face = dir;
            heroHD.rcyc = moving ? (heroHD.rcyc || 0) + dt / (running ? 560 : 820) : 0;
            const q = heroHD.rcyc % 1, gait = moving ? Math.abs(Math.sin(q * Math.PI * 2)) * (running ? 1.4 : 0.8) : Math.sin(now / 520) * 0.3;
            if (dir === 'up' || dir === 'down') { // riding away from / toward the camera: a real 8-frame gallop (legs, body bob, tail, rider a beat behind)
                const k8 = moving ? Math.floor(q * 8) % 8 : 0, nm = (dir === 'up' ? 'rideN' : 'rideS') + k8;
                return { name: nm, flip: dir === 'up' && HORSE.face === 'left', bob: moving ? 0 : gait, rot: 0, view: 'ride', riding: true };
            }
            const set = HORSE.face === 'left' ? ['ride_l0', 'ride_l1', 'ride_l2', 'ride_l3', 'ride_l4', 'ride_l5', 'ride_l6'] : ['ride_r0', 'ride_r1', 'ride_r2', 'ride_r3', 'ride_r4', 'ride_r5', 'ride_r6', 'ride_r7'];
            return { name: moving ? set[Math.floor(q * set.length) % set.length] : set[0], flip: false, bob: moving ? 0 : gait, rot: 0, view: 'ride', riding: true };
        }
        function drawHorseWorld() { // the waiting horse: its own sprite (no rider), drawn by the HD layer when there is one
            HORSE.req = null;
            if (HORSE.mounted || HORSE.map !== currentMapName) return;
            if (HORSE.x === player.gridX && HORSE.y === player.gridY && !player.isMoving) horsePark(currentMapName, player.gridX, player.gridY, player.gridX, player.gridY); // never stand on top of him
            const fx = HORSE.x * TILE_SIZE + 8, fy = HORSE.y * TILE_SIZE + 15, name = HORSE.face === 'left' ? 'horse_side_b' : 'horse_side_a';
            ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(fx, fy, 12, 3, 0, 0, 7); ctx.fill();
            if (heroHD.active()) { const m = ctx.getTransform(); HORSE.req = { x: m.a * fx + m.c * fy + m.e, y: m.b * fx + m.d * fy + m.f, s: m.a, name, wy: fy }; return; }
            const f = HERO_FRAMES[name]; if (!f || !heroAtlas2D.complete) return;
            const k = HERO_TARGET_H / 88, sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
            ctx.drawImage(heroAtlas2D, f[0], f[1], f[2], f[3], fx - f[4] * k, fy - f[5] * k, f[2] * k, f[3] * k); ctx.imageSmoothingEnabled = sm;
        }

