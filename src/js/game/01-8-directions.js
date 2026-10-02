        // ================= 8 DIRECTIONS =================
        // player.dir stays one of up/down/left/right, so every door, NPC, tree and dialogue check keeps working unchanged.
        // player.face8 is the full 8-way facing used for movement and animation. A diagonal's cardinal is its left/right part.
        const DIR8 = ['down', 'down_right', 'right', 'up_right', 'up', 'up_left', 'left', 'down_left'];
        const DIR8_VEC = { down: [0, 1], down_right: [1, 1], right: [1, 0], up_right: [1, -1], up: [0, -1], up_left: [-1, -1], left: [-1, 0], down_left: [-1, 1] };
        const DIR8_MIRROR = { right: 'left', left: 'right', down_right: 'down_left', down_left: 'down_right', up_right: 'up_left', up_left: 'up_right' };
        const DIR8_FALLBACK = { down_right: ['right', 'down'], down_left: ['left', 'down'], up_right: ['right', 'up'], up_left: ['left', 'up'] }; // until real diagonal art exists, diagonals use the side view
        function dir8FromVec(dx, dy) { const sx = Math.sign(dx), sy = Math.sign(dy); return DIR8.find(d => DIR8_VEC[d][0] === sx && DIR8_VEC[d][1] === sy) || 'down'; }
        function cardinalOf(d) { return !DIR8_VEC[d] ? 'down' : d.indexOf('_') > 0 ? d.split('_')[1] : d; }
        // Find the art for a facing in a {dir: value} table: exact match, then the mirror image, then the nearest view (mirrored if needed).
        function heroLookup(tbl, d) {
            if (!tbl) return null;
            if (tbl[d]) return { v: tbl[d], flip: false, key: d };
            const m = DIR8_MIRROR[d]; if (m && tbl[m]) return { v: tbl[m], flip: true, key: m };
            for (const alt of (DIR8_FALLBACK[d] || [])) {
                if (tbl[alt]) return { v: tbl[alt], flip: false, key: alt };
                const ma = DIR8_MIRROR[alt]; if (ma && tbl[ma]) return { v: tbl[ma], flip: true, key: ma };
            }
            return null;
        }
        let playerInvincible = false;
        let invincibleTimer = 0; // frames of dodge invincibility left

        function loadSprite(name) { return name; }

