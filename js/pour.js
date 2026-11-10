/* 生成中的「倒汽」动画：海报像一杯气水从下往上倒满。
   液面就是这句话的声纹（和海报上印的是同一条），液面下面一层白色泡沫，人格色的气泡往上冒、到液面破开溅出水珠；
   液体里是海报插画的网点（只取图形，不取文字）。倒满以后网点从中间往两边、按声纹的响度一颗颗化开，露出清晰的海报，
   然后整张海报直接缩放移动到结果页的位置。声音（声纹）+ 气泡（气水）= 声汽。 */
(function () {
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

  // o：off 整张海报、bare 不带文字的插画、cv 画布、p 人格、vp 声纹、reduce 减少动态效果、done 倒满以后调用。返回停止函数，离开生成屏时调用
  SF.pour = function (o) {
    var off = o.off, cv = o.cv, ctx = cv.getContext("2d"), p = o.p, vp = o.vp, done = o.done, raf = 0, timer = 0;
    var stop = function () { cancelAnimationFrame(raf); clearTimeout(timer); };
    var W = cv.width, H = cv.height, S = 30, TAU = Math.PI * 2;
    if (o.reduce) { ctx.drawImage(off, 0, 0); timer = setTimeout(done, 900); return stop; }
    var dots = sampleDots(o.bare, S, p), tint = SF.lum(p.c1) < 90 ? p.c2 : p.c1;
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
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return stop;
  };
})();
