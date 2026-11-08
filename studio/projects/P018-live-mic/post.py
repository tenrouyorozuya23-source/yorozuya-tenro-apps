# 光の筋が開く拍・扇が広がる拍に、ムービングライトの首振りの小さなメカ音（チルトのモーター 120ms・ハイパス 400Hz）と薄いシマーを足す。
# マスターは 35Hz 以下を切り、80Hz を -2dB、3kHz を +1.5dB。最後に -14 LUFS・mp4（AAC）で TP -1.5 以下になるまで詰める
import sys, json, subprocess, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt
sys.path.insert(0, '/home/user/yorozuya-tenro-apps/studio/tools')
import bgm_pack as P
src = 'audio/P018-bgm_15s.wav'; x, sr = sf.read(src)
BEAT = 60 / 128; BAR = 4 * BEAT
cues = [BAR + k * BEAT for k in range(8)] + [3 * BAR + k * 2 * BEAT for k in range(4)]
rng = np.random.default_rng(7)
def tick(gain):
    n = int(.12 * sr); t = np.arange(n) / sr
    motor = np.sin(2 * np.pi * (180 + 900 * t) * t) * np.exp(-t * 28)
    nz = sosfilt(butter(4, 400, 'hp', fs=sr, output='sos'), rng.standard_normal(n)) * np.exp(-t * 40) * .5
    sh = np.sin(2 * np.pi * 8000 * t) * np.exp(-t * 16) * .15
    return (motor * .5 + nz + sh) * gain
for i, c in enumerate(cues):
    g = 10 ** ((-30 + min(i, 11) * .6) / 20); y = tick(g); s = int((c - .03) * sr)   # 着地のフレームにピーク
    pan = np.sin(i * 1.7) * .4; x[s:s + len(y), 0] += y * (1 - pan); x[s:s + len(y), 1] += y * (1 + pan)
def peq(sig, f0, gain_db, q):
    A = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / sr; al = np.sin(w) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w), 1 - al / A]
    from scipy.signal import lfilter
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], sig, axis=0)
x = sosfilt(butter(4, 35, 'hp', fs=sr, output='sos'), x, axis=0); x = peq(x, 80, -2, 1.0); x = peq(x, 3000, 1.5, .8)
sil = json.load(open('audio/P018-bgm_15s.beats.json'))['silence']
out = 'audio/P018-final.wav'
for _ in range(10):
    sf.write(out, x, sr, subtype='PCM_24')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', out, '-c:a', 'aac', '-b:a', '192k', '/tmp/p018.m4a'], check=True)
    I, tp = P.measure('/tmp/p018.m4a')
    if abs(I + 14) <= .3 and tp <= -1.5: break
    x = P.zero(P.limit(x * 10 ** ((-14 - I) / 20), ceil_db=-4.5), sil)
print('final', I, tp)
