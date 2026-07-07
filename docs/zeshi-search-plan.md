# 擇時反查(擇格 → 得時)實作計劃

## 動機

現有流程為「選時間 → 觀盤」。用戶擇日擇時的真實需求是反向:「我要天遁/三奇得使,未來何日何時出現?」目前只能逐時辰手動撥 `datetime-local` 試看,極不便。

本計劃新增**擇時反查模式**:選定想要的格局與日期範圍,程式掃描每個時辰的盤,列出所有命中時刻,點擊任一結果即載入該時刻的完整盤面。

## 設計

### 1. 核心搜尋模組 `src/core/search.ts`

純函數、無 DOM 依賴,沿用 core 的既有慣例。

```ts
/** 可搜尋格局目錄,供 UI 生成選項 */
export interface GeCatalogEntry {
  name: string
  luck: Luck
  group: '九遁' | '詐假' | '三奇' | '剋應吉格'
}
export const GE_CATALOG: GeCatalogEntry[]

export interface AvoidOptions {
  kong?: boolean      // 避空亡(命中宮逢空則棄)
  jiXing?: boolean    // 避六儀擊刑(命中宮有擊刑則棄)
  menPo?: boolean     // 避門迫(命中宮門剋宮則棄)
  wuBuYuShi?: boolean // 避五不遇時(全局凶,整個時辰棄)
}

export interface SearchHit {
  date: DateParts        // 該時辰(或刻)起點,可直接回填 datetime input
  hourGZ: string         // 時柱干支
  ke?: number            // 八刻法之刻序
  matches: {
    name: string
    luck: Luck
    palace: number       // 命中宮位,點擊結果時順帶選中
    palaceName: string
  }[]
}

export function searchGe(
  names: string[],          // 欲尋之格(GE_CATALOG 中的 name)
  start: DateParts,         // 起始時刻
  days: number,             // 掃描日數
  options?: QimenOptions & { avoid?: AvoidOptions },
): SearchHit[]
```

**目錄內容**(全部已存在於 core,零新增判定邏輯):

- 九遁:天/地/人/神/鬼/風/雲/龍/虎遁(`ZE_GE`)
- 詐假:真詐、重詐、休詐、天假、地假、人假、物假、神假(`ZE_GE`)
- 三奇:三奇升殿、三奇得使、玉女守門
- 剋應吉格:`KE_YING` 中 luck 為吉的格(青龍返首、飛鳥跌穴等,名稱去重)

凶格反查(找凶時)非擇日主場景,v1 不列入目錄;避凶以 `avoid` 篩選器表達。

**掃描方式**:

- 自 `start` 對齊至時辰邊界(奇數整點:23、1、3…21),逐時辰(2 小時)步進。
- 每步呼叫 `computeChart` + `analyzeChart`,從各宮 `geju` 過濾出 `names` 命中者。
- 八刻法例外:一時辰八刻、每刻一局,步長改為 15 分鐘。
- 避忌:宮級避忌(空亡/擊刑/門迫)剔除該宮的命中;五不遇時剔除整個時辰。

**效能**:`computeChart` 為純函數。30 日 × 12 時辰 = 360 局,主線程直算 < 100ms,無需 worker。八刻法 30 日 = 2880 局,仍可接受;搜尋以按鈕觸發、非即時重算,不影響輸入流暢。

### 2. UI:`src/Search.tsx` + App.tsx 接線

App.tsx 已 606 行,搜尋面板獨立成 `src/Search.tsx`。

**模式切換**:header 下新增「起局 / 擇時」二態 tab(state `view`)。起局態即現有全部 UI,不動。

**擇時面板**:

1. **選格** — 依 group 分組的 multi-select chips,chip 上以現有 luck 色標示吉凶。
2. **範圍** — 起點預設「此刻」,長度預設 7 日,可選 7/30/90 日。
3. **避忌** — 四個 checkbox:避空亡、避擊刑、避門迫、避五不遇時。
4. **搜尋鈕** — 點擊執行,結果存 state。
5. **結果列表** — 按日分組:

   ```
   7月8日(二)
     辰時 07:00–09:00 甲辰   天遁·坎一宮  三奇得使·巽四宮
     未時 13:00–15:00 丁未   三奇升殿·離九宮
   ```

   點任一行 → `setValue(該時刻)`、`setSelected(首個命中宮)`、切回起局態。復用現有盤面 UI,零重複。

**樣式**:附加於 App.css,沿用既有 `.controls`、`.chip`、luck 色變數。

### 3. 測試

`src/core/__tests__/` 補 search 用例:

- 已知時刻含某格(從既有測試盤取例),`searchGe` 於含該時刻的範圍內必命中。
- 避忌篩選:構造命中宮逢空亡之例,開 `avoid.kong` 後該命中消失。
- 時辰對齊:起點非整時辰時首個掃描點正確。

## 分期

| 期 | 內容 | 規模 |
|---|---|---|
| v1(本次) | search.ts + 擇時面板 + 點結果載盤 + 避忌 + 測試 | 核心 |
| v2(後續) | 月曆熱圖視圖;盤面格局 badge 點擊「下次何時」快捷 | 加強 |
| v3(視需) | 八刻法大範圍掃描移入 web worker;凶格反查 | 視需求 |

## 不做

- 不改 core 既有判定邏輯,搜尋純屬消費者。
- 不做伺服器端預算表;全部客戶端即時算。
- v1 不做熱圖(先驗證列表流程是否合用)。
