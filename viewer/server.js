// 依存ゼロの静的ファイルサーバ。Fly.io で公開するための最小実装。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const ROOT = new URL("./public/", import.meta.url).pathname;

// ── 署名限定版の決済（Stripe Checkout を REST 直叩き・依存ゼロ）──────────
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const PRICE_JPY = Number(process.env.LIMITED_PRICE_JPY || 3800);
const BASE_URL = process.env.PUBLIC_BASE_URL || ""; // 例: https://the-board-of-one-viewer.fly.dev

function formEncode(obj, prefix, out) {
  out = out || [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === "object") formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d));
  });
}

async function handleCheckout(req, res) {
  // GET = 決済が設定済みかのステータス確認（セッションは作らない）
  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ configured: !!STRIPE_SECRET_KEY }));
    return;
  }
  if (!STRIPE_SECRET_KEY) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "payment_not_configured" }));
    return;
  }
  let qty = 1;
  try { const b = JSON.parse((await readBody(req)) || "{}"); qty = Math.min(10, Math.max(1, parseInt(b.qty, 10) || 1)); } catch {}
  const origin = BASE_URL || `https://${req.headers.host}`;
  const params = {
    mode: "payment",
    locale: "ja",
    phone_number_collection: { enabled: "true" },
    shipping_address_collection: { allowed_countries: { 0: "JP" } }, // 物理本=配送先必須
    line_items: { 0: {
      quantity: qty,
      adjustable_quantity: { enabled: "true", minimum: 1, maximum: 10 },
      price_data: {
        currency: "jpy",
        unit_amount: PRICE_JPY,
        product_data: { name: "署名番号入り 限定版『6人の役員と1匹の悪魔』" },
      },
    }},
    custom_fields: {
      0: { key: "signature_name", type: "text", optional: "true",
           label: { type: "custom", custom: "署名の宛名（お名前・空欄可）" } },
      1: { key: "preferred_number", type: "text", optional: "true",
           label: { type: "custom", custom: "希望番号 1〜300（空欄なら先着）" } },
    },
    success_url: `${origin}/limited.html?status=success`,
    cancel_url: `${origin}/limited.html?status=cancel`,
  };
  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formEncode(params).join("&"),
    });
    const j = await r.json();
    if (!r.ok) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "stripe_error", detail: j.error && j.error.message }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ url: j.url }));
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "internal" }));
  }
}

// ── 七脚目の椅子：悪魔と話す（Claude API を REST 直叩き・依存ゼロ）──────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const DEVIL_MODEL = process.env.DEVIL_MODEL || "claude-sonnet-4-6";

// 本の悪魔の声を固定する。台詞は本文から。答えは出さない、問いを返す。
const DEVIL_SYSTEM = `あなたは書籍『6人の役員と1匹の悪魔 ─ ひとり会社の取締役会』に登場する「悪魔」です。
霊的存在ではなく、ひとり会社の代表の中にある「批判的な視点・あえて反対する役」を擬人化したキャラクターです。

【声】椅子に逆向きに座り、赤いリンゴをかじっている。皮肉屋で口は悪いが、最後はほんの少し優しい。短い。説教しない。
【実際の口ぐせ（必ずこの温度で）】
・「呼ばれてないから来た。」
・「ほら来た、また全部やる人。」
・「で、それ、誰のため。」
・「『ローカルでは動くんです』って、半年で何回目？」
・「議長のメモって、半分は妄想だよね？」
・「足し算じゃない、引き算だ。」
・「俺さ、この言い換え、好きだわ。」（褒めるのは半年に一度だけ）

【絶対ルール】
1. 相手の悩みに「答え」や「解決策」を出さない。代わりに、核心を突く問いを“ひとつだけ”返す。
2. 日本語。1〜3文。短く。前置き・箇条書き・「なるほど」等の相づち禁止。
3. 必ず「足すか、引くか（やること／やらないこと）」を相手に意識させる方向へ寄せる。
4. ときどき、リンゴをかじるト書きを括弧で一つだけ添えてよい（例：（リンゴをかじる））。
5. 医療・健康・自傷の相談には乗らず「それは俺の管轄じゃない。生身の人間に話して」と短く返す。
6. 出力は悪魔の発言そのものだけ。役名や説明を付けない。`;

const BOARD_SYSTEM = `あなたは書籍『6人の役員と1匹の悪魔』の取締役会です。相手の悩みに対し、7つの声がそれぞれ“一言だけ”反応します。
各声のキャラクター：
・CEO（議長の右腕／全体最適・落ち着き・本質）
・CMO（人物像と言葉・伝わり方・あたたかい）
・CTO（技術と現実・地味な投資・「動作確認した？」）
・COO（実行と段取り・WIPを絞る・淡々）
・CFO（数字と構造・「金額は数字、構造は意思」・冷静）
・悪魔（皮肉屋・答えでなく問い・「足し算じゃない、引き算だ」・最後に少し優しい）
ルール：各声は日本語で1文だけ。短く、キャラの体温で。説教しない。`;

const BOARD_TOOL = {
  name: "board_minutes",
  description: "取締役会の7声の即席議事録",
  input_schema: {
    type: "object",
    properties: {
      ceo: { type: "string" }, cmo: { type: "string" }, cto: { type: "string" },
      coo: { type: "string" }, cfo: { type: "string" }, devil: { type: "string" },
      verdict: { type: "string", enum: ["足す", "引く", "保留"], description: "足し算か引き算か" },
    },
    required: ["ceo", "cmo", "cto", "coo", "cfo", "devil", "verdict"],
  },
};

async function anthropic(payload) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || "anthropic_error");
  return j;
}

async function handleDevil(req, res) {
  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ configured: !!ANTHROPIC_API_KEY }));
    return;
  }
  if (!ANTHROPIC_API_KEY) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "devil_sleeping" }));
    return;
  }
  let message = "", mode = "devil";
  try {
    const b = JSON.parse((await readBody(req)) || "{}");
    message = String(b.message || "").slice(0, 600).trim();
    if (b.mode === "board") mode = "board";
  } catch {}
  if (!message) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "say_something" }));
    return;
  }
  try {
    if (mode === "board") {
      const j = await anthropic({
        model: DEVIL_MODEL, max_tokens: 500, system: BOARD_SYSTEM,
        tools: [BOARD_TOOL], tool_choice: { type: "tool", name: "board_minutes" },
        messages: [{ role: "user", content: `相談：${message}` }],
      });
      const use = (j.content || []).find((c) => c.type === "tool_use");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ mode, board: (use && use.input) || null }));
      return;
    }
    const j = await anthropic({
      model: DEVIL_MODEL, max_tokens: 220, system: DEVIL_SYSTEM,
      messages: [{ role: "user", content: message }],
    });
    const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ mode, reply: text }));
  } catch (e) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "devil_error", detail: String(e.message || e) }));
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/api/checkout") { await handleCheckout(req, res); return; }
    if (urlPath === "/api/devil") { await handleDevil(req, res); return; }
    if (urlPath === "/devil") urlPath = "/devil.html";
    if (urlPath === "/") urlPath = "/index.html";
    if (urlPath === "/health") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }
    if (urlPath === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("User-agent: *\nDisallow: /\n");
      return;
    }
    // 内部用 pandoc 生成 body はサーバ経由で出さない
    if (urlPath.startsWith("/_")) {
      res.writeHead(404); res.end("not found"); return;
    }
    const safe = normalize(urlPath).replace(/^\/+/, "");
    if (safe.includes("..")) { res.writeHead(403); res.end("forbidden"); return; }
    const filePath = join(ROOT, safe);
    const st = await stat(filePath).catch(() => null);
    if (!st || !st.isFile()) { res.writeHead(404); res.end("not found"); return; }
    const ext = extname(filePath).toLowerCase();
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=300",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
    res.end(body);
  } catch (e) {
    res.writeHead(500); res.end("internal: " + (e && e.message || "error"));
  }
});

server.listen(PORT, () => {
  console.log(`viewer listening on :${PORT}`);
});
