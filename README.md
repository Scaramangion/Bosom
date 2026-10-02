# Saga of Koto (BOSOM)

A mobile 2.5D PS1-style game: one HTML file you install like an app. This folder is where its parts live.

**Never lose work:** every published build is a commit here, tagged `v2.81`, `v2.84` … Each one rebuilds byte for byte.

| Folder | What's in it |
|---|---|
| `src/index.template.html` | the page markup, with `{{placeholders}}` |
| `src/css/` | style sheets |
| `src/js/game/` | the game script, one numbered file per system (`24-papercraft.js`, `28-townsfolk.js` …) |
| `assets/` | every picture and film packed into the game: `backgrounds/`, `atlases/`, `ui/`, `icons/`, `video/` |
| `art-source/` | hand-made sheets the atlases were cut from; `incoming/` holds everything you've sent (images, videos, 3D models) |
| `docs/design-notes/` | the design ideas you've written (D20 web, Silent Hill nights, lasso, 113 seed …) |
| `pwa/` | offline-play service worker, app manifest, install notes |

**Build:** `python3 build.py` makes `game/index.html` (plus icons and PWA files), ready to publish.
**Seed:** the town is generated from the master prime 113 (`24-papercraft.js`, `PAPER.PRIME`).

## Papercraft
The paper-model 3D engine is documented in `docs/PAPERCRAFT.md` and runs on its own in `papercraft/paper-demo.html` (rebuild it with `python3 tools/make_papercraft_demo.py`). Sprites (and any picture you upload, on a phone) folded into paper cards: `papercraft/sprite-viewer.html` (`python3 tools/sprite_poly.py`, then `python3 tools/make_sprite_viewer.py`).
