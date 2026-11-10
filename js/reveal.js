/* 分享页倒汽：人格色的汽水带着这句话的声纹液面涨满，再从中间往两边一颗颗化开露出海报；存成视频时把画布和旋律一起录下来 */
(function () {
  SF.makeReveal = function (canvas, poster, d) {
    var ctx = canvas.getContext("2d"), layer = document.createElement("canvas"), ink = layer.getContext("2d");
    var w = canvas.width, h = canvas.height, p = SF.persona(d.p), amps = SF.voiceOf(d, 40);
    var frame = 0, active = false, duration = 2150;
    layer.width = w; layer.height = h;
    function liquid(t) {
      var rise = Math.min(t / 1100, 1), surface = h * (1 - rise), grad = ink.createLinearGradient(0, 0, w, h);
      ink.clearRect(0, 0, w, h);
      grad.addColorStop(0, p.c2); grad.addColorStop(1, p.c1); ink.fillStyle = grad;
      ink.beginPath(); ink.moveTo(0, h);
      for (var i = 0; i < amps.length; i++) {
        var x = i * w / (amps.length - 1), wave = Math.sin(i * 0.7 + t / 300) * 4;
        var y = surface - (amps[i] - 0.35) * 35 * Math.sin(Math.PI * rise) + wave * Math.sin(Math.PI * rise);
        ink.lineTo(x, y);
      }
      ink.lineTo(w, h); ink.closePath(); ink.fill();
      ink.fillStyle = "rgba(255,255,255,0.66)";
      for (var b = 0; b < 34; b++) {
        var bx = ((b * 137 + 31) % w) + Math.sin(t / 500 + b) * 8;
        var by = h - ((b * 97 + t * (0.08 + b % 5 * 0.012)) % h);
        if (by > surface + 12) { ink.beginPath(); ink.arc(bx, by, 2 + b % 4, 0, Math.PI * 2); ink.fill(); }
      }
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      if (t < 1100) { ctx.drawImage(poster, 0, 0, w, h); ctx.fillStyle = "rgba(16,16,20,0.84)"; ctx.fillRect(0, 0, w, h); liquid(t); ctx.drawImage(layer, 0, 0); return; } // 倒汽时海报在暗处隐约看得见，不像空白
      ctx.drawImage(poster, 0, 0, w, h);
      if (t >= 2000) return;
      liquid(1100);
      var progress = (t - 1100) / 900, spacing = 24;
      ink.globalCompositeOperation = "destination-out";
      for (var y = 0; y < h + spacing; y += spacing) {
        for (var x = 0; x < w + spacing; x += spacing) {
          var edge = Math.abs(x - w / 2) / (w / 2), size = Math.max(0, Math.min(1, (progress - edge * 0.7) / 0.3));
          if (size) { ink.beginPath(); ink.arc(x, y, size * spacing * 0.72, 0, Math.PI * 2); ink.fill(); }
        }
      }
      ink.globalCompositeOperation = "source-over"; ctx.drawImage(layer, 0, 0);
    }
    function play(progress, done) {
      if (active) return false;
      active = true; canvas.hidden = false;
      var start = performance.now(); draw(0);
      function tick(now) {
        var elapsed = Math.min(now - start, duration); draw(elapsed);
        if (progress) progress(elapsed / duration);
        if (elapsed < duration) frame = requestAnimationFrame(tick);
        else { active = false; canvas.hidden = true; if (done) done(); }
      }
      frame = requestAnimationFrame(tick); return true;
    }
    var untap = null;
    return { play: play, busy: function () { return active; }, context: SF.audioCtx, sound: function () {
      var ac = SF.audioCtx();
      if (ac.state === "running") SF.sfx("melody", { p: d.p, amps: amps }); // 浏览器还不让出声时就不出声
      return ac;
    }, audioDestination: function (ac) {
      var dest = ac.createMediaStreamDestination();
      untap = SF.audioTap(dest);
      return dest;
    }, disconnectAudio: function () { untap(); } };
  };
})();
