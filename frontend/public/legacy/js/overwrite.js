/* ==========================================================================
   overwrite.js — 剧情覆写工作台（§5.6 AI 改编）
   四阶段：起点 · 意图 · 结果 · 分支管理
   —— 前端演示 fallback + 可选后端 /api/overwrite 联调
   —— 原文只读，永远不能被覆盖；用户点"接受"后才写入分支
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;
  var SVG;

  /* 剧情倾向：多选，仅传递给后端做提示词构造 */
  var TONES = [
    { id: 'darker',    name: '更黑暗',   gl: '让代价更沉重' },
    { id: 'gentler',   name: '更温柔',   gl: '让人物得到抚慰' },
    { id: 'twisty',    name: '更多反转', gl: '给出出乎意料的一步' },
    { id: 'noir',      name: '悬疑',     gl: '悬念大于结论' },
    { id: 'romantic',  name: '暧昧',     gl: '让关系流动' },
    { id: 'political', name: '权谋',     gl: '让立场先于情感' },
    { id: 'mythic',    name: '神秘',     gl: '不解释所有的事' },
    { id: 'grounded',  name: '写实',     gl: '让魔法退到幕后' }
  ];
  var STRENGTHS = [
    { id: 'soft',   name: '轻微',  gl: '沿着原作方向轻推一步' },
    { id: 'medium', name: '中等',  gl: '让一个关键事实换向' },
    { id: 'strong', name: '强烈',  gl: '推翻一个原本必然的结局' }
  ];
  var STAGE_LABELS = [
    { id: 'origin', name: '起点',   en: 'Origin' },
    { id: 'intent', name: '意图',   en: 'Intent' },
    { id: 'result', name: '推演',   en: 'Result' },
    { id: 'tree',   name: '分支',   en: 'Branches' }
  ];

  /* API 端口：默认 http://127.0.0.1:8000，允许 window.OW_API 或 <html data-api> 覆盖 */
  var API = (function () {
    if (w.OW_API_BASE) return String(w.OW_API_BASE).replace(/\/+$/, '');
    var da = D.documentElement.getAttribute('data-api');
    if (da) return da.replace(/\/+$/, '');
    return 'http://127.0.0.1:8000';
  })();

  var Ow = {
    el: null,
    bookId: null,
    // 起点信息：由外部入口调用 openFrom* 设置
    origin: null,       // { bookId, ch, para?, s?, e?, quote, mode, fromIns? }
    stage: 'origin',    // origin | intent | result | tree
    form: null,         // { prompt, tones:[], strength, constraints }
    result: null,       // 后端或 stub 返回的整段
    running: false,

    mount: function (root) {
      SVG = OW.SVG;
      this.el = root;
      // 骨架先渲染，后续 render() 按当前 stage 填充
      root.innerHTML =
        '<div class="ow-shell">' +
          '<header class="ow-bar">' +
            '<button class="btn btn--icon" id="owBack" aria-label="回到阅读器" ' +
              'title="回到阅读器">' + SVG.icon('back') + '</button>' +
            '<div class="crumbs" id="owCrumbs"></div>' +
            '<span class="grow"></span>' +
            '<div class="stage-dots" id="owDots"></div>' +
          '</header>' +
          '<aside class="ow-rail" id="owRail"></aside>' +
          '<section class="ow-main" id="owMain"></section>' +
        '</div>' +
        '<div class="ow-cast" id="owCast" aria-hidden="true"></div>';
      this.wire();
    },

    wire: function () {
      var self = this;
      D.getElementById('owBack').addEventListener('click', function () {
        OW.App.openBook(self.bookId || (self.origin && self.origin.bookId));
      });
      // Esc 只是收起法阵动画，不退出工作台，避免误触后重来
      D.addEventListener('keydown', function (e) {
        if (!OW.App.isView('overwrite')) return;
        if (e.key === 'Escape' && self.running) {
          // 允许 Esc 取消推演
          self.running = false;
          self.hideCast();
        }
      });
    },

    /* ==================================================================
       打开工作台 —— 三种入口
       ================================================================== */
    /** 从阅读器顶栏 "AI 改编" 主按钮进入：起点默认为"本章结尾" */
    openFromReader: function (bookId) {
      var b = OW.Store.book(bookId); if (!b) return;
      var ch = b.page || 0;
      this.bookId = bookId;
      this.origin = {
        bookId: bookId, ch: ch, mode: 'end-of-chapter',
        quote: '', fromIns: null
      };
      this.stage = 'origin';
      this._resetForm();
      this._go();
    },

    /** 从选中文字浮层进入：起点是选区 */
    openFromSelection: function (bookId, sel) {
      var b = OW.Store.book(bookId); if (!b || !sel) return;
      this.bookId = bookId;
      this.origin = {
        bookId: bookId, ch: sel.ch, para: sel.para, s: sel.s, e: sel.e,
        quote: sel.quote, mode: 'from-selection', fromIns: null
      };
      this.stage = 'origin';
      this._resetForm();
      this._go();
    },

    /** 从续章类铭文详情进入：起点是那枚铭文，意图预填铭文正文 */
    openFromInscription: function (bookId, insId) {
      var b = OW.Store.book(bookId); if (!b) return;
      var ins = null;
      for (var i = 0; i < b.inscriptions.length; i++) {
        if (b.inscriptions[i].id === insId) { ins = b.inscriptions[i]; break; }
      }
      if (!ins) return;
      this.bookId = bookId;
      this.origin = {
        bookId: bookId, ch: ins.ch, para: ins.para, s: ins.s, e: ins.e,
        quote: ins.quote, mode: 'from-inscription', fromIns: ins.id
      };
      this._resetForm();
      this.form.prompt = ins.body || '';           // 把续章想法带入意图输入框
      this.form.strength = 'medium';
      this.stage = 'origin';
      this._go();
    },

    /** 从阅读器分支面板的 "候选" 卡片点击进入：直接回到 Stage 3 结果页 */
    openDraft: function (bookId, draftId) {
      var b = OW.Store.book(bookId); if (!b) return;
      var br = OW.OwStore && OW.OwStore.byId(b, draftId);
      if (!br) return;
      this.bookId = bookId;
      this.origin = br.origin || { bookId: bookId, ch: 0, mode: 'end-of-chapter', quote: '' };
      this._resetForm();
      this.form = Object.assign(this.form, br.form || {});
      this.result = br.result || {
        title: br.title, narrative: br.narrative,
        changes: br.changes, conflicts: br.conflicts,
        nextDirections: br.nextDirections, strength: (br.form || {}).strength,
        demo: !!br.demo
      };
      this.stage = 'result';
      this._go();
    },

    _resetForm: function () {
      this.form = { prompt: '', tones: [], strength: 'medium', constraints: '' };
      this.result = null;
    },

    _go: function () {
      OW.App.go('overwrite');
      this.render();
    },

    /* ==================================================================
       渲染
       ================================================================== */
    render: function () {
      this._renderCrumbs();
      this._renderDots();
      this._renderRail();
      this._renderMain();
    },

    _renderCrumbs: function () {
      var b = OW.Store.book(this.bookId);
      if (!b) return;
      var ch = (b.chapters || [])[this.origin.ch] || {};
      D.getElementById('owCrumbs').innerHTML =
        '<span>' + SVG.esc(b.title) + '</span>' +
        '<span class="t-faint">·</span>' +
        '<b>剧情覆写工作台</b>' +
        '<span class="t-faint">·</span>' +
        '<span>' + SVG.esc(ch.title || '第 ' + (this.origin.ch + 1) + ' 节') + '</span>';
    },

    _renderDots: function () {
      var cur = this.stage;
      var idx = ['origin', 'intent', 'result', 'tree'].indexOf(cur);
      D.getElementById('owDots').innerHTML = STAGE_LABELS.map(function (s, i) {
        var cls = i < idx ? 'is-done' : (i === idx ? 'is-cur' : '');
        return '<span class="sd ' + cls + '"><i></i>' + s.en + '</span>' +
          (i < STAGE_LABELS.length - 1 ? '<span class="sep"></span>' : '');
      }).join('');
    },

    _renderRail: function () {
      var b = OW.Store.book(this.bookId);
      var ch = (b.chapters || [])[this.origin.ch] || {};
      var line = this._currentLine();
      var self = this;

      var modeTxt = {
        'end-of-chapter':  '从本章结尾开始',
        'from-selection':  '从选中文字开始',
        'from-inscription':'从续章铭文延伸'
      }[this.origin.mode] || '起点未定义';

      var quoteHtml = this.origin.quote
        ? '<div class="quote">' + SVG.esc(this.origin.quote) + '</div>'
        : '<div class="quote is-empty">未选中原文 · 从本章结尾开始</div>';

      D.getElementById('owRail').innerHTML =
        '<div class="rail-head">' +
          '<div class="eyebrow">Overwrite Workshop</div>' +
          '<h2>剧情覆写工作台</h2>' +
          '<p>原文不会被覆盖。你所写下的每一条分支都保留在你自己的版本里，' +
            '与原作路线并列陈列。</p>' +
        '</div>' +
        '<div class="ow-src">' +
          '<div class="row"><span class="lb">秘典</span><span class="vl">' +
            SVG.esc(b.title) + '　·　' + SVG.esc(b.author) + '</span></div>' +
          '<div class="row"><span class="lb">章节</span><span class="vl">' +
            SVG.esc(ch.title || '第 ' + (this.origin.ch + 1) + ' 节') + '</span></div>' +
          '<div class="row"><span class="lb">起点</span><span class="vl">' +
            SVG.esc(modeTxt) + '</span></div>' +
          quoteHtml +
        '</div>' +
        '<div class="ow-line ' + (line.branchId ? 'is-branch' : '') + '">' +
          '<i class="dot"></i>' + SVG.esc(line.label) +
        '</div>' +
        '<div class="rail-back">' +
          '<button class="btn btn--sm btn--block" id="owRailBack">' +
            SVG.icon('back', 14) + ' 返回阅读器</button>' +
        '</div>';

      D.getElementById('owRailBack').addEventListener('click', function () {
        OW.App.openBook(self.bookId);
      });
    },

    _renderMain: function () {
      var host = D.getElementById('owMain');
      var self = this;
      if (this.stage === 'origin') host.innerHTML = this._stageOrigin();
      else if (this.stage === 'intent') host.innerHTML = this._stageIntent();
      else if (this.stage === 'result') host.innerHTML = this._stageResult();
      else if (this.stage === 'tree')   host.innerHTML = this._stageTree();

      // 按 stage 挂事件
      var byStage = {
        origin: function () { self._wireOrigin(); },
        intent: function () { self._wireIntent(); },
        result: function () { self._wireResult(); },
        tree:   function () { self._wireTree();   }
      };
      byStage[this.stage] && byStage[this.stage]();
    },

    /* ==================================================================
       Stage 1 · 起点
       ================================================================== */
    _stageOrigin: function () {
      var b = OW.Store.book(this.bookId);
      var ch = (b.chapters || [])[this.origin.ch] || {};
      var previewParas = this._originPreviewParas(ch);

      var quoteBlock = this.origin.quote
        ? '<div class="ow-src" style="max-width:none"><div class="quote">' +
            SVG.esc(this.origin.quote) + '</div>' +
            '<div class="row"><span class="lb">位置</span><span class="vl">' +
              '第 ' + (this.origin.ch + 1) + ' 节 · 第 ' + ((this.origin.para || 0) + 1) + ' 段' +
            '</span></div></div>'
        : '';

      return '<div class="ow-stage is-on">' +
        '<div class="hd"><span class="n">01</span><h2>确认改编起点</h2>' +
          '<span class="sub">Origin</span></div>' +
        '<div class="ow-origin">' +
          '<div class="callout">' +
            '<div class="icn">' + SVG.icon('lock', 20) + '</div>' +
            '<div>' +
              '<h4>原文只读，永远不会被覆盖</h4>' +
              '<p>你在这里生成的每一段新剧情，都会作为一条 ' +
                '<span class="term">分支</span> 保存在你的版本里。' +
                '任何时候都能回到 <b>原作路线</b>。</p>' +
            '</div>' +
          '</div>' +
          quoteBlock +
          '<div class="ow-preview">' +
            '<div class="hd">改编开始前的最后几段原文</div>' +
            '<div class="prose">' + previewParas + '</div>' +
          '</div>' +
          '<div class="ow-actions" style="border-top:0;padding-top:0">' +
            '<span class="grow"></span>' +
            '<button class="btn" id="owOriginBack">再看看原文</button>' +
            '<button class="btn btn--primary" id="owOriginNext">' +
              '开始改编 ' + SVG.icon('right', 15) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    _originPreviewParas: function (ch) {
      if (!ch || !ch.paras) return '<p class="t-low">这一节尚未解封。</p>';
      var paras = ch.paras.slice();
      // 若起点是选区，取到那一段为止；否则取最后 3 段
      var end;
      if (this.origin.mode === 'from-selection' && typeof this.origin.para === 'number') {
        end = Math.min(this.origin.para + 1, paras.length);
      } else {
        end = paras.length;
      }
      var start = Math.max(0, end - 3);
      return paras.slice(start, end)
        .map(function (t) { return '<p>' + SVG.esc(t) + '</p>'; })
        .join('') || '<p class="t-low">这一节还没有正文。</p>';
    },

    _wireOrigin: function () {
      var self = this;
      D.getElementById('owOriginBack').addEventListener('click', function () {
        OW.App.openBook(self.bookId);
      });
      D.getElementById('owOriginNext').addEventListener('click', function () {
        self.stage = 'intent';
        self.render();
      });
    },

    /* ==================================================================
       Stage 2 · 意图
       ================================================================== */
    _stageIntent: function () {
      var F = this.form;
      var toneChips = TONES.map(function (t) {
        return '<button class="chip" type="button" data-t="' + t.id +
          '" aria-pressed="' + (F.tones.indexOf(t.id) > -1) + '" ' +
          'title="' + t.gl + '">' + t.name + '</button>';
      }).join('');
      var strengthBtns = STRENGTHS.map(function (s) {
        return '<button type="button" data-s="' + s.id +
          '" aria-pressed="' + (F.strength === s.id) + '">' +
          '<span class="nm">' + s.name + '</span>' +
          '<span class="gl">' + s.gl + '</span></button>';
      }).join('');

      return '<div class="ow-stage is-on">' +
        '<div class="hd"><span class="n">02</span><h2>填写改编意图</h2>' +
          '<span class="sub">Intent</span></div>' +
        '<form class="ow-form" id="owForm" autocomplete="off">' +
          '<div class="field">' +
            '<label for="owPrompt">你希望接下来的故事发生什么？</label>' +
            '<textarea class="textarea tall" id="owPrompt" ' +
              'placeholder="例：我希望伊兰不要交出第七盏灯，而是利用它调查前任守灯人的失踪。" ' +
              'maxlength="600">' + SVG.esc(F.prompt) + '</textarea>' +
            '<span class="hint" id="owPromptN"></span>' +
          '</div>' +
          '<div class="field">' +
            '<label>剧情倾向 · 可多选</label>' +
            '<div class="ow-tones" id="owTones">' + toneChips + '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label>推演强度</label>' +
            '<div class="ow-strength" id="owStrength">' + strengthBtns + '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label for="owConstraints">必须保留的设定 · 可留空</label>' +
            '<textarea class="textarea" id="owConstraints" ' +
              'placeholder="例：抄经室夜里必须留七盏灯；伊兰不能死。" ' +
              'maxlength="300">' + SVG.esc(F.constraints) + '</textarea>' +
          '</div>' +
          '<div class="actions">' +
            '<button type="button" class="btn" id="owIntentBack">' +
              SVG.icon('left', 14) + ' 上一步</button>' +
            '<span class="grow"></span>' +
            '<span class="n" id="owFormOk"></span>' +
            '<button type="button" class="btn btn--primary" id="owIntentGo" disabled>' +
              '开始推演 ' + SVG.icon('right', 15) + '</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    },

    _wireIntent: function () {
      var self = this, F = this.form;
      var prompt = D.getElementById('owPrompt');
      var constr = D.getElementById('owConstraints');
      var promptN = D.getElementById('owPromptN');
      var go = D.getElementById('owIntentGo');
      var ok = D.getElementById('owFormOk');

      function update() {
        F.prompt = prompt.value;
        F.constraints = constr.value;
        var n = F.prompt.replace(/\s/g, '').length;
        promptN.textContent = n ? n + ' 字（推荐 30–200 字）' : '';
        var ready = n >= 4;
        go.disabled = !ready;
        ok.textContent = ready ? '意图已就绪' : '再多写几句你的想法';
      }
      update();
      prompt.addEventListener('input', update);
      constr.addEventListener('input', update);

      D.getElementById('owTones').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-t]'); if (!b) return;
        var id = b.getAttribute('data-t');
        var i = F.tones.indexOf(id);
        if (i > -1) F.tones.splice(i, 1); else F.tones.push(id);
        b.setAttribute('aria-pressed', i > -1 ? 'false' : 'true');
      });
      D.getElementById('owStrength').addEventListener('click', function (e) {
        var b = e.target.closest('button[data-s]'); if (!b) return;
        F.strength = b.getAttribute('data-s');
        var all = this.querySelectorAll('button[data-s]');
        for (var i = 0; i < all.length; i++) {
          all[i].setAttribute('aria-pressed', all[i] === b ? 'true' : 'false');
        }
      });

      D.getElementById('owIntentBack').addEventListener('click', function () {
        self.stage = 'origin'; self.render();
      });
      D.getElementById('owIntentGo').addEventListener('click', function () {
        if (go.disabled) return;
        self.cast();
      });
    },

    /* ==================================================================
       推演（法阵动画 + API 请求 / stub 回退）
       ================================================================== */
    cast: function () {
      var self = this;
      this.running = true;
      this.showCast('正在推演分支剧情');

      this.callBackend(this.form).then(function (res) {
        // 拿到结果后，动画至少留 1.4s，避免视觉上"闪一下就完成"
        w.setTimeout(function () {
          self.running = false;
          self.hideCast();
          self.result = res;
          self.stage = 'result';
          self.render();
        }, 1400);
      }).catch(function (err) {
        w.setTimeout(function () {
          self.running = false;
          self.hideCast();
          OW.toast('后端未连接，已切换到演示结果。', 'warn');
          self.result = self.stubResult(self.form, err);
          self.stage = 'result';
          self.render();
        }, 1400);
      });
    },

    showCast: function (msg) {
      var host = D.getElementById('owCast');
      host.innerHTML =
        '<div class="in">' +
          '<div class="rune">' + this._runeSvg() + '</div>' +
          '<div class="tx">' + SVG.esc(msg || '推演中') + '</div>' +
          '<div class="sub">Overwriting</div>' +
        '</div>';
      host.classList.add('is-on');
      host.setAttribute('aria-hidden', 'false');
    },
    hideCast: function () {
      var host = D.getElementById('owCast');
      host.classList.remove('is-on');
      host.setAttribute('aria-hidden', 'true');
    },

    /** 复用 base.css 的 rune-gate 骨架，但改成三重旋转符文 */
    _runeSvg: function () {
      return '<svg viewBox="0 0 120 120" aria-hidden="true">' +
        '<g class="ring-outer">' +
          '<circle cx="60" cy="60" r="52"/>' +
          '<circle cx="60" cy="60" r="46" stroke-dasharray="1 6"/>' +
          '<path d="M60 8 L64 20 L60 32 L56 20 Z"/>' +
          '<path d="M60 88 L64 100 L60 112 L56 100 Z"/>' +
          '<path d="M8 60 L20 56 L32 60 L20 64 Z"/>' +
          '<path d="M88 60 L100 56 L112 60 L100 64 Z"/>' +
        '</g>' +
        '<g class="ring-inner">' +
          '<circle cx="60" cy="60" r="34"/>' +
          '<path d="M60 26 L94 60 L60 94 L26 60 Z"/>' +
        '</g>' +
        '<g class="glyphs">' +
          '<path d="M50 60 L60 50 L70 60 L60 70 Z"/>' +
          '<circle cx="60" cy="60" r="8" class="core"/>' +
          '<path d="M60 46 v28 M46 60 h28"/>' +
        '</g>' +
      '</svg>';
    },

    /* ==================================================================
       Stage 3 · 结果
       ================================================================== */
    _stageResult: function () {
      var R = this.result || {};
      var body = (R.narrative || '').split(/\n{1,}/).map(function (t) {
        t = t.trim();
        return t ? '<p>' + SVG.esc(t) + '</p>' : '';
      }).join('') || '<p>（未生成正文）</p>';
      var len = (R.narrative || '').replace(/\s/g, '').length;

      var demoTag = R.demo
        ? '<span class="tag tag--teal tag--mode tag--demo">演示结果</span>'
        : '<span class="tag tag--gold tag--mode">真实生成</span>';

      var changes = (R.changes || []).map(function (c) {
        return '<li>' + SVG.esc(c) + '</li>';
      }).join('') || '<li class="t-faint">未识别关键变化</li>';
      var conflicts = (R.conflicts || []).map(function (c) {
        return '<li>' + SVG.esc(c) + '</li>';
      }).join('') || '<li class="t-faint">未识别设定冲突</li>';
      var nextDirs = (R.nextDirections || []).map(function (n, i) {
        return '<li data-i="' + i + '">' + SVG.esc(n) + '</li>';
      }).join('') || '<li class="t-faint">暂无后续方向</li>';

      return '<div class="ow-stage is-on">' +
        '<div class="hd"><span class="n">03</span><h2>推演结果</h2>' +
          '<span class="sub">Result</span></div>' +
        '<div class="ow-result">' +
          '<div class="head-row">' +
            '<h3>' + SVG.esc(R.title || '分支 · 未命名') + '</h3>' +
            demoTag +
            '<span class="tag">强度：' + this._strengthName(R.strength || this.form.strength) + '</span>' +
          '</div>' +
          '<article class="ow-narrative">' +
            '<span class="n">Branch Narrative</span>' +
            '<span class="len">' + len + ' 字</span>' +
            body +
          '</article>' +
          '<div class="ow-meta-grid">' +
            '<div class="ow-meta">' +
              '<div class="hd">' + SVG.icon('star', 12) + '关键变化</div>' +
              '<ul>' + changes + '</ul>' +
            '</div>' +
            '<div class="ow-meta warn">' +
              '<div class="hd">' + SVG.icon('warn', 12) + '设定冲突</div>' +
              '<ul>' + conflicts + '</ul>' +
            '</div>' +
            '<div class="ow-meta next" id="owNextDirs">' +
              '<div class="hd">' + SVG.icon('right', 12) + '后续可选方向</div>' +
              '<ul>' + nextDirs + '</ul>' +
            '</div>' +
          '</div>' +
          '<div class="ow-actions">' +
            '<button class="btn" id="owResBack">' + SVG.icon('left', 14) + ' 调整意图重新推演</button>' +
            '<button class="btn" id="owResDraft">保留为候选</button>' +
            '<button class="btn btn--ghost btn--danger" id="owResDrop">放弃并返回原作</button>' +
            '<span class="grow"></span>' +
            '<button class="btn" id="owResEdit">编辑后接受</button>' +
            '<button class="btn btn--primary" id="owResAccept">' +
              '接受并进入该分支 ' + SVG.icon('right', 15) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    _wireResult: function () {
      var self = this;
      D.getElementById('owResBack').addEventListener('click', function () {
        self.stage = 'intent'; self.render();
      });
      D.getElementById('owResDrop').addEventListener('click', function () {
        OW.confirm({
          title: '放弃这条推演？',
          body: '这条分支不会被保留，你会回到当前所在路线。原文和已有分支不受影响。',
          ok: '确认放弃', danger: true,
          onOk: function () {
            self.result = null;
            OW.App.openBook(self.bookId);
          }
        });
      });
      D.getElementById('owResDraft').addEventListener('click', function () {
        self.saveBranch({ status: 'draft' });
        OW.toast('已保留为候选。可以在"分支管理"里继续。');
        self.stage = 'tree'; self.render();
      });
      D.getElementById('owResEdit').addEventListener('click', function () {
        self._editNarrative();
      });
      D.getElementById('owResAccept').addEventListener('click', function () {
        var branch = self.saveBranch({ status: 'accepted' });
        var bookId = self.bookId;
        var chIdx = (branch.origin && branch.origin.ch != null)
          ? branch.origin.ch : 0;
        var bk = OW.Store.book(bookId);
        if (bk) { bk.page = chIdx; OW.Store.commit(); }

        var chs = (bk && bk.chapters) || [];
        /* 第一章已经在 Stage 3 生成完，立即回阅读器；
           后续章节在后台顺序推演，每写完一章就 commit + 通知阅读器重绘。 */
        OW.toast('已进入分支「' + branch.title + '」。');
        OW.App.openBook(bookId);
        if (chIdx < chs.length - 1) {
          self.continueRewriteBook(branch.id).catch(function () {
            /* 单章失败已在 continueRewriteBook 内部落 stub，此处兜底 */
          });
        }
        return;
      });
      D.getElementById('owNextDirs').addEventListener('click', function (e) {
        var li = e.target.closest('li[data-i]'); if (!li) return;
        var i = parseInt(li.getAttribute('data-i'), 10);
        var next = (self.result && self.result.nextDirections) || [];
        if (!next[i]) return;
        // 把选中的后续方向带回意图输入框，进入下一轮
        self.form.prompt = next[i];
        self.stage = 'intent'; self.render();
      });
    },

    _editNarrative: function () {
      var self = this;
      var R = this.result || {};
      var scrim = D.createElement('div');
      scrim.className = 'scrim';
      scrim.innerHTML =
        '<div class="dialog panel" style="width:min(720px,100%)" role="dialog" aria-modal="true">' +
          '<h3>编辑分支正文</h3>' +
          '<p style="margin-bottom:12px">修改会保存在这条分支里，不影响原文。</p>' +
          '<textarea class="textarea" id="owEditTA" rows="12" ' +
            'style="min-height:280px">' + SVG.esc(R.narrative || '') + '</textarea>' +
          '<div class="row" style="margin-top:16px">' +
            '<button class="btn" data-no>取消</button>' +
            '<button class="btn btn--primary" data-yes>保存修改</button>' +
          '</div>' +
        '</div>';
      D.body.appendChild(scrim);
      var ta = scrim.querySelector('#owEditTA');
      ta.focus();
      function close() { scrim.remove(); }
      scrim.querySelector('[data-no]').addEventListener('click', close);
      scrim.querySelector('[data-yes]').addEventListener('click', function () {
        R.narrative = ta.value;
        R.editedByReader = true;
        close();
        self.render();
      });
      scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    },

    /* ==================================================================
       Stage 4 · 分支管理
       ================================================================== */
    _stageTree: function () {
      var b = OW.Store.book(this.bookId);
      var tree = OW.OwStore.tree(b);
      var cur = OW.OwStore.currentLine(b);
      var self = this;

      var canonNode =
        '<div class="node ' + (cur.branchId === null ? 'is-cur' : '') + '" data-branch="">' +
          '<span class="badge is-canon">原作</span>' +
          '<span class="tt">' + SVG.esc(b.title) + '　·　' + SVG.esc(b.author) + ' 著</span>' +
          '<span class="meta">canonical</span>' +
          '<span class="go">GO →</span>' +
        '</div>';

      function nodeHtml(br) {
        var isDraft = br.status === 'draft';
        var badge = isDraft
          ? '<span class="badge is-draft">候选</span>'
          : '<span class="badge is-branch">分支 ' + self._pad(br.no) + '</span>';
        var isCur = cur.branchId === br.id;
        var meta = '第 ' + (br.origin.ch + 1) + ' 节' +
          (br.parentId ? ' · 承接分支 ' + self._pad(self._findNo(b, br.parentId)) : ' · 承接原作');
        return '<li><div class="node ' + (isCur ? 'is-cur' : '') + '" data-branch="' + br.id + '">' +
          badge +
          '<span class="tt">' + SVG.esc(br.title) + '</span>' +
          '<span class="meta">' + meta + '</span>' +
          '<span class="go">GO →</span></div>' +
          (br.children.length
            ? '<ul>' + br.children.map(nodeHtml).join('') + '</ul>'
            : '') +
        '</li>';
      }

      var treeHtml = tree.length
        ? '<ul><li>' + canonNode + '<ul>' + tree.map(nodeHtml).join('') + '</ul></li></ul>'
        : '<ul><li>' + canonNode + '</li></ul>' +
          '<div class="ow-tree-empty">还没有任何分支。' +
          '写下一条改编，就能在这里看到它长成什么样。</div>';

      var drafts = OW.OwStore.drafts(b);
      var draftsHtml = drafts.length
        ? '<div class="ow-drafts">' + drafts.map(function (d) {
            return '<div class="draft" data-draft="' + d.id + '">' +
              '<span class="nm">' + SVG.esc(d.title) + '</span>' +
              '<span class="qu">' + SVG.esc((d.narrative || '').slice(0, 76)) + '…</span>' +
              '<span class="meta">' + self._agoStr(d.at) + '</span></div>';
          }).join('') + '</div>'
        : '';

      return '<div class="ow-stage is-on">' +
        '<div class="hd"><span class="n">04</span><h2>分支管理</h2>' +
          '<span class="sub">Branches</span></div>' +
        '<div class="ow-tree">' + treeHtml + '</div>' +
        (draftsHtml
          ? '<h3 style="margin-top:32px;font-size:var(--fs-md);letter-spacing:.14em;' +
            'font-weight:400;color:var(--tx-mid)">已保留的候选</h3>' + draftsHtml
          : '') +
        '<div class="ow-actions" style="margin-top:32px">' +
          '<button class="btn" id="owTreeBackReader">返回阅读器</button>' +
          '<span class="grow"></span>' +
          '<button class="btn btn--primary" id="owTreeMore">' +
            '从当前分支继续改编 ' + SVG.icon('right', 15) + '</button>' +
        '</div>' +
      '</div>';
    },

    _wireTree: function () {
      var self = this, b = OW.Store.book(this.bookId);

      D.getElementById('owTreeBackReader').addEventListener('click', function () {
        OW.App.openBook(self.bookId);
      });
      D.getElementById('owTreeMore').addEventListener('click', function () {
        self.stage = 'intent';
        // 保留 form 里已有的意图（若刚接受完，form 一般会重置）
        self._resetForm();
        self.render();
      });

      D.querySelectorAll('#owMain .node[data-branch]').forEach(function (n) {
        n.addEventListener('click', function () {
          var id = n.getAttribute('data-branch') || null;
          OW.OwStore.setCurrent(b, id);
          self.render();
          OW.toast(id ? '已切换到分支 ' + self._pad(self._findNo(b, id)) + '。'
                       : '已回到原作路线。');
        });
      });
      D.querySelectorAll('#owMain .draft[data-draft]').forEach(function (n) {
        n.addEventListener('click', function () {
          var id = n.getAttribute('data-draft');
          var br = OW.OwStore.byId(b, id);
          if (!br) return;
          self.result = br.result;
          self.stage = 'result';
          self.render();
        });
      });
    },

    /* ==================================================================
       保存 / 派生
       ================================================================== */
    saveBranch: function (opts) {
      opts = opts || {};
      var b = OW.Store.book(this.bookId);
      var R = this.result || {};
      var chapters = {};
      if (this.origin && typeof this.origin.ch === 'number') {
        chapters[this.origin.ch] = {
          narrative: R.narrative || '',
          summary: R.summary || '',
          title: R.title || '',
          demo: !!R.demo
        };
      }
      var branch = OW.OwStore.addBranch(b, {
        origin: this.origin,
        parentId: OW.OwStore.currentLine(b).branchId || null,
        title: R.title || ('分支 · ' + new Date().toLocaleTimeString('zh-CN', { hour12: false })),
        narrative: R.narrative || '',
        chapters: chapters,
        changes: R.changes || [],
        conflicts: R.conflicts || [],
        nextDirections: R.nextDirections || [],
        form: this.form,
        result: R,
        status: opts.status || 'accepted',
        demo: !!R.demo,
        pending: opts.status === 'accepted' && this.origin &&
                 this.origin.ch < ((b.chapters || []).length - 1)
      });
      if (opts.status === 'accepted') {
        OW.OwStore.setCurrent(b, branch.id);
      }
      return branch;
    },

    /* ==================================================================
       全书顺序改写：从起点章的下一章开始，逐章生成并落库
       每一章调用 callBackendChapter，携带：
         - 前面章节的摘要（含起点章）
         - 上两章的完整正文（重写后的优先，否则原文）
         - 本章的原文
         - 用户意图 / 倾向 / 强度 / 硬约束
       ================================================================== */
    continueRewriteBook: function (branchId) {
      var self = this;
      var b = OW.Store.book(this.bookId); if (!b) return Promise.resolve();
      var br = OW.OwStore.byId(b, branchId); if (!br) return Promise.resolve();
      var chs = b.chapters || [];
      var startIdx = (br.origin && typeof br.origin.ch === 'number' ? br.origin.ch : 0) + 1;
      var total = chs.length - startIdx;
      if (total <= 0) {
        OW.OwStore.setPending(b, branchId, false);
        return Promise.resolve();
      }

      /* 顺序 promise 链，一章一章推。写完一章立即通知阅读器重绘，
         这样刚生成的章节马上能读，未生成的章节继续显示占位。 */
      function notifyReader() {
        try {
          if (OW.Rd && OW.Rd.bookId === b.id && OW.App && OW.App.isView('reader')) {
            OW.Rd.render();
          }
        } catch (_) { /* 阅读器未挂载或已切出，忽略 */ }
      }

      var chain = Promise.resolve();
      for (var i = startIdx; i < chs.length; i++) {
        (function (idx) {
          chain = chain.then(function () {
            var payload = self._buildChapterPayload(b, br, idx);
            return self.callBackendChapter(payload).then(function (res) {
              OW.OwStore.setChapter(b, branchId, idx, {
                narrative: res.narrative || '',
                summary: res.summary || self._quickSummary(res.narrative || ''),
                title: res.title || '',
                demo: !!res.demo
              });
              notifyReader();
            }).catch(function () {
              /* 单章失败：写入 stub 版本，继续下一章，不阻断整本 */
              var stub = self._stubChapter(b, br, idx);
              OW.OwStore.setChapter(b, branchId, idx, {
                narrative: stub.narrative, summary: stub.summary,
                title: stub.title, demo: true
              });
              notifyReader();
            });
          });
        })(i);
      }
      return chain.then(function () {
        OW.OwStore.setPending(b, branchId, false);
        notifyReader();
        OW.toast('分支「' + (br.title || '未命名') + '」已改写至末章。');
      });
    },

    _prevChaptersSummaries: function (b, br, idx) {
      /* 起点章之前的原作章节：使用原作首段作为伪摘要（保持轻量）。
         起点章及之后的重写章节：使用其 summary。 */
      var out = [];
      var chs = b.chapters || [];
      var originCh = (br.origin && typeof br.origin.ch === 'number') ? br.origin.ch : 0;
      for (var i = 0; i < idx; i++) {
        if (i < originCh) {
          var ch = chs[i] || {};
          out.push({ ch: i, title: ch.title || '',
            summary: (ch.paras || []).slice(0, 2).join(' ').slice(0, 140) });
        } else {
          var c = br.chapters && br.chapters[i];
          if (c) {
            out.push({ ch: i, title: c.title || (chs[i] && chs[i].title) || '',
              summary: c.summary || this._quickSummary(c.narrative || '') });
          }
        }
      }
      return out;
    },

    _prevTwoChaptersFull: function (b, br, idx) {
      /* 上两章的完整正文：重写后的优先，否则回退到原作 */
      var out = [];
      var chs = b.chapters || [];
      for (var k = Math.max(0, idx - 2); k < idx; k++) {
        var narrative = (br.chapters && br.chapters[k] && br.chapters[k].narrative) || '';
        if (!narrative && chs[k]) narrative = (chs[k].paras || []).join('\n\n');
        var title = (br.chapters && br.chapters[k] && br.chapters[k].title) ||
                    (chs[k] && chs[k].title) || '';
        out.push({ ch: k, title: title, narrative: narrative });
      }
      return out;
    },

    _buildChapterPayload: function (b, br, idx) {
      var chs = b.chapters || [];
      var ch = chs[idx] || {};
      var originText = (ch.paras || []).join('\n\n');
      return {
        book: { id: b.id, title: b.title, author: b.author },
        branch: { id: br.id, no: br.no, title: br.title },
        origin: {
          ch: br.origin && br.origin.ch,
          ch_title: (chs[br.origin && br.origin.ch] || {}).title || '',
          quote: (br.origin && br.origin.quote) || '',
          mode: br.origin && br.origin.mode
        },
        target: {
          ch: idx,
          ch_title: ch.title || '',
          origin_text: originText
        },
        prev_summaries: this._prevChaptersSummaries(b, br, idx),
        prev_two_chapters: this._prevTwoChaptersFull(b, br, idx),
        prompt: (br.form && br.form.prompt) || '',
        tones: (br.form && br.form.tones) || [],
        strength: (br.form && br.form.strength) || 'medium',
        constraints: (br.form && br.form.constraints) || ''
      };
    },

    callBackendChapter: function (payload) {
      /* 直接打后端；后端未连或超时由外层 catch 落到 _stubChapter。
         不再用 ai.model==='demo' 短路 —— 那是老流程用于纯离线演示的开关。 */
      return new Promise(function (resolve, reject) {
        var ctrl = new w.AbortController();
        var timer = w.setTimeout(function () { ctrl.abort(); }, 90000);
        fetch(API + '/api/overwrite/chapter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        }).then(function (r) {
          w.clearTimeout(timer);
          if (!r.ok) return r.text().then(function (t) { throw new Error(t || 'HTTP ' + r.status); });
          return r.json();
        }).then(function (j) {
          resolve({
            title: j.title || '',
            narrative: j.narrative || '',
            summary: j.summary || '',
            demo: !!j.demo
          });
        }).catch(function (err) {
          w.clearTimeout(timer);
          reject(err);
        });
      });
    },

    _quickSummary: function (text) {
      if (!text) return '';
      var t = String(text).replace(/\s+/g, '').slice(0, 96);
      return t + (String(text).length > 96 ? '…' : '');
    },

    _stubChapter: function (b, br, idx, payload) {
      /* 后端未连时的确定性伪续写：套上上一章末尾一句 + 意图关键词 */
      var p = payload || {};
      var chTitle = (p.target && p.target.ch_title) || '';
      var chIdx = (p.target && p.target.ch) || idx || 0;
      var intent = ((p.prompt || '') + '').slice(0, 40);
      var prevTail = '';
      var prev2 = p.prev_two_chapters || [];
      if (prev2.length) {
        var last = prev2[prev2.length - 1];
        var s = (last.narrative || '').split(/[。！？\n]/).filter(Boolean);
        prevTail = s.length ? s[s.length - 1].slice(-40) : '';
      }
      var lines = [
        '（分支续写 · 第 ' + (chIdx + 1) + ' 节' +
          (chTitle ? '「' + chTitle + '」' : '') + '）',
        prevTail ? '承上文「…' + prevTail + '」——' : '这一节，事情继续朝着另一个方向走。',
        intent
          ? '「' + intent + '」这条意图仍在推动叙事：'
          : '你写下的那条改编方向仍在推动叙事：',
        '人物记住了上一节没能说出口的话，本节里被换了一种方式讲出来。'
          + '场景没有回到原作既定的落点，而是留出一条空白供后来的章节承接。',
        '（演示：后端未连，本节由前端 stub 生成，仅用于展示流程与结构。）'
      ];
      var narrative = lines.filter(Boolean).join('\n\n');
      return {
        demo: true,
        title: chTitle ? '分支 · ' + chTitle : '分支',
        narrative: narrative,
        summary: (intent ? '意图：' + intent + '。' : '') +
          '本节承接上章走向，未回到原作落点。'
      };
    },

    /* ==================================================================
       后端调用
       ================================================================== */
    callBackend: function (form) {
      var payload = this._buildPayload(form);
      /* 直接打后端；后端未连 / 超时由外层 catch 落到 stubResult。
         不再用 ai.model==='demo' 短路 —— 那是老流程用于纯离线演示的开关。 */
      return new Promise(function (resolve, reject) {
        var ctrl = new w.AbortController();
        var timer = w.setTimeout(function () { ctrl.abort(); }, 90000);
        fetch(API + '/api/overwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ctrl.signal
        }).then(function (r) {
          w.clearTimeout(timer);
          if (!r.ok) return r.text().then(function (t) { throw new Error(t || 'HTTP ' + r.status); });
          return r.json();
        }).then(function (j) {
          // 后端返回的字段名统一成前端 camelCase
          resolve({
            title:  j.title  || '分支 · 未命名',
            narrative: j.narrative || '',
            changes: j.changes || j.key_changes || [],
            conflicts: j.conflicts || j.setting_conflicts || [],
            nextDirections: j.next_directions || j.nextDirections || [],
            strength: j.strength || form.strength,
            demo: !!j.demo
          });
        }).catch(function (err) {
          w.clearTimeout(timer);
          reject(err);
        });
      });
    },

    _buildPayload: function (form) {
      var b = OW.Store.book(this.bookId);
      var ch = (b.chapters || [])[this.origin.ch] || {};
      var context = (ch.paras || []).slice(-6).join('\n\n');
      return {
        book: { id: b.id, title: b.title, author: b.author },
        origin: {
          ch: this.origin.ch,
          ch_title: ch.title || '',
          para: this.origin.para,
          quote: this.origin.quote || '',
          mode: this.origin.mode,
          from_ins: this.origin.fromIns || null
        },
        context: context,
        prompt: form.prompt,
        tones: form.tones,
        strength: form.strength,
        constraints: form.constraints
      };
    },

    /* ==================================================================
       演示 stub：后端未连接时，前端也能完整地跑一次流程
       ================================================================== */
    stubResult: function (form) {
      var b = OW.Store.book(this.bookId);
      var ch = (b.chapters || [])[this.origin.ch] || {};
      var toneName = form.tones.length
        ? form.tones.map(function (id) {
            for (var i = 0; i < TONES.length; i++) if (TONES[i].id === id) return TONES[i].name;
            return id;
          }).join(' · ')
        : '未指定倾向';

      var promptClip = (form.prompt || '').slice(0, 60);
      var quote = this.origin.quote || (ch.paras || [])[0] || '';
      var lines = [
        '「' + (quote || '第 ' + (this.origin.ch + 1) + ' 节') + '」之后 —— ',
        '事情并没有按原作那样进行。',
        promptClip
          ? '「' + promptClip + '」 —— 这句想法在夜里被写了下来，油灯并未熄灭。'
          : '那盏未熄的灯照见了另一种可能。',
        '一位当年被记漏了名字的守灯人，从抄经室阴影里走出来，把一枚布签放在纸上。' +
          '布签上的字，是伊兰第一次值夜时写下、又被读走的那一个。',
        '她把它认了出来。她意识到：被读走的不是字，是回答 —— 有人在替她记着答案。',
        '第七盏灯的油面第一次颤动。灯芯没有熄，只是短暂地弯下去，像在等她开口。',
        (form.strength === 'strong'
          ? '这一夜，抄经室换了一位新的总务修士。原来的那个人，被写进了灯芯里。'
          : (form.strength === 'soft'
            ? '这一夜，她没有交出灯，也没有开口。她只是把布签折进袖子，走回自己那张桌前。'
            : '她把第七盏灯从架上取下，端向暗处 —— 那里还有第八张桌，桌上没有名字。'))
      ];

      return {
        demo: true,
        strength: form.strength,
        title: '分支 · ' + (promptClip.slice(0, 12) || (ch.title || '未命名').slice(0, 12)),
        narrative: lines.filter(Boolean).join('\n\n'),
        changes: [
          '原作里没有说出的守灯人被引入正面场景',
          '油灯的"从不见少"被解释为"有人替她记着"',
          '伊兰的第一次值夜与布签形成回响'
        ],
        conflicts: [
          '需要与原作里"抄经室只说得太省"的调子保持一致',
          '第八张桌是新增设定，后续需要交代'
        ],
        nextDirections: [
          '让伊兰在第二夜把布签写满，看看谁在读',
          '让另一位抄书人先她一步发现第八张桌',
          '让原作总务修士回来 —— 但只在灯里出现'
        ]
      };
    },

    /* ==================================================================
       小工具
       ================================================================== */
    _pad: function (n) { n = String(n || 0); while (n.length < 2) n = '0' + n; return n; },
    _findNo: function (b, id) { var br = OW.OwStore.byId(b, id); return br ? br.no : '?'; },
    _strengthName: function (id) {
      for (var i = 0; i < STRENGTHS.length; i++) if (STRENGTHS[i].id === id) return STRENGTHS[i].name;
      return id;
    },
    _currentLine: function () {
      var b = OW.Store.book(this.bookId);
      if (!b) return { label: '原作路线', branchId: null };
      var cur = OW.OwStore.currentLine(b);
      if (cur.branchId === null) return { label: '原作路线', branchId: null };
      var br = OW.OwStore.byId(b, cur.branchId);
      return { label: '分支 ' + this._pad(br ? br.no : '?'), branchId: cur.branchId };
    },
    _agoStr: function (ts) {
      if (!ts) return '';
      var s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
      if (s < 60) return s + ' 秒前';
      if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
      if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
      return Math.floor(s / 86400) + ' 天前';
    }
  };

  /* ==========================================================================
     OwStore —— 分支持久化，挂在 book 上，通过 OW.Store.commit() 落盘
     数据形状：
       b.branches      = [{ id, no, parentId, origin, title, narrative,
                            changes, conflicts, nextDirections, form, result,
                            status:'accepted'|'draft', demo, at, editedByReader }]
       b.currentBranch = null | branchId   （当前所在的分支线）
     ========================================================================== */
  OW.OwStore = {
    ensure: function (b) {
      if (!b.branches) b.branches = [];
      if (typeof b.currentBranch === 'undefined') b.currentBranch = null;
      if (typeof b.branchCounter === 'undefined') b.branchCounter = 0;
    },
    byId: function (b, id) {
      if (!b || !b.branches) return null;
      for (var i = 0; i < b.branches.length; i++) if (b.branches[i].id === id) return b.branches[i];
      return null;
    },
    addBranch: function (b, patch) {
      this.ensure(b);
      b.branchCounter++;
      /* chapters 是 {chIdx: {narrative, summary, title, demo}} 的稀疏映射：
         起点章为空时用 patch.narrative 兜底。 */
      var chapters = patch.chapters || {};
      if (patch.origin && typeof patch.origin.ch === 'number' &&
          patch.narrative && !chapters[patch.origin.ch]) {
        chapters[patch.origin.ch] = {
          narrative: patch.narrative,
          summary: '',
          title: patch.title || '',
          demo: !!patch.demo
        };
      }
      var br = {
        id: 'br' + Date.now() + Math.floor(Math.random() * 1000),
        no: b.branchCounter,
        parentId: patch.parentId || null,
        origin: patch.origin,
        title: patch.title,
        narrative: patch.narrative,              // 起点章正文（老字段，向后兼容）
        chapters: chapters,                       // 新字段：多章重写
        changes: patch.changes || [],
        conflicts: patch.conflicts || [],
        nextDirections: patch.nextDirections || [],
        form: patch.form || {},
        result: patch.result || {},
        status: patch.status || 'accepted',
        demo: !!patch.demo,
        editedByReader: !!patch.editedByReader,
        pending: !!patch.pending,                 // 后续章节仍在推演中
        at: Date.now()
      };
      b.branches.push(br);
      OW.Store.commit();
      return br;
    },
    setChapter: function (b, branchId, chIdx, chapter) {
      var br = this.byId(b, branchId);
      if (!br) return null;
      if (!br.chapters) br.chapters = {};
      br.chapters[chIdx] = chapter;
      OW.Store.commit();
      return br;
    },
    setPending: function (b, branchId, pending) {
      var br = this.byId(b, branchId);
      if (!br) return null;
      br.pending = !!pending;
      OW.Store.commit();
      return br;
    },
    chapterNarrative: function (br, idx) {
      if (!br) return null;
      var c = br.chapters && br.chapters[idx];
      if (c && (c.narrative || '').trim()) return c.narrative;
      if (br.origin && br.origin.ch === idx && (br.narrative || '').trim()) {
        return br.narrative;
      }
      return null;
    },
    setCurrent: function (b, id) {
      this.ensure(b);
      b.currentBranch = id || null;
      OW.Store.commit();
    },
    currentLine: function (b) {
      this.ensure(b);
      return { branchId: b.currentBranch || null };
    },
    /** 生成 UI 用的分支树（仅返回已接受的分支；候选另放） */
    tree: function (b) {
      this.ensure(b);
      var accepted = b.branches.filter(function (br) { return br.status !== 'draft'; });
      var byParent = {};
      accepted.forEach(function (br) {
        var k = br.parentId || '';
        (byParent[k] = byParent[k] || []).push(br);
      });
      function build(pid) {
        return (byParent[pid || ''] || []).map(function (br) {
          return { id: br.id, no: br.no, parentId: br.parentId, origin: br.origin,
                   title: br.title, status: br.status, children: build(br.id) };
        });
      }
      return build(null);
    },
    drafts: function (b) {
      this.ensure(b);
      return (b.branches || []).filter(function (br) { return br.status === 'draft'; })
        .sort(function (a, c) { return c.at - a.at; });
    }
  };

  OW.Ow = Ow;
})(window);
