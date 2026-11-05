#!/usr/bin/env python3
"""P017 の音: TNR-M04 を timeline.json の区間で切り出し、消灯・点灯の SE を合成して重ねる。
usage: python3 mix.py <TNR-M04 の wav> <out.wav>
SE のトランジェントはイベント時刻ちょうどに置く（審査で ±1f ゲートを外れたため、1f 前置きはやめた）。暗転の間は音楽・SE ともデジタルゼロ。"""
import json, sys
import numpy as np, soundfile as sf
tl = json.load(open(__file__.rsplit('/',1)[0] + '/timeline.json'))
src, out = sys.argv[1], sys.argv[2]
x, sr = sf.read(src, always_2d=True)
m = tl['music']; dur = tl['dur']
a = x[int(m['src_in']*sr): int(m['src_in']*sr) + int(dur*sr)].copy()
n = len(a); t = np.arange(n)/sr
fo = m['fade_out']; a *= np.clip((dur - t)/fo, 0, 1)[:, None] ** 1.5
a[:int(.004*sr)] *= np.linspace(0, 1, int(.004*sr))[:, None]
# 暗転の間：音楽を完全なデジタルゼロにし、無音明けからゆっくり戻す
s0, s1 = tl['silence']; r0, r1 = tl['music_return']
g = np.ones(n); g[(t >= s0)] = 0
k = (t >= r0) & (t < r1); g[k] = (10 ** (-30/20)) * (1 - ((t[k]-r0)/(r1-r0))) + ((t[k]-r0)/(r1-r0)) ** 2 * 1.0
g[(t >= r1)] = 1; g[(t >= s0 - .03) & (t < s0)] = np.linspace(1, 0, int(np.sum((t >= s0 - .03) & (t < s0))))
a *= g[:, None]
rng = np.random.default_rng(17)
def env(L, atk, dec):
    tt = np.arange(L)/sr; return np.minimum(tt/atk, 1) * np.exp(-tt/dec)
def relay():  # 金属リレーの「カチッ」: 短いノイズ＋高めの減衰共振2本
    L = int(.18*sr); tt = np.arange(L)/sr
    nz = rng.standard_normal(L) * env(L, .0005, .004)
    body = (np.sin(2*np.pi*2350*tt)*.6 + np.sin(2*np.pi*3900*tt)*.35) * env(L, .0003, .018)
    thump = np.sin(2*np.pi*140*tt) * env(L, .001, .03) * .5
    return (nz*.5 + body + thump) * .22
def lamp():  # 大型灯体の点灯「ガチャン・ドン」: リレー＋低い胴鳴り（120Hz 以上、サブベースなし）
    L = int(1.4*sr); tt = np.arange(L)/sr
    r = np.zeros(L); rr = relay(); r[:len(rr)] += rr * 1.3
    boom = (np.sin(2*np.pi*(82+30*np.exp(-tt*8))*tt)*.25 + np.sin(2*np.pi*164*tt)*.45 + np.sin(2*np.pi*246*tt)*.2) * env(L, .002, .32)
    return r + boom * .35
def rope():  # 綱元の擦過音：帯域を絞ったノイズが 1.2 秒かけて膨らみ、消える（-24dBFS 程度）
    L = int(1.6*sr); tt = np.arange(L)/sr
    nz = rng.standard_normal(L)
    sm = np.convolve(nz, np.ones(24)/24, 'same') - np.convolve(nz, np.ones(160)/160, 'same')
    e = np.sin(np.pi*np.clip(tt/1.6, 0, 1)) ** 1.5 * (1 + .25*np.sin(2*np.pi*5.5*tt))
    return sm * e * .5
SND = {'relay_click': relay, 'lamp_thunk': lamp, 'fly_rope': rope}
for s in tl['sfx']:
    snd = SND[s['type']]()
    i = int(round(s['t'] * sr)); j = min(n, i + len(snd))
    a[i:j] += snd[:j-i, None] * np.array([.9, 1.0])[None, :]
sf.write(out, a.astype(np.float32), sr, subtype='PCM_24')
print('wrote', out, n/sr, 's  peak', float(np.abs(a).max()))
