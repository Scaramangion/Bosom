"""Cuts the cottage's texture pieces out of the orthographic sheet and lays them in a 1024 x 244 strip.
The strip is drawn into the paper sheet at y = 780 (below the town's painted rows). Rects here MUST match COTTAGE_TEX in src/js/game/24-papercraft.js."""
from PIL import Image, ImageDraw, ImageFilter
import random, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = Image.open(os.path.join(ROOT, 'art-source/models/cottage/cottage-orthographic-sheet.jpg')).convert('RGB')
out = Image.new('RGB', (1024, 244), (0, 0, 0))
def put(name, box, dst, size=None):
    c = S.crop(box)
    if size: c = c.resize(size, Image.LANCZOS)
    out.paste(c, (dst[0], dst[1] - 780)); return (dst[0], dst[1], c.width, c.height)
R = {}
R['FC']  = put('FC',  (111, 169, 254, 393), (0, 780))          # front, centre block (gable + wall)
R['FWL'] = put('FWL', (19, 303, 111, 393), (146, 780))         # front, left wing wall
R['FWR'] = put('FWR', (254, 303, 346, 393), (240, 780))        # front, right wing wall
R['BC']  = put('BC',  (108, 686, 252, 905), (336, 780))        # back, centre block
R['BWL'] = put('BWL', (30, 820, 108, 900), (484, 780))
R['BWR'] = put('BWR', (254, 820, 332, 900), (566, 780))
R['ROOF'] = put('ROOF', (202, 1195, 355, 1358), (648, 780), (120, 156))   # blue slate, from the plan view
R['SHEDROOF'] = put('SHEDROOF', (452, 1175, 582, 1305), (772, 780), (96, 96))
R['SHEDFRAME'] = put('SHEDFRAME', (515, 292, 665, 395), (872, 780))
R['CHIM'] = put('CHIM', (165, 125, 198, 178), (572, 866))
R['WIN']  = put('WIN',  (54, 306, 98, 354), (610, 866))
# plaster: sampled cream with a little mottling; planks; foundation stone from the front elevation
cream = S.crop((131, 276, 141, 284)).resize((1, 1), Image.BOX).getpixel((0, 0))
rnd = random.Random(113); P = Image.new('RGB', (64, 64), cream); d = ImageDraw.Draw(P)
for _ in range(260):
    x, y = rnd.randrange(64), rnd.randrange(64); k = rnd.randrange(-9, 9); d.point((x, y), (max(0, min(255, cream[0] + k)), max(0, min(255, cream[1] + k)), max(0, min(255, cream[2] + k))))
out.paste(P, (660, 940 - 780)); R['PLASTER'] = (660, 940, 64, 64)
W = Image.new('RGB', (64, 40), (110, 78, 48)); d = ImageDraw.Draw(W)
for x in range(0, 64, 8): d.rectangle((x, 0, x, 39), fill=(70, 48, 30)); d.rectangle((x + 3, 0, x + 4, 39), fill=(126, 92, 58))
out.paste(W, (730, 940 - 780)); R['WOOD'] = (730, 940, 64, 40)
R['STONE'] = put('STONE', (257, 368, 337, 392), (800, 940))
out.save(os.path.join(ROOT, 'assets/atlases/cottage-tex.webp'), 'webp', quality=92, method=6)
out.save('/tmp/cottage_strip.png'); print(R)
