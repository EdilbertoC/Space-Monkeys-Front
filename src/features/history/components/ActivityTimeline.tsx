import { useMemo, useState } from "react";
import { Dot, format, Icon, PanelTitle } from "../../../shared/ui/ui";
import { SensorDot } from "../../sensors/SensorControls";
import {
  hasDemoData,
  matchesSensor,
  sensorLabel,
  unavailableMessage,
  type SensorSelection,
} from "../../sensors/sensors";
import { isDateRange, resolveObservationPeriod } from "../date-selection/date-range";
import DateCalendar from "../date-selection/DateCalendar";
import { getHistory, getObservation, getSelectedHistory, selectedRecords } from "../demo/demo-data";
import { latestDemoYear } from "../demo/exploration";

const DEFAULT_HISTORY_MONTHS = 12;

export default function ActivityTimeline({
  factor,
  full = false,
  endYear = latestDemoYear,
  period: requestedPeriod,
  onPeriodChange,
  sensor,
}: {
  factor: number;
  full?: boolean;
  endYear?: number;
  period?: string;
  onPeriodChange?: (value: string) => void;
  sensor: SensorSelection;
}) {
  const period = requestedPeriod ? resolveObservationPeriod(requestedPeriod) : undefined;
  const [mode, setMode] = useState("Monthly");
  const [hover, setHover] = useState<number | null>(null);
  const [focusedPoint, setFocusedPoint] = useState(0);
  const history = useMemo(
    () =>
      period && isDateRange(period)
        ? getSelectedHistory(period, factor, mode === "Weekly", sensor)
        : getHistory(DEFAULT_HISTORY_MONTHS, endYear, factor, mode === "Weekly"),
    [endYear, factor, mode, period, sensor],
  );
  const { points } = history;
  const pointCoverage = useMemo(() => {
    if (!period || !isDateRange(period))
      return points.map(() => ({
        MODIS: true,
        VIIRS: true,
        start: null as string | null,
        end: null as string | null,
      }));
    const buckets = new Map<string, ReturnType<typeof selectedRecords>>();
    selectedRecords(period).forEach((day, i) => {
      const key = mode === "Weekly" ? String(Math.floor(i / 7)) : day.date.slice(0, 7);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(day);
    });
    return [...buckets.values()].map((days) => ({
      MODIS: days.some((day) => day.modis !== null),
      VIIRS: days.some((day) => day.viirs !== null),
      start: days[0].date,
      end: days[days.length - 1].date,
    }));
  }, [period, mode, points]);
  const primary = sensor === "VIIRS" ? "viirs" : "modis";
  const primaryBaselineKey = sensor === "VIIRS" ? "baselineViirs" : "baselineModis";
  const primaryLabel =
    sensor === "ALL" || sensor === "All" ? "MODIS fallback" : sensorLabel(sensor);
  const primaryAvailable =
    hasDemoData(sensor) && pointCoverage.some((p) => p[sensor === "VIIRS" ? "VIIRS" : "MODIS"]);
  const primaryTotal = points.reduce((sum, point) => sum + point[primary], 0);
  const primaryBaseline = points.reduce((sum, point) => sum + point[primaryBaselineKey], 0);
  const max =
    Math.ceil(
      Math.max(1, ...points.flatMap((p) => [p.modis, p.viirs, p.baselineModis, p.baselineViirs])) /
        4000,
    ) * 4000;
  const x = (i: number) => (points.length === 1 ? 367.5 : 45 + (i * 645) / (points.length - 1));
  const y = (value: number) => 154 - (value / max) * 135;
  const series = (key: "modis" | "viirs" | "baselineModis" | "baselineViirs") =>
    points.map((p, i) => `${x(i)},${y(p[key])}`).join(" ");
  const linePath = (key: "modis" | "viirs" | "baselineModis" | "baselineViirs") => {
    let previous = false;
    return points
      .map((point, i) => {
        const source = key === "modis" || key === "baselineModis" ? "MODIS" : "VIIRS";
        if (!pointCoverage[i]?.[source]) {
          previous = false;
          return "";
        }
        const segment = `${previous ? "L" : "M"}${x(i)},${y(point[key])}`;
        previous = true;
        return segment;
      })
      .join(" ");
  };
  const index = Math.min(hover ?? points.length - 1, points.length - 1);
  const selected = points[index];
  const coreAvailability = {
    MODIS: !period || getObservation(period, factor, "MODIS").hasObservations,
    VIIRS: !period || getObservation(period, factor, "VIIRS").hasObservations,
  };
  const hasSelectedObservations =
    hasDemoData(sensor) && (!period || getObservation(period, factor, sensor).hasObservations);
  const tickEvery = Math.max(1, Math.ceil(points.length / 12));
  return (
    <section
      className={`panel timeline-panel historical-panel ${full ? "full-chart" : ""}`}
      data-modis={matchesSensor(sensor, "MODIS") && coreAvailability.MODIS}
      data-viirs={matchesSensor(sensor, "VIIRS") && coreAvailability.VIIRS}
    >
      <PanelTitle
        title="Historical Burning Activity"
        subtitle={`${mode} sensor comparison · illustrative demo data`}
      >
        <span className="demo-pill">DEMO DATA</span>
      </PanelTitle>
      <div className="history-controls">
        {period && onPeriodChange ? (
          <DateCalendar
            value={period}
            onApply={onPeriodChange}
            label="Historical observation calendar"
          />
        ) : (
          <span>{history.rangeLabel}</span>
        )}
        <div className="segmented">
          {["Weekly", "Monthly"].map((m) => (
            <button
              key={m}
              className={mode === m ? "selected" : ""}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setHover(null);
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="line-key modis-line" /> MODIS
        </span>
        <span>
          <i className="line-key viirs-line" /> VIIRS
        </span>
        <span>
          <i className="line-key baseline-line" /> Baseline, per sensor
        </span>
        <span className="chart-unit">Detections (thousands)</span>
        <span>
          <SensorDot sensor="SENTINEL3_SLSTR" />
          SLSTR · unavailable
        </span>
        <span>
          <SensorDot sensor="GOES_ABI" />
          ABI · unavailable
        </span>
      </div>
      {hasSelectedObservations ? (
        <>
          <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
            <svg
              viewBox="0 0 720 190"
              preserveAspectRatio="none"
              role="group"
              aria-label={`${mode} illustrative MODIS and VIIRS detections with sensor-specific historical baselines, ${history.rangeLabel}`}
              onMouseMove={(e) => {
                const b = e.currentTarget.getBoundingClientRect();
                setHover(
                  Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      Math.round(
                        ((((e.clientX - b.left) / b.width) * 720 - 45) / 645) * (points.length - 1),
                      ),
                    ),
                  ),
                );
              }}
            >
              <defs>
                <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--orange)" stopOpacity=".13" />
                  <stop offset="1" stopColor="var(--orange)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line
                    className="history-gridline"
                    x1="45"
                    x2="695"
                    y1={19 + i * 45}
                    y2={19 + i * 45}
                  />
                  <text x="32" y={23 + i * 45} textAnchor="end">
                    {Number(((max * (1 - i / 3)) / 1000).toFixed(1))}k
                  </text>
                </g>
              ))}
              {points.length > 1 && pointCoverage.every((p) => p.VIIRS) && (
                <polygon points={`45,154 ${series("viirs")} 690,154`} fill="url(#chartFill)" />
              )}
              {points.length === 1 && (
                <>
                  {pointCoverage[0]?.MODIS && (
                    <circle
                      className="history-point modis-series"
                      cx={x(0)}
                      cy={y(points[0].modis)}
                      r="3"
                    />
                  )}
                  {pointCoverage[0]?.VIIRS && (
                    <circle
                      className="history-point viirs-series"
                      cx={x(0)}
                      cy={y(points[0].viirs)}
                      r="3"
                    />
                  )}
                </>
              )}
              <path
                className="history-series modis-series historical-baseline"
                d={linePath("baselineModis")}
              />
              <path
                className="history-series viirs-series historical-baseline"
                d={linePath("baselineViirs")}
              />
              <path className="history-series modis-series" d={linePath("modis")} />
              <path className="history-series viirs-series" d={linePath("viirs")} />
              {points.map((point, i) => {
                const coverage = pointCoverage[i];
                const selectPoint = () => {
                  if (coverage?.start && coverage.end)
                    onPeriodChange?.(`${coverage.start}/${coverage.end}`);
                };
                return (
                  <rect
                    key={`point-${i}`}
                    data-history-point={i}
                    role="button"
                    tabIndex={i === Math.min(focusedPoint, points.length - 1) ? 0 : -1}
                    x={x(i) - Math.max(5, 645 / Math.max(1, points.length) / 2)}
                    y="10"
                    width={Math.max(10, 645 / Math.max(1, points.length))}
                    height="144"
                    fill="transparent"
                    className="history-period-target"
                    aria-label={`${point.dateLabel}. ${coverage?.MODIS ? `${format(point.modis)} raw MODIS demo detections` : "MODIS: no observations"}. ${coverage?.VIIRS ? `${format(point.viirs)} raw VIIRS demo detections` : "VIIRS: no observations"}. Select period.`}
                    onFocus={() => {
                      setFocusedPoint(i);
                      setHover(i);
                    }}
                    onBlur={() => setHover(null)}
                    onClick={selectPoint}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectPoint();
                      }
                      const steps: Record<string, number> = {
                        ArrowLeft: -1,
                        ArrowUp: -1,
                        ArrowRight: 1,
                        ArrowDown: 1,
                      };
                      if (e.key in steps || e.key === "Home" || e.key === "End") {
                        e.preventDefault();
                        const next =
                          e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? points.length - 1
                              : Math.max(0, Math.min(points.length - 1, i + steps[e.key]));
                        setFocusedPoint(next);
                        e.currentTarget.parentElement
                          ?.querySelector<SVGRectElement>(`[data-history-point="${next}"]`)
                          ?.focus();
                      }
                    }}
                  />
                );
              })}
              {points.map(
                (p, i) =>
                  i % tickEvery === 0 && (
                    <text x={x(i)} y="179" textAnchor="middle" key={i}>
                      {p.label}
                    </text>
                  ),
              )}
              {hover !== null && (
                <>
                  <line
                    className="history-hoverline"
                    x1={x(index)}
                    x2={x(index)}
                    y1="10"
                    y2="154"
                  />
                  {pointCoverage[index]?.[matchesSensor(sensor, "VIIRS") ? "VIIRS" : "MODIS"] && (
                    <circle
                      className="history-hoverdot"
                      cx={x(index)}
                      cy={y(matchesSensor(sensor, "VIIRS") ? selected.viirs : selected.modis)}
                      r="3.5"
                    />
                  )}
                </>
              )}
            </svg>
            {hover !== null && (
              <div
                className={`chart-tooltip history-tooltip ${index < points.length / 2 ? "tooltip-left" : "tooltip-right"}`}
              >
                <strong>{selected.dateLabel}</strong>
                <span>
                  <Dot color="yellow" /> MODIS{" "}
                  <b>
                    {!matchesSensor(sensor, "MODIS")
                      ? "Not selected"
                      : pointCoverage[index]?.MODIS
                        ? format(selected.modis)
                        : "N/A"}
                  </b>
                </span>
                <span>
                  <Dot color="orange" /> VIIRS{" "}
                  <b>
                    {!matchesSensor(sensor, "VIIRS")
                      ? "Not selected"
                      : pointCoverage[index]?.VIIRS
                        ? format(selected.viirs)
                        : "N/A"}
                  </b>
                </span>
                <span className="tooltip-baseline">
                  MODIS baseline{" "}
                  <b>
                    {!matchesSensor(sensor, "MODIS")
                      ? "Not selected"
                      : pointCoverage[index]?.MODIS
                        ? format(selected.baselineModis)
                        : "N/A"}
                  </b>
                </span>
                <span className="tooltip-baseline">
                  VIIRS baseline{" "}
                  <b>
                    {!matchesSensor(sensor, "VIIRS")
                      ? "Not selected"
                      : pointCoverage[index]?.VIIRS
                        ? format(selected.baselineViirs)
                        : "N/A"}
                  </b>
                </span>
                <small>Illustrative demo data</small>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="sensor-empty-chart">
          {hasDemoData(sensor)
            ? "No observations are available for the selected sensor and observation window. Missing data is not zero activity."
            : unavailableMessage(sensor)}
        </div>
      )}
      {hasSelectedObservations && (
        <div className="history-comparison" aria-label="Current activity versus historical average">
          <div>
            <span>Selected activity · {history.rangeLabel}</span>
            <strong>{primaryAvailable ? format(primaryTotal) : "N/A"}</strong>
            <small>{primaryLabel} · primary raw series</small>
          </div>
          <div>
            <span>Historical average</span>
            <strong>{primaryAvailable ? format(primaryBaseline) : "N/A"}</strong>
            <small>{history.referenceLabel} · same elapsed days</small>
          </div>
          <div>
            <span>Versus historical average</span>
            <strong className="increase">
              {primaryAvailable && primaryBaseline
                ? `${primaryTotal >= primaryBaseline ? "+" : ""}${((primaryTotal / primaryBaseline - 1) * 100).toFixed(1)}%`
                : "N/A"}
            </strong>
            <small>Illustrative comparison only</small>
          </div>
        </div>
      )}
      {full && hasSelectedObservations && (
        <div className="chart-summary">
          <span>
            <Dot color="orange" /> Peak month: {history.peak.label}{" "}
            {history.peak.dateLabel.slice(-4)}
          </span>
          <span>{format(history.peak.modis + history.peak.viirs)} illustrative detections</span>
        </div>
      )}
      <div className="history-note">
        <Icon name="info" size={13} />
        <span>
          Dashed lines: each sensor’s {history.referenceLabel} seasonal average.{" "}
          {history.partial
            ? "August 2026 is partial through Aug 24; baselines match elapsed days. "
            : ""}
          Chart follows the selected observation window. Counts are not harmonized or deduplicated.{" "}
          The primary All Sensors comparison falls back to MODIS while harmonization is pending; raw
          VIIRS remains separate. Missing source periods are gaps, not zero activity.
        </span>
      </div>
    </section>
  );
}
