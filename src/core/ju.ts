// 置閏法定局
//
// 法:符頭者,甲己之日。子午卯酉為上元,寅申巳亥為中元,辰戌丑未為下元。
// 上元符頭(甲子、己卯、甲午、己酉)每十五日一至,統一節氣之三元。
// 符頭先節氣而至為超神,後至為接氣,同至為正授。
// 超神積至九日(門檻可調)以上,逢芒種、大雪則置閏——重複其三元一次。
//
// 實作:自 1860 年起逐段推演。初始指派縱有一節之差,首次置閏後軌跡必自行
// 收斂歸一(差十五日之兩態,超者先閏,閏即合流),故 1900 年後結果為正典。

import { Solar } from 'lunar-typescript'
import { ganzhiIndex, ganzhiName } from './ganzhi'
import { getTerms, dayNumber, type SolarTerm } from './solarTerms'
import type { ChaoJieStatus, Dun } from './types'

/** 節氣 → [遁, [上元局, 中元局, 下元局]] */
export const JU_TABLE: Record<string, [Dun, [number, number, number]]> = {
  冬至: ['陽', [1, 7, 4]],
  小寒: ['陽', [2, 8, 5]],
  大寒: ['陽', [3, 9, 6]],
  立春: ['陽', [8, 5, 2]],
  雨水: ['陽', [9, 6, 3]],
  驚蟄: ['陽', [1, 7, 4]],
  春分: ['陽', [3, 9, 6]],
  清明: ['陽', [4, 1, 7]],
  穀雨: ['陽', [5, 2, 8]],
  立夏: ['陽', [4, 1, 7]],
  小滿: ['陽', [5, 2, 8]],
  芒種: ['陽', [6, 3, 9]],
  夏至: ['陰', [9, 3, 6]],
  小暑: ['陰', [8, 2, 5]],
  大暑: ['陰', [7, 1, 4]],
  立秋: ['陰', [2, 5, 8]],
  處暑: ['陰', [1, 4, 7]],
  白露: ['陰', [9, 3, 6]],
  秋分: ['陰', [7, 1, 4]],
  寒露: ['陰', [6, 9, 3]],
  霜降: ['陰', [5, 8, 2]],
  立冬: ['陰', [6, 9, 3]],
  小雪: ['陰', [5, 8, 2]],
  大雪: ['陰', [4, 7, 1]],
}

export interface Segment {
  startJdn: number // 上元符頭當日
  termName: string
  termJdn: number
  isLeap: boolean // 閏段(重複之三元)
  status: ChaoJieStatus
  gapDays: number // termJdn - startJdn(超神為正)
}

export interface JuDayResult {
  dun: Dun
  ju: number
  termName: string
  yuan: 1 | 2 | 3
  status: ChaoJieStatus
  gapDays: number
  shangYuanFuTou: string
  fuTou: string
}

const SIM_START = 1860
const SIM_END = 2105

/** 日序 → 日干支索引。以 lunar-typescript 於基準日校定偏移。 */
let dayGzOffset: number | null = null
export function dayGanzhiIndex(jdn: number): number {
  if (dayGzOffset === null) {
    const refJdn = dayNumber(2000, 1, 1)
    const name = Solar.fromYmdHms(2000, 1, 1, 12, 0, 0).getLunar().getDayInGanZhi()
    dayGzOffset = ((ganzhiIndex(name) - refJdn) % 60 + 60) % 60
  }
  return (((jdn + dayGzOffset) % 60) + 60) % 60
}

const segmentCache = new Map<number, Segment[]>()

/** 推演全部三元段。threshold:置閏門檻(日) */
export function buildSegments(threshold = 9): Segment[] {
  const cached = segmentCache.get(threshold)
  if (cached) return cached

  const terms = getTerms(SIM_START, SIM_END)

  // 首個上元符頭:自 SIM_START 年首日尋 干支索引 %15 === 0 者
  let u = dayNumber(SIM_START, 1, 1)
  while (dayGanzhiIndex(u) % 15 !== 0) u++

  // 初始指派:首個不早於符頭之節氣
  let ti = terms.findIndex((t) => t.jdn >= u)
  if (ti < 0) throw new Error('節氣資料不足')

  const segments: Segment[] = []
  let leapPending = false // 本段為閏段
  while (ti < terms.length) {
    const term: SolarTerm = terms[ti]
    const gap = term.jdn - u
    const isLeap = leapPending
    let status: ChaoJieStatus
    if (isLeap) status = '置閏'
    else if (gap > 0) status = '超神'
    else if (gap === 0) status = '正授'
    else status = '接氣'

    segments.push({ startJdn: u, termName: term.name, termJdn: term.jdn, isLeap, status, gapDays: gap })

    // 閏例:芒種、大雪,超神達門檻,且本段非閏段
    if (!isLeap && (term.name === '芒種' || term.name === '大雪') && gap >= threshold) {
      leapPending = true // 下一段重複本節
    } else {
      leapPending = false
      ti++
    }
    u += 15
  }

  segmentCache.set(threshold, segments)
  return segments
}

/** 以「日」定局(jdn 須已按子時換日法調整) */
export function juForDay(jdn: number, threshold = 9): JuDayResult {
  const segments = buildSegments(threshold)
  // 二分尋段:startJdn <= jdn < startJdn+15
  let lo = 0
  let hi = segments.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (segments[mid].startJdn <= jdn) lo = mid
    else hi = mid - 1
  }
  const seg = segments[lo]
  if (jdn < seg.startJdn || jdn >= seg.startJdn + 15) {
    throw new Error('日期超出支援範圍(約 1900–2100)')
  }

  const gz = dayGanzhiIndex(jdn)
  const yuan = (Math.floor((gz % 15) / 5) + 1) as 1 | 2 | 3
  const entry = JU_TABLE[seg.termName]
  if (!entry) throw new Error(`無局數表項: ${seg.termName}`)
  const [dun, jus] = entry
  const fuTouJdn = jdn - (gz % 5) // 最近甲己日
  return {
    dun,
    ju: jus[yuan - 1],
    termName: seg.termName,
    yuan,
    status: seg.status,
    gapDays: seg.gapDays,
    shangYuanFuTou: ganzhiName(dayGanzhiIndex(seg.startJdn)),
    fuTou: ganzhiName(dayGanzhiIndex(fuTouJdn)),
  }
}

/**
 * 旬首法(十刻一局,劉伯溫/透派立向時盤之制):
 * 定元與置閏法同(符頭統三元、芒種大雪置閏)。
 * 一元五日,自符頭日(必甲己日)甲子時起,每旬(十時辰)進一局:
 * 甲子旬用元局,以次陽遁順加、陰遁逆減。
 * 時辰所屬旬即定其局,故 k = 時旬序(甲子0…甲寅5)。
 */
export function juForHourXun(jdn: number, hourGz: number, threshold = 9): JuDayResult {
  const base = juForDay(jdn, threshold)
  const k = Math.floor((hourGz - (hourGz % 10)) / 10)
  const shift = base.dun === '陽' ? base.ju + k : base.ju - k
  const ju = ((shift - 1) % 9 + 9) % 9 + 1
  return { ...base, ju }
}

/** 拆補法:交節即換,元按當日符頭之支拆定 */
export function juForDayChaibu(jdn: number): JuDayResult {
  const terms = getTerms(SIM_START, SIM_END)
  // 最後一個節氣日 <= jdn 者
  let lo = 0
  let hi = terms.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (terms[mid].jdn <= jdn) lo = mid
    else hi = mid - 1
  }
  const term = terms[lo]
  if (term.jdn > jdn || jdn - term.jdn > 20) throw new Error('日期超出支援範圍(約 1900–2100)')

  const gz = dayGanzhiIndex(jdn)
  const yuan = (Math.floor((gz % 15) / 5) + 1) as 1 | 2 | 3
  const entry = JU_TABLE[term.name]
  if (!entry) throw new Error(`無局數表項: ${term.name}`)
  const [dun, jus] = entry
  const fuTouJdn = jdn - (gz % 5)
  return {
    dun,
    ju: jus[yuan - 1],
    termName: term.name,
    yuan,
    status: '拆補',
    gapDays: jdn - term.jdn,
    shangYuanFuTou: ganzhiName(dayGanzhiIndex(jdn - (gz % 15))),
    fuTou: ganzhiName(dayGanzhiIndex(fuTouJdn)),
  }
}
