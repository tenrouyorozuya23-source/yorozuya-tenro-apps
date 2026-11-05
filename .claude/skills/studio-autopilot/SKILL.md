---
name: studio-autopilot
description: 天狼スタジオの自動制作サイクル（計画→テスト→制作→公開→報告→次の計画）を1回まわす。映像制作・HP制作・広告動画・SNS運用・BGM制作を、管理アプリ「天狼スタジオ 制作進行表」の計画キューから選んでプロ品質まで仕上げる。「スタジオを回して」「自動制作」「次の制作」「制作進行表」、または定期実行のプロンプトで呼ばれたら使う。
---

# 天狼スタジオ 自動制作サイクル

萬屋天狼の制作部門として、ユーザーの許可を待たずに制作を進める。
ユーザーは「基本的な権限は全てClaudeに一任」と明示している（2026-11-05）。
ただし下の「ガードレール」は必ず守る。

- 管理アプリ: https://claude.ai/artifact/X6eebhYWCKkLx5FSpQ3Ubh （`ArtifactData` で読み書き）
- 作業ブランチ: `studio-autopilot`（知見と完成品はここに積み上げる）
- 道具: `studio/tools/`（bgm.py / render.mjs / master.py）
- 知見: `studio/knowledge/playbook.md` ← **制作前に必ず読む**
- 設定: `studio/config.json`（Drive フォルダID、公開先など）

## 0. 準備（毎回）

```bash
cd /home/user/yorozuya-tenro-apps
git fetch origin studio-autopilot && git checkout -B studio-autopilot origin/studio-autopilot
pip install -q -r studio/tools/requirements.txt
```
1. `studio/knowledge/playbook.md` と `studio/config.json` を読む。
2. `Artifact` の `action: "read"` で管理アプリを1回読む（アセットのアップロードに必要）。
3. `ArtifactData` で `system/status`・`system/settings`・`plans` を読む。

## 1. ロックと計画選定

- `system/status.lockedUntil` が未来なら、別の回が稼働中。制作はせず、短い研究（後述 R&D）だけして終了。
- そうでなければ `system/status` を更新: `phase:"planning"`, `cycle:+1`, `lastRunAt`, `lockedUntil: 今+100分`, `currentPlanId`。
- 着手する計画の選び方（上から順）:
  1. 制作途中（`testing`/`producing`/`publishing`/`reporting`）の計画 → 続きから再開
  2. `queued`（ユーザーがチェックした計画）→ `priority` 小さい順、同じなら `queuedAt` が古い順
  3. `settings.autoStart` が true なら、`backlog` のうち `blockedBy` が解消済みで `priority` が最小のもの
  4. 何もなければ R&D（道具・音色・テンプレートの改良）をして報告書を書く
- 計画の `notes`（ユーザーの指示・フィードバック）は**最優先の仕様**として扱う。完成済み作品へのフィードバックは改訂版の新計画（`P0xx-v2`）を作って `queued` にする。

## 2. テスト（phase: testing）

`plans/<id>` を `status:"testing"` にし、ログを追記する（ログは毎フェーズ必ず書く）。
- `studio/projects/<id>-<slug>/brief.md` に企画書を書く: 目的・視聴者・使用場所・尺/解像度・構成表（秒単位）・BGM設計（BPM/キー/構成）・合格ライン。
- 小さく試す: 動画なら要所の静止画（`render.mjs --still`）と BGM 単体、HP なら1セクション、を作り、合格ラインと playbook のチェックリストで自己評価する。
- 問題が出たら直してからでないと制作に進まない。

## 3. 制作（phase: producing）— プロ品質まで繰り返す

1テイク = 制作 → QC → 自己レビュー → 修正。`iterations` を増やしてログに「何を見て、何を直したか」を残す。
- 動画: `render.mjs` で全編 → `master.py` で音と合体・-14 LUFS・QC → `*.sheet.jpg` と要所の静止画を **Read で目視**。
- BGM: `bgm.py` → 帯域バランス（低域-中域差 ≤ +6dB）、スペクトログラム目視、ラウドネス。
- HP: Playwright でスマホ(390px)/PC(1440px) のスクショを目視、Lighthouse 相当の確認（画像サイズ、alt、見出し構造、meta/OGP）。
- 合格ラインをすべて満たすまで繰り返す（最大5テイク）。満たせない項目は報告書に正直に書く。
- 1回のセッションで終わらない大型案件は、途中成果をコミットして `status` を維持したまま終了してよい（次の回が再開する）。

## 4. 公開（phase: publishing）

使える公開先にすべて出す。使えないもの（未連携）は飛ばしてログに書く。
1. 管理アプリ: `Artifact` の `asset: true` で mp4/jpg/png をアップロード（各 20MB 以下。音声は AAC の .mp4 にする）→ `works/<Wxxx>` を作成（`videoAsset`/`posterAsset`/`audioAsset`/`specs`/`music`/`links`）。
2. GitHub: `studio/works/<id>/` に完成品を置いてコミット・push（`studio-autopilot` ブランチ）。
3. Google Drive: `config.json` の `drive_folder_id` があれば、`mcp__Google_Drive__create_file` で完成品とレポートを保存。
4. Cloudflare Pages: 環境変数 `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` があれば `npx wrangler pages deploy`（HP サンプル・ポートフォリオ）。
5. X: `X_API_KEY` ほか4つの環境変数と `settings.xPosting !== false` のときだけ投稿（下のガードレール参照）。

## 5. 報告（phase: reporting）

- `reports/<Rxxx>` を作成: `summary`・`good`・`learnings`・`next`。事実と数値（尺、LUFS、所要時間、テイク数）で書く。
- **学びをスキルに還元**: 再利用できる知見は `studio/knowledge/playbook.md` の該当節に追記（重複は統合）。手順そのものが変わるならこの SKILL.md を直す。道具の改良は `studio/tools/` に入れる。
- 計画を `status:"done"`, `workId`, `reportId` に更新。
- コミットして `git push -u origin studio-autopilot`。

## 6. 次の計画

- `backlog` が8件未満なら、ユーザーの目標（下記）に照らして足りない領域から1〜2件の計画を追加（`requestedBy:"claude"`）。
- `system/status` を `phase:"idle"`, `lockedUntil:null`, `nextRunAt`, `message`（1行で今回の成果）に更新。

## ユーザーの目標（完成品の要件）

1. 動画編集の実用スキルを証明できる作品
2. HP制作の用途別サンプルページ
3. SNS・店頭向けの短く分かりやすく好印象な広告動画
4. SNS自動投稿で、記事の内容に合った動画
5. BGM・音源を自作し、映像と高い品質で合っていること

## ガードレール（権限一任でも守る）

- 実在の人物・団体・他社ブランドを名乗る/なりすます表現、他社ロゴ・既存楽曲・既存作品の模倣はしない。素材は自作か、ユーザーの Drive 素材のみ。
- 実在のクライアント案件（例: 舞台公演）の素材を一般公開するときは、ユーザーの `notes` で公開許可がある場合に限る。
- X 投稿: 1日3件まで。政治・宗教・医療・誇大表現・他者批判はしない。投稿内容とURLは必ず `plans` のログと `works.links` に残す。`settings.xPosting === false` なら投稿しない。
- 秘密情報（APIキー等）をリポジトリ・管理アプリ・ログに書かない。
- 料金が発生する操作（有料API、広告出稿、ドメイン購入）はしない。必要なら計画の `blockedBy` に書いてユーザーに委ねる。
- 金額・数値は実測値のみ。できなかったことは「できなかった」と報告する。

## R&D（キューが空のとき）

`playbook.md` の「次に改善すること」から1つ選び、道具・音色・テンプレートを改良して小さな検証物を作り、報告書（`planId:"R&D"`）にまとめる。
