#!/usr/bin/env python3
"""ショーケースサイト（S05-10）のデータを、保存済みの完成品（works/pass）から作る。

usage: python3 tools/showcase.py projects/S05-10-showcase/site
  - works/pass/<ID>/README.md の見出しから題名と点数、カタログ（research/catalog-100.md）から種類・形式・架空の依頼主を読む
  - 代表画像を選び（poster → pc → og → シート → スペクトログラム → mp4 の 40% の位置）、幅 720 の jpg にして site/img/<ID>.jpg に置く
  - Web 作品は knowledge/published-artifacts.md の Artifact の URL、それ以外は GitHub のフォルダへリンクする
  - site/data.js を書く（手で書き換えない）
"""
import json, re, subprocess, sys
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
site = Path(sys.argv[1]).resolve(); (site / 'img').mkdir(parents=True, exist_ok=True)
cat = {}
for line in (ROOT / 'knowledge/research/catalog-100.md').read_text().splitlines():
    m = re.match(r'^\| *(S\d\d-\d\d) *\|(.*)', line)
    if m:
        c = [x.strip() for x in m.group(2).split('|')]
        cat[m.group(1)] = {'kind': c[1], 'form': c[2], 'client': c[8] if len(c) > 8 else ''}
EXTRA = {'P002': {'kind': 'web', 'form': '公演 LP', 'client': '架空の弾き語りライブ'}, 'P003': {'kind': 'music', 'form': 'BGM ライブラリ', 'client': '自社'},
         'P017': {'kind': 'video', 'form': '舞台ティザー', 'client': '架空の劇団'}}
pub = dict(re.findall(r'\| (\S+) [^|]*\| (https://claude\.ai/artifact/\S+) \|', (ROOT / 'knowledge/published-artifacts.md').read_text()))
GH = 'https://github.com/tenrouyorozuya23-source/yorozuya-tenro-apps/tree/studio-autopilot/studio/works/pass/'
items = []
for d in sorted((ROOT / 'works/pass').iterdir()):
    if not d.is_dir() or not (d / 'README.md').exists(): continue
    wid = re.match(r'(P\d{3}|S\d\d-\d\d)', d.name).group(1)
    h1 = (d / 'README.md').read_text().splitlines()[0]
    sc = re.search(r'（(\d\.\d+)）', h1); score = float(sc.group(1)) if sc else None
    title = re.sub(r'^#\s*' + re.escape(wid) + r'\s*', '', h1)
    title = re.sub(r'\s*—\s*(完成品|一級).*$', '', title).strip()
    meta = cat.get(wid) or EXTRA.get(wid, {'kind': '', 'form': '', 'client': ''})
    files = sorted(p.name for p in d.iterdir())
    pick = None
    for pat in [r'^poster\.jpg$', r'-poster\.jpg$', r'^pc\.jpg$', r'-pc\.jpg$', r'og\.jpg$', r'obs_on_green\.jpg$', r'-(seven|six)\.jpg$']:
        pick = next((f for f in files if re.search(pat, f)), None)
        if pick: break
    out = site / 'img' / f'{wid}.jpg'
    if pick:
        im = Image.open(d / pick).convert('RGB')
    elif any(f.endswith('.mp4') for f in files):
        mp4 = next(f for f in files if f.endswith('.mp4'))
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(d / mp4)], capture_output=True, text=True).stdout or 1)
        tmp = site / 'img' / '_tmp.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(dur * .4), '-i', str(d / mp4), '-frames:v', '1', str(tmp)], check=True)
        im = Image.open(tmp).convert('RGB'); tmp.unlink()
    elif any(f.endswith('.spec.png') for f in files):
        # 画のない音の作品：スペクトログラムの帯ごとの強さを、暗い地に琥珀の縦線で描く
        from PIL import ImageDraw
        import numpy as np
        sp = np.asarray(Image.open(d / next(f for f in files if f.endswith('.spec.png'))).convert('L'), float)
        col = sp[int(sp.shape[0] * .12):int(sp.shape[0] * .85), int(sp.shape[1] * .1):int(sp.shape[1] * .9)].mean(axis=0)
        col = (col - col.min()) / (np.ptp(col) + 1e-9)
        im = Image.new('RGB', (1280, 800), (11, 10, 9)); g = ImageDraw.Draw(im)
        n = 96
        for i in range(n):
            v = col[int(i / n * (len(col) - 1))]; h = 40 + 360 * v; x = 160 + i * 10
            g.rectangle([x, 400 - h / 2, x + 4, 400 + h / 2], fill=(int(241 * (.45 + .55 * v)), int(194 * (.45 + .55 * v)), int(125 * (.45 + .55 * v))))
    else:
        continue
    w = 720; im = im.resize((w, round(im.height * w / im.width)))
    if im.height > 900: im = im.crop((0, 0, w, 900))
    im.save(out, quality=82)
    link = pub.get(wid) or (GH + d.name)
    items.append({'id': wid, 'title': title, 'score': score, 'kind': meta['kind'], 'form': meta['form'], 'client': meta['client'],
                  'img': f'img/{wid}.jpg', 'w': im.width, 'h': im.height, 'link': link, 'site': wid in pub})
(site / 'data.js').write_text('// tools/showcase.py が works/pass から生成（手で書き換えない）\nexport const WORKS = ' + json.dumps(items, ensure_ascii=False, indent=0) + ';\n')
print(len(items), 'works'); print(sorted(set(i['kind'] for i in items)))
