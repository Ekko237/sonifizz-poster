/* 手机分享页：解析 # 后参数 → 重新审核 → 按种子重画同一张海报 */
SF.fontsReady.then(function () {
  var $ = function (id) { return document.getElementById(id); };
  var cfg = SF.settings();
  document.querySelectorAll(".logo-mark").forEach(function (el) { el.innerHTML = SF.LOGO_SVG; });

  var m = location.hash.match(/(s|d)=([^&]+)/); // #s= 是短格式，#d= 是早先发出去的旧链接
  var d = m ? (m[1] === "s" ? SF.decodeShort(m[2]) : SF.decodeShare(m[2])) : null;
  // 打开时重新审一遍：校验码、枚举值、文字规则。任何一项不过都不画海报
  var check = d ? SF.checkText(d.n, d.t) : { ok: false };
  var valid = d && d.sigOk && SF.persona(d.p) && SF.style(d.s) && check.ok;
  // 页面语言跟海报语言走：英文海报扫出来就是英文页；「我也做一张」也带上语言
  var L = d && d.l === "en" ? "en" : "zh", T = function (k, v) { return SF.mt(L, k, v); };
  SF.applyMT(L); document.title = T("pageTitle");
  document.body.classList.toggle("embed", /[?&]embed=1/.test(location.search));
  if (L === "en") document.querySelectorAll(".pf-link").forEach(function (a) { a.href = "prefill.html?lang=en"; });

  if (!valid) {
    document.body.classList.add("bad-link");
    $("badView").hidden = false;
    $("reportBtn").hidden = true;
    if (m) SF.bump(function (s) {
      var why = !d || !d.sigOk || !SF.persona(d.p) || !SF.style(d.s) ? "tamper" : check.reason;
      s.blocked[why] = (s.blocked[why] || 0) + 1;
    });
  } else {
    $("okView").hidden = false;
    if (!/[?&]embed=1/.test(location.search)) SF.bump(function (s) { s.shareOpens++; }); // 电脑演示页右侧手机里打开的不算真实扫码
    var p = SF.persona(d.p);
    document.body.style.setProperty("--pc", SF.lum(p.c1) < 90 ? p.c2 : p.c1); // 深色人格用第二色，光才看得见
    $("giftCan").src = "assets/brand/can-" + p.id + "-1.webp";
    var who = (d.n || "").trim();
    $("pTitle").textContent = who ? T("whose", { n: who }) : T("you", { p: L === "en" ? p.en : p.zh });
    // 和你最合拍的那一派：罐子顶起来；六个罐子都能点，打开排队预填页并选好那一派
    var mt = SF.MATCH[p.id], mp = SF.persona(mt[0]);
    $("match").innerHTML = T("match", { p: "<b>" + (L === "en" ? mp.en : mp.zh) + "</b>", w: L === "en" ? mt[2] : mt[1] });
    $("inviteCans").innerHTML = SF.PERSONAS.map(function (x) {
      return '<a href="prefill.html?p=' + x.id + "&from=" + SF.encodeFrom(p.id, who || (L === "en" ? p.en : p.zh)) + (L === "en" ? "&lang=en" : "") + '"' + (x.id === mt[0] ? ' class="best"' : "") + ' aria-label="' + (L === "en" ? x.en : x.zh) + '">' +
        '<img src="assets/brand/can-' + x.id + '-1.webp" alt="" decoding="async"></a>';
    }).join("");
    // 合拍卡：被朋友邀请来测的，链接里带着邀请人（打开时重审一遍昵称）；上半是邀请人，下半是自己
    if (d.f && SF.persona(d.f.p) && SF.checkText(d.f.n, "ok").ok) {
      $("duoBox").hidden = false;
      $("duoTitle").textContent = T("duoTitle", { n: d.f.n });
      var duo = document.createElement("canvas");
      SF.renderDuo(duo, { p: d.f.p, n: d.f.n }, { p: p.id, n: who || (L === "en" ? p.en : p.zh), t: d.t }, L).then(function () {
        duo.toBlob(function (blob) {
          var u = URL.createObjectURL(blob); $("duoImg").src = u; $("duoImg").alt = T("duoTitle", { n: d.f.n });
          $("duoSave").onclick = function () { var a = document.createElement("a"); a.href = u; a.download = "SONIFIZZ-duo-" + d.no + ".jpg"; a.click(); };
        }, "image/jpeg", 0.92);
      });
    }
    // 声纹：和海报上印的是同一条；点「听一听」用这一派的音色把它弹一遍，柱子跟着依次亮
    var bars = $("voiceBars"), amps = SF.voiceOf(d, 32);
    bars.innerHTML = amps.map(function (a) { return '<i style="--a:' + a.toFixed(3) + '"></i>'; }).join("");
    $("voiceLine").textContent = L === "en" ? "\u201C" + d.t + "\u201D" : "「" + d.t + "」";
    $("voicePlay").onclick = function () {
      SF.sfx("melody", { p: p.id, amps: SF.voiceOf(d, 40) });
      var total = SF.MELODY.notes * SF.MELODY.step * 1000;
      bars.querySelectorAll("i").forEach(function (b, i) { b.style.animationDelay = Math.round(i / amps.length * total) + "ms"; });
      bars.classList.remove("playing"); void bars.offsetWidth; bars.classList.add("playing");
    };
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
    var small = document.createElement("canvas"), full = document.createElement("canvas"), reveal = null;
    var replay = $("replayBtn"), video = $("videoBtn"), videoLabel = $("videoLabel");
    var videoText = L === "en" ? "Save video" : "存成视频";
    $("replayLabel").textContent = L === "en" ? "Replay" : "重播";
    videoLabel.textContent = videoText;
    replay.disabled = true; video.disabled = true;
    SF.renderPoster(small, d, Object.assign({ scale: 0.5 }, opt)).then(function () { publish(small, false); });
    SF.renderPoster(full, d, opt).then(function () {
      publish(full, true);
      reveal = SF.makeReveal($("revealCanvas"), full, d);
      replay.disabled = false;
      video.disabled = !window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream || location.protocol === "file:"; // 双击本地文件打开时画布录不出来
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches && !document.body.classList.contains("embed")) { reveal.play(); reveal.sound(); } // 电脑演示外壳右边那台小手机里直接显示海报
    });
    replay.onclick = function () {
      if (!reveal || reveal.busy()) return;
      if (reveal.play()) reveal.sound();
    };
    video.onclick = function () {
      if (!reveal || reveal.busy() || video.disabled) return;
      video.disabled = true; replay.disabled = true;
      var ac = reveal.context();
      ac.resume().then(function () { // 录屏要等声音跑起来，旋律才录得进去；mp4 能录就录 mp4（手机相册和聊天软件都认），不然 webm
        var dest = reveal.audioDestination(ac), stream = $("revealCanvas").captureStream(30);
        dest.stream.getAudioTracks().forEach(function (track) { stream.addTrack(track); });
        var mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
        var recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000, audioBitsPerSecond: 96000 });
        var chunks = [];
        recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
        recorder.onerror = function () { toast(L === "en" ? "Video recording failed" : "视频录制失败"); };
        recorder.onstop = function () {
          reveal.disconnectAudio(); stream.getTracks().forEach(function (track) { track.stop(); });
          video.disabled = false; replay.disabled = false; videoLabel.textContent = videoText;
          if (!chunks.length) { toast(L === "en" ? "Video recording failed" : "视频录制失败"); return; }
          var urlVideo = URL.createObjectURL(new Blob(chunks, { type: mime })), a = document.createElement("a");
          a.href = urlVideo; a.download = "SONIFIZZ-" + d.no + (mime === "video/mp4" ? ".mp4" : ".webm"); a.click();
          setTimeout(function () { URL.revokeObjectURL(urlVideo); }, 60000);
        };
        recorder.start();
        reveal.play(function (n) { videoLabel.textContent = Math.round(n * 100) + "%"; }, function () { recorder.stop(); });
        reveal.sound();
      });
    };
    $("saveBtn").onclick = function () {
      if (!url) return toast(fullShown ? T("holdSave") : T("saveWait"));
      var a = document.createElement("a"); a.href = url; a.download = "SONIFIZZ-" + d.no + ".jpg"; a.click();
    };
    /* 分享给朋友：发一张长图，海报下面接一条「你是哪一派？扫码测一测」和这一页的二维码，朋友圈里点不了的链接也能扫；
       手机上用系统分享直接发图，电脑上没有发图的分享就存下来、顺手把链接复制好 */
    var pageLink = location.href.replace(/[?&]embed=1/, "");
    function copyLink(msg) {
      (navigator.clipboard ? navigator.clipboard.writeText(pageLink) : Promise.reject()).then(function () { toast(msg || T("copied")); }, function () { toast(T("copyManual")); });
    }
    function shareCard() {
      var head = T("cardHead").split("\n"), sub = T("cardSub", { b: L === "en" ? cfg.boothEn : cfg.boothZh });
      return document.fonts.load('64px "Smiley Sans Oblique"', head.join("")).then(function () {
        var W = 1080, PH = 1920, H = PH + 330, c = document.createElement("canvas"), x = c.getContext("2d");
        c.width = W; c.height = H;
        x.drawImage(full, 0, 0, W, PH);
        x.fillStyle = "#0c0c0d"; x.fillRect(0, PH, W, H - PH);
        x.fillStyle = SF.lum(p.c1) < 90 ? p.c2 : p.c1; x.fillRect(0, PH, W, 10); // 人格色的一道，接住海报
        var q = qrcode(0, "M"); q.addData(pageLink); q.make();
        var n = q.getModuleCount(), size = 252, cell = size / (n + 4), qx = W - 56 - size, qy = PH + 10 + (H - PH - 10 - size) / 2;
        x.fillStyle = "#f3f3ef"; x.beginPath(); x.roundRect(qx, qy, size, size, 20); x.fill();
        x.fillStyle = "#0c0c0d";
        for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(qx + (k + 2) * cell, qy + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
        var maxW = qx - 40 - 56, fs = 72;
        x.textAlign = "left"; x.fillStyle = "#f3f3ef";
        for (; fs > 40; fs -= 2) { x.font = fs + 'px "Smiley Sans Oblique",' + SF.FONT_CN; if (head.every(function (l) { return x.measureText(l).width <= maxW; })) break; }
        head.forEach(function (l, i) { x.fillText(l, 56, PH + 110 + i * fs * 1.12); });
        x.font = "600 30px " + SF.FONT_CN; x.fillStyle = "#b4b4ae"; x.fillText(sub, 56, H - 56);
        return new Promise(function (res) { c.toBlob(res, "image/jpeg", 0.9); });
      });
    }
    $("shareBtn").onclick = function () {
      if (location.protocol === "file:") return copyLink(); // 双击本地文件打开时画布导不出图
      if (!fullShown) return toast(T("cardWait"));
      shareCard().then(function (blob) {
        var file = new File([blob], "SONIFIZZ-" + d.no + "-share.jpg", { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: T("shareTitle", { p: L === "en" ? p.en : p.zh }), text: pageLink }).catch(function () {}); // 在分享面板里点了取消
          return;
        }
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        copyLink(T("cardSaved"));
      });
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
      $("giftStamp").textContent = T("redeemed");
    }
    var holdTimer = 0, rb = $("redeemBtn"); // 店员长按 0.8 秒才核销：按钮里一条进度跟着走，松手就取消
    function holdEnd() { clearTimeout(holdTimer); rb.classList.remove("holding"); }
    rb.addEventListener("pointerdown", function (e) {
      if (SF.isRedeemed(key)) return;
      e.preventDefault(); rb.classList.add("holding"); SF.buzz(10);
      holdTimer = setTimeout(function () {
        rb.classList.remove("holding");
        SF.redeem(key); SF.bump(function (s) { s.redeems++; }); SF.sfx("stamp"); SF.buzz(30); $("gift").classList.add("just-used"); paintGift(); toast(T("redeemOk"));
      }, 800);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { rb.addEventListener(ev, holdEnd); });
    rb.addEventListener("contextmenu", function (e) { e.preventDefault(); }); // 长按不弹系统菜单
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
