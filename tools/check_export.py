"""Green/red check for the viewer's Save: reads the .zip (a .glb, an .obj/.mtl/.png), the cut-out .png and the .papercraft.json that
tools/shoot_upload.js saved, validates the glTF binary by hand (header, chunks, buffer views, accessors, PNG texture), checks that the .obj
matches it, and renders the .glb independently (a small numpy rasteriser: z-buffer, texture, alpha cut) from the front and the side, so the
saved model can be looked at without the viewer. Run: python3 tools/check_export.py [dir]  (default papercraft/shots/export)"""
import io, json, os, struct, sys, zipfile
import numpy as np
from PIL import Image
D = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'papercraft/shots/export')
errs = []
def check(ok, msg):
    if not ok: errs.append(msg)
    return ok
zp = [f for f in os.listdir(D) if f.endswith('.zip')][0]; z = zipfile.ZipFile(os.path.join(D, zp)); names = z.namelist()
glbn = [n for n in names if n.endswith('.glb')][0]; glb = z.read(glbn); objn = glbn[:-4] + '.obj'
magic, ver, length = struct.unpack('<III', glb[:12]); check(magic == 0x46546C67 and ver == 2 and length == len(glb), 'glb header')
jl, jt = struct.unpack('<II', glb[12:20]); check(jt == 0x4E4F534A, 'json chunk'); g = json.loads(glb[20:20 + jl])
bl, bt = struct.unpack('<II', glb[20 + jl:28 + jl]); check(bt == 0x004E4942, 'bin chunk'); B = glb[28 + jl:28 + jl + bl]; check(bl == g['buffers'][0]['byteLength'], 'buffer length')
for i, v in enumerate(g['bufferViews']): check(v['byteOffset'] % 4 == 0 and v['byteOffset'] + v['byteLength'] <= bl, 'bufferView %d in bounds' % i)
def acc(i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; n = {'VEC3': 3, 'VEC2': 2}[a['type']]
    return np.frombuffer(B, np.float32, a['count'] * n, v['byteOffset']).reshape(-1, n)
P, UV, C = acc(0), acc(1), acc(2); n = len(P)
check(n % 3 == 0 and n > 0, 'triangle list'); check(np.allclose(P.min(0), g['accessors'][0]['min'], atol=1e-5) and np.allclose(P.max(0), g['accessors'][0]['max'], atol=1e-5), 'POSITION min/max')
check(abs((P[:, 1].max() - P[:, 1].min()) - 1) < 0.02, 'model is 1 m tall (got %.3f)' % (P[:, 1].max() - P[:, 1].min()))
iv = g['bufferViews'][g['images'][0]['bufferView']]; png = B[iv['byteOffset']:iv['byteOffset'] + iv['byteLength']]; check(png[:8] == b'\x89PNG\r\n\x1a\n', 'embedded PNG'); tex = np.array(Image.open(io.BytesIO(png)).convert('RGBA'))
check(g['materials'][0]['alphaMode'] == 'MASK' and 'KHR_materials_unlit' in g['extensionsUsed'], 'material')
obj = z.read(objn).decode().split('\n'); ov = [l for l in obj if l.startswith('v ')]; of = [l for l in obj if l.startswith('f ')]
check(len(ov) == n and len(of) == n // 3, 'obj matches glb (%d/%d verts, %d/%d faces)' % (len(ov), n, len(of), n // 3))
check(np.allclose(np.array([[float(x) for x in l.split()[1:]] for l in ov]), P, atol=1e-4), 'obj positions match')
check(glbn[:-4] + '.png' in names and glbn[:-4] + '.mtl' in names, 'obj texture and material present')
# signed volume (glTF: right-handed, faces counter-clockwise from outside -> positive volume)
T = P.reshape(-1, 3, 3); vol = np.einsum('ij,ij->i', T[:, 0], np.cross(T[:, 1], T[:, 2])).sum() / 6; check(vol > 0, 'faces wound outward (volume %.5f)' % vol)
def render(view, W=360, H=480):  # orthographic; view 'front' looks down -z (from +z), 'side' looks down -x (from +x); y up
    q = P.copy(); q = q[:, [0, 1, 2]] if view == 'front' else np.stack([-P[:, 2], P[:, 1], P[:, 0]], 1)
    lo, hi = q[:, :2].min(0), q[:, :2].max(0); k = 0.9 * min(W / (hi[0] - lo[0] + 1e-9), H / (hi[1] - lo[1] + 1e-9)); c = (lo + hi) / 2
    sx = (q[:, 0] - c[0]) * k + W / 2; sy = H / 2 - (q[:, 1] - c[1]) * k; zb = np.full((H, W), -1e9); img = np.zeros((H, W, 3), np.uint8) + 235
    th, tw = tex.shape[:2]
    for t in range(0, n, 3):
        x, y, zz = sx[t:t + 3], sy[t:t + 3], q[t:t + 3, 2]; area = (x[1] - x[0]) * (y[2] - y[0]) - (x[2] - x[0]) * (y[1] - y[0])
        if area >= 0: continue  # back face (screen y down: counter-clockwise from the eye is negative here)
        x0, x1, y0, y1 = int(max(0, x.min())), int(min(W - 1, x.max())) + 1, int(max(0, y.min())), int(min(H - 1, y.max())) + 1
        if x1 <= x0 or y1 <= y0: continue
        X, Y = np.meshgrid(np.arange(x0, x1) + .5, np.arange(y0, y1) + .5)
        w0 = ((x[1] - X) * (y[2] - Y) - (x[2] - X) * (y[1] - Y)) / area; w1 = ((x[2] - X) * (y[0] - Y) - (x[0] - X) * (y[2] - Y)) / area; w2 = 1 - w0 - w1
        m = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        if not m.any(): continue
        Z = w0 * zz[0] + w1 * zz[1] + w2 * zz[2]; u = w0 * UV[t, 0] + w1 * UV[t + 1, 0] + w2 * UV[t + 2, 0]; v = w0 * UV[t, 1] + w1 * UV[t + 1, 1] + w2 * UV[t + 2, 1]
        tx = np.clip((u * tw).astype(int), 0, tw - 1); ty = np.clip((v * th).astype(int), 0, th - 1); s = tex[ty, tx]; sh = w0 * C[t, 0] + w1 * C[t + 1, 0] + w2 * C[t + 2, 0]
        sub = zb[y0:y1, x0:x1]; m &= (s[..., 3] >= 128) & (Z > sub); sub[m] = Z[m]; img[y0:y1, x0:x1][m] = np.clip(s[..., :3][m] * sh[m][:, None], 0, 255)
    return img
shots = [render('front'), render('side')]
cut = [f for f in os.listdir(D) if f.endswith('.png') and not f.startswith('render')]
if check(len(cut) == 1, 'cut-out png saved'):
    c = Image.open(os.path.join(D, cut[0])); a = np.array(c.convert('RGBA'))[..., 3]; check(c.mode == 'RGBA' and (a == 0).any() and (a == 255).any(), 'cut-out has transparency'); print('cut-out', c.size)
js = [f for f in os.listdir(D) if f.endswith('.json')]
if check(len(js) == 1, 'papercraft json saved'):
    r = json.load(open(os.path.join(D, js[0]))); check(r.get('papercraft') == 1 and r['picture'].startswith('data:image/png;base64,') and len(r['sprite']['tris']) % 3 == 0, 'papercraft json fields')
Image.fromarray(np.concatenate(shots, 1)).save(os.path.join(D, 'render.png'))
print('glb', len(glb), 'bytes,', n // 3, 'triangles, texture', tex.shape[1], 'x', tex.shape[0], '| zip:', ', '.join(names))
print('RED ' + ' | '.join(errs) if errs else 'GREEN export: glb valid, obj matches, cut-out and papercraft file saved; render.png drawn from the .glb'); sys.exit(1 if errs else 0)
