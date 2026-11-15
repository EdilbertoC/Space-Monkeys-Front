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
import TerritoryPage from "../features/territory/components/TerritoryPage";
import SatelliteSources from "../features/sensors/SatelliteSources";
import SensorHarmonization from "../features/sensors/SensorHarmonization";
import WorkspaceSettings from "../features/settings/WorkspaceSettings";
import { SourceStatus } from "../features/system/components/SystemStatus";
import { useApi } from "../shared/api/useApi";
import { Icon } from "../shared/ui/ui";
import { historyApi } from "./api";
import AboutDialog from "./components/AboutDialog";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import WorkspaceTopbar from "./components/WorkspaceTopbar";
import { pages, titles, type WorkspacePage } from "./navigation";
import { formatArea, parseArea, readParam, writeParams } from "./url-state";

import "../features/history/styles/history-workspace.css";

const HistoryWorkspace = lazy(() => import("../features/history/components/HistoryWorkspace"));

const TOAST_DURATION_MS = 4000;
/** Pages that use the shared area filter in the header, and those that also use the dates. */
const FILTERED: WorkspacePage[] = ["Overview", "Fire Map", "Historical Analysis"];
const DATED: WorkspacePage[] = ["Overview", "Fire Map"];

/** Territory is the landing page; a shared link can open any page. */
function initialPage(): WorkspacePage {
  const view = readParam("view");
  return pages.find((p) => p.name === view)?.name ?? "Territory";
}

export default function App() {
  const [page, setPage] = useState<WorkspacePage>(initialPage);
  const meta = useApi((signal) => historyApi.getMeta({ signal }), []);
  const [area, setArea] = useState<AreaChoice>(() => parseArea(readParam("area")) ?? DEFAULT_AREA);
  useEffect(() => writeParams({ view: page, area: formatArea(area) }), [page, area]);
  const [period, setPeriod] = useState<Period | null>(null);
  // Default period: the last 30 days of the record, once the API says where it ends.
  useEffect(() => {
    if (meta.data && !period) setPeriod(lastDays(coverageEnd(meta.data), 30));
  }, [meta.data, period]);

  const [menu, setMenu] = useState(false);
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
          onOpenInfo={() => setInfo(true)}
          onOpenMenu={() => setMenu(true)}
        />
        <div className={`page-content ${page === "Fire Map" ? "fire-map-workspace" : ""}`}>
          <header className="page-header">
            <div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            {showFilters && ready && (
              <div className="header-filters">
                <AreaPicker meta={ready.meta} value={area} onChange={setArea} />
                {DATED.includes(page) && <DateCalendar value={periodValue} onApply={applyPeriod} />}
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
          {ready && page === "Territory" && (
            <TerritoryPage meta={ready.meta} area={area} onAreaChange={setArea} />
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
              <HistoricalAnalysis meta={ready.meta} area={area} />
              <SensorHarmonization meta={ready.meta} />
            </>
          )}
          {ready && page === "Anomaly Alerts" && (
            <AnomalyScan
              meta={ready.meta}
              onOpenArea={(next) => {
                setArea(next);
                navigate("Burning Calendar");
              }}
            />
          )}
          {ready && page === "Risk Forecast" && <ForecastPage />}
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
            <span>OrbitBurn · Space Monkeys · NASA Space Apps Challenge 2026</span>
            <span>
              Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m), NOAA GOES-19 ABI, IBGE biomes 2019
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
