"""Cinematic SFX generator for the Tenro-sai 2026 teaser.
Synthesizes impacts (taiko-style booms), a braam, risers and whooshes
aligned to the BGM's onset timeline, and writes sfx.wav (48kHz stereo).
"""
import numpy as np
import wave

SR = 48000
DUR = 19.5
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)

rng = np.random.default_rng(42)


def add(sig, t0, gL=1.0, gR=1.0):
    i0 = int(t0 * SR)
    n = min(len(sig), N - i0)
    if n <= 0:
        return
    L[i0:i0 + n] += sig[:n] * gL
    R[i0:i0 + n] += sig[:n] * gR


def onepole_lp(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    b = 1 - a
    for i in range(len(x)):
        acc = a * acc + b * x[i]
        y[i] = acc
    return y


def boom(dur=0.9, f0=68.0, f1=32.0, amp=1.0, punch=1.0):
    """Sub boom with pitch drop + noise thump + click."""
    t = np.arange(int(dur * SR)) / SR
    freq = f1 + (f0 - f1) * np.exp(-t * 9)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t * 5.5)
    # noise thump (lowpassed)
    nz = rng.standard_normal(len(t)) * np.exp(-t * 30)
    nz = onepole_lp(nz, 300) * 2.2 * punch
    # click transient
    click = rng.standard_normal(int(0.008 * SR)) * np.hanning(int(0.008 * SR)) * 0.5 * punch
    sig = body + nz
    sig[:len(click)] += click
    return sig * amp


def braam(dur=2.0, base=55.0, amp=1.0):
    """Brass-like dark sustained hit: stacked detuned harmonics, lowpassed."""
    t = np.arange(int(dur * SR)) / SR
    sig = np.zeros_like(t)
    for mult, det, g in [(1, 0, 1.0), (1, 0.7, 0.8), (2, 1.1, 0.5), (3, -0.9, 0.3), (4, 1.6, 0.18), (0.5, 0.3, 0.6)]:
        f = base * mult + det
        for h in range(1, 6):
            sig += (g / h) * np.sin(2 * np.pi * f * h * t + rng.uniform(0, 6.28))
    env = np.minimum(t / 0.06, 1.0) * np.exp(-t * 1.9)
    sig = onepole_lp(sig * env, 900)
    return sig / (np.max(np.abs(sig)) + 1e-9) * amp


def riser(dur=1.8, amp=1.0):
    """Noise riser: opening lowpass + volume ramp + rising tone."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    nz = rng.standard_normal(n)
    # crude opening filter: blend of heavily-lowpassed -> raw
    lp = onepole_lp(nz, 500)
    sig = lp * (1 - p) + nz * p * 0.7
    # rising shepard-ish tone
    f = 120 * (2 ** (p * 2.2))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    sig = (sig * 0.9 + tone) * (p ** 2.2)
    # tiny gap at the very end for the hit to land clean
    cut = int(0.03 * SR)
    sig[-cut:] *= np.linspace(1, 0, cut)
    return sig / (np.max(np.abs(sig)) + 1e-9) * amp


def whoosh(dur=0.4, amp=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    p = t / dur
    nz = onepole_lp(rng.standard_normal(n), 1400)
    env = np.sin(np.pi * p) ** 2
    return nz * env / (np.max(np.abs(nz * env)) + 1e-9) * amp


# ---- timeline (matches anim.html) ----
T_TEN, T_ROU, T_SAI, T_YEAR = 0.627, 0.836, 1.138, 1.486
T_CAST, T_SOON, T_BIG, T_KAI, T_END = 7.709, 9.497, 13.70, 14.211, 16.60

# whooshes leading into stamp groups
add(whoosh(0.35, 0.5), T_TEN - 0.33, 0.9, 1.0)
add(whoosh(0.38, 0.55), T_CAST - 0.36, 1.0, 0.85)
add(whoosh(0.28, 0.45), T_KAI - 0.26, 0.85, 1.0)

# kanji stamp impacts
add(boom(0.7, 70, 36, 0.52, 1.0), T_TEN)
add(boom(0.7, 66, 34, 0.50, 1.0), T_ROU, 0.85, 1.0)
add(boom(0.8, 72, 34, 0.58, 1.1), T_SAI, 1.0, 0.85)
add(boom(0.6, 60, 32, 0.40, 0.8), T_YEAR)
add(boom(1.0, 74, 33, 0.72, 1.2), T_CAST)
add(boom(0.4, 90, 50, 0.22, 0.7), T_SOON)

# the big reveal: riser -> huge boom + braam
add(riser(1.78, 0.95), T_BIG - 1.80)
add(boom(1.6, 80, 28, 1.0, 1.5), T_BIG)
add(braam(2.2, 55, 0.55), T_BIG + 0.02, 1.0, 0.92)
add(boom(1.0, 70, 30, 0.75, 1.2), T_KAI, 0.9, 1.0)

# soft closing boom under the end card
add(boom(1.4, 50, 26, 0.34, 0.5), T_END)

# gentle stereo glue + peak normalize to -3 dBFS
mix = np.stack([L, R])
peak = np.max(np.abs(mix))
mix = mix / (peak + 1e-9) * 0.70

data = (mix.T * 32767).astype(np.int16)
with wave.open('sfx.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print('sfx.wav written', data.shape)
