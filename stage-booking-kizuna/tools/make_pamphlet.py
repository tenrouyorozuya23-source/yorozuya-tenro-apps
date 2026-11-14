#!/usr/bin/env python3
"""当日パンフレット（A3 二つ折り → A4・右とじ・4ページ）を作る： stage-booking-kizuna/pamphlet/
  pamphlet.html            … 印刷用（A3横 2面：外面＝4ページ｜1ページ、中面＝3ページ｜2ページ）
  pamphlet-print-A3.pdf    … 上の PDF（両面印刷・短辺とじで A3 1枚。中央で折ると右とじの冊子）
  preview-*.png            … 確認用画像
右とじなので、表紙（1ページ）を右に置いて左へめくる。中面は右が2ページ、左が3ページ（見開きで人物相関図）。

構成（クライアント指示 2026/11）
  1ページ … チラシ表面
  2・3ページ … 人物相関図（キャスト紹介。グループ名と各グループの目的だけ。物語の説明・関係の言葉は入れない）
  4ページ … 次回公演の案内（スタッフ欄は載せない）

使い方：  python3 stage-booking-kizuna/tools/make_pamphlet.py
          node stage-booking-kizuna/tools/render_pamphlet.js   （PDF と画像を書き出す）
写真（pamphlet/cards/）とフォント（pamphlet/fonts/）は公開リポジトリに入れない（.gitignore）。
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_links import ROOT
from make_cf_site import STORY, STORY_LAST

OUT = os.path.join(ROOT, "stage-booking-kizuna", "pamphlet")
ASSETS = "../../kizuna-site/assets"
e = html.escape

# ---- グループ：名前・目的（クライアントの言葉どおり）・色・メンバー（キャスト名, 役名, よみ, ひとこと） ----
GROUPS = {
    "family": {"name": "山小屋", "aim": "関ヶ原の爪痕の中ひっそり暮らす山小屋の家族", "color": "#b8322a", "brush": "深紅",
               "members": [("幸村宥弐", "左衛門", "さえもん", "父親"), ("菜乃華れみ", "紅葉", "もみじ", ""),
                           ("鶴田葵", "奈々", "なな", "母親")]},
    "guard": {"name": "護衛団", "aim": "流浪の旅人達", "color": "#2f5fb0", "brush": "藍色",
              "members": [("光藤隆馬", "梶原", "かじわら", ""), ("岡本莉瑚", "鞘", "さや", ""), ("屋冨祖絃貴", "陣", "じん", ""),
                          ("藤野めいり", "お鯉", "おこい", ""), ("森本真由", "お菊", "おきく", "")]},
    "fuma": {"name": "風魔忍軍", "aim": "抜け忍", "color": "#6d3f9a", "brush": "紫",
             "members": [("三吉織乃", "神無月", "かんなづき", "成り上がりを目論む元側室"), ("桑野結女凜", "花蓮", "かれん", ""), ("崎本詩織", "牡丹", "ぼたん", ""), ("泉谷アキヒロ", "奥村", "おくむら", "")]},
    "bandit": {"name": "盗賊団", "aim": "依頼の元に動く盗賊！", "color": "#a8742a", "brush": "金茶",
               "members": [("柳瀬佑太", "影山", "かげやま", ""), ("五味川竜馬", "水月", "すいげつ", ""), ("石山将隆", "鬼火", "おにび", ""),
                           ("天咲ヒカル", "庄司", "しょうじ", ""), ("尾ケ井思織", "雫", "しずく", ""),
                           ("磐城信治", "巌鉄", "がんてつ", "")]},
}
# 中面（420×297mm）の配置：ページごとの領域（x, y, w, h）と、上から並べるグループ（キー, 1行のカード数, カード幅mm）
#   枠の大きさは中身に合わせて自動。グループの間隔は領域の中で均等に割り付ける
#   左ページ上部は背景の満月と城を見せるため空けておく
PAGES = [
    ((12, 80, 186, 204), [("fuma", 4, 32), ("bandit", 3, 31)]),
    ((222, 120, 186, 168), [("family", 3, 34), ("guard", 5, 30)]),
]
STORY_BOX = (226, 53, 178, 62)   # あらすじ（右ページ・タイトルの下）x, y, w, h
# ---- 次回公演（4件・仮） ----
NEXT_SHOWS = [
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
    {"title": "公演タイトル", "date": "2027年○月○日（○）〜○日（○）", "venue": "劇場名", "org": "主催団体名"},
]

SAKURA = ('<svg viewBox="-12 -12 24 24"><g fill="{c}" stroke="#7a2b3a" stroke-width=".35">' +
          "".join(f'<path transform="rotate({a})" d="M0,0 C-3.6,-3 -3.4,-8.6 -1.1,-10.6 L0,-9.2 L1.1,-10.6 C3.4,-8.6 3.6,-3 0,0 Z"/>'
                  for a in (0, 72, 144, 216, 288)) +
          '</g><circle r="1.6" fill="#f7d36b"/></svg>')
MAPLE = ('<svg viewBox="-12 -12 24 24"><path fill="{c}" d="M0,-11 L2,-5 L6,-8 L5,-3 L11,-3 L7,0 L9,4 L3,2 L1,6 L0,11 L-1,6 L-3,2 L-9,4 L-7,0 L-11,-3 L-5,-3 L-6,-8 L-2,-5 Z"/></svg>')


def deco(kind, x, y, size, rot=0, color=None):
    svg = (SAKURA if kind == "s" else MAPLE).replace("{c}", color or ("#f4b8c8" if kind == "s" else "#c8361f"))
    return f'<div class="deco" style="left:{x}mm;top:{y}mm;width:{size}mm;height:{size}mm;transform:rotate({rot}deg)">{svg}</div>'


def group_html(key, per_row, cw):
    g = GROUPS[key]
    ms = g["members"]
    cards = "".join(
        f'<figure class="card"{" data-main" if role == "紅葉" else ""} style="width:{cw + (4 if role == "紅葉" else 0)}mm">'
        f'<div class="ph"><img src="cards/{e(cast)}.jpg" alt=""></div>'
        f'<figcaption><span class="yomi">（{e(yomi)}）</span><b>{e(cast)}</b>' + (f'<i>{e(note)}</i>' if note else "") +
        '</figcaption></figure>'
        for cast, role, yomi, note in ms)
    return (f'<section class="grp" style="--c:{g["color"]}">'
            f'<div class="gh"><h3 style="background-image:url(\'bg/brush_{g["brush"]}.png\')">{e(g["name"])}</h3><p>{e(g["aim"])}</p></div>'
            f'<div class="cards" style="width:{per_row * cw + (per_row - 1) * 3.5 + 4}mm">{cards}</div></section>')


def gold_waves(side):
    paths = []
    for i in range(5):
        o = i * 4
        paths.append(f'<path d="M0,{40+o} C30,{20+o} 50,{60+o} 90,{35+o} S150,{10+o} 200,{30+o}" />')
    flip = ' transform="scale(-1,1) translate(-200,0)"' if side == "r" else ""
    return f'<svg class="waves {side}" viewBox="0 0 200 80"><g{flip}>{"".join(paths)}</g></svg>'


def main():
    groups = "".join(
        f'<div class="col" style="left:{x}mm;top:{y}mm;width:{w}mm;height:{h}mm">' + "".join(group_html(*gr) for gr in grs) + '</div>'
        for (x, y, w, h), grs in PAGES)
    decos = "".join([
        deco("s", 4, 6, 12, 10), deco("s", 15, 3, 8, 40), deco("s", 9, 17, 7, 70), deco("s", 24, 9, 5, 15),
        deco("m", 30, 4, 7, -20), deco("m", 3, 26, 6, 25),
        deco("s", 404, 278, 12, 20), deco("s", 395, 287, 8, 50), deco("s", 410, 266, 6, 5),
        deco("m", 388, 279, 7, 30), deco("m", 412, 255, 5, -15),
        deco("m", 357, 33, 7, 10), deco("m", 365, 28, 5, -30), deco("m", 352, 26, 4, 40),
    ])
    nexts = "".join(
        f'<article class="next"><div class="ph">フライヤー画像</div><div class="tx">'
        f'<span class="no">NEXT STAGE {i}</span><h4>{e(s["title"])}</h4><p>{e(s["date"])}</p><p>{e(s["venue"])}</p><p class="org">{e(s["org"])}</p>'
        f'</div><div class="qr">QR</div></article>'
        for i, s in enumerate(NEXT_SHOWS, 1))
    sx, sy, sw, sh = STORY_BOX
    story = (f'<section class="story" style="left:{sx}mm;top:{sy}mm;width:{sw}mm;height:{sh}mm">'
             f'<h3 style="background-image:url(\'bg/brush_深緑.png\')">あらすじ</h3><div class="tx">'
             + "".join(f"<p>{e(t)}</p>" for t in STORY) + f'<p class="last">{e(STORY_LAST)}</p></div></section>')
    page = TEMPLATE.format(assets=ASSETS, groups=groups + story, decos=decos, nexts=nexts,
                           waves_l=gold_waves("l"), waves_r=gold_waves("r"))
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, "pamphlet.html"), "w", encoding="utf-8").write(page)
    print("wrote stage-booking-kizuna/pamphlet/pamphlet.html")


TEMPLATE = """<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><title>家族の絆 当日パンフレット</title>
<style>
@font-face{{font-family:"Kouzan";src:url("fonts/KouzanMouhituFontOTF.otf")}}
@font-face{{font-family:"Shippori";src:url("fonts/ShipporiMinchoB1-ExtraBold.ttf");font-weight:800}}
@font-face{{font-family:"Shippori";src:url("fonts/ShipporiMinchoB1-Medium.ttf");font-weight:500}}
@font-face{{font-family:"Corm";src:url("fonts/CormorantGaramond.ttf")}}
@page{{size:420mm 297mm;margin:0}}
*{{box-sizing:border-box;margin:0;padding:0}}
html,body{{background:#555}}
.title h1,.title h2,.gh h3,.p4 h2,.p4 .thanks b,.next h4,.p4 .foot p b{{letter-spacing:-.08em!important}}
:root{{--gold:#d8b76a;--gold-l:#f3dc9c;--gold-d:#8f7443;--ink:#f6efe0;--brush:"Kouzan",serif;--serif:"Shippori",serif;--latin:"Corm",serif}}
.sheet{{width:420mm;height:297mm;position:relative;overflow:hidden;display:flex;page-break-after:always;break-after:page;background:#0d0c10}}
.sheet:last-child{{page-break-after:auto;break-after:auto}}
.pg{{width:210mm;height:297mm;position:relative;overflow:hidden}}
/* 和紙調の暗い地 */
.bgimg{{background-size:cover;background-position:center}}
.paper{{background:
  radial-gradient(70% 55% at 30% 35%,rgba(120,105,90,.28),transparent 70%),
  radial-gradient(60% 60% at 75% 70%,rgba(110,95,85,.22),transparent 70%),
  radial-gradient(100% 100% at 50% 50%,#2a2622 0%,#121014 75%);}}
.paper::before{{content:"";position:absolute;inset:0;opacity:.35;mix-blend-mode:overlay;pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")}}
.frame{{position:absolute;inset:5mm;border:.5mm solid var(--gold);box-shadow:0 0 0 .8mm rgba(216,183,106,.25),inset 0 0 0 1.2mm rgba(0,0,0,.4),inset 0 0 0 1.5mm rgba(216,183,106,.55);pointer-events:none;z-index:3}}
.deco{{position:absolute;z-index:4;filter:drop-shadow(0 .4mm .6mm rgba(0,0,0,.6))}}
.deco svg{{width:100%;height:100%;display:block}}
.waves{{position:absolute;width:120mm;height:48mm;z-index:1;opacity:.8}}
.waves path{{fill:none;stroke:url(#gg);stroke:var(--gold);stroke-width:.9;opacity:.75}}
.waves.l{{left:-8mm;bottom:2mm}} .waves.r{{right:-6mm;top:30mm}}
/* ---- 1ページ：表紙 ---- */
.p1 img{{width:100%;height:100%;object-fit:cover;display:block}}
/* ---- 4ページ：次回公演 ---- */
.p4{{padding:22mm 18mm 16mm;color:var(--ink)}}
.p4 .thanks{{position:relative;z-index:2;text-align:center;font:500 10.5pt/2 var(--serif);letter-spacing:.12em;color:#e9e1cf;margin-bottom:12mm}}
.p4 .thanks b{{display:block;font:400 22pt/1.4 var(--brush);color:var(--gold-l);letter-spacing:.12em;margin-bottom:2mm;text-shadow:0 .6mm 1.5mm #000}}
.p4 h2{{position:relative;z-index:2;display:flex;align-items:center;gap:4mm;font:400 20pt var(--brush);color:#fff;letter-spacing:.2em;margin-bottom:7mm}}
.p4 h2 small{{font:italic 500 11pt var(--latin);letter-spacing:.3em;color:var(--gold)}}
.p4 h2::after{{content:"";flex:1;height:.3mm;background:linear-gradient(90deg,var(--gold),transparent)}}
.nexts{{position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr;gap:6mm}}
.next{{display:grid;grid-template-columns:30mm 1fr;grid-template-rows:1fr auto;gap:0 4mm;padding:4mm;height:64mm;
  background:linear-gradient(160deg,rgba(60,40,30,.55),rgba(10,10,14,.75));border:.4mm solid rgba(216,183,106,.7);box-shadow:inset 0 0 0 .8mm rgba(0,0,0,.5),inset 0 0 0 1mm rgba(216,183,106,.3)}}
.next .ph{{grid-row:1/3;background:repeating-linear-gradient(45deg,#2a2420 0 2mm,#221d1a 2mm 4mm);border:.3mm solid rgba(216,183,106,.4);display:flex;align-items:center;justify-content:center;font:500 7pt var(--serif);color:#a99f8c;writing-mode:vertical-rl}}
.next .no{{font:600 8pt var(--latin);letter-spacing:.25em;color:var(--gold)}}
.next h4{{font:400 15pt var(--brush);color:#fff;margin:1mm 0 2mm;letter-spacing:.06em}}
.next p{{font:500 8pt/1.6 var(--serif);color:#e9e1cf}}
.next p.org{{color:#b9ad95;font-size:7.4pt}}
.next .qr{{justify-self:end;align-self:end;width:16mm;height:16mm;background:#fff;color:#8a8a8a;font:600 6pt sans-serif;display:flex;align-items:center;justify-content:center;grid-column:2}}
.p4 .foot{{position:absolute;left:18mm;right:18mm;bottom:15mm;z-index:2;display:flex;align-items:flex-end;justify-content:space-between}}
.p4 .foot img{{height:20mm}}
.p4 .foot p{{font:500 8pt/1.7 var(--serif);color:#cfc6b3;text-align:right}}
.p4 .foot p b{{font:400 11pt var(--brush);color:var(--gold-l);letter-spacing:.1em}}
/* ---- 中面：人物相関図 ---- */
.moon{{position:absolute;left:126mm;top:9mm;width:40mm;height:40mm;border-radius:50%;z-index:2;
  background:radial-gradient(circle at 40% 38%,#fffdf2 0%,#fbefcc 40%,#e9d29a 75%,#cfae6a 100%);
  box-shadow:0 0 8mm 3mm rgba(255,236,180,.35),0 0 22mm 10mm rgba(255,220,150,.12)}}
.moon::after{{content:"";position:absolute;inset:0;border-radius:50%;opacity:.35;
  background:radial-gradient(circle at 30% 60%,rgba(170,140,90,.6) 0 9%,transparent 10%),radial-gradient(circle at 62% 35%,rgba(170,140,90,.5) 0 7%,transparent 8%),radial-gradient(circle at 58% 70%,rgba(170,140,90,.45) 0 12%,transparent 13%)}}
.title{{position:absolute;left:222mm;right:12mm;top:11mm;z-index:5;text-align:center}}
.title .pre{{font:500 9.5pt var(--serif);letter-spacing:.25em;color:#efe6d0}}
.title h1{{font:400 36pt/1.15 var(--brush);letter-spacing:0;margin-top:1mm;
  background:linear-gradient(180deg,#fff6d8 0%,#f0d58c 45%,#b88a3a 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 .5mm .8mm rgba(0,0,0,.9))}}
.title h2{{display:inline-block;margin-top:1mm;padding:3mm 16mm 3.2mm;font:400 18pt var(--brush);color:#fff;
  background:url("bg/brush_深紅.png") center/100% 100% no-repeat;text-shadow:0 .4mm 1mm #000,0 0 2mm rgba(0,0,0,.6)}}
.story{{position:absolute;z-index:5;padding:4mm 5mm 3mm;background:linear-gradient(180deg,rgba(30,40,30,.5),rgba(14,10,9,.62));
  border:.5mm solid color-mix(in srgb,#2e6b4a 45%,#f3dc9c);border-radius:1.2mm;box-shadow:0 0 3mm rgba(46,107,74,.6),inset 0 0 0 .9mm rgba(0,0,0,.45),inset 0 0 0 1.2mm color-mix(in srgb,#2e6b4a 40%,#d8b76a)}}
.story h3{{position:absolute;right:-3mm;top:-8mm;font:400 17pt var(--brush);color:#fff;padding:2.6mm 12mm 3mm 10mm;
  background:center/100% 100% no-repeat;text-shadow:0 .4mm 1mm #000,0 0 2mm rgba(0,0,0,.6);letter-spacing:-.08em}}
.story .tx{{writing-mode:vertical-rl;height:100%;width:100%;overflow:hidden;font:500 9.2pt/1.85 var(--serif);color:#f3ecdc;text-align:justify;letter-spacing:.03em;text-shadow:0 .2mm .5mm #000;padding-top:1.5mm}}
.story .tx p{{text-indent:1em}}
.story .tx p.last{{font-weight:800;color:#f3c26b;text-indent:0;margin-right:2mm}}
.col{{position:absolute;z-index:5;display:flex;flex-direction:column;justify-content:space-evenly;align-items:center}}
.grp{{position:relative;padding:3.5mm 5mm 3mm;
  background:linear-gradient(180deg,color-mix(in srgb,var(--c) 26%,rgba(18,12,10,.55)) 0%,rgba(14,10,9,.62) 60%);
  border:.5mm solid color-mix(in srgb,var(--c) 55%,#f3dc9c);border-radius:1.2mm;
  box-shadow:0 0 3.5mm color-mix(in srgb,var(--c) 70%,transparent),inset 0 0 0 .9mm rgba(0,0,0,.45),inset 0 0 0 1.2mm color-mix(in srgb,var(--c) 40%,#d8b76a)}}
.gh{{margin:-9mm 0 1.5mm -3mm}}
.gh h3{{display:inline-block;font:400 17pt var(--brush);color:#fff;padding:2.6mm 12mm 3mm 7mm;white-space:nowrap;
  background:center/100% 100% no-repeat;text-shadow:0 .4mm 1mm #000,0 0 2mm rgba(0,0,0,.6)}}
.gh p{{font:800 8.6pt var(--serif);color:var(--gold-l);letter-spacing:.05em;margin:1.2mm 0 0 3mm;white-space:nowrap;text-shadow:0 .3mm .6mm #000}}
.cards{{display:flex;flex-wrap:wrap;justify-content:center;gap:2.5mm 3.5mm;margin:0 auto}}
.card{{text-align:center}}
.card .ph{{aspect-ratio:3/4;border:.45mm solid color-mix(in srgb,var(--c) 45%,#f3dc9c);box-shadow:0 0 2mm color-mix(in srgb,var(--c) 70%,transparent);background:#222;overflow:hidden}}
.card img{{width:100%;height:100%;object-fit:cover;display:block}}
.card figcaption{{margin-top:1mm;line-height:1.25}}
.card .yomi{{display:block;font:500 6.6pt var(--serif);color:#d9cfb8;letter-spacing:.05em}}
.card b{{display:block;font:800 8.8pt var(--serif);color:#fff;letter-spacing:.06em;white-space:nowrap}}
.card i{{display:inline-block;margin-top:.6mm;font:800 6.6pt var(--serif);font-style:normal;color:#2a1a0e;background:linear-gradient(180deg,#f6e2a8,#d8b76a);padding:.2mm 2mm;border-radius:.5mm}}
.card[data-main] .ph{{border-width:.7mm;box-shadow:0 0 4mm #e0503f}}
.card[data-main] b{{font-size:9.4pt}}
.pno{{position:absolute;bottom:7.5mm;z-index:6;font:500 8pt var(--latin);letter-spacing:.25em;color:var(--gold)}}
@media screen{{body{{padding:10mm;display:grid;gap:10mm;justify-content:center}} .sheet{{box-shadow:0 2mm 8mm rgba(0,0,0,.4)}}}}
@media print{{html,body{{background:none}}}}
</style></head><body>

<!-- 外面：左＝4ページ（裏表紙・次回公演）／右＝1ページ（表紙・チラシ表面） -->
<section class="sheet">
  <div class="pg p4 bgimg" style="background-image:url('bg/back.webp')">
    <div class="frame"></div>
    <p class="thanks"><b>本日はご来場いただき<br>誠にありがとうございます</b>最後までごゆっくりお楽しみください。</p>
    <h2>次回公演のご案内 <small>NEXT STAGE</small></h2>
    <div class="nexts">{nexts}</div>
    <div class="foot"><img src="{assets}/logo.webp" alt="宵牙狼">
      <p><b>BSD presents 宵牙狼公演「家族の絆」</b><br>制作：(同)萬屋天狼 イベント事業部</p></div>
  </div>
  <div class="pg p1"><img src="{assets}/flyer-front-l.webp" alt="家族の絆"></div>
</section>

<!-- 中面：左＝3ページ／右＝2ページ（見開き：人物相関図） -->
<section class="sheet bgimg" style="background-image:url('bg/spread.webp')">
  <div class="frame"></div>
  <div class="title"><p class="pre">BSD Presents 宵牙狼公演</p><h1>舞台『家族の絆』</h1><h2>人物相関図</h2></div>
  {groups}
  <span class="pno" style="left:101mm">— 3 —</span><span class="pno" style="left:311mm">— 2 —</span>
</section>
</body></html>
"""

if __name__ == "__main__":
    main()
