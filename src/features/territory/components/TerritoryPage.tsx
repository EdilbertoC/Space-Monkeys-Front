// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Territory: is fire activity in an area going up or down over the years, and how does one
// period compare with another? The answer comes first (one word, one sentence, three
// numbers), next to a map of where it changed; below, yearly harmonized fire cell-days
// (optionally only some months of each year) with the Theil–Sen trend and the two periods,
// whose edges can be dragged. It shows association, never cause.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { historyApi, http } from "../../../app/api";
import { parseArea, readParam, writeParams } from "../../../app/url-state";
import { useApi } from "../../../shared/api/useApi";
import SelectControl from "../../../shared/ui/SelectControl";
import { Icon } from "../../../shared/ui/ui";
import { areaKey, areaLabel, areaSelector, type AreaChoice } from "../../history/model/area";
import { formatValue, type Meta } from "../../history/model/history-view";
import {
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
import { Skeleton, useSettled } from "./loading";
import SeasonPicker from "./SeasonPicker";
import TerritoryMap from "./TerritoryMap";

import "../styles/territory.css";

const NONE = "__none";
const BRAZIL = "__brazil";

type Periods = { a: YearRange; b: YearRange };
type Edge = { period: "a" | "b"; side: "from" | "to" };

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
  const [drawing, setDrawing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
  const periods: Periods | null = periodA && periodB ? { a: periodA, b: periodB } : null;
  // The map asks the API for cells; while an edge is being dragged it waits for the drag to
  // settle instead of requesting every year it passes.
  const mapPeriods = useSettled(
    periods,
    periods ? `${periods.a.from}-${periods.a.to}|${periods.b.from}-${periods.b.to}` : "none",
  );

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

  // Dragging an edge on the chart moves one end of one period, keeping from ≤ to.
  const moveEdge = ({ period, side }: Edge, year: number) => {
    if (!periods || first === null || last === null) return;
    const r = periods[period];
    const y = Math.min(last, Math.max(first, year));
    const next =
      side === "from"
        ? { from: Math.min(y, r.to), to: r.to }
        : { from: r.from, to: Math.max(y, r.from) };
    if (next.from === r.from && next.to === r.to) return;
    (period === "a" ? setPickedA : setPickedB)(next);
  };

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

  const openHelp = () => {
    setHelpOpen(true);
    requestAnimationFrame(() =>
      document.getElementById("tr-help")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <div className="history-workspace territory">
      <section className="panel tr-toolbar">
        <AreaPicker meta={meta} value={area} onChange={onAreaChange} />
        <button
          className={`tr-tool ${drawing ? "active" : ""}`}
          aria-pressed={drawing}
          onClick={() => setDrawing(!drawing)}
        >
          <DrawIcon /> {drawing ? "Cancel drawing" : "Draw on map"}
        </button>
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
        <SeasonPicker value={months} onChange={setMonths} firstYear={first} lastYear={last} />
        <div className="tr-toolbar-end">
          <button className="tr-tool quiet" onClick={exportCsv} disabled={own.length === 0}>
            <Icon name="download" size={15} /> CSV
          </button>
          <button className="tr-tool quiet" onClick={copyCall} disabled={own.length === 0}>
            {copied ? "Copied" : "API call"}
          </button>
        </div>
      </section>

      <div className="tr-hero">
        <Verdict
          place={placeName(area)}
          window={windowed ? monthsLabel(months) : null}
          loading={loading}
          error={seriesError}
          firstYear={own[0]?.year ?? null}
          slope={windowed ? (localTrend?.slope ?? null) : (t?.slope_per_year ?? null)}
          significant={windowed ? null : (t?.significant ?? false)}
          periods={periods}
          own={ownCmp}
          reference={refCmp}
          refPlace={refArea && placeName(refArea)}
          drift={drift}
          onHelp={openHelp}
        />
        <TerritoryMap
          meta={meta}
          area={area}
          periods={mapPeriods}
          months={months}
          drawing={drawing}
          onDrawingChange={setDrawing}
          onAreaChange={onAreaChange}
        />
      </div>

      <section className="panel tr-chart-panel">
        <div className="tr-chart-head">
          <h2>
            {indexed
              ? `Index, 100 = typical year of period A`
              : windowed
                ? `Fire cell-days in ${monthsLabel(months)} of each year`
                : "Fire cell-days per year"}
          </h2>
          <div className="tr-periods">
            <span className="tr-periods-label">Years</span>
            <PeriodField name="A" years={years} value={periodA} onChange={setPickedA} tone="a" />
            <PeriodField name="B" years={years} value={periodB} onChange={setPickedB} tone="b" />
            {periods && (
              <span className="tr-hint">
                {windowed
                  ? `Each year counts ${monthsLabel(months)} only · drag the edges to change years`
                  : "Whole years · drag the edges on the chart"}
              </span>
            )}
          </div>
        </div>
        {periods && overlaps(periods.a, periods.b) && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> A and B share years. Move them apart to compare.
          </p>
        )}
        {!loading && own.length > 0 ? (
          <TerritoryChart
            animKey={`${key}|${windowed ? monthsLabel(months) : "all"}|${indexed}`}
            own={shownOwn}
            ref={shownRef}
            indexed={indexed}
            name={placeName(area)}
            refName={refArea ? areaLabel(refArea) : null}
            periods={periods}
            line={trendLine}
            drift={drift}
            onEdge={moveEdge}
          />
        ) : seriesError ? (
          <PanelState error={seriesError} />
        ) : (
          <div className="tr-chart-skel" role="status" aria-label="Loading the yearly series">
            <Skeleton height="100%" radius={8} />
          </div>
        )}
        {territory.data?.fallback && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> Harmonized series unavailable here: showing observed
            MODIS.
          </p>
        )}
        {cannotIndex && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> No fire in the typical year of A, so the reference cannot
            share the axis. Showing this area alone.
          </p>
        )}
        {refArea && (refTrend.status === "error" || refCal.cal.status === "error") && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> The reference could not be loaded.
          </p>
        )}
      </section>

      <section className="panel tr-help" id="tr-help">
        <button
          className="tr-help-toggle"
          aria-expanded={helpOpen}
          aria-controls="tr-help-list"
          onClick={() => setHelpOpen(!helpOpen)}
        >
          <span>How to read this</span>
          <span className="tr-help-hint">
            {helpOpen ? "Hide" : "4 notes"}
            <Icon name="chevron" size={14} className={helpOpen ? "tr-flip" : ""} />
          </span>
        </button>
        {helpOpen && (
          <ul className="tr-help-list" id="tr-help-list">
            <li>Association, not cause. This page has no drought or heat data.</li>
            <li>
              A fire cell-day is one 0.1° cell with fire on one UTC day. Not burned area, not a
              count of fires. Complete years only, from 2003.
            </li>
            <li>
              Hatched years may read 8–15% high: MODIS orbits drift. Evidence is a Mann–Whitney test
              on yearly totals; dry spells last years, so treat it as a guide.
            </li>
            <li>
              Hollow dots are partly estimated from VIIRS. The method and its test scores are on
              About the data.
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}

function DrawIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="tr-svg-icon">
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
    </svg>
  );
}

/** Two year selects (first and last year) for one period, shown as a chip. */
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
    <div className={`tr-period ${tone}`} role="group" aria-label={`Period ${name}`}>
      <span className="tr-period-name">{name}</span>
      <select
        aria-label={`Period ${name} first year`}
        value={value ? String(value.from) : ""}
        disabled={disabled}
        onChange={(e) => {
          const from = Number(e.target.value);
          onChange({ from, to: value && value.to >= from ? value.to : from });
        }}
      >
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {String(y)}
          </option>
        ))}
      </select>
      <span aria-hidden="true">–</span>
      <select
        aria-label={`Period ${name} last year`}
        value={value ? String(value.to) : ""}
        disabled={disabled}
        onChange={(e) => {
          const to = Number(e.target.value);
          onChange({ from: value && value.from <= to ? value.from : to, to });
        }}
      >
        {years.map((y) => (
          <option key={y} value={String(y)} disabled={value !== null && y < value.from}>
            {String(y)}
          </option>
        ))}
      </select>
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

type Direction = "falling" | "rising" | "flat";

function evidenceOf(p: number | null): string {
  if (p === null) return "—";
  return p < 0.01 ? "Strong" : p < 0.05 ? "Moderate" : "Weak";
}

/** The answer first: one word, one sentence, three numbers. */
function Verdict({
  place,
  window,
  loading,
  error,
  firstYear,
  slope,
  significant,
  periods,
  own,
  reference,
  refPlace,
  drift,
  onHelp,
}: {
  place: string;
  window: string | null;
  loading: boolean;
  error?: Error;
  firstYear: number | null;
  slope: number | null;
  /** null when no test is run (a month window). */
  significant: boolean | null;
  periods: Periods | null;
  own: Comparison | null;
  reference: Comparison | null;
  refPlace: string | null;
  drift: number | null;
  onHelp: () => void;
}) {
  const context = `${place} · ${window ? `${window} of each year` : "whole year"} · harmonized record`;
  if (error)
    return (
      <section className="panel tr-verdict" aria-live="polite">
        <span className="tr-context">{context}</span>
        <PanelState error={error} />
      </section>
    );
  if (loading || firstYear === null)
    return (
      <section className="panel tr-verdict" aria-busy="true" aria-label="Loading the answer">
        <span className="tr-context">{context}</span>
        <div className="tr-word">
          <Skeleton width={60} height={60} radius={30} />
          <Skeleton width="55%" height={40} radius={8} />
        </div>
        <div className="tr-skel-lines">
          <Skeleton width="92%" height={16} />
          <Skeleton width="70%" height={16} />
        </div>
        <div className="tr-stats">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton width="60%" height={11} />
              <Skeleton width="70%" height={22} />
              <Skeleton width="50%" height={11} />
            </div>
          ))}
        </div>
      </section>
    );
  // With a month window the comparison is between seasons, so the sentence names it.
  const typical = window ? `typical ${window}` : "typical year";

  const pct = own?.enough ? own.changePct : null;
  const p = own?.enough ? own.p : null;
  const compared = periods !== null && pct !== null && pct !== undefined;
  // The word follows the period comparison when there is one, else the long-term trend.
  let direction: Direction;
  if (compared) direction = p !== null && p < 0.05 ? (pct! < 0 ? "falling" : "rising") : "flat";
  else if (slope !== null && significant) direction = slope < 0 ? "falling" : "rising";
  else direction = "flat";
  const word =
    direction === "falling" ? "Falling" : direction === "rising" ? "Rising" : "No clear change";

  let sentence: string;
  if (compared) {
    const a = rangeLabel(periods!.a);
    const b = rangeLabel(periods!.b);
    sentence =
      direction === "flat"
        ? `${b} and ${a} differ by ${Math.abs(pct!).toFixed(0)}% in the ${typical}, within normal year-to-year swings.`
        : `The ${typical} in ${b} had ${Math.abs(pct!).toFixed(0)}% ${pct! < 0 ? "fewer" : "more"} fire cell-days than in ${a}. That is more than normal year-to-year swings.`;
  } else if (own?.enough && own.changePct === null) {
    sentence = "Period A has no fire in its typical year, so a change in % cannot be computed.";
  } else {
    sentence = `Pick two periods of at least ${MIN_SEGMENT_YEARS} complete years each, without shared years, to compare them.`;
  }

  const lastYear = own?.enough ? Math.max(own.a.lastYear ?? 0, own.b.lastYear ?? 0) : 0;
  return (
    <section className={`panel tr-verdict ${direction}`} aria-live="polite">
      <span className="tr-context">{context}</span>
      <div className="tr-word tr-pop" key={direction}>
        <span className="tr-badge" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" className="tr-svg-icon thick">
            {direction === "falling" && <path d="M12 4v16M5 13l7 7 7-7" />}
            {direction === "rising" && <path d="M12 20V4M5 11l7-7 7 7" />}
            {direction === "flat" && <path d="M4 12h16" />}
          </svg>
        </span>
        <h2>{word}</h2>
      </div>
      <p className="tr-sentence tr-fade-in" key={sentence}>
        {sentence}
      </p>

      <dl className="tr-stats">
        <div>
          <dt>B vs A</dt>
          <dd className="tr-fade-in" key={compared ? pct : "none"}>
            {compared ? `${signed(pct!)}%` : "—"}
          </dd>
          <small>{typical}</small>
        </div>
        <div>
          <dt>Trend since {firstYear}</dt>
          <dd>
            {slope === null
              ? "—"
              : signed(noNegativeZero(slope) ?? 0, Math.abs(slope) < 10 ? 1 : 0)}
          </dd>
          <small>
            per year
            {significant === null ? ", not tested" : significant ? "" : ", not significant"}
          </small>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd className="tr-fade-in" key={p ?? "none"}>
            {evidenceOf(p ?? null)}
          </dd>
          <small>{p === null || p === undefined ? "no test" : `p = ${p.toFixed(3)}`}</small>
        </div>
      </dl>

      {reference?.changePct !== null && reference?.changePct !== undefined && refPlace && (
        <p className="tr-aside">
          {refPlace}: {signed(reference.changePct)}% between the same periods.
        </p>
      )}
      {drift !== null && lastYear >= drift && (
        <p className="tr-aside tr-warn">Includes {drift} on, which may read 8–15% high.</p>
      )}
      <p className="tr-caveat">
        <Icon name="info" size={14} /> Association, not cause.{" "}
        <button className="tr-link" onClick={onHelp}>
          How to read this
        </button>
      </p>
    </section>
  );
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function TerritoryChart({
  animKey,
  own,
  ref,
  indexed,
  name,
  refName,
  periods,
  line,
  drift,
  onEdge,
}: {
  /** The line draws in again only when this changes (area, months), not on every drag. */
  animKey: string;
  own: YearPoint[];
  ref: YearPoint[];
  indexed: boolean;
  name: string;
  refName: string | null;
  periods: Periods | null;
  line: { slope: number; intercept: number } | null;
  drift: number | null;
  onEdge: (edge: Edge, year: number) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Edge | null>(null);
  const all = [...own, ...ref];
  const max = Math.max(1, ...all.flatMap((p) => [p.value, p.high ?? 0]));
  const y0 = own[0]!.year;
  const y1 = own.at(-1)!.year;
  const inner = W - PAD.left - PAD.right;
  const x = (year: number) => PAD.left + (y1 === y0 ? 0.5 : (year - y0) / (y1 - y0)) * inner;
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const path = (pts: YearPoint[]) => pts.map((p) => `${x(p.year)},${y(p.value)}`).join(" ");
  const clampX = (v: number) => Math.min(W - PAD.right, Math.max(PAD.left, v));

  /** Year under a screen x, for the edge being dragged (edges sit half a year out). */
  const yearAt = (clientX: number, side: Edge["side"]) => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box || y1 === y0) return y0;
    const vx = ((clientX - box.left) / box.width) * W;
    const raw = y0 + ((vx - PAD.left) / inner) * (y1 - y0);
    return Math.round(side === "from" ? raw + 0.5 : raw - 0.5);
  };

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
  const handles = shaded.flatMap((s) => [
    { edge: { period: s.key, side: "from" } as Edge, at: s.x0, year: s.r.from },
    { edge: { period: s.key, side: "to" } as Edge, at: s.x1, year: s.r.to },
  ]);
  const showDrift = drift !== null && drift <= y1;

  const onKey = (edge: Edge, year: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    onEdge(edge, year + (e.key === "ArrowLeft" ? -1 : 1));
  };
  const onDown = (edge: Edge) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(edge);
  };
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (dragging) onEdge(dragging, yearAt(e.clientX, dragging.side));
  };

  return (
    <div className="hw-chart">
      <div className="tr-chart-wrap" ref={wrap}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Yearly fire cell-days in ${name}`}>
          <defs>
            <pattern
              id="tr-drift-hatch"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect className="tr-hatch" width="2.2" height="6" />
            </pattern>
          </defs>
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
              <text className={`tr-period-label ${s.key}`} x={s.x0 + 6} y={PAD.top + 10}>
                {s.key.toUpperCase()}
              </text>
            </g>
          ))}
          {showDrift && (
            <g>
              <rect
                className="tr-drift"
                x={x(drift - 0.5)}
                y={PAD.top}
                width={W - PAD.right - x(drift - 0.5)}
                height={H - PAD.top - PAD.bottom}
                fill="url(#tr-drift-hatch)"
              >
                <title>{`From ${drift}: MODIS orbits drift, so these years may read 8–15% high`}</title>
              </rect>
              <text
                className="tr-drift-label"
                x={W - PAD.right - 4}
                y={PAD.top + 10}
                textAnchor="end"
              >
                May read high
              </text>
            </g>
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
          {ref.length > 0 && (
            <polyline
              key={`r${animKey}`}
              className="hw-line tr-ref tr-draw"
              pathLength={1}
              points={path(ref)}
            />
          )}
          <polyline
            key={`o${animKey}`}
            className="hw-line harm tr-draw"
            pathLength={1}
            points={path(own)}
          />
          {own.map((p, i) => (
            <circle
              key={`${animKey}${p.year}`}
              style={{ animationDelay: `${300 + i * 25}ms` }}
              className={`tr-dot tr-dot-in ${p.low !== undefined ? "estimated" : ""}`}
              cx={x(p.year)}
              cy={y(p.value)}
              r={3}
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
        {handles.map((h) => (
          <button
            key={`${h.edge.period}${h.edge.side}`}
            className={`tr-handle ${h.edge.period} ${h.edge.side} ${dragging?.period === h.edge.period && dragging.side === h.edge.side ? "dragging" : ""}`}
            style={{
              left: `${(h.at / W) * 100}%`,
              top: `${(PAD.top / H) * 100}%`,
              height: `${((H - PAD.top - PAD.bottom) / H) * 100}%`,
            }}
            aria-label={`Period ${h.edge.period.toUpperCase()} ${h.edge.side === "from" ? "first" : "last"} year, ${h.year}. Use the arrow keys to move it.`}
            onKeyDown={onKey(h.edge, h.year)}
            onPointerDown={onDown(h.edge)}
            onPointerMove={onMove}
            onPointerUp={() => setDragging(null)}
            onPointerCancel={() => setDragging(null)}
          >
            <i />
            <span className="tr-handle-year" aria-hidden="true">
              {h.year}
            </span>
          </button>
        ))}
      </div>
      <div className="hw-legend tr-legend">
        <span>
          <i className="hw-swatch line harm" /> {name}
        </span>
        {refName && ref.length > 0 && (
          <span>
            <i className="hw-swatch line tr-ref" /> {refName}
          </span>
        )}
        {line && (
          <span>
            <i className="hw-swatch line tr-trend" /> Long-term trend
          </span>
        )}
        {shaded.some((s) => s.median !== null) && (
          <span>
            <i className="hw-swatch line tr-median-key" /> Typical year of A and B
          </span>
        )}
        {own.some((p) => p.low !== undefined) && (
          <span className="tr-hollow">○ Partly estimated</span>
        )}
      </div>
      {median(own.map((p) => p.value)) === 0 && (
        <p className="hw-note warn">This area has no fire cell-days in the complete years.</p>
      )}
    </div>
  );
}
