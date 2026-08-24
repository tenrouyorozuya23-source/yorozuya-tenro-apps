# 萬屋天狼 システム構成マップ

> 公式サイト・予約システム・物販・LINE Bot・スプレッドシート管理の全体像。
> 「どこに何があるか」を失わないための台帳。**秘密情報（APIキー・PIN・トークン）はここには書かない**こと（このリポジトリは公開）。
> 秘密情報の所在は各節の「🔑」を参照。

最終更新: 2026-08-24

---

## 全体構成図

```
                        ┌─────────────────────────────┐
                        │  公式サイト (Wix)            │
                        │  https://tenrou.info         │
                        │  DNS: 185.230.63.x (Wix)     │
                        └──────────┬──────────────────┘
                                   │ リンク / 埋め込み
                                   ▼
        ┌──────────────────────────────────────────────┐
        │  予約・物販システム (Cloudflare 経由)          │
        │  https://tenrousai.tenrou.info               │
        │  DNS: 172.66.x.x (Cloudflare Proxy)          │
        │                                              │
        │   /ticket    予約フォーム（お客様配布）        │
        │   /goods     グッズ通販（お客様配布）          │
        │   /checkin   受付アプリ（スタッフ・PIN保護）   │
        │   /register  レジ（スタッフ・PIN保護）         │
        │   /list?t=…  キャスト別予約リスト（トークン制） │
        └──────────────────┬───────────────────────────┘
                           │ プロキシ（Cloudflare → GAS）
                           ▼
        ┌──────────────────────────────────────────────┐
        │  GAS Webアプリ（スプレッドシート紐付き）        │
        │  script.google.com/macros/s/AKfycbybEne0…/exec │
        │   - Web画面の配信（予約/通販/受付/レジ/リスト） │
        │   - LINE Bot Webhook（?k=秘密キー 付きURL）     │
        │   - 遠隔実行API（check / richmenu / regcast 等）│
        └──────────────────┬───────────────────────────┘
                           ▼
        ┌──────────────────────────────────────────────┐
        │  マスタ台帳スプレッドシート                     │
        │  【予約管理】天狼祭2026                         │
        │  ID: 1gjrarYFZo1g3l0W6T0iZITXznbQnufg_iCtR51HkHg8 │
        └──────────────────────────────────────────────┘
```

---

## 1. 公式サイト（Wix）

- URL: `https://tenrou.info`（apex は Wix のIP 185.230.63.x に直接向いている）
- `www.tenrou.info` は Cloudflare 経由の CNAME
- 予約ページ等は Wix 内ではなく、`tenrousai.tenrou.info`（Cloudflare）へのリンク/埋め込みで連携
- 🔑 Wix API Key・サイトID: Wix ダッシュボード → 設定 → API キー で発行・確認

## 2. 予約・物販システム（Cloudflare + GAS）

- 配信ドメイン: `tenrousai.tenrou.info`（Cloudflare Proxy。実体は GAS Webアプリへの中継）
- Cloudflare アカウント: tenrou.yorozuya.23@gmail.com
  - 2026-08-24 時点で「アカウントAPIトークン」は未作成（ユーザーAPIトークンは マイプロフィール → APIトークン に別枠であるので注意）
- 公開URL:
  | ページ | URL | 用途 |
  |---|---|---|
  | 予約フォーム | https://tenrousai.tenrou.info/ticket | お客様配布（`?cast=C01` 等でキャスト紐付け） |
  | グッズ通販 | https://tenrousai.tenrou.info/goods | お客様配布 |
  | 受付アプリ | https://tenrousai.tenrou.info/checkin | スタッフ用・PIN保護 |
  | レジ | https://tenrousai.tenrou.info/register | スタッフ用・PIN保護 |
  | キャスト別リスト | https://tenrousai.tenrou.info/list?t=（トークン） | キャスト個別・トークン制 |
- 🔑 スタッフPIN（受付・レジ・管理）: スプレッドシート「操作パネル」シート末尾の「リンクと鍵」欄

## 3. マスタ台帳スプレッドシート

- ファイル名: 【予約管理】天狼祭2026
- ID: `1gjrarYFZo1g3l0W6T0iZITXznbQnufg_iCtR51HkHg8`
- 場所: Google Drive フォルダ `1cRMIDuGuBX0AuJ53ELjT0FAltDISg4lK`（richmenu.png も同フォルダ）
- 主なシート:
  - 予約一覧（予約番号 R-/T-/D- 採番、決済・来場ステータス管理）
  - キャンセル待ち（登録順に自動ご案内・期限で自動繰り上げ）
  - キャストマスタ（C01〜C26、個別トークン・予約リストURL・申込フォームURL）
  - 物販マスタ / 在庫ログ / 売上ログ（POS）
  - 通販注文（STORES決済連携・発送通知）
  - 操作パネル（チェックボックス実行・全22操作）＋「リンクと鍵」
  - 操作ログ（遠隔実行の履歴含む）
  - バックアップ履歴（毎日 3:05 に自動で控えスプシ＋サマリーPDFを保存）
- GAS はこのスプレッドシートにコンテナバインドされている（コードの正本はGASエディタ内。**このリポジトリへのミラーが未実施** → TODO参照）

## 4. LINE Bot

- Webhook: GAS Webアプリの `/exec` URL に `?k=（秘密キー）` を付けたもの（🔑 スプレッドシート「操作パネル」の「リンクと鍵」欄に記載。LINE Developers の Webhook 設定欄に貼る）
- チャネルアクセストークン / チャネルシークレット: GAS のスクリプトプロパティに設定済み（操作パネルの「check」で設定状態を確認可能）
- リッチメニュー: Drive の `richmenu.png` を差し替え → 操作パネル「LINEメニューを設定する」で反映
- 機能: キャストの取り置き予約（T-番号）、新規予約通知、お知らせ配信、問い合わせ返信、状況便（予約実績＋残席）

## 5. 決済（STORES）

- 事前決済・通販の決済に STORES API を使用（APIキーは GAS スクリプトプロパティに設定済み）
- STORES Webhook は 2026-08-24 時点で未設定（操作パネル表示より）
- 入金確認は操作パネル「入金を今すぐ確認する」で手動照会も可能

## 6. GitHub リポジトリとの関係

- `stage-booking-pos-manager/`（このリポジトリ）は **2026-06-06 時点の旧版**。現行システム（tenrousai.tenrou.info + 上記スプシGAS）は別物で、コードはGAS内にのみ存在する
- freee 会計アシスタント（Skill・マスタ資料）もこのリポジトリで管理

---

## Claude で運用を再開するときに必要なもの

1. **Claude Code 環境のネットワーク許可**（claude.ai/code の環境設定 → ネットワークアクセス）
   - 許可が必要なドメイン: `api.cloudflare.com` / `www.wixapis.com` / `script.google.com` / `script.googleusercontent.com` / `api.line.me` / `api-data.line.me` / `tenrou.info` / `*.tenrou.info`
2. **Cloudflare APIトークン**（マイプロフィール → APIトークン → 作成）
   - 推奨権限: Zone(tenrou.info): DNS:編集 + Zone:読み取り、Workers スクリプト:編集、Cloudflare Pages:編集
3. **Wix API Key + サイトID**（Wix ダッシュボード → 設定 → APIキー）
4. **スプレッドシート操作**: Google Drive コネクタで読み取り可。書き込み・GAS実行は「操作パネル」のチェックボックス、または GAS 遠隔実行API（🔑キー必要）経由

## TODO

- [ ] GAS コードをこのリポジトリにミラーする（clasp または手動コピー）— コード消失対策として最優先
- [ ] Cloudflare 側の実体確認（Worker か Pages か、ルーティング設定の書き出し）
- [ ] Wix API 連携の再構築（サイト更新の自動化）
- [ ] STORES Webhook の設定（入金通知の自動化）
