# Papercraft: flat paintings folded into 3D

The idea in one line: **the tile map is the blueprint, one painted sheet is the paint, and a prime number is the anchor.** The code folds the sheet along the map into real triangles, then draws them with a depth buffer. Nothing is modelled by hand; change a cell on the sheet and every wall of that kind changes.

## Where it lives
| What | File |
|---|---|
| The whole paper module: config, prime hash, sheet painter, folder, street painter, cottage, GLSL | `src/js/game/24-papercraft.js` |
| Blueprint (the town map and its legend) | `src/js/game/25-the-town-widened.js` |
| The GL hook that uploads and draws the mesh (`initPaper`, `drawPaper`) | `src/js/game/42-webgl-post-layer.js` |
| Standalone demo (runs the real module outside the game) | `papercraft/paper-demo.html`, made by `tools/make_papercraft_demo.py` |
| Cottage texture strip | `tools/make_cottage_tex.py` -> `assets/atlases/cottage-tex.webp` |

## Public surface (24-papercraft.js)
- `PAPER` config: `PRIME` (113), `GRID` (3 sheet px per world unit), `TILE` (16 x 6), `SIZE` (one cell 48 x 78 px), `HEIGHT` (storey 26 painted / 34 built, tree 56, fence 13), `mesh`, `sheet`, `verts`, `on`.
- `paperPrime(n)`, `paperInt(min,max,n)`, `paperChoose(array,n)`, `paperHash(a,b,c)`: deterministic numbers. Same prime + same n = same result, forever.
- `paperSheet()` -> a 1024 x 1024 canvas. Rows 0-6 wall materials (plain, window, door, upper plain / window / flowers, shop), row 7 roofs, row 8 props (tree, fence, lantern, stone, planter, bush, sign, wood, chimney, crown, water, awnings, goods), row 9 pieces cut from painted art, y >= 780 the cottage strip.
- `paperBuild()` -> `Float32Array` mesh. 7 floats per vertex: `x y z` (world px, z up), `u v` (sheet), `shade`, `glow`.
- `paperGroundStep(ms)` paints the street texture in slices so loading never stalls.
- `paperCottage(V)` an example of a hand-folded model that appends triangles to the mesh.
- `PAPER_GLSL.vert / .frag` the shaders; the fragment shader is the paper look.

## The algorithm (paperBuild)
1. **Classify tiles.** `paperKind(x,y)` turns each blueprint tile into a kind: house `h`, doorway `d`, town block `b`, tree line `t`, stall `s`, fountain `w`, or open ground.
2. **Cut solid areas into rectangles.** Scan row by row; grow each rectangle right (up to 8 wide for houses) then down (up to 4 deep). Each rectangle gets a storey count, a height, a wall material and a roof, all picked by `paperHash`/`paperChoose` from its position and the prime.
3. **Fold the walls.** For each solid tile and each of its four sides: if the neighbour is lower (or open), emit a wall quad from the neighbour's height up to this tile's height. One storey = one painted cell, however tall the storey is built (the cell is stretched). Ground floor chooses door / shop / window / plain; upper floors window / flowers / plain.
4. **Fold the roofs.** Over each rectangle: two sloped quads, gable ends cut into tile-wide strips so the wall texture keeps its size, sometimes a chimney box.
5. **Props.** Lamps, planters, avenue trees (two or three crossed cut-outs), signs, fences, market stalls (posts, counter, striped canvas), the eight-sided fountain.
6. **Every face is a quad**, split into two triangles, wound counter-clockwise seen from outside: bottom-left, bottom-right, top-right, top-left. `poly()` converts `[u 0..1, height in cell units]` into sheet UVs; `QUV` is the full cell.
7. **Return one buffer.** Upload once. Static for the life of the map.

Frame of reference: x east, y south (tile rows grow downward), z up. A south-facing wall runs left to right as x grows.

## How it is drawn (the illusion)
- One draw call, `gl.TRIANGLES`, depth test `LEQUAL`, back-face culling, sheet on texture unit 7 with `NEAREST` filtering (that is the PS1 crunch).
- Alpha key: sheet texels with alpha 179 are **glass**. At night the shader lights them from behind (`glow`), so windows burn without any extra geometry. Lanterns use `glow = 2`.
- **Cutaway instead of zoom:** anything between the lens and the hero is stippled away with a Bayer pattern in a soft ellipse round him, so the camera never needs to move in.
- Fog by view depth, lamp light from up to 8 lights (`uLW`), PS1 grade (desaturate, tint, 5-bit colour with Bayer dither, film grain, vignette) when `uGrade` is on.
- The game's vertex shader uses its own fixed-focal camera (`CINE`); the demo swaps in an ordinary orbit camera and keeps the same fragment shader.

## Reskin, reseed, extend
- **Reskin:** repaint a cell in `paperSheet()` (or draw your art into row 9 as `PAPER_PIECES` does). The folding does not change.
- **Reseed:** change `PAPER.PRIME`, set `PAPER.mesh = null; PAPER.sheet = null; PAPER.n = 0`, call `paperBuild()` again. The same blueprint reshuffles into a different, equally stable town. The game keeps 113.
- **A one-off model:** see `paperCottage`. Reserve a strip of the sheet, give each face its pixel rect, and emit quads/triangles with explicit UVs. Mirror a face by reversing its points and UVs.
- **Another project:** copy `24-papercraft.js` plus the `initPaper/drawPaper` logic (or just open the demo and read its harness: about 60 lines).

## Sprites folded into paper (in progress)
Goal: any sprite frame (hero, townsfolk, animals, props, the stalker) becomes a paper cut-out that stands in the depth-buffered world instead of a flat billboard.

**Step 1, the tracer** `tools/sprite_poly.py` -> `assets/papercraft/sprite-polys.json` (+ contact sheets in `papercraft/shots/trace-*.png`).
- Frame rects are read straight from the game's own tables (`FARM_ART.F`, `SUD_ART.F`, `HERO_FRAMES`), never copied by hand.
- Per sprite: alpha >= 128 (the module's own cut) -> grow 1 px -> fill diagonal-only pinches -> trace pixel edges into rings -> Douglas-Peucker (1 px) -> put corners back until every painted pixel is inside (`hold`) -> ear clipping, fattest ear first.
- Holes and specks under 12 px^2 are left to the shader's alpha cut (`discard` below 0.5): the polygon only has to hold the paint, the alpha keeps the edge pixel-exact.
- JSON per sprite: `rect` [x,y,w,h] on its atlas, `anchor` [ax,ay] where it stands, `pts` flat integer sprite px (y down), `rings` point count per outline, `tris` flat index triples (counter-clockwise as the picture is seen), `ein` the nearest painted pixel to each point (the edge ribbon samples it).
- Checks printed on every run: cover (share of painted pixels inside the cut, must be 1.0), air (cut area / painted area), and the `seal`, a hash salted with the prime 113. Same art in, same seal out.
- First run: 424 sprites, ~21.5k vertices, cover 1.0000, air 1.14 on average, re-run byte-identical.

## Gotchas we hit
- `//` comments inserted mid-line swallow the rest of the line in a minified or joined file; use `/* */`.
- Inside-out faces mean the winding is mirrored: check `frontFace` before touching the geometry.
- A shared uniform name between two programs clashed (`uZ0` vs `uZc`); keep per-program names distinct.
- Cottage-sized textures do not fit a 48 x 78 cell; give them their own strip of the sheet and use explicit UVs.
