# S03-10 キャストカード一括書き出し（社内の道具）— 審査対象外・動作確認済み

- 道具: `studio/tools/cards_batch.py`。CSV（name・role・troupe・note）を渡すと、1人1本のカード動画（音付き）と静止画、一覧 index.csv を書き出す
- 型は S03-01 の `card.html`（ほかの型も `--template` で渡せる）。1本約5分（クラウドの CPU）
- 試験: `studio/projects/S03-10-cards-batch/sample.csv`（架空のバンド「残響室」2人）→ このフォルダの2本
- 1:1（1080×1080）は型の文字の配置が縦長向けのため未対応（次の改善）
