import { useMemo, useState } from 'react';
import { BRANCHES, GE_CATALOG, searchGe } from './core';
import type { AvoidOptions, JuMethod, SearchHit } from './core';

const GROUPS = ['九遁', '詐假', '三奇', '剋應吉格'] as const;

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const AVOID_ITEMS: [keyof AvoidOptions, string][] = [
  ['kong', '避空亡'],
  ['jiXing', '避擊刑'],
  ['menPo', '避門迫'],
  ['wuBuYuShi', '避五不遇時'],
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 時支 → 時辰起訖,如 辰時07–09時 */
function hourRange(branch: string): string {
  const idx = BRANCHES.indexOf(branch as (typeof BRANCHES)[number]);
  const start = (idx * 2 + 23) % 24;
  return `${pad(start)}–${pad((start + 2) % 24)}時`;
}

function dayLabel(hit: SearchHit): string {
  const { year, month, day } = hit.date;
  const wd = WEEKDAYS[new Date(year, month - 1, day).getDay()];
  return `${year}年${month}月${day}日(${wd})`;
}

export default function Search({
  method,
  ziShiMode,
  onPick,
}: {
  method: JuMethod;
  ziShiMode: '23' | '0';
  onPick: (date: SearchHit['date'], palace: number) => void;
}) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(7);
  const [avoid, setAvoid] = useState<AvoidOptions>({});
  const [results, setResults] = useState<SearchHit[] | null>(null);

  const toggle = (name: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
    setResults(null);
  };

  const run = () => {
    const now = new Date();
    setResults(
      searchGe(
        [...chosen],
        {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
          hour: now.getHours(),
          minute: now.getMinutes(),
        },
        days,
        { method, ziShiMode, avoid },
      ),
    );
  };

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

  return (
    <div className="search-panel">
      <div className="ge-groups">
        {GROUPS.map((group) => (
          <div className="ge-group" key={group}>
            <span className="ge-group-label">{group}</span>
            <span className="ge-chips">
              {GE_CATALOG.filter((e) => e.group === group).map((e) => (
                <button
                  key={e.name}
                  className={`ge-chip${chosen.has(e.name) ? ' on' : ''}`}
                  onClick={() => toggle(e.name)}
                >
                  {e.name}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>

      <div className="controls search-opts">
        <label className="opt">
          範圍
          <select value={days} onChange={(e) => setDays(+e.target.value)}>
            <option value={7}>未來7日</option>
            <option value={30}>未來30日</option>
            <option value={90}>未來90日</option>
          </select>
        </label>
        {AVOID_ITEMS.map(([key, label]) => (
          <label className="opt check" key={key}>
            <input
              type="checkbox"
              checked={!!avoid[key]}
              onChange={(e) => setAvoid({ ...avoid, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <button className="search-go" onClick={run} disabled={chosen.size === 0}>
          搜尋
        </button>
      </div>

      {results && results.length === 0 && (
        <div className="hint">此範圍內無所選之格;可放寬範圍或減避忌</div>
      )}

      {grouped && grouped.length > 0 && (
        <div className="search-results">
          {grouped.map((g) => (
            <div className="day-group" key={g.label}>
              <div className="day-label">{g.label}</div>
              {g.hits.map((h, i) => (
                <button
                  className="hit-row"
                  key={i}
                  onClick={() => onPick(h.date, h.matches[0].palace)}
                >
                  <span className="hit-time">
                    {h.hourGZ}時 {hourRange(h.hourGZ[1])}
                    {h.ke != null && <i className="hit-ke">第{h.ke}刻</i>}
                  </span>
                  <span className="hit-matches">
                    {h.matches.map((m, j) => (
                      <span className={`chip chip-${m.luck}`} key={j}>
                        {m.name}·{m.palaceName}
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {!results && (
        <div className="hint">
          擇欲求之格,定範圍,按搜尋;點結果即載其時之盤
        </div>
      )}
    </div>
  );
}
