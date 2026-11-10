/* 电脑演示的背景：深色底上一层品牌点阵（四周淡出），上面两层很轻的动效：
   ① 点阵极慢地推近（CSS，40 秒一个来回）
   ② 立式机身后的光不规则地明暗，像灯光扫过烟雾
   立式机脚下的地面反光和屏幕外沿的光跟着屏幕当前的颜色变（tint）。
   系统设置了减弱动效时全部静止。 */
(function () {
  var scene = document.getElementById("scene");
  if (!scene) return;
  var haze = scene.querySelector(".scene-haze");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var timer = 0;

  function flicker() { // 每 0.6～2.4 秒换一个亮度，CSS 过渡负责把明暗连起来
    haze.style.opacity = (0.3 + Math.random() * 0.7).toFixed(2);
    timer = setTimeout(flicker, 600 + Math.random() * 1800);
  }

  SF.scene = {
    start: function () {
      if (reduce || timer || document.body.classList.contains("real")) return;
      flicker();
    },
    resize: function () {},
    tint: function (color) { scene.style.setProperty("--glow", color); },
    flash: function () { scene.classList.remove("flash"); void scene.offsetWidth; scene.classList.add("flash"); } // 出图那一下，舞台雾光和地面反光亮一下
  };
})();
