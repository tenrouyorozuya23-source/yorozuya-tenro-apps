#!/usr/bin/env python3
"""P015 の音: ライブラリ曲（TNR-M12 抜粋）＋合成 SE。

SE は sync point で置く（whoosh=通過のピーク、chime/impact=立ち上がり）、1フレーム早め。
SE の前後で音楽を -3dB ダック。10.85–11.22 は本当の無音（デジタルゼロ）。
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))
import bgm  # noqa: E402

SR = 48000
F1 = 1 / 30
d = json.load(open("beats.json"))
music, sr = sf.read("bgm.wav")
assert sr == SR
N = len(music)
fx = np.zeros((N, 2))
duck = np.ones(N)
fr = lambda t: round(t * 30) / 30
DB = d["downbeats"]


def place(t, mono, gain, pan=0.0):
    i = int(max(t, 0) * SR)
    j = min(i + len(mono), N)
    if i >= N:
        return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    fx[i:j, 0] += mono[: j - i] * gain * l * 1.414
    fx[i:j, 1] += mono[: j - i] * gain * r * 1.414
    a, b = max(0, i - int(.08 * SR)), min(N, j)
    duck[a:b] = np.minimum(duck[a:b], 10 ** (-3 / 20))


def whoosh(peak_t, length=0.48):
    n = int(length * SR)
    t = np.arange(n) / SR
    nz = np.random.default_rng(int(peak_t * 1000)).standard_normal(n)
    x = bgm.sweep_lp(bgm.hp(nz, 400), 600, 9000)
    env = np.exp(-((t - length / 2) / (length / 5)) ** 2)  # 中央がピーク
    return x * env * 0.5, length / 2


# ホイップ（小節頭が通過ピーク）
for k in (1, 2, 3):
    w, half = whoosh(fr(DB[k]))
    place(fr(DB[k]) - half - F1, w, 0.55, pan=(-.3, .3, -.3)[k - 1])
# ヒーロー：J カットの chime（絵より先）と、星が灯る3つの chime
HERO = fr(DB[4])
place(HERO - 0.06 - F1, bgm.fm_bell(91, 1.2, 1.2), 0.32, 0.1)
for i, dt in enumerate((.28, .56, .84)):
    place(HERO + dt - F1, bgm.fm_bell((86, 89, 93)[i], 1.0, 1.4), 0.30, (-.4, .4, 0)[i])
# 最後の盛り上がり：impact（余韻がエンド画に残る L カット）
FIN = fr(DB[5])
place(FIN - F1, bgm.impact(), 0.5)

out = music * duck[:, None] + fx
# 本当の無音（前後 5ms フェード）
s0, s1 = int(10.85 * SR), int(11.22 * SR)
f = int(.005 * SR)
out[s0 - f:s0] *= np.linspace(1, 0, f)[:, None]
out[s0:s1] = 0.0
out[s1:s1 + f] *= np.linspace(0, 1, f)[:, None]
peak = np.max(np.abs(out))
if peak > 0.98:
    out *= 0.98 / peak
sf.write("mix.wav", out, SR, subtype="PCM_24")
print("mix.wav", len(out) / SR, "s, peak", round(float(peak), 3), "silence", 10.85, "-", 11.22)
