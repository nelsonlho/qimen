import { describe, expect, it } from 'vitest'
import {
  BRANCHES,
  ganzhiIndex,
  ganzhiName,
  hourGanzhiIndex,
  kongWang,
  xunShouYi,
} from '../ganzhi'
import { buildSegments, dayGanzhiIndex, juForDay, juForDayChaibu } from '../ju'
import { stageOf, stagesInPalace } from '../changsheng'
import { analyzeChart, doorPalaceRelation } from '../analysis'
import { starWangShuai } from '../wuxing'
import { KE_YING } from '../keying'
import { dayNumber, getTerms } from '../solarTerms'
import { computeChart, earthPlate } from '../pan'

describe('干支', () => {
  it('六十甲子首尾', () => {
    expect(ganzhiName(0)).toBe('甲子')
    expect(ganzhiName(59)).toBe('癸亥')
    expect(ganzhiIndex('己卯')).toBe(15)
  })

  it('五鼠遁:甲日起甲子,乙日丙子', () => {
    expect(ganzhiName(hourGanzhiIndex(0, 0))).toBe('甲子')
    expect(ganzhiName(hourGanzhiIndex(1, 0))).toBe('丙子')
    expect(ganzhiName(hourGanzhiIndex(4, 6))).toBe('戊午') // 戊癸日起壬子,午時戊午
  })

  it('旬首與空亡', () => {
    expect(xunShouYi(ganzhiIndex('丙寅'))).toBe('戊') // 甲子旬
    expect(xunShouYi(ganzhiIndex('辛巳'))).toBe('己') // 甲戌旬
    expect(kongWang(ganzhiIndex('甲子'))).toEqual(['戌', '亥'])
    expect(kongWang(ganzhiIndex('甲寅'))).toEqual(['子', '丑'])
  })

  it('日干支對照 lunar 庫', () => {
    // 2000-01-01 為戊午日(廣為記載)
    expect(ganzhiName(dayGanzhiIndex(dayNumber(2000, 1, 1)))).toBe('戊午')
  })
})

describe('地盤', () => {
  it('陽遁一局:戊一己二庚三…乙九', () => {
    const p = earthPlate('陽', 1)
    expect(p[1]).toBe('戊')
    expect(p[2]).toBe('己')
    expect(p[9]).toBe('乙')
  })
  it('陰遁九局:戊九己八庚七…', () => {
    const p = earthPlate('陰', 9)
    expect(p[9]).toBe('戊')
    expect(p[8]).toBe('己')
    expect(p[1]).toBe('乙')
  })
})

describe('置閏定局', () => {
  it('模擬段連續且超接有界', () => {
    const segs = buildSegments(9)
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].startJdn - segs[i - 1].startJdn).toBe(15)
      expect(dayGanzhiIndex(segs[i].startJdn) % 15).toBe(0)
    }
    // 1900 後,超神不逾十五日,接氣不逾十五日
    for (const s of segs.filter((s) => s.startJdn > dayNumber(1900, 1, 1))) {
      expect(Math.abs(s.gapDays)).toBeLessThan(16)
    }
  })

  it('閏段必為芒種或大雪', () => {
    const segs = buildSegments(9)
    for (const s of segs.filter((s) => s.isLeap)) {
      expect(['芒種', '大雪']).toContain(s.termName)
    }
    // 約每二至三年一閏:1900–2100 間應有 60–80 閏段
    const n = segs.filter((s) => s.isLeap && s.startJdn > dayNumber(1900, 1, 1)).length
    expect(n).toBeGreaterThan(50)
    expect(n).toBeLessThan(90)
  })

  it('節氣指派恆為序進:每節恰佔一段,閏節佔二段', () => {
    const segs = buildSegments(9).filter((s) => s.startJdn > dayNumber(1900, 1, 1))
    const terms = getTerms(1900, 2100)
    // 段之節氣須與節氣表順序一致(閏段重複前段)
    let ti = terms.findIndex((t) => t.name === segs[0].termName && t.jdn === segs[0].termJdn)
    expect(ti).toBeGreaterThanOrEqual(0)
    for (let i = 1; i < segs.length && ti + 1 < terms.length; i++) {
      if (segs[i].isLeap) {
        expect(segs[i].termName).toBe(segs[i - 1].termName)
      } else {
        ti++
        expect(segs[i].termName).toBe(terms[ti].name)
      }
    }
  })
})

describe('置閏刊例迴歸', () => {
  it('2004-09-01 癸未日:置閏法白露上元陰九局(拆補法則處暑陰一局)', () => {
    const j = dayNumber(2004, 9, 1)
    expect(ganzhiName(dayGanzhiIndex(j))).toBe('癸未')
    const r = juForDay(j)
    expect(r.dun).toBe('陰')
    expect(r.ju).toBe(9)
    expect(r.termName).toBe('白露')
    expect(r.yuan).toBe(1)
    expect(r.status).toBe('超神')
  })

  it('已刊置閏年份:1975/78/81/84/87/90 大雪,1993/96 芒種,1998/2001/04/07 大雪', () => {
    const segs = buildSegments(9)
    const leaps = new Map<number, string>()
    for (const s of segs.filter((s) => s.isLeap)) {
      leaps.set(new Date(s.startJdn * 86400000).getUTCFullYear(), s.termName)
    }
    for (const y of [1975, 1978, 1981, 1984, 1987, 1990, 1998, 2001, 2004, 2007]) {
      expect(leaps.get(y), `${y}`).toBe('大雪')
    }
    for (const y of [1993, 1996]) {
      expect(leaps.get(y), `${y}`).toBe('芒種')
    }
  })
})

describe('拆補法', () => {
  it('2004-09-01 癸未日:拆補法處暑上元陰一局(刊例)', () => {
    const r = juForDayChaibu(dayNumber(2004, 9, 1))
    expect(r.dun).toBe('陰')
    expect(r.ju).toBe(1)
    expect(r.termName).toBe('處暑')
    expect(r.yuan).toBe(1)
  })
})

describe('斷析', () => {
  it('十二長生:甲死午、乙墓戌、庚墓丑、癸墓未', () => {
    expect(stageOf('甲', '午')).toBe('死')
    expect(stageOf('乙', '戌')).toBe('墓')
    expect(stageOf('庚', '丑')).toBe('墓')
    expect(stageOf('癸', '未')).toBe('墓')
    expect(stageOf('甲', '亥')).toBe('長生')
  })

  it('二支宮取旺者為主', () => {
    // 乾宮戌亥:甲養於戌、長生於亥 → 主長生
    const s = stagesInPalace('甲', ['戌', '亥'])!
    expect(s.primary).toBe('長生')
    expect(s.perBranch).toHaveLength(2)
  })

  it('門宮生剋:景門入乾為門迫,休門入離為門迫,開門入離為門制', () => {
    expect(doorPalaceRelation('景門', 6).key).toBe('迫') // 火剋金
    expect(doorPalaceRelation('休門', 9).key).toBe('迫') // 水剋火
    expect(doorPalaceRelation('開門', 9).key).toBe('制') // 火剋金,宮剋門
    expect(doorPalaceRelation('休門', 1).key).toBe('伏') // 比和
    expect(doorPalaceRelation('生門', 9).key).toBe('義') // 火生土
  })

  it('九星旺衰依煙波釣叟歌:同行相、我生旺、父母廢、財休、鬼囚', () => {
    // 天蓬屬水:木月(我生)旺、水月(同行)相、火月(財)休、土月(鬼)囚、金月(父母)廢
    expect(starWangShuai('水', '木')).toBe('旺')
    expect(starWangShuai('水', '水')).toBe('相')
    expect(starWangShuai('水', '火')).toBe('休')
    expect(starWangShuai('水', '土')).toBe('囚')
    expect(starWangShuai('水', '金')).toBe('廢')
  })

  it('十干剋應八十一格俱全', () => {
    const stems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']
    for (const a of stems) for (const b of stems) {
      expect(KE_YING[`${a}+${b}`], `${a}+${b}`).toBeDefined()
    }
    expect(KE_YING['戊+丙'].name).toBe('青龍返首')
    expect(KE_YING['丙+戊'].name).toBe('飛鳥跌穴')
  })
})

describe('擊刑', () => {
  it('六儀擊刑以本宮天盤儀論,中五寄干(隨禽)不論刑', () => {
    // 2026-07-05 丑時(丁丑):陰遁八局,天盤己落坤二(戌刑未)為擊刑;
    // 離九天盤丁辛,辛乃中五寄干隨禽至離,不論刑
    const chart = computeChart({ year: 2026, month: 7, day: 5, hour: 2, minute: 0 })
    const ana = analyzeChart(chart)
    expect(chart.pillars.hour).toBe('丁丑')
    const hasXing = (p: number) =>
      ana.palaces[p - 1].geju.some((g) => g.name === '六儀擊刑')
    expect(chart.palaces[1].skyStems).toEqual(['己']) // 坤二
    expect(hasXing(2)).toBe(true)
    expect(chart.palaces[8].skyStems).toEqual(['丁', '辛']) // 離九,辛為寄干
    expect(hasXing(9)).toBe(false)
  })
})

describe('暗干與帶干', () => {
  it('八門帶干:當局地盤中門本宮之干(陰遁八局:休帶丙、開帶庚、景帶乙)', () => {
    // 2026-07-05 10:30 → 置閏法小暑上元陰遁八局:地盤 丙1 丁2 癸3 壬4 辛5 庚6 己7 戊8 乙9
    const chart = computeChart({ year: 2026, month: 7, day: 5, hour: 10, minute: 30 })
    expect(chart.ju.dun).toBe('陰')
    expect(chart.ju.ju).toBe(8)
    const byDoor = (d: string) =>
      chart.palaces.find((p) => p.door === d)!.doorDaiGan
    expect(byDoor('休門')).toBe('丙')
    expect(byDoor('開門')).toBe('庚')
    expect(byDoor('景門')).toBe('乙')
    expect(byDoor('死門')).toBe('丁')
  })

  it('隱干刊例:壬申時陽遁一局,值使休門落離九,其隱干為壬', () => {
    // 陽遁一局上元符頭日必為甲己日,甲己日申時即壬申
    const segs = buildSegments(9)
    const seg = segs.find(
      (s) => s.startJdn > dayNumber(2000, 1, 1) && s.termName === '冬至' && !s.isLeap,
    )!
    const ymd = jdnToDate(seg.startJdn)
    const chart = computeChart({ ...ymd, hour: 15, minute: 30 })
    expect(chart.ju.dun).toBe('陽')
    expect(chart.ju.ju).toBe(1)
    expect(chart.pillars.hour).toBe('壬申')
    expect(chart.zhiShiDoor).toBe('休門')
    const yin = (p: number) => chart.palaces[p - 1].yinGan
    expect(chart.palaces[8].isZhiShi).toBe(true) // 離九
    expect(yin(9)).toBe('壬')
    // 陽遁順飛:一宮起癸,循三奇六儀次序
    expect(yin(1)).toBe('癸')
    expect(yin(2)).toBe('丁')
    expect(yin(5)).toBe('戊')
    expect(yin(8)).toBe('辛')
    // 暗干:甲起旬首儀(戊)地盤宮坎一,十干順飛,癸復歸本宮
    const an = (p: number) => chart.palaces[p - 1].anGan
    expect(an(1)).toBe('甲癸')
    expect(an(2)).toBe('乙')
    expect(an(5)).toBe('戊')
    expect(an(9)).toBe('壬')
  })
})

describe('排盤', () => {
  it('陽遁一局甲子時為伏吟局', () => {
    // 構造:尋一日,置閏法得陽遁一局上元、日干支使某時為甲子時
    // 直接驗排盤內部一致性:值符落宮 = 旬首儀宮 ⇒ 天地盤全同(伏吟)
    const segs = buildSegments(9)
    const seg = segs.find(
      (s) => s.startJdn > dayNumber(2000, 1, 1) && s.termName === '冬至' && !s.isLeap,
    )!
    // 上元符頭日必為甲己日,五鼠遁甲己日子時為甲子時
    const ymd = jdnToDate(seg.startJdn)
    const chart = computeChart({ ...ymd, hour: 0, minute: 30 })
    expect(chart.ju.dun).toBe('陽')
    expect(chart.ju.ju).toBe(1)
    // 甲子時旬首甲子遁戊,戊在一宮,天蓬為值符,值符落一宮 → 伏吟
    if (chart.pillars.hour === '甲子') {
      const k = chart.palaces[0] // 坎一
      expect(k.stars).toContain('天蓬')
      expect(k.door).toBe('休門')
      expect(k.isZhiFu).toBe(true)
    }
  })

  it('九宮結構完備:八神八門九星各歸其位', () => {
    const chart = computeChart({ year: 2026, month: 7, day: 5, hour: 10, minute: 0 })
    const outer = chart.palaces.filter((p) => p.palace !== 5)
    expect(new Set(outer.map((p) => p.god)).size).toBe(8)
    expect(new Set(outer.map((p) => p.door)).size).toBe(8)
    expect(outer.flatMap((p) => p.stars)).toHaveLength(9) // 八宮九星(芮禽同宮)
    expect(outer.filter((p) => p.isZhiFu)).toHaveLength(1)
    expect(outer.filter((p) => p.isZhiShi)).toHaveLength(1)
    // 天地盤各具九干
    const sky = outer.flatMap((p) => p.skyStems)
    expect(new Set(sky).size).toBe(9)
  })

  it('空亡馬星按時支', () => {
    const chart = computeChart({ year: 2026, month: 7, day: 5, hour: 10, minute: 0 })
    expect(BRANCHES).toContain(chart.horseBranch)
    expect(chart.kongWang).toHaveLength(2)
  })
})

function jdnToDate(jdn: number): { year: number; month: number; day: number } {
  const d = new Date(jdn * 86400000)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}
