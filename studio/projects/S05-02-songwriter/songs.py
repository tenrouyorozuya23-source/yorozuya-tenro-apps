#!/usr/bin/env python3
"""S05-02 の試聴用の見本音源（歌なしのインスト3曲・各30秒）を作る。曲名・アーティストは架空。"""
import json, subprocess, sys
from pathlib import Path
H = Path(__file__).parent
NOTES = "C C# D D# E F F# G G# A A# B".split()
def scale(key, minor=False):
    r = NOTES.index(key); iv = [0,2,3,5,7,8,10] if minor else [0,2,4,5,7,9,11]
    return [(r+i) for i in iv]
def nm(pc, octv): return NOTES[pc % 12] + str(octv + (pc // 12))
def melody(key, minor, phrases, start_oct=5):
    sc = scale(key, minor); out = []
    for bar, degs in phrases:          # degs: [(beat, degree, beats)]
        for beat, d, ln in degs:
            o, k = divmod(d, 7)
            out.append([bar, beat, nm(sc[k], start_oct + o), ln])
    return out
SONGS = [
 dict(id="yoake", title="夜明けの手紙", bpm=76, key="F", minor=False, seed=21, bars=9, prog=["Fmaj9","Dm9","Bbmaj7","C6"],
      layers=[[0,1,["epiano"]],[1,5,["epiano","sub"]],[5,9,["epiano","sub","pad"]]],
      mix={"epiano":0.55,"sub":0.16,"pad":0.3,"lead":0.3}, bright=0.45, reverb=0.45,
      mel=[(1,[(0,4,1),(1,2,1),(2,4,1),(3,5,1)]),(2,[(0,4,3)]),(3,[(0,2,1),(1,1,1),(2,2,2)]),(4,[(0,0,4)]),
           (5,[(0,4,1),(1,5,1),(2,7,2)]),(6,[(0,6,1),(1,5,1),(2,4,2)]),(7,[(0,5,1),(1,4,1),(2,2,2)]),(8,[(0,4,3)])]),
 dict(id="toudai", title="白い灯台", bpm=100, key="D", minor=False, seed=8, bars=12, prog=["Dmaj7","Bm7","Gmaj9","A6"],
      layers=[[0,2,["pluck","pad"]],[2,6,["pluck","pad","kick","bass"]],[6,12,["pluck","pad","kick","rim","bass"]]],
      mix={"pluck":0.42,"pad":0.36,"kick":0.3,"rim":0.2,"bass":0.28,"lead":0.3}, bright=0.55, reverb=0.32,
      mel=[(2,[(0,2,1),(1,4,1),(2,5,2)]),(3,[(0,4,2),(2,2,2)]),(4,[(0,1,1),(1,2,1),(2,4,2)]),(5,[(0,2,4)]),
           (6,[(0,4,1),(1,5,1),(2,7,2)]),(7,[(0,8,2),(2,7,2)]),(8,[(0,5,1),(1,4,1),(2,5,2)]),(9,[(0,4,4)]),
           (10,[(0,2,1),(1,4,1),(2,5,1),(3,4,1)]),(11,[(0,7,4)])]),
 dict(id="enrai", title="遠雷", bpm=84, key="A", minor=True, seed=44, bars=10, prog=["Am9","Fmaj7","Cmaj7","G6"],
      layers=[[0,2,["pad","rim"]],[2,6,["pad","rim","sub","pluck"]],[6,10,["pad","kick","rim","sub","pluck"]]],
      mix={"pad":0.42,"rim":0.22,"sub":0.18,"pluck":0.3,"kick":0.45,"lead":0.28}, bright=0.4, reverb=0.5,
      mel=[(2,[(0,4,2),(2,3,1),(3,2,1)]),(3,[(0,0,4)]),(4,[(0,2,1),(1,3,1),(2,4,2)]),(5,[(0,6,2),(2,4,2)]),
           (6,[(0,7,2),(2,6,1),(3,4,1)]),(7,[(0,4,4)]),(8,[(0,3,1),(1,4,1),(2,6,2)]),(9,[(0,7,4)])]),
]
def finish(base):
    """配信する m4a そのもので -14±0.3 LUFS・TP -1.5 dBTP 以下になるまで、天井 -4.5 dBFS のリミッターで詰め直す（AAC で TP が上がるため）"""
    sys.path.insert(0, str(H.parent.parent / "tools")); import bgm_pack as P, soundfile as sf
    x, sr = sf.read(str(base) + ".wav"); m4a = str(base) + ".m4a"
    for _ in range(10):
        sf.write(str(base) + ".wav", x, sr, subtype="PCM_24")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(base) + ".wav", "-c:a", "aac", "-b:a", "192k", m4a], check=True)
        I, tp = P.measure(m4a)
        if abs(I + 14) <= .3 and tp <= -1.5: break
        x = P.limit(x * 10 ** ((-14 - I) / 20), ceil_db=-4.5)
    rep = Path(str(base).rsplit("_", 1)[0] + ".report.json"); r = json.loads(rep.read_text())
    r["m4a"] = {"lufs": I, "tp": tp, "note": "配信する m4a を ebur128 で測った値"}; rep.write_text(json.dumps(r, ensure_ascii=False, indent=1))
    print(base.name, "m4a", I, tp)


for s in SONGS:
    beat = 60/s["bpm"]; length = round(s["bars"]*4*beat + 1.5, 2)
    pack = {"id": f"S05-02-{s['id']}", "title": s["title"], "genre": "Singer-songwriter (instrumental)",
      "base": {"bpm": s["bpm"], "key": s["key"], "seed": s["seed"], "brightness": s["bright"], "reverb": s["reverb"],
               "drive": 0.05, "sidechain": 0.0, "progression": s["prog"], "mix": s["mix"],
               "end_chord": s["prog"][0], "pre_end_chord": s["prog"][-1]},
      "versions": {"preview": {"length": length, "bars": s["bars"], "tail_sec": 1.5,
          "sections": [{"from": a, "to": b, "layers": L} for a, b, L in s["layers"]],
          "melody": melody(s["key"], s["minor"], s["mel"])}},
      "spec_version": "preview", "max_low_mid_db": 4.0}
    p = H / "audio" / f"{s['id']}.json"; p.write_text(json.dumps(pack, ensure_ascii=False, indent=1))
    subprocess.run([sys.executable, str(H.parent.parent / "tools/bgm_pack.py"), str(p), str(H / "audio" / "out")], check=True)
    finish(H / "audio" / "out" / f"S05-02-{s['id']}_preview")
