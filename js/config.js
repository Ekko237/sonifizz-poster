/* 配置：人格、风格、默认参数、双语文案。数据来自 PRD 第 4、8 节。 */
(function () {
  var PERSONAS = [
    { id: "rock",  zh: "摇滚炸场派", en: "ROCK IGNITER",  mottoZh: "散场耳鸣才算来过", mottoEn: "Ringing ears mean you were there",
      c1: "#FF3B1F", c2: "#FFD23F", flavorZh: "血橙", flavorEn: "Blood Orange",
      linesZh: ["音量越大越安心", "今晚嗓子不要了", "带你冲进第一排"], linesEn: ["The louder, the calmer I get", "No voice left tonight", "Front row, you're coming with me"] },
    { id: "edm",   zh: "电子夜行者", en: "NEON RAVER",    mottoZh: "心跳跟着 Drop 走", mottoEn: "My heart moves with the drop",
      c1: "#3A0CA3", c2: "#00F5D4", flavorZh: "蓝莓", flavorEn: "Blueberry",
      linesZh: ["我和低音炮是朋友", "天亮之前不回家", "等 Drop 的人举手"], linesEn: ["Bass is my best friend", "Not home till sunrise", "Hands up if you're waiting for the drop"] },
    { id: "folk",  zh: "民谣造梦家", en: "FOLK DREAMER",  mottoZh: "歌里有山，也有你", mottoEn: "Songs with mountains, and you",
      c1: "#F4A58A", c2: "#5E7D63", flavorZh: "白桃", flavorEn: "White Peach",
      linesZh: ["把晚风写进歌里", "这一首，唱给山听", "下一站，带你去远方"], linesEn: ["Writing the breeze into songs", "This one's for the mountains", "Next stop somewhere far, with you"] },
    { id: "hiphop", zh: "嘻哈态度王", en: "HIP-HOP BOSS", mottoZh: "麦在手，场子是我的", mottoEn: "Mic in hand, the floor is mine",
      c1: "#1A1A1A", c2: "#FFC300", flavorZh: "黑加仑", flavorEn: "Blackcurrant",
      linesZh: ["押韵是我的母语", "麦克风给我", "跟上我的拍子，别掉队"], linesEn: ["Rhymes are my first language", "Pass me the mic", "Keep up with my beat"] },
    { id: "jazz",  zh: "爵士微醺客", en: "JAZZ LOUNGER",  mottoZh: "慢半拍，刚刚好", mottoEn: "Half a beat late, just right",
      c1: "#0B3D2E", c2: "#D4A373", flavorZh: "青梅", flavorEn: "Green Plum",
      linesZh: ["今晚适合即兴", "为这段 solo 干杯", "陪我晃到散场"], linesEn: ["A night for improv", "Cheers to this solo", "Sway with me till closing"] },
    { id: "indie", zh: "独立梦游者", en: "INDIE DRIFTER", mottoZh: "小众，但不孤独", mottoEn: "Niche, never alone",
      c1: "#B8A1FF", c2: "#FFD6E0", flavorZh: "荔枝玫瑰", flavorEn: "Lychee Rose",
      linesZh: ["这首歌只有我懂", "在人群里做自己", "你也听这首？"], linesEn: ["Only I get this song", "Myself in the crowd", "You listen to this one too?"] }
  ];

  var STYLES = [
    { id: "neon",  zh: "霓虹夜场", en: "NEON NIGHT",  descZh: "深色底 发光描边", descEn: "Dark base, glowing lines" },
    { id: "riso",  zh: "复古丝印", en: "RISO PRINT",  descZh: "纸张颗粒 双色套印", descEn: "Paper grain, two-ink offset" },
    { id: "pop",   zh: "波普拼贴", en: "POP COLLAGE", descZh: "网点 粗描边 贴纸", descEn: "Halftone, bold outlines" },
    { id: "swiss", zh: "极简瑞士", en: "SWISS GRID",  descZh: "网格 大字 留白", descEn: "Grid, big type, space" }
  ];

  var DEFAULTS = {
    roundSec: 90,          // 单轮上限
    idleSec: 20,           // 空闲多久弹「还在吗」
    stillThereSec: 10,     // 「还在吗」倒计时
    resultMinSec: 20,      // 结果页保底扫码时间
    resultStaySec: 20,     // 结果页停留
    rerollMax: 1,          // 换一张次数
    peakMode: false,       // 高峰模式
    showNickOnScreen: true,// 大屏显示昵称（全局）
    lang: "zh",
    brandName: "SONIFIZZ",
    boothZh: "B 区 3 号展位", boothEn: "Booth B3",
    shareBase: "https://ekko237.github.io/sonifizz-poster/share.html" // 公网分享页（GitHub Pages）
  };

  var T = {
    zh: {
      idleTitle: "你是哪一派？\n印成海报带走", idleSub: "不用登录，还能免费领一罐",
      start: "点击开始", haveCode: "已在手机填好", queueScan: "扫码排队", queueScanSub: "先用手机填好\n到屏幕前 10 秒出图",
      queueN: "排队 {n} 人",
      s1Title: "你是哪一派？", random: "随便来一个",
      s2Title: "选一个海报风格",
      s3Title: "写下你的一句话", nick: "昵称", line: "一句话", hideNick: "大屏上不显示我的昵称", presets: "不想打字？点一句",
      generate: "生成海报", back: "上一步", next: "下一步", exit: "退出",
      gen1: "正在读取你的音乐人格", gen2: "正在调色", gen3: "正在压制成海报",
      s5Scan: "扫码带走你的海报", s5Gift: "凭海报到 {booth}，免费领一罐{flavor}味",
      reroll: "换一张", rerollUsed: "已换过", done: "完成", openLocal: "在本机打开分享页", backIn: "{n} 秒后回到首页",
      stillThere: "还在吗？", stillThereSub: "{n} 秒后回到首页", imHere: "我还在",
      codeTitle: "输入取号码", codeSub: "手机预填页上的 4 位数字", codeGo: "确认",
      blocked: "这句话不太适合上屏，换一句试试？", mysteryFan: "神秘乐迷",
      peakNote: "现在人多：先扫码排队，到屏幕前 10 秒出图"
    },
    en: {
      idleTitle: "Which tribe\nare you?", idleSub: "Get it on a poster. No sign-up. Free can.",
      start: "Tap to start", haveCode: "I filled it on my phone", queueScan: "Scan to queue", queueScanSub: "Fill it on your phone,\nprint in 10 seconds here",
      queueN: "{n} in line",
      s1Title: "Which tribe are you?", random: "Surprise me",
      s2Title: "Pick a poster style",
      s3Title: "Say it in one line", nick: "Nickname", line: "Your line", hideNick: "Hide my nickname on the big screen", presets: "No typing? Tap one",
      generate: "Make my poster", back: "Back", next: "Next", exit: "Exit",
      gen1: "Reading your music persona", gen2: "Mixing the colors", gen3: "Pressing your poster",
      s5Scan: "Scan to take your poster", s5Gift: "Show it at {booth} for a free {flavor} can",
      reroll: "New one", rerollUsed: "Used", done: "Done", openLocal: "Open share page here", backIn: "Home in {n}s",
      stillThere: "Still there?", stillThereSub: "Home in {n}s", imHere: "I'm here",
      codeTitle: "Enter your code", codeSub: "4 digits from your phone", codeGo: "Confirm",
      blocked: "That line can't go on screen. Try another?", mysteryFan: "Mystery Fan",
      peakNote: "Busy now: scan to queue, print in 10s when it's your turn"
    }
  };

  /* 手机分享页、预填页的双语文案（跟着海报语言或 ?lang=en 走） */
  var MT = {
    zh: {
      you: "你是{p}", save: "保存图片", saveHint: "也可以长按图片保存到相册", share: "分享给朋友",
      gift: "给店员看这页<br>免费领一罐{f}味", limit: "每张海报限领一次", redeem: "店员核销", redeemed: "已领取",
      invite: "你朋友是哪一派？", makeOne: "我也做一张", badTitle: "这张海报无法显示", badSub: "链接可能不完整或被改动过",
      aiNote: "本图由 AI 生成，仅供娱乐", report: "举报", reportTitle: "举报这张海报",
      r_vulgar: "低俗或辱骂", r_illegal: "违法违规", r_ad: "广告导流", r_other: "其他", submit: "提交", cancel: "取消",
      saveWait: "高清海报马上就好，稍等一下", holdSave: "请长按图片保存", copied: "链接已复制", copyManual: "请复制地址栏链接",
      redeemOk: "核销成功", reportOk: "已收到，我们会尽快处理", shareTitle: "我是{p}", pageTitle: "我的音乐人格海报 | SONIFIZZ", alt: "我的音乐人格海报",
      t1: "你是哪一派？", t2: "选一个海报风格", t3: "写下你的一句话", nick: "昵称", line: "一句话", presets: "不想打字？点一句",
      hide: "大屏上不显示我的昵称", codeLabel: "你的取号码", howTitle: "轮到你时怎么做",
      howText: "在大屏首页点「已在手机填好」，输入上面 4 位数字，10 秒出图。", next: "下一步", getCode: "拿号排队", back: "上一步",
      wait: "前面还有 {n} 人，大约 {m} 分钟", goNow: "现在就可以去大屏了", pfTitle: "排队预填 | SONIFIZZ"
    },
    en: {
      you: "Your tribe: {p}", save: "Save image", saveHint: "Or press and hold the image to save it", share: "Share with friends",
      gift: "Show this page to our staff<br>for a free {f} can", limit: "One can per poster", redeem: "Staff: redeem", redeemed: "Redeemed",
      invite: "Which tribe is your friend?", makeOne: "Make my own", badTitle: "This poster can't be shown", badSub: "The link may be incomplete or altered",
      aiNote: "AI-generated, just for fun", report: "Report", reportTitle: "Report this poster",
      r_vulgar: "Vulgar or abusive", r_illegal: "Illegal content", r_ad: "Spam or ads", r_other: "Other", submit: "Submit", cancel: "Cancel",
      saveWait: "HD poster is almost ready", holdSave: "Press and hold the image to save", copied: "Link copied", copyManual: "Copy the link from the address bar",
      redeemOk: "Redeemed", reportOk: "Thanks, we'll review it soon", shareTitle: "My tribe: {p}", pageTitle: "My music persona poster | SONIFIZZ", alt: "My music persona poster",
      t1: "Which tribe are you?", t2: "Pick a poster style", t3: "Say it in one line", nick: "Nickname", line: "Your line", presets: "No typing? Tap one",
      hide: "Hide my nickname on the big screen", codeLabel: "Your queue code", howTitle: "When it's your turn",
      howText: "On the big screen, tap \u201CI filled it on my phone\u201D and enter the 4 digits above. Your poster prints in about 10 seconds.",
      next: "Next", getCode: "Get my code", back: "Back",
      wait: "{n} ahead of you, about {m} min", goNow: "You can go to the big screen now", pfTitle: "Queue up | SONIFIZZ"
    }
  };

  window.SF = window.SF || {};
  SF.MT = MT;
  SF.mt = function (lang, key, vars) {
    var s = (MT[lang] && MT[lang][key]) || MT.zh[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  };
  SF.applyMT = function (lang) { // 页面上带 data-k 的文字按语言替换
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-k]").forEach(function (el) { el.textContent = SF.mt(lang, el.dataset.k); });
    document.querySelectorAll("[data-k-label]").forEach(function (el) { el.setAttribute("aria-label", SF.mt(lang, el.dataset.kLabel)); });
  };
  SF.PERSONAS = PERSONAS;
  SF.STYLES = STYLES;
  SF.DEFAULTS = DEFAULTS;
  SF.T = T;
  SF.persona = function (id) { return PERSONAS.find(function (p) { return p.id === id; }); };
  SF.style = function (id) { return STYLES.find(function (s) { return s.id === id; }); };
  SF.LOGO_SVG = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="21" stroke="currentColor" stroke-width="4"/><circle cx="18" cy="31" r="4.5" fill="currentColor"/><circle cx="27" cy="21" r="3.5" fill="currentColor"/><circle cx="33" cy="13" r="2.5" fill="currentColor"/></svg>';
})();
