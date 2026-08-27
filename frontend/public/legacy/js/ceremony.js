/* ==========================================================================
   ceremony.js — 契名仪式 + 个人秘典（§5.5，视觉最高潮）
   五步顺序固定：封面浮现 → 原作者署名 → 用户名金色书写 → 版本编号 → 契印落下。
   §5.5 验收：原作者名字始终保留，不能被用户覆盖或删除。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;
  var SVG;

  /* 五步时间轴：总长约 6.4s，仪式类节奏 800ms–2s */
  var STEP = [
    { at: 340,  lb: '封面浮现',   c1: '一本深色皮革的封面从暗处浮现。',
      c2: '这是你的版本，还没有名字。' },
    { at: 1560, lb: '原作者署名', c1: '原作者的名字先落在封面上。',
      c2: '他起了这个头，这一点不会被改变。' },
    { at: 2860, lb: '金色书写',   c1: '你的名字正在被写下。',
      c2: '一笔一划，和开场那支羽毛笔是同一套笔法。' },
    { at: 4520, lb: '版本编号',   c1: '这一版拿到了它的编号。',
      c2: '世上只有这一本这样批注过的书。' },
    { at: 5480, lb: '契印落下',   c1: '契印落在封面右下角。',
      c2: '四类铭文都在里面，你的版本成立了。' }
  ];

  var Cm = {
    el: null, bookId: null, penName: '', timers: [], running: false,

    mount: function (root) {
      SVG = OW.SVG;
      this.el = root;
      root.innerHTML =
        '<div class="cm" id="cmRoot" data-step="0">' +
          '<div class="cm-aura"></div>' +
          '<div class="cm-stars">' + SVG.sky({ seed: 29, stars: 26 }) + '</div>' +
          '<button class="btn btn--sm btn--ghost cm-quit" id="cmQuit">回到书库</button>' +
          '<div class="cm-steps" id="cmSteps"></div>' +
          '<div class="cm-stage">' +
            '<div class="cm-shock"></div>' +
            '<div class="cover" id="cmCover"></div>' +
            '<div class="cm-cap" id="cmCap"></div>' +
            '<div class="cm-acts" id="cmActs"></div>' +
          '</div>' +
        '</div>';
      D.getElementById('cmQuit').addEventListener('click', function () {
        Cm.stop(); OW.App.go('library');
      });
    },

    /** 进入仪式。penName 只决定「编注」那一行，author 永远来自书本身。 */
    open: function (bookId, penName) {
      this.bookId = bookId;
      var b = OW.Store.book(bookId);
      if (!b) return OW.App.go('library');
      this.penName = penName || OW.Store.get().reader || '读者';

      // 真实写入署名与版本号（发布按钮由演示者真实点击后才走到这里）
      if (!b.signed) {
        OW.Store.sign(bookId, this.penName);
      } else {
        var signedChanged = false;
        if (b.signed.reader !== this.penName) {
          b.signed.reader = this.penName;
          signedChanged = true;
        }
        if ((b.signed.branchId || null) !== (b.finalVersionBranchId || null)) {
          b.signed.branchId = b.finalVersionBranchId || null;
          b.signed.edition = b.finalVersionBranchId ? 'ai-rewrite' : 'annotated-original';
          signedChanged = true;
        }
        if (signedChanged) OW.Store.commit();
      }

      this.paintCover(b);
      this.paintSteps(0);
      D.getElementById('cmActs').innerHTML = '';
      this.run();
    },

    paintCover: function (b) {
      var pr = OW.Store.progress(b.id);
      var lit = {}; OW.KINDS.forEach(function (k) { lit[k.id] = pr.kinds[k.id]; });
      lit.full = true;

      D.getElementById('cmCover').innerHTML =
        '<div class="cover-glow"></div>' +
        '<div class="cover-art">' + SVG.cover(b, { title: false }) + '</div>' +
        '<div class="cover-tx">' +
          '<div class="kicker">Overwriting · Another Choice</div>' +
          '<h2 class="gilt">' + SVG.esc(b.title) + '</h2>' +
          '<div class="orn">' + SVG.ornament() + '</div>' +
          '<div class="sp"></div>' +
          '<div class="cover-author">' +
            '<b>' + SVG.esc(b.author) + '</b> ' +
            '<span class="role">著</span>' +
          '</div>' +
          '<div class="cover-div"></div>' +
          '<div class="cover-sig">' + SVG.signature(this.penName) + '</div>' +
          // 身份标用 HTML 渲染，字号才受令牌控制（§14.7）
          '<div class="cover-role">编注</div>' +
          '<div class="cover-ver">' + OW.Store.versionLabel(b) + '</div>' +
          (b.signed.edition === 'ai-rewrite' ? '<div class="cover-edition">AI 剧情覆写版</div>' : '') +
        '</div>' +
        '<div class="cover-seal">' + SVG.seal(lit) + '</div>';
    },

    paintSteps: function (cur) {
      D.getElementById('cmSteps').innerHTML = STEP.map(function (s, i) {
        return (i ? '<span class="sp"></span>' : '') +
          '<span class="st' + (i < cur ? ' is-on' : '') + '">' +
          '<span class="n">' + (i + 1) + '</span>' +
          '<span class="lb">' + s.lb + '</span></span>';
      }).join('');
    },

    run: function () {
      var self = this, root = D.getElementById('cmRoot');
      this.stop();
      this.running = true;
      root.setAttribute('data-step', '0');

      if (OW.reduced()) {
        // 减少动态效果：直接给终态，保留状态变化（§14.8）
        root.setAttribute('data-step', 'done');
        this.paintSteps(STEP.length);
        this.caption(STEP[STEP.length - 1]);
        this.finish();
        return;
      }

      STEP.forEach(function (s, i) {
        self.timers.push(w.setTimeout(function () {
          root.setAttribute('data-step', String(i + 1));
          self.paintSteps(i + 1);
          self.caption(s);
        }, s.at));
      });
      this.timers.push(w.setTimeout(function () {
        root.setAttribute('data-step', 'done');
        self.finish();
      }, STEP[STEP.length - 1].at + 1400));
    },

    caption: function (s) {
      D.getElementById('cmCap').innerHTML =
        '<div class="ln1">' + s.c1 + '</div><div class="ln2">' + s.c2 + '</div>';
    },

    finish: function () {
      this.running = false;
      var self = this;
      D.getElementById('cmCap').innerHTML =
        '<div class="ln1 t-gold">' + SVG.esc(this.penName) + '，你的名字已经在封面上。</div>' +
        '<div class="ln2">' + SVG.esc(OW.Store.signatureLine(OW.Store.book(this.bookId))) + '</div>';
      D.getElementById('cmActs').innerHTML =
        '<button class="btn btn--primary btn--lg" id="cmOpus">看我的个人秘典</button>' +
        '<button class="btn btn--sm btn--ghost" id="cmAgain">再看一次仪式</button>';
      D.getElementById('cmOpus').addEventListener('click', function () {
        OW.App.openOpus(self.bookId);
      });
      D.getElementById('cmAgain').addEventListener('click', function () {
        self.paintSteps(0);
        D.getElementById('cmActs').innerHTML = '';
        D.getElementById('cmRoot').setAttribute('data-step', '0');
        void D.getElementById('cmRoot').offsetWidth;
        w.setTimeout(function () { self.run(); }, 60);
      });
    },

    stop: function () {
      this.timers.forEach(w.clearTimeout);
      this.timers = [];
      this.running = false;
    }
  };

  /* ==========================================================================
     个人秘典：仪式之后的成品页
     ========================================================================== */
  var Op = {
    el: null, bookId: null,

    mount: function (root) {
      SVG = OW.SVG;
      this.el = root;
      root.innerHTML = '<div class="op" id="opRoot"></div>';
    },

    open: function (bookId) {
      this.bookId = bookId;
      var b = OW.Store.book(bookId);
      if (!b || !b.signed) return OW.App.go('library');
      var pr = OW.Store.progress(b.id);
      var lit = {}; OW.KINDS.forEach(function (k) { lit[k.id] = pr.kinds[k.id]; });
      lit.full = true;

      var when = new Date(b.signed.at);
      var dt = when.getFullYear() + '.' +
        String(when.getMonth() + 1).padStart(2, '0') + '.' +
        String(when.getDate()).padStart(2, '0');

      D.getElementById('opRoot').innerHTML =
        '<header class="op-head">' +
          '<div class="eyebrow">My Codex</div>' +
          '<h2 class="gilt">个人秘典</h2>' +
          '<p>' + SVG.esc(OW.Store.signatureLine(b)) + '</p>' +
        '</header>' +

        '<div class="op-body">' +
          '<div class="op-cover">' +
            '<div class="cover" style="width:100%;opacity:1;transform:none">' +
              '<div class="cover-art">' + SVG.cover(b, { title: false }) + '</div>' +
              '<div class="cover-tx">' +
                '<div class="kicker">Overwriting · Another Choice</div>' +
                '<h2 class="gilt">' + SVG.esc(b.title) + '</h2>' +
                '<div class="orn">' + SVG.ornament() + '</div>' +
                '<div class="sp"></div>' +
                '<div class="cover-author" style="opacity:1;transform:none">' +
                  '<b>' + SVG.esc(b.signed.author) + '</b> <span class="role">著</span>' +
                '</div>' +
                '<div class="cover-div" style="height:22px"></div>' +
                '<div class="cover-sig" style="height:40px">' +
                  '<svg viewBox="0 0 300 40" preserveAspectRatio="xMidYMid meet" role="img" ' +
                    'aria-label="署名 ' + SVG.esc(b.signed.reader) + ' 编注">' +
                    '<text x="150" y="30" text-anchor="middle" ' +
                    'fill="url(#gGoldSig)" font-family="Georgia,serif" font-size="26" ' +
                    'letter-spacing="3">' + SVG.esc(b.signed.reader) + '</text></svg>' +
                '</div>' +
                '<div class="cover-role">编注</div>' +
                '<div class="cover-ver" style="opacity:1">' + OW.Store.versionLabel(b) + '</div>' +
                (b.signed.edition === 'ai-rewrite' ? '<div class="cover-edition">AI 剧情覆写版</div>' : '') +
              '</div>' +
              '<div class="cover-seal" style="opacity:1;transform:none">' +
                SVG.seal(lit) + '</div>' +
            '</div>' +
          '</div>' +

          '<div class="op-side">' +
            '<div style="display:flex;justify-content:center">' + SVG.sigil(lit, 150) + '</div>' +
            '<div class="op-meta">' +
              row('原作者', b.signed.author + ' 著') +
              row('编注者', b.signed.reader + ' 编注') +
              row('版本编号', OW.Store.versionLabel(b)) +
              row('故事路线', b.signed.edition === 'ai-rewrite' ? 'AI 剧情覆写版' : '原作批注版') +
              row('契名日期', dt) +
              row('铭文总数', b.inscriptions.length + ' 枚') +
              row('完整度', pr.pct + '%') +
            '</div>' +
            '<div>' +
              '<div class="t-eyebrow" style="margin-bottom:12px">读者终章</div>' +
              '<div class="op-quote">' + SVG.esc(b.finale) + '</div>' +
            '</div>' +
            '<div class="op-acts">' +
              '<button class="btn btn--primary" id="opLib">回到书库</button>' +
              '<button class="btn" id="opRead">回到这本书</button>' +
              '<button class="btn btn--ghost" id="opRite">再看契名仪式</button>' +
            '</div>' +
            '<div class="t-low" style="font-size:12px;line-height:1.8">' +
              '原作不会被替换。' + (b.signed.edition === 'ai-rewrite' ?
                '本路线由 AI 辅助生成，并由你选择和编辑。' : '') +
              '你的名字与原作者并列留在封面上，刷新后依然在书库里。' +
            '</div>' +
          '</div>' +
        '</div>';

      function row(k, v) {
        return '<div class="op-row"><span class="k">' + k + '</span>' +
          '<span class="v">' + SVG.esc(v) + '</span></div>';
      }

      var self = this;
      D.getElementById('opLib').addEventListener('click', function () { OW.App.go('library'); });
      D.getElementById('opRead').addEventListener('click', function () { OW.App.openBook(self.bookId); });
      D.getElementById('opRite').addEventListener('click', function () {
        OW.App.openCeremony(self.bookId, b.signed.reader);
      });
    }
  };

  OW.Cm = Cm;
  OW.Op = Op;
})(window);
