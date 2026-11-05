#!/usr/bin/env python3
"""楽曲解析 — 既存の音源（SUNO 等）を映像に合わせるための情報を抽出する。

usage:
    python3 analyze_audio.py <audio> <out_prefix> [--title "曲名"]

出力:
    <out_prefix>.json   BPM・拍・小節頭・キー・ラウドネス・セクション・エネルギー曲線・
                        クライマックス・推奨カット（6/15/30/60秒、小節頭に揃える）
    <out_prefix>.png    メルスペクトログラム＋エネルギー曲線＋セクション境界（目視用）

推奨カットの考え方:
    - 開始と終了を小節頭に揃える（映像のカットも小節頭に置ける）
    - 終了はセクション境界かエネルギーの谷に寄せる（曲が「終わった感」を出せる）
    - 広告用（6/15秒）は最もエネルギーが高い区間、30/60秒は盛り上がりを含む区間
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np

KS_MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def ebur128(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    s = r[r.rfind("Summary:"):]
    g = lambda p: (float(m.group(1)) if (m := re.search(p, s)) else None)
    return g(r"I:\s+(-?[\d.]+) LUFS"), g(r"Peak:\s+(-?[\d.]+) dBFS"), g(r"LRA:\s+([\d.]+) LU")


def key_of(chroma):
    c = chroma.mean(1)
    best = None
    for i in range(12):
        for prof, mode in [(KS_MAJ, "major"), (KS_MIN, "minor")]:
            r = np.corrcoef(c, np.roll(prof, i))[0, 1]
            if best is None or r > best[0]:
                best = (r, f"{NAMES[i]} {mode}")
    return best[1], round(float(best[0]), 3)


def track_beats(onset, sr, hop, tightness=100.0):
    """Ellis (2007) の動的計画法ビートトラッカーを numpy で実装（librosa.beat は環境により numba で落ちるため）"""
    fps = sr / hop
    o = onset / (onset.std() + 1e-9)
    # テンポ: オンセット自己相関を 120BPM 中心の対数ガウスで重み付け
    ac = np.correlate(o, o, "full")[len(o) - 1:]
    lags = np.arange(len(ac))
    bpm = 60 * fps / np.maximum(lags, 1)
    w = np.exp(-0.5 * (np.log2(bpm / 120.0) / 1.0) ** 2)
    valid = (bpm >= 60) & (bpm <= 200)
    period = int(lags[valid][np.argmax((ac * w)[valid])])
    # 2倍/半分テンポのうちオンセットに合う方を補正はせず、周期をそのまま採用
    n = len(o)
    score = o.copy()
    back = np.full(n, -1)
    lo, hi = int(round(period / 2)), int(round(period * 2))
    for t in range(lo, n):
        prev = np.arange(max(0, t - hi), t - lo + 1)
        if len(prev) == 0:
            continue
        pen = -tightness * (np.log((t - prev) / period)) ** 2
        cand = score[prev] + pen
        j = np.argmax(cand)
        score[t] = o[t] + cand[j]
        back[t] = prev[j]
    # 末尾付近の最大から逆にたどる
    tail = max(0, n - period)
    t = tail + int(np.argmax(score[tail:]))
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    beats = np.array(beats[::-1])
    return 60 * fps / period, beats * hop / sr


def downbeat_phase(beat_times, onset_env, sr, hop):
    """4拍子を仮定し、低域の強いアタックが最も揃う位相を小節頭とする"""
    frames = librosa.time_to_frames(beat_times, sr=sr, hop_length=hop)
    frames = frames[frames < len(onset_env)]
    scores = [onset_env[frames[p::4]].mean() if len(frames[p::4]) else 0 for p in range(4)]
    return int(np.argmax(scores))


def best_window(t_grid, energy, starts, length, dur, boundaries):
    best = None
    for s in starts:
        e = s + length
        if e > dur - 0.25:
            break
        m = (t_grid >= s) & (t_grid < e)
        if not m.any():
            continue
        score = energy[m].mean()
        # 終わりがセクション境界に近いほど加点（自然に終われる）
        if boundaries:
            d = min(abs(e - b) for b in boundaries)
            score += 0.15 * np.exp(-d / 2.0)
        if best is None or score > best[0]:
            best = (score, s, e)
    return None if best is None else [round(best[1], 3), round(best[2], 3)]


def analyze(path, title=None):
    y, sr = librosa.load(path, sr=22050, mono=True)
    dur = len(y) / sr
    hop = 512
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    tempo, beats = track_beats(onset, sr, hop)
    tempo = float(tempo)
    # 低域オンセットで小節頭を推定
    S = np.abs(librosa.stft(y, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr)
    low_on = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S[freqs < 200]), sr=sr, hop_length=hop)
    ph = downbeat_phase(beats, low_on, sr, hop) if len(beats) > 8 else 0
    downbeats = beats[ph::4]
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=hop)
    key, key_conf = key_of(chroma)
    # エネルギー（0.5秒刻み、0-1正規化）
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)
    grid = np.arange(0, dur, 0.5)
    e = np.interp(grid, t_rms, rms)
    e = np.convolve(e, np.ones(4) / 4, mode="same")
    e_db = 20 * np.log10(e + 1e-6)
    # 曲中の大きい所（95パーセンタイル）から 18dB 下までを 0-1 に割り当てる（min-max だと殆どの曲で張り付く）
    ref = np.percentile(e_db, 95)
    en = np.clip((e_db - (ref - 18)) / 18, 0, 1)
    # セクション（クロマ＋MFCC を平均化して凝集型クラスタリング）
    mfcc = librosa.feature.mfcc(y=y, sr=sr, hop_length=hop, n_mfcc=13)
    feat = np.vstack([librosa.util.normalize(chroma, axis=1), librosa.util.normalize(mfcc, axis=1)])
    bf = librosa.util.fix_frames(librosa.time_to_frames(downbeats, sr=sr, hop_length=hop), x_max=feat.shape[1])
    sync = librosa.util.sync(feat, bf, aggregate=np.median)
    k = int(np.clip(round(dur / 22), 3, 12))
    k = min(k, max(2, sync.shape[1] - 1))
    bounds_idx = librosa.segment.agglomerative(sync, k)
    bound_t = sorted(set([0.0] + [float(librosa.frames_to_time(bf[i], sr=sr, hop_length=hop)) for i in bounds_idx if i < len(bf)] + [dur]))
    sections = []
    for a, b in zip(bound_t[:-1], bound_t[1:]):
        if b - a < 1.0:
            continue
        m = (grid >= a) & (grid < b)
        sections.append({"start": round(a, 2), "end": round(b, 2), "energy": round(float(en[m].mean()) if m.any() else 0, 3)})
    # 音色の手がかり
    cent = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
    H, P = librosa.effects.hpss(y)
    perc = float(np.sum(P ** 2) / (np.sum(H ** 2) + np.sum(P ** 2) + 1e-9))
    spec = np.abs(np.fft.rfft(y[: sr * 60] if dur > 60 else y))
    f = np.fft.rfftfreq(len(spec) * 2 - 2, 1 / sr)[: len(spec)]
    band = lambda lo, hi: float(10 * np.log10((spec[(f >= lo) & (f < hi)] ** 2).sum() + 1e-9))
    win8 = int(8 / 0.5)
    cl = np.convolve(en, np.ones(win8) / win8, mode="valid")
    climax = float(grid[int(np.argmax(cl))] + 4) if len(cl) else dur / 2
    # 最初に鳴り始める位置（無音・フェードインのスキップ用）
    first_sound = float(grid[np.argmax(en > 0.25)]) if (en > 0.25).any() else 0.0
    starts = [float(d) for d in downbeats if d >= first_sound - 0.01]
    bnds = [s["end"] for s in sections]
    cuts = {str(L): best_window(grid, en, starts, L, dur, bnds) for L in (6, 15, 30, 60) if L < dur}
    lufs, tp, lra = ebur128(path)
    return {
        "title": title or Path(path).stem, "file": Path(path).name, "duration": round(dur, 2),
        "bpm": round(tempo, 1), "beat_sec": round(60 / tempo, 4) if tempo else None,
        "key": key, "key_confidence": key_conf,
        "lufs": lufs, "true_peak": tp, "lra": lra,
        "brightness_hz": round(cent), "percussive_ratio": round(perc, 3),
        "bands_db": {"low_20_200": round(band(20, 200), 1), "mid_200_2k": round(band(200, 2000), 1), "high_2k_8k": round(band(2000, 8000), 1)},
        "first_sound": round(first_sound, 2), "climax_center": round(climax, 2),
        "sections": sections, "cuts": cuts,
        "beats": [round(float(b), 3) for b in beats], "downbeats": [round(float(b), 3) for b in downbeats],
        "energy_curve_2hz": [round(float(v), 3) for v in en],
    }


def plot(path, a, out_png):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    y, sr = librosa.load(path, sr=22050, mono=True)
    M = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, n_mels=96), ref=np.max)
    fig, ax = plt.subplots(2, 1, figsize=(14, 4.6), sharex=True, gridspec_kw={"height_ratios": [3, 1.2]})
    ax[0].imshow(M, origin="lower", aspect="auto", extent=[0, a["duration"], 0, 96], cmap="magma")
    ax[0].set_title(f"{re.sub(r'[^\x00-\x7f]', '', a['title'])}  |  {a['bpm']} BPM  {a['key']}  {a['lufs']} LUFS", fontsize=10)
    g = np.arange(len(a["energy_curve_2hz"])) * 0.5
    ax[1].plot(g, a["energy_curve_2hz"], color="#2F3FB8")
    for s in a["sections"]:
        for x in ax:
            x.axvline(s["start"], color="#FFB547", lw=1)
    for L, c in (a["cuts"] or {}).items():
        if c:
            ax[1].axvspan(c[0], c[1], alpha=0.12, color={"6": "red", "15": "orange", "30": "green", "60": "blue"}[L])
    ax[1].axvline(a["climax_center"], color="red", ls="--", lw=1)
    ax[1].set_xlabel("sec")
    fig.tight_layout()
    fig.savefig(out_png, dpi=80)
    plt.close(fig)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    title = sys.argv[sys.argv.index("--title") + 1] if "--title" in sys.argv else None
    a = analyze(sys.argv[1], title)
    Path(sys.argv[2] + ".json").write_text(json.dumps(a, ensure_ascii=False, indent=1))
    try:
        plot(sys.argv[1], a, sys.argv[2] + ".png")
    except ImportError:
        pass
    print(json.dumps({k: a[k] for k in ("title", "duration", "bpm", "key", "lufs", "climax_center", "cuts")}, ensure_ascii=False))
