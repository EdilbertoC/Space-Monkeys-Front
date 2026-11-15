import { useState } from "react";
import { Icon, PanelTitle } from "../../shared/ui/ui";
import { AlertList, AssessmentTrend, DataBoundary, DataState, RiskBadge } from "./components";
import { previousComparable, validityLabel } from "./presentation";
import type { PreventionController } from "./usePrevention";

export function PreventionSummary({
  controller,
  onForecast,
  onAlerts,
}: {
  controller: PreventionController;
  onForecast: () => void;
  onAlerts: () => void;
}) {
  const data = controller.payload;
  const windowId =
    data?.forecastWindows.find((w) => w.id === controller.windowId)?.id ??
    data?.forecastWindows[0]?.id;
  const assessments = data?.currentAssessments.filter((a) => a.validityId === windowId) ?? [];
  const attention = assessments.filter((a) => a.requiresAttention).length;
  const increasing =
    data && assessments.some((a) => previousComparable(a, data))
      ? assessments.filter((a) => a.trend.direction === "increasing" && previousComparable(a, data))
          .length
      : null;
  const stateLabel = {
    loading: "Loading preventive context",
    success: "Supplier-provided assessments",
    empty: "No prevention records supplied",
    insufficient: "Insufficient assessment data",
    unavailable: "Prevention data unavailable",
    error: "Prevention data source error",
    demonstration: "Synthetic scenarios · not live risk",
  }[controller.resource.status];
  return (
    <div
      className="prevention-summary"
      aria-label="Prevention monitoring summary"
      data-state={controller.resource.status}
    >
      <span>
        <Icon name="target" size={16} />
        <strong>Preventive monitoring</strong>
      </span>
      <button onClick={onForecast}>
        <b>{assessments.length ? attention : "—"}</b> regions requiring attention
        <Icon name="arrow" size={12} />
      </button>
      <button onClick={onForecast}>
        <b>{increasing ?? "—"}</b> regions with increasing risk
        <Icon name="arrow" size={12} />
      </button>
      <button onClick={onAlerts}>
        <b>{data ? controller.alerts.filter((a) => a.readStatus === "unread").length : "—"}</b>{" "}
        unread preventive alerts
        <Icon name="arrow" size={12} />
      </button>
      <span className="prevention-summary-note" role="status">
        {stateLabel}
      </span>
    </div>
  );
}
export function PreventionOverview({
  controller,
  onRegion,
  onAlert,
  onAlerts,
}: {
  controller: PreventionController;
  onRegion: (regionId: string, windowId?: string) => void;
  onAlert: (id: string) => void;
  onAlerts: () => void;
}) {
  const [filter, setFilter] = useState("attention");
  return (
    <section className="prevention-overview">
      <div className="prevention-section-title">
        <div>
          <h2>Risk & preventive attention</h2>
          <p>Assessments supplied separately from satellite hotspot observations.</p>
        </div>
        <span>
          {controller.payload?.provenance === "demonstration"
            ? "Illustrative scenarios only"
            : "Backend assessment view"}
        </span>
      </div>
      <DataBoundary resource={controller.resource} retry={controller.retry}>
        {(data) => {
          const window =
            data.forecastWindows.find((w) => w.id === controller.windowId) ??
            data.forecastWindows[0];
          const monitored = new Set(
            data.monitoredRegions.filter((m) => m.enabled).map((m) => m.regionId),
          );
          const supplied = data.currentAssessments.filter(
            (a) => monitored.has(a.regionId) && a.validityId === window?.id,
          );
          const visible = supplied.filter(
            (a) =>
              filter === "all" ||
              (filter === "attention" && a.requiresAttention) ||
              (filter === "increasing" &&
                a.trend.direction === "increasing" &&
                previousComparable(a, data)),
          );
          return (
            <div className="prevention-overview-grid">
              <section className="prevention-watchlist">
                <PanelTitle title="Monitored regions">
                  <div className="segmented">
                    {[
                      ["attention", "Requiring attention"],
                      ["increasing", "Increasing"],
                      ["all", "All monitored"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        className={filter === id ? "selected" : ""}
                        aria-pressed={filter === id}
                        onClick={() => setFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </PanelTitle>
                <p className="prevention-period-caption">{validityLabel(window)}</p>
                {!visible.length ? (
                  <DataState
                    status={supplied.length ? "empty" : "insufficient"}
                    compact
                    message={
                      supplied.length
                        ? "No supplied records match this watchlist filter. This does not indicate zero risk."
                        : "No current assessments were supplied for monitored regions in this period."
                    }
                  />
                ) : (
                  <div className="prevention-table-scroll">
                    <table className="prevention-table">
                      <thead>
                        <tr>
                          <th>Region</th>
                          <th>Risk level</th>
                          <th>Supplied trend</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <button
                                className="prevention-region-link"
                                onClick={() => onRegion(a.regionId, a.validityId)}
                              >
                                {data.regions.find((r) => r.id === a.regionId)?.name}
                                <small>
                                  {data.regions.find((r) => r.id === a.regionId)?.country}
                                </small>
                              </button>
                            </td>
                            <td>
                              {a.quality === "sufficient" ? (
                                <RiskBadge level={a.classification} />
                              ) : (
                                <span>Insufficient data</span>
                              )}
                            </td>
                            <td>
                              <AssessmentTrend assessment={a} data={data} />
                            </td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`View forecast for ${data.regions.find((r) => r.id === a.regionId)?.name}`}
                                onClick={() => onRegion(a.regionId, a.validityId)}
                              >
                                <Icon name="arrow" size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="prevention-note">
                  “Requires attention” and trend directions are supplied fields, not computed from
                  hotspot counts. Only comparable assessment references are shown as trends.
                </p>
              </section>
              <section className="prevention-recent">
                <PanelTitle title="Recent preventive alerts">
                  <button className="text-link" onClick={onAlerts}>
                    Alert Center
                    <Icon name="arrow" size={12} />
                  </button>
                </PanelTitle>
                <AlertList
                  alerts={controller.alerts.slice(0, 3)}
                  data={data}
                  onSelect={onAlert}
                  compact
                />
                <p className="prevention-note">
                  Illustrative records in preview mode. Alert generation and delivery are backend
                  responsibilities.
                </p>
              </section>
            </div>
          );
        }}
      </DataBoundary>
    </section>
  );
}
