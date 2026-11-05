#!/usr/bin/env python3
"""Studio BGM synthesizer — オリジナルBGMを数値合成で生成する。

外部音源・サンプルを一切使わず、numpy/scipy だけで楽曲を合成するので
著作権的に完全オリジナル。映像と同期させるための拍・小節・キュー時刻を
JSON で書き出す。

usage:
    python3 bgm.py song.json out.wav            # out.wav と out.beats.json を出力

song.json の主なキー（すべて任意。省略時は既定値）:
    bpm, bars, key(例 "D"), seed, swing(0-0.3), tail_sec
    progression: ["Dmaj7","Bm7","Gmaj7","A"]  1小節1コード、足りなければ循環
    sections: [{"from":0,"to":2,"layers":["pad","pluck"]}, ...]
        layers: kick snare clap hat openhat bass sub pad pluck arp bell lead
                riser impact chime stab
                epiano rim vinyl koto shaku taiko swell   （2026-11-05 追加: Lo-fi・和風・シネマ用）
    melody: [[bar, beat, "F#5", beats], ...]   (lead/bell が鳴らす)
    cues:   [{"bar":2,"beat":0,"type":"impact"}, {"bar":7,"type":"stab"}]
    mix:    {"kick":1.0, "pad":0.5, ...}       トラック別ゲイン
    reverb: 0-1, brightness: 0-1, drive: 0-1
    lofi: 0-1（バスのローパスと揺れ）, loop: true（末尾の残響を頭に回して継ぎ目なしのループにする）
    koto_pattern: [[beat, 和音の何番目, オクターブ], ...]  taiko_pattern: [[beat, 強さ], ...]
    （2026-11-05 審査を受けて追加）
    end_chord / pre_end_chord: 最後の小節・その前の小節の和音を上書き（主和音で終わるため）。chord_override: {"小節": "和音"}
    silence: [[bar, beat, 拍数], ...] その区間をデジタルゼロにする（間・暗転）
    snare_pattern: [拍,...]  bass_style: "legato"（bass_pattern: [[拍, 長さ拍], ...]）  pad_lp: パッドのローパス周波数
    pump_every_beat: true（キックがなくても毎拍サイドチェイン）  chime_intervals: [0,7,12,17]
    taiko_fill: {"every":4, "beats":[3,3.25,3.5,3.75], "g":[...]}  koto_patterns: [[...],[...]]（2小節ごとに交代）
    automation: [[秒, dB], ...] 全体の音量の折れ線  layers 追加: chop（スーパーソーの刻み）, ostinato（低弦の8分）
    cues 追加: braam
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48000
NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5,
        "F#": 6, "Gb": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}
QUAL = {
    "": [0, 4, 7], "maj": [0, 4, 7], "m": [0, 3, 7], "7": [0, 4, 7, 10],
    "maj7": [0, 4, 7, 11], "m7": [0, 3, 7, 10], "sus2": [0, 2, 7], "sus4": [0, 5, 7],
    "add9": [0, 4, 7, 14], "madd9": [0, 3, 7, 14], "m9": [0, 3, 7, 10, 14],
    "maj9": [0, 4, 7, 11, 14], "6": [0, 4, 7, 9], "m6": [0, 3, 7, 9], "dim": [0, 3, 6], "5": [0, 7, 12],
}


def midi_hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def parse_note(s):
    """'F#5' -> midi"""
    name = s[:-1] if s[-1].isdigit() else s
    octv = int(s[-1]) if s[-1].isdigit() else 4
    return NOTE[name] + 12 * (octv + 1)


def parse_chord(s):
    root = s[:2] if len(s) > 1 and s[1] in "#b" else s[:1]
    rest = s[len(root):]
    bass = None
    if "/" in rest:
        rest, bass = rest.split("/")
    q = QUAL.get(rest, QUAL[""])
    return NOTE[root], q, (NOTE[bass] if bass else None)


# ---------------------------------------------------------------- DSP utils
def env_adsr(n, a, d, s, r, sr=SR):
    a, d, r = int(a * sr), int(d * sr), int(r * sr)
    sus = max(n - a - d, 0)
    e = np.concatenate([
        np.linspace(0, 1, max(a, 1), endpoint=False),
        np.linspace(1, s, max(d, 1), endpoint=False),
        np.full(sus, s),
    ])[:n]
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)), constant_values=s)
    tail = s * np.exp(-np.linspace(0, 6, max(r, 1)))
    return np.concatenate([e, tail])


def lp(x, fc, order=2):
    fc = float(np.clip(fc, 20, SR / 2.2))
    b, a = signal.butter(order, fc / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    # PolyBLEP-less saw は高域が荒れるので加算合成で帯域制限
    out = np.zeros(n)
    k = 1
    while k * freq < SR / 2.5 and k < 40:
        out += np.sin(2 * np.pi * k * freq * t + phase * k) / k
        k += 1
    return out * (2 / np.pi)


def sweep_lp(x, f0, f1):
    """時間変化するローパス（ブロック処理）"""
    out = np.zeros_like(x)
    blk = 512
    zi = None
    nb = max(1, len(x) // blk + 1)
    for i in range(nb):
        s = slice(i * blk, (i + 1) * blk)
        if s.start >= len(x):
            break
        f = f0 * (f1 / f0) ** (i / nb)
        b, a = signal.butter(2, min(f, SR / 2.2) / (SR / 2), "low")
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        out[s], zi = signal.lfilter(b, a, x[s], zi=zi)
    return out


class Track:
    def __init__(self, n):
        self.buf = np.zeros((n, 2))

    def add(self, start, mono, pan=0.0, gain=1.0):
        i = int(start * SR)
        if i < 0:                      # 曲頭より前に始まる音（長いライザーなど）は、はみ出した部分を切り捨てる
            mono = mono[-i:]; i = 0
        if i >= len(self.buf) or len(mono) == 0:
            return
        j = min(i + len(mono), len(self.buf))
        l = np.cos((pan + 1) * np.pi / 4)
        r = np.sin((pan + 1) * np.pi / 4)
        seg = mono[: j - i] * gain
        self.buf[i:j, 0] += seg * l * 1.414
        self.buf[i:j, 1] += seg * r * 1.414

    def add_st(self, start, st, gain=1.0):
        i = int(start * SR)
        j = min(i + len(st), len(self.buf))
        if i < j:
            self.buf[i:j] += st[: j - i] * gain


# ---------------------------------------------------------------- instruments
def kick(punch=1.0):
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 11)
    click = hp(np.random.randn(n), 2500) * np.exp(-t * 400) * 0.25 * punch
    return np.tanh((body + click) * 1.6) * 0.9


def snare():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 28) * 0.6
    nz = bp(np.random.randn(n), 1200, 9000) * np.exp(-t * 18)
    return np.tanh((tone + nz) * 1.2) * 0.7


def clap():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    nz = bp(np.random.randn(n), 900, 6000)
    e = np.zeros(n)
    for k, d in enumerate([0, 0.011, 0.022, 0.034]):
        i = int(d * SR)
        e[i:] += np.exp(-(t[: n - i]) * (90 if k < 3 else 16))
    return nz * e * 0.5


def hat(open_=False):
    n = int((0.35 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    nz = hp(np.random.randn(n), 7000, 4)
    return nz * np.exp(-t * (9 if open_ else 70)) * (0.35 if open_ else 0.28)


def bass_note(m, dur, bright=0.5):
    n = int(dur * SR)
    f = midi_hz(m)
    x = saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR) * 0.7
    x = sweep_lp(x, 300 + 900 * bright, 180 + 300 * bright)
    return np.tanh(x * 1.4) * env_adsr(n, 0.004, 0.08, 0.7, 0.04)[:n] * 0.55


def sub_note(m, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * midi_hz(m) * t) * env_adsr(n, 0.01, 0.1, 0.9, 0.05)[:n] * 0.6


def pad_chord(ms, dur, bright=0.5):
    n = int((dur + 0.6) * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for m in ms:
        f = midi_hz(m)
        for det, pan in [(-0.11, -0.7), (0.0, 0.0), (0.12, 0.7)]:
            v = saw(f * 2 ** (det / 12), n, phase=np.random.rand() * 6.28)
            L += v * (1 - pan) * 0.5
            R += v * (1 + pan) * 0.5
    fc = 900 + 2600 * bright
    L, R = hp(lp(L, fc), 160), hp(lp(R, fc), 160)  # 低域は bass/kick に譲る
    e = env_adsr(int(dur * SR), 0.35, 0.4, 0.8, 0.6)[:n]
    e = np.pad(e, (0, n - len(e)))
    st = np.stack([L * e, R * e], 1) / (len(ms) * 3) * 1.4
    return st


def pluck_note(m, dur=0.4, bright=0.6):
    """Karplus-Strong"""
    f = midi_hz(m)
    n = int(max(dur, 0.25) * SR + 0.6 * SR)
    p = int(SR / f)
    buf = np.random.uniform(-1, 1, p)
    buf = lp(buf, 2000 + 6000 * bright, 1)
    out = np.zeros(n)
    damp = 0.996 - (1 - bright) * 0.006
    idx = 0
    # ベクトル化した KS: 周期ごとに平均化
    reps = n // p + 2
    seq = [buf]
    cur = buf
    for _ in range(reps):
        cur = damp * 0.5 * (cur + np.roll(cur, -1))
        seq.append(cur)
    out = np.concatenate(seq)[:n]
    t = np.arange(n) / SR
    return out * np.exp(-t * 2.2) * 0.55


def fm_bell(m, dur=1.2, idx=2.5):
    n = int((dur + 1.0) * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * idx * np.exp(-t * 3)
    x = np.sin(2 * np.pi * f * t + mod)
    return x * np.exp(-t * 2.4) * 0.35


def lead_note(m, dur, bright=0.6):
    n = int((dur + 0.15) * SR)
    t = np.arange(n) / SR
    f = midi_hz(m) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip(t * 3, 0, 1))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * 0.6 + np.sign(np.sin(ph)) * 0.12 + np.sin(2 * ph) * 0.15
    x = lp(x, 1800 + 4000 * bright)
    e = env_adsr(int(dur * SR), 0.02, 0.15, 0.75, 0.12)[:n]
    return x * np.pad(e, (0, n - len(e))) * 0.4


def epiano(ms, dur, bright=0.5):
    """FM のエレクトリックピアノ（Rhodes 風）。和音をまとめて鳴らす"""
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    L = np.zeros(n); R = np.zeros(n)
    for k, m in enumerate(ms):
        f = midi_hz(m)
        mod = np.sin(2 * np.pi * f * t) * (1.4 + bright) * np.exp(-t * 6)
        x = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * (1.6 + 0.02 * m))
        x += np.sin(2 * np.pi * f * 2 * t) * 0.12 * np.exp(-t * 9)
        trem = 1 + 0.18 * np.sin(2 * np.pi * 4.2 * t + k)
        pan = (k / max(1, len(ms) - 1) - 0.5) * 0.6
        L += x * trem * (1 - pan); R += x * trem * (1 + pan)
    e = np.ones(n); r = int(0.25 * SR); k0 = int(dur * SR)
    e[k0:k0 + r] = np.linspace(1, 0, min(r, n - k0)); e[k0 + r:] = 0
    return np.stack([L * e, R * e], 1) / len(ms) * 0.55


def rim():
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 90) + bp(np.random.randn(n), 2000, 7000) * np.exp(-t * 120) * 0.6
    return x * 0.35


def vinyl(n):
    """レコードのノイズ（細かい針音＋薄いヒス）"""
    x = hp(np.random.randn(n), 900) * 0.012
    pops = np.zeros(n)
    idx = np.random.randint(0, n, max(1, n // 9000))
    pops[idx] = np.random.uniform(0.15, 0.5, len(idx)) * np.random.choice([-1, 1], len(idx))
    pops = bp(pops, 1500, 9000)
    return lp(x + pops, 7000)


def koto_note(m, dur=1.6, bend=0.0):
    """箏：Karplus-Strong の撥弦に、明るい爪の立ち上がりと押し手（音程の持ち上げ）"""
    f = midi_hz(m)
    n = int((dur + 1.2) * SR)
    p = int(SR / f)
    buf = np.random.uniform(-1, 1, p)
    buf = buf - lp(buf, 300, 1)            # 胴鳴りを抜いて爪の硬さを出す
    reps = n // p + 2
    cur = buf; seq = [buf]
    for _ in range(reps):
        cur = 0.9985 * (0.62 * cur + 0.38 * np.roll(cur, -1)); seq.append(cur)
    x = np.concatenate(seq)[:n]
    t = np.arange(n) / SR
    if bend:
        # 押し手：0.25 秒後に bend 半音ぶん持ち上げる（時間伸縮で近似）
        r = 2 ** (bend / 12 * np.clip((t - 0.25) / 0.18, 0, 1))
        pos = np.cumsum(r); pos = pos[pos < n - 1]
        x = np.interp(pos, np.arange(n), x); x = np.pad(x, (0, n - len(x)))
    body = np.sin(2 * np.pi * f * t) * np.exp(-t * 5) * 0.15
    return (x * np.exp(-t * 1.3) + body) * 0.6


def shaku_note(m, dur, bright=0.5):
    """尺八風：息の帯域ノイズ＋ゆっくり深くなるビブラートの正弦、立ち上がりに『むら息』"""
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    vib = 1 + 0.009 * np.sin(2 * np.pi * 5.0 * t) * np.clip((t - 0.35) / 0.6, 0, 1)
    f = midi_hz(m) * vib * (1 - 0.03 * np.exp(-t * 14))   # 下から当てる
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.08 * np.sin(3 * ph)
    breath = bp(np.random.randn(n), midi_hz(m) * 1.5, min(9000, midi_hz(m) * 9)) * (0.35 + 0.6 * np.exp(-t * 6))
    e = env_adsr(int(dur * SR), 0.12, 0.2, 0.85, 0.35)[:n]; e = np.pad(e, (0, n - len(e)))
    return lp(tone * 0.5 + breath * 0.22 * (0.5 + bright), 6000) * e * 0.5


def taiko(strength=1.0):
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    f = 62 + 70 * np.exp(-t * 18)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    skin = bp(np.random.randn(n), 120, 1400) * np.exp(-t * 30) * 0.5
    harm = np.sin(2 * np.pi * np.cumsum(f * 2.3) / SR) * np.exp(-t * 7) * 0.3   # 倍音で小さなスピーカーでも聞こえる
    return np.tanh((body + skin + harm) * 1.3) * 0.75 * strength


def swell(ms, dur, bright=0.5):
    """弦の合奏風の和音（シネマ用。pad より暗い）。小節ごとに 0 から立ち上げ直さず、0.4 秒で前の和音と重ねて切り替える"""
    return pad_chord(ms, dur, bright * 0.6) * 1.3


def supersaw_chop(ms, dur):
    """Future bass のスーパーソーの和音チョップ：7声デチューン、頭で -2 半音から 30ms でベンド"""
    n = int((dur + 0.1) * SR)
    t = np.arange(n) / SR
    bendc = 2 ** (-2 / 12 * np.exp(-t / 0.012))
    L = np.zeros(n); R = np.zeros(n)
    for m in ms:
        f0 = midi_hz(m)
        for k in range(7):
            det = (k - 3) / 3 * 0.15
            f = f0 * 2 ** (det / 12) * bendc
            ph = 2 * np.pi * np.cumsum(f) / SR + k * 1.3
            v = 2 * ((ph / (2 * np.pi)) % 1) - 1
            pan = (k - 3) / 3 * 0.8
            L += v * (1 - pan); R += v * (1 + pan)
    L, R = lp(L, 7000), lp(R, 7000)
    L, R = hp(L, 180), hp(R, 180)
    e = np.minimum(1, t / 0.003) * np.where(t < dur, 1, np.exp(-(t - dur) / 0.03))
    return np.stack([L * e, R * e], 1) / (len(ms) * 7) * 0.9


def string_note(m, dur):
    """低弦の8分（ノコギリ波2声デチューン、LP 2.5kHz、アタック 8ms）"""
    n = int((dur + 0.08) * SR)
    t = np.arange(n) / SR
    f = midi_hz(m)
    x = saw(f * 2 ** (-0.08 / 12), n) + saw(f * 2 ** (0.08 / 12), n, 1.1)
    x = lp(x, 2500)
    e = np.minimum(1, t / 0.008) * np.where(t < dur, 1, np.exp(-(t - dur) / 0.03))
    return x * e * 0.3


def braam(m=38, dur=2.4):
    """金管風の braam：低い5度、LP を 300→2kHz に 1.5 秒でスイープ"""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = saw(midi_hz(m), n) + saw(midi_hz(m + 7), n, 0.7) + saw(midi_hz(m + 12), n, 1.9) * 0.5
    x = sweep_lp(x, 300, 2000)
    return np.tanh(x * 1.2) * np.minimum(1, t / 0.05) * np.exp(-t * 0.9) * 0.6


def riser(dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    nz = np.random.randn(n)
    x = sweep_lp(hp(nz, 300), 400, 12000)
    tone = np.sin(2 * np.pi * np.cumsum(200 * 2 ** (t / dur * 3)) / SR) * 0.2
    return (x * 0.5 + tone) * (t / dur) ** 2 * 0.6


def impact():
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(30 + 60 * np.exp(-t * 6)) / SR) * np.exp(-t * 2.2)
    nz = lp(np.random.randn(n), 3000) * np.exp(-t * 4) * 0.5
    return np.tanh((boom + nz) * 1.5) * 0.8


def chime(m=84, iv=(0, 7, 12, 16)):
    out = np.zeros(int(2.5 * SR))
    for k, mm in enumerate([m + i for i in iv]):
        b = fm_bell(mm, 1.2, 1.5)
        i = int(k * 0.06 * SR)
        out[i:i + len(b)] += b[: len(out) - i] * 0.6
    return out


# ---------------------------------------------------------------- reverb / mix
def make_ir(sec=2.2, sr=SR, seed=7):
    rng = np.random.default_rng(seed)
    n = int(sec * sr)
    t = np.arange(n) / sr
    decay = np.exp(-t * 6.9 / sec)
    L = rng.standard_normal(n) * decay
    R = rng.standard_normal(n) * decay
    L, R = lp(L, 6000), lp(R, 6000)
    L[: int(0.012 * sr)] = 0
    R[: int(0.017 * sr)] = 0
    return np.stack([L, R], 1) / np.sqrt(np.sum(L ** 2))


def reverb(st, amount, ir):
    if amount <= 0:
        return st
    wetL = signal.fftconvolve(st[:, 0], ir[:, 0])[: len(st)]
    wetR = signal.fftconvolve(st[:, 1], ir[:, 1])[: len(st)]
    wet = np.stack([wetL, wetR], 1)
    return st + wet * amount


def sidechain(n, kick_times, depth=0.6, rel=0.18):
    g = np.ones(n)
    t = np.arange(int(rel * 1.5 * SR)) / SR
    shape = 1 - depth * np.exp(-t / (rel / 3))
    for kt in kick_times:
        i = int(kt * SR)
        j = min(i + len(shape), n)
        if i < n:
            g[i:j] = np.minimum(g[i:j], shape[: j - i])
    return g


# ---------------------------------------------------------------- composer
def mono_low(x, fc=120):
    """120Hz 以下をモノにする（サイドだけハイパス）。スマホのモノ再生で低域が痩せない"""
    mid = (x[:, 0] + x[:, 1]) / 2; side = (x[:, 0] - x[:, 1]) / 2
    side = hp(side, fc, 2)
    return np.stack([mid + side, mid - side], 1)


def lofi_fx(x, lofi, wf):
    """Lo-fi のバス処理：ローパスとテープの揺れ"""
    n = len(x)
    fc = 9000 - 6000 * lofi
    x = np.stack([lp(x[:, 0], fc), lp(x[:, 1], fc)], 1)
    wow = 1 + 0.0025 * lofi * np.sin(2 * np.pi * wf * np.arange(n) / SR)
    pos = np.clip(np.cumsum(wow) - 1, 0, n - 1)
    return np.stack([np.interp(pos, np.arange(n), x[:, 0]), np.interp(pos, np.arange(n), x[:, 1])], 1)


def build(song):
    rng = np.random.default_rng(song.get("seed", 1))
    np.random.seed(song.get("seed", 1))
    bpm = song.get("bpm", 120)
    bars = song.get("bars", 8)
    beat = 60 / bpm
    bar = beat * 4
    tail = song.get("tail_sec", 1.5)
    total = bars * bar + tail
    N = int(total * SR)
    swing = song.get("swing", 0.0)
    bright = song.get("brightness", 0.55)
    prog = [parse_chord(c) for c in song.get("progression", ["C", "Am", "F", "G"])]
    key_root = NOTE.get(song.get("key", "C"), 0)
    sections = song.get("sections", [{"from": 0, "to": bars, "layers": ["kick", "hat", "bass", "pad", "pluck"]}])
    mix = {"kick": 1.0, "snare": 0.55, "clap": 0.5, "hat": 0.45, "openhat": 0.35, "bass": 0.7,
           "sub": 0.55, "pad": 0.5, "pluck": 0.45, "arp": 0.4, "bell": 0.4, "lead": 0.5,
           "riser": 0.45, "impact": 0.7, "chime": 0.4, "stab": 0.5}
    mix.update(song.get("mix", {}))
    drums = Track(N)
    music = Track(N)  # sidechain 対象
    fx = Track(N)
    kick_times = []

    def layers_at(b):
        L = set()
        for s in sections:
            if s.get("from", 0) <= b < s.get("to", bars):
                L |= set(s["layers"])
        return L

    def tpos(b, bt):
        # 8分裏にスウィング
        frac = bt - int(bt)
        sw = swing * beat * 0.5 if abs(frac - 0.5) < 1e-6 else 0
        return b * bar + bt * beat + sw

    ov = {int(k): parse_chord(v) for k, v in song.get("chord_override", {}).items()}
    if song.get("end_chord") and not song.get("loop"):
        ov.setdefault(bars - 1, parse_chord(song["end_chord"]))
    if song.get("pre_end_chord") and not song.get("loop") and bars >= 2:
        ov.setdefault(bars - 2, parse_chord(song["pre_end_chord"]))

    def chord_at(b):
        return ov.get(b, prog[b % len(prog)])

    K = kick()
    for b in range(bars):
        L = layers_at(b)
        root, q, bass_override = chord_at(b)
        base = 48 + root  # C3 基準
        chord = [base + 12 + iv for iv in q]
        # 中音域に寄せたボイシング
        chord = [m if m < 72 else m - 12 for m in chord]
        bass_m = 36 + (bass_override if bass_override is not None else root)
        if "kick" in L:
            pat = song.get("kick_pattern", [0, 1, 2, 3])
            for bt in pat:
                tt = tpos(b, bt)
                drums.add(tt, K, 0, mix["kick"])
                kick_times.append(tt)
        if "snare" in L:
            for bt in song.get("snare_pattern", [1, 3]):
                drums.add(tpos(b, bt), snare(), 0.05, mix["snare"])
        if "clap" in L:
            for bt in [1, 3]:
                drums.add(tpos(b, bt), clap(), -0.05, mix["clap"])
        if "hat" in L:
            for i in range(8):
                bt = i * 0.5
                v = 1.0 if i % 2 else 0.55
                drums.add(tpos(b, bt), hat(), 0.3, mix["hat"] * v * rng.uniform(0.85, 1.0))
            if song.get("hat16", False):
                for i in range(16):
                    if i % 2:
                        drums.add(b * bar + i * beat / 4, hat(), -0.3, mix["hat"] * 0.3)
        if "openhat" in L:
            for bt in [0.5, 1.5, 2.5, 3.5]:
                drums.add(tpos(b, bt), hat(True), -0.2, mix["openhat"])
        if "bass" in L and song.get("bass_style") == "legato":
            for bt, ln in song.get("bass_pattern", [[0, 2.4], [2.5, 1.4]]):
                music.add(tpos(b, bt), lp(bass_note(bass_m, ln * beat, bright * 0.4), 400), 0, mix["bass"])
        elif "bass" in L:
            for i in range(8):
                bt = i * 0.5
                if i % 2 == 0 and "kick" in L:
                    continue  # キックとぶつけない（裏打ちベース）
                m = bass_m + (12 if i == 7 else 0)
                music.add(tpos(b, bt), bass_note(m, beat * 0.45, bright), 0, mix["bass"])
        if "sub" in L:
            music.add(b * bar, sub_note(bass_m - 12 if bass_m > 40 else bass_m, bar * 0.98), 0, mix["sub"])
        if "pad" in L:
            pc = pad_chord(chord, bar, bright)
            if song.get("pad_lp"):
                pc = np.stack([lp(pc[:, 0], song["pad_lp"]), lp(pc[:, 1], song["pad_lp"])], 1) * 1.15
            music.add_st(b * bar, pc, mix["pad"])
        if "chop" in L:
            pat = song.get("chop_pattern", [0, 0.75, 1.5, 2.5, 3.0, 3.5])
            vo = [m + 12 for m in chord]
            for k, bt in enumerate(pat):
                nxt = pat[k + 1] if k + 1 < len(pat) else 4
                music.add_st(tpos(b, bt), supersaw_chop(vo, (nxt - bt) * beat * 0.8), mix.get("chop", 0.55))
        if "ostinato" in L:
            tones = [36 + root, 36 + root + q[1], 36 + root + q[2]]
            for i, k in enumerate([0, 0, 1, 0, 2, 0, 1, 0]):
                music.add(tpos(b, i * 0.5), string_note(tones[k] + 12, beat * 0.42), 0.2 if i % 2 else -0.2, mix.get("ostinato", 0.35))
        if "pluck" in L or "arp" in L:
            tones = sorted(chord + [chord[0] + 12, chord[1] + 12])
            order = song.get("arp_order", [0, 2, 1, 3, 2, 4, 3, 5])
            step = 0.5 if "pluck" in L else 0.25
            nsteps = int(4 / step)
            for i in range(nsteps):
                m = tones[order[i % len(order)] % len(tones)] + 12
                pan = -0.45 if i % 2 else 0.45
                g = mix["pluck"] if "pluck" in L else mix["arp"]
                music.add(tpos(b, i * step), pluck_note(m, beat * step, bright), pan, g * (1.0 if i % 4 == 0 else 0.75))
        if "stab" in L:
            for m in chord:
                music.add(b * bar, pluck_note(m + 12, 0.3, 0.9), 0, mix["stab"] * 0.6)
        if "epiano" in L:
            for bt, ln in song.get("epiano_pattern", [[0, 1.5], [1.5, 1.0], [2.5, 1.5]]):
                vo = [m + 12 if m < 57 else m for m in chord]
                music.add_st(tpos(b, bt), epiano(vo, ln * beat, bright), mix.get("epiano", 0.5) * rng.uniform(0.85, 1.0))
        if "rim" in L:
            for bt in song.get("rim_pattern", [1, 3]):
                drums.add(tpos(b, bt), rim(), 0.15, mix.get("rim", 0.45))
        if "koto" in L:
            tones = sorted(chord + [chord[0] + 12])
            kps = song.get("koto_patterns") or [song.get("koto_pattern", [[0, 0, 1], [1, 2, 1], [2, 1, 1], [3, 3, 1]])]
            for bt, k, octv, *rest in kps[(b // 2) % len(kps)]:
                m = tones[int(k) % len(tones)] + 12 * octv
                music.add(tpos(b, bt), koto_note(m, beat * 2, rest[0] if rest else 0), 0.25 if k % 2 else -0.25, mix.get("koto", 0.6) * rng.uniform(0.85, 1.15))
        if "taiko" in L:
            for bt, g in song.get("taiko_pattern", [[0, 1.0], [2.5, 0.6]]):
                tt = tpos(b, bt)
                drums.add(tt, taiko(g), 0, mix.get("taiko", 0.8)); kick_times.append(tt)
            tf = song.get("taiko_fill")
            if tf and (b + 1) % tf.get("every", 4) == 0:
                for bt, g in zip(tf["beats"], tf["g"]):
                    drums.add(tpos(b, bt), taiko(g), 0, mix.get("taiko", 0.8))
        if "swell" in L:
            music.add_st(b * bar, swell(chord, bar, bright), mix.get("swell", 0.5))
    # melody
    for ev in song.get("melody", []):
        b, bt, nm, d = ev[:4]
        m = parse_note(nm) if isinstance(nm, str) else nm
        L = layers_at(int(b))
        tt = tpos(b, bt)
        if "bell" in L:
            music.add(tt, fm_bell(m, d * beat), 0.15, mix["bell"])
        if "shaku" in L:
            music.add(tt, shaku_note(m, d * beat, bright), -0.1, mix.get("shaku", 0.55))
            continue
        if "kotomel" in L:
            music.add(tt, koto_note(m, d * beat, ev[4] if len(ev) > 4 else 0), 0.1, mix.get("kotomel", 0.6))
            continue
        if "lead" in L or "bell" not in L:
            music.add(tt, lead_note(m, d * beat, bright), -0.1, mix["lead"])
    # cues
    cue_out = []
    for c in song.get("cues", []):
        tt = c.get("bar", 0) * bar + c.get("beat", 0) * beat
        ty = c["type"]
        cue_out.append({"t": round(tt, 4), "type": ty})
        if ty == "riser":
            d = c.get("len_beats", 4) * beat
            fx.add(tt - d, riser(d), 0, mix["riser"])
        elif ty == "impact":
            fx.add(tt, impact(), 0, mix["impact"])
            kick_times.append(tt)
        elif ty == "chime":
            fx.add(tt, chime(c.get("note", 84), song.get("chime_intervals", (0, 7, 12, 16))), 0.1, mix["chime"])
        elif ty == "braam":
            fx.add(tt, braam(c.get("note", 38)), 0, mix.get("braam", 0.5))
        elif ty == "stab":
            root, q, _ = chord_at(int(c.get("bar", 0)))
            for iv in q:
                fx.add(tt, pluck_note(60 + root + iv, 1.0, 0.9), 0, mix["stab"])
                fx.add(tt, fm_bell(72 + root + iv, 1.5, 1.2), 0.2, mix["stab"] * 0.6)
            fx.add(tt, K, 0, mix["kick"])
    if song.get("pump_every_beat"):
        sc = sidechain(N, [i * beat for i in range(int(bars * 4) + 1)], song.get("sidechain", 0.55), 0.25)
    else:
        sc = sidechain(N, kick_times, song.get("sidechain", 0.55))
    music.buf *= sc[:, None]
    ir = make_ir(song.get("reverb_sec", 2.2))
    rv = song.get("reverb", 0.25)
    mixbus = drums.buf + reverb(drums.buf * 0.25, rv * 0.5, ir) - drums.buf * 0.25 \
        + reverb(music.buf, rv, ir) + reverb(fx.buf, rv * 1.3, ir)
    # master: HP 30Hz, ゆるいサチュレーション, ノーマライズ
    if any("vinyl" in s["layers"] for s in sections):
        vn = vinyl(N); mixbus = mixbus + np.stack([vn, vn * 0.9], 1) * mix.get("vinyl", 1.0)
    if song.get("loop"):
        L0 = int(round(bars * bar * SR))
        body = mixbus[:L0].copy(); tl = mixbus[L0:]
        body[:len(tl)] += tl[:L0]          # 末尾の残響を頭に回す → 継ぎ目なし
        # フィルタの状態が頭とお尻で違うと継ぎ目に段差が出るので、2周つないでから後半を使う
        two = np.concatenate([body, body])
        if song.get("lofi"):            # Lo-fi も2周つないだ上でかける（揺れの周期はループ長の約数）
            Ls = bars * bar
            two = lofi_fx(two, song["lofi"], max(1, round(0.55 * Ls)) / Ls)
        two = mono_low(two)
        mixbus = np.stack([hp(two[:, 0], 28), hp(two[:, 1], 28)], 1)[L0:]
    else:
        if song.get("lofi"):
            mixbus = lofi_fx(mixbus, song["lofi"], 0.55)
        mixbus = mono_low(mixbus)
        mixbus = np.stack([hp(mixbus[:, 0], 28), hp(mixbus[:, 1], 28)], 1)
    drive = song.get("drive", 0.3)
    mixbus = np.tanh(mixbus * (1 + drive * 2)) / np.tanh(1 + drive * 2)
    if song.get("automation"):
        pts = song["automation"]; tt_ = np.arange(len(mixbus)) / SR
        gdb = np.interp(tt_, [p[0] for p in pts], [p[1] for p in pts])
        mixbus = mixbus * (10 ** (gdb / 20))[:, None]
    sil = []
    for b0, bt0, nb in song.get("silence", []):
        t0 = b0 * bar + bt0 * beat; t1 = t0 + nb * beat; sil.append([round(t0, 4), round(t1, 4)])
    peak = np.max(np.abs(mixbus)) + 1e-9
    mixbus = mixbus / peak * 0.89
    # 末尾フェード
    if not song.get("loop"):
        fo = int(min(tail, 1.2) * SR)
        mixbus[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 2
    for t0, t1 in sil:                    # 意図した無音（間）：デジタルゼロ。前後 4ms で閉じる
        i0, i1 = int(t0 * SR), int(t1 * SR); f = int(0.004 * SR)
        mixbus[max(0, i0 - f):i0] *= np.linspace(1, 0, min(f, i0))[:, None]
        mixbus[i0:i1] = 0
        mixbus[i1:i1 + f] *= np.linspace(0, 1, len(mixbus[i1:i1 + f]))[:, None]
    beats = [round(i * beat, 4) for i in range(int(bars * 4) + 1)]
    fps_ok = [f for f in (24, 25, 30, 48, 60) if abs(beat * f - round(beat * f)) < 1e-6]
    meta = {
        "bpm": bpm, "beat_sec": beat, "bar_sec": bar, "bars": bars,
        "music_end_sec": round(bars * bar, 4), "total_sec": round(total, 4),
        "beats": beats, "downbeats": beats[::4], "cues": cue_out,
        "sections": sections, "silence": sil, "fps_beat_exact": fps_ok,
    }
    return mixbus, meta


def write_wav(path, st):
    pcm = (np.clip(st, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    song = json.loads(Path(sys.argv[1]).read_text())
    st, meta = build(song)
    out = Path(sys.argv[2])
    write_wav(out, st)
    out.with_suffix(".beats.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    print(f"wrote {out} ({meta['total_sec']}s, {meta['bpm']}bpm)")
