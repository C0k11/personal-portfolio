"""Rebuild station layers from the local Wallpaper Engine unpack.

Run: py -X utf8 make-station.py
"""
from pathlib import Path

from PIL import Image

SRC = Path(r"C:\Users\shien\.claude\projects\D--Project\memory\_wp_2504404939")
OUT = Path(__file__).parent / "assets"
W, H = 3652, 1688
TRAIN_Y = (923, 1084)
REFL_Y = (1100, 1253)
PILLAR_XY = (638, 379)


def load(name):
    return Image.open(SRC / name).convert("RGBA")


def main():
    if not (SRC / "layer_02.png").is_file():
        raise SystemExit("missing unpack at " + str(SRC))

    bg = Image.new("RGBA", (W, H), (18, 26, 74, 255))
    plate = Image.alpha_composite(bg, load("layer_02.png"))
    jpg = OUT / "station.jpg"
    plate.convert("RGB").save(jpg, quality=92, subsampling=0, optimize=True)
    print("station.jpg", jpg.stat().st_size, plate.size)

    dock = load("layer_23.png")
    dp = OUT / "dock.png"
    dock.save(dp, optimize=True)
    print("dock.png", dp.stat().st_size, dock.size)

    front = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    front = Image.alpha_composite(front, load("layer_46.png"))
    pillars = load("layer_44.png")
    front.paste(pillars, PILLAR_XY, pillars)
    fp = OUT / "front.png"
    front.save(fp, optimize=True)
    print("front.png", fp.stat().st_size, front.size)

    train = load("layer_33.png").crop((0, TRAIN_Y[0], W, TRAIN_Y[1]))
    refl = load("layer_13.png").crop((0, REFL_Y[0], W, REFL_Y[1]))
    tp = OUT / "train.png"
    rp = OUT / "reflect.png"
    train.save(tp, optimize=True)
    refl.save(rp, optimize=True)
    print("train.png", tp.stat().st_size, train.size, "y", TRAIN_Y)
    print("reflect.png", rp.stat().st_size, refl.size, "y", REFL_Y)
    print("uv train", 1 - TRAIN_Y[1] / H, 1 - TRAIN_Y[0] / H)
    print("uv refl", 1 - REFL_Y[1] / H, 1 - REFL_Y[0] / H)


if __name__ == "__main__":
    main()
