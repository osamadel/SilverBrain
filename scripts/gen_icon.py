#!/usr/bin/env python3
"""Generate a coarse pixel-art silver brain app icon with silver flares.
Outputs a 1024x1024 PNG; Tauri's `icon` command derives the rest."""
import math, random
from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
random.seed(7)

# ---------- background: dark slate rounded square with radial glow ----------
def radial_bg():
    s = 96
    g = Image.new("RGB", (s, s))
    px = g.load()
    cx = cy = (s - 1) / 2
    for y in range(s):
        for x in range(s):
            d = math.hypot(x - cx, y - cy) / (cx * 1.18)
            d = min(1.0, d)
            # center -> edge
            r = int(46 - 28 * d)
            gg = int(49 - 30 * d)
            b = int(57 - 33 * d)
            px[x, y] = (max(r, 14), max(gg, 15), max(b, 18))
    return g.resize((SIZE, SIZE), Image.BILINEAR)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
bg = radial_bg().convert("RGBA")
# rounded-square mask (icon shape with margin)
margin = 40
radius = 200
mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [margin, margin, SIZE - margin, SIZE - margin], radius=radius, fill=255
)
img.paste(bg, (0, 0), mask)

# ---------- brain pixel grid ----------
G = 26                      # logical grid resolution (coarse pixels)
area = SIZE - 2 * margin
inner = int(area * 0.82)    # brain footprint
block = inner / G
ox = (SIZE - inner) / 2
oy = (SIZE - inner) / 2 - SIZE * 0.015

lo = (60, 64, 73)           # cool deep silver
hi = (240, 242, 247)        # near-white silver

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def brain_mask(x, y):
    """x,y in [-1,1]; return True if inside the bumpy brain silhouette."""
    ex, ey = x / 0.96, y / 0.86
    theta = math.atan2(ey, ex)
    d = math.hypot(ex, ey)
    # bumpy gyri lobes around the perimeter, stronger on top
    bump = 0.075 * math.cos(6 * theta) + 0.045 * math.cos(11 * theta + 0.6)
    if ey < 0:
        bump += 0.05 * abs(math.cos(4 * theta))   # rounder, lumpier crown
    thr = 1.0 + bump
    # slightly flatten the very bottom (where the stem attaches)
    if ey > 0.72:
        thr -= (ey - 0.72) * 1.4
    return d < thr

def fold(x, y):
    """sulcus/gyrus shadow field -> higher = deeper groove."""
    central = math.exp(-((x) ** 2) / 0.006)            # central fissure
    waves = 0.5 + 0.5 * math.sin(8.5 * x + 1.7 * math.sin(4.2 * y) + 0.4 * y)
    waves2 = 0.5 + 0.5 * math.sin(6.0 * y - 2.3 * math.cos(5.0 * x))
    g = 0.6 * (waves * 0.6 + waves2 * 0.4)
    return min(1.0, central * 0.9 + g)

# draw the coarse pixel brain on its own layer
brain = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
bd = ImageDraw.Draw(brain)
for gy in range(G):
    for gx in range(G):
        x = (gx + 0.5) / G * 2 - 1
        y = (gy + 0.5) / G * 2 - 1
        if not brain_mask(x, y):
            continue
        # lighting from upper-left
        light = 0.5 - 0.42 * y - 0.22 * x
        f = fold(x, y)
        v = 0.60 + 0.55 * light - 0.62 * f
        # rim darkening near silhouette edge
        d = math.hypot(x / 0.96, y / 0.86)
        if d > 0.86:
            v -= (d - 0.86) * 1.6
        v += random.uniform(-0.05, 0.05)
        v = max(0.10, min(1.0, v))
        v = round(v * 6) / 6           # band into coarse silver steps
        col = lerp(lo, hi, v)
        px0 = ox + gx * block
        py0 = oy + gy * block
        # tiny gap between blocks -> crisp pixel grid
        bd.rectangle([px0 + 1, py0 + 1, px0 + block - 1, py0 + block - 1], fill=col + (255,))

# brain stem (a few stacked blocks below center)
sx = ox + (G / 2 - 1) * block
sy = oy + (G - 1.5) * block
for i in range(3):
    col = lerp(lo, hi, 0.5 - i * 0.08)
    bd.rectangle([sx + 1, sy + i * block + 1, sx + 2 * block - 1, sy + (i + 1) * block - 1], fill=col + (255,))

# soft silver glow derived from the brain silhouette, then the sharp brain on top
glow = brain.filter(ImageFilter.GaussianBlur(30))
img = Image.alpha_composite(img, glow)
img = Image.alpha_composite(img, glow)   # double for a denser halo
img = Image.alpha_composite(img, brain)

# ---------- silver lens flares ----------
def flare(cx, cy, length, core, alpha):
    fl = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(fl)
    col = (235, 238, 245, alpha)
    # cross rays
    d.line([cx - length, cy, cx + length, cy], fill=col, width=6)
    d.line([cx, cy - length, cx, cy + length], fill=col, width=6)
    # diagonal shorter rays
    dl = int(length * 0.6)
    d.line([cx - dl, cy - dl, cx + dl, cy + dl], fill=(235, 238, 245, int(alpha * 0.6)), width=4)
    d.line([cx - dl, cy + dl, cx + dl, cy - dl], fill=(235, 238, 245, int(alpha * 0.6)), width=4)
    fl = fl.filter(ImageFilter.GaussianBlur(3))
    # bright core
    cd = ImageDraw.Draw(fl)
    cd.ellipse([cx - core, cy - core, cx + core, cy + core], fill=(255, 255, 255, 255))
    fl = fl.filter(ImageFilter.GaussianBlur(2))
    return fl

for (cx, cy, ln, core, a) in [
    (int(SIZE * 0.30), int(SIZE * 0.30), 150, 16, 230),   # top-left glint over crown
    (int(SIZE * 0.74), int(SIZE * 0.26), 120, 12, 200),   # top-right spark
    (int(SIZE * 0.70), int(SIZE * 0.72), 95, 9, 160),     # lower-right small
]:
    img = Image.alpha_composite(img, flare(cx, cy, ln, core, a))

# clip everything back to the rounded icon shape
out = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
out.paste(img, (0, 0), mask)
out.save("icon-source.png")
print("wrote icon-source.png")
