# 「ワタシノユメ 2026」第3回目公演 エンドロール

黒地に白文字（明朝体・太字・中央揃え）のテキストが下から上へ流れるエンドロール動画を作る。
- 最後の【事務局】ブロックが、音源 **2:19.4 のインパクト**で画面中央にピタッと止まる
- 2:26〜2:28 の2秒で文字と音を同時にフェードアウトし、黒画面・無音のまま 2:29 で終わる

| ファイル | 内容 |
|---|---|
| `credits.txt` | 表示テキスト。1行＝1行、空行＝1行分の余白 |
| `docx_to_credits.py` | DVD文字データ(.docx)から `credits.txt` を作る |
| `make_endroll.py` | `credits.txt` と音源から MP4（1920×1080 / 29.97fps / H.264 + AAC）を作る |

## 作り方

フォント: [Noto Serif JP](https://fonts.google.com/noto/specimen/Noto+Serif+JP) Bold（Google Fonts）

```sh
python3 docx_to_credits.py 「ワタシノユメ2026」DVD文字データ_3回目公演.docx > credits.txt
python3 make_endroll.py --audio Akaikutsu_マチネ_エンドロール.wav --font NotoSerifJP-Bold.ttf --out endroll.mp4
```

文字の修正は `credits.txt` を直接編集して `make_endroll.py` を再実行すればよい。
文字サイズ・行間は `--font-size`（既定39px）・`--line-height`（既定62px）、
止める時刻・フェード・終わりは `--stop-at`（139.4）・`--fade-start`（146）・`--fade`（2）・`--end`（149）で変えられる。
