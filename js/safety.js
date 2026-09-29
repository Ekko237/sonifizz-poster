/* 内容安全：大屏、手机预填页、手机分享页三处共用同一套规则。
   原型用本地示例词表 + 正则；正式版在此之后再过一道云内容安全接口（见 PRD 7.6）。
   关键设计：这里审的文字只会进海报的排版层，永远不进图像生成的提示词。 */
(function () {
  SF.LIMITS = { nick: 8, line: 20 };

  /* 示例词表（原型演示用，运营后台可增删）。不放真实的政治敏感词，正式版交给接口。 */
  var DEFAULT_WORDS = {
    word: ["垃圾", "去死", "滚蛋", "脑残", "废物", "智障", "约炮", "裸聊", "色情", "赌博", "博彩", "代开发票", "毒品", "敏感词示例", "laji", "收票", "转票", "代抢"],
    brand: ["难喝", "假货", "过期", "拉肚子", "山寨", "竞品汽水"]
  };
  SF.words = function () {
    try { var w = JSON.parse(localStorage.getItem("sf.words")); if (w && w.word && w.brand) return w; } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_WORDS));
  };
  SF.saveWords = function (w) { try { localStorage.setItem("sf.words", JSON.stringify(w)); } catch (e) {} };
  SF.resetWords = function () { try { localStorage.removeItem("sf.words"); } catch (e) {} };

  /* 字数：中文算 1，英文数字半角算 0.5 */
  function units(s) { var n = 0; for (var ch of s) n += /[\x00-\xff]/.test(ch) ? 0.5 : 1; return n; }
  SF.textUnits = units;

  /* 预处理：全角转半角、去零宽和控制字符、统一小写、中文数字转阿拉伯数字 */
  var CN_NUM = { "零": "0", "〇": "0", "一": "1", "幺": "1", "二": "2", "两": "2", "三": "3", "四": "4", "五": "5", "六": "6", "七": "7", "八": "8", "九": "9" };
  function normalize(s) {
    return (s || "").normalize("NFKC").replace(/[​-‏⁠﻿]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").toLowerCase();
  }
  function compact(s) { return s.replace(/[\s\p{P}\p{S}_]/gu, ""); }  // 去掉所有空格和符号，防「微 信」「v-x」拆字
  function digitRun(s) { // 中文数字转阿拉伯数字，再去掉数字之间的空格/横线/点，「138 1234 5678」「一三八…」都会连成一串
    return s.replace(/[零〇一幺二两三四五六七八九]/g, function (c) { return CN_NUM[c]; }).replace(/(\d)[\s\-_.·,，/]+(?=\d)/g, "$1");
  }

  /* 允许的字符：中文、英文、数字、常用中英文标点、少量 emoji */
  var ALLOWED = /^[\p{Script=Han}a-zA-Z0-9\s，。！？、；：“”‘’「」…·,.!?;:'"()（）~\-+&#%@\p{Extended_Pictographic}‍️]*$/u;

  var CONTACT_WORDS = /(微信|威信|薇信|v信|vx|wx|weixin|wechat|加我|加v|qq|扣扣|企鹅号|抖音号|小红书号|私信我|私聊|滴滴我|dd我|联系方式|电话)/;
  var URL_RE = /(https?:|www\.|\.(com|cn|net|org|top|xyz|io|me|cc|vip|shop|link)\b|点(com|cn|net))/;

  /* 检查一段文字，返回命中的类别；不返回命中的具体词（防止有人试探词表） */
  function checkOne(raw) {
    var n = normalize(raw), c = compact(n), nospace = n.replace(/\s/g, "");
    if (!ALLOWED.test(raw.normalize("NFKC"))) return "format";
    if ((raw.match(/\p{Extended_Pictographic}/gu) || []).length > 2) return "format";
    if (URL_RE.test(nospace) || CONTACT_WORDS.test(c) || /@[a-z0-9_]{3,}/.test(nospace)) return "contact";
    var ds = digitRun(n);
    if (/1[3-9]\d{9}/.test(ds) || /\d{6,}/.test(ds)) return "contact";
    var w = SF.words();
    if (w.word.some(function (x) { return x && c.indexOf(compact(normalize(x))) >= 0; })) return "word";
    if (w.brand.some(function (x) { return x && c.indexOf(compact(normalize(x))) >= 0; })) return "brand";
    return null;
  }

  /* 对外：同时检查昵称和一句话。reason: empty | length | format | contact | word | brand */
  SF.checkText = function (nick, line) {
    nick = (nick || "").trim(); line = (line || "").trim();
    if (!nick || !line) return { ok: false, reason: "empty", field: !nick ? "nick" : "line" };
    if (units(nick) > SF.LIMITS.nick) return { ok: false, reason: "length", field: "nick" };
    if (units(line) > SF.LIMITS.line) return { ok: false, reason: "length", field: "line" };
    var a = checkOne(nick); if (a) return { ok: false, reason: a, field: "nick" };
    var b = checkOne(line); if (b) return { ok: false, reason: b, field: "line" };
    return { ok: true };
  };

  /* 给用户看的提示：长度可以说具体，内容类一律同一句，不暴露词表 */
  SF.blockMessage = function (r, lang) {
    var en = lang === "en";
    if (r.reason === "empty") return en ? "Fill in both boxes" : "昵称和一句话都要填";
    if (r.reason === "length") return r.field === "nick" ? (en ? "Nickname: 8 characters max" : "昵称最多 8 个字") : (en ? "Your line: 20 characters max" : "一句话最多 20 个字");
    return en ? "That line can't go on screen. Try another?" : "这句话不太适合上屏，换一句试试？";
  };
})();
