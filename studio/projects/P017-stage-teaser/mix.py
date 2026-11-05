#!/usr/bin/env python3
"""P017 の音: TNR-M04 を timeline.json の区間で切り出し、消灯・点灯の SE を合成して重ねる。
usage: python3 mix.py <TNR-M04 の wav> <out.wav>
SE は sync point（トランジェント）をイベント時刻の1フレーム前に置く（playbook §7.5）。"""
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
for s in tl['sfx']:
    snd = relay() if s['type'] == 'relay_click' else lamp()
    i = int(round((s['t'] - 1/30) * sr)); j = min(n, i + len(snd))
    a[i:j] += snd[:j-i, None] * np.array([.9, 1.0])[None, :]
sf.write(out, a.astype(np.float32), sr, subtype='PCM_24')
print('wrote', out, n/sr, 's  peak', float(np.abs(a).max()))
