// 擇時反查:選定格局與日期範圍,掃描逐時辰之盤,列出命中時刻
// 純消費者 — 判定邏輯全在 analysis/zege/keying,此處不重複任何規則

import { analyzeChart } from './analysis'
import { computeChart } from './pan'
import { ZE_GE } from './zege'
import { KE_YING, type Luck } from './keying'
import type { DateParts, QimenOptions } from './types'

export interface GeCatalogEntry {
  name: string
  luck: Luck
  group: '九遁' | '詐假' | '三奇' | '剋應吉格'
}

function buildCatalog(): GeCatalogEntry[] {
  const list: GeCatalogEntry[] = []
  for (const [name, def] of Object.entries(ZE_GE)) {
    list.push({ name, luck: def.luck, group: name.endsWith('遁') ? '九遁' : '詐假' })
  }
  list.push(
    { name: '三奇升殿', luck: '吉', group: '三奇' },
    { name: '三奇得使', luck: '吉', group: '三奇' },
    { name: '玉女守門', luck: '吉', group: '三奇' },
  )
  const seen = new Set(list.map((e) => e.name))
  for (const ky of Object.values(KE_YING)) {
    if (ky.luck === '吉' && !seen.has(ky.name)) {
      seen.add(ky.name)
      list.push({ name: ky.name, luck: '吉', group: '剋應吉格' })
    }
  }
  return list
}

/** 可搜尋格局目錄,供 UI 生成選項 */
export const GE_CATALOG: GeCatalogEntry[] = buildCatalog()

export interface AvoidOptions {
  /** 命中宮逢空亡則棄 */
  kong?: boolean
  /** 命中宮有六儀擊刑則棄 */
  jiXing?: boolean
  /** 命中宮門迫(門剋宮)則棄 */
  menPo?: boolean
  /** 全局五不遇時則整個時辰棄 */
  wuBuYuShi?: boolean
}

export interface SearchMatch {
  name: string
  luck: Luck
  palace: number
  palaceName: string
}

export interface SearchHit {
  /** 命中時刻(可直接回填起局時間) */
  date: DateParts
  hourGZ: string
  /** 八刻法之刻序 */
  ke?: number
  matches: SearchMatch[]
}

export interface SearchOptions extends QimenOptions {
  avoid?: AvoidOptions
}

/**
 * 於 [start, start+days) 內掃描,回傳含所選格局之時刻。
 * 逐小時步進(八刻法逐刻),同局去重 — 子時跨日、換日法差異一併涵蓋。
 */
export function searchGe(
  names: string[],
  start: DateParts,
  days: number,
  options: SearchOptions = {},
): SearchHit[] {
  const want = new Set(names)
  if (want.size === 0) return []
  const { avoid = {}, ...qOpts } = options
  const stepMinutes = qOpts.method === '八刻' ? 15 : 60
  const from = new Date(start.year, start.month - 1, start.day, start.hour, start.minute)
  const to = new Date(from.getTime() + days * 86400_000)

  const hits: SearchHit[] = []
  let lastKey = ''
  for (let t = from.getTime(); t < to.getTime(); t += stepMinutes * 60_000) {
    const d = new Date(t)
    const parts: DateParts = {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    }
    let chart
    try {
      chart = computeChart(parts, qOpts)
    } catch {
      continue // 超出節氣表範圍等,略過
    }
    // 同一局僅取首個步進點(日柱+時柱+局+刻唯一定盤)
    const key = `${chart.pillars.day}|${chart.pillars.hour}|${chart.ju.dun}${chart.ju.ju}|${chart.ju.ke ?? ''}`
    if (key === lastKey) continue
    lastKey = key

    const ana = analyzeChart(chart)
    if (avoid.wuBuYuShi && ana.global.some((g) => g.name === '五不遇時')) continue

    const matches: SearchMatch[] = []
    const dedupe = new Set<string>()
    for (const pa of ana.palaces) {
      const info = chart.palaces[pa.palace - 1]
      if (avoid.kong && info.kong) continue
      if (avoid.jiXing && pa.geju.some((g) => g.name === '六儀擊刑')) continue
      if (avoid.menPo && pa.doorRelation?.key === '迫') continue
      for (const g of pa.geju) {
        if (!want.has(g.name)) continue
        const dk = `${g.name}|${pa.palace}`
        if (dedupe.has(dk)) continue
        dedupe.add(dk)
        matches.push({ name: g.name, luck: g.luck, palace: pa.palace, palaceName: info.name })
      }
    }
    if (matches.length > 0) {
      hits.push({ date: parts, hourGZ: chart.pillars.hour, ke: chart.ju.ke, matches })
    }
  }
  return hits
}
