/**
 * 魔法书路径数据（v3：结构线 + 装饰线 + 成品书三层）。
 *
 * 本轮"粗线变精线"结构：
 * - ROUGH_SEGMENTS：羽毛笔依次画出书体结构、页框、角花、文字与星盘（约 4.2 秒）
 * - FINE_*：完整精细书（准确轮廓、页厚、翘角、包角、符文、文字线、羊皮纸材质）
 *   精细层不逐笔绘制，而是被"魔法扫光"遮罩从左到右揭示；
 *   扫光前沿经过处：粗线隐去（bookConceal 遮罩）、精线与材质显现（bookReveal 遮罩）。
 */

/** 墨色与强调色：深蓝紫 / 暮金 / 暮紫 / 蓝绿为主，暗红只做 ≤10% 点缀。
 *  绘本风：明度与纯净度整体上调，避免"旧物"式的灰暗棕调。 */
export const INK = {
  gold: '#e3b458', // 暮金（粗线魔法笔触）
  goldFine: '#c69940', // 暮金深（精细轮廓）
  goldSoft: '#b08d4a', // 淡金（文字线）
  brass: '#a5813a', // 黄铜（装饰）
  purple: '#9a74d8', // 暮紫（粗页边线）
  purpleFine: '#7a58b8', // 暮紫深（精细页边线）
  teal: '#3f96a5', // 蓝绿（符文）
  red: '#8a3f4d', // 暮红（丝带/节点，点缀用）
} as const

export interface DrawSegment {
  id: string
  d: string
  color: string
  width: number
  duration: number
  gapBefore: number
}

export interface ScheduledSegment extends DrawSegment {
  start: number
  end: number
}

/* ---------------- 魔法线稿（羽毛笔绘制，~3.4s） ---------------- */
/*
 * 顺序刻意从“大结构”过渡到“小装饰”：
 * 书脊/封皮/书页 → 双层页框 → 四角花纹 → 文字 → 星盘 → 书签。
 * 这样观众能明确看见一本空白书逐渐变成魔法典籍，而不是只看到五条轮廓线。
 */

const roughRaw: DrawSegment[] = [
  // 第一组：书的骨架
  { id: 'rSpine', d: 'M 800 298 C 807 372 795 556 801 664', color: INK.gold, width: 4.2, duration: 0.24, gapBefore: 0 },
  {
    id: 'rCover',
    d: 'M 800 286 C 696 264 566 268 480 297 L 474 632 C 568 669 694 676 800 679 C 906 676 1032 669 1126 632 L 1120 297 C 1034 268 904 264 800 286',
    color: INK.gold,
    width: 3.8,
    duration: 0.36,
    gapBefore: 0.04,
  },
  {
    id: 'rLeft',
    d: 'M 799 303 C 706 279 585 284 494 310 L 487 618 C 574 652 697 660 800 664',
    color: INK.gold,
    width: 3.8,
    duration: 0.3,
    gapBefore: 0.03,
  },
  {
    id: 'rRight',
    d: 'M 801 303 C 896 280 1017 283 1106 309 L 1113 619 C 1024 653 903 659 800 664',
    color: INK.gold,
    width: 3.8,
    duration: 0.3,
    gapBefore: 0.03,
  },

  // 第二组：双层页框
  {
    id: 'rLeftMargin',
    d: 'M 776 334 C 699 317 601 320 526 338 L 521 594 C 600 619 700 625 776 632',
    color: INK.purple,
    width: 2.8,
    duration: 0.22,
    gapBefore: 0.03,
  },
  {
    id: 'rRightMargin',
    d: 'M 824 334 C 901 317 999 320 1074 338 L 1079 594 C 1000 619 900 625 824 632',
    color: INK.purple,
    width: 2.8,
    duration: 0.22,
    gapBefore: 0.03,
  },

  // 第三组：四角卷草花纹（与终态书页角饰位置呼应）
  { id: 'rCornerTL', d: 'M 526 356 C 540 334 562 328 584 330 C 568 338 558 349 552 364 C 545 352 537 351 526 356', color: INK.goldFine, width: 2.4, duration: 0.1, gapBefore: 0.03 },
  { id: 'rCornerTR', d: 'M 1074 356 C 1060 334 1038 328 1016 330 C 1032 338 1042 349 1048 364 C 1055 352 1063 351 1074 356', color: INK.goldFine, width: 2.4, duration: 0.1, gapBefore: 0.03 },
  { id: 'rCornerBL', d: 'M 526 576 C 540 604 562 612 584 610 C 567 602 557 590 552 574 C 544 587 536 586 526 576', color: INK.goldFine, width: 2.4, duration: 0.1, gapBefore: 0.03 },
  { id: 'rCornerBR', d: 'M 1074 576 C 1060 604 1038 612 1016 610 C 1033 602 1043 590 1048 574 C 1056 587 1064 586 1074 576', color: INK.goldFine, width: 2.4, duration: 0.1, gapBefore: 0.03 },

  // 第四组：左页文字线，像刚刚落笔的故事开端
  { id: 'rText1', d: 'M 566 402 C 616 398 682 398 744 402', color: INK.goldSoft, width: 1.8, duration: 0.08, gapBefore: 0.02 },
  { id: 'rText2', d: 'M 566 432 C 626 428 690 429 730 433', color: INK.goldSoft, width: 1.8, duration: 0.08, gapBefore: 0.02 },
  { id: 'rText3', d: 'M 566 462 C 610 458 668 459 718 463', color: INK.goldSoft, width: 1.8, duration: 0.08, gapBefore: 0.02 },

  // 第五组：右页星盘。圆环、内环、罗盘星和月相逐层出现。
  { id: 'rRuneOuter', d: 'M 960 376 A 92 92 0 1 1 959.9 376', color: INK.teal, width: 2.5, duration: 0.18, gapBefore: 0.03 },
  { id: 'rRuneInner', d: 'M 960 402 A 66 66 0 1 1 959.9 402', color: INK.purple, width: 2.1, duration: 0.14, gapBefore: 0.02 },
  { id: 'rCompass', d: 'M 960 416 L 970 454 L 1008 464 L 970 474 L 960 512 L 950 474 L 912 464 L 950 454 Z', color: INK.gold, width: 2.3, duration: 0.15, gapBefore: 0.02 },
  { id: 'rMoon', d: 'M 944 398 A 20 20 0 1 0 976 398 A 16 16 0 0 1 944 398 M 948 528 A 18 18 0 1 1 974 528 A 14 14 0 0 0 948 528', color: INK.teal, width: 2, duration: 0.1, gapBefore: 0.02 },

  // 最后一笔：酒红书签，把视线带回书脊中央。
  { id: 'rBookmark', d: 'M 802 664 L 802 714 L 792 701 M 802 714 L 812 701', color: INK.red, width: 2.6, duration: 0.12, gapBefore: 0.03 },
]

/**
 * 统一的绘制减速系数。1.22 表示每一笔及提笔移动都比原版慢约 22%。
 * 集中控制速度，之后调整节奏时不需要逐条修改二十多段路径。
 */
const DRAW_TIME_SCALE = 1.22

let cursor = 0
export const ROUGH_SEGMENTS: ScheduledSegment[] = roughRaw.map((s) => {
  const gapBefore = s.gapBefore * DRAW_TIME_SCALE
  const duration = s.duration * DRAW_TIME_SCALE
  cursor += gapBefore
  const start = cursor
  cursor += duration
  return { ...s, gapBefore, duration, start, end: cursor }
})

/** 魔法线稿绘制总时长（约 4.2s） */
export const ROUGH_TOTAL = cursor

/* ---------------- 精细层：准确轮廓与装饰线 ---------------- */

export const SPINE_D = 'M 800 302 C 803 390 803 570 800 662'
export const LEFT_OUTLINE_D =
  'M 800 302 C 700 282 578 282 496 308 L 490 620 C 578 650 700 656 800 662'
export const RIGHT_OUTLINE_D =
  'M 800 302 C 900 282 1022 282 1104 308 L 1110 620 C 1022 650 900 656 800 662'

export interface FineLine {
  d: string
  color: string
  width: number
  opacity?: number
}

export const FINE_LINES: FineLine[] = [
  // 主轮廓（准确、细致）
  { d: SPINE_D, color: INK.goldFine, width: 2.6 },
  { d: LEFT_OUTLINE_D, color: INK.goldFine, width: 2.6 },
  { d: RIGHT_OUTLINE_D, color: INK.goldFine, width: 2.6 },
  // 页边装饰线（暮紫）
  {
    d: 'M 778 332 C 700 318 600 318 524 336 L 519 596 C 600 620 700 626 778 634',
    color: INK.purpleFine,
    width: 1.8,
  },
  {
    d: 'M 822 332 C 900 318 1000 318 1076 336 L 1081 596 C 1000 620 900 626 822 634',
    color: INK.purpleFine,
    width: 1.8,
  },
  // 四角优雅圆弧（替代生硬折角）
  { d: 'M 506 346 A 34 34 0 0 1 540 315', color: INK.brass, width: 2 },
  { d: 'M 1094 346 A 34 34 0 0 0 1060 315', color: INK.brass, width: 2 },
  { d: 'M 506 582 A 34 34 0 0 0 540 613', color: INK.brass, width: 2 },
  { d: 'M 1094 582 A 34 34 0 0 1 1060 613', color: INK.brass, width: 2 },
  // 中央符文（蓝绿）
  {
    d: 'M 950 418 A 50 50 0 1 1 950 518 A 50 50 0 1 1 950 418',
    color: INK.teal,
    width: 2.2,
  },
  {
    d: 'M 950 434 L 982 494 L 918 494 L 950 434 M 950 500 L 950 510 M 906 452 L 896 446 M 994 452 L 1004 446',
    color: INK.teal,
    width: 1.8,
  },
  // 书签丝带（暗红点缀）
  {
    d: 'M 804 662 L 804 700 M 804 700 L 797 713 M 804 700 L 811 713',
    color: INK.red,
    width: 2.2,
  },
  // 文字线（左页四行 + 右页两行）
  { d: 'M 560 396 L 742 392', color: INK.goldSoft, width: 1.5 },
  { d: 'M 560 428 L 742 424', color: INK.goldSoft, width: 1.5 },
  { d: 'M 560 460 L 718 456', color: INK.goldSoft, width: 1.5 },
  { d: 'M 560 492 L 742 488', color: INK.goldSoft, width: 1.5 },
  { d: 'M 872 556 L 1040 552', color: INK.goldSoft, width: 1.5 },
  { d: 'M 872 586 L 1014 582', color: INK.goldSoft, width: 1.5 },
  // 页边厚度线（书页下方的纸摞边缘，两侧各两条）
  { d: 'M 493 626 C 578 656 700 662 800 668', color: '#c8b183', width: 1.2, opacity: 0.8 },
  { d: 'M 497 632 C 580 661 702 667 799 672', color: '#b39d72', width: 1.1, opacity: 0.65 },
  { d: 'M 1107 626 C 1022 656 900 662 800 668', color: '#c8b183', width: 1.2, opacity: 0.8 },
  { d: 'M 1103 632 C 1020 661 898 667 801 672', color: '#b39d72', width: 1.1, opacity: 0.65 },
  // 页侧短厚度刻线
  { d: 'M 487 615 L 484 622 M 490 606 L 486 612', color: '#c8b183', width: 1.1, opacity: 0.7 },
  { d: 'M 1113 615 L 1116 622 M 1110 606 L 1114 612', color: '#c8b183', width: 1.1, opacity: 0.7 },
]

/** 页边中点的金色菱形装饰节点 */
export const GOLD_DIAMONDS: string[] = [
  'M 507 462 L 513 470 L 507 478 L 501 470 Z',
  'M 1093 462 L 1099 470 L 1093 478 L 1087 470 Z',
]

/** 暗红符文节点（书脊上下端 + 符文中心），红色总量控制在 ~10% */
export const RED_NODES: { cx: number; cy: number; r: number }[] = [
  { cx: 800, cy: 294, r: 2.6 },
  { cx: 800, cy: 670, r: 2.6 },
  { cx: 950, cy: 468, r: 3 },
]

/* ---------------- 实体化填充形状 ---------------- */

/** 深色皮革封面（比页面略大一圈） */
export const LEATHER_D =
  'M 800 290 C 694 269 570 269 484 299 L 477 629 C 570 663 694 671 800 675 C 906 671 1030 663 1123 629 L 1116 299 C 1030 269 906 269 800 290 Z'

/** 左右书页纸面 */
export const LEFT_PAGE_D =
  'M 800 302 C 700 282 578 282 496 308 L 490 620 C 578 650 700 656 800 662 Z'
export const RIGHT_PAGE_D =
  'M 800 302 C 900 282 1022 282 1104 308 L 1110 620 C 1022 650 900 656 800 662 Z'

/** 书脊中缝阴影带 */
export const SPINE_SHADE_D = 'M 758 300 L 842 300 L 842 664 L 758 664 Z'

/** 轻微翘角（右页右上、左页左下），带高光的小翻边 */
export const CURL_TR_D =
  'M 1104 308 C 1090 312 1076 313 1064 312 C 1072 322 1086 326 1098 322 Z'
export const CURL_BL_D =
  'M 490 620 C 504 617 518 617 530 619 C 522 628 508 631 496 628 Z'

/** 黄铜包角（实心） */
export const BRASS_CORNERS: string[] = [
  'M 496 308 L 490 340 L 534 314 Z',
  'M 490 620 L 496 588 L 534 614 Z',
  'M 1104 308 L 1110 340 L 1066 314 Z',
  'M 1110 620 L 1104 588 L 1066 614 Z',
]

/** 摊开书的视觉中心（镜头推进缩放原点） */
export const BOOK_CENTER = { x: 800, y: 482 }
