#!/usr/bin/env python3
"""facts.json → site/data.js（手で書き換えない）"""
import json
from pathlib import Path
H = Path(__file__).parent
F = {k: v for k, v in json.loads((H / 'facts.json').read_text()).items() if not k.startswith('_')}   # 制作メモ（_note）は配信しない
(H / 'site' / 'data.js').write_text('// facts.json から生成（手で書き換えない）\nexport const F = ' + json.dumps(F, ensure_ascii=False) + ';\n')
print('ok')
