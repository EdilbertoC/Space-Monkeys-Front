// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Building blocks shared by the history pages: filters, KPI cards, charts and API states.
// Every number comes from the /history API; failures are shown, never replaced.
import "../styles/history-workspace.css";
import { useState, type ReactNode } from "react";
import { ApiError } from "../../../shared/api/http";
import type { Biome, Schemas, Series } from "../../../shared/api/types";
import type { ApiResource } from "../../../shared/api/useApiResource";
import SelectControl from "../../../shared/ui/SelectControl";
import { Icon } from "../../../shared/ui/ui";
import { bboxSelector } from "../api/history";
import type { AreaChoice } from "../model/area";
import {
  ANOMALY_LABEL,
  coverageEnd,
  daysFromNormal,
  formatInterval,
  formatValue,
  longDate,
  MONTH_SHORT,
  SERIES_LABEL,
  shiftLabel,
  shortDate,
  weeksAgainstNormal,
  type Meta,
  type WeekVsNormal,
} from "../model/history-view";

// ---- filters -----------------------------------------------------------------------

export function AreaPicker({
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
  const current =
    value.kind === "biome" ? value.biome : value.kind === "country" ? "__brazil" : "__bbox";

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
          v === "__bbox"
            ? applyBbox()
            : v === "__brazil"
              ? onChange({ kind: "country", country: "BR" })
              : onChange({ kind: "biome", biome: v as Biome })
        }
      >
        <option value="__brazil">Brazil (all biomes)</option>
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

export function SeriesNote({
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

export type AnomalyResource = ApiResource<{ data: Schemas["Anomaly"]; fallback: boolean }>;
export type SeasonResource = ApiResource<{ data: Schemas["Season"]; fallback: boolean }>;
export type TrendResource = ApiResource<{ data: Schemas["Trend"]; fallback: boolean }>;

export function Card({
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

export function TotalCard({ anomaly, complete }: { anomaly: AnomalyResource; complete: boolean }) {
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

export function NormalCard({ anomaly }: { anomaly: AnomalyResource }) {
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

export function SeasonCard({ season }: { season: SeasonResource }) {
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

export function TrendCard({
  trend,
  title = "Long-term trend",
}: {
  trend: TrendResource;
  title?: string;
}) {
  const t = trend.data?.data;
  const years = t?.annual.filter((a) => a.complete).map((a) => a.year) ?? [];
  return (
    <Card title={title} state={trend}>
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

// ---- charts ------------------------------------------------------------------------

export const W = 760;
export const H = 190;
export const PAD = { left: 40, right: 10, top: 10, bottom: 22 };

export function WeeklyChart({
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

export function TrendChart({
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

export function niceTicks(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

// ---- shared bits -------------------------------------------------------------------

export function MethodNote({ meta }: { meta: Meta }) {
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

export function Loadable<T>({
  resource,
  children,
}: {
  resource: ApiResource<T>;
  children: (data: T) => ReactNode;
}) {
  if (resource.status === "success") return <>{children(resource.data)}</>;
  return <PanelState error={resource.error ?? undefined} />;
}

export function PanelState({ error }: { error?: Error }) {
  return (
    <div className={`hw-panel-state ${error ? "error" : ""}`} role={error ? "alert" : "status"}>
      {error ? describeError(error) : "Loading from the API…"}
    </div>
  );
}

export function describeError(error: Error): string {
  if (error instanceof ApiError) {
    const detail = typeof error.detail === "string" ? error.detail : error.message;
    if (error.status === 413) return `Area or period too large: ${detail}`;
    if (error.status === 422) return `Not available for this selection: ${detail}`;
    if (error.status === 503) return `Not available on the server: ${detail}`;
    return `API error ${error.status}: ${detail}`;
  }
  if (error.name === "TypeError" || /fetch/i.test(error.message))
    return "Cannot reach the API. Is it running, and does it allow this origin (CORS)?";
  return error.message;
}

export function ApiUnavailable({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <section className="panel hw-state hw-error" role="alert">
      <Icon name="alert" size={18} />
      <div>
        <strong>Space Monkeys API unavailable</strong>
        <p>{describeError(error)}</p>
        <p>
          Start the API (<code>uvicorn app.main:app --port 8000</code>) and check that{" "}
          <code>VITE_API_BASE_URL</code> points to it.
        </p>
        <button className="hw-button" onClick={onRetry}>
          Retry
        </button>
      </div>
    </section>
  );
}
