import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import ActivityTimeline from "../features/history/components/ActivityTimeline";
import RecentActivityTable from "../features/history/components/RecentActivityTable";
import { getObservation } from "../features/history/demo/demo-data";
import { filterRecentActivity } from "../features/history/demo/recent-activity";
import { REGION_FACTORS } from "../features/history/demo/region-factors";
import FireMap from "../features/map/components/FireMap";
import SatelliteSources from "../features/sensors/SatelliteSources";
import {
  SensorFilter,
  SensorLayersProvider,
  SensorUnavailable,
} from "../features/sensors/SensorControls";
import SensorHarmonization from "../features/sensors/SensorHarmonization";
import {
  hasDemoData,
  matchesSensor,
  unavailableMessage,
  type SensorSelection,
} from "../features/sensors/sensors";
import WorkspaceSettings from "../features/settings/WorkspaceSettings";
import { GLOBAL_REGIONS } from "../shared/constants/geography";
import { downloadCsv } from "../shared/lib/download-csv";
import DataStatus from "../shared/ui/DataStatus";
import SelectControl from "../shared/ui/SelectControl";
import { Dot, Icon } from "../shared/ui/ui";
import AboutDialog from "./components/AboutDialog";
import ObservationKpis from "./components/ObservationKpis";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import WorkspaceTopbar from "./components/WorkspaceTopbar";
import { titles, type WorkspacePage } from "./navigation";

import AnomalyAlerts, {
  AnomalyBanner,
  type AnomalyStatus,
} from "../features/history/components/AnomalyAlerts";
import {
  DEFAULT_DATES,
  isDateRange,
  resolveObservationPeriod,
} from "../features/history/date-selection/date-range";
import DateCalendar from "../features/history/date-selection/DateCalendar";
import { CALENDAR_CUTOFF, type CalendarScope } from "../features/history/demo/calendar-data";
import {
  getDemoAnomalies,
  latestDemoYear,
  type AreaSelection,
  type DemoAnomaly,
} from "../features/history/demo/exploration";
import AlertCenter from "../features/prevention-demo/AlertCenter";
import { PreventionToolbar } from "../features/prevention-demo/components";
import { PreventionOverview, PreventionSummary } from "../features/prevention-demo/Overview";
import RiskForecast from "../features/prevention-demo/RiskForecast";
import { usePrevention } from "../features/prevention-demo/usePrevention";

import "../features/prevention-demo/prevention.css";
import "../features/history/styles/exploration.css";

const BurningActivityCalendar = lazy(
  () => import("../features/history/components/BurningActivityCalendar"),
);

const TOAST_DURATION_MS = 4000;

export default function App() {
  return (
    <SensorLayersProvider>
      <OrbitBurn />
    </SensorLayersProvider>
  );
}
function OrbitBurn() {
  const [page, setPage] = useState<WorkspacePage>("Overview");
  const prevention = usePrevention();
  const isPreventionPage = page === "Risk Forecast" || page === "Alert Center";
  const [forecastMapRegion, setForecastMapRegion] = useState("South America");
  const forecastRegion =
    prevention.payload?.regions.find((r) => r.id === prevention.selectedRegionId) ??
    prevention.payload?.regions[0];
  useEffect(() => {
    const context = forecastRegion?.observationContext;
    setForecastMapRegion(context && GLOBAL_REGIONS.includes(context) ? context : "Global");
  }, [forecastRegion?.id, forecastRegion?.observationContext]);
  const [region, updateRegion] = useState("Global");
  const [calendarScope, updateCalendarScope] = useState<CalendarScope>({
    kind: "Global",
    name: "Global",
  });
  const [area, setArea] = useState<AreaSelection | null>(null);
  const setRegion = (name: string) => {
    updateRegion(name);
    updateCalendarScope({ kind: name === "Global" ? "Global" : "Continent", name });
    setArea(null);
  };
  const setCalendarScope = (scope: CalendarScope) => {
    updateCalendarScope(scope);
    updateRegion(scope.kind === "Continent" ? scope.name : "Global");
  };
  const [sensor, setSensor] = useState<SensorSelection>("ALL");
  const [period, updatePeriod] = useState(DEFAULT_DATES);
  const setPeriod = (value: string) => {
    const next = resolveObservationPeriod(value);
    updatePeriod(next);
    if (isDateRange(next)) setYear(next.slice(-10, -6));
  };
  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [info, setInfo] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimeout.current !== null) clearTimeout(toastTimeout.current);
    },
    [],
  );
  const [year, setYear] = useState(String(latestDemoYear));
  const [anomalyStatuses, setAnomalyStatuses] = useState<Record<string, AnomalyStatus>>({});
  const [dismissedAnomalies, setDismissedAnomalies] = useState<string[]>([]);
  const anomalyResults = useMemo(
    () => getDemoAnomalies(calendarScope, period, sensor),
    [calendarScope, period, sensor],
  );
  const primaryAnomaly = anomalyResults.find((a) => (anomalyStatuses[a.id] ?? "Open") === "Open");
  const bannerAnomaly =
    primaryAnomaly && !dismissedAnomalies.includes(primaryAnomaly.id) ? primaryAnomaly : null;
  const [units, setUnits] = useState("Metric (km)");
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setInfo(false);
        setProfile(false);
        setNotifications(false);
        setMenu(false);
      }
      if (event.key === "Tab" && info) {
        const focusable = document.querySelectorAll<HTMLButtonElement>(".info-modal button");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [info]);
  const observation = getObservation(period, REGION_FACTORS[region], sensor);
  const sourceAvailability = {
    MODIS: getObservation(period, REGION_FACTORS[region], "MODIS").hasObservations,
    VIIRS: getObservation(period, REGION_FACTORS[region], "VIIRS").hasObservations,
  };
  const navigate = (p: WorkspacePage) => {
    setPage(p);
    setMenu(false);
    setNotifications(false);
    setProfile(false);
  };
  const openForecast = (regionId?: string, windowId?: string) => {
    if (regionId) prevention.setSelectedRegionId(regionId);
    if (windowId) prevention.setWindowId(windowId);
    navigate("Risk Forecast");
  };
  const openPreventiveAlert = (id: string) => {
    prevention.setSelectedAlertId(id);
    navigate("Alert Center");
  };
  const notify = (message: string) => {
    if (toastTimeout.current !== null) clearTimeout(toastTimeout.current);
    setToast(message);
    toastTimeout.current = setTimeout(() => {
      setToast("");
      toastTimeout.current = null;
    }, TOAST_DURATION_MS);
  };
  const openAnomaly = (alert: DemoAnomaly) => {
    setPeriod(`${alert.date}/${alert.date}`);
    navigate("Burning Calendar");
  };
  const exportData = () => {
    const modisObservation = getObservation(period, REGION_FACTORS[region], "MODIS");
    const viirsObservation = getObservation(period, REGION_FACTORS[region], "VIIRS");
    const rows = filterRecentActivity(region, period, sensor);
    const csv = [
      "OrbitBurn — ILLUSTRATIVE DEMO DATA,Not connected to live NASA feeds",
      `Region filter,${region}`,
      `Sensor filter,${sensor}`,
      `Source status,${hasDemoData(sensor) ? "Illustrative MODIS/VIIRS data only; no live integration" : unavailableMessage(sensor)}`,
      "SENTINEL3_SLSTR observations,N/A — planned; not integrated",
      "GOES_ABI observations,N/A — planned; not integrated",
      `Observation window,${period}`,
      `Window start (UTC),${observation.start}`,
      `Window end (UTC),${observation.end}`,
      `MODIS demo detections,${matchesSensor(sensor, "MODIS") && modisObservation.hasObservations ? modisObservation.modis : "N/A — unavailable or not selected"}`,
      `VIIRS demo detections,${matchesSensor(sensor, "VIIRS") && viirsObservation.hasObservations ? viirsObservation.viirs : "N/A — unavailable or not selected"}`,
      `Combined demo detections (not deduplicated),${observation.hasObservations ? observation.total : "N/A — no observations"}`,
      "Regional rows,Illustrative sample only; not exhaustive",
      "Region,Detection date,Time,Sensor,Hotspots,Activity level",
      ...rows.map(
        (r) =>
          `"${r.region}",${r.date.replace(",", "")},${r.time},${r.sensor},${Math.round(r.count * getObservation(period).multiplier)},${r.level}`,
      ),
    ].join("\n");
    downloadCsv(csv, `orbitburn-demo-${region.toLowerCase().replace(/ /g, "-")}.csv`);
    notify("Illustrative activity data exported as CSV.");
  };

  return (
    <div className="app-shell">
      {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} />}
      <WorkspaceSidebar menu={menu} page={page} navigate={navigate} />
      <main className="main-content">
        <WorkspaceTopbar
          page={page}
          notifications={notifications}
          setNotifications={setNotifications}
          profile={profile}
          setProfile={setProfile}
          alertsEnabled={alertsEnabled}
          prevention={prevention}
          openPreventiveAlert={openPreventiveAlert}
          navigate={navigate}
          setRegion={setRegion}
          onOpenInfo={() => setInfo(true)}
          onOpenMenu={() => setMenu(true)}
        />
        <div className={`page-content ${page === "Fire Map" ? "fire-map-workspace" : ""}`}>
          <header className="page-header">
            <div>
              <div className="eyebrow">
                <span /> PLANETARY PERSPECTIVE. ACTIONABLE INTELLIGENCE.
              </div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            {page !== "Burning Calendar" && !isPreventionPage && (
              <div className="header-filters">
                <SelectControl label="Global region filter" value={region} onChange={setRegion}>
                  {GLOBAL_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r === "Global" ? "Global regions" : r}
                    </option>
                  ))}
                </SelectControl>
                <SensorFilter value={sensor} onChange={setSensor} harmonized />
                <DateCalendar value={period} onApply={setPeriod} />
              </div>
            )}
          </header>
          <DataStatus />
          {(page === "Overview" || isPreventionPage) && (
            <PreventionToolbar controller={prevention} periodControl={page !== "Alert Center"} />
          )}
          {page !== "Burning Calendar" && !isPreventionPage && (
            <div className="observation-bar">
              <span>
                <Dot /> Observation window{" "}
                <strong title={observation.exactLabel}>{observation.dateLabel}</strong>
                <span className="utc-tag">UTC</span>
              </span>
              <span>
                <Icon name="info" size={13} /> Illustrative demo data. Not for operational use.
                <button onClick={exportData}>
                  <Icon name="download" size={14} /> Export data
                </button>
              </span>
            </div>
          )}
          {page !== "Burning Calendar" && !isPreventionPage && (
            <SensorUnavailable selection={sensor} />
          )}
          {page === "Overview" && bannerAnomaly && (
            <AnomalyBanner
              alert={bannerAnomaly}
              onOpen={openAnomaly}
              onDismiss={() => setDismissedAnomalies((previous) => [...previous, bannerAnomaly.id])}
            />
          )}
          {page === "Overview" && (
            <PreventionSummary
              controller={prevention}
              onForecast={() => openForecast()}
              onAlerts={() => navigate("Alert Center")}
            />
          )}
          {(page === "Overview" || page === "Historical Analysis") && (
            <ObservationKpis
              observation={observation}
              sensor={sensor}
              sourceAvailability={sourceAvailability}
            />
          )}
          {(page === "Overview" || page === "Fire Map") && (
            <FireMap
              region={region}
              setRegion={setRegion}
              period={period}
              large={page === "Fire Map"}
              units={units}
              sensorFilter={sensor}
            />
          )}
          {page === "Overview" && (
            <PreventionOverview
              controller={prevention}
              onRegion={openForecast}
              onAlert={openPreventiveAlert}
              onAlerts={() => navigate("Alert Center")}
            />
          )}
          {page === "Overview" && (
            <>
              <div className="analytics-row">
                <ActivityTimeline
                  sensor={sensor}
                  factor={REGION_FACTORS[region]}
                  period={period}
                  onPeriodChange={setPeriod}
                />
                <SatelliteSources
                  period={period}
                  regionScale={REGION_FACTORS[region]}
                  sensor={sensor}
                  onInfo={() => setInfo(true)}
                />
              </div>
              <SensorHarmonization />
              <RecentActivityTable
                region={region}
                total={observation.total}
                period={period}
                sensor={sensor}
                onSelect={(r) => {
                  setRegion(r);
                  navigate("Fire Map");
                }}
              />
            </>
          )}
          {page === "Fire Map" && (
            <RecentActivityTable
              region={region}
              total={observation.total}
              period={period}
              sensor={sensor}
              onSelect={setRegion}
            />
          )}
          {page === "Burning Calendar" && (
            <Suspense
              fallback={
                <section className="panel calendar-loading" role="status">
                  Loading the illustrative calendar archive…
                </section>
              }
            >
              <BurningActivityCalendar
                onNotify={notify}
                onInfo={() => setInfo(true)}
                period={period}
                onPeriodChange={setPeriod}
                sensor={sensor}
                onSensorChange={setSensor}
                scope={calendarScope}
                onScopeChange={setCalendarScope}
                area={area}
                onAreaChange={setArea}
              />
            </Suspense>
          )}
          {page === "Historical Analysis" && (
            <>
              <div className="analysis-toolbar">
                <div>
                  <h2>Historical observation archive</h2>
                  <p>
                    Illustrative archive · select an end year and date range below. Observation KPIs
                    above retain their selected window.
                  </p>
                  <button className="text-link" onClick={() => navigate("Burning Calendar")}>
                    Open linked calendar &amp; map <Icon name="arrow" size={13} />
                  </button>
                </div>
                <SelectControl
                  label="Historical year"
                  icon="calendar"
                  value={year}
                  onChange={(v) => setPeriod(`${v}-01-01/${v}-12-31`)}
                >
                  {Array.from({ length: latestDemoYear - 2000 }, (_, i) => latestDemoYear - i).map(
                    (y) => (
                      <option key={y}>{y}</option>
                    ),
                  )}
                </SelectControl>
              </div>
              <ActivityTimeline
                endYear={Number(year)}
                factor={REGION_FACTORS[region]}
                period={period}
                onPeriodChange={setPeriod}
                full
                sensor={sensor}
              />
              <div className="insight-panel">
                <Icon name="chart" size={23} />
                <div>
                  <strong>Understanding the signal</strong>
                  <p>
                    VIIRS detects smaller thermal anomalies at 375 m resolution, while MODIS
                    provides a consistent 1 km observation record. Differences in detection counts
                    do not directly represent changes in burned area.
                  </p>
                </div>
                <span className="demo-pill">{year} DEMO</span>
              </div>
              <SensorHarmonization />
            </>
          )}
          {page === "Anomaly Alerts" && (
            <AnomalyAlerts
              alerts={anomalyResults}
              statuses={anomalyStatuses}
              onStatus={(id, status) =>
                setAnomalyStatuses((previous) => ({ ...previous, [id]: status }))
              }
              onOpen={openAnomaly}
              onArchive={() => setPeriod(`${latestDemoYear}-01-01/${CALENDAR_CUTOFF}`)}
            />
          )}
          {page === "Data Sources" && (
            <>
              <SatelliteSources full onInfo={() => setInfo(true)} />
              <SensorHarmonization />
            </>
          )}
          {page === "Risk Forecast" && (
            <RiskForecast
              controller={prevention}
              onRegion={(id) => prevention.setSelectedRegionId(id)}
              map={
                <FireMap
                  key={forecastRegion?.id ?? "global"}
                  region={forecastMapRegion}
                  setRegion={setForecastMapRegion}
                  period={period}
                  units={units}
                  sensorFilter="ALL"
                />
              }
            />
          )}
          {page === "Alert Center" && (
            <AlertCenter controller={prevention} onRegion={openForecast} onNotify={notify} />
          )}
          {page === "Settings" && (
            <WorkspaceSettings
              preferences={{ period, units, alerts: alertsEnabled }}
              onApply={(p) => {
                setPeriod(p.period);
                setUnits(p.units);
                setAlertsEnabled(p.alerts);
              }}
            />
          )}
          <footer className="page-footer">
            <span>
              OrbitBurn <i /> A clearer perspective on a changing planet.
            </span>
            <span>
              NASA Space Apps Challenge 2026 <span className="footer-dot">·</span> Illustrative demo
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast("")}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      {info && <AboutDialog onClose={() => setInfo(false)} />}
    </div>
  );
}
