// 擇時反查:選定條件與日期範圍,掃描逐時辰之盤,列出命中時刻
// 純消費者 — 判定邏輯全在 analysis/zege/keying/wuxing,此處不重複任何規則

import { analyzeChart } from './analysis'
import { computeChart } from './pan'
import { ZE_GE } from './zege'
import { KE_YING, type Luck } from './keying'
import {
  DOOR_ELEMENT,
  GOD_ELEMENT,
  PALACE_ELEMENT,
  STAR_ELEMENT,
  STEM_ELEMENT,
  BRANCH_ELEMENT,
  seasonStrength,
  sheng,
  type Element,
} from './wuxing'
import type { Chart, DateParts, QimenOptions } from './types'

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

export const DOOR_NAMES = Object.keys(DOOR_ELEMENT)
export const STAR_NAMES = Object.keys(STAR_ELEMENT)
export const GOD_NAMES = Object.keys(GOD_ELEMENT)

export type PillarKey = 'year' | 'month' | 'day' | 'hour'

export const PILLAR_LABEL: Record<PillarKey, string> = {
  year: '年干',
  month: '月干',
  day: '日干',
  hour: '時干',
}

/** 格局條件:格名,可限落宮、可限同宮之門 */
export interface GeCond {
  name: string
  palace?: number
  door?: string
}

/** 宮旺條件:某宮於月令須旺/相(四時旺相休囚死) */
export interface WangCond {
  palace: number
  accept: ('旺' | '相')[]
}

/** 用神:門/星/神(五行固定),或十干,或盤之四柱干 */
export type YongShen =
  | { kind: '門' | '星' | '神'; name: string }
  | { kind: '干'; stem: string }
  | { kind: '柱'; pillar: PillarKey }

/** 生之對象:盤之四柱干,或用家年命干 */
export type ShengTarget = { kind: '柱'; pillar: PillarKey } | { kind: '命'; stem: string }

/** 用神生干條件 */
export interface YongCond {
  yong: YongShen
  target: ShengTarget
}

/**
 * 查詢:ge 列擇一即可(任一命中即列),wang/yong 全須成立。
 * 三者皆空 → 空結果。
 */
export interface SearchQuery {
  ge?: GeCond[]
  wang?: WangCond[]
  yong?: YongCond[]
}

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
  kind: '格' | '旺' | '用'
  label: string
  luck?: Luck
  palace?: number
  palaceName?: string
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

function yongElement(y: YongShen, chart: Chart): Element {
  switch (y.kind) {
    case '門':
      return DOOR_ELEMENT[y.name]
    case '星':
      return STAR_ELEMENT[y.name]
    case '神':
      return GOD_ELEMENT[y.name]
    case '干':
      return STEM_ELEMENT[y.stem]
    case '柱':
      return STEM_ELEMENT[chart.pillars[y.pillar][0]]
  }
}

export function yongLabel(y: YongShen): string {
  switch (y.kind) {
    case '門':
    case '星':
    case '神':
      return y.name
    case '干':
      return y.stem
    case '柱':
      return PILLAR_LABEL[y.pillar]
  }
}

export function targetLabel(t: ShengTarget): string {
  return t.kind === '柱' ? PILLAR_LABEL[t.pillar] : `年命${t.stem}`
}

function hasQuery(q: SearchQuery): boolean {
  return (q.ge?.length ?? 0) + (q.wang?.length ?? 0) + (q.yong?.length ?? 0) > 0
}

/**
 * 於 [start, end) 內掃描,回傳滿足查詢之時刻。
 * 逐小時步進(八刻法逐刻),同局去重 — 子時跨日、換日法差異一併涵蓋。
 */
export function searchGe(
  query: SearchQuery,
  start: DateParts,
  end: DateParts,
  options: SearchOptions = {},
): SearchHit[] {
  if (!hasQuery(query)) return []
  const { avoid = {}, ...qOpts } = options
  const stepMinutes = qOpts.method === '八刻' ? 15 : 60
  const from = new Date(start.year, start.month - 1, start.day, start.hour, start.minute)
  const to = new Date(end.year, end.month - 1, end.day, end.hour, end.minute)

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

    const matches = evalChart(query, chart, avoid)
    if (matches) {
      hits.push({ date: parts, hourGZ: chart.pillars.hour, ke: chart.ju.ke, matches })
    }
  }
  return hits
}

/** 單盤判定:滿足則回傳命中列表,否則 null */
function evalChart(query: SearchQuery, chart: Chart, avoid: AvoidOptions): SearchMatch[] | null {
  const ana = analyzeChart(chart)
  if (avoid.wuBuYuShi && ana.global.some((g) => g.name === '五不遇時')) return null

  const matches: SearchMatch[] = []

  // 格局:任一條件命中即可
  if (query.ge && query.ge.length > 0) {
    const dedupe = new Set<string>()
    for (const pa of ana.palaces) {
      const info = chart.palaces[pa.palace - 1]
      if (avoid.kong && info.kong) continue
      if (avoid.jiXing && pa.geju.some((g) => g.name === '六儀擊刑')) continue
      if (avoid.menPo && pa.doorRelation?.key === '迫') continue
      for (const cond of query.ge) {
        if (cond.palace && pa.palace !== cond.palace) continue
        if (cond.door && info.door !== cond.door) continue
        const g = pa.geju.find((x) => x.name === cond.name)
        if (!g) continue
        const dk = `${cond.name}|${pa.palace}`
        if (dedupe.has(dk)) continue
        dedupe.add(dk)
        matches.push({
          kind: '格',
          label: cond.name,
          luck: g.luck,
          palace: pa.palace,
          palaceName: info.name,
        })
      }
    }
    if (matches.length === 0) return null
  }

  // 宮旺:全須成立(月令定,故同月內恆同)
  const seasonElem = BRANCH_ELEMENT[chart.pillars.month[1]]
  for (const w of query.wang ?? []) {
    const st = seasonStrength(PALACE_ELEMENT[w.palace], seasonElem)
    if (!(w.accept as string[]).includes(st)) return null
    const name = chart.palaces[w.palace - 1].name
    matches.push({ kind: '旺', label: `${name}${st}`, palace: w.palace, palaceName: name })
  }

  // 用神生干:全須成立
  for (const y of query.yong ?? []) {
    const targetStem = y.target.kind === '柱' ? chart.pillars[y.target.pillar][0] : y.target.stem
    if (!sheng(yongElement(y.yong, chart), STEM_ELEMENT[targetStem])) return null
    matches.push({ kind: '用', label: `${yongLabel(y.yong)}生${targetLabel(y.target)}` })
  }

  return matches
}
