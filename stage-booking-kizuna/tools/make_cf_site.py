#!/usr/bin/env python3
"""Cloudflare Pages 用の本番予約サイトを生成する： kizuna-site/
  kizuna-site/index.html   … トップページ（1ページ構成）
  kizuna-site/_redirects   … /c/1〜/c/18 = キャスト選択済みの予約フォーム、/form = 通常の予約フォーム
  kizuna-site/_headers     … キャッシュ等の設定
  kizuna-site/assets/      … ロゴ・キービジュアル・フライヤー・キャスト写真（cast/01.webp〜 は Code.gs のキャスト順）
Cloudflare Pages では「ビルドの出力ディレクトリ」に kizuna-site を指定する（ビルドコマンドは不要）。
キャスト・公演情報を変えたら再実行する：  python3 stage-booking-kizuna/tools/make_cf_site.py
未確定の情報は下の設定を書き換えて再実行する。
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_links import casts_from_code, prefilled, FORM_URL, ROOT
from make_site import SHOWS, SEATS, GOODS

OUT = os.path.join(ROOT, "kizuna-site")
SITE_URL = "https://yoigarou.kizuna.tenrou.info"  # 本番ドメイン（yoigaro.kizuna.tenrou.info でも同じサイトが開く）

# ---- 公演情報（フライヤー裏面より） ----
STAFF = [("脚本・演出", "幸村宥弐"), ("音響", "村上隆二"), ("照明", "建部雅代"), ("小道具", "高津装飾美術"),
         ("衣装", "BSD"), ("制作", "萬屋天狼"), ("主催", "BSD")]
AFFIL = {"鶴田葵": "株式会社ブルーフコーポレーション", "三吉織乃": "仮面女子",
         "崎本詩織": "株式会社グローアップ", "五味川竜馬": "ユニットばんぶるびい"}
STORY = ("難攻不落と言われた小田原城が豊臣により滅ぼされた。北条家の滅亡……そんな戦の爪痕の中でも人は生きる。"
         "元北条家家臣『梶原景宗』は護衛団を名乗りその日暮らしとなっていた。又同じく北条家家臣であった『成田長泰』も関ヶ原の爪痕を生きていた。"
         "そんな中付近の山中ではひっそりと暮らす山民の家族がいた。娘の紅葉。父の左衛門。母の奈々。戦をしない者達の物語が始まる。",
         "紅葉は帰りの道中に何者かに襲われるが、護衛団達に救われる。その日暮らしの護衛団達はお助け代金をもらおうとするが山小屋暮らしの者達に支払える余裕はない。"
         "変わりに宿と食事。一宿一飯の恩義で返す。そんな時ある盗賊団が紅葉を襲う。守る護衛団達。何故紅葉を襲うのか……"
         "謎が謎を呼びそれは次第に一つの真実に辿り着く。")
STORY_LAST = "紅葉が狙われる訳……それは……"
ONLINE_SHOP_URL = ""  # 事前予約物販（オンライン）の申込ページ。空欄なら「近日公開」と表示
SHOW_COUNT = 7

def main():
    group, casts = casts_from_code()
    e = html.escape
    # 日ごとにまとめる
    days = []
    for d, w, o, s in SHOWS:
        if not days or days[-1][0] != d:
            days.append((d, w, []))
        days[-1][2].append((o, s))
    def day_card(d, w, times):
        m, dd = d.split("/")
        cls = " sat" if w == "土" else " sun" if w == "日" else ""
        ts = "".join(f'<li><span class="t">{s}</span><span class="o">開場 {o}</span></li>' for o, s in times)
        return f'<li class="day{cls}"><div class="date"><span class="m">{m}.</span>{dd}<span class="w">{w}</span></div><ul>{ts}</ul></li>'
    show_rows = "".join(day_card(*x) for x in days)
    seat_rows = "".join(
        f'<li class="seatcard{" top" if i == 0 else ""}"><span class="seat">{n.replace("席", "")}<small>席</small></span>'
        f'<span class="price"><small>¥</small>{p}</span><span class="note">{t}</span></li>'
        for i, (n, p, t) in enumerate(SEATS))
    cast_cards = "".join(
        f'<li><a class="cast" href="/c/{i}" aria-label="{e(n)} の取り扱いで予約する">'
        f'<span class="ph"><img src="/assets/cast/{i:02d}.webp" alt="" width="480" height="640" loading="lazy" decoding="async"></span>'
        f'<span class="nm">{e(n)}</span>' + (f'<span class="af">{e(AFFIL[n])}</span>' if n in AFFIL else '') +
        '<span class="go">この出演者で予約 →</span></a></li>'
        for i, n in enumerate(casts, 1))
    online_goods = "".join(f'<li><span>{e(n)}</span><span class="price">¥{p}</span></li>' for n, p, pre in GOODS if pre)
    staff = "".join(f"<dt>{e(r)}</dt><dd>{e(n)}</dd>" for r, n in STAFF)
    story = "".join(f"<p>{e(p)}</p>" for p in STORY)
    online_btn = (f'<a class="btn" href="{e(ONLINE_SHOP_URL)}" rel="noopener">事前予約物販を申し込む</a>' if ONLINE_SHOP_URL
                  else '<p class="tbd">お申し込み方法は近日公開予定です。</p>')
    page = TEMPLATE.format(show_rows=show_rows, seat_rows=seat_rows, cast_cards=cast_cards, online_goods=online_goods,
                           staff=staff, story=story, story_last=e(STORY_LAST), online_btn=online_btn,
                           show_count=SHOW_COUNT, site=SITE_URL)
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)

    # 短いURL（Cloudflare Pages の _redirects。302＝あとで行き先を変えても問題ない一時転送）
    lines = ["# 自動生成：stage-booking-kizuna/tools/make_cf_site.py", "/form  %s  302" % FORM_URL, "/form/  %s  302" % FORM_URL]
    for i, n in enumerate(casts, 1):
        url = prefilled("%s 【%s】" % (n, group))
        lines += ["/c/%d  %s  302" % (i, url), "/c/%d/  %s  302" % (i, url)]
    open(os.path.join(OUT, "_redirects"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    open(os.path.join(OUT, "_headers"), "w", encoding="utf-8").write(
        "/assets/*\n  Cache-Control: public, max-age=604800\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n")
    print("wrote kizuna-site/ (", len(casts), "casts )")

TEMPLATE = """<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>家族の絆｜BSD presents 舞台公演</title>
<meta name="description" content="BSD presents 舞台「家族の絆」2026年12月4日（金）〜8日（火）全7公演 シアターグリーン BASE THEATER（池袋）。チケット予約受付中。">
<meta name="theme-color" content="#08122a">
<meta property="og:type" content="website">
<meta property="og:title" content="BSD presents 舞台「家族の絆」">
<meta property="og:description" content="2026.12.4（金）〜12.8（火）全7公演／シアターグリーン BASE THEATER（池袋）／チケット予約受付中">
<meta property="og:image" content="{site}/assets/og.jpg">
<meta property="og:url" content="{site}/">
<link rel="canonical" href="{site}/">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/logo.webp">
<link rel="preload" as="image" href="/assets/kv.webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Shippori+Mincho+B1:wght@500;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<style>
:root{{--bg:#08122a;--bg2:#0c1a3a;--panel:#0f1f45;--panel2:#132657;--line:rgba(201,169,106,.22);--line2:rgba(201,169,106,.45);
  --ink:#f3ede1;--mute:#a3aecb;--gold:#c9a96a;--gold-l:#e6cd95;--gold-d:#8f7443;--red:#b23a34;
  --serif:"Shippori Mincho B1","Hiragino Mincho ProN","Yu Mincho",serif;--latin:"Cormorant Garamond","Times New Roman",serif}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth;scroll-padding-top:64px;-webkit-text-size-adjust:100%}}
@media (prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}*{{transition:none!important}}}}
body{{margin:0;color:var(--ink);font-family:"Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",sans-serif;font-size:15px;line-height:1.8;
  background-color:var(--bg);
  background-image:radial-gradient(120% 60% at 50% 0%,#132a5c 0%,rgba(8,18,42,0) 70%),linear-gradient(180deg,#08122a,#060d20)}}
a{{color:var(--gold-l)}}
img{{display:block;max-width:100%;height:auto}}
.wrap{{max-width:1040px;margin:0 auto;padding-inline:16px}}
h1,h2,h3{{font-family:var(--serif);font-weight:700;margin:0;text-wrap:balance}}

/* nav */
nav{{position:sticky;top:0;z-index:20;background:rgba(8,18,42,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}}
nav .wrap{{display:flex;align-items:center;gap:18px;height:56px}}
nav .brand{{font-family:var(--serif);font-weight:800;color:var(--ink);text-decoration:none;letter-spacing:.2em;white-space:nowrap}}
nav ul{{display:flex;gap:18px;list-style:none;margin:0 0 0 auto;padding:0}}
nav ul a{{color:var(--mute);text-decoration:none;font-size:.82rem;letter-spacing:.08em;white-space:nowrap}}
nav ul a:hover,nav ul a:focus-visible{{color:var(--gold-l)}}
.navcta{{margin-left:auto;background:linear-gradient(180deg,var(--gold-l),var(--gold));color:#0a1530;padding:7px 16px;border-radius:2px;font-weight:700;font-size:.8rem;letter-spacing:.1em;text-decoration:none;white-space:nowrap}}
nav ul+.navcta{{margin-left:0}}

/* hero */
.hero{{position:relative;isolation:isolate;overflow:hidden;border-bottom:1px solid var(--line)}}
.hero .kv{{position:absolute;inset:0;z-index:-1}}
.hero .kv img{{width:100%;height:100%;object-fit:cover;object-position:50% 18%}}
.hero .kv::after{{content:"";position:absolute;inset:0;background:
  linear-gradient(180deg,rgba(8,18,42,.15) 0%,rgba(8,18,42,0) 30%,rgba(8,18,42,.55) 62%,var(--bg) 100%),
  linear-gradient(90deg,rgba(8,18,42,.35),rgba(8,18,42,0) 30%,rgba(8,18,42,0) 70%,rgba(8,18,42,.35));mix-blend-mode:normal}}
.hero .inner{{min-height:min(88vh,860px);display:flex;flex-direction:column;align-items:center;justify-content:flex-end;text-align:center;padding:48vh 16px 40px}}
.hero .logo{{width:200px;height:auto;filter:drop-shadow(0 6px 20px rgba(0,0,0,.6))}}
.presents{{font-family:var(--latin);font-style:italic;letter-spacing:.3em;color:var(--gold-l);font-size:.95rem;margin:6px 0 2px}}
.hero h1{{font-size:clamp(1.9rem,5.6vw,2.9rem);letter-spacing:.35em;margin-right:-.35em;text-shadow:0 2px 18px rgba(0,0,0,.6)}}
.facts{{display:flex;flex-wrap:wrap;justify-content:center;gap:0;margin:18px 0 0;padding:0}}
.facts div{{padding:4px 22px;border-left:1px solid var(--line2)}}
.facts div:first-child{{border-left:0}}
.facts dt{{font-family:var(--latin);letter-spacing:.3em;color:var(--gold);font-size:.78rem;text-transform:uppercase}}
.facts dd{{margin:0;font-family:var(--serif);font-weight:700;font-size:1.08rem;text-shadow:0 2px 10px rgba(0,0,0,.7)}}
.facts .n{{font-family:var(--latin);font-size:1.35rem;font-weight:600;letter-spacing:.04em}}

.btn{{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:14px 34px;border-radius:2px;
  background:linear-gradient(180deg,var(--gold-l),var(--gold));color:#0a1530;font-weight:700;letter-spacing:.12em;text-decoration:none;font-size:1rem;border:0;
  box-shadow:0 8px 28px rgba(201,169,106,.22),inset 0 1px 0 rgba(255,255,255,.35);transition:filter .2s,transform .2s}}
.btn:hover{{filter:brightness(1.08);transform:translateY(-1px)}}
.btn:focus-visible,.cast:focus-visible,nav a:focus-visible{{outline:2px solid var(--gold-l);outline-offset:3px}}
.btn.big{{font-size:1.12rem;padding:18px 52px}}
.btn .arr{{font-family:var(--latin);font-size:1.2em;line-height:1}}
.apply{{display:flex;flex-direction:column;align-items:center;gap:10px;padding:34px 16px 6px;text-align:center}}
.lead{{color:var(--mute);margin:0;font-size:.9rem}}

/* sections */
section{{padding-block:56px 8px}}
.hd{{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;margin-bottom:26px}}
.hd .en{{font-family:var(--latin);font-style:italic;font-weight:500;color:var(--gold);letter-spacing:.32em;font-size:1rem;text-transform:uppercase}}
.hd h2{{font-size:1.5rem;letter-spacing:.18em}}
.hd::after{{content:"";width:160px;height:1px;margin-top:12px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}}
.tbd{{color:var(--mute);margin:0;text-align:center}}
.frame{{border:1px solid var(--line);background:linear-gradient(180deg,rgba(19,38,87,.55),rgba(12,26,58,.55));position:relative}}
.frame::before{{content:"";position:absolute;inset:5px;border:1px solid rgba(201,169,106,.12);pointer-events:none}}

/* schedule */
.days{{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(5,1fr);gap:10px}}
.day{{padding:18px 12px 16px;text-align:center}}
.day .date{{font-family:var(--latin);font-weight:600;font-size:2.3rem;line-height:1;color:var(--ink)}}
.day .m{{font-size:1.05rem;color:var(--mute);margin-right:2px}}
.day .w{{display:block;font-family:var(--serif);font-size:.85rem;color:var(--gold);margin-top:8px;letter-spacing:.2em}}
.day.sat .w{{color:#9db8ff}} .day.sun .w{{color:#f08f86}}
.day ul{{list-style:none;margin:12px 0 0;padding:12px 0 0;border-top:1px solid var(--line);display:grid;gap:8px}}
.day .t{{display:block;font-family:var(--latin);font-weight:600;font-size:1.45rem;line-height:1.1;letter-spacing:.04em}}
.day .o{{display:block;color:var(--mute);font-size:.74rem;font-variant-numeric:tabular-nums}}
.cap{{text-align:center;color:var(--mute);font-size:.85rem;margin:14px 0 0}}

/* flyer */
.flyers{{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:820px;margin:0 auto}}
.flyers a{{display:block;padding:8px;transition:transform .25s,border-color .25s}}
.flyers a:hover{{transform:translateY(-3px);border-color:var(--line2)}}
.flyers img{{width:100%;height:auto;box-shadow:0 14px 40px rgba(0,0,0,.45)}}
.flyers span{{display:block;text-align:center;font-family:var(--latin);font-style:italic;color:var(--mute);letter-spacing:.2em;font-size:.85rem;margin-top:8px}}
.story{{max-width:720px;margin:30px auto 0;padding:26px 28px}}
.story h3{{font-size:1.05rem;letter-spacing:.3em;color:var(--gold-l);text-align:center;margin-bottom:12px}}
.story p{{margin:0 0 .9em;font-family:var(--serif);font-weight:500;font-size:.95rem;line-height:2}}
.story .last{{color:#e48a80;font-weight:700;margin:0}}

/* cast */
.casts{{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(6,1fr);gap:18px 14px}}
.cast{{display:flex;flex-direction:column;align-items:center;text-decoration:none;color:var(--ink);text-align:center}}
.cast .ph{{position:relative;display:block;width:100%;aspect-ratio:3/4;padding:4px;border:1px solid var(--line2);background:var(--panel);overflow:hidden}}
.cast .ph img{{width:100%;height:100%;object-fit:cover;transition:transform .5s}}
.cast .ph::after{{content:"";position:absolute;inset:4px;background:linear-gradient(180deg,rgba(8,18,42,0) 60%,rgba(8,18,42,.35));pointer-events:none}}
.cast:hover .ph img{{transform:scale(1.04)}}
.cast:hover .ph{{border-color:var(--gold)}}
.cast .nm{{font-family:var(--serif);font-weight:700;font-size:.98rem;margin-top:9px;letter-spacing:.06em}}
.cast .af{{color:var(--mute);font-size:.68rem;line-height:1.4;margin-top:1px}}
.cast .go{{font-size:.7rem;color:var(--gold);margin-top:4px;letter-spacing:.04em}}

/* ticket */
.seats{{list-style:none;margin:0 auto;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;max-width:860px}}
.seatcard{{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:24px 14px;border:1px solid var(--line);background:linear-gradient(180deg,rgba(19,38,87,.55),rgba(12,26,58,.55))}}
.seatcard.top{{border-color:var(--gold);background:linear-gradient(180deg,rgba(201,169,106,.16),rgba(19,38,87,.5))}}
.seat{{font-family:var(--latin);font-weight:600;font-size:2.4rem;line-height:1;color:var(--gold-l);letter-spacing:.05em}}
.seat small{{font-family:var(--serif);font-size:.9rem;margin-left:2px;color:var(--gold)}}
.seatcard .price{{font-family:var(--latin);font-weight:600;font-size:1.9rem;line-height:1.1;font-variant-numeric:tabular-nums}}
.seatcard .price small{{font-size:.6em;margin-right:2px}}
.seatcard .note{{color:var(--mute);font-size:.82rem;line-height:1.5}}
.callout{{max-width:860px;margin:18px auto 0;padding:14px 18px;border:1px solid var(--line2);text-align:center;background:rgba(201,169,106,.07)}}
.callout b{{color:var(--gold-l)}}
.flow{{max-width:860px;margin:30px auto 0}}
.flow h3{{font-size:1rem;letter-spacing:.2em;text-align:center;margin-bottom:14px;color:var(--gold-l)}}
.steps{{margin:0;padding:0;list-style:none;counter-reset:s;display:grid;gap:10px;font-size:.92rem}}
.steps li{{counter-increment:s;display:grid;grid-template-columns:34px 1fr;gap:12px;align-items:center}}
.steps li::before{{content:counter(s);width:32px;height:32px;background:linear-gradient(180deg,var(--gold-l),var(--gold));color:#0a1530;font-family:var(--latin);font-weight:600;font-size:1.05rem;display:flex;align-items:center;justify-content:center;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}}
.ctr{{text-align:center;margin-top:26px}}

/* staff */
.staff{{max-width:480px;margin:0 auto;padding:24px 28px;display:grid;grid-template-columns:auto 1fr;gap:10px 28px}}
.staff dt{{color:var(--gold);font-size:.85rem;letter-spacing:.15em;text-align:right}}
.staff dd{{margin:0;font-family:var(--serif);font-weight:700}}

/* access */
.access{{display:grid;grid-template-columns:1fr 1.1fr;gap:20px;font-size:.9rem;align-items:start}}
.access dl{{margin:0;padding:22px 24px;display:grid;grid-template-columns:auto 1fr;gap:8px 18px}}
.access dt{{color:var(--gold);white-space:nowrap}} .access dd{{margin:0}}
.access .name{{font-family:var(--serif);font-weight:700;font-size:1.05rem}}
.map{{width:100%;height:100%;min-height:280px;border:1px solid var(--line);filter:grayscale(.4) brightness(.9)}}

/* notes */
.notes-box{{max-width:860px;margin:0 auto;padding:24px 28px;display:grid;gap:18px}}
.notes-box h3{{font-size:1rem;letter-spacing:.12em;color:var(--gold-l);margin-bottom:6px}}
.notes{{margin:0;padding-left:1.2em;display:grid;gap:4px;font-size:.92rem}}
.warn{{border-left:2px solid var(--red);padding:10px 14px;background:rgba(178,58,52,.1);font-size:.92rem}}
.warn b{{color:#fff}}

/* goods */
.goods{{list-style:none;margin:0 auto;padding:6px 26px;max-width:640px}}
.goods li{{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);font-size:.95rem}}
.goods li:last-child{{border-bottom:0}}
.goods .price{{font-family:var(--latin);font-weight:600;font-size:1.15rem;white-space:nowrap}}
.goods-note{{text-align:center;margin:0 0 14px}}
.soon{{font-family:var(--latin);font-style:italic;font-weight:500;font-size:2.4rem;letter-spacing:.3em;color:var(--gold);margin:0;text-align:center}}
#goods .ctr{{margin-top:18px}}

footer{{margin-top:64px;padding:32px 16px 40px;border-top:1px solid var(--line);color:var(--mute);font-size:.82rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}}
footer img{{width:96px;opacity:.9;margin-bottom:6px}}

@media (max-width:880px){{
  .casts{{grid-template-columns:repeat(4,1fr)}}
  .days{{grid-template-columns:repeat(3,1fr)}}
}}
@media (max-width:720px){{
  body{{font-size:14.5px}}
  nav ul{{display:none}}
  nav ul+.navcta{{margin-left:auto}}
  .hero .inner{{min-height:auto;padding:66vw 12px 26px}}
  .hero .kv{{bottom:auto}}
  .hero .kv img{{height:auto}}
  .hero .kv::after{{background:linear-gradient(180deg,rgba(8,18,42,0) 0%,rgba(8,18,42,0) 45%,rgba(8,18,42,.7) 75%,var(--bg) 100%)}}
  .hero .logo{{width:150px}}
  .facts{{flex-direction:column;gap:6px}}
  .facts div{{border-left:0;padding:0}}
  section{{padding-block:44px 4px}}
  .days{{grid-template-columns:repeat(2,1fr);gap:8px}}
  .days .day:last-child{{grid-column:1/-1}}
  .day{{padding:14px 8px}}
  .flyers{{gap:10px}}
  .flyers a{{padding:5px}}
  .story{{padding:20px 18px}}
  .casts{{grid-template-columns:repeat(3,1fr);gap:16px 10px}}
  .cast .nm{{font-size:.86rem}}
  .cast .go{{display:none}}
  .seats{{grid-template-columns:1fr;gap:10px}}
  .seatcard{{display:grid;grid-template-columns:4.2em 1fr;grid-template-rows:auto auto;text-align:left;align-items:center;gap:0 14px;padding:14px 18px}}
  .seatcard .seat{{grid-row:1/3;font-size:2rem}}
  .seatcard .price{{font-size:1.5rem}}
  .access{{grid-template-columns:1fr}}
  .access dl{{padding:18px}}
  .map{{min-height:240px}}
  .staff{{padding:20px}}
  .notes-box{{padding:20px 18px}}
  .goods{{padding:4px 18px}}
  .soon{{font-size:1.9rem}}
}}
</style></head><body>

<nav><div class="wrap">
  <a class="brand" href="#top">家族の絆</a>
  <ul>
    <li><a href="#schedule">日程</a></li><li><a href="#flyer">フライヤー</a></li><li><a href="#cast">出演者</a></li><li><a href="#ticket">チケット</a></li>
    <li><a href="#staff">スタッフ</a></li><li><a href="#access">劇場</a></li><li><a href="#notes">注意事項</a></li><li><a href="#goods">物販</a></li>
  </ul>
  <a class="navcta" href="/form">チケット予約</a>
</div></nav>

<header class="hero" id="top">
  <div class="kv"><img src="/assets/kv.webp" alt="" width="1600" height="1392" fetchpriority="high"></div>
  <div class="inner">
    <img class="logo" src="/assets/logo.webp" alt="宵牙狼" width="480" height="360">
    <div class="presents">BSD Presents</div>
    <h1>舞台「家族の絆」</h1>
    <dl class="facts">
      <div><dt>Date</dt><dd><span class="n">2026.12.4</span>（金）〜<span class="n">12.8</span>（火）</dd></div>
      <div><dt>Theater</dt><dd>シアターグリーン BASE THEATER</dd></div>
      <div><dt>Stages</dt><dd>全<span class="n">{show_count}</span>公演</dd></div>
    </dl>
  </div>
</header>

<main class="wrap">
<div class="apply">
  <a class="btn big" href="/form">チケットを申し込む <span class="arr">→</span></a>
  <p class="lead">出演者を指定してお申し込みの場合は、下の「出演者」からお選びください。</p>
</div>

<section id="schedule">
  <div class="hd"><span class="en">Schedule</span><h2>公演スケジュール</h2></div>
  <ul class="days">{show_rows}</ul>
  <p class="cap">開場は開演の30分前／各回60席</p>
</section>

<section id="flyer">
  <div class="hd"><span class="en">Flyer</span><h2>フライヤー</h2></div>
  <div class="flyers">
    <a class="frame" href="/assets/flyer-front-l.webp" target="_blank" rel="noopener"><img src="/assets/flyer-front.webp" alt="「家族の絆」フライヤー表面" width="1400" height="1964" loading="lazy"><span>Front</span></a>
    <a class="frame" href="/assets/flyer-back-l.webp" target="_blank" rel="noopener"><img src="/assets/flyer-back.webp" alt="「家族の絆」フライヤー裏面（出演者・あらすじ・タイムテーブル・チケット料金・スタッフ）" width="1400" height="1964" loading="lazy"><span>Back</span></a>
  </div>
  <div class="story frame">
    <h3>あらすじ</h3>
    {story}
    <p class="last">{story_last}</p>
  </div>
</section>

<section id="cast">
  <div class="hd"><span class="en">Cast</span><h2>出演者</h2></div>
  <p class="lead" style="text-align:center;margin-bottom:22px">お写真を押すと、その出演者の取り扱いで予約フォームが開きます。</p>
  <ul class="casts">{cast_cards}</ul>
</section>

<section id="ticket">
  <div class="hd"><span class="en">Ticket</span><h2>チケット</h2></div>
  <ul class="seats">{seat_rows}</ul>
  <div class="callout"><b>お支払いは公演当日、会場受付にて現金のみ</b>となります。</div>
  <div class="flow">
    <h3>お申し込みの流れ</h3>
    <ol class="steps">
      <li>「チケットを申し込む」、または出演者のお写真から予約フォームを開きます</li>
      <li>お名前・メールアドレス・公演日時・席種・枚数を入力して送信します</li>
      <li>予約番号入りの受付メールが届きます（送信元 info.tenrou.event@gmail.com）</li>
      <li>運営事務局より本予約完了のご連絡をお送りします</li>
      <li>当日は受付で予約番号またはお名前をお伝えください</li>
    </ol>
  </div>
  <div class="ctr"><a class="btn" href="/form">チケットを申し込む <span class="arr">→</span></a></div>
</section>

<section id="staff">
  <div class="hd"><span class="en">Staff</span><h2>スタッフ</h2></div>
  <dl class="staff frame">{staff}</dl>
</section>

<section id="access">
  <div class="hd"><span class="en">Theater</span><h2>劇場マップ</h2></div>
  <div class="access">
    <dl class="frame">
      <dt>劇場</dt><dd class="name">シアターグリーン BASE THEATER</dd>
      <dt>住所</dt><dd>〒171-0022<br>東京都豊島区南池袋2-20-4</dd>
      <dt>JR池袋駅</dt><dd>南改札より地下通路39番出口から徒歩約2分<br>東口から地上で徒歩約6分</dd>
      <dt>東池袋駅</dt><dd>東京メトロ有楽町線 徒歩約5分</dd>
      <dt>雑司ヶ谷駅</dt><dd>都電荒川線 徒歩約7分</dd>
      <dt></dt><dd><a href="https://theater-green.com/access/" rel="noopener">劇場公式のアクセスページ</a></dd>
    </dl>
    <iframe class="map" title="シアターグリーン BASE THEATER の地図" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
      src="https://www.google.com/maps?q=%E3%82%B7%E3%82%A2%E3%82%BF%E3%83%BC%E3%82%B0%E3%83%AA%E3%83%BC%E3%83%B3+BASE+THEATER&output=embed"></iframe>
  </div>
</section>

<section id="notes">
  <div class="hd"><span class="en">Notes</span><h2>注意事項</h2></div>
  <div class="notes-box frame">
    <div>
      <h3>キャンセル・変更について</h3>
      <ul class="notes">
        <li>ご予約のキャンセル・内容の変更は、予約受付メールへの返信、または取り扱いの出演者までご連絡ください。</li>
        <li>ご来場が難しくなった場合は、お早めにご連絡をお願いいたします。</li>
      </ul>
    </div>
    <div>
      <h3>応援花（スタンドフラワー）について</h3>
      <div class="warn"><b>スタンドフラワー等の応援花はお受けしておりません。</b><br>出演者への応援は、事前予約物販の<b>「お祝い札」</b>でお届けいただけます（下の「オンライン物販」をご覧ください）。</div>
    </div>
  </div>
</section>

<section id="goods">
  <div class="hd"><span class="en">Online Goods</span><h2>オンライン物販（事前予約）</h2></div>
  <p class="lead goods-note">各商品、全出演者分をご用意しています。価格は予価です。</p>
  <ul class="goods frame">{online_goods}</ul>
  <div class="ctr">{online_btn}</div>
</section>

<section id="goods-day">
  <div class="hd"><span class="en">Goods</span><h2>当日物販</h2></div>
  <p class="soon">COMING SOON</p>
  <p class="lead" style="text-align:center;margin-top:8px">当日物販の詳細は近日公開予定です。物販は現金のほか各種電子決済がご利用いただけます。</p>
</section>
</main>

<footer>
  <img src="/assets/logo.webp" alt="" width="480" height="360" loading="lazy">
  <div>お問い合わせ：運営事務局 <a href="mailto:info.tenrou.event@gmail.com">info.tenrou.event@gmail.com</a></div>
  <div>主催：BSD　制作：萬屋天狼</div>
</footer>
</body></html>
"""

if __name__ == "__main__":
    main()
