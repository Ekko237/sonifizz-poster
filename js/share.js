/* 手机分享页：解析 # 后参数 → 重新审核 → 按种子重画同一张海报 */
SF.fontsReady.then(function () {
  var $ = function (id) { return document.getElementById(id); };
  var cfg = SF.settings();
  document.querySelectorAll(".logo-mark").forEach(function (el) { el.innerHTML = SF.LOGO_SVG; });

  var m = location.hash.match(/d=([^&]+)/);
  var d = m ? SF.decodeShare(m[1]) : null;
  // 打开时重新审一遍：校验码、枚举值、文字规则。任何一项不过都不画海报
  var check = d ? SF.checkText(d.n, d.t) : { ok: false };
  var valid = d && d.sigOk && SF.persona(d.p) && SF.style(d.s) && check.ok;
  // 页面语言跟海报语言走：英文海报扫出来就是英文页；「我也做一张」也带上语言
  var L = d && d.l === "en" ? "en" : "zh", T = function (k, v) { return SF.mt(L, k, v); };
  SF.applyMT(L); document.title = T("pageTitle");
  if (L === "en") document.querySelectorAll(".pf-link").forEach(function (a) { a.href = "prefill.html?lang=en"; });

  if (!valid) {
    $("badView").hidden = false;
    $("reportBtn").hidden = true;
    if (m) SF.bump(function (s) {
      var why = !d || !d.sigOk || !SF.persona(d.p) || !SF.style(d.s) ? "tamper" : check.reason;
      s.blocked[why] = (s.blocked[why] || 0) + 1;
    });
  } else {
    $("okView").hidden = false;
    SF.bump(function (s) { s.shareOpens++; });
    var p = SF.persona(d.p);
    $("pTitle").textContent = T("you", { p: L === "en" ? p.en : p.zh });
    $("pMotto").textContent = L === "en" ? p.mottoEn : p.mottoZh;
    // 先用缩略图马上画一版（小、快），大图到了再换成清晰版；转图片用 toBlob 异步编码，不卡住页面
    var url = null, fullShown = false, img = $("posterImg"), opt = { lang: d.l || "zh", hideNick: false }; // 手机上始终显示真实昵称（大屏隐藏昵称只管大屏）
    function publish(canvas, isFull) {
      if (fullShown) return;
      if (isFull) fullShown = true;
      var done = function () { img.alt = T("alt"); $("posterBox").classList.add("loaded"); };
      try {
        canvas.toBlob(function (blob) {
          if (!blob) return;
          if (!isFull && fullShown) return;
          var u = URL.createObjectURL(blob);
          img.onload = done; img.src = u;
          if (isFull) url = u;
        }, "image/jpeg", isFull ? 0.92 : 0.85);
      } catch (e) { // 本地 file:// 打开时画布不能导出，直接显示画布
        if (!isFull) return;
        canvas.className = "poster-img"; img.replaceWith(canvas); img = canvas; done();
      }
    }
    var small = document.createElement("canvas"), full = document.createElement("canvas");
    SF.renderPoster(small, d, Object.assign({ scale: 0.5 }, opt)).then(function () { publish(small, false); });
    SF.renderPoster(full, d, opt).then(function () { publish(full, true); });
    $("saveBtn").onclick = function () {
      if (!url) return toast(fullShown ? T("holdSave") : T("saveWait"));
      var a = document.createElement("a"); a.href = url; a.download = "SONIFIZZ-" + d.no + ".jpg"; a.click();
    };
    $("shareBtn").onclick = function () {
      if (navigator.share) navigator.share({ title: T("shareTitle", { p: L === "en" ? p.en : p.zh }), url: location.href }).catch(function () {});
      else { (navigator.clipboard ? navigator.clipboard.writeText(location.href) : Promise.reject()).then(function () { toast(T("copied")); }, function () { toast(T("copyManual")); }); }
    };

    var key = d.seed + "-" + d.no;
    $("giftTitle").innerHTML = T("gift", { f: L === "en" ? p.flavorEn : p.flavorZh }); // 固定断行位置，手机窄屏不会只剩一个字
    $("giftWhere").textContent = L === "en" ? cfg.boothEn : cfg.boothZh;
    $("giftCode").textContent = SF.redeemCode(d);
    function paintGift() {
      var used = SF.isRedeemed(key);
      $("gift").classList.toggle("used", used);
      $("redeemBtn").disabled = used;
      $("redeemLabel").textContent = used ? T("redeemed") : T("redeem");
    }
    $("redeemBtn").onclick = function () {
      if (SF.isRedeemed(key)) return;
      SF.redeem(key); SF.bump(function (s) { s.redeems++; }); paintGift(); toast(T("redeemOk"));
    };
    paintGift();
  }

  /* 举报 */
  var reason = null;
  $("reportBtn").onclick = function () { $("reportSheet").hidden = false; };
  $("reportCancel").onclick = function () { $("reportSheet").hidden = true; };
  document.querySelectorAll(".sheet .opt").forEach(function (b) {
    b.onclick = function () {
      reason = b.dataset.r;
      document.querySelectorAll(".sheet .opt").forEach(function (x) { x.classList.toggle("sel", x === b); });
      $("reportSubmit").disabled = false;
    };
  });
  $("reportSubmit").onclick = function () {
    SF.addReport({ reason: reason, no: d && d.no, p: d && d.p, text: d && d.t });
    $("reportSheet").hidden = true; toast(T("reportOk"));
  };

  function toast(msg) {
    var el = document.createElement("div"); el.className = "toast"; el.textContent = msg;
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 2000);
  }
  renderIcons();
  // 判断完是正常页还是“无法显示”之后再露面，避免底栏先跳出来
  requestAnimationFrame(function () { document.body.classList.remove("booting"); });
});
