// 五行生剋與各元素歸屬

export type Element = '木' | '火' | '土' | '金' | '水'

export const STEM_ELEMENT: Record<string, Element> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
}

export const BRANCH_ELEMENT: Record<string, Element> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
}

export const PALACE_ELEMENT: Record<number, Element> = {
  1: '水', 2: '土', 3: '木', 4: '木', 5: '土', 6: '金', 7: '金', 8: '土', 9: '火',
}

export const DOOR_ELEMENT: Record<string, Element> = {
  休門: '水', 生門: '土', 傷門: '木', 杜門: '木', 景門: '火', 死門: '土', 驚門: '金', 開門: '金',
}

export const STAR_ELEMENT: Record<string, Element> = {
  天蓬: '水', 天任: '土', 天沖: '木', 天輔: '木', 天英: '火', 天芮: '土', 天柱: '金', 天心: '金', 天禽: '土',
}

export const GOD_ELEMENT: Record<string, Element> = {
  值符: '土', 騰蛇: '火', 太陰: '金', 六合: '木', 白虎: '金', 玄武: '水', 九地: '土', 九天: '金',
  // 飛盤九神所增(以勾雀常代虎武)
  勾陳: '土', 朱雀: '火', 太常: '土',
}

const SHENG_NEXT: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }
const KE_NEXT: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' }

export function sheng(a: Element, b: Element): boolean {
  return SHENG_NEXT[a] === b
}

export function ke(a: Element, b: Element): boolean {
  return KE_NEXT[a] === b
}

/**
 * 九星旺衰,依《煙波釣叟歌》:
 * 「與我同行即為相,我生之月誠為旺,廢於父母休於財,囚於鬼兮真不妄」
 * 同行=相;我生(子孫月)=旺;生我(父母月)=廢;我剋(財月)=休;剋我(鬼月)=囚
 */
export function starWangShuai(mine: Element, season: Element): '旺' | '相' | '休' | '囚' | '廢' {
  if (mine === season) return '相'
  if (sheng(mine, season)) return '旺'
  if (sheng(season, mine)) return '廢'
  if (ke(mine, season)) return '休'
  return '囚'
}

/**
 * 四時旺相休囚死(通行說,用於宮氣):
 * 當令旺,令生者相,生令者休,剋令者囚,令剋者死
 */
export function seasonStrength(mine: Element, season: Element): '旺' | '相' | '休' | '囚' | '死' {
  if (mine === season) return '旺'
  if (sheng(season, mine)) return '相'
  if (sheng(mine, season)) return '休'
  if (ke(mine, season)) return '囚'
  return '死'
}
