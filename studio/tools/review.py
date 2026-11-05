#!/usr/bin/env python3
"""レビュー用シートと数値レポートを作る（完成した mp4 を目視・数値でチェックする道具）。

usage:
    python3 review.py final.mp4 [--beats bgm.beats.json] [--out DIR]
                      [--every 0.5] [--crops "6.6:80,1000,920,420;14:0,760,1080,640"]
                      [--strip-span 3] [--max-strips 16]

出力（既定は final.review/）:
    sheet.jpg       コンタクトシート。--beats があれば拍ごと、無ければ --every 秒ごと。タイムコード付き
    strips_N.jpg    小節頭（カット点）・cue の前後 ±3 フレームを横に並べたストリップ
                    （カットの瞬間・遷移の中割りを確認する用）
    crop_*.png      指定時刻・領域のフル解像度切り出し（テロップの文字確認用）
    report.json     数値レポート:
        尺 / fps / フレーム数 / 解像度 / 色タグ
        black: 黒味区間（blackdetect d=0.3）
        freeze: 1秒以上の静止区間（freezedetect）
        loudness: integrated LUFS / true peak / LRA（ebur128）
        sync: 拍・cue ごとの
          - audio_ms : 一番近い音のオンセットとのずれ（±60ms 以内を探索。+ は音が遅い）
          - visual_f : 一番大きな絵の変化（フレーム差分のピーク）とのずれ（±4f、+ は絵が遅い）
        summary: 上記の中央値・最大値と、目安を超えたものの警告
目安: 黒味なし / 静止 1秒超は意図した箇所だけ / -14±1 LUFS / TP ≤ -1 dBFS /
      audio_ms の |中央値| ≤ 15ms / visual_f は 0〜+1f（絵は拍ちょうどか1f遅れまで）
注意: librosa.beat はこの環境で numba が落ちるので使わない（onset_strength のみ使用）。
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def probe(path):
    pr = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path]).stdout)
    v = next(s for s in pr["streams"] if s["codec_type"] == "video")
    a = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
    num, den = map(int, v["r_frame_rate"].split("/"))
    return {
        "duration": float(pr["format"]["duration"]), "fps": num / den, "width": v["width"], "height": v["height"],
        "frames": int(v.get("nb_frames", 0)) or None, "has_audio": a is not None,
        "color": {k: v.get(k) for k in ("color_space", "color_primaries", "color_transfer", "color_range")},
    }


def font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)


def tc(t, fps):
    f = int(round(t * fps))
    s, ff = divmod(f, int(round(fps)))
    return f"{s // 60:02d}:{s % 60:02d}:{ff:02d}"


def grab_frames(path, frames, width, info):
    """フレーム番号のリスト → PIL 画像（幅 width に縮小）。1回の ffmpeg で取り出す"""
    frames = sorted(set(f for f in frames if 0 <= f))
    if not frames:
        return {}
    h = int(round(info["height"] * width / info["width"] / 2) * 2)
    expr = "+".join(f"eq(n\\,{f})" for f in frames)
    cm = "bt709" if info["color"].get("color_space") == "bt709" else "bt601"
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf",
                        f"select='{expr}',scale={width}:{h}:in_color_matrix={cm},format=rgb24",
                        "-vsync", "0", "-f", "rawvideo", "-"], capture_output=True)
    buf = np.frombuffer(r.stdout, np.uint8)
    n = len(buf) // (width * h * 3)
    imgs = buf[: n * width * h * 3].reshape(n, h, width, 3)
    return {f: Image.fromarray(imgs[i]) for i, f in enumerate(frames[:n])}


def label(img, text, size=18):
    d = ImageDraw.Draw(img)
    f = font(size)
    bb = d.textbbox((0, 0), text, font=f)
    d.rectangle([0, 0, bb[2] + 10, bb[3] + 8], fill=(0, 0, 0))
    d.text((5, 3), text, fill=(255, 220, 120), font=f)
    return img


def grid(imgs, cols, pad=6, bg=(30, 30, 34)):
    if not imgs:
        return None
    w, h = imgs[0].size
    rows = (len(imgs) + cols - 1) // cols
    out = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + pad) + pad), bg)
    for i, im in enumerate(imgs):
        out.paste(im, (pad + (i % cols) * (w + pad), pad + (i // cols) * (h + pad)))
    return out


def detect(path, filt, pat):
    return re.findall(pat, run(["ffmpeg", "-hide_banner", "-i", path, "-vf", filt, "-an", "-f", "null", "-"]).stderr)


def loudness(path):
    s = run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr
    s = s[s.rfind("Summary:"):]
    g = lambda p: (float(m.group(1)) if (m := re.search(p, s)) else None)
    return {"integrated_lufs": g(r"I:\s+(-?[\d.]+) LUFS"), "true_peak_dbfs": g(r"Peak:\s+(-?[\d.]+) dBFS"), "lra": g(r"LRA:\s+([\d.]+) LU")}


def audio_onsets(path, sr=22050):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"], capture_output=True).stdout
    y = np.frombuffer(raw, np.float32)
    if len(y) == 0:
        return np.array([])
    import librosa  # onset_strength は numba を使わない経路なので安全
    hop = 128
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    env = env / (env.max() + 1e-9)
    # 単純なピーク検出: 局所最大かつ移動平均＋閾値を超える
    w = 12
    pk = []
    avg = np.convolve(env, np.ones(2 * w + 1) / (2 * w + 1), mode="same")
    for i in range(1, len(env) - 1):
        if env[i] >= env[i - 1] and env[i] > env[i + 1] and env[i] > avg[i] + 0.05 and env[i] > 0.08:
            pk.append(i)
    # バックトラック: onset_strength のピークは実際のアタックより 20ms 前後遅れるので、
    # 直前 16 フレーム（約93ms）の最小値からピークまでの 30% を越えた最初の点をアタック時刻とする
    bt = []
    for i in pk:
        lo = max(0, i - 16)
        base = env[lo:i + 1].min()
        thr = base + 0.3 * (env[i] - base)
        j = i
        while j > lo and env[j - 1] >= thr:
            j -= 1
        bt.append(j)
    # 較正: 拍時刻が既知の合成BGM（P001 bgm.wav）で測ると、この方法は一貫して +12ms 遅く出る
    ONSET_BIAS = 0.012
    return np.array(bt) * hop / sr - ONSET_BIAS


def frame_diffs(path, info):
    """フレーム間の平均絶対差（縮小グレー）。index i = フレーム i と i-1 の差"""
    w, h = 90, int(round(info["height"] * 90 / info["width"]))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    d = np.zeros(len(fr))
    d[1:] = np.abs(np.diff(fr, axis=0)).mean(axis=(1, 2))
    return d


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        sys.exit(1)
    opt = lambda k, d=None: a[a.index("--" + k) + 1] if "--" + k in a else d
    src = a[0]
    out = Path(opt("out", str(Path(src).with_suffix("")) + ".review"))
    out.mkdir(parents=True, exist_ok=True)
    info = probe(src)
    fps, dur = info["fps"], info["duration"]
    nframes = info["frames"] or int(round(dur * fps))
    beats = json.loads(Path(opt("beats")).read_text()) if opt("beats") else None
    every = float(opt("every", 0.5))
    span = int(opt("strip-span", 3))

    # (a) コンタクトシート
    if beats and beats.get("beats"):
        times = [t for t in beats["beats"] if t < dur - 1 / fps]
    else:
        times = list(np.arange(0, dur - 1 / fps, every))
    sheet_frames = [int(round(t * fps)) for t in times]
    vert = info["height"] > info["width"]
    tw = 180 if vert else 320
    fr = grab_frames(src, sheet_frames, tw, info)
    sheet = grid([label(fr[f].copy(), tc(f / fps, fps), 14) for f in sheet_frames if f in fr], cols=10 if vert else 6)
    if sheet:
        sheet.save(out / "sheet.jpg", quality=85)

    # (b) カット点ストリップ
    pts = []
    if beats:
        pts += [("bar", t) for t in beats.get("downbeats", []) if 0 < t < dur - 1 / fps]
        pts += [(c["type"], c["t"]) for c in beats.get("cues", []) if 0 < c["t"] < dur - 1 / fps]
    pts = sorted({round(t, 3): (k, t) for k, t in pts}.values(), key=lambda x: x[1])[: int(opt("max-strips", 16))]
    if pts:
        sw = 150 if vert else 240
        need = [int(round(t * fps)) + o for _, t in pts for o in range(-span, span + 1)]
        sf = grab_frames(src, [f for f in need if f < nframes], sw, info)
        rows = []
        for k, t in pts:
            c = int(round(t * fps))
            row = [label(sf[c + o].copy(), f"{o:+d}" if o else f"{k} {tc(t, fps)}", 13) for o in range(-span, span + 1) if (c + o) in sf]
            if row:
                rows.append(grid(row, cols=len(row), pad=3))
        per = 6
        for i in range(0, len(rows), per):
            chunk = rows[i: i + per]
            W = max(r.width for r in chunk)
            img = Image.new("RGB", (W, sum(r.height for r in chunk)), (30, 30, 34))
            y = 0
            for r in chunk:
                img.paste(r, (0, y))
                y += r.height
            img.save(out / f"strips_{i // per + 1}.jpg", quality=85)

    # (c) クロップ
    crops = opt("crops")
    if crops:
        for spec in crops.split(";"):
            t, box = spec.split(":")
            x, y, w, h = map(int, box.split(","))
            f = int(round(float(t) * fps))
            full = grab_frames(src, [f], info["width"], info).get(f)
            if full:
                full.crop((x, y, x + w, y + h)).save(out / f"crop_{float(t):.2f}s.png")

    # 数値
    rep = {"file": Path(src).name, **info, "frames": nframes}
    rep["black"] = [[float(s), float(e)] for s, e in detect(src, "blackdetect=d=0.3:pix_th=0.06", r"black_start:([\d.]+) black_end:([\d.]+)")]
    fz = run(["ffmpeg", "-hide_banner", "-i", src, "-vf", "freezedetect=n=0.001:d=1", "-map", "0:v", "-f", "null", "-"]).stderr
    starts = [float(x) for x in re.findall(r"freeze_start: ([\d.]+)", fz)]
    ends = [float(x) for x in re.findall(r"freeze_end: ([\d.]+)", fz)]
    rep["freeze"] = [[s, ends[i] if i < len(ends) else round(dur, 3)] for i, s in enumerate(starts)]
    if info["has_audio"]:
        rep["loudness"] = loudness(src)
    warn = []
    if beats:
        on = audio_onsets(src) if info["has_audio"] else np.array([])
        diffs = frame_diffs(src, info)
        sync = []
        for k, t in [("beat", t) for t in beats.get("downbeats", [])] + [(c["type"], c["t"]) for c in beats.get("cues", [])]:
            if t >= dur:
                continue
            row = {"kind": k, "t": round(t, 3)}
            if len(on):
                near = on[np.abs(on - t) <= 0.06]
                if len(near):
                    row["audio_ms"] = round(float((near[np.argmin(np.abs(near - t))] - t) * 1000), 1)
            c = int(round(t * fps))
            lo, hi = max(1, c - 4), min(len(diffs) - 1, c + 4)
            if hi > lo:
                j = lo + int(np.argmax(diffs[lo: hi + 1]))
                if diffs[j] > max(2.0, 3 * np.median(diffs[1:]) if len(diffs) > 2 else 0):
                    row["visual_f"] = j - c
                    row["visual_diff"] = round(float(diffs[j]), 2)
            sync.append(row)
        rep["sync"] = sync
        am = [r["audio_ms"] for r in sync if "audio_ms" in r]
        vf = [r["visual_f"] for r in sync if "visual_f" in r]
        rep["summary"] = {
            "audio_ms_median": float(np.median(am)) if am else None, "audio_ms_absmax": float(np.max(np.abs(am))) if am else None,
            "audio_matched": f"{len(am)}/{len(sync)}",
            "visual_f_median": float(np.median(vf)) if vf else None, "visual_matched": f"{len(vf)}/{len(sync)}",
            "visual_off": [r for r in sync if "visual_f" in r and not 0 <= r["visual_f"] <= 1],
        }
        if am and abs(np.median(am)) > 15:
            warn.append(f"音のオンセットが拍から中央値 {np.median(am):.0f}ms ずれている（ミックス/尺合わせを確認）")
        if rep["summary"]["visual_off"]:
            warn.append(f"絵の変化が拍から 2f 以上ずれている箇所: {[(r['kind'], r['t'], r['visual_f']) for r in rep['summary']['visual_off']]}")
    if rep["black"]:
        warn.append(f"黒味あり: {rep['black']}")
    if rep["freeze"]:
        warn.append(f"1秒以上の静止: {rep['freeze']}（意図した止めか確認）")
    L = rep.get("loudness") or {}
    if L.get("integrated_lufs") is not None and abs(L["integrated_lufs"] + 14) > 1.0:
        warn.append(f"ラウドネス {L['integrated_lufs']} LUFS（目標 -14±1）")
    if L.get("true_peak_dbfs") is not None and L["true_peak_dbfs"] > -1.0:
        warn.append(f"トゥルーピーク {L['true_peak_dbfs']} dBFS（目標 ≤ -1）")
    if info["color"].get("color_space") != "bt709" and info["height"] >= 720:
        warn.append("色タグが BT.709 でない（プレーヤーで色がずれる可能性）")
    rep["warnings"] = warn
    (out / "report.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    show = {k: rep[k] for k in ("duration", "fps", "frames", "black", "freeze") if k in rep}
    show.update({k: rep[k] for k in ("loudness", "summary", "warnings") if k in rep})
    print(json.dumps(show, ensure_ascii=False, indent=1))
    print("->", out)


if __name__ == "__main__":
    main()
