# Changelog
- 2.90 (not yet published) Sudashorn's own sprite sheet: stands, runs, twirls round when you talk.
- 2.89 Cottage film behind the BOSOM title card.
- 2.88 New game starts in the farmhouse at night; dialogue on a side page; townsfolk at Koto's size; the Tall One stalker and the nerve bar.
- 2.87 Pieces from the painted asset sheet blended sparingly into the town.
- 2.86 Buildings 3-6 storeys; prime-113 paper config.
- 2.85 Code cleanup (dead code, unused variables).
- 2.84 Koto's story as the opening crawl; great-grandmother's scroll in the basement.
- 2.83 Character voices, night patrol, Sudashorn keeps the farm while you patrol.
- 2.82 Wide town and market square with fountain; steady camera; townsfolk schedules; hooded neighbours.
- 2.81 Brennan's Theme folded into real 3D (papercraft).

## 2.91
- Title card: removed "2027"; tiny "© Yules" lower right.
- B button: guarded (cannot throw to the error screen); tested with every tool (axe, torch, lens, staff, sword, rope, none).

## 2.92
- The opening-film cottage is Koto's house (new homestead footprint, door at 23,17).
- Walkable farmhouse interior (zone "farmhouse"): stove (kitchen), bed (sleep), table (pantry), shelves, trapdoor (basement + scroll), rug. [A] on things replaces the menu. New games start inside.
- Dialogue panel: plain dark side panel (the book look is gone).
- Cottage model sheet saved in art-source/models/cottage.

## 2.93
- The cottage is now a real folded 3D house in the paper-model style (front/back gables, wings, hip roofs, shed, chimney), textured from the orthographic sheet (tools/make_cottage_tex.py -> assets/atlases/cottage-tex.webp, drawn into the paper sheet at y=780). The flat cutout remains as the fallback for the flat camera.
- Collision follows the new footprint (house body + shed).
- build.py strips Content Credentials (C2PA) blocks from webp assets (metadata only).

## 2.94
- Brighter nights (outdoor ambient 0.32 -> 0.42; farmhouse interior 0.5).
- Papercraft isolated: 24-papercraft.js is now only the paper module (config, prime hash, sheet, folder, street painter, cottage, shaders as PAPER_GLSL); the world-state code that shared the file moved to 24b-world-state.js.
- docs/PAPERCRAFT.md explains the concept and algorithm; papercraft/paper-demo.html runs the real module on its own (tools/make_papercraft_demo.py).

## 2.95 — The paper hero
- New `src/js/game/24c-paper-hero.js`: a small glTF player for Papercraft exports (one node per body part, looping clips). It reads `assets/models/paper-hero.glb` from the page, poses it every frame and draws it through the paper shader, so the hero stands in the folded town as real geometry with depth, fog, night grading and the cutaway.
- Plays Idle (arms lowered from the export's T-pose), Walk (faster when running), Jump, Swing (sword/axe). Side views turn 3/4 toward the lens so the flat figure never shows as a sliver.
- Horse, pouch and roll still use the flat sprite; held tools are not drawn on the paper hero yet. Combat and every non-town zone are unchanged.
- `build.py` packs `.glb` files as data URIs.

## 2.96 — Koto as the paper hero
- `assets/models/paper-hero.glb` is now Koto (Papercraft export IMG_7918): blue gi, red sash, wrapped arms and shins, barefoot, his hair on the back.
- The player measures each export's rest height and scales it to stand 25 px tall with his feet on the ground (this export is 0.77 m, not the 1 m its README says).
- The arm-lowering for T-pose exports only applies when the export really is a T-pose; Koto's own Idle plays as made.
- Sources kept in `art-source/models/paper-hero/` (both exports and the front-view sheet).

## 2.97 — Crash guard, security roster, view modes, paper hero tools
- **Crash guard** (`46-crash-guard.js`). The movement crash didn't reproduce on desktop: no script errors and no memory growth over long walks with every outfit. So the likely cause is the phone itself:
  - If the phone takes the GPU back (WebGL context lost), the game drops to the 2D view instead of freezing, and says so.
  - Every 2 s the game notes where Koto is. If the phone closes the page, the next start shows what was happening (map, tile, walking or standing, paper hero, 3D).
  - A watchdog reports if the frame loop stops for 5 s while the page is on screen.
- **Security roster** (`29b-security-roster.js`). You play Koto only. Rahjai, Kael, Basic Standard, Starter and the Child are logged in `HIRE_ROSTER` as hireable city security, with wage, shift, beat and notes. The outfit card and the gear list show them as FOR HIRE. Live patrolling is the next step.
- **Camera button** next to the lens (key G) cycles three views:
  - NORMAL.
  - FIRST PERSON: the lens sits in Koto's head and turns with him.
  - INSPECT: a see-through shadow circle walks instead of Koto (within 7 tiles of him). A readout shows the tile, whether it's solid, and any door, person, wolf, building, horse or Koto there.
- **Paper hero:**
  - The sword and axe are held in his fist as crossed paper cards from the hero atlas, so they follow the arm through Swing.
  - The roll is a real forward tumble.
  - In the pouch, his hands come forward and his head bows.
  - Riding still uses the flat sprite: the horse has no paper model yet.
- Paper hero posing reuses its buffers (no per-frame garbage), and the GPU buffer is refilled in place.
- Site fix: the build now also writes the playable game to the repo root (index.html, sw.js, manifest, icons), which is what GitHub Pages (scaramangion.github.io/Bosom/) serves. The game's service worker now leaves the other pages on the site alone (papercraft/, docs).

## 2.98 — Street level (direction art 03)
- Direction art saved in `art-source/direction/`: the stable door and horse, Koto in rags with a sword, and the street-level town.
- STREET camera: in the paper town, the everyday view sits low and close behind Koto, as in the direction art (`STREET` in `47-view-modes.js`: z0 70, mag 2.0, horizon 20). The right stick's zoom still nudges it. Anything standing between the lens and him (grass, props) is left out so the view stays clear.
- Tile spacing: the street is laid in cobbles at street scale (about a fifth of his height). They're blue-grey, rounded, slightly uneven, set in dark joints with moss, with wet patches and a glint on wet crowns. The market square uses slightly larger stones of the same kind instead of big flagstones.
- The axe in his hand is a little shorter (9 px).

## 2.99 — Memory diet (the crash report from the phone)
- The crash guard caught it: the phone closed the page for memory while Koto stood in town (23,21). Memory now:
  - The old desert town photo is no longer decoded when the paper town is on. A plain stand-in shows while the street is painted.
  - The town has no photo "beyond the edge" previews, which kept the 704x1974 wastes photo in memory. The neighbour picture is freed when it isn't needed.
  - Only the photo in use stays decoded, and the painted floors of other zones are dropped on leaving. The trail floor alone was 11 MB.
  - The town's street lives in its own GPU texture, so its 7 MB canvas is freed once uploaded. The shared picture slot is emptied while in town.
  - The paper sheet canvas (4 MB) is freed once it's on the GPU.
  - Phones draw the 3D layer at 720x648 at most, instead of 960x864.
- Measured in a desktop browser at the crash spot, GPU textures dropped from about 41 MB to 30 MB, plus the freed canvases and decoded photos.

## 3.00 — Near-only cards, one card atlas, lint clean
- A trace while walking found no growing JavaScript memory. But every standing card stayed in memory for good: 53 farmhouse wall cards were still held in town. Moving things also re-allocated a GPU texture for each card, every frame (about 28 per frame).
- Keep only what's near (as Minecraft loads and unloads chunks): a static card nobody has drawn for 12 s frees its canvas and texture, and is redrawn if it comes back into view. In the test, 85 cached cards dropped to 19 once the farmhouse was behind him.
- One texture atlas for moving things (as Minecraft's terrain sheet does): a single 1024x1024 texture allocated once, each card copied into its own slot. No per-card allocation.
- Lint: the last two unused variables (papercraft module) removed. The lint check now reports nothing.
