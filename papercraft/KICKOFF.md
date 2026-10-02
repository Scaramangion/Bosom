# Papercraft: kickoff for its own conversation

Paste the "Opening message" below into a new chat, with this project (or the GitHub repo Scaramangion/Bosom) attached.

## Opening message
I'm building **Papercraft**, a small engine that folds flat painted pictures into real 3D (PS1 paper-model look). It started inside my game Saga of Koto / BOSOM and is now isolated. Read `docs/PAPERCRAFT.md`, then open `papercraft/paper-demo.html` and `src/js/game/24-papercraft.js` (the real module the demo runs). The new goal: **make polygons straight from sprites**. Take any sprite (hero, townsfolk, animals, props, the stalker), trace its alpha silhouette into a simplified polygon, and fold it into a paper-thin or slightly thick 3D piece with the sprite on the front (and a flipped or darkened copy on the back), so characters and props stand in the depth-buffered paper world instead of being flat billboards. Keep it deterministic (the prime, 113, is the anchor), keep the PS1 look (NEAREST sampling, Bayer dither), and keep it standalone and reusable. Work slow and steady, one step at a time, and save/commit after every breakthrough.

## What already exists
- `PAPER` config, prime hash (`paperPrime/paperInt/paperChoose/paperHash`), the 1024x1024 sheet (`paperSheet`), the folder (`paperBuild`), the street painter, the cottage as a hand-folded example (`paperCottage`, explicit UV rects), the shaders (`PAPER_GLSL`).
- Mesh format: 7 floats per vertex (x y z, u v, shade, glow); x east, y south, z up; faces wound counter-clockwise seen from outside.
- The game draws it with its own camera; the demo draws the same mesh with an orbit camera.
- Characters are currently billboards ("standing cards", `asCard`) cut from atlases (`hero-atlas`, `farm-atlas`, `sud-atlas`); frames are known rects, so a sprite is already a rect on a sheet.

## Ideas to start from
1. **Alpha-contour tracer** (marching squares) -> simplify (Douglas-Peucker) -> triangulate (ear clipping) -> UVs straight from the sprite rect. Offline tool first (Python in `tools/`), then maybe in-browser.
2. **Thickness:** front face, back face, and a thin edge ribbon so cut-outs turn like cardboard.
3. **Layer stack:** split one sprite into depth layers (cloak, arm, head) for parallax when the camera yaws.
4. **Fold lines:** let a sprite bend (cloak, banner) along a hinge for a paper-flap animation.
5. **Pipeline:** sprite sheet in -> polygon meshes out (JSON) -> loaded beside the town mesh. Add a viewer to the demo.
6. **The Heads system:** the headless outfit body and the heads should be separate polygons that dock at a neck hinge.

## Rules we agreed on
- One step at a time; show a screenshot or demo after each; green/red light checks before publishing.
- Organize and commit after every breakthrough (the project is in git; push to GitHub).
- Keep memory arrays and data tidy and in one place.
