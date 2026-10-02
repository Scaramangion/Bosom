        // ================= SPATIAL FILEDEX: X/Y -> region -> chunk -> entities =================
        const FileDex = {
            REGIONS: [{ id: 'town_west', name: "BRENNAN'S THEME - WEST", cx: [0, 2] }, { id: 'town_east', name: "BRENNAN'S THEME - EAST", cx: [3, 5] }, { id: 'town_camp', name: "BRENNAN'S CAMP", cx: [6, 6] }],
            index: new Map(), active: null,
            getChunk(x, y) {
                const cx = Math.max(0, Math.min(MAP_COLS / CHUNK_W - 1, Math.floor(x / CHUNK_W)));
                const cy = Math.max(0, Math.min(MAP_ROWS / CHUNK_H - 1, Math.floor(y / CHUNK_H)));
                return { cx, cy, key: cx + ',' + cy, id: TOWN_LAYOUT[cy][cx] };
            },
            getRegion(x, y) { const { cx } = this.getChunk(x, y); return this.REGIONS.find(r => cx >= r.cx[0] && cx <= r.cx[1]); },
            neighbors(cx, cy, rad = 1) {
                const keys = [];
                for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) keys.push((cx + dx) + ',' + (cy + dy));
                return keys;
            },
            register(entity, x, y) { const k = this.getChunk(x, y).key; if (!this.index.has(k)) this.index.set(k, []); this.index.get(k).push(entity); },
            at(x, y) { return (this.index.get(this.getChunk(x, y).key) || []).find(e => e.gx === x && e.gy === y); },
            updateActive(x, y) { const c = this.getChunk(x, y); this.active = new Set(this.neighbors(c.cx, c.cy)); },
            isActive(x, y) { return !this.active || this.active.has(this.getChunk(x, y).key); }
        };

