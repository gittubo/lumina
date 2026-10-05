#!/usr/bin/env python3
"""Bundle the site into one self-contained HTML file (dist/night-out.html).

Every stylesheet, script, font, image, video and frame is embedded, so the
file opens by double-click with no server and no other files beside it.
Usage: python3 build-single.py
"""
import base64
import json
import mimetypes
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
MIME = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2'}


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def data_uri(rel):
    ext = os.path.splitext(rel)[1]
    mime = MIME.get(ext) or mimetypes.guess_type(rel)[0]
    with open(os.path.join(ROOT, rel), 'rb') as f:
        return f'data:{mime};base64,' + base64.b64encode(f.read()).decode()


def script(code):
    return '<script>' + code.replace('</script', '<\\/script') + '</script>'


html = read('index.html')

# Preload hints and the og:image point at files that won't exist beside the bundle
html = re.sub(r'\s*<link rel="preload"[^>]*>', '', html)
html = re.sub(r'\s*<meta property="og:image"[^>]*>', '', html)

# Stylesheets: inline, with font urls embedded
css_main = re.sub(r'url\("\.\./(assets/fonts/[^"]+)"\)', lambda m: f'url("{data_uri(m.group(1))}")', read('css/style.css'))
html = html.replace('<link rel="stylesheet" href="vendor/lenis.css">', '<style>' + read('vendor/lenis.css') + '</style>')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>' + css_main + '</style>')

# Media referenced from markup
html = re.sub(r'(src|poster|data-reveal-img)="(assets/[^"]+)"', lambda m: f'{m.group(1)}="{data_uri(m.group(2))}"', html)

# Frame sequences for the canvas players
frames = {}
for name in ('hero', 'smoke'):
    d = f'assets/seq/{name}'
    frames[d] = [data_uri(f'{d}/{f}') for f in sorted(os.listdir(os.path.join(ROOT, d)))]

# Large data: videos play more reliably on Safari from blob URLs than data URIs
video_fix = """
document.querySelectorAll('video[src^="data:"]').forEach(function (v) {
  fetch(v.src).then(function (r) { return r.blob(); }).then(function (b) {
    var paused = v.paused; v.src = URL.createObjectURL(b); if (!paused) v.play().catch(function () {});
  });
});"""

scripts = ''.join([
    script('window.NIGHT_OUT_FRAMES=' + json.dumps(frames) + ';'),
    script(read('vendor/gsap.min.js')),
    script(read('vendor/ScrollTrigger.min.js')),
    script(read('vendor/SplitText.min.js')),
    script(read('vendor/lenis.min.js')),
    script(video_fix),
    script(read('js/main.js')),
])
html = re.sub(r'\s*<script src="[^"]+"></script>', '', html)
html = html.replace('</body>', scripts + '\n</body>')

assert 'src="assets/' not in html and 'href="css/' not in html and '<script src=' not in html
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'night-out.html')
with open(out, 'w', encoding='utf-8') as f:
    f.write(html)
print(f'{out}  {os.path.getsize(out) / 1e6:.1f} MB')
