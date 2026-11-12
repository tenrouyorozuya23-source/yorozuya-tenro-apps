#!/usr/bin/env python3
"""facts.json → site/data.js。明朝は使う字だけを text= で読む（facts・app.js・index.html の和文をすべて集める。S05-02 の教訓）"""
import json, re, urllib.parse
from pathlib import Path
H = Path(__file__).parent; S = H / 'site'
F = json.loads((H / 'facts.json').read_text())
(S / 'data.js').write_text('// facts.json から生成（手で書き換えない）\nexport const F = ' + json.dumps(F, ensure_ascii=False) + ';\n')
html = (S / 'index.html').read_text()
src = json.dumps(F, ensure_ascii=False) + (S / 'app.js').read_text() + html
chars = ''.join(sorted(set(re.findall(r'[　-ヿ一-鿿＀-￯]', src)) | set('0123456789')))
url = 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&display=swap&text=' + urllib.parse.quote(chars)
html = re.sub(r'<link id="fm"[^>]*>', f'<link id="fm" rel="stylesheet" href="{url}">', html)
(S / 'index.html').write_text(html)
print(len(chars), 'chars')
