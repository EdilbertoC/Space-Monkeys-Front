// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Why harmonization matters: yearly fire cell-days of the area as MODIS saw them, as VIIRS
// saw them, and the harmonized (MODIS-equivalent) series, with the trend of each
// comparable series. VIIRS is shown for context only: it is not comparable across years.
import { historyApi } from "../../../app/api";
import { useApi } from "../../../shared/api/useApi";
import { PanelTitle } from "../../../shared/ui/ui";
import { areaKey, areaSelector, type AreaChoice } from "../model/area";
import { coverageEnd, formatValue, type Meta } from "../model/history-view";
import { H, niceTicks, PAD, PanelState, TrendCard, W } from "./HistoryParts";

type YearRow = { year: number; harmonized?: number; modis?: number; viirs?: number };

export default function HistoricalAnalysis({ meta, area }: { meta: Meta; area: AreaChoice }) {
  const key = areaKey(area);
  const harmonized = useApi(
    (signal) => historyApi.getTrend({ ...areaSelector(area), series: "harmonized" }, { signal }),
    [key],
  );
  const modis = useApi(
    (signal) => historyApi.getTrend({ ...areaSelector(area), series: "modis" }, { signal }),
    [key],
  );
  const lastYear = Math.min(
    harmonized.data?.data.annual.at(-1)?.year ?? Number(coverageEnd(meta).slice(0, 4)) - 1,
    Number(coverageEnd(meta).slice(0, 4)) - 1,
  );
  const viirsStart = meta.coverage.viirs?.start.slice(0, 4) ?? "2012";
  const viirs = useApi(
    (signal) =>
      historyApi.getCalendar(
        {
          ...areaSelector(area),
          start: `${Number(viirsStart) + 1}-01-01`,
          end: `${lastYear}-12-31`,
          granularity: "month",
        },
        { signal },
      ),
    [key, viirsStart, lastYear],
  );

  const rows = new Map<number, YearRow>();
  const row = (y: number) => rows.get(y) ?? rows.set(y, { year: y }).get(y)!;
  harmonized.data?.data.annual.forEach((a) => a.complete && (row(a.year).harmonized = a.value));
  modis.data?.data.annual.forEach((a) => a.complete && (row(a.year).modis = a.value));
  viirs.data?.buckets.forEach((b) => {
    if (b.viirs === null) return;
    const r = row(Number(b.start.slice(0, 4)));
    r.viirs = (r.viirs ?? 0) + b.viirs;
  });
  const years = [...rows.values()].sort((a, b) => a.year - b.year);

  return (
    <div className="history-workspace">
      <div className="hw-kpis hw-kpis-2">
        <TrendCard trend={harmonized} title="Trend · harmonized" />
        <TrendCard trend={modis} title="Trend · MODIS observed" />
      </div>
      <section className="panel hw-trend-panel">
        <PanelTitle
          title="Yearly fire cell-days: MODIS, VIIRS and harmonized"
          subtitle={`VIIRS (375 m) sees small fires MODIS (1 km) misses, and NOAA-20 (2018) and NOAA-21 (2023) add detections, so raw VIIRS counts jump when satellites are added. The harmonized series stays in MODIS units across the record.`}
        />
        {harmonized.status === "success" || modis.status === "success" ? (
          <YearLines years={years} />
        ) : (
          <PanelState error={harmonized.error ?? modis.error ?? undefined} />
        )}
        {viirs.status === "error" && (
          <p className="hw-note hw-pad">VIIRS totals unavailable for this area.</p>
        )}
      </section>
    </div>
  );
}

function YearLines({ years }: { years: YearRow[] }) {
  const keys = ["viirs", "modis", "harmonized"] as const;
  const max = Math.max(1, ...years.flatMap((r) => keys.map((k) => r[k] ?? 0)));
  const n = years.length;
  if (!n) return <PanelState error={new Error("No complete years for this area.")} />;
  const x = (i: number) => PAD.left + (n === 1 ? 0.5 : i / (n - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  return (
    <div className="hw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Yearly fire cell-days per series">
        {niceTicks(max).map((t) => (
          <g key={t}>
            <line className="hw-gridline" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="hw-axis" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {years.map((r, i) =>
          i % 2 === 0 ? (
            <text
              key={r.year}
              className="hw-axis"
              x={x(i)}
              y={H - 6}
              textAnchor={i === n - 1 ? "end" : "middle"}
            >
              {r.year}
            </text>
          ) : null,
        )}
        {keys.map((k) => {
          const segs: string[][] = [[]];
          years.forEach((r, i) => {
            const v = r[k];
            if (v === undefined) segs.push([]);
            else segs[segs.length - 1]!.push(`${x(i)},${y(v)}`);
          });
          return segs
            .filter((s) => s.length)
            .map((s, j) => (
              <polyline
                key={`${k}${j}`}
                className={`hw-line ${k === "harmonized" ? "harm" : k}`}
                points={s.join(" ")}
              />
            ));
        })}
        {years.map((r, i) => (
          <rect
            key={`h${r.year}`}
            className="hw-hit"
            x={x(i) - (W - PAD.left - PAD.right) / n / 2}
            width={(W - PAD.left - PAD.right) / n}
            y={PAD.top}
            height={H - PAD.top - PAD.bottom}
          >
            <title>
              {`${r.year}: harmonized ${formatValue(r.harmonized ?? null)}, MODIS ${formatValue(r.modis ?? null)}, VIIRS ${formatValue(r.viirs ?? null)} fire cell-days`}
            </title>
          </rect>
        ))}
      </svg>
      <div className="hw-legend">
        <i className="hw-swatch line harm" /> <span>Harmonized (MODIS-equivalent)</span>
        <i className="hw-swatch line modis" /> <span>MODIS observed</span>
        <i className="hw-swatch line viirs" />{" "}
        <span>VIIRS observed (not comparable across years)</span>
      </div>
    </div>
  );
}
