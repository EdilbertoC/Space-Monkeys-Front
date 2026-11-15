// Keep lazy-loaded calendar styles in the established cascade order.
import "../styles/calendar.css";
import "../styles/priority-anomalies.css";
import "../styles/harmonized-calendar.css";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { downloadCsv } from "../../../shared/lib/download-csv";
import { Dot, format, Icon, PanelTitle, type IconName } from "../../../shared/ui/ui";
import FireMap, { type MapViewRequest } from "../../map/components/FireMap";
import { SensorFilter } from "../../sensors/SensorControls";
import { hasDemoData, isAllSensors, sensorLabel, unavailableMessage } from "../../sensors/sensors";
import { isDateRange } from "../date-selection/date-range";
import DateCalendar from "../date-selection/DateCalendar";
import {
  activityFor,
  CALENDAR_CUTOFF,
  CONTINENTS,
  COUNTRIES,
  dateLabel,
  generateCalendar,
  inCalendarRange,
  intensityLevel,
  MONTHS,
  scopeLabel,
  signedPercent,
  summarizeCalendar,
  validBounds,
  type Bounds,
  type CalendarDay,
  type CalendarScope,
  type CalendarSensor,
} from "../demo/calendar-data";
import {
  latestDemoYear,
  selectionLabel,
  selectionScope,
  type AreaSelection,
} from "../demo/exploration";
import type { ActivityDisplayMode } from "../demo/harmonized-preview";
import type { PriorityScenario } from "../demo/priority-scenarios";
import { formatCalendarCount } from "../model/calendar-presentation";
import CalendarDayDetail from "./CalendarDayDetail";
import CalendarFilter from "./CalendarFilter";
import CalendarInsights from "./CalendarInsights";
import CalendarMonthlyComparison from "./CalendarMonthlyComparison";
import ExplorerHistory from "./ExplorerHistory";
import HarmonizedCalendar, { HarmonizedSummary } from "./HarmonizedCalendar";
import PriorityAnomalyTable from "./PriorityAnomalyTable";

const defaultBounds: Bounds = { south: -15, north: 5, west: -75, east: -45 };

export default function BurningActivityCalendar({
  onNotify,
  onInfo,
  period,
  onPeriodChange,
  sensor,
  onSensorChange,
  scope,
  onScopeChange,
  area,
  onAreaChange,
}: {
  onNotify: (message: string) => void;
  onInfo: () => void;
  period: string;
  onPeriodChange: (value: string) => void;
  sensor: CalendarSensor;
  onSensorChange: (value: CalendarSensor) => void;
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  area: AreaSelection | null;
  onAreaChange: (area: AreaSelection | null) => void;
}) {
  const [displayMode, setDisplayMode] = useState<ActivityDisplayMode>("harmonized");
  const [mapOverride, setMapOverride] = useState<{ scopeKey: string; region: string } | null>(null);
  const [mapFocus, setMapFocus] = useState<MapViewRequest | null>(null);
  const [inspectedScenario, setInspectedScenario] = useState<PriorityScenario | null>(null);
  const mapColumn = useRef<HTMLDivElement>(null);
  const mapRegion =
    mapOverride?.scopeKey === JSON.stringify(scope)
      ? mapOverride.region
      : scope.kind === "Continent"
        ? scope.name
        : displayMode === "harmonized"
          ? "South America"
          : "Global";
  const [year, setYear] = useState(latestDemoYear);
  const [month, setMonth] = useState(-1);
  const setSensor = onSensorChange;
  const setScope = (next: CalendarScope) => {
    onAreaChange(null);
    onScopeChange(next);
    setMapFocus(null);
    setInspectedScenario(null);
  };
  const [range, setRange] = useState("Full year");
  const [customStart, setCustomStart] = useState(`${latestDemoYear}-01-01`);
  const [customEnd, setCustomEnd] = useState(CALENDAR_CUTOFF);
  const [boundsDraft, setBoundsDraft] = useState(defaultBounds);
  const [boundsError, setBoundsError] = useState("");
  const [selectedDate, setSelectedDate] = useState(CALENDAR_CUTOFF);
  const [mapDate, setMapDate] = useState<string | null>(null);
  const appliedPeriod = useRef<string | null>(null);
  const commitPeriod = (value: string) => {
    appliedPeriod.current = value;
    onPeriodChange(value);
  };
  const [hover, setHover] = useState<CalendarDay | null>(null);
  const [view, setView] = useState("Annual heatmap");
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isDateRange(period)) return;
    const locallyApplied = appliedPeriod.current === period;
    appliedPeriod.current = null;
    if (locallyApplied) return;
    const [a, b] = period.split("/");
    setYear(Number(b.slice(0, 4)));
    setMonth(-1);
    setRange("Custom range");
    setCustomStart(a);
    setCustomEnd(b);
    setSelectedDate(b);
    setMapDate(null);
  }, [period]);
  const days = useMemo(() => generateCalendar(year, scope), [year, scope]);
  const start =
    range === "Custom range"
      ? customStart
      : range === "Jul – Dec"
        ? `${year}-07-01`
        : `${year}-01-01`;
  const end =
    range === "Custom range"
      ? customEnd
      : range === "Jan – Jun"
        ? `${year}-06-30`
        : `${year}-12-31`;
  const rangeValid =
    !!start && !!end && start <= end && start >= "2001-01-01" && end <= `${latestDemoYear}-12-31`;
  const filtered = useMemo(
    () => (rangeValid ? days.filter((d) => inCalendarRange(d, start, end, month)) : []),
    [days, start, end, month, rangeValid],
  );
  const filteredDates = useMemo(() => new Set(filtered.map((d) => d.date)), [filtered]);
  const summary = useMemo(() => summarizeCalendar(filtered, sensor), [filtered, sensor]);
  const selected =
    filtered.find((d) => d.date === selectedDate) ??
    filtered.find((d) => activityFor(d, sensor).observed) ??
    filtered[0];
  const selectedActivity = selected ? activityFor(selected, sensor) : null;
  const maximum = Math.max(1, ...filtered.map((d) => activityFor(d, sensor).total ?? 0));
  const yearOffset = days[0].weekday;
  const weeks = Math.ceil((days.length + yearOffset) / 7);
  const detailMonth = month >= 0 ? month : (selected?.month ?? 7);
  const detailDays = days.filter((d) => d.month === detailMonth);
  const readout = hover && filteredDates.has(hover.date) ? hover : selected;
  const readoutActivity = readout ? activityFor(readout, sensor) : null;
  const label = area ? selectionLabel(area) : scopeLabel(scope);
  const changeMonth = (next: number) => {
    setMonth(next);
    setRange("Full year");
    setMapDate(null);
    setHover(null);
    const a = next < 0 ? `${year}-01-01` : `${year}-${String(next + 1).padStart(2, "0")}-01`;
    const b =
      next < 0 ? `${year}-12-31` : new Date(Date.UTC(year, next + 1, 0)).toISOString().slice(0, 10);
    commitPeriod(`${a}/${b}`);
  };

  const changeYear = (value: string) => {
    const next = Number(value);
    commitPeriod(`${next}-01-01/${next}-12-31`);
    setYear(next);
    setMonth(-1);
    setRange("Full year");
    setHover(null);
    setCustomStart(`${next}-01-01`);
    setCustomEnd(`${next}-12-31`);
    setSelectedDate(next === latestDemoYear ? CALENDAR_CUTOFF : `${next}-12-31`);
    setMapDate(null);
  };
  const changeScope = (kind: CalendarScope["kind"]) => {
    setScope({
      kind,
      name: kind === "Continent" ? CONTINENTS[0] : kind === "Country" ? COUNTRIES[0].name : kind,
      ...(kind === "Custom Area" ? { bounds: { ...defaultBounds } } : {}),
    });
    setBoundsDraft({ ...defaultBounds });
    setBoundsError("");
    setHover(null);
  };
  const reset = () => {
    commitPeriod(`${CALENDAR_CUTOFF}/${CALENDAR_CUTOFF}`);
    setYear(latestDemoYear);
    setMonth(-1);
    setRange("Custom range");
    setSensor("ALL");
    setScope({ kind: "Global", name: "Global" });
    setSelectedDate(CALENDAR_CUTOFF);
    setCustomStart(CALENDAR_CUTOFF);
    setCustomEnd(CALENDAR_CUTOFF);
    setMapDate(null);
    onAreaChange(null);
    setBoundsError("");
    setHover(null);
  };
  const inspectDay = (date: string) => {
    setSelectedDate(date);
    setMapDate(date);
    commitPeriod(`${date}/${date}`);
    setHover(null);
  };
  const reviewPeriod = (from: string, to: string) => {
    setYear(Number(to.slice(0, 4)));
    setMonth(-1);
    setRange("Custom range");
    setCustomStart(from);
    setCustomEnd(to);
    commitPeriod(`${from}/${to}`);
    setSelectedDate(from);
    setMapDate(null);
    setHover(null);
  };
  const inspectScenario = (scenario: PriorityScenario) => {
    const nextScope = selectionScope(scenario.area);
    onAreaChange(scenario.area);
    onScopeChange(nextScope);
    setMapOverride({ scopeKey: JSON.stringify(nextScope), region: "South America" });
    setMapFocus({ id: `${scenario.id}-${Date.now()}`, center: scenario.center, zoom: 3.1 });
    setInspectedScenario(scenario);
    setDisplayMode("harmonized");
    reviewPeriod(scenario.date, scenario.date);
    requestAnimationFrame(() => {
      mapColumn.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
      mapColumn.current
        ?.querySelector<HTMLButtonElement>(".area-tool-buttons button[aria-pressed='true']")
        ?.focus({ preventScroll: true });
    });
  };

  const exportCalendar = () => {
    const rows = [
      "OrbitBurn Burning Calendar — ILLUSTRATIVE DEMO DATA",
      `"Geographic scope","${label}"`,
      `Year,${year}`,
      `Sensor filter,${sensor}`,
      `"Selected geometry (projected preview only)","${area ? JSON.stringify(area).replace(/"/g, '""') : "None"}"`,
      "SENTINEL3_SLSTR availability,Planned; not integrated; no observations",
      "GOES_ABI availability,Planned; not integrated; no observations",
      "Combined totals,Available MODIS and VIIRS only; not harmonized or deduplicated",
      `Date range,${start} to ${end}`,
      `Month,${month < 0 ? "All months" : MONTHS[month]}`,
      "Scientific harmonization and anomaly detection,NOT IMPLEMENTED",
      "Date,MODIS raw demo,VIIRS raw demo,SENTINEL3_SLSTR raw observations,GOES_ABI raw observations,Selected total,Matched baseline,Deviation percent,Observation status,Illustrative classification,Harmonized output",
      ...filtered.map((day) => {
        const a = activityFor(day, sensor);
        return [
          day.date,
          day.modis ?? "N/A",
          day.viirs ?? "N/A",
          day.observations.SENTINEL3_SLSTR ?? "N/A",
          day.observations.GOES_ABI ?? "N/A",
          a.total ?? "N/A",
          a.baseline ?? "N/A",
          a.deviation?.toFixed(2) ?? "N/A",
          !hasDemoData(sensor)
            ? "Unavailable / not computed"
            : a.partial
              ? "Partial coverage"
              : a.observed
                ? a.total === 0
                  ? "Observed zero"
                  : "Observed"
                : day.reason === "after-cutoff"
                  ? "After demo cutoff"
                  : "Missing observations",
          a.classification,
          "Not computed",
        ].join(",");
      }),
    ].join("\n");
    downloadCsv(rows, `orbitburn-burning-calendar-${year}-${sensor.toLowerCase()}.csv`);
    onNotify("Filtered illustrative calendar data exported as CSV.");
  };
  const navigateDay = (event: KeyboardEvent<HTMLButtonElement>, day: CalendarDay) => {
    const annual = view === "Annual heatmap";
    const steps: Record<string, number> = {
      ArrowLeft: annual ? -7 : -1,
      ArrowRight: annual ? 7 : 1,
      ArrowUp: annual ? -1 : -7,
      ArrowDown: annual ? 1 : 7,
    };
    let index = filtered.findIndex((d) => d.date === day.date);
    if (event.key === "Home") index = 0;
    else if (event.key === "End") index = filtered.length - 1;
    else if (event.key in steps)
      index = Math.max(0, Math.min(filtered.length - 1, index + steps[event.key]));
    else return;
    event.preventDefault();
    const target = filtered[index];
    if (!target) return;
    if (!annual && target.month !== detailMonth) setMonth(target.month);
    inspectDay(target.date);
    requestAnimationFrame(() =>
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${target.date}"]`)?.focus(),
    );
  };
  const renderDay = (day: CalendarDay, detailed = false) => {
    const activity = activityFor(day, sensor);
    const included = filteredDates.has(day.date);
    const active = selected?.date === day.date;
    const state = !hasDemoData(sensor)
      ? "not-computed"
      : !activity.observed
        ? "missing"
        : activity.total === 0
          ? "zero"
          : `level-${intensityLevel(activity.total!, maximum)}`;
    const description = `${dateLabel(day.date, true)}: ${!included ? "outside selected filters" : !hasDemoData(sensor) ? `${sensorLabel(sensor)} output unavailable` : !activity.observed ? (day.reason === "after-cutoff" ? "no observations, beyond demo cutoff" : "no observations") : `${format(activity.total!)} illustrative hotspots${activity.partial ? ", partial coverage" : ""}${activity.anomalous ? ", demo anomaly flag" : activity.total === 0 ? ", observed zero activity" : ""}`}`;
    return (
      <button
        key={day.date}
        type="button"
        data-date={day.date}
        data-state={state}
        disabled={!included}
        tabIndex={active ? 0 : -1}
        aria-label={description}
        title={description}
        aria-pressed={active}
        className={`${detailed ? "burn-month-day" : "burn-day"} burn-${state} ${active ? "selected" : ""} ${activity.anomalous && included ? "has-anomaly" : ""} ${activity.partial ? "partial-coverage" : ""}`}
        onClick={() => inspectDay(day.date)}
        onMouseEnter={() => setHover(day)}
        onFocus={() => setHover(day)}
        onKeyDown={(e) => navigateDay(e, day)}
      >
        {detailed && (
          <>
            <span>{day.day}</span>
            <strong>{formatCalendarCount(activity.total)}</strong>
            <small>
              {!hasDemoData(sensor)
                ? "not computed"
                : activity.observed
                  ? "hotspots"
                  : "no observations"}
            </small>
          </>
        )}
        {activity.anomalous && included && <i className="burn-anomaly-mark" />}
      </button>
    );
  };
  return (
    <div className="burning-calendar-page">
      <section className="panel burn-filter-panel" aria-label="Calendar filters">
        <div className="burn-filter-grid">
          <CalendarFilter
            label="Geographic selector"
            caption="Region"
            value={scope.kind}
            onChange={(v) => changeScope(v as CalendarScope["kind"])}
            icon="globe"
          >
            {["Global", "Continent", "Country", "Custom Area"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </CalendarFilter>
          <SensorFilter value={sensor} onChange={setSensor} harmonized />
          <DateCalendar value={period} onApply={onPeriodChange} label="Calendar date selection" />
          <div className="hfi-display-toggle" role="group" aria-label="Activity measurement">
            <button
              aria-pressed={displayMode === "raw"}
              onClick={() => {
                setDisplayMode("raw");
                if (sensor === "Harmonized") setSensor("ALL");
              }}
            >
              Raw Sensor Counts
            </button>
            <button
              aria-pressed={displayMode === "harmonized"}
              className="hfi-index-toggle"
              onClick={() => {
                setDisplayMode("harmonized");
                if (sensor === "Harmonized") setSensor("ALL");
              }}
            >
              <Icon name="layers" size={14} />
              Harmonized Index <small>(MODIS + VIIRS)</small>
            </button>
          </div>
          <button className="burn-reset" onClick={reset}>
            <Icon name="target" size={15} />
            Reset
          </button>
        </div>
        {(scope.kind === "Continent" || scope.kind === "Country") && (
          <div className="burn-filter-dependent">
            <CalendarFilter
              label={scope.kind === "Continent" ? "Select continent" : "Select country"}
              value={scope.name}
              onChange={(name) => setScope({ ...scope, name })}
              icon="globe"
            >
              {(scope.kind === "Continent" ? CONTINENTS : COUNTRIES.map((c) => c.name)).map(
                (name) => (
                  <option key={name}>{name}</option>
                ),
              )}
            </CalendarFilter>
            <p>Illustrative regional sample · filters change the synthetic observation series.</p>
          </div>
        )}
        {scope.kind === "Custom Area" && !area && (
          <form
            className="burn-area-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!validBounds(boundsDraft)) {
                setBoundsError(
                  "Enter valid bounds: −90 ≤ south < north ≤ 90 and −180 ≤ west < east ≤ 180.",
                );
                return;
              }
              setBoundsError("");
              setScope({ ...scope, bounds: { ...boundsDraft } });
              onNotify("Illustrative custom area applied.");
            }}
          >
            <div className="burn-area-inputs">
              {(["south", "north", "west", "east"] as const).map((key) => (
                <label key={key}>
                  <span>{key} bound (°)</span>
                  <input
                    aria-label={`${key} bound`}
                    type="number"
                    required
                    step="0.1"
                    min={key === "south" || key === "north" ? -90 : -180}
                    max={key === "south" || key === "north" ? 90 : 180}
                    value={Number.isNaN(boundsDraft[key]) ? "" : boundsDraft[key]}
                    onChange={(e) =>
                      setBoundsDraft({ ...boundsDraft, [key]: e.target.valueAsNumber })
                    }
                  />
                </label>
              ))}
              <button className="button secondary" type="submit">
                Apply area
                <Icon name="check" size={14} />
              </button>
            </div>
            {boundsError && (
              <p className="burn-form-error" role="alert">
                {boundsError}
              </p>
            )}
            <p>
              Bounding-box inputs control this synthetic regional sample only. No actual geospatial
              clipping or analysis is performed.
            </p>
          </form>
        )}
      </section>
      <div className="hfi-source-status">
        <span>
          <i />
          Illustrative preview · 2001–2026 archive
        </span>
        <span>
          <Icon name="satellite" size={14} />
          NASA FIRMS live sync not connected
        </span>
      </div>
      <div className="burn-context">
        <span>
          <Dot color="orange" />
          <strong>{label}</strong>
          <span className="burn-context-divider" />
          {rangeValid ? `${dateLabel(start)} – ${dateLabel(end)}` : "Invalid date range"}
          {month >= 0 && ` · ${MONTHS[month]}`}
          <span className="utc-tag">UTC</span>
        </span>
        <div>
          <span className="demo-pill">ILLUSTRATIVE DEMO DATA</span>
          <button
            className="text-link"
            onClick={exportCalendar}
            disabled={!rangeValid || !filtered.length}
          >
            <Icon name="download" size={14} />
            Export calendar
          </button>
        </div>
      </div>
      {!hasDemoData(sensor) && (
        <div className="burn-unavailable" role="status">
          <Icon name="layers" size={20} />
          <div>
            <strong>{sensorLabel(sensor)} activity is not available</strong>
            <p>
              {unavailableMessage(sensor)} Calendar values, comparisons and anomaly flags are
              unavailable for this mode; raw sensor details remain visible.
            </p>
          </div>
          <button className="button secondary" onClick={() => setSensor("ALL")}>
            View All sensors
            <Icon name="arrow" size={14} />
          </button>
        </div>
      )}
      {displayMode === "harmonized" && <HarmonizedSummary sensor={sensor} />}
      {displayMode === "harmonized" && !isAllSensors(sensor) && (
        <div className="hfi-mode-notice" role="status">
          <Icon name="info" size={16} />
          <p>
            The joint index preview requires All Sensors (MODIS + VIIRS). This source selection has
            no joint index; N/A is not zero activity.
          </p>
          <button className="text-link" onClick={() => setDisplayMode("raw")}>
            View raw source counts
            <Icon name="arrow" size={13} />
          </button>
        </div>
      )}
      <div
        className={`kpi-grid burn-summary ${displayMode === "harmonized" ? "hfi-raw-summary" : ""}`}
      >
        {[
          {
            title: "Observed hotspots",
            value: formatCalendarCount(summary.total),
            note: !hasDemoData(sensor)
              ? `${sensorLabel(sensor)} output unavailable`
              : `${isAllSensors(sensor) ? "MODIS + VIIRS · not deduplicated" : `${sensorLabel(sensor)} raw detections`} · demo`,
            icon: "flame" as IconName,
            color: "orange",
          },
          {
            title: "Observation coverage",
            value: !hasDemoData(sensor) ? "N/A" : `${summary.observedDays} / ${filtered.length}`,
            note: `${summary.partialDays} partial · ${summary.zeroDays} observed zero days`,
            icon: "satellite" as IconName,
            color: "yellow",
          },
          {
            title: "Vs. historical average",
            value: signedPercent(summary.deviation),
            note: `${year - 5}–${year - 1} · coverage-matched demo`,
            icon: "chart" as IconName,
            color: "orange",
          },
          {
            title: "Illustrative anomaly days",
            value:
              !hasDemoData(sensor) || !summary.observedDays ? "N/A" : format(summary.anomalyCount),
            note: summary.observedDays
              ? "Demo flag ≥ +35% · not validated"
              : "Not assessed · no observations",
            icon: "alert" as IconName,
            color: "purple",
          },
        ].map((k) => (
          <section className="kpi-card" key={k.title}>
            <div className="kpi-top">
              <span>{k.title}</span>
              <span className={`kpi-icon ${k.color}`}>
                <Icon name={k.icon} size={17} />
              </span>
            </div>
            <div className="kpi-value-row">
              <strong>{k.value}</strong>
            </div>
            <div className="kpi-comparison">
              <span>{k.note}</span>
            </div>
          </section>
        ))}
      </div>
      <div className="hfi-main-grid">
        <HarmonizedCalendar
          year={year}
          onYearChange={changeYear}
          mode={displayMode}
          scope={scope}
          sensor={sensor}
          areaLabel={label}
          period={period}
          onPeriod={reviewPeriod}
        />
        <details className="hfi-daily-details" open={displayMode === "raw"}>
          <summary>
            <Icon name="calendar" size={16} />
            <span>Daily observations &amp; coverage</span>
            <small>Explore the original daily heatmap and observation details</small>
            <Icon name="chevron" size={14} />
          </summary>
          <div className="daily-month-selector">
            <CalendarFilter
              label="Calendar month"
              caption="Month"
              value={month}
              onChange={(v) => {
                changeMonth(Number(v));
              }}
            >
              <option value={-1}>All months</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </CalendarFilter>
          </div>
          <section className="panel burn-annual-panel">
            <PanelTitle
              title={`${year} burning activity`}
              subtitle="Daily satellite detections · all 12 months · UTC"
            >
              <div className="segmented">
                {["Annual heatmap", "Month detail"].map((v) => (
                  <button
                    key={v}
                    aria-pressed={view === v}
                    className={view === v ? "selected" : ""}
                    onClick={() => {
                      setView(v);
                      setHover(null);
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </PanelTitle>
            <div className="burn-calendar-caption">
              <span>
                {!hasDemoData(sensor)
                  ? `${sensorLabel(sensor)} output unavailable`
                  : `${summary.observedDays} observed days · ${filtered.length - summary.observedDays} without observations in selection`}
              </span>
              <span className="burn-day-readout">
                {readout && readoutActivity
                  ? `${dateLabel(readout.date)} · ${readoutActivity.total === null ? (!hasDemoData(sensor) ? "not computed" : "no observations") : `${format(readoutActivity.total)} hotspots`}`
                  : "No days match the current filters"}
              </span>
            </div>
            <div ref={grid} onMouseLeave={() => setHover(null)}>
              {view === "Annual heatmap" ? (
                <div className="burn-heatmap-scroll">
                  <div className="burn-heatmap-inner">
                    <div
                      className="burn-month-labels"
                      style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
                    >
                      {MONTHS.map((m, i) => {
                        const first = days.findIndex((d) => d.month === i);
                        return (
                          <span
                            key={m}
                            className={month === i ? "focused-month" : ""}
                            style={{
                              gridColumn: `${Math.floor((first + yearOffset) / 7) + 1} / span 3`,
                            }}
                          >
                            {m.slice(0, 3)}
                          </span>
                        );
                      })}
                    </div>
                    <div className="burn-heatmap-body">
                      <div className="burn-weekday-labels">
                        {["Mon", "", "Wed", "", "Fri", "", ""].map((v, i) => (
                          <span key={i}>{v}</span>
                        ))}
                      </div>
                      <div
                        className="burn-heatmap-grid"
                        aria-label={`${year} annual activity calendar`}
                        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
                      >
                        {Array.from({ length: weeks * 7 }, (_, i) => {
                          const day = days[i - yearOffset];
                          return day ? (
                            renderDay(day)
                          ) : (
                            <span className="burn-day-padding" key={`pad${i}`} />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="burn-month-detail">
                  <div className="burn-month-navigation">
                    <button
                      className="icon-button"
                      aria-label="Previous calendar month"
                      disabled={detailMonth === 0}
                      onClick={() => changeMonth(detailMonth - 1)}
                    >
                      <span className="burn-chevron-prev">
                        <Icon name="chevron" />
                      </span>
                    </button>
                    <strong>
                      {MONTHS[detailMonth]} {year}
                    </strong>
                    <button
                      className="icon-button"
                      aria-label="Next calendar month"
                      disabled={detailMonth === 11}
                      onClick={() => changeMonth(detailMonth + 1)}
                    >
                      <span className="burn-chevron-next">
                        <Icon name="chevron" />
                      </span>
                    </button>
                  </div>
                  <div className="burn-month-grid">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                      <strong key={d}>{d}</strong>
                    ))}
                    {Array.from({ length: detailDays[0].weekday }, (_, i) => (
                      <span key={`pad${i}`} />
                    ))}
                    {detailDays.map((d) => renderDay(d, true))}
                  </div>
                </div>
              )}
            </div>
            {view === "Annual heatmap" && (
              <div className="burn-scroll-hint">
                <Icon name="arrow" size={12} />
                Scroll horizontally to explore all 12 months
              </div>
            )}
            <div className="burn-calendar-legend">
              <div className="burn-intensity-legend">
                <span className="burn-legend-title">Daily intensity</span>
                {["Low", "Low–moderate", "Moderate", "High", "Extreme"].map((label, index) => (
                  <span key={label}>
                    <i className={`burn-legend-cell burn-level-${index + 1}`} />
                    {label}
                  </span>
                ))}
                <span className="burn-legend-relative">Relative to selected observations</span>
              </div>
              <div className="burn-quality-legend">
                <span className="burn-legend-title">Observation states</span>
                <span>
                  <i className="burn-legend-cell burn-zero" />
                  Observed zero
                </span>
                <span>
                  <i className="burn-legend-cell burn-missing" />
                  No observations
                </span>
                <span>
                  <i className="burn-legend-cell burn-anomaly-example">
                    <i className="burn-anomaly-mark" />
                  </i>
                  Demo anomaly
                </span>
                <span>
                  <i className="burn-legend-cell burn-partial-example" />
                  Partial sensor coverage
                </span>
                {!hasDemoData(sensor) && (
                  <span>
                    <i className="burn-legend-cell burn-not-computed" />
                    Not computed
                  </span>
                )}
              </div>
            </div>
            <div className="history-note">
              <Icon name="info" size={13} />
              <span>
                Each square is one UTC day. Use arrow keys to navigate; select a day for details.
                Hatched squares are missing observations, not zero detections. Dimmed days are
                outside your filters. Partial coverage is included only for available sensors. Demo
                archive ends {dateLabel(CALENDAR_CUTOFF)}; later dates have no observations.
              </span>
            </div>
            {!filtered.length && (
              <div className="burn-no-selection" role="status">
                <p>No days match the month and date-range combination.</p>
                <button className="text-link" onClick={reset}>
                  Reset filters
                  <Icon name="arrow" size={12} />
                </button>
              </div>
            )}
          </section>
        </details>
        <div className="hfi-map-column" ref={mapColumn}>
          {inspectedScenario && (
            <div className="priority-inspector" role="status">
              <div>
                <span>INSPECTING DEMO AOI</span>
                <strong>
                  {inspectedScenario.region} · {inspectedScenario.biome}
                </strong>
                <p>
                  {inspectedScenario.pattern} · {inspectedScenario.status} scenario. Polygon
                  coordinates are schematic, not a validated incident boundary.
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="Close priority AOI details"
                onClick={() => setInspectedScenario(null)}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          )}
          <div className="explorer-map-context" role="status">
            <Icon name="target" size={15} />
            <strong>{label}</strong>
            <span className="priority-viewport-label">{mapRegion} viewport</span>
            <span>
              {mapDate
                ? `Selected day: ${dateLabel(mapDate)}`
                : `Map follows ${month >= 0 ? MONTHS[month] + " " : ""}${dateLabel(start)} – ${dateLabel(end)}`}{" "}
              · UTC
            </span>
            {mapDate && (
              <button
                className="text-link"
                onClick={() => {
                  setMapDate(null);
                  commitPeriod(`${start}/${end}`);
                }}
              >
                Show full selected period
              </button>
            )}
          </div>
          <FireMap
            region={mapRegion}
            setRegion={(name) => {
              const nextScope: CalendarScope = {
                kind: name === "Global" ? "Global" : "Continent",
                name,
              };
              onAreaChange(null);
              setScope(nextScope);
              setMapOverride({ scopeKey: JSON.stringify(nextScope), region: name });
            }}
            anomalyPreview={displayMode === "harmonized" && isAllSensors(sensor)}
            initialAreaTool={displayMode === "harmonized" ? "Polygon" : "Pan"}
            focusRequest={mapFocus}
            period={period}
            sensorFilter={sensor}
            units="Metric (km)"
            large
            areaSelection={{
              value: area,
              onChange: (value) => {
                const nextScope = selectionScope(value);
                onAreaChange(value);
                onScopeChange(nextScope);
                setMapOverride((previous) => ({
                  scopeKey: JSON.stringify(nextScope),
                  region: value === null && previous?.region === "Global" ? "Global" : mapRegion,
                }));
                setInspectedScenario(null);
                setMapFocus(null);
              },
            }}
          />
          <p className="explorer-footnote">
            Selected shapes define a demo workspace, not a scientific clipping result. The spatial
            markers are illustrative samples, not dated acquisitions. Area-specific observations,
            validated clipping and uncertainty await the backend adapter.
          </p>
        </div>
      </div>
      <PriorityAnomalyTable
        period={period}
        sensor={sensor}
        scope={scope}
        selectedId={inspectedScenario?.id}
        onInspect={inspectScenario}
        onSamplePeriod={() => {
          setScope({ kind: "Continent", name: "South America" });
          setMapOverride(null);
          setDisplayMode("harmonized");
          reviewPeriod(CALENDAR_CUTOFF, CALENDAR_CUTOFF);
        }}
      />
      <ExplorerHistory
        scope={scope}
        sensor={sensor}
        endYear={year}
        month={month}
        onPeriod={reviewPeriod}
      />
      <div className="burn-analysis-grid">
        <CalendarMonthlyComparison
          summary={summary}
          year={year}
          sensor={sensor}
          onMonth={changeMonth}
        />
        <CalendarDayDetail day={selected} sensor={sensor} />
      </div>
      <CalendarInsights
        summary={summary}
        sensor={sensor}
        onMonth={changeMonth}
        onDay={inspectDay}
        onPeriod={reviewPeriod}
        reset={!hasDemoData(sensor) ? () => setSensor("ALL") : reset}
      />
      <div className="burn-method-note">
        <Icon name="info" size={14} />
        <p>
          <strong>Research demonstration, not operational intelligence.</strong> Date selection is
          shared with the dashboard; the annual heatmap displays the end year of cross-year
          selections. All values and baselines are synthetic. Geographic filters are illustrative;
          harmonization and scientific anomaly detection are not implemented.
        </p>
        <button className="text-link" onClick={onInfo}>
          About demo data
          <Icon name="arrow" size={12} />
        </button>
      </div>
      <span className="burn-selection-announcement" aria-live="polite">
        {selected
          ? `Selected ${dateLabel(selected.date, true)}. ${formatCalendarCount(selectedActivity?.total ?? null)} hotspots. ${selectedActivity?.classification}.`
          : "No day selected."}
      </span>
    </div>
  );
}
