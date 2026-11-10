/* 新手指引：「指哪点哪」。第一次打开先问要不要带着走，答应了才开始；记住选择，左侧留「再走一遍」入口。
   每一步按当前屏和已经选了什么自动推断（不靠计时），用发光框圈住要点的东西，气泡写「点这里」并拉一条箭头过去。
   电脑上气泡放在立式机左边；手机上（竖屏窗口）气泡贴在目标的上方或下方。?kiosk=1 的真机不出现指引。 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage");
  var KEY = "sf.tour";
  var TXT = {
    zh: {
      start: "点这里开始", pickP: "选一派：点任意一张卡", next: "点下一步", pickS: "选一个海报风格",
      fill: "昵称随便写两个字；一句话不想打，就点下面的一句", gen: "点这里生成海报", wait: "海报正在压制，等两秒",
      qr: "手机扫这个码就能把海报带走", qrDesk: "手机扫这个码就能把海报带走。右边那部手机里就是扫出来的页面",
      done: "看完点完成，回到首页", end: "走完了。手机分享页、排队预填页和运营后台也能点开看看",
      ok: "知道了", go: "下一步", quit: "退出指引"
    },
    en: {
      start: "Tap here to start", pickP: "Pick a tribe: tap any card", next: "Tap Next", pickS: "Pick a poster style",
      fill: "Type any nickname. For the line, tap one of the suggestions below", gen: "Tap here to make the poster", wait: "Pressing your poster, give it two seconds",
      qr: "Scan this with a phone to take the poster home", qrDesk: "Scan this with a phone to take the poster home. The phone on the right shows the page you get",
      done: "Tap Done to go back home", end: "That's the whole flow. The phone share page, queue prefill and admin pages are worth a look too",
      ok: "Got it", go: "Next", quit: "Exit guide"
    }
  };
  var active = false, qrSeen = false, reachedResult = false, timer = 0, lastKey = "";
  var ring = document.createElement("div"), bubble = document.createElement("div"), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ring.className = "tour-ring"; bubble.className = "tour-bubble"; svg.setAttribute("class", "tour-arrow");
  svg.innerHTML = '<defs><marker id="tourHead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#e2ff2e"/></marker></defs><line marker-end="url(#tourHead)"/>';
  [ring, svg, bubble].forEach(function (el) { el.setAttribute("hidden", ""); document.body.appendChild(el); });
  function showAll(on) { [ring, svg, bubble].forEach(function (el) { if (on) el.removeAttribute("hidden"); else el.setAttribute("hidden", ""); }); } // svg 元素没有 hidden 属性，只能改特性

  function lang() { return document.documentElement.lang === "en" ? "en" : "zh"; }
  function T(k) { return TXT[lang()][k]; }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 隐私模式下记不住，下次再问 */ } }
  function realKiosk() { return /[?&]kiosk=1/.test(location.search); }
  function phoneView() { return document.body.classList.contains("real"); }
  SF.tourSeen = function () { return !!read(); };

  /* 当前该指哪：[目标选择器, 文案键, 按钮] */
  function stepNow() {
    var s = stage.dataset.screen, r = SF._debug.round();
    if (!$("codeModal").hidden || !$("stillModal").hidden) return null;
    if (s === "idle") return reachedResult ? ["#demoLinks", "end", "ok"] : ["#startBtn", "start"];
    if (s === "persona") return r && r.p ? ["#nextBtn", "next"] : ["#personaGrid", "pickP"];
    if (s === "style") return r && r.s ? ["#nextBtn", "next"] : ["#styleRow", "pickS"];
    if (s === "input") return r && r.n.trim() && r.t.trim() ? ["#nextBtn", "gen"] : ["#presets", "fill"];
    if (s === "gen") return ["#genCanvas", "wait"];
    if (s === "result") { reachedResult = true; return qrSeen ? ["#doneBtn", "done"] : ["#resultQr", phoneView() ? "qr" : "qrDesk", "go"]; }
    return null;
  }

  function place() {
    if (!active) return;
    var st = stepNow();
    document.body.classList.toggle("tour-end", !!st && st[1] === "end");
    if (!st) { showAll(false); return; }
    var target = document.querySelector(st[0]);
    if (st[0] === "#demoLinks" && (phoneView() || document.body.classList.contains("narrow"))) target = $("startBtn"); // 左侧栏没显示时就指回开始按钮
    var key = st.join("|") + lang();
    if (key !== lastKey) {
      lastKey = key;
      bubble.innerHTML = '<p>' + T(st[1]) + '</p><div class="tour-row">' +
        (st[2] ? '<button class="btn btn-primary tour-go">' + T(st[2]) + '</button>' : '') +
        '<button class="tour-quit">' + T("quit") + '</button></div>';
      var go = bubble.querySelector(".tour-go");
      if (go) go.onclick = function () { if (st[2] === "go") { qrSeen = true; place(); } else stop(true); };
      bubble.querySelector(".tour-quit").onclick = function () { stop(true); };
      bubble.classList.remove("in"); void bubble.offsetWidth; bubble.classList.add("in");
    }
    var r = target.getBoundingClientRect(), pad = 8;
    showAll(true);
    Object.assign(ring.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    var bw = bubble.offsetWidth, bh = bubble.offsetHeight, vw = innerWidth, vh = innerHeight, bx, by, ax, ay, tx, ty;
    if (!phoneView() && st[0] !== "#demoLinks") { // 电脑：气泡在立式机左边，箭头横着指过去
      var k = $("kiosk").getBoundingClientRect();
      bx = Math.max(16, k.left - bw - 36); by = Math.min(vh - bh - 16, Math.max(16, r.top + r.height / 2 - bh / 2));
      ax = bx + bw; ay = by + bh / 2; tx = r.left - pad - 4; ty = r.top + r.height / 2;
    } else if (st[0] === "#demoLinks") { // 最后一步：指向左侧栏的页面链接
      bx = Math.min(vw - bw - 16, r.right + 40); by = Math.max(16, r.top + r.height / 2 - bh / 2);
      ax = bx; ay = by + bh / 2; tx = r.right + pad + 4; ty = r.top + r.height / 2;
    } else { // 手机：气泡贴在目标上方，放不下就放下方
      bx = Math.min(vw - bw - 12, Math.max(12, r.left + r.width / 2 - bw / 2));
      var above = r.top - pad - bh - 28 > 8;
      by = above ? r.top - pad - bh - 28 : Math.min(vh - bh - 8, r.bottom + pad + 28);
      ax = r.left + r.width / 2; ay = above ? by + bh : by; tx = ax; ty = above ? r.top - pad - 4 : r.bottom + pad + 4;
    }
    Object.assign(bubble.style, { left: bx + "px", top: by + "px" });
    var line = svg.querySelector("line");
    line.setAttribute("x1", ax); line.setAttribute("y1", ay); line.setAttribute("x2", tx); line.setAttribute("y2", ty);
  }

  function label() { // 左栏按钮：指引进行中写「退出指引」，否则「再走一遍」
    $("tourBtn").lastElementChild.textContent = active ? T("quit") : SF.DEMO[lang()].tourAgain;
  }
  function start() {
    write("done"); active = true; qrSeen = false; reachedResult = false; lastKey = "";
    $("tourAsk").hidden = true; $("tourBtn").hidden = false;
    document.body.classList.add("touring"); label();
    place(); clearInterval(timer); timer = setInterval(place, 250);
  }
  function stop(byUser) {
    active = false; clearInterval(timer); showAll(false);
    document.body.classList.remove("touring", "tour-end"); label();
    if (byUser) write("done");
  }
  SF.tourLang = function () { // 大屏切语言时，询问条和按钮的字跟着换
    $("tourQLabel").textContent = SF.DEMO[lang()].tour;
    if (!$("tourBtn").hidden) label();
    lastKey = ""; place();
  };

  $("tourYes").onclick = start;
  $("tourNo").onclick = function () { write("skip"); $("tourAsk").hidden = true; $("tourBtn").hidden = false; };
  $("tourBtn").onclick = function () { if (active) stop(true); else start(); };
  document.addEventListener("sf:change", place);
  window.addEventListener("resize", place);

  /* 第一次来：电脑上在左侧问；手机上在屏幕顶部问 */
  $("tourQ").onclick = function () { $("tourQ").classList.remove("fresh"); start(); };
  SF.tourBoot = function () {
    if (realKiosk()) { $("tourBtn").hidden = true; return; }
    $("tourQ").hidden = !phoneView(); $("tourQLabel").textContent = SF.DEMO[lang()].tour;
    if (read()) return;
    $("tourBtn").hidden = true;
    if (phoneView()) { // 手机和竖着的平板：首页副标题下面一个「带我走一遍」，第一次来时轻轻呼吸，点了就开始走一遍
      $("tourQ").classList.add("fresh");
      document.addEventListener("sf:change", function off() {
        if (stage.dataset.screen === "idle") return;
        $("tourQ").classList.remove("fresh"); write("skip"); document.removeEventListener("sf:change", off);
      });
    } else {
      $("tourAsk").hidden = false;
      // 电脑上同样：没答就离开首页，询问卡收起，留一个「带我走一遍」小按钮
      document.addEventListener("sf:change", function off() {
        if (stage.dataset.screen === "idle" || $("tourAsk").hidden) return;
        write("skip"); $("tourAsk").hidden = true; $("tourBtn").hidden = false; label(); document.removeEventListener("sf:change", off);
      });
    }
  };
})();
