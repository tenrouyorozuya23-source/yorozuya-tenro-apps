#!/usr/bin/env python3
"""映像と音声を合体し、配信規格に合わせてマスタリングし、品質チェックを出す。

usage:
    python3 master.py video.mp4 bgm.wav out.mp4 [--lufs -14] [--dur 15] [--fade 0.6] [--grain 5]   (grain: 3〜6 が目安)
    python3 master.py --qc out.mp4            # QC だけ

出力:
    out.mp4               H.264 + AAC 192k / faststart / -14 LUFS(SNS標準) / TP -1dB
    out.qc.json           尺・解像度・fps・ラウドネス・無音/黒味検出
    out.sheet.jpg         コンタクトシート（1秒ごとのサムネ）— 目視レビュー用
    out.poster.jpg        サムネイル（中盤のフレーム）
"""
import json
import re
import subprocess
import sys
from pathlib import Path


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def loudnorm_measure(wav, lufs):
    r = run(["ffmpeg", "-hide_banner", "-i", wav, "-af",
             f"loudnorm=I={lufs}:TP=-1.0:LRA=11:print_format=json", "-f", "null", "-"])
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S)
    return json.loads(m.group(0))


def master(video, wav, out, lufs=-14.0, dur=None, fade=0.6, grain=0):
    meas = loudnorm_measure(wav, lufs)
    ln = (f"loudnorm=I={lufs}:TP=-1.0:LRA=11:measured_I={meas['input_i']}:"
          f"measured_TP={meas['input_tp']}:measured_LRA={meas['input_lra']}:"
          f"measured_thresh={meas['input_thresh']}:offset={meas['target_offset']}:linear=true")
    try:
        silent = float(meas["input_i"]) < -70
    except ValueError:
        silent = True
    af = "anull" if silent else ln   # 無音（テスト用）では loudnorm が計算できないので素通し
    if dur:
        af += f",afade=t=out:st={max(dur - fade, 0)}:d={fade}"
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", video, "-i", wav,
           "-map", "0:v", "-map", "1:a"]
    if grain:  # フィルムグレイン（時間方向に変化する微細なノイズ）を後付けして再エンコード
        cmd += ["-vf", f"noise=c0s={grain}:c0f=t+u,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17",
                "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
    else:
        cmd += ["-c:v", "copy"]
    cmd += ["-af", af, "-ar", "48000",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]
    if dur:
        cmd += ["-t", str(dur)]
    cmd += [out]
    r = run(cmd)
    if r.returncode:
        print(r.stderr)
        sys.exit(1)
    return qc(out)


def qc(path):
    p = Path(path)
    pr = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path]).stdout)
    v = next((s for s in pr["streams"] if s["codec_type"] == "video"), {})
    a = next((s for s in pr["streams"] if s["codec_type"] == "audio"), None)
    rep = {
        "file": p.name,
        "duration": round(float(pr["format"]["duration"]), 3),
        "size_mb": round(int(pr["format"]["size"]) / 1e6, 2),
        "width": v.get("width"), "height": v.get("height"),
        "fps": v.get("r_frame_rate"), "vcodec": v.get("codec_name"),
        "acodec": a.get("codec_name") if a else None,
    }
    if a:
        r = run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"])
        s = r.stderr[r.stderr.rfind("Summary:"):]
        gi = re.search(r"I:\s+(-?[\d.]+) LUFS", s)
        tp = re.search(r"Peak:\s+(-?[\d.]+) dBFS", s)
        rep["integrated_lufs"] = float(gi.group(1)) if gi else None
        rep["true_peak_dbfs"] = float(tp.group(1)) if tp else None
        sil = run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=n=-45dB:d=0.8", "-f", "null", "-"]).stderr
        rep["silences"] = re.findall(r"silence_start: ([\d.]+)", sil)
    bl = run(["ffmpeg", "-hide_banner", "-i", path, "-vf", "blackdetect=d=0.3:pix_th=0.06", "-an", "-f", "null", "-"]).stderr
    rep["black_segments"] = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bl)
    # contact sheet
    n = max(1, int(rep["duration"]))
    cols = 8 if (rep["width"] or 0) < (rep["height"] or 1) else 5
    rows = (n + cols - 1) // cols
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", path, "-vf",
         f"fps=1,scale=270:-1,tile={cols}x{rows}:padding=6:color=0x222222", "-frames:v", "1",
         "-q:v", "3", str(p.with_suffix(".sheet.jpg"))])
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(rep["duration"] * 0.55), "-i", path,
         "-frames:v", "1", "-q:v", "2", str(p.with_suffix(".poster.jpg"))])
    checks = []
    if rep.get("integrated_lufs") is not None and abs(rep["integrated_lufs"] + 14) > 1.5:
        checks.append("ラウドネスが -14 LUFS から 1.5dB 以上ずれている")
    if rep.get("true_peak_dbfs") is not None and rep["true_peak_dbfs"] > -0.5:
        checks.append("トゥルーピークが -0.5 dBFS を超えている")
    if rep["black_segments"]:
        checks.append(f"黒味あり: {rep['black_segments']}")
    rep["warnings"] = checks
    p.with_suffix(".qc.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1))
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    return rep


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        sys.exit(1)
    if a[0] == "--qc":
        qc(a[1])
        sys.exit(0)
    def opt(k, d):
        return type(d)(a[a.index("--" + k) + 1]) if "--" + k in a else d
    master(a[0], a[1], a[2], lufs=opt("lufs", -14.0), dur=opt("dur", 0.0) or None, fade=opt("fade", 0.6), grain=opt("grain", 0))
