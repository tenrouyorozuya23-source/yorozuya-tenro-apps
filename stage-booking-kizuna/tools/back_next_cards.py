import sys, cv2, numpy as np, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S = sys.argv[1]; src = sys.argv[2]; out = sys.argv[3]
base = Image.open(src).convert("RGB"); K = base.width / 1055.0
FB = S + "/fonts/ShipporiMinchoB1-ExtraBold.ttf"; FM = S + "/fonts/ShipporiMinchoB1-Medium.ttf"; FL = S + "/fonts/CormorantGaramond.ttf"
SHOWS = [
    ("宵牙狼", "『大奥（下剋上）』", "2027年3月31日（水）〜4月4日（日）", "アトリエファンファーレ東池袋"),
    ("縁劇ユニット EN環公演", "『侍放浪記 斬 〜旅芸人と双星の姫君〜』", "2027年6月18日（金）〜6月21日（月）", "シアター風姿花伝"),
    ("BSD Presents 本公演", "『さぶらひ〜侍と人斬り』", "2027年9月4日（土）〜9月7日（火）", "シアター風姿花伝"),
    ("BSD Presents 特別公演", "『真田家の復讐』", "2028年1月12日（水）〜1月16日（日）", "シアター風姿花伝"),
]
CARDS = [366, 649, 932]          # 各カードの上端（1055基準）。高さ 266
CX0, CX1, CH = 60, 994, 266
k = lambda v: int(round(v * K))
arr = np.array(base)
def blank(top):
    c = arr[k(top):k(top + CH), k(CX0):k(CX1)].copy()
    hsv = cv2.cvtColor(c, cv2.COLOR_RGB2HSV); h, w = c.shape[:2]
    m = np.zeros((h, w), np.uint8)
    X = lambda v: k(v - CX0); Y = lambda v: k(v)
    # タブの文字（金地の上の暗い字）
    sub = hsv[Y(10):Y(32), X(400):X(655)]; m[Y(10):Y(32), X(400):X(655)] = (sub[:, :, 2] < 110)
    # 団体名（金）・作品名（白）
    sub = hsv[Y(42):Y(142), X(250):X(810)]; m[Y(42):Y(142), X(250):X(810)] = (sub[:, :, 2] > 105)
    # 日程・劇場の文字（バッジの右、白）
    sub = hsv[Y(150):Y(228), X(354):X(800)]; m[Y(150):Y(228), X(354):X(800)] = (sub[:, :, 2] > 130) & (sub[:, :, 1] < 90)
    m = cv2.dilate(m, np.ones((k(3), k(3)), np.uint8))
    c = cv2.inpaint(c, m, k(4), cv2.INPAINT_TELEA)
    # 文字のあった帯は、ぼかした地で置き換えて跡を残さない
    soft = cv2.GaussianBlur(c, (0, 0), K * 14)
    zm = np.zeros((h, w), np.float32)
    zm[Y(40):Y(146), X(240):X(820)] = 1; zm[Y(146):Y(232), X(354):X(810)] = 1
    zm = cv2.GaussianBlur(zm, (0, 0), K * 6)[:, :, None]
    return (c * (1 - zm) + soft * zm).astype(np.uint8)
tpl = [blank(t) for t in CARDS]
# 古いカードの範囲を地の色で埋める（左の無地の帯の行ごとの色＋細かい粒）
strip = arr[k(362):k(1210), k(40):k(56)].astype(float)
rowc = np.median(strip, axis=1)
reg = arr[k(362):k(1210), k(38):k(1018)].astype(float)
rng = np.random.default_rng(3)
fill = np.repeat(rowc[:, None, :], reg.shape[1], axis=1) + cv2.GaussianBlur(rng.normal(0, 6, reg.shape[:2]).astype(np.float32), (0, 0), K * .8)[:, :, None]
yy = np.linspace(0, 1, reg.shape[0])[:, None]; xx = np.linspace(0, 1, reg.shape[1])[None, :]
edge = np.clip(np.minimum(np.minimum(yy / .02, (1 - yy) / .02), np.minimum(xx / .02, (1 - xx) / .02)), 0, 1)[:, :, None]
arr[k(362):k(1210), k(38):k(1018)] = np.clip(reg * (1 - edge) + fill * edge, 0, 255).astype(np.uint8)
img = Image.fromarray(arr); d = ImageDraw.Draw(img)
# 4枚を縮小して並べる
TOP, BOT, GAP = 364, 1226, 10
s = ((BOT - TOP) - GAP * 3) / (CH * 4)
cw, chh = (CX1 - CX0) * s, CH * s; x0 = (1055 - cw) / 2
order = [0, 1, 2, 1]
def text(xy, t, f, fill, anchor="mm", shadow=True, sp=0):
    if shadow:
        lay = Image.new("L", img.size, 0); ImageDraw.Draw(lay).text(xy, t, font=f, fill=255, anchor=anchor)
        img.paste((0, 0, 0), (0, 0) + img.size, lay.filter(ImageFilter.GaussianBlur(K * 1.6)).point(lambda p: int(p * .9)))
    ImageDraw.Draw(img).text(xy, t, font=f, fill=fill, anchor=anchor)
for i, (org, title, date, venue) in enumerate(SHOWS):
    t = Image.fromarray(tpl[order[i]]).resize((k(cw), k(chh)), Image.LANCZOS)
    y0 = TOP + i * (chh + GAP)
    fm = Image.new("L", t.size, 0); ImageDraw.Draw(fm).rectangle((k(3), k(3), t.width - k(3), t.height - k(3)), fill=255)
    img.paste(t, (k(x0), k(y0)), fm.filter(ImageFilter.GaussianBlur(K * 3)))
    U = lambda v: v * s; cx = x0 + U(527 - CX0)
    fl = ImageFont.truetype(FL, k(19 * s)); fl.set_variation_by_axes([700])
    lab = "NEXT  STAGE  " + str(i + 1); lab = " ".join(lab)
    text((k(cx), k(y0 + U(21))), lab, fl, (40, 24, 8), shadow=False)
    text((k(cx), k(y0 + U(60))), org, ImageFont.truetype(FB, k(23 * s)), (238, 200, 116))
    fs = 36 * s; ft = ImageFont.truetype(FB, k(fs))
    while d.textlength(title, font=ft) > k(U(560)): fs *= .96; ft = ImageFont.truetype(FB, k(fs))
    text((k(cx), k(y0 + U(108))), title, ft, (255, 255, 255))
    fi = ImageFont.truetype(FB, k(21.5 * s))
    bx = x0 + U(362 - CX0)
    text((k(bx), k(y0 + U(171))), date, fi, (248, 242, 230), anchor="lm")
    text((k(bx), k(y0 + U(209))), venue, fi, (248, 242, 230), anchor="lm")
img.save(out, quality=94)
print("scale", round(s, 3))
