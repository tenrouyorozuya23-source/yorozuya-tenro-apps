#!/usr/bin/env python3
"""Cloudflare Pages 用の本番予約サイトを生成する： kizuna-site/
  kizuna-site/index.html   … トップページ（1ページ構成）
  kizuna-site/_redirects   … /c/1〜/c/18 = キャスト選択済みの予約フォーム、/form = 通常の予約フォーム
  kizuna-site/_headers     … キャッシュ等の設定
Cloudflare Pages では「ビルドの出力ディレクトリ」に kizuna-site を指定する（ビルドコマンドは不要）。
キャスト・公演情報を変えたら再実行する：  python3 stage-booking-kizuna/tools/make_cf_site.py
未確定の情報（あらすじ・スタッフ・フライヤー画像など）は下の PLACEHOLDER を書き換えて再実行する。
"""
import html, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_links import casts_from_code, prefilled, FORM_URL, ROOT
from make_site import SHOWS, SEATS, GOODS

OUT = os.path.join(ROOT, "kizuna-site")

# ---- 未確定の情報（決まったら書き換える。空欄のままなら「準備中」「COMING SOON」と表示） ----
STAFF = []            # [("脚本・演出", "名前"), ...]
FLYER = ""            # フライヤー画像のファイル名（kizuna-site/assets/ に置く。例 "flyer.jpg"）
ONLINE_SHOP_URL = ""  # 事前予約物販（オンライン）の申込ページ
SHOW_COUNT = 7

def main():
    group, casts = casts_from_code()
    e = html.escape
    show_rows = "".join(
        f'<tr><td><b>{d}</b><span class="dow">（{w}）</span></td><td class="num">{o}</td><td class="num strong">{s}</td></tr>'
        for d, w, o, s in SHOWS)
    seat_rows = "".join(f'<li><span class="seat">{n}</span><span class="price">¥{p}</span><span class="note">{t}</span></li>' for n, p, t in SEATS)
    cast_cards = "".join(
        f'<li class="cast"><span class="cname">{e(n)}</span><a href="/c/{i}">この出演者で予約</a></li>'
        for i, n in enumerate(casts, 1))
    online_goods = "".join(f'<li><span>{e(n)}</span><span class="price">¥{p}</span></li>' for n, p, pre in GOODS if pre)
    staff = ("<dl class='staff'>" + "".join(f"<dt>{e(r)}</dt><dd>{e(n)}</dd>" for r, n in STAFF) + "</dl>") if STAFF else '<p class="tbd">スタッフ情報は近日公開予定です。</p>'
    flyer = (f'<img class="flyer" src="/assets/{e(FLYER)}" alt="「家族の絆」フライヤー">' if FLYER
             else '<div class="flyer tbd-box">フライヤー画像<br>近日公開</div>')
    online_btn = (f'<a class="btn" href="{e(ONLINE_SHOP_URL)}" rel="noopener">事前予約物販を申し込む</a>' if ONLINE_SHOP_URL
                  else '<p class="tbd">お申し込み方法は近日公開予定です。</p>')
    page = TEMPLATE.format(show_rows=show_rows, seat_rows=seat_rows, cast_cards=cast_cards, online_goods=online_goods,
                           staff=staff, flyer=flyer, online_btn=online_btn, show_count=SHOW_COUNT)
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
<meta property="og:type" content="website">
<meta property="og:title" content="BSD presents 舞台「家族の絆」">
<meta property="og:description" content="2026.12.4（金）〜12.8（火）全7公演／シアターグリーン BASE THEATER（池袋）／チケット予約受付中">
<meta property="og:image" content="/assets/logo.webp">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/assets/logo.webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<style>
:root{{--ink:#efe9df;--mute:#a59fb4;--bg:#120f18;--panel:#1b1624;--line:#2e2639;--gold:#c9a76a;--gold-l:#dcbd84;--gold-d:#9c7f4c;--red:#b0322e}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth;scroll-padding-top:64px}}
@media (prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:"Zen Kaku Gothic New","Hiragino Sans","Noto Sans JP",sans-serif;font-size:15px;line-height:1.85}}
a{{color:var(--gold)}}
.wrap{{max-width:960px;margin:0 auto;padding-inline:16px}}
h1,h2,h3{{font-family:"Shippori Mincho B1","Hiragino Mincho ProN",serif;font-weight:800;margin:0;text-wrap:balance}}
/* nav */
nav{{position:sticky;top:0;z-index:10;background:rgba(18,15,24,.92);backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}}
nav .wrap{{display:flex;align-items:center;gap:16px;height:56px}}
nav .brand{{font-family:"Shippori Mincho B1",serif;font-weight:800;color:var(--ink);text-decoration:none;white-space:nowrap}}
nav ul{{display:flex;gap:14px;list-style:none;margin:0 0 0 auto;padding:0;overflow-x:auto;scrollbar-width:none}}
nav ul::-webkit-scrollbar{{display:none}}
nav ul a{{color:var(--mute);text-decoration:none;font-size:.85rem;white-space:nowrap}}
nav ul a:hover,nav ul a:focus-visible{{color:var(--ink)}}
nav .navcta{{background:var(--gold);color:#1a1424;padding:6px 14px;border-radius:999px;font-weight:700;font-size:.82rem;text-decoration:none;white-space:nowrap}}
/* hero */
.hero{{padding-block:56px 48px;display:grid;grid-template-columns:minmax(0,320px) 1fr;gap:36px;align-items:center}}
.hero img{{width:100%;max-width:320px;height:auto}}
.eyebrow{{letter-spacing:.35em;font-size:.75rem;color:var(--gold)}}
.hero h1{{font-size:clamp(2.8rem,10vw,5rem);line-height:1.08;margin:.15em 0 .25em}}
.hero .date{{font-size:1.1rem;font-weight:700}}
.hero .venue{{color:var(--mute)}}
.btn{{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 30px;border-radius:999px;background:var(--gold);color:#1a1424;font-weight:700;text-decoration:none;font-size:1.02rem;border:0}}
.btn:hover,.btn:focus-visible{{background:var(--gold-l);outline:none}}
.btn:focus-visible,.cast a:focus-visible,nav a:focus-visible{{box-shadow:0 0 0 3px #ffffff40;outline:none}}
.btn.ghost{{background:transparent;color:var(--gold);border:1px solid var(--gold-d)}}
.hero .btns{{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}}
/* sections */
section{{padding-block:52px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:20px}}
h2{{font-size:1.55rem;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 12px}}
h2 small{{font-family:"Zen Kaku Gothic New",sans-serif;font-size:.72rem;letter-spacing:.3em;color:var(--gold);font-weight:700}}
.tbd{{color:var(--mute);margin:0}}
.facts{{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:6px 0 0}}
.facts dt{{color:var(--gold);font-size:.85rem;letter-spacing:.1em;padding-top:2px}}
.facts dd{{margin:0;font-weight:700;font-size:1.05rem}}
.apply{{display:flex;flex-direction:column;align-items:center;gap:10px;padding-block:8px 44px;text-align:center}}
.btn.big{{font-size:1.15rem;padding:18px 44px}}
.sub{{font-size:1.02rem;margin-top:6px}}
.soon{{font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:2rem;letter-spacing:.2em;color:var(--gold);margin:0}}
.lead{{color:var(--mute);margin:0;max-width:60ch}}
.news{{list-style:none;margin:0;padding:0}}
.news li{{display:flex;gap:16px;padding:8px 0;border-bottom:1px solid var(--line)}}
.news time{{color:var(--gold);font-variant-numeric:tabular-nums;white-space:nowrap}}
.intro{{display:grid;grid-template-columns:minmax(0,280px) 1fr;gap:28px;align-items:start}}
.flyer{{width:100%;max-width:420px;border-radius:6px;align-self:center}}
.tbd-box{{aspect-ratio:1/1.414;border:1px dashed var(--gold-d);display:flex;align-items:center;justify-content:center;text-align:center;color:var(--mute);font-size:.9rem}}
.story p{{margin:0 0 .8em;max-width:60ch}}
table{{border-collapse:collapse;width:100%;max-width:520px}}
td,th{{padding:11px 12px;border-bottom:1px solid var(--line);text-align:left}}
th{{color:var(--mute);font-weight:500;font-size:.85rem}}
.num{{font-variant-numeric:tabular-nums}} .strong{{font-weight:700;color:#fff}}
.dow{{color:var(--mute)}}
.seats,.goods{{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}}
.seats li{{display:grid;grid-template-columns:4.5em 6em 1fr;gap:12px;align-items:baseline;padding:13px 0;border-bottom:1px solid var(--line)}}
.seat{{font-family:"Shippori Mincho B1",serif;font-size:1.3rem;font-weight:800;color:var(--gold)}}
.price{{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}}
.seats .note{{color:var(--mute);font-size:.9rem}}
.callout{{background:var(--panel);border-left:4px solid var(--gold);padding:14px 16px;border-radius:0 8px 8px 0}}
.callout b{{color:#fff}}
.steps{{margin:0;padding:0;list-style:none;counter-reset:s;display:grid;gap:10px}}
.steps li{{counter-increment:s;display:grid;grid-template-columns:30px 1fr;gap:12px;align-items:start}}
.steps li::before{{content:counter(s);width:28px;height:28px;border-radius:50%;background:var(--gold);color:#1a1424;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:.85rem;margin-top:2px}}
.casts{{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}}
.cast{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px}}
.cname{{font-family:"Shippori Mincho B1",serif;font-weight:800;font-size:1.1rem}}
.cast a{{font-size:.82rem;color:var(--gold);text-decoration:none;border:1px solid var(--gold-d);border-radius:999px;padding:4px 10px;align-self:flex-start}}
.cast a:hover{{background:var(--gold);color:#1a1424}}
.goods li{{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}}
.goods em{{font-style:normal;font-size:.72rem;color:var(--gold);border:1px solid var(--gold-d);border-radius:4px;padding:0 6px;margin-left:8px;white-space:nowrap}}
.access{{display:grid;grid-template-columns:1fr 1fr;gap:24px}}
.access dl,.staff{{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 16px}}
.access dt,.staff dt{{color:var(--mute)}} .access dd,.staff dd{{margin:0}}
.map{{width:100%;aspect-ratio:16/9;border:0;border-radius:8px;filter:grayscale(.3)}}
.notes{{margin:0;padding-left:1.2em;display:grid;gap:6px;color:var(--ink)}}
footer{{padding-block:40px 56px;border-top:1px solid var(--line);color:var(--mute);font-size:.85rem;display:flex;flex-direction:column;gap:6px}}
@media (max-width:720px){{
  .hero{{grid-template-columns:1fr;justify-items:center}}
  .hero h1,.hero .eyebrow{{text-align:center}}
  .tbd-box.flyer{{max-width:280px}}
  .access{{grid-template-columns:1fr}}
  .seats li{{grid-template-columns:4em 5.5em 1fr}}
  nav ul{{display:none}}
}}
</style></head><body>

<nav><div class="wrap">
  <a class="brand" href="#top">家族の絆</a>
  <ul>
    <li><a href="#schedule">日程</a></li><li><a href="#cast">出演者</a></li><li><a href="#ticket">チケット</a></li>
    <li><a href="#access">劇場</a></li><li><a href="#notes">注意事項</a></li><li><a href="#goods">物販</a></li>
  </ul>
  <a class="navcta" href="/form">申し込む</a>
</div></nav>

<main class="wrap" id="top">
<header class="hero">
  <img src="/assets/logo.webp" alt="宵牙狼" width="320" height="240">
  <div>
    <div class="eyebrow">BSD PRESENTS</div>
    <h1>家族の絆</h1>
    <dl class="facts">
      <dt>公演期間</dt><dd>2026年12月4日（金）〜 12月8日（火）</dd>
      <dt>劇場</dt><dd>シアターグリーン BASE THEATER（池袋）</dd>
      <dt>公演数</dt><dd>全{show_count}公演</dd>
    </dl>
  </div>
</header>

<div class="apply">
  <a class="btn big" href="/form">チケットを申し込む</a>
  <p class="lead">出演者を指定して申し込む場合は、下の「出演者」からどうぞ。</p>
</div>

<section id="schedule">
  <h2><small>SCHEDULE</small>公演スケジュール</h2>
  <table><thead><tr><th>日付</th><th>開場</th><th>開演</th></tr></thead><tbody>{show_rows}</tbody></table>
  <p class="lead">開場は開演の30分前です。各回60席。</p>
</section>

<section id="flyer">
  <h2><small>FLYER</small>フライヤー</h2>
  {flyer}
</section>

<section id="cast">
  <h2><small>CAST</small>出演者</h2>
  <p class="lead">応援している出演者の「この出演者で予約」を押すと、取り扱いが選ばれた状態で予約フォームが開きます。</p>
  <ul class="casts">{cast_cards}</ul>
</section>

<section id="ticket">
  <h2><small>TICKET</small>チケット</h2>
  <ul class="seats">{seat_rows}</ul>
  <div class="callout"><b>お支払いは公演当日、会場受付にて現金のみ</b>となります。</div>
  <h3 style="font-size:1.05rem;margin-top:8px">お申し込みの流れ</h3>
  <ol class="steps">
    <li>「チケットを申し込む」、または出演者の「この出演者で予約」から予約フォームを開きます</li>
    <li>お名前・メールアドレス・公演日時・席種・枚数を入力して送信します</li>
    <li>予約番号入りの受付メールが届きます（送信元 info.tenrou.event@gmail.com）</li>
    <li>運営事務局より本予約完了のご連絡をお送りします</li>
    <li>当日は受付で予約番号またはお名前をお伝えください</li>
  </ol>
  <div><a class="btn" href="/form">チケットを申し込む</a></div>
</section>

<section id="staff">
  <h2><small>STAFF</small>スタッフ</h2>
  {staff}
</section>

<section id="access">
  <h2><small>THEATER</small>劇場マップ</h2>
  <div class="access">
    <dl>
      <dt>劇場</dt><dd>シアターグリーン BASE THEATER</dd>
      <dt>住所</dt><dd>〒171-0022<br>東京都豊島区南池袋2-20-4</dd>
      <dt>JR池袋駅</dt><dd>南改札より地下通路39番出口から徒歩約2分<br>東口から地上で徒歩約6分</dd>
      <dt>東池袋駅</dt><dd>東京メトロ有楽町線 徒歩約5分</dd>
      <dt>雑司ヶ谷駅</dt><dd>都電荒川線 徒歩約7分</dd>
    </dl>
    <iframe class="map" title="シアターグリーン BASE THEATER の地図" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
      src="https://www.google.com/maps?q=%E3%82%B7%E3%82%A2%E3%82%BF%E3%83%BC%E3%82%B0%E3%83%AA%E3%83%BC%E3%83%B3+BASE+THEATER&output=embed"></iframe>
  </div>
  <p class="lead"><a href="https://theater-green.com/access/" rel="noopener">劇場公式のアクセスページ</a></p>
</section>

<section id="notes">
  <h2><small>NOTES</small>注意事項</h2>
  <h3 class="sub">キャンセル・変更について</h3>
  <ul class="notes">
    <li>ご予約のキャンセル・内容の変更は、予約受付メールへの返信、または取り扱いの出演者までご連絡ください。</li>
    <li>ご来場が難しくなった場合は、お早めにご連絡をお願いいたします。</li>
  </ul>
  <h3 class="sub">応援花（スタンドフラワー）について</h3>
  <div class="callout"><b>スタンドフラワー等の応援花はお受けしておりません。</b><br>出演者への応援は、事前予約物販の<b>「お祝い札」</b>でお届けいただけます（下の「オンライン物販」をご覧ください）。</div>
</section>

<section id="goods">
  <h2><small>ONLINE</small>オンライン物販（事前予約）</h2>
  <p class="lead">各商品、全出演者分をご用意しています。価格は予価です。</p>
  <ul class="goods">{online_goods}</ul>
  {online_btn}
</section>

<section id="goods-day">
  <h2><small>GOODS</small>当日物販</h2>
  <p class="soon">COMING SOON</p>
  <p class="lead">当日物販の詳細は近日公開予定です。物販は現金のほか各種電子決済がご利用いただけます。</p>
</section>
</main>

<footer><div class="wrap" style="display:flex;flex-direction:column;gap:6px">
  <div>お問い合わせ：運営事務局 info.tenrou.event@gmail.com</div>
  <div>主催：BSD presents</div>
</div></footer>
</body></html>
"""

if __name__ == "__main__":
    main()
