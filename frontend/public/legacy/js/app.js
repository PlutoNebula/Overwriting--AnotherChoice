/* ==========================================================================
   app.js — 应用外壳：路由、主题单一来源、通用提示
   页面流程：开场 → 首次署名 → 秘典书库 → 阅读器 → 读者终章 → 契名仪式 → 个人秘典
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;

  /* prefers-reduced-motion：全站唯一判断入口 */
  var mq = w.matchMedia ? w.matchMedia('(prefers-reduced-motion: reduce)') : null;
  OW.reduced = function () { return !!(mq && mq.matches); };

  /* ---------- 轻提示 ---------- */
  OW.toast = function (msg, kind) {
    var wrap = D.getElementById('toasts');
    var t = D.createElement('div');
    t.className = 'toast' + (kind === 'warn' ? ' toast--warn' : '');
    t.setAttribute('role', 'status');
    t.innerHTML = '<span class="ico">' +
      OW.SVG.icon(kind === 'warn' ? 'warn' : 'check', 15) + '</span><span></span>';
    t.lastChild.textContent = msg;
    wrap.appendChild(t);
    w.setTimeout(function () {
      t.classList.add('is-out');
      w.setTimeout(function () { t.remove(); }, 260);
    }, kind === 'warn' ? 3400 : 2400);
  };

  /* ---------- 二次确认：默认按钮为取消（§8）---------- */
  OW.confirm = function (o) {
    var wrap = D.createElement('div');
    wrap.className = 'scrim';
    wrap.innerHTML =
      '<div class="dialog panel" role="dialog" aria-modal="true" aria-labelledby="dlgT">' +
        '<h3 id="dlgT"></h3><p></p>' +
        '<div class="row">' +
          '<button class="btn" data-no></button>' +
          '<button class="btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + '" data-yes></button>' +
        '</div>' +
      '</div>';
    wrap.querySelector('h3').textContent = o.title || '确认？';
    wrap.querySelector('p').textContent = o.body || '';
    var no = wrap.querySelector('[data-no]'), yes = wrap.querySelector('[data-yes]');
    no.textContent = o.cancel || '取消';
    yes.textContent = o.ok || '确认';
    D.body.appendChild(wrap);
    no.focus();                                  // 默认落在取消上

    function close() { wrap.remove(); D.removeEventListener('keydown', esc); }
    function esc(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {                     // 焦点锁在对话框内
        var f = [no, yes], i = f.indexOf(D.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    }
    D.addEventListener('keydown', esc);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
    no.addEventListener('click', close);
    yes.addEventListener('click', function () { close(); if (o.onOk) o.onOk(); });
  };

  /* ==========================================================================
     App
     ========================================================================== */
  var VIEWS = ['intro', 'signin', 'library', 'reader', 'finale', 'ceremony', 'opus'];

  var App = {
    view: null,
    demo: false,
    autoplay: false,

    boot: function () {
      var q = new w.URLSearchParams(w.location.search);
      this.demo = q.get('demo') === '1';
      this.autoplay = q.get('autoplay') === '1';

      D.getElementById('defs').innerHTML = OW.SVG.defs();

      OW.Store.init({ demo: this.demo });
      this.applyTheme();

      // 开场动画由 React（src/main.tsx）挂在 #intro-root 上，此处不再挂 OW.Intro。
      this.mountSignin();
      OW.Lib.mount(D.getElementById('view-library'));
      OW.Rd.mount(D.getElementById('view-reader'));
      OW.Fn.mount(D.getElementById('view-finale'));
      OW.Cm.mount(D.getElementById('view-ceremony'));
      OW.Op.mount(D.getElementById('view-opus'));

      if (this.demo) {
        D.getElementById('demoFlag').hidden = false;
        OW.Lib.render();
      }

      // 从开场进入。?autoplay=1 由 IntroScene 自己处理（见 src/intro/IntroScene.tsx）。
      this.go('intro');
    },

    /* ---------- 路由 ---------- */
    isView: function (v) { return this.view === v; },
    go: function (v) {
      if (VIEWS.indexOf(v) < 0) v = 'library';
      this.view = v;
      VIEWS.forEach(function (id) {
        var el = D.getElementById('view-' + id);
        if (el) el.classList.toggle('is-active', id === v);
      });
      if (v === 'library') OW.Lib.render();
      if (v !== 'reader') OW.Rd.stopTts();
      if (v !== 'ceremony') OW.Cm.stop();
      D.getElementById('main').focus({ preventScroll: true });
    },

    /** 开场结束 → 首次署名（仅首次）→ 书库 */
    afterIntro: function () {
      var st = OW.Store.get();
      if (st.firstRun || !st.reader) { this.go('signin'); this.focusSign(); }
      else this.go('library');
    },

    replayIntro: function () {
      var root = D.getElementById('intro-root');
      if (root) root.removeAttribute('data-done');
      w.dispatchEvent(new CustomEvent('overwriting:replay-intro'));
      this.go('intro');
    },

    openBook: function (id) { this.go('reader'); OW.Rd.open(id); },
    openFinale: function (id) { this.go('finale'); OW.Fn.open(id); },
    openCeremony: function (id, name) { this.go('ceremony'); OW.Cm.open(id, name); },
    openOpus: function (id) { this.go('opus'); OW.Op.open(id); },

    /* ---------- 主题单一来源（§5.3）---------- */
    applyTheme: function () {
      var st = OW.Store.get();
      // 夜间模式与阅读器配色共用同一套状态：night=false 时正文走 sepia，
      // night=true 时保留用户选的 night/dark，避免局部漏色
      var theme = st.night ? (st.theme === 'sepia' ? 'night' : st.theme) : 'sepia';
      D.documentElement.setAttribute('data-theme', theme);
      D.documentElement.setAttribute('data-night', st.night ? '1' : '0');
    },
    setTheme: function (t) {
      var st = OW.Store.get();
      OW.Store.set({ theme: t, night: t !== 'sepia' ? st.night : false });
      this.applyTheme();
      if (this.view === 'reader') OW.Rd.render();
      if (this.view === 'library') OW.Lib.render();
    },
    setNight: function (on) {
      OW.Store.set({ night: !!on });
      this.applyTheme();
      if (this.view === 'reader') OW.Rd.render();
      if (this.view === 'library') OW.Lib.render();
    },
    toggleNight: function () { this.setNight(!OW.Store.get().night); },

    /* ---------- 首次署名 ---------- */
    mountSignin: function () {
      var root = D.getElementById('view-signin');
      root.innerHTML =
        '<section class="sign-card parch corners">' +
          '<i class="cnr tl"></i><i class="cnr tr"></i>' +
          '<i class="cnr bl"></i><i class="cnr br"></i>' +
          '<div class="seal">' + OW.SVG.sigil({}, 64) + '</div>' +
          '<div class="eyebrow">First Signature</div>' +
          '<h2>先写下你的名字</h2>' +
          '<p class="lede">这个名字会跟着你留下的每一枚' +
            '<span class="term" data-gloss="铭文：你留在原文旁的回应，不会改动原文">铭文</span>，' +
            '最后与原作者并列印在封面上。</p>' +
          '<div class="sign-form">' +
            '<input class="input input--quill" id="sgName" maxlength="10" ' +
              'placeholder="你的名字" aria-label="你的署名">' +
            '<div class="count" id="sgCount">最多 10 个字</div>' +
            '<button class="btn btn--primary" id="sgGo">以此名进入书库</button>' +
          '</div>' +
          '<p class="sign-note">名字只存在你自己的浏览器里，随时可以在设置中重新开始。<br>' +
            '原作者的署名不会被替换 —— 你以「编注」的身份进入每一本书。</p>' +
        '</section>';

      var input = D.getElementById('sgName');
      var go = D.getElementById('sgGo');
      var cnt = D.getElementById('sgCount');
      var self = this;

      function paint() {
        var v = input.value.trim();
        cnt.textContent = v ? v.length + ' / 10 字' : '最多 10 个字';
        go.disabled = !v;
      }
      paint();
      input.addEventListener('input', paint);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && input.value.trim()) go.click();
      });
      go.addEventListener('click', function () {
        var v = input.value.trim();
        if (!v) { input.focus(); return OW.toast('先写下你的名字。', 'warn'); }
        OW.Store.set({ reader: v, firstRun: false });
        self.go('library');
        OW.toast(v + '，书库已经为你打开。');
      });
    },
    focusSign: function () {
      var i = D.getElementById('sgName');
      if (i) w.setTimeout(function () { i.focus(); }, 320);
    },

    /* ---------- 恢复首次使用状态 ---------- */
    wipe: function () {
      OW.Store.reset();
      this.applyTheme();
      var root = D.getElementById('intro-root');
      if (root) root.removeAttribute('data-done');
      w.dispatchEvent(new CustomEvent('overwriting:replay-intro'));
      this.go('intro');
      OW.toast('已回到首次使用状态。');
    }
  };

  OW.App = App;

  D.addEventListener('DOMContentLoaded', function () { App.boot(); });
})(window);
