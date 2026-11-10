/* 外壳缩放：真机模式（窗口本身是竖的，或网址带 ?kiosk=1）：屏幕 1080×1920 铺满窗口。
   电脑演示：整台立式机（1220×2254，含外壳）按窗口高度缩放，居中，两侧放说明。 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("stage"), kiosk = $("kiosk"), slot = $("kioskSlot");
  var fitW = 0, fitH = 0;
  function fit() {
    var vw = window.innerWidth, vh = window.innerHeight;
    // 手机上弹出键盘只会让窗口变矮、宽度不变：这时不重新缩放，免得整块屏幕缩小
    if (document.body.classList.contains("phone") && vw === fitW && vh < fitH * 0.85) return;
    fitW = vw; fitH = vh;
    var real = /[?&]kiosk=1/.test(location.search) || vw / vh <= 0.75; // 竖着的平板（768×1024 正好 3:4）也按真机铺满
    var coarse = window.matchMedia && matchMedia("(pointer: coarse)").matches;
    document.body.classList.toggle("real", real);
    document.body.classList.toggle("kiosk", /[?&]kiosk=1/.test(location.search));
    document.body.classList.toggle("phone", real && !/[?&]kiosk=1/.test(location.search) && vw <= 600); // 手机上看演示：扫不了自己屏幕上的码
    document.body.classList.toggle("landscape-phone", !real && coarse && vh < 520);                   // 手机横着拿：提示竖过来
    // 手机竖着看：画面逻辑宽度按屏幕比例收窄（长屏手机约 900，短屏手机仍是 1080），同样的字和按钮在手机上大两成，高度至少 1920 铺满屏幕；
    // 平板和真机（?kiosk=1）固定 1080 宽
    var kioskParam = /[?&]kiosk=1/.test(location.search), phone = document.body.classList.contains("phone");
    var SW = phone ? Math.max(900, Math.min(1080, Math.round(1920 * vw / vh))) : 1080;
    var stageH = real && !kioskParam && vh / vw > 1920 / SW ? Math.min(2400, Math.round(SW * vh / vw)) : 1920;
    document.documentElement.style.setProperty("--sw", SW + "px");
    stage.style.height = stageH + "px"; stage.style.setProperty("--xh", stageH - 1920 + "px");
    kiosk.style.height = real ? stageH + "px" : "";
    var booth = !real && document.body.classList.contains("booth"); // 放大展位屏：电脑上只留屏幕
    var w = real || booth ? SW : 1220, h = real ? stageH : booth ? 1920 : 2254;
    var k = real ? Math.min(vw / w, vh / h) : Math.min((vh - 24) / h, (vw - 32) / w);
    kiosk.style.transform = "scale(" + k + ")";
    slot.style.width = w * k + "px"; slot.style.height = h * k + "px";
    document.body.classList.toggle("narrow", !real && vw - w * k < 560);
    document.body.classList.toggle("tight", !real && (vw - w * k) / 2 < 380); // 两侧太窄就不放手机
    if (SF.scene) SF.scene.resize();
    fitSides();
  }
  function fitSides() { // 窗口矮时两侧依次收起次要内容，保证整栏都在窗口里
    document.body.classList.remove("short1", "shortR", "short2");
    if (document.body.classList.contains("real")) return;
    var over = function (sel) { var el = document.querySelector(sel); return el.offsetTop + el.scrollHeight > window.innerHeight - 16; };
    if (over(".side-left")) document.body.classList.add("short1");  // 左栏放不下：先收起介绍文字
    if (over(".side-right")) document.body.classList.add("shortR"); // 右栏放不下：先收起小手机下面的说明
    if (over(".side-left") || over(".side-right")) document.body.classList.add("short2");
  }
  SF.fit = fit; SF.fitSides = fitSides;
})();
