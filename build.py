"""Builds the single-file game from the organized project.
   python3 build.py            -> game/ (index.html + the PWA files + icons), ready to publish or install
Placeholders in src/index.template.html:
   {{file path}}      the file's text, as is (CSS, small scripts)
   {{jsjoin dir}}     every .js file in that folder, joined in name order (00-, 01-, ...): the game script
   {{datauri path}}   a picture, packed as data:<type>;base64,..."""
import base64, os, re, shutil, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
MIME = {'mp4': 'video/mp4', 'webm': 'video/webm', 'webp': 'image/webp', 'png': 'image/png', 'jpg': 'image/jpeg', 'gif': 'image/gif', 'mp3': 'audio/mpeg'}
def clean(b): # drop Content Credentials (C2PA) blocks that the file host stamps onto images and video: metadata only, the picture is untouched
    import struct
    if b[:4] == b'RIFF' and b[8:12] == b'WEBP':
        out, i = [], 12
        while i + 8 <= len(b):
            cc, n = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]; end = i + 8 + n + (n & 1)
            if cc != b'C2PA': out.append(b[i:end])
            i = end
        body = b'WEBP' + b''.join(out); return b'RIFF' + struct.pack('<I', len(body)) + body
    # (mp4 files are cleaned with ffmpeg -c copy -map_metadata -1 instead: dropping a box would shift the sample offsets)
    return b
def read(rel): return open(os.path.join(ROOT, rel), encoding='utf-8', newline='').read()
def sub(m):
    kind, arg = m.group(1), m.group(2)
    if kind == 'file': return re.sub(r'\{\{(file|jsjoin|datauri) ([^}]+)\}\}', sub, read(arg))
    if kind == 'jsjoin': d = os.path.join(ROOT, arg); return ''.join(read(os.path.join(arg, f)) for f in sorted(os.listdir(d)) if f.endswith('.js'))
    b = clean(open(os.path.join(ROOT, arg), 'rb').read()); return 'data:%s;base64,%s' % (MIME[arg.rsplit('.', 1)[1]], base64.b64encode(b).decode())
def build():
    out = re.sub(r'\{\{(file|jsjoin|datauri) ([^}]+)\}\}', sub, read('src/index.template.html'))
    g = os.path.join(ROOT, 'game'); os.makedirs(g, exist_ok=True)
    open(os.path.join(g, 'index.html'), 'w', encoding='utf-8', newline='').write(out)
    for f in os.listdir(os.path.join(ROOT, 'pwa')): shutil.copy(os.path.join(ROOT, 'pwa', f), g)
    for f in os.listdir(os.path.join(ROOT, 'assets/icons')): shutil.copy(os.path.join(ROOT, 'assets/icons', f), g)
    return out
if __name__ == '__main__':
    out = build(); print('built game/index.html', round(len(out) / 1024), 'KB')
    if len(sys.argv) > 1: same = out == open(sys.argv[1], encoding='utf-8', newline='').read(); print('identical to', sys.argv[1], '->', same); sys.exit(0 if same else 1)
