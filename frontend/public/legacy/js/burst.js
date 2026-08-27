/* ========================================================================
   点击反馈：稀疏的魔法符文法阵

   旧版在整张卡片上铺满像素格，视觉密度高，而且跳转后仍会残留。
   这里保留原文件入口，避免改动项目装载顺序；内部实现已改为一次性的 SVG 法阵。
   动画只改变透明度、缩放和旋转，结束后立即从页面移除。
   ======================================================================== */
(function (w) {
  'use strict';

  var OW = (w.OW = w.OW || {});
  var D = w.document;
  var activeGate = null;
  var cleanupTimer = 0;

  function removeGate() {
    if (cleanupTimer) w.clearTimeout(cleanupTimer);
    cleanupTimer = 0;
    if (activeGate && activeGate.parentNode) {
      activeGate.parentNode.removeChild(activeGate);
    }
    activeGate = null;
  }

  function runeSvg() {
    return [
      '<svg viewBox="0 0 120 120" focusable="false" aria-hidden="true">',
      '  <g class="rune-gate__outer">',
      '    <circle cx="60" cy="60" r="47"/>',
      '    <path d="M60 7v11 M60 102v11 M7 60h11 M102 60h11"/>',
      '    <path d="M25 25l8 8 M87 87l8 8 M95 25l-8 8 M33 87l-8 8"/>',
      '  </g>',
      '  <g class="rune-gate__inner">',
      '    <circle cx="60" cy="60" r="31"/>',
      '    <path d="M60 30l26 45H34z"/>',
      '    <path d="M60 43l15 25H45z"/>',
      '  </g>',
      '  <g class="rune-gate__glyphs">',
      '    <path d="M56 14h8l-4 7z M99 56v8l-7-4z M64 106h-8l4-7z M21 64v-8l7 4z"/>',
      '  </g>',
      '  <path class="rune-gate__core" d="M60 51l9 9-9 9-9-9z"/>',
      '</svg>'
    ].join('');
  }

  function showGate(target, clientX, clientY, variant) {
    if (!target) return;
    removeGate();

    var box = target.getBoundingClientRect();
    var x = typeof clientX === 'number' ? clientX : box.left + box.width / 2;
    var y = typeof clientY === 'number' ? clientY : box.top + box.height / 2;

    /* 法阵不会被窗口边缘裁掉。 */
    x = Math.max(70, Math.min(w.innerWidth - 70, x));
    y = Math.max(70, Math.min(w.innerHeight - 70, y));

    var gate = D.createElement('span');
    gate.className = 'rune-gate' +
      (variant === 'cursor' ? ' rune-gate--cursor' :
        (target.classList && target.classList.contains('btn') ? ' rune-gate--button' : ''));
    gate.setAttribute('aria-hidden', 'true');
    gate.style.left = Math.round(x) + 'px';
    gate.style.top = Math.round(y) + 'px';
    gate.innerHTML = runeSvg();
    D.body.appendChild(gate);
    activeGate = gate;

    gate.addEventListener('animationend', removeGate, { once: true });
    cleanupTimer = w.setTimeout(removeGate, variant === 'cursor' ? 240 : 400);
  }

  /* 任意真实鼠标左键按下都给出短促反馈；键盘与触屏不额外制造装饰动画。 */
  D.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || (e.pointerType && e.pointerType !== 'mouse')) return;
    showGate(e.target, e.clientX, e.clientY, 'cursor');
  });

  OW.RuneGate = { show: showGate, remove: removeGate };
})(window);
