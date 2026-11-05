# yorozuya-tenro-apps

**ユーザーへの返信・説明は常に日本語で書くこと。**

合同会社萬屋天狼のアプリ集（chain-fx-simulator / particle-mist-simulator / stage-booking-pos-manager / stage-cut）と、freee会計アシスタントの資料を含むリポジトリ。

## freee会計アシスタント

このリポジトリには、freee会計を「専属税理士」として運用するためのSkillと資料が入っている。freee・経理・請求書・領収書・経費の話題が出たら、以下に従うこと。

- 事業所: 合同会社萬屋天狼（company_id: **10939384**、決算期 11/1〜10/31）
- マスタデータ（勘定科目ID・税区分・口座ID・取引先ID）: `freee-accounting/references/company-master.md` — **APIで探索する前に必ずここを見る**
- 運用ガイドと入力フォーム: `freee-accounting/README.md`

### Skill の使い分け

| 状況 | Skill |
|---|---|
| 健康診断・状態チェック・売上/経費/役員借入金/役員貸付金の確認 | `freee-checkup` |
| 経費の登録・未処理明細の経費化 | `freee-expense` |
| 領収書やレシートの写真・画像・PDFが送られてきた | `freee-receipt` |
| 請求書・領収書（帳票）・見積書の作成 | `freee-billing` |

### 共通ルール

- 作成する取引・帳票の明細行には必ずメモタグ `freee-mcp`（tag_ids: [35402337]）を付ける
- freeeの認証「期限切れ」表示は無視してよい（API呼び出し時に自動更新される）
- 書き込み系（POST/PUT/DELETE）は実行前に内容を1度提示して確認する。ただしユーザーが明示的に依頼した経費登録は即実行してよい
- 金額・残高は必ずAPIの実数値を使い、推測しない

## 天狼スタジオ（自動制作）

映像制作・HP制作・広告動画・SNS運用・BGM制作を Claude が自動で回す仕組み。詳細は `studio/README.md`。

- 管理アプリ（制作進行表）: https://claude.ai/artifact/X6eebhYWCKkLx5FSpQ3Ubh
- 手順は Skill `studio-autopilot`、知見は `studio/knowledge/playbook.md`（制作前に必ず読む）
- 作業ブランチは `studio-autopilot`。知見と完成品はここに積み上げる
- **権限**: ユーザーは制作・公開・SNS投稿の判断を Claude に一任している（2026-11-05）。許可待ちをせずに進めてよい。ただし Skill 内の「ガードレール」（なりすまし禁止、実在クライアント素材の公開は許可制、有料操作はしない、秘密情報を書かない、X投稿は1日3件まで）は必ず守る
