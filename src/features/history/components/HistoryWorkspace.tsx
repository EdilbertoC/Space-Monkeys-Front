// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Burning activity calendar backed by the /history API. Every number on this page comes
// from the backend; on failure the panel says so and never falls back to fixtures.
import "../styles/history-workspace.css";
import { useCallback, useMemo, useState } from "react";
import { historyApi } from "../../../app/api";
import type { Series } from "../../../shared/api/types";
import { useApiResource } from "../../../shared/api/useApiResource";
import SelectControl from "../../../shared/ui/SelectControl";
import { PanelTitle } from "../../../shared/ui/ui";
import { areaLabel, areaSelector, type AreaChoice } from "../model/area";
import {
  bucketValue,
  coverageYears,
  formatInterval,
  formatValue,
  intensityLevel,
  isCompleteYear,
  longDate,
  MONTH_SHORT,
  monthGrid,
  SERIES_LABEL,
  yearRange,
  type Bucket,
  type Meta,
} from "../model/history-view";
import {
  AreaPicker,
  Loadable,
  MethodNote,
  NormalCard,
  SeasonCard,
  SeriesNote,
  TotalCard,
  TrendCard,
  TrendChart,
  WeeklyChart,
} from "./HistoryParts";

const DEFAULT_YEAR = 2020;

export default function HistoryWorkspace({
  meta,
  area,
  onAreaChange,
}: {
  meta: Meta;
  area: AreaChoice;
  onAreaChange: (area: AreaChoice) => void;
}) {
  const years = useMemo(() => coverageYears(meta), [meta]);
  const [year, setYear] = useState(years.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : years[0]!);
  const [series, setSeries] = useState<Series>("harmonized");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const setArea = onAreaChange;

  const harmonizedReady = meta.harmonization.status === "available";
  // Climatology, anomaly, season and trend compare years: VIIRS is not comparable.
  const analysisSeries: Series = series === "modis" || !harmonizedReady ? "modis" : "harmonized";
  const calendarSeries: Series = series === "harmonized" && !harmonizedReady ? "modis" : series;

  const selector = useMemo(() => areaSelector(area), [area]);
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
