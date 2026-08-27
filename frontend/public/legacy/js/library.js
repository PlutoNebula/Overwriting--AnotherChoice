/* ==========================================================================
   library.js — 秘典书库（§5.2）
   四个入口：导入 TXT / 恢复示例藏书 / 全局设置·AI 设置 / 重播开场。
   「恢复示例藏书」与「重置示例书进度」在视觉上分开 —— 两者语义完全不同。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var D = w.document;
  var SVG;

  var Lib = {
    el: null,

    mount: function (root) {
      SVG = OW.SVG;
      this.el = root;
      root.innerHTML =
        '<div class="lib">' +
          OW.SVG.libStars() +
          '<header class="lib-top">' +
            '<div class="lib-brand">' +
              '<div class="en gilt">Overwriting</div>' +
              '<div class="cn">秘 典 书 库</div>' +
            '</div>' +
            '<div class="lib-tools">' +
              '<div class="lib-me" id="libMe"></div>' +
              '<span class="rule-v"></span>' +
              '<button class="btn btn--icon" id="libTheme" title="日夜切换" ' +
                'aria-label="日夜切换"></button>' +
              '<button class="btn btn--icon" id="libSet" title="全局设置 · AI 设置" ' +
                'aria-label="全局设置">' + SVG.icon('gear') + '</button>' +
            '</div>' +
          '</header>' +

          '<div class="lib-scroll">' +
            '<div id="libResume"></div>' +

            '<div class="sec-head">' +
              '<h3>示例藏书</h3><span class="line"></span>' +
              '<span class="n" id="libCount"></span>' +
            '</div>' +
            '<div class="shelf" id="libShelf"></div>' +
          '</div>' +

          '<footer class="lib-foot">' +
            '<button class="btn btn--sm" id="libImport">' +
              SVG.icon('import', 15) + ' 导入 TXT</button>' +
            '<div class="entry-pair">' +
              '<span class="lb">示例书</span>' +
              '<button class="btn btn--sm btn--ghost" id="libRestore" ' +
                'title="把被删掉的示例书补回来，不改动任何进度">恢复示例藏书</button>' +
              '<button class="btn btn--sm btn--ghost btn--danger" id="libResetProg" ' +
                'title="清空示例书的铭文、终章与契名，书仍保留">重置示例书进度</button>' +
            '</div>' +
            '<span class="grow"></span>' +
            '<span class="note" id="libHint"></span>' +
            '<button class="btn btn--sm btn--ghost" id="libReplay">' +
              SVG.icon('replay', 14) + ' 重播开场</button>' +
          '</footer>' +
        '</div>' +
        '<input type="file" id="libFile" accept=".txt,text/plain" hidden>';

      this.wire();
    },

    wire: function () {
      var self = this, S = OW.Store;

      D.getElementById('libSet').addEventListener('click', function () { self.settings(); });
      D.getElementById('libTheme').addEventListener('click', function () { OW.App.toggleNight(); });
      D.getElementById('libReplay').addEventListener('click', function () { OW.App.replayIntro(); });

      D.getElementById('libImport').addEventListener('click', function () {
        D.getElementById('libFile').click();
      });
      D.getElementById('libFile').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        e.target.value = '';                       // 允许重复导入同一文件
        if (f) self.importTxt(f);
      });

      D.getElementById('libRestore').addEventListener('click', function () {
        var n = S.restoreSamples();
        self.render();
        OW.toast(n > 0 ? '已恢复 ' + n + ' 本示例藏书。' : '三本示例藏书都在架上，无需恢复。');
      });

      D.getElementById('libResetProg').addEventListener('click', function () {
        OW.confirm({
          title: '重置示例书进度？',
          body: '示例书的铭文、读者终章、契名与阅读位置都会清空，书本身仍留在书库。' +
                '导入的书不受影响。这一步无法撤销。',
          ok: '确认重置', danger: true,
          onOk: function () {
            S.resetSampleProgress();
            self.render();
            OW.toast('示例书进度已重置，藏书仍在架上。');
          }
        });
      });
    },

    /* ---------- 导入 TXT：解析失败要说清原因，不出现白屏（§8）---------- */
    importTxt: function (file) {
      var self = this;
      if (!/\.txt$/i.test(file.name) && file.type !== 'text/plain') {
        return OW.toast('只支持纯文本 TXT 文件。', 'warn');
      }
      if (file.size === 0) return OW.toast('这个文件是空的，没有可阅读的内容。', 'warn');
      if (file.size > 4 * 1024 * 1024) {
        return OW.toast('文件过大（超过 4MB），初赛版暂不支持。', 'warn');
      }
      if (!OW.Api || !OW.Api.importBook) return OW.toast('未连接到后端，无法导入。', 'warn');
      OW.Api.importBook(file).then(function (data) {
        var chapters = data.chapters || [];
        var name = (data.filename || file.name).replace(/\.txt$/i, '').slice(0, 24) || '无名秘典';
        OW.Store.addBook({
          id: data.work_id || ('u' + Date.now()),
          sample: false, locked: false,
          title: name, author: '导入·佚名', sub: '由你导入',
          hue: chapters.length % 3, chapters: chapters, page: 0,
          inscriptions: [], bookmarks: [], finale: '', signed: null, firstInsDone: false
        });
        self.render();
        OW.toast('《' + name + '》已入库，共 ' + chapters.length + ' 节。');
      }).catch(function (err) {
        OW.toast(err.message || OW.COPY.txtBad, 'warn');
      });
    },

    /* ---------- 渲染 ---------- */
    render: function () {
      if (!this.el) return;
      var S = OW.Store, st = S.get();

      /* 读者身份 */
      var signedCount = st.books.filter(function (b) { return !!b.signed; }).length;
      D.getElementById('libMe').innerHTML =
        '<span class="av">' + SVG.esc((st.reader || '读').slice(0, 1)) + '</span>' +
        '<span class="nm">' + SVG.esc(st.reader || '未署名') + '</span>' +
        '<span class="ct">· 覆写版本 ' + signedCount + '</span>';

      var themeBtn = D.getElementById('libTheme');
      themeBtn.innerHTML = SVG.icon(st.night ? 'moon' : 'sun');
      themeBtn.classList.toggle('is-on', !st.night);

      /* 继续阅读：首屏突出（§5.2）*/
      var pick = null;
      st.books.forEach(function (b) {
        if (b.locked) return;
        if (!pick) { pick = b; return; }
        if ((b.page || 0) > (pick.page || 0)) pick = b;
      });
      D.getElementById('libResume').innerHTML = pick ? this.resumeHtml(pick) : '';
      if (pick) {
        var self = this;
        /* 首屏「继续阅读」入口与书卡同一节奏：先播短促的符文法阵再跳转。 */
        var heroJump = function (fn) {
          var go = D.getElementById('resumeGo');
          if (!go || go.__jump) return;
          go.__jump = true;
          w.setTimeout(function () { go.__jump = false; fn(); }, 280);
        };
        D.getElementById('resumeGo').addEventListener('click', function () {
          heroJump(function () { OW.App.openBook(pick.id); });
        });
        var fin = D.getElementById('resumeFin');
        if (fin) fin.addEventListener('click', function () {
          heroJump(function () { OW.App.openFinale(pick.id); });
        });
      }

      /* 书架 */
      var shelf = D.getElementById('libShelf');
      shelf.innerHTML = st.books.map(function (b) { return Lib.cardHtml(b); }).join('') +
        '<button class="bcard bcard--add" id="libAdd">' +
          '<span class="in">' + SVG.icon('plus', 34) +
            '<span class="t">导入一本 TXT</span>' +
            '<span class="d">纯文本即可。导入的书与示例藏书并列，可独立批注与契名。</span>' +
          '</span></button>';
      D.getElementById('libCount').textContent =
        st.books.length + ' 本 · ' + st.books.filter(function (b) { return !b.locked; }).length + ' 本可读';

      D.getElementById('libAdd').addEventListener('click', function () {
        D.getElementById('libFile').click();
      });

      var cards = shelf.querySelectorAll('.bcard[data-id]');
      for (var i = 0; i < cards.length; i++) {
        (function (card) {
          var id = card.getAttribute('data-id');
          card.addEventListener('click', function (e) {
            if (e.target.closest('[data-del]')) return;   // 删除按钮自己处理
            var b = OW.Store.book(id);
            if (!b) return;
            if (b.locked) return OW.toast(OW.COPY.locked, 'warn');
            if (card.__jump) return;                      // 双击保护
            card.__jump = true;
            // 留 280ms 播完符文法阵，再进入阅读器；避免动画残留到下一页。
            w.setTimeout(function () {
              card.__jump = false;
              OW.App.openBook(id);
            }, 280);
          });
          var del = card.querySelector('[data-del]');
          if (del) del.addEventListener('click', function (e) {
            e.stopPropagation();
            var b = OW.Store.book(id);
            OW.confirm({
              title: '删除《' + (b ? b.title : '') + '》？',
              body: '这本导入的书连同它的铭文、终章与契名会一起删除，无法撤销。',
              ok: '确认删除', danger: true,
              onOk: function () {
                OW.Store.removeBook(id); Lib.render(); OW.toast('已删除这本导入的秘典。');
              }
            });
          });
        })(cards[i]);
      }

      D.getElementById('libHint').textContent =
        st.books.length <= 3 ? '书库常驻三本示例藏书' : '';
    },

    resumeHtml: function (b) {
      var pr = OW.Store.progress(b.id);
      var total = (b.chapters || []).length || 1;
      var read = Math.round(((b.page || 0) + 1) / total * 100);
      var firstPara = (b.chapters && b.chapters[b.page || 0] &&
                       b.chapters[b.page || 0].paras[0]) || '';
      return '<section class="resume leather">' +
        '<div class="mini">' + SVG.cover(b, { title: false }) + '</div>' +
        '<div class="meta">' +
          '<div class="eyebrow">继续阅读</div>' +
          '<h2 class="gilt">' + SVG.esc(b.title) + '</h2>' +
          '<div class="by">' + SVG.esc(b.author) + ' 著' +
            (b.signed ? ' · <span class="t-gold">' + SVG.esc(b.signed.reader) + ' 编注</span>' : '') +
          '</div>' +
          '<p class="quote">' + SVG.esc(firstPara) + '</p>' +
          '<div class="prog">' +
            '<div class="row"><span>' +
              SVG.esc((b.chapters[b.page || 0] || {}).title || '') +
            '</span><span>完整度 ' + pr.pct + '%</span></div>' +
            '<div class="bar"><i style="width:' + pr.pct + '%"></i></div>' +
            '<div class="row" style="margin-top:8px">' +
              '<span>阅读进度 ' + read + '%</span>' +
              '<span>' + pr.lit + '/4 类铭文 · 终章 ' + pr.chars + ' 字</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="act">' +
          '<button class="btn btn--primary" id="resumeGo">翻开这本' +
            (b.page ? '（第 ' + ((b.page || 0) + 1) + ' 节）' : '') + '</button>' +
          '<button class="btn btn--sm btn--ghost" id="resumeFin">' +
            (b.signed ? '查看我的版本' : '去写读者终章') + '</button>' +
        '</div>' +
      '</section>';
    },

    cardHtml: function (b) {
      var pr = OW.Store.progress(b.id);
      var total = (b.chapters || []).length || 1;
      var read = b.locked ? 0 : Math.round(((b.page || 0) + 1) / total * 100);
      var cls = 'bcard' + (b.locked ? ' is-locked' : '') + (b.signed ? ' is-signed' : '');
      return '<article class="' + cls + '" data-id="' + b.id + '" tabindex="0" ' +
          'role="button" aria-label="' + SVG.esc(b.title) + '">' +
        '<div class="bcard-cover">' + SVG.cover(b) +
          (b.locked ? '<div class="bcard-lock">' + SVG.icon('lock', 30) + '</div>' : '') +
          '<div class="bcard-badge">' +
            (b.locked ? '<span class="tag tag--locked">尚未解封</span>'
             : b.signed ? '<span class="tag tag--gold"><i class="dot"></i>已契名</span>'
             : pr.pct > 0 ? '<span class="tag tag--teal"><i class="dot"></i>覆写中</span>'
             : '<span class="tag">未启封</span>') +
          '</div>' +
          (b.signed ? '<div class="bcard-sig">' + SVG.esc(b.signed.reader) + ' 编注</div>' : '') +
        '</div>' +
        '<div class="bcard-body">' +
          '<h4>' + SVG.esc(b.title) + '</h4>' +
          '<div class="by">' + SVG.esc(b.author) + ' 著</div>' +
          '<div class="ver">' +
            (b.signed ? OW.Store.versionLabel(b) : (b.locked ? '待解封' : '尚无覆写版本')) +
          '</div>' +
          (b.locked ? '' :
            '<div class="bar"><i style="width:' + pr.pct + '%"></i></div>' +
            '<div class="bcard-foot">' +
              '<span>完整度 ' + pr.pct + '%</span>' +
              '<span>阅读 ' + read + '%</span>' +
            '</div>') +
          (b.sample ? '' :
            '<div class="bcard-foot"><span></span>' +
            '<button class="btn btn--sm btn--ghost btn--danger" data-del ' +
              'aria-label="删除这本导入的书">' + SVG.icon('trash', 13) + '</button></div>') +
        '</div>' +
      '</article>';
    },

    /* ---------- 全局设置 · AI 设置 ---------- */
    settings: function () {
      var st = OW.Store.get();
      var wrap = D.createElement('div');
      wrap.className = 'scrim';
      wrap.innerHTML =
        '<aside class="drawer" role="dialog" aria-modal="true" aria-label="全局设置">' +
          '<div class="drawer-head">' +
            '<h3>全局设置</h3>' +
            '<button class="btn btn--icon" data-x aria-label="关闭">' + SVG.icon('close') + '</button>' +
          '</div>' +
          '<div class="drawer-body">' +

            '<section class="drawer-sec">' +
              '<div class="hd">外观</div>' +
              '<div class="opt-row">' +
                '<div><div class="lb">夜间模式</div>' +
                  '<div class="ds">全局与阅读器配色共用同一套主题，不会出现局部漏色。</div></div>' +
                '<div class="seg" id="setNight">' +
                  '<button data-v="1" aria-pressed="' + (st.night ? 'true' : 'false') + '">夜</button>' +
                  '<button data-v="0" aria-pressed="' + (!st.night ? 'true' : 'false') + '">昼</button>' +
                '</div>' +
              '</div>' +
              '<div class="opt-row">' +
                '<div><div class="lb">正文字号</div>' +
                  '<div class="ds">阅读器内也可随时调整。</div></div>' +
                '<div class="seg" id="setFs">' +
                  '<button data-v="16" aria-pressed="' + (st.fontSize === 16) + '">小</button>' +
                  '<button data-v="18" aria-pressed="' + (st.fontSize === 18) + '">中</button>' +
                  '<button data-v="21" aria-pressed="' + (st.fontSize === 21) + '">大</button>' +
                '</div>' +
              '</div>' +
            '</section>' +

            '<section class="drawer-sec">' +
              '<div class="hd">AI 设置</div>' +
              '<div class="ai-note">' + OW.COPY.aiNo + '</div>' +
              '<div class="field">' +
                '<label for="setKey">接口密钥</label>' +
                '<div class="key-row">' +
                  '<input class="input" id="setKey" type="password" autocomplete="off" ' +
                    'placeholder="默认掩码显示" value="' + SVG.esc(st.ai.key) + '">' +
                  '<button class="btn btn--sm" id="setKeyEye">显示</button>' +
                '</div>' +
                '<div class="ds" style="font-size:12px;color:var(--tx-faint);line-height:1.8">' +
                  '密钥只存在你自己的浏览器里，不会写进项目、也不会上传。录屏时请保持掩码状态。' +
                '</div>' +
              '</div>' +
              '<div class="opt-row">' +
                '<div><div class="lb">魔法助手</div>' +
                  '<div class="ds">初赛版仅做预设演示，核心阅读与铭文不依赖它。</div></div>' +
                '<span class="tag">未连接</span>' +
              '</div>' +
            '</section>' +

            '<section class="drawer-sec">' +
              '<div class="hd">数据</div>' +
              '<div class="opt-row">' +
                '<div><div class="lb">恢复示例藏书</div>' +
                  '<div class="ds">补回被删掉的示例书，不改动任何进度。</div></div>' +
                '<button class="btn btn--sm" id="setRestore">恢复</button>' +
              '</div>' +
              '<div class="opt-row">' +
                '<div><div class="lb">重置示例书进度</div>' +
                  '<div class="ds">清空示例书的铭文、终章与契名，书仍保留。</div></div>' +
                '<button class="btn btn--sm btn--danger" id="setResetProg">重置</button>' +
              '</div>' +
              '<div class="opt-row">' +
                '<div><div class="lb">恢复首次使用状态</div>' +
                  '<div class="ds">清空全部本地数据，回到署名之前。演示前用。</div></div>' +
                '<button class="btn btn--sm btn--danger" id="setWipe">清空</button>' +
              '</div>' +
            '</section>' +

            '<section class="drawer-sec">' +
              '<div class="hd">开场</div>' +
              '<div class="opt-row">' +
                '<div><div class="lb">重播开场动画</div>' +
                  '<div class="ds">6–8 秒，可随时按 Esc 跳过。</div></div>' +
                '<button class="btn btn--sm" id="setReplay">重播</button>' +
              '</div>' +
            '</section>' +
          '</div>' +
        '</aside>';
      D.body.appendChild(wrap);

      /* 与 OW.confirm 同一套行为：Esc 关闭，监听随关闭一起摘掉。
         若此刻上面还叠着 OW.confirm（.dialog），让确认框独自处理 Esc。 */
      function close() { wrap.remove(); D.removeEventListener('keydown', esc); }
      function esc(e) {
        if (e.key === 'Escape' && !D.querySelector('.scrim .dialog')) close();
      }
      D.addEventListener('keydown', esc);
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });
      wrap.querySelector('[data-x]').addEventListener('click', close);

      seg(wrap.querySelector('#setNight'), function (v) {
        OW.App.setNight(v === '1'); Lib.render();
      });
      seg(wrap.querySelector('#setFs'), function (v) {
        OW.Store.set({ fontSize: parseInt(v, 10) });
      });

      var key = wrap.querySelector('#setKey');
      wrap.querySelector('#setKeyEye').addEventListener('click', function () {
        var show = key.type === 'password';
        key.type = show ? 'text' : 'password';
        this.textContent = show ? '掩码' : '显示';
      });
      key.addEventListener('change', function () {
        var st2 = OW.Store.get(); st2.ai.key = key.value; OW.Store.commit();
      });

      wrap.querySelector('#setRestore').addEventListener('click', function () {
        var n = OW.Store.restoreSamples(); Lib.render();
        OW.toast(n > 0 ? '已恢复 ' + n + ' 本示例藏书。' : '三本示例藏书都在架上。');
      });
      wrap.querySelector('#setResetProg').addEventListener('click', function () {
        OW.confirm({
          title: '重置示例书进度？', danger: true, ok: '确认重置',
          body: '示例书的铭文、终章、契名与阅读位置会清空，书本身保留。',
          onOk: function () { OW.Store.resetSampleProgress(); Lib.render(); OW.toast('示例书进度已重置。'); }
        });
      });
      wrap.querySelector('#setWipe').addEventListener('click', function () {
        OW.confirm({
          title: '清空全部本地数据？', danger: true, ok: '确认清空',
          body: '署名、铭文、终章、契名版本都会删除，回到第一次打开的状态。无法撤销。',
          onOk: function () { close(); OW.App.wipe(); }
        });
      });
      wrap.querySelector('#setReplay').addEventListener('click', function () {
        close(); OW.App.replayIntro();
      });
    }
  };

  /* 分段选择器：只在这里处理 aria-pressed，页面代码不重复写 */
  function seg(root, onPick) {
    if (!root) return;
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]');
      if (!b) return;
      var all = root.querySelectorAll('button[data-v]');
      for (var i = 0; i < all.length; i++) all[i].setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      onPick(b.getAttribute('data-v'));
    });
  }
  OW.seg = seg;

  OW.Lib = Lib;
})(window);
