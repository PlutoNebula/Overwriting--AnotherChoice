/* ==========================================================================
   data.js — 示例藏书
   正文是我为搭壳自写的占位原创短文（§5.2 要求公版或团队原创，规避版权）。
   书名 / 作者 / 三本书定位归角色 4，拿到后只替换这个文件。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});

  function p(arr) { return arr; }

  /* ---------- 可读的那一本：三章，段落短，方便演示选区 ---------- */
  var CH = [
    {
      title: '第一章 · 抄经室的第七盏灯',
      paras: p([
        '抄经室每夜留七盏灯。前六盏给六位抄书人，第七盏没有主人，油却从不见少。',
        '伊兰第一次值夜时数过：六个人影，七圈光。她把这件事写在袖口的布签上，第二天布签空白如新。',
        '总务修士说，那盏灯是留给读到一半就走的人的。她问，走去哪里。修士说，走进书里。',
        '她那时以为这是句劝人早睡的玄话。后来她才知道，抄经室从不说玄话，它只说得太省。'
      ])
    },
    {
      title: '第二章 · 空白的批注',
      paras: p([
        '第七盏灯下摊着一本无名书。纸面干净得反常，唯有页边留着一道极浅的压痕，像谁用指甲划过。',
        '伊兰试着在压痕旁写下一个字。墨落纸上，字迹缓慢散开，不是被吸走，是被读走。',
        '第二夜，压痕多了一道。第三夜，多了三道。第七夜，页边挤满了浅痕，密得像一段没人念出的话。',
        '她终于明白：那些痕不是别人的字，是别人的回答。这本书一直在等有人先开口。',
        '于是她开口了。她写：我不同意你在第一章说的每一句。她写完，手心是汗，灯却亮了一寸。'
      ])
    },
    {
      title: '第三章 · 署名之夜',
      paras: p([
        '书的最后一页只有一行小字：此书由读者完成，作者只负责起头。',
        '伊兰把笔搁下。她没有改掉起头那个人的名字，那名字仍在扉页，墨色比她的新。',
        '她在下面写了自己的名字，中间空一格。她想，空格是留给下一个值夜人的。',
        '第七盏灯从此有了主人。它还是不见油少，只是每晚亮得比前一晚更稳一点。'
      ])
    }
  ];

  var LOCKED_1 = { title: '星轨残页', author: '佚名', tag: '待解封' };
  var LOCKED_2 = { title: '铜门之后', author: '佚名', tag: '待解封' };

  OW.DATA = {
    chapters: CH,

    seedBooks: function () {
      return [
        {
          id: 'b-lamp', sample: true, locked: false,
          title: '第七盏灯', author: '佚名·抄经室辑录',
          sub: '一本等人开口的书',
          hue: 0,
          chapters: CH,
          page: 0,
          inscriptions: [],
          bookmarks: [],
          finale: '',
          signed: null,
          firstInsDone: false
        },
        {
          id: 'b-star', sample: true, locked: true,
          title: LOCKED_1.title, author: LOCKED_1.author, sub: '尚未解封',
          hue: 1, chapters: [], page: 0, inscriptions: [], bookmarks: [],
          finale: '', signed: null, firstInsDone: false
        },
        {
          id: 'b-door', sample: true, locked: true,
          title: LOCKED_2.title, author: LOCKED_2.author, sub: '尚未解封',
          hue: 2, chapters: [], page: 0, inscriptions: [], bookmarks: [],
          finale: '', signed: null, firstInsDone: false
        }
      ];
    },

    /* ------------------------------------------------------------------
       ?demo=1（§6.2）：预置「四类铭文各一条」+ 预填终章。
       演示数据写进独立的 storage key，不污染正常数据。
       发布按钮仍必须由演示者真实点击 —— 这里绝不预置 signed。
       ------------------------------------------------------------------ */
    applyDemo: function (S) {
      var b = null;
      for (var i = 0; i < S.books.length; i++) if (S.books[i].id === 'b-lamp') b = S.books[i];
      if (!b) return;

      S.firstRun = (S.reader == null);       // 可恢复「首次使用」状态
      b.page = 1;
      b.firstInsDone = true;                 // 演示时不重复弹第一枚铭文仪式

      var seed = [
        { ch: 1, para: 1, quote: '不是被吸走，是被读走', kind: 'echo',
          body: '「被读走」这三个字让我停了很久。原来写下去不是留下，是交出去。' },
        { ch: 1, para: 0, quote: '纸面干净得反常', kind: 'query',
          body: '真的干净吗？还是前面的人写过、又被读走了？作者在这里没有说实话。' },
        { ch: 1, para: 3, quote: '这本书一直在等有人先开口', kind: 'link',
          body: '像我读过的另一本书里那句：门不上锁，只是没人推。' },
        { ch: 2, para: 2, quote: '空格是留给下一个值夜人的', kind: 'cont',
          body: '于是第八个人来了。她没有写名字，她把空格又往下挪了一行。' }
      ];

      b.inscriptions = [];
      seed.forEach(function (s, n) {
        var chap = b.chapters[s.ch];
        if (!chap) return;
        var txt = chap.paras[s.para] || '';
        var at = txt.indexOf(s.quote);
        if (at < 0) return;
        b.inscriptions.push({
          id: 'demo-' + n, at: Date.now() - (4 - n) * 60000,
          ch: s.ch, para: s.para, s: at, e: at + s.quote.length,
          quote: s.quote, kind: s.kind, body: s.body
        });
      });

      b.bookmarks = [{ ch: 1, para: 1, text: '墨落纸上，字迹缓慢散开', at: Date.now() }];

      b.finale = '我原以为读完一本书就是把它放回架上。第七盏灯告诉我不是的：'
               + '起头的人只写了一半，剩下一半要我在页边补齐。我不打算改掉扉页上的名字，'
               + '我只在它下面留一格，写上我自己的。';
    }
  };
})(window);
