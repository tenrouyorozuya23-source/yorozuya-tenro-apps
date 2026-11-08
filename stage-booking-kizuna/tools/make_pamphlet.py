#!/usr/bin/env python3
"""当日パンフレット（A3 二つ折り → A4・右とじ・4ページ）を作る： stage-booking-kizuna/pamphlet/
  pamphlet.html            … 印刷用（A3横 2面：外面＝4ページ｜1ページ、中面＝3ページ｜2ページ）
  pamphlet-print-A3.pdf    … 上の PDF（両面印刷・短辺とじで A3 1枚。中央で折ると右とじの冊子）
  preview-*.png            … 確認用画像
右とじなので、表紙（1ページ）を右に置いて左へめくる。中面は右が2ページ、左が3ページ（見開きで人物相関図）。

使い方：  python3 stage-booking-kizuna/tools/make_pamphlet.py
          node stage-booking-kizuna/tools/render_pamphlet.js   （PDF と画像を書き出す）
配役・グループ・相関・次回公演は下の設定を書き換えて再実行する（いまは「仮」のサンプル）。
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_cf_site import STAFF, AFFIL, STORY, STORY_LAST, display_casts, DISPLAY_NAME
from make_links import casts_from_code, ROOT

OUT = os.path.join(ROOT, "stage-booking-kizuna", "pamphlet")
ASSETS = "../../kizuna-site/assets"   # pamphlet.html から見た画像の場所
e = html.escape

# ---- グループ（色・陣地）：x, y, w, h は中面（A3横 420×297mm）上の位置。x<210 が3ページ（左）、x>210 が2ページ（右） ----
GROUPS = {
    "family": {"name": "山民の家族", "sub": "戦をしない者達", "color": "#5f8f4e", "box": (256, 124, 118, 64)},
    "guard":  {"name": "護衛団",     "sub": "元・北条家家臣",   "color": "#2f5fa8", "box": (222, 206, 186, 79)},
    "narita": {"name": "成田家",     "sub": "関ヶ原の爪痕を生きる", "color": "#6d4c9c", "box": (14, 44, 132, 64)},
    "bandit": {"name": "盗賊団",     "sub": "紅葉を狙う者達",   "color": "#a8322c", "box": (12, 206, 186, 79)},
}
# ---- 配役（仮）：(キャスト名, 役名, グループ, 一言) ※サンプル用の仮の割り振り ----
ROLES = [
    ("菜乃華れみ", "紅葉", "family", "山民の娘"),
    ("光藤隆馬", "左衛門", "family", "紅葉の父"),
    ("三吉織乃", "奈々", "family", "紅葉の母"),
    ("磐城信治", "梶原景宗", "guard", "護衛団の長"),
    ("屋冨祖弦貴", "役名", "guard", ""),
    ("岡本莉瑚", "役名", "guard", ""),
    ("桑野結女凜", "役名", "guard", ""),
    ("崎本詩織", "役名", "guard", ""),
    ("五味川竜馬", "役名", "guard", ""),
    ("石山将隆", "成田長泰", "narita", "元・北条家家臣"),
    ("柳瀬佑太", "役名", "narita", ""),
    ("藤野めいり", "役名", "narita", ""),
    ("尾ケ井思織", "役名", "narita", ""),
    ("天咲ヒカル", "役名", "bandit", "盗賊団の頭"),
    ("森本真由", "役名", "bandit", ""),
    ("泉谷アキヒロ", "役名", "bandit", ""),
    ("幸村宥弐", "役名", "bandit", ""),
    ("鶴田葵", "役名", "bandit", ""),
]
# ---- 相関の矢印：(from, to, 文字, 色, 両方向か, 曲がり具合)  from/to は "g:グループ" か 役の番号（ROLES の 0 始まり） ----
LINKS = [
    ("g:bandit", 0, "命を狙う", "#a8322c", False, -30),
    (3, 0, "守る", "#2f5fa8", False, 0),
    ("g:family", "g:guard", "一宿一飯の恩義", "#5f8f4e", False, 0),
    (3, 9, "元・北条家の同志", "#8f7443", True, 25),
    ("g:bandit", "g:guard", "対立", "#a8322c", True, 0),
    ("g:narita", "g:bandit", "？", "#6d4c9c", False, 0),
]
# ---- 次回公演（4件・仮） ----
NEXT_SHOWS = [
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
]
SAMPLE_NOTE = "※サンプル：役名・配役・グループ・相関・次回公演は仮の内容です"

CARD_W, PHOTO_H, CARD_H = 26, 34, 47   # キャストカード（mm）


def layout_cards(photo_no):
    """各グループの陣地の中にカードを横一列に並べる → [(x, y)]（ROLES の順）"""
    pos = [None] * len(ROLES)
    for g, gv in GROUPS.items():
        idx = [i for i, r in enumerate(ROLES) if r[2] == g]
        x0, y0, w, h = gv["box"]
        gap = min(8, (w - 8 - CARD_W * len(idx)) / max(1, len(idx) - 1)) if len(idx) > 1 else 0
        total = CARD_W * len(idx) + gap * (len(idx) - 1)
        sx = x0 + (w - total) / 2
        for k, i in enumerate(idx):
            pos[i] = (sx + k * (CARD_W + gap), y0 + 9 + (h - 9 - CARD_H) / 2)
    return pos


def anchor(ref, pos):
    """矢印の端点に使う中心と半径（箱）"""
    if isinstance(ref, str) and ref.startswith("g:"):
        x, y, w, h = GROUPS[ref[2:]]["box"]
        return (x + w / 2, y + h / 2, w / 2, h / 2)
    x, y = pos[ref]
    return (x + CARD_W / 2, y + CARD_H / 2, CARD_W / 2 + 1.5, CARD_H / 2 + 1.5)


def clip(cx, cy, hw, hh, tx, ty):
    """箱の中心から (tx,ty) へ向かう線が箱の縁と交わる点"""
    dx, dy = tx - cx, ty - cy
    if dx == 0 and dy == 0:
        return cx, cy
    s = min(hw / abs(dx) if dx else 1e9, hh / abs(dy) if dy else 1e9)
    return cx + dx * s, cy + dy * s


def links_svg(pos):
    out = []
    for i, (a, b, label, color, both, bend) in enumerate(LINKS):
        ax, ay, aw, ah = anchor(a, pos)
        bx, by, bw, bh = anchor(b, pos)
        p1 = clip(ax, ay, aw + 1, ah + 1, bx, by)
        p2 = clip(bx, by, bw + 1.5, bh + 1.5, ax, ay)
        mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
        # 曲げ：線に垂直な方向へ bend mm
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        ln = (dx * dx + dy * dy) ** .5 or 1
        cx, cy = mx - dy / ln * bend, my + dx / ln * bend
        lx, ly = (p1[0] + 2 * cx + p2[0]) / 4, (p1[1] + 2 * cy + p2[1]) / 4   # 曲線の中点
        mk = f"m{i}"
        out.append(f'<marker id="{mk}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse">'
                   f'<path d="M0,0 L10,5 L0,10 z" fill="{color}"/></marker>')
        out.append(f'<path d="M{p1[0]:.1f},{p1[1]:.1f} Q{cx:.1f},{cy:.1f} {p2[0]:.1f},{p2[1]:.1f}" fill="none" stroke="{color}" '
                   f'stroke-width=".9" marker-end="url(#{mk})"' + (f' marker-start="url(#{mk})"' if both else "") + '/>')
        tw = 3.6 * len(label) + 5
        out.append(f'<g class="lbl"><rect x="{lx - tw / 2:.1f}" y="{ly - 3.6:.1f}" width="{tw:.1f}" height="7.2" rx="3.6" fill="#fffaf0" stroke="{color}" stroke-width=".5"/>'
                   f'<text x="{lx:.1f}" y="{ly + 1.35:.1f}" fill="{color}">{e(label)}</text></g>')
    return '<svg class="links" viewBox="0 0 420 297" width="420mm" height="297mm">' + "".join(out) + "</svg>"


def main():
    group, casts = casts_from_code()
    photo = {DISPLAY_NAME.get(n, n): i for i, n in enumerate(casts, 1)}   # 表示名 → 写真の番号
    missing = [r[0] for r in ROLES if r[0] not in photo]
    if missing:
        sys.exit("写真が見つからないキャスト: " + "、".join(missing))
    pos = layout_cards(photo)

    zones = "".join(
        f'<div class="zone" style="left:{x}mm;top:{y}mm;width:{w}mm;height:{h}mm;--c:{g["color"]}">'
        f'<div class="zname"><b>{e(g["name"])}</b><span>{e(g["sub"])}</span></div></div>'
        for g in GROUPS.values() for (x, y, w, h) in [g["box"]])
    cards = "".join(
        f'<figure class="card" style="left:{x:.1f}mm;top:{y:.1f}mm;--c:{GROUPS[g]["color"]}">'
        f'<img src="{ASSETS}/cast/{photo[n]:02d}.webp" alt="">'
        f'<figcaption><b>{e(role)}</b><span>{e(n)}</span>' + (f'<i>{e(note)}</i>' if note else "") + '</figcaption></figure>'
        for (n, role, g, note), (x, y) in zip(ROLES, pos))
    legend = "".join(f'<li style="--c:{g["color"]}">{e(g["name"])}</li>' for g in GROUPS.values())
    story = "".join(f"<p>{e(p)}</p>" for p in STORY) + f'<p class="last">{e(STORY_LAST)}</p>'
    staff = "".join(f"<div><dt>{e(r)}</dt><dd>{e(n)}</dd></div>" for r, n in STAFF)
    cast_list = "".join(f'<li>{e(DISPLAY_NAME.get(n, n))}' + (f'<small>（{e(AFFIL[n])}）</small>' if n in AFFIL else "") + '</li>'
                        for _, n in display_casts(casts))
    nexts = "".join(
        f'<article class="next"><div class="ph">フライヤー画像</div><div class="tx">'
        f'<span class="no">NEXT {i}</span><h4>{e(s["title"])}</h4><p>{e(s["date"])}</p><p>{e(s["venue"])}</p><p class="org">{e(s["org"])}</p>'
        f'</div><div class="qr">QR</div></article>'
        for i, s in enumerate(NEXT_SHOWS, 1))
    page = TEMPLATE.format(assets=ASSETS, zones=zones, cards=cards, links=links_svg(pos), legend=legend, story=story,
                           staff=staff, cast_list=cast_list, nexts=nexts, note=e(SAMPLE_NOTE))
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, "pamphlet.html"), "w", encoding="utf-8").write(page)
    print("wrote stage-booking-kizuna/pamphlet/pamphlet.html")


TEMPLATE = """<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>家族の絆 当日パンフレット</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Noto+Serif+JP:wght@500;600;700&family=Shippori+Mincho+B1:wght@500;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=block">
<style>
@page{{size:420mm 297mm;margin:0}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{background:#555}}
:root{{--navy:#08122a;--navy2:#0f1f45;--gold:#c9a96a;--gold-l:#e6cd95;--gold-d:#8f7443;--paper:#f6f0e3;--ink:#1b2340;
  --serif:"Shippori Mincho B1","Noto Serif JP",serif;--num:"Noto Serif JP",serif;--latin:"Cormorant Garamond",serif;--sans:"Zen Kaku Gothic New",sans-serif}}
.sheet{{width:420mm;height:297mm;position:relative;overflow:hidden;display:flex;page-break-after:always;break-after:page;background:#fff}}
.sheet:last-child{{page-break-after:auto;break-after:auto}}
.pg{{width:210mm;height:297mm;position:relative;overflow:hidden}}
.pno{{position:absolute;bottom:7mm;font:500 8pt var(--latin);letter-spacing:.2em;color:var(--gold-d)}}
.pg.l .pno{{left:12mm}} .pg.r .pno{{right:12mm}}

/* ---- 1ページ：表紙（フライヤー表面） ---- */
.p1{{background:var(--navy)}}
.p1 img{{width:100%;height:100%;object-fit:cover;display:block}}

/* ---- 4ページ：裏表紙（スタッフ・次回公演） ---- */
.p4{{background:radial-gradient(120% 80% at 50% 0%,#132657 0%,var(--navy) 60%);color:#f3ede1;padding:14mm 14mm 12mm}}
.p4::before{{content:"";position:absolute;inset:6mm;border:.35mm solid rgba(201,169,106,.5);pointer-events:none}}
.p4::after{{content:"";position:absolute;inset:7.4mm;border:.15mm solid rgba(201,169,106,.3);pointer-events:none}}
.h{{font:700 15pt var(--serif);letter-spacing:.3em;color:var(--gold-l);display:flex;align-items:center;gap:4mm;margin-bottom:5mm}}
.h small{{font:italic 500 10pt var(--latin);letter-spacing:.25em;color:var(--gold)}}
.h::after{{content:"";flex:1;height:.25mm;background:linear-gradient(90deg,var(--gold),transparent)}}
.thanks{{text-align:center;font:500 10pt/1.9 var(--serif);color:#e9e1cf;margin:3mm 0 7mm;letter-spacing:.1em}}
.thanks b{{display:block;font:700 13pt var(--serif);color:var(--gold-l);letter-spacing:.25em;margin-bottom:1mm}}
.staff{{display:grid;grid-template-columns:1fr 1fr;gap:1.6mm 8mm;margin-bottom:5mm}}
.staff div{{display:flex;align-items:baseline;gap:3mm;border-bottom:.15mm dotted rgba(201,169,106,.45);padding-bottom:1.2mm}}
.staff dt{{font:500 8pt var(--sans);color:var(--gold);width:20mm;letter-spacing:.1em}}
.staff dd{{font:700 10.5pt var(--serif);letter-spacing:.08em}}
.castlist{{list-style:none;display:flex;flex-wrap:wrap;gap:1.2mm 4.5mm;font:700 9.5pt var(--serif);margin-bottom:8mm}}
.castlist small{{font:500 6.5pt var(--sans);color:#a3aecb;margin-left:.5mm}}
.nexts{{display:grid;grid-template-columns:1fr 1fr;gap:4mm}}
.next{{display:grid;grid-template-columns:24mm 1fr;grid-template-rows:1fr auto;gap:0 3.5mm;background:rgba(15,31,69,.85);border:.25mm solid rgba(201,169,106,.45);padding:3mm;height:48mm}}
.next .ph{{grid-row:1/3;background:repeating-linear-gradient(45deg,#1a2b55 0 2mm,#15244a 2mm 4mm);border:.2mm solid rgba(201,169,106,.35);display:flex;align-items:center;justify-content:center;font:500 6.5pt var(--sans);color:#a3aecb;writing-mode:vertical-rl}}
.next .no{{font:600 8pt var(--latin);letter-spacing:.25em;color:var(--gold)}}
.next h4{{font:800 12pt var(--serif);color:var(--gold-l);margin:.6mm 0 1.2mm;letter-spacing:.06em}}
.next p{{font:500 7.6pt/1.55 var(--num);color:#e9e1cf}}
.next p.org{{color:#a3aecb;font-size:7pt}}
.next .qr{{justify-self:end;align-self:end;width:13mm;height:13mm;background:#fff;color:#8a8a8a;font:600 6pt var(--sans);display:flex;align-items:center;justify-content:center;grid-column:2}}
.foot{{position:absolute;left:14mm;right:14mm;bottom:12mm;display:flex;align-items:flex-end;justify-content:space-between}}
.foot img{{height:17mm}}
.foot p{{font:500 7.2pt/1.7 var(--sans);color:#c9cfdf;text-align:right}}
.foot p b{{font:700 8.5pt var(--serif);color:var(--gold-l);letter-spacing:.1em}}

/* ---- 中面（2・3ページ）：あらすじ＋人物相関図 ---- */
.inner{{background:var(--paper);color:var(--ink)}}
.inner::before{{content:"";position:absolute;inset:0;background:
  radial-gradient(60% 50% at 75% 20%,rgba(201,169,106,.16),transparent 70%),
  radial-gradient(50% 60% at 15% 80%,rgba(143,116,67,.10),transparent 70%);pointer-events:none}}
.inner .frame{{position:absolute;inset:6mm;border:.35mm solid var(--gold);pointer-events:none}}
.inner .fold{{position:absolute;left:210mm;top:0;bottom:0;border-left:.2mm dashed rgba(143,116,67,.25)}}
.story{{position:absolute;left:222mm;top:14mm;width:188mm;height:100mm;writing-mode:vertical-rl}}
.story h2{{font:800 20pt var(--serif);letter-spacing:.5em;color:var(--navy);padding-left:4mm;margin-left:5mm;border-left:.3mm solid var(--gold)}}
.story h2 small{{display:block;font:italic 500 10pt var(--latin);letter-spacing:.3em;color:var(--gold-d);margin-top:4mm}}
.story .tx{{font:500 9.6pt/1.95 var(--serif);text-align:justify;letter-spacing:.04em}}
.story .tx p{{text-indent:1em}}
.story .tx p.last{{font-weight:800;color:#a8322c;text-indent:0;margin-right:3mm;font-size:11pt}}
.chart-h{{position:absolute;left:14mm;top:13mm;display:flex;align-items:baseline;gap:4mm}}
.chart-h h2{{font:800 20pt var(--serif);letter-spacing:.35em;color:var(--navy)}}
.chart-h small{{font:italic 500 11pt var(--latin);letter-spacing:.3em;color:var(--gold-d)}}
.legend{{position:absolute;left:150mm;top:16mm;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:1mm 4mm;font:700 7.5pt var(--sans)}}
.legend li{{display:flex;align-items:center;gap:1.5mm}}
.legend li::before{{content:"";width:3.2mm;height:3.2mm;border-radius:.6mm;background:var(--c)}}
.zone{{position:absolute;border:.45mm solid var(--c);border-radius:3mm;background:color-mix(in srgb,var(--c) 9%,transparent)}}
.zname{{position:absolute;left:-.45mm;top:-.45mm;background:var(--c);color:#fff;border-radius:3mm 0 3mm 0;padding:1mm 3mm;display:flex;align-items:baseline;gap:2mm}}
.zname b{{font:800 10pt var(--serif);letter-spacing:.2em}}
.zname span{{font:500 6.5pt var(--sans);opacity:.9}}
.links{{position:absolute;left:0;top:0;overflow:visible}}
.links text{{font:700 3.3px var(--sans);text-anchor:middle;letter-spacing:.1px}}
.card{{position:absolute;width:{card_w}mm}}
.card img{{display:block;width:{card_w}mm;height:{photo_h}mm;object-fit:cover;border:.5mm solid var(--c);border-radius:1.2mm;background:#ddd;box-shadow:0 .6mm 1.6mm rgba(0,0,0,.18)}}
.card figcaption{{text-align:center;margin-top:1mm;line-height:1.25}}
.card b{{display:block;font:800 9pt var(--serif);color:var(--c);letter-spacing:.04em;white-space:nowrap}}
.card span{{display:block;font:700 6.6pt var(--sans);color:var(--ink);white-space:nowrap}}
.card i{{display:block;font:500 5.6pt var(--sans);font-style:normal;color:#6b6b67;white-space:nowrap}}
.note{{position:absolute;left:14mm;bottom:8.5mm;font:500 6.5pt var(--sans);color:#a8322c}}
@media screen{{body{{padding:10mm;display:grid;gap:10mm;justify-content:center}} .sheet{{box-shadow:0 2mm 8mm rgba(0,0,0,.4)}}}}
@media print{{html,body{{background:none}}}}
</style></head><body>

<!-- 外面：左＝4ページ（裏表紙）／右＝1ページ（表紙） -->
<section class="sheet outer">
  <div class="pg l p4">
    <p class="thanks"><b>本日はご来場いただき<br>誠にありがとうございます</b>最後までごゆっくりお楽しみください。</p>
    <h3 class="h">出演 <small>CAST</small></h3>
    <ul class="castlist">{cast_list}</ul>
    <h3 class="h">スタッフ <small>STAFF</small></h3>
    <dl class="staff">{staff}</dl>
    <h3 class="h">次回公演のご案内 <small>NEXT STAGE</small></h3>
    <div class="nexts">{nexts}</div>
    <div class="foot"><img src="{assets}/logo.webp" alt="宵牙狼">
      <p><b>BSD presents 公演 宵牙狼「家族の絆」</b><br>制作：(同)萬屋天狼 イベント事業部<br>お問い合わせ：info.tenrou.event@gmail.com</p></div>
  </div>
  <div class="pg r p1"><img src="{assets}/flyer-front-l.webp" alt="家族の絆"></div>
</section>

<!-- 中面：左＝3ページ／右＝2ページ（見開き：あらすじ＋人物相関図） -->
<section class="sheet inner">
  <div class="frame"></div><div class="fold"></div>
  <div class="story"><h2>あらすじ<small>STORY</small></h2><div class="tx">{story}</div></div>
  <div class="chart-h"><h2>人物相関図</h2><small>CHARACTERS</small></div>
  <ul class="legend">{legend}</ul>
  {zones}
  {links}
  {cards}
  <p class="note">{note}</p>
  <span class="pno" style="left:100mm">— 3 —</span><span class="pno" style="left:310mm">— 2 —</span>
</section>
</body></html>
""".replace("{card_w}", str(CARD_W)).replace("{photo_h}", str(PHOTO_H))

if __name__ == "__main__":
    main()
