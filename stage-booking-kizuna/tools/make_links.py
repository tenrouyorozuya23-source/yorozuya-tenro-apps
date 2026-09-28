#!/usr/bin/env python3
"""GitHub Pages 用の個別URL（転送ページ）を生成する。

  https://tenrouyorozuya23-source.github.io/yorozuya-tenro-apps/k/      … 通常の予約フォーム
  https://tenrouyorozuya23-source.github.io/yorozuya-tenro-apps/k/1     … キャスト1 が選ばれた予約フォーム
  …
キャストの順番は Code.gs の CONFIG.groups と同じ（Code.gs の castNumber と一致させる）。
キャストやフォームを変えたら、このスクリプトを再実行して k/ を作り直す。
  python3 stage-booking-kizuna/tools/make_links.py
"""
import html, json, os, re, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "k")

# Googleフォーム（取り扱いキャストの質問）
FORM_ID  = "1FAIpQLSdCvSwWU5FWh0CijrUct4tusshy-eCTrZCtwokIoVrxg51whg"
ENTRY_ID = "2040009292"
FORM_URL = "https://docs.google.com/forms/d/e/%s/viewform" % FORM_ID
TITLE = "家族の絆"
ORGANIZER = "BSD presents"

def casts_from_code():
    src = open(os.path.join(ROOT, "stage-booking-kizuna", "Code.gs"), encoding="utf-8").read()
    groups = src[src.index("groups: ["):src.index("// スタッフ：")]
    group = re.search(r'name:\s*"([^"]+)",\s*\n\s*casts', groups).group(1)
    return group, re.findall(r'\{\s*name:\s*"([^"]+)",\s*mail', groups)

def prefilled(label):
    return FORM_URL + "?usp=pp_url&entry.%s=%s" % (ENTRY_ID, urllib.parse.quote_plus(label))

PAGE = """<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} 予約フォーム</title>
<meta name="robots" content="noindex">
<meta property="og:title" content="{title} ご予約フォーム{who}">
<meta property="og:description" content="{organizer}「{title}」2026年12月4日〜8日 シアターグリーン BASE THEATER">
<noscript><meta http-equiv="refresh" content="0;url={target_attr}"></noscript>
<style>
html,body{{margin:0;height:100%;background:#0f0e17;color:#e8e4f0;font-family:"Hiragino Sans","Noto Sans JP",sans-serif}}
.wrap{{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;box-sizing:border-box;text-align:center}}
.logo{{width:min(62vw,300px);height:auto;animation:p 1.8s ease-in-out infinite}}
@keyframes p{{0%,100%{{opacity:.75;transform:scale(.98)}}50%{{opacity:1;transform:scale(1)}}}}
@media (prefers-reduced-motion:reduce){{.logo{{animation:none}}}}
.t{{font-size:13px;letter-spacing:.12em}}.s{{font-size:12px;color:#8f88a8}}
a{{margin-top:8px;padding:12px 22px;border-radius:999px;background:#c9a76a;color:#1a1424;font-weight:700;text-decoration:none;font-size:14px}}
</style></head><body><div class="wrap">
<img class="logo" src="{logo}" alt="宵牙狼">
<div class="t">{title} 予約フォームを開いています</div>
<div class="s">{organizer}</div>
<a href="{target_attr}">開かないときはこちら</a>
</div>
<script>setTimeout(function(){{location.replace({target_js});}},700);</script>
</body></html>
"""

def write(path, target, who, logo):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w", encoding="utf-8").write(PAGE.format(
        title=TITLE, organizer=ORGANIZER, who=who, logo=logo,
        target_attr=html.escape(target, quote=True), target_js=json.dumps(target)))

def main():
    group, casts = casts_from_code()
    write(os.path.join(OUT, "index.html"), FORM_URL, "", "logo.webp")
    lines = ["番号,キャスト,個別URL（パス）"]
    for i, name in enumerate(casts, 1):
        write(os.path.join(OUT, str(i), "index.html"), prefilled("%s 【%s】" % (name, group)), "（" + name + "）", "../logo.webp")
        lines.append("%d,%s,k/%d" % (i, name, i))
    open(os.path.join(OUT, "links.csv"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines))

if __name__ == "__main__":
    main()
