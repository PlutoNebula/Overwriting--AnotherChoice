/* ==========================================================================
   store.js — 状态、规则与持久化
   这是给技术负责人（角色 2）的接缝：把 Persist 换成 Dexie / IndexedDB 即可，
   上层页面代码一行不用改。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});

  /* ------------------------------------------------------------------
     完整度规则：集中配置（§3.1 要求，不得散落写死在多个页面）
     ------------------------------------------------------------------ */
  OW.RULES = {
    kindWeight: 20,       // 四类铭文各 20%
    finaleWeight: 20,     // 终章 ≥ minChars 得 20%
    finaleMinChars: 50,
    // 阅读进度单独展示，不计入契名条件（避免为录视频假装读完整本书）
    readingCountsToward: false
  };

  /* ------------------------------------------------------------------
     四类铭文：语义、配色、第二区分维度
     配色映射待角色 1 拍板；改这里即可全站生效。
     ------------------------------------------------------------------ */
  OW.KINDS = [
    { id: 'echo',  name: '回响', en: 'ECHO',   ico: '·',
      gloss: '记录感受和共鸣', color: 'var(--ins-echo)',  line: '实线' },
    { id: 'query', name: '诘问', en: 'QUERY',  ico: '?',
      gloss: '提出质疑或不同意见', color: 'var(--ins-query)', line: '波浪' },
    { id: 'link',  name: '星链', en: 'LINK',   ico: '*',
      gloss: '联结其他书、经历、人物', color: 'var(--ins-link)', line: '点线' },
    { id: 'cont',  name: '续章', en: 'CONT.',  ico: '+',
      gloss: '沿着原文继续创作', color: 'var(--ins-cont)',  line: '双线' }
  ];
  OW.kindOf = function (id) {
    for (var i = 0; i < OW.KINDS.length; i++) if (OW.KINDS[i].id === id) return OW.KINDS[i];
    return OW.KINDS[0];
  };

  /* ------------------------------------------------------------------
     §8 文案：给定即用，不要改写
     ------------------------------------------------------------------ */
  OW.COPY = {
    locked:     '这本秘典尚未解封，先从可阅读的秘典开始。',
    noIns:      '这本书还在等待你的第一枚铭文。',
    noHit:      '秘典中未寻得此语。',
    ttsNo:      '当前浏览器无法唤醒朗读，请使用最新版浏览器。',
    aiNo:       '魔法助手尚未连接；核心阅读与铭文不受影响。',
    firstIns:   '第一枚铭文已经落下，你的版本从这里开始。',
    crossPara:  '初赛版暂不支持跨段批注，请在同一段内选择。',
    overlap:    '这段已有铭文，请重新选择一处尚未标记的文字。',
    txtBad:     '这个文件无法解析：可能为空、过大或格式不受支持。请提供纯文本 TXT。'
  };

  /* ------------------------------------------------------------------
     持久化：localStorage 版。角色 2 接 Dexie 时只替换这个对象。
     演示数据与正常数据分开存（§6.2），?demo=1 走 KEY_DEMO。
     ------------------------------------------------------------------ */
  var KEY_MAIN = 'ow.state.v1';
  var KEY_DEMO = 'ow.state.demo.v1';

  var Persist = {
    key: KEY_MAIN,
    useDemo: function (on) { this.key = on ? KEY_DEMO : KEY_MAIN; },
    read: function () {
      try {
        var raw = w.localStorage.getItem(this.key);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }     // 隐私模式 / file:// 下静默降级为内存态
    },
    write: function (state) {
      try { w.localStorage.setItem(this.key, JSON.stringify(state)); }
      catch (e) { /* 存不下不影响演示 */ }
    },
    clear: function () {
      try { w.localStorage.removeItem(this.key); } catch (e) {}
    }
  };
  OW.Persist = Persist;

  /* ------------------------------------------------------------------
     Store
     ------------------------------------------------------------------ */
  var subs = [];
  var S = null;

  function fresh() {
    return {
      firstRun: true,
      reader: null,               // 读者署名
      theme: 'night',             // 主题单一来源（§5.3），阅读器配色是它的派生值
      night: true,
      fontSize: 18,
      lineHeight: 2,
      books: OW.DATA.seedBooks(),
      ai: { key: '', model: 'demo', connected: false },
      versionCounter: 0
    };
  }

  OW.Store = {
    init: function (opts) {
      opts = opts || {};
      Persist.useDemo(!!opts.demo);
      S = Persist.read();
      if (!S || !S.books) S = fresh();
      // 老数据补齐字段，避免刷新后白屏
      var f = fresh();
      for (var k in f) if (!(k in S)) S[k] = f[k];
      if (opts.demo) OW.DATA.applyDemo(S);
      this.commit(true);
      return S;
    },
    get: function () { return S; },
    /** 订阅：任何页面拿到的都是同一份 state，不允许自己存副本 */
    sub: function (fn) { subs.push(fn); return function () {
      var i = subs.indexOf(fn); if (i > -1) subs.splice(i, 1);
    }; },
    commit: function (silent) {
      Persist.write(S);
      if (!silent) for (var i = 0; i < subs.length; i++) subs[i](S);
    },
    set: function (patch) {
      for (var k in patch) S[k] = patch[k];
      this.commit();
    },
    reset: function () { Persist.clear(); S = fresh(); this.commit(); },

    /* ---------- 书 ---------- */
    book: function (id) {
      for (var i = 0; i < S.books.length; i++) if (S.books[i].id === id) return S.books[i];
      return null;
    },
    addBook: function (b) { S.books.push(b); this.commit(); return b; },
    removeBook: function (id) {
      S.books = S.books.filter(function (b) { return b.id !== id; });
      this.commit();
    },
    /** 恢复示例藏书：补回被删掉的示例书，不动任何进度 */
    restoreSamples: function () {
      var seeds = OW.DATA.seedBooks(), added = 0, self = this;
      seeds.forEach(function (s) {
        if (!self.book(s.id)) { S.books.push(s); added++; }
      });
      // 保持示例书在前
      S.books.sort(function (a, b) { return (a.sample ? 0 : 1) - (b.sample ? 0 : 1); });
      this.commit();
      return added;
    },
    /** 重置示例书进度：清掉铭文、终章、契名与阅读位置，书还在 */
    resetSampleProgress: function () {
      S.books.forEach(function (b) {
        if (!b.sample) return;
        b.inscriptions = [];
        b.finale = '';
        b.signed = null;
        b.page = 0;
        b.firstInsDone = false;
        b.bookmarks = [];
      });
      this.commit();
    },

    /* ---------- 铭文 ---------- */
    addIns: function (bookId, ins) {
      var b = this.book(bookId); if (!b) return null;
      ins.id = 'i' + Date.now() + Math.floor(Math.random() * 1000);
      ins.at = Date.now();
      b.inscriptions.push(ins);
      this.commit();
      return ins;
    },
    updateIns: function (bookId, insId, patch) {
      var b = this.book(bookId); if (!b) return;
      b.inscriptions.forEach(function (i) {
        if (i.id === insId) for (var k in patch) i[k] = patch[k];
      });
      this.commit();
    },
    removeIns: function (bookId, insId) {
      var b = this.book(bookId); if (!b) return;
      b.inscriptions = b.inscriptions.filter(function (i) { return i.id !== insId; });
      this.commit();
    },

    /* ---------- 完整度：唯一计算入口 ---------- */
    progress: function (bookId) {
      var b = this.book(bookId);
      var R = OW.RULES;
      var out = { kinds: {}, lit: 0, finaleOk: false, chars: 0, pct: 0, missing: [] };
      if (!b) return out;

      OW.KINDS.forEach(function (k) {
        var n = b.inscriptions.filter(function (i) { return i.kind === k.id; }).length;
        out.kinds[k.id] = n;
        if (n > 0) out.lit++;
        else out.missing.push('还缺一条「' + k.name + '」（' + k.gloss + '）');
      });

      out.chars = (b.finale || '').replace(/\s/g, '').length;
      out.finaleOk = out.chars >= R.finaleMinChars;
      if (!out.finaleOk) {
        out.missing.push('读者终章还差 ' + (R.finaleMinChars - out.chars) + ' 字（不少于 ' +
          R.finaleMinChars + ' 字）');
      }

      out.pct = out.lit * R.kindWeight + (out.finaleOk ? R.finaleWeight : 0);
      out.ready = out.pct >= 100;
      return out;
    },

    /* ---------- 契名 ---------- */
    sign: function (bookId, penName) {
      var b = this.book(bookId); if (!b) return null;
      S.versionCounter++;
      b.signed = {
        reader: penName,
        // 原作者名字始终保留（§5.5 验收），这里不接受任何覆盖入参
        author: b.author,
        no: S.versionCounter,
        at: Date.now()
      };
      this.commit();
      return b.signed;
    },
    versionLabel: function (b) {
      var no = b.signed ? b.signed.no : (S.versionCounter + 1);
      var n = String(no);
      while (n.length < 3) n = '0' + n;
      return '第 ' + n + ' 号覆写版本';
    },
    /** 署名格式：原作者名 著 · 用户名 编注｜第 001 号覆写版本 */
    signatureLine: function (b) {
      var reader = b.signed ? b.signed.reader : (S.reader || '读者');
      return b.author + ' 著 · ' + reader + ' 编注｜' + this.versionLabel(b);
    }
  };
})(window);
