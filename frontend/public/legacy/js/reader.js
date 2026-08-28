/* ==========================================================================
   reader.js — 阅读器 + 铭文系统（§5.3 / §5.4 / §5.5）
   六个辅助面板互斥：单一 activePanel，不是六个 boolean。
   翻页只做稳定切换，不做纸张翻卷特效。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;
  var SVG;

  var PANELS = [
    { id: 'toc',    ico: 'toc',    lb: '目录' },
    { id: 'search', ico: 'search', lb: '搜索' },
    { id: 'bookmark', ico: 'mark', lb: '书签' },
    { id: 'branch', ico: 'branch', lb: '分支' },
    { id: 'tts',    ico: 'tts',    lb: '朗读' },
    { id: 'display', ico: 'disp',  lb: '配色' }
  ];

  var Rd = {
    el: null,
    bookId: null,
    panel: 'toc',          // 唯一的面板状态（含 null = 全收起）
    asideOn: true,         // 铭文面板：右栏，与左侧五个面板同属互斥集合的一员
    filter: 'all',
    selectedIns: null,     // 从扇形牌组中抽出、在上方完整展示的铭文 id
    editing: null,         // {mode:'new'|'edit', ...}
    sel: null,             // 当前选区 {ch,para,s,e,quote}

    mount: function (root) {
      SVG = OW.SVG;
      this.el = root;
      root.innerHTML =
        '<div class="rd" id="rdGrid">' +
          '<header class="rd-bar">' +
            '<button class="btn btn--icon" id="rdBack" aria-label="回到书库" ' +
              'title="回到书库">' + SVG.icon('back') + '</button>' +
            '<div class="bk grow"><span class="t" id="rdTitle"></span>' +
              '<span class="s" id="rdSub"></span></div>' +
            '<div class="rd-sigil" id="rdSigil"></div>' +
            '<div class="rd-tools">' +
              '<span class="rule-v"></span>' +
              '<button class="btn btn--icon" id="rdNight" aria-label="日夜切换"></button>' +
              '<button class="btn btn--icon" id="rdMark" aria-label="加书签" ' +
                'title="给当前一节加书签">' + SVG.icon('mark') + '</button>' +
              '<span class="rule-v"></span>' +
              '<button class="btn btn--sm" id="rdIns">' + SVG.icon('ins', 15) +
                ' 铭文</button>' +
              '<button class="btn btn--sm rd-rewrite-btn" id="rdRewrite">' + SVG.icon('star', 15) +
                ' AI 改编</button>' +
              '<button class="btn btn--sm btn--primary" id="rdFin">读者终章</button>' +
            '</div>' +
          '</header>' +

          '<aside class="rd-side" id="rdSide">' +
            '<div class="side-tabs" id="rdTabs" role="tablist"></div>' +
            '<div class="side-body" id="rdSideBody"></div>' +
          '</aside>' +

          '<main class="rd-main">' +
            '<article class="page parch" id="rdPage">' +
              '<div class="page-inner" id="rdPageInner"></div>' +
            '</article>' +
            '<div class="rd-foot">' +
              '<button class="btn btn--sm" id="rdPrev">' + SVG.icon('left', 15) + ' 上一节</button>' +
              '<span class="pos" id="rdPos"></span>' +
              '<button class="btn btn--sm" id="rdNext">下一节 ' + SVG.icon('right', 15) + '</button>' +
            '</div>' +
          '</main>' +

          '<aside class="rd-aside" id="rdAside"></aside>' +
        '</div>' +
        '<div class="sel-pop" id="rdPop"></div>';

      this.wire();
    },

    wire: function () {
      var self = this;

      D.getElementById('rdBack').addEventListener('click', function () { OW.App.go('library'); });
      D.getElementById('rdFin').addEventListener('click', function () { OW.App.openFinale(self.bookId); });
      D.getElementById('rdRewrite').addEventListener('click', function () { self.openRewriteAtEnd(); });
      D.getElementById('rdNight').addEventListener('click', function () { OW.App.toggleNight(); });
      D.getElementById('rdPrev').addEventListener('click', function () { self.turn(-1); });
      D.getElementById('rdNext').addEventListener('click', function () { self.turn(1); });

      /* 右侧铭文与左侧工具栏独立开关，切换工具不应让铭文消失。 */
      D.getElementById('rdIns').addEventListener('click', function () { self.setPanel('inscription'); });

      D.getElementById('rdMark').addEventListener('click', function () { self.addBookmark(); });

      /* 左侧六个 tab */
      var tabs = D.getElementById('rdTabs');
      tabs.innerHTML = PANELS.map(function (p) {
        return '<button role="tab" data-p="' + p.id + '" aria-selected="false" ' +
          'aria-label="' + p.lb + '">' + SVG.icon(p.ico, 16) + '<span>' + p.lb + '</span></button>';
      }).join('');
      tabs.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-p]');
        if (b) self.setPanel(b.getAttribute('data-p'));
      });

      /* 键盘左右翻页（§5.3）*/
      this.keys = function (e) {
        if (!OW.App.isView('reader')) return;
        var t = e.target.tagName;
        if (t === 'TEXTAREA' || t === 'INPUT') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); self.turn(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); self.turn(1); }
        if (e.key === 'Escape') { self.hidePop(); self.closeEditor(); }
      };
      D.addEventListener('keydown', this.keys);

      /* 选中文字 → 浮动按钮 */
      var inner = D.getElementById('rdPageInner');
      inner.addEventListener('mouseup', function () { w.setTimeout(function () { self.onSelect(); }, 0); });
      inner.addEventListener('keyup', function () { self.onSelect(); });
      inner.addEventListener('click', function (e) {
        var m = e.target.closest('.ins');
        if (m) { self.focusIns(m.getAttribute('data-id')); }
      });
      D.addEventListener('mousedown', function (e) {
        if (!e.target.closest('#rdPop')) self.hidePop();
      });
    },

    /* ------------------------------------------------------------------
       打开一本书
       ------------------------------------------------------------------ */
    open: function (bookId) {
      var b = OW.Store.book(bookId);
      if (!b) return OW.App.go('library');
      if (b.locked) { OW.toast(OW.COPY.locked, 'warn'); return OW.App.go('library'); }
      this.bookId = bookId;
      this.filter = 'all';
      this.selectedIns = null;
      this.editing = null;
      this.sel = null;
      this.stopTts();
      if (this.panel === null) this.panel = 'toc';
      if (this.panel === 'branch') this.asideOn = true;
      this.render();
    },

    /** 左侧辅助面板与右侧铭文彼此独立，只有用户主动操作才收起对应一侧。 */
    setPanel: function (id) {
      if (id === 'inscription') {
        this.asideOn = !this.asideOn;
      } else {
        if (this.panel === id) { this.panel = null; }
        else {
          this.panel = id;
          if (id === 'branch') this.asideOn = true;
        }
      }
      // 两边都空时至少留一个，避免出现空白大页
      if (this.panel === null && !this.asideOn) this.asideOn = true;
      this.render();
      if (this.panel === 'search') {
        var i = D.getElementById('rdQ'); if (i) i.focus();
      }
    },

    /* ------------------------------------------------------------------
       渲染
       ------------------------------------------------------------------ */
    render: function () {
      var b = OW.Store.book(this.bookId);
      if (!b) return;
      var st = OW.Store.get(), pr = OW.Store.progress(b.id);
      var chs = b.chapters || [], idx = Math.min(b.page || 0, Math.max(chs.length - 1, 0));

      D.getElementById('rdTitle').textContent = b.title + ' · ' + b.author + ' 著';
      D.getElementById('rdSub').textContent =
        (chs[idx] ? chs[idx].title : '') + '　|　铭文 ' + b.inscriptions.length + ' 枚';

      var nb = D.getElementById('rdNight');
      nb.innerHTML = SVG.icon(st.night ? 'moon' : 'sun');
      nb.classList.toggle('is-on', !st.night);

      /* 顶栏契印 + 完整度 */
      var lit = {}; OW.KINDS.forEach(function (k) { lit[k.id] = pr.kinds[k.id]; });
      lit.full = pr.ready;
      D.getElementById('rdSigil').innerHTML =
        '<span class="mini-sigil">' + SVG.sigil(lit, 34) + '</span>' +
        '<span class="pc">' + pr.pct + '%</span>';

      /* 栅格：收起的栏宽度归零 */
      var grid = D.getElementById('rdGrid');
      grid.classList.toggle('no-side', this.panel === null);
      grid.classList.toggle('no-aside', !this.asideOn);

      this.renderSide(b, idx);
      this.renderPage(b, idx);
      this.renderAside(b);

      D.getElementById('rdPos').textContent =
        (idx + 1) + ' / ' + Math.max(chs.length, 1);
      D.getElementById('rdPrev').disabled = idx <= 0;
      D.getElementById('rdNext').disabled = idx >= chs.length - 1;
      D.getElementById('rdIns').classList.toggle('is-on', this.asideOn);
    },

    /* ---------- 分支面板：只复用视觉与交互，数据仍使用本项目 OW.Store ---------- */
    branchPaneHtml: function (b) {
      var accepted = (b.branches || []).filter(function (branch) {
        return branch.status === 'accepted';
      });
      var candidates = (b.branches || []).filter(function (branch) {
        return branch.status !== 'accepted';
      });
      var acceptedById = {};
      accepted.forEach(function (branch) { acceptedById[branch.id] = branch; });

      function branchNo(branch) {
        var i = accepted.indexOf(branch);
        return String(i + 1).padStart(2, '0');
      }
      function childrenOf(parentId) {
        return accepted.filter(function (branch) { return (branch.parentId || null) === parentId; });
      }
      function nodeHtml(branch) {
        var children = childrenOf(branch.id);
        var meta = '第 ' + ((branch.chapterIndex || 0) + 1) + ' 节' +
          (branch.parentId ? ' · 承分支' : ' · 承原作');
        return '<li><button class="br-node ' + (b.activeBranchId === branch.id ? 'is-cur' : '') +
          '" data-branch-id="' + branch.id + '" aria-pressed="' +
          (b.activeBranchId === branch.id) + '">' +
            '<span class="br-badge is-branch">分支 ' + branchNo(branch) + '</span>' +
            '<span class="br-tt">' + SVG.esc(branch.title || '未命名分支') + '</span>' +
            '<span class="br-meta">' + meta + '</span>' +
          '</button>' +
          (children.length ? '<ul>' + children.map(nodeHtml).join('') + '</ul>' : '') +
        '</li>';
      }

      var roots = accepted.filter(function (branch) {
        return !branch.parentId || !acceptedById[branch.parentId];
      });
      var tree = '<ul><li><button class="br-node ' + (!b.activeBranchId ? 'is-cur' : '') +
        '" data-branch-id="" aria-pressed="' + (!b.activeBranchId) + '">' +
          '<span class="br-badge is-canon">原作</span>' +
          '<span class="br-tt">' + SVG.esc(b.title) + '</span>' +
          '<span class="br-meta">canonical</span>' +
        '</button>' +
        (roots.length ? '<ul>' + roots.map(nodeHtml).join('') + '</ul>' : '') +
      '</li></ul>';

      var candidateHtml = candidates.length
        ? '<div class="br-drafts-hd">已保留的候选</div><div class="br-drafts">' +
          candidates.map(function (branch) {
            return '<button class="br-draft" data-branch-candidate="' + branch.id + '">' +
              '<span class="nm">' + SVG.esc(branch.title || '未命名候选') + '</span>' +
              '<span class="qu">' + SVG.esc((branch.content || '').slice(0, 70)) + '</span>' +
            '</button>';
          }).join('') + '</div>'
        : '';

      return '<div class="side-pane is-on side-branch">' +
        '<div class="hd br-panel-head"><span>分支 <span class="hd-sub">' + accepted.length +
          ' 条分支 · ' + candidates.length + ' 个候选</span></span>' +
          '<button class="btn btn--sm br-workbench" data-branch-workbench ' +
            'aria-label="展开分支工作台" title="展开分支工作台">' +
            SVG.icon('expand', 13) + ' 展开</button></div>' +
        '<div class="br-tree">' + tree + '</div>' +
        (!accepted.length && !candidates.length
          ? '<div class="br-empty">还没有分支。<br>点击顶栏“AI 改编”，让故事从当前章节长出另一条路线。</div>'
          : '') +
        candidateHtml +
        '<div class="br-actions">' +
          '<button class="btn btn--sm" data-branch-original>回到原作</button>' +
          '<button class="btn btn--sm rd-rewrite-btn" data-branch-continue>' +
            SVG.icon('star', 12) + ' 从当前分支继续改编</button>' +
        '</div></div>';
    },

    wireBranchPane: function (b) {
      var self = this;
      var body = D.getElementById('rdSideBody');
      if (!body) return;
      body.addEventListener('click', function (e) {
        if (e.target.closest('[data-branch-workbench]')) {
          self.openRewriteAtEnd();
          return;
        }
        var node = e.target.closest('[data-branch-id]');
        if (node) {
          var id = node.getAttribute('data-branch-id') || null;
          if ((b.activeBranchId || null) === id) return;
          OW.Store.setActiveBranch(b.id, id);
          OW.toast(id ? '已切换到这条剧情分支。' : '已回到原作路线。');
          self.render();
          return;
        }
        var draft = e.target.closest('[data-branch-candidate]');
        if (draft) {
          OW.App.go('rewrite');
          OW.Rw.openSaved(b.id, draft.getAttribute('data-branch-candidate'));
          return;
        }
        if (e.target.closest('[data-branch-original]')) {
          OW.Store.setActiveBranch(b.id, null);
          OW.toast('已回到原作路线。');
          self.render();
          return;
        }
        if (e.target.closest('[data-branch-continue]')) {
          var active = b.activeBranchId ? OW.Store.branch(b.id, b.activeBranchId) : null;
          if (!active) return self.openRewriteAtEnd();
          OW.App.openRewrite({
            bookId: b.id,
            chapterIndex: active.chapterIndex || (b.page || 0),
            sourceType: 'branch',
            quote: (active.content || '').slice(-160),
            parentId: active.id,
            intent: (active.nextDirections || [])[0] || ''
          });
        }
      });
    },

    /* ---------- 左侧六合一面板 ---------- */
    renderSide: function (b, idx) {
      var tabs = D.getElementById('rdTabs').querySelectorAll('button[data-p]');
      for (var i = 0; i < tabs.length; i++) {
        tabs[i].setAttribute('aria-selected',
          tabs[i].getAttribute('data-p') === this.panel ? 'true' : 'false');
      }
      if (this.panel === null) { D.getElementById('rdSideBody').innerHTML = ''; return; }

      var body = D.getElementById('rdSideBody');
      var self = this;

      if (this.panel === 'toc') {
        body.innerHTML = '<div class="side-pane is-on"><div class="hd">目录</div>' +
          '<ul class="toc">' + (b.chapters || []).map(function (c, i) {
            var n = b.inscriptions.filter(function (x) { return x.ch === i; }).length;
            return '<li><button data-i="' + i + '" class="' +
              (i === idx ? 'is-cur ' : '') + (n ? 'has-ins' : '') + '">' +
              '<span class="n">' + (i + 1) + '</span>' +
              '<span class="tt">' + SVG.esc(c.title) + '</span>' +
              '<span class="dot" title="本节有 ' + n + ' 枚铭文"></span></button></li>';
          }).join('') + '</ul></div>';
        body.querySelector('.toc').addEventListener('click', function (e) {
          var btn = e.target.closest('button[data-i]');
          if (btn) self.goto(parseInt(btn.getAttribute('data-i'), 10));
        });

      } else if (this.panel === 'search') {
        body.innerHTML = '<div class="side-pane is-on"><div class="hd">搜索</div>' +
          '<input class="input" id="rdQ" placeholder="在这本秘典中搜索…" ' +
            'aria-label="搜索正文">' +
          '<div id="rdHits" style="margin-top:16px"></div></div>';
        var q = D.getElementById('rdQ');
        q.addEventListener('input', function () { self.search(q.value); });
        // 命中列表每次输入都会重绘 innerHTML，监听挂在稳定的容器上，避免层层累加
        D.getElementById('rdHits').addEventListener('click', function (e) {
          var hit = e.target.closest('.search-hit');
          if (hit) self.goto(parseInt(hit.getAttribute('data-ch'), 10));
        });

      } else if (this.panel === 'bookmark') {
        var bms = b.bookmarks || [];
        body.innerHTML = '<div class="side-pane is-on"><div class="hd">书签</div>' +
          '<div id="rdBms">' +
          (bms.length ? bms.map(function (m, i) {
            return '<div class="bm-item" data-i="' + i + '">' + SVG.icon('mark', 14) +
              '<div class="tx"><span class="loc">第 ' + (m.ch + 1) + ' 节</span>' +
              SVG.esc(m.text.slice(0, 40)) + '</div></div>';
          }).join('') : '<div class="empty">' + SVG.icon('mark', 40) +
            '<div>还没有书签。顶栏的书签按钮可以记住当前一节。</div></div>') +
          '</div></div>';
        // 挂在每次重建的 #rdBms 上，不挂 #rdSideBody，避免监听逐次累加
        D.getElementById('rdBms').addEventListener('click', function (e) {
          var it = e.target.closest('.bm-item');
          if (it) self.goto(bms[parseInt(it.getAttribute('data-i'), 10)].ch);
        });

      } else if (this.panel === 'branch') {
        body.innerHTML = this.branchPaneHtml(b);
        this.wireBranchPane(b);

      } else if (this.panel === 'tts') {
        body.innerHTML = '<div class="side-pane is-on"><div class="hd">朗读</div>' +
          '<div class="tts-box" id="rdTts">' +
            '<div class="tts-voice-card">' + SVG.icon('tts', 18) +
              '<div><strong>温柔女声朗读</strong><span id="rdTtsVoice">优先使用系统中文女声 · 舒缓节奏</span></div>' +
            '</div>' +
            '<div class="tts-viz">' + new Array(19).join('<i></i>') + '</div>' +
            '<div class="tts-row">' +
              '<button class="btn btn--sm btn--primary" data-t="play">开始</button>' +
              '<button class="btn btn--sm" data-t="pause">暂停</button>' +
              '<button class="btn btn--sm" data-t="resume">继续</button>' +
              '<button class="btn btn--sm" data-t="stop">停止</button>' +
            '</div>' +
            '<div class="t-low" style="font-size:12px;line-height:1.8">' +
              '朗读当前一节的正文。切换章节会自动停止。</div>' +
          '</div></div>';
        body.querySelector('.tts-row').addEventListener('click', function (e) {
          var t = e.target.closest('button[data-t]');
          if (t) self.tts(t.getAttribute('data-t'));
        });

      } else if (this.panel === 'display') {
        var st = OW.Store.get();
        body.innerHTML = '<div class="side-pane is-on"><div class="hd">阅读配色与字号</div>' +
          '<div class="disp-row"><span class="lb">配色</span>' +
            '<div class="swatches" id="rdSw">' +
              '<button class="swatch sw-night" data-v="night" aria-label="明亮羊皮纸（日间）" ' +
                'aria-pressed="' + (st.theme === 'night') + '"></button>' +
              '<button class="swatch sw-sepia" data-v="sepia" aria-label="暖黄旧纸（日间）" ' +
                'aria-pressed="' + (st.theme === 'sepia') + '"></button>' +
              '<button class="swatch sw-dark" data-v="dark" aria-label="深色纸面（夜间）" ' +
                'aria-pressed="' + (st.theme === 'dark') + '"></button>' +
            '</div>' +
            '<div class="t-low" style="font-size:11px">选择深色会进入夜间模式；两种浅色均为日间阅读。</div>' +
          '</div>' +
          '<div class="disp-row"><span class="lb">字号</span>' +
            '<div class="seg" id="rdFs">' +
              '<button data-v="16" aria-pressed="' + (st.fontSize === 16) + '">小</button>' +
              '<button data-v="18" aria-pressed="' + (st.fontSize === 18) + '">中</button>' +
              '<button data-v="21" aria-pressed="' + (st.fontSize === 21) + '">大</button>' +
              '<button data-v="24" aria-pressed="' + (st.fontSize === 24) + '">特大</button>' +
            '</div></div>' +
          '<div class="disp-row"><span class="lb">行距</span>' +
            '<div class="seg" id="rdLh">' +
              '<button data-v="1.8" aria-pressed="' + (st.lineHeight === 1.8) + '">紧</button>' +
              '<button data-v="2" aria-pressed="' + (st.lineHeight === 2) + '">标准</button>' +
              '<button data-v="2.3" aria-pressed="' + (st.lineHeight === 2.3) + '">松</button>' +
            '</div></div>' +
          '</div>';
        body.querySelector('#rdSw').addEventListener('click', function (e) {
          var s = e.target.closest('.swatch'); if (!s) return;
          OW.App.setTheme(s.getAttribute('data-v'));
        });
        OW.seg(body.querySelector('#rdFs'), function (v) {
          OW.Store.set({ fontSize: parseInt(v, 10) }); Rd.renderPage(b, idx);
        });
        OW.seg(body.querySelector('#rdLh'), function (v) {
          OW.Store.set({ lineHeight: parseFloat(v) }); Rd.renderPage(b, idx);
        });
      }
    },

    /* ---------- 正文 ---------- */
    renderPage: function (b, idx) {
      var st = OW.Store.get();
      var ch = (b.chapters || [])[idx];
      var inner = D.getElementById('rdPageInner');
      if (!ch) {
        inner.innerHTML = '<div class="empty">' + SVG.icon('lock', 40) +
          '<div>' + OW.COPY.locked + '</div></div>';
        return;
      }
      inner.style.setProperty('--rd-fs', st.fontSize + 'px');
      inner.style.setProperty('--rd-lh', st.lineHeight);

      var self = this;
      inner.innerHTML =
        '<header class="page-head">' +
          '<div class="ch">Chapter ' + (idx + 1) + '</div>' +
          '<h2>' + SVG.esc(ch.title) + '</h2>' +
          '<div class="orn">' + SVG.ornament() + '</div>' +
        '</header>' +
        '<div class="prose" id="rdProse" style="font-size:' + st.fontSize +
          'px;line-height:' + st.lineHeight + '">' +
          ch.paras.map(function (t, pi) {
            return '<p data-p="' + pi + '">' + self.markup(b, idx, pi, t) + '</p>';
          }).join('') +
        '</div>' +
        this.branchReadingHtml(b, idx) +
        '<section class="rewrite-callout">' +
          '<span class="rewrite-callout-mark">' + SVG.icon('star', 18) + '</span>' +
          '<div><strong>故事也许可以不这样发生。</strong>' +
            '<span>从本节结尾推演一条平行路线，原作不会被覆盖。</span></div>' +
          '<button class="btn btn--sm rd-rewrite-btn" id="rdRewriteEnd">改变剧情</button>' +
        '</section>';

      var end = D.getElementById('rdRewriteEnd');
      if (end) end.addEventListener('click', function () { self.openRewriteAtEnd(); });
      var origin = inner.querySelector('[data-branch-original]');
      if (origin) origin.addEventListener('click', function () {
        OW.Store.setActiveBranch(b.id, null); self.render(); OW.toast('已回到原作路线。');
      });
      var more = inner.querySelector('[data-branch-continue]');
      if (more) more.addEventListener('click', function () {
        var branch = OW.Store.branch(b.id, more.getAttribute('data-branch-continue'));
        if (branch) OW.App.openRewrite({ bookId: b.id, chapterIndex: idx, sourceType: 'branch',
          quote: branch.content.slice(-160), parentId: branch.id,
          intent: (branch.nextDirections || [])[0] || '' });
      });
    },

    branchReadingHtml: function (b, idx) {
      if (!b.activeBranchId) return '';
      var lineage = OW.Store.branchLineage(b.id, b.activeBranchId).filter(function (x) {
        return x.status === 'accepted' && x.chapterIndex === idx;
      });
      if (!lineage.length) return '';
      var last = lineage[lineage.length - 1];
      return '<section class="branch-reading" aria-label="已采纳的 AI 剧情分支">' +
        '<header><div><span class="t-eyebrow">AI Rewrite Route</span><h3>平行剧情 · ' +
          SVG.esc(last.title) + '</h3></div><span class="tag">AI 剧情覆写版</span></header>' +
        lineage.map(function (branch, i) {
          return '<article><span class="branch-depth">分支 ' + (i + 1) + '</span><p>' +
            SVG.esc(branch.content) + '</p></article>';
        }).join('') +
        '<footer><span>由 AI 辅助生成，内容由你选择并可编辑。</span><div>' +
          '<button class="btn btn--sm btn--ghost" data-branch-original>回到原作</button>' +
          '<button class="btn btn--sm rd-rewrite-btn" data-branch-continue="' + last.id + '">继续推演</button>' +
        '</div></footer></section>';
    },

    openRewriteAtEnd: function () {
      var b = OW.Store.book(this.bookId); if (!b) return;
      var idx = b.page || 0, ch = (b.chapters || [])[idx]; if (!ch) return;
      var active = b.activeBranchId ? OW.Store.branch(b.id, b.activeBranchId) : null;
      OW.App.openRewrite({ bookId: b.id, chapterIndex: idx,
        paragraphIndex: Math.max(ch.paras.length - 1, 0), sourceType: active ? 'branch' : 'chapter_end',
        quote: active ? (active.content || '').slice(-160) : (ch.paras[ch.paras.length - 1] || ch.title),
        parentId: active ? active.id : null });
    },

    /** 把某段的铭文标记套进正文。同段多条按起点排序，互不重叠。 */
    markup: function (b, ch, para, text) {
      var list = b.inscriptions.filter(function (i) {
        return i.ch === ch && i.para === para;
      }).sort(function (a, c) { return a.s - c.s; });

      if (!list.length) return SVG.esc(text);

      var out = '', cur = 0;
      list.forEach(function (i) {
        if (i.s < cur) return;                     // 防御：重叠的直接跳过，不做重叠批注
        out += SVG.esc(text.slice(cur, i.s));
        var k = OW.kindOf(i.kind);
        out += '<span class="ins ins-' + i.kind + '" data-id="' + i.id +
               '" data-ico="' + k.ico + '" tabindex="0" role="button" ' +
               'aria-label="' + k.name + '铭文：' + SVG.esc(i.body.slice(0, 30)) + '" ' +
               'title="' + k.name + '（' + k.gloss + '）">' +
               SVG.esc(text.slice(i.s, i.e)) + '</span>';
        cur = i.e;
      });
      out += SVG.esc(text.slice(cur));
      return out;
    },

    /* ---------- 翻页：稳定切换，不做翻卷 ---------- */
    turn: function (d) {
      var b = OW.Store.book(this.bookId); if (!b) return;
      this.goto((b.page || 0) + d);
    },
    goto: function (i) {
      var b = OW.Store.book(this.bookId); if (!b) return;
      var chs = b.chapters || [];
      if (i < 0 || i >= chs.length) return;
      this.stopTts();
      b.page = i;
      OW.Store.commit();
      var pg = D.getElementById('rdPage');
      pg.classList.remove('is-turning');
      void pg.offsetWidth;
      pg.classList.add('is-turning');
      this.render();
      D.getElementById('rdPageInner').scrollTop = 0;
    },

    /* ---------- 搜索 ---------- */
    search: function (q) {
      var box = D.getElementById('rdHits');
      var b = OW.Store.book(this.bookId);
      q = (q || '').trim();
      if (!q) { box.innerHTML = ''; return; }

      var hits = [];
      (b.chapters || []).forEach(function (c, ci) {
        c.paras.forEach(function (t, pi) {
          var at = t.indexOf(q);
          while (at > -1 && hits.length < 40) {
            hits.push({ ch: ci, para: pi, at: at, text: t, title: c.title });
            at = t.indexOf(q, at + q.length);
          }
        });
      });

      if (!hits.length) {
        box.innerHTML = '<div class="empty">' + SVG.icon('search', 36) +
          '<div>' + OW.COPY.noHit + '</div></div>';
        return;
      }
      box.innerHTML = hits.map(function (h) {
        var s = Math.max(0, h.at - 14), e = Math.min(h.text.length, h.at + q.length + 20);
        return '<button class="search-hit" data-ch="' + h.ch + '">' +
          '<span class="loc">第 ' + (h.ch + 1) + ' 节 · ' + SVG.esc(h.title) + '</span>' +
          (s > 0 ? '…' : '') + SVG.esc(h.text.slice(s, h.at)) +
          '<mark>' + SVG.esc(q) + '</mark>' +
          SVG.esc(h.text.slice(h.at + q.length, e)) + (e < h.text.length ? '…' : '') +
          '</button>';
      }).join('');
      // 点击由 renderSide 里挂在 #rdHits 上的委托处理，这里不再重复绑定
    },

    /* ---------- 书签 ---------- */
    addBookmark: function () {
      var b = OW.Store.book(this.bookId); if (!b) return;
      var idx = b.page || 0, ch = (b.chapters || [])[idx];
      if (!ch) return;
      b.bookmarks = b.bookmarks || [];
      var dup = b.bookmarks.some(function (m) { return m.ch === idx; });
      if (dup) {
        b.bookmarks = b.bookmarks.filter(function (m) { return m.ch !== idx; });
        OW.Store.commit(); this.render();
        return OW.toast('已取消这一节的书签。');
      }
      b.bookmarks.push({ ch: idx, para: 0, text: ch.paras[0] || ch.title, at: Date.now() });
      OW.Store.commit(); this.render();
      OW.toast('已为「' + ch.title + '」加上书签。');
    },

    /* ---------- 朗读（§5.3：开始/暂停/继续/停止）---------- */
    tts: function (act) {
      var sp = w.speechSynthesis;
      if (!sp || typeof w.SpeechSynthesisUtterance !== 'function') {
        return OW.toast(OW.COPY.ttsNo, 'warn');
      }
      var box = D.getElementById('rdTts');
      var b = OW.Store.book(this.bookId);
      var ch = (b.chapters || [])[b.page || 0];
      if (act === 'play') {
        if (!ch) return;
        sp.cancel();
        var u = new w.SpeechSynthesisUtterance(ch.paras.join('。\n'));
        var voices = sp.getVoices ? sp.getVoices() : [];
        var zh = voices.filter(function (voice) { return /^zh/i.test(voice.lang || ''); });
        var preferred = [/xiaoyi/i, /xiaoxiao/i, /yaoyao/i, /huihui/i, /晓伊|晓晓|瑶瑶|慧慧/];
        var picked = null;
        for (var p = 0; p < preferred.length && !picked; p++) {
          picked = zh.find(function (voice) { return preferred[p].test(voice.name || ''); }) || null;
        }
        picked = picked || zh[0] || null;
        if (picked) { u.voice = picked; u.lang = picked.lang || 'zh-CN'; }
        else u.lang = 'zh-CN';
        // 优先使用系统中文女声，语速略慢、音调轻柔，适合连续阅读。
        u.rate = 0.94; u.pitch = 1.05; u.volume = 1;
        var voiceLabel = D.getElementById('rdTtsVoice');
        if (voiceLabel) voiceLabel.textContent = picked
          ? '温柔女声 · ' + (picked.name || '系统中文女声')
          : '温柔女声 · 系统中文音色';
        u.onend = function () { if (box) box.classList.remove('is-on'); };
        sp.speak(u);
        if (box) box.classList.add('is-on');
      } else if (act === 'pause') { sp.pause(); if (box) box.classList.remove('is-on'); }
      else if (act === 'resume') { sp.resume(); if (box) box.classList.add('is-on'); }
      else { sp.cancel(); if (box) box.classList.remove('is-on'); }
    },
    stopTts: function () {
      try { if (w.speechSynthesis) w.speechSynthesis.cancel(); } catch (e) {}
      var box = D.getElementById('rdTts'); if (box) box.classList.remove('is-on');
    },

    /* ==================================================================
       选区 → 铭文（§5.4）
       跨段落：提示「初赛版暂不支持跨段批注」，不崩溃
       同段已有标记：提示重新选择
       ================================================================== */
    onSelect: function () {
      var sel = w.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return this.hidePop();
      var range = sel.getRangeAt(0);
      var txt = String(sel.toString()).replace(/\n/g, '').trim();
      if (!txt) return this.hidePop();

      var pa = closestP(range.startContainer);
      var pb = closestP(range.endContainer);
      if (!pa || !pb) return this.hidePop();

      // 跨段落：友好提示，不崩溃（§5.4）
      if (pa !== pb) {
        this.hidePop();
        sel.removeAllRanges();
        return OW.toast(OW.COPY.crossPara, 'warn');
      }
      // 选到已有标记上：提示重新选择
      if (range.cloneContents().querySelector('.ins') ||
          closestIns(range.startContainer) || closestIns(range.endContainer)) {
        this.hidePop();
        sel.removeAllRanges();
        return OW.toast(OW.COPY.overlap, 'warn');
      }

      var b = OW.Store.book(this.bookId);
      var ch = b.page || 0, para = parseInt(pa.getAttribute('data-p'), 10);
      var full = (b.chapters[ch] || {}).paras[para] || '';
      var s = offsetInP(pa, range.startContainer, range.startOffset);
      if (s < 0) return this.hidePop();
      // 用选中文本回校一次，避免转义与标记导致的偏移
      var probe = full.indexOf(txt, Math.max(0, s - 4));
      if (probe > -1) s = probe; else { probe = full.indexOf(txt); if (probe > -1) s = probe; }
      var e = s + txt.length;
      if (full.slice(s, e) !== txt) return this.hidePop();

      // 与已有铭文重叠也拦住（防御两处：DOM 和区间）
      var clash = b.inscriptions.some(function (i) {
        return i.ch === ch && i.para === para && s < i.e && e > i.s;
      });
      if (clash) {
        this.hidePop(); sel.removeAllRanges();
        return OW.toast(OW.COPY.overlap, 'warn');
      }

      this.sel = { ch: ch, para: para, s: s, e: e, quote: txt };
      this.showPop(range);
    },

    showPop: function (range) {
      var pop = D.getElementById('rdPop');
      var self = this;
      pop.innerHTML = OW.KINDS.map(function (k) {
        return '<button data-k="' + k.id + '" title="' + k.name + '：' + k.gloss + '">' +
          '<i class="sw" style="background:' + k.color + '"></i>' + k.name + '</button>';
      }).join('') + '<span class="sel-divider"></span><button class="sel-rewrite" data-rewrite>' +
        SVG.icon('star', 13) + ' 从这里改写</button>';
      pop.classList.add('is-on');

      var r = range.getBoundingClientRect();
      var pw = pop.offsetWidth || 300, ph = pop.offsetHeight || 40;
      var x = Math.min(Math.max(r.left + r.width / 2 - pw / 2, 12), w.innerWidth - pw - 12);
      var y = r.top - ph - 10;
      if (y < 12) y = r.bottom + 10;
      pop.style.left = Math.round(x) + 'px';
      pop.style.top = Math.round(y) + 'px';

      pop.onclick = function (e) {
        var rw = e.target.closest('[data-rewrite]');
        if (rw && self.sel) {
          var pick = self.sel;
          self.hidePop();
          var selection = w.getSelection(); if (selection) selection.removeAllRanges();
          return OW.App.openRewrite({ bookId: self.bookId, chapterIndex: pick.ch,
            paragraphIndex: pick.para, sourceType: 'selection', quote: pick.quote });
        }
        var b = e.target.closest('button[data-k]');
        if (!b) return;
        self.openEditor('new', { kind: b.getAttribute('data-k') });
      };
    },
    hidePop: function () {
      var pop = D.getElementById('rdPop');
      if (pop) pop.classList.remove('is-on');
    },

    /* ---------- 右侧铭文面板 ---------- */
    renderAside: function (b) {
      var aside = D.getElementById('rdAside');
      if (!this.asideOn) { aside.innerHTML = ''; return; }
      var self = this, pr = OW.Store.progress(b.id);

      var list = b.inscriptions.slice().sort(function (a, c) { return c.at - a.at; });
      if (this.filter !== 'all') {
        list = list.filter(function (i) { return i.kind === self.filter; });
      }
      var selected = this.selectedIns ? find(b, this.selectedIns) : null;
      if (selected && !list.some(function (i) { return i.id === selected.id; })) {
        selected = null;
        this.selectedIns = null;
      }

      aside.innerHTML =
        '<div class="ins-head">' +
          '<div class="row">' +
            '<h3><span class="term" data-gloss="铭文：你留在原文旁的回应，不会改动原文">铭文</span>' +
              '　<span class="t-low" style="font-size:13px">你留在原文旁的回应</span></h3>' +
            '<button class="btn btn--icon" id="rdAsideX" aria-label="收起铭文面板">' +
              SVG.icon('close', 16) + '</button>' +
          '</div>' +
          '<div class="sub">共 ' + b.inscriptions.length + ' 枚 · 四类已点亮 ' + pr.lit +
            '/4 · 在正文中选一句话即可写下新的一枚</div>' +
        '</div>' +
        '<div class="ins-filter" id="rdFilter">' +
          '<button class="chip" data-f="all" aria-pressed="' + (this.filter === 'all') + '">全部</button>' +
          OW.KINDS.map(function (k) {
            return '<button class="chip" data-f="' + k.id + '" aria-pressed="' +
              (self.filter === k.id) + '" title="' + k.gloss + '">' +
              '<i class="sw" style="background:' + k.color + '"></i>' + k.name +
              ' ' + (pr.kinds[k.id] || 0) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="ins-gallery' + (selected ? ' has-feature' : '') + '" id="rdInsList">' +
          (list.length ?
            '<section class="ins-feature" aria-live="polite">' +
              (selected ? self.cardHtml(b, selected, 'featured') :
                '<div class="ins-feature-empty">' +
                  '<span class="ins-feature-sigil">' + SVG.icon('ins', 32) + '</span>' +
                  '<strong>从牌组中抽出一枚铭文</strong>' +
                  '<span>将鼠标移到下方牌组展开，点击卡片即可完整查看。</span>' +
                '</div>') +
            '</section>' +
            '<section class="ins-deck-shell" aria-label="铭文牌组，共 ' + list.length + ' 枚">' +
              '<div class="ins-deck" data-count="' + list.length + '">' +
                list.map(function (i, index) {
                  return self.cardHtml(b, i, 'deck', index, list.length);
                }).join('') +
              '</div>' +
              '<div class="ins-deck-hint">悬停展开 · 点击抽取</div>' +
            '</section>' :
            '<div class="empty">' + SVG.icon('ins', 40) + '<div>' +
              (b.inscriptions.length ? '这一类还没有铭文。' : OW.COPY.noIns) +
            '</div></div>') +
        '</div>' +
        '<div class="ins-editor" id="rdEditor"></div>';

      D.getElementById('rdAsideX').addEventListener('click', function () {
        self.asideOn = false; self.panel = self.panel || 'toc'; self.render();
      });
      D.getElementById('rdFilter').addEventListener('click', function (e) {
        var c = e.target.closest('.chip[data-f]');
        if (c) {
          self.filter = c.getAttribute('data-f');
          var picked = self.selectedIns ? find(b, self.selectedIns) : null;
          if (picked && self.filter !== 'all' && picked.kind !== self.filter) self.selectedIns = null;
          self.render();
        }
      });
      D.getElementById('rdInsList').addEventListener('click', function (e) {
        var card = e.target.closest('.icard'); if (!card) return;
        var id = card.getAttribute('data-id');
        if (e.target.closest('[data-collapse]')) {
          self.selectedIns = null;
          self.renderAside(b);
        } else if (e.target.closest('[data-edit]')) {
          var ins = find(b, id);
          if (ins) self.openEditor('edit', ins);
        } else if (e.target.closest('[data-del]')) {
          self.delIns(id);
        } else if (e.target.closest('[data-develop]')) {
          var cont = find(b, id);
          if (cont) OW.App.openRewrite({ bookId: b.id, chapterIndex: cont.ch,
            paragraphIndex: cont.para, sourceType: 'inscription', quote: cont.quote,
            inscriptionId: cont.id, intent: cont.body, tendencies: ['角色选择'] });
        } else {
          self.selectedIns = self.selectedIns === id ? null : id;
          self.renderAside(b);
          self.focusIns(id);
        }
      });
      D.getElementById('rdInsList').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var card = e.target.closest('.icard--deck'); if (!card) return;
        e.preventDefault();
        card.click();
      });

      if (this.editing) this.paintEditor();
    },

    cardHtml: function (b, i, mode, index, total) {
      var k = OW.kindOf(i.kind);
      var tarot = {
        echo:  { n: 'I', en: 'Echo' },
        query: { n: 'II', en: 'Query' },
        link:  { n: 'III', en: 'Star-Link' },
        cont:  { n: 'IV', en: 'Coda' }
      }[i.kind] || { n: '·', en: k.en || '' };
      if (mode === 'deck') {
        var middle = (total - 1) / 2;
        var offset = index - middle;
        var restAngleStep = total > 1 ? Math.min(7, 24 / (total - 1)) : 0;
        var openAngleStep = total > 1 ? Math.min(11.5, 34 / (total - 1)) : 0;
        var restXStep = total > 1 ? Math.min(17, 64 / (total - 1)) : 0;
        var openXStep = total > 1 ? Math.min(21, 68 / (total - 1)) : 0;
        var restY = Math.abs(offset) * 4;
        var openY = Math.abs(offset) * 7 - 13;
        var deckStyle = '--c:' + k.color +
          ';--rest-x:' + (offset * restXStep).toFixed(1) + 'px' +
          ';--rest-y:' + restY.toFixed(1) + 'px' +
          ';--rest-r:' + (offset * restAngleStep).toFixed(1) + 'deg' +
          ';--open-x:' + (offset * openXStep).toFixed(1) + 'px' +
          ';--open-y:' + openY.toFixed(1) + 'px' +
          ';--open-r:' + (offset * openAngleStep).toFixed(1) + 'deg' +
          ';--hover-x:' + (offset === 0 ? 0 : (offset < 0 ? 10 : -10)).toFixed(1) + 'px' +
          ';--hover-r:' + (offset * openAngleStep * 0.78).toFixed(1) + 'deg' +
          ';--z:' + (index + 1);
        return '<article class="icard tarot icard--deck' +
          (this.selectedIns === i.id ? ' is-selected' : '') + '" data-id="' + i.id +
          '" tabindex="0" role="button" aria-label="抽出' + k.name + '铭文：' +
          SVG.esc(i.body.slice(0, 28)) + '" style="' + deckStyle + '">' +
            '<i class="tc tl"></i><i class="tc tr"></i><i class="tc bl"></i><i class="tc br"></i>' +
            '<div class="t-hd">' +
              '<span class="t-num">' + tarot.n + '</span>' +
              '<span class="t-nm">' + k.name + '</span>' +
              '<span class="t-when">第 ' + (i.ch + 1) + ' 节</span>' +
              '<span class="t-en">' + tarot.en + '</span>' +
            '</div>' +
            '<div class="t-emblem">' + SVG.tarotIcon(k.id, 72) + '</div>' +
            '<div class="quote">「' + SVG.esc(i.quote) + '」</div>' +
            '<div class="body">' + SVG.esc(i.body) + '</div>' +
          '</article>';
      }

      return '<article class="icard tarot icard--featured" data-id="' + i.id +
        '" style="--c:' + k.color + '">' +
        '<button class="feature-collapse" data-collapse aria-label="把这枚铭文放回牌组" ' +
          'title="放回牌组">' + SVG.icon('close', 14) + '</button>' +
        '<i class="tc tl"></i><i class="tc tr"></i><i class="tc bl"></i><i class="tc br"></i>' +
        '<div class="t-hd">' +
          '<span class="t-num">' + tarot.n + '</span>' +
          '<span class="t-nm">' + k.name + '</span>' +
          '<span class="t-when">第 ' + (i.ch + 1) + ' 节</span>' +
          '<span class="t-en">' + tarot.en + '</span>' +
        '</div>' +
        '<div class="t-emblem">' + SVG.tarotIcon(k.id, 92) + '</div>' +
        '<div class="quote">「' + SVG.esc(i.quote) + '」</div>' +
        '<div class="body">' + SVG.esc(i.body) + '</div>' +
        '<div class="acts">' +
          (i.kind === 'cont' ? '<button class="btn btn--sm rd-rewrite-btn" data-develop>' +
            SVG.icon('star', 13) + ' 发展为剧情</button>' : '') +
          '<button class="btn btn--sm btn--ghost" data-edit>' + SVG.icon('edit', 13) + ' 编辑</button>' +
          '<button class="btn btn--sm btn--ghost btn--danger" data-del>' +
            SVG.icon('trash', 13) + ' 删除</button>' +
        '</div>' +
      '</article>';
    },

    /** 点标记 / 点卡片 → 互相定位 */
    focusIns: function (id) {
      var b = OW.Store.book(this.bookId);
      var ins = find(b, id); if (!ins) return;
      if ((b.page || 0) !== ins.ch) { this.goto(ins.ch); }
      if (!this.asideOn) { this.asideOn = true; this.panel = null; this.render(); }

      var mark = D.querySelector('.ins[data-id="' + id + '"]');
      var card = D.querySelector('.icard--featured[data-id="' + id + '"]') ||
        D.querySelector('.icard[data-id="' + id + '"]');
      var all = D.querySelectorAll('.ins.is-focus');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('is-focus');
      if (mark) {
        mark.classList.add('is-focus');
        mark.scrollIntoView({ block: 'center', behavior: OW.reduced() ? 'auto' : 'smooth' });
      }
      if (card) {
        card.scrollIntoView({ block: 'nearest', behavior: OW.reduced() ? 'auto' : 'smooth' });
        card.classList.remove('is-pulse');
        void card.offsetWidth;
        card.classList.add('is-pulse');
        w.setTimeout(function () { card.classList.remove('is-pulse'); }, 1200);
      }
    },

    /* ---------- 编辑器 ---------- */
    openEditor: function (mode, data) {
      if (mode === 'new') {
        if (!this.sel) return;
        this.editing = {
          mode: 'new', kind: data.kind,
          ch: this.sel.ch, para: this.sel.para, s: this.sel.s, e: this.sel.e,
          quote: this.sel.quote, body: ''
        };
      } else {
        this.editing = {
          mode: 'edit', id: data.id, kind: data.kind,
          ch: data.ch, para: data.para, s: data.s, e: data.e,
          quote: data.quote, body: data.body
        };
      }
      this.hidePop();
      var sel = w.getSelection(); if (sel) sel.removeAllRanges();
      if (!this.asideOn) { this.asideOn = true; this.panel = null; }
      this.render();
      var t = D.getElementById('rdBody'); if (t) t.focus();
    },

    paintEditor: function () {
      var ed = D.getElementById('rdEditor'), E = this.editing;
      if (!ed || !E) return;
      var self = this;
      ed.classList.add('is-on');
      ed.innerHTML =
        '<div class="quoted">「' + SVG.esc(E.quote) + '」</div>' +
        '<div class="kind-pick" id="rdKind">' +
          OW.KINDS.map(function (k) {
            return '<button data-k="' + k.id + '" style="--c:' + k.color + '" ' +
              'aria-pressed="' + (E.kind === k.id) + '" title="' + k.gloss + '">' +
              SVG.kindIcon(k.id, 17) + '<span>' + k.name + '</span>' +
              '<span class="gl">' + k.line + '</span></button>';
          }).join('') +
        '</div>' +
        '<textarea class="textarea" id="rdBody" rows="4" ' +
          'placeholder="写下你的回应。原文不会被改动。">' + SVG.esc(E.body) + '</textarea>' +
        '<div class="row">' +
          '<span class="cnt" id="rdBodyN"></span><span class="grow"></span>' +
          '<button class="btn btn--sm btn--ghost" id="rdCancel">取消</button>' +
          '<button class="btn btn--sm btn--primary" id="rdSave">' +
            (E.mode === 'edit' ? '保存修改' : '落下这一枚') + '</button>' +
        '</div>';

      var ta = D.getElementById('rdBody'), n = D.getElementById('rdBodyN');
      function cnt() { n.textContent = ta.value.replace(/\s/g, '').length + ' 字'; }
      cnt(); ta.addEventListener('input', cnt);

      D.getElementById('rdKind').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-k]'); if (!b) return;
        E.kind = b.getAttribute('data-k');
        var all = this.querySelectorAll('button[data-k]');
        for (var i = 0; i < all.length; i++) {
          all[i].setAttribute('aria-pressed', all[i] === b ? 'true' : 'false');
        }
      });
      D.getElementById('rdCancel').addEventListener('click', function () { self.closeEditor(); });
      D.getElementById('rdSave').addEventListener('click', function () {
        E.body = ta.value.trim();
        if (!E.body) { ta.focus(); return OW.toast('先写下一句你的回应，再落下这一枚铭文。', 'warn'); }
        self.saveIns();
      });
      ta.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') D.getElementById('rdSave').click();
      });
    },

    closeEditor: function () {
      this.editing = null; this.sel = null;
      var ed = D.getElementById('rdEditor');
      if (ed) { ed.classList.remove('is-on'); ed.innerHTML = ''; }
    },

    saveIns: function () {
      var E = this.editing, b = OW.Store.book(this.bookId);
      if (!E || !b) return;
      var firstEver = b.inscriptions.length === 0 && !b.firstInsDone;

      if (E.mode === 'edit') {
        OW.Store.updateIns(b.id, E.id, { kind: E.kind, body: E.body });
        this.closeEditor(); this.render();
        return OW.toast('铭文已更新。');
      }

      OW.Store.addIns(b.id, {
        ch: E.ch, para: E.para, s: E.s, e: E.e, quote: E.quote, kind: E.kind, body: E.body
      });
      var k = OW.kindOf(E.kind);
      this.closeEditor();
      this.render();

      /* 第一枚铭文：每本书首次保存触发一次约 2 秒轻量仪式（§5.5），
         刷新后不重复 —— 靠 firstInsDone 持久化 */
      if (firstEver) {
        b.firstInsDone = true;
        OW.Store.commit();
        this.firstRite();
      } else {
        OW.toast('已落下一枚「' + k.name + '」。');
      }
    },

    delIns: function (id) {
      var self = this, b = OW.Store.book(this.bookId);
      var ins = find(b, id); if (!ins) return;
      var k = OW.kindOf(ins.kind);
      OW.confirm({
        title: '删除这枚「' + k.name + '」？',
        body: '「' + ins.quote.slice(0, 24) + '」上的这条批注会被移除，原文不受影响。',
        ok: '确认删除', danger: true,
        onOk: function () {
          OW.Store.removeIns(b.id, id);
          if (self.selectedIns === id) self.selectedIns = null;
          self.render();
          OW.toast('铭文已删除。');
        }
      });
    },

    /* ---------- 第一枚铭文仪式：约 2 秒，文案固定 ---------- */
    firstRite: function () {
      var v = D.createElement('div');
      v.className = 'rite';
      v.innerHTML =
        '<div class="rite-in">' +
          '<div class="rite-sig">' + SVG.sigil({ echo: 1 }, 128) + '</div>' +
          '<div class="rite-tx">' + OW.COPY.firstIns + '</div>' +
        '</div>';
      D.body.appendChild(v);
      var ms = OW.reduced() ? 900 : 2000;
      w.setTimeout(function () {
        v.classList.add('is-out');
        w.setTimeout(function () { v.remove(); }, 320);
      }, ms);
    }
  };

  /* ---------- 小工具 ---------- */
  function closestP(node) {
    while (node && node !== D.body) {
      if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-p')) return node;
      node = node.parentNode;
    }
    return null;
  }
  function closestIns(node) {
    while (node && node !== D.body) {
      if (node.nodeType === 1 && node.classList && node.classList.contains('ins')) return node;
      node = node.parentNode;
    }
    return null;
  }
  /** 段落内的纯文本偏移：把标记 span 里的文本也算进去 */
  function offsetInP(p, node, off) {
    var walker = D.createTreeWalker(p, w.NodeFilter.SHOW_TEXT, null, false);
    var acc = 0, t;
    while ((t = walker.nextNode())) {
      if (t === node) return acc + off;
      acc += t.nodeValue.length;
    }
    return -1;
  }
  function find(b, id) {
    if (!b) return null;
    for (var i = 0; i < b.inscriptions.length; i++) {
      if (b.inscriptions[i].id === id) return b.inscriptions[i];
    }
    return null;
  }

  OW.Rd = Rd;
})(window);
