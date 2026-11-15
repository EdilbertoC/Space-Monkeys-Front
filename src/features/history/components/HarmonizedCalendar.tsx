import { useMemo, useRef, useState } from "react";
import SelectControl from "../../../shared/ui/SelectControl";
import { format, Icon, PanelTitle } from "../../../shared/ui/ui";
import { isAllSensors, type SensorSelection } from "../../sensors/sensors";
import { CALENDAR_CUTOFF, MONTHS, signedPercent, type CalendarScope } from "../demo/calendar-data";
import {
  buildAnnualActivity,
  PREVIEW_SUMMARY,
  type ActivityDisplayMode,
} from "../demo/harmonized-preview";
import "../styles/harmonized-calendar.css";

export function HarmonizedSummary({ sensor }: { sensor: SensorSelection }) {
  const available = isAllSensors(sensor);
  const sample = PREVIEW_SUMMARY;
  return (
    <div className="hfi-summary-section">
      <div className="hfi-scenario-label">
        <span className="hfi-preview-tag">ILLUSTRATIVE SCENARIO</span>
        <span>Fixed design values, not measurements of the selected area or period.</span>
      </div>
      <div className="hfi-kpi-grid">
        <section className="kpi-card hfi-index-card">
          <div className="kpi-top">
            <span>Harmonized Fire Index</span>
            <Icon name="layers" size={17} />
          </div>
          <div className="hfi-kpi-value">
            {available ? sample.index.toFixed(1) : "N/A"}
            <small>HFI</small>
          </div>
          <p>
            <span className="hfi-trend">{available ? `+${sample.baselineChange}%` : "N/A"}</span>{" "}
            vs. 20-yr baseline · demo
          </p>
        </section>
        <section className="kpi-card">
          <div className="kpi-top">
            <span>Total Fire Radiative Power</span>
            <Icon name="flame" size={17} />
          </div>
          <div className="hfi-kpi-value">
            {available ? format(sample.frpMw) : "N/A"}
            <small>MW</small>
          </div>
          <p>MODIS 1 km + VIIRS 375 m · mock display</p>
          <small className="hfi-kpi-note">No unified FRP measurement is connected.</small>
        </section>
        <section className="kpi-card">
          <div className="kpi-top">
            <span>Active Critical Anomalies</span>
            <Icon name="alert" size={17} />
          </div>
          <div className="hfi-kpi-value">
            {available ? sample.criticalRegions : "N/A"}
            <small>Regions</small>
          </div>
          <p>
            <i className={`hfi-alert-dot ${available ? "pulsing" : ""}`} />
            Out-of-season / Extreme · demo
          </p>
          <small className="hfi-kpi-note">Not operational alerts.</small>
        </section>
        <section className="kpi-card hfi-regime-card">
          <div className="kpi-top">
            <span>Dominant Fire Regime</span>
            <Icon name="globe" size={17} />
          </div>
          <div className="hfi-regime-value">
            {available ? "68%" : "N/A"} <span>Agricultural</span>
            <b>/</b>
            {available ? "32%" : "N/A"} <span>Forest</span>
          </div>
          <div
            className="hfi-regime-bar"
            role="img"
            aria-label={
              available
                ? "Illustrative split: 68 percent agricultural, 32 percent forest. Not a land-cover analysis."
                : "Fire regime unavailable"
            }
          >
            {available && (
              <>
                <i style={{ width: `${sample.agriculturalPercent}%` }} />
                <i style={{ width: `${sample.forestPercent}%` }} />
              </>
            )}
          </div>
          <p>Illustrative composition · classification not supplied</p>
        </section>
      </div>
    </div>
  );
}

export default function HarmonizedCalendar({
  mode,
  scope,
  sensor,
  areaLabel,
  period,
  onPeriod,
  year,
  onYearChange,
}: {
  mode: ActivityDisplayMode;
  scope: CalendarScope;
  sensor: SensorSelection;
  areaLabel: string;
  period: string;
  onPeriod: (start: string, end: string) => void;
  year: number;
  onYearChange: (year: string) => void;
}) {
  const cells = useMemo(
    () => buildAnnualActivity(year, mode, scope, sensor),
    [year, mode, scope, sensor],
  );
  const [focused, setFocused] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const maximum = Math.max(1, ...cells.map((c) => c.value ?? 0));
  const readout = focused === null ? null : cells[focused];
  const lastYear = Number(CALENDAR_CUTOFF.slice(0, 4));
  return (
    <section className="panel hfi-calendar annual-calendar">
      <PanelTitle title="Annual fire activity" subtitle="Monthly patterns · selected area · UTC">
        <div className="annual-year-nav">
          <button
            className="icon-button annual-prev"
            aria-label="Previous calendar year"
            disabled={year <= 2001}
            onClick={() => onYearChange(String(year - 1))}
          >
            <Icon name="chevron" size={16} />
          </button>
          <SelectControl label="Calendar year" value={year} onChange={onYearChange} icon="calendar">
            {Array.from({ length: lastYear - 2000 }, (_, i) => (
              <option key={i} value={lastYear - i}>
                {lastYear - i}
              </option>
            ))}
          </SelectControl>
          <button
            className="icon-button annual-next"
            aria-label="Next calendar year"
            disabled={year >= lastYear}
            onClick={() => onYearChange(String(year + 1))}
          >
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </PanelTitle>
      <div className="annual-area">
        <Icon name="target" size={15} />
        <strong>{areaLabel}</strong>
        <span>{mode === "harmonized" ? "Illustrative index" : "Raw sensor counts"}</span>
      </div>
      <div
        className="annual-months"
        ref={root}
        role="group"
        aria-label={`${year} monthly fire activity`}
      >
        {cells.map((cell, i) => (
          <button
            key={cell.start}
            data-month-index={i}
            className={`annual-month level-${cell.level} ${period.slice(0, 7) === cell.start.slice(0, 7) ? "selected" : ""}`}
            aria-pressed={period.slice(0, 7) === cell.start.slice(0, 7)}
            aria-label={`${cell.label}: ${cell.value === null ? "missing observations" : cell.value === 0 ? "observed zero activity" : `${mode === "harmonized" ? "illustrative HFI" : "raw demo detections"} ${cell.value}`}. Select month.`}
            onMouseEnter={() => setFocused(i)}
            onMouseLeave={() => setFocused(null)}
            onFocus={() => setFocused(i)}
            onBlur={() => setFocused(null)}
            onClick={() => onPeriod(cell.start, cell.end)}
            onKeyDown={(e) => {
              const steps: Record<string, number> = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -3,
                ArrowDown: 3,
              };
              if (e.key in steps) {
                e.preventDefault();
                root.current
                  ?.querySelector<HTMLButtonElement>(
                    `[data-month-index="${Math.max(0, Math.min(11, i + steps[e.key]))}"]`,
                  )
                  ?.focus();
              }
              if (e.key === "Escape") setFocused(null);
            }}
          >
            <span className="annual-month-name">
              {MONTHS[i].slice(0, 3)}
              <i />
            </span>
            <strong>
              {cell.value === null
                ? "—"
                : mode === "harmonized"
                  ? cell.value.toFixed(1)
                  : format(cell.value)}
            </strong>
            <span className="annual-month-track">
              <i
                style={{
                  width:
                    cell.value === null ? "100%" : `${Math.max(2, (cell.value / maximum) * 100)}%`,
                }}
              />
            </span>
            <small>
              {cell.value === null
                ? "No observations"
                : cell.value === 0
                  ? "Observed zero"
                  : `${signedPercent(cell.deviation)} vs. reference`}
            </small>
          </button>
        ))}
      </div>
      <div className="annual-readout" role="status" aria-live="polite">
        {readout ? (
          <>
            <strong>{readout.label}</strong>
            <span>
              {readout.value === null
                ? "Missing observations are not zero activity."
                : `${readout.level === "extreme" ? "Elevated scenario · " : ""}${signedPercent(readout.deviation)} versus ${mode === "harmonized" ? "mock historical reference" : "coverage-matched synthetic baseline"}.`}
            </span>
          </>
        ) : (
          <>
            <Icon name="info" size={15} />
            <span>
              Select a month to update the map and historical analysis. Hover or focus for
              comparison details.
            </span>
          </>
        )}
      </div>
      <p className="annual-method">
        {mode === "harmonized"
          ? "Index values and references are design scenarios, not validated harmonization."
          : "Counts preserve source provenance and are not deduplicated fires."}{" "}
        Long-term comparisons remain available in the historical view below.
      </p>
    </section>
  );
}
