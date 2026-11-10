/* 声音：全部用 WebAudio 现场合成，不带音频文件。
   六派各有一段招牌音色（选卡时响）；生成时把这句话的声纹当成一小段旋律播出来，音色跟人格走；
   出图那一下是开罐的「嘶」，按钮是气泡破开的「啵」；四种风格、开始、往前往回、换一张、完成各有自己的一声；
   结果页和每轮最后 5 秒滴答，内容被拦是一声低音，店员核销是盖章的闷响。
   浏览器要等用户点过一次才让出声，所以第一次要出声时才建 AudioContext（都在点击里触发）；静音设置记在本机。 */
(function () {
  var ac = null, out = null, comp = null, noiseBuf = null, bornAt = 0;
  function audio() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)(); bornAt = performance.now();
      comp = ac.createDynamicsCompressor();
      out = ac.createGain(); out.gain.value = 0.5;
      out.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume();
    return ac;
  }
  function hz(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  // 一个音：振荡器 + 快起慢落的包络；freqEnd 给了就滑音
  function tone(type, freq, at, dur, vol, freqEnd, dest) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, at);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(dest || out); o.start(at); o.stop(at + dur + 0.03);
  }
  // 一段滤过的白噪声：开罐的嘶声、镲片、拨弦的杂音
  function noise(at, dur, vol, type, f0, f1) {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(f0, at);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(at); s.stop(at + dur + 0.03);
  }
  function drive(amount) { // 摇滚用的失真
    var ws = ac.createWaveShaper(), n = 1024, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; curve[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
    var g = ac.createGain(); g.gain.value = 0.82; // 失真把波形顶平了，输入调小不见效，在后面压一级才和其他派一样响
    ws.curve = curve; ws.connect(g); g.connect(out); return ws;
  }

  // 每一派的一个音：招牌声和生成时的旋律都用它
  var VOICE = {
    rock: function (m, at, dur, v) { var d = drive(16); tone("sawtooth", hz(m), at, dur, v * 0.45, 0, d); tone("sawtooth", hz(m + 7), at, dur, v * 0.35, 0, d); },
    edm: function (m, at, dur, v) { tone("square", hz(m), at, dur * 0.8, v * 0.3); tone("sawtooth", hz(m + 12) * 1.005, at, dur * 0.6, v * 0.18); },
    folk: function (m, at, dur, v) { tone("triangle", hz(m), at, dur * 1.6, v * 0.7); tone("sine", hz(m + 12), at, dur * 1.2, v * 0.22); },
    hiphop: function (m, at, dur, v) { tone("sine", hz(m - 12), at, dur * 1.2, v * 0.9, hz(m - 14)); noise(at, 0.04, v * 0.2, "highpass", 6000); },
    jazz: function (m, at, dur, v) { [0, 4, 11].forEach(function (k, i) { tone("sine", hz(m + k) * (1 + i * 0.002), at + i * 0.012, dur * 1.8, v * 0.34); }); },
    indie: function (m, at, dur, v) { tone("sine", hz(m + 12), at, dur * 2.2, v * 0.55); tone("sine", hz(m + 19), at + 0.09, dur * 1.8, v * 0.24); }
  };
  // 招牌声：每一派一小句，0.4 秒上下
  var SIGN = {
    rock: function (at) { VOICE.rock(40, at, 0.45, 0.6); noise(at, 0.07, 0.2, "bandpass", 1800); },                       // 失真强力和弦
    edm: function (at) { tone("sine", 150, at, 0.3, 0.78, 45); VOICE.edm(64, at + 0.15, 0.17, 0.7); VOICE.edm(71, at + 0.27, 0.17, 0.6); }, // 808 底鼓 + 两下合成器
    folk: function (at) { [64, 67, 71, 76].forEach(function (m, i) { VOICE.folk(m, at + i * 0.06, 0.34, 0.72); }); },           // 扫一下木吉他
    hiphop: function (at) { tone("sine", 120, at, 0.26, 0.86, 48); noise(at + 0.2, 0.12, 0.36, "bandpass", 2200); tone("sine", 120, at + 0.34, 0.2, 0.6, 50); }, // 动次打次
    jazz: function (at) { VOICE.jazz(60, at, 0.5, 0.9); VOICE.jazz(65, at + 0.22, 0.45, 0.68); },                               // 两个七和弦
    indie: function (at) { VOICE.indie(67, at, 0.5, 1.35); VOICE.indie(74, at + 0.18, 0.5, 1); }                              // 叮咚的铃
  };
  // 四种海报风格选中时各响一声：霓虹是电流滋一下，丝印是滚筒压一下纸，波普是弹簧「啵嘤」，瑞士是干净的一声提示音
  var STYLE = {
    neon: function (at) { tone("sawtooth", 880, at, 0.16, 0.72, 1760); noise(at, 0.1, 0.5, "bandpass", 5000, 9000); },
    riso: function (at) { noise(at, 0.16, 0.8, "lowpass", 700, 300); tone("sine", 140, at, 0.12, 0.72, 90); },
    pop: function (at) { tone("sine", 420, at, 0.22, 0.5, 980); pop(at + 0.12, 1300); },
    swiss: function (at) { tone("sine", hz(84), at, 0.28, 0.58); tone("sine", hz(91), at + 0.05, 0.24, 0.29); }
  };
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  var BASE = { rock: 52, edm: 57, folk: 60, hiphop: 50, jazz: 57, indie: 64 };
  SF.MELODY = { notes: 12, step: 0.115 }; // 生成动画按这个节奏让液面上的「播放头」走过去
  function melody(pid, amps, at) { // 声纹从左到右当成 12 个音：越响的地方音越高
    for (var i = 0; i < SF.MELODY.notes; i++) {
      var a = amps[Math.floor(i / SF.MELODY.notes * amps.length)];
      VOICE[pid](BASE[pid] + PENTA[Math.min(PENTA.length - 1, Math.floor(a * PENTA.length))], at + i * SF.MELODY.step, 0.16, 0.32 + a * 0.24); // 旋律和冒泡同时响，整段压到和按钮差不多响
    }
  }
  function pop(at, f, v) { tone("sine", f, at, 0.08, v || 0.7, f * 0.4); }
  function note(pid, a, at) { VOICE[pid](BASE[pid] + PENTA[Math.min(PENTA.length - 1, Math.floor(a * PENTA.length))], at, 0.16, 0.55 + a * 0.35); } // 打一个字响一个音：越响的字音越高

  SF.sfx = function (name, arg) {
    if (SF.muted()) return;
    var a = audio();
    if (a.state !== "running") { a.resume().then(function () { SF.sfx(name, arg); }); return; } // 还没跑起来：等跑起来再响，第一下点击也有声音
    var at = a.currentTime + (performance.now() - bornAt < 400 ? 0.08 : 0.01); // 刚建好的头几百毫秒，输出要过一会儿才真正开始
    if (name === "tap") pop(at, 700 + Math.random() * 300);
    else if (name === "persona") SIGN[arg](at);
    else if (name === "melody") melody(arg.p, arg.amps, at);
    else if (name === "note") note(arg.p, arg.a, at);
    else if (name === "pops") for (var i = 0; i < arg; i++) pop(at + 0.1 + Math.random() * 1.4, 900 + Math.random() * 900, 0.38); // 和旋律同时响，压小一点
    else if (name === "open") { tone("square", 2400, at, 0.02, 0.25); noise(at + 0.01, 0.42, 0.45, "highpass", 3500, 7500); noise(at + 0.04, 0.3, 0.18, "bandpass", 900); }
    else if (name === "land") { tone("sine", 150, at, 0.16, 0.65, 60); tone("sine", hz(84), at + 0.04, 0.6, 0.22); tone("sine", hz(91), at + 0.11, 0.5, 0.13); } // 罐子落地的闷响 + 叮
    else if (name === "kick") { tone("sine", 160, at, 0.24, 0.76, 46); noise(at, 0.03, 0.25, "highpass", 3000); }
    else if (name === "start") { [0, 7, 12].forEach(function (k, i) { tone("sine", hz(72 + k), at + i * 0.05, 0.3, 0.42); }); pop(at + 0.16, 1500); } // 点击开始：往上一串音 + 一个气泡
    else if (name === "style") STYLE[arg](at);
    else if (name === "back") { tone("sine", hz(83 + arg * 2), at, 0.12, 0.6); tone("sine", hz(76 + arg * 2), at + 0.07, 0.18, 0.45); } // 往回走一步：音往下走
    else if (name === "reroll") { noise(at, 0.3, 0.32, "bandpass", 900, 4200); pop(at + 0.28, 1200); }                              // 换一张：哗地洗一下牌
    else if (name === "done") { [0, 4, 7, 12].forEach(function (k, i) { tone("triangle", hz(67 + k), at + i * 0.06, 0.5, 0.46); }); } // 完成：往上的大三和弦
    else if (name === "step") { tone("sine", hz(76 + arg * 2), at, 0.12, 0.6); tone("sine", hz(83 + arg * 2), at + 0.07, 0.18, 0.43); } // 每进一步音高往上走一级
    else if (name === "digit") pop(at, 660 * Math.pow(2, arg / 6));                                                                        // 取号码每按一位音高升一点
    else if (name === "tick") tone("square", 1600, at, 0.03, 0.27);
    else if (name === "error") tone("triangle", 220, at, 0.2, 0.57, 140);
    else if (name === "stamp") { tone("sine", 90, at, 0.22, 0.9, 50); noise(at, 0.08, 0.38, "lowpass", 900); }
  };
  SF.audioCtx = audio; // 念一遍时麦克风接到同一个 AudioContext 上量音量（不接到扬声器）
  // 存成视频时把合成出来的声音同时接到录制流上（扬声器照常响），返回断开的函数
  SF.audioTap = function (dest) { audio(); comp.connect(dest); return function () { comp.disconnect(dest); }; };
  SF.sfxMute = function () { if (ac) out.gain.setTargetAtTime(SF.muted() ? 0 : 0.5, ac.currentTime, 0.01); }; // 一关就断，余音也不留
  SF.buzz = function (pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }; // 手机上点按轻振；不支持振动的浏览器（iOS Safari）没有这个方法
})();
