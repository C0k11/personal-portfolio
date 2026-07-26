"""Generate og.png — the link preview card, drawn with the same dusk palette
as the site's canvas background so a shared link matches the page it opens.

Run: py make-og.py   (regenerate only if the palette or copy changes)
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
HORIZON = int(H * 0.66)
OUT = Path(__file__).parent / "og.png"

# same stops as the canvas sky/water in script.js
SKY = [(0.00, (25, 20, 48)), (0.42, (70, 40, 92)), (0.72, (156, 68, 120)),
       (0.92, (229, 122, 90)), (1.00, (242, 176, 106))]
WATER = [(0.00, (217, 148, 107)), (0.12, (163, 82, 124)),
         (0.45, (61, 36, 86)), (1.00, (20, 16, 38))]


def lerp(stops, t):
    for i in range(len(stops) - 1):
        (p0, c0), (p1, c1) = stops[i], stops[i + 1]
        if p0 <= t <= p1:
            f = 0 if p1 == p0 else (t - p0) / (p1 - p0)
            return tuple(round(a + (b - a) * f) for a, b in zip(c0, c1))
    return stops[-1][1]


def font(size, bold=False):
    for name in (("georgiab.ttf", "georgia.ttf") if bold else ("georgia.ttf",)):
        try:
            return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
        except OSError:
            continue
    return ImageFont.load_default()


img = Image.new("RGB", (W, H))
d = ImageDraw.Draw(img)

for y in range(HORIZON):
    d.line([(0, y), (W, y)], fill=lerp(SKY, y / HORIZON))
for y in range(HORIZON, H):
    d.line([(0, y), (W, y)], fill=lerp(WATER, (y - HORIZON) / (H - HORIZON)))

# Sun glow + its reflection, built on a full-size black layer and added in one
# pass. Compositing a cropped region instead leaves a visible rectangular seam.
glow = Image.new("RGB", (W, H), (0, 0, 0))
gd = ImageDraw.Draw(glow)
sx, sy, r = int(W * 0.72), HORIZON - 18, 175
for i in range(r, 0, -2):
    a = (1 - i / r) ** 2.6
    gd.ellipse([sx - i, sy - i, sx + i, sy + i],
               fill=(round(210 * a), round(168 * a), round(112 * a)))
for y in range(HORIZON, H):                       # reflection, fading down and outward
    f = (y - HORIZON) / (H - HORIZON)
    half = int(22 + 105 * f)
    v = (1 - f) ** 1.7
    for step in range(6):                         # nested widths -> horizontal falloff
        w = int(half * (1 - step / 6))
        a = v * (step + 1) / 6 * 0.42
        gd.line([(sx - w, y), (sx + w, y)],
                fill=(round(150 * a), round(110 * a), round(70 * a)))
glow = glow.filter(ImageFilter.GaussianBlur(22))
img = ImageChops.add(img, glow)

d = ImageDraw.Draw(img)
d.text((72, 232), "Jerry Zhang", font=font(92, True), fill=(243, 236, 242))
d.text((74, 348), "Data analyst & engineer", font=font(44), fill=(243, 236, 242))
d.text((74, 412), "pipelines · warehouses · predictive models",
       font=font(34), fill=(215, 195, 214))
d.text((74, 108), "T O R O N T O", font=font(24), fill=(242, 176, 106))

img.save(OUT, quality=92)
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
