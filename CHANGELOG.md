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
