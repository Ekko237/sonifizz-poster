/* 念一遍：点麦克风把这句话念出来，3 秒按时间分成 24 段，每段记最响的音量，就是这一张海报的声纹。
   不录音，只留 24 个音量数。 */
(function () {
  var VP_N = 24, VP_MS = 3000, recording = false;
  // on.frame(bins, max) 边念边调用；on.done(bins, max) 念完调用，max 小于 0.01 是没听到声音；on.denied() 没给麦克风
  SF.recordVoice = function (on) {
    if (recording) return;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (stream) {
      recording = true;
      var ac = SF.audioCtx(), src = ac.createMediaStreamSource(stream), an = ac.createAnalyser(), buf = new Float32Array(1024), bins = [], t0 = performance.now();
      an.fftSize = 1024; src.connect(an);
      on.start();
      (function frame() {
        var el = performance.now() - t0, k = Math.min(VP_N - 1, Math.floor(el / VP_MS * VP_N)), sum = 0;
        an.getFloatTimeDomainData(buf);
        for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        bins[k] = Math.max(bins[k] || 0, Math.sqrt(sum / buf.length));
        on.frame(bins.slice(0, k + 1), Math.max(0.02, Math.max.apply(null, bins.map(function (b) { return b || 0; })))); // 边念边长
        if (el < VP_MS) { requestAnimationFrame(frame); return; }
        stream.getTracks().forEach(function (tr) { tr.stop(); }); src.disconnect();
        recording = false;
        for (var j = 0; j < VP_N; j++) bins[j] = bins[j] || 0;
        on.done(bins, Math.max.apply(null, bins));
      })();
    }, on.denied);
  };
})();
