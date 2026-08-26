import quillUrl from '../../assets/art/quill-fine.png'

/**
 * 精致羽毛笔（产品负责人提供的透明 PNG 素材，直接使用，不再手绘 SVG）。
 *
 * 锚点约定（与动画系统一致）：本组件局部坐标的 (0,0) = 金属笔尖尖端。
 * 原图 1024x1536，笔尖位于像素 (92, 1508)；
 * 显示宽度 W=130（保持原比例，高 195），
 * 因此 image 放置在 x = -92/1024*W, y = -1508/1536*H 处，
 * 外层的 translate(qx qy) rotate(qr) 即以笔尖为运动与旋转锚点。
 */

/** 显示宽度（viewBox 单位）。保持原始宽高比 1024:1536 = 2:3 */
const W = 130
const H = (W * 1536) / 1024 // = 195
/** 笔尖在原图中的像素位置 */
const TIP_PX = { x: 92, y: 1508 }

export function QuillPen() {
  return (
    <g className="quill-art">
      <image
        href={quillUrl}
        x={(-TIP_PX.x / 1024) * W}
        y={(-TIP_PX.y / 1536) * H}
        width={W}
        height={H}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  )
}
