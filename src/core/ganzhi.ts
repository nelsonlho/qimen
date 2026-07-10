// 干支基礎運算

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const

export function ganzhiName(index: number): string {
  const i = ((index % 60) + 60) % 60
  return STEMS[i % 10] + BRANCHES[i % 12]
}

export function ganzhiIndex(name: string): number {
  for (let i = 0; i < 60; i++) {
    if (ganzhiName(i) === name) return i
  }
  throw new Error(`非法干支: ${name}`)
}

/** 五鼠遁:由日干與時支得時干支索引 */
export function hourGanzhiIndex(dayStemIndex: number, hourBranchIndex: number): number {
  const startStem = (dayStemIndex % 5) * 2 // 甲己起甲子,乙庚起丙子...
  const stem = (startStem + hourBranchIndex) % 10
  // 六十甲子中求 stem/branch 同時吻合者
  for (let i = 0; i < 60; i++) {
    if (i % 10 === stem && i % 12 === hourBranchIndex) return i
  }
  throw new Error('時干支計算失敗')
}

/** 時支:0-23 時 → 支索引(23 時起子) */
export function hourBranchIndex(hour: number): number {
  return Math.floor(((hour + 1) % 24) / 2)
}

/** 旬首:干支索引 → 旬首索引(甲子=0, 甲戌=10, ...) */
export function xunStart(gzIndex: number): number {
  return gzIndex - (gzIndex % 10)
}

/** 旬首所遁六儀:甲子戊 甲戌己 甲申庚 甲午辛 甲辰壬 甲寅癸 */
const XUN_YI = ['戊', '己', '庚', '辛', '壬', '癸'] as const
export function xunShouYi(gzIndex: number): string {
  return XUN_YI[xunStart(gzIndex) / 10]
}

/**
 * 柱之用干(遁甲):甲不上盤,柱首字甲者取本旬所遁六儀
 * (甲子戊 甲戌己 甲申庚 甲午辛 甲辰壬 甲寅癸);餘取本干。
 */
export function pillarStem(gz: string): string {
  return gz[0] === '甲' ? xunShouYi(ganzhiIndex(gz)) : gz[0]
}

/** 旬空二支 */
export function kongWang(gzIndex: number): [string, string] {
  const k = xunStart(gzIndex) / 10 // 0..5
  const first = (10 - 2 * k + 12) % 12
  return [BRANCHES[first], BRANCHES[(first + 1) % 12]]
}

/** 驛馬:申子辰馬在寅、寅午戌馬在申、巳酉丑馬在亥、亥卯未馬在巳 */
export function horseBranch(branchIndex: number): string {
  const map = [2, 11, 8, 5] // 三合局按 branch%4 分組:子辰申→寅(2)…
  // 子(0)申(8)辰(4) → %4==0 → 寅;寅(2)午(6)戌(10) → %4==2 → 申
  // 丑(1)巳(5)酉(9) → %4==1 → 亥;卯(3)未(7)亥(11) → %4==3 → 巳
  return BRANCHES[map[branchIndex % 4]]
}
