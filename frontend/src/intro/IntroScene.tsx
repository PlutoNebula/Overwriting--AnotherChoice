import { useCallback, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion'
import type { IntroPhase } from './phases'
import { QUILL_REST, DRAW_START, QUILL_HOVER, PHASE_SECONDS } from './phases'
import { BOOK_CENTER } from './paths'
import { IntroDefs, SweepDefs } from './parts/Defs'
import { Background } from './parts/Background'
import { Parchment } from './parts/Parchment'
import { PenStand } from './parts/PenStand'
import { QuillPen } from './parts/QuillPen'
import { BookLines } from './parts/BookLines'
import { BookBody } from './parts/BookBody'
import { Sparks } from './parts/Sparks'
import { COPY, PRODUCT } from '../constants/terms'
import './intro.css'

/**
 * 开场动画总导演（v3）。
 *
 * 阶段机：idle → quillRising → drawing → bookMaterializing → entering
 *         → awaitingStart → divingIn → completed
 * - idle:              羽毛笔停在右上角笔架上，等待点击或 Enter
 * - quillRising:       羽毛笔升起并飞向画面中央 (0.8s)
 * - drawing:           笔尖画出书体结构、角花、文字和星盘 (~3.4s)
 * - bookMaterializing: 线稿先充能，再由书心向外扩散成完整魔法书；
 * - entering:          镜头轻推并显示正式产品名；
 * - awaitingStart:     标题页无限停留，等待用户按任意键；
 * - divingIn:          用户确认后大幅靠近书页，再切入正式页面。
 * - completed:         调用 onComplete，App 切换到书库
 */

interface Props {
  onComplete: () => void
}

export function IntroScene({ onComplete }: Props) {
  const [phase, setPhase] = useState<IntroPhase>('idle')
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const reduced = useReducedMotion() ?? false

  /* 羽毛笔笔尖坐标与倾角 */
  const qx = useMotionValue(QUILL_REST.x)
  const qy = useMotionValue(QUILL_REST.y)
  const qr = useMotionValue(QUILL_REST.r)
  const quillRef = useRef<SVGGElement>(null)

  /* 魔法扩散进度 0→1：同时驱动 reveal/conceal 两个圆形遮罩 */
  const sweep = useMotionValue(0)
  /* 扩散完成后点亮页缘能量线 */
  const [energized, setEnergized] = useState(false)
  useEffect(
    () =>
      sweep.on('change', (v) => {
        if (v > 0.95) setEnergized(true)
      }),
    [sweep]
  )

  /* MotionValue → SVG transform（rotate 围绕笔尖 (0,0)） */
  useEffect(() => {
    const apply = () =>
      quillRef.current?.setAttribute(
        'transform',
        `translate(${qx.get()} ${qy.get()}) rotate(${qr.get()})`
      )
    apply()
    const subs = [qx.on('change', apply), qy.on('change', apply), qr.on('change', apply)]
    return () => subs.forEach((unsub) => unsub())
  }, [qx, qy, qr])

  /* 开始动画：仅 idle 可触发 */
  const start = useCallback(() => {
    if (phaseRef.current !== 'idle') return
    if (reduced) {
      // 减少动画模式：跳过绘制与飞行动作，书直接完整显现。
      qx.set(QUILL_REST.x)
      qy.set(QUILL_REST.y)
      qr.set(QUILL_REST.r)
      sweep.set(1)
      setPhase('bookMaterializing')
      return
    }
    setPhase('quillRising')
  }, [reduced, qx, qy, qr, sweep])

  /* 跳过 */
  const skip = useCallback(() => {
    if (phaseRef.current === 'completed') return
    setPhase('completed')
  }, [])

  /** 标题停留页的确认动作：只允许触发一次。 */
  const enterBook = useCallback(() => {
    if (phaseRef.current !== 'awaitingStart') return
    setPhase('divingIn')
  }, [])

  /* 结构线与装饰线画完 → 进入魔法实体化 */
  const handleDrawn = useCallback(() => {
    if (phaseRef.current === 'drawing') setPhase('bookMaterializing')
  }, [])

  /* 阶段推进与羽毛笔编排 */
  useEffect(() => {
    if (phase === 'quillRising') {
      const anims = [
        animate(qx, [qx.get(), 1180, DRAW_START.x], { duration: PHASE_SECONDS.quillRising, ease: 'easeInOut' }),
        animate(qy, [qy.get(), 165, DRAW_START.y], { duration: PHASE_SECONDS.quillRising, ease: 'easeInOut' }),
        animate(qr, -6, { duration: PHASE_SECONDS.quillRising, ease: 'easeInOut' }),
      ]
      const t = window.setTimeout(() => setPhase('drawing'), PHASE_SECONDS.quillRising * 1000 + 50)
      return () => {
        anims.forEach((a) => a.stop())
        clearTimeout(t)
      }
    }
    if (phase === 'bookMaterializing') {
      if (reduced) {
        qx.set(QUILL_REST.x)
        qy.set(QUILL_REST.y)
        qr.set(QUILL_REST.r)
        sweep.set(1)
        const t = window.setTimeout(() => setPhase('entering'), 600)
        return () => clearTimeout(t)
      }

      // 最后一笔抬起后，羽毛笔伴随魔法扩散飞回右侧笔架。
      const anims = [
        animate(qx, [qx.get(), QUILL_HOVER.x, 1110, QUILL_REST.x], {
          duration: 1.45,
          times: [0, 0.24, 0.62, 1],
          ease: 'easeInOut',
        }),
        animate(qy, [qy.get(), QUILL_HOVER.y - 16, 190, QUILL_REST.y], {
          duration: 1.45,
          times: [0, 0.24, 0.62, 1],
          ease: 'easeInOut',
        }),
        animate(qr, [qr.get(), QUILL_HOVER.r, 14, QUILL_REST.r], {
          duration: 1.45,
          times: [0, 0.24, 0.62, 1],
          ease: 'easeInOut',
        }),
      ]
      anims.push(
        animate(sweep, 1, {
          duration: PHASE_SECONDS.refineSweep,
          delay: PHASE_SECONDS.chargeHold,
          ease: [0.22, 0.65, 0.35, 1],
        })
      )
      const total = PHASE_SECONDS.chargeHold + PHASE_SECONDS.refineSweep + PHASE_SECONDS.refineHold
      const t = window.setTimeout(() => setPhase('entering'), total * 1000)
      return () => {
        anims.forEach((a) => a.stop())
        clearTimeout(t)
      }
    }
    if (phase === 'entering') {
      const t = window.setTimeout(
        () => setPhase('awaitingStart'),
        (reduced ? 0.45 : PHASE_SECONDS.entering) * 1000
      )
      return () => clearTimeout(t)
    }
    if (phase === 'divingIn') {
      const t = window.setTimeout(
        () => setPhase('completed'),
        (reduced ? 0.45 : PHASE_SECONDS.diveIn) * 1000
      )
      return () => clearTimeout(t)
    }
    if (phase === 'completed') {
      onCompleteRef.current()
    }
  }, [phase, reduced, qx, qy, qr, sweep])

  /*
   * 键盘：
   * - 初始页用 Enter 开始绘制；
   * - 标题停留页除 Esc 外，任意按键均进入书页；
   * - Esc 在任何阶段都保留“立即跳过”的含义。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        skip()
      } else if (phaseRef.current === 'awaitingStart') {
        e.preventDefault()
        enterBook()
      } else if (e.key === 'Enter') {
        start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [start, skip, enterBook])

  /* ?autoplay=1 自动开始 */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('autoplay') === '1') {
      const t = window.setTimeout(start, 600)
      return () => clearTimeout(t)
    }
  }, [start])

  const titleSequence =
    phase === 'entering' || phase === 'awaitingStart' || phase === 'divingIn' || phase === 'completed'
  const titleVisible = phase === 'entering' || phase === 'awaitingStart'
  const waitingForStart = phase === 'awaitingStart'
  const divingIn = phase === 'divingIn' || phase === 'completed'
  const bookVisible = phase === 'bookMaterializing' || titleSequence
  const stageScale = divingIn && !reduced ? 4.6 : titleSequence && !reduced ? 1.12 : 1

  return (
    <motion.div
      className="intro-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9 }}
    >
      {/*
       * 两段镜头推进：标题出现时只轻推至 1.12 倍；用户确认后再深入到 4.6 倍，
       * 让书页真正铺满视野，再进入主页面。
       */}
      <motion.div
        className="intro-stage"
        style={{
          transformOrigin: `${(BOOK_CENTER.x / 1600) * 100}% ${(BOOK_CENTER.y / 900) * 100}%`,
        }}
        animate={{ scale: stageScale }}
        transition={{
          duration: divingIn ? (reduced ? 0.45 : PHASE_SECONDS.diveIn) : PHASE_SECONDS.entering,
          ease: divingIn ? [0.64, 0.04, 0.86, 0.48] : [0.22, 0.72, 0.28, 1],
        }}
      >
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <IntroDefs />
          <SweepDefs sweep={sweep} />
          <Background />
          <Parchment />
          <PenStand />
          {/* 精细书（由书心向外柔和显露） */}
          <BookBody visible={bookVisible} energized={energized} />
          {/* 结构与装饰线稿（实体书出现时原位融入） */}
          <BookLines
            phase={phase}
            tipX={qx}
            tipY={qy}
            tipR={qr}
            onDrawn={handleDrawn}
            reduced={reduced}
          />
          {/* 成品显色由柔边遮罩完成，不叠加可见圆环，避免出现“气泡”边界。 */}
          <Sparks phase={phase} tipX={qx} tipY={qy} />

          {/* 羽毛笔完成绘制后回到笔架，随整个开场场景一起结束。 */}
          <motion.g initial={{ opacity: 1 }} animate={{ opacity: 1 }}>
            <g
              ref={quillRef}
              transform={`translate(${QUILL_REST.x} ${QUILL_REST.y}) rotate(${QUILL_REST.r})`}
              className={phase === 'idle' ? 'quill-hit' : undefined}
              onClick={start}
            >
              <circle
                cx="55"
                cy="-105"
                r="150"
                fill="transparent"
                pointerEvents={phase === 'idle' ? 'all' : 'none'}
              />
              <g className={phase === 'idle' ? 'quill-bob' : undefined}>
                <QuillPen />
                <motion.circle
                  r="14"
                  fill="url(#tipGlow)"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase === 'idle' ? 0 : 1 }}
                  transition={{ duration: 0.4 }}
                />
                <motion.circle
                  r="3"
                  fill="#ffe3a1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase === 'idle' ? 0 : 1 }}
                  transition={{ duration: 0.4 }}
                />
              </g>
            </g>
          </motion.g>

          {/* 低调提示：执笔进入 */}
          <motion.g initial={{ opacity: 1 }} animate={{ opacity: phase === 'idle' ? 1 : 0 }} transition={{ duration: 0.5 }}>
            <text x="1331" y="322" textAnchor="middle" className="intro-hint hint-pulse">
              {COPY.enterWithPen}
            </text>
          </motion.g>
        </svg>
      </motion.div>

      {/* 入书面纱：书页放大占满屏幕时淡入羊皮纸色，避免黑屏或硬切 */}
      <motion.div
        className="enter-veil"
        initial={{ opacity: 0 }}
        animate={{ opacity: titleSequence ? 1 : 0 }}
        transition={{ duration: 0.55, delay: phase === 'entering' && !reduced ? 0.18 : 0 }}
      />
      {/* 产品名出现后保持显示，直到用户确认进入。 */}
      <motion.div
        className="enter-title"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: titleVisible ? 1 : 0, y: titleVisible ? 0 : 16 }}
        transition={{ duration: divingIn ? 0.22 : 0.6, delay: phase === 'entering' && !reduced ? 0.32 : 0 }}
      >
        <h1>{PRODUCT.name}</h1>
        <span className="english-title">{PRODUCT.nameEn}</span>
        <p>{PRODUCT.slogan}</p>
      </motion.div>

      {/* 标题稳定后才出现提示；既支持任意键，也允许鼠标点击。 */}
      <motion.button
        type="button"
        className="press-start"
        onClick={enterBook}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: waitingForStart ? 1 : 0, y: waitingForStart ? 0 : 10 }}
        transition={{ duration: 0.42 }}
        aria-label="Press any key to start"
        tabIndex={waitingForStart ? 0 : -1}
        style={{ pointerEvents: waitingForStart ? 'auto' : 'none' }}
      >
        <span>Press any key to start</span>
      </motion.button>

      {/* 深入书页末段用暖色覆盖画面，让放大后的书页自然接到正式页面。 */}
      <motion.div
        className="dive-veil"
        initial={{ opacity: 0 }}
        animate={{ opacity: divingIn ? 1 : 0 }}
        transition={{
          duration: reduced ? 0.35 : 0.48,
          delay: divingIn && !reduced ? PHASE_SECONDS.diveIn * 0.58 : 0,
        }}
      />

      {/* 右下角低调跳过按钮 */}
      <button className={`skip-btn${divingIn ? ' skip-btn--hidden' : ''}`} onClick={skip}>
        {COPY.skipOpening}
      </button>
    </motion.div>
  )
}
