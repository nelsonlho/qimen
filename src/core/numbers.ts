// 九宮之數:先天卦數、後天卦數(洛書)、五行數(河圖對)
// 先天:乾一兌二離三震四巽五坎六艮七坤八
// 後天:即宮數
// 五行數:水一六、火二七、木三八、金四九、土五十
// 取數之慣:後天為主,先天次之,五行又次;旺相取大,休囚取小

export interface PalaceNumbers {
  xianTian: number | null // 先天卦數
  houTian: number | null // 後天卦數(宮數)
  wuXing: [number, number] // 五行數
  all: number[] // 併集,由小而大
}

const XIAN_TIAN: Record<number, number> = {
  6: 1, // 乾
  7: 2, // 兌
  9: 3, // 離
  3: 4, // 震
  4: 5, // 巽
  1: 6, // 坎
  8: 7, // 艮
  2: 8, // 坤
}

const WU_XING_NUM: Record<string, [number, number]> = {
  水: [1, 6],
  火: [2, 7],
  木: [3, 8],
  金: [4, 9],
  土: [5, 10],
}

const PALACE_WUXING: Record<number, string> = {
  1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火',
}

function build(palace: number): PalaceNumbers {
  const xianTian = XIAN_TIAN[palace] ?? null
  const houTian = palace === 5 ? null : palace
  const wuXing = WU_XING_NUM[PALACE_WUXING[palace]]
  const all = [...new Set([xianTian, houTian, ...wuXing].filter((n): n is number => n !== null))].sort(
    (a, b) => a - b,
  )
  return { xianTian, houTian, wuXing, all }
}

export const PALACE_NUMBERS: Record<number, PalaceNumbers> = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => [p, build(p)]),
)
