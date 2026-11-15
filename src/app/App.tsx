import { lazy, Suspense, useEffect, useRef, useState } from "react";
import ForecastPage, { ForecastSummary } from "../features/forecast/components/ForecastPage";
import AnomalyScan from "../features/history/components/AnomalyScan";
import HistoricalAnalysis from "../features/history/components/HistoricalAnalysis";
import { ApiUnavailable, AreaPicker } from "../features/history/components/HistoryParts";
import {
  PeriodChart,
  PeriodKpis,
  type Period,
} from "../features/history/components/PeriodOverview";
import { isDateRange } from "../features/history/date-selection/date-range";
import DateCalendar from "../features/history/date-selection/DateCalendar";
import { DEFAULT_AREA, lastDays, type AreaChoice } from "../features/history/model/area";
import { coverageEnd, longDate, type Meta } from "../features/history/model/history-view";
import LiveFiresTable from "../features/live/components/LiveFiresTable";
import FireMapPanel from "../features/map/components/FireMapPanel";
import SatelliteSources from "../features/sensors/SatelliteSources";
import SensorHarmonization from "../features/sensors/SensorHarmonization";
import WorkspaceSettings from "../features/settings/WorkspaceSettings";
import { SourceStatus } from "../features/system/components/SystemStatus";
import { useApi } from "../shared/api/useApi";
import { Icon, PanelTitle } from "../shared/ui/ui";
import { historyApi } from "./api";
import AboutDialog from "./components/AboutDialog";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import WorkspaceTopbar from "./components/WorkspaceTopbar";
import { titles, type WorkspacePage } from "./navigation";

import "../features/history/styles/history-workspace.css";

const HistoryWorkspace = lazy(() => import("../features/history/components/HistoryWorkspace"));

const TOAST_DURATION_MS = 4000;
/** Pages that use the shared area and period filters in the header. */
const FILTERED: WorkspacePage[] = ["Overview", "Fire Map", "Historical Analysis"];

export default function App() {
  const [page, setPage] = useState<WorkspacePage>("Overview");
  const meta = useApi((signal) => historyApi.getMeta({ signal }), []);
  const [area, setArea] = useState<AreaChoice>(DEFAULT_AREA);
  const [period, setPeriod] = useState<Period | null>(null);
  // Default period: the last 30 days of the record, once the API says where it ends.
  useEffect(() => {
    if (meta.data && !period) setPeriod(lastDays(coverageEnd(meta.data), 30));
  }, [meta.data, period]);

  const [menu, setMenu] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const [info, setInfo] = useState(false);
  const [toast, setToast] = useState("");
  const [units, setUnits] = useState("Metric (km)");
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimeout.current !== null) clearTimeout(toastTimeout.current);
    },
    [],
  );
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

  const navigate = (p: WorkspacePage) => {
    setPage(p);
    setMenu(false);
    setNotifications(false);
    setProfile(false);
  };
  const notify = (message: string) => {
    if (toastTimeout.current !== null) clearTimeout(toastTimeout.current);
    setToast(message);
    toastTimeout.current = setTimeout(() => {
      setToast("");
      toastTimeout.current = null;
    }, TOAST_DURATION_MS);
  };
  const periodValue = period ? `${period.start}/${period.end}` : "";
  const applyPeriod = (value: string) => {
    if (!isDateRange(value)) return;
    const [start, end] = value.split("/") as [string, string];
    const last = meta.data ? coverageEnd(meta.data) : end;
    setPeriod({ start, end: end > last ? last : end });
    if (end > last) notify(`The record ends on ${longDate(last)}; the period was cut there.`);
  };

  const ready: { meta: Meta; period: Period } | null =
    meta.status === "success" && period ? { meta: meta.data, period } : null;
  const showFilters = FILTERED.includes(page);

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
          navigate={navigate}
          onOpenInfo={() => setInfo(true)}
          onOpenMenu={() => setMenu(true)}
        />
        <div className={`page-content ${page === "Fire Map" ? "fire-map-workspace" : ""}`}>
          <header className="page-header">
            <div>
              <div className="eyebrow">
                <span /> NASA FIRMS · MODIS + VIIRS · BRAZIL
              </div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            {showFilters && ready && (
              <div className="header-filters">
                <AreaPicker meta={ready.meta} value={area} onChange={setArea} />
                <DateCalendar value={periodValue} onApply={applyPeriod} />
              </div>
            )}
          </header>

          {meta.status === "error" && page !== "Settings" && (
            <ApiUnavailable error={meta.error} onRetry={meta.reload} />
          )}
          {meta.status !== "error" && !ready && page !== "Settings" && (
            <section className="panel hw-state" role="status">
              Loading the record from the API…
            </section>
          )}

          {ready && page === "Overview" && (
            <>
              <PeriodKpis area={area} period={ready.period} />
              <div className="hw-overview-row">
                <FireMapPanel area={area} period={ready.period} />
                <ForecastSummary onOpen={() => navigate("Risk Forecast")} />
              </div>
              <PeriodChart area={area} period={ready.period} />
              <LiveFiresTable limit={6} />
            </>
          )}
          {ready && page === "Fire Map" && (
            <>
              <FireMapPanel area={area} period={ready.period} large />
              <LiveFiresTable />
            </>
          )}
          {ready && page === "Burning Calendar" && (
            <Suspense
              fallback={
                <section className="panel hw-state" role="status">
                  Loading the burning activity calendar…
                </section>
              }
            >
              <HistoryWorkspace meta={ready.meta} area={area} onAreaChange={setArea} />
            </Suspense>
          )}
          {ready && page === "Historical Analysis" && (
            <>
              <PeriodKpis area={area} period={ready.period} />
              <HistoricalAnalysis meta={ready.meta} area={area} />
              <SensorHarmonization meta={ready.meta} />
            </>
          )}
          {ready && page === "Anomaly Alerts" && (
            <AnomalyScan
              meta={ready.meta}
              onOpenBiome={(biome) => {
                setArea({ kind: "biome", biome });
                navigate("Burning Calendar");
              }}
            />
          )}
          {ready && page === "Risk Forecast" && <ForecastPage />}
          {ready && page === "Alert Center" && <AlertCenterGap navigate={navigate} />}
          {ready && page === "Data Sources" && (
            <>
              <SourceStatus meta={ready.meta} />
              <SensorHarmonization meta={ready.meta} />
              <SatelliteSources onInfo={() => setInfo(true)} />
            </>
          )}
          {page === "Settings" && (
            <WorkspaceSettings
              preferences={{ period: periodValue, units, alerts: alertsEnabled }}
              onApply={(p) => {
                applyPeriod(p.period);
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
              NASA Space Apps Challenge 2026 <span className="footer-dot">·</span> Data: NASA FIRMS,
              NOAA GOES
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

function AlertCenterGap({ navigate }: { navigate: (page: WorkspacePage) => void }) {
  return (
    <section className="panel">
      <PanelTitle
        title="No alert feed from the backend yet"
        subtitle="The API does not issue, store or deliver alerts. Nothing is shown here rather than made-up advisories."
      />
      <ul className="hw-facts">
        <li>
          Unusual months per biome are computed on request in{" "}
          <button className="text-link" onClick={() => navigate("Anomaly Alerts")}>
            Anomaly Alerts
          </button>
          .
        </li>
        <li>
          The 7-day probability of fire detection per cell is in{" "}
          <button className="text-link" onClick={() => navigate("Risk Forecast")}>
            Risk Forecast
          </button>
          .
        </li>
        <li>Fires burning now are in the Live fires table on Overview and Fire Map.</li>
      </ul>
    </section>
  );
}
