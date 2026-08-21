---
name: freee-billing
description: freee請求書での請求書・領収書（帳票）・見積書の作成。「請求書を作って」「領収書を発行して」「見積書」と言われたら使う。フォーム未記入ならフォームを提示する。受け取った領収書の写真の経費化は freee-receipt を使うこと。
---

# freee 請求書・領収書（帳票）作成

事業所: 合同会社萬屋天狼（company_id: **10939384**）。service は **invoice**（会計APIの `/api/1/invoices` は使わない）。
取引先IDは `freee-accounting/references/company-master.md` を参照。

## フォーム

ユーザーが情報なしで「請求書作りたい」等と言ったら、該当フォームをコピペ用に提示する。自由文で情報が揃っているならフォームは省略してよい（足りない項目だけまとめて確認）。

### 請求書フォーム

```
【請求書作成】
宛先: （取引先名）
請求日: YYYY-MM-DD（省略時: 今日）
入金期日: YYYY-MM-DD（省略時: 翌月末）
件名: 
明細（1行ずつ: 内容 / 数量 / 単価(税抜) / 税率10 or 軽8）
1. 
2. 
源泉徴収: あり / なし（省略時: なし）
備考: （省略可）
```

### 領収書フォーム

```
【領収書作成】
宛名: 
領収日: YYYY-MM-DD（省略時: 今日）
但し書き: （例: お品代として）
金額（税込）: 円
税率: 10 / 軽8
```

### 見積書フォーム

```
【見積書作成】
宛先: 
見積日: YYYY-MM-DD（省略時: 今日）
有効期限: （省略可）
件名: 
明細（1行ずつ: 内容 / 数量 / 単価(税抜) / 税率10 or 軽8）
1. 
```

## 作成手順

### 1. 取引先IDを解決

- company-master.md の一覧にあればそのIDを使う
- なければ検索: `freee_api_get { service: "accounting", path: "/api/1/partners", query: { company_id: 10939384, keyword: "<名前>" } }`
- それでもなければ作成: `freee_api_post { service: "accounting", path: "/api/1/partners", body: { company_id: 10939384, name: "<名前>" } }`
- 敬称: 会社→御中、個人→様（取引先マスタに default_title があればそれを優先）

### 2. 内容確認

作成前に、宛先・日付・明細・合計額（税込）を表で提示して確認する（帳票は取引先に渡るものなので、フォーム記入済みでも一度は確認を挟む）。

### 3-a. 請求書を作成

```
freee_api_post { "service": "invoice", "path": "/invoices", "body": {
  "company_id": 10939384,
  "billing_date": "YYYY-MM-DD",
  "payment_date": "YYYY-MM-DD",
  "payment_type": "transfer",
  "subject": "<件名>",
  "partner_id": <ID>,
  "partner_title": "御中",
  "tax_entry_method": "out",
  "tax_fraction": "omit",
  "withholding_tax_entry_method": "out",
  "lines": [{
    "type": "item",
    "description": "<内容>",
    "quantity": 1,
    "unit_price": "100000",
    "tax_rate": 10,
    "withholding": false,
    "account_item_id": 763260719,
    "tax_code": 129,
    "tag_ids": [35402337]
  }],
  "invoice_note": "<備考>"
}}
```

- unit_price は**文字列**、税抜額
- 軽減8%の行: `"tax_rate": 8, "reduced_tax_rate": true`（tax_code は 156）
- 源泉徴収ありの行: `"withholding": true`
- 振込先は事業所既定（GMOあおぞら ***0456）が自動で載る

### 3-b. 領収書（帳票）を作成

```
freee_api_post { "service": "invoice", "path": "/receipts", "body": {
  "company_id": 10939384,
  "receipt_date": "YYYY-MM-DD",
  "partner_id": <ID>,
  "partner_title": "様",
  "tax_entry_method": "in",
  "tax_fraction": "omit",
  "withholding_tax_entry_method": "out",
  "lines": [{ "type": "item", "description": "<但し書き>", "quantity": 1,
    "unit_price": "<税込金額>", "tax_rate": 10, "tag_ids": [35402337] }]
}}
```

- 金額を税込で受けたら `tax_entry_method: "in"` にして unit_price に税込額を入れる

### 3-c. 見積書を作成

パスを `/quotations`、日付フィールドを `quotation_date` にする以外は請求書と同様。

### 4. 完了報告

レスポンスの `report_url`（なければ下記URL形式）と合計金額を提示:
- 請求書: `https://invoice.secure.freee.co.jp/reports/invoices/{id}`
- 領収書: `https://invoice.secure.freee.co.jp/reports/receipts/{id}`
- 見積書: `https://invoice.secure.freee.co.jp/reports/quotations/{id}`

「Web画面から送付（メール/郵送）できます」と案内する。送付操作自体はAPIから行わない。

## 修正・取消

- 内容修正: `PUT /invoices/{id}`（bodyは作成時と同形式 + company_id）
- 取消: `PUT /invoices/{id}/cancel`（body: `{ "company_id": 10939384 }`）。取引が紐づく帳票の取消は取引も消える点を先に伝える
