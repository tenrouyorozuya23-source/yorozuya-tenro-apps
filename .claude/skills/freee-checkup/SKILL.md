---
name: freee-checkup
description: freee会計の健康診断と財務サマリー。定期チェック、状態確認、売上・経費の合計、役員借入金・役員貸付金の残高確認、未処理明細の確認を頼まれたら使う。「健康診断」「チェックして」「今の売上は」「経費の合計」「役員借入金」などが合図。
---

# freee 健康診断 & 財務サマリー

事業所: 合同会社萬屋天狼（company_id: **10939384**、決算期 11/1〜10/31）。
不明なIDが出てきたら `freee-accounting/references/company-master.md` を参照。

読み取り専用の診断であり、このSkillではデータを作成・変更しない（修正が必要なものは報告し、ユーザーの指示を待つ）。

## 手順

以下を順に実行する。エラーが出たAPIはスキップして報告に「取得失敗」と書く（全体を止めない）。

### 1. ログイン・接続チェック

`mcp__freee__freee_get_current_company` を呼ぶ。
- 「合同会社萬屋天狼 (ID: 10939384)」が返れば接続OK（認証は自動更新されるので「期限切れ」表示は問題ない）。
- エラーの場合は診断を中断し、freee Web（https://secure.freee.co.jp）での再認証を案内する。

### 2. 損益（当期累計）

```
freee_api_get { "service": "accounting", "path": "/api/1/reports/trial_pl",
  "query": { "company_id": 10939384 } }
```
（fiscal_year省略=当期。レスポンス `trial_pl.balances[]` から読む）
- **売上高合計**: account_category_name が「売上高」の合計行（total_line）の closing_balance
- **販売管理費合計**（経費合計）: 「販売管理費」の合計行の closing_balance
- **営業外損益・当期純損益**: 末尾の集計行
- 金額の大きい経費科目 上位5つも控える

### 3. 貸借（残高）

```
freee_api_get { "service": "accounting", "path": "/api/1/reports/trial_bs",
  "query": { "company_id": 10939384 } }
```
- **役員借入金**（account_item_id 763260803）の closing_balance → 会社が役員から借りている額
- **役員貸付金**（account_item_id 763260802）の closing_balance → **残高があれば要注意**（役員への貸付は認定利息・税務リスクの論点。0でなければ必ず警告する）
- 現金・預金合計
- **役員借入金が0でなく、かつ役員貸付金も残高がある場合**: company-master.md の「役員借入金との定期相殺」運用に従い、役員借入金の全額を役員貸付金と相殺する仕訳（manual_journals、借方763260803／貸方763260802、tax_code 2、金額は役員借入金の残高）を「要対応」に提案する（自動実行はせず、ユーザー承認後に登録）

### 4. 口座残高と同期状態

```
freee_api_get { "service": "accounting", "path": "/api/1/walletables",
  "query": { "company_id": 10939384, "with_balance": true } }
```
- 各口座の walletable_balance（登録残高）と last_balance（同期残高）を比較し、差がある口座は「同期ズレあり」として報告する。

### 5. 未処理の入出金明細（自動で経理の滞留）

```
freee_api_get { "service": "accounting", "path": "/api/1/wallet_txns",
  "query": { "company_id": 10939384, "limit": 100 } }
```
- status = 1（消込待ち）の件数と合計金額を数える。あれば「未処理明細あり → /freee-expense で経費化推奨」と報告。

### 6. 未決済の取引（売掛・買掛の滞留）

```
freee_api_get { "service": "accounting", "path": "/api/1/deals",
  "query": { "company_id": 10939384, "status": "unsettled", "limit": 100 } }
```
- type=income（未回収の売上）と type=expense（未払いの経費）に分け、件数・合計・支払期日超過のものを報告。

### 7. ファイルボックスの未処理証憑（任意）

```
freee_api_get { "service": "accounting", "path": "/api/1/receipts",
  "query": { "company_id": 10939384, "start_date": "<90日前>", "end_date": "<今日>", "limit": 100 } }
```
- 取引に紐づいていない（deal未設定の）証憑があれば件数を報告。エラーになる場合はこの項目を省略してよい。

## 報告フォーマット

以下のMarkdownで簡潔に報告する:

```
# freee健康診断レポート（YYYY-MM-DD）

## 総合判定: ✅ 良好 / ⚠️ 要対応あり / ❌ 異常

## 財務サマリー（第3期: 2025-11-01〜、当期累計）
| 項目 | 金額 |
|---|---|
| 売上高 | ¥X |
| 経費合計（販管費） | ¥X |
| 営業損益 | ¥X |
| 役員借入金 残高 | ¥X |
| 役員貸付金 残高 | ¥X（0でなければ⚠️） |
| 現金・預金 | ¥X |

## 経費の内訳（上位5科目）
...

## 要対応（あれば）
- [ ] 未処理明細 X件（¥X）→ /freee-expense で処理
- [ ] 期日超過の未回収請求 X件
- [ ] 口座同期ズレ: ...

## 一言コメント（税理士目線）
（例: 役員貸付金の解消を推奨、消費税経過措置が10月から控50に変わる、決算期(10/31)まであとX ヶ月 等）
```

## 注意

- 数値は closing_balance をそのまま使い、推測で埋めない。取得に失敗した項目は「取得失敗」と明記。
- 決算期末（10/31）の3ヶ月前からは、決算準備（証憑の整理・役員貸付金の解消・未処理明細ゼロ化）を毎回リマインドする。
