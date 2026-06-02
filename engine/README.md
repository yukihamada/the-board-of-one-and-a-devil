# あなたの議事録 ── エンジン（M5 常駐 / LLM=ローカル・課金ゼロ）

読者の「悩み」を受け、6役員＋悪魔が臨時取締役会を開いて議事録を生成し、メール（Resend）と
web/PDF で届ける。LLM は **M5 Mac の Ollama（qwen2.5）** を使うので **API課金ゼロ**。
devil.pub（Fly の静的サイト）から CORS 越しに叩かれる。

## 構成
- `server.js` … 依存ゼロ（Node 22+ の `node:sqlite` + `fetch`）。
- DB … `./data/minutes.db`（SQLite, 自動作成）。悩み・メール・議事録・送信済みフラグ。
- LLM … 対話の悪魔=`qwen2.5:14b`（速い）／議事録=`qwen2.5:32b`（品質）。

## エンドポイント
| | |
|---|---|
| `POST /api/intake` `{worry,email?}` | 悩みを預かる→即 `{token}` 返し、生成は非同期 |
| `GET /r/:token.json` | 生成状況＋議事録（本ページが後半でポーリング） |
| `GET /r/:token` | 議事録 web ページ（ブラウザ印刷で PDF 保存） |
| `POST /api/devil` `{message,mode?}` | 対話の悪魔（問い1つ）／`mode:"board"`=即席議事録 |
| `GET /health` | `{ok,model,dry_run,mail_configured}` |

## M5 で動かす（実証済み）
```bash
# 1. モデル（取得済み）
ollama pull qwen2.5:32b-instruct-q4_K_M
ollama pull qwen2.5:14b-instruct-q4_K_M
# 2. 起動（既定 DRY_RUN=メール送らない）
cd ~/your-minutes-engine && PORT=8791 PUBLIC_BASE=https://engine.devil.pub node server.js
```
常駐は launchd（`~/Library/LaunchAgents/pub.devil.engine.plist`）推奨。

## 本番化に必要な3手（要・優貴さん）
1. **公開トンネル**: M5:8791 を Cloudflare tunnel で `engine.devil.pub` に割当
   （既存 cloudflared を利用。`viewer` 側 `window.ENGINE_BASE` と一致させる）。
2. **Resend（devil.pub 送信）**: Resend に devil.pub ドメイン追加 → SPF/DKIM の DNS を
   Cloudflare に登録 → `RESEND_API_KEY` を環境変数に。
3. **本送信ON**: `SEND_LIVE=1`（未指定なら DRY_RUN でログのみ／実メール無し）。

## 検証済み（2026-06-02・M5 qwen2.5）
- 悪魔の声: 「で、それ、誰のため？（リンゴをかじる）」＝本の声を再現
- 議事録: CFO「金額は数字ですが、構造は意思です」等キャラ一致・verdict=引く・具体的decision
- DB保存／非同期生成（~40s）／DRY_RUNメールログ／web・PDFページ いずれも動作
