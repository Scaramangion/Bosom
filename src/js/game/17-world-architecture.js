        // ================= WORLD ARCHITECTURE (data only; no rendering/simulation in here) =================
        // 1) TILE MATRIX: the world is plain numeric arrays.  2) CHUNKS: MAP_DATA above is the west-half source of truth,
        // cut into CHUNK_W x CHUNK_H squares.  3) LAYOUT: the town is a table of chunk IDs; a trailing X/Y means
        // "mirror this source chunk", so the east half stores no tile data of its own.
        const CHUNK_W = 10, CHUNK_H = 8;
        const WORLD_RULES = { mirrorReplace: { 8: 0 }, seamCol: 29 }; // gems are not duplicated; seam opens where floor meets floor
        const CHUNKS = {};
        for (let cy = 0; cy < MAP_ROWS / CHUNK_H; cy++) for (let cx = 0; cx < 3; cx++)
            CHUNKS['t' + cx + cy] = MAP_DATA.slice(cy * CHUNK_H, (cy + 1) * CHUNK_H).map(row => row.slice(cx * CHUNK_W, (cx + 1) * CHUNK_W));
        for (let cy = 0; cy < 3; cy++) CHUNKS['e' + cy] = Array.from({ length: CHUNK_H }, (_, y) => Array(CHUNK_W).fill(cy === 2 && y >= 1 && y <= 3 ? 0 : 0).map((t, x) => (cy === 2 && y >= 1 && y <= 3 && x === 9 ? 16 : 0))); // east camp: exit road to the Wastes at (69, 17-19)
        const mirrorRow = ids => ids.concat(ids.slice().reverse().map(id => id + 'X'));
        const TOWN_LAYOUT = [['t00', 't10', 't20', 'e0'], ['t01', 't11', 't21', 'e1'], ['t02', 't12', 't22', 'e2']].map(r => { const m = mirrorRow(r.slice(0, 3)); m.push(r[3]); return m; });

        function getChunkRows(id) { // chunk lookup: source square + mirror flags -> tile rows
            let rows = CHUNKS[id.replace(/[XY]+$/, '')].map(r => r.slice());
            if (id.endsWith('X')) rows = rows.map(r => r.reverse().map(t => WORLD_RULES.mirrorReplace[t] ?? t));
            if (id.includes('Y')) rows.reverse();
            return rows;
        }
        function assembleWorld(layout) {
            const rows = [];
            layout.forEach(chunkRow => {
                const parts = chunkRow.map(getChunkRows);
                for (let y = 0; y < CHUNK_H; y++) rows.push([].concat(...parts.map(p => p[y])));
            });
            const sc = WORLD_RULES.seamCol;
            rows.forEach((row, r) => { if (r > 0 && r < rows.length - 1 && row[sc - 1] === 0) { row[sc] = 0; row[sc + 1] = 0; } });
            return rows;
        }
        (function buildTown() { const town = assembleWorld(TOWN_LAYOUT); MAP_DATA.length = 0; town.forEach(r => MAP_DATA.push(r)); })();

                // ================= INVISIBLE BUMPERS: collision painted over the background art =================
        // The photoreal background supplies the boulders, cliffs, pond and posts. These tiles (id 15) are drawn as nothing
        // but block movement, so you can't walk over a picture of a rock. Rects are inclusive [col0,row0,col1,row1].
        const TILE_BUMPER = 15;
        const BUMPER_RECTS = [[12,13,19,16],[20,13,20,14],[22,9,22,9],[22,14,22,15],[16,12,21,12],[60,8,60,11],[63,4,63,6],[60,2,65,6],[65,0,69,1],[62,7,65,7],[68,9,69,15],[67,2,69,5],[68,6,68,7],[64,11,67,13],[62,11,63,11],[60,13,61,14],[62,14,67,14],[60,18,61,22],[60,16,60,17],[61,19,62,19],[63,20,68,21],[68,20,69,23],[0,0,9,13],[9,6,12,8],[10,2,11,3],[0,16,4,23],[5,20,8,23],[16,0,29,1],[16,2,17,5],[24,3,24,6],[16,8,21,9],[24,7,25,7],[26,8,26,8],[27,9,27,9],[16,18,17,18],[25,18,26,18],[15,22,17,23],[36,5,36,8],[45,0,46,2],[33,8,33,9],[36,9,37,9],[46,9,55,10],[53,6,57,9],[52,0,59,1],[55,2,59,6],[56,13,58,14],[46,17,49,19],[53,19,59,23],[51,20,52,23],[49,22,50,23],[39,22,40,23],[43,22,46,23]];
        const BUMPER_CLEAR = []; // no carved gaps needed: with the west shop hidden every door, sign, gem and trail is reachable on its own
        const GEM_SPOTS = [[17, 10], [23, 17], [7, 14], [6, 19], [22, 8], [20, 18], [12, 11], [24, 15], [40, 14], [49, 14], [62, 16], [41, 20]]; // the 12 power crystals (the HUD and shop talk say 12); chosen on open, reachable ground away from cliffs and water
        const REMOVE_TILES = [[6, 3], [2, 5], [57, 5], [10, 17], [11, 17]]; // plateau signs that only made sense next to the old west shop, plus a two-tile gap in the south fence so you can walk all the way around the pond
        const SIGN_TEXTS = {
            default: '',
            '6,3': "TIGER EMPORIUM \u2014 Potions & gear. Ring the bell if the counter's empty.",
            '14,10': 'TOWN NOTICE: Wolves sighted near the hollow after dark. Travel in pairs.'
        }; // sign text by 'x,y' (east half uses its mirrored west coordinates); empty means the sign says nothing for now
        const SHOW_BUMPERS = location.hash.includes('bumpers'); // add #bumpers to the URL to see them in red
        (function applyBumpers() {
            for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) {
                const t = MAP_DATA[r][c];
                if (t === 1 || t === 2 || t === 6) MAP_DATA[r][c] = 0; // the old visible walls, trees and water are gone
                if ((r === 0 || c === 0 || r === MAP_ROWS - 1 || c === MAP_COLS - 1) && MAP_DATA[r][c] !== 14 && MAP_DATA[r][c] !== 16) MAP_DATA[r][c] = TILE_BUMPER; // level edge (trail entrance 14 and road exit 16 stay)
            }
            for (let r = 1; r <= 3; r++) for (let c = 7; c <= 10; c++) if (MAP_DATA[r][c] === 3 || MAP_DATA[r][c] === 4) MAP_DATA[r][c] = TILE_BUMPER; // west Tiger Emporium is hidden: the east one is the real shop
            MAP_DATA[4][7] = TILE_BUMPER;
            REMOVE_TILES.forEach(([c, r]) => { MAP_DATA[r][c] = 0; });
            MAP_DATA.forEach(row => row.forEach((t, c) => { if (t === 8) row[c] = 0; })); // old gem tiles go first, so bumpers cover the ground they sat on
            BUMPER_RECTS.forEach(([c0, r0, c1, r1]) => {
                for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (MAP_DATA[r][c] === 0) MAP_DATA[r][c] = TILE_BUMPER;
            });
            BUMPER_CLEAR.forEach(([c, r]) => { MAP_DATA[r][c] = 0; });
            GEM_SPOTS.forEach(([c, r]) => { if (MAP_DATA[r][c] === 0) MAP_DATA[r][c] = 8; });
        })();

