// Green/red guard for the Papercraft motif (docs/BRAND.md): the opening page, the UI's type and colours, and Sudashorn turning on the stage
// are the company's look, so they must not drift by accident. Every rule is checked in the generator (tools/make_sprite_viewer.py) and in
// the page it writes (papercraft/sprite-viewer.html). To change the motif on purpose, change BRAND.md and this list together.
// Run from the repo root: node tools/check_brand.js
const fs = require('fs'), gen = fs.readFileSync('tools/make_sprite_viewer.py', 'utf8'), page = fs.readFileSync('papercraft/sprite-viewer.html', 'utf8');
const MOTIF = [
  ['type: the system font stack (San Francisco on Apple devices)', `--font:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",system-ui,sans-serif`],
  ['type: body 15 px', 'font:15px/1.35 var(--font)'],
  ['wordmark: "Papercraft", 17 px semibold, top left; tapping it goes home', '<button id="home" class="word" aria-label="Papercraft: back to the start">Papercraft</button>'], ['wordmark style', '.word{font-weight:600;font-size:17px;letter-spacing:-.01em'],
  ['headline: 22 px bold, tight', '.hello h1{margin:0 0 6px;font-size:22px;line-height:1.2;font-weight:700;letter-spacing:-.02em'],
  ['opening words', '<h1>Turn any picture into a paper model</h1><p>Choose a photo or a drawing. Papercraft cuts out the subject and folds it into 3D.</p><label class="primary" for="file">Choose Photo</label>'],
  ['colour: light stage and labels', '--scene:#ececf1;--floor:#dcdce4;'], ['colour: light labels', '--label:#1d1d1f;--label2:#6e6e73;'],
  ['colour: amber tint, light', '--tint:#a8670f;--tint-ink:#ffffff;'], ['colour: amber tint, dark', '--tint:#e0a447;--tint-ink:#1d1d1f;'], ['colour: dark stage', '--scene:#1b1b1f;--floor:#2b2b31;'],
  ['material: frosted glass', '.glass{background:var(--material);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border:.5px solid var(--hair)}'],
  ['shape: the floating tool bar', '.bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;gap:4px;padding:6px;border-radius:22px}'],
  ['shape: the primary button', '.primary{display:flex;align-items:center;justify-content:center;height:50px;border-radius:14px;background:var(--tint)'],
  ['Sudashorn opens the app', "sprite: Q.get('s') || 'sud/stand'"], ['the opening page is the start stage', "mode: Q.get('mode') || (Q.get('s') ? 'one' : 'start')"],
  ['she is folded as Facets', "shape: Q.get('shape') || 'facets'"], ['at PS2 Low', "budget: +(Q.get('budget') || 300)"], ['with the middle of Flat to Sculpted', 'id="thick" type="range" min="0" max="4" step="0.25" value="2"'],
  ['she turns slowly by default', 'id="spin" class="switch" type="checkbox" checked'], ['at 0.3 radians a second', 'cam.yaw += dt * 0.3'],
  ['seen from a little to the side and above', "yaw: +(Q.get('yaw') || 0.5), pitch: +(Q.get('pitch') || 0.22)"],
  ['standing above the welcome card', 'focus = [0, 0, hi ? -h * 0.32 : h / 2]; radius = Math.max(h, w) * (hi ? 2.5 : 1.9)'],
];
let bad = 0; for (const [what, s] of MOTIF) { const g = gen.includes(s), p = page.includes(s); if (!g || !p) { bad++; console.log('RED', what, g ? '' : '(generator)', p ? '' : '(page: rebuild with python3 tools/make_sprite_viewer.py)'); } }
if (!fs.existsSync('docs/brand/opening.png')) { bad++; console.log('RED the reference picture docs/brand/opening.png is missing'); }
console.log(bad ? 'RED' : 'GREEN', MOTIF.length, 'motif rules hold:', bad, 'drifted'); process.exit(bad ? 1 : 0);
