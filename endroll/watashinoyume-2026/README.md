# 「ワタシノユメ 2026」エンドロール（23日 マチネ／ソワレ）

黒地に白文字（明朝体・太字・中央揃え）のテキストが下から上へ流れるエンドロール動画を作る。
最後の【事務局】ブロックが BGM の最後の1音で画面中央にピタッと止まり、
文字と音を同時に2秒の指数フェードアウト（最後はゆっくり消える）で消して、黒画面のまま終わる。

| 公演 | テキスト | 停止（BGM最後の1音） | フェード | 終わり |
|---|---|---|---|---|
| 第3回目 11:00 マチネ | `credits_matinee.txt` | 2:19.40 | 2:26.0〜2:28.0 | 2:29.0 |
| 第4回目 15:00 ソワレ | `credits_soiree.txt` | 2:18.85 | 2:21.14〜2:23.14（音源の終わり） | 2:24.14 |

※ 2:20 すぎからの大きな音は拍手なので、止める位置にはしない。

| ファイル | 内容 |
|---|---|
| `credits_*.txt` | 表示テキスト。1行＝1行、空行＝1行分の余白 |
| `docx_to_credits.py` | DVD文字データ(.docx)からテキストを作る |
| `make_endroll.py` | テキストと音源から MP4（1920×1080 / 29.97fps / H.264 + AAC）を作る |

## 作り方

フォント: [Noto Serif JP](https://fonts.google.com/noto/specimen/Noto+Serif+JP) Bold（Google Fonts）

```sh
# マチネ（3回目）
python3 docx_to_credits.py 「ワタシノユメ2026」DVD文字データ_3回目公演.docx > credits_matinee.txt
python3 make_endroll.py --credits credits_matinee.txt --audio Akaikutsu_マチネ_エンドロール.wav \
  --font NotoSerifJP-Bold.ttf --out matinee.mp4

# ソワレ（4回目）
python3 docx_to_credits.py ソワレのDVD文字データ.docx > credits_soiree.txt
python3 make_endroll.py --credits credits_soiree.txt --audio ソワレ音源.wav \
  --font NotoSerifJP-Bold.ttf --fade-in 1 --stop-at 138.85 --fade-start 141.14 --end 144.14 --out soiree.mp4
```

文字の修正はテキストを直接編集して `make_endroll.py` を再実行すればよい。
文字サイズ・行間は `--font-size`（既定39px）・`--line-height`（既定62px）、
止める時刻・フェード・終わりは `--stop-at`（139.4）・`--fade-start`（146）・`--fade`（2）・`--fade-curve`（4）・`--end`（149）で変えられる。
