import { useRef } from 'react'
import { useAnimationFrame, type MotionValue } from 'framer-motion'
import type { IntroPhase } from '../phases'

/**
 * 笔尖魔法微粒：克制的粒子池（28 个，远低于 40 上限）。
 * 每个粒子循环"在笔尖出生 → 缓缓上浮 → 淡出"，
 * 直接改写 SVG 属性，不触发 React 重渲染，性能开销极小。
 */

const COUNT = 28
const COLORS = ['#e8b954', '#f3d98c', '#c9762f', '#efe3c0']
/** 暗红火星的出现概率（红色只做点缀，控制在 10% 以下） */
const RED_CHANCE = 0.08
const RED = '#a03838'

interface Particle {
  dur: number // 单次生命周期时长
  offset: number // 错开出生时间
  dx: number // 水平漂移量
  dy: number // 垂直漂移量（负值 = 上浮）
  r: number
  color: string
  lastCycle: number
  sx: number // 本轮出生点
  sy: number
}

function makeParticles(): Particle[] {
  const arr: Particle[] = []
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < COUNT; i++) {
    arr.push({
      dur: 0.5 + rand() * 0.6,
      offset: rand() * 1.1,
      dx: (rand() - 0.5) * 44,
      dy: -8 - rand() * 30,
      r: 1.2 + rand() * 1.5,
      color: rand() < RED_CHANCE ? RED : COLORS[Math.floor(rand() * COLORS.length)],
      lastCycle: -1,
      sx: 0,
      sy: 0,
    })
  }
  return arr
}

interface Props {
  phase: IntroPhase
  tipX: MotionValue<number>
  tipY: MotionValue<number>
}

export function Sparks({ phase, tipX, tipY }: Props) {
  const groupRef = useRef<SVGGElement>(null)
  const ps = useRef<Particle[]>(makeParticles())
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useAnimationFrame((tMs) => {
    const g = groupRef.current
    if (!g) return
    const p = phaseRef.current
    const active = p === 'quillRising' || p === 'drawing' || p === 'bookMaterializing'
    g.setAttribute('opacity', active ? '1' : '0')
    if (!active) return

    const t = tMs / 1000
    const nodes = g.children
    ps.current.forEach((pt, i) => {
      const el = nodes[i] as SVGCircleElement | undefined
      if (!el) return
      const cycle = Math.floor((t + pt.offset) / pt.dur)
      if (cycle !== pt.lastCycle) {
        // 新一轮生命：在当前笔尖位置附近出生
        pt.lastCycle = cycle
        pt.sx = tipX.get() + (Math.random() - 0.5) * 8
        pt.sy = tipY.get() + (Math.random() - 0.5) * 8
      }
      const lt = ((t + pt.offset) % pt.dur) / pt.dur
      el.setAttribute('cx', String(pt.sx + pt.dx * lt))
      el.setAttribute('cy', String(pt.sy + pt.dy * lt))
      el.setAttribute('opacity', String((1 - lt) * 0.8))
    })
  })

  return (
    <g ref={groupRef} opacity="0">
      {ps.current.map((pt, i) => (
        <circle key={i} r={pt.r} fill={pt.color} opacity="0" />
      ))}
    </g>
  )
}
