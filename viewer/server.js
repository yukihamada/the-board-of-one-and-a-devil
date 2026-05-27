// 依存ゼロの静的ファイルサーバ。Fly.io で公開するための最小実装。
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const ROOT = new URL("./public/", import.meta.url).pathname;

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
