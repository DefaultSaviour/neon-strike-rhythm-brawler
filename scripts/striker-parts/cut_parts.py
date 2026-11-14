"""Cut Gemini's arms-out Neon Striker into parts with see-through backgrounds, and write their joint anchors.

Usage (from the project root):
  python scripts/striker-parts/cut_parts.py scripts/striker-parts/gemini-spread.jpg public/fighters/striker src/game/strikerParts.ts
"""
import json
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, __file__.rsplit('\\', 1)[0].rsplit('/', 1)[0])
from joints import J, PARTS, SCARF, SCARF_POLY  # noqa: E402

src, out_dir, ts_out = sys.argv[1], sys.argv[2], sys.argv[3]
SHRINK = 2  # saved at half size: plenty for the screen, lighter on phones
img = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
H, W, _ = img.shape
BG = np.array([13, 9, 23], np.float32)
FLOOD = 120  # anything darker than this (distance from the background) outside the outlines is glow or background
KEY_LO, KEY_HI = 30, 120


def poly_mask(poly):
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return np.asarray(m) > 0


def cut(poly, keep_pixel=None):
    """RGBA crop of the part inside poly, with the background keyed out (and its glow kept soft)."""
    inside = poly_mask(poly)
    ys, xs = np.nonzero(inside)
    x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
    x0, y0 = max(0, x0), max(0, y0)
    crop = img[y0:y1, x0:x1]
    ins = inside[y0:y1, x0:x1]
    dist = np.abs(crop - BG).max(axis=2)
    keep = ins.copy()
    if keep_pixel is not None:
        keep &= keep_pixel(crop)
    h, w = dist.shape
    # Flood in from outside through dark pixels: what's reached is background or glow; what isn't is the part itself
    # (starting only from true background, so a part cut open where it meets its neighbour doesn't leak)
    passable = dist < FLOOD
    seed = dist < 25
    reached = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if seed[y, x] and not reached[y, x]:
                reached[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if seed[y, x] and not reached[y, x]:
                reached[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and passable[ny, nx] and not reached[ny, nx]:
                reached[ny, nx] = True
                q.append((ny, nx))
    alpha = np.where(reached, np.clip((dist - KEY_LO) / (KEY_HI - KEY_LO), 0, 1), 1.0)
    alpha = np.where(keep, alpha, 0.0)
    # Un-mix the background out of the soft glow so it isn't dark-edged over other parts
    a = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip(BG + (crop - BG) / a, 0, 255)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    im = im.resize((max(1, im.width // SHRINK), max(1, im.height // SHRINK)), Image.LANCZOS)
    return im, (x0, y0)


def not_pink(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return ~((r > 110) & (r > g + 60) & (r >= b))


def pink(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    return (r > g + 22) & (r > 30)


def local(p, origin):
    return [round((p[0] - origin[0]) / SHRINK, 2), round((p[1] - origin[1]) / SHRINK, 2)]


data = {}
for name, (a, b, poly) in PARTS.items():
    im, origin = cut(poly, not_pink)
    im.save(f'{out_dir}/{name}.png')
    data[name] = {'w': im.width, 'h': im.height, 'a': local(J[a], origin), 'b': local(J[b], origin)}
    print(name, im.size)
im, origin = cut(SCARF_POLY, pink)
im.save(f'{out_dir}/scarf.png')
data['scarf'] = {'w': im.width, 'h': im.height, 'a': local(SCARF[0], origin), 'b': local(SCARF[-1], origin)}
print('scarf', im.size)

# Where the core gem sits on the torso (pulses with the bass)
gem = (860, 680)
tx, ty = PARTS['torso'][2][0]
torso_origin = None
# recompute the torso origin the same way cut() does
inside = poly_mask(PARTS['torso'][2])
ys, xs = np.nonzero(inside)
torso_origin = (max(0, xs.min() - 2), max(0, ys.min() - 2))
data['torso']['gem'] = local(gem, torso_origin)

with open(ts_out, 'w', newline='\n') as f:
    f.write('/**\n')
    f.write(" * The Neon Striker's parts, cut from Gemini's arms-out drawing (scripts/striker-parts/gemini-spread.jpg)\n")
    f.write(' * by a script: each is a picture in public/fighters/striker/, hung between two joints.\n')
    f.write(' * `a` and `b` are where those joints sit in the picture (pixels); `gem` is the core gem on the torso.\n')
    f.write(' * Generated: edit the cutting script, not this file.\n')
    f.write(' */\n')
    f.write('export interface StrikerPart {\n  w: number;\n  h: number;\n  a: [number, number];\n  b: [number, number];\n  gem?: [number, number];\n}\n\n')
    f.write('export const STRIKER_PARTS = ')
    f.write(json.dumps(data, indent=2))
    f.write(' as const satisfies Record<string, StrikerPart>;\n')
print('wrote', ts_out)
