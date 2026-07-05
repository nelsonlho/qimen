// 盤面斷析:門宮生剋、九星旺衰、十二長生、格局

import { stagesInPalace, type StemStages } from './changsheng'
import { KE_YING, type KeYing, type Luck } from './keying'
import {
  BRANCH_ELEMENT,
  DOOR_ELEMENT,
  PALACE_ELEMENT,
  STAR_ELEMENT,
  ke,
  sheng,
  starWangShuai,
} from './wuxing'
import type { Chart, PalaceInfo } from './types'

export interface DoorRelation {
  key: '迫' | '制' | '和' | '義' | '伏'
  label: string
  luck: Luck
  note: string
}

export interface GeJu {
  name: string
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

/** 宮所藏支(斷析用,與 pan 一致) */
const PALACE_BRANCHES: Record<number, string[]> = {
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

  // 全局:天地盤伏吟/反吟
  const global: GeJu[] = []
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
