/* あなたの議事録 ── 本の冒頭で議題を預け、後半で取締役会が応える。
   LLM はエンジン(M5)側。ここは UI と橋渡しのみ。token は localStorage に保持。 */
(function () {
  var BASE = (window.ENGINE_BASE || "").replace(/\/$/, "");
  var KEY = "board_minutes_token";
  var POLL = null;

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s){ return String(s||"").replace(/[<>&]/g,function(m){return{"<":"&lt;",">":"&gt;","&":"&amp;"}[m];}); }
  function $(sel){ return document.querySelector(sel); }

  // ── スタイル（本のトーンに馴染ませる）──
  var css = document.createElement("style");
  css.textContent = [
    ".ym{margin:34px 0;padding:22px 20px;border:1px solid var(--rule,#e3ddd2);border-radius:14px;background:rgba(192,57,43,.025)}",
    ".ym h4{margin:0 0 4px;font-size:18px;letter-spacing:.02em}",
    ".ym p.k{margin:.2em 0 14px;color:#8a8076;font-size:14px;line-height:1.7}",
    ".ym textarea{width:100%;box-sizing:border-box;min-height:76px;padding:12px;border:1px solid var(--rule,#ddd);border-radius:10px;font:inherit;font-size:16px;line-height:1.7;resize:vertical}",
    ".ym input{width:100%;box-sizing:border-box;margin-top:10px;padding:12px;border:1px solid var(--rule,#ddd);border-radius:10px;font:inherit;font-size:16px}",
    ".ym button{margin-top:12px;width:100%;cursor:pointer;font-family:system-ui,sans-serif;font-size:15px;font-weight:600;color:#fff;background:#c0392b;border:0;border-radius:10px;padding:13px}",
    ".ym button:disabled{opacity:.5;cursor:wait}",
    ".ym .small{font-family:system-ui,sans-serif;font-size:12px;color:#9a9088;margin-top:10px;line-height:1.7}",
    ".ym-mins{margin:34px 0;padding:24px 20px;border:1px solid var(--rule,#e3ddd2);border-radius:14px;background:#1b1714;color:#ece6dd;animation:ymf .8s ease both}",
    ".ym-mins .eb{font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.3em;color:#c0392b;text-align:center;margin:0 0 8px}",
    ".ym-mins h3{text-align:center;margin:0 0 18px;font-weight:600}",
    ".ym-mins .ag{border-left:2px solid #c0392b;padding-left:14px;margin:0 0 18px}",
    ".ym-mins .m{display:grid;grid-template-columns:56px 1fr;padding:11px 13px;border:1px solid #322c27;border-bottom:0;background:#191512}",
    ".ym-mins .m:last-of-type{border-bottom:1px solid #322c27}.ym-mins .m.dv{background:#1f1512}",
    ".ym-mins .who{font-family:system-ui,sans-serif;font-size:11px;color:#9a9088;letter-spacing:.1em;padding-top:3px}.ym-mins .m.dv .who{color:#c0392b}",
    ".ym-mins .vd{text-align:center;font-family:system-ui,sans-serif;letter-spacing:.2em;padding:13px;background:#0f0c0a;margin-top:2px;border-radius:0 0 8px 8px}.ym-mins .vd b{color:#c0392b;font-size:17px}",
    ".ym-mins .dc{text-align:center;font-size:17px;margin:20px 0 4px}.ym-mins .nt{text-align:center;color:#b8aea3}",
    ".ym-mins a.lnk{color:#f3ede2}",
    ".ym-pending{color:#9a9088;font-style:italic;text-align:center;padding:18px 0}",
    "@keyframes ymf{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
    "@media(prefers-reduced-motion:reduce){.ym-mins{animation:none}}"
  ].join("\n");
  document.head.appendChild(css);

  // ── 1) 冒頭（はじめに の後）に議題フォーム ──
  function mountIntake() {
    if (!BASE) return;
    var anchor = document.getElementById("はじめに") || document.getElementById("プロローグ-ある日曜日椅子は-7-脚あった");
    if (!anchor) return;
    if (localStorage.getItem(KEY)) return; // 既に預けている人には出さない
    var box = el(
      '<aside class="ym">' +
      '<h4>七脚目の椅子に、あなたの議題を</h4>' +
      '<p class="k">いま迷っていることを、ひとつ。読み進めて<b>後半に差しかかる頃</b>、この本の取締役会があなたの件について臨時会を開き、議事録をここに書き、メールでも届けます。</p>' +
      '<textarea id="ymw" maxlength="1200" placeholder="例：新しい案件、面白そうで受けたい。でも今すでに手一杯。"></textarea>' +
      '<input id="yme" type="email" placeholder="議事録を受け取るメール（任意）" />' +
      '<button id="ymb" type="button">議題を、預ける</button>' +
      '<p class="small">※ 本文は全文無料。これは「あなたの悩み」に本が応える機能です。メールは議事録の送付にのみ使い、預けたときだけ届きます。</p>' +
      '</aside>'
    );
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
    box.querySelector("#ymb").addEventListener("click", submit);
  }

  function submit() {
    var w = ($("#ymw").value || "").trim();
    if (!w) { $("#ymw").focus(); return; }
    var email = ($("#yme").value || "").trim();
    var b = $("#ymb"); b.disabled = true; b.textContent = "役員会を招集中…";
    fetch(BASE + "/api/intake", { method:"POST", headers:{"content-type":"application/json"},
      body: JSON.stringify({ worry:w, email:email }) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!j.token) throw new Error(j.error||"err");
        localStorage.setItem(KEY, j.token);
        var aside = b.closest(".ym");
        aside.innerHTML = '<h4>議題を、預かりました</h4><p class="k">取締役会が審議に入りました。本を読み進めて、<b>エピローグの手前</b>まで来てください。そこに、あなたの件の議事録が出ています。'+(email?'同じものをメールにもお送りします。':'')+'</p>';
        startPoll();
      })
      .catch(function(){ b.disabled=false; b.textContent="もう一度、預ける"; });
  }

  // ── 2) 後半（エピローグの前）に議事録プレースホルダ ──
  function mountSummarySlot() {
    var ep = document.getElementById("エピローグ-椅子は7-脚あっていい");
    if (!ep || document.getElementById("ym-slot")) return null;
    var slot = el('<section id="ym-slot" class="level2"></section>');
    ep.parentNode.insertBefore(slot, ep);
    return slot;
  }

  function renderMinutes(m) {
    var N = { ceo:"CEO", cmo:"CMO", cto:"CTO", coo:"COO", cfo:"CFO" };
    var rows = Object.keys(N).map(function(k){
      return '<div class="m"><span class="who">'+N[k]+'</span><span>'+esc(m[k])+'</span></div>'; }).join("");
    rows += '<div class="m dv"><span class="who">悪魔</span><span>'+esc(m.devil_question)+'</span></div>';
    var token = localStorage.getItem(KEY);
    return '<div class="ym-mins">' +
      '<p class="eb">EXTRAORDINARY BOARD MEETING ・ 臨時取締役会</p>' +
      '<h3>あなたの件について</h3>' +
      '<p class="ag">議題 ── '+esc(m.agenda)+'</p>' + rows +
      '<div class="vd">本日の決定 ── <b>'+esc(m.verdict)+'</b></div>' +
      '<p class="dc">'+esc(m.decision)+'</p>' +
      '<p class="nt"><em>'+esc(m.chair_note)+'</em></p>' +
      '<p style="text-align:center"><a class="lnk" href="'+BASE+'/r/'+esc(token)+'">この議事録をひらく（PDF保存）</a></p>' +
      '</div>';
  }

  function showSummary(m) {
    var slot = document.getElementById("ym-slot") || mountSummarySlot();
    if (slot) slot.innerHTML = renderMinutes(m);
  }

  function startPoll() {
    var token = localStorage.getItem(KEY);
    if (!token || !BASE) return;
    if (POLL) clearInterval(POLL);
    var tick = function () {
      fetch(BASE + "/r/" + token + ".json").then(function(r){ return r.json(); })
        .then(function(j){
          if (j.status === "done" && j.minutes) { clearInterval(POLL); POLL=null; showSummary(j.minutes); }
        }).catch(function(){});
    };
    tick();
    POLL = setInterval(tick, 8000);
  }

  function init() {
    mountIntake();
    if (localStorage.getItem(KEY)) { mountSummarySlot(); startPoll(); }
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
