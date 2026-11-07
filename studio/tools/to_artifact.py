#!/usr/bin/env python3
"""Web 作品を Artifact で公開するための準備（2026-11-08、raw.githack が中間ページになるため）。

usage: python3 tools/to_artifact.py <site_dir> [--out <build_dir>]
  - index.html から外側の doctype/html/head/body を外した artifact.html を作る（Artifact の公開ページ）
  - index.html 以外のファイルを、Artifact の files に渡す対応表 files.json に書く
    （index.html は公開ページ自身を指す予約名。サブページから index.html へのリンクはそのまま公開ページに届く）
  - Artifact が配信しない拡張子（.m4a）は、中身は同じまま .mp4 として置き、html/js/css の参照も書き換える
    → そのため --out を付けて、作品フォルダとは別の場所（スクラッチ）に公開用のコピーを作る
  - 公開: Artifact の publish に file_path=<build>/artifact.html、root=<build>、files=[{"path": ...}] を渡す
"""
import json, re, shutil, sys
from pathlib import Path
site = Path(sys.argv[1]).resolve()
out = Path(sys.argv[sys.argv.index('--out') + 1]).resolve() if '--out' in sys.argv else site
if out != site:
    shutil.rmtree(out, ignore_errors=True); shutil.copytree(site, out)
RENAME = {'.m4a': '.mp4'}
for p in list(out.rglob('*')):
    if p.is_file() and p.suffix in RENAME:
        p.rename(p.with_suffix(RENAME[p.suffix]))
for p in out.rglob('*'):
    if p.is_file() and p.suffix in ('.html', '.js', '.css', '.json') and p.name != 'files.json':
        t = p.read_text()
        for a, b in RENAME.items():
            t = t.replace(a, b)
        p.write_text(t)
h = (out / 'index.html').read_text()
m = re.search(r'<head[^>]*>(.*?)</head>\s*<body([^>]*)>(.*)</body>', h, re.S | re.I)
head, battr, body = m.group(1), m.group(2), m.group(3)
head = re.sub(r'<meta charset[^>]*>\s*', '', head, flags=re.I)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head, flags=re.I)
old = out / 'artifact.html'
title = re.search(r'<title>(.*?)</title>', old.read_text()).group(1) if old.exists() and '<title>' in old.read_text() else None
if title:
    head = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', head, count=1)
res = head.strip() + '\n'
if battr.strip():
    attrs = dict(re.findall(r'([\w-]+)="([^"]*)"', battr))
    res += '<script>' + ''.join(f'document.body.setAttribute({json.dumps(k)},{json.dumps(v)});' for k, v in attrs.items()) + '</script>\n'
res += body.strip() + '\n'
(out / 'artifact.html').write_text(res)
skip = {'artifact.html', 'files.json', '_headers', 'index.html'}
files = [{'path': str(p.relative_to(out))} for p in sorted(out.rglob('*')) if p.is_file() and p.name not in skip]
(out / 'files.json').write_text(json.dumps(files, ensure_ascii=False))
print(out, len(files), 'files')
