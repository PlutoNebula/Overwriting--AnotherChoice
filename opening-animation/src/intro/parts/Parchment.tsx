/**
 * 中央大张衬纸：干净牛皮纸（产品负责人提供的视觉素材 v1）。
 * 纹理通过 path fill=pattern 裁切在衬纸轮廓内部，不会显示成矩形图片；
 * 保留轻微不规则轮廓，不加破洞、焦边、裂纹、污渍。
 */
export function Parchment() {
  const SHAPE =
    'M 360 210 C 530 196 1070 194 1242 212 C 1256 310 1258 630 1238 744 C 1070 762 530 760 364 746 C 346 630 348 310 360 210 Z'
  return (
    <g>
      {/* 落影（轻） */}
      <ellipse cx="800" cy="500" rx="480" ry="310" fill="url(#bookShadow)" opacity="0.32" />
      {/* 牛皮纸纹理（pattern 填充 = 裁切在轮廓内） */}
      <path d={SHAPE} fill="url(#kraftPat)" />
      {/* 轻微金色细线边缘 */}
      <path
        d="M 374 224 C 536 211 1064 209 1226 226 C 1239 316 1241 624 1222 730 C 1064 747 536 745 378 732 C 361 624 363 316 374 224 Z"
        fill="none"
        stroke="#c9a24a"
        strokeWidth="1.2"
        opacity="0.35"
      />
    </g>
  )
}
