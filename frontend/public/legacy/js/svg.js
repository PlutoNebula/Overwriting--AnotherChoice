/* ==========================================================================
   svg.js — 全部图形素材（自己画，不引用任何第三方素材）
   羊皮纸 / 皮革质感用 feTurbulence，不用位图。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var SVG = (OW.SVG = {});

  /* ---------- 界面小图标：24 线性，统一 1.4 描边 ---------- */
  var ICO = {
    toc:    '<path d="M4 6h10M4 12h13M4 18h8"/><circle cx="19" cy="6" r="1.4"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/>',
    mark:   '<path d="M7 4h10v16l-5-4-5 4z"/>',
    tts:    '<path d="M5 9v6h3l4 4V5L8 9H5z"/><path d="M16 9c1.2 1.2 1.2 4.8 0 6"/><path d="M18.6 6.6c2.4 2.4 2.4 8.4 0 10.8"/>',
    disp:   '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    ins:    '<path d="M4 19l3-1 10-10a2 2 0 00-3-3L4 15z"/><path d="M13 6l3 3"/>',
    left:   '<path d="M14 6l-6 6 6 6"/>',
    right:  '<path d="M10 6l6 6-6 6"/>',
    close:  '<path d="M6 6l12 12M18 6L6 18"/>',
    lock:   '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/>',
    plus:   '<path d="M12 5v14M5 12h14"/>',
    moon:   '<path d="M20 14A8 8 0 019.5 4 8.5 8.5 0 1020 14z"/>',
    sun:    '<circle cx="12" cy="12" r="4.4"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/>',
    gear:   '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9"/>',
    replay: '<path d="M4 12a8 8 0 108-8"/><path d="M4 4v5h5"/>',
    quill:  '<path d="M4 20l3.5-1L20 6.5A2.5 2.5 0 0016.5 3L4 15.5z"/><path d="M8 16l4 0"/>',
    trash:  '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"/>',
    edit:   '<path d="M4 20l3-.8 11-11a2 2 0 10-3-3L4 16z"/>',
    warn:   '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.6"/>',
    check:  '<path d="M5 13l4.5 4.5L19 7"/>',
    seal:   '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>',
    star:   '<path d="M12 4l2.3 5.2 5.7.5-4.3 3.8 1.3 5.5L12 16.2 6.9 19l1.3-5.5L4 9.7l5.7-.5z"/>',
    import: '<path d="M12 4v10M8 10.5l4 4 4-4"/><path d="M5 17v2a1 1 0 001 1h12a1 1 0 001-1v-2"/>',
    back:   '<path d="M11 6l-6 6 6 6M5 12h14"/>',
    dl:     '<path d="M12 4v11M8 11.5l4 4 4-4M5 20h14"/>',
    branch: '<circle cx="6" cy="5" r="1.8"/><circle cx="6" cy="19" r="1.8"/><circle cx="18" cy="5" r="1.8"/><path d="M6 7v10"/><path d="M6 12h6a6 6 0 006-6"/>'
  };

  SVG.icon = function (name, size) {
    var s = size || 18;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICO[name] || '') + '</svg>';
  };

  /* 四类铭文的专用图标（颜色之外的第二区分维度，§14.8） */
  SVG.kindIcon = function (id, size) {
    var s = size || 16, d = {
      echo:  '<path d="M4 12h3l2.5-5 2.5 10 2.5-7 2 2h4"/>',
      query: '<path d="M9 9a3 3 0 116 0c0 2-3 2.4-3 4.6"/><circle cx="12" cy="18" r="1"/>',
      link:  '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="11" cy="18" r="2"/><path d="M7.6 8.4l2 8M7.9 6.4l8.2 2M16.6 10.6l-4 5.9" stroke-dasharray="2 2"/>',
      cont:  '<path d="M5 6h9M5 11h11M5 16h6"/><path d="M14 19h6M17 16v6"/>'
    }[id] || '';
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.4" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };

  /* Four inscription emblems used by the tarot-style card frame. */
  SVG.tarotIcon = function (id, size) {
    var s = size || 88, d = {
      echo:
        '<path d="M13 40C5 31 7 19 17 15C22 25 21 34 13 40Z"/>' +
        '<path d="M16 38C11 32 11 24 16 18"/>' +
        '<path d="M18 18l4 3M19 24l4 2"/>' +
        '<path d="M28 28a6 6 0 015 4"/>' +
        '<path d="M25 21a13 13 0 0110 9"/>' +
        '<path d="M22 14a19 19 0 0114 13"/>',
      query:
        '<path d="M19 8a6 6 0 1112 0c0 4-4 4-4 8"/>' +
        '<circle cx="25" cy="23" r="1.1"/>' +
        '<path d="M27 44h-8"/>' +
        '<path d="M25 44v-7h-4v7"/>' +
        '<path d="M23 37c2 3 4 5 4 8a4 4 0 01-8 0c0-3 2-5 4-8z"/>',
      link:
        '<path d="M11 13v9M6.5 17.5h9M36 8v9M31.5 12.5h9M25 30v9M20.5 34.5h9"/>' +
        '<path d="M11 17.5L36 12.5M36 12.5L25 34.5M25 34.5L11 17.5" stroke-dasharray="2.5 2.6"/>',
      cont:
        '<path d="M12 12c-5 3-7 8-7 14 5 3 9 2 12-1 3 3 7 4 12 1 0-6-2-11-7-14-2 3-3 6-5 6-2 0-3-3-5-6z"/>' +
        '<path d="M6 34h12M24 34h16"/>' +
        '<path d="M31 27l3 9M35 25l2 4"/>'
    }[id] || '';
    return '<svg viewBox="0 0 48 48" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.1" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  };

  /* ---------- 花饰分隔（页头 / 封面用）---------- */
  SVG.ornament = function () {
    return '<svg viewBox="0 0 120 12" fill="none" stroke="currentColor" ' +
      'stroke-width="1" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M2 6h34"/><path d="M84 6h34"/>' +
      '<path d="M46 6q7-5 14 0-7 5-14 0z"/>' +
      '<path d="M74 6q-7-5-14 0 7 5 14 0z"/>' +
      '<circle cx="60" cy="6" r="1.6" fill="currentColor" stroke="none"/>' +
      '</svg>';
  };

  /* ---------- 共享滤镜与渐变：整站只注入一次 ---------- */
  SVG.defs = function () {
    return '' +
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#F0DFAE"/><stop offset=".5" stop-color="#C7A45A"/>' +
        '<stop offset="1" stop-color="#8A6A34"/></linearGradient>' +
      '<linearGradient id="gGoldSig" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#F5E7BF"/><stop offset=".55" stop-color="#C7A45A"/>' +
        '<stop offset="1" stop-color="#9C7C3C"/></linearGradient>' +
      '<linearGradient id="gCopper" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#A67C45"/><stop offset="1" stop-color="#5C4024"/></linearGradient>' +
      '<linearGradient id="gParch" x1="0" y1="0" x2=".3" y2="1">' +
        '<stop offset="0" stop-color="#E8DAB7"/><stop offset=".55" stop-color="#D8C59A"/>' +
        '<stop offset="1" stop-color="#C1A97B"/></linearGradient>' +
      // 皮革三档与 tokens.css 的 --leather-1/2/3 必须同步：SVG 里不能引 CSS 变量，
      // 改一处漏一处就会出现「书脊是紫的、卡片是暖的」这种不一致。
      '<linearGradient id="gLeather" x1="0" y1="0" x2=".5" y2="1">' +
        '<stop offset="0" stop-color="#221B17"/><stop offset=".5" stop-color="#1C1714"/>' +
        '<stop offset="1" stop-color="#14100F"/></linearGradient>' +
      // 契名/开场共用的暮紫氛围层：径向衰减，不是平铺（§9.1「氛围层，不平铺」）
      '<radialGradient id="gAtmo">' +
        '<stop offset="0" stop-color="#241735" stop-opacity="1"/>' +
        '<stop offset=".6" stop-color="#241735" stop-opacity=".62"/>' +
        '<stop offset="1" stop-color="#241735" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="gHalo"><stop offset="0" stop-color="#C7A45A" stop-opacity=".5"/>' +
        '<stop offset="1" stop-color="#C7A45A" stop-opacity="0"/></radialGradient>' +
      '<filter id="fParch"><feTurbulence type="fractalNoise" baseFrequency=".03 .06" ' +
        'numOctaves="5" seed="3" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter>' +
      '<filter id="fGrain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="3"/>' +
        '<feColorMatrix type="saturate" values="0"/>' +
        '<feComponentTransfer><feFuncA type="linear" slope=".22"/></feComponentTransfer></filter>' +
      '<filter id="fSoft" x="-40%" y="-40%" width="180%" height="180%">' +
        '<feGaussianBlur stdDeviation="7"/></filter>' +
    '</defs></svg>';
  };

  /* ==========================================================================
     符文：程序生成的假文字纹样。同一 seed 出同一结果，录屏可复现。
     ========================================================================== */
  function rng(seed) {
    var s = seed || 1;
    return function () { s = (s * 16807) % 2147483647; return s / 2147483647; };
  }
  SVG.runeRow = function (x, y, n, seed, w2) {
    var r = rng(seed), out = '', step = w2 || 11;
    for (var i = 0; i < n; i++) {
      var cx = x + i * step, h = 5 + r() * 5, t = Math.floor(r() * 5);
      if (t === 0) out += '<path d="M' + cx + ' ' + (y - h) + 'v' + h * 2 + 'M' + (cx - 3) + ' ' + y + 'h6"/>';
      else if (t === 1) out += '<path d="M' + (cx - 3) + ' ' + (y + h) + 'l3 ' + (-h * 2) + 'l3 ' + h * 2 + '"/>';
      else if (t === 2) out += '<path d="M' + (cx - 3) + ' ' + (y - h) + 'h6l-6 ' + h * 2 + 'h6"/>';
      else if (t === 3) out += '<circle cx="' + cx + '" cy="' + y + '" r="' + (h * .5).toFixed(1) + '"/>';
      else out += '<path d="M' + (cx - 3) + ' ' + (y - h) + 'v' + h * 2 + 'l6 ' + (-h * 2) + '"/>';
    }
    return out;
  };

  /* ==========================================================================
     四区契印：四类铭文各点亮一区。初赛只有这一套固定图案（§5.5）。
     lit = {echo:n, query:n, link:n, cont:n}，数量>1 只增亮度不加完整度。
     ========================================================================== */
  SVG.sigil = function (lit, size) {
    lit = lit || {};
    var s = size || 120, C = 60;
    // 四个扇区：上/右/下/左，对应 回响/诘问/星链/续章
    var secs = [
      { id: 'echo',  a0: -135, a1: -45,  c: '#C7A45A' },
      { id: 'query', a0: -45,  a1: 45,   c: '#8A3F4D' },
      { id: 'link',  a0: 45,   a1: 135,  c: '#53A7B8' },
      { id: 'cont',  a0: 135,  a1: 225,  c: '#7A5832' }
    ];
    function pt(deg, r) {
      var a = deg * Math.PI / 180;
      return [(C + Math.cos(a) * r).toFixed(2), (C + Math.sin(a) * r).toFixed(2)];
    }
    var g = '';
    secs.forEach(function (sec, i) {
      var n = lit[sec.id] || 0;
      var on = n > 0;
      // 数量越多越亮，但封顶，避免刷条数就发白
      var op = on ? Math.min(.42 + n * .16, .95) : .13;
      var wOut = pt(sec.a0 + 3, 46), wIn = pt(sec.a0 + 3, 27);
      var eOut = pt(sec.a1 - 3, 46), eIn = pt(sec.a1 - 3, 27);
      var mid = (sec.a0 + sec.a1) / 2;
      var mk = pt(mid, 36.5);
      g += '<g class="sg-sec sg-' + sec.id + (on ? ' is-lit' : '') + '" ' +
           'style="--c:' + sec.c + '" opacity="' + op.toFixed(2) + '">' +
           '<path d="M' + wIn + 'L' + wOut +
             'A46 46 0 0 1 ' + eOut + 'L' + eIn +
             'A27 27 0 0 0 ' + wIn + 'Z" ' +
             'fill="' + sec.c + '" fill-opacity="' + (on ? .16 : .04) + '" ' +
             'stroke="' + sec.c + '" stroke-width="1"/>' +
           // 区内符号：即使全部转灰也能靠形状分辨
           '<g transform="translate(' + mk[0] + ',' + mk[1] + ')" ' +
             'stroke="' + sec.c + '" stroke-width="1.3" fill="none" ' +
             'stroke-linecap="round">' + sectorMark(i) + '</g>' +
           '</g>';
    });
    function sectorMark(i) {
      return [
        '<path d="M-5 0h2.4l1.6-3.4 1.8 6.4 1.8-4.6 1 1.6H5"/>',            // 回响 波形
        '<path d="M-2.4-1.6a2.4 2.4 0 114.8 0c0 1.7-2.4 1.9-2.4 3.5"/><circle cx="0" cy="4.4" r=".8" fill="currentColor" stroke="none"/>', // 诘问
        '<circle cx="-4" cy="-2.6" r="1.4"/><circle cx="4.4" cy="-1" r="1.4"/><circle cx="-.6" cy="4.4" r="1.4"/><path d="M-2.8-1.8l2.2 4.6M-2.6-2.3l5.6 1.2" stroke-dasharray="1.6 1.6"/>', // 星链
        '<path d="M-5-3.4h8M-5 0h9M-5 3.4h5"/><path d="M4 4.6h4M6 2.6v4"/>'  // 续章
      ][i];
    }
    return '<svg viewBox="0 0 120 120" width="' + s + '" height="' + s + '" fill="none" ' +
      'role="img" aria-label="契印：四类铭文点亮状态">' +
      // 外环与内环
      '<circle cx="60" cy="60" r="52" stroke="url(#gCopper)" stroke-width="1.2" opacity=".8"/>' +
      '<circle cx="60" cy="60" r="48" stroke="#7A5832" stroke-width=".6" opacity=".5"/>' +
      '<circle cx="60" cy="60" r="24" stroke="#7A5832" stroke-width=".8" opacity=".6"/>' +
      g +
      // 中心：完整时点亮
      '<circle cx="60" cy="60" r="8" fill="#C7A45A" ' +
        'fill-opacity="' + (lit.full ? '.9' : '.12') + '"/>' +
      '<g stroke="#7A5832" stroke-width=".7" opacity=".55" fill="none">' +
        SVG.runeRow(24, 108, 8, 91, 9) + '</g>' +
      '</svg>';
  };

  /* ==========================================================================
     书封面：三种色相变体，深色皮革 + 旧铜包角 + 暮金文字（书库不用羊皮纸块）
     ========================================================================== */
  SVG.cover = function (book, opts) {
    opts = opts || {};
    var hue = book.hue || 0;
    var tint = ['#241735', '#1B2233', '#2A1A22'][hue % 3];
    var line = ['#7A5832', '#53A7B8', '#8A3F4D'][hue % 3];
    var seed = 7 + hue * 13;
    var motif = [
      // 0 灯：一盏灯与向上的光
      '<g stroke="url(#gCopper)" stroke-width="1.1" fill="none">' +
        '<path d="M100 96h40l-6 30h-28z"/><path d="M120 96V78"/>' +
        '<path d="M108 78h24"/><circle cx="120" cy="112" r="7" fill="#C7A45A" fill-opacity=".22"/>' +
        '<path d="M120 126v26M104 132l-6 16M136 132l6 16" opacity=".55"/></g>' +
        '<circle cx="120" cy="112" r="26" fill="url(#gHalo)"/>',
      // 1 星轨：三条弧与散点
      '<g stroke="' + line + '" stroke-width="1" fill="none" opacity=".8">' +
        '<path d="M56 132a64 44 0 01128 0"/><path d="M64 148a56 34 0 01112 0" opacity=".6"/>' +
        '<path d="M74 112a46 30 0 0192 0" opacity=".45"/>' +
        '<circle cx="94" cy="121" r="2.2" fill="' + line + '"/>' +
        '<circle cx="146" cy="117" r="1.6" fill="' + line + '"/>' +
        '<circle cx="120" cy="150" r="2" fill="' + line + '"/></g>',
      // 2 铜门：一扇半开的门
      '<g stroke="url(#gCopper)" stroke-width="1.2" fill="none">' +
        '<rect x="86" y="76" width="68" height="86" rx="4"/>' +
        '<path d="M120 76v86"/><circle cx="112" cy="120" r="2.6"/>' +
        '<circle cx="128" cy="120" r="2.6"/>' +
        '<path d="M96 92h16M128 92h16" opacity=".6"/></g>' +
        '<path d="M120 76v86" stroke="' + line + '" stroke-width=".8" opacity=".7"/>'
    ][hue % 3];

    return '<svg viewBox="0 0 240 328" preserveAspectRatio="xMidYMid slice" ' +
      'role="img" aria-label="' + esc(book.title) + ' 封面">' +
      '<rect width="240" height="328" fill="url(#gLeather)"/>' +
      '<rect width="240" height="328" fill="' + tint + '" opacity=".5"/>' +
      '<rect width="240" height="328" filter="url(#fGrain)" opacity=".5"/>' +
      // 书脊
      '<rect width="18" height="328" fill="#05070E" opacity=".55"/>' +
      '<line x1="18.5" y1="0" x2="18.5" y2="328" stroke="#C7A45A" stroke-opacity=".18"/>' +
      // 内框
      '<rect x="30" y="22" width="188" height="284" fill="none" ' +
        'stroke="url(#gCopper)" stroke-width="1" opacity=".75"/>' +
      '<rect x="35" y="27" width="178" height="274" fill="none" ' +
        'stroke="#C7A45A" stroke-width=".5" opacity=".3"/>' +
      motif +
      // 符文带
      '<g stroke="#7A5832" stroke-width=".8" fill="none" opacity=".5">' +
        SVG.runeRow(48, 218, 13, seed, 11) + '</g>' +
      // 四角
      '<g stroke="#C7A45A" stroke-width="1" opacity=".5" fill="none">' +
        '<path d="M30 40V22h18"/><path d="M200 22h18v18"/>' +
        '<path d="M218 288v18h-18"/><path d="M48 306H30v-18"/></g>' +
      (opts.title === false ? '' :
        '<text x="120" y="60" text-anchor="middle" fill="#C7A45A" ' +
          'font-family="Georgia,serif" font-size="19" letter-spacing="3">' +
          esc(cut(book.title, 8)) + '</text>' +
        '<text x="120" y="262" text-anchor="middle" fill="#D8C59A" fill-opacity=".55" ' +
          'font-family="Georgia,serif" font-size="9.5" letter-spacing="2.4">' +
          esc(cut(book.author, 14)) + '</text>') +
      // 顶部压暗，让卡片文字区不打架
      '<rect width="240" height="328" fill="url(#gCoverShade)" opacity="0"/>' +
      '</svg>';
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  SVG.esc = esc;

  /* ==========================================================================
     星空 / 云层背景：开场与契名共用（同一套资产，2D 兜底也用它）
     ========================================================================== */
  SVG.sky = function (opts) {
    opts = opts || {};
    var r = rng(opts.seed || 11), stars = '', n = opts.stars || 34;   // 同时运动 ≤40（§5.1）
    for (var i = 0; i < n; i++) {
      var x = (r() * 1920).toFixed(0), y = (r() * 700).toFixed(0);
      var rr = (.6 + r() * 1.5).toFixed(2), d = (2.4 + r() * 4).toFixed(1);
      stars += '<circle class="star" cx="' + x + '" cy="' + y + '" r="' + rr + '" ' +
        'fill="#D8C59A" style="animation-duration:' + d + 's;animation-delay:' +
        (r() * 4).toFixed(1) + 's"/>';
    }
    function cloud(cls, y, sc, op, col) {
      return '<g class="' + cls + '" opacity="' + op + '">' +
        '<ellipse cx="380" cy="' + y + '" rx="' + 420 * sc + '" ry="' + 90 * sc + '" fill="' + col + '"/>' +
        '<ellipse cx="1020" cy="' + (y + 26) + '" rx="' + 520 * sc + '" ry="' + 74 * sc + '" fill="' + col + '"/>' +
        '<ellipse cx="1660" cy="' + (y - 14) + '" rx="' + 400 * sc + '" ry="' + 84 * sc + '" fill="' + col + '"/>' +
        '</g>';
    }
    return '<svg class="sky" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" ' +
      'aria-hidden="true">' +
      '<rect width="1920" height="1080" fill="#090D18"/>' +
      // 暮紫氛围：径向衰减填充，不是平铺的实色椭圆。
      // 原来 fill="#241735" opacity=".55" 是一整块等浓度紫，覆盖画面近六成，
      // 实测把契名整页推到暮紫 40.4%（§9 目标 17.4%），等于 §9.1 禁止的「平铺」。
      // 换成 gAtmo 后落到 20.3%，而金色署名四周仍然够暗（§9 高潮成立的前提）。
      '<ellipse cx="960" cy="560" rx="800" ry="540" fill="url(#gAtmo)" ' +
        'opacity=".78" filter="url(#fSoft)"/>' +
      stars +
      cloud('cloud-far', 250, 1, '.16', '#241735') +
      cloud('cloud-mid', 830, 1.25, '.3', '#150F1E') +
      cloud('cloud-near', 1010, 1.5, '.5', '#05070E') +
      '<ellipse class="halo" cx="960" cy="540" rx="330" ry="250" fill="url(#gHalo)"/>' +
      '</svg>';
  };

  /* ==========================================================================
     摊开的双页魔法书
     §5.1 反向要求：不出现合上的书、不从下方升起、不播「打开」动画。
     魔法线条直接勾勒出「已经摊开」的双页书。
     实测版面：书脊在画面 50%，双页书居中占中间约 60% 宽。
     五组路径：spine / pages / corners / runes / decor —— 供 intro.js 按序描绘。
     ========================================================================== */
  /* Quiet star-particle layer used behind the library content. */
  SVG.libStars = function () {
    var r = rng(41), out = '';
    var cool = ['#E9E6D8', '#D7E0EC', '#AFC8DC', '#E6E0F2'];
    var accent = ['#C7A45A', '#53A7B8'];

    function dots(cls, count, rMin, rMax, dMin, dMax) {
      var s = '';
      for (var i = 0; i < count; i++) {
        var x = (r() * 1920).toFixed(0), y = (r() * 980).toFixed(0);
        var rr = (rMin + r() * (rMax - rMin)).toFixed(2);
        var d = (dMin + r() * (dMax - dMin)).toFixed(1);
        var dl = (r() * dMax).toFixed(1);
        var col = r() < .12 ? accent[(r() * 2) | 0] : cool[(r() * 4) | 0];
        s += '<circle class="' + cls + '" cx="' + x + '" cy="' + y + '" r="' + rr + '" ' +
          'fill="' + col + '" style="animation-duration:' + d + 's;animation-delay:' + dl + 's"/>';
      }
      return s;
    }

    out += dots('star-far', 140, .5, 1.1, 3, 8);
    out += dots('star-mid', 50, 1.2, 2.2, 2, 5);
    for (var i = 0; i < 8; i++) {
      var x = (r() * 1920).toFixed(0), y = (r() * 980).toFixed(0);
      var rr = (2 + r() * 1.5).toFixed(2);
      var d = (2.5 + r() * 2.5).toFixed(1), dl = (r() * 5).toFixed(1);
      var glow = (rr * 4.2).toFixed(1), long = (rr * 7).toFixed(1), short = (rr * 4).toFixed(1);
      out += '<g class="star-spike" transform="translate(' + x + ' ' + y + ')">' +
        '<g class="spike" style="animation-duration:' + d + 's;animation-delay:' + dl + 's">' +
          '<circle r="' + glow + '" fill="#E9E6D8" fill-opacity=".16"/>' +
          '<path d="M-' + long + ' 0H' + long + 'M0 -' + long + 'V' + long + '" stroke="#E9E6D8" ' +
            'stroke-width=".6" stroke-linecap="round" opacity=".85"/>' +
          '<path d="M-' + short + ' ' + short + 'L' + short + ' -' + short + 'M-' + short + ' -' + short + 'L' + short + ' ' + short + '" ' +
            'stroke="#E9E6D8" stroke-width=".4" opacity=".5"/>' +
          '<circle r="' + rr + '" fill="#F4F0E2"/>' +
        '</g></g>';
    }
    return '<svg class="lib-stars" viewBox="0 0 1920 1080" ' +
      'preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + out + '</svg>';
  };

  SVG.openBook = function () {
    // 视口 1920×1080；书体 x 从 384 到 1536（60% 宽），书脊 x=960
    var P = {
      /* 1 书脊 */
      spine: [
        'M960 300v520',                                        // 脊心线
        'M948 312q-8 248 0 496',                               // 左脊弧
        'M972 312q8 248 0 496'                                 // 右脊弧
      ],
      /* 2 左右书页轮廓（已摊开：两片外凸的纸，中间在脊处收拢） */
      pages: [
        // 左页：脊 → 上边 → 外缘 → 下边 → 回脊
        'M948 318C830 292 690 288 570 306C498 317 436 334 392 356' +
          'C398 520 404 664 412 792C462 770 528 754 604 748C716 740 848 764 948 806',
        // 右页
        'M972 318C1090 292 1230 288 1350 306C1422 317 1484 334 1528 356' +
          'C1522 520 1516 664 1508 792C1458 770 1392 754 1316 748C1204 740 1072 764 972 806',
        // 页叠厚度：左右各两道贴边线
        'M392 356C398 520 404 664 412 792M384 366C390 528 396 670 404 798',
        'M1528 356C1522 520 1516 664 1508 792M1536 366C1530 528 1524 670 1516 798'
      ],
      /* 3 页角与包角 */
      corners: [
        'M392 356l-8 10M412 792l-8 6M1528 356l8 10M1508 792l8 6',
        // 左上包角
        'M436 344l46-8 6 22-44 8z',
        'M1484 344l-46-8-6 22 44 8z',
        // 下缘卷角
        'M604 748q-24 14-40 30M1316 748q24 14 40 30'
      ],
      /* 4 符文（页面上的假文字，两页各三行） */
      runes: [
        'M520 430h300M520 470h280M520 510h300M520 550h240',
        'M1100 430h300M1100 470h280M1100 510h300M1100 550h240',
        'M520 600h180M1100 600h180'
      ],
      /* 5 装饰：星芒、藤蔓、脊上花饰 */
      decor: [
        'M960 268q-14 14-30 18 16 4 30 18 14-14 30-18-16-4-30-18z',    // 脊顶星
        'M700 660q40 26 96 22M1220 660q-40 26-96 22',
        'M470 396q-16 34-8 70M1450 396q16 34 8 70',
        'M960 838q-10 12-24 16 14 4 24 16 10-12 24-16-14-4-24-16z'     // 脊底星
      ]
    };

    function grp(name, arr, stroke, wid) {
      var s = '<g class="g-' + name + '">';
      for (var i = 0; i < arr.length; i++) {
        s += '<path class="ln ln-' + name + '" data-g="' + name + '" d="' + arr[i] +
             '" stroke="' + stroke + '" stroke-width="' + wid + '"/>';
      }
      return s + '</g>';
    }

    return '<svg class="book" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="羽毛笔以魔法线条勾勒出一本已经摊开的双页魔法书">' +

      /* ---- 实体化层：线条画完后显影的羊皮纸 / 皮革 / 金属 ---- */
      '<g class="solid">' +
        // 桌面阴影
        '<ellipse cx="960" cy="830" rx="620" ry="70" fill="#05070E" opacity=".7" filter="url(#fSoft)"/>' +
        // 左页纸面
        '<path d="M948 318C830 292 690 288 570 306C498 317 436 334 392 356' +
          'C398 520 404 664 412 792C462 770 528 754 604 748C716 740 848 764 948 806Z" ' +
          'fill="url(#gParch)"/>' +
        // 右页纸面
        '<path d="M972 318C1090 292 1230 288 1350 306C1422 317 1484 334 1528 356' +
          'C1522 520 1516 664 1508 792C1458 770 1392 754 1316 748C1204 740 1072 764 972 806Z" ' +
          'fill="url(#gParch)"/>' +
        // 纸纹
        '<g opacity=".28" filter="url(#fGrain)">' +
          '<rect x="392" y="288" width="556" height="520"/>' +
          '<rect x="972" y="288" width="556" height="520"/></g>' +
        // 脊处内阴影：让两页看起来真的连在一本书上
        '<path d="M900 306h120v510H900z" fill="#05070E" opacity=".5" filter="url(#fSoft)"/>' +
        // 皮革书脊
        '<path d="M948 312q-8 248 0 496h24q-8-248 0-496z" fill="url(#gLeather)"/>' +
        '<path d="M948 312q-8 248 0 496h24q-8-248 0-496z" fill="none" ' +
          'stroke="#C7A45A" stroke-opacity=".35"/>' +
        // 旧铜包角（金属）
        '<path d="M436 344l46-8 6 22-44 8z" fill="url(#gCopper)"/>' +
        '<path d="M1484 344l-46-8-6 22 44 8z" fill="url(#gCopper)"/>' +
        // 纸上的字行：真的像有字，但不可读，避免抢注意力
        '<g opacity=".42" stroke="#5B4B33" stroke-width="2.6" stroke-linecap="round">' +
          '<path d="M520 430h300M520 470h280M520 510h300M520 550h240M520 600h180"/>' +
          '<path d="M1100 430h300M1100 470h280M1100 510h300M1100 550h240M1100 600h180"/></g>' +
        // 符文点缀
        '<g stroke="#7A5832" stroke-width="1.6" fill="none" opacity=".5">' +
          SVG.runeRow(540, 680, 12, 31, 13) + SVG.runeRow(1120, 680, 12, 57, 13) + '</g>' +
      '</g>' +

      /* ---- 线条层：按 spine → pages → corners → runes → decor 顺序描绘 ---- */
      grp('spine',   P.spine,   '#C7A45A', 2.4) +
      grp('pages',   P.pages,   '#C7A45A', 2) +
      grp('corners', P.corners, '#7A5832', 1.8) +
      grp('runes',   P.runes,   '#53A7B8', 1.6) +
      grp('decor',   P.decor,   '#8A3F4D', 1.6) +

      /* ---- 羽毛笔：沿路径漂浮，笔尖带光 ---- */
      '<g class="quill-orbit">' +
        '<g class="quill-idle">' +
          '<g class="quill" transform="translate(-70,-96)">' +
            // 笔羽
            '<path d="M64 8C40 26 22 52 14 82c14-6 26-8 36-6-6 12-8 24-6 34 ' +
              '18-10 34-26 44-46 8-16 10-36 6-56-10 0-20 0-30 0z" ' +
              'fill="url(#gParch)" opacity=".92"/>' +
            '<path d="M64 8C40 26 22 52 14 82c14-6 26-8 36-6-6 12-8 24-6 34 ' +
              '18-10 34-26 44-46 8-16 10-36 6-56-10 0-20 0-30 0z" ' +
              'fill="none" stroke="#7A5832" stroke-width="1.2"/>' +
            // 羽轴
            '<path d="M62 14C48 40 34 66 18 96" stroke="#7A5832" stroke-width="1.4" fill="none"/>' +
            // 笔杆到笔尖
            '<path d="M18 96l-6 14" stroke="url(#gCopper)" stroke-width="3.4" ' +
              'stroke-linecap="round" fill="none"/>' +
            '<circle class="nib" cx="11" cy="112" r="3.4" fill="#C7A45A"/>' +
          '</g>' +
        '</g>' +
      '</g>' +
      '</svg>';
  };

  /* ==========================================================================
     金色署名：用 stroke-dashoffset 把名字「写」出来（和开场同一套技法），
     写完再淡入金色填充层，让名字变成实体。不是淡入。
     ========================================================================== */
  SVG.signature = function (name, role) {
    var t = esc(cut(name || '读者', 10));
    // 字形轮廓无法取真实长度，给一个足够大的固定 dash 长度即可稳定描绘
    var len = 120 + t.length * 130;
    // 「编注」不画进 SVG：viewBox 缩放会把它压到 7px 以下（§14.7 字号过小），
    // 而这两个字承担「原作者著 / 读者编注」的区分（§5.5 验收），必须读得清。
    // 身份标由调用方用 .cover-role 以 HTML 渲染，字号走令牌。
    return '<svg viewBox="0 0 300 40" preserveAspectRatio="xMidYMid meet" ' +
      'role="img" aria-label="署名 ' + t + (role ? ' ' + esc(role) : '') + '">' +
      '<text class="wr" x="150" y="30" text-anchor="middle" ' +
        'font-family="Georgia,serif" font-size="26" letter-spacing="3" ' +
        'style="--len:' + len + ';stroke-dasharray:' + len + ';stroke-dashoffset:' + len + '">' +
        t + '</text>' +
      '<text class="fl" x="150" y="30" text-anchor="middle" ' +
        'font-size="26" letter-spacing="3">' + t + '</text>' +
      '</svg>';
  };

  /* 契印落款（封面右下）：圆印 + 四区微光 */
  SVG.seal = function (lit) {
    lit = lit || { echo: 1, query: 1, link: 1, cont: 1, full: 1 };
    return SVG.sigil(lit, 78);
  };
})(window);
