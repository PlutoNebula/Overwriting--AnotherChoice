import { useEffect, useLayoutEffect, useRef } from 'react'
import { useAnimationFrame, type MotionValue } from 'framer-motion'
import { ROUGH_SEGMENTS, ROUGH_TOTAL } from '../paths'
import type { IntroPhase } from '../phases'

/**
 * 魔法线稿绘制引擎（v3）。
 *
 * 与 v1 的变化：
 * 1. 羽毛笔依次画出书体结构、角花、文字与星盘（约 4.2s）；
 * 2. 每条线有两层：低透明度的宽"能量晕"底描 + 主笔触，营造魔法笔触感；
 * 3. 笔尖朝向跟随运动路径切线（采样前方一点算方向角，平滑过渡）。
 *
 * 原理不变：dasharray/dashoffset 逐段放出线条，
 * getPointAtLength 采样"画到哪"写入笔尖坐标，保证笔尖贴线。
 */

interface Props {
  phase: IntroPhase
  tipX: MotionValue<number>
  tipY: MotionValue<number>
  tipR: MotionValue<number>
  onDrawn: () => void
  reduced: boolean
}

interface SegMeta {
  len: number
  sx: number
  sy: number
  ex: number
  ey: number
}

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t))

export function BookLines({ phase, tipX, tipY, tipR, onDrawn, reduced }: Props) {
  const mains = useRef<(SVGPathElement | null)[]>([])
  const echoes = useRef<(SVGPathElement | null)[]>([])
  const meta = useRef<SegMeta[]>([])
  const startRef = useRef<number | null>(null)
  const doneRef = useRef(false)
  const curR = useRef(-6) // 平滑后的笔尖倾角

  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const onDrawnRef = useRef(onDrawn)
  onDrawnRef.current = onDrawn

  /* 测长并把所有粗线初始化为"未画出" */
  useLayoutEffect(() => {
    meta.current = mains.current.map((el, i) => {
      if (!el) return { len: 0, sx: 0, sy: 0, ex: 0, ey: 0 }
      const len = el.getTotalLength()
      const set = (p: SVGPathElement | null) => {
        p?.setAttribute('stroke-dasharray', `${len}`)
        p?.setAttribute('stroke-dashoffset', `${len}`)
      }
      set(el)
      set(echoes.current[i])
      const s = el.getPointAtLength(0)
      const e = el.getPointAtLength(len)
      return { len, sx: s.x, sy: s.y, ex: e.x, ey: e.y }
    })
  }, [])

  /* 减少动画模式：跳过绘制表演（粗线随后会被扫光遮罩整体隐去，无需补画） */
  useEffect(() => {
    if (reduced && phase === 'bookMaterializing') doneRef.current = true
  }, [phase, reduced])

  const setOffset = (i: number, v: string) => {
    mains.current[i]?.setAttribute('stroke-dashoffset', v)
    echoes.current[i]?.setAttribute('stroke-dashoffset', v)
  }

  useAnimationFrame((tMs) => {
    if (phaseRef.current !== 'drawing' || doneRef.current) {
      if (phaseRef.current !== 'drawing') startRef.current = null
      return
    }
    if (startRef.current === null) startRef.current = tMs
    const elapsed = (tMs - startRef.current) / 1000

    let tip: { x: number; y: number } | null = null
    let targetR = -6

    for (let i = 0; i < ROUGH_SEGMENTS.length; i++) {
      const seg = ROUGH_SEGMENTS[i]
      const el = mains.current[i]
      const m = meta.current[i]
      if (!el || !m || m.len === 0) continue

      if (elapsed >= seg.end) {
        setOffset(i, '0')
        continue
      }

      if (elapsed >= seg.start) {
        // 正在画：放出线条，笔尖贴线，朝向跟随切线
        const p = (elapsed - seg.start) / seg.duration
        const at = m.len * p
        setOffset(i, `${m.len * (1 - p)}`)
        const pt = el.getPointAtLength(at)
        const ahead = el.getPointAtLength(Math.min(m.len, at + 4))
        tip = { x: pt.x, y: pt.y }
        // 切线方向 → 笔杆倾角：向右画身体右倾，向左画左倾，幅度收敛
        const dx = ahead.x - pt.x
        const dy = ahead.y - pt.y
        const dist = Math.hypot(dx, dy)
        if (dist > 0.01) {
          targetR = -6 + (dx / dist) * 13 + (dy / dist) * 5
        }
      } else {
        // 提笔间隔：飞向下一笔起点并微微抬起
        const prev = i > 0 ? ROUGH_SEGMENTS[i - 1] : null
        const prevM = i > 0 ? meta.current[i - 1] : null
        const gapStart = prev ? prev.end : 0
        const gp = seg.start > gapStart ? (elapsed - gapStart) / (seg.start - gapStart) : 1
        const e = smooth(gp)
        const fx = prevM ? prevM.ex : m.sx
        const fy = prevM ? prevM.ey : m.sy
        tip = {
          x: fx + (m.sx - fx) * e,
          y: fy + (m.sy - fy) * e - Math.sin(Math.PI * Math.min(Math.max(gp, 0), 1)) * 16,
        }
      }
      break
    }

    if (tip) {
      tipX.set(tip.x)
      tipY.set(tip.y)
      // 平滑逼近目标倾角 + 轻微手写抖动
      curR.current += (targetR - curR.current) * 0.22
      tipR.set(curR.current + Math.sin(elapsed * 15) * 1.6)
    }

    if (elapsed >= ROUGH_TOTAL + 0.1) {
      doneRef.current = true
      ROUGH_SEGMENTS.forEach((_, i) => setOffset(i, '0'))
      onDrawnRef.current()
    }
  })

  /*
   * 线稿完成时先整体充能一次，再由中央向外逐渐融入成品书。
   * conceal 遮罩与成品的 reveal 遮罩使用同一个扩散半径，保证两层原位交接。
   */
  return (
    <g
      mask="url(#bookConceal)"
      className={phase === 'bookMaterializing' ? 'book-lines book-lines--charged' : 'book-lines'}
    >
      {ROUGH_SEGMENTS.map((s, i) => (
        <g key={s.id}>
          {/* 能量晕底描 */}
          <path
            ref={(el) => {
              echoes.current[i] = el
            }}
            d={s.d}
            stroke={s.color}
            strokeWidth={s.width * 2.6}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.2"
          />
          {/* 主笔触 */}
          <path
            ref={(el) => {
              mains.current[i] = el
            }}
            d={s.d}
            stroke={s.color}
            strokeWidth={s.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
          />
        </g>
      ))}
    </g>
  )
}
