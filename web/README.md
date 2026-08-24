# 《覆写：故事新编》/ OVERWRITING: ANOTHER CHOICE

西幻风沉浸式读书批注产品（黑客松初赛原型，纯前端静态网页）。

读者通过**回响、诘问、星链、续章**四类批注参与原作，最终生成署有原作者与自己名字的个人版本。

## 运行

无需构建、无依赖。任意静态服务器均可：

```
python -m http.server 8777
```

然后打开 `http://localhost:8777/index.html`。

- `?autoplay=1` — 开场动画自动播放（录屏用）
- `?demo=1` — 演示模式：预置四类铭文各一条 + 50 字以上终章（演示数据独立存储）

## 目录

```
index.html        入口
assets/css/       七页样式（tokens 变量层 → base → 各页面）
assets/js/        无框架 classic script，OW 全局命名空间
  app.js          路由 / 主题 / 确认框
  store.js        localStorage 持久化 / 完整度规则集中配置
  data.js         示例书内容
  svg.js          全部自绘 SVG（羽毛笔、魔法书、契印、封面）
  intro.js        开场动画
  library.js      书库 / 设置 / TXT 导入
  reader.js       阅读器三栏 / 六面板互斥 / 铭文系统
  finale.js       读者终章 / 发布确认
  ceremony.js     契名仪式五步 / 个人秘典
```
