/**
 * 开场动画的阶段定义与关键位置常量。
 * 所有坐标均基于 SVG viewBox "0 0 1600 900"。
 *
 * v3 节奏（从点击起约 7s）：
 *   idle → quillRising(0.8s) → drawing(结构线与装饰线 ~4.2s)
 *   → bookMaterializing(线稿展示/充能 0.62s + 魔法扩散 0.95s + 停留 0.2s)
 *   → entering(标题显现 1.1s) → awaitingStart(等待任意键)
 *   → divingIn(镜头深入书页 1.25s) → completed
 */
export type IntroPhase =
  | 'idle'
  | 'quillRising'
  | 'drawing'
  | 'bookMaterializing'
  | 'entering'
  | 'awaitingStart'
  | 'divingIn'
  | 'completed'

/** 羽毛笔在笔架上的初始位置（笔尖坐标）与倾角 */
export const QUILL_REST = { x: 1300, y: 265, r: 20 }

/** 绘制起点 = 粗线书脊的起点 */
export const DRAW_START = { x: 800, y: 298 }

/** 绘制完成后羽毛笔悬停在书页上方的位置 */
export const QUILL_HOVER = { x: 878, y: 268, r: 8 }

/** 各阶段时长（秒） */
export const PHASE_SECONDS = {
  quillRising: 0.8,
  /** 线稿完成后的短暂充能脉冲 */
  chargeHold: 0.62,
  /** 魔法由书心向外扩散，线稿逐渐变成实体书 */
  refineSweep: 0.95,
  /** 完整书停留 */
  refineHold: 0.2,
  /** 成品书轻微靠近并显示标题 */
  entering: 1.1,
  /** 用户确认后，镜头大幅靠近书页并进入主页面 */
  diveIn: 1.25,
} as const
