# S08-08 サウンドロゴ10本：各 4.5 秒の枠、0.5 秒に光と音の一打をそろえる
import sys, json, subprocess, numpy as np, soundfile as sf
sys.path.insert(0, '/home/user/yorozuya-tenro-apps/studio/tools')
import bgm as B, bgm_pack as P
SR = B.SR; SLOT = 4.5; HIT = 8 / 30
np.random.seed(11)
IR = B.make_ir(2.4)
def buf(): return np.zeros(int(SLOT * SR))
def M(s): return s.mean(1) if s.ndim == 2 else s
def put(x, sig, t, g=1.0):
    sig = M(sig)
    i = int(t * SR); n = min(len(sig), len(x) - i)
    if n > 0: x[i:i + n] += sig[:n] * g
def fade(x, sec=.6):
    n = int(sec * SR); w = np.cos(np.linspace(0, np.pi / 2, n)) ** 2; x[-n:] *= (w[:, None] if x.ndim == 2 else w); return x
def L01():  # 霞ヶ丘精工：金属の走査音 → 高いピン
    x = buf(); n = int(HIT * SR); t = np.arange(n) / SR
    scan = B.bp(np.random.randn(n), 3000, 9000) * (t / HIT) ** 2 * .12
    put(x, scan, 0); put(x, B.fm_bell(96, 1.6, 3.2), HIT, .7); put(x, B.fm_bell(84, 2.0, 1.2), HIT, .35); return x, .30
def L02():  # 月影ホテル：柔らかい和音に鐘
    x = buf(); pad = M(B.pad_chord([62, 66, 69, 73, 76], 3.6, .35)); put(x, pad * np.minimum(1, np.arange(len(pad)) / (SR * .5)), 0, .5)
    put(x, B.fm_bell(81, 2.2, 1.4), HIT, .6); put(x, B.fm_bell(88, 1.8, 1.2), HIT + .35, .35); return x, .38
def L03():  # 暁ホールディングス：上昇 → 低い一打と開いた和音
    x = buf(); put(x, B.riser(HIT), 0, .6); put(x, B.impact(), HIT, .6); put(x, B.swell([50, 57, 62, 66, 69], 3.2, .5), HIT, .45); return x, .28
def L04():  # Maison Yūgure：はじく音のアルペジオ
    x = buf()
    for k, m in enumerate([69, 73, 76, 81, 85]): put(x, B.pluck_note(m, .9, .55), HIT + k * .09, .5)
    put(x, B.pad_chord([57, 64, 69, 73], 3.0, .3), HIT, .25); return x, .35
def L05():  # Sirius Acoustics：低い鼓動 → 星の鐘
    x = buf(); put(x, B.kick(1.2), HIT, .8); put(x, B.sub_note(38, .8), HIT, .5); put(x, B.chime(88, (0, 7, 12, 19)), HIT + .02, .5); return x, .30
def L06():  # 筆影：箏の二音（二音目は押し手で上げない・音階内）
    x = buf(); put(x, B.koto_note(62, 2.4), HIT, .8); put(x, B.koto_note(69, 2.2), HIT + .42, .6); put(x, B.koto_note(74, 2.0), HIT + .84, .45); return x, .32
def L07():  # Hoshimi Optics：シャッターの小さな音 → 開く鐘
    x = buf(); put(x, B.rim(), HIT, .55); put(x, B.hat(False), HIT + .03, .3); put(x, B.chime(84, (0, 7, 14, 19)), HIT + .06, .5); return x, .30
def L08():  # Lune Atelier：二つの小さな鐘
    x = buf(); put(x, B.fm_bell(88, 2.0, 1.0), HIT, .55); put(x, B.fm_bell(95, 1.8, .9), HIT + .24, .4); put(x, B.pad_chord([64, 71, 76], 3.2, .25), HIT, .2); return x, .42
def L09():  # Atelier Kasumi：エレピの和音
    x = buf(); put(x, B.epiano([60, 64, 67, 71, 74], 3.2, .45), HIT, .6); put(x, B.fm_bell(79, 1.6, 1.0), HIT + .5, .25); return x, .36
def L10():  # ノクターン・ラボ：16分の四音 → 鐘
    x = buf(); s16 = 60 / 120 / 4
    for k, m in enumerate([74, 78, 81, 86]): put(x, B.pluck_note(m, .35, .7), HIT + k * s16, .5)
    put(x, B.fm_bell(90, 1.8, 1.6), HIT + 4 * s16, .45); return x, .30
FN = [L01, L02, L03, L04, L05, L06, L07, L08, L09, L10]
def master(st, path, target=-14):
    tmp = path + '.tmp.wav'
    for _ in range(8):
        sf.write(tmp, st, SR, subtype='FLOAT'); i, tp = P.measure(tmp)
        if abs(i - target) <= .2 and tp <= -2.0: break
        st = P.limit(st * 10 ** ((target - i) / 20), ceil_db=-4.5)
    sf.write(path, st, SR, subtype='PCM_24'); subprocess.run(['rm', tmp]); return P.measure(path)
out = '/home/user/yorozuya-tenro-apps/studio/projects/S08-08-soundlogos/audio/'
facts = json.load(open('/home/user/yorozuya-tenro-apps/studio/projects/S08-08-soundlogos/facts.json'))
allst = []; rep = {}
for f, c in zip(FN, facts['companies']):
    x, rv = f(); x = fade(x / (np.abs(x).max() + 1e-9) * .5)
    st = np.stack([x, x], 1); st = B.reverb(st, rv, IR)[:len(x)]
    st = fade(st)
    rep[c['id']] = master(st.copy(), out + f"{c['id']}.wav")
    allst.append(sf.read(out + f"{c['id']}.wav")[0])
reel = np.concatenate(allst)
rep['reel'] = master(reel, out + 'S08-08-reel.wav')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', out + 'S08-08-reel.wav', '-c:a', 'aac', '-b:a', '192k', out + 'S08-08-reel.m4a'], check=True)
rep['reel_m4a'] = P.measure(out + 'S08-08-reel.m4a'); rep['bands_reel'] = float(P.bands(reel))
json.dump(rep, open(out + 'report.json', 'w'), ensure_ascii=False, indent=1); print(rep)
