/* 运营后台：改参数（存本机，大屏下一轮读取）+ 看数据 + 管词表 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  document.querySelectorAll(".logo-mark").forEach(function (el) { el.innerHTML = SF.LOGO_SVG; });

  var FIELDS = [
    ["roundSec", "单轮时长上限（秒）", "num", 30, 300],
    ["idleSec", "空闲多久弹「还在吗」（秒）", "num", 5, 120],
    ["stillThereSec", "「还在吗」倒计时（秒）", "num", 3, 60],
    ["resultStaySec", "结果页停留（秒）", "num", 5, 120],
    ["resultMinSec", "结果页保底扫码时间（秒）", "num", 5, 60],
    ["rerollMax", "每轮换一张次数", "num", 0, 3],
    ["peakMode", "高峰模式（60 秒一轮，关闭换一张）", "bool"],
    ["showNickOnScreen", "大屏显示昵称", "bool"],
    ["boothZh", "领福利的展位位置", "text"]
  ];

  function renderForm() {
    var cfg = SF.settings(), f = $("paramForm"); f.innerHTML = "";
    FIELDS.forEach(function (x) {
      var row = document.createElement("label"); row.className = "a-row" + (x[2] === "text" ? " a-row-text" : "");
      var input = x[2] === "bool" ? '<input type="checkbox" name="' + x[0] + '"' + (cfg[x[0]] ? " checked" : "") + ">"
        : x[2] === "text" ? '<input type="text" name="' + x[0] + '" maxlength="16" value="' + esc(cfg[x[0]]) + '">'
        : '<input type="number" min="' + x[3] + '" max="' + x[4] + '" name="' + x[0] + '" value="' + cfg[x[0]] + '">';
      row.innerHTML = "<span>" + x[1] + "</span>" + input;
      f.appendChild(row);
    });
  }
  $("paramForm").addEventListener("change", function (e) {
    var el = e.target, patch = {}, spec = FIELDS.find(function (x) { return x[0] === el.name; });
    if (!spec) return;
    if (spec[2] === "bool") patch[el.name] = el.checked;
    else if (spec[2] === "text") patch[el.name] = el.value.trim() || SF.DEFAULTS[el.name];
    else { var v = Math.min(spec[4], Math.max(spec[3], parseInt(el.value || "0", 10) || spec[3])); el.value = v; patch[el.name] = v; }
    SF.saveSettings(patch);
    $("savedTip").hidden = false; clearTimeout(window._st); window._st = setTimeout(function () { $("savedTip").hidden = true; }, 1800);
  });
  $("resetBtn").onclick = function () { SF.resetSettings(); renderForm(); };

  /* ---------- 词表 ---------- */
  var CAT = { word: "敏感词", brand: "品牌安全" };
  function renderWords() {
    var w = SF.words(), box = $("words"); box.innerHTML = "";
    Object.keys(CAT).forEach(function (cat) {
      var g = document.createElement("div"); g.className = "word-group";
      g.innerHTML = "<p>" + CAT[cat] + "（" + w[cat].length + "）</p>";
      var list = document.createElement("div"); list.className = "chips";
      w[cat].forEach(function (word, i) {
        var chip = document.createElement("button"); chip.className = "chip"; chip.type = "button";
        chip.innerHTML = esc(word) + '<span class="ico" data-icon="x"></span>';
        chip.setAttribute("aria-label", "删除 " + word);
        chip.onclick = function () { var ww = SF.words(); ww[cat].splice(i, 1); SF.saveWords(ww); renderWords(); };
        list.appendChild(chip);
      });
      g.appendChild(list); box.appendChild(g);
    });
    renderIcons(box);
  }
  $("wordAddBtn").onclick = function () {
    var v = $("wordInput").value.trim(), cat = $("wordCat").value;
    if (!v) return;
    var w = SF.words(); if (w[cat].indexOf(v) < 0) w[cat].push(v);
    SF.saveWords(w); $("wordInput").value = ""; renderWords();
  };
  $("wordResetBtn").onclick = function () { SF.resetWords(); renderWords(); };

  /* ---------- 数据 ---------- */
  function bars(el, rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
    el.innerHTML = rows.map(function (r) {
      return '<div class="bar"><span>' + r[0] + '</span><i style="width:' + (r[1] / max * 100) + '%"></i><b>' + r[1] + "</b></div>";
    }).join("");
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) + "%" : "0%"; }

  var lastSnap = "";
  function renderStats() {
    var s = SF.stats();
    var snap = JSON.stringify(s) + "|" + JSON.stringify(SF.reports());
    if (snap === lastSnap) return; // 数据没变就不重画，工作人员翻举报列表时不会被弹回顶部
    lastSnap = snap;
    var blockedTotal = Object.keys(s.blocked).reduce(function (a, k) { return a + s.blocked[k]; }, 0);
    var k = [
      ["今日轮次", s.rounds],
      ["出图 / 完成率", s.done + " / " + pct(s.done, s.rounds)],
      ["平均占用（秒）", s.occupyN ? Math.round(s.occupySum / s.occupyN) : 0],
      ["扫码预填占比", pct(s.fromCode, s.rounds)],
      ["超时 + 空闲退出", (s.timeouts || 0) + (s.idleOuts || 0)],
      ["换一张使用", s.rerolls],
      ["分享页打开 / 核销", s.shareOpens + " / " + (s.redeems || 0)],
      ["拦截总数", blockedTotal]
    ];
    $("kpis").innerHTML = k.map(function (x) { return '<div class="kpi"><p>' + x[0] + '</p><b class="dot">' + x[1] + "</b></div>"; }).join("");
    bars($("personaBars"), SF.PERSONAS.map(function (p) { return [p.zh, s.persona[p.id] || 0]; }));
    bars($("styleBars"), SF.STYLES.map(function (x) { return [x.zh, s.style[x.id] || 0]; }));
    bars($("blockBars"), [["敏感词", s.blocked.word], ["导流信息", s.blocked.contact], ["品牌安全", s.blocked.brand], ["非法字符", s.blocked.format], ["超长", s.blocked.length], ["伪造链接", s.blocked.tamper]]);
    var reps = SF.reports();
    var R = { vulgar: "低俗或辱骂", illegal: "违法违规", ad: "广告导流", other: "其他" };
    $("reports").innerHTML = reps.length ? reps.map(function (r) {
      return "<div><b class=\"dot\">No." + String(r.no || 0).padStart(4, "0") + "</b>" + (R[r.reason] || "") + "<span>" + esc(r.text || "") + "</span></div>";
    }).join("") : "<p>暂无举报</p>";
  }
  $("clearBtn").onclick = function () { if (confirm("清空今日所有统计和举报？")) { SF.clearStats(); renderStats(); } };
  $("exportBtn").onclick = function () {
    var s = SF.stats(), rows = [["指标", "数值"]];
    ["rounds", "done", "rerolls", "fromCode", "occupySum", "occupyN", "timeouts", "idleOuts", "shareOpens", "redeems"].forEach(function (k) { rows.push([k, s[k] || 0]); });
    Object.keys(s.blocked).forEach(function (k) { rows.push(["blocked." + k, s.blocked[k]]); });
    SF.PERSONAS.forEach(function (p) { rows.push(["persona." + p.id, s.persona[p.id] || 0]); });
    SF.STYLES.forEach(function (x) { rows.push(["style." + x.id, s.style[x.id] || 0]); });
    var csv = "﻿" + rows.map(function (r) { return r.join(","); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "sonifizz-stats.csv"; a.click();
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  renderIcons();
  renderForm();
  renderWords();
  renderStats();
  requestAnimationFrame(function () { document.body.classList.remove("booting"); }); // 数据和表单填好后再露面，刷新不闪
  window.addEventListener("storage", renderStats);
  setInterval(renderStats, 3000);
})();
