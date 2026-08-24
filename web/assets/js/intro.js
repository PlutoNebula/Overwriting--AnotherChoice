/* ==========================================================================
   intro.js — 开场动画（§5.1）
   独立可跑：/index.html#intro 或 ?autoplay=1，不依赖书库数据。
   验收：点击一次只触发一次，连点不重复播放 → playing 锁。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;

  /* 时间轴（总 7000ms，落在 §5.1 的 6–8s 内）
     线条顺序：书脊 → 左右书页轮廓 → 页角/符文/装饰 */
  var TL = {
    spine:   { at: 260,  dur: 900  },
    pages:   { at: 1000, dur: 1700 },
    corners: { at: 2500, dur: 800  },
    runes:   { at: 3050, dur: 900  },
    decor:   { at: 3700, dur: 900  },
    solid:   4300,   // 羊皮纸/皮革/金属/符文开始实体化
    push:    4600,   // 镜头推入
    title:   5000,
    total:   7000
  };

  var Intro = {
    el: null, playing: false, timers: [], done: false,

    mount: function (root) {
      this.el = root;
      root.innerHTML =
        '<div class="intro-stage">' +
          '<div class="intro-cam" id="introCam">' +
            OW.SVG.sky({ seed: 11, stars: 34 }) +
            OW.SVG.openBook() +
          '</div>' +
          '<div class="intro-title" id="introTitle">' +
            '<div class="en display gilt">Overwriting</div>' +
            '<div class="cn">故 事 新 编</div>' +
          '</div>' +
          '<div class="intro-tools">' +
            '<button class="btn btn--sm btn--ghost" id="introSkip">跳过 <kbd>Esc</kbd></button>' +
            '<button class="btn btn--sm btn--ghost" id="introReplay" hidden>' +
              OW.SVG.icon('replay', 14) + ' 重播</button>' +
          '</div>' +
          '<div class="intro-cta" id="introCta">' +
            '<button class="btn btn--primary btn--lg" id="introStart">' +
              OW.SVG.icon('quill', 18) + ' 取笔起势</button>' +
            '<div class="hint">点击羽毛笔或按 <kbd>Enter</kbd> 开始</div>' +
          '</div>' +
          '<div class="intro-progress"><i></i></div>' +
        '</div>';

      var self = this;
      D.getElementById('introStart').addEventListener('click', function () { self.play(); });
      D.getElementById('introSkip').addEventListener('click', function () { self.finish(true); });
      D.getElementById('introReplay').addEventListener('click', function () { self.replay(); });
      // 点书页任意处也能起势，符合「点击羽毛笔启动」的直觉
      root.querySelector('svg.book').addEventListener('click', function () { self.play(); });
      this.keys = function (e) {
        if (!OW.App.isView('intro')) return;
        if (e.key === 'Enter' && !self.playing && !self.done) self.play();
        if (e.key === 'Escape') self.finish(true);
      };
      D.addEventListener('keydown', this.keys);
    },

    /** 给每条路径量真实长度，再写入 --len / --dur / --at，CSS 负责跑动画 */
    prime: function () {
      var self = this;
      ['spine', 'pages', 'corners', 'runes', 'decor'].forEach(function (g) {
        var conf = TL[g];
        var paths = self.el.querySelectorAll('.ln-' + g);
        for (var i = 0; i < paths.length; i++) {
          var p = paths[i], len = 1000;
          try { len = Math.ceil(p.getTotalLength()) || 1000; } catch (e) {}
          // 同组内部再错开一点，线条像是一笔笔画出来的
          var stagger = (conf.dur / Math.max(paths.length, 1)) * i * 0.55;
          p.style.setProperty('--len', len);
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len;
          p.style.setProperty('--dur', conf.dur + 'ms');
          p.style.setProperty('--at', Math.round(conf.at + stagger) + 'ms');
        }
      });
      // 羽毛笔飞行路径：从左上入画，掠过书脊与两页，收在右下
      var orbit = this.el.querySelector('.quill-orbit');
      if (orbit) {
        orbit.style.setProperty('--path',
          'path("M300 200 C620 150 900 250 960 300 C1010 420 700 520 470 400 ' +
          'C640 620 1240 640 1520 380 C1600 560 1300 760 960 820")');
        orbit.style.setProperty('--flight', (TL.decor.at + TL.decor.dur) + 'ms');
      }
      this.el.querySelector('.intro-progress').style.setProperty('--total', TL.total + 'ms');
    },

    /** 播放。连点由 playing / done 双重拦住（§5.1 验收） */
    play: function () {
      if (this.playing || this.done) return;
      this.playing = true;

      var cta = D.getElementById('introCta');
      cta.classList.add('is-hidden');

      // prefers-reduced-motion：不播装饰动画，直接给终态（§5.1）
      if (OW.reduced()) { this.settle(); this.finish(false); return; }

      this.prime();
      this.el.classList.add('is-playing');

      var self = this;
      this.after(TL.solid, function () { self.el.classList.add('is-solid'); });
      this.after(TL.push, function () { D.getElementById('introCam').classList.add('is-push'); });
      this.after(TL.title, function () { D.getElementById('introTitle').classList.add('is-in'); });
      this.after(TL.total, function () { self.finish(false); });
    },

    /** 直接给终态：跳过与 reduced-motion 共用，保证画面不空 */
    settle: function () {
      var lines = this.el.querySelectorAll('.ln');
      for (var i = 0; i < lines.length; i++) {
        lines[i].style.animation = 'none';
        lines[i].style.strokeDashoffset = '0';
      }
      var orbit = this.el.querySelector('.quill-orbit');
      if (orbit) { orbit.style.animation = 'none'; orbit.style.offsetDistance = '100%'; }
      this.el.classList.add('is-solid');
      D.getElementById('introCam').classList.add('is-push');
      D.getElementById('introTitle').classList.add('is-in');
      var bar = this.el.querySelector('.intro-progress > i');
      if (bar) { bar.style.animation = 'none'; bar.style.width = '100%'; }
    },

    after: function (ms, fn) { this.timers.push(w.setTimeout(fn, ms)); },
    clear: function () {
      this.timers.forEach(w.clearTimeout);
      this.timers = [];
    },

    /**
     * 结束：书页自然变成书库页面，不用黑场或硬切（§5.1）
     * @param skipped 是否由用户跳过
     */
    finish: function (skipped) {
      if (this.done) return;
      if (!this.playing && !skipped) return;
      this.done = true; this.playing = false;
      this.clear();
      if (skipped) this.settle();

      D.getElementById('introSkip').hidden = true;
      D.getElementById('introReplay').hidden = false;

      var self = this;
      var hold = (skipped || OW.reduced()) ? 60 : 520;   // 让终态被看见一瞬再走
      w.setTimeout(function () {
        self.el.classList.add('is-leaving');
        w.setTimeout(function () {
          self.el.classList.remove('is-leaving');
          OW.App.afterIntro();
        }, OW.reduced() ? 20 : 880);
      }, hold);
    },

    /** 重播（§14.1：可播放、可跳过、可重播） */
    replay: function () {
      this.clear();
      this.done = false; this.playing = false;
      this.el.classList.remove('is-playing', 'is-solid', 'is-leaving');
      D.getElementById('introCam').classList.remove('is-push');
      D.getElementById('introTitle').classList.remove('is-in');
      D.getElementById('introCta').classList.remove('is-hidden');
      D.getElementById('introSkip').hidden = false;
      D.getElementById('introReplay').hidden = true;

      var lines = this.el.querySelectorAll('.ln');
      for (var i = 0; i < lines.length; i++) {
        lines[i].style.animation = '';
        lines[i].style.strokeDashoffset = '';
      }
      var orbit = this.el.querySelector('.quill-orbit');
      if (orbit) { orbit.style.animation = ''; orbit.style.offsetDistance = ''; }
      var bar = this.el.querySelector('.intro-progress > i');
      if (bar) { bar.style.animation = ''; bar.style.width = ''; }

      // 强制回流，让动画能重新起跑
      void this.el.offsetWidth;
      var self = this;
      w.requestAnimationFrame(function () { self.play(); });
    },

    /** 从书库「重播开场」进来时复位 */
    rearm: function () {
      this.clear();
      this.done = false; this.playing = false;
      this.el.classList.remove('is-playing', 'is-solid', 'is-leaving');
      D.getElementById('introCam').classList.remove('is-push');
      D.getElementById('introTitle').classList.remove('is-in');
      D.getElementById('introCta').classList.remove('is-hidden');
      D.getElementById('introSkip').hidden = false;
      D.getElementById('introReplay').hidden = true;
      var lines = this.el.querySelectorAll('.ln');
      for (var i = 0; i < lines.length; i++) {
        lines[i].style.animation = ''; lines[i].style.strokeDashoffset = '';
      }
      var bar = this.el.querySelector('.intro-progress > i');
      if (bar) { bar.style.animation = ''; bar.style.width = ''; }
    }
  };

  OW.Intro = Intro;
})(window);
