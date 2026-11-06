#!/usr/bin/env python3
"""キャストカードの一括書き出し（S03-10）。CSV の1行＝1人分のカード動画と静止画を作る。

usage:
    python3 cards_batch.py cast.csv OUTDIR [--template projects/S03-01-cast-cards/card.html]
                           [--music audio.wav] [--dur 8] [--still 3.5] [--sizes 1080x1920,1080x1080] [--dry]

cast.csv（1行目は見出し。name と role は必須、troupe（上の行）と note（注記）は任意）:
    name,role,troupe
    水無瀬 透,硝子職人 伊織 役,灯守座 · 解禁

出力: OUTDIR/<連番>_<名前>_<幅x高さ>.mp4（音付き）と .jpg（--still 秒の静止画）、OUTDIR/index.csv（ファイル一覧）
- 型（--template）は window.__DATA に {name, role, troupe} を受け取る scene.html なら何でもよい
- 音楽を渡さなければ無音の mp4 になる
- 名前の文字数で縦組みの大きさは自動で変わる（型の側の処理）
"""
import csv
import subprocess
import sys
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent


def arg(a, k, d=None):
    return a[a.index(k) + 1] if k in a else d


def main():
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__); sys.exit(1)
    rows = list(csv.DictReader(open(a[0], encoding="utf-8-sig")))
    out = Path(a[1]); out.mkdir(parents=True, exist_ok=True)
    tpl = arg(a, "--template", "projects/S03-01-cast-cards/card.html")
    music = arg(a, "--music"); dur = arg(a, "--dur", "8"); still = arg(a, "--still", "3.5")
    sizes = [tuple(map(int, s.split("x"))) for s in arg(a, "--sizes", "1080x1920").split(",")]
    dry = "--dry" in a
    index = []
    for i, r in enumerate(rows, 1):
        if not r.get("name") or not r.get("role"):
            print(f"行{i + 1}: name と role は必須なので飛ばします"); continue
        data = {k: v for k, v in r.items() if v}
        dj = out / f".data{i}.json"; dj.write_text(json.dumps(data, ensure_ascii=False))
        slug = f"{i:02d}_{r['name'].replace(' ', '')}"
        for w, h in sizes:
            base = out / f"{slug}_{w}x{h}"
            cmd = ["node", str(HERE / "render.mjs"), tpl, f"{base}.v.mp4", "--w", str(w), "--h", str(h),
                   "--fps", "30", "--dur", dur, "--data", str(dj), "--workers", "3"]
            print(" ".join(cmd))
            if dry: continue
            subprocess.run(cmd, cwd=STUDIO, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if music:
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", f"{base}.v.mp4", "-i", music, "-c:v", "copy", "-c:a", "aac",
                                "-b:a", "192k", "-shortest", f"{base}.mp4"], check=True)
                Path(f"{base}.v.mp4").unlink()
            else:
                Path(f"{base}.v.mp4").rename(f"{base}.mp4")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", still, "-i", f"{base}.mp4", "-frames:v", "1", "-q:v", "2", f"{base}.jpg"], check=True)
            index.append({"no": i, "name": r["name"], "role": r["role"], "size": f"{w}x{h}", "mp4": f"{base.name}.mp4", "jpg": f"{base.name}.jpg"})
        dj.unlink()
    if index:
        with open(out / "index.csv", "w", encoding="utf-8", newline="") as f:
            wr = csv.DictWriter(f, fieldnames=list(index[0])); wr.writeheader(); wr.writerows(index)
    print(f"{len(index)} 本を書き出しました -> {out}")


if __name__ == "__main__":
    main()
