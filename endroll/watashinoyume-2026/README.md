# 「ワタシノユメ 2026」エンドロール（23日 マチネ／ソワレ）

黒地に白文字（丸ゴシック・太字・中央揃え）のテキストが下から上へ流れるエンドロール動画を作る。

- BGM 冒頭の「テー（レッテレッテーレレレ…）」で最初の行が画面下から見え始める
- 最後の【事務局】ブロックが BGM 最後の「デーデーデー**デン！**」で画面中央にピタッと止まる
- 文字と音を同時に2秒の指数フェードアウト（最後はゆっくり消える）
- 0.5秒あけて「ありがとう！松永　春さん」を FI 0.5秒 → キープ 5秒 → FO 1.0秒、黒画面1秒で終わり

| 公演 | テキスト | 見え始め（テー） | 停止（デン！） | フェードアウト | 一文 | 終わり |
|---|---|---|---|---|---|---|
| 第3回目 11:00 マチネ | `credits_matinee.txt` | 0:02.80 | 2:19.40 | 2:26.0〜2:28.0 | 2:28.5〜2:35.0 | 2:36.0 |
| 第4回目 15:00 ソワレ | `credits_soiree.txt` | 0:02.38 | 2:19.00 | 2:23.09〜2:25.09（音源の終わり） | 2:25.59〜2:32.09 | 2:33.09 |

ソワレは始まりに1秒のフェードイン（文字と音）を付ける。
※ 2:20 すぎからの大きな音は拍手なので、止める位置にはしない。

文字は 34px、文字のある行は 48px、空行（余白）は 32px。スクロールは毎秒約130px。
Cast は「氏名」「役名」の2行で表示する。

| ファイル | 内容 |
|---|---|
| `credits_*.txt` | 表示テキスト。1行＝1行、空行＝余白 |
| `docx_to_credits.py` | DVD文字データ(.docx)からテキストを作る |
| `make_endroll.py` | テキストと音源から MP4（1920×1080 / 29.97fps / H.264 + AAC）を作る |

## 作り方

フォント: [Zen Maru Gothic](https://fonts.google.com/specimen/Zen+Maru+Gothic) Bold（Google Fonts）。
HG丸ゴシックM-PRO は Windows 付属で配布できないため、見た目の近い無料の丸ゴシックを使う。
手元の .ttf/.ttc を `--font` に渡せばそのフォントで作れる。

```sh
# マチネ（3回目）
python3 docx_to_credits.py 「ワタシノユメ2026」DVD文字データ_3回目公演.docx > credits_matinee.txt
python3 make_endroll.py --credits credits_matinee.txt --audio Akaikutsu_マチネ_エンドロール.wav \
  --font ZenMaruGothic-Bold.ttf --out matinee.mp4

# ソワレ（4回目）
python3 docx_to_credits.py 「ワタシノユメ2026」DVD文字データ_4回目公演.docx > credits_soiree.txt
python3 make_endroll.py --credits credits_soiree.txt --audio Akaikutsu_ソワレ_エンドロール.wav \
  --font ZenMaruGothic-Bold.ttf --fade-in 1 --lead 2.38 --stop-at 139.0 --fade-start 143.09 --out soiree.mp4
```

文字の修正はテキストを直接編集して `make_endroll.py` を再実行すればよい。
主な調整項目: `--font-size` `--line-height` `--blank-height` `--lead` `--stop-at` `--fade-start` `--fade`
`--fade-curve` `--thanks` `--thanks-in` `--thanks-hold` `--thanks-out`（`python3 make_endroll.py -h` で一覧）。
