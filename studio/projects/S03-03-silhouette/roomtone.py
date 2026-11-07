# 5.0〜5.9375 に客席のルームトーン（-42 dBFS 相当、ハイパス 120Hz）を足し、-14 LUFS に合わせ直す
import sys, json, subprocess, numpy as np, soundfile as sf
sys.path.insert(0, '/home/user/yorozuya-tenro-apps/studio/tools')
import bgm_pack as P, bgm
wav, beats = sys.argv[1], sys.argv[2]
x, sr = sf.read(wav)
t0, t1 = 5.0, 5.9375; n = int((t1 - t0) * sr)
nz = np.stack([bgm.hp(np.random.default_rng(3).standard_normal(n), 120), bgm.hp(np.random.default_rng(4).standard_normal(n), 120)], 1)
nz = bgm.lp(nz[:, 0], 3000)[:, None] * [1, 0] + bgm.lp(nz[:, 1], 3000)[:, None] * [0, 1]
env = np.minimum(1, np.linspace(0, 1, n) * 4)[:, None]
nz = nz / np.abs(nz).max() * 10 ** (-36 / 20) * env
i = int(t0 * sr); x[i:i + n] += nz
sil = json.load(open(beats))['silence']
tmp = wav + '.tmp.wav'
for _ in range(8):
    sf.write(tmp, x, sr, subtype='FLOAT'); I, tp = P.measure(tmp)
    if abs(I + 14) <= .2 and tp <= -2.0: break
    x = P.zero(P.limit(x * 10 ** ((-14 - I) / 20), ceil_db=-4.5), sil)
sf.write(wav, x, sr, subtype='PCM_24'); subprocess.run(['rm', tmp])
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '192k', wav[:-4] + '.m4a'], check=True)
print(P.measure(wav))
