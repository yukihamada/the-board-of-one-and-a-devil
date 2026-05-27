# KDP 出版 Runbook — 『6人の役員と1匹の悪魔』

このドキュメントは Amazon.co.jp の Kindle ストアに本書を発売するための、人手による最短手順書である。Claude は KDP アカウントへの代理ログイン・銀行口座入力・本人確認は**できない**ため、ここから先は著者本人の手作業になる。完了まで実働 30〜60 分、Amazon 側の審査で公開まで最大 72 時間。

---

## 0. 事前準備（一度だけ）

### 0.1 必要なもの
- KDP アカウント（無ければ https://kdp.amazon.co.jp/ja_JP/ で無料登録）
- 銀行口座（日本の銀行可、ジャパンネット銀行・楽天銀行等）
- マイナンバー（W-8BEN 電子フォームで「日本居住者」として申告するため）
- クレジットカード（任意、ペーパーバックの校正本注文に使用）

### 0.2 著者ページ・税情報
1. KDP > アカウント > 著者・出版社情報
2. ペンネーム「粟田Kenny」、本名（KDP 内部のみ）
3. 著者プロフィール: `kdp-package/book-metadata.json` の `author.bio_200` をコピー
4. 税務情報 (W-8BEN): KDP の電子フォームに進み、日本居住者として申告。**米国源泉徴収 0%** になることを確認

---

## 1. パッケージファイルの場所
```
/Users/kentarohawata/work/book-6months/
├── build/book.epub                  ← Kindle 本体
├── build/book.pdf                   ← ペーパーバック用（任意、第2段で）
├── cover/cover.jpg                  ← 1600×2560 表紙
├── cover/cover.png                  ← 同上 PNG
└── kdp-package/
    ├── book-metadata.json           ← 書誌情報マスター
    └── KDP-PUBLISHING-RUNBOOK.md    ← このファイル
```

---

## 2. KDP ダッシュボード入稿手順（Kindle電子書籍）

### Step 1. 新規本の作成
1. https://kdp.amazon.co.jp/ja_JP/bookshelf にログイン
2. 「+ Kindle 本」ボタン

### Step 2. Kindle 本の詳細
| 項目 | 入力値 | book-metadata.json のキー |
|---|---|---|
| 言語 | 日本語 | publisher.language |
| 本のタイトル | 6人の役員と1匹の悪魔 | title.main |
| サブタイトル | ひとり会社の取締役会 | title.subtitle |
| タイトルのふりがな | ロクニンノヤクインノトイッピキノアクマ | title.reading |
| シリーズ | （空欄） | — |
| エディション番号 | （空欄、初版） | — |
| 著者 | 粟田Kenny | author.name |
| 著者ふりがな | アワタ ケニー | author.name_reading |
| 寄稿者 | （なし） | — |
| 内容紹介 | metadata の description.short_amazon_2000bytes をコピペ | description |
| 出版権 | 私はこの本の著作権者であり、必要な権利を保有しています | publishing_rights |
| キーワード | metadata.keywords_7 の7語をカンマ区切りで | keywords_7 |
| カテゴリー | metadata.categories.amazon_kdp_primary の2件を選択 | categories |
| 成人向けコンテンツ | いいえ | adult_content |
| 出版日 | 2026年5月30日（または当日） | publisher.publication_date |
| 出版社 | Atsume Press | publisher.imprint |

### Step 3. Kindle 本のコンテンツ
1. **原稿アップロード**: `build/book.epub` をアップロード
   - Kindle Previewer で自動変換、レイアウト確認画面が出る
2. **表紙**: 「表紙画像をアップロード」→ `cover/cover.jpg` (KDP は JPG/TIFF 推奨)
3. **Kindle 本のプレビュー**: 「オンラインプレビュアーを起動」→ 目次・章扉・本文・改行・絵文字（無いはず）を一通り確認
4. **ISBN**: 入力不要（Kindle 本に ISBN は必須ではない）

### Step 4. Kindle 本の価格設定
| 項目 | 値 |
|---|---|
| KDP セレクトに登録 | はい（独占配信 90日、Kindle Unlimited 報酬対象） |
| 出版地域 | 全世界 |
| ロイヤリティ プラン | 70% |
| 主な販売市場 | Amazon.co.jp |
| 価格設定 | ¥980（他市場は自動換算 or 個別設定）|
| 本のレンタル | 有効 |
| Kindle MatchBook | 該当なし |
| Kindle Book Lending | 有効（70% 選択時は自動） |

### Step 5. 出版
1. 全項目チェック→「Kindle 本を出版」
2. Amazon 側の審査 12〜72 時間
3. 完了するとメール通知、Amazon.co.jp の Kindle ストアに該当ページが出現
4. ASIN（Amazon Standard Identification Number）が発番される

### Step 6. 著者セントラル登録（公開後）
1. https://authorcentral.amazon.co.jp/ にログイン
2. 著者プロフィール（粟田Kenny）を作成、本書を紐付け
3. 著者ページ URL を取得し、SNS プロフィールに貼る
4. 公式サイト/ブログ URL も登録可能

---

## 3. ペーパーバック版（任意、第2段）

Kindle 電子書籍を出してから 1〜2 週間後の追加投入を推奨。電子書籍ローンチに集中する初動期は手間を増やさない。

| 項目 | 値 |
|---|---|
| 判型 | 文庫サイズ A6（105×148mm）または新書サイズ（103×182mm） |
| 紙質 | クリーム紙 |
| 表紙 | KDP の表紙テンプレートに合わせて再生成（背幅は本文ページ数で決定） |
| 本文 PDF | `build/book.pdf` をベースに、ノンブル・章扉・余白を再調整 |
| ISBN | KDP の無料 ISBN を割り当て可（KDP 経由出版のみ有効） |
| 価格 | ¥1,200〜¥1,500 推奨（印刷コスト + 著者印税 60%） |

---

## 4. 公開直後の動作確認チェックリスト

公開（ASIN 発番）から 24 時間以内に以下を確認:

- [ ] Amazon.co.jp のサイトで `[書名]` を検索して本書が出る
- [ ] 商品ページの表紙・タイトル・著者・価格・内容紹介が正しい
- [ ] 「無料サンプルを送信」をクリックして冒頭が表示される
- [ ] Kindle Unlimited マークが付いている
- [ ] 「目次」リンクで章タイトルがクリック可能
- [ ] 著者名をクリックすると著者ページに飛ぶ（著者セントラル登録後）
- [ ] ASIN をコピーして `marketing/creatives/utm-tracking.md` の Amazon Attribution URL を埋める

---

## 5. 緊急時の対応

| 症状 | 対応 |
|---|---|
| EPUB アップロードでエラー | Kindle Previewer 3 をローカルでインストールして検証、要因（フォント埋め込み・画像サイズ・XHTML 不正）を修正 |
| 表紙が「鮮明さ不足」で却下 | `cover/cover.png` を使う or 倍解像度で再書き出し |
| カテゴリーが反映されない | 公開後 24h 待つ。それでも変わらなければ kdp-support@amazon.com に依頼 |
| 「審査中」が72hを超える | KDP > サポート > お問い合わせ |
| 内容に修正が必要 | KDP > 本棚 > 該当書 > 「本のコンテンツを更新」で再アップロード（既に購入した読者にも更新通知が届く） |

---

## 6. 公開後の運用へ

公開でき次第:
- `kdp-package/book-metadata.json` の `files.asin` フィールドに ASIN を追記
- `marketing/plan/marketing-plan.md` の「Day 0 タスク」を実行
- `marketing/ads-engine/` の `npm run init` でキャンペーン雛形を本書 ASIN で投入
- Day 1 から `npm run sync` を毎日 cron で実行（runbook 参照）

> 「やらない判断、ありだよね」── 議長
