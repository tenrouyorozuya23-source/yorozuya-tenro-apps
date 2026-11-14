import sys, json, cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S = sys.argv[1]; base_path = sys.argv[2]; out = sys.argv[3]
sys.path.insert(0, "/home/user/yorozuya-tenro-apps/stage-booking-kizuna/tools")
from make_cf_site import STORY, STORY_LAST
base = Image.open(base_path).convert("RGB"); K = base.width / 1448.0
slots = json.load(open(S + "/sk/slots.json"))
slots[4]["photo"][1] = 458; slots[4]["photo"][3] = 164
FONT = S + "/fonts/ShipporiMinchoB1-ExtraBold.ttf"
C = S + "/sohkan/"
# 枠の順番 → （カード画像, キャスト名）
ORDER = [(C+"16.jpg","幸村 宥弐"),(C+"1.jpg","菜乃華 れみ"),(C+"2.jpg","鶴田 葵"),
         (C+"10.jpg","柳瀬 佑太"),(C+"8.jpg","五味川 竜馬"),(C+"9.jpg","石山 将隆"),(C+"13.jpg","天咲 ヒカル"),(C+"12.jpg","尾ケ井 思織"),(None,"磐城 信治"),
         (C+"3.jpg","三吉 織乃"),
         (C+"17.jpg","桑野 結女凜"),(C+"7.jpg","崎本 詩織"),(C+"15.jpg","泉谷 アキヒロ"),
         (C+"4.jpg","光藤 隆馬"),(S+"/sk/cards/saya.jpg","岡本 莉瑚"),(C+"5.jpg","屋冨祖 絃貴"),(C+"11.jpg","藤野 めいり"),(C+"14.jpg","森本 真由")]
det = None
def feature_box(img):
    """顔と、左下の白い役名の範囲 → (x0,y0,x1,y1)"""
    global det
    a = np.array(img)[:, :, ::-1].copy(); h, w = a.shape[:2]
    sc = 640 / max(h, w); sm = cv2.resize(a, (int(w * sc), int(h * sc)))
    det = cv2.FaceDetectorYN.create(S + "/yunet.onnx", "", (sm.shape[1], sm.shape[0]), 0.6)
    _, f = det.detect(sm)
    boxes = []
    if f is not None:
        fx, fy, fw, fh = (f[0][:4] / sc); boxes.append((fx - fw * .35, fy - fh * .45, fx + fw * 1.35, fy + fh * 1.2))
    m = (a.min(2) > 235).astype(np.uint8); m[: h // 3] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    t = [st[i] for i in range(1, n) if st[i, 4] > 1500]
    if t:
        boxes.append((min(b[0] for b in t) - 25, min(b[1] for b in t) - 25, max(b[0] + b[2] for b in t) + 25, max(b[1] + b[3] for b in t) + 25))
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
def fit(card, tw, th):
    img = Image.open(card).convert("RGB"); img = img.crop((40, 40, img.width - 40, img.height - 40))   # カード自身の金枠を外す
    W, H = img.size; r = tw / th
    x0, y0, x1, y1 = feature_box(img)
    cw, ch = (W, W / r) if W / H < r else (H * r, H)
    if (y1 - y0) > ch or (x1 - x0) > cw:                    # 顔と役名が入りきらないときは少し引いて入れる（余りはぼかした背景で埋める）
        k = max((y1 - y0) / ch, (x1 - x0) / cw); cw, ch = cw * k, ch * k
    cx = min(max((x0 + x1) / 2, cw / 2), W - cw / 2) if cw <= W else W / 2
    cy = min(max((y0 + y1) / 2, ch / 2), H - ch / 2) if ch <= H else H / 2
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    # 下地：画像を枠いっぱいに拡大してぼかしたもの
    cs = max(cw / W, ch / H); bg = img.resize((int(W * cs) + 2, int(H * cs) + 2), Image.LANCZOS)
    bg = bg.crop(((bg.width - int(cw)) // 2, (bg.height - int(ch)) // 2, (bg.width - int(cw)) // 2 + int(cw), (bg.height - int(ch)) // 2 + int(ch)))
    canvas = bg.filter(ImageFilter.GaussianBlur(float(max(cw, ch)) * 0.03))
    canvas = Image.blend(canvas, Image.new("RGB", canvas.size, (0, 0, 0)), 0.25)
    canvas.paste(img, (int(-box[0]), int(-box[1])))
    return canvas.resize((tw, th), Image.LANCZOS)
d = ImageDraw.Draw(base)
for s, (card, name) in zip(slots, ORDER):
    x, y, w, h = [v * K for v in s["photo"]]; ins = 3.2 * K
    tw, th = int(w - 2 * ins), int(h - 2 * ins)
    if card: base.paste(fit(card, tw, th), (int(x + ins), int(y + ins)))
    else:   # 画像待ち：空欄（暗い無地）
        base.paste(Image.new("RGB", (tw, th), (16, 18, 30)), (int(x + ins), int(y + ins)))
    px, py, pw, ph = [v * K for v in s["plate"]]
    size = ph * 0.66; f = ImageFont.truetype(FONT, int(size))
    while d.textlength(name, font=f) > pw * 0.94: size *= 0.95; f = ImageFont.truetype(FONT, int(size))
    d.text((px + pw / 2, py + ph / 2 + ph * 0.02), name, font=f, fill=(48, 26, 10), anchor="mm")
# あらすじ（横書き・ラベルの右、最後の一文の上）
ax0, ay0, ax1, ay1 = 372 * K, 196 * K, 1328 * K, 306 * K
text = "　" + STORY[0] + "\n　" + STORY[1] + STORY_LAST
fs = 15.5 * K
def layout(fs):
    f = ImageFont.truetype(FONT, int(fs)); lines = []
    for para in text.split("\n"):
        cur = ""
        for ch in para:
            if d.textlength(cur + ch, font=f) > ax1 - ax0 and ch not in "。、」』……":
                lines.append(cur); cur = ch
            else: cur += ch
        lines.append(cur)
    return f, lines
while True:
    f, lines = layout(fs); lh = fs * 1.42
    if len(lines) * lh <= ay1 - ay0: break
    fs *= 0.97
lay = Image.new("L", base.size, 0); ld = ImageDraw.Draw(lay)
y = ay0 + ((ay1 - ay0) - len(lines) * lh) / 2
pos = []
for ln in lines:
    pos.append((ax0, y, ln)); y += lh
for x_, y_, ln in pos: ld.text((x_, y_), ln, font=f, fill=255)
shadow = lay.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(2 * K))
base.paste((0, 0, 0), (0, 0) + base.size, shadow.point(lambda p: int(p * .8)))
base.paste((244, 230, 196), (0, 0) + base.size, lay)
base.save(out, quality=95)
print("font px", round(fs / K, 1), "lines", len(lines))
