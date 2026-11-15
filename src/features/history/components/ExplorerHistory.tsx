import { useMemo, useState } from "react";
import { downloadCsv } from "../../../shared/lib/download-csv";
import SelectControl from "../../../shared/ui/SelectControl";
import { format, Icon, PanelTitle } from "../../../shared/ui/ui";
import { hasDemoData, sensorLabel, type SensorSelection } from "../../sensors/sensors";
import { CALENDAR_CUTOFF, MONTHS, type CalendarScope } from "../demo/calendar-data";
import { explorationCsv, getExplorationHistory, latestDemoYear } from "../demo/exploration";

export default function ExplorerHistory({
  scope,
  sensor,
  endYear,
  month,
  onPeriod,
}: {
  scope: CalendarScope;
  sensor: SensorSelection;
  endYear: number;
  month: number;
  onPeriod: (start: string, end: string) => void;
}) {
  const [startYear, setStartYear] = useState(Math.max(2001, latestDemoYear - 5));
  const [aggregation, setAggregation] = useState<"Monthly" | "Yearly">("Yearly");
  const [hover, setHover] = useState<number | null>(null);
  const from = Math.min(startYear, endYear);
  const points = useMemo(
    () => getExplorationHistory(scope, sensor, from, endYear, month, aggregation),
    [scope, sensor, from, endYear, month, aggregation],
  );
  const maximum = Math.max(1, ...points.flatMap((p) => [p.total ?? 0, p.baseline ?? 0]));
  const primaryLabel =
    sensor === "ALL" || sensor === "All" ? "MODIS fallback" : sensorLabel(sensor);
  const active = hover === null ? null : points[hover];
  const exportSeries = () => {
    downloadCsv(
      explorationCsv(points, sensor, scope),
      `orbitburn-demo-history-${from}-${endYear}-${aggregation.toLowerCase()}.csv`,
    );
  };
  return (
    <section className="panel explorer-history">
      <PanelTitle
        title="Long-term activity"
        subtitle={`${from}–${endYear}${month >= 0 ? ` · ${MONTHS[month]}` : ""} · same selected area · illustrative archive`}
      >
        <span className="demo-pill">NOT HARMONIZED</span>
        <button className="text-link" onClick={exportSeries}>
          <Icon name="download" size={14} />
          Export series
        </button>
      </PanelTitle>
      <div className="explorer-history-controls">
        <label className="history-start-control">
          Starting year
          <SelectControl
            label="Historical starting year"
            icon="calendar"
            value={from}
            onChange={(v) => setStartYear(Number(v))}
          >
            {Array.from({ length: endYear - 2000 }, (_, i) => 2001 + i).map((y) => (
              <option key={y}>{y}</option>
            ))}
          </SelectControl>
        </label>
        <span>Ending year and month follow the calendar filters above.</span>
        <div className="segmented">
          {(["Monthly", "Yearly"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={aggregation === value}
              className={aggregation === value ? "selected" : ""}
              onClick={() => {
                setAggregation(value);
                setHover(null);
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="line-key modis-line" />
          {primaryLabel} · raw detections
        </span>
        <span>
          <i className="line-key baseline-line" />
          Coverage-matched synthetic baseline
        </span>
      </div>
      {!hasDemoData(sensor) ? (
        <p className="explorer-footnote">
          {sensorLabel(sensor)} historical output is unavailable, not zero activity.
        </p>
      ) : (
        <div className="explorer-chart-scroll">
          <div
            className="explorer-bars"
            style={{ minWidth: Math.max(480, points.length * 32) }}
            onMouseLeave={() => setHover(null)}
            role="group"
            aria-label={`${aggregation} historical chart, select a period to update the map and calendar`}
          >
            {points.map((p, i) => (
              <button
                key={p.label}
                className="explorer-bar"
                aria-label={`${p.label}: ${p.total === null ? "No observations" : `${format(p.total)} ${primaryLabel} demo detections, baseline ${format(p.baseline!)}`}. Select period.`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onPeriod(p.start, p.end)}
              >
                <span className="explorer-bar-track">
                  {p.total === null ? (
                    <span className="explorer-bar-missing">N/A</span>
                  ) : (
                    <>
                      <i
                        className={`explorer-bar-fill ${sensor === "VIIRS" ? "viirs" : ""}`}
                        style={{ height: `${Math.max(1, (p.total / maximum) * 100)}%` }}
                      />
                      <i
                        className="explorer-baseline-tick"
                        style={{ bottom: `${(p.baseline! / maximum) * 100}%` }}
                      />
                    </>
                  )}
                </span>
                <span>
                  {aggregation === "Yearly"
                    ? p.label
                    : `${p.label.slice(2, 4)}/${p.label.slice(5)}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="explorer-chart-readout" role="status" aria-live="polite">
        {active ? (
          <>
            <strong>{active.label} · UTC</strong>
            <span>
              {primaryLabel}: {active.total === null ? "No observations" : format(active.total)}
            </span>
            <span>Baseline: {active.baseline === null ? "N/A" : format(active.baseline)}</span>
            <span>
              VIIRS raw comparison: {active.viirs === null ? "N/A" : format(active.viirs)}
            </span>
            <span>
              {active.observedDays}/{active.days} observed days
            </span>
          </>
        ) : (
          <span>Hover or focus a bar to inspect; select it to explore its observation period.</span>
        )}
      </div>
      <div className="history-note">
        <Icon name="info" size={13} />
        <span>
          Harmonization pending: the primary All Sensors historical series falls back to MODIS; raw
          VIIRS stays available for comparison. No validated baseline or uncertainty bounds are
          connected. Missing periods stay empty. Synthetic archive ends {CALENDAR_CUTOFF}.
        </span>
      </div>
    </section>
  );
}
