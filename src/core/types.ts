// 核心型別 — 純 TS,無 DOM 依賴,便於日後行動裝置復用

export type Dun = '陽' | '陰'

export type ChaoJieStatus = '超神' | '接氣' | '正授' | '置閏' | '拆補'

export type JuMethod = '置閏' | '拆補' | '旬首' | '八刻'

/** 盤式:轉盤(星門神循八宮環轉)/ 飛盤(按洛書宮序飛佈,中五入盤) */
export type PlateStyle = '轉盤' | '飛盤'

export interface DateParts {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23
  minute: number
}

export interface QimenOptions {
  /** 子時換日法:'23' = 夜子時起新日(預設),'0' = 凌晨零時換日 */
  ziShiMode?: '23' | '0'
  /** 置閏門檻:符頭超過節氣達此日數(含)以上,逢芒種大雪置閏。預設 9 */
  leapThreshold?: number
  /** 定局法:置閏(預設)或拆補 */
  method?: JuMethod
  /** 盤式:轉盤(預設)或飛盤 */
  plate?: PlateStyle
}

export interface JuInfo {
  method: JuMethod
  dun: Dun
  ju: number // 1-9
  termName: string // 節氣名(正體)
  yuan: 1 | 2 | 3 // 上中下元
  yuanName: '上元' | '中元' | '下元'
  fuTou: string // 本元符頭干支
  shangYuanFuTou: string // 上元符頭干支
  status: ChaoJieStatus
  /** 符頭與節氣相隔日數(超神為正) */
  gapDays: number
  /** 八刻法:本時辰第幾刻(1-8,每刻十五分鐘);他法無 */
  ke?: number
}

export interface Pillars {
  year: string
  month: string
  day: string
  hour: string
}

export interface PalaceInfo {
  palace: number // 宮數 1-9(洛書)
  name: string // 坎一宮 等
  god: string | null // 八神
  stars: string[] // 天盤星(芮禽同宮則二)
  skyStems: string[] // 天盤干
  door: string | null // 八門
  earthStems: string[] // 地盤干
  isZhiFu: boolean
  isZhiShi: boolean
  kong: boolean // 時旬空亡
  horse: boolean // 時馬星
  anGan: string // 暗干:甲起旬首儀地盤宮,十干依序陽順陰逆飛佈(癸與甲同宮)
  yinGan: string // 隱干:時干加值使落宮,三奇六儀陽順陰逆飛佈
  doorDaiGan: string | null // 門帶干:當局地盤中,門本宮之干
}

export interface Chart {
  input: DateParts
  plateStyle: PlateStyle
  pillars: Pillars
  /** 當日農曆日期,如 六月十二、閏五月初三 */
  lunarDate: string
  ju: JuInfo
  xunShou: string // 旬首,如 甲子(戊)
  xunYi: string // 旬首所遁儀
  zhiFuStar: string
  zhiShiDoor: string
  kongWang: [string, string] // 空亡二支
  horseBranch: string
  palaces: PalaceInfo[] // 九宮,索引 = 宮數-1
}
