// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Territory: is fire activity in an area going up or down over the years, and how does one
// period compare with another? Yearly harmonized fire cell-days (optionally only some
// months of each year), the Theil–Sen trend, a period A vs period B comparison and a
// reference area on one axis. The area can be drawn on the map. It shows association,
// never cause.
import { useEffect, useMemo, useState } from "react";
import { historyApi, http } from "../../../app/api";
import { parseArea, readParam, writeParams } from "../../../app/url-state";
import { useApi } from "../../../shared/api/useApi";
import SelectControl from "../../../shared/ui/SelectControl";
import { Icon, PanelTitle } from "../../../shared/ui/ui";
import { areaKey, areaLabel, areaSelector, type AreaChoice } from "../../history/model/area";
import { formatValue, type Meta } from "../../history/model/history-view";
import {
  Card,
  H,
  niceTicks,
  PAD,
  PanelState,
  AreaPicker,
  W,
  type TrendResource,
} from "../../history/components/HistoryParts";
import {
  ALL_MONTHS,
  comparePeriods,
  defaultPeriods,
  driftYear,
  inRange,
  indexSeries,
  intervalRuns,
  isAllYear,
  median,
  MIN_SEGMENT_YEARS,
  MONTHS,
  monthsLabel,
  overlaps,
  parseRange,
  rangeLabel,
  summarize,
  theilSen,
  toCsv,
  windowTotals,
  type Comparison,
  type MonthBucket,
  type MonthRange,
  type YearPoint,
  type YearRange,
} from "../model/territory";
import TerritoryMap from "./TerritoryMap";

import "../styles/territory.css";

const NONE = "__none";
const BRAZIL = "__brazil";

function referenceArea(key: string): AreaChoice | null {
  if (key === NONE) return null;
  if (key === BRAZIL) return { kind: "country", country: "BR" };
  const parsed = parseArea(key);
  return parsed?.kind === "biome" ? parsed : null;
}

function points(trend: TrendResource): YearPoint[] {
  return (
    trend.data?.data.annual
      .filter((a) => a.complete)
      .map((a) => ({
        year: a.year,
        value: a.value,
        low: a.interval?.low,
        high: a.interval?.high,
      })) ?? []
  );
}

function parseMonths(text: string | null): MonthRange {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(text ?? "");
  const from = Number(m?.[1]);
  const to = Number(m?.[2]);
  return from >= 1 && from <= 12 && to >= 1 && to <= 12 ? { from, to } : ALL_MONTHS;
}

const signed = (value: number, digits = 0) =>
  `${value < 0 ? "−" : "+"}${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })}`;

/** Monthly buckets for one area over the record, only when a month window is chosen. */
function useWindowBuckets(area: AreaChoice | null, from: number | null, to: number | null) {
  const cal = useApi(
    area && from !== null && to !== null
      ? (signal) =>
          historyApi.getCalendar(
            {
              ...areaSelector(area),
              // One year earlier so a window that wraps the new year has its first months.
              start: `${from - 1}-01-01`,
              end: `${to}-12-31`,
              granularity: "month",
            },
            { signal },
          )
      : null,
    [area ? areaKey(area) : NONE, from, to],
  );
  const buckets: MonthBucket[] | null =
    cal.data?.buckets.map((b) => ({ start: b.start, value: b.harmonized?.value ?? null })) ?? null;
  return { cal, buckets };
}

export default function TerritoryPage({
  meta,
  area,
  onAreaChange,
}: {
  meta: Meta;
  area: AreaChoice;
  onAreaChange: (area: AreaChoice) => void;
}) {
  const [pickedA, setPickedA] = useState<YearRange | null>(() => parseRange(readParam("a")));
  const [pickedB, setPickedB] = useState<YearRange | null>(() => parseRange(readParam("b")));
  const [months, setMonths] = useState<MonthRange>(() => parseMonths(readParam("months")));
  const [referenceKey, setReferenceKey] = useState(() => {
    const key = readParam("ref");
    // No reference by default, so the chart opens in fire cell-days with the trend line.
    return key !== null && (key === NONE || referenceArea(key)) ? key : NONE;
  });
  const [copied, setCopied] = useState(false);

  const key = areaKey(area);
  const reference = referenceArea(referenceKey);
  // A territory is never its own reference.
  const refArea = reference && areaKey(reference) !== key ? reference : null;

  const territory = useApi(
    (signal) => historyApi.getTrend({ ...areaSelector(area), series: "harmonized" }, { signal }),
    [key],
  );
  const refTrend = useApi(
    refArea
      ? (signal) =>
          historyApi.getTrend({ ...areaSelector(refArea), series: "harmonized" }, { signal })
      : null,
    [refArea ? areaKey(refArea) : NONE],
  );

  // Complete years of the whole-year series decide which years exist at all.
  const whole = useMemo(() => points(territory), [territory]);
  const refWhole = useMemo(() => (refArea ? points(refTrend) : []), [refTrend, refArea]);
  const years = useMemo(() => whole.map((p) => p.year), [whole]);
  const first = years[0] ?? null;
  const last = years.at(-1) ?? null;

  const windowed = !isAllYear(months);
  const ownCal = useWindowBuckets(windowed ? area : null, first, last);
  const refCal = useWindowBuckets(windowed ? refArea : null, first, last);
  const own = useMemo(
    () =>
      windowed
        ? ownCal.buckets
          ? windowTotals(ownCal.buckets, months, new Set(years))
          : []
        : whole,
    [windowed, ownCal.buckets, months, years, whole],
  );
  const ref = useMemo(() => {
    if (!refArea) return [];
    if (!windowed) return refWhole;
    return refCal.buckets
      ? windowTotals(refCal.buckets, months, new Set(refWhole.map((p) => p.year)))
      : [];
  }, [refArea, windowed, refWhole, refCal.buckets, months]);
  const loading = territory.status !== "success" || (windowed && ownCal.cal.status === "loading");
  const seriesError = territory.error ?? (windowed ? ownCal.cal.error : null) ?? undefined;

  // A chosen period that falls outside this area's years gives way to the default split.
  const fits = (r: YearRange | null): r is YearRange =>
    r !== null && first !== null && last !== null && r.from >= first && r.to <= last;
  // The default split stops before the MODIS drift years, which may read 8–15% high; the
  // user can still pick them.
  const drift = driftYear(meta.harmonization.switch_date);
  const preDrift = drift === null ? years : years.filter((y) => y < drift);
  const defaults = defaultPeriods(preDrift) ?? defaultPeriods(years);
  const periodA = fits(pickedA) ? pickedA : (defaults?.a ?? null);
  const periodB = fits(pickedB) ? pickedB : (defaults?.b ?? null);
  const periods = periodA && periodB ? { a: periodA, b: periodB } : null;

  useEffect(() => {
    writeParams({
      ref: referenceKey === NONE ? null : referenceKey,
      a: pickedA ? `${pickedA.from}-${pickedA.to}` : null,
      b: pickedB ? `${pickedB.from}-${pickedB.to}` : null,
      months: windowed ? `${months.from}-${months.to}` : null,
      decision: null,
      label: null,
    });
    return () => writeParams({ ref: null, a: null, b: null, months: null });
  }, [referenceKey, pickedA, pickedB, months, windowed]);

  // With a reference both series share one axis: 100 is the median year of period A (or the
  // median year overall when there are no periods).
  const wantsIndex = refArea !== null && ref.length > 0;
  const baseYears = periodA ? (y: number) => y >= periodA.from && y <= periodA.to : undefined;
  const indexedOwn = wantsIndex ? indexSeries(own, baseYears) : [];
  const indexedRef = wantsIndex ? indexSeries(ref, baseYears) : [];
  // Indexing divides by a median, so it needs fire in the base years of both series.
  const indexed = indexedOwn.length > 0 && indexedRef.length > 0;
  const cannotIndex = wantsIndex && !indexed;
  const shownOwn = indexed ? indexedOwn : own;
  const shownRef = indexed ? indexedRef : [];

  const ownCmp = periods ? comparePeriods(own, periods.a, periods.b) : null;
  const refCmp = periods && indexed ? comparePeriods(ref, periods.a, periods.b) : null;

  const t = territory.data?.data;
  const localTrend = theilSen(own);
  const trendLine = indexed ? null : localTrend;

  const exportCsv = () => {
    const refByYear = new Map(ref.map((p) => [p.year, p.value]));
    const suffix = windowed ? `_${slug(monthsLabel(months))}` : "";
    const csv = toCsv(
      own.map((p) => ({
        year: p.year,
        territory: p.value,
        low: p.low,
        high: p.high,
        reference: refByYear.get(p.year),
      })),
      slug(areaLabel(area)) + suffix,
      indexed && refArea ? slug(areaLabel(refArea)) + suffix : null,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fire-cell-days-${slug(areaLabel(area))}${suffix}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copyCall = async () => {
    const call =
      windowed && first !== null && last !== null
        ? http.url("/history/calendar", {
            ...areaSelector(area),
            start: `${first - 1}-01-01`,
            end: `${last}-12-31`,
            granularity: "month",
          })
        : http.url("/history/trend", { ...areaSelector(area), series: "harmonized" });
    try {
      await navigator.clipboard.writeText(call);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy the API call", call);
    }
  };

  return (
    <div className="history-workspace territory">
      <section className="panel">
        <div className="hw-filters">
          <AreaPicker meta={meta} value={area} onChange={onAreaChange} />
          <div className="hw-field">
            <span>Compare with</span>
            <SelectControl
              label="Reference area"
              icon="globe"
              value={refArea ? referenceKey : NONE}
              onChange={setReferenceKey}
            >
              <option value={NONE}>No reference</option>
              <option value={BRAZIL}>Brazil (all biomes)</option>
              {meta.biomes.map((b) => (
                <option key={b.name} value={b.name}>
                  {`${b.name} biome`}
                </option>
              ))}
            </SelectControl>
          </div>
          <PeriodField
            name="Period A"
            years={years}
            value={periodA}
            onChange={setPickedA}
            tone="a"
          />
          <PeriodField
            name="Period B"
            years={years}
            value={periodB}
            onChange={setPickedB}
            tone="b"
          />
          <div className="hw-field">
            <span>Months of each year</span>
            <div className="tr-range">
              <SelectControl
                label="First month"
                icon="calendar"
                value={String(months.from)}
                onChange={(v) => setMonths({ ...months, from: Number(v) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </SelectControl>
              <span className="tr-dash">to</span>
              <SelectControl
                label="Last month"
                icon="calendar"
                value={String(months.to)}
                onChange={(v) => setMonths({ ...months, to: Number(v) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>
                    {m}
                  </option>
                ))}
              </SelectControl>
            </div>
          </div>
        </div>
        {periods && overlaps(periods.a, periods.b) && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> Periods A and B overlap. Pick periods that do not share
            years to compare them.
          </p>
        )}
        {windowed && months.from > months.to && (
          <p className="hw-note hw-pad">
            <Icon name="info" size={13} /> {monthsLabel(months)} crosses the new year: each window
            counts for the year it ends in.
          </p>
        )}
      </section>

      {own.length > 0 && (
        <Finding
          place={placeName(area)}
          window={windowed ? monthsLabel(months) : null}
          firstYear={own[0]!.year}
          slope={t?.slope_per_year ?? null}
          significant={t?.significant ?? false}
          periods={periods}
          own={ownCmp}
          reference={refCmp}
          refPlace={refArea && placeName(refArea)}
        />
      )}

      <div className="hw-kpis hw-kpis-2">
        <Card
          title={
            periods
              ? `Period B (${rangeLabel(periods.b)}) vs period A (${rangeLabel(periods.a)})`
              : "Period B vs period A"
          }
          state={territory}
        >
          {ownCmp === null || !periods ? (
            <small>
              Pick two periods with at least {MIN_SEGMENT_YEARS} complete years each to compare
              them.
            </small>
          ) : (
            <PeriodSummary
              own={ownCmp}
              ref={refCmp}
              refName={refArea && areaLabel(refArea)}
              drift={drift}
              periods={periods}
            />
          )}
        </Card>
        <Card title={`Trend since ${own[0]?.year ?? "…"}`} state={territory}>
          {windowed
            ? localTrend && (
                <>
                  <strong className="hw-big">
                    {signed(localTrend.slope)}
                    <em> fire cell-days / year</em>
                  </strong>
                  <small>
                    Theil–Sen on {own.length} complete years, {monthsLabel(months)} only. No
                    confidence interval is computed for a month window.
                  </small>
                </>
              )
            : t &&
              (t.significant ? (
                <>
                  <strong className="hw-big">
                    {signed(t.slope_per_year)}
                    <em> fire cell-days / year</em>
                  </strong>
                  <small>
                    Theil–Sen on {own.length} complete years, 95% CI{" "}
                    {signed(noNegativeZero(t.ci95[0]) ?? 0)} to{" "}
                    {signed(noNegativeZero(t.ci95[1]) ?? 0)}.
                  </small>
                </>
              ) : (
                <>
                  <strong className="hw-big">No detectable trend</strong>
                  <small>
                    Theil–Sen slope {signed(t.slope_per_year)} fire cell-days / year on{" "}
                    {own.length} complete years, but the 95% CI ({signed(noNegativeZero(t.ci95[0]) ?? 0)}{" "}
                    to {signed(noNegativeZero(t.ci95[1]) ?? 0)}) includes zero.
                  </small>
                </>
              ))}
        </Card>
      </div>

      <section className="panel hw-trend-panel">
        <PanelTitle
          title={`Yearly fire cell-days · ${areaLabel(area)}${windowed ? ` · ${monthsLabel(months)}` : ""}`}
          subtitle={
            indexed
              ? "Both series are indexed: 100 is the median year " +
                (periodA ? `of period A (${rangeLabel(periodA)}).` : "of the record.")
              : `Harmonized, MODIS-equivalent${windowed ? `, summed over ${monthsLabel(months)} of each year` : ""}. One cell-day is a 0.1° cell with at least one detection on one UTC day.`
          }
        />
        {!loading && own.length > 0 ? (
          <TerritoryChart
            own={shownOwn}
            ref={shownRef}
            indexed={indexed}
            refName={refArea ? areaLabel(refArea) : null}
            periods={periods}
            line={trendLine}
            drift={drift}
          />
        ) : (
          <PanelState error={seriesError} />
        )}
        {territory.data?.fallback && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> The harmonized series is not available on this server;
            the chart shows MODIS observed fire cell-days.
          </p>
        )}
        {cannotIndex && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> This area has no fire cell-days in the median year of
            period A, so it cannot be put on one axis with the reference. The chart shows the
            territory alone.
          </p>
        )}
        {refArea && (refTrend.status === "error" || refCal.cal.status === "error") && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> The reference series could not be loaded, so the chart
            shows the territory alone.
          </p>
        )}
        <div className="tr-actions">
          <button className="hw-button" onClick={exportCsv} disabled={own.length === 0}>
            <Icon name="download" size={13} /> Download yearly totals (CSV)
          </button>
          <button className="hw-button" onClick={copyCall} disabled={own.length === 0}>
            {copied ? "Copied" : "Copy the API call"}
          </button>
        </div>
      </section>

      <TerritoryMap meta={meta} area={area} periods={periods} onAreaChange={onAreaChange} />

      <section className="panel">
        <PanelTitle title="How to read this" />
        <ul className="hw-facts">
          <li>
            This shows association, not cause. Fire also follows drought and heat, and this page has
            no climate data, so a difference between two periods is a lead to investigate, not proof
            of what caused it.
          </li>
          <li>
            The unit is fire cell-days: not burned area, not fire intensity and not a count of
            fires. Only complete calendar years are used, starting in 2003 (Aqua joined Terra in
            mid-2002). With a month window, each year is the sum of those months only.
          </li>
          <li>
            The comparison is the median year of period B against the median year of period A, with
            a Mann–Whitney test on the yearly totals. Years are not independent (dry spells last
            several years), so read the p-value as a guide, not a verdict.
          </li>
          <li>
            From 2022 the MODIS orbits drift, and until the harmonized series switches to the VIIRS
            estimate it still uses observed MODIS for those years (shaded on the chart). Over Brazil
            the methodology finds that MODIS 8–15% above the estimate, so recent years can read high
            and a period reaching them leans toward an increase.
          </li>
          <li>
            Years drawn as hollow dots are partly estimated from VIIRS after MODIS, with a 90% band
            (whole year only). The trend is the figure most sensitive to harmonization errors; the
            method and its test scores are on Data Sources.
          </li>
        </ul>
      </section>
    </div>
  );
}

/** Two year selects (first and last year) for one period. */
function PeriodField({
  name,
  years,
  value,
  onChange,
  tone,
}: {
  name: string;
  years: readonly number[];
  value: YearRange | null;
  onChange: (r: YearRange) => void;
  tone: "a" | "b";
}) {
  const disabled = years.length === 0 || value === null;
  return (
    <div className={`hw-field tr-period ${tone}`}>
      <span>
        <i className={`tr-chip ${tone}`} /> {name}
      </span>
      <div className="tr-range">
        <SelectControl
          label={`${name} first year`}
          icon="calendar"
          value={value ? String(value.from) : ""}
          disabled={disabled}
          onChange={(v) => {
            const from = Number(v);
            onChange({ from, to: value && value.to >= from ? value.to : from });
          }}
        >
          {years.map((y) => (
            <option key={y} value={String(y)}>
              {String(y)}
            </option>
          ))}
        </SelectControl>
        <span className="tr-dash">to</span>
        <SelectControl
          label={`${name} last year`}
          icon="calendar"
          value={value ? String(value.to) : ""}
          disabled={disabled}
          onChange={(v) => {
            const to = Number(v);
            onChange({ from: value && value.from <= to ? value.from : to, to });
          }}
        >
          {years.map((y) => (
            <option key={y} value={String(y)} disabled={value !== null && y < value.from}>
              {String(y)}
            </option>
          ))}
        </SelectControl>
      </div>
    </div>
  );
}

/** 0 − 0 style results can come back as -0, which would print as "-0". */
function noNegativeZero(value: number | undefined): number | null {
  return value === undefined ? null : value + 0;
}

/** Short name of an area for sentences: "Pantanal", "Brazil", "This box". */
function placeName(area: AreaChoice): string {
  if (area.kind === "biome") return area.biome;
  if (area.kind === "country") return "Brazil";
  return "This box";
}

/** The answer, in words, before the numbers that back it. */
function Finding({
  place,
  window,
  firstYear,
  slope,
  significant,
  periods,
  own,
  reference,
  refPlace,
}: {
  place: string;
  window: string | null;
  firstYear: number;
  slope: number | null;
  significant: boolean;
  periods: { a: YearRange; b: YearRange } | null;
  own: Comparison | null;
  reference: Comparison | null;
  refPlace: string | null;
}) {
  const where = window ? `${place}, ${window}` : place;
  const trend =
    slope === null
      ? null
      : !significant
        ? "no detectable trend"
        : slope < 0
          ? "fire is falling"
          : "fire is rising";
  const pct = own?.enough ? own.changePct : null;
  const differs = own?.p !== null && own?.p !== undefined && own.p < 0.05;
  if (!periods || pct === null || pct === undefined)
    return (
      <div className="tr-finding" aria-live="polite">
        <h2>
          {place}: {trend ?? "yearly fire activity"} since {firstYear}.
        </h2>
        <p className="muted">
          {own && own.enough && own.changePct === null
            ? "Period A has no fire in its median year, so a percentage change is undefined."
            : `Pick two periods with at least ${MIN_SEGMENT_YEARS} complete years each, without shared years, to compare them.`}
        </p>
      </div>
    );
  return (
    <div className="tr-finding" aria-live="polite">
      <h2>
        {where}: the median year of {rangeLabel(periods.b)} is {Math.abs(pct).toFixed(0)}%{" "}
        {pct < 0 ? "lower" : "higher"} than in {rangeLabel(periods.a)}.
      </h2>
      <p>
        {differs
          ? "That is more than year-to-year variation explains"
          : "That is within normal year-to-year variation"}
        {reference?.changePct !== null && reference?.changePct !== undefined && refPlace
          ? `; ${refPlace} changed ${signed(reference.changePct)}% between the same periods`
          : ""}
        .
        {trend && !window
          ? ` Over the whole record (${firstYear} on) there is ${trend === "no detectable trend" ? "no detectable trend" : `a significant trend: ${trend}`}.`
          : ""}
      </p>
    </div>
  );
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function PeriodSummary({
  own,
  ref,
  refName,
  drift,
  periods,
}: {
  own: Comparison;
  ref: Comparison | null;
  refName: string | null;
  drift: number | null;
  periods: { a: YearRange; b: YearRange };
}) {
  if (!own.enough)
    return (
      <small>
        {overlaps(periods.a, periods.b)
          ? "The periods overlap."
          : `Each period needs at least ${MIN_SEGMENT_YEARS} complete years.`}
      </small>
    );
  if (own.changePct === null)
    return (
      <small>
        The median year of period A has no fire, so a percentage change is undefined. Medians:{" "}
        {formatValue(own.a.median)} in A, {formatValue(own.b.median)} in B.
      </small>
    );
  const p = own.p;
  const lastYear = Math.max(own.a.lastYear ?? 0, own.b.lastYear ?? 0);
  return (
    <>
      <strong className="hw-big">
        {signed(own.changePct)}%<em> in the median year</em>
      </strong>
      <small>
        Median {formatValue(own.a.median)} over {own.a.n} years in A, {formatValue(own.b.median)}{" "}
        over {own.b.n} years in B{p === null ? "." : ` · Mann–Whitney p = ${p.toFixed(3)}`}
      </small>
      {ref && ref.changePct !== null && refName && (
        <small>
          {refName}: {signed(ref.changePct)}% between the same periods (
          {Math.abs(own.changePct - ref.changePct).toFixed(0)} points{" "}
          {own.changePct - ref.changePct < 0 ? "below" : "above"} it).
        </small>
      )}
      {drift !== null && lastYear >= drift && (
        <small className="tr-warn">
          Includes {drift} onward, when MODIS orbits drift: those years may read 8–15% high.
        </small>
      )}
    </>
  );
}

function TerritoryChart({
  own,
  ref,
  indexed,
  refName,
  periods,
  line,
  drift,
}: {
  own: YearPoint[];
  ref: YearPoint[];
  indexed: boolean;
  refName: string | null;
  periods: { a: YearRange; b: YearRange } | null;
  line: { slope: number; intercept: number } | null;
  drift: number | null;
}) {
  const all = [...own, ...ref];
  const max = Math.max(1, ...all.flatMap((p) => [p.value, p.high ?? 0]));
  const y0 = own[0]!.year;
  const y1 = own.at(-1)!.year;
  const inner = W - PAD.left - PAD.right;
  const x = (year: number) => PAD.left + (y1 === y0 ? 0.5 : (year - y0) / (y1 - y0)) * inner;
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const path = (pts: YearPoint[]) => pts.map((p) => `${x(p.year)},${y(p.value)}`).join(" ");
  const clampX = (v: number) => Math.min(W - PAD.right, Math.max(PAD.left, v));

  const bands = intervalRuns(own);
  const shaded = periods
    ? (["a", "b"] as const).map((k) => {
        const r = periods[k];
        const seg = inRange(own, r);
        return {
          key: k,
          x0: clampX(x(r.from - 0.5)),
          x1: clampX(x(r.to + 0.5)),
          median: seg.length >= MIN_SEGMENT_YEARS ? summarize(seg).median : null,
          r,
        };
      })
    : [];

  return (
    <div className="hw-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Yearly fire cell-days of the territory">
        {niceTicks(max).map((tick) => (
          <g key={tick}>
            <line
              className="hw-gridline"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="hw-axis" x={PAD.left - 6} y={y(tick) + 3} textAnchor="end">
              {indexed ? Math.round(tick) : formatValue(tick)}
            </text>
          </g>
        ))}
        {own.map((p, i) =>
          i % 2 === (own.length - 1) % 2 ? (
            <text
              key={p.year}
              className="hw-axis"
              x={x(p.year)}
              y={H - 6}
              textAnchor={p.year === y1 ? "end" : "middle"}
            >
              {p.year}
            </text>
          ) : null,
        )}
        {shaded.map((s) => (
          <g key={s.key}>
            <rect
              className={`tr-period-band ${s.key}`}
              x={s.x0}
              y={PAD.top}
              width={Math.max(0, s.x1 - s.x0)}
              height={H - PAD.top - PAD.bottom}
            />
            <text className={`tr-period-label ${s.key}`} x={s.x0 + 4} y={PAD.top + 9}>
              {`${s.key.toUpperCase()} · ${rangeLabel(s.r)}`}
            </text>
          </g>
        ))}
        {drift !== null && drift <= y1 && (
          <rect
            className="tr-drift"
            x={x(drift - 0.5)}
            y={PAD.top}
            width={W - PAD.right - x(drift - 0.5)}
            height={H - PAD.top - PAD.bottom}
          />
        )}
        {bands.map((run, i) => (
          <polygon
            key={i}
            className="tr-band"
            points={[
              ...run.map((p) => `${x(p.year)},${y(p.high!)}`),
              ...[...run].reverse().map((p) => `${x(p.year)},${y(p.low!)}`),
            ].join(" ")}
          />
        ))}
        {shaded.map((s) =>
          s.median === null ? null : (
            <line
              key={`m${s.key}`}
              className={`tr-median ${s.key}`}
              x1={s.x0}
              x2={s.x1}
              y1={y(s.median)}
              y2={y(s.median)}
            />
          ),
        )}
        {line && (
          <line
            className="tr-trend"
            x1={x(y0)}
            x2={x(y1)}
            y1={y(Math.max(0, line.slope * y0 + line.intercept))}
            y2={y(Math.max(0, line.slope * y1 + line.intercept))}
          />
        )}
        {ref.length > 0 && <polyline className="hw-line tr-ref" points={path(ref)} />}
        <polyline className="hw-line harm" points={path(own)} />
        {own.map((p) => (
          <circle
            key={p.year}
            className={`tr-dot ${p.low !== undefined ? "estimated" : ""}`}
            cx={x(p.year)}
            cy={y(p.value)}
            r={2.6}
          />
        ))}
        {own.map((p) => (
          <rect
            key={`h${p.year}`}
            className="hw-hit"
            x={x(p.year) - inner / own.length / 2}
            width={inner / own.length}
            y={PAD.top}
            height={H - PAD.top - PAD.bottom}
          >
            <title>
              {`${p.year}: ${indexed ? p.value.toFixed(0) + " (index)" : formatValue(p.value) + " fire cell-days"}` +
                (p.low !== undefined
                  ? `, 90% interval ${formatValue(p.low)}–${formatValue(p.high ?? null)}, partly estimated from VIIRS`
                  : "") +
                (ref.length
                  ? `; reference ${ref.find((r) => r.year === p.year)?.value.toFixed(0) ?? "no data"}`
                  : "")}
            </title>
          </rect>
        ))}
      </svg>
      <div className="hw-legend">
        <i className="hw-swatch line harm" /> <span>Territory (harmonized)</span>
        {refName && ref.length > 0 && (
          <>
            <i className="hw-swatch line tr-ref" /> <span>{refName}</span>
          </>
        )}
        {line && (
          <>
            <i className="hw-swatch line tr-trend" /> <span>Theil–Sen trend</span>
          </>
        )}
        {shaded.some((s) => s.median !== null) && (
          <>
            <i className="hw-swatch line tr-median a" />{" "}
            <i className="hw-swatch line tr-median b" /> <span>Median year of period A and B</span>
          </>
        )}
        {drift !== null && drift <= y1 && (
          <>
            <i className="hw-swatch tr-drift-swatch" />{" "}
            <span>From {drift}: MODIS orbit drift, may read high</span>
          </>
        )}
        {own.some((p) => p.low !== undefined) && (
          <span className="tr-hollow">○ partly estimated from VIIRS</span>
        )}
      </div>
      {median(own.map((p) => p.value)) === 0 && (
        <p className="hw-note warn">This area has no fire cell-days in the complete years.</p>
      )}
    </div>
  );
}
