# 🎬 天狼祭2026 出演団体 情報解禁ティザー

「天狼祭2026 出演団体 8月10日情報解禁」告知動画のジェネレーター一式。
BGM（和太鼓トラック）のオンセット解析結果にテキスト演出を同期させた、
コードベースのシネマチック・モーショングラフィックス。

## 📼 完成映像

- `tenrosai2026_teaser_810.mp4` — 1920×1080 / 30fps / 約19.5秒

## 🎞 演出構成（BGM同期タイムライン）

| 時間 | 演出 | 音 |
|------|------|-----|
| 0.63 / 0.84 / 1.14s | 「天」「狼」「祭」を太鼓3連打に合わせ1文字ずつスタンプ | 打撃音＋墨飛沫 |
| 1.49s | 「二〇二六」（朱） | 打撃音 |
| 4.2s | 「その舞台に立つのは――」 | — |
| 7.71s | 「出演団体」スタンプ＋朱の筆線 | ウーシュ＋打撃音 |
| 9.50s | 「まもなく、明かされる。」 | 小打撃音 |
| 12.4s | 静寂パート「来たる――」（明滅） | ライザー（期待値の煽り） |
| 13.70s | **「8月10日」** 最大のドンに合わせ日の丸グローと共に解禁 | 大インパクト＋ブラーム |
| 14.21s | 「情報解禁」（朱）スタンプ | 打撃音 |
| 16.6s | 「続報を待て。／天狼祭 二〇二六」エンドカード | 低音ブーム |

## 🛠 仕組み

- `anim.html` — Canvas 2Dによるフレーム決定論的レンダラー（`seekTo(t)` で任意時刻を描画）
  - 筆文字フォント **Yuji Syuku**（書家・大橋祐二による楷書毛筆体 / OFLライセンス）
  - 金の火の粉パーティクル・煙・日の丸グロー・墨飛沫・衝撃波・カメラシェイク・フィルムグレイン・シネスコ黒帯
- `render.js` — Playwright（Chromium）で1920×1080・30fpsの全フレームをJPEG書き出し
- `sfx.py` — numpyでシネマチックSFX（太鼓風ブーム／ブラーム／ライザー／ウーシュ）を合成
- ffmpegでフレーム＋BGM＋SFXをミックスしてMP4に書き出し

## 🚀 再生成手順

```bash
npm install ffmpeg-static playwright-core
pip install numpy

node render.js all      # frames/ に585フレーム書き出し
python3 sfx.py          # sfx.wav 生成
ffmpeg -framerate 30 -i frames/f%04d.jpg -i bgm.mp3 -i sfx.wav \
  -filter_complex "[1:a]apad[a1];[2:a]anull[a2];[a1][a2]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,afade=t=out:st=18.4:d=1.0[aout]" \
  -map 0:v -map "[aout]" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
  -t 19.5 -c:a aac -b:a 256k -movflags +faststart tenrosai2026_teaser_810.mp4
```

※ BGM音源（`bgm.mp3`）は権利の関係でリポジトリには含めていません。
