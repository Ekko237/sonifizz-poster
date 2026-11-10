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

  /* 顶栏进度做成四段小声纹柱（每段 9 根，高低取自声纹） */
  document.querySelectorAll(".steps i").forEach(function (seg, si) {
    SF.voiceprint("SONIFIZZ" + si, 9).forEach(function (h, k) { var b = document.createElement("b"); b.style.setProperty("--h", (0.3 + h * 0.7).toFixed(2)); b.style.setProperty("--k", si * 9 + k); seg.appendChild(b); });
  });

  /* ---------- 按下的回应：声音、轻振、冒气泡 ---------- */
  function stagePoint(cx, cy) { // 窗口坐标换成大屏坐标（大屏整体缩放过）
    var r = stage.getBoundingClientRect(), k = r.width / stage.offsetWidth;
    return { x: (cx - r.left) / k, y: (cy - r.top) / k };
  }
  // 一串小气泡从 (x, y) 散开；up 为真时只往上冒（罐口冒泡），否则一圈散开（按钮破泡）
  function burst(x, y, n, spread, up, color) {
    if (reduceMotion) return;
    for (var i = 0; i < n; i++) (function () {
      var b = document.createElement("i"), r = 10 + Math.random() * 16;
      var ang = up ? -Math.PI * (0.2 + Math.random() * 0.6) : Math.random() * Math.PI * 2, dist = spread * (0.55 + Math.random() * 0.7);
      b.className = "fx-bubble";
      b.style.cssText = "left:" + (x - r) + "px;top:" + (y - r) + "px;width:" + 2 * r + "px;height:" + 2 * r + "px" + (color ? ";border-color:" + color : "");
      stage.appendChild(b);
      var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - (up ? spread * 0.4 : 0);
      b.animate([{ transform: "translate(0,0) scale(0.3)", opacity: 1 },
        { transform: "translate(" + dx * 0.7 + "px," + dy * 0.7 + "px) scale(0.9)", opacity: 0.9, offset: 0.55 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(1)", opacity: 0 }],
        { duration: 620 + Math.random() * 320, easing: "cubic-bezier(0.22,0.8,0.3,1)" }).onfinish = function () { b.remove(); };
    })();
  }
  // 每一下按都有回应：气泡破开的「啵」+ 手机轻振；主按钮外圈再散开一圈小气泡。人格卡有自己的招牌声
  stage.addEventListener("pointerdown", function (e) {
    var nb = $("nextBtn"), r = nb.getBoundingClientRect();
    if (nb.disabled && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { // 灰着的「下一步」被点：抖一下、低音一声、提示闪一下
      nb.classList.remove("nope"); void nb.offsetWidth; nb.classList.add("nope");
      if (stage.dataset.screen === "input") ["nickInput", "lineInput"].forEach(function (id) { // 写一句话页：哪个框还空着就标红抖一下
        var el = $(id); if (el.value.trim()) return;
        el.classList.add("bad"); el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
      });
      SF.sfx("error"); SF.buzz([18, 60, 18]);
      return;
    }
    var steps = document.querySelector(".steps"); steps.classList.remove("bump"); void steps.offsetWidth; steps.classList.add("bump"); // 每点一下进度柱跳一下
    var b = e.target.closest("button");
    if (!b || b.disabled || b.classList.contains("p-card") || b.id === "tapPad" || b.id === "randomBtn") return; // 鼓面每拍一下有自己的鼓声；随便来一个响的是选中那一派的招牌声
    var si = ORDER.indexOf(stage.dataset.screen);
    if (b.id === "nextBtn") SF.sfx("step", si);
    else if (b.id === "backBtn") SF.sfx("back", si);
    else if (b.id === "startBtn") SF.sfx("start");
    else if (b.id === "rerollBtn") SF.sfx("reroll");
    else if (b.id === "doneBtn") SF.sfx("done");
    else if (b.dataset.style) SF.sfx("style", b.dataset.style);
    else if (b.closest("#presets") && round) SF.sfx("note", { p: round.p, a: 0.7 });
    else if (b.closest("#numpad") && /^\d$/.test(b.textContent)) SF.sfx("digit", code.length);
    else SF.sfx("tap");
    SF.buzz(12);
    if (b.classList.contains("btn-primary")) { var q = stagePoint(e.clientX, e.clientY); burst(q.x, q.y, 10, 150, false); }
  });

  /* 后台参数 + 高峰模式修正 */
  function effectiveCfg() {
    var c = SF.settings();
    if (c.peakMode) { c.roundSec = Math.min(c.roundSec, 60); c.rerollMax = 0; }
    return c;
  }

  /* ---------- 缩放 ----------
     真机模式（窗口本身是竖的，或网址带 ?kiosk=1）：屏幕 1080×1920 铺满窗口。
     电脑演示：整台立式机（1220×2224，含外壳）按窗口高度缩放，居中，两侧放说明。 */
  var kiosk = $("kiosk"), slot = $("kioskSlot");
  var fitW = 0, fitH = 0;
  function fit() {
    var vw = window.innerWidth, vh = window.innerHeight;
    // 手机上弹出键盘只会让窗口变矮、宽度不变：这时不重新缩放，免得整块屏幕缩小
    if (document.body.classList.contains("phone") && vw === fitW && vh < fitH * 0.85) return;
    fitW = vw; fitH = vh;
    var real = /[?&]kiosk=1/.test(location.search) || vw / vh <= 0.75; // 竖着的平板（768×1024 正好 3:4）也按真机铺满
    var coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    document.body.classList.toggle("real", real);
    document.body.classList.toggle("kiosk", /[?&]kiosk=1/.test(location.search));
    document.body.classList.toggle("phone", real && !/[?&]kiosk=1/.test(location.search) && vw <= 600); // 手机上看演示：扫不了自己屏幕上的码
    document.body.classList.toggle("landscape-phone", !real && coarse && vh < 520);                   // 手机横着拿：提示竖过来
    // 手机竖着看：画面逻辑宽度按屏幕比例收窄（长屏手机约 900，短屏手机仍是 1080），同样的字和按钮在手机上大两成，高度至少 1920 铺满屏幕；
    // 平板和真机（?kiosk=1）固定 1080 宽
    var kioskParam = /[?&]kiosk=1/.test(location.search), phone = document.body.classList.contains("phone");
    var SW = phone ? Math.max(900, Math.min(1080, Math.round(1920 * vw / vh))) : 1080;
    var stageH = real && !kioskParam && vh / vw > 1920 / SW ? Math.min(2400, Math.round(SW * vh / vw)) : 1920;
    document.documentElement.style.setProperty("--sw", SW + "px");
    stage.style.height = stageH + "px"; stage.style.setProperty("--xh", stageH - 1920 + "px");
    kiosk.style.height = real ? stageH + "px" : "";
    var booth = !real && document.body.classList.contains("booth"); // 放大展位屏：电脑上只留屏幕
    var w = real || booth ? SW : 1220, h = real ? stageH : booth ? 1920 : 2224;
    var k = real ? Math.min(vw / w, vh / h) : Math.min((vh - 24) / h, (vw - 32) / w);
    kiosk.style.transform = "scale(" + k + ")";
    slot.style.width = w * k + "px"; slot.style.height = h * k + "px";
    document.body.classList.toggle("narrow", !real && vw - w * k < 560);
    document.body.classList.toggle("tight", !real && (vw - w * k) / 2 < 380); // 两侧太窄就不放手机
    if (SF.scene) SF.scene.resize();
    fitSides();
  }
  function fitSides() { // 窗口矮时两侧依次收起次要内容，保证整栏都在窗口里
    document.body.classList.remove("short1", "shortR", "short2");
    if (document.body.classList.contains("real")) return;
    var over = function (sel) { var el = document.querySelector(sel); return el.offsetTop + el.scrollHeight > window.innerHeight - 16; };
    if (over(".side-left")) document.body.classList.add("short1");  // 左栏放不下：先收起介绍文字
    if (over(".side-right")) document.body.classList.add("shortR"); // 右栏放不下：先收起小手机下面的说明
    if (over(".side-left") || over(".side-right")) document.body.classList.add("short2");
  }
  window.addEventListener("resize", fit); fit();
  if (SF.scene) SF.scene.start();

  /* ---------- 两侧说明：跟着当前屏和大屏语言变 ---------- */
  function D() { return SF.DEMO[lang] || SF.DEMO.zh; }
  function setSide(d) { $("sideStep").textContent = d[0]; $("sideName").textContent = d[1]; $("sideDesc").textContent = d[2]; }
  function updateSide(name) {
    var d = D().side[name]; if (!d) return;
    setSide(d);
    $("sideTimer").hidden = name === "idle";
    $("sideRound").textContent = D().round.replace("{n}", cfg.roundSec);
    fitSides();
  }
  function sideModal(key) {
    var d = D().side[key];
    setSide([d[0], d[1], d[2].replace("{idle}", cfg.idleSec).replace("{still}", cfg.stillThereSec)]);
  }
  function applyDemoText() {
    var d = D();
    $("demoTitle").textContent = d.title; $("demoText").textContent = d.text; $("demoNote").textContent = d.note; $("kPlate").textContent = d.plate;
    $("tourAskText").textContent = d.tourAsk; $("tourYesLabel").textContent = d.tour; $("tourNo").textContent = d.tourSkip;
    $("tourLabel").textContent = SF.tourSeen && SF.tourSeen() ? d.tourAgain : d.tour;
    $("demoLinks").setAttribute("aria-label", d.linksLabel);
    ["lnkShare", "lnkPrefill", "lnkAdmin"].forEach(function (id, i) { $(id).lastElementChild.textContent = d.links[i]; });
    var q = lang === "en" ? "?lang=en" : "";
    $("lnkPrefill").href = "prefill.html" + q;
    var sample = Object.assign({ no: 427, l: lang }, SAMPLES[1], lang === "en" ? { t: SAMPLES[1].te } : {}); // 示例海报的分享页
    $("lnkShare").href = "share.html#s=" + SF.encodeShort(sample);
    $("phoneFrame").title = lang === "en" ? "Page on the phone" : "手机上的页面";
  }

  /* ---------- 右侧的手机：待机时是排队预填页，出图后是扫码打开的分享页，其余步骤收起来 ---------- */
  var phoneSrc = "";
  $("phoneFrame").addEventListener("load", function () { this.classList.remove("loading"); });
  function phoneShow(name) {
    var src = "", cap = "";
    if (name === "idle") { src = "prefill.html?embed=1" + (lang === "en" ? "&lang=en" : ""); cap = D().phoneIdle; }
    if (name === "result" && round) { src = "share.html?embed=1&k=" + round.seed + "-" + round.no + shareHash(); cap = D().phoneResult; }
    $("sidePhone").classList.toggle("on", !!src);
    if (!src) return;
    $("phoneCap").textContent = cap;
    if (src !== phoneSrc) { phoneSrc = src; $("phoneFrame").classList.add("loading"); $("phoneFrame").src = src; }
  }

  /* ---------- 外壳跟着屏幕变：展示窗里亮起选中的那一罐，屏幕外沿和地面反光换成这一派的颜色 ----------
     选中的那一罐还会「倒汽」：走到第几步，罐身里就亮起几成人格色的液面；生成时跟屏幕里的液面一起涨满 */
  var cans = {}, FILL = { persona: 0.25, style: 0.5, input: 0.75, gen: 1, result: 1 };
  SF.PERSONAS.forEach(function (p) {
    var wrap = document.createElement("span"), img = document.createElement("img"), fill = document.createElement("span"), src = "assets/brand/can-" + p.id + "-1.webp";
    img.src = src; img.alt = ""; img.decoding = "async";
    fill.className = "k-fill"; // 罐身上一块人格色的液面，顶上一道亮线
    wrap.className = "k-can"; wrap.appendChild(img); wrap.appendChild(fill);
    $("kCans").appendChild(wrap); cans[p.id] = wrap;
  });
  function glowOf(p) { return SF.lum(p.c1) < 90 ? p.c2 : p.c1; } // 深色人格用第二色，光才看得见
  function tintFor(name) {
    var p = round && round.p ? SF.persona(round.p) : null;
    if (SF.scene) SF.scene.tint(name === "idle" || !p ? "#e2ff2e" : glowOf(p));
    stage.style.setProperty("--pc", name === "idle" || !p ? "rgba(0,0,0,0)" : p.c1);
    Object.keys(cans).forEach(function (id) {
      var on = !!p && name !== "idle" && id === p.id;
      cans[id].classList.toggle("on", on);
      cans[id].style.setProperty("--lvl", on ? FILL[name] || 0 : 0);
      cans[id].classList.toggle("pouring", on && name === "gen"); // 生成时液面慢慢涨满，和屏幕里倒汽同步
    });
  }

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
      var s = vars && vars.n === 0 ? t("queueNone") : t(el.dataset.t, vars);
      if (el.matches(".idle-title, .screen-title, .modal-title")) SF.setHead(el, s); else el.textContent = s;
    });
    document.querySelectorAll(".lang-toggle button").forEach(function (b) { b.classList.toggle("on", b.dataset.lang === lang); });
    $("backBtn").setAttribute("aria-label", t("back")); // 手机上这个按钮只留箭头
    applyDemoText();
    paintToday();
    fitSides();
    paintSound();
    updateSide(stage.dataset.screen);
    if (SF.tourLang) SF.tourLang();
  }
  function paintToday() { var n = SF.todayCount(); $("idleToday").textContent = n ? t(n === 1 ? "todayOne" : "today", { n: n }) : ""; } // 首页「今天已经印了几张」，切语言时跟着换
  function refreshQueue() { // 没人排队时顶栏不显示「排队 0 人」，首页写「现在不用排队」
    var n = SF.queueCount();
    document.querySelectorAll('[data-n="queue"]').forEach(function (el) { el.textContent = n ? t(el.dataset.t, { n: n }) : t("queueNone"); });
    document.querySelectorAll(".queue-chip").forEach(function (el) { el.hidden = !n; });
  }

  /* ---------- 切屏 ---------- */
  var screenAt = 0, sideTimer = 0;
  /* 点卡片选好以后 0.9 秒自动往下走：下一步按钮从左到右亮满；这期间改点别的卡就重新计时，点别的按钮或换屏就不走 */
  var autoTimer = 0;
  function autoNext() {
    clearTimeout(autoTimer);
    var nb = $("nextBtn"), from = stage.dataset.screen;
    nb.classList.remove("auto"); void nb.offsetWidth; nb.classList.add("auto");
    autoTimer = setTimeout(function () {
      nb.classList.remove("auto");
      if (stage.dataset.screen !== from || nb.disabled || !$("tapModal").hidden) return;
      SF.sfx("step", ORDER.indexOf(from)); nb.click();
    }, 900);
  }
  function cancelAuto() { clearTimeout(autoTimer); $("nextBtn").classList.remove("auto"); }
  function go(name) {
    cancelAuto();
    stage.dataset.dir = ORDER.indexOf(name) < ORDER.indexOf(stage.dataset.screen) ? "back" : "fwd";
    stage.dataset.screen = name;
    var hadFocus = document.activeElement && document.activeElement.tagName === "BUTTON";
    stage.querySelectorAll(".screen").forEach(function (sc) { sc.inert = sc.dataset.s !== name; }); // 看不见的屏不让键盘焦点跳进去
    if (hadFocus) { var first = stage.querySelector('.screen[data-s="' + name + '"] button:not([disabled])'); if (first) first.focus({ preventScroll: true }); } // 用键盘按的：焦点跟到新的一屏
    screenAt = Date.now(); beatSec = 0;
    $("tapModal").hidden = true; clearTimeout(tapTimer);
    clearInterval(fanTimer); genTimers.forEach(clearTimeout); cancelAnimationFrame(genRaf); // 离开当前屏就停掉它的动画和定时跳转
    $("nextBtn").classList.remove("nudge");
    document.body.classList.toggle("on-idle", name === "idle"); // 手机上版权行只在首页露出，别压住各屏底部的按钮
    refreshQueue();
    clearTimeout(sideTimer);
    if (name === "result") sideTimer = setTimeout(function () { updateSide(name); }, 350); // 等大屏淡入结果页再换侧栏
    else updateSide(name);
    tintFor(name);
    if (name !== "result") phoneShow(name);
    var step = ORDER.indexOf(name);
    document.querySelectorAll(".steps i").forEach(function (el, i) { el.classList.toggle("on", i < Math.min(step, 4)); });
    if (name === "idle") { clearTimeout(exitArmed); exitArmed = 0; $("exitBtn").classList.remove("armed"); enterIdle(); } // 回到首页：「再点一次退出」的状态不留到下一轮
    if (name === "persona") renderPersonas();
    if (name === "style") renderStyles();
    if (name === "input") enterInput();
    if (name === "gen") enterGen();
    if (name === "result") enterResult();
    updateNext();
    tick();
    changed();
  }
  function changed() { document.dispatchEvent(new Event("sf:change")); } // 新手指引跟着这个事件换下一步

  /* ---------- 一轮的开始和结束 ---------- */
  function startRound(fromCode) {
    cfg = effectiveCfg();
    round = { p: null, s: null, n: "", t: "", h: false, b: 0, vp: "", seed: SF.newSeed(), rerolls: 0, no: 0, startedAt: Date.now(), fromCode: !!fromCode, counted: false };
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
      if (ev === "pointerdown" && round && stage.dataset.screen === "result") { // 结果页点一下屏幕多留 15 秒，这一页最多停 60 秒
        resultUntil = Math.min(resultShownAt + 60000, Math.max(resultUntil, Date.now() + 15000));
        resultTotal = Math.max(resultTotal, (resultUntil - Date.now()) / 1000);
      }
    }, true);
  });

  var RING = 213.6;
  var beatSec = 0;
  function setRing(left, total) {
    var sec = Math.max(0, Math.ceil(left / 1000));
    $("timer").classList.toggle("last", sec <= 5);
    if (sec <= 5 && sec >= 1 && sec !== beatSec && stage.dataset.screen !== "gen") { // 最后 5 秒：每秒滴答一下，圈跳一下
      beatSec = sec; SF.sfx("tick");
      var el = $("timer"); el.classList.remove("beat"); void el.offsetWidth; el.classList.add("beat");
    }
    $("timerNum").textContent = sec;
    $("timerFill").style.strokeDashoffset = RING * (1 - Math.max(0, left) / (total * 1000));
    $("timer").classList.toggle("warn", sec <= 15 && stage.dataset.screen !== "result");
  }

  function tick() {
    var now = Date.now(), s = stage.dataset.screen;
    if (!round || s === "idle") return;

    if (s === "result") {
      if (document.body.classList.contains("phone")) return; // 手机上看演示的人用的是自己的手机：海报一直留着，点「完成」才回首页
      var left = resultUntil - now;
      setRing(left, resultTotal);

      if (left <= 0) sendOff(false);
      return;
    }

    var remain = round.startedAt + cfg.roundSec * 1000 - now;
    setRing(remain, cfg.roundSec);
    if (remain <= 0 && s !== "gen") return endRound("timeout"); // 生成中不打断，出图后进结果页保底扫码

    if (ACTIVE[s]) {
      if ($("stillModal").hidden && now - lastAct >= cfg.idleSec * 1000) {
        $("stillModal").hidden = false; stillUntil = now + cfg.stillThereSec * 1000;
        sideModal("still");
      }
      if (!$("stillModal").hidden) {
        var sl = stillUntil - now;
        $("stillSub").innerHTML = t("stillThereSub", { n: Math.max(0, Math.ceil(sl / 1000)) }); // 秒数用点阵字单独放大
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
    { p: "rock", s: "pop", n: "阿野", t: "今晚嗓子不要了", te: "No voice left tonight", seed: 11 },
    { p: "edm", s: "neon", n: "Kiki", t: "天亮之前不回家", te: "Not home till sunrise", seed: 22 },
    { p: "folk", s: "riso", n: "小满", t: "把晚风写进歌里", te: "Writing the breeze into songs", seed: 33 },
    { p: "jazz", s: "swiss", n: "老周", t: "今晚适合即兴", te: "A night for improv", seed: 44 },
    { p: "indie", s: "riso", n: "moon", t: "在人群里做自己", te: "Myself in the crowd", seed: 55 },
    { p: "hiphop", s: "pop", n: "Z哥", t: "麦克风给我", te: "Pass me the mic", seed: 66 }
  ];
  var fanReady = Promise.resolve();
  function enterIdle() {
    cfg = effectiveCfg();
    stage.classList.toggle("peak", !!cfg.peakMode);
    drawFan();
    if (!reduceMotion) fanTimer = setInterval(function () { fanIdx = (fanIdx + 1) % SAMPLES.length; drawFan(); }, 4000);
    renderQr($("queueQr"), pageUrl("prefill.html") + (lang === "en" ? "?lang=en" : ""));
    paintToday();
    if (!preloaded) { preloaded = true; setTimeout(SF.preloadAllThumbs, 1500); } // 首屏画完再在后台拿其余缩略图
  }
  var preloaded = false;
  function drawFan() {
    var cs = $("idleFan").querySelectorAll("canvas"), jobs = [];
    [1, 2, 0].forEach(function (off, i) {
      var sm = SAMPLES[(fanIdx + off) % SAMPLES.length];
      jobs.push(SF.renderPoster(cs[i], Object.assign({ no: 400 + ((fanIdx + off) % SAMPLES.length) }, sm, lang === "en" ? { t: sm.te } : {}), { lang: lang, scale: 0.5 }));
    });
    fanReady = Promise.all(jobs);
    var front = SF.persona(SAMPLES[fanIdx].p);
    $("idleBg").style.background = "radial-gradient(900px 900px at 50% 30%, " + front.c1 + "55, transparent 70%)";
  }

  /* ---------- S1 选人格 ---------- */
  function phrases(text) { return window.SFPhrase(text).map(function (x) { return x.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }).join("<wbr>"); } // 中文按 BudouX 短语插断行点
  function renderPersonas() {
    var g = $("personaGrid"); g.innerHTML = "";
    SF.PERSONAS.forEach(function (p) {
      var b = document.createElement("button");
      b.className = "p-card"; b.dataset.id = p.id;
      b.style.background = p.c1;
      b.style.color = SF.isLight(p.c1) ? "#141414" : "#f3f3ef";
      b.innerHTML =
        '<span class="p-name">' + (lang === "en" ? p.en : p.zh) + '</span>' +
        (lang === "en" ? "" : '<span class="p-en dot">' + p.en + '</span>') + // 英文界面只写英文名
        '<span class="p-motto">' + (lang === "en" ? p.mottoEn : phrases(p.mottoZh)) + '</span>' +
        '<span class="p-flavor">' + (lang === "en" ? p.flavorEn : p.flavorZh + "味") + '</span>' +
        '<span class="p-beat" aria-hidden="true">' + SF.voiceprint(p.mottoZh, 22).map(function (a, k) { return '<i style="--a:' + a.toFixed(2) + ';--k:' + k + '"></i>'; }).join("") + '</span>' + // 这一派宣言的声纹，选中时跟着招牌声跳
        '<img class="p-can" src="assets/brand/can-' + p.id + '-1.webp" alt="" decoding="async">' +
        '<span class="p-check"><span class="ico" data-icon="check"></span></span>';
      b.onclick = function () { pickPersona(p.id); autoNext(); };
      g.appendChild(b);
    });
    renderIcons(g);
    markPersona();
  }
  // 选中只切换样式不重建卡片，罐子立起来的过渡才看得见
  function markPersona() { // 选中一派后其余卡片退暗；没选时「拍 4 下节奏」按钮过 3 秒开始轻轻呼吸
    $("personaGrid").querySelectorAll(".p-card").forEach(function (c) { c.classList.toggle("sel", c.dataset.id === round.p); });
    $("personaGrid").classList.toggle("has-sel", !!round.p); stage.classList.toggle("picked", !!round.p);
  }
  function pickPersona(id) {
    round.p = id; SF.preloadPersona(id); markPersona(); updateNext(); tintFor("persona"); changed();
    var p = SF.persona(id), can = $("personaGrid").querySelector('.p-card[data-id="' + id + '"] .p-can');
    SF.sfx("persona", id); SF.buzz(18);
    var r = can.getBoundingClientRect(), q = stagePoint(r.left + r.width / 2, r.top + r.height * 0.08); // 罐口冒一串这一派颜色的气泡
    burst(q.x, q.y, 9, 170, true, SF.isLight(p.c1) ? "#141414" : "#ffffff");
  }

  /* 拍节奏帮你选：拍 4 下，按快慢和稳不稳推荐一派（推荐完仍可改选），BPM 印在海报顶栏 */
  var taps4 = [], tapTimer = 0;
  function paintTaps() { $("tapDots").querySelectorAll("i").forEach(function (d, i) { d.classList.toggle("on", i < taps4.length); }); }
  $("tapBtn").onclick = function () { cancelAuto(); taps4 = []; paintTaps(); $("tapResult").textContent = ""; $("tapModal").hidden = false; };
  $("tapClose").onclick = function () { clearTimeout(tapTimer); $("tapModal").hidden = true; };
  $("tapPad").addEventListener("pointerdown", function (e) {
    e.preventDefault();
    if (taps4.length >= 4) return;
    clearTimeout(tapTimer);
    taps4.push(performance.now()); paintTaps(); SF.sfx("kick"); SF.buzz(15);
    var pad = $("tapPad"); pad.classList.remove("hit"); void pad.offsetWidth; pad.classList.add("hit");
    if (taps4.length < 4) { tapTimer = setTimeout(function () { taps4 = []; paintTaps(); }, 2500); return; } // 停太久就重来
    var iv = [taps4[1] - taps4[0], taps4[2] - taps4[1], taps4[3] - taps4[2]], mean = (iv[0] + iv[1] + iv[2]) / 3;
    var cv = Math.sqrt(iv.reduce(function (a, x) { return a + (x - mean) * (x - mean); }, 0) / 3) / mean; // 忽快忽慢的程度
    var bpm = Math.max(40, Math.min(240, Math.round(60000 / mean)));
    // 拍得随性：慢的像爵士（慢半拍），快的像独立；拍得稳：越快越炸
    var id = cv > 0.22 ? (bpm < 110 ? "jazz" : "indie") : bpm >= 145 ? "rock" : bpm >= 115 ? "edm" : bpm >= 85 ? "hiphop" : "folk";
    var p = SF.persona(id);
    round.b = bpm;
    $("tapResult").textContent = t("tapResult", { bpm: bpm, p: lang === "en" ? p.en : p.zh });
    tapTimer = setTimeout(function () { $("tapModal").hidden = true; pickPersona(id); autoNext(); }, 1200);
  });

  /* ---------- S2 选风格：缩略图用刚选的人格实时画 ---------- */
  function renderStyles() {
    var row = $("styleRow"); row.innerHTML = "";
    SF.STYLES.forEach(function (s, i) {
      var b = document.createElement("button");
      b.className = "s-card" + (round.s === s.id ? " sel" : ""); b.dataset.style = s.id;
      var c = document.createElement("canvas");
      var pp = SF.persona(round.p), d = { p: round.p, s: s.id, seed: round.seed, n: "", t: lang === "en" ? pp.mottoEn : pp.mottoZh, no: SF.peekSerial() }; // 还没写一句话，先用这一派的宣言当示意句；编号印这一张会拿到的
      setTimeout(function () { SF.renderPoster(c, d, { lang: lang, scale: 0.5 }); }, i * 40); // 4 张错开画，不挤在同一瞬间
      b.appendChild(c);
      var name = document.createElement("span"); name.className = "s-name"; name.textContent = lang === "en" ? s.en : s.zh;
      var desc = document.createElement("span"); desc.className = "s-desc"; desc.textContent = lang === "en" ? s.descEn : s.descZh;
      b.appendChild(name); b.appendChild(desc);
      b.onclick = function () { round.s = s.id; SF.preloadFull(round.p, s.id, round.seed); row.querySelectorAll(".s-card").forEach(function (x) { x.classList.toggle("sel", x === b); }); updateNext(); changed(); autoNext(); };
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
      b.onclick = function () { $("lineInput").value = line; onInput(); lastLine = ""; typed(line); };
      box.appendChild(b);
    });
    clearError();
    onInput();
    lastLine = round.t;
    if (round.vp) paintMine(Array.from(round.vp, function (c) { return Math.pow(parseInt(c, 36) / 35, 2); }), 1); else paintTypeVoice(round.t, Array.from(round.t).length);
    $("tvPlay").setAttribute("aria-label", t("listen"));
    $("tvMic").hidden = !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); // 不是 https 或本机地址时浏览器不给麦克风
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
    changed();
  }
  function clearError() {
    $("inputError").textContent = ""; $("nickError").textContent = "";
    $("nickInput").classList.remove("bad"); $("lineInput").classList.remove("bad");
  }
  /* 输入时就按字数截断（中文算 1，英文数字算 0.5）；拼音输入法还在组字时不动，组完再截 */
  function clampField(el, limit, counter) {
    if (SF.textUnits(el.value) <= limit) return;
    el.value = SF.clampUnits(el.value, limit);
    counter.classList.remove("shake"); void counter.offsetWidth; counter.classList.add("shake");
  }
  [["nickInput", "nick", "nickCount"], ["lineInput", "line", "lineCount"]].forEach(function (f) {
    var el = $(f[0]);
    el.addEventListener("input", function (e) { if (!e.isComposing) clampField(el, SF.LIMITS[f[1]], $(f[2])); onInput(); if (f[1] === "line" && !e.isComposing) typed(el.value); });
    el.addEventListener("compositionend", function () { clampField(el, SF.LIMITS[f[1]], $(f[2])); onInput(); if (f[1] === "line") typed(el.value); });
  });

  /* 写一句话时的声纹条：每个字两根柱子；打一个字长出两根，用这一派的乐器响一个音（拼音组字时不响，组完再响）；
     点左边的喇叭把整句弹一遍。海报上印的声纹就是从这些字算出来的 */
  var lastLine = "";
  function paintTypeVoice(text, from) {
    var cs = Array.from(text), html = "";
    cs.forEach(function (ch, i) {
      var a = SF.charAmp(ch, i), cls = i >= from ? ' class="new"' : "";
      html += '<i style="--a:' + a.toFixed(3) + '"' + cls + '></i><i style="--a:' + (a * 0.62).toFixed(3) + '"' + cls + "></i>";
    });
    $("tvBars").innerHTML = html || '<b class="tv-hint">' + t("tvHint") + "</b>";
  }
  function typed(text) {
    var cs = Array.from(text), old = Array.from(lastLine), same = 0;
    while (same < old.length && same < cs.length && old[same] === cs[same]) same++;
    cs.slice(same, same + 3).forEach(function (ch, k) { // 一次贴进来很多字时只响前三个
      setTimeout(function () { SF.sfx("note", { p: round.p, a: SF.charAmp(ch, same + k) }); }, k * 80);
    });
    if (!round.vp) paintTypeVoice(text, same); // 念过一遍以后声纹条留着自己的声音
    lastLine = text;
  }
  /* 念一遍：点麦克风把这句话念出来，3 秒按时间分成 24 段，每段记最响的音量，就是这一张海报的声纹。
     不录音，只留 24 个音量数；没给麦克风或没听到声音时，声纹照旧按这句话的字来算 */
  var VP_N = 24, VP_MS = 3000, recording = false;
  function paintMine(bins, max) {
    $("tvBars").innerHTML = '<b class="tv-mine">' + t("micMine") + "</b>" + bins.map(function (b) {
      return '<i style="--a:' + Math.max(0.06, Math.sqrt((b || 0) / max)).toFixed(3) + '"></i>';
    }).join("");
  }
  $("tvMic").onclick = function () {
    if (recording) return;
    $("inputError").textContent = "";
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (stream) {
      recording = true;
      var ac = SF.audioCtx(), src = ac.createMediaStreamSource(stream), an = ac.createAnalyser(), buf = new Float32Array(1024), bins = [], t0 = performance.now();
      an.fftSize = 1024; src.connect(an);
      $("tvMic").classList.add("rec");
      (function frame() {
        var el = performance.now() - t0, k = Math.min(VP_N - 1, Math.floor(el / VP_MS * VP_N)), sum = 0;
        an.getFloatTimeDomainData(buf);
        for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        bins[k] = Math.max(bins[k] || 0, Math.sqrt(sum / buf.length));
        paintMine(bins.slice(0, k + 1), Math.max(0.02, Math.max.apply(null, bins.map(function (b) { return b || 0; })))); // 边念边长
        if (el < VP_MS) { requestAnimationFrame(frame); return; }
        stream.getTracks().forEach(function (tr) { tr.stop(); }); src.disconnect();
        recording = false; $("tvMic").classList.remove("rec");
        for (var j = 0; j < VP_N; j++) bins[j] = bins[j] || 0;
        var max = Math.max.apply(null, bins);
        if (max < 0.01) { $("inputError").textContent = t("micQuiet"); round.vp = ""; paintTypeVoice(lastLine, lastLine.length); return; }
        round.vp = bins.map(function (b) { return Math.round(Math.min(1, Math.sqrt(b / max)) * 35).toString(36); }).join("");
        paintMine(bins, max);
        SF.sfx("melody", { p: round.p, amps: SF.voiceOf(round, 40) });
        changed();
      })();
    }, function () { $("inputError").textContent = t("micDenied"); $("tvMic").hidden = true; });
  };
  $("tvPlay").onclick = function () {
    var text = $("lineInput").value.trim();
    if (!text) return;
    SF.sfx("melody", { p: round.p, amps: SF.voiceOf(round, 40, text) });
    var bars = $("tvBars"), list = bars.querySelectorAll("i"), total = SF.MELODY.notes * SF.MELODY.step * 1000;
    list.forEach(function (b, i) { b.style.animationDelay = Math.round(i / list.length * total) + "ms"; });
    bars.classList.remove("playing"); void bars.offsetWidth; bars.classList.add("playing");
  };
  $("hideNick").addEventListener("change", onInput);
  // 回车：昵称框跳到一句话；一句话框里两项都写了就直接生成（手机键盘上的「前往」键也一样）
  $("nickInput").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); $("lineInput").focus(); } });
  $("lineInput").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    if (!$("nickInput").value.trim()) return $("nickInput").focus();
    if ($("lineInput").value.trim()) { $("lineInput").blur(); $("nextBtn").click(); }
  });

  /* ---------- S4 生成中：海报像一杯气水从下往上倒满 ----------
     液面就是这句话的声纹（和海报上印的是同一条），液面下面一层白色泡沫，人格色的气泡往上冒、到液面破开溅出水珠；
     液体里是海报插画的网点（只取图形，不取文字）。倒满以后网点从中间往两边、按声纹的响度一颗颗化开，露出清晰的海报，
     然后整张海报直接缩放移动到结果页的位置。声音（声纹）+ 气泡（气水）= 声汽。 */
  var genTimers = [], genRaf = 0, genPoster = null; // genPoster：生成动画里画好的那张，结果页直接复用
  function enterGen() {
    genTimers = [];
    if (!round.counted) { // 每轮只统计一次出图
      round.counted = true;
      SF.bump(function (s) { s.done++; s.persona[round.p] = (s.persona[round.p] || 0) + 1; s.style[round.s] = (s.style[round.s] || 0) + 1; });
      SF.bumpToday();
    }
    $("genText").textContent = ""; // 切屏淡入完成前不出字，免得和上一屏的残影叠在一起
    [t("gen1"), t("gen2"), t("gen3")].forEach(function (l, i) { genTimers.push(setTimeout(function () { genSay(l); }, [200, 800, 1350][i])); }); // 第三句和网点化开同时出现
    if (!round.no) round.no = SF.nextSerial(); // 编号在画海报之前定，生成动画和结果页是同一个编号
    var off = document.createElement("canvas"), bare = document.createElement("canvas");
    var cv = $("genCanvas"), ctx = cv.getContext("2d");
    cv.style.visibility = "";
    ctx.fillStyle = "#0c0c0d"; ctx.fillRect(0, 0, cv.width, cv.height);
    var mine = round, seed = round.seed, opt = { lang: lang, hideNick: round.h || !cfg.showNickOnScreen, mystery: t("mysteryFan") };
    genPoster = null;
    // 先让生成画面显示出来，下一帧再画整张高清海报，点下去立刻有反应
    genTimers.push(setTimeout(function () {
      Promise.all([SF.renderPoster(off, round, opt), SF.loadBg(round)]).then(function (res) {
        if (round !== mine || stage.dataset.screen !== "gen") return;
        SF.drawPoster(bare, round, Object.assign({}, opt, { bg: res[1], bare: true }));
        genPoster = { canvas: off, seed: seed, lang: lang };
        pour(off, bare, cv, ctx, SF.persona(round.p), round.t, flyToResult);
      });
    }, 60));
  }
  function genSay(s) { var el = $("genText"); el.textContent = s; el.classList.remove("in"); void el.offsetWidth; el.classList.add("in"); }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function easeOutBack(x) { var c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }

  /* 网点：把图缩成每格一个像素，取颜色和亮度（亮的地方点大）。file:// 打开时浏览器不让读画布像素，改用人格的两种颜色 */
  function sampleDots(src, S, p) {
    var W = src.width, H = src.height, cols = Math.ceil(W / S), rows = Math.ceil(H / S), dots = [], data = null;
    if (location.protocol !== "file:") {
      var small = document.createElement("canvas"); small.width = cols; small.height = rows;
      var sx = small.getContext("2d"); sx.drawImage(src, 0, 0, cols, rows);
      data = sx.getImageData(0, 0, cols, rows).data;
    }
    for (var j = 0; j < rows; j++) for (var i = 0; i < cols; i++) {
      var col, lum, y = j * S + S / 2;
      if (data) {
        var o = (j * cols + i) * 4;
        col = "rgb(" + data[o] + "," + data[o + 1] + "," + data[o + 2] + ")";
        lum = (data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114) / 255;
      } else {
        col = y > H - 150 ? "#e2ff2e" : ((i * 7 + j * 13) % 5 < 2 ? p.c2 : p.c1); lum = 0.6;
      }
      dots.push({ x: i * S + S / 2, y: y, r: S / 2 * (0.3 + 0.62 * lum), col: col });
    }
    return dots;
  }

  function pour(off, bare, cv, ctx, p, text, done) {
    var W = cv.width, H = cv.height, S = 30, TAU = Math.PI * 2;
    if (reduceMotion) { ctx.drawImage(off, 0, 0); genTimers.push(setTimeout(done, 900)); return; }
    var dots = sampleDots(bare, S, p), vp = SF.voiceOf(round, 40, text), tint = SF.lum(p.c1) < 90 ? p.c2 : p.c1;
    var PLAY = SF.MELODY.notes * SF.MELODY.step * 1000; // 声纹被当成旋律播一遍，液面上的播放头同时从左走到右
    SF.sfx("melody", { p: p.id, amps: vp }); SF.sfx("pops", 6);
    var tintRgb = [1, 3, 5].map(function (i) { return parseInt(tint.substr(i, 2), 16); }).join(",");
    var bubbles = [], pops = [], foam = [], gush = null; // gush：网点开始化开时从底部喷出来的那一大串气泡
    var intro = []; // 一点下去：底部先冒上来一串气泡，开头就有动静
    for (var n0 = 0; n0 < 60; n0++) intro.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.8, y: H - Math.random() * 120, vy: -(0.9 + Math.random() * 1.6), r: [6, 12, 18][n0 % 3] * (0.7 + Math.random() * 0.6) });
    function bubble(first) { return { x: Math.random() * W, y: H + (first ? Math.random() * H * 0.8 : 20 + Math.random() * 140), r: 10 + Math.random() * 18, v: 0.32 + Math.random() * 0.5, ph: Math.random() * TAU }; }
    for (var i = 0; i < 46; i++) bubbles.push(bubble(true));
    for (var f = 0; f < 170; f++) foam.push({ x: Math.random() * W, d: Math.random(), r: 3 + Math.random() * 6, ph: Math.random() * TAU });
    var FILL1 = 1500, MELT0 = 1350, MELT1 = 2500, END = 2600, MELT_EACH = 520, t0 = performance.now(), last = t0;
    function level(t) { return H * Math.pow(1 - clamp01(t / FILL1), 1.6) - 70; } // 第一帧就开始涨，略微先快后慢，1.5 秒正好涨满
    function amp(x) { var k = clamp01(x / W) * (vp.length - 1), a = Math.floor(k), b = Math.min(vp.length - 1, a + 1); return vp[a] + (vp[b] - vp[a]) * (k - a); }
    function head(t) { return t < PLAY + 120 ? clamp01(t / PLAY) * W : -999; }
    // 每颗网点什么时候化开：插画从中间往两边，声纹越响的那一段越早
    dots.forEach(function (d) { // 插画部分；海报下半的文字区整块一起化开，不先冒出零散的单字
      d.m0 = d.y / H > 0.55 ? MELT0 + 380 + Math.random() * 60 : MELT0 + Math.abs(d.x - W / 2) / (W / 2) * 520 + (d.y / H < 0.5 ? 120 : 0) - amp(d.x) * 220;
    });
    function surface(x, t, lv) { // 每一段的高低取自声纹，像正在播放一样起伏；播放头经过的地方顶起来
      var boost = Math.exp(-Math.pow((x - head(t)) / 70, 2)) * 48;
      return lv - amp(x) * 74 * (0.55 + 0.45 * Math.sin(t / 105 + x / 70)) - boost + 9 * Math.sin(x / 120 + t / 180);
    }
    function frame(now) {
      var t = now - t0, dt = Math.min(48, now - last), lv = level(t), fade = 1 - clamp01((t - MELT0) / (MELT1 - MELT0));
      last = now;
      ctx.fillStyle = "#0c0c0d"; ctx.fillRect(0, 0, W, H);
      if (t >= END) { ctx.drawImage(off, 0, 0); done(); return; }
      if (fade > 0 && lv < H) { // 液体本身：一层人格色的半透明渐变
        ctx.beginPath(); ctx.moveTo(0, H);
        for (var sx = 0; sx <= W; sx += 18) ctx.lineTo(sx, surface(sx, t, lv));
        ctx.lineTo(W, H); ctx.closePath();
        var lg = ctx.createLinearGradient(0, lv, 0, H);
        lg.addColorStop(0, "rgba(" + tintRgb + "," + (0.1 * fade) + ")"); lg.addColorStop(1, "rgba(" + tintRgb + "," + (0.22 * fade) + ")"); // 液体底色淡一点，网点里插画的颜色透得出来
        ctx.fillStyle = lg; ctx.fill();
      }
      // 网点：倒满之后从下往上一颗颗化开，化开的地方透出清晰海报
      ctx.save(); ctx.beginPath();
      var melting = false;
      for (var k = 0; k < dots.length; k++) {
        var d = dots[k], m = easeInOut(clamp01((t - d.m0) / MELT_EACH));
        if (m <= 0) continue;
        var grown = d.r + (S * 0.74 - d.r) * m;
        ctx.moveTo(d.x + grown, d.y); ctx.arc(d.x, d.y, grown, 0, TAU); melting = true;
      }
      if (melting) { ctx.clip(); ctx.drawImage(off, 0, 0); }
      ctx.restore();
      for (var k2 = 0; k2 < dots.length; k2++) {
        var e = dots[k2];
        if (t > e.m0) continue;
        var depth = e.y - surface(e.x, t, lv);
        ctx.beginPath();
        if (depth <= 0) { // 还没倒到：没亮的 LED，从中心一圈圈波纹似的亮起来，第一帧就有画面
          var wave = Math.max(0, Math.sin(t / 160 + 1.4 - Math.hypot(e.x - W / 2, e.y - H * 0.55) / 170)); // 第一帧中心那圈就亮着
          ctx.fillStyle = wave > 0.05 ? "rgba(" + tintRgb + "," + (0.16 + 0.55 * wave * wave).toFixed(3) + ")" : "rgba(243,243,239,0.16)"; // 波纹用这一派的颜色，一秒内扩到整屏
          ctx.arc(e.x, e.y, 2.8 + wave * 3, 0, TAU);
        }
        else { ctx.fillStyle = e.col; ctx.arc(e.x, e.y, Math.max(0.5, e.r * easeOutBack(clamp01(depth / 70))), 0, TAU); }
        ctx.fill();
      }
      if (fade > 0) {
        if (lv > -80) { // 液面下的白色泡沫带
          for (var q = 0; q < foam.length; q++) {
            var fo = foam[q], fy = surface(fo.x, t, lv) + 8 + fo.d * 40 + Math.sin(t / 200 + fo.ph) * 3;
            if (fy > H) continue;
            ctx.beginPath(); ctx.arc(fo.x, fy, fo.r * (1 - fo.d * 0.5), 0, TAU);
            ctx.fillStyle = "rgba(255,255,255," + ((1 - fo.d) * 0.85 * fade) + ")"; ctx.fill();
          }
        }
        for (var b = 0; b < bubbles.length; b++) { // 气泡往上冒：人格色的圈 + 白色高光，碰到液面就破
          var bb = bubbles[b], bx = bb.x + Math.sin(t / 260 + bb.ph) * 8;
          bb.y -= bb.v * dt * (0.7 + (H - bb.y) / H);
          if (bb.y < surface(bx, t, lv) + 10) {
            if (bb.y > 0 && lv < H) pops.push({ x: bx, y: bb.y, at: t, r: bb.r });
            bubbles[b] = bubble(false);
            continue;
          }
          ctx.beginPath(); ctx.arc(bx, bb.y, bb.r, 0, TAU);
          ctx.fillStyle = "rgba(" + tintRgb + "," + (0.22 * fade) + ")"; ctx.fill();
          ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(" + tintRgb + "," + (0.95 * fade) + ")"; ctx.stroke();
          ctx.beginPath(); ctx.arc(bx - bb.r * 0.32, bb.y - bb.r * 0.32, bb.r * 0.26, 0, TAU);
          ctx.fillStyle = "rgba(255,255,255," + (0.85 * fade) + ")"; ctx.fill();
        }
        pops = pops.filter(function (o) { return t - o.at < 320; });
        pops.forEach(function (o) { // 破开：一圈细线散开，三颗水珠往上溅
          var k3 = (t - o.at) / 320;
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1 + k3 * 1.6), 0, TAU);
          ctx.strokeStyle = "rgba(226,255,46," + (0.75 * (1 - k3) * fade) + ")"; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255," + (0.9 * (1 - k3) * fade) + ")";
          [-1, 0, 1].forEach(function (s) {
            ctx.beginPath(); ctx.arc(o.x + s * o.r * (0.6 + k3 * 1.4), o.y - o.r * k3 * (2.2 - Math.abs(s) * 0.8) + k3 * k3 * 30, 4 * (1 - k3 * 0.5), 0, TAU); ctx.fill();
          });
        });
        if (lv > -90) { // 液面那条声纹线
          ctx.beginPath();
          for (var x = 0; x <= W; x += 12) { var y = surface(x, t, lv); if (x) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(226,255,46," + (0.95 * fade) + ")";
          ctx.shadowColor = "rgba(226,255,46," + (0.7 * fade) + ")"; ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0;
          var hx = head(t);
          if (hx >= 0) { ctx.beginPath(); ctx.arc(hx, surface(hx, t, lv), 16, 0, TAU); ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#e2ff2e"; ctx.shadowBlur = 30; ctx.fill(); ctx.shadowBlur = 0; }
        }
      }
      if (t < 1100) { // 开头那串气泡：往上冒、慢慢淡掉
        var ia = clamp01(1 - t / 1100);
        intro.forEach(function (q) {
          q.y += q.vy * dt;
          ctx.beginPath(); ctx.arc(q.x + Math.sin(t / 180 + q.r) * 6, q.y, q.r, 0, TAU);
          ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255," + (0.9 * ia).toFixed(3) + ")"; ctx.stroke();
          ctx.fillStyle = "rgba(" + tintRgb + "," + (0.3 * ia).toFixed(3) + ")"; ctx.fill();
        });
      }
      if (t >= MELT0 && !gush) { // 开罐：底部中间喷出一大串大小不一的气泡，整屏亮一下，嘶的一声
        gush = [];
        for (var g = 0; g < 110; g++) gush.push({ x: W / 2 + (Math.random() - 0.5) * 260, y: H - 30, vx: (Math.random() - 0.5) * 1.1, vy: -(1.1 + Math.random() * 2.4), r: [5, 11, 20][g % 3] * (0.7 + Math.random() * 0.6) });
        SF.sfx("open");
      }
      if (gush) {
        var ga = clamp01(1 - (t - MELT0) / 1300);
        if (t - MELT0 < 140) { ctx.fillStyle = "rgba(255,255,255," + (0.28 * (1 - (t - MELT0) / 140)).toFixed(3) + ")"; ctx.fillRect(0, 0, W, H); }
        gush.forEach(function (q) {
          q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 0.0016 * dt;
          ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU);
          ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255," + (0.9 * ga).toFixed(3) + ")"; ctx.stroke();
          ctx.fillStyle = "rgba(" + tintRgb + "," + (0.25 * ga).toFixed(3) + ")"; ctx.fill();
        });
      }
      genRaf = requestAnimationFrame(frame);
    }
    genRaf = requestAnimationFrame(frame);
  }

  // 倒满以后：生成画面上的海报一路缩放移动到结果页的位置（FLIP），中间不切黑、不跳；二维码和按钮随后从下面滑上来
  function flyToResult() {
    var cv = $("genCanvas"), from = rectIn(cv);
    if (reduceMotion) { go("result"); return; }
    stage.classList.add("flip");
    $("genText").classList.remove("in"); $("genText").textContent = "";
    SF.scene.flash();
    go("result");
    genTimers.push(setTimeout(function () { // 罐子落定（canIn 0.45s 起跳、0.6s 落地）：叮一声、屏幕轻震
      SF.sfx("land"); SF.buzz(20);
      stage.classList.remove("thud"); void stage.offsetWidth; stage.classList.add("thud");
    }, 1000));
    var to = rectIn($("resultCanvas")), fly = document.createElement("canvas");
    fly.width = genPoster.canvas.width; fly.height = genPoster.canvas.height;
    fly.getContext("2d").drawImage(genPoster.canvas, 0, 0);
    fly.className = "fly-poster";
    fly.style.left = from.x + "px"; fly.style.top = from.y + "px"; fly.style.width = from.w + "px"; fly.style.height = from.h + "px";
    stage.appendChild(fly);
    cv.style.visibility = "hidden";
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      fly.style.transform = "translate(" + (to.x - from.x) + "px," + (to.y - from.y) + "px) scale(" + (to.w / from.w) + ")";
    }); });
    fly.addEventListener("transitionend", function () { fly.remove(); stage.classList.remove("flip"); }, { once: true });
  }
  function rectIn(el) { // 元素在 #stage 里的版面位置（按布局算，不受切屏位移影响）
    var x = 0, y = 0, n = el;
    for (; n && n !== stage; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }
  /* ---------- S5 结果 ---------- */
  var resultTotal = 20, resultShownAt = 0;
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
    $("resultCan").src = "assets/brand/can-" + p.id + "-1.webp";
    $("resultBack").textContent = t("backIn"); // 秒数只在顶部的圈里显示一次
    $("resultGift").innerHTML = t("s5Gift", { booth: "<b>" + (lang === "en" ? cfg.boothEn : cfg.boothZh) + "</b>", flavor: '<span class="nowrap">' + (lang === "en" ? p.flavorEn + " sparkling water" : p.flavorZh + "味气泡水") + "</span>" }); // 口味连同「味气泡水」不拆行
    var used = round.rerolls >= cfg.rerollMax;
    $("rerollBtn").disabled = used;
    $("rerollLabel").textContent = used ? t("rerollUsed") : t("reroll");
    // 结果页停留：默认 resultStaySec；有人排队缩到 15 秒；不超过本轮剩余，但剩余不够时保底给够扫码时间
    var stay = SF.queueCount() > 0 ? Math.min(cfg.resultStaySec, 15) : cfg.resultStaySec;
    var remain = Math.max(0, (round.startedAt + cfg.roundSec * 1000 - Date.now()) / 1000);
    resultTotal = Math.max(Math.min(stay, remain), Math.min(cfg.resultMinSec, stay));
    resultUntil = Date.now() + resultTotal * 1000; resultShownAt = Date.now();
    phoneShow("result");
  }
  function shareHash() { return "#s=" + SF.encodeShort(round); }
  function shareUrl() { return (location.protocol === "file:" ? cfg.shareBase : pageUrl("share.html")) + shareHash(); }
  function pageUrl(file) {
    if (location.protocol === "file:") return cfg.shareBase.replace("share.html", file);
    return location.href.replace(/[^/]*([?#].*)?$/, "") + file;
  }
  function renderQr(el, url) { // 屏幕上的码不会被弄脏，纠错用 L 档，模块更少、更好扫
    var q = qrcode(0, "L"); q.addData(url); q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  /* ---------- 底栏 ---------- */
  function updateNext() {
    var s = stage.dataset.screen, ok = false;
    if (!round) return;
    if (s === "persona") ok = !!round.p;
    if (s === "style") ok = !!round.s;
    if (s === "input") ok = round.n.trim() !== "" && round.t.trim() !== ""; // 能点，点了再审，审不过给提示
    if (ok && $("nextBtn").disabled) { var nb = $("nextBtn"); nb.classList.remove("lit"); void nb.offsetWidth; nb.classList.add("lit"); } // 刚能点的那一下亮一圈
    $("nextBtn").disabled = !ok;
    $("nextLabel").textContent = !ok ? t({ persona: "hint1", style: "hint2", input: "hint3" }[s]) : s === "input" ? t("generate") : t("next"); // 不能点时按钮上直接写还差什么
    $("nextBtn").classList.toggle("wait", !ok);
  }
  $("nextBtn").onclick = function () {
    var s = stage.dataset.screen;
    if (s === "input") {
      var r = SF.checkText(round.n, round.t);
      if (!r.ok) {
        $(r.field === "nick" ? "nickError" : "inputError").textContent = SF.blockMessage(r, lang); // 提示贴在出问题的那个框下面
        $(r.field === "nick" ? "nickInput" : "lineInput").classList.add("bad");
        SF.sfx("error"); SF.buzz([18, 60, 18]);
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
    pickPersona(SF.PERSONAS[Math.floor(Math.random() * SF.PERSONAS.length)].id); autoNext();
  };
  var exitArmed = 0;
  $("exitBtn").onclick = function () { // 退出要点两下：第一下按钮旁边提示「再点一次退出」，2.5 秒内再点才清空这一轮
    if (exitArmed) { clearTimeout(exitArmed); exitArmed = 0; $("exitBtn").classList.remove("armed"); return endRound("exit"); }
    $("exitBtn").classList.add("armed");
    exitArmed = setTimeout(function () { exitArmed = 0; $("exitBtn").classList.remove("armed"); }, 2500);
  };
  $("startBtn").onclick = function () { startRound(false); go("persona"); };
  $("rerollBtn").onclick = function () {
    if (!round || round.rerolls >= cfg.rerollMax) return;
    round.rerolls++; round.seed = SF.newSeed(); round.no = 0;
    SF.bump(function (s) { s.rerolls++; });
    go("gen");
  };
  $("doneBtn").onclick = function () { sendOff(true); };
  /* 收尾：海报缩成一颗气泡往上飘走，一串人格色气泡跟上去，二维码和按钮先淡掉，然后回到首页 */
  var leaving = false;
  function sendOff(tapped) {
    if (leaving) return;
    var pw = document.querySelector(".result-poster");
    if (reduceMotion) return endRound("done");
    leaving = true;
    var r = rectIn(pw), p = SF.persona(round.p), col = SF.isLight(p.c1) ? "#141414" : "#ffffff", anims = [];
    document.querySelectorAll(".s-result .result-scan, .s-result .result-actions, .s-result .result-phone, .s-result .result-can").forEach(function (el) {
      anims.push(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: "forwards" }));
    });
    anims.push(pw.animate([{ transform: "none", borderRadius: "28px", opacity: 1 },
      { transform: "translateY(-6%) scale(0.5)", borderRadius: "40%", opacity: 0.9, offset: 0.45 },
      { transform: "translateY(-48%) scale(0.08)", borderRadius: "50%", opacity: 0 }],
      { duration: 820, easing: "cubic-bezier(0.55,0,0.7,0.2)", fill: "forwards" }));
    setTimeout(function () { burst(r.x + r.w / 2, r.y + r.h * 0.4, 14, 260, true, col); }, 300);
    if (!tapped) SF.sfx("pops", 6); // 倒计时走完时没人点「完成」，用一串气泡声收尾
    setTimeout(function () {
      leaving = false; endRound("done");
      setTimeout(function () { anims.forEach(function (a) { a.cancel(); }); }, 500); // 结果屏淡出以后再撤掉定格，下一轮进结果页时一切复原
    }, 860);
  }
  $("openLocalBtn").onclick = function () { window.open("share.html" + shareHash(), "_blank", "width=430,height=900"); };
  // 手机上看演示时二维码扫不了：直接把这张海报存下来，或者打开扫码后的那一页
  $("saveLocalBtn").onclick = function () {
    $("resultCanvas").toBlob(function (blob) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "SONIFIZZ-" + round.no + ".jpg"; a.click();
    }, "image/jpeg", 0.92);
  };
  $("openShareBtn").onclick = function () { location.href = "share.html" + shareHash(); };

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
    if (!e) { // 原型说明只在演示时出现，展位真机（?kiosk=1）上只说核对号码
      var demo = !document.body.classList.contains("kiosk");
      $("codeError").textContent = lang === "en" ? "Code not found. Check the number on your phone" + (demo ? " (in this prototype, codes live in this browser only)" : "") : "没找到这个号码，对一下手机上的号码" + (demo ? "（原型里号码只存在这台设备的浏览器）" : "");
      SF.sfx("error"); SF.buzz([18, 60, 18]); code = ""; renderCode(); return; }
    var r = SF.checkText(e.n, e.t); // 手机端审过一次，大屏再审一次
    if (!r.ok) { $("codeError").textContent = SF.blockMessage(r, lang); return; }
    $("codeModal").hidden = true;
    startRound(true); Object.assign(round, { p: e.p, s: e.s, n: e.n, t: e.t, h: e.h, f: e.f || null }, e.seed ? { seed: e.seed } : {}); // 手机上预览的是哪张就印哪张；被邀请来的带上邀请人
    go("gen");
  }
  $("codeBtn").onclick = function () {
    code = ""; renderCode(); $("codeError").textContent = ""; $("codeModal").hidden = false;
    sideModal("code");
  };
  $("codeClose").onclick = function () { $("codeModal").hidden = true; updateSide(stage.dataset.screen); };
  $("imHereBtn").onclick = function () { $("stillModal").hidden = true; lastAct = Date.now(); updateSide(stage.dataset.screen); };

  /* ---------- 放大展位屏（电脑上） ---------- */
  function booth(on) { document.body.classList.toggle("booth", on); fit(); }
  $("boothBtn").onclick = function () { booth(true); };
  $("boothExit").onclick = function () { booth(false); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && document.body.classList.contains("booth")) booth(false); });

  /* ---------- 声音开关（顶栏和首页各一个） ---------- */
  function paintSound() {
    var m = SF.muted();
    ["soundBtn", "soundBtnIdle"].forEach(function (id) {
      var el = $(id);
      el.querySelector(".ico").innerHTML = '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">' + ICONS[m ? "speaker-slash" : "speaker-high"] + "</svg>";
      el.setAttribute("aria-label", t(m ? "soundOn" : "soundOff")); el.classList.toggle("off", m);
    });
  }
  ["soundBtn", "soundBtnIdle"].forEach(function (id) { $(id).onclick = function () { SF.setMuted(!SF.muted()); SF.sfxMute(); paintSound(); SF.sfx("tap"); }; });

  /* ---------- 语言 ---------- */
  document.querySelectorAll(".lang-toggle button").forEach(function (b) {
    b.onclick = function () { lang = b.dataset.lang; applyText(); drawFan(); renderQr($("queueQr"), pageUrl("prefill.html") + (lang === "en" ? "?lang=en" : "")); phoneShow(stage.dataset.screen); };
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
  document.fonts.ready.then(fitSides); // 得意黑加载完标题会变高，再量一次两侧放不放得下
  SF.fontsReady.then(function () {
    go("idle");
    Promise.race([fanReady, new Promise(function (r) { setTimeout(r, 1500); })]).then(function () {
      requestAnimationFrame(function () { document.body.classList.remove("booting"); if (SF.tourBoot) SF.tourBoot(); });
    });
  });
  SF._debug = { go: go, round: function () { return round; }, cfg: function () { return cfg; } };
})();
