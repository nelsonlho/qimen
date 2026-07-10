import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BRANCHES,
  BRANCH_ELEMENT,
  JIANG_LUCK,
  JIANG_SHORT,
  PALACE_BRANCHES,
  PALACE_NUMBERS,
  STEMS,
  STEM_ELEMENT,
  analyzeChart,
  chuanRen,
  computeChart,
  pillarStem,
} from './core';
import type {
  Chart,
  ChartAnalysis,
  DateParts,
  GeJu,
  JuMethod,
  PalaceAnalysis,
  PalaceInfo,
  PlateStyle,
  TianJiang,
} from './core';
import Search from './Search';
import './App.css';

// 洛書九宮版位:上南下北
const GRID: number[] = [4, 9, 2, 3, 5, 7, 8, 1, 6];

// 穿壬外環:十二支繞盤方位(上南下北左東右西),[支, 列, 行]
const RING: [string, number, number][] = [
  ['巳', 1, 2],
  ['午', 1, 3],
  ['未', 1, 4],
  ['辰', 2, 1],
  ['卯', 3, 1],
  ['寅', 4, 1],
  ['申', 2, 5],
  ['酉', 3, 5],
  ['戌', 4, 5],
  ['丑', 5, 2],
  ['子', 5, 3],
  ['亥', 5, 4],
];

// 後天八卦水印
const TRIGRAM: Record<number, string> = {
  1: '☵',
  2: '☷',
  3: '☳',
  4: '☴',
  5: '☯',
  6: '☰',
  7: '☱',
  8: '☶',
  9: '☲',
};

const STAGE_SHORT: Record<string, string> = {
  長生: '生',
  沐浴: '浴',
  冠帶: '帶',
  臨官: '祿',
  帝旺: '帝',
  衰: '衰',
  病: '病',
  死: '死',
  墓: '墓',
  絕: '絕',
  胎: '胎',
  養: '養',
};

function toInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 日/時干所遁盤上用干(甲不上盤取六儀)→ 標記。同一儀可兼日時 */
type StemMark = { label: string; jia?: string };
function pillarMarks(chart: Chart): Record<string, StemMark[]> {
  const out: Record<string, StemMark[]> = {};
  for (const [pillar, label] of [
    ['day', '日'],
    ['hour', '時'],
  ] as const) {
    const gz = chart.pillars[pillar];
    const stem = pillarStem(gz);
    (out[stem] ??= []).push({ label, jia: gz[0] === '甲' ? gz : undefined });
  }
  return out;
}

function StemGroup({
  stems,
  stages,
  marks,
}: {
  stems: string[];
  stages: PalaceAnalysis['skyStages'];
  marks?: Record<string, StemMark[]>;
}) {
  return (
    <span className="stems">
      {stems.map((s) => {
        const st = stages.find((x) => x.stem === s);
        const mk = marks?.[s];
        return (
          <span
            className={`stem e-${STEM_ELEMENT[s]}${mk ? ' stem-pillar' : ''}`}
            key={s}
          >
            {mk && (
              <i className="pillar-tag">
                {mk.map((m) => (
                  <b
                    key={m.label}
                    title={m.jia ? `${m.label}干${m.jia}(遁${s})` : `${m.label}干${s}`}
                  >
                    {m.label}
                    {m.jia && <em>甲</em>}
                  </b>
                ))}
              </i>
            )}
            {s}
            {st && (
              <i className="cs">
                {/* 二支宮兩態並列,依宮支之序;支之陰陽與干同者,著干色為主態 */}
                {st.perBranch.map((b, i) => {
                  const sameYinYang =
                    STEMS.indexOf(s as (typeof STEMS)[number]) % 2 ===
                    BRANCHES.indexOf(b.branch as (typeof BRANCHES)[number]) % 2;
                  return (
                    <span
                      key={i}
                      className={
                        sameYinYang ? `cs-hit e-${STEM_ELEMENT[s]}` : undefined
                      }
                    >
                      {STAGE_SHORT[b.stage]}
                    </span>
                  );
                })}
              </i>
            )}
          </span>
        );
      })}
    </span>
  );
}

function PalaceCell({
  info,
  chart,
  ana,
  selected,
  onSelect,
  showAnGan,
  showYinGan,
  showDaiGan,
  showFeiZhi,
  order,
  globalGe,
  jiangMap,
  marks,
}: {
  info: PalaceInfo;
  chart: Chart;
  ana: PalaceAnalysis;
  selected: boolean;
  onSelect: () => void;
  showAnGan: boolean;
  showYinGan: boolean;
  showDaiGan: boolean;
  showFeiZhi: boolean;
  order: number;
  globalGe: GeJu[];
  jiangMap: Record<string, TianJiang> | null;
  marks: Record<string, StemMark[]>;
}) {
  const cellStyle = { '--i': order } as CSSProperties;
  // 格底一行:左為暗干隱干,右為宮名——入流佈局,不壓正文
  // 天將:寬屏由外環顯,窄屏環無所容,以此行內備(CSS media 擇一)
  const cellFoot = (
    <div className="cell-foot">
      {showAnGan && <span className="angan">暗{info.anGan}</span>}
      {showYinGan && <span className="yingan">隱{info.yinGan}</span>}
      {showFeiZhi && info.anZhi && (
        <span className="feizhi">支{info.anZhi}</span>
      )}
      {jiangMap && PALACE_BRANCHES[info.palace].length > 0 && (
        <span className="jiang-inline">
          {PALACE_BRANCHES[info.palace].map((b) => (
            <i className={`jiang-${JIANG_LUCK[jiangMap[b]]}`} key={b}>
              {JIANG_SHORT[jiangMap[b]]}
            </i>
          ))}
        </span>
      )}
      <span className="palace-name">{info.name}</span>
    </div>
  );
  const watermark = <span className="trigram">{TRIGRAM[info.palace]}</span>;
  if (info.palace === 5) {
    // 中宮:轉盤寄坤二僅列局訊;飛盤/鳴法中五入盤,星干門神並列
    const isFly = chart.plateStyle !== '轉盤';
    return (
      <div
        className={`palace center${selected ? ' selected' : ''}${info.isZhiFu ? ' zhifu' : ''}${info.isZhiShi ? ' zhishi' : ''}`}
        style={cellStyle}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      >
        {watermark}
        <div className="center-ju">
          {chart.ju.dun}遁{chart.ju.ju}局
        </div>
        <div className="center-term">
          {chart.ju.termName}
          {chart.ju.yuanName}・{chart.ju.method}法
          {chart.ju.ke != null && `・第${chart.ju.ke}刻`}
        </div>
        {isFly && (
          <div className="center-fly">
            <span className="god">
              {info.god?.slice(1)}
              {info.earthGod && (
                <i className="egod">{info.earthGod.slice(1)}</i>
              )}
            </span>
            <span className="star">
              {info.stars.map((s) => s.slice(1)).join('')}
              {info.isZhiFu && <span className="tag tag-fu">符</span>}
            </span>
            <span className="sky-stem">
              <StemGroup stems={info.skyStems} stages={ana.skyStages} marks={marks} />
            </span>
            <span className="door">
              {info.door ? info.door.slice(0, 1) : '無門'}
              {info.isZhiShi && <span className="tag tag-shi">使</span>}
            </span>
          </div>
        )}
        <div className="stem-row">
          <span className="earth-stem">
            <StemGroup stems={info.earthStems} stages={ana.earthStages} />
          </span>
          {!isFly && <span className="ji-note">寄坤二</span>}
        </div>
        {globalGe.length > 0 && (
          <div className="global-badges">
            {globalGe.map((g, i) => (
              <span className={`gbadge gbadge-${g.luck}`} key={i}>
                {g.name}
              </span>
            ))}
          </div>
        )}
        {cellFoot}
      </div>
    );
  }
  const rel = ana.doorRelation;
  const jiXing = ana.geju.some((g) => g.name === '六儀擊刑');
  return (
    <div
      className={`palace${info.isZhiFu ? ' zhifu' : ''}${info.isZhiShi ? ' zhishi' : ''}${selected ? ' selected' : ''}`}
      style={cellStyle}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {watermark}
      <div className="row god-row">
        {/* 八神取次字:符蛇陰合虎武地天;鳴法地盤神小字相隨 */}
        <span className="god">
          {info.god?.slice(1)}
          {info.earthGod && <i className="egod">{info.earthGod.slice(1)}</i>}
        </span>
        <span className="marks">
          {ana.geju.map((g, i) => (
            <span className={`dot dot-${g.luck}`} key={i} title={g.name} />
          ))}
          {jiXing && <span className="mark xing">刑</span>}
          {info.horse && <span className="mark horse">馬</span>}
          {info.kong && <span className="mark kong">空</span>}
        </span>
      </div>
      <div className="row">
        <span className="star">
          {info.stars.map((s) => s.slice(1)).join('')}
          {ana.starStrength && (
            <i className={`str str-${ana.starStrength.strength}`}>
              {ana.starStrength.strength}
            </i>
          )}
          {info.isZhiFu && <span className="tag tag-fu">符</span>}
        </span>
        <span className="sky-stem">
          <StemGroup stems={info.skyStems} stages={ana.skyStages} marks={marks} />
        </span>
      </div>
      <div className="row">
        <span className="door">
          {/* 八門取首字 */}
          {info.door?.slice(0, 1)}
          {rel && rel.key !== '義' && rel.key !== '和' && rel.key !== '伏' && (
            <i className={`rel rel-${rel.key}`}>{rel.key}</i>
          )}
          {showDaiGan && info.doorDaiGan && (
            <i className="daigan">{info.doorDaiGan}</i>
          )}
          {info.isZhiShi && <span className="tag tag-shi">使</span>}
        </span>
        <span className="earth-stem">
          <StemGroup stems={info.earthStems} stages={ana.earthStages} />
        </span>
      </div>
      {cellFoot}
    </div>
  );
}

function LuckChip({ luck }: { luck: string }) {
  return <span className={`chip chip-${luck}`}>{luck}</span>;
}

function DetailPanel({
  chart,
  ana,
  palace,
  jiangMap,
}: {
  chart: Chart;
  ana: ChartAnalysis;
  palace: number;
  jiangMap: Record<string, TianJiang> | null;
}) {
  const info = chart.palaces[palace - 1];
  const pa = ana.palaces[palace - 1];
  if (palace === 5) {
    // 中宮:全局之詳解
    return (
      <div className="detail">
        <div className="detail-head">
          <strong>中五宮・全局</strong>
        </div>
        <dl>
          <div>
            <dt>定局</dt>
            <dd>
              {chart.ju.termName}
              {chart.ju.yuanName}・{chart.ju.dun}遁{chart.ju.ju}局(
              {chart.ju.method}法{chart.ju.ke != null && `・第${chart.ju.ke}刻`}
              {chart.ju.method === '置閏' &&
                `,${chart.ju.status}${chart.ju.status !== '正授' ? Math.abs(chart.ju.gapDays) + '日' : ''}`}
              )
            </dd>
          </div>
          <div>
            <dt>地盤寄干</dt>
            <dd>
              {info.earthStems.join('')}
              <span className="note">(寄坤二宮)</span>
            </dd>
          </div>
          <div>
            <dt>宮數</dt>
            <dd>
              {PALACE_NUMBERS[5].all.join('、')}
              <span className="note">(五行土5/10,無先後天數)</span>
            </dd>
          </div>
        </dl>
        <div className="geju-list">
          {ana.global.length === 0 && (
            <div className="note">此時無全局之格</div>
          )}
          {ana.global.map((g, i) => (
            <div className="geju" key={i}>
              <strong>{g.name}</strong>
              <LuckChip luck={g.luck} />
              <span className="note">
                {g.note}({g.source})
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const stageText = (s: PalaceAnalysis['skyStages'][number]) =>
    s.perBranch.map((b) => `${b.branch}${b.stage}`).join('、');
  return (
    <div className="detail">
      <div className="detail-head">
        <strong>{info.name}宮</strong>
        {info.isZhiFu && <span className="tag tag-fu">值符</span>}
        {info.isZhiShi && <span className="tag tag-shi">值使</span>}
        {info.kong && <span className="mark kong">空亡</span>}
        {info.horse && <span className="mark horse">馬星</span>}
      </div>
      <dl>
        <div>
          <dt>八神</dt>
          <dd>
            {info.god}
            {info.earthGod && (
              <span className="note">・地盤{info.earthGod}(鳴法暗套)</span>
            )}
          </dd>
        </div>
        {jiangMap && (
          <div>
            <dt>天將</dt>
            <dd>
              {PALACE_BRANCHES[palace]
                .map((b) => `${b}${jiangMap[b]}`)
                .join('、')}
              <span className="note">(穿壬:日干晝夜貴,順逆佈十二將)</span>
            </dd>
          </div>
        )}
        <div>
          <dt>九星</dt>
          <dd>
            {info.stars.join('、')}
            {pa.starStrength && <>(月令{pa.starStrength.strength})</>}
          </dd>
        </div>
        <div>
          <dt>八門</dt>
          <dd>
            {info.door}
            {info.doorDaiGan && (
              <span className="note">(帶干{info.doorDaiGan},本宮地盤)</span>
            )}
            {pa.doorRelation && (
              <>
                ・{pa.doorRelation.label}
                <LuckChip luck={pa.doorRelation.luck} />
                <span className="note">{pa.doorRelation.note}</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>宮數</dt>
          <dd>
            {PALACE_NUMBERS[palace].all.join('、')}
            <span className="note">
              (
              {PALACE_NUMBERS[palace].xianTian !== null &&
                `先天${PALACE_NUMBERS[palace].xianTian}・`}
              {PALACE_NUMBERS[palace].houTian !== null &&
                `後天${PALACE_NUMBERS[palace].houTian}・`}
              五行{PALACE_NUMBERS[palace].wuXing.join('/')})
            </span>
          </dd>
        </div>
        <div>
          <dt>暗干</dt>
          <dd>
            {info.anGan}
            <span className="note">(甲加值符宮,十干飛佈)</span>
          </dd>
        </div>
        <div>
          <dt>隱干</dt>
          <dd>
            {info.yinGan}
            <span className="note">(時干加值使宮,奇儀飛佈)</span>
          </dd>
        </div>
        {info.anZhi && (
          <div>
            <dt>飛支</dt>
            <dd>
              {info.anZhi}
              <span className="note">
                (鳴法暗支:旬宮起本旬首支,陽順陰逆;配刑德以知神煞)
              </span>
            </dd>
          </div>
        )}
        <div>
          <dt>天盤干長生</dt>
          <dd>
            {pa.skyStages.map((s) => `${s.stem}:${stageText(s)}`).join(';') ||
              '—'}
          </dd>
        </div>
        <div>
          <dt>地盤干長生</dt>
          <dd>
            {pa.earthStages.map((s) => `${s.stem}:${stageText(s)}`).join(';') ||
              '—'}
          </dd>
        </div>
      </dl>
      <div className="geju-list">
        {pa.geju.length === 0 && <div className="note">此宮無特別格局</div>}
        {pa.geju.map((g, i) => (
          <div className="geju" key={i}>
            <strong>{g.name}</strong>
            {g.aliases && g.aliases.length > 0 && (
              <span className="aliases">又名{g.aliases.join('、')}</span>
            )}
            <LuckChip luck={g.luck} />
            <span className="note">
              {g.note}({g.source})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

type Theme = 'auto' | 'light' | 'dark';

export default function App() {
  const [value, setValue] = useState(() => toInputValue(new Date()));
  const [ziShiMode, setZiShiMode] = useState<'23' | '0'>('23');
  const [method, setMethod] = useState<JuMethod>('置閏');
  const [plate, setPlate] = useState<PlateStyle>(() => {
    const q = new URLSearchParams(location.search).get('plate');
    return q === '飛盤' || q === '轉盤' || q === '鳴法' ? q : '轉盤';
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const q = new URLSearchParams(location.search).get('theme');
    if (q === 'light' || q === 'dark' || q === 'auto') return q;
    return (localStorage.getItem('qimen-theme') as Theme) ?? 'auto';
  });
  const layerInit = (key: string) => () => {
    const q = new URLSearchParams(location.search).get(
      key.replace('qimen-', ''),
    );
    if (q === '1' || q === '0') return q === '1';
    return localStorage.getItem(key) === '1';
  };
  const [showAnGan, setShowAnGan] = useState(layerInit('qimen-angan'));
  const [showYinGan, setShowYinGan] = useState(layerInit('qimen-yingan'));
  const [showDaiGan, setShowDaiGan] = useState(layerInit('qimen-daigan'));
  const [showChuanRen, setShowChuanRen] = useState(layerInit('qimen-chuanren'));
  const [showFeiZhi, setShowFeiZhi] = useState(layerInit('qimen-feizhi'));
  const [view, setView] = useState<'chart' | 'search'>('chart');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    localStorage.setItem('qimen-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('qimen-angan', showAnGan ? '1' : '0');
    localStorage.setItem('qimen-yingan', showYinGan ? '1' : '0');
    localStorage.setItem('qimen-daigan', showDaiGan ? '1' : '0');
    localStorage.setItem('qimen-chuanren', showChuanRen ? '1' : '0');
    localStorage.setItem('qimen-feizhi', showFeiZhi ? '1' : '0');
  }, [showAnGan, showYinGan, showDaiGan, showChuanRen, showFeiZhi]);

  const { chart, ana, error } = useMemo(() => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return { chart: null, ana: null, error: '請輸入時間' };
    try {
      const chart = computeChart(
        { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] },
        { ziShiMode, method, plate },
      );
      return { chart, ana: analyzeChart(chart), error: null };
    } catch (e) {
      return { chart: null, ana: null, error: (e as Error).message };
    }
  }, [value, ziShiMode, method, plate]);

  // 穿壬:十二天將依日干晝夜貴佈支位
  const jiangMap =
    chart && showChuanRen
      ? chuanRen(chart.pillars.day[0], chart.pillars.hour[1])
      : null;

  return (
    <div className="app">
      <header>
        <div className="theme-switch" role="group" aria-label="晝夜模式">
          {(
            [
              ['light', '晝'],
              ['auto', '隨'],
              ['dark', '夜'],
            ] as [Theme, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              className={theme === t ? 'on' : ''}
              onClick={() => setTheme(t)}
              title={t === 'auto' ? '隨系統' : label}
            >
              {label}
            </button>
          ))}
        </div>
        <h1>
          奇門遁甲<span className="seal">陽盤</span>
        </h1>
        <div className="subtitle">時家{plate}</div>
      </header>

      <div className="view-tabs" role="tablist" aria-label="模式">
        {(
          [
            ['chart', '起局'],
            ['search', '擇時'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            className={view === v ? 'on' : ''}
            onClick={() => setView(v)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="controls">
        {view === 'chart' && (
          <>
            <input
              type="datetime-local"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="起局時間"
            />
            <button onClick={() => setValue(toInputValue(new Date()))}>
              此刻
            </button>
          </>
        )}
        <label className="opt">
          盤式
          <select
            value={plate}
            onChange={(e) => setPlate(e.target.value as PlateStyle)}
          >
            <option value="轉盤">轉盤</option>
            <option value="飛盤">飛盤</option>
            <option value="鳴法">鳴法</option>
          </select>
        </label>
        <label className="opt">
          定局
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as JuMethod)}
          >
            <option value="置閏">置閏法</option>
            <option value="拆補">拆補法</option>
            <option value="旬首">旬首法(十刻一局)</option>
            <option value="八刻">八刻法(一時辰八刻)</option>
          </select>
        </label>
        <label className="opt">
          子時
          <select
            value={ziShiMode}
            onChange={(e) => setZiShiMode(e.target.value as '23' | '0')}
          >
            <option value="23">夜子起新日</option>
            <option value="0">零時換日</option>
          </select>
        </label>
      </div>

      {view === 'chart' && (
        <div className="controls layers">
          <label className="opt check">
            <input
              type="checkbox"
              checked={showAnGan}
              onChange={(e) => setShowAnGan(e.target.checked)}
            />
            暗干
          </label>
          <label className="opt check">
            <input
              type="checkbox"
              checked={showYinGan}
              onChange={(e) => setShowYinGan(e.target.checked)}
            />
            隱干
          </label>
          <label className="opt check">
            <input
              type="checkbox"
              checked={showDaiGan}
              onChange={(e) => setShowDaiGan(e.target.checked)}
            />
            帶干
          </label>
          <label className="opt check">
            <input
              type="checkbox"
              checked={showChuanRen}
              onChange={(e) => setShowChuanRen(e.target.checked)}
            />
            穿壬
          </label>
          {plate === '鳴法' && (
            <label className="opt check">
              <input
                type="checkbox"
                checked={showFeiZhi}
                onChange={(e) => setShowFeiZhi(e.target.checked)}
              />
              飛支
            </label>
          )}
        </div>
      )}

      {/* 常駐不卸:切回起局再返,條件與結果俱存 */}
      <div hidden={view !== 'search'}>
        <Search
          method={method}
          ziShiMode={ziShiMode}
          plate={plate}
          onPick={(d: DateParts, palace: number | null) => {
            const p = (n: number) => String(n).padStart(2, '0');
            setValue(
              `${d.year}-${p(d.month)}-${p(d.day)}T${p(d.hour)}:${p(d.minute)}`,
            );
            setSelected(palace);
            setView('chart');
          }}
        />
      </div>

      {view === 'chart' && error && <div className="error">{error}</div>}

      {view === 'chart' && chart && ana && (
        <>
          {/* 古式直書:年柱居右,自右向左讀 */}
          <div className="pillars">
            {(['hour', 'day', 'month', 'year'] as const).map((k, i) => (
              <div className="pillar" key={k}>
                <div className="pillar-label">
                  {['時柱', '日柱', '月柱', '年柱'][i]}
                </div>
                <div className="pillar-gz">
                  <span className={`e-${STEM_ELEMENT[chart.pillars[k][0]]}`}>
                    {chart.pillars[k][0]}
                  </span>
                  <span className={`e-${BRANCH_ELEMENT[chart.pillars[k][1]]}`}>
                    {chart.pillars[k][1]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="summary">
            <span>農曆{chart.lunarDate}</span>
            <span>
              {chart.ju.termName}
              {chart.ju.yuanName}・{chart.ju.dun}遁{chart.ju.ju}局
            </span>
            {chart.ju.method === '置閏' ? (
              <span className="status">
                {chart.ju.status}
                {chart.ju.status !== '正授' &&
                  `(${Math.abs(chart.ju.gapDays)}日)`}
              </span>
            ) : (
              <span className="status">
                {chart.ju.method}法
                {chart.ju.ke != null && `・第${chart.ju.ke}刻`}
              </span>
            )}
            <span>旬首 {chart.xunShou}</span>
            <span>
              值符{chart.zhiFuStar}・值使{chart.zhiShiDoor}
            </span>
            <span>空亡 {chart.kongWang.join('')}</span>
            <span>馬星 {chart.horseBranch}</span>
          </div>

          {(() => {
            const marks = pillarMarks(chart);
            const board = (
              <div
                className="board"
                key={`${chart.pillars.day}${chart.pillars.hour}${chart.ju.dun}${chart.ju.ju}`}
              >
                {GRID.map((p, idx) => (
                  <PalaceCell
                    key={p}
                    order={idx}
                    info={chart.palaces[p - 1]}
                    chart={chart}
                    ana={ana.palaces[p - 1]}
                    selected={selected === p}
                    onSelect={() => setSelected(selected === p ? null : p)}
                    showAnGan={showAnGan}
                    showYinGan={showYinGan}
                    showDaiGan={showDaiGan}
                    showFeiZhi={showFeiZhi}
                    globalGe={ana.global}
                    jiangMap={jiangMap}
                    marks={marks}
                  />
                ))}
              </div>
            );
            if (!jiangMap) return board;
            // 穿壬:天將成外環,依支繞盤
            return (
              <div className="chuan-ring">
                {RING.map(([b, row, col]) => (
                  <div
                    className={`ring-cell${col === 1 || col === 5 ? ' ring-side' : ''}${jiangMap[b] === '貴人' ? ' ring-gui' : ''}`}
                    style={{ gridRow: row, gridColumn: col }}
                    key={b}
                    title={`${b}・${jiangMap[b]}`}
                  >
                    <span className="ring-branch">{b}</span>
                    <span
                      className={`ring-jiang jiang-${JIANG_LUCK[jiangMap[b]]}`}
                    >
                      {JIANG_SHORT[jiangMap[b]]}
                    </span>
                  </div>
                ))}
                {board}
              </div>
            );
          })()}

          {selected ? (
            <DetailPanel
              chart={chart}
              ana={ana}
              palace={selected}
              jiangMap={jiangMap}
            />
          ) : (
            <div className="hint">
              點按任一宮,觀門宮生剋、長生、格局詳解;全局之格(五不遇時、伏反吟)列於中宮
            </div>
          )}

          <footer>
            <p>
              置閏法:符頭超節氣九日(實差)以上,逢芒種大雪重用三元;拆補法:交節即換局,元按符頭拆定;
              旬首法:元同置閏,自符頭日甲子時起每旬(十時辰)進一局,陽順陰逆(劉伯溫/透派時盤之制)。
              飛盤:九星各攜本宮地盤干,自值符宮按洛書宮序飛入時干宮起之宮序,陽順陰逆,中五入盤不寄;
              門神同法飛佈,九神以勾陳、朱雀、太常代轉盤之白虎、玄武。
              鳴法(《奇門遁甲鳴法》):星、儀、門恆順飛不分遁,九門補中門,
              九神陽遁順飛(符蛇陰合陳常雀地天)、陰遁逆飛(符蛇陰合虎常玄地天),
              天盤起值符落宮、地盤起值符原宮,一明一暗兩套;
              飛支自旬宮起本旬首支,十二支陽順陰逆飛佈。 時間依東八區。支援約
              1900–2100 年。
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
