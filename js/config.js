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
    { id: "neon",  zh: "霓虹夜场", en: "NEON NIGHT",  descZh: "发光空心字", descEn: "Hollow glowing type" },
    { id: "riso",  zh: "复古丝印", en: "RISO PRINT",  descZh: "竖排双色套印", descEn: "Vertical two-ink print" },
    { id: "pop",   zh: "波普拼贴", en: "POP COLLAGE", descZh: "撕纸加对话框", descEn: "Torn paper, speech bubble" },
    { id: "swiss", zh: "极简瑞士", en: "SWISS GRID",  descZh: "网格和大编号", descEn: "Grid and a giant number" }
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
      idleTitle: "你是哪一派？\n印成海报带走", idleSub: "不用登录，还能免费领一罐气泡水",
      start: "点击开始", haveCode: "输入取号码", boothOn: "放大展位屏", boothOff: "退出放大", today: "今天已经印了 {n} 张", todayOne: "今天已经印了 1 张", queueScan: "扫码排队", queueScanSub: "先用手机填好\n到屏幕前 10 秒出图",
      queueN: "排队 {n} 人", queueNone: "现在不用排队",
      s1Title: "你是哪一派？", random: "随便来一个",
      tapAsk: "拿不准？拍 4 下节奏", tapTitle: "跟着感觉拍 4 下", tapSub: "快慢、稳不稳都算数，拍完告诉你像哪一派", tapPad: "TAP", tapResult: "{bpm} BPM，你的节奏像{p}",
      s2Title: "选一个海报风格",
      s3Title: "写下你的一句话", nick: "昵称", line: "一句话", tvHint: "打字时，这里会长出这句话的声纹", listen: "听一听", micSay: "录声纹", micMine: "你的声音", micQuiet: "没听到声音，靠近一点再念一遍", micDenied: "没拿到麦克风，声纹就按这句话的字来算", hideNick: "大屏上不显示我的昵称", hideNickShort: "大屏不显示", presets: "不想打字？点一句",
      generate: "生成海报", back: "上一步", next: "下一步", exit: "退出",
      soundOff: "关掉声音", soundOn: "打开声音",
      gen1: "正在读取你的音乐人格", gen2: "正在调色", gen3: "正在压制成海报",
      s5Scan: "扫码带走你的海报", s5Ready: "你的海报做好了", saveLocal: "保存海报", openShare: "打开分享页", rotateTip: "把手机竖过来看，海报机是竖屏的", s5Gift: "凭海报到 {booth}，免费领一罐{flavor}",
      reroll: "换一张", rerollUsed: "已换过", done: "完成", openLocal: "在本机打开分享页", backIn: "倒计时走完回到首页，点一下屏幕多留 15 秒", exitTip: "再点一次退出", hint1: "先选一派", hint2: "先选一个风格", hint3: "昵称和一句话都要写",
      stillThere: "还在吗？", stillThereSub: "<b class=\"num\">{n}</b> 秒后回到首页", imHere: "我还在",
      codeTitle: "输入取号码", codeSub: "手机预填页上的 4 位数字", codeGo: "确认",
      blocked: "这句话不太适合上屏，换一句试试？", mysteryFan: "神秘乐迷",
      peakNote: "现在人多：先扫码排队，到屏幕前 10 秒出图"
    },
    en: {
      idleTitle: "Which tribe\nare you?", idleSub: "No sign-up. Free sparkling water.",
      start: "Tap to start", haveCode: "Enter code", boothOn: "Enlarge the kiosk", boothOff: "Exit", today: "{n} posters printed today", todayOne: "1 poster printed today", queueScan: "Scan to queue", queueScanSub: "Fill it on your phone,\nprint in 10 seconds here",
      queueN: "{n} in line", queueNone: "No line right now",
      s1Title: "Which tribe are you?", random: "Surprise me",
      tapAsk: "Not sure? Tap the beat", tapTitle: "Tap 4 times, your way", tapSub: "Fast or slow, steady or loose. We'll match your tribe.", tapPad: "TAP", tapResult: "{bpm} BPM. You move like a {p}",
      s2Title: "Pick a poster style",
      s3Title: "Say it in one line", nick: "Nickname", line: "Your line", tvHint: "Your line\u2019s voiceprint grows here as you type", listen: "Play it", micSay: "Record", micMine: "Your voice", micQuiet: "Didn\u2019t catch that. Get closer and say it again", micDenied: "No mic access, so the voiceprint comes from your words", hideNick: "Hide my nickname on the big screen", hideNickShort: "Hide on screen", presets: "No typing? Tap one",
      generate: "Make my poster", back: "Back", next: "Next", exit: "Exit",
      soundOff: "Mute", soundOn: "Unmute",
      gen1: "Reading your music persona", gen2: "Mixing the colors", gen3: "Pressing your poster",
      s5Scan: "Scan to take your poster", s5Ready: "Your poster is ready", saveLocal: "Save poster", openShare: "Open share page", rotateTip: "Turn your phone upright. The kiosk is a portrait screen.", s5Gift: "Show it at {booth} for a free {flavor}",
      reroll: "New one", rerollUsed: "Used", done: "Done", openLocal: "Open share page here", backIn: "Back home when the ring runs out. Tap the screen for 15 more seconds", exitTip: "Tap again to quit", hint1: "Pick a tribe first", hint2: "Pick a style first", hint3: "Fill in both fields",
      stillThere: "Still there?", stillThereSub: "Home in <b class=\"num\">{n}</b>s", imHere: "I'm here",
      codeTitle: "Enter your code", codeSub: "4 digits from your phone", codeGo: "Confirm",
      blocked: "That line can't go on screen. Try another?", mysteryFan: "Mystery Fan",
      peakNote: "Busy now: scan to queue, print in 10s when it's your turn"
    }
  };

  /* 电脑演示外壳两侧的说明（跟着大屏的语言走）。side：[步骤, 屏名, 这一屏为什么这样设计] */
  var DEMO = {
    zh: {
      title: "声汽海报机",
      text: "音乐节展位上的竖屏触摸机。路过的人选一派、写一句话，一分钟印成自己的海报，扫码带走，再凭海报到展位领一罐。",
      tour: "带我走一遍", tourAgain: "再走一遍", tourSkip: "我自己逛逛", tourAsk: "第一次来？我指着屏幕带你走一遍，大约一分钟。",
      links: ["手机分享页", "排队预填页", "运营后台"], linksLabel: "其他页面",
      note: "电脑上是演示外壳，真机只显示中间这块屏。",
      plate: "扫码保存　到展位领一罐",
      round: "本轮上限 {n} 秒",
      phoneIdle: "扫待机屏上的码：排队时先在手机上填好，轮到时 10 秒出图",
      phoneResult: "扫结果页的码：海报到了手机上，能保存、分享、领一罐",
      side: {
        idle: ["未开始", "待机轮播", "轮播示例海报，吸引路过的人。有人排队时，底部显示排队人数。"],
        persona: ["1 / 4", "选音乐人格", "6 个人格对应 6 种口味。选了人格，就选了海报的品牌色。拿不准就拍 4 下节奏，按快慢和稳不稳推荐一派，BPM 印在海报上。"],
        style: ["2 / 4", "选视觉风格", "每张缩略图都是用刚选的人格实时画的，所见即所得。"],
        input: ["3 / 4", "写一句话", "文字只进排版，不进 AI 提示词。含导流信息或敏感词会被拦下。"],
        gen: ["4 / 4", "生成中", "海报像一杯汽水倒满：液面是这句话的声纹，响起的旋律就是它弹出来的样子。底图是活动前画好、人工审过的 96 张，现场只排字，几秒出图。"],
        result: ["完成", "扫码带走", "二维码打开手机分享页，按种子重画同一张。换一张每轮只有 1 次。"],
        still: ["空闲检测", "还在吗？", "{idle} 秒没操作就问一句，再 {still} 秒没反应就回首页，把屏让给下一位。"],
        code: ["扫码预填", "输入取号码", "排队时已经在手机上选好填好，输入 4 位号码直接出图，大屏只占 10 秒左右。"]
      }
    },
    en: {
      title: "SONIFIZZ Poster Kiosk",
      text: "A vertical touch kiosk at a festival booth. Pick a tribe, write one line, and get your own poster in a minute. Scan to take it home, then trade it for a free can.",
      tour: "Show me around", tourAgain: "Walk me through again", tourSkip: "I'll explore", tourAsk: "First time here? I'll point at the screen and walk you through it in about a minute.",
      links: ["Phone share page", "Queue prefill", "Admin"], linksLabel: "Other pages",
      note: "On a laptop you see a demo shell. The real kiosk shows only the screen.",
      plate: "Scan to save, free can at the booth",
      round: "Round limit {n} s",
      phoneIdle: "Scan the code on the idle screen: fill it in while you queue, print in 10 s at the kiosk",
      phoneResult: "Scan the result code: the poster lands on your phone to save, share and redeem",
      side: {
        idle: ["Idle", "Attract loop", "Sample posters rotate to catch passers-by. The queue count shows at the bottom."],
        persona: ["1 / 4", "Pick a tribe", "Six tribes map to six flavors. The tribe sets the poster's colors. Not sure? Tap 4 beats and we match a tribe by speed and steadiness; the BPM goes on the poster."],
        style: ["2 / 4", "Pick a style", "Each thumbnail is drawn live with the chosen tribe, so what you see is what you get."],
        input: ["3 / 4", "Write one line", "Text goes into the layout only, never into the AI prompt. Contact info and blocked words are stopped."],
        gen: ["4 / 4", "Making it", "The poster pours in like a soda: the surface is your line\u2019s voiceprint, and the melody is that voiceprint played out. The 96 backgrounds were drawn and reviewed before the event, so only the type is set live and it prints in seconds."],
        result: ["Done", "Scan to take it", "The QR opens the phone page, which redraws the same poster from its seed. One redo per round."],
        still: ["Idle check", "Still there?", "After {idle} s without a tap it asks. {still} s later it goes home and frees the screen."],
        code: ["Phone prefill", "Enter your code", "People fill everything in on their phone while they queue. A 4-digit code prints the poster, so the kiosk is busy for about 10 s."]
      }
    }
  };

  /* 手机分享页、预填页的双语文案（跟着海报语言或 ?lang=en 走） */
  var MT = {
    zh: {
      you: "你是{p}", whose: "{n} 的音乐人格", duoTitle: "你和 {n} 的合拍卡", duoSave: "保存合拍卡", listen: "听一听", voiceCap: "这句话的声纹", match: "和你最合拍：{p}。{w}", save: "保存图片", saveHint: "也可以长按图片保存到相册", share: "分享给朋友",
      gift: "给店员看这页<br>免费领一罐{f}味气泡水", limit: "每张海报限领一次", redeem: "店员长按核销", redeemed: "已领取",
      invite: "你朋友是哪一派？", makeOne: "我也做一张", badTitle: "这张海报无法显示", badSub: "链接可能不完整或被改动过",
      aiNote: "本图由 AI 生成，仅供娱乐", report: "举报", reportTitle: "举报这张海报",
      r_vulgar: "低俗或辱骂", r_illegal: "违法违规", r_ad: "广告导流", r_other: "其他", submit: "提交", cancel: "取消",
      saveWait: "高清海报马上就好，稍等一下", holdSave: "请长按图片保存", copied: "链接已复制", copyManual: "请复制地址栏链接", cardHead: "你是哪一派？\n扫码测一测", cardSub: "SONIFIZZ 声汽海报机 · {b}", cardSaved: "分享图已保存，链接也复制好了", cardWait: "分享图马上就好，稍等一下",
      redeemOk: "核销成功", reportOk: "已收到，我们会尽快处理", shareTitle: "我是{p}", pageTitle: "我的音乐人格海报 | SONIFIZZ", alt: "我的音乐人格海报",
      t1: "你是哪一派？", t2: "选一个海报风格", t3: "写下你的一句话", nick: "昵称", line: "一句话", presets: "不想打字？点一句",
      hide: "大屏上不显示我的昵称", codeLabel: "你的取号码", howTitle: "轮到你时怎么做",
      howText: "在大屏首页点「输入取号码」，输入上面 4 位数字，10 秒出图。",
      hint1: "先选一派", hint2: "先选一个风格", hint3: "昵称和一句话都要写", protoNote: "原型演示：号码存在这台设备的浏览器里，请在同一台设备上打开大屏页输入。", previewCap: "你的海报预览，轮到你时大屏印的就是这一张", next: "下一步", getCode: "拿号排队", back: "上一步",
      wait: "前面还有 {n} 人，大约 {m} 分钟", goNow: "现在就可以去大屏了", pfTitle: "排队预填 | SONIFIZZ", pickGift: "出图后凭海报领一罐{f}味", invitedBy: "{n}（{p}）邀请你来测，出图后分享页有你们俩的合拍卡"
    },
    en: {
      you: "Your tribe: {p}", whose: "{n}'s music persona", duoTitle: "Duo card: you and {n}", duoSave: "Save duo card", listen: "Play it", voiceCap: "Your line as a voiceprint", match: "Best match: {p}. {w}", save: "Save image", saveHint: "Or press and hold the image to save it", share: "Share with friends",
      gift: "Show this page to our staff<br>for a free {f} sparkling water", limit: "One can per poster", redeem: "Staff: hold to redeem", redeemed: "Redeemed",
      invite: "Which tribe is your friend?", makeOne: "Make my own", badTitle: "This poster can't be shown", badSub: "The link may be incomplete or altered",
      aiNote: "AI-generated, just for fun", report: "Report", reportTitle: "Report this poster",
      r_vulgar: "Vulgar or abusive", r_illegal: "Illegal content", r_ad: "Spam or ads", r_other: "Other", submit: "Submit", cancel: "Cancel",
      saveWait: "HD poster is almost ready", holdSave: "Press and hold the image to save", copied: "Link copied", copyManual: "Copy the link from the address bar", cardHead: "Which tribe are you?\nScan to find out", cardSub: "SONIFIZZ Poster Kiosk · {b}", cardSaved: "Share image saved, link copied too", cardWait: "Share image is almost ready",
      redeemOk: "Redeemed", reportOk: "Thanks, we'll review it soon", shareTitle: "My tribe: {p}", pageTitle: "My music persona poster | SONIFIZZ", alt: "My music persona poster",
      t1: "Which tribe are you?", t2: "Pick a poster style", t3: "Say it in one line", nick: "Nickname", line: "Your line", presets: "No typing? Tap one",
      hide: "Hide my nickname on the big screen", codeLabel: "Your queue code", howTitle: "When it's your turn",
      howText: "On the big screen, tap \u201CEnter code\u201D and type the 4 digits above. Your poster prints in about 10 seconds.",
      next: "Next", getCode: "Get my code", back: "Back",
      hint1: "Pick a tribe first", hint2: "Pick a style first", hint3: "Fill in both fields", protoNote: "Prototype note: the code lives in this browser, so open the kiosk page on this same device.", previewCap: "Your poster preview. The big screen prints this one when it's your turn",
      wait: "{n} ahead of you, about {m} min", goNow: "You can go to the big screen now", pfTitle: "Queue up | SONIFIZZ", pickGift: "Your poster gets you a free {f} can", invitedBy: "{n} ({p}) invited you. After printing, your share page gets a duo card for you two"
    }
  };

  // 分享页「和你最合拍」：每一派配一派，加一句配对语，给拉朋友来测一个理由
  var MATCH = {
    rock: ["hiphop", "一个负责炸场，一个负责控麦", "One lights the fuse, one holds the mic"],
    edm: ["rock", "Drop 和失真一起砸下来，耳朵准备好", "Drops meet distortion. Brace your ears"],
    folk: ["jazz", "一首慢歌配一杯微醺，刚好", "A slow song and a gentle buzz, just right"],
    hiphop: ["edm", "低音炮开到最大，拍子你来带", "Bass all the way up, you lead the beat"],
    jazz: ["folk", "慢半拍的人，最懂歌里的山", "Half a beat late, you get the mountains in the song"],
    indie: ["folk", "小众遇上民谣，散场一起走", "Niche meets folk, walk home together"]
  };

  window.SF = window.SF || {};
  SF.MT = MT;
  SF.MATCH = MATCH;
  SF.mt = function (lang, key, vars) {
    var s = (MT[lang] && MT[lang][key]) || MT.zh[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  };
  /* 得意黑的全角问号左边空得多：大标题里的「？」单独包起来收紧 */
  SF.setHead = function (el, text) {
    var esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    el.innerHTML = esc.replace(/？/g, '<span class="qm">？</span>');
  };
  SF.applyMT = function (lang) { // 页面上带 data-k 的文字按语言替换
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-k]").forEach(function (el) {
      var s = SF.mt(lang, el.dataset.k);
      if (el.classList.contains("m-title")) SF.setHead(el, s); else el.textContent = s;
    });
    document.querySelectorAll("[data-k-label]").forEach(function (el) { el.setAttribute("aria-label", SF.mt(lang, el.dataset.kLabel)); });
  };
  SF.DEMO = DEMO;
  SF.PERSONAS = PERSONAS;
  SF.STYLES = STYLES;
  SF.DEFAULTS = DEFAULTS;
  SF.T = T;
  SF.persona = function (id) { return PERSONAS.find(function (p) { return p.id === id; }); };
  SF.style = function (id) { return STYLES.find(function (s) { return s.id === id; }); };
  SF.LOGO_SVG = '<svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="21" stroke="currentColor" stroke-width="4"/><circle cx="18" cy="31" r="4.5" fill="currentColor"/><circle cx="27" cy="21" r="3.5" fill="currentColor"/><circle cx="33" cy="13" r="2.5" fill="currentColor"/></svg>';
})();
