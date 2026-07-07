// 遁甲穿壬:大六壬十二天將佈於奇門盤十二支位
//
// 起例:以日干定天乙貴人(晝夜有別),歌訣「甲戊庚牛羊,乙己鼠猴鄉,
// 丙丁豬雞位,壬癸兔蛇藏,六辛逢馬虎」——晝貴取前支,夜貴取後支。
// 晝占(卯至申時)用晝貴,夜占(酉至寅時)用夜貴。
// 貴人落亥子丑寅卯辰六位為順治,順佈十二將;落巳午未申酉戌為逆治,逆佈。

import { BRANCHES } from './ganzhi'
import type { Luck } from './keying'

export const TIAN_JIANG = [
  '貴人', '螣蛇', '朱雀', '六合', '勾陳', '青龍',
  '天空', '白虎', '太常', '玄武', '太陰', '天后',
] as const

export type TianJiang = (typeof TIAN_JIANG)[number]

export const JIANG_SHORT: Record<TianJiang, string> = {
  貴人: '貴', 螣蛇: '蛇', 朱雀: '雀', 六合: '合', 勾陳: '勾', 青龍: '龍',
  天空: '空', 白虎: '虎', 太常: '常', 玄武: '玄', 太陰: '陰', 天后: '后',
}

/** 六吉六凶(通行說) */
export const JIANG_LUCK: Record<TianJiang, Luck> = {
  貴人: '吉', 六合: '吉', 青龍: '吉', 太常: '吉', 太陰: '吉', 天后: '吉',
  螣蛇: '凶', 朱雀: '凶', 勾陳: '凶', 天空: '凶', 白虎: '凶', 玄武: '凶',
}

/** 日干 → [晝貴支, 夜貴支] */
const GUI_REN: Record<string, [string, string]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅'],
}

/** 晝時辰:卯至申 */
const DAY_HOURS = new Set(['卯', '辰', '巳', '午', '未', '申'])

/** 順治之位:亥子丑寅卯辰 */
const SHUN_ZHI = new Set(['亥', '子', '丑', '寅', '卯', '辰'])

/**
 * 佈十二天將。回傳 支 → 天將。
 * @param dayStem 日干
 * @param hourBranch 時支(定晝夜)
 */
export function chuanRen(dayStem: string, hourBranch: string): Record<string, TianJiang> {
  const pair = GUI_REN[dayStem]
  if (!pair) throw new Error(`穿壬無解:日干 ${dayStem}`)
  const gui = pair[DAY_HOURS.has(hourBranch) ? 0 : 1]
  const start = BRANCHES.indexOf(gui as (typeof BRANCHES)[number])
  const dir = SHUN_ZHI.has(gui) ? 1 : -1
  const out: Record<string, TianJiang> = {}
  for (let i = 0; i < 12; i++) {
    out[BRANCHES[(start + dir * i + 24) % 12]] = TIAN_JIANG[i]
  }
  return out
}
