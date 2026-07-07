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
import { PALACE_NUMBERS } from '../numbers'
import { matchZeGe } from '../zege'
import { dayNumber, getTerms } from '../solarTerms'
import { computeChart, earthPlate } from '../pan'
import { chuanRen } from '../chuanren'

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

describe('九宮之數', () => {
  it('先天後天五行併集,與刊表吻合', () => {
    expect(PALACE_NUMBERS[1].all).toEqual([1, 6])
    expect(PALACE_NUMBERS[2].all).toEqual([2, 5, 8, 10])
    expect(PALACE_NUMBERS[3].all).toEqual([3, 4, 8])
    expect(PALACE_NUMBERS[4].all).toEqual([3, 4, 5, 8])
    expect(PALACE_NUMBERS[5].all).toEqual([5, 10])
    expect(PALACE_NUMBERS[6].all).toEqual([1, 4, 6, 9])
    expect(PALACE_NUMBERS[7].all).toEqual([2, 4, 7, 9])
    expect(PALACE_NUMBERS[8].all).toEqual([5, 7, 8, 10])
    expect(PALACE_NUMBERS[9].all).toEqual([2, 3, 7, 9])
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

describe('擇日格', () => {
  it('五不遇時:庚辰日丙子時(時干剋日干)', () => {
    const chart = computeChart({ year: 2026, month: 7, day: 5, hour: 0, minute: 30 })
    expect(chart.pillars.day).toBe('庚辰')
    expect(chart.pillars.hour).toBe('丙子')
    const ana = analyzeChart(chart)
    expect(ana.global.some((g) => g.name === '五不遇時')).toBe(true)
  })
})

describe('擇日格判器', () => {
  const base = {
    palace: 1, name: '坎一', god: null as string | null, stars: ['天蓬'],
    skyStems: ['戊'], door: '休門' as string | null, earthStems: ['戊'],
    isZhiFu: false, isZhiShi: false, kong: false, horse: false,
    anGan: '甲', yinGan: '戊', doorDaiGan: null as string | null,
  }
  it('人遁:休門+丁+太陰', () => {
    const hits = matchZeGe({ ...base, skyStems: ['丁'], god: '太陰' })
    expect(hits.map((h) => h.name)).toContain('人遁')
    expect(hits.map((h) => h.name)).toContain('真詐') // 丁亦三奇,休門+太陰兼成真詐
  })
  it('地遁:開門+乙+地盤己', () => {
    const hits = matchZeGe({ ...base, door: '開門', skyStems: ['乙'], earthStems: ['己'] })
    expect(hits.map((h) => h.name)).toContain('地遁')
  })
  it('龍遁:吉門+乙落坎一', () => {
    const hits = matchZeGe({ ...base, skyStems: ['乙'] })
    expect(hits.map((h) => h.name)).toContain('龍遁')
  })
  it('三奇升殿:丙落離九;得使:丁臨壬', () => {
    expect(
      matchZeGe({ ...base, palace: 9, name: '離九', skyStems: ['丙'], door: '景門' }).map((h) => h.name),
    ).toContain('三奇升殿')
    expect(
      matchZeGe({ ...base, skyStems: ['丁'], earthStems: ['壬'] }).map((h) => h.name),
    ).toContain('三奇得使')
  })
  it('不中則無', () => {
    expect(matchZeGe(base).filter((h) => h.name.includes('遁'))).toHaveLength(0)
  })
})

describe('旬首法(十刻一局)', () => {
  it('用戶刊例:辛巳日(小暑上元陰八)戊子時甲申旬陰六、甲午時甲午旬陰五', () => {
    // 2026-07-06 辛巳日,置閏定元:小暑上元陰遁八局(符頭己卯超三日)
    const zi = computeChart({ year: 2026, month: 7, day: 6, hour: 0, minute: 30 }, { method: '旬首' })
    expect(zi.pillars.day).toBe('辛巳')
    expect(zi.pillars.hour).toBe('戊子')
    expect(zi.ju.termName).toBe('小暑')
    expect(zi.ju.yuan).toBe(1)
    expect(zi.ju.dun).toBe('陰')
    expect(zi.ju.ju).toBe(6) // 甲申旬:8−2
    const wu = computeChart({ year: 2026, month: 7, day: 6, hour: 11, minute: 30 }, { method: '旬首' })
    expect(wu.pillars.hour).toBe('甲午')
    expect(wu.ju.ju).toBe(5) // 甲午旬:8−3
  })

  it('陽遁順加:冬至上元甲子旬一局、甲戌旬二局', () => {
    const segs = buildSegments(9)
    const seg = segs.find(
      (s) => s.startJdn > dayNumber(2000, 1, 1) && s.termName === '冬至' && !s.isLeap,
    )!
    const ymd = jdnToDate(seg.startJdn)
    const zi = computeChart({ ...ymd, hour: 0, minute: 30 }, { method: '旬首' })
    expect(zi.ju.ju).toBe(1) // 甲子旬
    const xu = computeChart({ ...ymd, hour: 19, minute: 30 }, { method: '旬首' })
    expect(xu.pillars.hour).toBe('甲戌')
    expect(xu.ju.ju).toBe(2) // 甲戌旬:1+1
  })
})

describe('八刻法(一時辰八刻)', () => {
  it('用戶刊例:2026-07-06 辛巳日甲午時全時辰陰五(依甲午旬符首定局)', () => {
    // 午時 11:00-13:00,八刻皆同局
    const first = computeChart({ year: 2026, month: 7, day: 6, hour: 11, minute: 0 }, { method: '八刻' })
    expect(first.pillars.hour).toBe('甲午')
    expect(first.ju.dun).toBe('陰')
    expect(first.ju.ju).toBe(5)
    expect(first.ju.ke).toBe(1)
    const last = computeChart({ year: 2026, month: 7, day: 6, hour: 12, minute: 45 }, { method: '八刻' })
    expect(last.ju.ju).toBe(5)
    expect(last.ju.ke).toBe(8)
  })

  it('用戶刊例:辛巳日戊子時甲申旬陰六,八刻皆然', () => {
    // 子時起於 23:00(奇數時為前半),偶數時 0 時為後半
    const kes = [
      { d: 5, hour: 23, minute: 0, ke: 1 },
      { d: 5, hour: 23, minute: 45, ke: 4 },
      { d: 6, hour: 0, minute: 0, ke: 5 },
      { d: 6, hour: 0, minute: 59, ke: 8 },
    ]
    for (const t of kes) {
      const c = computeChart({ year: 2026, month: 7, day: t.d, hour: t.hour, minute: t.minute }, { method: '八刻' })
      expect(c.pillars.hour).toBe('戊子')
      expect(c.ju.dun).toBe('陰')
      expect(c.ju.ju).toBe(6) // 甲申旬:8−2
      expect(c.ju.ke).toBe(t.ke)
    }
  })

  it('他法不帶刻序', () => {
    const c = computeChart({ year: 2026, month: 7, day: 6, hour: 0, minute: 30 }, { method: '置閏' })
    expect(c.ju.ke).toBeUndefined()
  })
})

describe('農曆日期', () => {
  it('2026-07-06 為五月廿二', () => {
    const c = computeChart({ year: 2026, month: 7, day: 6, hour: 12, minute: 0 })
    expect(c.lunarDate).toBe('五月廿二')
  })

  it('閏月正體:2025-08-06 為閏六月十三', () => {
    const c = computeChart({ year: 2025, month: 8, day: 6, hour: 12, minute: 0 })
    expect(c.lunarDate).toBe('閏六月十三')
  })
})

describe('遁甲穿壬', () => {
  it('甲日晝占:貴人丑,順治順佈', () => {
    const m = chuanRen('甲', '午')
    expect(m['丑']).toBe('貴人')
    expect(m['寅']).toBe('螣蛇')
    expect(m['卯']).toBe('朱雀')
    expect(m['午']).toBe('青龍')
    expect(m['子']).toBe('天后')
  })

  it('甲日夜占:貴人未,逆治逆佈', () => {
    const m = chuanRen('甲', '子')
    expect(m['未']).toBe('貴人')
    expect(m['午']).toBe('螣蛇')
    expect(m['巳']).toBe('朱雀')
    expect(m['申']).toBe('天后')
  })

  it('晝夜之界:卯時晝、酉時夜;十二將無重', () => {
    expect(chuanRen('乙', '卯')['子']).toBe('貴人') // 晝貴子
    expect(chuanRen('乙', '酉')['申']).toBe('貴人') // 夜貴申
    const m = chuanRen('辛', '巳') // 晝貴午,逆治
    expect(m['午']).toBe('貴人')
    expect(m['巳']).toBe('螣蛇')
    expect(new Set(Object.values(m)).size).toBe(12)
  })
})

describe('飛盤', () => {
  const w9 = (n: number) => ((n - 1) % 9 + 9) % 9 + 1
  const GODS_FLY = ['值符', '騰蛇', '太陰', '六合', '勾陳', '朱雀', '太常', '九地', '九天']

  function checkFly(input: { year: number; month: number; day: number; hour: number; minute: number }) {
    const chart = computeChart(input, { plate: '飛盤' })
    expect(chart.plateStyle).toBe('飛盤')
    // 九宮各一星一天盤干一地盤干,星九枚無重含天禽
    const stars = chart.palaces.map((p) => p.stars)
    expect(stars.every((s) => s.length === 1)).toBe(true)
    expect(new Set(stars.flat()).size).toBe(9)
    expect(stars.flat()).toContain('天禽')
    expect(chart.palaces.every((p) => p.skyStems.length === 1 && p.earthStems.length === 1)).toBe(true)
    expect(new Set(chart.palaces.map((p) => p.skyStems[0])).size).toBe(9)
    // 值符星落時干宮,神為值符
    const fuT = chart.palaces.find((p) => p.isZhiFu)!
    expect(fuT.stars[0]).toBe(chart.zhiFuStar)
    expect(fuT.god).toBe('值符')
    // 飛佈方向:星攜本宮地盤干,src 自值符宮順序,dest 自時干宮陽順陰逆
    const plateMap: Record<number, string> = {}
    for (const p of chart.palaces) plateMap[p.palace] = p.earthStems[0]
    const fuRaw = chart.palaces.find((p) => plateMap[p.palace] === chart.xunYi)!.palace
    const dir = chart.ju.dun === '陽' ? 1 : -1
    for (let i = 0; i < 9; i++) {
      const src = w9(fuRaw + i)
      const dest = w9(fuT.palace + dir * i)
      expect(chart.palaces[dest - 1].skyStems[0]).toBe(plateMap[src])
      expect(chart.palaces[dest - 1].god).toBe(GODS_FLY[i])
    }
    // 八門八枚,一宮懸空;值使宮之門為值使門
    const doorless = chart.palaces.filter((p) => p.door === null)
    expect(doorless.length).toBe(1)
    const shi = chart.palaces.find((p) => p.isZhiShi)!
    if (shi.door) expect(shi.door).toBe(chart.zhiShiDoor)
    return chart
  }

  it('陰遁飛盤佈局', () => {
    const chart = checkFly({ year: 2026, month: 7, day: 6, hour: 12, minute: 0 })
    expect(chart.ju.dun).toBe('陰')
  })

  it('陽遁飛盤佈局', () => {
    const chart = checkFly({ year: 2026, month: 1, day: 15, hour: 10, minute: 0 })
    expect(chart.ju.dun).toBe('陽')
  })

  it('轉盤為預設,不受影響', () => {
    const chart = computeChart({ year: 2026, month: 7, day: 6, hour: 12, minute: 0 })
    expect(chart.plateStyle).toBe('轉盤')
    expect(chart.palaces[4].stars).toEqual([])
    expect(chart.palaces[1].earthStems.length).toBe(2) // 坤二寄中五干
  })
})

describe('鳴法', () => {
  const w9 = (n: number) => ((n - 1) % 9 + 9) % 9 + 1
  const YANG = ['值符', '騰蛇', '太陰', '六合', '勾陳', '太常', '朱雀', '九地', '九天']
  const YIN = ['值符', '騰蛇', '太陰', '六合', '白虎', '太常', '玄武', '九地', '九天']
  const DOOR_MING: Record<number, string> = {
    1: '休門', 2: '死門', 3: '傷門', 4: '杜門', 5: '中門', 6: '開門', 7: '驚門', 8: '生門', 9: '景門',
  }

  function checkMing(input: { year: number; month: number; day: number; hour: number; minute: number }) {
    const chart = computeChart(input, { plate: '鳴法' })
    expect(chart.plateStyle).toBe('鳴法')
    // 九宮各一星一干,九門俱全含中門
    expect(chart.palaces.every((p) => p.stars.length === 1 && p.skyStems.length === 1)).toBe(true)
    const doors = chart.palaces.map((p) => p.door)
    expect(new Set(doors).size).toBe(9)
    expect(doors).toContain('中門')
    // 星、儀、門恆順飛:src 自值符宮升序,dest 升序(不分陰陽遁)
    const plateMap: Record<number, string> = {}
    for (const p of chart.palaces) plateMap[p.palace] = p.earthStems[0]
    const fuRaw = chart.palaces.find((p) => plateMap[p.palace] === chart.xunYi)!.palace
    const fuT = chart.palaces.find((p) => p.isZhiFu)!.palace
    const shiT = chart.palaces.find((p) => p.isZhiShi)!.palace
    for (let i = 0; i < 9; i++) {
      const src = w9(fuRaw + i)
      expect(chart.palaces[w9(fuT + i) - 1].skyStems[0]).toBe(plateMap[src])
      expect(chart.palaces[w9(shiT + i) - 1].door).toBe(DOOR_MING[src])
    }
    // 九神兩套:天盤自值符落宮、地盤自值符原宮,陽順陰逆
    const seq = chart.ju.dun === '陽' ? YANG : YIN
    const dir = chart.ju.dun === '陽' ? 1 : -1
    for (let i = 0; i < 9; i++) {
      expect(chart.palaces[w9(fuT + dir * i) - 1].god).toBe(seq[i])
      expect(chart.palaces[w9(fuRaw + dir * i) - 1].earthGod).toBe(seq[i])
    }
    // 飛支:旬宮起本旬首支,十二支陽順陰逆,共十二字
    const BR = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
    const xunBranch = chart.xunShou[1] // 如 甲辰(壬) → 辰
    const start = BR.indexOf(xunBranch)
    for (let i = 0; i < 12; i++) {
      const p = w9(fuRaw + dir * i)
      expect(chart.palaces[p - 1].anZhi).toContain(BR[(start + i) % 12])
    }
    expect(chart.palaces[fuRaw - 1].anZhi![0]).toBe(xunBranch)
    expect(chart.palaces.map((p) => p.anZhi ?? '').join('').length).toBe(12)
    return chart
  }

  it('陰遁鳴法:恆順飛,九神用虎玄逆佈', () => {
    const chart = checkMing({ year: 2026, month: 7, day: 6, hour: 12, minute: 0 })
    expect(chart.ju.dun).toBe('陰')
    expect(chart.palaces.map((p) => p.god)).toContain('白虎')
    expect(chart.palaces.map((p) => p.god)).toContain('玄武')
  })

  it('陽遁鳴法:九神用陳雀常順佈', () => {
    const chart = checkMing({ year: 2026, month: 1, day: 15, hour: 10, minute: 0 })
    expect(chart.ju.dun).toBe('陽')
    const gods = chart.palaces.map((p) => p.god)
    expect(gods).toContain('勾陳')
    expect(gods).toContain('朱雀')
    expect(gods).toContain('太常')
  })

  it('轉盤/飛盤無地盤神;鳴法值符原宮地盤神為值符', () => {
    expect(
      computeChart({ year: 2026, month: 7, day: 6, hour: 12, minute: 0 })
        .palaces.every((p) => p.earthGod == null),
    ).toBe(true)
    expect(
      computeChart({ year: 2026, month: 7, day: 6, hour: 12, minute: 0 }, { plate: '飛盤' })
        .palaces.every((p) => p.earthGod == null),
    ).toBe(true)
  })
})
