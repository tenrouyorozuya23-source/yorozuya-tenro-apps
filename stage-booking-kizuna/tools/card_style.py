# Drive のキャラ画像と同じ作り（1045×1565、金の二重線、左下に白＋黒縁の筆文字）のカードを作る
import sys, json, numpy as np
from PIL import Image, ImageOps, ImageFilter, ImageDraw
CW, CH = 1045, 1565
GOLD = (214, 182, 112)
def grow(m, px):
    while px > 0:
        k = min(px * 2 + 1, 15) | 1; m = m.filter(ImageFilter.MaxFilter(k)); px -= (k - 1) // 2
    return m
def make(photo, glyph_alpha, n_chars, out, crop=None):
    im = ImageOps.exif_transpose(Image.open(photo)).convert("RGB")
    if crop: im = im.crop(crop)
    # 2:3 にトリミングして縮小
    W, H = im.size; r = CW / CH
    if W / H > r: nw = int(H * r); im = im.crop(((W - nw) // 2, 0, (W - nw) // 2 + nw, H))
    else: nh = int(W / r); im = im.crop((0, 0, W, nh))
    im = im.resize((CW, CH), Image.LANCZOS)
    # 下側を少し暗く
    g = Image.linear_gradient("L").resize((CW, CH)).point(lambda p: int(max(0, p - 150) * 1.6))
    im.paste((10, 10, 16), (0, 0, CW, CH), g)
    # 筆文字
    a = glyph_alpha.crop(glyph_alpha.point(lambda p: 255 if p > 20 else 0).getbbox())
    th = 290 if n_chars == 1 else 450
    a = a.resize((max(1, int(a.width * th / a.height)), th), Image.LANCZOS)
    if n_chars == 1 and a.width > 270: a = a.resize((270, int(a.height * 270 / a.width)), Image.LANCZOS)
    x = 56 if n_chars == 1 else 95; y = (1440 if n_chars == 1 else 1480) - a.height
    mask = Image.new("L", (CW, CH), 0); mask.paste(a, (x, y), a)
    full = grow(mask, 14)
    halo = grow(mask, 22).filter(ImageFilter.GaussianBlur(18)).point(lambda p: int(p * .7))
    im.paste((0, 0, 0), (0, 0, CW, CH), halo); im.paste((0, 0, 0), (0, 0, CW, CH), full); im.paste((255, 255, 255), (0, 0, CW, CH), mask)
    d = ImageDraw.Draw(im)
    d.rectangle((26, 26, CW - 27, CH - 27), outline=GOLD, width=3); d.rectangle((33, 33, CW - 34, CH - 34), outline=GOLD, width=1)
    im.save(out, quality=95)
if __name__ == "__main__":
    photo, glyph, n, out = sys.argv[1:5]
    ga = Image.open(glyph)
    ga = ga.getchannel("A") if ga.mode == "RGBA" else ImageOps.invert(ga.convert("L"))
    crop = json.loads(sys.argv[5]) if len(sys.argv) > 5 else None
    make(photo, ga, int(n), out, crop)
