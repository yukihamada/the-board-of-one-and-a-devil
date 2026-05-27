// public/_book-body.html をテンプレートに埋め込み、章ごとの挿絵を H2 直後に注入
// gallery.html も生成 (10案カバー候補)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");
const body = readFileSync(resolve(root, "public/_book-body.html"), "utf8");
const tpl = readFileSync(resolve(root, "templates/index.html"), "utf8");

// 各章の H2 見出しに対応する挿絵
const ILLUS = [
  { match: "プロローグ", file: "ch00-prologue.png", alt: "椅子は 7 脚あった、ある日曜日のオフィス" },
  { match: "第1回 取締役会", file: "ch01-yaranai.png", alt: "8 件の案件、3 件を保留、2 件をやらないと決めた朝" },
  { match: "第2回 取締役会", file: "ch02-thinking.png", alt: "完成された提案書ではなく、未完成な思考ノートを送る" },
  { match: "第3回 取締役会", file: "ch03-jigoku.png", alt: "暗闇のデバッグ、ふっと点る小さな光" },
  { match: "第4回 取締役会", file: "ch04-devil.png", alt: "悪魔の隣に、小さな悪魔がもう一匹" },
  { match: "第5回 取締役会", file: "ch05-secret.png", alt: "夜のキーボードと、薄い赤い警告灯" },
  { match: "第6回 取締役会", file: "ch06-omakase.png", alt: "代理人ではなく、パートナーとしての握手" },
  { match: "第7回 取締役会", file: "ch07-houses.png", alt: "数十軒の家を、ひとつのスキーマに並べる" },
  { match: "第8回 取締役会", file: "ch08-structure.png", alt: "金額は同じ、構造を変える二枚の紙" },
  { match: "第9回 取締役会", file: "ch09-words.png", alt: "便利な言葉を一筋の線で消し、書き直す" },
  { match: "第10回 取締役会", file: "ch10-finale.png", alt: "半年を閉じる、リンゴの芯と束ねた議事録" },
  { match: "エピローグ", file: "ch99-epilogue.png", alt: "ドアを閉じる手と、7 脚の椅子の影" },
];

function injectIllustrations(html) {
  let out = html;
  for (const { match, file, alt } of ILLUS) {
    // h2 タイトルに該当文字列を含む最初のものを置換 (id 属性も保持)
    const re = new RegExp(`(<h2[^>]*>)([^<]*${match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^<]*)(</h2>)`);
    if (re.test(out)) {
      out = out.replace(re, (_m, open, title, close) =>
        `<figure class="chapter-illustration"><img src="/illustrations/${file}" alt="${alt}" loading="lazy" /></figure>${open}${title}${close}`
      );
    } else {
      console.warn("⚠ no h2 match for", match);
    }
  }
  return out;
}

const bodyWithImg = injectIllustrations(body);
const out = tpl.replace("{{BOOK_BODY}}", bodyWithImg);
writeFileSync(resolve(root, "public/index.html"), out);
console.log("built public/index.html (" + out.length + " bytes, +" + (bodyWithImg.length - body.length) + " for illustrations)");

// ── Gallery (10 cover candidates) ────────────────────────────
const candidatesDir = resolve(root, "public/cover-candidates");
const files = readdirSync(candidatesDir).filter(f => f.endsWith(".png") || f.endsWith(".jpg")).sort();
const galleryRows = files.map(f => {
  const id = f.replace(/\.\w+$/, "");
  const label = id.replace(/^\d+-/, "").replace(/-/g, " ");
  return `<figure class="cand"><a href="/cover-candidates/${f}" target="_blank"><img src="/cover-candidates/${f}" loading="lazy" alt="${id}" /></a><figcaption><strong>${id}</strong><span>${label}</span></figcaption></figure>`;
}).join("\n");

const galleryHtml = `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>表紙候補ギャラリー — 6人の役員と1匹の悪魔</title>
<style>
body { font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; background: #faf8f3; color: #1a1a1a; margin: 0; padding: 32px 20px 80px; }
h1 { font-size: 22px; max-width: 980px; margin: 8px auto 6px; letter-spacing: 0.04em; }
p.lede { max-width: 980px; margin: 0 auto 28px; color: #555; font-size: 14px; line-height: 1.7; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 22px; max-width: 1280px; margin: 0 auto; }
.cand { margin: 0; background: #fff; border: 1px solid #e6e0cd; border-radius: 6px; overflow: hidden; }
.cand img { width: 100%; height: 380px; object-fit: cover; display: block; background: #f5f1e6; }
.cand figcaption { padding: 10px 12px; font-size: 12px; line-height: 1.5; display: flex; flex-direction: column; gap: 2px; }
.cand strong { font-weight: 700; letter-spacing: 0.04em; }
.cand span { color: #777; }
.nav { max-width: 980px; margin: 0 auto 14px; font-size: 12px; color: #555; }
.nav a { color: #1a1a1a; }
</style></head>
<body>
<div class="nav"><a href="/">← 本文プレビューへ</a></div>
<h1>表紙候補ギャラリー（10案）</h1>
<p class="lede">Gemini Nano Banana で生成した 10 パターン。時代普遍・童話までいかないけどサッと読みやすい、をテーマに同一モチーフ（木の机と 7 脚の椅子、1 個のリンゴ）でスタイルだけ振り分けています。気に入った案の番号を著者まで。クリックで原寸表示。</p>
<div class="grid">${galleryRows}</div>
</body></html>`;
writeFileSync(resolve(root, "public/gallery.html"), galleryHtml);
console.log("built public/gallery.html (" + files.length + " candidates)");
