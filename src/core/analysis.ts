// 盤面斷析:門宮生剋、九星旺衰、十二長生、格局

import { stagesInPalace, type StemStages } from './changsheng'
import { KE_YING, type KeYing, type Luck } from './keying'
import { MEN_MEN, MEN_YING, PALACE_BASE_DOOR } from './menying'
import {
  BRANCH_ELEMENT,
  DOOR_ELEMENT,
  PALACE_ELEMENT,
  STAR_ELEMENT,
  STEM_ELEMENT,
  ke,
  sheng,
  starWangShuai,
} from './wuxing'
import { matchZeGe } from './zege'
import { STEMS, pillarStem } from './ganzhi'
import type { Chart, PalaceInfo } from './types'

export interface DoorRelation {
  key: '迫' | '制' | '和' | '義' | '伏'
  label: string
  luck: Luck
  note: string
}

export interface GeJu {
  name: string
  aliases?: string[] // 異名
  luck: Luck
  note: string
  source: string // 何以成格,如「天盤戊+地盤丙」
}

export interface PalaceAnalysis {
  palace: number
  doorRelation: DoorRelation | null
  starStrength: { star: string; strength: string } | null
  skyStages: StemStages[]
  earthStages: StemStages[]
  geju: GeJu[]
}

export interface ChartAnalysis {
  palaces: PalaceAnalysis[] // 索引 = 宮數-1
  global: GeJu[]
}

/** 宮所藏支(斷析、穿壬顯示用,與 pan 一致) */
export const PALACE_BRANCHES: Record<number, string[]> = {
  1: ['子'], 8: ['丑', '寅'], 3: ['卯'], 4: ['辰', '巳'],
  9: ['午'], 2: ['未', '申'], 7: ['酉'], 6: ['戌', '亥'],
  5: [],
}

/** 六儀擊刑:儀落某宮與宮支相刑 */
const JI_XING: Record<string, [number, string]> = {
  戊: [3, '子刑卯'],
  己: [2, '戌刑未'],
  庚: [8, '申刑寅'],
  辛: [9, '午自刑'],
  壬: [4, '辰自刑'],
  癸: [4, '寅刑巳'],
}

export function doorPalaceRelation(door: string, palace: number): DoorRelation {
  const de = DOOR_ELEMENT[door]
  const pe = PALACE_ELEMENT[palace]
  if (de === pe)
    return { key: '伏', label: '比和', luck: '吉', note: '門宮五行比和,安穩' }
  if (ke(de, pe))
    return { key: '迫', label: '門迫', luck: '凶', note: '門剋宮為迫:吉門被迫吉不成,凶門被迫凶更甚' }
  if (ke(pe, de))
    return { key: '制', label: '門制', luck: '凶', note: '宮剋門為制:門受制,力不能伸' }
  if (sheng(de, pe))
    return { key: '和', label: '門生宮', luck: '平', note: '門氣洩於宮,和而稍洩' }
  return { key: '義', label: '宮生門', luck: '吉', note: '宮生門為義,門得宮助' }
}

export function analyzeChart(chart: Chart): ChartAnalysis {
  const monthBranch = chart.pillars.month[1]
  const seasonElem = BRANCH_ELEMENT[monthBranch]
  // 四柱用干(甲遁六儀)與值符儀,庚格丙悖諸動格所需
  const pGan = {
    歲: pillarStem(chart.pillars.year),
    月: pillarStem(chart.pillars.month),
    日: pillarStem(chart.pillars.day),
    時: pillarStem(chart.pillars.hour),
  }
  const fuYi = chart.xunYi

  const palaces: PalaceAnalysis[] = chart.palaces.map((p: PalaceInfo) => {
    const branches = PALACE_BRANCHES[p.palace]
    const geju: GeJu[] = []

    // 十干剋應:天盤各干 × 地盤各干(中五宮寄干不重列)
    if (p.palace !== 5) {
      for (const s of p.skyStems) {
        for (const e of p.earthStems) {
          const hit: KeYing | undefined = KE_YING[`${s}+${e}`]
          if (hit) geju.push({ ...hit, source: `天盤${s}+地盤${e}` })
        }
      }
      // 六儀擊刑(中五寄干隨禽而行者不論刑,故二干時僅取首干)
      const ownSkyStems = p.skyStems.length === 2 ? [p.skyStems[0]] : p.skyStems
      for (const s of ownSkyStems) {
        const jx = JI_XING[s]
        if (jx && jx[0] === p.palace) {
          geju.push({ name: '六儀擊刑', luck: '凶', note: `${s}落${p.name}宮,${jx[1]},諸事不利`, source: `天盤${s}` })
        }
      }
      // 奇儀入墓(以十二長生墓位斷)
      for (const s of p.skyStems) {
        const st = stagesInPalace(s, branches)
        if (st?.perBranch.some((b) => b.stage === '墓')) {
          geju.push({ name: '入墓', luck: '凶', note: `${s}墓於${st.perBranch.find((b) => b.stage === '墓')!.branch},氣伏不揚`, source: `天盤${s}` })
        }
      }
      // 玉女守門:丁奇臨值使門宮
      if (p.isZhiShi && p.skyStems.includes('丁')) {
        geju.push({ name: '玉女守門', luck: '吉', note: '丁奇臨值使之門,百事可為', source: '天盤丁+值使門' })
      }
      // 三奇受制:奇落宮受宮剋(乙落乾兌、丙丁落坎)
      for (const s of p.skyStems) {
        if ('乙丙丁'.includes(s) && ke(PALACE_ELEMENT[p.palace], STEM_ELEMENT[s])) {
          geju.push({ name: '三奇受制', luck: '凶', note: `${s}奇落${p.name}宮受宮剋,奇力受挫`, source: `天盤${s}落${p.name}宮` })
        }
      }
      // 庚格丙悖家族+天網四張:庚丙癸臨四柱干、值符儀,動態成格
      // (與81格名重者不復列,如旬首遁戊時庚+戊已名太白伏宮)
      const sky = p.skyStems
      const earth = p.earthStems
      const addDyn = (name: string, note: string, source: string) => {
        if (geju.some((g) => g.name === name || g.aliases?.includes(name))) return
        geju.push({ name, luck: '凶', note, source })
      }
      if (sky.includes('庚')) {
        if (earth.includes(pGan.日)) addDyn('伏干格', '庚伏日干之上,同人相害,凡事不利', `天盤庚+地盤日干${pGan.日}`)
        if (earth.includes(pGan.時)) addDyn('伏格', '庚伏時干之上,諸事阻滯,又名時格', `天盤庚+地盤時干${pGan.時}`)
        if (earth.includes(pGan.歲)) addDyn('歲格', '庚加年干,歲君受制,謀事多阻', `天盤庚+地盤年干${pGan.歲}`)
        if (earth.includes(pGan.月)) addDyn('月格', '庚加月干,月建受制,事多阻隔', `天盤庚+地盤月干${pGan.月}`)
        if (earth.includes(fuYi)) addDyn('天乙伏宮', '庚加值符,百事不可謀為', `天盤庚+地盤值符儀${fuYi}`)
      }
      if (earth.includes('庚')) {
        if (sky.includes(pGan.日)) addDyn('飛干格', '日干飛臨庚上,凡事格拒不利', `天盤日干${pGan.日}+地盤庚`)
        if (sky.includes(pGan.時)) addDyn('飛格', '時干飛臨庚上,所謀被格,難成', `天盤時干${pGan.時}+地盤庚`)
        if (sky.includes(fuYi)) addDyn('天乙飛宮', '值符加庚,吉事成凶,宜守勿動', `天盤值符儀${fuYi}+地盤庚`)
      }
      if (sky.includes('丙')) {
        if (earth.includes(fuYi)) addDyn('伏悖', '丙加值符,火悖亂真,文書事亂', `天盤丙+地盤值符儀${fuYi}`)
        if (earth.includes(pGan.歲)) addDyn('歲悖', '丙加年干,悖亂經年,事多乖張', `天盤丙+地盤年干${pGan.歲}`)
        if (earth.includes(pGan.月)) addDyn('月悖', '丙加月干,月內悖亂,事不順遂', `天盤丙+地盤月干${pGan.月}`)
        if (earth.includes(pGan.日)) addDyn('日悖', '丙加日干,當日悖亂,防文書差錯', `天盤丙+地盤日干${pGan.日}`)
        if (earth.includes(pGan.時)) addDyn('時悖', '丙加時干,臨事悖亂,舉動乖違', `天盤丙+地盤時干${pGan.時}`)
      }
      if (earth.includes('丙') && sky.includes(fuYi)) {
        addDyn('飛悖', '值符加丙,悖亂飛揚,諸事反覆', `天盤值符儀${fuYi}+地盤丙`)
      }
      if (sky.includes('癸') && earth.includes(pGan.時)) {
        addDyn('天網四張', '癸加時干,天網張時,舉動不便,宜守', `天盤癸+地盤時干${pGan.時}`)
      }
      // 八門加臨十干剋應(門加本宮天盤干)
      if (p.door) {
        for (const s of p.skyStems) {
          const my = MEN_YING[`${p.door[0]}+${s}`]
          if (my) {
            geju.push({ name: `${p.door[0]}門加${s}`, luck: my.luck, note: my.note, source: `${p.door}加天盤${s}` })
          }
        }
        // 門加門(門加本宮八卦本位之門;門臨本位如休加休,亦在表中)
        const base = PALACE_BASE_DOOR[p.palace]
        const mm = base && MEN_MEN[`${p.door[0]}+${base[0]}`]
        if (mm) {
          geju.push({ name: `${p.door[0]}門加${base[0]}門`, luck: mm.luck, note: mm.note, source: `${p.door}加本位${base}` })
        }
      }
      // 擇日格:九遁、三詐五假、升殿、得使
      geju.push(...matchZeGe(p))
    }

    return {
      palace: p.palace,
      doorRelation: p.door ? doorPalaceRelation(p.door, p.palace) : null,
      starStrength: p.stars.length
        ? { star: p.stars[0], strength: starWangShuai(STAR_ELEMENT[p.stars[0]], seasonElem) }
        : null,
      skyStages: p.skyStems.map((s) => stagesInPalace(s, branches)).filter((x): x is StemStages => !!x),
      earthStages: p.earthStems.map((s) => stagesInPalace(s, branches)).filter((x): x is StemStages => !!x),
      geju,
    }
  })

  // 全局:五不遇時——時干剋日干(同陰陽),即時干為日干後六位
  const global: GeJu[] = []
  const dayStemIdx = STEMS.indexOf(chart.pillars.day[0] as (typeof STEMS)[number])
  const hourStemIdx = STEMS.indexOf(chart.pillars.hour[0] as (typeof STEMS)[number])
  if (dayStemIdx >= 0 && hourStemIdx === (dayStemIdx + 6) % 10) {
    global.push({ name: '五不遇時', luck: '凶', note: '時干剋日干,百事不宜', source: '時干剋日干' })
  }
  const outer = chart.palaces.filter((p) => p.palace !== 5)
  const same = outer.every((p) => p.skyStems.join('') === p.earthStems.join(''))
  if (same) {
    global.push({ name: '天地盤伏吟', luck: '凶', note: '星門俱伏,宜靜不宜動', source: '值符落本宮' })
  } else {
    const OPP: Record<number, number> = { 1: 9, 9: 1, 8: 2, 2: 8, 3: 7, 7: 3, 4: 6, 6: 4 }
    const yiPalace = outer.find((p) => p.earthStems.includes(chart.xunYi))?.palace
    const fuPalace = outer.find((p) => p.isZhiFu)?.palace
    if (yiPalace && fuPalace && OPP[yiPalace === 5 ? 2 : yiPalace] === fuPalace) {
      global.push({ name: '天地盤反吟', luck: '凶', note: '星門對沖,事多反覆', source: '值符落對宮' })
    }
  }
  return { palaces, global }
}
