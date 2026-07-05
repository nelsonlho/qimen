// 節氣資料 — 取自 lunar-typescript(天文法真節氣,中國標準時間)
// 一律以「naive 毫秒」表示時刻(Date.UTC 封裝年月日時分秒,不經本地時區)

import { Solar } from 'lunar-typescript'

export interface SolarTerm {
  name: string // 正體名
  ms: number // naive ms
  jdn: number // 當日日序(天數)
}

const S2T: Record<string, string> = {
  惊蛰: '驚蟄',
  谷雨: '穀雨',
  小满: '小滿',
  芒种: '芒種',
  处暑: '處暑',
}

export function naiveMs(y: number, m: number, d: number, h = 0, mi = 0, s = 0): number {
  return Date.UTC(y, m - 1, d, h, mi, s)
}

export function dayNumber(y: number, m: number, d: number): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

export function dayNumberOfMs(ms: number): number {
  return Math.floor(ms / 86400000)
}

const CJK = /^[一-鿿]+$/

/** 取 [startYear, endYear] 間全部節氣,依時刻排序 */
export function getTerms(startYear: number, endYear: number): SolarTerm[] {
  const seen = new Map<number, SolarTerm>()
  for (let y = startYear - 1; y <= endYear + 1; y++) {
    const lunar = Solar.fromYmdHms(y, 7, 1, 12, 0, 0).getLunar()
    const table = lunar.getJieQiTable()
    for (const key of Object.keys(table)) {
      if (!CJK.test(key)) continue // 略去英文別名鍵
      const s = table[key]
      const ms = naiveMs(s.getYear(), s.getMonth(), s.getDay(), s.getHour(), s.getMinute(), s.getSecond())
      if (!seen.has(ms)) {
        seen.set(ms, {
          name: S2T[key] ?? key,
          ms,
          jdn: dayNumberOfMs(ms),
        })
      }
    }
  }
  return [...seen.values()]
    .filter((t) => {
      const y = new Date(t.ms).getUTCFullYear()
      return y >= startYear - 1 && y <= endYear + 1
    })
    .sort((a, b) => a.ms - b.ms)
}
