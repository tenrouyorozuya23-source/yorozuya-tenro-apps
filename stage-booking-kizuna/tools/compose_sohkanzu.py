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
    ((52, 500, 666, 684),  [(C+"16.jpg","幸村 宥弐"),(C+"1.jpg","菜乃華 れみ"),(C+"2.jpg","鶴田 葵")]),
    ((704, 500, 1400, 684), [(C+"10.jpg","柳瀬 佑太"),(C+"8.jpg","五味川 竜馬"),(C+"9.jpg","石山 将隆"),(C+"13.jpg","天咲 ヒカル"),(C+"12.jpg","尾ケ井 思織"),(None,"磐城 信治")]),
    ((52, 800, 282, 976),  [(C+"3.jpg","三吉 織乃")]),
    ((310, 774, 708, 976), [(C+"17.jpg","桑野 結女凜"),(C+"7.jpg","崎本 詩織"),(C+"15.jpg","泉谷 アキヒロ")]),
    ((742, 774, 1400, 976), [(C+"4.jpg","光藤 隆馬"),(S+"/sk/cards/saya.jpg","岡本 莉瑚"),(C+"5.jpg","屋冨祖 絃貴"),(C+"11.jpg","藤野 めいり"),(C+"14.jpg","森本 真由")]),
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
# あらすじ
ax0, ay0, ax1, ay1 = 128 * K, 254 * K, 1332 * K, 400 * K
text = "　" + STORY[0] + "\n　" + STORY[1] + "\n" + STORY_LAST
def layout(fs):
    f = ImageFont.truetype(FONT, int(fs)); lines = []
    for para in text.split("\n"):
        cur = ""
        for ch in para:
            if d.textlength(cur + ch, font=f) > ax1 - ax0 and ch not in "。、」』…":
                lines.append(cur); cur = ch
            else: cur += ch
        lines.append(cur)
    return f, lines
fs = 22 * K
while True:
    f, lines = layout(fs); lh = fs * 1.5
    if len(lines) * lh <= ay1 - ay0: break
    fs *= 0.97
lay = Image.new("L", base.size, 0); ld = ImageDraw.Draw(lay); gold = Image.new("L", base.size, 0); gd = ImageDraw.Draw(gold)
y = ay0 + ((ay1 - ay0) - len(lines) * lh) / 2
for i, ln in enumerate(lines):
    (gd if i == len(lines) - 1 else ld).text((ax0, y), ln, font=f, fill=255); y += lh
both = Image.fromarray(__import__("numpy").maximum(__import__("numpy").array(lay), __import__("numpy").array(gold)))
base.paste((0, 0, 0), (0, 0) + base.size, both.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2 * K)).point(lambda p: int(p * .85)))
base.paste((246, 236, 212), (0, 0) + base.size, lay)
base.paste((240, 196, 108), (0, 0) + base.size, gold)
base.save(out, quality=95)
print("story font", round(fs / K, 1), "lines", len(lines))
