import { describe, expect, it } from 'vitest'
import { GE_CATALOG, INTENT_PRESETS, searchGe } from '../search'
import { analyzeChart } from '../analysis'
import { computeChart } from '../pan'
import { BRANCH_ELEMENT, PALACE_ELEMENT, STEM_ELEMENT, ke, seasonStrength, sheng } from '../wuxing'
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

  it('用神生干:開門(金)生日干 ⇔ 日干屬水', () => {
    const days = 12 // 逾一旬,必有壬癸日
    const hits = searchGe(
      { yong: [{ yong: { kind: '門', name: '開門' }, target: { kind: '柱', pillar: 'day' } }] },
      START,
      endAfter(days),
    )
    expect(hits.length).toBeGreaterThan(0)
    // 與手動掃描全然一致
    const expected = new Set<string>()
    for (const parts of scanHours(days)) {
      const chart = computeChart(parts)
      if (sheng('金', STEM_ELEMENT[chart.pillars.day[0]])) {
        expected.add(`${chart.pillars.day}|${chart.pillars.hour}`)
      }
    }
    for (const h of hits) {
      expect(h.matches.some((m) => m.kind === '用' && m.label === '開門生日干')).toBe(true)
    }
    // 命中數 = 手掃數(時辰去重後)
    expect(hits.length).toBe(expected.size)
  })

  it('用神生年命:壬水生甲木,恆真,全時辰列', () => {
    const hits = searchGe(
      { yong: [{ yong: { kind: '干', stem: '壬' }, target: { kind: '命', stem: '甲' } }] },
      START,
      endAfter(1),
    )
    expect(hits.length).toBeGreaterThanOrEqual(12)
    // 反例:甲木不生壬水
    expect(
      searchGe(
        { yong: [{ yong: { kind: '干', stem: '甲' }, target: { kind: '命', stem: '壬' } }] },
        START,
        endAfter(1),
      ),
    ).toEqual([])
  })

  it('用神比和:戊土比和年命己土恆真;甲木比和庚金恆假', () => {
    const hits = searchGe(
      { yong: [{ yong: { kind: '干', stem: '戊' }, relation: '比和', target: { kind: '命', stem: '己' } }] },
      START,
      endAfter(1),
    )
    expect(hits.length).toBeGreaterThanOrEqual(12)
    expect(hits.every((h) => h.matches.some((m) => m.label === '戊比和年命己'))).toBe(true)
    expect(
      searchGe(
        { yong: [{ yong: { kind: '干', stem: '甲' }, relation: '比和', target: { kind: '命', stem: '庚' } }] },
        START,
        endAfter(1),
      ),
    ).toEqual([])
  })

  it('用神剋:年命庚金剋甲木;方向不可倒,倒者換側表之', () => {
    // 年命亦可為用神側
    const kehits = searchGe(
      { yong: [{ yong: { kind: '命', stem: '庚' }, relation: '剋', target: { kind: '命', stem: '甲' } }] },
      START,
      endAfter(1),
    )
    expect(kehits.length).toBeGreaterThanOrEqual(12)
    expect(kehits.every((h) => h.matches.some((m) => m.label === '年命庚剋年命甲'))).toBe(true)
    // 倒向恆假(「被剋」即換側,無專項)
    expect(
      searchGe(
        { yong: [{ yong: { kind: '命', stem: '甲' }, relation: '剋', target: { kind: '命', stem: '庚' } }] },
        START,
        endAfter(1),
      ),
    ).toEqual([])
  })

  it('用神剋盤之日干:與手掃全等', () => {
    const days = 12
    const hits = searchGe(
      { yong: [{ yong: { kind: '柱', pillar: 'hour' }, relation: '剋', target: { kind: '柱', pillar: 'day' } }] },
      START,
      endAfter(days),
    )
    const expected = new Set<string>()
    for (const parts of scanHours(days)) {
      const chart = computeChart(parts)
      if (ke(STEM_ELEMENT[chart.pillars.hour[0]], STEM_ELEMENT[chart.pillars.day[0]])) {
        expected.add(`${chart.pillars.day}|${chart.pillars.hour}`)
      }
    }
    expect(hits.length).toBe(expected.size)
    expect(hits.length).toBeGreaterThan(0)
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

  it('複合:格 AND 用神,結果為交集', () => {
    const geOnly = searchGe({ ge: [{ name: '三奇得使' }] }, START, endAfter(5))
    const yong = { yong: { kind: '門', name: '生門' }, target: { kind: '柱', pillar: 'hour' } } as const
    const both = searchGe({ ge: [{ name: '三奇得使' }], yong: [yong] }, START, endAfter(5))
    expect(both.length).toBeLessThanOrEqual(geOnly.length)
    const geKeys = new Set(geOnly.map((h) => `${h.date.day}|${h.hourGZ}`))
    for (const h of both) {
      expect(geKeys.has(`${h.date.day}|${h.hourGZ}`)).toBe(true)
      // 生門土生時干 → 時干必屬金
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
