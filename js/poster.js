/* 海报绘制：人格 × 风格 × 随机种子 → 1080×1920 竖版海报。
   大屏、分享页、预填页共用这一份代码，同一个种子画出同一张图。
   分工：人格决定「画什么 + 用什么颜色」（母题），风格决定「怎么画」（画笔），种子决定构图细节。
   用户输入的昵称和一句话只在最后作为文字排版叠上去，不参与图形生成（正式版同理：不进 AI 提示词）。 */
(function () {
  var W = 1080, H = 1920;
  var ART = { x: 0, y: 150, w: 1080, h: 1040, cx: 540, cy: 670 }; // 图形区
  var CN = '"PingFang SC","Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
  var DOT = '"Doto",' + CN;
  var BRAND = "#e2ff2e";

  // 点阵字体加载完再画 canvas，否则第一张会用回落字体
  SF.fontsReady = (document.fonts && document.fonts.load) ? document.fonts.load('900 40px "Doto"').catch(function () {}) : Promise.resolve();
  SF.newSeed = function () { return Math.floor(Math.random() * 2147483647); };

  function rng(seed) { // mulberry32：同种子同序列
    var a = seed >>> 0;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* ---------- 颜色工具 ---------- */
  function hex(c) { c = c.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(c.substr(i, 2), 16); }); }
  function lum(c) { var v = hex(c); return (v[0] * 299 + v[1] * 587 + v[2] * 114) / 1000; }
  function isLight(c) { return lum(c) > 150; }
  function toHex(v) { return "#" + v.map(function (x) { return ("0" + Math.round(x).toString(16)).slice(-2); }).join(""); }
  function mix(c, d, k) { var a = hex(c), b = hex(d); return toHex(a.map(function (x, i) { return x + (b[i] - x) * k; })); }
  function rgba(c, a) { var v = hex(c); return "rgba(" + v.join(",") + "," + a + ")"; }
  SF.isLight = isLight;

  /* ---------- 四种画笔（风格） ----------
     每支画笔提供：bg() 背景、fill(path, color) 填充形状、stroke(path, color, w) 线条、after() 表面质感。 */
  function makePen(ctx, style, p, r) {
    var c1 = p.c1, c2 = p.c2, pen = { ctx: ctx, p: p };
    if (style === "neon") {
      // 霓虹夜场：深底 + 发光描边 + 扫描线。深色人格色提亮，保证在黑底上看得见
      var n1 = lum(c1) < 90 ? mix(c1, "#ffffff", 0.55) : c1, n2 = lum(c2) < 90 ? mix(c2, "#ffffff", 0.55) : c2;
      pen.col = [n1, n2]; pen.ink = "#f3f3ef"; pen.bgc = "#0b0b0e";
      pen.bg = function () {
        ctx.fillStyle = pen.bgc; ctx.fillRect(0, 0, W, H);
        var g = ctx.createRadialGradient(ART.cx, ART.cy, 50, ART.cx, ART.cy, 760);
        g.addColorStop(0, rgba(n1, 0.28)); g.addColorStop(1, rgba(n1, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      };
      pen.fill = function (path, col) {
        ctx.save(); path(); ctx.fillStyle = col; ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1;
        ctx.shadowColor = col; ctx.shadowBlur = 34; ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.stroke(); ctx.restore();
      };
      pen.stroke = function (path, col, w) {
        ctx.save(); path(); ctx.shadowColor = col; ctx.shadowBlur = 30; ctx.strokeStyle = col; ctx.lineWidth = Math.max(4, w * 0.6); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); ctx.restore();
      };
      pen.after = function () {
        ctx.fillStyle = "rgba(0,0,0,0.22)";
        for (var y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
      };
    } else if (style === "riso") {
      // 复古丝印：米白纸 + 两块色版正片叠底 + 第二块色版错位 + 颗粒
      pen.col = [c1, isLight(c2) ? mix(c2, c1, 0.35) : c2]; pen.ink = "#1b1b1b"; pen.bgc = "#efebe2";
      var mx = (r() - 0.5) * 14, my = (r() - 0.5) * 14;
      pen.bg = function () { ctx.fillStyle = pen.bgc; ctx.fillRect(0, 0, W, H); };
      pen.fill = function (path, col) {
        ctx.save(); ctx.globalCompositeOperation = "multiply";
        if (col === pen.col[1]) ctx.translate(mx, my);
        path(); ctx.fillStyle = col; ctx.globalAlpha = 0.9; ctx.fill(); ctx.restore();
      };
      pen.stroke = function (path, col, w) {
        ctx.save(); ctx.globalCompositeOperation = "multiply";
        if (col === pen.col[1]) ctx.translate(mx, my);
        path(); ctx.strokeStyle = col; ctx.globalAlpha = 0.9; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(); ctx.restore();
      };
      pen.after = function () { grain(ctx, r, 0.10, 9000); };
    } else if (style === "pop") {
      // 波普拼贴：人格主色满底 + 半调网点 + 粗黑描边
      var dark = !isLight(c1);
      pen.col = [c2, dark ? "#f3f3ef" : "#141414"]; pen.ink = dark ? "#f3f3ef" : "#141414"; pen.bgc = c1;
      pen.bg = function () {
        ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)";
        for (var y = 0; y < H; y += 28) for (var x = (y / 28) % 2 ? 14 : 0; x < W; x += 28) {
          var k = 1 - Math.abs(y - ART.cy) / 1100; if (k <= 0) continue;
          ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, 7); ctx.fill();
        }
      };
      pen.fill = function (path, col) {
        ctx.save(); path(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = 10; ctx.lineJoin = "round"; ctx.stroke(); ctx.restore();
      };
      pen.stroke = function (path, col, w) {
        ctx.save(); path(); ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.strokeStyle = "#111"; ctx.lineWidth = w + 14; ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.restore();
      };
      pen.after = function () {};
    } else {
      // 极简瑞士：浅底 + 细网格 + 纯色平涂，不描边不发光
      pen.col = [lum(c1) > 200 ? mix(c1, "#111111", 0.2) : c1, isLight(c2) && isLight(c1) ? mix(c2, "#111111", 0.25) : c2];
      pen.ink = "#121212"; pen.bgc = "#f2f1ec";
      pen.bg = function () {
        ctx.fillStyle = pen.bgc; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.lineWidth = 2;
        for (var x = 72; x < W; x += 78) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      };
      pen.fill = function (path, col) { ctx.save(); path(); ctx.fillStyle = col; ctx.fill(); ctx.restore(); };
      pen.stroke = function (path, col, w) { ctx.save(); path(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "butt"; ctx.lineJoin = "miter"; ctx.stroke(); ctx.restore(); };
      pen.after = function () {};
    }
    return pen;
  }

  function grain(ctx, r, alpha, n) {
    ctx.save(); ctx.fillStyle = "rgba(40,30,20," + alpha + ")";
    for (var i = 0; i < n; i++) ctx.fillRect(r() * W, r() * H, 2, 2);
    ctx.restore();
  }

  /* ---------- 形状工具 ---------- */
  function P(ctx, fn) { return function () { ctx.beginPath(); fn(); }; }
  function poly(ctx, pts) { return P(ctx, function () { pts.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); }); }
  function star(cx, cy, R, rr, n, rot) {
    var pts = []; for (var i = 0; i < n * 2; i++) { var a = rot + i * Math.PI / n, d = i % 2 ? rr : R; pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); } return pts;
  }
  function ngon(cx, cy, R, n, rot) { var pts = []; for (var i = 0; i < n; i++) { var a = rot + i * Math.PI * 2 / n; pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } return pts; }
  function circle(ctx, x, y, rad) { return P(ctx, function () { ctx.arc(x, y, rad, 0, Math.PI * 2); }); }
  function between(r, a, b) { return a + r() * (b - a); }
  function roundRect(ctx, x, y, w, h, rad) {
    ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
  }

  /* ---------- 六个人格的母题 ---------- */
  var MOTIF = {
    rock: function (ctx, pen, r) { // 爆裂放射线 + 闪电 + 碎裂声波
      var cx = ART.cx + between(r, -120, 120), cy = ART.cy + between(r, -120, 60), n = 18 + Math.floor(r() * 8);
      for (var i = 0; i < n; i++) {
        var a = i * Math.PI * 2 / n + between(r, -0.06, 0.06), len = between(r, 380, 720), wd = between(r, 0.035, 0.07);
        pen.fill(poly(ctx, [[cx, cy], [cx + Math.cos(a - wd) * len, cy + Math.sin(a - wd) * len], [cx + Math.cos(a + wd) * len, cy + Math.sin(a + wd) * len]]), pen.col[i % 2]);
      }
      var bolts = 1 + (r() < 0.5 ? 1 : 0);
      for (var b = 0; b < bolts; b++) {
        var bx = ART.cx + between(r, -260, 200), by = ART.y + between(r, 40, 180), s = between(r, 0.8, 1.2);
        pen.fill(poly(ctx, [[bx, by], [bx + 190 * s, by], [bx + 90 * s, by + 280 * s], [bx + 230 * s, by + 280 * s], [bx - 20 * s, by + 700 * s], [bx + 60 * s, by + 380 * s], [bx - 80 * s, by + 380 * s]]), pen.col[1]);
      }
      var y0 = ART.y + ART.h - 120;
      pen.stroke(P(ctx, function () { ctx.moveTo(40, y0); for (var x = 40; x <= 1040; x += 40) ctx.lineTo(x, y0 + (r() - 0.5) * between(r, 40, 180)); }), pen.col[0], 14);
    },
    edm: function (ctx, pen, r) { // 透视网格 + 同心圆 + 脉冲波形
      var hz = ART.cy + 120, vx = ART.cx + between(r, -80, 80);
      for (var i = -8; i <= 8; i++) pen.stroke(P(ctx, function () { ctx.moveTo(vx, hz); ctx.lineTo(vx + i * 150, ART.y + ART.h); }), pen.col[1], 4);
      for (var k = 1; k < 7; k++) { var y = hz + Math.pow(k / 6, 1.8) * (ART.y + ART.h - hz); pen.stroke(P(ctx, function () { ctx.moveTo(0, y); ctx.lineTo(W, y); }), pen.col[1], 4); }
      var rx = ART.cx + between(r, -100, 100), ry = ART.cy - between(r, 140, 240);
      for (var j = 0; j < 6; j++) pen.stroke(circle(ctx, rx, ry, 70 + j * 52), pen.col[j % 2 ? 1 : 0], j === 0 ? 14 : 8);
      var py = hz - 30;
      pen.stroke(P(ctx, function () {
        ctx.moveTo(0, py); var x = 0;
        while (x < W) { x += between(r, 40, 90); if (r() < 0.35) { ctx.lineTo(x, py - between(r, 80, 220)); x += 20; ctx.lineTo(x, py + between(r, 30, 90)); x += 20; } ctx.lineTo(x, py); }
      }), pen.col[0], 10);
    },
    folk: function (ctx, pen, r) { // 半圆太阳 + 飘带 + 层叠山峦
      var sx = ART.cx + between(r, -220, 220), sy = ART.cy + 40;
      pen.fill(P(ctx, function () { ctx.arc(sx, sy, between(r, 200, 270), Math.PI, 0); ctx.closePath(); }), pen.col[0]);
      pen.stroke(P(ctx, function () { var y = ART.y + between(r, 120, 260); ctx.moveTo(-20, y); ctx.bezierCurveTo(300, y - 160, 700, y + 200, 1100, y - 40); }), pen.col[1], 22);
      for (var layer = 0; layer < 3; layer++) {
        var base = ART.cy + 120 + layer * 110, pts = [[-20, ART.y + ART.h + 40]], x = -20;
        while (x < W + 40) { x += between(r, 120, 260); pts.push([x, base - between(r, 60, 260)]); x += between(r, 60, 140); pts.push([x, base + between(r, 0, 60)]); }
        pts.push([W + 20, ART.y + ART.h + 40]);
        pen.fill(poly(ctx, pts), pen.col[layer % 2 ? 0 : 1]);
      }
    },
    hiphop: function (ctx, pen, r) { // 大贴纸块 + 皇冠 + 星星 + 喷漆点
      ctx.save(); ctx.translate(ART.cx, ART.cy - 40); ctx.rotate(between(r, -0.18, 0.18));
      pen.fill(P(ctx, function () { roundRect(ctx, -330, -260, 660, 520, 60); }), pen.col[0]);
      pen.fill(poly(ctx, [[-230, 110], [-250, -140], [-120, -30], [0, -200], [120, -30], [250, -140], [230, 110]]), pen.col[1]);
      ctx.restore();
      for (var i = 0; i < 7; i++) {
        var R = between(r, 40, 110);
        pen.fill(poly(ctx, star(between(r, 80, 1000), between(r, ART.y + 40, ART.y + ART.h - 60), R, R * 0.45, 5, r() * 6)), pen.col[i % 2]);
      }
      var dx = between(r, 150, 930), dy = ART.y + ART.h - 160;
      ctx.save(); ctx.fillStyle = pen.col[1];
      for (var d = 0; d < 180; d++) { var a = r() * 6.3, dist = Math.pow(r(), 1.8) * 220; ctx.beginPath(); ctx.arc(dx + Math.cos(a) * dist * 1.6, dy + Math.sin(a) * dist * 0.6, between(r, 2, 9), 0, 7); ctx.fill(); }
      ctx.restore();
    },
    jazz: function (ctx, pen, r) { // 流动曲线 + 黑胶唱片 + 音符
      for (var c = 0; c < 3; c++) {
        var y = ART.y + between(r, 80, ART.h - 80);
        pen.stroke(P(ctx, function () { ctx.moveTo(-40, y); ctx.bezierCurveTo(260, y - between(r, 200, 400), 760, y + between(r, 200, 400), 1120, y - between(r, -100, 100)); }), pen.col[c % 2 ? 0 : 1], between(r, 8, 18));
      }
      var vx = ART.cx + between(r, -140, 140), vy = ART.cy - 40, R = between(r, 300, 360);
      pen.fill(circle(ctx, vx, vy, R), pen.col[0]);
      for (var g = R - 30; g > R * 0.4; g -= 26) pen.stroke(circle(ctx, vx, vy, g), pen.bgc, 2);
      pen.fill(circle(ctx, vx, vy, R * 0.3), pen.col[1]);
      pen.fill(circle(ctx, vx, vy, 12), pen.bgc);
      for (var n = 0; n < 3; n++) {
        var nx = between(r, 100, 940), ny = between(r, ART.y + 180, ART.y + ART.h - 60), s = between(r, 0.8, 1.3);
        pen.fill(P(ctx, function () { ctx.ellipse(nx, ny, 40 * s, 30 * s, -0.4, 0, 7); }), pen.col[1]);
        pen.stroke(P(ctx, function () { ctx.moveTo(nx + 36 * s, ny - 10 * s); ctx.lineTo(nx + 36 * s, ny - 170 * s); ctx.quadraticCurveTo(nx + 100 * s, ny - 120 * s, nx + 90 * s, ny - 60 * s); }), pen.col[1], 12 * s);
      }
    },
    indie: function (ctx, pen, r) { // 柔光斑 + 漂浮几何
      for (var f = 0; f < 3; f++) {
        var fx = between(r, 150, 930), fy = between(r, ART.y + 100, ART.y + ART.h - 100), fr = between(r, 220, 400);
        var gl = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
        gl.addColorStop(0, rgba(f % 2 ? pen.col[1] : pen.col[0], 0.5)); gl.addColorStop(1, rgba(pen.col[0], 0));
        ctx.fillStyle = gl; ctx.fillRect(0, ART.y - 200, W, ART.h + 400);
      }
      for (var i = 0; i < 11; i++) {
        var x = between(r, 90, 990), y = between(r, ART.y + 60, ART.y + ART.h - 60), s = between(r, 40, 150), t = Math.floor(r() * 3), rot = r() * 6;
        var col = pen.col[i % 2];
        if (t === 0) pen.fill(circle(ctx, x, y, s * 0.6), col);
        else pen.fill(poly(ctx, ngon(x, y, s * 0.75, t === 1 ? 3 : 4, rot)), col);
      }
    }
  };

  /* 品牌彩蛋：1 到 3 个气泡（圆 + 高光），藏在图形区里 */
  function bubbles(ctx, pen, r) {
    var n = 1 + Math.floor(r() * 3);
    for (var i = 0; i < n; i++) {
      var x = between(r, 120, 960), y = between(r, ART.y + 80, ART.y + ART.h - 80), rad = between(r, 22, 48);
      ctx.save(); ctx.strokeStyle = pen.ink; ctx.globalAlpha = 0.75; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, rad * 0.62, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke(); ctx.restore();
    }
  }

  /* 产品小元素：品牌条左侧的罐子，罐身是人格口味色 */
  function can(ctx, x, y, color) {
    ctx.save();
    ctx.fillStyle = "#0c0c0d"; ctx.beginPath(); roundRect(ctx, x - 5, y - 5, 88, 150, 18); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); roundRect(ctx, x, y, 78, 140, 14); ctx.fill();
    ctx.fillStyle = "#0c0c0d"; ctx.fillRect(x, y + 52, 78, 34);
    ctx.fillStyle = BRAND; ctx.font = "900 20px " + DOT; ctx.textAlign = "center"; ctx.fillText("FIZZ", x + 39, y + 76);
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.fillRect(x + 12, y + 14, 7, 30);
    ctx.restore();
  }

  /* 引用句排版：一行放得下就一行；放不下就平均切成两行（行首不放标点），还放不下就缩小字号 */
  var NO_HEAD = "」，。！？、；：,.!?;:)";
  function quote(ctx, text, x, y, max, size, minSize) {
    var chars = Array.from(text);
    for (var fs = size; fs >= minSize; fs -= 4) {
      ctx.font = "800 " + fs + "px " + CN;
      if (ctx.measureText(text).width <= max) { ctx.fillText(text, x, y); return { lines: 1, lh: fs * 1.28 }; }
      var cut = Math.ceil(chars.length / 2);
      while (cut < chars.length - 1 && NO_HEAD.indexOf(chars[cut]) >= 0) cut++;
      var l1 = chars.slice(0, cut).join(""), l2 = chars.slice(cut).join("");
      if (ctx.measureText(l1).width <= max && ctx.measureText(l2).width <= max) {
        ctx.fillText(l1, x, y); ctx.fillText(l2, x, y + fs * 1.28); return { lines: 2, lh: fs * 1.28 };
      }
    }
    ctx.fillText(text, x, y, max); return { lines: 1, lh: minSize * 1.28 };
  }

  /* ---------- 主入口 ----------
     d: { p 人格, s 风格, seed 种子, n 昵称, t 一句话, no 流水号, l 语言 }
     opt: { lang, hideNick 大屏隐藏昵称, mystery 隐藏时显示的称呼 } */
  SF.drawPoster = function (canvas, d, opt) {
    opt = opt || {};
    var p = SF.persona(d.p) || SF.PERSONAS[0], s = SF.style(d.s) || SF.STYLES[0];
    var lang = opt.lang || d.l || "zh";
    var sc = opt.scale || 1; // 缩略图按比例缩小画布，坐标仍按 1080×1920 写
    canvas.width = Math.round(W * sc); canvas.height = Math.round(H * sc);
    var ctx = canvas.getContext("2d"), r = rng(d.seed || 1);
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";

    var pen = makePen(ctx, s.id, p, r);
    var bg = opt.bg; // 素材池里的 AI 背景图（正式版通道一）；没有时用程序化母题兜底
    if (bg) {
      drawCover(ctx, bg);
      var tone = toneOf(bg);
      if (tone) { pen.ink = tone.light ? "#141414" : "#f3f3ef"; pen.bgc = tone.hex; }
    } else {
      pen.bg();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 110, W, ART.h + 120); ctx.clip(); // 图形只画在上半区
      MOTIF[p.id](ctx, pen, r);
      bubbles(ctx, pen, r);
      ctx.restore();
      pen.after();
    }

    // 顶部信息行（AI 背景上先压一层淡淡的渐变，保证小字看得清）
    var ink = pen.ink;
    if (bg) {
      var top = ctx.createLinearGradient(0, 0, 0, 150);
      top.addColorStop(0, rgba(pen.bgc, 0.75)); top.addColorStop(1, rgba(pen.bgc, 0));
      ctx.fillStyle = top; ctx.fillRect(0, 0, W, 150);
    }
    ctx.fillStyle = ink; ctx.font = "900 32px " + DOT;
    ctx.fillText("MUSIC PERSONA", 64, 86);
    ctx.textAlign = "right"; ctx.fillText("No." + String(d.no || 0).padStart(4, "0"), W - 64, 86); ctx.textAlign = "left";

    // 文字区：从图形区渐变过渡到底色，保证字清楚
    var ty = ART.y + ART.h + 20;
    if (bg) {
      var veil = ctx.createLinearGradient(0, ty - 200, 0, H - 150);
      veil.addColorStop(0, rgba(pen.bgc, 0)); veil.addColorStop(0.35, rgba(pen.bgc, 0.72)); veil.addColorStop(1, rgba(pen.bgc, 0.9));
      ctx.fillStyle = veil; ctx.fillRect(0, ty - 200, W, H - 150 - ty + 200);
    } else {
      var fade = ctx.createLinearGradient(0, ty - 140, 0, ty + 30);
      fade.addColorStop(0, rgba(pen.bgc, 0)); fade.addColorStop(1, rgba(pen.bgc, 1));
      ctx.fillStyle = fade; ctx.fillRect(0, ty - 140, W, 170);
      ctx.fillStyle = pen.bgc; ctx.fillRect(0, ty + 30, W, H - 150 - ty - 30);
      if (s.id === "neon") { ctx.fillStyle = "rgba(0,0,0,0.22)"; for (var yy = ty + 30; yy < H - 150; yy += 6) ctx.fillRect(0, yy, W, 2); }
      if (s.id === "riso") grain(ctx, rng((d.seed || 1) + 7), 0.08, 2500);
    }

    var name = lang === "en" ? p.en : p.zh, sub = lang === "en" ? p.zh : p.en;
    ctx.fillStyle = ink;
    ctx.font = lang === "en" ? "900 100px " + DOT : "900 132px " + CN;
    if (s.id === "neon") { ctx.shadowColor = pen.col[1]; ctx.shadowBlur = 28; }
    if (s.id === "pop" && !bg) { ctx.lineWidth = 14; ctx.strokeStyle = "#111"; ctx.lineJoin = "round"; if (ink !== "#141414") ctx.strokeText(name, 64, ty + 118, W - 128); }
    if (bg && ink !== "#141414") { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 18; }
    ctx.fillText(name, 64, ty + 118, W - 128);
    ctx.shadowBlur = 0;
    ctx.font = lang === "en" ? "900 50px " + CN : "900 50px " + DOT;
    var subCol = s.id === "neon" ? pen.col[1] : (s.id === "pop" ? ink : pen.col[0]);
    if (bg) subCol = ink;
    if (!bg && (s.id === "riso" || s.id === "swiss") && lum(subCol.charAt(0) === "#" ? subCol : "#888888") > 140) subCol = mix(p.c1, "#111111", 0.45); // 浅底上的浅色压深，保证看得清
    ctx.fillStyle = subCol;
    ctx.fillText(sub, 68, ty + 190, W - 136);

    ctx.fillStyle = ink;
    var q = { lines: 1, lh: 82 };
    if (d.t) q = quote(ctx, lang === "en" ? "\u201C" + d.t + "\u201D" : "「" + d.t + "」", 52, ty + 296, W - 116, 64, 48);
    var who = opt.hideNick ? (opt.mystery || "神秘乐迷") : (d.n || "");
    if (who) { ctx.font = "600 44px " + CN; ctx.globalAlpha = 0.78; ctx.fillText(who, 64, ty + 296 + q.lines * q.lh + 20, W - 128); ctx.globalAlpha = 1; }

    // 品牌条：底部荧光黄 + 罐子 + 口味 + 活动名。占 8%，是签名不是主角
    ctx.fillStyle = BRAND; ctx.fillRect(0, H - 150, W, 150);
    can(ctx, 60, H - 214, p.c1);
    ctx.fillStyle = "#0c0c0d";
    ctx.font = "900 46px " + DOT; ctx.fillText("SONIFIZZ", 176, H - 62);
    ctx.font = "700 34px " + CN;
    ctx.fillText(lang === "en" ? p.flavorEn : "声汽 " + p.flavorZh + "味", 452, H - 64);
    ctx.textAlign = "right"; ctx.font = "900 30px " + DOT; ctx.fillText("FEST 2026", W - 64, H - 64); ctx.textAlign = "left";
  };

  function drawCover(ctx, img) {
    var k = Math.max(W / img.width, H / img.height), w = img.width * k, h = img.height * k;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
  // 取背景图文字区（下半部）的平均色，决定文字用深色还是浅色。每张图只算一次；
  // file:// 打开时浏览器不让读像素，读不到就按风格默认
  function toneOf(img) {
    if (img._tone !== undefined) return img._tone;
    try {
      var c = document.createElement("canvas"); c.width = 24; c.height = 12;
      var x = c.getContext("2d");
      x.drawImage(img, 0, img.height * (ART.y + ART.h) / H, img.width, img.height * (H - 150 - ART.y - ART.h) / H, 0, 0, 24, 12);
      var data = x.getImageData(0, 0, 24, 12).data, rr = 0, gg = 0, bb = 0, n = 0;
      for (var i = 0; i < data.length; i += 4) { rr += data[i]; gg += data[i + 1]; bb += data[i + 2]; n++; }
      var v = [rr / n, gg / n, bb / n];
      img._tone = { hex: toHex(v), light: (v[0] * 299 + v[1] * 587 + v[2] * 114) / 1000 > 140 };
    } catch (e) { img._tone = null; }
    return img._tone;
  }

  /* ---------- 素材池（正式版通道一的原型实现） ----------
     活动前用文生图为「人格 × 风格」各预生成 N 张无文字背景，人工审过后入库；
     现场按种子选图，再叠排版文字。分享页按同一个种子取回同一张图，服务器不存用户合成图。 */
  SF.POOL_PER_COMBO = 2;
  SF.POOL_ENABLED = true;
  // 两档尺寸：完整图 1080×1920（结果页、生成动画、分享页），缩略图 405×720（待机轮播、风格卡、输入预览）
  var cache = {};
  SF.poolKey = function (d) { return d.p + "-" + d.s + "-" + (((d.seed || 1) >>> 0) % SF.POOL_PER_COMBO + 1); };
  SF.loadBg = function (d, small) {
    if (!SF.POOL_ENABLED) return Promise.resolve(null);
    var key = SF.poolKey(d), id = (small ? "s/" : "") + key;
    if (!cache[id]) cache[id] = new Promise(function (res) {
      var img = new Image();
      img.onload = function () { (img.decode ? img.decode() : Promise.resolve()).then(function () { res(img); }, function () { res(img); }); }; // 提前解码，画的时候不卡
      img.onerror = function () { res(small ? SF.loadBg(d, false) : null); }; // 缩略图缺了用完整图，完整图也缺就程序化兜底
      img.src = "assets/pool/" + id + ".webp";
    });
    return cache[id];
  };
  function both(p, s, small) { for (var i = 0; i < SF.POOL_PER_COMBO; i++) SF.loadBg({ p: p, s: s, seed: i }, small); }
  SF.preloadPersona = function (pid) { SF.STYLES.forEach(function (s) { both(pid, s.id, true); }); };   // 选了人格：先拿 8 张缩略图给风格页
  SF.preloadFull = function (pid, sid) { both(pid, sid, false); };                                        // 选了风格：拿这一组的 2 张完整图
  // 待机时在后台慢慢把 48 张缩略图都拿下来（一次两张，不抢首屏带宽）
  SF.preloadAllThumbs = function () {
    var list = []; SF.PERSONAS.forEach(function (p) { SF.STYLES.forEach(function (s) { for (var i = 0; i < SF.POOL_PER_COMBO; i++) list.push({ p: p.id, s: s.id, seed: i }); }); });
    function next() { var d = list.shift(); if (d) SF.loadBg(d, true).then(next); }
    next(); next();
  };

  /* 异步入口：先取背景再画。同一块画布连续调用时只保留最后一次（防止打字时旧图盖新图） */
  SF.renderPoster = function (canvas, d, opt) {
    opt = opt || {};
    var seq = (canvas._seq = (canvas._seq || 0) + 1);
    return SF.loadBg(d, (opt.scale || 1) <= 0.5).then(function (img) {
      if (canvas._seq !== seq) return false;
      SF.drawPoster(canvas, d, Object.assign({}, opt, { bg: img }));
      canvas.classList.add("ready");
      return true;
    });
  };

  SF.POSTER_SIZE = { w: W, h: H };
})();
