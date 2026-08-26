import { motion } from 'framer-motion'
import bookUrl from '../../assets/art/magic-book-final.webp'
import { LEFT_OUTLINE_D, RIGHT_OUTLINE_D } from '../paths'

/**
 * 精致魔法书终态（混合方案 v4）。
 *
 * 动画前半段由 BookLines 用 SVG 画出书体结构与装饰细节；
 * 最后一笔完成后，本层的"魔法书终态"PNG（产品负责人提供素材，真透明）
 * 通过 bookReveal 遮罩从书心向外逐渐显现——像线稿被魔法赋予材质，
 * 同时线稿经 bookConceal 遮罩在同一范围融入成品，不会突然跳切。
 *
 * 素材本身已包含：暗紫皮革封皮、多层页边厚度、书脊下陷阴影、
 * 页面外弯、精细金色角饰、金线+紫饰页框、底部酒红书签。
 * 因此本层不再叠加 SVG 装饰（旧版的三角包角/紫色页框/横线/圆形符文全部移除），
 * 只保留贴近书体的轻落影与显色完成后的页缘能量线。
 *
 * 对齐：PNG 内容包围盒 (8,34)-(1526,1000)，内容中心 (767,517)/1536x1024。
 * 显示宽 W=680 保持原比例，内容中心对齐画面书心 (800,482)。
 */

/** 显示尺寸（viewBox 单位），保持 1536:1024 原始比例 */
const W = 680
const H = (W * 1024) / 1536 // ≈ 453
/** PNG 内容中心（原图像素） → 对齐到书心 (800, 482) */
const CX = 767 / 1536
const CY = 517 / 1024
const X = 800 - CX * W
const Y = 482 - CY * H

interface Props {
  visible: boolean
  /** 页缘能量流线是否点亮（扫光完成后开启） */
  energized: boolean
}

export function BookBody({ visible, energized }: Props) {
  if (!visible) return null
  return (
    <g mask="url(#bookReveal)">
      {/* 贴近书体的轻落影（椭圆贴着书底，不做大片模糊黑影） */}
      <ellipse cx="800" cy="668" rx="330" ry="34" fill="url(#bookShadow)" opacity="0.65" />
      {/* 精致魔法书终态（保持原比例，无变形） */}
      <image href={bookUrl} x={X} y={Y} width={W} height={H} preserveAspectRatio="xMidYMid meet" />
      {/* 页缘流动的魔法能量线（扫光完成后点亮，轻量，不叠大发光） */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: energized ? 0.55 : 0 }} transition={{ duration: 0.5 }}>
        <path
          d={LEFT_OUTLINE_D}
          className="magic-flow"
          fill="none"
          stroke="url(#flowGrad)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d={RIGHT_OUTLINE_D}
          className="magic-flow magic-flow--alt"
          fill="none"
          stroke="url(#flowGrad)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </motion.g>
    </g>
  )
}
