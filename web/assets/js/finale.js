/* ==========================================================================
   finale.js — 读者终章（§5.5）
   ≥50 字，实时字数提示；未满足条件时发布按钮置灰，并逐项说明还缺什么（§8）。
   完整度只从 Store.progress 取，不在这里重算规则（§3.1）。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;
  var SVG;

  var Fn = {
    el: null, bookId: null,

    mount: function (root) {
      SVG = OW.SVG;
      this.el = root;
      root.innerHTML =
        '<div class="fn">' +
          '<aside class="fn-rail">' +
            '<div class="fn-rail-head">' +
              '<div class="eyebrow">Reader’s Coda</div>' +
              '<h2 class="gilt">读者终章</h2>' +
              '<p>写下你读完这本书之后想说的话。它会和你的四类铭文一起，' +
                '构成署有你名字的那个版本。</p>' +
            '</div>' +
            '<div class="fn-rail-body" id="fnRail"></div>' +
          '</aside>' +

          '<main class="fn-main">' +
            '<section class="fn-sheet parch corners">' +
              '<i class="cnr tl"></i><i class="cnr tr"></i>' +
              '<i class="cnr bl"></i><i class="cnr br"></i>' +
              '<header class="fn-sheet-head">' +
                '<div class="eyebrow" id="fnBook"></div>' +
                '<h2>写下你的终章</h2>' +
                '<p class="ds">不少于 50 字。原作不会被替换 —— 你写的是回应，' +
                  '它会留在你自己的那一版里。</p>' +
                '<div class="orn">' + SVG.ornament() + '</div>' +
              '</header>' +
              '<div class="fn-write">' +
                '<div class="lines"></div>' +
                '<textarea id="fnText" aria-label="读者终章正文" ' +
                  'placeholder="我读到的是……"></textarea>' +
              '</div>' +
              '<footer class="fn-sheet-foot">' +
                '<span class="fn-count" id="fnCount"></span>' +
                '<span class="grow"></span>' +
                '<button class="btn btn--sm btn--ghost" id="fnBack">回到阅读</button>' +
                '<button class="btn btn--primary" id="fnPub">发布并进入契名仪式</button>' +
              '</footer>' +
            '</section>' +
            '<div class="gate" id="fnGate"></div>' +
          '</main>' +
        '</div>';

      this.wire();
    },

    wire: function () {
      var self = this;
      D.getElementById('fnBack').addEventListener('click', function () {
        OW.App.openBook(self.bookId);
      });
      var ta = D.getElementById('fnText');
      ta.addEventListener('input', function () {
        var b = OW.Store.book(self.bookId); if (!b) return;
        b.finale = ta.value;
        OW.Store.commit(true);              // 静默存，不触发整页重绘打断输入
        self.paint();
      });
      D.getElementById('fnPub').addEventListener('click', function () { self.publish(); });
    },

    open: function (bookId) {
      this.bookId = bookId;
      var b = OW.Store.book(bookId);
      if (!b) return OW.App.go('library');
      D.getElementById('fnText').value = b.finale || '';
      D.getElementById('fnBook').textContent = b.title + ' · ' + b.author + ' 著';
      this.paint();
    },

    /** 只刷会变的部分：字数、完整度、缺项、按钮态 */
    paint: function () {
      var b = OW.Store.book(this.bookId); if (!b) return;
      var pr = OW.Store.progress(b.id), R = OW.RULES;

      /* 字数 */
      var cEl = D.getElementById('fnCount');
      cEl.className = 'fn-count' + (pr.finaleOk ? ' is-ok' : '');
      cEl.innerHTML = '已写 <b>' + pr.chars + '</b> 字　' +
        (pr.finaleOk ? '· 已达发布字数' : '· 还需 ' + (R.finaleMinChars - pr.chars) + ' 字');

      /* 左轨：完整度环 + 四类清单 + 阅读进度 */
      var C = 2 * Math.PI * 50;
      var lit = {}; OW.KINDS.forEach(function (k) { lit[k.id] = pr.kinds[k.id]; });
      lit.full = pr.ready;
      var chs = (b.chapters || []).length || 1;
      var read = Math.round(((b.page || 0) + 1) / chs * 100);

      D.getElementById('fnRail').innerHTML =
        '<div class="gauge">' +
          '<div class="ring">' +
            '<svg viewBox="0 0 112 112" aria-hidden="true">' +
              '<circle class="track" cx="56" cy="56" r="50"/>' +
              '<circle class="fill" cx="56" cy="56" r="50" ' +
                'stroke-dasharray="' + C.toFixed(1) + '" ' +
                'stroke-dashoffset="' + (C * (1 - pr.pct / 100)).toFixed(1) + '"/>' +
            '</svg>' +
            '<div class="mid"><b>' + pr.pct + '%</b><s>完整度</s></div>' +
          '</div>' +
          '<div class="txt">' +
            '<div class="lb">契名条件</div>' +
            '<div class="ds">四类<span class="term" data-gloss="铭文：你留在原文旁的回应">铭文</span>' +
              '各 20%，读者终章满 50 字再得 20%。</div>' +
          '</div>' +
        '</div>' +

        '<div class="fn-kinds">' +
          OW.KINDS.map(function (k) {
            var n = pr.kinds[k.id] || 0;
            return '<div class="kind-row' + (n ? ' is-lit' : '') + '" style="--c:' + k.color + '">' +
              '<span class="ic">' + SVG.kindIcon(k.id, 13) + '</span>' +
              '<span><span class="nm">' + k.name + '</span>' +
                '<span class="gl">' + k.gloss + ' · ' + k.line + '</span></span>' +
              '<span class="n">' + n + ' 枚</span>' +
              '<span class="pct">' + (n ? '+20' : '—') + '</span>' +
            '</div>';
          }).join('') +
          '<div class="kind-row' + (pr.finaleOk ? ' is-lit' : '') + '" style="--c:var(--dusk-gold)">' +
            '<span class="ic">' + SVG.icon('quill', 13) + '</span>' +
            '<span><span class="nm">读者终章</span>' +
              '<span class="gl">不少于 50 字</span></span>' +
            '<span class="n">' + pr.chars + ' 字</span>' +
            '<span class="pct">' + (pr.finaleOk ? '+20' : '—') + '</span>' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:24px;display:flex;justify-content:center">' +
          SVG.sigil(lit, 148) + '</div>' +

        '<div class="read-prog">' +
          '<div class="row"><span>阅读进度</span><span>' + read + '%</span></div>' +
          '<div class="bar" style="margin-top:8px"><i style="width:' + read + '%"></i></div>' +
          '<div class="ds">阅读进度单独展示，不计入契名条件。</div>' +
        '</div>';

      /* 缺项逐条列出（§8）*/
      var gate = D.getElementById('fnGate');
      var items = OW.KINDS.map(function (k) {
        var n = pr.kinds[k.id] || 0;
        return { done: n > 0, tx: '「' + k.name + '」至少一条（' + k.gloss + '）' };
      });
      items.push({
        done: pr.finaleOk,
        tx: pr.finaleOk ? '读者终章已满 50 字'
          : '读者终章还差 ' + (OW.RULES.finaleMinChars - pr.chars) + ' 字'
      });

      gate.className = 'gate' + (pr.ready ? ' is-ready' : '');
      gate.innerHTML =
        '<div class="hd">' + SVG.icon(pr.ready ? 'check' : 'warn', 13) +
          (pr.ready ? '发布条件已满足' : '还差这些才能契名') + '</div>' +
        '<ul>' + items.map(function (it) {
          return '<li class="' + (it.done ? 'is-done' : '') + '">' +
            '<span class="mk">' + (it.done ? '✓' : '·') + '</span>' + it.tx + '</li>';
        }).join('') + '</ul>';

      var pub = D.getElementById('fnPub');
      pub.disabled = !pr.ready;
      pub.setAttribute('aria-disabled', String(!pr.ready));
      pub.title = pr.ready ? '进入契名仪式' : '发布条件尚未满足，右侧列出了还缺什么';
    },

    /** 发布前再次确认用户名（§5.5），原作者名字不可编辑 */
    publish: function () {
      var b = OW.Store.book(this.bookId);
      var pr = OW.Store.progress(b.id);
      if (!pr.ready) return OW.toast('发布条件尚未满足，请看右侧列出的缺项。', 'warn');

      var st = OW.Store.get();
      var wrap = D.createElement('div');
      wrap.className = 'scrim';
      wrap.innerHTML =
        '<div class="dialog parch confirm-name" role="dialog" aria-modal="true">' +
          '<h3>确认你的署名</h3>' +
          '<p>这个名字会写进封面，并留在书库里。现在还可以改。</p>' +
          '<input class="input input--quill" id="cfName" maxlength="10" ' +
            'value="' + SVG.esc(st.reader || '') + '" aria-label="你的署名">' +
          '<div class="preview" id="cfPrev"></div>' +
          '<div class="keep">原作者 <b>' + SVG.esc(b.author) + '</b> 的「著」始终保留，' +
            '你以「编注」的身份进入这本书。</div>' +
          '<div class="row">' +
            '<button class="btn" id="cfNo">再改改</button>' +
            '<button class="btn btn--primary" id="cfYes">确认并契名</button>' +
          '</div>' +
        '</div>';
      D.body.appendChild(wrap);

      var input = wrap.querySelector('#cfName');
      var prev = wrap.querySelector('#cfPrev');
      function paint() {
        var nm = input.value.trim() || '读者';
        prev.textContent = b.author + ' 著 · ' + nm + ' 编注｜' + OW.Store.versionLabel(b);
      }
      paint();
      input.addEventListener('input', paint);
      input.focus();
      input.select();

      wrap.querySelector('#cfNo').addEventListener('click', function () { wrap.remove(); });
      wrap.addEventListener('click', function (e) { if (e.target === wrap) wrap.remove(); });
      wrap.querySelector('#cfYes').addEventListener('click', function () {
        var nm = input.value.trim();
        if (!nm) { input.focus(); return OW.toast('请先写下你的署名。', 'warn'); }
        OW.Store.set({ reader: nm });
        wrap.remove();
        OW.App.openCeremony(b.id, nm);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') wrap.querySelector('#cfYes').click();
      });
    }
  };

  OW.Fn = Fn;
})(window);
