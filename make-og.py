"""Generate og.png from the station photo plus nameplate text.

Run: py -X utf8 make-og.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
OUT = Path(__file__).parent / "og.png"
BG = Path(__file__).parent / "assets" / "station-og.jpg"


def font(size, bold=False):
    for name in (("georgiab.ttf", "georgia.ttf") if bold else ("georgia.ttf",)):
        try:
            return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)
        except OSError:
            continue
    return ImageFont.load_default()


img = Image.open(BG).convert("RGB")
if img.size != (W, H):
    img = img.resize((W, H), Image.Resampling.LANCZOS)

# left veil so type stays readable on the bright horizon
veil = Image.new("RGB", (W, H), (12, 18, 52))
mask = Image.new("L", (W, H), 0)
md = ImageDraw.Draw(mask)
for x in range(W):
    a = 0
    if x < 720:
        a = int(150 * (1 - x / 720) ** 1.15)
    md.line([(x, 0), (x, H)], fill=a)
img = Image.composite(veil, img, mask)

d = ImageDraw.Draw(img)
d.text((72, 168), "Jerry Zhang", font=font(92, True), fill=(238, 241, 250))
d.text((74, 284), "Data & ML engineer", font=font(44), fill=(238, 241, 250))
d.text((74, 348), "pipelines \u00b7 warehouses \u00b7 models \u00b7 LLMs",
       font=font(34), fill=(183, 192, 228))
d.text((74, 88), "T O R O N T O", font=font(24), fill=(255, 200, 154))

img.save(OUT, quality=90)
print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")
