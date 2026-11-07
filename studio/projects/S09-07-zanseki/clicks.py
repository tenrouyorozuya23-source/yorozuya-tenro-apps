# 席が消える瞬間の短いクリック（16分音符の格子）を BGM に足し、-14 LUFS に合わせ直す
import sys, json, subprocess, numpy as np, soundfile as sf
sys.path.insert(0, '/home/user/yorozuya-tenro-apps/studio/tools')
import bgm_pack as P, bgm
wav = sys.argv[1]; x, sr = sf.read(wav)
beat = 60 / 96; s16 = beat / 4
rng = np.random.default_rng(7)
n = int(.012 * sr); env = np.exp(-np.linspace(0, 9, n))
for t0 in (2.5, 5.0, 7.5):
    for k in range(8):
        t = t0 - 2 * beat + k * s16          # 打点の2拍前から 8 回
        b = bgm.bp(rng.standard_normal(n), 1400, 2800)
        c = b / (np.abs(b).max() + 1e-9) * env * 10 ** (-24 / 20) * (0.8 + 0.2 * (k % 2))
        i = int(t * sr); pan = 0.5 + 0.3 * np.sin(k)
        x[i:i + n, 0] += c * (1 - pan) * 1.4; x[i:i + n, 1] += c * pan * 1.4
tmp = wav + '.tmp.wav'
for _ in range(8):
    sf.write(tmp, x, sr, subtype='FLOAT'); i, tp = P.measure(tmp)
    if abs(i + 14) <= .2 and tp <= -2.0: break
    x = x * 10 ** ((-14 - i) / 20); x = P.limit(x, ceil_db=-4.5); x = P.zero(x, json.load(open(sys.argv[2]))['silence'])
sf.write(wav, x, sr, subtype='PCM_24')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', wav[:-4] + '.m4a'], check=True)
print(P.measure(wav), P.measure(wav[:-4] + '.m4a'), P.bands(x))
