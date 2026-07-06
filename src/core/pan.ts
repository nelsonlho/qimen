// 時家轉盤(陽盤)排盤

import { Solar } from 'lunar-typescript'
import {
  STEMS,
  ganzhiName,
  hourBranchIndex,
  hourGanzhiIndex,
  horseBranch,
  kongWang,
  xunShouYi,
  xunStart,
} from './ganzhi'
import { dayGanzhiIndex, juForDay, juForDayChaibu, juForHourXun, type JuDayResult } from './ju'
import { dayNumber } from './solarTerms'
import type { Chart, DateParts, PalaceInfo, Pillars, QimenOptions } from './types'

// 轉盤宮序(順時針):坎一 → 艮八 → 震三 → 巽四 → 離九 → 坤二 → 兌七 → 乾六
const CIRC = [1, 8, 3, 4, 9, 2, 7, 6]

const STAR_BY_PALACE: Record<number, string> = {
  1: '天蓬', 8: '天任', 3: '天沖', 4: '天輔', 9: '天英', 2: '天芮', 7: '天柱', 6: '天心',
}
const DOOR_BY_PALACE: Record<number, string> = {
  1: '休門', 8: '生門', 3: '傷門', 4: '杜門', 9: '景門', 2: '死門', 7: '驚門', 6: '開門',
}
const GODS = ['值符', '騰蛇', '太陰', '六合', '白虎', '玄武', '九地', '九天']

/** 八門本宮 */
export const DOOR_HOME: Record<string, number> = {
  休門: 1, 死門: 2, 傷門: 3, 杜門: 4, 開門: 6, 驚門: 7, 生門: 8, 景門: 9,
}

export const PALACE_NAMES: Record<number, string> = {
  1: '坎一', 2: '坤二', 3: '震三', 4: '巽四', 5: '中五', 6: '乾六', 7: '兌七', 8: '艮八', 9: '離九',
}

/** 宮所藏地支(定空亡、馬星落宮) */
const PALACE_BRANCHES: Record<number, string[]> = {
  1: ['子'], 8: ['丑', '寅'], 3: ['卯'], 4: ['辰', '巳'],
  9: ['午'], 2: ['未', '申'], 7: ['酉'], 6: ['戌', '亥'],
  5: [],
}

// 三奇六儀佈地盤次序
const EARTH_SEQ = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙']

function wrap9(n: number): number {
  return ((n - 1) % 9 + 9) % 9 + 1
}

function jiGong(palace: number): number {
  return palace === 5 ? 2 : palace // 中五寄坤二
}

/** 地盤:戊落局宮,陽順陰逆 */
export function earthPlate(dun: '陽' | '陰', ju: number): Record<number, string> {
  const plate: Record<number, string> = {}
  for (let i = 0; i < 9; i++) {
    const palace = dun === '陽' ? wrap9(ju + i) : wrap9(ju - i)
    plate[palace] = EARTH_SEQ[i]
  }
  return plate
}

function palaceOfStem(plate: Record<number, string>, stem: string): number {
  for (let p = 1; p <= 9; p++) if (plate[p] === stem) return p
  throw new Error(`地盤無此干: ${stem}`)
}

export function computeChart(input: DateParts, options: QimenOptions = {}): Chart {
  const ziShiMode = options.ziShiMode ?? '23'
  const threshold = options.leapThreshold ?? 9
  const method = options.method ?? '置閏'

  // --- 定日:夜子時(23 時)按法換日 ---
  let dayJdn = dayNumber(input.year, input.month, input.day)
  if (ziShiMode === '23' && input.hour === 23) dayJdn += 1

  const dayGz = dayGanzhiIndex(dayJdn)
  const hourBr = hourBranchIndex(input.hour)
  const hourGz = hourGanzhiIndex(dayGz % 10, hourBr)

  // --- 四柱(年月取立春/節氣真時刻) ---
  const lunar = Solar.fromYmdHms(input.year, input.month, input.day, input.hour, input.minute, 0).getLunar()
  const pillars: Pillars = {
    year: lunar.getYearInGanZhiExact(),
    month: lunar.getMonthInGanZhiExact(),
    day: ganzhiName(dayGz),
    hour: ganzhiName(hourGz),
  }

  // --- 定局 ---
  const ju: JuDayResult =
    method === '拆補'
      ? juForDayChaibu(dayJdn)
      : method === '旬首'
        ? juForHourXun(dayJdn, hourGz, threshold)
        : juForDay(dayJdn, threshold)
  const plate = earthPlate(ju.dun, ju.ju)

  // --- 旬首、值符值使 ---
  const xun = xunStart(hourGz)
  const yi = xunShouYi(hourGz) // 旬首所遁儀
  const fuPalaceRaw = palaceOfStem(plate, yi) // 值符原宮(可為 5)
  const zhiFuStar = fuPalaceRaw === 5 ? '天禽' : STAR_BY_PALACE[fuPalaceRaw]
  const zhiShiDoor = fuPalaceRaw === 5 ? DOOR_BY_PALACE[2] : DOOR_BY_PALACE[fuPalaceRaw]

  // 時干(甲用旬首儀)所在地盤宮 = 值符星落宮
  const hourStem = STEMS[hourGz % 10]
  const searchStem = hourStem === '甲' ? yi : hourStem
  const fuTarget = jiGong(palaceOfStem(plate, searchStem))

  // --- 天盤:轉盤,值符星移至落宮,餘星隨轉 ---
  const fuOrig = jiGong(fuPalaceRaw)
  const shift = (CIRC.indexOf(fuTarget) - CIRC.indexOf(fuOrig) + 8) % 8
  const skyStars: Record<number, string[]> = {}
  const skyStems: Record<number, string[]> = {}
  for (let i = 0; i < 8; i++) {
    const orig = CIRC[i]
    const dest = CIRC[(i + shift) % 8]
    const stars = orig === 2 ? ['天芮', '天禽'] : [STAR_BY_PALACE[orig]]
    const stems = orig === 2 ? [plate[2], plate[5]] : [plate[orig]]
    skyStars[dest] = stars
    skyStems[dest] = stems
  }

  // --- 值使門落宮:自原宮起,每時辰行一宮,陽順陰逆(含中五) ---
  const steps = hourGz - xun // 0..9
  const landRaw = ju.dun === '陽' ? wrap9(fuPalaceRaw + steps) : wrap9(fuPalaceRaw - steps)
  const zhiShiPalace = jiGong(landRaw)
  const doorOrig = fuPalaceRaw === 5 ? 2 : fuPalaceRaw
  const doorShift = (CIRC.indexOf(zhiShiPalace) - CIRC.indexOf(doorOrig) + 8) % 8
  const doors: Record<number, string> = {}
  for (let i = 0; i < 8; i++) {
    const orig = CIRC[i]
    const dest = CIRC[(i + doorShift) % 8]
    doors[dest] = DOOR_BY_PALACE[orig]
  }

  // --- 八神:直符加值符星落宮,陽順陰逆 ---
  const gods: Record<number, string> = {}
  const gIdx = CIRC.indexOf(fuTarget)
  for (let i = 0; i < 8; i++) {
    const dest = ju.dun === '陽' ? CIRC[(gIdx + i) % 8] : CIRC[(gIdx - i + 8) % 8]
    gods[dest] = GODS[i]
  }

  // --- 暗干:地甲為直符——甲起旬首儀地盤宮,十干依序陽順陰逆飛佈,逢癸復歸本宮 ---
  const anGan: Record<number, string> = {}
  for (let i = 0; i < 10; i++) {
    const p = ju.dun === '陽' ? wrap9(fuPalaceRaw + i) : wrap9(fuPalaceRaw - i)
    anGan[p] = (anGan[p] ?? '') + STEMS[i]
  }

  // --- 隱干:時干(甲用旬首儀)加值使落宮,三奇六儀次序陽順陰逆飛佈(含中五) ---
  const yinGan: Record<number, string> = {}
  const yinSeqStart = EARTH_SEQ.indexOf(searchStem)
  for (let i = 0; i < 9; i++) {
    const p = ju.dun === '陽' ? wrap9(landRaw + i) : wrap9(landRaw - i)
    yinGan[p] = EARTH_SEQ[(yinSeqStart + i) % 9]
  }

  // --- 空亡、馬星 ---
  const kw = kongWang(hourGz)
  const horse = horseBranch(hourGz % 12)

  const palaces: PalaceInfo[] = []
  for (let p = 1; p <= 9; p++) {
    const branches = PALACE_BRANCHES[p]
    const door = p === 5 ? null : doors[p] ?? null
    palaces.push({
      // 門帶干:當局地盤中,門本宮之干
      doorDaiGan: door ? plate[DOOR_HOME[door]] : null,
      palace: p,
      name: PALACE_NAMES[p],
      god: p === 5 ? null : gods[p] ?? null,
      stars: p === 5 ? [] : skyStars[p] ?? [],
      skyStems: p === 5 ? [] : skyStems[p] ?? [],
      door,
      earthStems: p === 5 ? [plate[5]] : p === 2 ? [plate[2], plate[5]] : [plate[p]],
      isZhiFu: p !== 5 && p === fuTarget,
      isZhiShi: p !== 5 && p === zhiShiPalace,
      kong: branches.some((b) => kw.includes(b)),
      horse: branches.includes(horse),
      anGan: anGan[p],
      yinGan: yinGan[p],
    })
  }

  return {
    input,
    pillars,
    ju: {
      method,
      dun: ju.dun,
      ju: ju.ju,
      termName: ju.termName,
      yuan: ju.yuan,
      yuanName: (['上元', '中元', '下元'] as const)[ju.yuan - 1],
      fuTou: ju.fuTou,
      shangYuanFuTou: ju.shangYuanFuTou,
      status: ju.status,
      gapDays: ju.gapDays,
    },
    xunShou: `${ganzhiName(xun)}(${yi})`,
    xunYi: yi,
    zhiFuStar,
    zhiShiDoor,
    kongWang: kw,
    horseBranch: horse,
    palaces,
  }
}
