// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Burning activity calendar backed by the /history API. Every number on this page comes
// from the backend; on failure the panel says so and never falls back to fixtures.
import "../styles/history-workspace.css";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { historyApi } from "../../../app/api";
import { ApiError } from "../../../shared/api/http";
import type { AreaSelector, Biome, Schemas, Series } from "../../../shared/api/types";
import { useApiResource, type ApiResource } from "../../../shared/api/useApiResource";
import SelectControl from "../../../shared/ui/SelectControl";
import { Icon, PanelTitle } from "../../../shared/ui/ui";
import { bboxSelector } from "../api/history";
import {
  ANOMALY_LABEL,
  bucketValue,
  coverageEnd,
  coverageYears,
  daysFromNormal,
  formatInterval,
  formatValue,
  intensityLevel,
  isCompleteYear,
  longDate,
  MONTH_SHORT,
  monthGrid,
  SERIES_LABEL,
  shiftLabel,
  shortDate,
  weeksAgainstNormal,
  yearRange,
  type Bucket,
  type Meta,
  type WeekVsNormal,
} from "../model/history-view";

type AreaChoice = { kind: "biome"; biome: Biome } | { kind: "bbox"; bbox: string };

const DEFAULT_AREA: AreaChoice = { kind: "biome", biome: "Pantanal" };
const DEFAULT_YEAR = 2020;

export default function HistoryWorkspace() {
  const loadMeta = useCallback((signal: AbortSignal) => historyApi.getMeta({ signal }), []);
  const meta = useApiResource(loadMeta);

  if (meta.status === "error") {
    return (
      <section className="panel hw-state hw-error" role="alert">
        <Icon name="alert" size={18} />
        <div>
          <strong>Historical data service unavailable</strong>
          <p>{describeError(meta.error)}</p>
          <p>
            Start the Space Monkeys API (<code>uvicorn app.main:app --port 8000</code>) and check
            that <code>VITE_API_BASE_URL</code> points to it.
          </p>
          <button className="hw-button" onClick={meta.reload}>
            Retry
          </button>
        </div>
      </section>
    );
  }
  if (meta.status !== "success") {
    return (
      <section className="panel hw-state" role="status">
        Loading the historical record from the API…
      </section>
    );
  }
  return <Workspace meta={meta.data} />;
}

function Workspace({ meta }: { meta: Meta }) {
  const years = useMemo(() => coverageYears(meta), [meta]);
  const [area, setArea] = useState<AreaChoice>(DEFAULT_AREA);
  const [year, setYear] = useState(years.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : years[0]!);
  const [series, setSeries] = useState<Series>("harmonized");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const harmonizedReady = meta.harmonization.status === "available";
  // Climatology, anomaly, season and trend compare years: VIIRS is not comparable.
  const analysisSeries: Series = series === "modis" || !harmonizedReady ? "modis" : "harmonized";
  const calendarSeries: Series = series === "harmonized" && !harmonizedReady ? "modis" : series;

  const selector = useMemo<AreaSelector>(
    () => (area.kind === "biome" ? { biome: area.biome } : { bbox: area.bbox }),
    [area],
  );
  const range = useMemo(() => yearRange(meta, year), [meta, year]);
  const complete = isCompleteYear(meta, year);

  const days = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        historyApi.getCalendar({ ...selector, ...range, granularity: "day" }, { signal }),
      [selector, range],
    ),
  );
  const weeks = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        historyApi.getCalendar({ ...selector, ...range, granularity: "week" }, { signal }),
      [selector, range],
    ),
  );
  const climatology = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        historyApi.getClimatology(
          { ...selector, series: analysisSeries, granularity: "week" },
          { signal },
        ),
      [selector, analysisSeries],
    ),
  );
  const anomaly = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        historyApi.getAnomaly({ ...selector, ...range, series: analysisSeries }, { signal }),
      [selector, range, analysisSeries],
    ),
  );
  const season = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        historyApi.getSeason({ ...selector, year, series: analysisSeries }, { signal }),
      [selector, year, analysisSeries],
    ),
  );
  const trend = useApiResource(
    useCallback(
      (signal: AbortSignal) =>
        historyApi.getTrend({ ...selector, series: analysisSeries }, { signal }),
      [selector, analysisSeries],
    ),
  );

  const dayBuckets = days.status === "success" ? days.data.buckets : [];
  const selectedBucket = dayBuckets.find((b) => b.start === selectedDay) ?? null;
  const areaSummary = days.status === "success" ? days.data.area : null;

  return (
    <div className="history-workspace">
      <section className="panel hw-filters" aria-label="Calendar filters">
        <AreaPicker meta={meta} value={area} onChange={(a) => (setArea(a), setSelectedDay(null))} />
        <div className="hw-field">
          <span>Year</span>
          <SelectControl
            label="Year"
            icon="calendar"
            value={year}
            onChange={(v) => (setYear(Number(v)), setSelectedDay(null))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectControl>
        </div>
        <div className="hw-field">
          <span>Calendar series</span>
          <div className="segmented" role="group" aria-label="Calendar series">
            {(["harmonized", "modis", "viirs"] as const).map((s) => (
              <button
                key={s}
                className={series === s ? "selected" : ""}
                aria-pressed={series === s}
                disabled={s === "harmonized" && !harmonizedReady}
                onClick={() => setSeries(s)}
              >
                {s === "harmonized" ? "Harmonized" : s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="hw-scope">
          <strong>{areaLabel(area)}</strong>
          <span>
            {areaSummary ? `${areaSummary.cells.toLocaleString("en-US")} cells of 0.1°` : "…"} ·{" "}
            {longDate(range.start)} – {longDate(range.end)} UTC
            {!complete && " · year in progress"}
          </span>
        </div>
      </section>

      <SeriesNote series={series} analysisSeries={analysisSeries} meta={meta} />

      <div className="hw-kpis">
        <TotalCard anomaly={anomaly} complete={complete} />
        <NormalCard anomaly={anomaly} />
        <SeasonCard season={season} />
        <TrendCard trend={trend} />
      </div>

      <section className="panel hw-calendar-panel">
        <PanelTitle
          title={`Burning activity calendar · ${year}`}
          subtitle={`${SERIES_LABEL[calendarSeries]} fire cell-days per UTC day. A fire cell-day is a 0.1° cell with at least one detection that day.`}
        />
        <Loadable resource={days}>
          {(data) => (
            <DayCalendar
              year={year}
              buckets={data.buckets}
              series={calendarSeries}
              selected={selectedDay}
              onSelect={setSelectedDay}
            />
          )}
        </Loadable>
        {selectedBucket && <DayDetail bucket={selectedBucket} />}
      </section>

      <section className="panel hw-weekly-panel">
        <PanelTitle
          title="This year against the normal year"
          subtitle={`Weekly fire cell-days, ${SERIES_LABEL[analysisSeries]}. The band is the 10th–90th percentile of the base years, the line their median.`}
        />
        <WeeklyChart weeks={weeks} climatology={climatology} series={analysisSeries} year={year} />
      </section>

      <section className="panel hw-trend-panel">
        <PanelTitle
          title="Yearly totals and long-term trend"
          subtitle={`${SERIES_LABEL[analysisSeries]} fire cell-days per year. Click a year to open its calendar.`}
        />
        <Loadable resource={trend}>
          {(result) => (
            <TrendChart
              annual={result.data.annual}
              selected={year}
              onSelect={(y) => years.includes(y) && (setYear(y), setSelectedDay(null))}
            />
          )}
        </Loadable>
      </section>

      <MethodNote meta={meta} />
    </div>
  );
}

// ---- filters -----------------------------------------------------------------------

function AreaPicker({
  meta,
  value,
  onChange,
}: {
  meta: Meta;
  value: AreaChoice;
  onChange: (area: AreaChoice) => void;
}) {
  const [draft, setDraft] = useState({
    west: "-58.5",
    south: "-19.5",
    east: "-56.5",
    north: "-17.5",
  });
  const [bboxError, setBboxError] = useState<string | null>(null);
  const current = value.kind === "biome" ? value.biome : "__bbox";

  const applyBbox = () => {
    try {
      const sel = bboxSelector([
        Number(draft.west),
        Number(draft.south),
        Number(draft.east),
        Number(draft.north),
      ]);
      setBboxError(null);
      onChange({ kind: "bbox", bbox: sel.bbox! });
    } catch (error) {
      setBboxError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="hw-field hw-area">
      <span>Area of interest</span>
      <SelectControl
        label="Area of interest"
        icon="target"
        value={current}
        onChange={(v) =>
          v === "__bbox" ? applyBbox() : onChange({ kind: "biome", biome: v as Biome })
        }
      >
        {meta.biomes.map((b) => (
          <option key={b.name} value={b.name}>
            {`${b.name} biome`}
          </option>
        ))}
        <option value="__bbox">Custom box (lon/lat)</option>
      </SelectControl>
      {value.kind === "bbox" && (
        <form
          className="hw-bbox"
          onSubmit={(e) => {
            e.preventDefault();
            applyBbox();
          }}
        >
          {(["west", "south", "east", "north"] as const).map((k) => (
            <label key={k}>
              {k}
              <input
                inputMode="decimal"
                value={draft[k]}
                onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              />
            </label>
          ))}
          <button className="hw-button" type="submit">
            Apply
          </button>
          {bboxError && <small role="alert">{bboxError}</small>}
        </form>
      )}
    </div>
  );
}

function areaLabel(area: AreaChoice) {
  if (area.kind === "biome") return `${area.biome} biome (IBGE 2019)`;
  const [w, s, e, n] = area.bbox.split(",");
  return `Box ${s}° to ${n}° lat, ${w}° to ${e}° lon`;
}

function SeriesNote({
  series,
  analysisSeries,
  meta,
}: {
  series: Series;
  analysisSeries: Series;
  meta: Meta;
}) {
  if (meta.harmonization.status !== "available")
    return (
      <p className="hw-note warn">
        <Icon name="info" size={13} /> The harmonized series is not available yet; the page shows
        MODIS observed fire cell-days instead.
      </p>
    );
  if (series === "viirs")
    return (
      <p className="hw-note warn">
        <Icon name="info" size={13} /> VIIRS counts are not comparable across years (NOAA-20 from
        2018 and NOAA-21 from 2023 add detections). The calendar shows VIIRS; the comparisons below
        use the {SERIES_LABEL[analysisSeries]} series.
      </p>
    );
  return null;
}

// ---- KPI cards ---------------------------------------------------------------------

type AnomalyResource = ApiResource<{ data: Schemas["Anomaly"]; fallback: boolean }>;
type SeasonResource = ApiResource<{ data: Schemas["Season"]; fallback: boolean }>;
type TrendResource = ApiResource<{ data: Schemas["Trend"]; fallback: boolean }>;

function Card({
  title,
  children,
  state,
}: {
  title: string;
  children?: ReactNode;
  state?: ApiResource<unknown>;
}) {
  return (
    <section className="panel hw-card">
      <div className="hw-card-title">{title}</div>
      {state && state.status !== "success" ? (
        <div className={`hw-card-state ${state.status}`}>
          {state.status === "error" ? describeError(state.error) : "Loading…"}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function TotalCard({ anomaly, complete }: { anomaly: AnomalyResource; complete: boolean }) {
  const a = anomaly.data?.data;
  return (
    <Card title={complete ? "Fire cell-days this year" : "Fire cell-days so far"} state={anomaly}>
      {a && (
        <>
          <strong className="hw-big">{formatValue(a.value)}</strong>
          <small>
            {formatInterval(a.value_interval) ?? SERIES_LABEL[a.series]}
            {!complete && " · year in progress"}
          </small>
        </>
      )}
    </Card>
  );
}

function NormalCard({ anomaly }: { anomaly: AnomalyResource }) {
  const a = anomaly.data?.data;
  return (
    <Card title="Compared with the normal" state={anomaly}>
      {a && (
        <>
          <strong className={`hw-big hw-class-${a.class}`}>{ANOMALY_LABEL[a.class]}</strong>
          <small>
            {a.ratio_to_median !== null && a.ratio_to_median !== undefined
              ? `${a.ratio_to_median.toFixed(2)}× the median (${formatValue(a.normal.median)}); `
              : ""}
            {a.percentile >= 100
              ? "higher than every base year"
              : `higher than ${a.percentile.toFixed(0)}% of base years`}{" "}
            {a.base_years[0]}–{a.base_years[1]}
          </small>
        </>
      )}
    </Card>
  );
}

function SeasonCard({ season }: { season: SeasonResource }) {
  const s = season.data?.data;
  return (
    <Card title="Fire season" state={season}>
      {s && (
        <ul className="hw-season">
          {(
            [
              ["Start", s.start_week, s.normal.start],
              ["Peak", s.peak_week, s.normal.peak],
              ["End", s.end_week, s.normal.end],
            ] as const
          ).map(([label, actual, normal]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>week of {shortDate(actual)}</strong>
              <small>{shiftLabel(daysFromNormal(actual, normal))}</small>
            </li>
          ))}
          {!s.complete_year && (
            <li className="hw-muted">Year in progress; dates may still move.</li>
          )}
        </ul>
      )}
    </Card>
  );
}

function TrendCard({ trend }: { trend: TrendResource }) {
  const t = trend.data?.data;
  const years = t?.annual.filter((a) => a.complete).map((a) => a.year) ?? [];
  return (
    <Card title="Long-term trend" state={trend}>
      {t && (
        <>
          <strong className="hw-big">
            {t.slope_per_year >= 0 ? "+" : "−"}
            {formatValue(Math.abs(t.slope_per_year))}
            <em> / year</em>
          </strong>
          <small>
            95% CI {formatValue(t.ci95[0] ?? null)} to {formatValue(t.ci95[1] ?? null)} ·{" "}
            {t.significant ? "significant" : "not significant"} · Theil–Sen
            {years.length > 0 && `, ${years[0]}–${years.at(-1)}`}
          </small>
        </>
      )}
    </Card>
  );
}

// ---- calendar ----------------------------------------------------------------------

function DayCalendar({
  year,
  buckets,
  series,
  selected,
  onSelect,
}: {
  year: number;
  buckets: Bucket[];
  series: Series;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const grid = useMemo(() => monthGrid(year, buckets), [year, buckets]);
  const max = useMemo(
    () => Math.max(0, ...buckets.map((b) => bucketValue(b, series) ?? 0)),
    [buckets, series],
  );
  return (
    <div className="hw-calendar">
      <div className="hw-grid" role="grid" aria-label={`Fire cell-days per day in ${year}`}>
        <div className="hw-row hw-head" role="row">
          <span />
          {Array.from({ length: 31 }, (_, d) => (
            <span key={d} role="columnheader">
              {d + 1}
            </span>
          ))}
        </div>
        {grid.map((row, m) => (
          <div className="hw-row" role="row" key={m}>
            <span role="rowheader">{MONTH_SHORT[m]}</span>
            {row.map((cell) => {
              if (!cell.inYear) return <span key={cell.date} className="hw-day out" />;
              const value = cell.bucket ? bucketValue(cell.bucket, series) : null;
              const level = value === null ? -1 : intensityLevel(value, max);
              const label = `${longDate(cell.date)}: ${
                value === null ? "no data" : `${formatValue(value)} fire cell-days`
              }${cell.bucket?.provisional ? " (provisional)" : ""}`;
              return (
                <button
                  key={cell.date}
                  role="gridcell"
                  className={`hw-day ${level < 0 ? "nodata" : `l${level}`} ${
                    cell.bucket?.provisional ? "prov" : ""
                  } ${selected === cell.date ? "sel" : ""}`}
                  title={label}
                  aria-label={label}
                  disabled={!cell.bucket}
                  onClick={() => onSelect(cell.date)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="hw-legend">
        <span>0</span>
        {[0, 1, 2, 3, 4, 5].map((l) => (
          <i key={l} className={`hw-day l${l}`} />
        ))}
        <span>{formatValue(max)} (busiest day)</span>
        <i className="hw-day nodata" /> <span>no data</span>
        <i className="hw-day l2 prov" /> <span>provisional (NRT)</span>
      </div>
    </div>
  );
}

function DayDetail({ bucket }: { bucket: Bucket }) {
  const source =
    bucket.harmonized_source === "viirs_estimate"
      ? "estimated from VIIRS (expected count)"
      : bucket.harmonized_source === "modis"
        ? "MODIS observed"
        : bucket.harmonized_source === "mixed"
          ? "mixed sources"
          : "not available";
  return (
    <dl className="hw-day-detail">
      <div>
        <dt>Day (UTC)</dt>
        <dd>
          {longDate(bucket.start)}
          {bucket.provisional && <span className="hw-tag">provisional</span>}
        </dd>
      </div>
      <div>
        <dt>Harmonized</dt>
        <dd>
          {formatValue(bucket.harmonized?.value)} <small>{source}</small>
          {formatInterval(bucket.harmonized) && (
            <small> · {formatInterval(bucket.harmonized)}</small>
          )}
        </dd>
      </div>
      <div>
        <dt>MODIS observed</dt>
        <dd>{formatValue(bucket.modis)}</dd>
      </div>
      <div>
        <dt>VIIRS observed</dt>
        <dd>{formatValue(bucket.viirs)}</dd>
      </div>
    </dl>
  );
}

// ---- charts ------------------------------------------------------------------------

const W = 760;
const H = 190;
const PAD = { left: 40, right: 10, top: 10, bottom: 22 };

function WeeklyChart({
  weeks,
  climatology,
  series,
  year,
}: {
  weeks: ApiResource<Schemas["Calendar"]>;
  climatology: ApiResource<{ data: Schemas["Climatology"]; fallback: boolean }>;
  series: Series;
  year: number;
}) {
  if (weeks.status === "error" || climatology.status === "error")
    return <PanelState error={(weeks.error ?? climatology.error)!} />;
  if (weeks.status !== "success" || climatology.status !== "success") return <PanelState />;
  const rows = weeksAgainstNormal(weeks.data.buckets, climatology.data.data.buckets, series);
  const base = climatology.data.data.base_years;
  const max = Math.max(1, ...rows.flatMap((r) => [r.p90, r.value ?? 0]));
  const x = (i: number) => PAD.left + (i / 51) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const band =
    rows.map((r) => `${x(r.index)},${y(r.p90)}`).join(" ") +
    " " +
    [...rows]
      .reverse()
      .map((r) => `${x(r.index)},${y(r.p10)}`)
      .join(" ");
  const median = rows.map((r) => `${x(r.index)},${y(r.median)}`).join(" ");
  const ticks = niceTicks(max);
  const above = rows.filter((r) => r.status === "above");
  return (
    <div className="hw-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Weekly fire cell-days in ${year} against base years ${base[0]}–${base[1]}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="hw-gridline" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="hw-axis" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {MONTH_SHORT.map((m, i) => (
          <text key={m} className="hw-axis" x={x((i * 52) / 12 + 2)} y={H - 6} textAnchor="middle">
            {m}
          </text>
        ))}
        <polygon className="hw-band" points={band} />
        <polyline className="hw-median" points={median} />
        {rows.map((r) =>
          r.value === null ? null : (
            <rect
              key={r.index}
              className={`hw-bar ${r.status}`}
              x={x(r.index) - 4.5}
              width={9}
              y={y(r.value)}
              height={Math.max(0, y(0) - y(r.value))}
            >
              <title>{weekTitle(r, year)}</title>
            </rect>
          ),
        )}
      </svg>
      <div className="hw-legend">
        <i className="hw-swatch bar" /> <span>{year}</span>
        <i className="hw-swatch above" /> <span>above the 90th percentile</span>
        <i className="hw-swatch median" />{" "}
        <span>
          median {base[0]}–{base[1]}
        </span>
        <i className="hw-swatch band" /> <span>10th–90th percentile</span>
        {climatology.data.fallback && <span className="hw-tag">MODIS fallback</span>}
      </div>
      {above.length > 0 && (
        <p className="hw-note">
          <Icon name="alert" size={13} /> {above.length} week{above.length > 1 ? "s" : ""} above the
          90th percentile of the base years:{" "}
          {(() => {
            const top = [...above].sort((a, b) => b.value! - b.p90 - (a.value! - a.p90))[0]!;
            return `largest excess: ${top.label} (${formatValue(top.value)} vs p90 ${formatValue(top.p90)})`;
          })()}
        </p>
      )}
    </div>
  );
}

function weekTitle(r: WeekVsNormal, year: number) {
  return `${r.label} ${year}: ${formatValue(r.value)} fire cell-days (median ${formatValue(r.median)}, p10–p90 ${formatValue(r.p10)}–${formatValue(r.p90)})`;
}

function TrendChart({
  annual,
  selected,
  onSelect,
}: {
  annual: Schemas["Trend"]["annual"];
  selected: number;
  onSelect: (year: number) => void;
}) {
  const max = Math.max(1, ...annual.map((a) => a.interval?.high ?? a.value));
  const n = annual.length;
  const step = (W - PAD.left - PAD.right) / Math.max(1, n);
  const x = (i: number) => PAD.left + i * step + step / 2;
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  return (
    <div className="hw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fire cell-days per year">
        {niceTicks(max).map((t) => (
          <g key={t}>
            <line className="hw-gridline" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text className="hw-axis" x={PAD.left - 6} y={y(t) + 3} textAnchor="end">
              {formatValue(t)}
            </text>
          </g>
        ))}
        {annual.map((a, i) => (
          <g key={a.year} className="hw-year" onClick={() => onSelect(a.year)}>
            <rect
              className={`hw-bar ${a.year === selected ? "sel" : ""} ${a.complete ? "" : "partial"}`}
              x={x(i) - step * 0.35}
              width={step * 0.7}
              y={y(a.value)}
              height={Math.max(0, y(0) - y(a.value))}
            />
            {a.interval && a.interval.low !== a.interval.high && (
              <line
                className="hw-whisker"
                x1={x(i)}
                x2={x(i)}
                y1={y(a.interval.low)}
                y2={y(a.interval.high)}
              />
            )}
            {(i % 2 === 0 || a.year === selected) && (
              <text
                className={`hw-axis ${a.year === selected ? "sel" : ""}`}
                x={x(i)}
                y={H - 6}
                textAnchor="middle"
              >
                {String(a.year).slice(2)}
              </text>
            )}
            <rect
              className="hw-hit"
              x={x(i) - step / 2}
              width={step}
              y={PAD.top}
              height={H - PAD.top - PAD.bottom}
            >
              <title>
                {a.year}: {formatValue(a.value)} fire cell-days
                {a.interval && a.interval.low !== a.interval.high
                  ? ` (90% interval ${formatValue(a.interval.low)}–${formatValue(a.interval.high)})`
                  : ""}
                {a.complete ? "" : " · incomplete year"}
              </title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  );
}

function niceTicks(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

// ---- shared bits -------------------------------------------------------------------

function MethodNote({ meta }: { meta: Meta }) {
  const modis = meta.coverage.modis;
  const viirs = meta.coverage.viirs;
  return (
    <details className="panel hw-method">
      <summary>
        <Icon name="info" size={14} /> How these numbers are made
      </summary>
      <ul>
        <li>
          Unit: fire cell-days. The map is a 0.1° grid; a cell counts once per UTC day if MODIS or
          VIIRS detected fire in it. These are not hotspot counts, fire intensity or burned area.
        </li>
        <li>
          Harmonized series: {meta.harmonization.method ?? "MODIS where MODIS delivers data."}
          {meta.harmonization.switch_date
            ? ` Switched to the VIIRS estimate on ${longDate(meta.harmonization.switch_date)}.`
            : " MODIS is still used throughout."}
        </li>
        {modis && (
          <li>
            MODIS (Terra, Aqua): {longDate(modis.start)} – {longDate(modis.end)}; standard archive
            until {longDate(modis.standard_until)}, later days are provisional (NRT).
          </li>
        )}
        {viirs && (
          <li>
            VIIRS (S-NPP, NOAA-20, NOAA-21): {longDate(viirs.start)} – {longDate(viirs.end)};
            standard archive until {longDate(viirs.standard_until)}.
          </li>
        )}
        <li>
          Normal: the 10th, 50th and 90th percentiles of the same calendar period in the base years
          (the selected year is left out). Trend: Theil–Sen slope over complete years.
        </li>
        <li>
          {meta.known_gaps.length} known data gaps are listed by the API. Record ends{" "}
          {longDate(coverageEnd(meta))}. Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m).
        </li>
      </ul>
    </details>
  );
}

function Loadable<T>({
  resource,
  children,
}: {
  resource: ApiResource<T>;
  children: (data: T) => ReactNode;
}) {
  if (resource.status === "success") return <>{children(resource.data)}</>;
  return <PanelState error={resource.error ?? undefined} />;
}

function PanelState({ error }: { error?: Error }) {
  return (
    <div className={`hw-panel-state ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {error ? describeError(error) : "Loading from the API…"}
    </div>
  );
}

function describeError(error: Error): string {
  if (error instanceof ApiError) {
    const detail = typeof error.detail === "string" ? error.detail : error.message;
    if (error.status === 413) return `Area or period too large: ${detail}`;
    if (error.status === 422) return `Not available for this selection: ${detail}`;
    if (error.status === 503) return `Historical data not built on the server: ${detail}`;
    return `API error ${error.status}: ${detail}`;
  }
  if (error.name === "TypeError" || /fetch/i.test(error.message))
    return "Cannot reach the API. Is it running, and does it allow this origin (CORS)?";
  return error.message;
}
