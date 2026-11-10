/* 手机排队预填页：排队时在手机上选好填好，拿 4 位取号码 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  document.querySelectorAll(".logo-mark").forEach(function (el) { el.innerHTML = SF.LOGO_SVG; });
  var st = { step: 1, p: null, s: null, n: "", t: "", h: false, seed: SF.newSeed() };
  var qp = location.search.match(/[?&]p=([a-z]+)/); // 从分享页点朋友那一派的罐子过来：先替他选好
  if (qp && SF.persona(qp[1])) st.p = qp[1];
  var qf = location.search.match(/[?&]from=([A-Za-z0-9_-]+)/); // 谁邀请的：拿号后带去大屏，出图后分享页有你们俩的合拍卡
  if (qf) st.f = SF.decodeFrom(qf[1]);
  // 语言：网址带 ?lang=en（大屏英文模式的排队码、英文海报页的「我也做一张」）就用英文
  var L = /[?&]lang=en/.test(location.search) ? "en" : "zh", T = function (k, v) { return SF.mt(L, k, v); };
  SF.applyMT(L); document.title = T("pfTitle");

  function show(step) {
    st.step = step;
    document.querySelectorAll("[data-step]").forEach(function (el) { el.hidden = +el.dataset.step !== step; });
    document.querySelectorAll("#pfSteps i").forEach(function (el, i) { el.classList.toggle("on", i < step); });
    $("pfBack").hidden = !(step > 1 && step < 4); // 第 1 步没有返回，下一步占满整行
    $("pfFoot").hidden = step === 4;
    if (step === 1) renderPersonas();
    if (step === 2) renderStyles();
    if (step === 3) renderInput();
    update();
    window.scrollTo(0, 0);
  }

  function renderPersonas() {
    var box = $("pfPersonas"); box.innerHTML = "";
    SF.PERSONAS.forEach(function (p) {
      var b = document.createElement("button");
      b.className = "pf-item" + (st.p === p.id ? " sel" : "");
      b.style.background = p.c1; b.style.color = SF.isLight(p.c1) ? "#141414" : "#f3f3ef";
      b.innerHTML = "<b>" + (L === "en" ? p.en : p.zh) + "</b><span>" + (L === "en" ? p.mottoEn : p.mottoZh) + "</span>" +
        '<img class="pf-can" src="assets/brand/can-' + p.id + '-1.webp" alt="" decoding="async">';
      b.onclick = function () { st.p = p.id; SF.buzz(12); renderPersonas(); update(); };
      box.appendChild(b);
    });
  }
  function renderStyles() {
    var box = $("pfStyles"); box.innerHTML = "";
    SF.STYLES.forEach(function (s) {
      var b = document.createElement("button");
      b.className = "pf-style" + (st.s === s.id ? " sel" : "");
      var c = document.createElement("canvas");
      var pp = SF.persona(st.p); // 还没写一句话，先用这一派的宣言当示意句
      SF.renderPoster(c, { p: st.p, s: s.id, seed: st.seed, n: "", t: L === "en" ? pp.mottoEn : pp.mottoZh, no: 0 }, { scale: 0.5, lang: L });
      var desc = document.createElement("small"); desc.className = "pf-desc"; desc.textContent = L === "en" ? s.descEn : s.descZh;
      b.appendChild(c); b.appendChild(document.createTextNode(L === "en" ? s.en : s.zh)); b.appendChild(desc);
      b.onclick = function () { st.s = s.id; box.querySelectorAll(".pf-style").forEach(function (x) { x.classList.toggle("sel", x === b); }); update(); }; // 只切换选中框，不重画缩略图
      box.appendChild(b);
    });
  }
  function renderInput() {
    var box = $("pfPresets"); box.innerHTML = "";
    var pp = SF.persona(st.p); (L === "en" ? pp.linesEn : pp.linesZh).forEach(function (l) {
      var b = document.createElement("button"); b.textContent = l;
      b.onclick = function () { $("pfLine").value = l; onInput(); };
      box.appendChild(b);
    });
    $("pfNick").value = st.n; $("pfLine").value = st.t; $("pfHide").checked = st.h;
    onInput();
  }
  function onInput() {
    st.n = $("pfNick").value; st.t = $("pfLine").value; st.h = $("pfHide").checked;
    $("pfNickCount").textContent = Math.ceil(SF.textUnits(st.n.trim())) + "/8";
    $("pfLineCount").textContent = Math.ceil(SF.textUnits(st.t.trim())) + "/20";
    $("pfErr").textContent = "";
    update();
  }
  [["pfNick", "nick"], ["pfLine", "line"]].forEach(function (f) { // 和大屏一样，输入时就按字数截断，组字时不动
    var el = $(f[0]);
    var clamp = function () { if (SF.textUnits(el.value) > SF.LIMITS[f[1]]) el.value = SF.clampUnits(el.value, SF.LIMITS[f[1]]); };
    el.addEventListener("input", function (e) { if (!e.isComposing) clamp(); onInput(); });
    el.addEventListener("compositionend", function () { clamp(); onInput(); });
  });
  $("pfHide").addEventListener("change", onInput);

  function update() {
    var ok = st.step === 1 ? !!st.p : st.step === 2 ? !!st.s : (st.n.trim() !== "" && st.t.trim() !== "");
    $("pfNext").disabled = !ok;
    $("pfNext").textContent = st.step === 3 ? T("getCode") : T("next");
    $("pfHint").textContent = ok || st.step > 3 ? "" : T("hint" + st.step); // 按钮不能点时说清还差什么
  }
  $("pfNext").onclick = function () {
    if (st.step < 3) return show(st.step + 1);
    var r = SF.checkText(st.n, st.t);
    if (!r.ok) {
      $("pfErr").textContent = SF.blockMessage(r, L);
      if (r.reason !== "empty") SF.bump(function (s) { s.blocked[r.reason] = (s.blocked[r.reason] || 0) + 1; });
      return;
    }
    var code = SF.enqueue({ p: st.p, s: st.s, n: st.n.trim(), t: st.t.trim(), h: st.h, seed: st.seed, f: st.f || null }); // 带上种子，大屏印出来和预览是同一张
    $("pfCode").textContent = code;
    var ahead = SF.queueCount() - 1;
    $("pfWait").textContent = ahead > 0 ? T("wait", { n: ahead, m: Math.ceil(ahead * 0.75) }) : T("goNow");
    var pp = SF.persona(st.p), ss = SF.style(st.s); // 拿号页写清选了什么、领哪一罐
    $("pfPickCan").src = "assets/brand/can-" + pp.id + "-1.webp";
    $("pfPickName").textContent = L === "en" ? pp.en : pp.zh;
    $("pfPickStyle").textContent = L === "en" ? ss.en : ss.zh;
    $("pfPickGift").textContent = T("pickGift", { f: L === "en" ? pp.flavorEn : pp.flavorZh });
    SF.renderPoster($("pfPreview"), { p: st.p, s: st.s, seed: st.seed, n: st.n.trim(), t: st.t.trim(), no: 0 }, { scale: 0.5, lang: L });
    show(4);
  };
  $("pfBack").onclick = function () { show(Math.max(1, st.step - 1)); };

  if (st.f) { // 邀请条：谁邀请的、测完有什么
    var fp = SF.persona(st.f.p);
    $("pfInvite").hidden = false;
    $("pfInvite").textContent = T("invitedBy", { n: st.f.n, p: L === "en" ? fp.en : fp.zh });
  }
  renderIcons();
  show(1);
  requestAnimationFrame(function () { document.body.classList.remove("booting"); }); // 列表和按钮就绪后再露面，刷新不闪
})();
