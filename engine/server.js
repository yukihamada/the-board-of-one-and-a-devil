// 「あなたの議事録」エンジン ── M5 Mac 常駐（LLM=ローカル Ollama / 課金ゼロ）
// 役割: 悩みを受ける → SQLite保存 → 6役員+悪魔が臨時取締役会を開く(議事録生成)
//        → メール送付(Resend) → web/PDF サマリーを配信。
// 依存ゼロ（Node 22+ の node:sqlite と fetch のみ）。devil.pub(Fly静的) から CORS で叩かれる。
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";

const PORT = Number(process.env.PORT || 8791);
const DATA_DIR = process.env.DATA_DIR || "./data";
const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODEL_FAST = process.env.MODEL_FAST || "qwen2.5:14b-instruct-q4_K_M"; // 対話の悪魔
const MODEL_DEEP = process.env.MODEL_DEEP || "qwen2.5:32b-instruct-q4_K_M"; // 議事録の品質
const PUBLIC_BASE = process.env.PUBLIC_BASE || `http://localhost:${PORT}`;   // 例 https://engine.devil.pub
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const MAIL_FROM = process.env.MAIL_FROM || "Atsume Press <kenny@devil.pub>";
const DRY_RUN = process.env.SEND_LIVE !== "1"; // 既定はメール送らない（本送信は SEND_LIVE=1）

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(`${DATA_DIR}/minutes.db`);
db.exec(`CREATE TABLE IF NOT EXISTS intake(
  token TEXT PRIMARY KEY, created TEXT, email TEXT, name TEXT, worry TEXT,
  status TEXT DEFAULT 'pending',           -- pending|done|error
  minutes_json TEXT, devil_q TEXT, verdict TEXT, mailed INTEGER DEFAULT 0, err TEXT
)`);
const qIns = db.prepare(`INSERT INTO intake(token,created,email,name,worry,status) VALUES(?,?,?,?,?, 'pending')`);
const qGet = db.prepare(`SELECT * FROM intake WHERE token=?`);
const qDone = db.prepare(`UPDATE intake SET status='done', minutes_json=?, devil_q=?, verdict=?, mailed=? WHERE token=?`);
const qErr = db.prepare(`UPDATE intake SET status='error', err=? WHERE token=?`);

// ── helpers ───────────────────────────────────────────────
const J = (res, code, obj) => {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  });
  res.end(JSON.stringify(obj));
};
const body = (req) => new Promise((r) => { let d=""; req.on("data",c=>d+=c); req.on("end",()=>r(d)); });
const esc = (s) => String(s||"").replace(/[<>&]/g,m=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[m]));

async function ollama(model, system, user, json) {
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model, stream: false, think: false,
      format: json ? "json" : undefined,
      options: { temperature: json ? 0.6 : 0.85, num_predict: json ? 1300 : 200 },
      messages: [{ role:"system", content: system }, { role:"user", content: user }],
    }),
  });
  const j = await r.json();
  if (!r.ok || !j.message) throw new Error("ollama: " + JSON.stringify(j).slice(0,200));
  return (j.message.content || "").trim();
}

// ── 悪魔の声（対話・問いを1つ）────────────────────────────
const DEVIL_SYS = `あなたは書籍『6人の役員と1匹の悪魔 ─ ひとり会社の取締役会』の「悪魔」。
ひとり会社の代表の中の「批判的な視点・あえて反対する役」を擬人化した存在。霊的な意味はない。
椅子に逆向きに座り赤いリンゴをかじる皮肉屋。口は悪いが最後はほんの少しだけ優しい。
口ぐせ:「で、それ、誰のため。」「ほら来た、また全部やる人。」「足し算じゃない、引き算だ。」
ルール:
- 相手の悩みに答え・解決策・アドバイスを出さない。核心を突く問いを“ひとつだけ”返す。
- 日本語。1〜3文。短く。前置き・相づち・箇条書き・説教を禁止。
- 「足すか、引くか（やること/やらないこと）」を意識させる方向に寄せる。
- ときどき（リンゴをかじる）のト書きを一つだけ添えてよい。
- 医療・自傷の相談には乗らず「それは俺の管轄じゃない。生身の人間に話して」とだけ短く返す。
- 出力は悪魔の発言だけ。役名や説明を付けない。`;

// ── 臨時取締役会の議事録（深い・JSON）────────────────────
const BOARD_SYS = `あなたは『6人の役員と1匹の悪魔』の取締役会。読者から届いた“ひとつの悩み”について、
臨時取締役会を開き、本と同じ筆致で議事録をまとめる。各役員のキャラ:
・CEO=全体最適と本質、落ち着き ・CMO=言葉と伝わり方、あたたかい ・CTO=技術と現実、地味な投資、「動作確認した？」
・COO=実行と段取り、WIPを絞る、淡々 ・CFO=数字と構造、「金額は数字、構造は意思」、冷静
・悪魔=答えでなく問い、「足し算じゃない、引き算だ」、最後に少しだけ優しい
必ず次のJSONだけを返す（前後に文を付けない）:
{
 "agenda": "議題を一文で（読者の悩みを要約・固有名詞は伏せる）",
 "ceo": "...", "cmo": "...", "cto": "...", "coo": "...", "cfo": "...",
 "devil_question": "悪魔が突きつける問い（1つ・短く）",
 "verdict": "足す" か "引く" か "保留",
 "decision": "決定事項を一文で（読者が来週やる/やめる具体的な一歩）",
 "chair_note": "議長メモ（読者の背中をそっと押す2文・本の温度で）"
}
各値は日本語。役員の発言は1〜2文、その悩みに即して具体的に。`;

async function generateMinutes(worry) {
  const raw = await ollama(MODEL_DEEP, BOARD_SYS, `読者の悩み：\n${worry}`, true);
  let m;
  try { m = JSON.parse(raw); }
  catch { const s=raw.indexOf("{"), e=raw.lastIndexOf("}"); m = JSON.parse(raw.slice(s, e+1)); }
  for (const k of ["agenda","ceo","cmo","cto","coo","cfo","devil_question","verdict","decision","chair_note"])
    if (!m[k]) m[k] = "";
  if (!["足す","引く","保留"].includes(m.verdict)) m.verdict = "保留";
  return m;
}

// ── メール（Resend REST・DRY_RUN既定）──────────────────────
async function sendMail(to, token, m) {
  const url = `${PUBLIC_BASE}/r/${token}`;
  const html = renderEmail(m, url);
  if (DRY_RUN || !RESEND_API_KEY) {
    console.log(`[DRY_RUN mail] to=${to} url=${url} verdict=${m.verdict}`);
    return false;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization:`Bearer ${RESEND_API_KEY}`, "content-type":"application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to: [to],
      subject: `臨時取締役会の議事録 ── あなたの件について（決定: ${m.verdict}）`, html }),
  });
  if (!r.ok) throw new Error("resend: " + (await r.text()).slice(0,200));
  return true;
}

// ── ジョブ: 悩み→議事録→メール ──────────────────────────
async function runJob(token) {
  const row = qGet.get(token); if (!row) return;
  try {
    const m = await generateMinutes(row.worry);
    let mailed = 0;
    if (row.email) { try { mailed = (await sendMail(row.email, token, m)) ? 1 : 0; } catch(e){ console.log("mail err", e.message); } }
    qDone.run(JSON.stringify(m), m.devil_question, m.verdict, mailed, token);
  } catch (e) { console.log("process err", e.message); qErr.run(String(e.message).slice(0,300), token); }
}

// ── HTTP ─────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = (req.url||"/").split("?")[0];
  if (req.method === "OPTIONS") return J(res, 204, {});
  try {
    if (url === "/health") return J(res, 200, { ok:true, model:MODEL_DEEP, dry_run:DRY_RUN, mail_configured:!!RESEND_API_KEY });

    // 議題を受ける（悩み + メール）→ 即 token返し、生成は非同期
    if (url === "/api/intake" && req.method === "POST") {
      let b={}; try{ b=JSON.parse(await body(req)||"{}"); }catch{}
      const worry=String(b.worry||"").slice(0,1200).trim();
      const email=String(b.email||"").slice(0,200).trim();
      const name=String(b.name||"").slice(0,80).trim();
      if (!worry) return J(res,400,{error:"worry_required"});
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return J(res,400,{error:"bad_email"});
      const token = randomBytes(9).toString("base64url");
      qIns.run(token, new Date().toISOString(), email, name, worry);
      runJob(token); // fire and forget
      return J(res,200,{ token, status:"pending", url:`${PUBLIC_BASE}/r/${token}` });
    }

    // サマリー JSON（本のページがポーリングして後半に差し込む）
    if (url.startsWith("/r/") && url.endsWith(".json")) {
      const token = url.slice(3, -5);
      const row = qGet.get(token); if (!row) return J(res,404,{error:"not_found"});
      return J(res,200,{ status:row.status, verdict:row.verdict,
        minutes: row.minutes_json ? JSON.parse(row.minutes_json) : null });
    }

    // 対話の悪魔（問いを1つ）/ 取締役会の即席版
    if (url === "/api/devil" && req.method === "POST") {
      let b={}; try{ b=JSON.parse(await body(req)||"{}"); }catch{}
      const msg=String(b.message||"").slice(0,600).trim();
      if (!msg) return J(res,400,{error:"say_something"});
      if (b.mode === "board") {
        const m = await generateMinutes(msg);
        return J(res,200,{ mode:"board", board:{ ceo:m.ceo,cmo:m.cmo,cto:m.cto,coo:m.coo,cfo:m.cfo,devil:m.devil_question,verdict:m.verdict } });
      }
      const reply = await ollama(MODEL_FAST, DEVIL_SYS, msg, false);
      return J(res,200,{ mode:"devil", reply });
    }

    // サマリーの web ページ（印刷=PDF対応）
    if (url.startsWith("/r/")) {
      const token = url.slice(3);
      const row = qGet.get(token);
      if (!row) { res.writeHead(404,{"content-type":"text/html; charset=utf-8"}); return res.end("<p>見つかりません</p>"); }
      res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
      return res.end(renderPage(row));
    }
    J(res,404,{error:"not_found"});
  } catch (e) { J(res,500,{error:"internal", detail:String(e.message||e)}); }
});
server.listen(PORT, ()=>console.log(`minutes engine on :${PORT}  deep=${MODEL_DEEP} fast=${MODEL_FAST} dry_run=${DRY_RUN}`));

// ── レンダリング ─────────────────────────────────────────
function minutesRows(m){
  const N={ceo:"CEO",cmo:"CMO",cto:"CTO",coo:"COO",cfo:"CFO"};
  let r=Object.keys(N).map(k=>`<div class="m"><span class="who">${N[k]}</span><span>${esc(m[k])}</span></div>`).join("");
  r+=`<div class="m dv"><span class="who">悪魔</span><span>${esc(m.devil_question)}</span></div>`;
  return r;
}
function renderPage(row){
  const m = row.minutes_json ? JSON.parse(row.minutes_json) : null;
  const pending = row.status!=="done";
  const inner = pending
    ? `<p class="pending">役員会、まだ審議中です。少し時間をおいて、もう一度ひらいてください。</p>`
    : `<p class="agenda">議題 ── ${esc(m.agenda)}</p>
       <div class="minutes">${minutesRows(m)}</div>
       <div class="verdict">本日の決定 ── <b>${esc(m.verdict)}</b></div>
       <p class="decision">${esc(m.decision)}</p>
       <p class="note"><em>${esc(m.chair_note)}</em></p>`;
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>臨時取締役会の議事録 ── あなたの件について</title><style>
@page{margin:18mm}
body{margin:0;background:#14110f;color:#ece6dd;font-family:"Hiragino Mincho ProN","Yu Mincho",serif;line-height:1.9}
.wrap{max-width:640px;margin:0 auto;padding:48px 22px 80px}
.eyebrow{font-family:system-ui,sans-serif;font-size:12px;letter-spacing:.3em;color:#9a9088;text-align:center;margin:0 0 12px}
h1{text-align:center;font-size:26px;font-weight:600;margin:0 0 4px}
.sub{text-align:center;color:#9a9088;font-size:13px;margin:0 0 34px}
.agenda{font-size:18px;border-left:2px solid #c0392b;padding-left:16px;margin:0 0 26px}
.minutes{border:1px solid #322c27;border-radius:12px;overflow:hidden;margin:0 0 18px}
.m{display:grid;grid-template-columns:60px 1fr;gap:0;padding:13px 16px;border-bottom:1px solid #322c27;background:#1b1714}
.m:last-child{border-bottom:0}.m.dv{background:#1f1512}
.who{font-family:system-ui,sans-serif;font-size:11px;color:#9a9088;letter-spacing:.1em;padding-top:4px}
.m.dv .who{color:#c0392b}
.verdict{text-align:center;font-family:system-ui,sans-serif;letter-spacing:.2em;padding:14px;background:#0f0c0a;border-radius:10px}
.verdict b{color:#c0392b;font-size:18px}
.decision{font-size:17px;text-align:center;margin:24px 0 6px}
.note{color:#b8aea3;text-align:center}
.pending{color:#9a9088;text-align:center;font-style:italic;padding:40px 0}
.foot{margin-top:48px;text-align:center;color:#9a9088;font-size:12px;line-height:2}
.foot a{color:#f3ede2;text-decoration:none}
.print{display:inline-block;margin-top:8px;font-family:system-ui,sans-serif;font-size:13px;color:#9a9088;cursor:pointer;background:none;border:1px solid #322c27;border-radius:8px;padding:8px 14px}
@media print{body{background:#fff;color:#111}.m,.m.dv{background:#fafafa}.verdict{background:#f0f0f0}.foot,.print{display:none}}
</style></head><body><div class="wrap">
<p class="eyebrow">EXTRAORDINARY BOARD MEETING ・ 臨時取締役会</p>
<h1>あなたの件について</h1>
<p class="sub">『6人の役員と1匹の悪魔』取締役会 ／ ${esc((row.created||"").slice(0,10))}</p>
${inner}
<div class="foot">
 <button class="print" onclick="print()">この議事録を PDF で保存</button><br><br>
 <a href="https://devil.pub">devil.pub</a> ・ 本文（全文無料）／ 発行 Atsume Press
</div></div></body></html>`;
}
function renderEmail(m, url){
  const N={ceo:"CEO",cmo:"CMO",cto:"CTO",coo:"COO",cfo:"CFO"};
  const rows=Object.keys(N).map(k=>`<tr><td style="color:#888;font-size:12px;padding:8px 12px;vertical-align:top">${N[k]}</td><td style="padding:8px 12px">${esc(m[k])}</td></tr>`).join("")
    +`<tr><td style="color:#c0392b;font-size:12px;padding:8px 12px;vertical-align:top">悪魔</td><td style="padding:8px 12px">${esc(m.devil_question)}</td></tr>`;
  return `<div style="background:#14110f;color:#ece6dd;font-family:'Hiragino Mincho ProN',serif;padding:32px">
<div style="max-width:560px;margin:0 auto">
<p style="font-family:sans-serif;font-size:11px;letter-spacing:.3em;color:#9a9088;text-align:center">臨時取締役会・議事録</p>
<h1 style="text-align:center;font-weight:600">あなたの件について</h1>
<p style="border-left:2px solid #c0392b;padding-left:14px">議題 ── ${esc(m.agenda)}</p>
<table style="width:100%;border:1px solid #322c27;border-collapse:collapse;background:#1b1714">${rows}</table>
<p style="text-align:center;font-family:sans-serif;letter-spacing:.2em;margin-top:20px">本日の決定 ── <b style="color:#c0392b">${esc(m.verdict)}</b></p>
<p style="text-align:center;font-size:17px">${esc(m.decision)}</p>
<p style="text-align:center;color:#b8aea3"><em>${esc(m.chair_note)}</em></p>
<p style="text-align:center;margin-top:28px"><a href="${url}" style="color:#f3ede2">議事録をひらく（PDF保存も）</a></p>
<p style="text-align:center;color:#9a9088;font-size:12px;margin-top:28px">『6人の役員と1匹の悪魔』 ／ 本文は <a href="https://devil.pub" style="color:#9a9088">devil.pub</a> で全文無料。<br>このメールは、あなたが議題を預けたときだけ届きます。</p>
</div></div>`;
}
