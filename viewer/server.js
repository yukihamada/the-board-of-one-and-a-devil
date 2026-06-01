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
