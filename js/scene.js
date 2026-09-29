/* 电脑演示用的音乐节夜景背景：程序化绘制（灯光束 + 光斑 + 人群剪影），不用图片。
   分三层，只有中间的灯光层在动：
   ① 天空 + 地平线光 + 光斑：画一次（#sceneBg）
   ② 灯光束：半分辨率，每秒约 25 帧重画（光束本来就是柔光，半分辨率看不出来）
   ③ 人群剪影：画一次，盖在灯光前面
   系统设置了减弱动效时灯光静止。 */
(function () {
  var back = document.getElementById("sceneBg");
  if (!back) return;
  function layer(cls) { var c = document.createElement("canvas"); c.className = "scene-layer " + cls; c.setAttribute("aria-hidden", "true"); return c; }
  var beams = layer("scene-beams"), crowd = layer("scene-crowd");
  back.after(beams); beams.after(crowd);
  var bx = beams.getContext("2d");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var W = 0, H = 0, dpr = 1, BEAM_RES = 0.5;

  function rng(seed) { var a = seed; return function () { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = back.clientWidth; H = back.clientHeight;
    var r = rng(7);

    // ① 天空、地平线光、光斑
    back.width = Math.round(W * dpr); back.height = Math.round(H * dpr);
    var c = back.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#060607"); g.addColorStop(0.55, "#0e0c0c"); g.addColorStop(0.85, "#251710"); g.addColorStop(1, "#140d0a");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    var h = c.createRadialGradient(W / 2, H * 0.9, 0, W / 2, H * 0.9, W * 0.6);
    h.addColorStop(0, "rgba(255,150,60,0.28)"); h.addColorStop(1, "rgba(255,150,60,0)");
    c.fillStyle = h; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "lighter";
    for (var i = 0; i < 46; i++) {
      var bxp = r() * W, byp = H * (0.18 + r() * 0.55), bs = 3 + r() * 14, ba = 0.05 + r() * 0.18;
      var col = r() < 0.35 ? "226,255,46" : (r() < 0.5 ? "255,160,80" : "255,236,210");
      var rg = c.createRadialGradient(bxp, byp, 0, bxp, byp, bs);
      rg.addColorStop(0, "rgba(" + col + "," + ba + ")"); rg.addColorStop(1, "rgba(" + col + ",0)");
      c.fillStyle = rg; c.beginPath(); c.arc(bxp, byp, bs, 0, Math.PI * 2); c.fill();
    }

    // ② 灯光层尺寸（半分辨率）
    beams.width = Math.max(1, Math.round(W * BEAM_RES)); beams.height = Math.max(1, Math.round(H * BEAM_RES));

    // ③ 人群剪影
    crowd.width = Math.round(W * dpr); crowd.height = Math.round(H * dpr);
    var k = crowd.getContext("2d"); k.setTransform(dpr, 0, 0, dpr, 0, 0);
    var base = H * 0.86;
    for (var row = 0; row < 3; row++) {
      var y0 = base + row * H * 0.05, size = 16 + row * 7, shade = ["#0c0b0d", "#08080a", "#040405"][row];
      k.fillStyle = shade; k.strokeStyle = shade; k.lineCap = "round";
      for (var x = -20; x < W + 40; x += size * (1.6 + r() * 0.8)) {
        var hy = y0 + (r() - 0.5) * size * 1.4;
        k.beginPath(); k.arc(x, hy, size * 0.62, 0, Math.PI * 2); k.fill();
        k.beginPath(); k.ellipse(x, hy + size * 1.7, size * 1.25, size * 1.3, 0, 0, Math.PI * 2); k.fill();
        if (r() < 0.22) { // 举起的手
          k.lineWidth = size * 0.36; var dir = r() < 0.5 ? -1 : 1;
          k.beginPath(); k.moveTo(x + dir * size * 0.8, hy + size); k.lineTo(x + dir * size * 1.1, hy - size * 2.4); k.stroke();
          if (r() < 0.4) { k.fillStyle = "rgba(255,255,240,0.85)"; k.fillRect(x + dir * size * 1.1 - 3, hy - size * 2.9, 6, 9); k.fillStyle = shade; }
        }
      }
      k.fillRect(0, y0 + size * 2.2, W, H);
    }
  }

  // 只重画 7 道灯光
  function frame(t) {
    var s = t / 1000;
    bx.setTransform(BEAM_RES, 0, 0, BEAM_RES, 0, 0);
    bx.clearRect(0, 0, W, H);
    bx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 7; i++) {
      var ox = W * (0.08 + i * 0.14), ang = Math.sin(s * 0.25 + i * 1.7) * 0.35 + (i - 3) * 0.06;
      var len = H * 1.15, spread = 0.07;
      var col = i % 3 === 1 ? "226,255,46" : "255,240,220";
      var bg = bx.createLinearGradient(ox, 0, ox + Math.sin(ang) * len, Math.cos(ang) * len);
      bg.addColorStop(0, "rgba(" + col + ",0.20)"); bg.addColorStop(1, "rgba(" + col + ",0)");
      bx.fillStyle = bg;
      bx.beginPath(); bx.moveTo(ox, -10);
      bx.lineTo(ox + Math.sin(ang - spread) * len, Math.cos(ang - spread) * len);
      bx.lineTo(ox + Math.sin(ang + spread) * len, Math.cos(ang + spread) * len);
      bx.closePath(); bx.fill();
    }
  }

  var last = 0, running = false;
  function loop(t) {
    if (!running) return;
    if (t - last > 40) { frame(t); last = t; } // 约 25 帧，够用且省电
    requestAnimationFrame(loop);
  }
  SF.scene = {
    start: function () {
      if (document.body.classList.contains("real")) return;
      build(); frame(0);
      if (!reduce && !running) { running = true; requestAnimationFrame(loop); }
    },
    resize: function () { if (!document.body.classList.contains("real")) { build(); frame(performance.now()); } }
  };
})();
