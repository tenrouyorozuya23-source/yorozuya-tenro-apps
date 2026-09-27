# 家族の絆 — 予約・受付・物販システム

`stage-booking-pos-manager`（天狼祭2026で使用）をベースにした、舞台「家族の絆」（BSD presents／シアターグリーン BASE THEATER）用の予約システム。

- 予約受付：Googleフォーム → 予約一覧シート（予約番号 R-001 形式）
- キャスト別予約リスト（Webアプリ）と LINE 通知・LINE 取り置き
- 当日受付（`checkin.html`）
- 物販レジ・在庫・領収書PDF（`register.html`）

## 公演設定

| 項目 | 内容 |
|---|---|
| 公演数 | 全7公演・各60席 |
| 席種 | SS席 / S席 / A席 |
| 特別チケット | なし |
| キャスト | 18名（取り扱いキャストとしてフォームに表示） |
| 物販 | 未定（決まったら `CONFIG.goods` に追加） |

## セットアップ前に埋める項目（`Code.gs` の CONFIG で「★要入力」と書いてある箇所）

1. `shows[].dt`：7公演の日時（例 `3/14(土) 13:00`）。フォームの選択肢と受付シート名に使われるので、**setup を実行する前に**確定させる
2. `seatTypes[].price`：SS席・S席・A席の料金（setup 後に「公演マスタ」の単価セルを直しても売上管理に反映される）
3. `notify.lineToken` / `lineSecret`：LINE公式アカウントのトークン（リポジトリにはコミットしない）
4. `receiptFolderId`：領収書PDFを保存する Google ドライブのフォルダID
5. `goods`：物販の商品（あれば）

## セットアップ手順

1. 新しいスプレッドシートを作り、拡張機能 → Apps Script に `Code.gs`・`index.html`・`checkin.html`・`register.html` を貼り付ける
2. `setup_1_sheets()` → `setup_2_form()` → `setup_3_reservationSheet()` → `setup_4_triggers()` の順に実行
3. ウェブアプリとしてデプロイし、LINE の Webhook URL に設定する

## ベース版からの主な変更

- 売上管理シートの列を `CONFIG.seatTypes` / `specialTickets` から自動生成（ベース版は S席・自由席・全通券・学割・クーポンで固定だった）。料金は公演マスタの単価セルを参照
- 枚数を「2枚」などの文字列ではなく数値で保存するように修正。残席計算と売上が枚数で正しく集計される
- LINE の案内文、レジのタイトル、領収書フォルダを CONFIG から参照するように変更
