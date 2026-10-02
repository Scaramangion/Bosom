"""Writes assets/manifest.json and docs/catalog.html (a browsable ledger of every asset and code module).
   python3 tools/catalog.py      (run from the project folder after adding or changing assets)"""
import base64, io, json, os, re
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
DESC = {
    'bg-town': "Brennan's Theme seen from above: the old photo ground under the town (fallback when the 3D town is off).",
    'bg-wastes': 'The Wastes, the desert east of town: painted ground for the whole zone.',
    'bg-haven': 'Haven at the top of the Long Trail: the town round the fountain.',
    'bg-vista': 'The horizon over Brennan\'s Theme: ruins under the turning black hole.',
    'bg-trail': 'Tile of canyon ground repeated along the Long Trail.',
    'farm-atlas': 'Rahjai farm sheet: farmhouse, barn, stable, coop, stall, well, fences, crops at every stage, animals, townsfolk, herbs.',
    'hero-atlas': 'Every hero frame: Koto and the outfits (walk, run, roll, jump, attack, ride), plus the horse.',
    'trail-atlas': 'Long Trail props: pillars, statues, arches, the camp.',
    'temple-atlas': 'The opening: the night temple, the princess, the guard.',
    'item-atlas': 'Held items drawn in the hand: sword, axe, lantern and friends.',
    'world-atlas': 'Night-temple set pieces, the Agent of the Malignant Principles, Boxelders.',
    'interior-atlas': 'Room interiors: the Tiger Emporium, the Tellhouse, home.',
    'apple-touch-icon-inline': 'Home-screen icon written into the page head.',
    'title-logo': 'The "Saga of Koto" title logo.',
    'party-portrait': 'Koto\'s portrait in the start menu party panel.',
    'v2-portrait': 'Koto\'s portrait in the HUD.',
    'hero-avatar-badge': 'The round avatar badge on the HUD corner.',
    'menu-backdrop': 'Backdrop texture behind the start menu.',
    'apple-touch-icon': 'Home-screen icon (iPhone).', 'icon-192': 'App icon, small.', 'icon-512': 'App icon, large (also the maskable icon).',
}
order = json.load(open('build-order.json'))
code = {os.path.join('src/js/game', x): open(os.path.join('src/js/game', x), encoding='utf-8').read() for x in sorted(os.listdir('src/js/game'))}
extra = {p: open(p, encoding='utf-8').read() for p in ['src/index.template.html'] + ['src/css/' + c for c in sorted(os.listdir('src/css'))]}
def thumb(path, maxw=360, maxh=300, q=78):
    im = Image.open(path).convert('RGBA'); im.thumbnail((maxw, maxh), Image.LANCZOS); b = io.BytesIO(); im.save(b, 'WEBP', quality=q)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
rows = []
for a in order['assets']:
    im = Image.open(a['file']); used = [os.path.basename(f) for f, t in code.items() if a['id'] in t] + [os.path.basename(f) for f, t in extra.items() if a['file'] in t]
    if a['kind'] == 'icons': used = ['pwa (home screen)']
    rows.append(dict(a, w=im.size[0], h=im.size[1], kb=round(os.path.getsize(a['file']) / 1024, 1), used=used, desc=DESC.get(a['id'], '')))
json.dump({'seed': 113, 'assets': [{k: r[k] for k in ('id', 'kind', 'file', 'mime', 'w', 'h', 'kb', 'used', 'desc')} for r in rows]}, open('assets/manifest.json', 'w'), indent=1)
mods = []
for f, t in code.items():
    first = t.split('\n', 1)[0].strip(); hm = re.match(r'// (?:={5,}|-{8,}) ?(.+?)(?: ?[=-]{3,})?$', first)
    title = hm.group(1) if hm else 'Core: constants, tools, sprites and the hero\'s basics'
    mods.append((os.path.basename(f), t.count('\n'), round(len(t.encode()) / 1024), title))
art = {}
for d, _, fs in os.walk('art-source'):
    imgs = sorted(f for f in fs if f.lower().endswith(('.png', '.webp', '.jpg')))
    if imgs: art[d] = imgs
build = re.search(r"BUILD_VERSION = '([0-9.]+)'", code['src/js/game/00-core.js'] + ''.join(code.values()))
esc = lambda s: s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
H = []
H.append('''<title>Koto Asset Ledger</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,500;0,700;1,500&family=IBM+Plex+Sans+Condensed:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: a ledger. One column of chapters (assets, code, source art, how to build); each entry is a row of thumbnail + facts that stacks on phones. */
:root{--ground:#f3efe6;--paper:#fbf8f1;--ink:#231d16;--quiet:#6f6455;--rule:#ddd3c2;--gold:#9a6a12;--night:#2c2a3c;
 --display:'Spectral',Georgia,serif;--body:'IBM Plex Sans Condensed','Arial Narrow',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ground:#16151d;--paper:#1e1c27;--ink:#ece6d8;--quiet:#a69c8b;--rule:#37334a;--gold:#e0b45c;--night:#0e0d14;color-scheme:dark}}
:root[data-theme="dark"]{--ground:#16151d;--paper:#1e1c27;--ink:#ece6d8;--quiet:#a69c8b;--rule:#37334a;--gold:#e0b45c;--night:#0e0d14;color-scheme:dark}
body{background:var(--ground);color:var(--ink);font:15px/1.55 var(--body)}
.wrap{max-width:980px;margin:0 auto;padding-inline:18px;padding-block:28px 60px;display:flex;flex-direction:column;gap:40px}
h1,h2{font-family:var(--display);font-weight:700;text-wrap:balance;margin:0}
h1{font-size:clamp(30px,6vw,46px);line-height:1.05}h2{font-size:24px}
.eyebrow{font:500 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.lede{max-width:64ch;color:var(--quiet);margin:10px 0 0}
.facts{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:18px;font-family:var(--mono);font-size:13px}
.facts b{font-size:20px;font-family:var(--display);color:var(--ink);display:block}.facts span{color:var(--quiet)}
section{display:flex;flex-direction:column;gap:14px}
.sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-bottom:1px solid var(--rule);padding-bottom:8px;flex-wrap:wrap}
.sec-head p{margin:0;color:var(--quiet);font-size:13px}
.kind{font:600 12px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--quiet);margin-top:8px}
.asset{display:grid;grid-template-columns:minmax(0,210px) minmax(0,1fr);gap:16px;padding:14px;background:var(--paper);border:1px solid var(--rule);border-radius:4px}
.asset .pic{background:repeating-conic-gradient(var(--rule) 0 25%,transparent 0 50%) 0 0/14px 14px;border-radius:2px;display:flex;align-items:center;justify-content:center;min-height:90px}
.asset img{display:block;max-height:220px;object-fit:contain;image-rendering:auto}
.asset h3{margin:0;font:600 17px/1.2 var(--mono)}.asset p{margin:4px 0 8px;max-width:62ch}
.meta{font:12px/1.6 var(--mono);color:var(--quiet);display:flex;flex-wrap:wrap;gap:4px 16px}.meta code{color:var(--ink)}
.chip{display:inline-block;font:11px/1 var(--mono);padding:4px 6px;border:1px solid var(--rule);border-radius:3px;margin:2px 4px 0 0;color:var(--ink)}
.tbl{overflow-x:auto;border:1px solid var(--rule);border-radius:4px;background:var(--paper)}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:560px}
th,td{text-align:left;padding:7px 12px;border-bottom:1px solid var(--rule);vertical-align:top}
th{font:600 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--quiet)}
td.n{font-family:var(--mono);font-variant-numeric:tabular-nums;text-align:right;color:var(--quiet)}td code{font-family:var(--mono);font-size:13px}
.art{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:8px}
.art figure{margin:0;background:var(--paper);border:1px solid var(--rule);border-radius:3px;padding:4px;display:flex;flex-direction:column;gap:3px;min-width:0}
.art img{width:100%;aspect-ratio:1;object-fit:contain;max-width:100%}
.art figcaption{font:10px/1.2 var(--mono);color:var(--quiet);overflow-wrap:anywhere}
pre{margin:0;overflow-x:auto;background:var(--night);color:#e9e2d0;padding:14px 16px;border-radius:4px;font:13px/1.6 var(--mono)}
details summary{cursor:pointer;font:600 14px var(--mono);color:var(--ink)}details summary:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
@media (max-width:560px){.asset{grid-template-columns:minmax(0,1fr)}}
</style>
<div class="wrap">''')
nart = sum(len(v) for v in art.values())
H.append(f'''<header><div class="eyebrow">Saga of Koto · build {build.group(1) if build else ""} · seed 113</div>
<h1>Koto Asset Ledger</h1>
<p class="lede">Every picture the game packs inside itself, every piece of code it runs, and the hand-made art it was cut from. The game still ships as one file; this ledger and the project folders are where its parts now live.</p>
<div class="facts"><div><b>{len(rows)}</b><span>game assets</span></div><div><b>{len(mods)}</b><span>code modules</span></div><div><b>{nart}</b><span>source art files</span></div><div><b>{round(sum(r['kb'] for r in rows))} KB</b><span>of pictures in the build</span></div></div></header>''')
H.append('<section><div class="sec-head"><h2>Game assets</h2><p>Packed into the game file at build time. Swap a file, rebuild, done.</p></div>')
for kind, label in [('backgrounds', 'Backgrounds'), ('atlases', 'Sprite sheets'), ('ui', 'Interface'), ('icons', 'App icons')]:
    H.append(f'<div class="kind">{label}</div>')
    for r in [r for r in rows if r['kind'] == kind]:
        chips = ''.join(f'<span class="chip">{esc(u)}</span>' for u in r['used']) or '<span class="chip">not referenced</span>'
        H.append(f'<article class="asset"><div class="pic"><img alt="{esc(r["id"])}" src="{thumb(r["file"])}"></div><div style="min-width:0"><h3>{esc(r["id"])}</h3><p>{esc(r["desc"])}</p>'
                 f'<div class="meta"><span><code>{esc(r["file"])}</code></span><span>{r["w"]} × {r["h"]} px</span><span>{r["kb"]} KB</span></div><div>{chips}</div></div></article>')
H.append('</section>')
H.append('<section><div class="sec-head"><h2>Code modules</h2><p>Joined in this order into the one game script. The number is the order.</p></div><div class="tbl"><table><thead><tr><th>File</th><th>What it is</th><th>Lines</th><th>KB</th></tr></thead><tbody>')
for f, n, kb, t in mods: H.append(f'<tr><td><code>{esc(f)}</code></td><td>{esc(t)}</td><td class="n">{n}</td><td class="n">{kb}</td></tr>')
H.append('</tbody></table></div></section>')
H.append('<section><div class="sec-head"><h2>Source art</h2><p>The hand-made sheets and frames the sprite sheets were cut from. Not packed into the game.</p></div>')
for d, fs in sorted(art.items()):
    H.append(f'<details{" open" if d.endswith("characters") else ""}><summary>{esc(d)} · {len(fs)}</summary><div class="art" style="margin-top:10px">')
    for f in fs: H.append(f'<figure><img loading="lazy" alt="{esc(f)}" src="{thumb(os.path.join(d, f), 120, 120, 70)}"><figcaption>{esc(f)}</figcaption></figure>')
    H.append('</div></details>')
H.append('</section>')
H.append('''<section><div class="sec-head"><h2>Folders and the build</h2><p>Where things go, and how the one game file is made from them.</p></div>
<pre>saga-of-koto/
  build.py                 makes game/index.html from everything below
  src/index.template.html  the page markup, with {{placeholders}}
  src/css/                 the four style sheets
  src/js/boot-check.js     shows startup errors on screen
  src/js/game/             the game script, in numbered modules
  src/js/sw-register.js    offline play
  assets/backgrounds/      zone ground and horizon pictures
  assets/atlases/          sprite sheets
  assets/ui/  assets/icons/
  assets/manifest.json     this ledger as data
  art-source/              the hand-made art the sheets came from
  pwa/                     service worker, app manifest, install notes
  tools/catalog.py         rebuilds this ledger
  game/                    the finished, publishable game</pre>
<pre>python3 build.py            # game/index.html (+ icons and PWA files)
python3 tools/catalog.py    # assets/manifest.json + docs/catalog.html</pre></section></div>''')
os.makedirs('docs', exist_ok=True); open('docs/catalog.html', 'w', encoding='utf-8').write('\n'.join(H))
print('manifest + catalog written', round(os.path.getsize('docs/catalog.html') / 1024), 'KB')
