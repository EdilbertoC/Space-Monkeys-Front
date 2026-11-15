// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Territory: is fire activity in an area going up or down over the years, and did it change
// after a decision? Yearly harmonized fire cell-days, the Theil–Sen trend, a before/after
// comparison and a reference area on one axis. It shows association, never cause.
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
  compareAt,
  decisionYears,
  driftYear,
  indexSeries,
  intervalRuns,
  median,
  splitAt,
  summarize,
  theilSen,
  toCsv,
  type Comparison,
  type YearPoint,
} from "../model/territory";

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

const signed = (value: number, digits = 0) =>
  `${value < 0 ? "−" : "+"}${Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
  })}`;

export default function TerritoryPage({
  meta,
  area,
  onAreaChange,
}: {
  meta: Meta;
  area: AreaChoice;
  onAreaChange: (area: AreaChoice) => void;
}) {
  const [decision, setDecision] = useState<number | null>(() => {
    const year = Number(readParam("decision"));
    return Number.isInteger(year) && year > 2000 ? year : null;
  });
  const [decisionLabel, setDecisionLabel] = useState(() => readParam("label")?.slice(0, 40) ?? "");
  const [referenceKey, setReferenceKey] = useState(() => {
    const key = readParam("ref");
    return key !== null && (key === NONE || referenceArea(key)) ? key : BRAZIL;
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    writeParams({
      ref: referenceKey === BRAZIL ? null : referenceKey,
      decision: decision === null ? null : String(decision),
      label: decisionLabel.trim() || null,
    });
    return () => writeParams({ ref: null, decision: null, label: null });
  }, [referenceKey, decision, decisionLabel]);

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

  const own = useMemo(() => points(territory), [territory]);
  const ref = useMemo(() => (refArea ? points(refTrend) : []), [refTrend, refArea]);
  const years = useMemo(() => decisionYears(own), [own]);
  // A decision year that no longer leaves three years per side (area changed) is dropped.
  const effective = decision !== null && years.includes(decision) ? decision : null;

  // With a reference both series share one axis: 100 is the median year before the
  // decision (or the median year overall when no decision is set).
  const wantsIndex = refArea !== null && ref.length > 0;
  const baseYears = effective !== null ? (y: number) => y < effective : undefined;
  const indexedOwn = wantsIndex ? indexSeries(own, baseYears) : [];
  const indexedRef = wantsIndex ? indexSeries(ref, baseYears) : [];
  // Indexing divides by a median, so it needs fire in the base years of both series.
  const indexed = indexedOwn.length > 0 && indexedRef.length > 0;
  const cannotIndex = wantsIndex && !indexed;
  const shownOwn = indexed ? indexedOwn : own;
  const shownRef = indexed ? indexedRef : [];

  const ownCmp = effective !== null ? compareAt(own, effective) : null;
  const refCmp = effective !== null && indexed ? compareAt(ref, effective) : null;

  const t = territory.data?.data;
  const drift = driftYear(meta.harmonization.switch_date);
  const trendLine = indexed ? null : theilSen(own);

  const exportCsv = () => {
    const refByYear = new Map(ref.map((p) => [p.year, p.value]));
    const csv = toCsv(
      own.map((p) => ({
        year: p.year,
        territory: p.value,
        low: p.low,
        high: p.high,
        reference: refByYear.get(p.year),
      })),
      slug(areaLabel(area)),
      indexed && refArea ? slug(areaLabel(refArea)) : null,
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fire-cell-days-${slug(areaLabel(area))}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copyCall = async () => {
    const call = http.url("/history/trend", { ...areaSelector(area), series: "harmonized" });
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
          <div className="hw-field">
            <span>Decision took effect in</span>
            <SelectControl
              label="Decision year"
              icon="calendar"
              value={effective === null ? NONE : String(effective)}
              onChange={(v) => setDecision(v === NONE ? null : Number(v))}
              disabled={years.length === 0}
            >
              <option value={NONE}>No decision marked</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  {String(y)}
                </option>
              ))}
            </SelectControl>
          </div>
          <label className="hw-field tr-label">
            <span>Decision label (optional)</span>
            <input
              type="text"
              value={decisionLabel}
              maxLength={40}
              placeholder="e.g. new fire-control plan"
              onChange={(e) => setDecisionLabel(e.target.value)}
            />
          </label>
        </div>
      </section>

      <div className="hw-kpis hw-kpis-2">
        <Card title={`Trend since ${own[0]?.year ?? "…"}`} state={territory}>
          {t && (
            <>
              <strong className="hw-big">
                {signed(t.slope_per_year)}
                <em> fire cell-days / year</em>
              </strong>
              <small>{trendSentence(t.slope_per_year, t.ci95, t.significant)}</small>
              <small>
                Theil–Sen on {own.length} complete years, 95% CI{" "}
                {formatValue(noNegativeZero(t.ci95[0]))} to {formatValue(noNegativeZero(t.ci95[1]))}
                .
              </small>
            </>
          )}
        </Card>
        <Card
          title={
            effective === null ? "Before and after a decision" : `Before and after ${effective}`
          }
          state={territory}
        >
          {ownCmp === null ? (
            <small>
              Choose the year a decision took effect to compare the years before and after it.
            </small>
          ) : (
            <BeforeAfterSummary
              own={ownCmp}
              ref={refCmp}
              refName={refArea && areaLabel(refArea)}
              drift={drift}
            />
          )}
        </Card>
      </div>

      <section className="panel hw-trend-panel">
        <PanelTitle
          title={`Yearly fire cell-days · ${areaLabel(area)}`}
          subtitle={
            indexed
              ? "Both series are indexed: 100 is the median year " +
                (effective === null ? "of the record." : `before ${effective}.`)
              : "Harmonized, MODIS-equivalent. One cell-day is a 0.1° cell with at least one detection on one UTC day."
          }
        />
        {territory.status === "success" && own.length > 0 ? (
          <TerritoryChart
            own={shownOwn}
            ref={shownRef}
            indexed={indexed}
            refName={refArea ? areaLabel(refArea) : null}
            decision={effective}
            decisionLabel={decisionLabel.trim()}
            line={trendLine}
            drift={drift}
          />
        ) : (
          <PanelState error={territory.error ?? undefined} />
        )}
        {territory.data?.fallback && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> The harmonized series is not available on this server;
            the chart shows MODIS observed fire cell-days.
          </p>
        )}
        {cannotIndex && (
          <p className="hw-note warn hw-pad">
            <Icon name="info" size={13} /> This area has no fire cell-days in the median year of the
            base period, so it cannot be put on one axis with the reference. The chart shows the
            territory alone.
          </p>
        )}
        {refArea && refTrend.status === "error" && (
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

      <section className="panel">
        <PanelTitle title="How to read this" />
        <ul className="hw-facts">
          <li>
            This shows association, not cause. Fire also follows drought and heat, and this page has
            no climate data, so a drop after a decision is a lead to investigate, not proof the
            decision worked.
          </li>
          <li>
            The unit is fire cell-days: not burned area, not fire intensity and not a count of
            fires. Only complete calendar years are used, starting in 2003 (Aqua joined Terra in
            mid-2002).
          </li>
          <li>
            The before/after p-value is a Mann–Whitney test on yearly totals. Years are not
            independent (dry spells last several years), so read it as a guide, not a verdict.
          </li>
          <li>
            From 2022 the MODIS orbits drift, and until the harmonized series switches to the VIIRS
            estimate it still uses observed MODIS for those years (shaded on the chart). Over Brazil
            the methodology finds that MODIS 8–15% above the estimate, so recent years can read high
            and a before/after comparison reaching them leans toward an increase.
          </li>
          <li>
            Years drawn as hollow dots are partly estimated from VIIRS after MODIS, with a 90% band.
            The trend is the figure most sensitive to harmonization errors; the method and its test
            scores are on Data Sources.
          </li>
        </ul>
      </section>
    </div>
  );
}

/** 0 − 0 style results can come back as -0, which would print as "-0". */
function noNegativeZero(value: number | undefined): number | null {
  return value === undefined ? null : value + 0;
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function trendSentence(slope: number, ci: number[], significant: boolean): string {
  if (!significant)
    return "No detectable trend: the 95% interval includes zero, so the data cannot say whether fire is rising or falling.";
  const lo = ci[0] ?? NaN;
  const hi = ci[1] ?? NaN;
  return `Fire activity ${slope < 0 ? "fell" : "rose"} over the years (95% interval ${formatValue(lo)} to ${formatValue(hi)} per year, excluding zero).`;
}

function BeforeAfterSummary({
  own,
  ref,
  refName,
  drift,
}: {
  own: Comparison;
  ref: Comparison | null;
  refName: string | null;
  drift: number | null;
}) {
  if (!own.enough) return <small>Not enough complete years on each side to compare.</small>;
  if (own.changePct === null)
    return (
      <small>
        The median year before the decision has no fire, so a percentage change is undefined.
        Medians: {formatValue(own.before.median)} before, {formatValue(own.after.median)} after.
      </small>
    );
  const p = own.p;
  const differs = p !== null && p < 0.05;
  return (
    <>
      <strong className="hw-big">
        {signed(own.changePct)}%<em> in the median year</em>
      </strong>
      <small>
        {formatValue(own.before.median)} before ({own.before.n} years) →{" "}
        {formatValue(own.after.median)} after ({own.after.n} years).
      </small>
      <small>
        {p === null
          ? ""
          : differs
            ? `The two periods differ more than year-to-year variation explains (p = ${p.toFixed(3)}).`
            : `Within what year-to-year variation produces (p = ${p.toFixed(3)}).`}
      </small>
      {ref && ref.changePct !== null && refName && (
        <small>
          {refName} changed {signed(ref.changePct)}% over the same split, so the territory ended{" "}
          {Math.abs(own.changePct - ref.changePct).toFixed(0)} percentage points{" "}
          {own.changePct - ref.changePct < 0 ? "below" : "above"} it.
        </small>
      )}
      {drift !== null && own.after.lastYear !== null && own.after.lastYear >= drift && (
        <small className="tr-warn">
          The after period includes {drift} onward, when MODIS orbits drifted. The methodology finds
          observed MODIS 8–15% above the VIIRS-based estimate over Brazil in those years, so they
          may read high.
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
  decision,
  decisionLabel,
  line,
  drift,
}: {
  own: YearPoint[];
  ref: YearPoint[];
  indexed: boolean;
  refName: string | null;
  decision: number | null;
  decisionLabel: string;
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

  const bands = intervalRuns(own);

  const medians =
    decision !== null
      ? (() => {
          const { before, after } = splitAt(own, decision);
          return [before, after]
            .filter((s) => s.length >= 3)
            .map((s) => ({ from: s[0]!.year, to: s.at(-1)!.year, value: summarize(s).median }));
        })()
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
        {drift !== null && drift <= y1 && (
          <>
            <rect
              className="tr-drift"
              x={x(drift - 0.5)}
              y={PAD.top}
              width={W - PAD.right - x(drift - 0.5)}
              height={H - PAD.top - PAD.bottom}
            />
            <text
              className="tr-drift-label"
              x={W - PAD.right - 4}
              y={H - PAD.bottom - 5}
              textAnchor="end"
            >
              MODIS orbit drift: may read high
            </text>
          </>
        )}
        {decision !== null && (
          <>
            <rect
              className="tr-after"
              x={x(decision - 0.5)}
              y={PAD.top}
              width={W - PAD.right - x(decision - 0.5)}
              height={H - PAD.top - PAD.bottom}
            />
            <line
              className="tr-decision"
              x1={x(decision - 0.5)}
              x2={x(decision - 0.5)}
              y1={PAD.top}
              y2={H - PAD.bottom}
            />
            <text className="tr-decision-label" x={x(decision - 0.5) + 4} y={PAD.top + 9}>
              {decisionLabel || `Decision ${decision}`}
            </text>
          </>
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
        {medians.map((m) => (
          <line
            key={m.from}
            className="tr-median"
            x1={x(m.from - 0.4)}
            x2={x(m.to + 0.4)}
            y1={y(m.value)}
            y2={y(m.value)}
          />
        ))}
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
        {medians.length > 0 && (
          <>
            <i className="hw-swatch line tr-median" /> <span>Median year, before and after</span>
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
