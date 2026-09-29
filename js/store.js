/* 本地存储：参数、统计、排队预填、分享链接编解码。
   原型里所有数据存在浏览器 localStorage；正式版换成服务端接口。 */
(function () {
  var K = { settings: "sf.settings", stats: "sf.stats", queue: "sf.queue", redeemed: "sf.redeemed", reports: "sf.reports", serial: "sf.serial" };

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

  SF.nextSerial = function () { var n = read(K.serial, 426) + 1; write(K.serial, n); return n; };

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
  function payload(d) { return [d.v, d.p, d.s, d.seed, d.n, d.t, d.h ? 1 : 0, d.no, d.l || "zh"].join("|"); }

  SF.encodeShare = function (d) {
    var body = { v: 1, p: d.p, s: d.s, seed: d.seed, n: d.n, t: d.t, h: d.h ? 1 : 0, no: d.no, l: d.l || "zh" };
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
  SF.redeemCode = function (d) { return hash("redeem|" + d.seed + "|" + d.no).toUpperCase().slice(-6).padStart(6, "0"); };
})();
