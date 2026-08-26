# 萬屋天狼 公式サイト（official-site/）

合同会社萬屋天狼の公式サイト本体。**このディレクトリの静的HTMLが正本**で、Claude Codeが作成・更新する。

## アーキテクチャ

```
このリポジトリ official-site/  ←  Claude Code が編集して push（ここが正本）
        │  Cloudflare Pages の Git 連携で自動デプロイ
        ▼
Cloudflare Pages（カスタムドメイン例: site.tenrou.info）
        │  リンク or 埋め込み
        ▼
Wix（tenrou.info）＝ メニュー構造・ドメインの器のみ。中身は持たない
```

- ビルド工程なし。素のHTML/CSSのみ（各ページは `assets/style.css` を共有）
- push → 自動デプロイなので、運用にCloudflare APIトークンは不要

## 初回セットアップ（1回だけ・ダッシュボード操作）

1. Cloudflare ダッシュボード → **Workers & Pages → 作成 → Pages → Gitに接続**
2. リポジトリ `tenrouyorozuya23-source/yorozuya-tenro-apps` を選択
3. 設定:
   - プロダクションブランチ: `main`
   - ビルドコマンド: （空欄）
   - ビルド出力ディレクトリ: `official-site`
4. デプロイ後、**カスタムドメイン**タブで `site.tenrou.info`（任意のサブドメイン）を追加
5. Wix側: 各メニューから該当ページへリンク（または埋め込み）

## ページ構成

| ファイル | ページ |
|---|---|
| `index.html` | トップ |
| `services.html` | 事業内容 |
| `works.html` | 実績・開発（主催公演・自社ツール） |
| `company.html` | 会社概要（※代表・所在地・設立は【準備中】のまま。確定情報をもらってから記入） |
| `contact.html` | お問い合わせ（※LINEボタン・フォームは【準備中】） |
| `assets/style.css` | 共通スタイル（夜空×狼の和モダン・ダークテーマ） |

## 運用ルール

- 事実情報（代表者名・住所・設立日・料金など）は**ユーザー確認済みのものだけ**記載する。未確定は【準備中】表記
- 個人メールアドレス（gmail）はサイトに掲載しない
- ページ追加時はヘッダー/フッターのナビも全ページ更新する
