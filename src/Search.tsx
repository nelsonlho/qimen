import { useMemo, useState } from 'react';
import {
  BRANCHES,
  BRANCH_ELEMENT,
  DOOR_NAMES,
  GE_CATALOG,
  GOD_NAMES,
  INTENT_PRESETS,
  PALACE_ELEMENT,
  PILLAR_LABEL,
  STAGES,
  STAR_NAMES,
  STEMS,
  computeChart,
  seasonStrength,
  searchGe,
} from './core';
import type {
  AvoidOptions,
  DateParts,
  GeCond,
  JuMethod,
  PillarKey,
  PlateStyle,
  SearchHit,
  SearchQuery,
  Stage,
  StemRef,
  YongRelation,
  YongShen,
} from './core';

const GROUPS = ['九遁', '詐假', '三奇', '剋應吉格'] as const;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const AVOID_ITEMS: [keyof AvoidOptions, string][] = [
  ['kong', '避空亡'],
  ['jiXing', '避擊刑'],
  ['menPo', '避門迫'],
  ['wuBuYuShi', '避五不遇時'],
];

const AVOID_ALL: AvoidOptions = { kong: true, jiXing: true, menPo: true, wuBuYuShi: true };

/** 條件可用之八宮(中五不論門神,不列) */
const COND_PALACES: [number, string][] = [
  [1, '坎一'], [2, '坤二'], [3, '震三'], [4, '巽四'],
  [6, '乾六'], [7, '兌七'], [8, '艮八'], [9, '離九'],
];

/** 落宮可用九宮(飛盤/鳴法用神可落中五) */
const LUO_PALACES: [number, string][] = [
  [1, '坎一'], [2, '坤二'], [3, '震三'], [4, '巽四'], [5, '中五'],
  [6, '乾六'], [7, '兌七'], [8, '艮八'], [9, '離九'],
];

const PILLAR_KEYS: PillarKey[] = ['year', 'month', 'day', 'hour'];

/** 用神選項編碼:kind:name。兩側同單,互為生剋比和同宮 */
const YONG_OPTIONS: { group: string; items: [string, string][] }[] = [
  { group: '合門', items: [['三吉門', '三吉門(開休生)']] as [string, string][] },
  { group: '八門', items: DOOR_NAMES.map((n) => [`門:${n}`, n] as [string, string]) },
  { group: '九星', items: STAR_NAMES.map((n) => [`星:${n}`, n] as [string, string]) },
  { group: '八神', items: GOD_NAMES.map((n) => [`神:${n}`, n] as [string, string]) },
  // 遁甲:甲不上盤,天地盤皆九干
  { group: '天盤干', items: STEMS.filter((s) => s !== '甲').map((s) => [`天:${s}`, `天盤${s}`] as [string, string]) },
  { group: '地盤干', items: STEMS.filter((s) => s !== '甲').map((s) => [`地:${s}`, `地盤${s}`] as [string, string]) },
  { group: '盤之柱干', items: PILLAR_KEYS.map((p) => [`柱:${p}`, PILLAR_LABEL[p]] as [string, string]) },
  { group: '用家', items: [['命', '年命']] as [string, string][] },
];

function decodeYong(v: string, year: number): YongShen {
  if (v === '命') return { kind: '命', stem: yearStem(year) };
  if (v === '三吉門') return { kind: '三吉門' };
  const [kind, rest] = v.split(':') as [string, string];
  if (kind === '天') return { kind: '天盤干', stem: rest };
  if (kind === '地') return { kind: '地盤干', stem: rest };
  if (kind === '柱') return { kind: '柱', pillar: rest as PillarKey };
  return { kind: kind as '門' | '星' | '神', name: rest };
}

/** 干指涉編碼('柱:day' 或 '命')→ StemRef */
function decodeStemRef(target: string, year: number): StemRef {
  return target === '命'
    ? { kind: '命', stem: yearStem(year) }
    : { kind: '柱', pillar: target.split(':')[1] as PillarKey };
}

const SI_JI: Stage[] = ['長生', '冠帶', '臨官', '帝旺'];

interface WangRow {
  palace: number;
  accept: '旺相' | '旺' | '相';
  req: boolean; // 必者硬濾,宜者計分
}

interface YongRow {
  yong: string; // 編碼值
  relation: YongRelation;
  target: string; // 柱:day… 或 命
  year: number; // 年命之生年
  req: boolean;
}

interface CsRow {
  stem: string; // 柱:day… 或 命
  stage: string; // 長生…養,或 '四吉'
  year: number;
  req: boolean;
}

interface LuoRow {
  yong: string; // 用神編碼
  palace: number; // 落宮
  year: number; // 年命之生年
  req: boolean;
}

/** 必/宜切換鈕 */
function ReqToggle({ req, onChange }: { req: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`req-toggle${req ? ' req' : ''}`}
      title={req ? '必:非有不可,無此則不列' : '宜:有則更佳,合多者列前'}
      onClick={() => onChange(!req)}
    >
      {req ? '必' : '宜'}
    </button>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 生年 → 年干(西曆年 - 4 mod 10;跨立春生者宜自斟) */
function yearStem(year: number): string {
  return STEMS[(((year - 4) % 10) + 10) % 10];
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 時支 → 時辰起訖,如 07–09時 */
function hourRange(branch: string): string {
  const idx = BRANCHES.indexOf(branch as (typeof BRANCHES)[number]);
  const start = (idx * 2 + 23) % 24;
  return `${pad(start)}–${pad((start + 2) % 24)}時`;
}

/** 相對日標:今日/明日,他日空 */
function relDay(d: DateParts): string {
  const today = new Date();
  const diff =
    (new Date(d.year, d.month - 1, d.day).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
    86400_000;
  if (diff === 0) return '今日';
  if (diff === 1) return '明日';
  return '';
}

function dayLabel(hit: SearchHit): string {
  const { year, month, day } = hit.date;
  const wd = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  const rel = relDay(hit.date);
  return `${year}年${month}月${day}日(${wd})${rel && `・${rel}`}`;
}

export default function Search({
  method,
  ziShiMode,
  plate,
  onPick,
}: {
  method: JuMethod;
  ziShiMode: '23' | '0';
  plate: PlateStyle;
  onPick: (date: DateParts, palace: number | null) => void;
}) {
  const [intent, setIntent] = useState('');
  const [showAdv, setShowAdv] = useState(false);
  // 格局:名 → 宮/門限定(0/'' = 任意)
  const [geSel, setGeSel] = useState<Map<string, { palace: number; door: string }>>(
    new Map(),
  );
  const [wangRows, setWangRows] = useState<WangRow[]>([]);
  const [yongRows, setYongRows] = useState<YongRow[]>([]);
  const [csRows, setCsRows] = useState<CsRow[]>([]);
  const [luoRows, setLuoRows] = useState<LuoRow[]>([]);
  const [fromDate, setFromDate] = useState(() => toDateStr(new Date()));
  const [toDate, setToDate] = useState(() =>
    toDateStr(new Date(Date.now() + 7 * 86400_000)),
  );
  const [avoid, setAvoid] = useState<AvoidOptions>({});
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const reset = () => {
    setResults(null);
    setRangeError(null);
  };

  const pickIntent = (v: string) => {
    setIntent(v);
    if (v === '自訂') {
      setShowAdv(true);
    } else {
      const preset = INTENT_PRESETS.find((p) => p.intent === v);
      if (preset) {
        setGeSel(new Map(preset.ge.map((n) => [n, { palace: 0, door: '' }])));
        setAvoid(AVOID_ALL);
      }
    }
    reset();
  };

  const toggleGe = (name: string) => {
    setGeSel((prev) => {
      const next = new Map(prev);
      if (next.has(name)) next.delete(name);
      else next.set(name, { palace: 0, door: '' });
      return next;
    });
    setIntent('自訂');
    reset();
  };

  const setGeQual = (name: string, q: { palace: number; door: string }) => {
    setGeSel((prev) => new Map(prev).set(name, q));
    reset();
  };

  const condCount =
    geSel.size + wangRows.length + yongRows.length + csRows.length + luoRows.length;

  // 宮旺預警:月令範圍內恆不合者,搜前即示
  const wangWarns = useMemo(() => {
    const fm = fromDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const tm = toDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!fm || !tm || wangRows.length === 0) return wangRows.map(() => null);
    const branches = new Set<string>();
    const f = new Date(+fm[1], +fm[2] - 1, +fm[3], 12).getTime();
    const t = new Date(+tm[1], +tm[2] - 1, +tm[3], 12).getTime();
    for (let x = f; x <= t; x += 7 * 86400_000) branches.add(monthBranchAt(x));
    branches.add(monthBranchAt(t));
    branches.delete('');
    return wangRows.map((w) => {
      const ok = [...branches].some((b) => {
        const st = seasonStrength(PALACE_ELEMENT[w.palace], BRANCH_ELEMENT[b]);
        return w.accept === '旺相' ? st === '旺' || st === '相' : st === w.accept;
      });
      return ok ? null : '此範圍月令恆不合';
    });
  }, [wangRows, fromDate, toDate]);

  const run = () => {
    const fm = fromDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const tm = toDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!fm || !tm) {
      setRangeError('請選起訖日期');
      return;
    }
    const now = new Date();
    const fromIsToday = fromDate === toDateStr(now);
    // 自日為今日者,自此刻起搜;否則自該日 00:00
    const start: DateParts = {
      year: +fm[1],
      month: +fm[2],
      day: +fm[3],
      hour: fromIsToday ? now.getHours() : 0,
      minute: fromIsToday ? now.getMinutes() : 0,
    };
    const endDate = new Date(+tm[1], +tm[2] - 1, +tm[3] + 1); // 至日含全日
    const spanDays =
      (endDate.getTime() - new Date(+fm[1], +fm[2] - 1, +fm[3]).getTime()) / 86400_000;
    if (spanDays <= 0) {
      setRangeError('至日須不早於自日');
      return;
    }
    if (spanDays > 366) {
      setRangeError('範圍上限一年');
      return;
    }
    setRangeError(null);
    const query: SearchQuery = {
      ge: [...geSel.entries()].map(([name, q]): GeCond => ({
        name,
        palace: q.palace || undefined,
        door: q.door || undefined,
      })),
      wang: wangRows.map((w) => ({
        palace: w.palace,
        accept: w.accept === '旺相' ? (['旺', '相'] as const) : [w.accept],
        required: w.req || undefined,
      })),
      yong: yongRows.map((y) => ({
        yong: decodeYong(y.yong, y.year),
        relation: y.relation,
        target: decodeYong(y.target, y.year),
        required: y.req || undefined,
      })),
      changsheng: csRows.map((c) => ({
        stem: decodeStemRef(c.stem, c.year),
        stages: c.stage === '四吉' ? SI_JI : [c.stage as Stage],
        required: c.req || undefined,
      })),
      luo: luoRows.map((l) => ({
        yong: decodeYong(l.yong, l.year),
        palace: l.palace,
        required: l.req || undefined,
      })),
    };
    setResults(
      searchGe(
        query,
        start,
        {
          year: endDate.getFullYear(),
          month: endDate.getMonth() + 1,
          day: endDate.getDate(),
          hour: 0,
          minute: 0,
        },
        { method, ziShiMode, plate, avoid },
      ),
    );
  };

  // 最佳三時:宜分高者先,次命中數,同者取早
  const best = useMemo(() => {
    if (!results || results.length === 0) return [];
    return results
      .map((h, i) => ({ h, i }))
      .sort(
        (a, b) =>
          b.h.score - a.h.score || b.h.matches.length - a.h.matches.length || a.i - b.i,
      )
      .slice(0, 3)
      .map((x) => x.h);
  }, [results]);

  // 按日分組,序不變
  const grouped = useMemo(() => {
    if (!results) return null;
    const out: { label: string; hits: SearchHit[] }[] = [];
    for (const h of results) {
      const label = dayLabel(h);
      const last = out[out.length - 1];
      if (last && last.label === label) last.hits.push(h);
      else out.push({ label, hits: [h] });
    }
    return out;
  }, [results]);

  const hitChips = (h: SearchHit) =>
    h.matches.map((m, j) => (
      <span
        className={`chip ${m.kind === '格' ? `chip-${m.luck}` : `chip-${m.kind}`}`}
        key={j}
      >
        {m.label}
        {m.palaceName && m.kind !== '旺' ? `·${m.palaceName}` : ''}
      </span>
    ));

  const pick = (h: SearchHit) =>
    onPick(h.date, h.matches.find((m) => m.palace)?.palace ?? null);

  return (
    <div className="search-panel">
      {/* ── 一行擇事 ── */}
      <div className="controls intent-row">
        <label className="opt">
          我欲
          <select value={intent} onChange={(e) => pickIntent(e.target.value)}>
            <option value="" disabled>
              擇事由…
            </option>
            {INTENT_PRESETS.map((p) => (
              <option value={p.intent} key={p.intent}>
                {p.intent}
              </option>
            ))}
            <option value="自訂">自訂條件</option>
          </select>
        </label>
        <label className="opt">
          自
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              reset();
            }}
          />
        </label>
        <label className="opt">
          至
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              reset();
            }}
          />
        </label>
        <button className="search-go" onClick={run} disabled={condCount === 0}>
          求吉時
        </button>
      </div>

      <button className="adv-toggle" onClick={() => setShowAdv(!showAdv)}>
        {showAdv ? '▾' : '▸'} 進階條件
        {condCount > 0 && <span className="adv-count">{condCount}</span>}
      </button>

      {showAdv && (
        <>
          {/* ── 格局 ── */}
          <div className="cond-card">
            <div className="cond-title">格局(擇一即得)</div>
            <div className="ge-groups">
              {GROUPS.map((group) => (
                <div className="ge-group" key={group}>
                  <span className="ge-group-label">{group}</span>
                  <span className="ge-chips">
                    {GE_CATALOG.filter((e) => e.group === group).map((e) => (
                      <button
                        key={e.name}
                        className={`ge-chip${geSel.has(e.name) ? ' on' : ''}`}
                        title={e.note}
                        onClick={() => toggleGe(e.name)}
                      >
                        {e.name}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </div>
            {geSel.size > 0 && (
              <div className="cond-rows">
                {[...geSel.entries()].map(([name, q]) => (
                  <div className="cond-row" key={name}>
                    <strong>{name}</strong>
                    <label>
                      落
                      <select
                        value={q.palace}
                        onChange={(e) => setGeQual(name, { ...q, palace: +e.target.value })}
                      >
                        <option value={0}>任意宮</option>
                        {COND_PALACES.map(([p, n]) => (
                          <option value={p} key={p}>
                            {n}宮
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      遇
                      <select
                        value={q.door}
                        onChange={(e) => setGeQual(name, { ...q, door: e.target.value })}
                      >
                        <option value="">任意門</option>
                        {DOOR_NAMES.map((d) => (
                          <option value={d} key={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button className="cond-del" onClick={() => toggleGe(name)} aria-label="刪">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── 宮旺・用神・長生・避忌 ── */}
          <div className="cond-card">
            <div className="cond-title cond-title-row">
              加持條件
              <span className="cond-note">必=非有不可;宜=有則更佳,合多者列前</span>
            </div>
            <div className="cond-rows">
              {wangRows.map((w, i) => (
                <div className="cond-row" key={`w${i}`}>
                  <ReqToggle
                    req={w.req}
                    onChange={(v) => {
                      const rows = [...wangRows];
                      rows[i] = { ...w, req: v };
                      setWangRows(rows);
                      reset();
                    }}
                  />
                  <strong>宮旺</strong>
                  <select
                    value={w.palace}
                    onChange={(e) => {
                      const rows = [...wangRows];
                      rows[i] = { ...w, palace: +e.target.value };
                      setWangRows(rows);
                      reset();
                    }}
                  >
                    {COND_PALACES.map(([p, n]) => (
                      <option value={p} key={p}>
                        {n}宮
                      </option>
                    ))}
                  </select>
                  <label>
                    於月令
                    <select
                      value={w.accept}
                      onChange={(e) => {
                        const rows = [...wangRows];
                        rows[i] = { ...w, accept: e.target.value as WangRow['accept'] };
                        setWangRows(rows);
                        reset();
                      }}
                    >
                      <option value="旺相">旺或相</option>
                      <option value="旺">旺</option>
                      <option value="相">相</option>
                    </select>
                  </label>
                  {wangWarns[i] && <span className="cond-warn">{wangWarns[i]}</span>}
                  <button
                    className="cond-del"
                    onClick={() => {
                      setWangRows(wangRows.filter((_, j) => j !== i));
                      reset();
                    }}
                    aria-label="刪"
                  >
                    ×
                  </button>
                </div>
              ))}
              {yongRows.map((y, i) => (
                <div className="cond-row" key={`y${i}`}>
                  <ReqToggle
                    req={y.req}
                    onChange={(v) => {
                      const rows = [...yongRows];
                      rows[i] = { ...y, req: v };
                      setYongRows(rows);
                      reset();
                    }}
                  />
                  <strong>用神</strong>
                  <select
                    value={y.yong}
                    onChange={(e) => {
                      const rows = [...yongRows];
                      rows[i] = { ...y, yong: e.target.value };
                      setYongRows(rows);
                      reset();
                    }}
                  >
                    {YONG_OPTIONS.map((g) => (
                      <optgroup label={g.group} key={g.group}>
                        {g.items.map(([v, label]) => (
                          <option value={v} key={v}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <select
                    value={y.relation}
                    onChange={(e) => {
                      const rows = [...yongRows];
                      rows[i] = { ...y, relation: e.target.value as YongRelation };
                      setYongRows(rows);
                      reset();
                    }}
                  >
                    <option value="生">生</option>
                    <option value="比和">比和</option>
                    <option value="剋">剋</option>
                    <option value="同宮">同宮</option>
                    <option value="生比和同宮">生/比和/同宮</option>
                  </select>
                  <select
                    value={y.target}
                    onChange={(e) => {
                      const rows = [...yongRows];
                      rows[i] = { ...y, target: e.target.value };
                      setYongRows(rows);
                      reset();
                    }}
                  >
                    {YONG_OPTIONS.map((g) => (
                      <optgroup label={g.group} key={g.group}>
                        {g.items.map(([v, label]) => (
                          <option value={v} key={v}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {(y.yong === '命' || y.target === '命') && (
                    <label>
                      生年
                      <input
                        type="number"
                        className="year-input"
                        value={y.year}
                        min={1900}
                        max={2100}
                        onChange={(e) => {
                          const rows = [...yongRows];
                          rows[i] = { ...y, year: +e.target.value };
                          setYongRows(rows);
                          reset();
                        }}
                      />
                      <span className="year-stem">{yearStem(y.year)}年</span>
                    </label>
                  )}
                  <button
                    className="cond-del"
                    onClick={() => {
                      setYongRows(yongRows.filter((_, j) => j !== i));
                      reset();
                    }}
                    aria-label="刪"
                  >
                    ×
                  </button>
                </div>
              ))}
              {csRows.map((c, i) => (
                <div className="cond-row" key={`c${i}`}>
                  <ReqToggle
                    req={c.req}
                    onChange={(v) => {
                      const rows = [...csRows];
                      rows[i] = { ...c, req: v };
                      setCsRows(rows);
                      reset();
                    }}
                  />
                  <strong>長生</strong>
                  <select
                    value={c.stem}
                    onChange={(e) => {
                      const rows = [...csRows];
                      rows[i] = { ...c, stem: e.target.value };
                      setCsRows(rows);
                      reset();
                    }}
                  >
                    {PILLAR_KEYS.map((p) => (
                      <option value={`柱:${p}`} key={p}>
                        盤之{PILLAR_LABEL[p]}
                      </option>
                    ))}
                    <option value="命">用家年命</option>
                  </select>
                  處
                  <select
                    value={c.stage}
                    onChange={(e) => {
                      const rows = [...csRows];
                      rows[i] = { ...c, stage: e.target.value };
                      setCsRows(rows);
                      reset();
                    }}
                  >
                    <option value="四吉">四吉(生帶祿旺)</option>
                    {STAGES.map((s) => (
                      <option value={s} key={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {c.stem === '命' && (
                    <label>
                      生年
                      <input
                        type="number"
                        className="year-input"
                        value={c.year}
                        min={1900}
                        max={2100}
                        onChange={(e) => {
                          const rows = [...csRows];
                          rows[i] = { ...c, year: +e.target.value };
                          setCsRows(rows);
                          reset();
                        }}
                      />
                      <span className="year-stem">{yearStem(c.year)}年</span>
                    </label>
                  )}
                  <button
                    className="cond-del"
                    onClick={() => {
                      setCsRows(csRows.filter((_, j) => j !== i));
                      reset();
                    }}
                    aria-label="刪"
                  >
                    ×
                  </button>
                </div>
              ))}
              {luoRows.map((l, i) => (
                <div className="cond-row" key={`l${i}`}>
                  <ReqToggle
                    req={l.req}
                    onChange={(v) => {
                      const rows = [...luoRows];
                      rows[i] = { ...l, req: v };
                      setLuoRows(rows);
                      reset();
                    }}
                  />
                  <strong>落宮</strong>
                  <select
                    value={l.yong}
                    onChange={(e) => {
                      const rows = [...luoRows];
                      rows[i] = { ...l, yong: e.target.value };
                      setLuoRows(rows);
                      reset();
                    }}
                  >
                    {YONG_OPTIONS.map((g) => (
                      <optgroup label={g.group} key={g.group}>
                        {g.items.map(([v, label]) => (
                          <option value={v} key={v}>
                            {label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  落
                  <select
                    value={l.palace}
                    onChange={(e) => {
                      const rows = [...luoRows];
                      rows[i] = { ...l, palace: +e.target.value };
                      setLuoRows(rows);
                      reset();
                    }}
                  >
                    {LUO_PALACES.map(([p, n]) => (
                      <option value={p} key={p}>
                        {n}宮
                      </option>
                    ))}
                  </select>
                  {l.yong === '命' && (
                    <label>
                      生年
                      <input
                        type="number"
                        className="year-input"
                        value={l.year}
                        min={1900}
                        max={2100}
                        onChange={(e) => {
                          const rows = [...luoRows];
                          rows[i] = { ...l, year: +e.target.value };
                          setLuoRows(rows);
                          reset();
                        }}
                      />
                      <span className="year-stem">{yearStem(l.year)}年</span>
                    </label>
                  )}
                  <button
                    className="cond-del"
                    onClick={() => {
                      setLuoRows(luoRows.filter((_, j) => j !== i));
                      reset();
                    }}
                    aria-label="刪"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="cond-add">
                <button
                  onClick={() => {
                    setWangRows([...wangRows, { palace: 1, accept: '旺相', req: false }]);
                    reset();
                  }}
                >
                  +宮旺
                </button>
                <button
                  onClick={() => {
                    setYongRows([
                      ...yongRows,
                      { yong: '門:開門', relation: '生', target: '柱:day', year: 1990, req: false },
                    ]);
                    reset();
                  }}
                >
                  +用神
                </button>
                <button
                  onClick={() => {
                    setCsRows([...csRows, { stem: '柱:day', stage: '四吉', year: 1990, req: false }]);
                    reset();
                  }}
                >
                  +長生
                </button>
                <button
                  onClick={() => {
                    setLuoRows([
                      ...luoRows,
                      { yong: '三吉門', palace: 1, year: 1990, req: false },
                    ]);
                    reset();
                  }}
                >
                  +落宮
                </button>
              </div>
              <div className="cond-row avoid-row">
                <strong>避忌</strong>
                {AVOID_ITEMS.map(([key, label]) => (
                  <label className="opt check" key={key}>
                    <input
                      type="checkbox"
                      checked={!!avoid[key]}
                      onChange={(e) => {
                        setAvoid({ ...avoid, [key]: e.target.checked });
                        reset();
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {rangeError && <div className="error">{rangeError}</div>}

      {results && results.length === 0 && (
        <div className="hint">此範圍內無合條件之時;可放寬範圍或減條件</div>
      )}

      {results && results.length > 0 && (
        <>
          <div className="best-cards">
            {best.map((h, i) => (
              <button className="best-card" key={i} onClick={() => pick(h)}>
                <span className="best-rank">
                  {['最佳', '次吉', '又次'][i]}
                  {h.optTotal > 0 && (
                    <i className="score-badge">
                      宜{h.score}/{h.optTotal}
                    </i>
                  )}
                </span>
                <span className="best-time">
                  {h.hourGZ}時 <i>{hourRange(h.hourGZ[1])}</i>
                  {h.ke != null && <i className="hit-ke">第{h.ke}刻</i>}
                </span>
                <span className="best-date">{dayLabel(h)}</span>
                <span className="hit-matches">{hitChips(h)}</span>
              </button>
            ))}
          </div>
          <details className="all-hits">
            <summary>全部 {results.length} 中</summary>
            <div className="search-results">
              {grouped!.map((g) => (
                <div className="day-group" key={g.label}>
                  <div className="day-label">{g.label}</div>
                  {g.hits.map((h, i) => (
                    <button className="hit-row" key={i} onClick={() => pick(h)}>
                      <span className="hit-time">
                        {h.hourGZ}時 {hourRange(h.hourGZ[1])}
                        {h.ke != null && <i className="hit-ke">第{h.ke}刻</i>}
                        {h.optTotal > 0 && (
                          <i className="score-badge">
                            宜{h.score}/{h.optTotal}
                          </i>
                        )}
                      </span>
                      <span className="hit-matches">{hitChips(h)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </details>
        </>
      )}

      {!results && (
        <div className="hint">擇事由與起訖之日,按「求吉時」;點結果即載其時之盤</div>
      )}
    </div>
  );
}

/** 某時刻之月支(取當日正午),超出範圍者空 */
function monthBranchAt(ms: number): string {
  const d = new Date(ms);
  try {
    return computeChart({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      hour: 12,
      minute: 0,
    }).pillars.month[1];
  } catch {
    return '';
  }
}
