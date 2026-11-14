import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S = sys.argv[1]; base_path = sys.argv[2]; out = sys.argv[3]
sys.path.insert(0, "/home/user/yorozuya-tenro-apps/stage-booking-kizuna/tools")
from make_cf_site import STORY, STORY_LAST
base = Image.open(base_path).convert("RGB"); K = base.width / 1448.0
FONT = S + "/fonts/ShipporiMinchoB1-ExtraBold.ttf"
C = S + "/sohkan/"
# グループの中身を置く範囲（元画像 1448×1086 の座標）と、並べる（カード, キャスト名）
GROUPS = [
    ((72, 466, 578, 634),  [(C+"16.jpg","幸村 宥弐"),(C+"1.jpg","菜乃華 れみ"),(C+"2.jpg","鶴田 葵")]),
    ((612, 466, 1372, 634), [(C+"10.jpg","柳瀬 佑太"),(C+"8.jpg","五味川 竜馬"),(C+"9.jpg","石山 将隆"),(C+"13.jpg","天咲 ヒカル"),(C+"12.jpg","尾ケ井 思織"),(S+"/sk/cards/gantetsu_v.jpg","磐城 信治")]),
    ((70, 738, 314, 896),  [(C+"3.jpg","三吉 織乃")]),
    ((348, 714, 714, 896), [(C+"17.jpg","桑野 結女凜"),(C+"7.jpg","崎本 詩織"),(C+"15.jpg","泉谷 アキヒロ")]),
    ((786, 714, 1378, 896), [(S+"/sk/cards/kajiwara_v.jpg","光藤 隆馬"),(S+"/sk/cards/saya.jpg","岡本 莉瑚"),(C+"5.jpg","屋冨祖 絃貴"),(S+"/sk/cards/okoi_v.jpg","藤野 めいり"),(C+"14.jpg","森本 真由")]),
]
PLATE_H, GAP_V, GAP_H = 25, 5, 10
d = ImageDraw.Draw(base)
def plate(cx, top, w, name):
    x0, y0, x1, y1 = (cx - w / 2) * K, top * K, (cx + w / 2) * K, (top + PLATE_H) * K
    r = PLATE_H * K * 0.32
    d.rounded_rectangle((x0, y0, x1, y1), r, fill=(122, 86, 34))
    d.rounded_rectangle((x0 + 1.2 * K, y0 + 1.2 * K, x1 - 1.2 * K, y1 - 1.2 * K), r * .8, fill=(240, 214, 156), outline=(196, 152, 74), width=max(1, int(.6 * K)))
    size = PLATE_H * K * 0.64; f = ImageFont.truetype(FONT, int(size))
    while d.textlength(name, font=f) > (x1 - x0) * 0.9: size *= 0.95; f = ImageFont.truetype(FONT, int(size))
    d.text(((x0 + x1) / 2, (y0 + y1) / 2 + .3 * K), name, font=f, fill=(52, 28, 10), anchor="mm")
for (ax0, ay0, ax1, ay1), items in GROUPS:
    ims = [Image.open(c).convert("RGB") if c else None for c, _ in items]
    ratios = [im.width / im.height if im else 2 / 3 for im in ims]
    hmax = (ay1 - ay0) - PLATE_H - GAP_V
    h = min(hmax, ((ax1 - ax0) - GAP_H * (len(items) + 1)) / sum(ratios))
    widths = [h * r for r in ratios]
    gap = ((ax1 - ax0) - sum(widths)) / (len(items) + 1)
    gap = min(gap, 26); total = sum(widths) + gap * (len(items) - 1)
    x = ax0 + ((ax1 - ax0) - total) / 2
    # 折り目（ページの中央 x=724）が画像や名前の札にかからないよう、すき間の真ん中に来るまで行をずらす
    FOLD = 724
    if ax0 < FOLD < ax1:
        plw = [min(max(w_, 100), w_ + gap - 3) for w_ in widths]
        def spans(x0_):
            xx = x0_; out_ = []
            for w_, pw_ in zip(widths, plw):
                c = xx + w_ / 2; out_.append((min(xx, c - pw_ / 2), max(xx + w_, c + pw_ / 2))); xx += w_ + gap
            return out_
        sp = spans(x)
        if any(l - 3 < FOLD < r + 3 for l, r in sp):
            gaps = [(sp[i][1] + sp[i + 1][0]) / 2 for i in range(len(sp) - 1)]
            g = min(gaps, key=lambda v: abs(v - FOLD)); nx = x + (FOLD - g)
            if nx >= ax0 and nx + total <= ax1: x = nx
    top = ay0 + ((ay1 - ay0) - (h + GAP_V + PLATE_H)) / 2
    for im, w, (_, name) in zip(ims, widths, items):
        box = (int(x * K), int(top * K), int((x + w) * K), int((top + h) * K))
        sh = Image.new("L", base.size, 0); ImageDraw.Draw(sh).rectangle((box[0] + 2 * K, box[1] + 3 * K, box[2] + 2 * K, box[3] + 3 * K), fill=170)
        base.paste((0, 0, 0), (0, 0) + base.size, sh.filter(ImageFilter.GaussianBlur(3 * K)))
        if im: base.paste(im.resize((box[2] - box[0], box[3] - box[1]), Image.LANCZOS), box[:2])
        else:
            d.rectangle(box, fill=(18, 20, 34), outline=(214, 182, 112), width=max(1, int(.8 * K)))
        plate(x + w / 2, top + h + GAP_V, min(max(w, 100), w + gap - 3), name)
        x += w + gap
# あらすじ（「あらすじ」の右の空き。句点・読点などの区切りで改行）
ax0, ay0, ax1, ay1 = 344 * K, 172 * K, 1334 * K, 372 * K
import re
def tokens(t):
    return [x for x in re.split(r"(?<=[。、』])|(?<=……)", t) if x]
paras = [STORY[0], STORY[1], STORY_LAST]
best = None
for fs_ in [v * K for v in (18, 17.5, 17, 16.5, 16, 15.5, 15, 14.5, 14)]:
    f_ = ImageFont.truetype(FONT, int(fs_)); maxw = ax1 - ax0; L = []
    for k, ptxt in enumerate(paras):
        cur = "　" if k < 2 else ""
        for tk in tokens(ptxt):
            if d.textlength(cur + tk, font=f_) > maxw and cur.strip():
                L.append(cur); cur = tk
            else: cur += tk
        L.append(cur)
    if any(d.textlength(x, font=f_) > maxw for x in L): continue
    if len(L) * fs_ * 1.55 <= ay1 - ay0: best = (fs_, f_, L); break
fs, f, lines = best; lh = fs * 1.55
lay = Image.new("L", base.size, 0); ld = ImageDraw.Draw(lay); gold = Image.new("L", base.size, 0); gd = ImageDraw.Draw(gold)
y = ay0 + ((ay1 - ay0) - len(lines) * lh) / 2
for i, ln in enumerate(lines):
    if i == len(lines) - 1: y += lh * 0.15
    (gd if i == len(lines) - 1 else ld).text((ax0, y), ln, font=f, fill=255); y += lh
both = Image.fromarray(__import__("numpy").maximum(__import__("numpy").array(lay), __import__("numpy").array(gold)))
base.paste((0, 0, 0), (0, 0) + base.size, both.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2 * K)).point(lambda p: int(p * .85)))
base.paste((246, 236, 212), (0, 0) + base.size, lay)
base.paste((240, 196, 108), (0, 0) + base.size, gold)
base.save(out, quality=95)
print("story font", round(fs / K, 1), "lines", len(lines))
