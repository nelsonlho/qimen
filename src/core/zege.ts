// 擇日格局:九遁、三詐、五假、三奇升殿、三奇得使等
// 條件判器 — 格局數據待考據填充

import type { Luck } from './keying'
import type { PalaceInfo } from './types'

export interface ZeGeCond {
  door?: string
  doorAny?: string[]
  skyStem?: string
  skyStemAny?: string[]
  earthStem?: string
  earthStemAny?: string[]
  god?: string
  godAny?: string[]
  palace?: number
  palaceAny?: number[]
}

export interface ZeGeDef {
  cond: ZeGeCond
  luck: Luck
  note: string
  variants?: string[] // 異說
}

/**
 * 宮級擇日格(門+奇儀+神+宮之組合)
 * 條件從主流(煙波釣叟歌注、通行整理本);有異說者錄於 variants 備考
 */
export const ZE_GE: Record<string, ZeGeDef> = {
  天遁: {
    cond: { door: '生門', skyStem: '丙', earthStem: '丁' },
    luck: '吉',
    note: '月精華蓋,宜百事,尤宜上書求官、經商婚姻',
    variants: ['另說丙臨地盤六戊,較少用'],
  },
  地遁: {
    cond: { door: '開門', skyStem: '乙', earthStem: '己' },
    luck: '吉',
    note: '日精紫雲蔽,宜修造安葬、屯兵設寨、隱跡',
  },
  人遁: {
    cond: { door: '休門', skyStem: '丁', god: '太陰' },
    luck: '吉',
    note: '星精太陰蔽,宜和談交易、婚姻、探密求謀',
  },
  神遁: {
    cond: { door: '生門', skyStem: '丙', god: '九天' },
    luck: '吉',
    note: '宜祭祀祈福、揚兵布陣、宣揚聲勢',
    variants: ['一說須落乾宮,多數不取宮位限制'],
  },
  鬼遁: {
    cond: { door: '杜門', skyStem: '丁', god: '九地' },
    luck: '吉',
    note: '宜探敵刺察、暗謀襲擊、閉藏',
    variants: ['另說生門六丁臨九地', '一說杜門合六乙會九地'],
  },
  風遁: {
    cond: { doorAny: ['開門', '休門', '生門'], skyStem: '乙', palace: 4 },
    luck: '吉',
    note: '乙奇合吉門落巽宮,宜候風使船、火攻借勢',
    variants: ['一說專主開門;或加要求合六辛'],
  },
  雲遁: {
    cond: { doorAny: ['開門', '休門', '生門'], skyStem: '乙', earthStem: '辛' },
    luck: '吉',
    note: '宜祈雨澤、藏形遁跡、化險為夷',
    variants: ['另說乙奇合吉門臨坤二宮'],
  },
  龍遁: {
    cond: { doorAny: ['開門', '休門', '生門'], skyStem: '乙', palace: 1 },
    luck: '吉',
    note: '宜水戰行船、祈雨、謁貴求謀',
    variants: ['或乙臨地盤六癸亦成;一說專主休門合六癸臨坎'],
  },
  虎遁: {
    cond: { door: '休門', skyStem: '乙', earthStem: '辛', palace: 8 },
    luck: '吉',
    note: '宜山戰伏兵、守禦保聚、求名防小人',
    variants: ['另說生門六乙合六辛,不拘宮'],
  },
  真詐: {
    cond: { doorAny: ['開門', '休門', '生門'], skyStemAny: ['乙', '丙', '丁'], god: '太陰' },
    luck: '吉',
    note: '三奇吉門會太陰,宜施恩隱遁、祈禱密謀',
  },
  重詐: {
    cond: { doorAny: ['開門', '休門', '生門'], skyStemAny: ['乙', '丙', '丁'], god: '九地' },
    luck: '吉',
    note: '三奇吉門會九地,宜求財拜官、出師設伏',
  },
  休詐: {
    cond: { doorAny: ['開門', '休門', '生門'], skyStemAny: ['乙', '丙', '丁'], god: '六合' },
    luck: '吉',
    note: '三奇吉門會六合,宜合藥治病、婚姻交易',
  },
  天假: {
    cond: { door: '景門', skyStemAny: ['乙', '丙', '丁'], god: '九天' },
    luck: '吉',
    note: '宜上書獻策、陳事求名、顯揚之事',
  },
  地假: {
    cond: { door: '杜門', skyStemAny: ['丁', '己', '癸'], godAny: ['九地', '太陰', '六合'] },
    luck: '吉',
    note: '宜潛伏逃亡、躲災避難、暗中謀劃',
  },
  人假: {
    cond: { door: '驚門', skyStem: '壬', god: '九天' },
    luck: '吉',
    note: '宜捕捉逃亡、搜擒盜賊匿寇',
  },
  物假: {
    cond: { door: '傷門', skyStemAny: ['丁', '己', '癸'], god: '六合' },
    luck: '吉',
    note: '宜索取討債、交易、捕捉',
    variants: ['一說死門合丁己癸臨九地'],
  },
  神假: {
    cond: { door: '傷門', skyStemAny: ['丁', '己', '癸'], god: '九地' },
    luck: '吉',
    note: '宜埋藏、祭祀祈禱、謀密事',
    variants: ['一說死門合丁己癸臨九地,宜超亡埋葬'],
  },
}

/** 三奇升殿:乙落震(日出扶桑)、丙到離(月照端門)、丁落兌(星見西方) */
export const SHENG_DIAN: Record<string, number> = { 乙: 3, 丙: 9, 丁: 7 }

/** 三奇得使:乙逢犬馬(己/辛)、丙鼠猴(戊/庚)、丁騎龍虎(壬/癸) */
export const DE_SHI: Record<string, string[]> = {
  乙: ['己', '辛'],
  丙: ['戊', '庚'],
  丁: ['壬', '癸'],
}

function condMatch(c: ZeGeCond, p: PalaceInfo): boolean {
  if (c.door && p.door !== c.door) return false
  if (c.doorAny && (!p.door || !c.doorAny.includes(p.door))) return false
  if (c.skyStem && !p.skyStems.includes(c.skyStem)) return false
  if (c.skyStemAny && !p.skyStems.some((s) => c.skyStemAny!.includes(s))) return false
  if (c.earthStem && !p.earthStems.includes(c.earthStem)) return false
  if (c.earthStemAny && !p.earthStems.some((s) => c.earthStemAny!.includes(s))) return false
  if (c.god && p.god !== c.god) return false
  if (c.godAny && (!p.god || !c.godAny.includes(p.god))) return false
  if (c.palace && p.palace !== c.palace) return false
  if (c.palaceAny && !c.palaceAny.includes(p.palace)) return false
  return true
}

export interface ZeGeHit {
  name: string
  luck: Luck
  note: string
  source: string
}

export function matchZeGe(p: PalaceInfo): ZeGeHit[] {
  const hits: ZeGeHit[] = []
  for (const [name, def] of Object.entries(ZE_GE)) {
    if (condMatch(def.cond, p)) {
      hits.push({ name, luck: def.luck, note: def.note, source: '擇日格' })
    }
  }
  // 三奇升殿
  for (const s of p.skyStems) {
    if (SHENG_DIAN[s] === p.palace) {
      hits.push({ name: '三奇升殿', luck: '吉', note: `${s}奇臨本殿,貴而得位`, source: `天盤${s}` })
    }
  }
  // 三奇得使
  for (const s of p.skyStems) {
    const yi = DE_SHI[s]
    if (yi && p.earthStems.some((e) => yi.includes(e))) {
      hits.push({ name: '三奇得使', luck: '吉', note: `${s}奇得使,所謀皆遂`, source: `天盤${s}` })
    }
  }
  return hits
}
