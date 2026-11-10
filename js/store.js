/* 本地存储：参数、统计、排队预填、分享链接编解码。
   原型里所有数据存在浏览器 localStorage；正式版换成服务端接口。 */
(function () {
  var K = { settings: "sf.settings", stats: "sf.stats", queue: "sf.queue", redeemed: "sf.redeemed", reports: "sf.reports", serial: "sf.serial", mute: "sf.mute", today: "sf.today" };

  function read(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式下写不进去也能跑 */ }
  }

  SF.settings = function () { return Object.assign({}, SF.DEFAULTS, read(K.settings, {})); };
  SF.saveSettings = function (patch) { write(K.settings, Object.assign(read(K.settings, {}), patch)); };
  SF.resetSettings = function () { write(K.settings, {}); };

  SF.stats = function () {
    var s = Object.assign({ rounds: 0, done: 0, rerolls: 0, fromCode: 0, occupySum: 0, occupyN: 0, timeouts: 0, idleOuts: 0, shareOpens: 0, redeems: 0,
      blocked: {}, persona: {}, style: {} }, read(K.stats, {}));
    s.blocked = Object.assign({ word: 0, contact: 0, brand: 0, format: 0, length: 0, tamper: 0 }, s.blocked);
    return s;
  };
  SF.bump = function (fn) { var s = SF.stats(); fn(s); write(K.stats, s); };
  SF.clearStats = function () { write(K.stats, {}); write(K.reports, []); write(K.redeemed, {}); };

  SF.todayCount = function () { var v = read(K.today, {}); return v.d === new Date().toDateString() ? v.n : 0; };
  SF.bumpToday = function () { var d = new Date().toDateString(), v = read(K.today, {}); write(K.today, { d: d, n: v.d === d ? v.n + 1 : 1 }); };
  SF.muted = function () { return read(K.mute, false); };            // 声音开关，按设备记
  SF.setMuted = function (v) { write(K.mute, !!v); };
  // 海报编号：这台大屏当天的第几张，每天从 0001 数起（正式版由服务端按展位统一发号）
  function serialToday() { var v = read(K.serial, {}); return v && v.d === new Date().toDateString() ? v.n : 0; }
  SF.peekSerial = function () { return serialToday() + 1; }; // 下一张会拿到的编号（风格缩略图先印出来）
  SF.nextSerial = function () { var n = serialToday() + 1; write(K.serial, { d: new Date().toDateString(), n: n }); return n; };

  /* 排队预填：手机端存一条，拿 4 位取号码；大屏按码取出 */
  SF.queue = function () { return read(K.queue, []); };
  SF.enqueue = function (entry) {
    var q = SF.queue(), code;
    do { code = String(1000 + Math.floor(Math.random() * 9000)); } while (q.some(function (e) { return e.code === code; }));
    entry.code = code; entry.at = Date.now(); q.push(entry); write(K.queue, q); return code;
  };
  SF.takeFromQueue = function (code) {
    var q = SF.queue(), i = q.findIndex(function (e) { return e.code === code; });
    if (i < 0) return null;
    var e = q.splice(i, 1)[0]; write(K.queue, q); return e;
  };
  SF.queueCount = function () { return SF.queue().length; };

  SF.reports = function () { return read(K.reports, []); };
  SF.addReport = function (r) { var a = SF.reports(); a.unshift(Object.assign({ at: Date.now() }, r)); write(K.reports, a.slice(0, 200)); };
  SF.isRedeemed = function (key) { return !!read(K.redeemed, {})[key]; };
  SF.redeem = function (key) { var m = read(K.redeemed, {}); m[key] = Date.now(); write(K.redeemed, m); };

  /* 分享参数：JSON → UTF-8 → base64url，放在 # 后面（不会发给服务器）。
     sig 是前端简单哈希，只防手滑改错；正式版换服务端 HMAC 签名。 */
  function b64urlEncode(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }
  function payload(d) { return [d.v, d.p, d.s, d.seed, d.n, d.t, d.h ? 1 : 0, d.no, d.l || "zh"].concat(d.b ? [d.b] : [], d.f ? [d.f.p + "," + d.f.n] : []).join("|"); }
  /* 分享参数短格式（#s=）：各字段按固定顺序用换行连起来，人格、风格存序号，种子、编号、BPM 存 36 进制，念过一遍的声纹是 24 个 36 进制字，UTF-8 后 base64url。
     比 JSON 短四成，二维码少一圈模块，电脑外壳里也扫得出。#d= 的旧链接照样能打开 */
  function ids(list) { return list.map(function (x) { return x.id; }); }
  SF.encodeShort = function (d) {
    var f = d.f || {}, parts = ["2", ids(SF.PERSONAS).indexOf(d.p), ids(SF.STYLES).indexOf(d.s), d.h ? 1 : 0, d.l === "en" ? "e" : "z",
      (d.seed >>> 0).toString(36), (d.no || 0).toString(36), d.b ? d.b.toString(36) : "", f.p ? ids(SF.PERSONAS).indexOf(f.p) : "", f.n || "", d.n, d.t, d.vp || ""];
    var str = parts.join("\n");
    return b64urlEncode(str + "\n" + hash("sonifizz-proto2|" + str));
  };
  // 聊天软件截断链接很常见：字符不对或长度不对的 base64 解不开，当作坏链接
  function b64ok(s) { return /^[A-Za-z0-9_-]+$/.test(s) && s.length % 4 !== 1; }
  SF.decodeShort = function (s) {
    if (!b64ok(s)) return null;
    var all = b64urlDecode(s).split("\n"), sig = all.pop(), str = all.join("\n"), x = all;
    var d = { v: 2, p: ids(SF.PERSONAS)[+x[1]], s: ids(SF.STYLES)[+x[2]], h: +x[3], l: x[4] === "e" ? "en" : "zh", seed: parseInt(x[5], 36), no: parseInt(x[6], 36), n: x[10], t: x[11] };
    if (x[7]) d.b = parseInt(x[7], 36);
    if (x[8] !== "") d.f = { p: ids(SF.PERSONAS)[+x[8]], n: x[9] };
    if (/^[0-9a-z]{24}$/.test(x[12] || "")) d.vp = x[12]; // 念过一遍的声纹
    d.sigOk = all.length === 13 && sig === hash("sonifizz-proto2|" + str) && (!x[12] || !!d.vp);
    return d;
  };
  // 邀请参数：分享页点罐子去预填页时带上「谁邀请的」（派 + 昵称，换行连起来），打开时重新审一遍昵称
  SF.encodeFrom = function (p, n) { return b64urlEncode(p + "\n" + n); };
  SF.decodeFrom = function (str) {
    if (!b64ok(str)) return null;
    var x = b64urlDecode(str).split("\n");
    return x.length === 2 && SF.persona(x[0]) && SF.checkText(x[1], "ok").ok ? { p: x[0], n: x[1] } : null;
  };

  SF.encodeShare = function (d) {
    var body = { v: 1, p: d.p, s: d.s, seed: d.seed, n: d.n, t: d.t, h: d.h ? 1 : 0, no: d.no, l: d.l || "zh" };
    if (d.b) body.b = d.b; // 拍过节奏才有 BPM；没有 b 的旧链接校验码不变
    if (d.f) body.f = { p: d.f.p, n: d.f.n }; // 被朋友邀请来测的：带上邀请人的派和昵称，分享页画合拍卡
    body.sig = hash("sonifizz-proto|" + payload(body));
    return b64urlEncode(JSON.stringify(body));
  };
  SF.decodeShare = function (str) {
    try {
      var d = JSON.parse(b64urlDecode(str));
      d.sigOk = d.sig === hash("sonifizz-proto|" + payload(d));
      return d;
    } catch (e) { return null; }
  };
  SF.redeemCode = function (d) { // 6 位核销码，只用不会看混的字符（没有 0 O 1 I）
    var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", h = parseInt(hash("redeem|" + d.seed + "|" + d.no), 36), out = "";
    for (var i = 0; i < 6; i++) { out += A[h % A.length]; h = Math.floor(h / A.length); }
    return out;
  };
})();
