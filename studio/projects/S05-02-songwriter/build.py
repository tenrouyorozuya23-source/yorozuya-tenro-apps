#!/usr/bin/env python3
"""facts.json → site/data.js。明朝は使う字だけを Google Fonts の text= で読む（index.html の印の行を書き換える）"""
import json, re, urllib.parse
from pathlib import Path
H = Path(__file__).parent; S = H / 'site'
F = json.loads((H / 'facts.json').read_text())
for t in F['tracks']:
    t['downbeats'] = json.loads((H / 'audio/out' / f"S05-02-{t['id']}_preview.beats.json").read_text())['downbeats']
(S / 'data.js').write_text('// facts.json から生成（手で書き換えない）\nexport const F = ' + json.dumps(F, ensure_ascii=False) + ';\n')
html = (S / 'index.html').read_text()
# 明朝で組む字：見出し・名前・曲名・会場・タグライン（index.html の class="m" の要素と data の値）
heads = ''.join(re.findall(r'<h[12][^>]*>([^<]*)<', html)) + ''.join(re.findall(r'data-m>([^<]*)<', html))
vals = F['artist']['name'] + F['artist']['tagline'] + ''.join(t['title'] for t in F['tracks']) + ''.join(r['title'] + ''.join(r['songs']) for r in F['releases']) + ''.join(l['venue'] for l in F['lives'])
chars = ''.join(sorted(set(heads + vals + '『』（）・') - set(' \n')))
url = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&display=swap&text=' + urllib.parse.quote(chars)
html = re.sub(r'<link id="fm"[^>]*>', f'<link id="fm" rel="stylesheet" href="{url}">', html)
(S / 'index.html').write_text(html)
print(len(chars), 'chars')
