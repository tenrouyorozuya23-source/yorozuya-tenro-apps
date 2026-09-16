"""Extract per-video-frame audio features: RMS, bass/mid/high band energy, onsets."""
import json, subprocess
import numpy as np

SRC = "/root/.claude/uploads/479c9c35-7524-5be0-9909-9a5f23203d37/814357ac-Kagebi_-_Electronic_Band_Mix.mp3"
SR = 48000
FPS = 24

raw = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", SRC, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
    capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype=np.float32)
dur = len(x) / SR
nframes = int(dur * FPS)
hop = SR // FPS  # 2000 samples per video frame
win = 4096

def band_energy(spec, freqs, lo, hi):
    m = (freqs >= lo) & (freqs < hi)
    return float(np.sqrt(np.mean(spec[m] ** 2))) if m.any() else 0.0

NBANDS = 24
edges = np.geomspace(40, 12000, NBANDS + 1)
feat = {"fps": FPS, "duration": dur, "rms": [], "bass": [], "mid": [], "high": [], "centroid": [], "bands": []}
freqs = np.fft.rfftfreq(win, 1 / SR)
hann = np.hanning(win)
band_masks = [(freqs >= edges[b]) & (freqs < edges[b + 1]) for b in range(NBANDS)]
for i in range(nframes):
    c = i * hop
    seg = x[max(0, c - win // 2): max(0, c - win // 2) + win]
    if len(seg) < win:
        seg = np.pad(seg, (0, win - len(seg)))
    feat["rms"].append(float(np.sqrt(np.mean(seg ** 2))))
    spec = np.abs(np.fft.rfft(seg * hann))
    feat["bass"].append(band_energy(spec, freqs, 30, 150))
    feat["mid"].append(band_energy(spec, freqs, 150, 2000))
    feat["high"].append(band_energy(spec, freqs, 4000, 12000))
    tot = spec.sum() + 1e-9
    feat["centroid"].append(float((spec * freqs).sum() / tot))
    feat["bands"].append([float(np.sqrt(np.mean(spec[m] ** 2))) if m.any() else 0.0 for m in band_masks])

# normalize each 0..1 with soft percentile clip
for k in ["rms", "bass", "mid", "high", "centroid"]:
    a = np.array(feat[k])
    lo, hi = np.percentile(a, 2), np.percentile(a, 99)
    a = np.clip((a - lo) / (hi - lo + 1e-9), 0, 1)
    feat[k] = [round(float(v), 4) for v in a]

# normalize each spectral band independently (per-band percentile clip)
B = np.array(feat["bands"])
lo = np.percentile(B, 5, axis=0)
hi = np.percentile(B, 99, axis=0)
B = np.clip((B - lo) / (hi - lo + 1e-9), 0, 1)
feat["bands"] = [[round(float(v), 3) for v in row] for row in B]

# onset detection: spectral flux on bass+mid, pick peaks
rms = np.array(feat["rms"])
bass = np.array(feat["bass"])
flux = np.maximum(0, np.diff(bass, prepend=bass[0]))
thresh = np.convolve(flux, np.ones(FPS) / FPS, mode="same") * 1.6 + 0.02
onsets = []
for i in range(1, len(flux) - 1):
    if flux[i] > thresh[i] and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1]:
        if not onsets or i - onsets[-1] > FPS // 6:
            onsets.append(i)
feat["onsets"] = onsets

# smoothed energy curve (1s window) for section shading
smooth = np.convolve(rms, np.ones(FPS) / FPS, mode="same")
feat["energy"] = [round(float(v), 4) for v in smooth]

with open("/tmp/claude-0/-home-user-yorozuya-tenro-apps/479c9c35-7524-5be0-9909-9a5f23203d37/scratchpad/features.json", "w") as f:
    json.dump(feat, f)

# print a coarse energy map (per 5 s) to see song structure
print(f"duration={dur:.1f}s frames={nframes} onsets={len(onsets)}")
for t in range(0, int(dur), 5):
    i0, i1 = t * FPS, min((t + 5) * FPS, nframes)
    e = smooth[i0:i1].mean()
    print(f"{t:4d}s {'#' * int(e * 60)}")
