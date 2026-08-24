/**
 * 右上角的黄铜笔架（静态装饰）。
 * 位置与 phases.ts 中 QUILL_REST 对应：羽毛笔斜靠在托架上。
 * 【占位素材】手写 SVG，以后可替换为美术资源。
 */
export function PenStand() {
  return (
    <g>
      {/* 底座 */}
      <ellipse cx="1331" cy="268" rx="42" ry="9" fill="#4a3a1c" />
      <ellipse cx="1331" cy="264" rx="42" ry="9" fill="#7a5f2b" />
      <ellipse cx="1331" cy="264" rx="30" ry="6" fill="#8f7136" />
      {/* 立柱 */}
      <path d="M 1331 262 L 1331 228" stroke="#7a5f2b" strokeWidth="5" strokeLinecap="round" />
      <path d="M 1331 258 L 1331 230" stroke="#a3823f" strokeWidth="2" strokeLinecap="round" />
      {/* 月牙托架（羽毛笔杆靠在这里） */}
      <path
        d="M 1314 212 Q 1331 230 1350 210"
        stroke="#8f7136"
        strokeWidth="5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 1314 212 Q 1331 228 1350 210"
        stroke="#c2a45a"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* 底座高光 */}
      <path d="M 1300 262 Q 1331 256 1362 262" stroke="#c2a45a" strokeWidth="1" fill="none" opacity="0.6" />
    </g>
  )
}
