/* 大屏端：状态机 + 占用控制 + 内容安全 + 统计。
   一轮 = 点「点击开始」（或输入取号码）到回到待机。 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var cfg = effectiveCfg();
  var lang = cfg.lang;
  var ORDER = ["idle", "persona", "style", "input", "gen", "result"];
  var ACTIVE = { persona: 1, style: 1, input: 1 };           // 会弹「还在吗」的屏
  var HINT = { persona: 15, style: 10, input: 25 };           // 每步建议时长（秒），超过就轻推「下一步」

  var round = null;            // 当前这一轮
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* 后台参数 + 高峰模式修正 */
  function effectiveCfg() {
    var c = SF.settings();
    if (c.peakMode) { c.roundSec = Math.min(c.roundSec, 60); c.rerollMax = 0; }
    return c;
  }

  /* ---------- 缩放 ----------
     真机模式（窗口本身是竖的，或网址带 ?kiosk=1）：屏幕 1080×1920 铺满窗口。
     电脑演示：整台立式机（1300×2450，含外壳）按窗口高度缩放，居中，两侧放说明。 */
  var kiosk = $("kiosk"), slot = $("kioskSlot");
  function fit() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var real = /[?&]kiosk=1/.test(location.search) || vw / vh < 0.75;
    document.body.classList.toggle("real", real);
    var w = real ? 1080 : 1300, h = real ? 1920 : 2450;
    var k = real ? Math.min(vw / w, vh / h) : Math.min((vh - 40) / h, (vw - 32) / w);
    kiosk.style.transform = "scale(" + k + ")";
    slot.style.width = w * k + "px"; slot.style.height = h * k + "px";
    document.body.classList.toggle("narrow", !real && vw - w * k < 560);
    if (SF.scene) SF.scene.resize();
  }
  window.addEventListener("resize", fit); fit();
  if (SF.scene) SF.scene.start();

  /* ---------- 两侧说明：跟着当前屏变 ---------- */
  var SIDE = {
    idle:    ["未开始", "待机轮播", "轮播示例海报，吸引路过的人。有人排队时，底部显示排队人数。"],
    persona: ["1 / 4", "选音乐人格", "6 个人格对应 6 种口味。选了人格，就选了海报的品牌色。"],
    style:   ["2 / 4", "选视觉风格", "每张缩略图都是用刚选的人格实时画的，所见即所得。"],
    input:   ["3 / 4", "写一句话", "文字只进排版，不进 AI 提示词。含导流信息或敏感词会被拦下。"],
    gen:     ["4 / 4", "生成中", "原型用 canvas 按人格、风格和随机种子画图，不调用付费接口。"],
    result:  ["完成", "扫码带走", "二维码打开手机分享页，按种子重画同一张。换一张每轮只有 1 次。"]
  };
  function updateSide(name) {
    var d = SIDE[name]; if (!d) return;
    $("sideStep").textContent = d[0]; $("sideName").textContent = d[1]; $("sideDesc").textContent = d[2];
    $("sideTimer").hidden = name === "idle";
    $("sideRound").textContent = cfg.roundSec;
  }
  function sideModal(step, name, desc) { $("sideStep").textContent = step; $("sideName").textContent = name; $("sideDesc").textContent = desc; }

  /* ---------- 文案 ---------- */
  function t(key, vars) {
    var s = (SF.T[lang] && SF.T[lang][key]) || SF.T.zh[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }
  function applyText() {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-t]").forEach(function (el) {
      var vars = el.dataset.n === "queue" ? { n: SF.queueCount() } : null;
      el.textContent = t(el.dataset.t, vars);
    });
    document.querySelectorAll(".lang-toggle button").forEach(function (b) { b.classList.toggle("on", b.dataset.lang === lang); });
  }
  function refreshQueue() {
    document.querySelectorAll('[data-n="queue"]').forEach(function (el) { el.textContent = t(el.dataset.t, { n: SF.queueCount() }); });
  }

  /* ---------- 切屏 ---------- */
  var screenAt = 0;
  function go(name) {
    stage.dataset.screen = name;
    screenAt = Date.now();
    clearInterval(fanTimer); genTimers.forEach(clearTimeout); cancelAnimationFrame(genRaf); // 离开当前屏就停掉它的动画和定时跳转
    $("nextBtn").classList.remove("nudge");
    refreshQueue();
    updateSide(name);
    var step = ORDER.indexOf(name);
    document.querySelectorAll(".steps i").forEach(function (el, i) { el.classList.toggle("on", i < Math.min(step, 4)); });
    if (name === "idle") enterIdle();
    if (name === "persona") renderPersonas();
    if (name === "style") renderStyles();
    if (name === "input") enterInput();
    if (name === "gen") enterGen();
    if (name === "result") enterResult();
    updateNext();
    tick();
  }

  /* ---------- 一轮的开始和结束 ---------- */
  function startRound(fromCode) {
    cfg = effectiveCfg();
    round = { p: null, s: null, n: "", t: "", h: false, seed: SF.newSeed(), rerolls: 0, no: 0, startedAt: Date.now(), fromCode: !!fromCode, counted: false };
    lastAct = Date.now();
    SF.bump(function (s) { s.rounds++; if (fromCode) s.fromCode++; });
  }
  function endRound(kind) {
    if (round) {
      var sec = Math.round((Date.now() - round.startedAt) / 1000);
      SF.bump(function (s) { s.occupySum += sec; s.occupyN = (s.occupyN || 0) + 1; if (kind === "timeout") s.timeouts = (s.timeouts || 0) + 1; if (kind === "idle") s.idleOuts = (s.idleOuts || 0) + 1; });
    }
    round = null;
    $("stillModal").hidden = true;
    go("idle");
  }

  /* ---------- 计时器：本轮倒计时、结果页倒计时、空闲检测、步骤轻推 ---------- */
  var lastAct = Date.now(), stillUntil = 0, resultUntil = 0;
  ["pointerdown", "keydown", "input"].forEach(function (ev) {
    document.addEventListener(ev, function () {
      lastAct = Date.now();
      if (!$("stillModal").hidden && ev === "pointerdown") { $("stillModal").hidden = true; updateSide(stage.dataset.screen); }
    }, true);
  });

  var RING = 213.6;
  function setRing(left, total) {
    var sec = Math.max(0, Math.ceil(left / 1000));
    $("timerNum").textContent = sec;
    $("timerFill").style.strokeDashoffset = RING * (1 - Math.max(0, left) / (total * 1000));
    $("timer").classList.toggle("warn", sec <= 15 && stage.dataset.screen !== "result");
  }

  function tick() {
    var now = Date.now(), s = stage.dataset.screen;
    if (!round || s === "idle") return;

    if (s === "result") {
      var left = resultUntil - now;
      setRing(left, resultTotal);
      $("resultBack").textContent = t("backIn", { n: Math.max(0, Math.ceil(left / 1000)) });
      if (left <= 0) endRound("done");
      return;
    }

    var remain = round.startedAt + cfg.roundSec * 1000 - now;
    setRing(remain, cfg.roundSec);
    if (remain <= 0 && s !== "gen") return endRound("timeout"); // 生成中不打断，出图后进结果页保底扫码

    if (ACTIVE[s]) {
      if ($("stillModal").hidden && now - lastAct >= cfg.idleSec * 1000) {
        $("stillModal").hidden = false; stillUntil = now + cfg.stillThereSec * 1000;
        sideModal("空闲检测", "还在吗？", cfg.idleSec + " 秒没操作就问一句，再 " + cfg.stillThereSec + " 秒没反应就回首页，把屏让给下一位。");
      }
      if (!$("stillModal").hidden) {
        var sl = stillUntil - now;
        $("stillSub").textContent = t("stillThereSub", { n: Math.max(0, Math.ceil(sl / 1000)) });
        if (sl <= 0) return endRound("idle");
      }
      if (now - screenAt > HINT[s] * 1000 && !$("nextBtn").disabled) $("nextBtn").classList.add("nudge");
    }
  }
  setInterval(tick, 250);
  setInterval(refreshQueue, 2000);
  window.addEventListener("storage", function () { refreshQueue(); if (!round) cfg = effectiveCfg(); });

  /* ---------- S0 待机 ---------- */
  var fanTimer = null, fanIdx = 0;
  var SAMPLES = [ // 待机只轮播运营预置的示例，不轮播真实用户作品
    { p: "rock", s: "pop", n: "阿野", t: "今晚嗓子不要了", seed: 11 },
    { p: "edm", s: "neon", n: "Kiki", t: "天亮之前不回家", seed: 22 },
    { p: "folk", s: "riso", n: "小满", t: "把晚风写进歌里", seed: 33 },
    { p: "jazz", s: "swiss", n: "老周", t: "今晚适合即兴", seed: 44 },
    { p: "indie", s: "riso", n: "moon", t: "在人群里做自己", seed: 55 },
    { p: "hiphop", s: "pop", n: "Z哥", t: "麦克风给我", seed: 66 }
  ];
  var fanReady = Promise.resolve();
  function enterIdle() {
    cfg = effectiveCfg();
    stage.classList.toggle("peak", !!cfg.peakMode);
    drawFan();
    if (!reduceMotion) fanTimer = setInterval(function () { fanIdx = (fanIdx + 1) % SAMPLES.length; drawFan(); }, 4000);
    renderQr($("queueQr"), pageUrl("prefill.html") + (lang === "en" ? "?lang=en" : ""));
    if (!preloaded) { preloaded = true; setTimeout(SF.preloadAllThumbs, 1500); } // 首屏画完再在后台拿其余缩略图
  }
  var preloaded = false;
  function drawFan() {
    var cs = $("idleFan").querySelectorAll("canvas"), jobs = [];
    [1, 2, 0].forEach(function (off, i) {
      var sm = SAMPLES[(fanIdx + off) % SAMPLES.length];
      jobs.push(SF.renderPoster(cs[i], Object.assign({ no: 400 + ((fanIdx + off) % SAMPLES.length) }, sm), { lang: lang, scale: 0.5 }));
    });
    fanReady = Promise.all(jobs);
    var front = SF.persona(SAMPLES[fanIdx].p);
    $("idleBg").style.background = "radial-gradient(900px 900px at 50% 30%, " + front.c1 + "55, transparent 70%)";
  }

  /* ---------- S1 选人格 ---------- */
  function renderPersonas() {
    var g = $("personaGrid"); g.innerHTML = "";
    SF.PERSONAS.forEach(function (p) {
      var b = document.createElement("button");
      b.className = "p-card" + (round.p === p.id ? " sel" : "");
      b.style.background = p.c1;
      b.style.color = SF.isLight(p.c1) ? "#141414" : "#f3f3ef";
      b.innerHTML =
        '<span class="p-name">' + (lang === "en" ? p.en : p.zh) + '</span>' +
        '<span class="p-en dot">' + (lang === "en" ? p.zh : p.en) + '</span>' +
        '<span class="p-motto">' + (lang === "en" ? p.mottoEn : p.mottoZh) + '</span>' +
        '<span class="p-flavor">' + (lang === "en" ? p.flavorEn : p.flavorZh + "味") + '</span>' +
        '<span class="p-check"><span class="ico" data-icon="check"></span></span>';
      b.onclick = function () { round.p = p.id; SF.preloadPersona(p.id); renderPersonas(); updateNext(); };
      g.appendChild(b);
    });
    renderIcons(g);
  }

  /* ---------- S2 选风格：缩略图用刚选的人格实时画 ---------- */
  function renderStyles() {
    var row = $("styleRow"); row.innerHTML = "";
    SF.STYLES.forEach(function (s, i) {
      var b = document.createElement("button");
      b.className = "s-card" + (round.s === s.id ? " sel" : "");
      var c = document.createElement("canvas");
      var d = { p: round.p, s: s.id, seed: round.seed, n: "", t: "", no: 0 };
      setTimeout(function () { SF.renderPoster(c, d, { lang: lang, scale: 0.5 }); }, i * 40); // 4 张错开画，不挤在同一瞬间
      b.appendChild(c);
      var name = document.createElement("span"); name.className = "s-name"; name.textContent = lang === "en" ? s.en : s.zh;
      b.appendChild(name);
      b.onclick = function () { round.s = s.id; SF.preloadFull(round.p, s.id); row.querySelectorAll(".s-card").forEach(function (x) { x.classList.toggle("sel", x === b); }); updateNext(); };
      row.appendChild(b);
    });
  }

  /* ---------- S3 输入 ---------- */
  function enterInput() {
    var p = SF.persona(round.p);
    $("nickInput").value = round.n; $("lineInput").value = round.t; $("hideNick").checked = round.h;
    var box = $("presets"); box.innerHTML = ""; box.classList.remove("hint");
    (lang === "en" ? p.linesEn : p.linesZh).forEach(function (line) {
      var b = document.createElement("button"); b.textContent = line;
      b.onclick = function () { $("lineInput").value = line; onInput(); };
      box.appendChild(b);
    });
    clearError();
    onInput();
  }
  var previewRaf = 0;
  function onInput() {
    round.n = $("nickInput").value; round.t = $("lineInput").value; round.h = $("hideNick").checked;
    var nu = SF.textUnits(round.n.trim()), lu = SF.textUnits(round.t.trim());
    $("nickCount").textContent = Math.ceil(nu) + "/" + SF.LIMITS.nick;
    $("lineCount").textContent = Math.ceil(lu) + "/" + SF.LIMITS.line;
    $("nickCount").classList.toggle("over", nu > SF.LIMITS.nick);
    $("lineCount").classList.toggle("over", lu > SF.LIMITS.line);
    clearError();
    cancelAnimationFrame(previewRaf);
    previewRaf = requestAnimationFrame(function () { // 公共大屏：没过审的文字在预览里用省略号代替，不上屏
      var shown = Object.assign({}, round);
      var r = SF.checkText(round.n || "x", round.t || "x");
      if (!r.ok && r.reason !== "length" && r.reason !== "empty") shown[r.field === "nick" ? "n" : "t"] = "…";
      SF.renderPoster($("previewCanvas"), shown, { lang: lang, hideNick: false, scale: 0.5 });
    });
    updateNext();
  }
  function clearError() {
    $("inputError").textContent = "";
    $("nickInput").classList.remove("bad"); $("lineInput").classList.remove("bad");
  }
  ["nickInput", "lineInput"].forEach(function (id) { $(id).addEventListener("input", onInput); });
  $("hideNick").addEventListener("change", onInput);

  /* ---------- S4 生成中：成品海报按像素方块拼出来 ---------- */
  var genTimers = [], genRaf = 0, genPoster = null; // genPoster：生成动画里画好的那张，结果页直接复用
  function enterGen() {
    genTimers = [];
    if (!round.counted) { // 每轮只统计一次出图
      round.counted = true;
      SF.bump(function (s) { s.done++; s.persona[round.p] = (s.persona[round.p] || 0) + 1; s.style[round.s] = (s.style[round.s] || 0) + 1; });
    }
    [t("gen1"), t("gen2"), t("gen3")].forEach(function (l, i) { genTimers.push(setTimeout(function () { $("genText").textContent = l; }, i * 1150)); });
    var off = document.createElement("canvas");
    var cv = $("genCanvas"), ctx = cv.getContext("2d");
    ctx.fillStyle = "#0c0c0d"; ctx.fillRect(0, 0, cv.width, cv.height);
    var mine = round, seed = round.seed;
    genPoster = null;
    // 先让生成画面显示出来，下一帧再画整张高清海报，点下去立刻有反应
    genTimers.push(setTimeout(function () {
      SF.renderPoster(off, round, { lang: lang, hideNick: round.h || !cfg.showNickOnScreen, mystery: t("mysteryFan") }).then(function () {
        if (round !== mine || stage.dataset.screen !== "gen") return;
        genPoster = { canvas: off, seed: seed, lang: lang };
        reveal(off, cv, ctx);
      });
    }, 60));
    genTimers.push(setTimeout(function () { go("result"); }, 3600));
  }
  function reveal(off, cv, ctx) {
    var B = 60, cols = Math.ceil(cv.width / B), rows = Math.ceil(cv.height / B), cells = [];
    for (var i = 0; i < cols * rows; i++) cells.push(i);
    for (var j = cells.length - 1; j > 0; j--) { var k = Math.floor(Math.random() * (j + 1)), tmp = cells[j]; cells[j] = cells[k]; cells[k] = tmp; }
    var DUR = 3000, t0 = performance.now(), drawn = 0;
    function frame(now) {
      var target = reduceMotion ? cells.length : Math.min(cells.length, Math.floor(Math.pow((now - t0) / DUR, 1.4) * cells.length));
      for (; drawn < target; drawn++) {
        var c = cells[drawn], x = (c % cols) * B, y = Math.floor(c / cols) * B;
        ctx.drawImage(off, x, y, B, B, x, y, B, B);
      }
      if (drawn < cells.length) genRaf = requestAnimationFrame(frame);
    }
    genRaf = requestAnimationFrame(frame);
  }

  /* ---------- S5 结果 ---------- */
  var resultTotal = 20;
  function enterResult() {
    if (!round.no) round.no = SF.nextSerial();
    round.l = lang;
    var p = SF.persona(round.p);
    var rc = $("resultCanvas");
    if (genPoster && genPoster.seed === round.seed && genPoster.lang === lang) { // 复用生成时画好的海报，不再重画
      rc.width = genPoster.canvas.width; rc.height = genPoster.canvas.height;
      rc.getContext("2d").drawImage(genPoster.canvas, 0, 0); rc.classList.add("ready"); rc._seq = (rc._seq || 0) + 1;
    } else {
      SF.renderPoster(rc, round, { lang: lang, hideNick: round.h || !cfg.showNickOnScreen, mystery: t("mysteryFan") });
    }
    renderQr($("resultQr"), shareUrl());
    $("resultGift").innerHTML = t("s5Gift", { booth: "<b>" + (lang === "en" ? cfg.boothEn : cfg.boothZh) + "</b>", flavor: lang === "en" ? p.flavorEn : p.flavorZh });
    var used = round.rerolls >= cfg.rerollMax;
    $("rerollBtn").disabled = used;
    $("rerollLabel").textContent = used ? t("rerollUsed") : t("reroll");
    // 结果页停留：默认 resultStaySec；有人排队缩到 15 秒；不超过本轮剩余，但剩余不够时保底给够扫码时间
    var stay = SF.queueCount() > 0 ? Math.min(cfg.resultStaySec, 15) : cfg.resultStaySec;
    var remain = Math.max(0, (round.startedAt + cfg.roundSec * 1000 - Date.now()) / 1000);
    resultTotal = Math.max(Math.min(stay, remain), Math.min(cfg.resultMinSec, stay));
    resultUntil = Date.now() + resultTotal * 1000;
  }
  function shareHash() { return "#d=" + SF.encodeShare(round); }
  function shareUrl() { return (location.protocol === "file:" ? cfg.shareBase : pageUrl("share.html")) + shareHash(); }
  function pageUrl(file) {
    if (location.protocol === "file:") return cfg.shareBase.replace("share.html", file);
    return location.href.replace(/[^/]*([?#].*)?$/, "") + file;
  }
  function renderQr(el, url) {
    var q = qrcode(0, "M"); q.addData(url); q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  /* ---------- 底栏 ---------- */
  function updateNext() {
    var s = stage.dataset.screen, ok = false;
    if (!round) return;
    if (s === "persona") ok = !!round.p;
    if (s === "style") ok = !!round.s;
    if (s === "input") ok = round.n.trim() !== "" && round.t.trim() !== ""; // 能点，点了再审，审不过给提示
    $("nextBtn").disabled = !ok;
    $("nextLabel").textContent = s === "input" ? t("generate") : t("next");
  }
  $("nextBtn").onclick = function () {
    var s = stage.dataset.screen;
    if (s === "input") {
      var r = SF.checkText(round.n, round.t);
      if (!r.ok) {
        $("inputError").textContent = SF.blockMessage(r, lang);
        $(r.field === "nick" ? "nickInput" : "lineInput").classList.add("bad");
        if (r.field === "line") $("presets").classList.add("hint");
        if (r.reason !== "empty") SF.bump(function (st) { st.blocked[r.reason] = (st.blocked[r.reason] || 0) + 1; });
        return;
      }
      round.n = round.n.trim(); round.t = round.t.trim();
    }
    go(ORDER[ORDER.indexOf(s) + 1]);
  };
  $("backBtn").onclick = function () {
    var s = stage.dataset.screen;
    if (s === "persona") return endRound("exit");
    go(ORDER[ORDER.indexOf(s) - 1]);
  };
  $("randomBtn").onclick = function () {
    round.p = SF.PERSONAS[Math.floor(Math.random() * SF.PERSONAS.length)].id; SF.preloadPersona(round.p); renderPersonas(); updateNext();
  };
  $("exitBtn").onclick = function () { endRound("exit"); };
  $("startBtn").onclick = function () { startRound(false); go("persona"); };
  $("rerollBtn").onclick = function () {
    if (!round || round.rerolls >= cfg.rerollMax) return;
    round.rerolls++; round.seed = SF.newSeed(); round.no = 0;
    SF.bump(function (s) { s.rerolls++; });
    go("gen");
  };
  $("doneBtn").onclick = function () { endRound("done"); };
  $("openLocalBtn").onclick = function () { window.open("share.html" + shareHash(), "_blank", "width=430,height=900"); };

  /* ---------- 取号码 ---------- */
  var code = "";
  function renderCode() {
    $("codeSlots").querySelectorAll("i").forEach(function (el, i) { el.textContent = code[i] || ""; });
  }
  (function buildPad() {
    var pad = $("numpad");
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "go"].forEach(function (k) {
      var b = document.createElement("button");
      if (k === "del") { b.innerHTML = '<span class="ico" data-icon="backspace"></span>'; b.setAttribute("aria-label", "删除"); }
      else if (k === "go") { b.className = "go"; b.dataset.t = "codeGo"; }
      else b.textContent = k;
      b.onclick = function () {
        $("codeError").textContent = "";
        if (k === "del") code = code.slice(0, -1);
        else if (k === "go") return submitCode();
        else if (code.length < 4) code += k;
        renderCode();
      };
      pad.appendChild(b);
    });
  })();
  function submitCode() {
    if (code.length < 4) { $("codeError").textContent = lang === "en" ? "Enter all 4 digits" : "请输入 4 位数字"; return; }
    var e = SF.takeFromQueue(code);
    if (!e) { $("codeError").textContent = lang === "en" ? "Code not found" : "没找到这个号码"; code = ""; renderCode(); return; }
    var r = SF.checkText(e.n, e.t); // 手机端审过一次，大屏再审一次
    if (!r.ok) { $("codeError").textContent = SF.blockMessage(r, lang); return; }
    $("codeModal").hidden = true;
    startRound(true); Object.assign(round, { p: e.p, s: e.s, n: e.n, t: e.t, h: e.h });
    go("gen");
  }
  $("codeBtn").onclick = function () {
    code = ""; renderCode(); $("codeError").textContent = ""; $("codeModal").hidden = false;
    sideModal("扫码预填", "输入取号码", "排队时已经在手机上选好填好，输入 4 位号码直接出图，大屏只占 10 秒左右。");
  };
  $("codeClose").onclick = function () { $("codeModal").hidden = true; updateSide(stage.dataset.screen); };
  $("imHereBtn").onclick = function () { $("stillModal").hidden = true; lastAct = Date.now(); updateSide(stage.dataset.screen); };

  /* ---------- 语言 ---------- */
  document.querySelectorAll(".lang-toggle button").forEach(function (b) {
    b.onclick = function () { lang = b.dataset.lang; applyText(); drawFan(); renderQr($("queueQr"), pageUrl("prefill.html") + (lang === "en" ? "?lang=en" : "")); };
  });

  /* ---------- 隐藏入口：连点 logo 5 次进后台 ---------- */
  var taps = [];
  document.querySelectorAll("#stage .logo").forEach(function (el) {
    el.addEventListener("click", function () {
      var now = Date.now(); taps = taps.filter(function (x) { return now - x < 2000; }); taps.push(now);
      if (taps.length >= 5) location.href = "admin.html";
    });
  });

  document.querySelectorAll(".logo-mark").forEach(function (el) { el.innerHTML = SF.LOGO_SVG; });
  renderIcons();
  applyText();
  // 首次打开：外壳缩放好、首页三张海报画好之后再淡入，避免刷新时闪一下（最多等 1.5 秒）
  SF.fontsReady.then(function () {
    go("idle");
    Promise.race([fanReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
      requestAnimationFrame(function () { document.body.classList.remove("booting"); });
    });
  });
  SF._debug = { go: go, round: function () { return round; }, cfg: function () { return cfg; } };
})();
