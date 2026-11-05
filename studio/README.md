# 天狼スタジオ（自動制作）

Claude が 計画 → テスト → 制作 → 公開 → 報告 → 次の計画 を自動でまわし、
映像・HP・広告動画・SNS運用・BGM を作り続けるための仕組み。

- **管理アプリ（制作進行表）**: https://claude.ai/artifact/X6eebhYWCKkLx5FSpQ3Ubh
  - 計画にチェック → 次のサイクルでテストから着手 → 完成すると「完成品」に並ぶ
  - 行をクリックすると詳細（内容・成果物・合格ライン・進行ログ）が開く
  - 詳細欄から指示・フィードバックを送れる（次のサイクルで反映）
  - 「チェックが無いときは優先度順に自動着手する」をオフにすると、チェックした計画だけ作る
- **手順（Skill）**: `.claude/skills/studio-autopilot/SKILL.md`
- **知見**: `knowledge/playbook.md`（制作のたびに追記）
- **完成品**: `works/<計画ID>/`
- **制作途中のプロジェクト**: `projects/<計画ID>-<slug>/`

## 道具

| ファイル | 役割 |
|---|---|
| `tools/bgm.py` | オリジナルBGMを数値合成で作る（拍・キュー情報を JSON で出力） |
| `tools/analyze_audio.py` | 既存の楽曲（SUNO 等）から BPM・拍・小節頭・キー・セクション・推奨カットを抽出 |
| `tools/motion.js` | ページで使う決定論モーション部品（イージング、閉形式ばね、拍同期 `M.hit/M.land/M.snapToBeat`、文字送り、カウントアップ、固定幅数字） |
| `tools/render.mjs` | HTML/Canvas アニメをフレーム単位で書き出して H.264（BT.709 タグ付き）にする。`--workers` で並列、`--blur N` でモーションブラー、`--still` で静止画 |
| `tools/master.py` | 映像と音を合体、-14 LUFS に整え、QC（黒味・無音・ラウドネス）とコンタクトシートを出す |
| `tools/review.py` | 完成品のレビューシート（拍ごとのシート、カット前後 ±3f のストリップ、文字クロップ）と、黒味・静止・ラウドネス・音と絵の拍ずれ（ms / フレーム）の数値レポート |

```bash
python3 tools/bgm.py projects/P001-brand-ad-15s/song.json /tmp/bgm.wav
node tools/render.mjs projects/P001-brand-ad-15s/scene.html /tmp/video.mp4 --data /tmp/bgm.beats.json --dur 15 --workers 4
python3 tools/master.py /tmp/video.mp4 /tmp/bgm.wav /tmp/final.mp4 --dur 15
python3 tools/review.py /tmp/final.mp4 --beats /tmp/bgm.beats.json --crops "6.6:80,960,920,440"
# 速い動きの区間だけモーションブラー（描画コストは N 倍）
node tools/render.mjs scene.html /tmp/part.mp4 --data /tmp/bgm.beats.json --from 3 --dur 3 --blur 4
```

ページでは `<script src="../../tools/motion.js"></script>` を読み込むと `window.M` が使える（API はファイル冒頭に日本語で記載）。

## 連携の設定（ユーザー側の作業）

APIキーは**チャットに貼らず**、Claude Code の環境設定（セッション上部の環境メニュー → 編集）に
環境変数として登録する。新しいセッションから使える。

| 連携 | 環境変数 / 設定 | 必要な権限 |
|---|---|---|
| Google Drive | 作業フォルダのURLをチャットで共有 → `config.json` の `drive_folder_id` に記録 | コネクタ（接続済み） |
| Cloudflare Pages | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | API トークン: Account › Cloudflare Pages › Edit |
| X | `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` | User authentication settings で Read and Write を有効化してから Access Token を発行 |

## 自動稼働

定期実行（スケジュールタスク）が 2 時間ごとに新しいセッションを起動し、
`studio-autopilot` スキルを 1 サイクル実行する。止めたいときは Claude に
「スタジオの自動稼働を止めて」と言えばよい。
