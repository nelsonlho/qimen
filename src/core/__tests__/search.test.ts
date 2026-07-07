import { describe, expect, it } from 'vitest'
import { GE_CATALOG, searchGe } from '../search'
import { analyzeChart } from '../analysis'
import { computeChart } from '../pan'
import type { DateParts } from '../types'

const START: DateParts = { year: 2026, month: 7, day: 6, hour: 0, minute: 0 }
const CATALOG_NAMES = new Set(GE_CATALOG.map((e) => e.name))

/** 逐時辰掃描(奇數整點),與 searchGe 同 options */
function* scanHours(days: number): Generator<DateParts> {
  for (let d = 0; d < days; d++) {
    for (let h = 1; h < 24; h += 2) {
      yield { year: 2026, month: 7, day: 6 + d, hour: h, minute: 0 }
    }
  }
}

describe('擇時反查', () => {
  it('目錄含九遁、三奇、剋應吉格,分四組', () => {
    for (const name of ['天遁', '地遁', '真詐', '三奇得使', '玉女守門', '青龍返首', '飛鳥跌穴']) {
      expect(CATALOG_NAMES.has(name)).toBe(true)
    }
    expect(new Set(GE_CATALOG.map((e) => e.group)).size).toBe(4)
    // 目錄全為吉格
    expect(GE_CATALOG.every((e) => e.luck === '吉')).toBe(true)
  })

  it('空選格 → 空結果', () => {
    expect(searchGe([], START, 7)).toEqual([])
  })

  it('手動掃描所見之格,searchGe 必命中同時辰同宮', () => {
    // 於三日內尋一必然存在的目錄格
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
    const hits = searchGe([target!.name], START, 3)
    expect(
      hits.some(
        (h) =>
          h.date.day === target!.day &&
          h.hourGZ === target!.hourGZ &&
          h.matches.some((m) => m.name === target!.name && m.palace === target!.palace),
      ),
    ).toBe(true)
  })

  it('結果依時序且不重複時辰', () => {
    const names = GE_CATALOG.map((e) => e.name)
    const hits = searchGe(names, START, 5)
    expect(hits.length).toBeGreaterThan(0)
    const keys = hits.map((h) => `${h.date.day}|${h.hourGZ}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (let i = 1; i < hits.length; i++) {
      const a = hits[i - 1].date
      const b = hits[i].date
      const ta = new Date(a.year, a.month - 1, a.day, a.hour, a.minute).getTime()
      const tb = new Date(b.year, b.month - 1, b.day, b.hour, b.minute).getTime()
      expect(tb).toBeGreaterThan(ta)
    }
  })

  it('避空亡:命中宮逢空之時辰被剔除', () => {
    // 尋一「目錄格落空亡宮」之實例
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
          h.matches.some((m) => m.name === found!.name && m.palace === found!.palace),
      )
    expect(has(searchGe([found!.name], START, 20))).toBe(true)
    expect(has(searchGe([found!.name], START, 20, { avoid: { kong: true } }))).toBe(false)
  })

  it('避五不遇時:該時辰整體剔除', () => {
    let found: { day: number; hourGZ: string } | null = null
    for (const parts of scanHours(20)) {
      const chart = computeChart(parts)
      const ana = analyzeChart(chart)
      if (!ana.global.some((g) => g.name === '五不遇時')) continue
      const hasCatalogGe = ana.palaces.some((pa) => pa.geju.some((x) => CATALOG_NAMES.has(x.name)))
      if (hasCatalogGe) {
        found = { day: parts.day, hourGZ: chart.pillars.hour }
        break
      }
    }
    expect(found).not.toBeNull()
    const names = GE_CATALOG.map((e) => e.name)
    const atHour = (hits: ReturnType<typeof searchGe>) =>
      hits.some((h) => h.date.day === found!.day && h.hourGZ === found!.hourGZ)
    expect(atHour(searchGe(names, START, 20))).toBe(true)
    expect(atHour(searchGe(names, START, 20, { avoid: { wuBuYuShi: true } }))).toBe(false)
  })

  it('八刻法逐刻掃描,ke 有值', () => {
    const names = GE_CATALOG.map((e) => e.name)
    const hits = searchGe(names, START, 1, { method: '八刻' })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.ke != null && h.ke >= 1 && h.ke <= 8)).toBe(true)
  })
})
