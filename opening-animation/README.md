# 《覆写：故事新编》独立开场动画

本目录只包含开场动画，不包含书库、阅读器、数据库或其他正式主页面。

## 本地运行

```bash
npm install
npm run dev
```

打开终端显示的本地地址即可预览。

## 操作方式

- 点击右上角羽毛笔或按 `Enter`：开始绘制。
- 动画播放过程中按 `Esc` 或点击“跳过”：立即结束。
- 标题停留页按任意键或点击 `Press any key to start`：放大进入书页。
- 地址增加 `?autoplay=1`：约 0.6 秒后自动开始，适合录屏。

## 接入正式前端

动画组件是 `src/intro/IntroScene.tsx`，只需要传入结束回调：

```tsx
<IntroScene onComplete={() => 切换到正式主页面()} />
```

独立演示入口在动画结束时还会派发浏览器事件：

```js
window.addEventListener('overwriting:intro-complete', () => {
  // 在这里进入正式主页面
})
```

## 构建

```bash
npm run build
```

构建产物位于 `dist/`，已使用相对资源路径，可供静态托管或后续桌面程序打包。

