/* ==========================================================================
   api.js — 浏览器与本地 FastAPI 的唯一通信入口
   密钥只从 localStorage 中读取并放进请求头，不写进源码、不进入请求正文。
   ========================================================================== */
(function (w) {
  'use strict';
  var OW = (w.OW = w.OW || {});
  var BACKEND = 'http://127.0.0.1:8000/api/v1';

  function wait(ms, signal) {
    return new Promise(function (resolve, reject) {
      var id = w.setTimeout(resolve, ms);
      if (!signal) return;
      signal.addEventListener('abort', function () {
        w.clearTimeout(id);
        reject(new DOMException('已取消推演', 'AbortError'));
      }, { once: true });
    });
  }

  function settings() {
    var ai = (OW.Store.get() || {}).ai || {};
    return {
      base_url: ai.baseUrl || 'https://api.deepseek.com',
      model: ai.model || 'deepseek-chat',
      timeout: Math.max(10, Math.min(120, parseInt(ai.timeout, 10) || 45))
    };
  }

  function request(path, options) {
    options = options || {};
    var ai = (OW.Store.get() || {}).ai || {};
    var controller = options.controller || new AbortController();
    var timeout = Math.max(10, Math.min(120, parseInt(ai.timeout, 10) || 45)) * 1000;
    var timer = w.setTimeout(function () { controller.abort('timeout'); }, timeout);
    return w.fetch(BACKEND + path, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AI-Key': ai.key || ''
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) throw new Error(data.detail || ('请求失败（' + res.status + '）'));
        return data;
      });
    }).catch(function (err) {
      if (err && err.name === 'AbortError') throw err;
      if (err instanceof TypeError) {
        throw new Error('未连接到本地 AI 服务，请先启动后端或使用演示模式。');
      }
      throw err;
    }).finally(function () { w.clearTimeout(timer); });
  }

  function demoResult(payload) {
    var intent = payload.intent || '让人物作出不同的选择';
    var keep = payload.must_preserve ? '同时保留“' + payload.must_preserve + '”这一约束。' : '';
    var pivot = payload.original_text || '故事在这里出现了岔路';
    if (pivot.length > 64) pivot = pivot.slice(0, 64) + '……';
    var continuing = payload.source_type === 'branch';
    return {
      title: continuing ? '翻页声后的来客' : '灯影之外的另一条路',
      content: '“' + pivot + '”之后，伊兰没有像原来的故事那样停下。她把第七盏灯移到无名书旁，' +
        '让灯焰照进那道几乎看不见的压痕。纸页先是沉默，随后浮出一行并非由墨写成的字：' +
        '每一个回答，都会替另一个人承担遗忘。她意识到，自己此前留下的痕迹并没有消失，' +
        '而是被送进了某个仍在等待回应的夜晚。她在页边写下自己的决定：' +
        intent.replace(/[。！!？?]+$/, '') + '。' + keep +
        '当她再次落笔，抄经室的六道人影同时回头，第七盏灯第一次熄灭了；黑暗里却响起了翻页声，' +
        '像有什么人终于从书的另一边走来。',
      key_changes: ['伊兰主动改变了第七盏灯的位置', '无名书揭示了“回答与遗忘”的代价', '新的来访者即将进入抄经室'],
      characters: ['伊兰', '总务修士', '书另一边的来访者'],
      next_directions: ['追查被送往其他夜晚的回答', '让来访者说出第七盏灯真正的主人', '选择是否重新点亮第七盏灯'],
      difference: '原作在署名与传承中收束；这条路线把灯的秘密转化为必须处理的现实代价。',
      conflicts: ['需要解释第七盏灯熄灭后为何仍能维持抄经室', '新人物的身份不能抹去原作者已经建立的规则'],
      model: 'demo-rewrite-v1.2',
      is_demo: true
    };
  }

  OW.Api = {
    generateRewrite: function (payload, controller) {
      if (OW.App.demo) {
        return wait(OW.reduced() ? 120 : 900, controller && controller.signal)
          .then(function () { return demoResult(payload); });
      }
      var body = {};
      for (var k in payload) body[k] = payload[k];
      body.connection = settings();
      return request('/rewrite/generate', { body: body, controller: controller });
    },
    testConnection: function (draft) {
      var ai = OW.Store.get().ai;
      var old = { baseUrl: ai.baseUrl, model: ai.model, timeout: ai.timeout, key: ai.key };
      ai.baseUrl = draft.baseUrl; ai.model = draft.model; ai.timeout = draft.timeout; ai.key = draft.key;
      return request('/ai/test', {
        body: { base_url: draft.baseUrl, model: draft.model, timeout: draft.timeout }
      }).finally(function () {
        ai.baseUrl = old.baseUrl; ai.model = old.model; ai.timeout = old.timeout; ai.key = old.key;
      });
    }
  };
})(window);
