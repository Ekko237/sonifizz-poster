/* 海报绘制：人格 × 风格 × 随机种子 → 1080×1920 竖版海报。
   大屏、分享页、预填页共用这一份代码，同一个种子画出同一张图。
   分工：人格决定「画什么 + 用什么颜色」（母题），风格决定「怎么画」（画笔），种子决定构图细节。
   用户输入的昵称和一句话只在最后作为文字排版叠上去，不参与图形生成（正式版同理：不进 AI 提示词）。 */
(function () {
  var W = 1080, H = 1920;
  var ART = { x: 0, y: 150, w: 1080, h: 1040, cx: 540, cy: 670 }; // 图形区
  var CN = '"PingFang SC","Source Han Sans SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';
  SF.FONT_CN = CN; // 分享页画分享图时用同一套中文字体
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
  function hsl(c) {
    var v = hex(c).map(function (x) { return x / 255; }), mx = Math.max.apply(null, v), mn = Math.min.apply(null, v), dl = mx - mn, l = (mx + mn) / 2, h = 0, s = 0;
    if (dl) {
      s = dl / (1 - Math.abs(2 * l - 1));
      h = mx === v[0] ? ((v[1] - v[2]) / dl) % 6 : mx === v[1] ? (v[2] - v[0]) / dl + 2 : (v[0] - v[1]) / dl + 4;
      h = (h * 60 + 360) % 360;
    }
    return [h, s, l];
  }
  function fromHsl(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    var v = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return toHex(v.map(function (k) { return (k + m) * 255; }));
  }
  // 霓虹灯管色：保留色相，饱和度拉满，亮度收进 0.58～0.72；接近灰色的颜色没有色相，返回 null
  function neonize(c) { var q = hsl(c); return q[1] < 0.15 ? null : fromHsl(q[0], Math.max(q[1], 0.85), Math.min(0.72, Math.max(0.58, q[2]))); }
  // 两块油墨：深色版 A 压字、浅色版 B 铺色。两色按亮度排，A 太浅就压深，B 太深就提亮
  function inks(p) {
    var c = [p.c1, p.c2].sort(function (x, y) { return lum(x) - lum(y); }), A = c[0], B = c[1];
    if (lum(A) > 120) A = mix(A, "#1b1b1b", 0.5);
    if (lum(B) < 120) B = mix(B, "#ffffff", 0.45);
    return [A, B];
  }
  SF.isLight = isLight;
  SF.lum = lum;

  /* ---------- 四种画笔（风格） ----------
     每支画笔提供：bg() 背景、fill(path, color) 填充形状、stroke(path, color, w) 线条、after() 表面质感。 */
  function makePen(ctx, style, p, r) {
    var c1 = p.c1, c2 = p.c2, pen = { ctx: ctx, p: p };
    if (style === "neon") {
      // 霓虹夜场：深底 + 发光描边 + 扫描线。人格色换成同色相的灯管色，黑色人格借用第二色
      var n1 = neonize(c1) || neonize(c2), n2 = neonize(c2) || n1;
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
      pen.after = function () {}; // 扫描线在版式里统一画（盖住文字区）
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
      pen.after = function () {}; // 纸张颗粒在版式里统一撒（盖住文字区）
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

  /* ---------- 文字排版工具 ---------- */
  var HEAD = '"Smiley Sans Oblique",' + CN; // 得意黑：霓虹和波普的大字与引句、所有风格的签名
  var NO_HEAD = "」』，。！？、；：”’,.!?;:)）…~";   // 不放行首，粘在前一个字后面
  var NO_TAIL = "「『“‘(（";                        // 不放行尾，跟着后一个字走
  var TOP = 1060, BOT = 1738;                       // 文字区上下边界（插画下沿到品牌条上沿）
  function tokenize(text) { // 英文和数字按词切，中文按字切
    var toks = [], lead = "";
    (text.match(/[A-Za-z0-9'’\-]+|\s+|[\s\S]/gu) || []).forEach(function (tk) {
      if (NO_TAIL.indexOf(tk) >= 0) { lead += tk; return; }
      if (toks.length && !lead && NO_HEAD.indexOf(tk) >= 0) { toks[toks.length - 1] += tk; return; }
      toks.push(lead + tk); lead = "";
    });
    if (lead) toks.push(lead);
    return toks;
  }
  function greedy(ctx, toks, maxW) {
    var out = [], cur = "";
    toks.forEach(function (tk) {
      if (cur.trim() && /\S/.test(tk) && ctx.measureText((cur + tk).trim()).width > maxW) { out.push(cur.trim()); cur = tk; }
      else cur += tk;
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  // 每个断行位置的代价：标点和空格后面 0；BudouX 短语边界和浏览器分词边界都认 0.3；只有一家认 0.7 / 0.9；词中间 2
  var WORDS = new Intl.Segmenter("zh", { granularity: "word" });
  function edges(parts) { var e = {}, i = 0; parts.forEach(function (x) { i += x.length; e[i] = 1; }); return e; }
  function cutCosts(text, toks) {
    var a = edges(window.SFPhrase(text)), b = edges(Array.from(WORDS.segment(text), function (x) { return x.segment; }));
    var costs = [], at = 0;
    toks.forEach(function (tk, k) {
      if (k) {
        var prev = toks[k - 1].slice(-1);
        costs.push(/\s/.test(prev) || /^\s/.test(tk) || NO_HEAD.indexOf(prev) >= 0 ? 0 : a[at] && b[at] ? 0.3 : a[at] ? 0.7 : b[at] ? 0.9 : 2);
      } else costs.push(0);
      at += tk.length;
    });
    return costs;
  }
  // 行数定了以后挑断行位置：断行代价加上几行长短差，两三行时把所有断法都试一遍；只剩一个字的行另外扣分
  function arrange(ctx, toks, n, maxW, costs) {
    var best = null;
    function tryCuts(cuts) {
      var lines = [], prev = 0, cut = 0;
      cuts.concat(toks.length).forEach(function (c) { lines.push(toks.slice(prev, c).join("").trim()); prev = c; });
      if (lines.some(function (l) { return !l; })) return;
      var ws = lines.map(function (l) { return ctx.measureText(l).width; }), wMax = Math.max.apply(null, ws);
      if (wMax > maxW) return;
      cuts.forEach(function (c) { cut += costs[c]; });
      lines.forEach(function (l) { if (Array.from(l).length === 1) cut += 1; });
      var score = (wMax - Math.min.apply(null, ws)) / maxW + cut;
      if (!best || score < best.score) best = { lines: lines, cut: cut, score: score };
    }
    for (var i = 1; i < toks.length; i++) {
      if (n === 2) tryCuts([i]);
      else for (var j = i + 1; j < toks.length; j++) tryCuts([i, j]);
    }
    return best;
  }
  // 短句一行能排到最大字号的四分之三就不折行；要折行时从大字号往下找，找到不断在词中间的断法为止（最多再缩一成半）
  function fit(ctx, text, font, maxW, maxLines, maxSize, minSize) {
    var toks = tokenize(text), costs = cutCosts(text, toks), size, out = null, first = 0;
    var one = fitSize(ctx, text.trim(), font, maxW, maxSize, minSize);
    if (one >= maxSize * 0.75 && ctx.measureText(text.trim()).width <= maxW) { size = one; out = [text.trim()]; }
    else for (size = maxSize; size >= minSize; size -= 2) {
      ctx.font = font(size);
      var g = greedy(ctx, toks, maxW);
      if (g.length > maxLines) continue;
      var r = (g.length > 1 && arrange(ctx, toks, g.length, maxW, costs)) || { lines: g, cut: 0 }; // 有一个词比整行还宽时只能照逐字排的结果
      first = first || size;
      if (r.cut < 2 || size - 2 < Math.max(minSize, first * 0.85)) { out = r.lines; break; }
    }
    if (!out) { size = minSize; ctx.font = font(size); out = greedy(ctx, toks, maxW); }
    var lh = Math.round(size * 1.24);
    return { size: size, lines: out, lh: lh, h: size * 1.06 + (out.length - 1) * lh };
  }
  function fitSize(ctx, text, font, maxW, maxSize, minSize) { // 单行：从大往小找放得下的字号，结束时 ctx.font 就是这个字号
    for (var s = maxSize; s > minSize; s -= 2) { ctx.font = font(s); if (ctx.measureText(text).width <= maxW) return s; }
    ctx.font = font(minSize); return minSize;
  }
  function drawLines(ctx, q, x, y, align) { // y 是第一行基线，返回最后一行基线
    ctx.textAlign = align;
    q.lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * q.lh); });
    return y + (q.lines.length - 1) * q.lh;
  }
  function header(ctx, t, x, y, col, glow, chip) { // 顶栏：左边 MUSIC PERSONA，右边 BPM 和编号；chip 给了就在字后面垫一块底，插画再花也看得清
    ctx.save(); ctx.font = "900 38px " + DOT;
    var right = [t.bpm, t.no].filter(Boolean).join("   ");
    if (chip) {
      ctx.fillStyle = rgba(chip, 0.88);
      [["MUSIC PERSONA", x], [right, W - x - ctx.measureText(right).width]].forEach(function (it) {
        if (!it[0]) return;
        ctx.beginPath(); roundRect(ctx, it[1] - 12, y - 36, ctx.measureText(it[0]).width + 24, 50, 10); ctx.fill();
      });
    }
    ctx.fillStyle = col;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
    ctx.textAlign = "left"; ctx.fillText("MUSIC PERSONA", x, y);
    if (right) { ctx.textAlign = "right"; ctx.fillText(right, W - x, y); }
    ctx.restore();
  }
  // 签名：得意黑斜体 + 一笔带过的下划弧线
  function signature(ctx, who, x, y, size, col, align, glow) {
    ctx.save();
    ctx.font = size + "px " + HEAD; ctx.textAlign = align; ctx.fillStyle = col; ctx.strokeStyle = col;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
    var w = ctx.measureText(who).width, x0 = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    ctx.fillText(who, x, y);
    ctx.lineWidth = Math.max(3, size * 0.075); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0 - size * 0.15, y + size * 0.3);
    ctx.bezierCurveTo(x0 + w * 0.35, y + size * 0.1, x0 + w * 0.7, y + size * 0.42, x0 + w + size * 0.5, y + size * 0.02);
    ctx.stroke();
    ctx.restore();
  }

  /* 声纹：一句话的每个字算出一段振幅，空格和标点是停顿；同一句话永远是同一条波形。
     海报、生成动画的液面、分享页都用这一条，所以每张海报都带着自己那句话的「声音」 */
  // 一个字的响度：只看这个字和它的位置，打字时前面的字不会跟着变；空格和标点是停顿
  SF.charAmp = function (ch, i) {
    if (/[\s\p{P}\p{S}]/u.test(ch)) return 0.1;
    return 0.32 + (Math.imul(ch.codePointAt(0) + i * 7919, 2654435761) >>> 0) % 1000 / 1000 * 0.68;
  };
  SF.voiceprint = function (text, n) {
    var cs = Array.from((text || "").trim() || "SONIFIZZ"), seed = 2166136261, out = [];
    cs.forEach(function (ch) { seed = Math.imul(seed ^ ch.codePointAt(0), 16777619); });
    var amp = cs.map(SF.charAmp);
    for (var i = 0; i < n; i++) {
      var pos = (i + 0.5) / n * cs.length - 0.5, a = Math.max(0, Math.floor(pos)), b = Math.min(cs.length - 1, a + 1), f = Math.min(1, Math.max(0, pos - a));
      var v = amp[a] + (amp[b] - amp[a]) * f;
      var jit = ((Math.imul(i + 1, 2246822519) ^ seed) >>> 0) % 1000 / 1000; // 每根再抖一点，像真实录音
      var env = Math.pow(Math.sin(Math.PI * (i + 0.5) / n), 0.45);        // 两头轻、中间满，像一句话的音量起伏
      out.push(Math.max(0.06, Math.min(1, v * (0.68 + 0.32 * jit) * (0.35 + 0.65 * env))));
    }
    return out;
  };
  // 这一张的声纹：念过一遍的用录下来的音量起伏（vp：24 个 36 进制字，每个 0–35），没念过的按这句话的字算
  SF.voiceOf = function (d, n, text) {
    if (!d.vp) return SF.voiceprint(text || d.t, n);
    var src = Array.from(d.vp, function (c) { return parseInt(c, 36) / 35; }), out = [];
    for (var i = 0; i < n; i++) {
      var pos = (i + 0.5) / n * src.length - 0.5, a = Math.max(0, Math.floor(pos)), b = Math.min(src.length - 1, a + 1), f = Math.min(1, Math.max(0, pos - a));
      out.push(Math.max(0.06, src[a] + (src[b] - src[a]) * f));
    }
    return out;
  };
  // 声纹的四种画法：scope 示波器发光线（霓虹）、ink 油墨柱（丝印）、chunky 粗描边柱（波普）、hair 细柱（瑞士）
  function voice(ctx, amps, x, cy, w, h, kind, c1, c2) {
    var n = amps.length, step = w / n;
    ctx.save();
    if (kind === "scope") { // 上下对称的发光竖线，中间一条细基线
      ctx.strokeStyle = c1; ctx.lineCap = "round"; ctx.shadowColor = c1; ctx.shadowBlur = 16;
      ctx.lineWidth = 2; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = Math.max(3, step * 0.42); ctx.beginPath();
      amps.forEach(function (v, i) { var px = x + (i + 0.5) * step; ctx.moveTo(px, cy - v * h); ctx.lineTo(px, cy + v * h); });
      ctx.stroke();
    } else {
      var bw = kind === "hair" ? Math.max(3, step * 0.34) : step * (kind === "chunky" ? 0.64 : 0.56);
      if (kind === "ink") ctx.globalCompositeOperation = "multiply";
      amps.forEach(function (v, i) {
        var bh = Math.max(6, v * h * 2), bx = x + i * step + (step - bw) / 2, by = cy - bh / 2;
        ctx.fillStyle = kind === "chunky" && i % 2 ? c2 : c1; ctx.fillRect(bx, by, bw, bh);
        if (kind === "chunky") { ctx.lineWidth = 4; ctx.strokeStyle = "#111"; ctx.strokeRect(bx, by, bw, bh); }
      });
    }
    ctx.restore();
  }
  function scan(ctx, alpha) { ctx.save(); ctx.fillStyle = "rgba(0,0,0," + alpha + ")"; for (var y = 0; y < H - 150; y += 6) ctx.fillRect(0, y, W, 2); ctx.restore(); }
  function regMark(ctx, x, y, col) { // 印刷套准标记：圆 + 十字
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.moveTo(x - 24, y); ctx.lineTo(x + 24, y); ctx.moveTo(x, y - 24); ctx.lineTo(x, y + 24);
    ctx.stroke(); ctx.restore();
  }
  // 插画区按种子撒几个气泡，画法跟着风格：霓虹发光圈、丝印两色错版圈、波普白泡黑边、瑞士实心圆
  function fizz(ctx, sid, vr, a, b) {
    var n = 4 + Math.floor(vr() * 4);
    for (var i = 0; i < n; i++) {
      var x = between(vr, 80, W - 80), y = between(vr, 190, 980), rad = between(vr, 9, 34) * (i === 0 ? 1.7 : 1);
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2);
      if (sid === "neon") { ctx.strokeStyle = b; ctx.lineWidth = 3; ctx.shadowColor = b; ctx.shadowBlur = 18; ctx.stroke(); }
      else if (sid === "riso") {
        ctx.globalCompositeOperation = "multiply"; ctx.lineWidth = 5; ctx.strokeStyle = a; ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 5, y + 4, rad, 0, Math.PI * 2); ctx.strokeStyle = b; ctx.stroke();
      }
      else if (sid === "pop") { ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = "#111"; ctx.stroke(); }
      else { ctx.fillStyle = a; ctx.fill(); }
      ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0;
      ctx.strokeStyle = sid === "pop" ? "#111" : "rgba(255,255,255,0.85)"; ctx.lineWidth = Math.max(2, rad * 0.13); ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(x, y, rad * 0.62, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      ctx.restore();
    }
  }
  function brandBar(ctx, p, lang) { // 底部荧光黄品牌条：罐子 + SONIFIZZ + 口味 + 活动名
    ctx.save();
    ctx.fillStyle = BRAND; ctx.fillRect(0, H - 150, W, 150);
    can(ctx, 60, H - 214, p.c1);
    ctx.fillStyle = "#0c0c0d"; ctx.textAlign = "left";
    ctx.font = "900 58px " + DOT; ctx.fillText("SONIFIZZ", 172, H - 54);
    var fx = 172 + ctx.measureText("SONIFIZZ").width + 30;
    ctx.font = "900 40px " + DOT; var festW = ctx.measureText("FEST 2026").width;
    ctx.textAlign = "right"; ctx.fillText("FEST 2026", W - 56, H - 56);
    var flavor = lang === "en" ? p.flavorEn : "声汽 " + p.flavorZh + "味";
    fitSize(ctx, flavor, function (s) { return "800 " + s + "px " + CN; }, W - 56 - festW - 28 - fx, 44, 26);
    ctx.textAlign = "left"; ctx.fillText(flavor, fx, H - 57);
    ctx.restore();
  }

  /* ---------- 四种版式 ----------
     插画画完以后按风格排文字，四种风格的骨架各不相同：
     霓虹 = 居中、灯管边框、空心发光大字、示波器声纹；
     丝印 = 右侧竖排色带大字、左栏引句、套准标记和色标、油墨柱声纹；
     波普 = 撕开的纸、斜贴的贴纸标题、对话气泡、爆炸贴编号；
     瑞士 = 左对齐网格、超大点阵编号、细线分隔、细柱声纹。
     t：{ en, name, sub, line 带引号的一句话, who 昵称或神秘乐迷, no, num, idx 人格序号, bpm, voice(n) } */
  var LAYOUT = {};
  LAYOUT.neon = function (ctx, pen, t) {
    var a = pen.col[0], b = pen.col[1], nf = function (s) { return s + "px " + HEAD; };
    ctx.save(); // 灯管边框：辉光描两遍，再压一条白色灯芯
    ctx.beginPath(); roundRect(ctx, 30, 30, W - 60, H - 150 - 50, 44);
    ctx.strokeStyle = b; ctx.lineWidth = 6; ctx.shadowColor = b; ctx.shadowBlur = 30; ctx.stroke(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    header(ctx, t, 80, 112, "#f3f3ef", b);

    var ns = fitSize(ctx, t.name, nf, 900, t.en ? 150 : 172, 80), fixed = ns * 0.86 + 58 + 92 + (t.who ? 88 : 0), q = null;
    if (t.line) for (var qs = Math.round(ns * 0.7); ; qs -= 4) { q = fit(ctx, t.line, nf, 880, 2, qs, 50); if (fixed + 28 + q.h <= BOT - TOP || qs <= 50) break; }
    var y = TOP + Math.max(0, (BOT - TOP - fixed - (q ? 28 + q.h : 0)) / 2) + ns * 0.86;

    ctx.save(); ctx.textAlign = "center"; ctx.font = nf(ns); ctx.lineJoin = "round"; // 空心灯管字：淡淡的填充 + 两遍辉光描边 + 白色灯芯
    ctx.fillStyle = rgba(a, 0.16); ctx.fillText(t.name, 540, y, 900);
    ctx.strokeStyle = a; ctx.lineWidth = Math.max(4, ns * 0.042); ctx.shadowColor = a; ctx.shadowBlur = 38;
    ctx.strokeText(t.name, 540, y, 900); ctx.strokeText(t.name, 540, y, 900);
    ctx.shadowBlur = 0; ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = Math.max(1.5, ns * 0.013); ctx.strokeText(t.name, 540, y, 900);
    ctx.restore();
    y += 58;
    ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = b; ctx.shadowColor = b; ctx.shadowBlur = 14;
    ctx.font = t.en ? "800 40px " + CN : "900 40px " + DOT; ctx.fillText(t.sub, 540, y, 900);
    ctx.restore();
    y += 46;
    voice(ctx, t.voice(44), 170, y, 740, 40, "scope", b);
    y += 46;
    if (q) {
      y += 28 + q.size * 0.86;
      ctx.save(); ctx.font = nf(q.size); ctx.fillStyle = "#f6f6f2"; ctx.shadowColor = a; ctx.shadowBlur = 22;
      y = drawLines(ctx, q, 540, y, "center") + q.size * 0.2; ctx.restore();
    }
    if (t.who) signature(ctx, t.who, 540, y + 76, 60, b, "center", b);
    scan(ctx, 0.16);
  };

  LAYOUT.riso = function (ctx, pen, t, vr) {
    var ink2 = inks(pen.p), A = ink2[0], B = ink2[1], ox = 7, oy = 5; // 浅色版 B 错位 ox, oy
    [A, B, BRAND, "#1b1b1b"].forEach(function (col, i) { ctx.fillStyle = col; ctx.fillRect(W / 2 - 74 + i * 38, 30, 30, 30); }); // 色标
    [[46, 46], [W - 46, 46], [46, H - 196], [W - 46, H - 196]].forEach(function (m) { regMark(ctx, m[0], m[1], "#1b1b1b"); });
    header(ctx, t, 92, 118, "#1b1b1b", null, pen.bgc);

    var bw = 200, bx = W - 70 - bw, by = 980, bh = BOT - by, ns; // 右侧色带：浅色版铺底，深色版竖排大字压在上面
    ctx.save();
    ctx.fillStyle = B; ctx.globalAlpha = 0.94; ctx.fillRect(bx + ox, by + oy, bw, bh); ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = A; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (!t.en) {
      var chars = Array.from(t.name); ns = Math.min(160, Math.floor((bh - 50) / chars.length / 1.02));
      ctx.font = "900 " + ns + "px " + CN;
      chars.forEach(function (ch, i) { ctx.fillText(ch, bx + bw / 2, by + 25 + ns * (i * 1.02 + 0.5)); });
    } else {
      ns = fitSize(ctx, t.name, function (s) { return "900 " + s + "px " + CN; }, bh - 50, 150, 60);
      ctx.translate(bx + bw / 2, by + bh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(t.name, 0, 0);
    }
    ctx.restore();

    var lx = 70, lw = bx - 44 - lx, qf = function (s) { return "800 " + s + "px " + CN; }, fixed = 52 + (t.who ? 96 : 0) + 110, q = null;
    if (t.line) for (var qs = Math.min(Math.round(ns * 0.7), 110); ; qs -= 4) { q = fit(ctx, t.line, qf, lw, 3, qs, 48); if (fixed + 30 + q.h <= BOT - 1110 || qs <= 48) break; }
    var y = 1110 + Math.max(0, (BOT - 1110 - fixed - (q ? 30 + q.h : 0)) / 2);
    ctx.save(); ctx.fillStyle = A; ctx.textAlign = "left"; ctx.font = t.en ? "800 36px " + CN : "900 36px " + DOT;
    ctx.fillText(t.sub, lx, y + 36, lw); ctx.restore();
    y += 52;
    if (q) { // 引句也是两块版：浅色版错开一点垫在下面
      y += 30 + q.size * 0.86;
      ctx.save(); ctx.font = qf(q.size); ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = B; drawLines(ctx, q, lx + 4, y + 3, "left");
      ctx.fillStyle = "#1b1b1b"; y = drawLines(ctx, q, lx, y, "left") + q.size * 0.2;
      ctx.restore();
    }
    if (t.who) { signature(ctx, t.who, lx + 6, y + 84, 62, A, "left"); y += 96; }
    voice(ctx, t.voice(40), lx, y + 70, lw, 36, "ink", B);
    grain(ctx, vr, 0.07, 7000);
  };

  LAYOUT.pop = function (ctx, pen, t, vr) {
    var p = pen.p, stick = lum(p.c2) > 110 ? p.c2 : BRAND, stickInk = lum(stick) > 140 ? "#111" : "#fff", nf = function (s) { return s + "px " + HEAD; };
    var edge = []; // 撕开的纸：锯齿上沿 + 黑色硬阴影，整张微微歪着
    for (var x = -30; x <= W + 60; x += 30) edge.push([x, 1110 + (vr() - 0.5) * 34]);
    function sheet(dy) { ctx.beginPath(); edge.forEach(function (q, i) { i ? ctx.lineTo(q[0], q[1] + dy) : ctx.moveTo(q[0], q[1] + dy); }); ctx.lineTo(W + 60, H); ctx.lineTo(-30, H); ctx.closePath(); }
    ctx.save(); ctx.translate(540, 1400); ctx.rotate(-0.025); ctx.translate(-540, -1400);
    sheet(-14); ctx.fillStyle = "#111"; ctx.fill();
    sheet(0); ctx.fillStyle = "#f8f3e8"; ctx.fill();
    ctx.restore();
    ctx.save(); ctx.fillStyle = rgba(p.c1, 0.35); // 纸的右下角压一片网点
    for (var gy = 1330; gy < H - 150; gy += 24) for (var gx = 600 + ((gy / 24) % 2) * 12; gx < W; gx += 24) {
      var k = Math.min(1, ((gx - 600) / 480 + (gy - 1330) / 440) / 2); if (k < 0.1) continue;
      ctx.beginPath(); ctx.arc(gx, gy, 10 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.save(); ctx.translate(58, 62); ctx.rotate(-0.035); ctx.font = "900 34px " + DOT; // 左上角胶带标签
    var hw = ctx.measureText("MUSIC PERSONA").width + 44;
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(0, 0, hw, 58);
    ctx.fillStyle = "#111"; ctx.textAlign = "left"; ctx.fillText("MUSIC PERSONA", 22, 41);
    ctx.restore();
    ctx.save(); ctx.translate(W - 170, 184); ctx.rotate(0.16); // 右上角爆炸贴：编号，缩略图没有编号写 NEW!
    var pts = star(0, 0, 128, 98, 14, 0);
    function burst(d) { ctx.beginPath(); pts.forEach(function (q, i) { i ? ctx.lineTo(q[0] + d, q[1] + d) : ctx.moveTo(q[0] + d, q[1] + d); }); ctx.closePath(); }
    burst(10); ctx.fillStyle = "#111"; ctx.fill();
    burst(0); ctx.fillStyle = BRAND; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = "#111"; ctx.stroke();
    ctx.fillStyle = "#111"; ctx.textAlign = "center";
    if (t.num) { ctx.font = "900 30px " + DOT; ctx.fillText("No.", 0, -18); ctx.font = "900 54px " + DOT; ctx.fillText(t.num, 0, 34); }
    else { ctx.font = "60px " + HEAD; ctx.fillText("NEW!", 0, 20); }
    ctx.restore();

    var ns = fitSize(ctx, t.name, nf, 800, t.en ? 132 : 158, 70), tw = ctx.measureText(t.name).width; // 贴纸标题：斜贴、黑描边、硬阴影
    var sw = tw + 84, sh = ns * 1.12 + 40, sx = 64, sy = 1000;
    ctx.save(); ctx.translate(sx + sw / 2, sy + sh / 2); ctx.rotate(-0.06);
    ctx.fillStyle = "#111"; ctx.fillRect(-sw / 2 + 14, -sh / 2 + 14, sw, sh);
    ctx.fillStyle = stick; ctx.fillRect(-sw / 2, -sh / 2, sw, sh);
    ctx.lineWidth = 8; ctx.strokeStyle = "#111"; ctx.strokeRect(-sw / 2, -sh / 2, sw, sh);
    ctx.fillStyle = stickInk; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = nf(ns); ctx.fillText(t.name, 0, ns * 0.05);
    ctx.restore();
    var sub = [t.sub, t.bpm].filter(Boolean).join("  ·  ");
    ctx.save(); ctx.font = t.en ? "800 34px " + CN : "900 34px " + DOT;
    var tw2 = ctx.measureText(sub).width + 40;
    ctx.translate(Math.min(sx + sw - tw2 + 20, W - 40 - tw2), sy + sh + 8); ctx.rotate(0.04);
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, tw2, 56); ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText(sub, 20, 40);
    ctx.restore();

    var top = sy + sh + 104, tail = (t.who ? 96 : 0) + 96, q = null; // 对话气泡：尾巴指向左上方的插画
    if (t.line) for (var qs = Math.round(ns * 0.7); ; qs -= 4) { q = fit(ctx, t.line, nf, 800, 2, qs, 50); if (top + q.h + 64 + tail <= BOT || qs <= 50) break; }
    var y = top;
    if (q) {
      ctx.save(); ctx.font = nf(q.size);
      var qw = Math.max.apply(null, q.lines.map(function (l) { return ctx.measureText(l).width; }));
      var bw2 = Math.max(qw + 96, 380), bh2 = q.h + 64, bx2 = 80;
      ctx.fillStyle = "#111"; ctx.beginPath(); roundRect(ctx, bx2 + 10, y + 10, bw2, bh2, 48); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx2 + 86, y + 10); ctx.lineTo(bx2 + 50, y - 58); ctx.lineTo(bx2 + 166, y + 10); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 8;
      ctx.beginPath(); roundRect(ctx, bx2, y, bw2, bh2, 48); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx2 + 76, y + 2); ctx.lineTo(bx2 + 40, y - 68); ctx.lineTo(bx2 + 156, y + 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx2 + 76, y + 2); ctx.lineTo(bx2 + 40, y - 68); ctx.lineTo(bx2 + 156, y + 2); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.fillRect(bx2 + 82, y - 3, 68, 10); // 盖住尾巴根部那一段气泡边线
      ctx.fillStyle = "#111"; drawLines(ctx, q, bx2 + bw2 / 2, y + 32 + q.size * 0.86, "center");
      ctx.restore();
      y += bh2;
    }
    if (t.who) signature(ctx, t.who, W - 100, y + 86, 62, "#111", "right");
    voice(ctx, t.voice(20), 80, y + 66, 470, 44, "chunky", p.c1, stick);
  };

  LAYOUT.swiss = function (ctx, pen, t) {
    var ink = pen.ink, acc = inks(pen.p)[0];
    ctx.save(); ctx.strokeStyle = rgba(ink, 0.1); ctx.lineWidth = 2; // 六栏网格线
    for (var k = 0; k <= 6; k++) { var gx = 64 + k * 952 / 6; ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H - 150); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = pen.bgc; ctx.fillRect(0, 1000, W, H - 150 - 1000); // 插画下沿切一刀：上面是图，下面是实底的文字区
    ctx.fillStyle = ink; ctx.fillRect(64, 56, 952, 4);
    header(ctx, { no: [t.bpm, t.sub].filter(Boolean).join("   ") }, 64, 108, ink, null, pen.bgc); // 编号已经是超大数字，顶栏右边放副名
    var big = t.num || t.idx; // 超大点阵编号；缩略图没有编号时印这一派的序号
    fitSize(ctx, big, function (s) { return "900 " + s + "px " + DOT; }, 960, 300, 120);
    ctx.fillStyle = acc; ctx.textAlign = "left"; ctx.fillText(big, 50, 1250);
    ctx.fillStyle = ink; ctx.fillRect(64, 1276, 952, 4);
    var nf = function (s) { return "900 " + s + "px " + CN; }, ns = fitSize(ctx, t.name, nf, 952, t.en ? 120 : 134, 70);
    var y = 1300 + ns * 0.86;
    ctx.fillStyle = ink; ctx.fillText(t.name, 60, y, 952);
    var qf = function (s) { return "500 " + s + "px " + CN; }, rowH = 96, q = null;
    if (t.line) for (var qs = Math.round(ns * 0.7); ; qs -= 4) { q = fit(ctx, t.line, qf, 952, 2, qs, 46); if (y + 34 + q.h + 22 + rowH <= BOT || qs <= 46) break; }
    if (q) { y += 34 + q.size * 0.86; ctx.font = qf(q.size); ctx.fillStyle = ink; y = drawLines(ctx, q, 62, y, "left") + q.size * 0.2; }
    var ry = Math.max(y + 22, BOT - rowH); // 底部一行贴着品牌条：细线 + 声纹 + 签名
    ctx.fillStyle = ink; ctx.fillRect(64, ry, 952, 2);
    voice(ctx, t.voice(56), 64, ry + 50, 500, 28, "hair", ink);
    if (t.who) signature(ctx, t.who, W - 76, ry + 70, 56, ink, "right");
  };

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
    var vr = rng(((d.seed || 1) ^ 0x2545f491) >>> 0); // 版式里的随机细节单独用一条序列，不打乱插画的随机数
    var bg = opt.bg; // 素材池里的 AI 背景图（正式版通道一）；没有时用程序化母题兜底
    if (bg) {
      drawCover(ctx, bg, vr);
      var tone = toneOf(bg);
      if (tone) { pen.ink = tone.light ? "#141414" : "#f3f3ef"; pen.bgc = tone.hex; }
      fizz(ctx, s.id, vr, pen.col[0], pen.col[1]);
    } else {
      pen.bg();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 110, W, ART.h + 120); ctx.clip(); // 图形只画在上半区
      MOTIF[p.id](ctx, pen, r);
      bubbles(ctx, pen, r);
      ctx.restore();
      pen.after();
    }

    // 顶栏和文字区压一层底色渐变，保证字清楚
    var ty = ART.y + ART.h + 20;
    if (bg) {
      var top = ctx.createLinearGradient(0, 0, 0, 160);
      top.addColorStop(0, rgba(pen.bgc, 0.75)); top.addColorStop(1, rgba(pen.bgc, 0));
      ctx.fillStyle = top; ctx.fillRect(0, 0, W, 160);
      var veil = ctx.createLinearGradient(0, ty - 200, 0, H - 150);
      veil.addColorStop(0, rgba(pen.bgc, 0)); veil.addColorStop(0.35, rgba(pen.bgc, 0.72)); veil.addColorStop(1, rgba(pen.bgc, 0.9));
      ctx.fillStyle = veil; ctx.fillRect(0, ty - 200, W, H - 150 - ty + 200);
    } else {
      var fade = ctx.createLinearGradient(0, ty - 140, 0, ty + 30);
      fade.addColorStop(0, rgba(pen.bgc, 0)); fade.addColorStop(1, rgba(pen.bgc, 1));
      ctx.fillStyle = fade; ctx.fillRect(0, ty - 140, W, 170);
      ctx.fillStyle = pen.bgc; ctx.fillRect(0, ty + 30, W, H - 150 - ty - 30);
    }

    if (opt.bare) { ctx.fillStyle = BRAND; ctx.fillRect(0, H - 150, W, 150); return; } // 生成动画取网点用：只要插画和品牌条底色，不要文字

    var num = d.no ? String(d.no).padStart(4, "0") : "";
    LAYOUT[s.id](ctx, pen, {
      en: lang === "en", name: lang === "en" ? p.en : p.zh, sub: lang === "en" ? p.zh : p.en,
      line: d.t ? (lang === "en" ? "“" + d.t + "”" : "「" + d.t + "」") : "",
      who: opt.hideNick ? (opt.mystery || "神秘乐迷") : (d.n || ""),
      num: num, no: num ? "No." + num : "", idx: String(SF.PERSONAS.indexOf(p) + 1).padStart(2, "0"),
      bpm: d.b ? d.b + " BPM" : "",
      voice: function (n) { return SF.voiceOf(d, n, d.t || p.zh); }
    }, vr);
    brandBar(ctx, p, lang);
  };

  // 底图按种子轻微放大、平移，一半镜像：同一张素材出来的海报也各不相同
  function drawCover(ctx, img, vr) {
    var k = Math.max(W / img.width, H / img.height) * (1 + vr() * 0.07), w = img.width * k, h = img.height * k;
    var x = (W - w) * vr(), y = (H - h) * (0.2 + vr() * 0.6);
    ctx.save();
    if (vr() < 0.5) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
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
  SF.POOL_PER_COMBO = 4;
  // 每个组合几张底图：#d= 的旧链接按发出去时的 2 张算，打开还是当时那张；大屏和 #s= 链接按 4 张
  function poolSize(d) { return d.v === 1 ? 2 : SF.POOL_PER_COMBO; }
  SF.POOL_ENABLED = true;
  // 两档尺寸：完整图 1080×1920（结果页、生成动画、分享页），缩略图 405×720（待机轮播、风格卡、输入预览）
  var cache = {};
  SF.poolKey = function (d) { return d.p + "-" + d.s + "-" + (((d.seed || 1) >>> 0) % poolSize(d) + 1); };
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
  SF.preloadPersona = function (pid) { SF.STYLES.forEach(function (s) { both(pid, s.id, true); }); };    // 选了人格：先拿这一派四种风格的缩略图给风格页
  SF.preloadFull = function (pid, sid, seed) { SF.loadBg({ p: pid, s: sid, seed: seed }, false); };        // 选了风格：拿这一轮会用到的那张完整图
  // 待机时在后台慢慢把全部缩略图都拿下来（一次两张，不抢首屏带宽）
  SF.preloadAllThumbs = function () {
    var list = []; SF.PERSONAS.forEach(function (p) { SF.STYLES.forEach(function (s) { for (var i = 0; i < SF.POOL_PER_COMBO; i++) list.push({ p: p.id, s: s.id, seed: i }); }); });
    function next() { var d = list.shift(); if (d) SF.loadBg(d, true).then(next); }
    next(); next();
  };

  /* 异步入口：先取背景再画。同一块画布连续调用时只保留最后一次（防止打字时旧图盖新图） */
  SF.renderPoster = function (canvas, d, opt) {
    opt = opt || {};
    var seq = (canvas._seq = (canvas._seq || 0) + 1);
    return Promise.all([SF.loadBg(d, (opt.scale || 1) <= 0.5), glyphs(d, opt)]).then(function (res) {
      if (canvas._seq !== seq) return false;
      SF.drawPoster(canvas, d, Object.assign({}, opt, { bg: res[0] }));
      canvas.classList.add("ready");
      return true;
    });
  };

  /* ---------- 合拍卡：被朋友邀请来测的人，分享页上多一张两个人的卡 ----------
     1080×1350：上半是邀请人那一派的颜色，下半是自己这一派；两人的声纹在中缝相对长出来，中间一条白带写两派的配对语 */
  SF.duoLine = function (a, b, lang) { // 两派的配对语：是对方的最合拍就用那一句，同一派、其他组合各有一句
    var en = lang === "en", m = SF.MATCH;
    if (m[a][0] === b) return en ? m[a][2] : m[a][1];
    if (m[b][0] === a) return en ? m[b][2] : m[b][1];
    if (a === b) return en ? "Same tribe, double the volume" : "同一派，音量翻倍";
    return en ? "Two rhythms, one night" : "两种节奏，同一个夜晚";
  };
  SF.drawDuo = function (canvas, top, bottom, lang) {
    var DW = 1080, DH = 1350, mid = 640, en = lang === "en";
    canvas.width = DW; canvas.height = DH;
    var ctx = canvas.getContext("2d");
    [[top, 0, mid], [bottom, mid, DH - 120]].forEach(function (it, k) {
      var p = SF.persona(it[0].p), ink = isLight(p.c1) ? "#141414" : "#f3f3ef";
      ctx.fillStyle = p.c1; ctx.fillRect(0, it[1], DW, it[2] - it[1]);
      ctx.fillStyle = rgba(p.c2, 0.22); // 一片这一派第二色的网点
      for (var y = it[1] + 14; y < it[2]; y += 26) for (var x = (y / 26) % 2 ? 13 : 0; x < DW; x += 26) {
        var kk = k ? (y - it[1]) / (it[2] - it[1]) : 1 - (y - it[1]) / (it[2] - it[1]);
        ctx.beginPath(); ctx.arc(x, y, 9 * kk, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = ink; ctx.textAlign = "left";
      var name = en ? p.en : p.zh, nf = function (s) { return s + "px " + HEAD; };
      var ny = k ? it[1] + 250 : it[1] + 270;
      fitSize(ctx, name, nf, DW - 128, 150, 70); ctx.fillText(name, 64, ny);
      ctx.font = "900 34px " + DOT; ctx.globalAlpha = 0.85; ctx.fillText(en ? p.zh : p.en, 68, ny + 56); ctx.globalAlpha = 1;
      signature(ctx, it[0].n, 68, ny + 150, 64, ink, "left");
      // 声纹在中缝相对长出来：上面那人的往上，下面那人的往下
      var amps = SF.voiceprint(it[0].t || it[0].n || name, 48), step = (DW - 128) / amps.length;
      ctx.fillStyle = rgba(ink, 0.9);
      amps.forEach(function (v, i) {
        var h = 12 + v * 90, bx = 64 + i * step + step * 0.2, bw = step * 0.6;
        if (k) ctx.fillRect(bx, mid + 44, bw, h); else ctx.fillRect(bx, mid - 44 - h, bw, h);
      });
    });
    ctx.fillStyle = "#f8f6ef"; ctx.fillRect(0, mid - 32, DW, 64); // 中缝白带：两派的配对语
    ctx.fillStyle = "#141414"; ctx.textAlign = "center";
    fitSize(ctx, SF.duoLine(top.p, bottom.p, lang), function (s) { return "800 " + s + "px " + CN; }, DW - 120, 36, 22);
    ctx.fillText(SF.duoLine(top.p, bottom.p, lang), DW / 2, mid + 12);
    ctx.save(); ctx.translate(DW - 150, mid); ctx.rotate(-0.12); // 右边一枚「合拍」圆章压在中缝上
    ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = "#111"; ctx.stroke();
    ctx.fillStyle = "#111"; ctx.font = (en ? "64px " : "70px ") + HEAD; ctx.fillText(en ? "DUO" : "合拍", 0, 24);
    ctx.restore();
    ctx.fillStyle = BRAND; ctx.fillRect(0, DH - 120, DW, 120); // 底部品牌条
    ctx.fillStyle = "#0c0c0d"; ctx.textAlign = "left"; ctx.font = "900 52px " + DOT; ctx.fillText("SONIFIZZ", 56, DH - 44);
    ctx.textAlign = "right"; ctx.font = "800 36px " + CN; ctx.fillText(en ? "Duo card · FEST 2026" : "合拍卡 · FEST 2026", DW - 56, DH - 46);
  };
  SF.renderDuo = function (canvas, top, bottom, lang) {
    var p1 = SF.persona(top.p), p2 = SF.persona(bottom.p);
    var text = (lang === "en" ? p1.en + p2.en + "DUO" : p1.zh + p2.zh + "合拍") + top.n + bottom.n;
    return document.fonts.load('40px "Smiley Sans Oblique"', text).then(function () { SF.drawDuo(canvas, top, bottom, lang); });
  };

  // 得意黑按字切片加载：画之前先把这张海报要用的字拿下来，否则 canvas 会用回落字体画
  function glyphs(d, opt) {
    var p = SF.persona(d.p) || SF.PERSONAS[0], lang = opt.lang || d.l || "zh";
    var text = (lang === "en" ? p.en : p.zh) + (d.t || "") + (opt.hideNick ? (opt.mystery || "神秘乐迷") : (d.n || "")) + "「」“”NEW!";
    return document.fonts.load('40px "Smiley Sans Oblique"', text);
  }

  SF.POSTER_SIZE = { w: W, h: H };
})();
