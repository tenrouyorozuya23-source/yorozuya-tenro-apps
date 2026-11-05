#!/usr/bin/env python3
"""撮影書類の自動生成（P023）。企画の shoot.json から、スマホで上から順に見るだけで現場が回る1枚の HTML を作る。

usage:
    python3 shoot_docs.py shoot.json out.html

shoot.json の主なキー（例: studio/projects/P023-shoot-docs/sample-shoot.json）:
    title, client（架空なら「架空」と書く）, date, place, call_time（集合）, wrap_time（撤収完了）
    method: "A"（固定カメラ＋OBS のリアルタイム合成） / "B"（iPhone トラッキング） / "C"（撮って後日合成）
    people: [{"role": "監督", "name": "..."}]          役割と名前
    schedule: [["10:00", "集合・搬入"], ...]            その日の流れ
    equipment: [{"item": "...", "qty": 1, "check": "電池を満充電"}]
    lights: [{"name": "キー", "fixture": "amaran 200d S", "where": "人物の右前 45°・高さ 2.2m",
              "aim": "顔", "power": "60%", "color": "5600K", "why": "顔の立体感を出す"}]
    shots: [{"id": "S1", "what": "...", "length": "30秒", "camera": "胸から上・固定", "lights": ["キー","リム"],
             "takes": 3, "ok": "OK の条件（目線が外れない、など）"}]
    notes: ["..."]  安全・注意
    staff_roles: {"監督": "天狼", "スタッフ": "現場スタッフ"}  チェックの担当の表示名
    extra_checks: {"設営": [["スタッフ", "..."]], ...}  案件ごとの追加（カメラの設定など）
    light_note: 照明の全体の決まり（例: 全部 5600K にそろえる）  shots[].cue: 明かりの合図
方式（method）に応じて、設営・テスト・撤収のチェックリストを自動で足す（CHECKS）。専門用語は使わず、動作で書く。
"""
import html
import json
import sys
from pathlib import Path

E = html.escape

# チェックリスト。各行は（担当, やること）。担当は shoot.json の staff_roles で名前に置き換わる
# 専門用語は使わず動作で書く。使う語は GLOSSARY でページの最初に1回だけ説明する
CHECKS = {
    "前日": [
        ("監督", "出演者に「緑色の服・小物、光る素材（スパンコールなど）は避けて」と連絡する（緑の部分は背景と一緒に消えてしまう）"),
        ("スタッフ", "カメラ・ライト・マイクの電池を満充電にする（予備の電池も）"),
        ("スタッフ", "記録カード（SDカード）の中身をパソコンに移して、空にしておく"),
        ("監督", "このページの「撮る順」を声に出して読み、分からない所に印を付けて Claude に聞く"),
    ],
    "設営": [
        ("スタッフ", "ライトスタンド全部に重り（砂袋）を乗せる（倒れると危ない）"),
        ("スタッフ", "グリーンバックを張る。しわ・たるみが無いか、手で伸ばして確かめる"),
        ("スタッフ", "床にテープで印を付ける：人物の立ち位置（グリーンバックから 2m 前）と、歩いてよい範囲"),
        ("スタッフ", "ライトを「照明」の表のとおりに置き、明るさ（%）と色（K）を本体の表示で表の数字に合わせる"),
        ("スタッフ", "ケーブルが床を横切る所は、テープで止めて足を引っかけないようにする"),
    ],
    "テスト": [
        ("スタッフ", "人物に立ち位置に立ってもらう（衣装を着た後にもう一度やる）"),
        ("監督", "モニターで、顔が暗くないか・背景の緑がむらになっていないか見る"),
        ("スタッフ", "出演者に声を出してもらい、音の大きさの表示が真ん中あたりで揺れるか確かめる"),
        ("スタッフ", "10秒だけ撮って再生し、音と映像の両方が入っているか確かめる"),
    ],
    "本番": [
        ("スタッフ", "昼休みの後は、ライトの数字・カメラの位置・録画できるかをもう一度確かめる"),
        ("スタッフ", "1テイクの手順：録画を始める → 「S1 テイク1」と声に出す → 監督の「はい」で演技 → 監督の「カット」で録画を止める"),
        ("監督", "OK の条件（撮る順の表）を満たしたら、そのテイク番号を表に書いて次へ。迷ったらもう1テイク"),
        ("スタッフ", "1シーンごとに、最後の数秒を再生して確かめる"),
    ],
    "撤収": [
        ("スタッフ", "記録カードを抜く前に、全部のシーンが撮れているか一覧で確かめる"),
        ("Claude", "カードの中身を丸ごと、保存先フォルダにコピーする（中のフォルダ構成は変えない）。パソコンで録った映像も同じ場所へ"),
        ("Claude", "コピーした数と長さを再生して確かめ、外付けディスクにもう1か所控えを取る。それが済むまでカードは消さない"),
        ("スタッフ", "ライトの電源を切ってから片付ける。借りた物・自分の物を機材表で数える"),
    ],
}
GLOSSARY = {
    "合成": "緑の部分を CG の背景に置き換えること",
    "OBS": "パソコンで映像を合成・録画するソフト",
    "テイク": "同じ場面を撮る1回分。1回目＝テイク1",
    "キャプチャ機器": "カメラの映像をパソコンに入れる小さな変換器",
    "K（ケルビン）": "光の色。5600K＝昼の光の白、3200K＝電球のオレンジ寄り",
    "ソフトボックス": "ライトの前に付けて光を柔らかくする布の箱",
}
METHOD = {
    "A": ("固定カメラで撮りながら、その場で合成", {
        "設営": [("スタッフ", "カメラを三脚に固定する。撮影中は動かさない（動かすと合成がずれる）"),
                 ("スタッフ", "カメラとパソコンをキャプチャ機器でつなぎ、OBS に映ることを確かめる")],
        "テスト": [("Claude", "OBS の合成画面で、背景がむらなく消えているか・髪の毛のまわりに緑が残っていないか見る。緑が残る側の背景ライトを 10% 上げる"),
                   ("スタッフ", "録画は OBS とカメラ本体の両方で回す（片方が失敗しても大丈夫なように）")],
    }),
    "B": ("iPhone でカメラの動きを記録しながら撮る", {
        "設営": [("スタッフ", "iPhone をカメラの上にしっかり固定する（ずれると動きの記録が狂う）"),
                 ("Claude", "Jetset を起動し、画面の案内どおりに床を映して位置合わせをする")],
        "テスト": [("監督", "カメラをゆっくり動かして、画面の CG 背景がずれずについてくるか見る")],
    }),
    "C": ("撮るだけにして、合成は後日", {
        "設営": [("スタッフ", "グリーンバックに目印（小さなテープの×）を 4〜6 か所貼る（あとでカメラの動きを読み取るため）")],
        "テスト": [("監督", "カメラを動かす速さは、ゆっくりを守る（速いとぶれて読み取れない）")],
    }),
}


def checks_for(d):
    out = {k: list(v) for k, v in CHECKS.items()}
    for k, v in METHOD.get(d.get("method", "A"), ("", {}))[1].items():
        out[k] = out[k][:1] + v + out[k][1:]
    for k, v in d.get("extra_checks", {}).items():   # 案件ごとの追加（カメラの設定など）
        out.setdefault(k, [])
        out[k] = out[k][:1] + [tuple(x) for x in v] + out[k][1:]
    return out


def build(d):
    m = d.get("method", "A")
    mname = METHOD.get(m, (m,))[0]
    who = d.get("staff_roles", {})
    lights = {l["name"]: l for l in d.get("lights", [])}
    chk = checks_for(d)

    def clist(phase):
        items = chk.get(phase, [])
        return f'''<section id="c-{E(phase)}"><h2>チェック：{E(phase)}</h2><ul class="check">{''.join(f'<li><label><input type="checkbox" data-k="{E(phase)}-{i}"><span><em>{E(who.get(r, r))}</em>{E(t)}</span></label></li>' for i, (r, t) in enumerate(items))}</ul></section>'''
    sec = []
    sec.append(f'''<section id="flow"><h2>今日の流れ</h2><ol class="flow">{''.join(f'<li><time>{E(t)}</time><span>{E(w)}</span></li>' for t, w in d.get("schedule", []))}</ol></section>''')
    sec.append(f'''<section id="people"><h2>誰が何をするか</h2><ul class="kv">{''.join(f'<li><b>{E(p["role"])}</b><span>{E(p["name"])}</span></li>' for p in d.get("people", []))}</ul></section>''')
    sec.append(f'''<section id="words"><h2>この書類に出てくる言葉</h2><dl class="gl">{''.join(f'<dt>{E(k)}</dt><dd>{E(v)}</dd>' for k, v in GLOSSARY.items())}</dl></section>''')
    sec.append(f'''<section id="gear"><h2>持っていく機材</h2><ul class="check">{''.join(f'<li><label><input type="checkbox" data-k="gear-{i}"><span><b>{E(e["item"])}</b> × {e.get("qty", 1)}<small>{E(e.get("check", ""))}</small></span></label></li>' for i, e in enumerate(d.get("equipment", [])))}</ul></section>''')
    sec.append(clist("前日"))
    sec.append(clist("設営"))
    if lights:
        sec.append(f'''<section id="lights"><h2>照明（置く場所と明るさ）</h2>{('<p class="lead">' + E(d["light_note"]) + '</p>') if d.get("light_note") else ""}<div class="cards">{''.join(f"""<article class="light"><h3>{E(l['name'])}<small>{E(l.get('fixture',''))}</small></h3>
<dl><dt>置く場所</dt><dd>{E(l.get('where',''))}</dd><dt>向ける先</dt><dd>{E(l.get('aim',''))}</dd><dt>明るさ</dt><dd>{E(l.get('power',''))}</dd><dt>色</dt><dd>{E(l.get('color',''))}</dd><dt>なぜ</dt><dd>{E(l.get('why',''))}</dd></dl></article>""" for l in lights.values())}</div></section>''')
    sec.append(clist("テスト"))
    sec.append(clist("本番"))
    def shot(s_):
        ls = '・'.join(f"{n}（{lights[n]['power']}）" if n in lights else n for n in s_.get('lights', []))
        cue = f'<p class="cue">明かりの合図：{E(s_["cue"])}</p>' if s_.get("cue") else ""
        return f"""<li><h3><span class="sid">{E(s_['id'])}</span>{E(s_['what'])}</h3>
<p>長さ {E(s_.get('length',''))} ・ カメラ {E(s_.get('camera',''))} ・ 目安 {s_.get('takes', 2)} テイク</p><p>点けるライト：{E(ls)}</p>{cue}
<p class="ok">OK の条件：{E(s_.get('ok',''))}</p>
<div class="row"><label class="done"><input type="checkbox" data-k="shot-{E(s_['id'])}"> 撮れた</label><label class="take">OK のテイク番号 <input type="text" inputmode="numeric" data-k="take-{E(s_['id'])}" size="4"></label></div></li>"""
    sec.append(f'''<section id="shots"><h2>撮る順</h2><ol class="shots">{''.join(shot(x) for x in d.get("shots", []))}</ol></section>''')
    sec.append(clist("撤収"))
    if d.get("notes"):
        sec.append(f'''<section id="notes"><h2>安全と注意</h2><ul class="plain">{''.join(f'<li>{E(n)}</li>' for n in d["notes"])}</ul></section>''')
    sec.append('''<section id="reset"><button type="button" id="clear">チェックと記入を全部消す（リハーサルの後に）</button></section>''')
    nav = [("flow", "流れ"), ("gear", "機材"), ("c-設営", "設営"), ("lights", "照明"), ("c-テスト", "テスト"), ("shots", "撮る順"), ("c-撤収", "撤収")]
    return f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{E(d.get("title","撮影"))} — 現場の書類</title>
<style>
:root{{--bg:#0e0d0c;--panel:#191715;--line:#2d2925;--ink:#f2ede6;--sub:#a59b8f;--amber:#e9ae62;color-scheme:dark}}
@media (prefers-color-scheme: light){{:root{{--bg:#f6f3ee;--panel:#fff;--line:#e2dcd2;--ink:#1d1a16;--sub:#6b6258;--amber:#a3620f;color-scheme:light}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "Hiragino Sans","Noto Sans JP",system-ui,sans-serif;font-feature-settings:"palt"}}
header,section{{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
header{{padding-block:24px 8px}}h1{{margin:0;font-size:26px;line-height:1.3}}.meta{{margin:6px 0 0;color:var(--sub);font-size:14px}}
nav{{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);display:flex;gap:6px;overflow-x:auto;padding:8px max(16px,env(safe-area-inset-left,0px))}}
nav a{{flex:none;color:var(--ink);text-decoration:none;font-size:14px;padding:6px 12px;border:1px solid var(--line);border-radius:999px}}
section{{padding-block:20px;border-bottom:1px solid var(--line)}}h2{{margin:0 0 12px;font-size:20px}}h3{{margin:0;font-size:17px}}.lead{{margin:0 0 12px;color:var(--sub)}}
.flow,.shots,.check,.kv,.plain{{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}}
.flow li{{display:grid;grid-template-columns:64px 1fr;gap:10px}}.flow time{{font-variant-numeric:tabular-nums;color:var(--amber);font-weight:600}}
.kv li{{display:flex;gap:12px}}.kv b{{min-width:5em}}
.gl{{margin:0;display:grid;grid-template-columns:auto 1fr;gap:6px 12px}}.gl dt{{font-weight:600}}.gl dd{{margin:0;color:var(--sub)}}
.check label{{display:flex;gap:12px;align-items:flex-start;padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:10px}}
.check input,.done input{{width:22px;height:22px;flex:none;margin-top:2px;accent-color:var(--amber)}}
.check em{{font-style:normal;font-size:13px;color:var(--amber);border:1px solid var(--amber);border-radius:4px;padding:0 6px;margin-right:8px;white-space:nowrap}}
.check small{{display:block;color:var(--sub);font-size:14px}}
.check input:checked+span{{color:var(--sub);text-decoration:line-through}}
.cards{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}}
.light{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}.light small{{display:block;color:var(--sub);font-weight:400;font-size:13px}}
.light dl{{margin:8px 0 0;display:grid;grid-template-columns:5em 1fr;gap:4px 8px;font-size:15px}}.light dt{{color:var(--sub)}}.light dd{{margin:0}}
.shots li{{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}.shots p{{margin:6px 0 0;font-size:15px;color:var(--sub)}}
.shots .ok,.shots .cue{{color:var(--ink)}}.sid{{display:inline-block;min-width:2.6em;color:var(--amber);font-variant-numeric:tabular-nums}}
.row{{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;margin-top:8px}}.done{{display:flex;gap:8px;align-items:center;font-weight:600}}
.take input{{font:inherit;width:4em;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink)}}
.plain li::before{{content:"・"}}
#clear{{font:inherit;padding:10px 14px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink)}}
</style></head><body>
<header><h1>{E(d.get("title",""))}</h1><p class="meta">{E(d.get("date",""))} ・ {E(d.get("place",""))} ・ 集合 {E(d.get("call_time",""))} ・ 撤収完了 {E(d.get("wrap_time",""))}<br>撮り方：{E(mname)}{(" ・ " + E(d["client"])) if d.get("client") else ""}</p></header>
<nav aria-label="目次">{''.join(f'<a href="#{E(a)}">{E(b)}</a>' for a, b in nav)}</nav>
{''.join(sec)}
<script>
// チェックと記入はこの端末だけに残す（開き直しても消えない）。共有はされない
const key='shootdocs:'+document.title;let st={{}};try{{st=JSON.parse(localStorage.getItem(key)||'{{}}')}}catch(e){{}}
const save=()=>{{try{{localStorage.setItem(key,JSON.stringify(st))}}catch(e){{}}}};
document.querySelectorAll('input[data-k]').forEach(c=>{{const k=c.dataset.k;
  if(c.type==='checkbox'){{c.checked=!!st[k];c.addEventListener('change',()=>{{st[k]=c.checked;save()}})}}
  else{{c.value=st[k]||'';c.addEventListener('input',()=>{{st[k]=c.value;save()}})}}}});
document.getElementById('clear').addEventListener('click',()=>{{st={{}};save();document.querySelectorAll('input[data-k]').forEach(c=>{{if(c.type==='checkbox')c.checked=false;else c.value=''}})}});
</script></body></html>'''


if __name__ == "__main__":
    d = json.loads(Path(sys.argv[1]).read_text())
    Path(sys.argv[2]).write_text(build(d))
    print("wrote", sys.argv[2])
