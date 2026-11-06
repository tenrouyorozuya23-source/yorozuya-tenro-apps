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
- **方向性: `studio/knowledge/direction.md` ← 最優先。顧客（舞台・音楽 → 映像美を求める企業）と見た目（Apple の製品LPのように洗練・簡潔・三次元的、イラスト調にしない）**
- バーチャルプロダクション（グリーンバック撮影・合成・カメラ連動・モーキャプ）: `studio/knowledge/virtual-production-pipeline.md`（監督＝ユーザー、エンジニアリング＝Claude の分担）
- リサーチ（制作前に該当するものを読む）: `studio/knowledge/research/apple-style-craft.md`（Apple 風 LP・製品映像の数値と型）、`research/stage-lighting-and-vp.md`（舞台照明の CG 再現・グリーンバック）、`research/market-performers.md`（顧客市場・価格帯・SNS の型）
- **完成品100件カタログ**: `studio/knowledge/research/catalog-100.md`（10シリーズ×10本。管理アプリの計画 S01-01〜S10-10 に登録済み。シリーズ内はテンプレートを共通化して量産する）
- 知見: `studio/knowledge/playbook.md` ← **制作前に必ず読む**（v2：8つの先行リポジトリの研究を反映済み）
- 審査基準: `studio/knowledge/rubric.md`／ブリーフ雛形: `studio/knowledge/brief-template.md`／スタイル: `studio/knowledge/styles.md`
- 音源ライブラリ: `studio/music-library/catalog.json`（ユーザー制作の SUNO 曲。解析済みの拍・推奨カット付き）
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

## 1.5 学習（毎回・最初に）

- Drive「05_学習資料」（`config.json` の `drive_folders.learning`）と「自作音源」フォルダ（`drive_folders.music`）に新しいファイルがあれば、制作より先に吸収する。
  - 資料: 読んで要点を `playbook.md` に反映し、報告書（`planId:"R&D"`）に残す。リポジトリURLなら clone して読む（実行はしない）。
  - 音源: 10MB 以下は Drive コネクタ、超えるものは `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t` で取得 → `tools/analyze_audio.py` → `music-library/catalog.json` に追記。

## 2. テスト（phase: testing）

`plans/<id>` を `status:"testing"` にし、ログを追記する（ログは毎フェーズ必ず書く）。
- `studio/projects/<id>-<slug>/brief.md` を `knowledge/brief-template.md` に沿って書く。**トリートメントを3案書いて1つ選ぶ**。スタイルは既定で「天狼シネマ」（`styles.md` の 0'、three.js の 3D・照明で見せる）。フラット・線画・イラスト系はユーザーが明示したときだけ。前作の焼き直しは禁止（構成・冒頭・看板ショット・カメラ経路・音楽の形・結末のうち4つ以上を変える）。
- 音を決める: ライブラリ曲（`catalog.json` の用途・タグで選び、小節頭で切り出す）か合成 BGM（尺ちょうどが必要なとき）。**拍は表示 BPM で計算せず `beats`/`downbeats` の実測時刻を使う**。
- `timeline.json`（拍・小節・キュー・テロップ）を最上流に置き、絵・音・SE・テロップが同じ値を読む。カット時刻はフレームに丸め、入りの動きは1フレーム早く始める。
- 拍グリッド上の**リード表**（観客が理解すべきことを1ショット2〜3個まで）を作る。テロップ表示は max(1.8秒, 字数÷8秒＋0.6秒) 以上。
- **キーフレーム静止画6〜10枚** → **一番難しい2〜4秒だけ動画化**して確認。問題が出たら直してからでないと全尺に進まない。
- **キーフレームの事前審査**: 全尺レンダーの前に、キーフレームのスチルを別エージェントに見せ、主役の大きさ（ヒーローで画面の1/3以上）・主役の同一性・黒地と色数・文字の字面の高さ（64px以上＝font-size 84px以上）・エンドのホールドだけを判定させる。ここで落ちたら全尺に進まない（P017 は細部の修正を5テイク重ねても 5.7 点で頭打ちになった）。

## 3. 制作（phase: producing）— プロ品質まで繰り返す

1テイク = 制作 → QC → 審査 → 1ラウンドにまとめて修正。`iterations` を増やしてログに「何を見て、何を直したか」を残す。
- 動画: `render.mjs --workers 3`（速い区間は `--blur 4`）で全編 → `master.py` で音と合体・-14 LUFS・QC → `review.py` で拍ごとのシート・カット前後のストリップ・音と絵のずれ(ms)を出し、**Read で目視**。
- **審査は別エージェント**（Agent ツール）に任せる: 渡すのは mp4 のレビューシート画像・report.json・brief の抜粋・`rubric.md` だけ（作り手の説明は渡さない）。JSON で7軸スコアと時刻付きの修正5〜10件を返させる。**等級は rubric.md §4.2（ユーザー決定 2026-11-06）：一級＝全軸7以上・平均7.5以上・ゲート全部 yes／完成品＝平均5.0以上・critical なし・数値ゲート合格（100件に数える）／それ以外は合格未満**。初回審査の指摘を1ラウンドにまとめて直し、再審査（最大2ラウンド）。
- 演出の必須: 0.5秒以内のフック（フレーム0で絵が成立）、尺の60〜75%にヒーローモーメント、エンド画0.8〜1.2秒ホールド、一度に1つだけ見せる、転換は画面内の要素に運ばせる（既定のクロスフェード禁止）、禁止表現（汎用パーティクル爆発・汎用グロー・レンズフレア・偽の数値）を使わない。
- モーション: `tools/motion.js` を使う（閉形式ばね・拍の0.05秒前に動き出して拍で着地・2〜4フレームのずらし）。`renderAt(t)` は t の純関数（Math.random・Date.now 禁止）。
- BGM: `bgm.py` → 帯域バランス（低域-中域差 ≤ +6dB）、スペクトログラム目視、ラウドネス。
- HP: Playwright でスマホ(390px)/PC(1440px) のスクショを目視、Lighthouse 相当の確認（画像サイズ、alt、見出し構造、meta/OGP）。
- **中止しない**。2回目の審査の点で等級を決め、合格・合格未満のどちらでも完成品として保存する（`studio/works/pass/<ID>/` か `studio/works/below/<ID>/`、管理アプリ works に grade と score）。満たせない項目は報告書に正直に書く。データを貯めることが目的（2026-11-06 ユーザー指示）。
- 1回のセッションで終わらない大型案件は、途中成果をコミットして `status` を維持したまま終了してよい（次の回が再開する）。

## 4. 公開（phase: publishing）

使える公開先にすべて出す。使えないもの（未連携）は飛ばしてログに書く。
0. 書き出しは BT.709 タグ付き・-14 LUFS/TP -1.2（`render.mjs`・`master.py` の既定）。
1. 管理アプリ: `Artifact` の `asset: true` で mp4/jpg/png をアップロード（各 20MB 以下。音声は AAC の .mp4 にする）→ `works/<Wxxx>` を作成（`videoAsset`/`posterAsset`/`audioAsset`/`specs`/`music`/`links`）。
   - **プレビュー必須（ユーザー指示 2026-11-06）**: 完成品・合格未満を問わず、管理アプリの works には必ずその場で見られるプレビューを付ける。GitHub のフォルダへのリンクだけで終わらせない。
     - 動画: `videoAsset`（本編 mp4）と `posterAsset`（中盤のフレームの jpg）。複数本は `extraVideos`（asset id の配列、2本目以降）。
     - 静止画: `posterAsset`、追加の画像は `extraImages`（`[{id, label}]`）。
     - Web サイト: スマホ画面のスクリーンショットを `posterAsset`、PC 画面を `extraImages`、そして `previewUrl` に `https://raw.githack.com/tenrouyorozuya23-source/yorozuya-tenro-apps/studio-autopilot/<サイトの index.html までのパス>`（push 後に 200 が返ることを curl で確認）、`previewLabel: "サイトを開く"`。
     - 音楽: `audioAsset`（AAC の .mp4）か、試聴ページの URL を `previewUrl`。
     - `aspect` に縦横比（例 "9/16"、"16/9"）を入れる。
2. GitHub: `studio/works/<id>/` に完成品を置いてコミット・push（`studio-autopilot` ブランチ）。
3. Google Drive（「Claude専用 開発部」、ID は `config.json` の `drive_folders`）: 報告書は `01_計画と報告書`、ナレッジ更新は `02_ナレッジ・スキル` に Google ドキュメント（`contentMimeType: text/markdown`）で保存。完成品は `03_完成品` に作品ページ（概要・仕様・管理アプリ/GitHub のリンク）を置く。コネクタのアップロードは本文を会話に通すため、大きな動画ファイルは載せない（リンクで代える）。定期実行のセッションに Drive コネクタが無いときは飛ばしてログに書く。
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
