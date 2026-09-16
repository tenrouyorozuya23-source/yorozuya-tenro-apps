# kagebi-mv — 「影火 (Kagebi)」リリックMV 制作パイプライン

楽曲「Kagebi — Electronic Band Mix」（Suno製）の音源から、音に反応するリリックMV（1920x1080 / 24fps / H.264）を自動生成するパイプライン。

## 構成

```
kagebi-mv/
├── audio/      元音源 (mp3) とカバーアート
├── data/       解析済みデータ（音響特徴・歌詞タイミング・文字起こし）
├── fonts/      しっぽり明朝 / 佑字 肅（Google Fonts, OFL）
├── pipeline/   解析・レンダリングスクリプト
├── renderer/   Canvas 2D の映像エンジン（render.html）
└── output/     生成物（mp4 は git 管理外）
```

## 使い方

```bash
# 1. 音響解析（features.json を再生成する場合のみ。要 numpy）
python3 pipeline/analyze.py

# 2. 歌詞タイミングの自動検出（再検出する場合のみ。要 faster-whisper）
python3 pipeline/transcribe.py
#    → data/transcript.json を参考に data/lyrics.json を手で調整する

# 3. プレビュー静止画（指定秒のPNGを output/preview/ に出力）
node pipeline/render.mjs --preview 8,42,90,145,200

# 4. 本番レンダリング → output/kagebi-mv.mp4
node pipeline/render.mjs
```

要件: ffmpeg（libx264入り）、Node 22 + Playwright（Chromium）、Python 3 + numpy。

## 映像の演出（ストーリーボード）

セクションごとの配色・演出は `renderer/render.html` の `SECTIONS` 配列で定義。
歌詞の内容に合わせた構成:

| 区間 | 演出 |
|---|---|
| イントロ | 藍色の常夜・霞・タイトルカード「影火」 |
| Aメロ | 冬の藍、月と霞、まばらな火の粉 |
| サビ | 暖色の灯、徒花の花びらが舞い散る |
| ブリッジ前半 | 「凍える夜」— 青白い冷たい火の粉 |
| ブリッジ後半 | 「血が通う」— 焔の色へ転じる |
| 間奏 | スペクトラムリング（音の焔）＋太刀風の光条 |
| ラスサビ | 花吹雪と光条の最大強度 |
| アウトロ | 提灯が現れ、「あなたがくれた名を提灯にして」 |

音への反応: 低域→灯の脈動、高域→星の瞬き、オンセット→火の粉の爆ぜ・太刀風。
背景には各章のテーマ漢字（宵・灯・祈・魂・焔・花）が薄く浮かぶ。

## 調整ポイント

- **歌詞のタイミング・表記・ルビ**: `data/lyrics.json`（`seg` の `r` がルビ）
- **タイトルの漢字表記**: `data/lyrics.json` の `titleKanji`（現状は「影火」と仮置き）
- **色・演出の強さ**: `renderer/render.html` の `SECTIONS`
- **画質・fps**: `pipeline/render.mjs` の ffmpeg 引数 / `analyze.py` の `FPS`（fps変更時は features.json 再生成が必要）

## 既知の注意点

- 211〜229秒付近に歌詞カードに無いボーカル（アウトロの追加行）があり、
  文字起こしの確度が低いため字幕を出していない。正しい歌詞が分かれば
  `lyrics.json` に行を追加するだけで表示される。
- 文字起こし（transcript.json）は Whisper small によるもので誤認識を含む。
  表示用の正式歌詞は lyrics.json 側で管理する。
