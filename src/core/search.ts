// 擇時反查:選定條件與日期範圍,掃描逐時辰之盤,列出命中時刻
// 純消費者 — 判定邏輯全在 analysis/zege/keying/wuxing,此處不重複任何規則

import { analyzeChart, type ChartAnalysis } from './analysis'
import { computeChart } from './pan'
import { ZE_GE } from './zege'
import { KE_YING, type Luck } from './keying'
import {
  DOOR_ELEMENT,
  GOD_ELEMENT,
  PALACE_ELEMENT,
  STAR_ELEMENT,
  BRANCH_ELEMENT,
  ke,
  seasonStrength,
  sheng,
  type Element,
} from './wuxing'
import { type Stage } from './changsheng'
import type { Chart, DateParts, QimenOptions } from './types'

export interface GeCatalogEntry {
  name: string
  luck: Luck
  group: '九遁' | '詐假' | '三奇' | '剋應吉格'
  note: string
}

function buildCatalog(): GeCatalogEntry[] {
  const list: GeCatalogEntry[] = []
  for (const [name, def] of Object.entries(ZE_GE)) {
    list.push({ name, luck: def.luck, group: name.endsWith('遁') ? '九遁' : '詐假', note: def.note })
  }
  list.push(
    { name: '三奇升殿', luck: '吉', group: '三奇', note: '乙丙丁各臨本殿,貴而得位' },
    { name: '三奇得使', luck: '吉', group: '三奇', note: '奇臨其使,所謀皆遂' },
    { name: '玉女守門', luck: '吉', group: '三奇', note: '丁奇臨值使之門,百事可為' },
  )
  const seen = new Set(list.map((e) => e.name))
  for (const ky of Object.values(KE_YING)) {
    if (ky.luck === '吉' && !seen.has(ky.name)) {
      seen.add(ky.name)
      list.push({ name: ky.name, luck: '吉', group: '剋應吉格', note: ky.note })
    }
  }
  return list
}

/** 可搜尋格局目錄,供 UI 生成選項 */
export const GE_CATALOG: GeCatalogEntry[] = buildCatalog()

/** 事由 → 吉格包(輯自諸格 note 之「宜」;避忌默認全開由 UI 定) */
export const INTENT_PRESETS: { intent: string; ge: string[] }[] = [
  { intent: '經商求財', ge: ['天遁', '重詐', '物假', '獄神得奇'] },
  { intent: '婚姻嫁娶', ge: ['天遁', '人遁', '休詐', '天乙會合'] },
  { intent: '上書求名', ge: ['天假', '青龍耀明', '青龍轉光', '天遁'] },
  { intent: '修造安葬', ge: ['地遁', '神假'] },
  { intent: '和談交易', ge: ['人遁', '休詐', '物假'] },
  { intent: '隱遁避難', ge: ['雲遁', '鬼遁', '地假', '華蓋逢星'] },
  { intent: '祭祀祈福', ge: ['神遁', '神假', '雲遁'] },
  { intent: '捕捉討債', ge: ['人假', '物假'] },
]

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
  /** 必者硬濾,宜者計分;缺省宜 */
  required?: boolean
}

/**
 * 用神:門/星/神,天盤干/地盤干,盤之四柱干,或用家年命干。
 * 五行之判不涉盤位;同宮之判各依其位:地盤干取地盤所在,門星神取所在宮,餘取天盤所在。
 */
export type YongShen =
  | { kind: '門' | '星' | '神'; name: string }
  | { kind: '天盤干' | '地盤干'; stem: string }
  /** @deprecated 舊制,同「天盤干」 */
  | { kind: '干'; stem: string }
  | { kind: '柱'; pillar: PillarKey }
  | { kind: '命'; stem: string }

/** 干之指涉:盤之四柱干,或用家年命干 */
export type StemRef = { kind: '柱'; pillar: PillarKey } | { kind: '命'; stem: string }

/** @deprecated 舊名,同 StemRef */
export type ShengTarget = StemRef

/**
 * 用神與干之關係:五行生/剋/比和,同宮,或「生比和同宮」(三者任一,有情即可)。
 * 兩側可換,故無被生被剋。
 */
export type YongRelation = '生' | '比和' | '剋' | '同宮' | '生比和同宮'

/** 用神條件:兩側皆可任取用神,互為生剋比和同宮 */
export interface YongCond {
  yong: YongShen
  target: YongShen
  /** 缺省為「生」 */
  relation?: YongRelation
  /** 必者硬濾,宜者計分;缺省宜 */
  required?: boolean
}

/** 十二長生條件:某干(天盤落宮之支)處某長生階段,任一落宮任一支合即中 */
export interface ChangShengCond {
  stem: StemRef
  stages: Stage[]
  /** 必者硬濾,宜者計分;缺省宜 */
  required?: boolean
}

/**
 * 查詢:ge 列擇一即可(任一命中即列)。
 * wang/yong/changsheng 各為一單元:required 者全須成立(硬濾);
 * 餘者計分不淘汰 — 唯全查詢無格無必時,至少須中一宜方列。
 * 皆空 → 空結果。
 */
export interface SearchQuery {
  ge?: GeCond[]
  wang?: WangCond[]
  yong?: YongCond[]
  changsheng?: ChangShengCond[]
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
  /** 所中「宜」條之數 */
  score: number
  /** 「宜」條總數 */
  optTotal: number
}

export interface SearchOptions extends QimenOptions {
  avoid?: AvoidOptions
}

export function yongLabel(y: YongShen): string {
  switch (y.kind) {
    case '門':
    case '星':
    case '神':
      return y.name
    case '干':
      return y.stem
    case '天盤干':
      return `天盤${y.stem}`
    case '地盤干':
      return `地盤${y.stem}`
    case '命':
      return `年命${y.stem}`
    case '柱':
      return PILLAR_LABEL[y.pillar]
  }
}

function resolveStem(r: StemRef, chart: Chart): string {
  return r.kind === '柱' ? chart.pillars[r.pillar][0] : r.stem
}

/** 用神落宮(門/星/神所在;地盤干取地盤所在;餘干取天盤所在,或有二宮) */
function yongPalaces(y: YongShen, chart: Chart): number[] {
  const out: number[] = []
  for (const info of chart.palaces) {
    switch (y.kind) {
      case '門':
        if (info.door === y.name) out.push(info.palace)
        break
      case '星':
        if (info.stars.includes(y.name)) out.push(info.palace)
        break
      case '神':
        if (info.god === y.name) out.push(info.palace)
        break
      case '地盤干':
        if (info.earthStems.includes(y.stem)) out.push(info.palace)
        break
      case '干':
      case '天盤干':
      case '命':
        if (info.skyStems.includes(y.stem)) out.push(info.palace)
        break
      case '柱':
        if (info.skyStems.includes(chart.pillars[y.pillar][0])) out.push(info.palace)
        break
    }
  }
  return out
}

/**
 * 用神落宮五行之生剋比和:遍歷兩者所有落宮,任一對合即中。
 * 生剋比和皆以「所在宮之五行」論(非門/星/神/干本身五行)——
 * 如休門落坎為水、日干落艮八(寅)不取寅木而取艮土。
 * kind 生=用神宮生目標宮(單向)、剋=用神宮剋目標宮、比和=宮五行同。
 * 回落宮對 [用神宮, 目標宮];無則 null。
 */
function palaceRel(
  yong: YongShen,
  target: YongShen,
  chart: Chart,
  kind: '生' | '剋' | '比和',
): [number, number] | null {
  const ap = yongPalaces(yong, chart)
  const bp = yongPalaces(target, chart)
  for (const pa of ap) {
    for (const pb of bp) {
      const ea = PALACE_ELEMENT[pa]
      const eb = PALACE_ELEMENT[pb]
      const ok = kind === '生' ? sheng(ea, eb) : kind === '剋' ? ke(ea, eb) : ea === eb
      if (ok) return [pa, pb]
    }
  }
  return null
}

function hasQuery(q: SearchQuery): boolean {
  return (
    (q.ge?.length ?? 0) +
      (q.wang?.length ?? 0) +
      (q.yong?.length ?? 0) +
      (q.changsheng?.length ?? 0) >
    0
  )
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

    const r = evalChart(query, chart, avoid)
    if (r) {
      hits.push({ date: parts, hourGZ: chart.pillars.hour, ke: chart.ju.ke, ...r })
    }
  }
  return hits
}

/** 宮旺單元 */
function evalWang(w: WangCond, chart: Chart, seasonElem: Element): SearchMatch | null {
  const st = seasonStrength(PALACE_ELEMENT[w.palace], seasonElem)
  if (!(w.accept as string[]).includes(st)) return null
  const name = chart.palaces[w.palace - 1].name
  return { kind: '旺', label: `${name}${st}`, palace: w.palace, palaceName: name }
}

/** 用神單元 */
function evalYong(y: YongCond, chart: Chart): SearchMatch | null {
  const relation = y.relation ?? '生'
  const yl = yongLabel(y.yong)
  const tl = yongLabel(y.target)
  const commonPalaces = () => {
    const bp = yongPalaces(y.target, chart)
    return yongPalaces(y.yong, chart).filter((p) => bp.includes(p))
  }
  if (relation === '同宮') {
    const common = commonPalaces()
    if (common.length === 0) return null
    const name = chart.palaces[common[0] - 1].name
    return { kind: '用', label: `${yl}與${tl}同宮`, palace: common[0], palaceName: name }
  }
  if (relation === '生比和同宮') {
    // 有情即可:生(用神宮生目標宮,單向)、比和(宮五行同)、同宮,任一即中
    const bihe = palaceRel(y.yong, y.target, chart, '比和')
    const rel = bihe
      ? { pair: bihe, name: '比和' as const }
      : (() => {
          const s = palaceRel(y.yong, y.target, chart, '生')
          return s ? { pair: s, name: '生' as const } : null
        })()
    const common = commonPalaces()
    if (!rel && common.length === 0) return null
    const at =
      common.length > 0
        ? { palace: common[0], palaceName: chart.palaces[common[0] - 1].name }
        : rel
          ? { palace: rel.pair[0], palaceName: chart.palaces[rel.pair[0] - 1].name }
          : {}
    const label = rel
      ? common.length > 0
        ? `${yl}${rel.name}${tl}且同宮`
        : `${yl}${rel.name}${tl}`
      : `${yl}與${tl}同宮`
    return { kind: '用', label, ...at }
  }
  // 生剋皆分向:生=用神宮生目標宮,剋=用神宮剋目標宮(倒者換側表之);比和=宮五行同
  const pair = palaceRel(y.yong, y.target, chart, relation)
  if (!pair) return null
  return {
    kind: '用',
    label: `${yl}${relation}${tl}`,
    palace: pair[0],
    palaceName: chart.palaces[pair[0] - 1].name,
  }
}

/** 十二長生單元(干之天盤落宮,任一落宮任一支合即中) */
function evalChangSheng(c: ChangShengCond, chart: Chart, ana: ChartAnalysis): SearchMatch | null {
  const stem = resolveStem(c.stem, chart)
  for (const pa of ana.palaces) {
    const st = pa.skyStages.find((s) => s.stem === stem)
    if (!st) continue
    const b = st.perBranch.find((x) => c.stages.includes(x.stage))
    if (!b) continue
    const name = chart.palaces[pa.palace - 1].name
    const base = c.stem.kind === '柱' ? `${PILLAR_LABEL[c.stem.pillar]}${stem}` : `年命${stem}`
    return { kind: '用', label: `${base}${b.stage}`, palace: pa.palace, palaceName: name }
  }
  return null
}

interface EvalResult {
  matches: SearchMatch[]
  score: number
  optTotal: number
}

/** 單盤判定:滿足則回傳命中列表與宜分,否則 null */
function evalChart(query: SearchQuery, chart: Chart, avoid: AvoidOptions): EvalResult | null {
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

  // 加持條件:必者硬濾,宜者計分
  const seasonElem = BRANCH_ELEMENT[chart.pillars.month[1]]
  const req: (SearchMatch | null)[] = []
  const opt: (SearchMatch | null)[] = []
  const put = (required: boolean | undefined, m: SearchMatch | null) =>
    (required ? req : opt).push(m)

  for (const w of query.wang ?? []) put(w.required, evalWang(w, chart, seasonElem))
  for (const y of query.yong ?? []) put(y.required, evalYong(y, chart))
  for (const c of query.changsheng ?? []) put(c.required, evalChangSheng(c, chart, ana))

  if (req.some((u) => u === null)) return null
  const optHit = opt.filter((u): u is SearchMatch => u !== null)
  // 無格無必而有宜者,至少中一宜方列,免全表皆時辰
  if (!query.ge?.length && req.length === 0 && opt.length > 0 && optHit.length === 0) {
    return null
  }
  matches.push(...(req as SearchMatch[]), ...optHit)

  return { matches, score: optHit.length, optTotal: opt.length }
}
