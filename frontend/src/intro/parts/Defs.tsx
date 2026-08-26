import { useEffect, useRef } from 'react'
import type { MotionValue } from 'framer-motion'
import kraftUrl from '../../assets/textures/kraft-clean.webp'
import parchWarmUrl from '../../assets/textures/parchment-warm.webp'

/**
 * SVG 渐变、贴图 pattern 与扫光遮罩定义。
 * 贴图（产品负责人提供的视觉素材）只作为"材质层"填充，
 * 轮廓与动画仍由矢量控制。
 */

/** 静态渐变与纸张 pattern */
export function IntroDefs() {
  return (
    <defs>
      {/* ---- 干净牛皮纸：书本下的大张衬纸（原图 1672x941，按衬纸区域铺放） ---- */}
      <pattern id="kraftPat" patternUnits="userSpaceOnUse" x="340" y="190" width="920" height="580">
        <image href={kraftUrl} width="920" height="580" preserveAspectRatio="xMidYMid slice" />
      </pattern>

      {/* ---- 暖色羊皮纸：打开的书页（左右页取不同裁剪区，避免镜像重复感） ---- */}
      <pattern id="pageWarmL" patternUnits="userSpaceOnUse" x="480" y="280" width="660" height="420">
        <image href={parchWarmUrl} x="-60" width="780" height="440" preserveAspectRatio="xMidYMid slice" />
      </pattern>
      <pattern id="pageWarmR" patternUnits="userSpaceOnUse" x="500" y="270" width="660" height="420">
        <image href={parchWarmUrl} x="-320" y="-20" width="1000" height="563" preserveAspectRatio="xMidYMid slice" />
      </pattern>

      {/* 背景暗角与中央提亮（轻微，不盖住织物质感） */}
      <radialGradient id="bgVign" cx="0.5" cy="0.5" r="0.72">
        <stop offset="0.58" stopColor="#131426" stopOpacity="0" />
        <stop offset="1" stopColor="#131426" stopOpacity="0.34" />
      </radialGradient>
      <radialGradient id="bgLight" cx="0.5" cy="0.52" r="0.5">
        <stop offset="0" stopColor="#cdbfff" stopOpacity="0.08" />
        <stop offset="1" stopColor="#cdbfff" stopOpacity="0" />
      </radialGradient>

      {/* 书页中央提亮（保持中央干净可读） */}
      <radialGradient id="pageLight" cx="0.5" cy="0.5" r="0.6">
        <stop offset="0" stopColor="#fffaf0" stopOpacity="0.28" />
        <stop offset="1" stopColor="#fffaf0" stopOpacity="0" />
      </radialGradient>

      {/* 笔尖光点（轻金色微光，非大面积光团） */}
      <radialGradient id="tipGlow">
        <stop offset="0" stopColor="#ffd98c" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ffd98c" stopOpacity="0" />
      </radialGradient>

      {/* 书脊中缝阴影（横向：透明→深→透明） */}
      <linearGradient id="spineShade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#4a3416" stopOpacity="0" />
        <stop offset="0.5" stopColor="#3a2810" stopOpacity="0.55" />
        <stop offset="1" stopColor="#4a3416" stopOpacity="0" />
      </linearGradient>

      {/* 符文微光 */}
      <radialGradient id="runeGlow">
        <stop offset="0" stopColor="#7fd4c8" stopOpacity="0.3" />
        <stop offset="1" stopColor="#7fd4c8" stopOpacity="0" />
      </radialGradient>

      {/* 书本柔和落影 */}
      <radialGradient id="bookShadow">
        <stop offset="0" stopColor="#0c0703" stopOpacity="0.55" />
        <stop offset="1" stopColor="#0c0703" stopOpacity="0" />
      </radialGradient>

      {/* 页缘流动能量线（暮金→暮紫→蓝绿） */}
      <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#e0b45c" />
        <stop offset="0.5" stopColor="#8a63c8" />
        <stop offset="1" stopColor="#55b0a6" />
      </linearGradient>

      {/* 扫光光带：淡金→暮紫，两端透明；亮度克制，避免像扫描仪白条。 */}
      <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffd98c" stopOpacity="0" />
        <stop offset="0.32" stopColor="#f0c978" stopOpacity="0.42" />
        <stop offset="0.68" stopColor="#a98ad8" stopOpacity="0.36" />
        <stop offset="1" stopColor="#a98ad8" stopOpacity="0" />
      </linearGradient>

      {/* 扫光严格裁在精致书体范围内，不扫到衬纸和桌布。 */}
      <clipPath id="bookSweepClip">
        <rect x="458" y="250" width="684" height="458" rx="26" />
      </clipPath>

      {/* 只给窄光带一点柔边，不制造大片模糊光团。 */}
      <filter id="sweepGlow" x="-30%" y="-10%" width="160%" height="120%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>

      {/* 翘角小翻边的纸色 */}
      <linearGradient id="curlGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f2e6c4" />
        <stop offset="1" stopColor="#d8c496" />
      </linearGradient>
    </defs>
  )
}

/**
 * 魔法扩散遮罩：一个 MotionValue（0→1）同时驱动两层柔边圆形遮罩。
 * - bookReveal：从书心向外逐渐显露实体书；
 * - bookConceal：同一范围内让线稿逐渐融入实体书。
 *
 * 两个遮罩共用半径，所以不会再出现横向扫描白条，也不会发生线稿与
 * 成品书错位跳切。遮罩使用很宽的灰阶过渡，避免出现明显的圆形窗口边缘。
 */
export function SweepDefs({ sweep }: { sweep: MotionValue<number> }) {
  const revealRef = useRef<SVGCircleElement>(null)
  const concealRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const apply = () => {
      const radius = Math.max(1, sweep.get() * 1500)
      revealRef.current?.setAttribute('r', `${radius}`)
      concealRef.current?.setAttribute('r', `${radius}`)
    }
    apply()
    return sweep.on('change', apply)
  }, [sweep])

  return (
    <defs>
      <radialGradient id="revealInkGrad">
        <stop offset="0" stopColor="#fff" />
        <stop offset="0.28" stopColor="#fff" />
        <stop offset="0.58" stopColor="#c4c4c4" />
        <stop offset="0.82" stopColor="#606060" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <radialGradient id="concealInkGrad">
        <stop offset="0" stopColor="#000" />
        <stop offset="0.28" stopColor="#000" />
        <stop offset="0.58" stopColor="#3b3b3b" />
        <stop offset="0.82" stopColor="#9f9f9f" />
        <stop offset="1" stopColor="#fff" />
      </radialGradient>
      <mask id="bookReveal" maskUnits="userSpaceOnUse" x="340" y="180" width="920" height="600">
        <rect x="340" y="180" width="920" height="600" fill="#000" />
        <circle ref={revealRef} cx="800" cy="482" r="1" fill="url(#revealInkGrad)" />
      </mask>
      <mask id="bookConceal" maskUnits="userSpaceOnUse" x="340" y="180" width="920" height="600">
        <rect x="340" y="180" width="920" height="600" fill="#fff" />
        <circle ref={concealRef} cx="800" cy="482" r="1" fill="url(#concealInkGrad)" />
      </mask>
    </defs>
  )
}
