#!/usr/bin/env python3
"""BGM ライブラリ用の一括書き出し。1 ジャンル＝1 つの pack.json から、30秒・ループ・15秒・6秒などの版を作る。

usage:
    python3 bgm_pack.py pack.json OUTDIR [--lufs -14]

pack.json:
    {"id": "TNR-B01", "title": "...", "base": {bgm.py の song.json と同じキー},
     "versions": {"30s": {"length": 30.0, "bars": 15, "sections": [...], ...上書き},
                  "loop": {"loop": true, "bars": 8, ...}, "15s": {...}, "6s": {...}}}
    - 版ごとの値は base に上書きされる（melody/cues は版ごとに書く。省略時は base のもの）
    - length を書いた版は、その秒数ちょうどに切る（足りなければ無音で埋める）。末尾 0.8 秒でフェード
    - loop 版は bgm.py の loop（末尾の残響を頭に回す）で、長さは bars × 小節ちょうど

出力（OUTDIR/<id>_<版>.*）:
    .wav（48kHz/24bit）・.m4a（AAC 192k、試聴用）・.beats.json（拍とキュー）
    OUTDIR/<id>.report.json : 版ごとの LUFS・TP・帯域差（20–200Hz 合計 − 200–2000Hz 合計, dB）・ステレオ相関・
                              ループ継ぎ目の段差（直前2サンプルからの予測とのずれを、曲中で最大の同じ量と比べた倍率。1 以下なら曲中の音の出だしより目立たない）
    OUTDIR/<id>.spec.png    : 30秒版のスペクトログラム（拍の印付き）
帯域: 20–200Hz が 200–2000Hz より max_low_mid_db（既定 +4dB）を超えたら、200Hz 以下だけを下げて収める（ループ版は2周つないで処理）。
ラウドネス: ffmpeg ebur128 で測り、直線のゲインだけで -14 LUFS に合わせる（ループの継ぎ目を壊さないため
           loudnorm の動的処理は使わない）。TP が -1.2 dBTP を超える分はゲインを下げて守る（その場合 LUFS は低めになる）。
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import bgm  # noqa: E402

SR = bgm.SR


def measure(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    i = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", r)[-1])
    tp = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)[-1])
    return i, tp


def bands(x):
    m = x.mean(1)
    sp = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    f = np.fft.rfftfreq(len(m), 1 / SR)
    lo = sp[(f >= 20) & (f < 200)].sum()
    mid = sp[(f >= 200) & (f < 2000)].sum()
    return round(10 * np.log10(lo / mid), 2)


def corr(x):
    a, b = x[:, 0], x[:, 1]
    return round(float(np.corrcoef(a, b)[0, 1]), 3)


def seam(x):
    """ループの継ぎ目の段差。直前2サンプルからの直線予測と実際の値のずれを、曲中で最大の同じ量（打楽器の立ち上がり）と比べた倍率（1 以下なら、曲中の音の出だしより目立たない）"""
    e = np.abs(x[2:] - (2 * x[1:-1] - x[:-2])).max(1)
    j = np.abs(x[0] - (2 * x[-1] - x[-2])).max()
    return round(float(j / (e.max() + 1e-9)), 3)   # 曲中で最大の段差（打楽器の立ち上がり）と比べる。1 以下なら曲中の音の出だしと同じ程度


def spectrogram(x, meta, out, title):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    m = x.mean(1)
    fig, ax = plt.subplots(figsize=(12, 3.2), dpi=110)
    ax.specgram(m, NFFT=2048, Fs=SR, noverlap=1536, cmap="magma", vmin=-120)
    ax.set_yscale("symlog", linthresh=200)
    ax.set_ylim(30, 16000)
    for t in meta.get("downbeats", []):
        ax.axvline(t, color="w", lw=0.4, alpha=0.35)
    ax.set_title(title, fontsize=10)
    ax.set_xlabel("秒" if False else "sec")
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)


def limit(x, ceil_db=-2.4, look=0.004, rel=0.09, loop=False):
    """先読みピークリミッター。ceil を超える瞬間だけゲインを下げ、release でゆっくり戻す"""
    src = np.concatenate([x, x, x]) if loop else x   # ループは3周つないで真ん中を使う（両端の処理の影響を避ける）
    c = 10 ** (ceil_db / 20)
    # トゥルーピークで判定する：4 倍にオーバーサンプルしてサンプル間のピークも拾う（倍音の多い音色で 2〜3dB 跳ねるため）
    from scipy.signal import resample_poly
    up = resample_poly(src, 4, 1, axis=0)
    pk = np.abs(up).max(1)[: len(src) * 4].reshape(-1, 4).max(1)
    if len(pk) < len(src):
        pk = np.pad(pk, (0, len(src) - len(pk)), mode="edge")
    need = np.minimum(1.0, c / (pk + 1e-12))
    la = int(look * SR)
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1, mode="wrap" if loop else "nearest")
    a = np.exp(-1 / (rel * SR))
    out = np.empty_like(g); cur = 1.0
    for i in range(len(g)):            # 下げるのは即時、戻すのは release
        cur = g[i] if g[i] < cur else a * cur + (1 - a) * g[i]
        out[i] = cur
    k = np.ones(la) / la
    out = np.convolve(out, k, mode="same")
    y = src * np.minimum(out, need * 0 + 1)[:, None]
    k = 0.8 * c                          # 天井の手前からなめらかに寄せる（ハードクリップはサンプル間ピークを生む）
    ay = np.abs(y)
    y = np.where(ay > k, np.sign(y) * (k + (c - k) * np.tanh((ay - k) / (c - k))), y)
    return y[len(x):2 * len(x)] if loop else y


def zero(st, sil):
    """意図した無音を、帯域補正・リミッターの後にもう一度デジタルゼロにする（フィルタのにじみを消す）"""
    f = int(0.004 * SR)
    fi = int(0.018 * SR)                  # 無音への入りは 18ms で絞る（3ms だと耳でチッと聞こえる恐れ。S08-03 審査）
    for t0, t1 in sil:
        i0, i1 = int(t0 * SR), int(t1 * SR)
        st[max(0, i0 - fi):i0] *= np.linspace(1, 0, min(fi, i0))[:, None] ** 2
        st[i0:i1] = 0
        st[i1:i1 + f] *= np.linspace(0, 1, len(st[i1:i1 + f]))[:, None]
    return st


def main():
    a = sys.argv[1:]
    pack = json.loads(Path(a[0]).read_text())
    outdir = Path(a[1]); outdir.mkdir(parents=True, exist_ok=True)
    target = float(a[a.index("--lufs") + 1]) if "--lufs" in a else -14.0
    pid = pack["id"]
    report = {"id": pid, "title": pack.get("title"), "versions": {}}
    for name, ov in pack["versions"].items():
        song = {**pack["base"], **ov}
        st, meta = bgm.build(song)
        if "length" in ov and not song.get("loop"):
            n = int(round(ov["length"] * SR))
            st = st[:n] if len(st) >= n else np.pad(st, ((0, n - len(st)), (0, 0)))
            fo = int(0.8 * SR)
            st[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
        # 帯域の自動補正：20–200Hz が 200–2000Hz より +4dB を超えるぶんだけ低域を下げる（スマホで聴き取れるように）
        eq_db = 0.0
        for _ in range(4):
            dlt = bands(st)
            if dlt <= pack.get("max_low_mid_db", 4.0):
                break
            g = 10 ** (-(dlt - pack.get("max_low_mid_db", 4.0)) / 20) - 1
            src = np.concatenate([st, st, st]) if song.get("loop") else st
            low = np.stack([bgm.lp(src[:, 0], 200, 2), bgm.lp(src[:, 1], 200, 2)], 1)
            src = src + g * low
            st = src[len(st):2 * len(st)] if song.get("loop") else src
            eq_db += 20 * np.log10(1 + g)
        tmp = outdir / f"{pid}_{name}.tmp.wav"
        sf.write(tmp, st, SR, subtype="FLOAT")
        i, tp = measure(tmp)
        lim_db = 0.0
        for _ in range(8):                 # ゲインで -14 に合わせ、超えたピークはリミッターで抑える（±0.2 LUFS・TP -1.2 以下まで）
            st = st * 10 ** ((target - i) / 20)
            before = np.abs(st).max()
            st = limit(st, loop=bool(song.get("loop")))
            st = zero(st, meta.get("silence", []))
            lim_db = max(lim_db, round(20 * np.log10(before / (np.abs(st).max() + 1e-12)), 1))
            sf.write(tmp, st, SR, subtype="FLOAT")
            i, tp = measure(tmp)
            if abs(i - target) <= 0.2 and tp <= -1.2:
                break
        if tp > -1.2:
            st = st * 10 ** ((-1.3 - tp) / 20)
        wav = outdir / f"{pid}_{name}.wav"
        sf.write(wav, st, SR, subtype="PCM_24")
        tmp.unlink()
        i2, tp2 = measure(wav)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                        str(outdir / f"{pid}_{name}.m4a")], check=True)
        (outdir / f"{pid}_{name}.beats.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        rec = {"sec": round(len(st) / SR, 3), "bpm": song.get("bpm"), "fps_beat_exact": meta.get("fps_beat_exact"), "silence": meta.get("silence"), "lufs": i2, "tp": tp2,
               "low_minus_mid_db": bands(st), "low_shelf_db": round(eq_db, 1), "limiter_db": lim_db, "stereo_corr": corr(st)}
        if song.get("loop"):
            rec["seam_ratio"] = seam(st)
        report["versions"][name] = rec
        print(pid, name, rec)
        if name == pack.get("spec_version", "30s"):
            spectrogram(st, meta, outdir / f"{pid}.spec.png", f"{pid} {pack.get('genre','')} ({name})")
    (outdir / f"{pid}.report.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
