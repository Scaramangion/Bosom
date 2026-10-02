# Papercraft: flat paintings folded into 3D

The idea in one line: **the tile map is the blueprint, one painted sheet is the paint, and a prime number is the anchor.** The code folds the sheet along the map into real triangles, then draws them with a depth buffer. Nothing is modelled by hand; change a cell on the sheet and every wall of that kind changes.

## Where it lives
| What | File |
|---|---|
| The whole paper module: config, prime hash, sheet painter, folder, street painter, cottage, GLSL | `src/js/game/24-papercraft.js` |
| Blueprint (the town map and its legend) | `src/js/game/25-the-town-widened.js` |
| The GL hook that uploads and draws the mesh (`initPaper`, `drawPaper`) | `src/js/game/42-webgl-post-layer.js` |
| Standalone demo (runs the real module outside the game) | `papercraft/paper-demo.html`, made by `tools/make_papercraft_demo.py` |
| Sprite outlines (traced) | `tools/sprite_poly.py` -> `assets/papercraft/sprite-polys.json` |
| Sprite viewer (the real module folding the traced sprites) | `papercraft/sprite-viewer.html`, made by `tools/make_sprite_viewer.py`; screenshots by `tools/shoot_sprite_viewer.js` |
| Cottage texture strip | `tools/make_cottage_tex.py` -> `assets/atlases/cottage-tex.webp` |

## Public surface (24-papercraft.js)
- `PAPER` config: `PRIME` (113), `GRID` (3 sheet px per world unit), `TILE` (16 x 6), `SIZE` (one cell 48 x 78 px), `HEIGHT` (storey 26 painted / 34 built, tree 56, fence 13), `mesh`, `sheet`, `verts`, `on`.
- `paperPrime(n)`, `paperInt(min,max,n)`, `paperChoose(array,n)`, `paperHash(a,b,c)`: deterministic numbers. Same prime + same n = same result, forever.
- `paperSheet()` -> a 1024 x 1024 canvas. Rows 0-6 wall materials (plain, window, door, upper plain / window / flowers, shop), row 7 roofs, row 8 props (tree, fence, lantern, stone, planter, bush, sign, wood, chimney, crown, water, awnings, goods), row 9 pieces cut from painted art, y >= 780 the cottage strip.
- `paperBuild()` -> `Float32Array` mesh. 7 floats per vertex: `x y z` (world px, z up), `u v` (sheet), `shade`, `glow`.
- `paperGroundStep(ms)` paints the street texture in slices so loading never stalls.
- `paperCottage(V)` an example of a hand-folded model that appends triangles to the mesh.
- `paperSubject(px, w, h, o)` finds the subject of a photo (GrabCut: learned colour models + `paperMaxflow`, a Boykov-Kolmogorov minimum cut); `paperCutout` uses it for photos.
- `paperCutout(img, o)` any picture -> a clean cut-out (shrunk, background keyed out, tap-to-erase seeds); `paperTrace(px, W, rect, o)` the tracer in the browser; `paperFlood` the flood fill they share.
- `paperPuff(V, px, W, H, rect, o)` puffs a picture into a rounded, closed shape (the Round option); see step 7.
- `paperFitView(front, w, h, view, vw, vh, o)` lays another view of the figure (a back view) onto the front's pixels; `paperGuessBack(px, w, h, head)` guesses a back when there is none. `paperPuff` / `paperSprite` take `o.backDU` so the back side samples a back laid out beside the front.
- `paperFitSide(front, w, h, view, vw, vh, o)` lays a side view onto the front's rows (height, feet, facing) and reads its depth per row; `paperPuff` takes `o.depthRow` (forward / back depth per row), `o.sideUV` (paint steep faces from the side view) and `o.field` (shape a part from the whole figure).
- `paperRig(px, W, rect, o)` finds a standing figure's rig (head, torso, arms, legs, pivots) in its cut-out; see step 10.
- `paperSprite(V, S, A, o)` folds one traced sprite into a standing card and appends it to `V` (see below).
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

**Step 2, the fold** `paperSprite(V, S, A, o)` in `24-papercraft.js`.
- `S` one sprite record from the JSON, `A` its atlas size (UVs are for the sprite's own atlas texture, not the paper sheet, so it draws with that texture bound).
- `o`: `x, y` where it stands (world px), `ang` the way the front faces (0 = south, +y), `s` world units per sprite px (a 24-tall villager from an 85 px frame: `s = 24 / 85`), `thick` card thickness in world units (0 = paper-thin), `flip`, `shade` [front, back, edge] (default 1, 0.62, 0.74), `glow`.
- Front: the sprite as painted. Back: the same paint seen through (so mirrored) and darker. Edge (only when `thick > 0`): one strip per outline segment, flat-coloured from that point's nearest painted pixel, so the card's rim takes the sprite's own outline colour.
- Winding is decided per triangle against its outward normal (in this left-handed world a front face has (B-A)x(C-A) pointing *into* it), so flips and turns can never turn a card inside out.
- Check: `node tools/check_paper_sprites.js` folds all 424 sprites twice (plain; mirrored and turned) and demands closed, consistently wound shells. GREEN.

**Step 3, the viewer** `papercraft/sprite-viewer.html` (rebuild: `python3 tools/make_sprite_viewer.py`). The module verbatim, the JSON verbatim, the atlases embedded; same fragment shader as the game. "The cast" stands the townsfolk, Sudashorn, Koto, the animals and a few props on a plaza (turns and mirrors nudged by `paperPrime`), the tall one at the back; "one sprite" shows any frame. Thickness slider, wireframe, spin, PS1 look. URL options for screenshots: `?s=farm/f_elder&mode=one&t=1.5&wire=1&ps1=0&yaw=0.6&pitch=0.35&spin=0`. `node tools/shoot_sprite_viewer.js` takes the screenshots in `papercraft/shots/viewer-*.png` and goes RED on any page error.

**The end goal: any image -> a polygon, on your phone.**

**Step 4, the tracer in the browser** `paperTrace(px, W, rect, o)`: the same cut as `tools/sprite_poly.py`, step for step, returning the same record `paperSprite` folds. Check: `node tools/check_paper_trace.js` traces all 424 sprites with both and demands identical polygons. GREEN, 1.3 s for the lot.

**Step 5, any picture** `paperCutout(img, o)` then `paperTrace` then `paperSprite`, all on the device:
- Shrinks the picture so its long side is `o.max` px (96 / 160 / 256; an area average done in code, not by the browser, so every device gets the same pixels).
- A picture with its own transparency keeps it. Any other picture has its background keyed out: a flood fill from the border through pixels within `o.tol` of the border's median colour.
- Tap to erase (`o.seeds`): each tap floods from that spot while the colour changes smoothly (each step within 0.4 tol, all within 3 tol of the tapped colour), so a shaded backdrop goes in a tap or two.
- `o.one` keeps only the biggest piece (a pair of characters -> the bigger one; stray specks dropped).
- In the viewer: **+ picture** (camera or gallery on a phone), a detail picker, a background slider, "one piece", and the cut-out preview in the corner: tap it to open it big, tap the background to erase, "undo erase". Pinch to zoom.
- Speed: about 60 ms to cut and trace a 1112 x 960 picture at detail 160 (desktop Chromium).
- Check: `node tools/shoot_upload.js` uploads a sprite with alpha, a dagger on black, a pair on white and a character on a vignetted backdrop at phone size, taps to erase, and goes RED on any page error or picture that fails to fold. GREEN. Shots: `papercraft/shots/phone-*.png`.
- Limits today: busy photographic backgrounds need taps (or, later, a cut-out model); holes in the subject are left to the alpha cut, so a thick card's rim does not run round them.

**Step 6, the phone app look (Apple-style simplicity)** and the fixes your first real test showed:
- One screen: a calm studio stage (floor and dome drawn with the same paper shader, so they meet without a seam; it follows light / dark mode), a first-run card with one button (**Choose Photo**), and one bottom bar with four tools: **Photo, Erase, Depth, Look**. Everything else lives in one **Options** sheet (Detail, Background removal, Keep one piece, Turn slowly, Wireframe, the Saga of Koto examples, and the numbers). Double-tap the stage to reset the view.
- **Erase** turns the model to face you; tap the background *on the model itself* (a ray from the tap to the card's face finds the pixel) and it is keyed out from there. Undo / Done.
- **Look**: Clean (studio) or PS1 (the game's grade and flagstones).
- Background key now uses the border's palette (up to six colours), so grid paper, checks and patterns come out, not just plain backdrops. Your spear-girl on grid paper folded as a plain rectangle because the grid lines survived and "one piece" joined them up; fixed (`tools/fixtures/grid-paper.jpg` is the test).
- "Keep one piece" keeps one subject: the biggest piece plus any piece within ~2% of the picture's size of it (a handle split off by a dark seam comes along; a second figure standing apart does not).
- Your picture stands on its lowest painted pixel, not on the bottom of the frame.
- Checks: `node tools/check_cutout.js` (cut-outs contact sheet, `papercraft/shots/cutouts.png`), `node tools/shoot_upload.js` (phone-size: start, five pictures, Erase by tapping the model, Options, dark mode). GREEN.

**Step 7, Round: from a cut-out slab to a volume** `paperPuff(V, px, W, H, rect, o)`.
Extruding the outline (the card) gives every part the same thickness: arms as deep as the chest, flat striped sides. Round inflates the picture instead, like a pillow sewn round its outline:
- A chamfer distance field (3-4) gives every painted pixel its distance to the air. A grid (about 56 cells across) covers the painted cells; each corner is raised by a quarter-circle of its distance (minus a seam band), so the fullest point gets `o.depth` and thin parts stay slim and round.
- Front and back are the same grid, mirrored through the picture plane; they meet on a flat seam round the edge, so the shell is closed. The alpha cut keeps the outline pixel-exact.
- Gouraud shading per corner from a light high on the left (the PS1 way); the back is lit from behind and dimmer.
- Check: `node tools/check_paper_puff.js` puffs all 424 sprites twice (plain; mirrored and turned): every edge balanced by edges running the other way (on the seam, front and back sheets coincide), wound inward. GREEN.
- Viewer: Depth has **Card / Round** (Round by default) and a Thin-Full slider. The cut-out also loses the 1 px fringe the background key leaves, which was where the grey stripes on card edges came from.
- Planar projection, as on the card: seen from the side the paint stretches over the curve. Fine for PS1; a later step could paint the sides.

**Step 8, the subject, not the backdrop** (photos of people, busy backgrounds).
- `paperCutout` now decides per picture: its own transparency -> kept; a plain backdrop (the border's main colours cover 85% of it) -> the pixel-exact colour key; anything else is a photo -> `paperSubject`.
- `paperSubject` is GrabCut: two colour models (5 Gaussians each) for subject and backdrop, a first guess (a box in the middle; the top and sides of the frame are backdrop, the bottom is left open for feet), then four rounds of: the exact best split of the pixels (a minimum graph cut, `paperMaxflow`, Boykov-Kolmogorov) where each pixel pays for the model it is given and neighbours pay to be split (a lot across flat colour, little across an edge), and both models re-learned from the split. The piece kept is the one your Keep taps touch, else the biggest piece in the middle of the frame; small holes fill in.
- On scikit-image's sample photos it matches OpenCV's GrabCut on the cat, the coffee and the rocket (94-99% of pixels agree), keeps the whole astronaut where OpenCV cuts her arm away, and is cleaner on grid paper. About 0.5-2 s for a 256 px picture in Node; the viewer says "Finding the subject..." meanwhile.
- **Cut** replaces Erase: the whole picture lies flat facing you (what is removed shown dark and grey), **Keep** / **Remove**, tap on the picture itself; each tap is a hard label for the cut (Keep also switches a keyed picture to the learned cut). Undo, Done.
- Options: Cut-out (Auto / Backdrop / Photo), Backdrop tolerance.
- No neural network: the downloads for one are blocked from this workspace, and this runs offline and gives the same cut every time. A person-segmentation model could be added later as a first guess for `paperSubject` (its `o.init`).
- Check: `node tools/shoot_upload.js` now also folds a photo (`tools/fixtures/photo-astronaut.jpg`) and uses Cut with Keep / Remove taps. GREEN.

**Step 9, Save** (the download icon, top right). Inside Claude the page offers files through the viewer's own save (you confirm each one); opened anywhere else it is a normal download. Allowed file types there are zip, png and json among others (not glb or obj on their own), so:
- **3D model** (`name-papercraft.zip`): `name.glb` (glTF 2.0 binary: unlit, the texture embedded with its alpha cut, the paper shading as vertex colours, 1 m tall, y up, front toward +z; our world's x east / y south / z up maps to (x, z, y), which also turns left-handed into right-handed) and `name.obj` + `.mtl` + `.png` for apps that prefer OBJ, and a README.
- **Cut-out picture** (`name.png`): the cut's mask scaled up smoothly onto the original photo (up to 2048 px), hard-edged, trimmed to the subject. For character sheets and game assets.
- **Papercraft file** (`name.papercraft.json`): the cut-out picture (PNG, data URI), the outline record (`rect, anchor, pts, rings, tris, ein`, the format `paperSprite` folds), shape and depth. Choose it with Photo to open it again.
- Check: `tools/shoot_upload.js` saves all three; `python3 tools/check_export.py` validates the .glb by hand (header, chunks, views, accessors, PNG), checks the .obj matches it and the faces wind outward, and renders the .glb with its own small rasteriser from the front and the side (`papercraft/shots/export/render.png`). GREEN.

**Step 10, the rig: parts that move** (Paper Mario's flaps, Minecraft's limbs). `paperRig(px, W, rect)`:
- Read from the silhouette: the **neck** is the row narrowest compared with the widest row above it (hair often hides it, so a slight narrowing counts); the **hips** are where the legs part (air under the middle, found from the feet up); the **arms** are what lies outside the torso's own width, taken from rows where arm and body show a gap, else from the chest. Arm pixels must hang from the shoulder (a flood from the upper torso); the rest goes back to the torso or a leg. Sanity: hips well below the neck and above the feet, else one piece.
- Six parts (torso, head, armL, armR, legL, legR; L is the picture's left), each with a pivot (hips, neck, shoulders, hip joints) and a direction (0 = hanging straight down). Each limb reaches a few px into the torso, so a joint never opens a hole. Anything else (a side view, a dagger) is one piece that can still bob and sway.
- Tested on Koto's art: the starter outfit and the girl split cleanly; the caped outfit splits with the cape shared between arms and torso; the side view stays one piece.
- Viewer: **Pose** tool. **Still / Idle / Walk / Wave**; drag an arm, a leg or the head to turn it in the picture's plane (the joints show as dots); Reset. Walk swings legs and arms forward and back about the hips and shoulders (out-stretched arms first come down to hang); Wave raises the picture's right arm. Each part is its own puff (one shared fullest point, so limbs come out slimmer than the body) or card, cut from a texture where the parts are laid out one under another.
- Save: the .glb is now a **rigged model**: a node per part at its pivot (children of the torso, which is a child of the figure), its mesh around that pivot, and **Idle (4 s), Walk (0.9 s), Wave (1.4 s)** as looping animations (rotation keys at 24 fps, the torso's bob as translation). A turn in the picture's plane is a rotation about +z, a swing a rotation about -x (glTF axes). The .obj is the rest pose with one group per part.
- Checks: `node tools/shoot_rig.js` (phone size: rigs two characters, shoots Idle, a Walk strip, Wave, drags an arm and checks it turned; saves the rigged model); `python3 tools/check_export.py papercraft/shots/export-rig` walks the glTF node tree itself, plays Walk from the file's own keys (the feet part front to back) and Wave (the arm rises) and draws them. GREEN.

**Step 11a, the back.** A card or a puff used to show its front again from behind (mirrored, darker). Now the back has paint of its own:
- **Picture**: choose a back view of the same figure (an orthographic sheet's BACK panel). It is cut out like any picture, then `paperFitView` lays it onto the front's own pixels: matched in height, feet together, centred, mirrored left-right (seen from behind, the figure's right is on the picture's left). Where the back view has no paint inside the front's outline, the guess fills in. Koto's own four-view sheet (`tools/fixtures/koto-*.png`): 94% of the front matched by his back view; hair, cape and the sword on his back show from behind.
- **Guess** (the default for a figure with a rig): `paperGuessBack` covers the head with the crown's own hair texture, repeated down, and keeps the body's colours with the small details (eyes, buttons, buckles) smoothed away.
- **Mirror**: the old look.
- Texture: every rig part is one row, front on the left half, back on the right; the back side of a puff or card samples the right half (`o.backDU = 0.5`). The rig, the animations and Save carry it (the saved .glb's texture holds both).
- Viewer: **Views** tool: Back = Mirror / Guess / Picture, and Turn (to look at the back). Check: `node tools/shoot_views.js` (phone size: mirrored, guessed and fitted backs, then saves; `check_export.py papercraft/shots/export-views`). GREEN.

**Step 11b, the side.** Choose a side view (an orthographic sheet's LEFT or RIGHT panel):
- `paperFitSide` cuts it out, matches it to the front's rows (height, feet together), and turns it to face right if it faces left. Which way it faces is read from the picture: the toes point forward and a cape trails behind (Koto's LEFT VIEW: facing right, found). Flip overrides it.
- **Depth**: the front's picture plane is the side view's middle (the mean column of its torso band); at every height the outline says how far the figure reaches forward and back, and `paperPuff` (`o.depthRow`) puffs the front and the back sides that far. The Depth slider scales it (the middle of the slider is the side view's own depth). A big head of hair, a belly, a cape or a backpack get their real depth.
- **Paint**: a steep face of the puff (one that faces sideways) samples the side view (`o.sideUV`): its depth picks the column, its height the row. The side panel is filled out sideways so a side face never samples air. The texture is now front | back | side per row of parts.
- Rig parts are shaped from the whole figure (`o.field`), so the body is continuous through the neck, shoulders and hips (no seam that pinches to nothing), and torso and limbs overlap both ways at every joint, so turning a limb never opens a hole.
- Viewer: **Views** tool: Side = Round / Picture (+ Flip). Check: `node tools/shoot_views.js` now also fits Koto's side view and shoots him from both sides and both three-quarters, then saves him (front, back and side in one texture, rigged). GREEN.

**Step 12a, a view for each side.** Other side adds the opposite side view: a view that faces left shows the figure's east (+x) side, one that faces right its west side, and each side of the puff is painted from its own (`o.sideUV(x, y, depth, east)`); the depth comes from both outlines averaged. With one side view, both sides use it. Koto's LEFT and RIGHT views land on the right sides by themselves. Checked in `tools/shoot_views.js`.

**Next:** rig the game's own sprites and the cast the same way; give arms an elbow and legs a knee (two-bone limbs); let you nudge a joint if the guess is off; walk in the town demo. (the polygon + its cut-out as one file, and a .glb so it opens in other 3D apps); make the viewer an installable phone app (it is already one self-contained page); then the cast in the town demo, layer stacks, hinges and the Heads system.

**Later:** fold the cast into the town demo beside the town mesh (and into the game in place of `asCard` for standing poses), the layer stack (cloak, arm, head) for parallax, hinge folds for cloaks and banners, and the Heads system (headless body + head docking at a neck hinge). Walk cycles can swap frames on the same card: each frame is its own outline, so rebuild just that card's slice of the buffer.

## Gotchas we hit
- `//` comments inserted mid-line swallow the rest of the line in a minified or joined file; use `/* */`.
- Inside-out faces mean the winding is mirrored: check `frontFace` before touching the geometry.
- The orbit cameras in the demos used to show the world mirrored (east on the left): in this left-handed world (x east, y south, z up) the camera's right is up x forward and its up is forward x right. Fixed in both demos; with no mirror, faces wind counter-clockwise as seen from outside, as documented, so `frontFace(gl.CCW)`.
- A shared uniform name between two programs clashed (`uZ0` vs `uZc`); keep per-program names distinct.
- Cottage-sized textures do not fit a 48 x 78 cell; give them their own strip of the sheet and use explicit UVs.
