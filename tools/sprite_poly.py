"""Papercraft sprite tracer: every sprite frame becomes a flat paper polygon, ready to fold.

    sprite rect on an atlas -> alpha mask -> grow 1 px -> trace the pixel edges into rings
    -> Douglas-Peucker (eps px) -> ear clipping -> one tidy JSON for every atlas

The frame tables are read straight out of the game's own JS (FARM_ART.F, SUD_ART.F, HERO_FRAMES), so the rects are never
copied by hand. Output: assets/papercraft/sprite-polys.json. Preview: papercraft/shots/trace-<atlas>.png.

Deterministic: integer pixel corners only, rings start at their top-left corner, no randomness. The file carries a seal
(a hash of everything traced, salted with the master prime 113) so a re-run proves it rebuilt byte for byte.

Run:  python3 tools/sprite_poly.py            (all atlases)
      python3 tools/sprite_poly.py farm sud    (some of them)
"""
import json, math, os, re, sys
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIME = 113            # the master prime (PAPER.PRIME): salts the seal
ALPHA = 128            # the module's own cut: alpha >= 128 is paper, below is air
GROW = 1               # grow the silhouette by this many px so the simplified outline still holds every painted pixel
EPS = 1.0              # Douglas-Peucker tolerance in sprite px
MIN_AREA = 12          # islands smaller than this (px^2) are left to the alpha cut
OUT = 'assets/papercraft/sprite-polys.json'

# atlas id -> (image, JS file, the frame table's variable). Frames are [x, y, w, h] (+ optional anchor ax, ay).
ATLASES = {
    'farm': ('assets/atlases/farm-atlas.webp', 'src/js/game/27-rahjai.js', r'const FARM_ART = \{ img: new Image\(\), F: (\{.*?\}) \};'),
    'sud':  ('assets/atlases/sud-atlas.webp', 'src/js/game/28-townsfolk.js', r'const SUD_ART = \{ img: new Image\(\), F: (\{.*?\}), ready'),
    'hero': ('assets/atlases/hero-atlas.webp', 'src/js/game/03-hero-sprite.js', r'const HERO_FRAMES = (\{.*?\});'),
}


def frames_of(atlas):
    img, js, pat = ATLASES[atlas]
    src = open(os.path.join(ROOT, js), encoding='utf-8').read()
    return json.loads(re.search(pat, src).group(1))


# ---------------------------------------------------------------- the trace
def grow(mask, r):
    """8-neighbour dilation by r px (a square brush): a cheap, exact 'grow the paper a little'."""
    m = mask.copy()
    for _ in range(r):
        p = np.pad(m, 1)
        m = np.zeros_like(m)
        for dy in (0, 1, 2):
            for dx in (0, 1, 2):
                m |= p[dy:dy + mask.shape[0], dx:dx + mask.shape[1]]
    return m


def unpinch(m):
    """Fill one pixel of every diagonal-only touch (a 2x2 window holding just a diagonal pair), so each outline is a simple ring.
    Deterministic: windows scanned top to bottom, left to right; the pixel filled is always the window's bottom-left/top-left."""
    m = m.copy()
    while True:
        a, b, c, d = m[:-1, :-1], m[:-1, 1:], m[1:, :-1], m[1:, 1:]   # TL TR BL BR of every 2x2 window
        p1 = a & d & ~b & ~c; p2 = b & c & ~a & ~d
        if not (p1.any() or p2.any()):
            return m
        ys, xs = np.nonzero(p1); m[ys + 1, xs] = True                 # TL+BR pair: fill BL
        ys, xs = np.nonzero(p2); m[ys, xs] = True                     # TR+BL pair: fill TL


def trace(mask):
    """Every ring of pixel edges round the filled pixels. Corners are integer lattice points (x right, y down).
    Rings run with the paper on the LEFT when y points up, i.e. counter-clockwise as the picture is seen.
    At a pinch (two pixels touching only at a corner) we always turn so the pixels stay apart: rings never cross."""
    p = unpinch(np.pad(mask, 1).astype(bool))
    H, W = mask.shape
    f = lambda x, y: p[y + 1, x + 1]                 # filled? (out of range = air)
    nxt = {}                                         # start corner -> list of (end corner) for each boundary edge
    for y in range(-1, H + 1):
        for x in range(-1, W + 1):
            if not f(x, y):
                continue
            # pixel (x,y) spans corners (x,y)..(x+1,y+1). Edge directions keep the pixel on the left in y-up terms,
            # which in y-down image terms means: top edge runs right->left, left edge top->bottom, bottom left->right, right bottom->top.
            if not f(x, y - 1): nxt.setdefault((x + 1, y), []).append((x, y))
            if not f(x - 1, y): nxt.setdefault((x, y), []).append((x, y + 1))
            if not f(x, y + 1): nxt.setdefault((x, y + 1), []).append((x + 1, y + 1))
            if not f(x + 1, y): nxt.setdefault((x + 1, y + 1), []).append((x + 1, y))
    rings = []
    while nxt:
        start = min(nxt, key=lambda c: (c[1], c[0]))  # deterministic: the top-most, then left-most corner with edges left
        ring, cur, prev_d = [], start, None
        while True:
            outs = nxt[cur]
            if len(outs) == 1 or prev_d is None:
                e = min(outs)
            else:                                    # a pinch: turn so we keep hugging the pixel we came along (a left turn, y up)
                cr = lambda e: prev_d[0] * (e[1] - cur[1]) - prev_d[1] * (e[0] - cur[0])
                e = min(outs, key=lambda e: (cr(e), e))
            outs.remove(e)
            if not outs:
                del nxt[cur]
            ring.append(cur)
            prev_d = (e[0] - cur[0], e[1] - cur[1])
            cur = e
            if cur == start:
                break
        rings.append(ring)
    return rings


def area2(r):
    """Twice the signed area in image coords (y down). Paper rings (CCW as seen) come out NEGATIVE."""
    s = 0
    for i in range(len(r)):
        x0, y0 = r[i]; x1, y1 = r[(i + 1) % len(r)]
        s += x0 * y1 - x1 * y0
    return s


def strip_collinear(r):
    out = []
    n = len(r)
    for i in range(n):
        a, b, c = r[i - 1], r[i], r[(i + 1) % n]
        if (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) != 0:
            out.append(b)
    return out


def dp(pts, eps):
    """Douglas-Peucker on an open chain (keeps both ends). Returns the kept indices."""
    keep = {0, len(pts) - 1}
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay = pts[i]; bx, by = pts[j]; dx, dy = bx - ax, by - ay; L = math.sqrt(dx * dx + dy * dy)
        best, bk = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]
            d = abs(dx * (ay - py) - dy * (ax - px)) / L if L else math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
            if d > best: best, bk = d, k
        if best > eps:
            keep.add(bk); stack += [(i, bk), (bk, j)]
    return sorted(keep)


def simplify_ring(r, eps):
    """Indices of the corners kept: the closed ring is split at its first corner and the corner farthest from it, both halves simplified."""
    if eps <= 0 or len(r) < 5:
        return list(range(len(r)))
    a = r[0]
    far = max(range(len(r)), key=lambda k: ((r[k][0] - a[0]) ** 2 + (r[k][1] - a[1]) ** 2, -k))
    h2 = [far + i for i in dp(r[far:] + [r[0]], eps)]
    return sorted(set(dp(r[:far + 1], eps)) | {i for i in h2 if i < len(r)})


def outside(ring, cx, cy):
    """Which points (cx, cy arrays) fall outside the ring (even-odd rule)."""
    ins = np.zeros(len(cx), bool); n = len(ring)
    for i in range(n):
        (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % n]
        if y0 == y1: continue
        m = (cy >= min(y0, y1)) & (cy < max(y0, y1))
        xs = x0 + (cy - y0) * (x1 - x0) / (y1 - y0)
        ins ^= m & (cx < xs)
    return ~ins


def hold(ring, keep, cx, cy):
    """Put corners back until the simplified ring holds every painted pixel centre it is responsible for:
    each pass restores, for the first pixel still outside, the dropped corner nearest to it."""
    keep = set(keep)
    for _ in range(len(ring)):
        s = [ring[i] for i in sorted(keep)]
        out = np.nonzero(outside(s, cx, cy))[0]
        if not len(out): break
        px, py = cx[out[0]], cy[out[0]]
        drop = [i for i in range(len(ring)) if i not in keep]
        if not drop: break
        keep.add(min(drop, key=lambda i: ((ring[i][0] - px) ** 2 + (ring[i][1] - py) ** 2, i)))
    return sorted(keep)


def seg_cross(p1, p2, p3, p4):
    def o(a, b, c): v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return (v > 0) - (v < 0)
    d1, d2, d3, d4 = o(p3, p4, p1), o(p3, p4, p2), o(p1, p2, p3), o(p1, p2, p4)
    if d1 * d2 < 0 and d3 * d4 < 0: return True
    def on(a, b, c): return min(a[0], b[0]) <= c[0] <= max(a[0], b[0]) and min(a[1], b[1]) <= c[1] <= max(a[1], b[1])
    return (d1 == 0 and on(p3, p4, p1)) or (d2 == 0 and on(p3, p4, p2)) or (d3 == 0 and on(p1, p2, p3)) or (d4 == 0 and on(p1, p2, p4))


def simple(r):
    n = len(r)
    if len(set(r)) != n: return False
    for i in range(n):
        for j in range(i + 1, n):
            if j == i + 1 or (i == 0 and j == n - 1): continue
            if seg_cross(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n]): return False
    return True


def earclip(r):
    """Ear clipping for a simple ring that is CCW as seen (negative area2 in y-down). Returns index triples, same winding."""
    idx = list(range(len(r)))
    cr = lambda a, b, c: (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])   # < 0 = a CCW-as-seen (convex) corner
    def inside(p, a, b, c):
        return cr(a, b, p) <= 0 and cr(b, c, p) <= 0 and cr(c, a, p) <= 0
    tris, guard = [], 0
    while len(idx) > 3 and guard < 10 * len(r) * len(r):
        guard += 1
        n, cut = len(idx), False
        best = None
        for k in range(n):                            # every valid ear; the fattest one is cut (ties: the first in ring order)
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % n]
            a, b, c = r[i0], r[i1], r[i2]
            ar = -cr(a, b, c)
            if ar <= 0: continue                      # reflex or flat
            if any(inside(r[m], a, b, c) for m in idx if m not in (i0, i1, i2) and r[m] not in (a, b, c)): continue
            q = ar / ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (b[0] - c[0]) ** 2 + (b[1] - c[1]) ** 2 + (c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2)
            if best is None or q > best[0]: best = (q, k)
        if best:
            k = best[1]; tris.append((idx[k - 1], idx[k], idx[(k + 1) % n])); idx.pop(k); cut = True
        if not cut:
            return None
    if len(idx) == 3:
        tris.append(tuple(idx))
    return tris


def nearest_paper(mask, x, y, R=4):
    """The centre of the nearest painted pixel to lattice corner (x, y): the edge ribbon takes its colour from there."""
    H, W = mask.shape; best = None
    for py in range(max(0, y - R), min(H, y + R)):
        for px in range(max(0, x - R), min(W, x + R)):
            if mask[py, px]:
                d = (px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2
                if best is None or (d, py, px) < best[0]: best = ((d, py, px), (px, py))
    return best[1] if best else (min(W - 1, max(0, x)), min(H - 1, max(0, y)))


def trace_sprite(rgba, rect):
    x, y, w, h = rect[:4]
    a = rgba[y:y + h, x:x + w, 3] >= ALPHA
    paper = int(a.sum())
    if paper == 0:
        return None
    g = grow(a, GROW)
    ys, xs = np.nonzero(a); cx, cy = xs + 0.5, ys + 0.5
    pts, rings, tris, ein = [], [], [], []
    for ring in trace(g):
        if area2(ring) >= 0 or -area2(ring) / 2 < MIN_AREA:   # holes (and specks) are left to the alpha cut
            continue
        ring = strip_collinear(ring)
        mine = ~outside(ring, cx, cy)                      # the painted pixels this outline is responsible for
        for eps in (EPS, EPS * 0.75, EPS * 0.5, 0):        # if the simplified ring folds over itself, ease off
            s = [ring[i] for i in hold(ring, simplify_ring(ring, eps), cx[mine], cy[mine])]
            t = earclip(s) if len(s) >= 3 and area2(s) < 0 and simple(s) else None
            if t: break
        else:
            raise RuntimeError('could not cut %s' % (rect,))
        base = len(pts)
        pts += s; rings.append(len(s)); tris += [(base + i, base + j, base + k) for i, j, k in t]
        ein += [nearest_paper(a, px, py) for px, py in s]
    # checks: how much of the paint the cut holds, how much air it carries
    cover = 0
    if tris:
        hit = np.zeros(len(cx), bool)
        for i, j, k in tris:
            (ax, ay), (bx, by), (qx, qy) = pts[i], pts[j], pts[k]
            e = lambda x0, y0, x1, y1: (x1 - x0) * (cy - y0) - (y1 - y0) * (cx - x0)   # <= 0 on the inner side of a CCW-as-seen edge
            hit |= (e(ax, ay, bx, by) <= 0) & (e(bx, by, qx, qy) <= 0) & (e(qx, qy, ax, ay) <= 0)
        cover = hit.mean()
    poly_area = sum(-((pts[j][0] - pts[i][0]) * (pts[k][1] - pts[i][1]) - (pts[j][1] - pts[i][1]) * (pts[k][0] - pts[i][0])) for i, j, k in tris) / 2
    return {'pts': pts, 'rings': rings, 'tris': tris, 'ein': ein, 'paper': paper, 'cover': float(cover), 'area': poly_area}


def seal(data):
    """A 32-bit FNV-style hash of the traced data, salted with the master prime: same input, same seal, forever."""
    h = (2166136261 ^ PRIME) & 0xffffffff
    for ch in json.dumps(data, sort_keys=True, separators=(',', ':')).encode():
        h = ((h ^ ch) * 16777619) & 0xffffffff
    return '%08x' % h


def flat(seq):
    return [v for p in seq for v in p]


def preview(name, rgba, frames, out, width=1800, tall=200):
    """A contact sheet: each sprite on a slate card, its outline (gold) and triangles (blue) drawn over it. Shelf-packed."""
    cells = [(k, frames[k], out[k]) for k in frames if k in out]
    cells.sort(key=lambda c: (-c[1][3], c[0]))
    place, x, y, row_h = [], 8, 8, 0
    for k, f, o in cells:
        sc = max(1, min(4, int(tall / f[3]))); w, h = f[2] * sc, f[3] * sc
        if x + w + 8 > width: x, y, row_h = 8, y + row_h + 26, 0
        place.append((k, f, o, sc, x, y)); x += w + 14; row_h = max(row_h, h)
    sheet = Image.new('RGB', (width, y + row_h + 34), (24, 26, 32)); d = ImageDraw.Draw(sheet)
    src = Image.fromarray(rgba)
    for k, f, o, sc, ox, oy in place:
        x, y, w, h = f[:4]
        sp = src.crop((x, y, x + w, y + h)).resize((w * sc, h * sc), Image.NEAREST)
        bg = Image.new('RGB', sp.size, (58, 62, 76)); bg.paste(sp, (0, 0), sp); sheet.paste(bg, (ox, oy))
        P = [(ox + px * sc, oy + py * sc) for px, py in o['pts']]
        for i, j, kk in o['tris']:
            d.polygon([P[i], P[j], P[kk]], outline=(80, 190, 255))
        b = 0
        for nr in o['rings']:
            ring = P[b:b + nr]; d.line(ring + [ring[0]], fill=(255, 205, 60), width=2); b += nr
        d.text((ox, oy + h * sc + 4), '%s %dv %dt' % (k[:18], len(o['pts']), len(o['tris'])), fill=(225, 222, 210))
    sheet.save(out_path := os.path.join(ROOT, 'papercraft/shots/trace-%s.png' % name), optimize=True)
    return out_path


def main(which):
    path = os.path.join(ROOT, OUT)
    db = json.load(open(path)) if os.path.exists(path) else {}
    db.setdefault('atlases', {}); db.setdefault('sprites', {})
    report = []
    for name in which:
        img, _, _ = ATLASES[name]
        rgba = np.array(Image.open(os.path.join(ROOT, img)).convert('RGBA'))
        frames = frames_of(name)
        db['atlases'][name] = {'file': img, 'size': [rgba.shape[1], rgba.shape[0]]}
        for k in [k for k in db['sprites'] if k.startswith(name + '/')]:
            del db['sprites'][k]
        traced = {}
        for k in sorted(frames):
            f = frames[k]; o = trace_sprite(rgba, f)
            if not o: continue
            traced[k] = o
            anchor = [f[4], f[5]] if len(f) >= 6 else [f[2] / 2, f[3]]       # where the piece stands: the frame's own anchor, else bottom-centre
            db['sprites'][name + '/' + k] = {'rect': f[:4], 'anchor': anchor, 'pts': flat(o['pts']), 'rings': o['rings'], 'tris': flat(o['tris']), 'ein': flat(o['ein'])}
            report.append((name + '/' + k, len(o['pts']), len(o['tris']), o['cover'], o['area'] / o['paper']))
        if name != 'hero':
            preview(name, rgba, frames, traced)
        else:  # the hero has ~300 frames: preview the standing poses only
            pick = {k: frames[k] for k in frames if k in ('basic_down', 'basic_right', 'basic_up', 'starter_down', 'kael_idle', 'kt_down', 'kt_right', 'kt_up', 'rj_down', 'rj_right', 'rj_up', 'nc_idle_d', 'nc_idle_r', 'nc_idle_u', 'horse_front', 'horse_side_a')}
            preview(name, rgba, pick, traced)
    db['sprites'] = dict(sorted(db['sprites'].items()))
    meta = {'prime': PRIME, 'alpha': ALPHA, 'grow': GROW, 'eps': EPS, 'minArea': MIN_AREA,
            'format': 'per sprite: rect [x,y,w,h] on its atlas; anchor [ax,ay] in sprite px (where it stands); pts flat [x,y,...] '
                      'integer sprite px, y down; rings = point count of each outline; tris flat index triples, counter-clockwise as the '
                      'picture is seen; ein flat [x,y,...] the nearest painted pixel to each point (the edge ribbon samples it)'}
    db = {'meta': meta, 'atlases': dict(sorted(db['atlases'].items())), 'sprites': db['sprites']}
    db['meta']['seal'] = seal({'atlases': db['atlases'], 'sprites': db['sprites']})
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:   # one sprite per line: diffs stay readable
        fh.write('{"meta": ' + json.dumps(db['meta']) + ',\n"atlases": ' + json.dumps(db['atlases']) + ',\n"sprites": {\n')
        fh.write(',\n'.join(json.dumps(k) + ': ' + json.dumps(v, separators=(',', ':')) for k, v in db['sprites'].items()))
        fh.write('\n}}\n')
    return db, report


if __name__ == '__main__':
    which = sys.argv[1:] or list(ATLASES)
    db, report = main(which)
    cov = [r[3] for r in report]; air = [r[4] for r in report]
    print('traced %d sprites  verts %d  tris %d' % (len(report), sum(r[1] for r in report), sum(r[2] for r in report)))
    print('cover  min %.4f  mean %.4f   (share of painted pixels inside the cut; 1.0 = none lost)' % (min(cov), sum(cov) / len(cov)))
    print('air    max %.2f  mean %.2f   (cut area / painted area)' % (max(air), sum(air) / len(air)))
    worst = sorted(report, key=lambda r: r[3])[:5]
    print('lowest cover:', ', '.join('%s %.3f' % (r[0], r[3]) for r in worst))
    print('seal', db['meta']['seal'], ' size %d KB' % (os.path.getsize(os.path.join(ROOT, OUT)) // 1024))
