        // ================= LOCATIONS + HYBRID CAMERA: snap cuts for map changes, eased curves for zones inside a map =================
        // A TransitionZone is a tile rectangle. First match wins, so list specific areas before general ones.
        //   mode 'interpolate': eased (ease-out cubic, CAMERA_EASE_SECONDS) name change + cylinder/zoom blend.  mode 'snap': instant cut, input locked for 2 frames.
        //   cylinder 0..1 curves the view around a vertical axis (panorama); zoom 1 = normal; map changes always snap.
        const CAMERA_EASE_SECONDS = 0.4;
        const TRANSITION_ZONES = [
            { id: 'town_gate', map: 'overworld', rect: [18, 16, 41, 23], name: 'TOWN GATE', mode: 'interpolate', cylinder: 0, zoom: 1 },
            { id: 'camp', map: 'overworld', rect: [60, 0, 69, 23], name: "BRENNAN'S CAMP", mode: 'interpolate', cylinder: 0, zoom: 1 },
            { id: 'brennans_theme', map: 'overworld', rect: [0, 0, 69, 23], name: "BRENNAN'S THEME", mode: 'interpolate', cylinder: 0, zoom: 1 },
            { id: 'hollow_canyon', map: 'wastes', rect: [0, 0, 29, 20], name: 'HOLLOW CANYON', mode: 'interpolate', cylinder: 0.35, zoom: 1.04 },
            { id: 'sun_tomb_grounds', map: 'wastes', rect: [0, 47, 29, 63], name: 'SUN TOMB GROUNDS', mode: 'interpolate', cylinder: 0.3, zoom: 1.04 },
            { id: 'canyon_clearing', map: 'wastes', rect: [0, 64, 29, 83], name: 'CANYON CLEARING', mode: 'interpolate', cylinder: 0.25, zoom: 1.04 },
            { id: 'wastes', map: 'wastes', rect: [0, 0, 29, 83], name: 'THE WASTES', mode: 'interpolate', cylinder: 0, zoom: 1 },
            { id: 'trail', map: 'trail', rect: [0, 0, 29, 359], name: 'THE LONG TRAIL', mode: 'interpolate', cylinder: 0, zoom: 1 },
            { id: 'haven', map: 'haven', rect: [0, 0, 59, 39], name: 'HAVEN', mode: 'interpolate', cylinder: 0, zoom: 1 }
        ];
        const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
        let locNameToken = 0;
        function setLocationName(name, mode = 'snap') { // 'interpolate' fades the HUD name out and back in
            const el = document.getElementById('location-name');
            if (!el || el.textContent === name) return;
            const token = ++locNameToken;
            if (mode === 'snap') { el.style.opacity = '1'; el.textContent = name; return; }
            el.style.transition = 'opacity .2s ease-out'; el.style.opacity = '0';
            setTimeout(() => { if (token === locNameToken) { el.textContent = name; el.style.opacity = '1'; } }, 200);
        }
        class DioramaCameraManager {
            constructor() {
                this.state = 'GRID_LOCKED';                 // GRID_LOCKED (flat view) or PANORAMA (curved view)
                this.cur = { cyl: 0, zoom: 1 }; this.from = { cyl: 0, zoom: 1 }; this.to = { cyl: 0, zoom: 1 };
                this.t = 1; this.yaw = 0; this.lockFrames = 0;
                this.zone = null; this.mapKey = null; this.pending = null; this.holdSteps = 0;
            }
            zoneAt(map, x, y) { return TRANSITION_ZONES.find(z => z.map === map && x >= z.rect[0] && x <= z.rect[2] && y >= z.rect[1] && y <= z.rect[3]) || null; }
            enter(z, mode) {
                this.zone = z;
                const tgt = z ? { cyl: z.cylinder || 0, zoom: z.zoom || 1 } : { cyl: 0, zoom: 1 };
                if (z) setLocationName(z.name, mode);
                if (mode === 'snap') { this.cur = { ...tgt }; this.from = { ...tgt }; this.to = { ...tgt }; this.t = 1; this.yaw = 0; this.lockFrames = 2; } // instant cut + 2 frames without input
                else { this.from = { ...this.cur }; this.to = tgt; this.t = 0; }
            }
            step() { // once per simulation step (1/60 s)
                if (!gameStarted) return;
                if (this.lockFrames > 0) this.lockFrames--;
                const map = currentMapName, z = this.zoneAt(map, player.gridX, player.gridY);
                if (map !== this.mapKey) { this.mapKey = map; this.pending = null; this.enter(z, 'snap'); }
                else if (z !== this.zone) { // must stay a few steps inside the new zone, so walking along an edge does not flicker
                    if (this.pending !== z) { this.pending = z; this.holdSteps = 0; }
                    else if (++this.holdSteps >= 6) { this.pending = null; this.enter(z, z ? z.mode : 'snap'); }
                } else this.pending = null;
                if (this.t < 1) {
                    this.t = Math.min(1, this.t + 1 / (60 * CAMERA_EASE_SECONDS));
                    const e = easeOutCubic(this.t);
                    this.cur.cyl = this.from.cyl + (this.to.cyl - this.from.cyl) * e;
                    this.cur.zoom = this.from.zoom + (this.to.zoom - this.from.zoom) * e;
                }
                let yawT = 0; // lateral position in a curve zone -> cylinder angle: theta = (x - x0) / R
                const z2 = this.zone;
                if (z2 && z2.cylinder > 0) {
                    const x0 = (z2.rect[0] + z2.rect[2] + 1) * TILE_SIZE / 2, R = (z2.rect[2] - z2.rect[0] + 1) * TILE_SIZE / (Math.PI / 2);
                    yawT = Math.max(-0.25, Math.min(0.25, (player.pixelX - x0) / R)) * 0.5;
                }
                this.yaw += (yawT - this.yaw) * 0.08;
                this.state = (this.cur.cyl > 0.001 || this.to.cyl > 0) ? 'PANORAMA' : 'GRID_LOCKED';
            }
        }
        const diorama = new DioramaCameraManager();

        let __bosomBootStarted = false;
        function bootBosom() {
            if (__bosomBootStarted) return; __bosomBootStarted = true;
            try {
                gameLoop();
            } catch (e) {
                console.error("gameLoop failed to start:", e);
            }
            FX_GL.init();
            try { setActiveScreen('title'); } catch (e) { console.error('Title screen failed:', e); }
            window.__bosomBooted = true;
            const avatarImg = document.querySelector('#hero-avatar-badge img');
            if (avatarImg) {
                avatarImg.onerror = function() { avatarImg.style.display = 'none'; };
            }
        }
        // start as soon as the page is parsed (all art is inline); never wait on outside requests like the web font
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bootBosom, 0)); else setTimeout(bootBosom, 0);
        window.addEventListener('load', bootBosom);
    