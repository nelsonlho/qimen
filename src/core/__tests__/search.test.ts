import { describe, expect, it } from 'vitest'
import { GE_CATALOG, INTENT_PRESETS, searchGe } from '../search'
import { analyzeChart } from '../analysis'
import { computeChart } from '../pan'
import { BRANCH_ELEMENT, PALACE_ELEMENT, ke, seasonStrength, sheng } from '../wuxing'
import type { Stage } from '../changsheng'
import type { DateParts } from '../types'

const START: DateParts = { year: 2026, month: 7, day: 6, hour: 0, minute: 0 }
const CATALOG_NAMES = new Set(GE_CATALOG.map((e) => e.name))

function endAfter(days: number): DateParts {
  const d = new Date(2026, 6, 6 + days)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: 0, minute: 0 }
}

/** 逐時辰掃描(奇數整點),與 searchGe 同 options */
function* scanHours(days: number): Generator<DateParts> {
  for (let d = 0; d < days; d++) {
    for (let h = 1; h < 24; h += 2) {
      const dt = new Date(2026, 6, 6 + d, h)
      yield { year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), hour: h, minute: 0 }
    }
  }
}

/** 逐局迭代:鏡 searchGe 之步進(每時去重),與其命中representative 全齊 */
function* eachJu(days: number): Generator<{ parts: DateParts; chart: ReturnType<typeof computeChart> }> {
  let last = ''
  for (let h = 0; h < days * 24; h++) {
    const dt = new Date(2026, 6, 6, h)
    const parts: DateParts = {
      year: dt.getFullYear(),
      month: dt.getMonth() + 1,
      day: dt.getDate(),
      hour: dt.getHours(),
      minute: 0,
    }
    let chart
    try {
      chart = computeChart(parts)
    } catch {
      continue
    }
    const key = `${chart.pillars.day}|${chart.pillars.hour}|${chart.ju.dun}${chart.ju.ju}|${chart.ju.ke ?? ''}`
    if (key === last) continue
    last = key
    yield { parts, chart }
  }
}

type Sym = { door?: string; star?: string; god?: string; sky?: string; earth?: string }

/** 符號落宮(門/星/神;sky=天盤干;earth=地盤干) */
function palOf(chart: ReturnType<typeof computeChart>, s: Sym): number[] {
  const out: number[] = []
  for (const p of chart.palaces) {
    if (
      (s.door && p.door === s.door) ||
      (s.star && p.stars.includes(s.star)) ||
      (s.god && p.god === s.god) ||
      (s.sky && p.skyStems.includes(s.sky)) ||
      (s.earth && p.earthStems.includes(s.earth))
    )
      out.push(p.palace)
  }
  return out
}

/** 落宮五行生剋比和:遍歷兩者落宮任一對合即真 */
function palRel(
  chart: ReturnType<typeof computeChart>,
  a: Sym,
  b: Sym,
  kind: '生' | '剋' | '比和',
): boolean {
  for (const pa of palOf(chart, a))
    for (const pb of palOf(chart, b)) {
      const ea = PALACE_ELEMENT[pa]
      const eb = PALACE_ELEMENT[pb]
      if (kind === '生' ? sheng(ea, eb) : kind === '剋' ? ke(ea, eb) : ea === eb) return true
    }
  return false
}

describe('擇時反查', () => {
  it('目錄含九遁、三奇、剋應吉格,分四組,全為吉', () => {
    for (const name of ['天遁', '地遁', '真詐', '三奇得使', '玉女守門', '青龍返首', '飛鳥跌穴']) {
      expect(CATALOG_NAMES.has(name)).toBe(true)
    }
    expect(new Set(GE_CATALOG.map((e) => e.group)).size).toBe(4)
    expect(GE_CATALOG.every((e) => e.luck === '吉')).toBe(true)
  })

  it('事由包之格皆在目錄,且各有註', () => {
    for (const p of INTENT_PRESETS) {
      expect(p.ge.length).toBeGreaterThan(0)
      for (const name of p.ge) {
        expect(CATALOG_NAMES.has(name)).toBe(true)
      }
    }
    expect(GE_CATALOG.every((e) => e.note.length > 0)).toBe(true)
  })

  it('空查詢 → 空結果', () => {
    expect(searchGe({}, START, endAfter(7))).toEqual([])
    expect(searchGe({ ge: [], wang: [], yong: [] }, START, endAfter(7))).toEqual([])
  })

  it('手動掃描所見之格,searchGe 必命中同時辰同宮', () => {
    let target: { name: string; palace: number; day: number; hourGZ: string } | null = null
    for (const parts of scanHours(3)) {
      const chart = computeChart(parts)
      const ana = analyzeChart(chart)
      for (const pa of ana.palaces) {
        const g = pa.geju.find((x) => CATALOG_NAMES.has(x.name))
        if (g) {
          target = { name: g.name, palace: pa.palace, day: parts.day, hourGZ: chart.pillars.hour }
          break
        }
      }
      if (target) break
    }
    expect(target).not.toBeNull()
    const hits = searchGe({ ge: [{ name: target!.name }] }, START, endAfter(3))
    expect(
      hits.some(
        (h) =>
          h.date.day === target!.day &&
          h.hourGZ === target!.hourGZ &&
          h.matches.some((m) => m.label === target!.name && m.palace === target!.palace),
      ),
    ).toBe(true)
  })

  it('格限宮限門:合則中,異門則否', () => {
    // 尋一格實例,記其宮與門
    let found: { name: string; palace: number; door: string; day: number; hourGZ: string } | null = null
    for (const parts of scanHours(3)) {
      const chart = computeChart(parts)
      const ana = analyzeChart(chart)
      for (const pa of ana.palaces) {
        const info = chart.palaces[pa.palace - 1]
        if (!info.door) continue
        const g = pa.geju.find((x) => CATALOG_NAMES.has(x.name))
        if (g) {
          found = { name: g.name, palace: pa.palace, door: info.door, day: parts.day, hourGZ: chart.pillars.hour }
          break
        }
      }
      if (found) break
    }
    expect(found).not.toBeNull()
    const at = (hits: ReturnType<typeof searchGe>) =>
      hits.some((h) => h.date.day === found!.day && h.hourGZ === found!.hourGZ)
    // 限定正確宮+門 → 中
    expect(
      at(searchGe({ ge: [{ name: found!.name, palace: found!.palace, door: found!.door }] }, START, endAfter(3))),
    ).toBe(true)
    // 限定他門 → 該時辰該宮不中
    const otherDoor = found!.door === '開門' ? '休門' : '開門'
    const hitsOther = searchGe({ ge: [{ name: found!.name, palace: found!.palace, door: otherDoor }] }, START, endAfter(3))
    expect(
      hitsOther.some(
        (h) => h.date.day === found!.day && h.hourGZ === found!.hourGZ && h.matches.some((m) => m.palace === found!.palace),
      ),
    ).toBe(false)
  })

  it('宮旺:依月令四時旺相,合則全時辰列,否則空', () => {
    const chart = computeChart(START)
    const season = BRANCH_ELEMENT[chart.pillars.month[1]]
    // 未月土旺:尋一旺相宮與一休囚死宮
    const okPalace = [1, 2, 3, 4, 6, 7, 8, 9].find((p) =>
      ['旺', '相'].includes(seasonStrength(PALACE_ELEMENT[p], season)),
    )!
    const badPalace = [1, 2, 3, 4, 6, 7, 8, 9].find(
      (p) => !['旺', '相'].includes(seasonStrength(PALACE_ELEMENT[p], season)),
    )!
    const okHits = searchGe({ wang: [{ palace: okPalace, accept: ['旺', '相'] }] }, START, endAfter(1))
    expect(okHits.length).toBeGreaterThanOrEqual(12) // 一日十二時辰皆合(月令不變)
    expect(okHits.every((h) => h.matches.some((m) => m.kind === '旺'))).toBe(true)
    expect(searchGe({ wang: [{ palace: badPalace, accept: ['旺', '相'] }] }, START, endAfter(1))).toEqual([])
  })

  it('用神生:開門宮五行生日干宮五行(落宮論,非門五行)', () => {
    const days = 12
    const hits = searchGe(
      { yong: [{ yong: { kind: '門', name: '開門' }, target: { kind: '柱', pillar: 'day' } }] },
      START,
      endAfter(days),
    )
    // 手掃:開門所在宮五行 生 日干天盤所在宮五行
    const expected = new Set<string>()
    for (const { parts, chart } of eachJu(days)) {
      if (palRel(chart, { door: '開門' }, { sky: chart.pillars.day[0] }, '生')) {
        expected.add(`${parts.day}|${chart.pillars.hour}`)
      }
    }
    expect(new Set(hits.map((h) => `${h.date.day}|${h.hourGZ}`))).toEqual(expected)
    for (const h of hits) {
      expect(h.matches.some((m) => m.kind === '用' && m.label === '開門生日干')).toBe(true)
    }
  })

  it('用神比和:兩者落宮五行相同(落宮論)', () => {
    const days = 5
    const hits = searchGe(
      { yong: [{ yong: { kind: '天盤干', stem: '戊' }, relation: '比和', target: { kind: '命', stem: '己' } }] },
      START,
      endAfter(days),
    )
    const expected = new Set<string>()
    for (const { parts, chart } of eachJu(days)) {
      if (palRel(chart, { sky: '戊' }, { sky: '己' }, '比和')) {
        expected.add(`${parts.day}|${chart.pillars.hour}`)
      }
    }
    expect(new Set(hits.map((h) => `${h.date.day}|${h.hourGZ}`))).toEqual(expected)
    for (const h of hits) {
      expect(h.matches.some((m) => m.label === '天盤戊比和年命己')).toBe(true)
    }
  })

  it('用神剋:用神宮剋目標宮,分向;倒向換側表之', () => {
    const days = 5
    const fwd = searchGe(
      { yong: [{ yong: { kind: '柱', pillar: 'hour' }, relation: '剋', target: { kind: '柱', pillar: 'day' } }] },
      START,
      endAfter(days),
    )
    const expected = new Set<string>()
    const revExp = new Set<string>()
    for (const { parts, chart } of eachJu(days)) {
      const k = `${parts.day}|${chart.pillars.hour}`
      if (palRel(chart, { sky: chart.pillars.hour[0] }, { sky: chart.pillars.day[0] }, '剋')) expected.add(k)
      if (palRel(chart, { sky: chart.pillars.day[0] }, { sky: chart.pillars.hour[0] }, '剋')) revExp.add(k)
    }
    expect(new Set(fwd.map((h) => `${h.date.day}|${h.hourGZ}`))).toEqual(expected)
    // 倒向:日干宮剋時干宮,自成一集(分向)
    const rev = searchGe(
      { yong: [{ yong: { kind: '柱', pillar: 'day' }, relation: '剋', target: { kind: '柱', pillar: 'hour' } }] },
      START,
      endAfter(days),
    )
    expect(new Set(rev.map((h) => `${h.date.day}|${h.hourGZ}`))).toEqual(revExp)
  })

  it('用神同宮:開門與日干同宮 ⇔ 開門宮天盤有日干', () => {
    const days = 5
    const expected = new Set<string>()
    for (const parts of scanHours(days)) {
      const chart = computeChart(parts)
      const doorPalace = chart.palaces.find((p) => p.door === '開門')
      if (doorPalace?.skyStems.includes(chart.pillars.day[0])) {
        expected.add(`${chart.pillars.day}|${chart.pillars.hour}`)
      }
    }
    const hits = searchGe(
      { yong: [{ yong: { kind: '門', name: '開門' }, relation: '同宮', target: { kind: '柱', pillar: 'day' } }] },
      START,
      endAfter(days),
    )
    expect(hits.length).toBe(expected.size)
    for (const h of hits) {
      const m = h.matches.find((x) => x.label === '開門與日干同宮')
      expect(m).toBeDefined()
      expect(m!.palace).toBeGreaterThanOrEqual(1)
    }
  })

  it('地盤干同宮:地盤乙與盤之日干同宮 ⇔ 某宮地盤有乙且天盤有日干', () => {
    const days = 5
    const expected = new Set<string>()
    for (const parts of scanHours(days)) {
      const chart = computeChart(parts)
      if (
        chart.palaces.some(
          (p) => p.earthStems.includes('乙') && p.skyStems.includes(chart.pillars.day[0]),
        )
      ) {
        expected.add(`${chart.pillars.day}|${chart.pillars.hour}`)
      }
    }
    const hits = searchGe(
      {
        yong: [
          { yong: { kind: '地盤干', stem: '乙' }, relation: '同宮', target: { kind: '柱', pillar: 'day' } },
        ],
      },
      START,
      endAfter(days),
    )
    expect(hits.length).toBe(expected.size)
    expect(hits.every((h) => h.matches.some((m) => m.label === '地盤乙與日干同宮'))).toBe(true)
  })

  it('門星互同宮:開門與天心同宮,與手掃全等', () => {
    const days = 5
    const expected = new Set<string>()
    for (const parts of scanHours(days)) {
      const chart = computeChart(parts)
      if (chart.palaces.some((p) => p.door === '開門' && p.stars.includes('天心'))) {
        expected.add(`${chart.pillars.day}|${chart.pillars.hour}`)
      }
    }
    const hits = searchGe(
      {
        yong: [
          { yong: { kind: '門', name: '開門' }, relation: '同宮', target: { kind: '星', name: '天心' } },
        ],
      },
      START,
      endAfter(days),
    )
    expect(hits.length).toBe(expected.size)
    expect(hits.every((h) => h.matches.some((m) => m.label === '開門與天心同宮'))).toBe(true)
  })

  it('十二長生:日干處某階段,與盤面斷析一致', () => {
    // 取首時辰,問日干天盤落宮之長生階段
    const chart = computeChart({ ...START, hour: 1 })
    const ana = analyzeChart(chart)
    const dayStem = chart.pillars.day[0]
    const allStages = new Set<string>()
    for (const pa of ana.palaces) {
      const st = pa.skyStages.find((s) => s.stem === dayStem)
      if (st) for (const b of st.perBranch) allStages.add(b.stage)
    }
    expect(allStages.size).toBeGreaterThan(0)
    const someStage = [...allStages][0] as Stage
    const hits = searchGe(
      { changsheng: [{ stem: { kind: '柱', pillar: 'day' }, stages: [someStage] }] },
      START,
      endAfter(1),
    )
    // 首時辰必中
    expect(
      hits.some((h) => h.hourGZ === chart.pillars.hour && h.matches.some((m) => m.label.includes(someStage))),
    ).toBe(true)
    // 反例:取日干該時辰所無之階段
    const absent = (['長生', '沐浴', '冠帶', '臨官', '帝旺', '衰', '病', '死', '墓', '絕', '胎', '養'] as const).find(
      (s) => !allStages.has(s),
    )!
    const missHits = searchGe(
      { changsheng: [{ stem: { kind: '柱', pillar: 'day' }, stages: [absent] }] },
      START,
      endAfter(1),
    )
    expect(missHits.some((h) => h.hourGZ === chart.pillars.hour)).toBe(false)
  })

  it('必宜:必者硬濾,宜者計分不淘汰', () => {
    // 坤二(土)於午月相、未月旺,恆旺相為真;坎一(水)於午月囚、未月死,恆非旺相為假
    const T = { palace: 2, accept: ['旺', '相'] as ('旺' | '相')[] }
    const F = { palace: 1, accept: ['旺', '相'] as ('旺' | '相')[] }
    // 必之假 → 全棄
    expect(searchGe({ wang: [{ ...F, required: true }, T] }, START, endAfter(1))).toEqual([])
    // 宜真宜假並列 → 恆中,僅列成立之條,分 1/2
    const hits = searchGe({ wang: [T, F] }, START, endAfter(1))
    expect(hits.length).toBeGreaterThanOrEqual(12)
    for (const h of hits) {
      expect(h.score).toBe(1)
      expect(h.optTotal).toBe(2)
      expect(h.matches.some((m) => m.kind === '旺' && m.palace === 2)).toBe(true)
      expect(h.matches.some((m) => m.palace === 9)).toBe(false)
    }
    // 必真宜假 → 恆中,分 0/1,必者列於命中
    const h2 = searchGe({ wang: [{ ...T, required: true }, F] }, START, endAfter(1))
    expect(h2.length).toBeGreaterThanOrEqual(12)
    for (const h of h2) {
      expect(h.score).toBe(0)
      expect(h.optTotal).toBe(1)
      expect(h.matches.some((m) => m.palace === 2)).toBe(true)
    }
    // 唯宜且全不中 → 不列
    expect(searchGe({ wang: [F] }, START, endAfter(1))).toEqual([])
  })

  it('宜不弛格局之關:格仍須中', () => {
    const alwaysTrue = { yong: { kind: '命', stem: '庚' }, relation: '剋', target: { kind: '命', stem: '甲' } } as const
    const geOnly = searchGe({ ge: [{ name: '三奇得使' }] }, START, endAfter(3))
    const withCond = searchGe({ ge: [{ name: '三奇得使' }], yong: [alwaysTrue] }, START, endAfter(3))
    expect(withCond.length).toBe(geOnly.length)
    const geKeys = new Set(geOnly.map((h) => `${h.date.day}|${h.hourGZ}`))
    for (const h of withCond) {
      expect(geKeys.has(`${h.date.day}|${h.hourGZ}`)).toBe(true)
    }
  })

  it('生/比和/同宮(有情即可):併單向生、比和、同宮;生不取反向', () => {
    const days = 5
    const door = { kind: '門', name: '開門' } as const
    const day = { kind: '柱', pillar: 'day' } as const
    // 開門屬金:開門生日干(單向)⇔日干水;比和⇔日干金;同宮視盤
    const run = (relation: string) =>
      searchGe(
        { yong: [{ yong: door, target: day, relation, required: true } as never] },
        START,
        endAfter(days),
      )
    // 有情之併:開門生日干(單向)∪ 比和 ∪ 同宮
    const union = new Set(
      [...run('生'), ...run('比和'), ...run('同宮')].map((h) => `${h.date.day}|${h.hourGZ}`),
    )
    const combo = run('生比和同宮')
    // 合條恰為三式之併(逐時辰全等)
    expect(new Set(combo.map((h) => `${h.date.day}|${h.hourGZ}`))).toEqual(union)
    for (const h of combo) {
      const m = h.matches.find((x) => x.kind === '用')!
      expect(/(開門生日干|開門比和日干)(且同宮)?$|開門與日干同宮$/.test(m.label)).toBe(true)
    }
    // 反向之生(日干宮生開門宮)不入合條,除非亦正向/比和/同宮
    const rev = searchGe(
      { yong: [{ yong: day, target: door, relation: '生', required: true } as never] },
      START,
      endAfter(days),
    )
    const comboKeys = new Set(combo.map((h) => `${h.date.day}|${h.hourGZ}`))
    for (const h of rev) {
      const k = `${h.date.day}|${h.hourGZ}`
      if (!union.has(k)) expect(comboKeys.has(k)).toBe(false)
    }
  })

  it('複合:格 AND 用神,結果為交集', () => {
    const geOnly = searchGe({ ge: [{ name: '三奇得使' }] }, START, endAfter(5))
    const yong = { yong: { kind: '門', name: '生門' }, target: { kind: '柱', pillar: 'hour' }, required: true } as const
    const both = searchGe({ ge: [{ name: '三奇得使' }], yong: [yong] }, START, endAfter(5))
    expect(both.length).toBeLessThanOrEqual(geOnly.length)
    const geKeys = new Set(geOnly.map((h) => `${h.date.day}|${h.hourGZ}`))
    for (const h of both) {
      expect(geKeys.has(`${h.date.day}|${h.hourGZ}`)).toBe(true)
      // 生門宮五行生時干宮五行(落宮論)
      expect(h.matches.some((m) => m.label === '生門生時干')).toBe(true)
    }
  })

  it('結果依時序且不重複時辰', () => {
    const hits = searchGe({ ge: GE_CATALOG.map((e) => ({ name: e.name })) }, START, endAfter(5))
    expect(hits.length).toBeGreaterThan(0)
    const keys = hits.map((h) => `${h.date.day}|${h.hourGZ}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (let i = 1; i < hits.length; i++) {
      const a = hits[i - 1].date
      const b = hits[i].date
      expect(new Date(b.year, b.month - 1, b.day, b.hour, b.minute).getTime()).toBeGreaterThan(
        new Date(a.year, a.month - 1, a.day, a.hour, a.minute).getTime(),
      )
    }
  })

  it('避空亡:命中宮逢空之時辰被剔除', () => {
    let found: { name: string; palace: number; day: number; hourGZ: string } | null = null
    for (const parts of scanHours(20)) {
      const chart = computeChart(parts)
      const ana = analyzeChart(chart)
      for (const pa of ana.palaces) {
        if (!chart.palaces[pa.palace - 1].kong) continue
        const g = pa.geju.find((x) => CATALOG_NAMES.has(x.name))
        if (g) {
          found = { name: g.name, palace: pa.palace, day: parts.day, hourGZ: chart.pillars.hour }
          break
        }
      }
      if (found) break
    }
    expect(found).not.toBeNull()
    const has = (hits: ReturnType<typeof searchGe>) =>
      hits.some(
        (h) =>
          h.date.day === found!.day &&
          h.hourGZ === found!.hourGZ &&
          h.matches.some((m) => m.label === found!.name && m.palace === found!.palace),
      )
    expect(has(searchGe({ ge: [{ name: found!.name }] }, START, endAfter(20)))).toBe(true)
    expect(has(searchGe({ ge: [{ name: found!.name }] }, START, endAfter(20), { avoid: { kong: true } }))).toBe(false)
  })

  it('避五不遇時:該時辰整體剔除', () => {
    let found: { day: number; hourGZ: string } | null = null
    for (const parts of scanHours(20)) {
      const chart = computeChart(parts)
      const ana = analyzeChart(chart)
      if (!ana.global.some((g) => g.name === '五不遇時')) continue
      if (ana.palaces.some((pa) => pa.geju.some((x) => CATALOG_NAMES.has(x.name)))) {
        found = { day: parts.day, hourGZ: chart.pillars.hour }
        break
      }
    }
    expect(found).not.toBeNull()
    const query = { ge: GE_CATALOG.map((e) => ({ name: e.name })) }
    const atHour = (hits: ReturnType<typeof searchGe>) =>
      hits.some((h) => h.date.day === found!.day && h.hourGZ === found!.hourGZ)
    expect(atHour(searchGe(query, START, endAfter(20)))).toBe(true)
    expect(atHour(searchGe(query, START, endAfter(20), { avoid: { wuBuYuShi: true } }))).toBe(false)
  })

  it('八刻法逐刻掃描,ke 有值', () => {
    const hits = searchGe({ ge: GE_CATALOG.map((e) => ({ name: e.name })) }, START, endAfter(1), { method: '八刻' })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.ke != null && h.ke >= 1 && h.ke <= 8)).toBe(true)
  })
})
