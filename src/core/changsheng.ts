// 十二長生:陽干順行,陰干逆行

import { BRANCHES } from './ganzhi'

export const STAGES = ['長生', '沐浴', '冠帶', '臨官', '帝旺', '衰', '病', '死', '墓', '絕', '胎', '養'] as const
export type Stage = (typeof STAGES)[number]

/** 各干長生所起之支 */
const CS_START: Record<string, number> = {
  甲: 11, // 亥
  乙: 6, // 午
  丙: 2, // 寅
  丁: 9, // 酉
  戊: 2, // 寅(隨丙)
  己: 9, // 酉(隨丁)
  庚: 5, // 巳
  辛: 0, // 子
  壬: 8, // 申
  癸: 3, // 卯
}

const YANG = new Set(['甲', '丙', '戊', '庚', '壬'])

export function stageOf(stem: string, branch: string): Stage {
  const b = BRANCHES.indexOf(branch as (typeof BRANCHES)[number])
  const start = CS_START[stem]
  if (b < 0 || start === undefined) throw new Error(`長生無解: ${stem}${branch}`)
  const d = YANG.has(stem) ? (b - start + 12) % 12 : (start - b + 12) % 12
  return STAGES[d]
}

/** 同宮二支取旺者為主之序 */
const VIGOR_ORDER: Stage[] = ['帝旺', '臨官', '長生', '冠帶', '沐浴', '養', '胎', '衰', '病', '死', '墓', '絕']

export interface StemStages {
  stem: string
  perBranch: { branch: string; stage: Stage }[]
  primary: Stage
}

export function stagesInPalace(stem: string, branches: string[]): StemStages | null {
  if (!branches.length) return null
  const perBranch = branches.map((branch) => ({ branch, stage: stageOf(stem, branch) }))
  const primary = [...perBranch].sort(
    (a, b) => VIGOR_ORDER.indexOf(a.stage) - VIGOR_ORDER.indexOf(b.stage),
  )[0].stage
  return { stem, perBranch, primary }
}
