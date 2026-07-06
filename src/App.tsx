import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  BRANCHES,
  BRANCH_ELEMENT,
  PALACE_NUMBERS,
  STEMS,
  STEM_ELEMENT,
  analyzeChart,
  computeChart,
} from './core';
import type {
  Chart,
  ChartAnalysis,
  GeJu,
  JuMethod,
  PalaceAnalysis,
  PalaceInfo,
} from './core';
import './App.css';

// 洛書九宮版位:上南下北
const GRID: number[] = [4, 9, 2, 3, 5, 7, 8, 1, 6];

// 後天八卦水印
const TRIGRAM: Record<number, string> = {
  1: '☵', 2: '☷', 3: '☳', 4: '☴', 5: '☯', 6: '☰', 7: '☱', 8: '☶', 9: '☲',
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

function StemGroup({
  stems,
  stages,
}: {
  stems: string[];
  stages: PalaceAnalysis['skyStages'];
}) {
  return (
    <span className="stems">
      {stems.map((s) => {
        const st = stages.find((x) => x.stem === s);
        return (
          <span className={`stem e-${STEM_ELEMENT[s]}`} key={s}>
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
                      className={sameYinYang ? `cs-hit e-${STEM_ELEMENT[s]}` : undefined}
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
  order,
  globalGe,
}: {
  info: PalaceInfo;
  chart: Chart;
  ana: PalaceAnalysis;
  selected: boolean;
  onSelect: () => void;
  showAnGan: boolean;
  showYinGan: boolean;
  showDaiGan: boolean;
  order: number;
  globalGe: GeJu[];
}) {
  const cellStyle = { '--i': order } as CSSProperties;
  // 格底一行:左為暗干隱干,右為宮名——入流佈局,不壓正文
  const cellFoot = (
    <div className="cell-foot">
      {showAnGan && <span className="angan">暗{info.anGan}</span>}
      {showYinGan && <span className="yingan">隱{info.yinGan}</span>}
      <span className="palace-name">{info.name}</span>
    </div>
  );
  const watermark = <span className="trigram">{TRIGRAM[info.palace]}</span>;
  if (info.palace === 5) {
    // 中宮統攝全局:全局之格列此,按之觀詳解
    return (
      <div
        className={`palace center${selected ? ' selected' : ''}`}
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
        </div>
        <div className="stem-row">
          <span className="earth-stem">{info.earthStems.join('')}</span>
          <span className="ji-note">寄坤二</span>
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
        {/* 八神取次字:符蛇陰合虎武地天 */}
        <span className="god">{info.god?.slice(1)}</span>
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
          <StemGroup stems={info.skyStems} stages={ana.skyStages} />
        </span>
      </div>
      <div className="row">
        <span className="door">
          {/* 八門取首字 */}
          {info.door?.slice(0, 1)}
          {showDaiGan && info.doorDaiGan && (
            <i className="daigan">{info.doorDaiGan}</i>
          )}
          {rel && rel.key !== '義' && rel.key !== '和' && rel.key !== '伏' && (
            <i className={`rel rel-${rel.key}`}>{rel.key}</i>
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
}: {
  chart: Chart;
  ana: ChartAnalysis;
  palace: number;
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
              {chart.ju.yuanName}・{chart.ju.dun}遁{chart.ju.ju}局({chart.ju.method}法
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
          {ana.global.length === 0 && <div className="note">此時無全局之格</div>}
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
          <dd>{info.god}</dd>
        </div>
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
  const [selected, setSelected] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const q = new URLSearchParams(location.search).get('theme');
    if (q === 'light' || q === 'dark' || q === 'auto') return q;
    return (localStorage.getItem('qimen-theme') as Theme) ?? 'auto';
  });
  const layerInit = (key: string) => () => {
    const q = new URLSearchParams(location.search).get(key.replace('qimen-', ''));
    if (q === '1' || q === '0') return q === '1';
    return localStorage.getItem(key) === '1';
  };
  const [showAnGan, setShowAnGan] = useState(layerInit('qimen-angan'));
  const [showYinGan, setShowYinGan] = useState(layerInit('qimen-yingan'));
  const [showDaiGan, setShowDaiGan] = useState(layerInit('qimen-daigan'));

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
  }, [showAnGan, showYinGan, showDaiGan]);

  const { chart, ana, error } = useMemo(() => {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return { chart: null, ana: null, error: '請輸入時間' };
    try {
      const chart = computeChart(
        { year: +m[1], month: +m[2], day: +m[3], hour: +m[4], minute: +m[5] },
        { ziShiMode, method },
      );
      return { chart, ana: analyzeChart(chart), error: null };
    } catch (e) {
      return { chart: null, ana: null, error: (e as Error).message };
    }
  }, [value, ziShiMode, method]);

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
        <div className="subtitle">時家轉盤</div>
      </header>

      <div className="controls">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="起局時間"
        />
        <button onClick={() => setValue(toInputValue(new Date()))}>此刻</button>
        <label className="opt">
          定局
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as JuMethod)}
          >
            <option value="置閏">置閏法</option>
            <option value="拆補">拆補法</option>
            <option value="旬首">旬首法(十刻一局)</option>
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
      </div>

      {error && <div className="error">{error}</div>}

      {chart && ana && (
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
              <span className="status">拆補法</span>
            )}
            <span>旬首 {chart.xunShou}</span>
            <span>
              值符{chart.zhiFuStar}・值使{chart.zhiShiDoor}
            </span>
            <span>空亡 {chart.kongWang.join('')}</span>
            <span>馬星 {chart.horseBranch}</span>
          </div>

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
                globalGe={ana.global}
              />
            ))}
          </div>

          {selected ? (
            <DetailPanel chart={chart} ana={ana} palace={selected} />
          ) : (
            <div className="hint">
              點按任一宮,觀門宮生剋、長生、格局詳解;全局之格(五不遇時、伏反吟)列於中宮
            </div>
          )}

          <footer>
            <p>
              置閏法:符頭超節氣九日(實差)以上,逢芒種大雪重用三元;拆補法:交節即換局,元按符頭拆定;
              旬首法:元同置閏,自符頭日甲子時起每旬(十時辰)進一局,陽順陰逆(劉伯溫/透派時盤之制)。
              時間依東八區。支援約 1900–2100 年。
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
