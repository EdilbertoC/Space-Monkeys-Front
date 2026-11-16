// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import { lazy, Suspense, useEffect, useState } from "react";
import ProjectCredits from "../features/credits/ProjectCredits";
import ForecastPage from "../features/forecast/components/ForecastPage";
import AnomalyScan from "../features/history/components/AnomalyScan";
import HistoricalAnalysis from "../features/history/components/HistoricalAnalysis";
import { ApiUnavailable, AreaPicker } from "../features/history/components/HistoryParts";
import { DEFAULT_AREA, type AreaChoice } from "../features/history/model/area";
import type { Meta } from "../features/history/model/history-view";
import LiveNow from "../features/live/components/LiveNow";
import TerritoryPage from "../features/territory/components/TerritoryPage";
import SatelliteSources from "../features/sensors/SatelliteSources";
import SensorHarmonization from "../features/sensors/SensorHarmonization";
import WorkspaceSettings from "../features/settings/WorkspaceSettings";
import { SourceStatus } from "../features/system/components/SystemStatus";
import { useApi } from "../shared/api/useApi";
import { historyApi } from "./api";
import AboutDialog from "./components/AboutDialog";
import WorkspaceSidebar from "./components/WorkspaceSidebar";
import WorkspaceTopbar from "./components/WorkspaceTopbar";
import { pages, titles, type WorkspacePage } from "./navigation";
import { formatArea, parseArea, readParam, writeParams } from "./url-state";

import "../features/history/styles/history-workspace.css";

const HistoryWorkspace = lazy(() => import("../features/history/components/HistoryWorkspace"));

/** Pages that use the shared area filter in the header. */
const FILTERED: WorkspacePage[] = ["Overview", "Historical Analysis", "Risk Forecast"];

/** Territory is the landing page; a shared link can open any page. */
function initialPage(): WorkspacePage {
  // The Fire map page is now part of "Fires now" (Overview); old links open it.
  const view = readParam("view") === "Fire Map" ? "Overview" : readParam("view");
  return pages.find((p) => p.name === view)?.name ?? "Territory";
}

export default function App() {
  const [page, setPage] = useState<WorkspacePage>(initialPage);
  const meta = useApi((signal) => historyApi.getMeta({ signal }), []);
  const [area, setArea] = useState<AreaChoice>(() => parseArea(readParam("area")) ?? DEFAULT_AREA);
  useEffect(() => writeParams({ view: page, area: formatArea(area) }), [page, area]);
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [units, setUnits] = useState("Metric (km)");
  const [alertsEnabled, setAlertsEnabled] = useState(true);
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
  const ready: { meta: Meta } | null = meta.status === "success" ? { meta: meta.data } : null;
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
        <div className="page-content">
          <header className="page-header">
            <div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            {showFilters && ready && (
              <div className="header-filters">
                <AreaPicker meta={ready.meta} value={area} onChange={setArea} />
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

          {/* Fires now: live VIIRS detections only (no MODIS, no GOES, no fused events). */}
          {ready && page === "Overview" && <LiveNow meta={ready.meta} area={area} />}
          {ready && page === "Territory" && (
            <TerritoryPage meta={ready.meta} area={area} onAreaChange={setArea} />
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
          {ready && page === "Risk Forecast" && <ForecastPage area={area} />}
          {ready && page === "Data Sources" && (
            <>
              <SourceStatus meta={ready.meta} />
              <SensorHarmonization meta={ready.meta} />
              <SatelliteSources onInfo={() => setInfo(true)} />
            </>
          )}
          {page === "Data Sources" && <ProjectCredits />}
          {page === "Settings" && (
            <WorkspaceSettings
              preferences={{ units, alerts: alertsEnabled }}
              onApply={(p) => {
                setUnits(p.units);
                setAlertsEnabled(p.alerts);
              }}
            />
          )}
          <footer className="page-footer">
            <span>Solis · Space Monkeys · NASA Space Apps Challenge 2026</span>
            <span>
              Data: NASA FIRMS (MODIS C6.1, VIIRS 375 m), NOAA GOES-19 ABI, IBGE biomes 2019
            </span>
          </footer>
        </div>
      </main>
      {info && <AboutDialog onClose={() => setInfo(false)} />}
    </div>
  );
}
