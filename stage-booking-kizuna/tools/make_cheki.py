#!/usr/bin/env python3
"""チェキ券（裏面）の白い枠にキャスト名を書き込む。
  python make_cheki.py 裏面の画像 出力先.png フォント(.ttf)
白い枠（17個）の位置は画像から自動で見つけ、左の列から上→下の順に NAMES を入れる。"""
import sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

# 表記は予約システム・パンフレットと同じ（姓, 名）。並びは見本どおり 6・6・5
NAMES = [("菜乃華", "れみ"), ("鶴田", "葵"), ("三吉", "織乃"), ("光藤", "隆馬"), ("磐城", "信治"), ("屋冨祖", "絃貴"),
         ("岡本", "莉瑚"), ("桑野", "結女凜"), ("崎本", "詩織"), ("五味川", "竜馬"), ("石山", "将隆"), ("柳瀬", "佑太"),
         ("藤野", "めいり"), ("天咲", "ヒカル"), ("森本", "真由"), ("泉谷", "アキヒロ"), ("幸村", "宥弐")]

src, dst, font = sys.argv[1:4]
img = Image.open(src).convert("RGB"); W, H = img.size
bgr = np.array(img)[:, :, ::-1].copy()
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
m = ((hsv[:, :, 2] > 190) & (hsv[:, :, 1] < 60)).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
boxes = [st[i, :4] for i in range(1, n)
         if st[i, 4] > W * H * 0.012 and st[i, 2] > st[i, 3] * 4]          # 横長の白い枠だけ
boxes.sort(key=lambda b: (round(b[0] / (W * 0.2)), b[1]))
if len(boxes) != len(NAMES):
    sys.exit(f"白い枠が {len(boxes)} 個見つかりました（{len(NAMES)} 個のはず）")
d = ImageDraw.Draw(img)
for (x, y, w, h), (sei, mei) in zip(boxes, NAMES):
    size = int(h * 0.56); f = ImageFont.truetype(font, size)
    tx = x + h * 1.08                                                   # 左のチェック欄の右から
    gap = size * 0.45
    total = d.textlength(sei, font=f) + gap + d.textlength(mei, font=f)
    maxw = x + w - h * 0.25 - tx
    if total > maxw:                                                    # 長い名前は少し縮める
        size = int(size * maxw / total); f = ImageFont.truetype(font, size); gap = size * 0.45
    cy = y + h / 2
    for t, xx in ((sei, tx), (mei, tx + d.textlength(sei, font=f) + gap)):
        d.text((xx, cy), t, font=f, fill=(28, 20, 14), anchor="lm")
img.save(dst)
print("wrote", dst, len(boxes), "names")
