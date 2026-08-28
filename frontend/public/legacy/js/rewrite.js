/* ==========================================================================
   rewrite.js — AI 剧情覆写工作台（PRD v1.2）
   原作永远保留；只有用户明确采纳的候选才进入当前阅读路线。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;
  var TENDENCIES = [
    ['角色选择', '让角色作出不同选择'],
    ['事件结局', '改变当前事件的结果'],
    ['拯救角色', '让某个角色避开原有命运'],
    ['调查秘密', '追查尚未揭开的秘密'],
    ['人物关系', '改变人物之间的关系'],
    ['新地点', '把故事引向新的地点'],
    ['自定义', '按照我的意图自由推演']
  ];

  var Rw = {
    el: null,
    bookId: null,
    ctx: null,
    form: null,
    candidate: null,
    loading: false,
    error: '',
    controller: null,

    mount: function (root) {
      this.el = root;
    },

    open: function (ctx) {
      ctx = ctx || {};
      var b = OW.Store.book(ctx.bookId);
      if (!b) return OW.App.go('library');
      var ch = Math.max(0, Math.min(ctx.chapterIndex == null ? (b.page || 0) : ctx.chapterIndex,
        Math.max((b.chapters || []).length - 1, 0)));
      var chapter = (b.chapters || [])[ch] || { title: '', paras: [] };
      this.bookId = b.id;
      this.ctx = {
        chapterIndex: ch,
        paragraphIndex: ctx.paragraphIndex == null ? Math.max(chapter.paras.length - 1, 0) : ctx.paragraphIndex,
        sourceType: ctx.sourceType || 'chapter_end',
        quote: ctx.quote || chapter.paras[chapter.paras.length - 1] || chapter.title,
        parentId: ctx.parentId || b.activeBranchId || null,
        inscriptionId: ctx.inscriptionId || null
      };
      this.form = {
        intent: ctx.intent || '',
        tendencies: ctx.tendencies || ['角色选择'],
        intensity: ctx.intensity || 'medium',
        mustPreserve: ctx.mustPreserve || ''
      };
      this.candidate = null;
      this.loading = false;
      this.error = '';
      this.render();
    },

    /** 从阅读器的分支面板重新打开一个已保存候选，继续编辑或采纳。 */
    openSaved: function (bookId, branchId) {
      var branch = OW.Store.branch(bookId, branchId);
      if (!branch) return;
      this.open({
        bookId: bookId,
        chapterIndex: branch.chapterIndex || 0,
        paragraphIndex: branch.paragraphIndex || 0,
        sourceType: branch.sourceType || 'chapter_end',
        quote: branch.quote || '',
        parentId: branch.parentId || null,
        intent: branch.intent || '',
        tendencies: branch.tendencies || ['角色选择'],
        intensity: branch.intensity || 'medium',
        mustPreserve: branch.mustPreserve || ''
      });
      this.candidate = branch;
      this.render();
    },

    render: function () {
      var self = this, b = OW.Store.book(this.bookId);
      if (!b || !this.el) return;
      var chapter = (b.chapters || [])[this.ctx.chapterIndex] || { title: '', paras: [] };
      var parent = this.ctx.parentId ? OW.Store.branch(b.id, this.ctx.parentId) : null;
      var accepted = (b.branches || []).filter(function (x) { return x.status === 'accepted'; });
      var candidates = (b.branches || []).filter(function (x) { return x.status !== 'accepted'; });
      var sourceLabel = {
        selection: '从选中的原文开始', chapter_end: '从本节结尾开始',
        inscription: '从「续章」铭文发展', branch: '沿已采纳分支继续'
      }[this.ctx.sourceType] || '从当前情节开始';

      this.el.innerHTML =
        '<div class="rw">' +
          '<header class="rw-bar">' +
            '<button class="btn btn--icon" id="rwBack" aria-label="返回阅读器">' + OW.SVG.icon('back') + '</button>' +
            '<div class="rw-brand"><span class="t-eyebrow">Parallel Story Workshop</span>' +
              '<h1>AI 剧情覆写</h1></div>' +
            '<div class="rw-truth"><span class="rw-truth-dot"></span>原作始终保留</div>' +
          '</header>' +
          '<main class="rw-grid">' +
            '<aside class="rw-source panel">' +
              '<div class="rw-panel-head"><span class="step">01</span><div><h2>选择岔路</h2>' +
                '<p>确认从哪里改变故事。</p></div></div>' +
              '<div class="rw-book"><span>《' + OW.SVG.esc(b.title) + '》</span><small>' +
                OW.SVG.esc(chapter.title) + '</small></div>' +
              '<div class="rw-source-label">' + sourceLabel + '</div>' +
              '<blockquote>“' + OW.SVG.esc(this.ctx.quote) + '”</blockquote>' +
              (parent ? '<div class="rw-parent"><span>承接分支</span><strong>' +
                OW.SVG.esc(parent.title) + '</strong></div>' : '') +
              '<div class="rw-route-head"><span>路线书签</span><button class="btn btn--sm btn--ghost" id="rwOriginal">返回原作</button></div>' +
              '<div class="rw-routes">' +
                this.routeHtml(accepted, candidates) +
              '</div>' +
            '</aside>' +
            '<section class="rw-intent panel">' +
              '<div class="rw-panel-head"><span class="step">02</span><div><h2>说出你的选择</h2>' +
                '<p>AI 负责推演，你负责决定。</p></div></div>' +
              '<form id="rwForm">' +
                '<label class="rw-field"><span>我希望接下来…… <em id="rwIntentN">0 / 300</em></span>' +
                  '<textarea class="textarea" id="rwIntent" maxlength="300" rows="5" ' +
                    'placeholder="例如：伊兰不要把书合上，而是追问第七盏灯为何从不缺油。">' +
                    OW.SVG.esc(this.form.intent) + '</textarea></label>' +
                '<fieldset class="rw-field"><legend>改编倾向（至少选择一项）</legend>' +
                  '<div class="rw-chips" id="rwTendencies">' + TENDENCIES.map(function (t) {
                    var on = self.form.tendencies.indexOf(t[0]) > -1;
                    return '<button type="button" class="chip" data-v="' + t[0] + '" aria-pressed="' + on +
                      '" title="' + t[1] + '">' + t[0] + '</button>';
                  }).join('') + '</div></fieldset>' +
                '<fieldset class="rw-field"><legend>改变幅度</legend>' +
                  '<div class="rw-strength" id="rwStrength">' +
                    strength('light', '轻微', '保留大部分走向', this.form.intensity) +
                    strength('medium', '中等', '改变关键选择', this.form.intensity) +
                    strength('strong', '强烈', '开启全新路线', this.form.intensity) +
                  '</div></fieldset>' +
                '<label class="rw-field"><span>必须保留（可选）</span>' +
                  '<input class="input" id="rwKeep" maxlength="300" placeholder="人物性格、线索或一句关键台词" value="' +
                    OW.SVG.esc(this.form.mustPreserve) + '"></label>' +
                '<button class="btn btn--primary btn--lg btn--block rw-generate" id="rwGenerate" type="submit"' +
                  (this.loading ? ' disabled' : '') + '>' + OW.SVG.icon('star', 18) +
                  (this.loading ? ' 正在推演…' : ' 推演新的可能') + '</button>' +
              '</form>' +
            '</section>' +
            '<section class="rw-result panel" aria-live="polite">' + this.resultHtml() + '</section>' +
          '</main>' +
        '</div>';
      this.wire();
    },

    routeHtml: function (accepted, candidates) {
      if (!accepted.length && !candidates.length) {
        return '<div class="rw-empty-route">还没有分支。第一次推演会从这里长出新的路线。</div>';
      }
      var html = '';
      accepted.forEach(function (x, i) { html += routeCard(x, '已采纳', i + 1); });
      candidates.forEach(function (x, i) { html += routeCard(x, '候选', accepted.length + i + 1); });
      return html;
    },

    resultHtml: function () {
      var c = this.candidate;
      if (this.loading) {
        return '<div class="rw-loading"><div class="rw-orbit" aria-hidden="true"><i></i><i></i><i></i></div>' +
          '<h2>正在推演新的可能……</h2><p>AI 正在沿着你的选择重排人物、线索与后果。</p>' +
          '<button class="btn btn--sm" id="rwCancel">取消推演</button></div>';
      }
      if (this.error) {
        return '<div class="rw-state rw-state--error">' + OW.SVG.icon('warn', 34) +
          '<h2>这次推演没有完成</h2><p>' + OW.SVG.esc(this.error) + '</p>' +
          '<button class="btn btn--primary" id="rwRetry">重新推演</button></div>';
      }
      if (!c) {
        return '<div class="rw-state">' + OW.SVG.sigil({}, 92) +
          '<h2>另一种可能尚未显形</h2><p>填写左侧意图后开始推演。生成内容不会自动写入你的版本，' +
          '只有点击“采纳为分支”才会保存为当前路线。</p></div>';
      }
      var meta = (c.keyChanges || c.key_changes || []).map(function (x) { return '<li>' + OW.SVG.esc(x) + '</li>'; }).join('');
      var dirs = (c.nextDirections || c.next_directions || []).map(function (x) { return '<li>' + OW.SVG.esc(x) + '</li>'; }).join('');
      var conflicts = (c.conflicts || []).map(function (x) { return '<li>' + OW.SVG.esc(x) + '</li>'; }).join('');
      var lead = ((c.content || '').match(/[\u3400-\u9fffA-Za-z0-9]/) || ['✦'])[0];
      return '<article class="rw-page">' +
        '<div class="rw-page-corner rw-page-corner--tl" aria-hidden="true"></div>' +
        '<div class="rw-page-corner rw-page-corner--br" aria-hidden="true"></div>' +
        '<header class="rw-result-head"><div><span class="t-eyebrow">改编稿页 · Generated Branch</span>' +
          '<input class="rw-title-input" id="rwTitle" maxlength="60" value="' + OW.SVG.esc(c.title) + '"></div>' +
          ((c.isDemo || c.is_demo) ? '' : '<span class="tag">' + OW.SVG.esc(c.model || 'AI') + '</span>') + '</header>' +
        '<div class="rw-page-rule" aria-hidden="true"><i></i></div>' +
        '<div class="rw-page-story"><span class="rw-dropcap" id="rwDropCap" aria-hidden="true">' +
          OW.SVG.esc(lead) + '</span><textarea class="textarea rw-story" id="rwStory" ' +
          'aria-label="可编辑的改编正文">' + OW.SVG.esc(c.content) + '</textarea></div>' +
        '<footer class="rw-page-foot"><span>' + ((c.isDemo || c.is_demo) ?
          '预置 AI 输出，用于流程展示' : 'AI 辅助推演') + '</span><i></i>' +
          '<span>内容由你审阅与定稿</span></footer>' +
        '</article>' +
        '<div class="rw-result-meta"><details open><summary>关键变化</summary><ul>' + meta + '</ul></details>' +
          '<details><summary>下一步可选方向</summary><ol>' + dirs + '</ol></details>' +
          '<details><summary>与原作的差异和风险</summary><p>' + OW.SVG.esc(c.difference || '') +
            '</p>' + (conflicts ? '<ul>' + conflicts + '</ul>' : '') + '</details></div>' +
        '<div class="rw-result-actions">' +
          '<button class="btn btn--sm btn--ghost" id="rwDiscard">放弃这次结果</button>' +
          '<button class="btn btn--sm" id="rwAgain">重新推演</button>' +
          '<button class="btn btn--sm" id="rwKeepCandidate">保留为候选</button>' +
          '<button class="btn btn--primary" id="rwAccept">采纳为分支</button>' +
        '</div>' + (c.status === 'accepted' ?
          '<div class="rw-accepted"><strong>这条路线已被你采纳。</strong><div>' +
            '<button class="btn btn--sm" id="rwContinue">沿此分支继续推演</button>' +
            '<button class="btn btn--sm btn--primary" id="rwRead">阅读这条分支</button>' +
          '</div></div>' : '');
    },

    wire: function () {
      var self = this, b = OW.Store.book(this.bookId);
      D.getElementById('rwBack').addEventListener('click', function () { OW.App.openBook(self.bookId); });
      D.getElementById('rwOriginal').addEventListener('click', function () {
        OW.Store.setActiveBranch(self.bookId, null);
        OW.toast('已回到原作路线，AI 分支仍保留在路线书签中。');
        OW.App.openBook(self.bookId);
      });
      var form = D.getElementById('rwForm');
      if (form) {
        var intent = D.getElementById('rwIntent'), n = D.getElementById('rwIntentN');
        function count() { self.form.intent = intent.value; n.textContent = intent.value.length + ' / 300'; }
        count(); intent.addEventListener('input', count);
        D.getElementById('rwKeep').addEventListener('input', function () { self.form.mustPreserve = this.value; });
        D.getElementById('rwTendencies').addEventListener('click', function (e) {
          var chip = e.target.closest('[data-v]'); if (!chip) return;
          var value = chip.getAttribute('data-v'), at = self.form.tendencies.indexOf(value);
          if (at > -1 && self.form.tendencies.length > 1) self.form.tendencies.splice(at, 1);
          else if (at < 0) self.form.tendencies.push(value);
          self.render();
        });
        D.getElementById('rwStrength').addEventListener('click', function (e) {
          var pick = e.target.closest('[data-v]'); if (!pick) return;
          self.form.intensity = pick.getAttribute('data-v'); self.render();
        });
        form.addEventListener('submit', function (e) { e.preventDefault(); self.generate(); });
      }
      var routes = this.el.querySelector('.rw-routes');
      if (routes) routes.addEventListener('click', function (e) {
        var del = e.target.closest('[data-rdel]');
        var card = e.target.closest('[data-rid]');
        if (del) {
          e.stopPropagation();
          return OW.confirm({ title: '删除这条剧情分支？', danger: true, ok: '确认删除',
            body: '它之后继续生长的子分支也会一起删除，原作与铭文不会受影响。',
            onOk: function () { OW.Store.removeBranch(self.bookId, del.getAttribute('data-rdel')); self.render(); } });
        }
        if (!card) return;
        var branch = OW.Store.branch(self.bookId, card.getAttribute('data-rid'));
        if (branch) { self.candidate = branch; self.error = ''; self.render(); }
      });
      this.wireResult(b);
    },

    wireResult: function () {
      var self = this;
      var cancel = D.getElementById('rwCancel');
      if (cancel) cancel.addEventListener('click', function () { if (self.controller) self.controller.abort(); });
      var retry = D.getElementById('rwRetry');
      if (retry) retry.addEventListener('click', function () { self.generate(); });
      if (!this.candidate || this.loading) return;
      var title = D.getElementById('rwTitle'), story = D.getElementById('rwStory');
      if (title) title.addEventListener('input', function () { self.candidate.title = this.value; });
      if (story) story.addEventListener('input', function () {
        self.candidate.content = this.value;
        var drop = D.getElementById('rwDropCap');
        if (drop) drop.textContent = (this.value.match(/[\u3400-\u9fffA-Za-z0-9]/) || ['✦'])[0];
      });
      bind('rwDiscard', function () { self.candidate = null; self.render(); });
      bind('rwAgain', function () { self.generate(); });
      bind('rwKeepCandidate', function () { self.saveCandidate(false); });
      bind('rwAccept', function () { self.saveCandidate(true); });
      bind('rwRead', function () { OW.App.openBook(self.bookId); });
      bind('rwContinue', function () {
        var c = self.candidate;
        self.open({ bookId: self.bookId, chapterIndex: c.chapterIndex, sourceType: 'branch',
          quote: c.content.slice(-160), parentId: c.id,
          intent: (c.nextDirections || c.next_directions || [])[0] || '' });
      });
      function bind(id, fn) { var el = D.getElementById(id); if (el) el.addEventListener('click', fn); }
    },

    generate: function () {
      var self = this, b = OW.Store.book(this.bookId);
      this.form.intent = (D.getElementById('rwIntent') || {}).value || this.form.intent;
      this.form.mustPreserve = (D.getElementById('rwKeep') || {}).value || this.form.mustPreserve;
      if (!this.form.intent.trim()) return OW.toast('请先写下你希望故事怎样改变。', 'warn');
      if (!this.form.tendencies.length) return OW.toast('至少选择一项改编倾向。', 'warn');
      var chapter = (b.chapters || [])[this.ctx.chapterIndex] || { title: '', paras: [] };
      var parent = this.ctx.parentId ? OW.Store.branch(b.id, this.ctx.parentId) : null;
      var upto = this.ctx.sourceType === 'selection' ? this.ctx.paragraphIndex + 1 : chapter.paras.length;
      var payload = {
        book_id: b.id, book_title: b.title, author: b.author,
        chapter_index: this.ctx.chapterIndex, chapter_title: chapter.title,
        source_type: this.ctx.sourceType,
        original_text: this.ctx.quote,
        context_before: chapter.paras.slice(0, upto).join('\n'),
        parent_branch_text: parent ? parent.content : '',
        intent: this.form.intent.trim(), tendencies: this.form.tendencies.slice(),
        intensity: this.form.intensity, must_preserve: this.form.mustPreserve.trim()
      };
      this.loading = true; this.error = ''; this.candidate = null;
      this.controller = new AbortController(); this.render();
      OW.Api.generateRewrite(payload, this.controller).then(function (result) {
        self.candidate = {
          parentId: self.ctx.parentId || null,
          chapterIndex: self.ctx.chapterIndex,
          paragraphIndex: self.ctx.paragraphIndex,
          sourceType: self.ctx.sourceType,
          quote: self.ctx.quote,
          intent: self.form.intent.trim(), tendencies: self.form.tendencies.slice(),
          intensity: self.form.intensity, mustPreserve: self.form.mustPreserve.trim(),
          title: result.title, content: result.content,
          keyChanges: result.key_changes || [], characters: result.characters || [],
          nextDirections: result.next_directions || [], difference: result.difference || '',
          conflicts: result.conflicts || [], model: result.model || '', isDemo: !!result.is_demo,
          status: 'candidate'
        };
      }).catch(function (err) {
        if (err && err.name === 'AbortError') self.error = '推演已取消，你的输入仍然保留。';
        else self.error = err.message || '未知错误';
      }).finally(function () { self.loading = false; self.controller = null; self.render(); });
    },

    saveCandidate: function (accept) {
      var c = this.candidate;
      if (!c) return;
      c.title = ((D.getElementById('rwTitle') || {}).value || c.title || '').trim();
      c.content = ((D.getElementById('rwStory') || {}).value || c.content || '').trim();
      if (!c.title || c.content.replace(/\s/g, '').length < 80) {
        return OW.toast('请保留标题，并让改编正文至少有 80 字。', 'warn');
      }
      var saved = c.id ? OW.Store.updateBranch(this.bookId, c.id, c) : OW.Store.addBranch(this.bookId, c);
      if (accept) saved = OW.Store.acceptBranch(this.bookId, saved.id);
      this.candidate = saved;
      OW.toast(accept ? '已采纳这条分支。原作仍可随时返回。' : '已保留为候选路线。');
      this.render();
    }
  };

  function strength(id, name, desc, current) {
    return '<button type="button" data-v="' + id + '" aria-pressed="' + (id === current) + '">' +
      '<strong>' + name + '</strong><span>' + desc + '</span></button>';
  }
  function routeCard(branch, status, no) {
    return '<article class="rw-route" data-rid="' + branch.id + '" tabindex="0">' +
      '<span class="rw-route-no">' + String(no).padStart(2, '0') + '</span><div><strong>' +
      OW.SVG.esc(branch.title || '未命名分支') + '</strong><small>' + status + ' · 第 ' +
      ((branch.chapterIndex || 0) + 1) + ' 节' + (branch.parentId ? ' · 二级分支' : '') + '</small></div>' +
      '<button class="btn btn--icon" data-rdel="' + branch.id + '" aria-label="删除分支">' +
      OW.SVG.icon('trash', 14) + '</button></article>';
  }

  OW.Rw = Rw;
})(window);
