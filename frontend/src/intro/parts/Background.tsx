/**
 * 开场动态星空。
 *
 * 视觉规则提取自团队提供的“前端页面”素材：
 * - 远星缓慢呼吸；
 * - 中星更明显地闪烁；
 * - 少量十字星芒周期性亮起；
 * - 两颗流星偶尔从左上向右下划过；
 * - 紫蓝星云只做静态氛围，不抢中央魔法书的注意力。
 *
 * 所有位置由固定种子生成，因此 React 重新渲染时星星不会跳动。
 */

type Star = {
  x: number
  y: number
  radius: number
  color: string
  duration: number
  delay: number
}

type SpikeStar = Star & {
  arm: number
  diagonal: number
  glow: number
}

/** 固定种子的伪随机数，保证每次打开都是同一片星空。 */
function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

const COOL_COLORS = ['#f4f0e2', '#d7e0ec', '#afc8dc', '#e6e0f2']
const ACCENT_COLORS = ['#c7a45a', '#65b8c7']

function makeStars(
  seed: number,
  count: number,
  minRadius: number,
  maxRadius: number,
  minDuration: number,
  maxDuration: number
): Star[] {
  const random = seededRandom(seed)

  return Array.from({ length: count }, () => {
    const accent = random() < 0.1
    return {
      x: Math.round(random() * 1600),
      y: Math.round(random() * 880),
      radius: minRadius + random() * (maxRadius - minRadius),
      color: accent
        ? ACCENT_COLORS[Math.floor(random() * ACCENT_COLORS.length)]
        : COOL_COLORS[Math.floor(random() * COOL_COLORS.length)],
      duration: minDuration + random() * (maxDuration - minDuration),
      delay: random() * maxDuration,
    }
  })
}

function makeSpikeStars(): SpikeStar[] {
  const random = seededRandom(93)
  return Array.from({ length: 18 }, () => {
    const radius = 1.8 + random() * 1.35
    return {
      x: Math.round(random() * 1600),
      y: Math.round(random() * 860),
      radius,
      color: '#f4f0e2',
      duration: 3.2 + random() * 3.2,
      delay: random() * 5.5,
      glow: radius * 4.2,
      arm: radius * 7,
      diagonal: radius * 3.8,
    }
  })
}

const FAR_STARS = makeStars(41, 138, 0.45, 1.05, 4.2, 8.5)
const MID_STARS = makeStars(67, 76, 1.05, 2.05, 2.8, 5.6)
const SPIKE_STARS = makeSpikeStars()

export function Background() {
  return (
    <g className="starfield" aria-hidden="true">
      <defs>
        <radialGradient id="skyBase" cx="50%" cy="42%" r="76%">
          <stop offset="0" stopColor="#281b4a" />
          <stop offset="0.5" stopColor="#130d2c" />
          <stop offset="1" stopColor="#070813" />
        </radialGradient>
        <radialGradient id="nebulaLeft">
          <stop offset="0" stopColor="#6e4ea1" stopOpacity="0.28" />
          <stop offset="0.48" stopColor="#3c2d71" stopOpacity="0.13" />
          <stop offset="1" stopColor="#241735" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebulaRight">
          <stop offset="0" stopColor="#315d78" stopOpacity="0.2" />
          <stop offset="0.5" stopColor="#2c3868" stopOpacity="0.1" />
          <stop offset="1" stopColor="#15152c" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="skyCenterLight">
          <stop offset="0" stopColor="#d3c6ff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#8a6cc2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shootingTrail" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="-132" y2="-74">
          <stop offset="0" stopColor="#fff9e9" stopOpacity="0.96" />
          <stop offset="1" stopColor="#d9e6ff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="1600" height="900" fill="url(#skyBase)" />

      {/* 星云只放在两侧，中央留给羊皮纸与魔法书。 */}
      <ellipse className="star-nebula" cx="245" cy="170" rx="520" ry="360" fill="url(#nebulaLeft)" />
      <ellipse className="star-nebula" cx="1370" cy="735" rx="480" ry="330" fill="url(#nebulaRight)" />
      <ellipse className="star-nebula" cx="800" cy="425" rx="540" ry="390" fill="url(#skyCenterLight)" />

      <g className="star-layer star-layer--far">
        {FAR_STARS.map((star, index) => (
          <circle
            key={`far-${index}`}
            className="star-dot star-dot--far"
            cx={star.x}
            cy={star.y}
            r={star.radius}
            fill={star.color}
            style={{ animationDuration: `${star.duration}s`, animationDelay: `${star.delay}s` }}
          />
        ))}
      </g>

      <g className="star-layer star-layer--mid">
        {MID_STARS.map((star, index) => (
          <circle
            key={`mid-${index}`}
            className="star-dot star-dot--mid"
            cx={star.x}
            cy={star.y}
            r={star.radius}
            fill={star.color}
            style={{ animationDuration: `${star.duration}s`, animationDelay: `${star.delay}s` }}
          />
        ))}
      </g>

      <g className="star-layer star-layer--spikes">
        {SPIKE_STARS.map((star, index) => (
          <g key={`spike-${index}`} transform={`translate(${star.x} ${star.y})`}>
            <g
              className="star-spike"
              style={{ animationDuration: `${star.duration}s`, animationDelay: `${star.delay}s` }}
            >
              <circle r={star.glow} fill="#e9e6d8" fillOpacity="0.12" />
              <path
                d={`M-${star.arm} 0H${star.arm}M0 -${star.arm}V${star.arm}`}
                stroke="#f4f0e2"
                strokeWidth="0.65"
                strokeLinecap="round"
                opacity="0.88"
              />
              <path
                d={`M-${star.diagonal} ${star.diagonal}L${star.diagonal} -${star.diagonal}M-${star.diagonal} -${star.diagonal}L${star.diagonal} ${star.diagonal}`}
                stroke="#d9e6ff"
                strokeWidth="0.42"
                opacity="0.5"
              />
              <circle r={star.radius} fill={star.color} />
            </g>
          </g>
        ))}
      </g>

      {/* 外层只负责定位，内层负责位移，避免动画覆盖 SVG 的 transform。 */}
      <g className="shooting-star-anchor" transform="translate(190 155)">
        <g className="shooting-star shooting-star--one">
          <line x1="0" y1="0" x2="-132" y2="-74" stroke="url(#shootingTrail)" strokeWidth="1.7" />
          <circle r="1.7" fill="#fff9e9" />
        </g>
      </g>
      <g className="shooting-star-anchor" transform="translate(995 105)">
        <g className="shooting-star shooting-star--two">
          <line x1="0" y1="0" x2="-132" y2="-74" stroke="url(#shootingTrail)" strokeWidth="1.45" />
          <circle r="1.5" fill="#fff9e9" />
        </g>
      </g>

      {/* 轻微暗角把视线收回中央。 */}
      <rect width="1600" height="900" fill="url(#bgVign)" />
    </g>
  )
}
