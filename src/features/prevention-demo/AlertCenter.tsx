import { useEffect, useState } from "react";
import SelectControl from "../../shared/ui/SelectControl";
import { Icon, PanelTitle } from "../../shared/ui/ui";
import { AlertList, DataBoundary, DataState, RiskBadge, TrendLabel } from "./components";
import { dateTime, validityLabel } from "./presentation";
import type { PreventionController } from "./usePrevention";

export default function AlertCenter({
  controller,
  onRegion,
  onNotify,
}: {
  controller: PreventionController;
  onRegion: (id: string, windowId?: string) => void;
  onNotify: (message: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [severity, setSeverity] = useState("all"),
    [region, setRegion] = useState("all"),
    [read, setRead] = useState("all");
  const data = controller.payload;
  const visible = controller.alerts.filter(
    (a) =>
      (severity === "all" || a.severity === severity) &&
      (region === "all" || a.regionId === region) &&
      (read === "all" || a.readStatus === read) &&
      `${a.title} ${a.description} ${data?.regions.find((r) => r.id === a.regionId)?.name ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selected = visible.find((a) => a.id === controller.selectedAlertId) ?? visible[0];
  useEffect(() => {
    if (controller.selectedAlertId && !visible.some((a) => a.id === controller.selectedAlertId)) {
      setSearch("");
      setSeverity("all");
      setRegion("all");
      setRead("all");
    }
    // Selecting from the bell can open an alert that was outside this page's local filters.
    // Subsequent read-state changes do not reset a user's active filter.
  }, [controller.selectedAlertId]);
  return (
    <div className="alert-center-page">
      <div className="alert-center-controls">
        <label className="alert-search">
          <Icon name="search" size={15} />
          <input
            aria-label="Search preventive alerts"
            placeholder="Search alerts or regions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Severity
          <select
            aria-label="Alert severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {["all", "critical", "high", "moderate", "low", "unknown"].map((v) => (
              <option key={v} value={v}>
                {v === "all"
                  ? "All severities"
                  : v === "unknown"
                    ? "Not assessed"
                    : v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region
          <SelectControl label="Alert region" value={region} onChange={setRegion}>
            <option value="all">All regions</option>
            {data?.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </SelectControl>
        </label>
        <label>
          Read status
          <select
            aria-label="Alert read status"
            value={read}
            onChange={(e) => setRead(e.target.value)}
          >
            <option value="all">All alerts</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </label>
        <button
          className="button secondary"
          disabled={!visible.some((a) => a.readStatus === "unread")}
          onClick={() => {
            visible.forEach((a) => controller.setRead(a.id, "read"));
            onNotify("Visible alerts marked read for this session only.");
          }}
        >
          Mark visible read
        </button>
      </div>
      <DataBoundary resource={controller.resource} retry={controller.retry}>
        {(payload) => (
          <>
            <div className="alert-center-caption">
              <span>
                {visible.length} supplied alert record(s) in this selection ·{" "}
                {payload.provenance === "demonstration"
                  ? "synthetic demonstration"
                  : "backend response"}
              </span>
              <span>Feed updated {dateTime(payload.updatedAt)}</span>
            </div>
            <div className="alert-center-workspace">
              <section className="alert-center-feed">
                <PanelTitle title="Preventive alert records" />
                <AlertList
                  alerts={visible}
                  data={payload}
                  onSelect={controller.setSelectedAlertId}
                />
              </section>
              <section className="preventive-alert-detail" aria-label="Preventive alert details">
                <PanelTitle title="Alert detail" />
                {!selected ? (
                  <DataState
                    status="empty"
                    compact
                    message="No alert is selected. Try another severity, region or read-status filter."
                  />
                ) : (
                  <>
                    <div className="alert-detail-meta">
                      <RiskBadge level={selected.severity} />
                      <TrendLabel
                        direction={selected.trend}
                        reason="Trend reported in the supplied alert record; no frontend trend calculation."
                      />
                    </div>
                    <h2>{selected.title}</h2>
                    <p className="alert-detail-description">{selected.description}</p>
                    <dl className="forecast-metadata">
                      <dt>Region</dt>
                      <dd>
                        {payload.regions.find((r) => r.id === selected.regionId)?.name ??
                          "Not supplied"}
                      </dd>
                      <dt>Alert timestamp</dt>
                      <dd>{dateTime(selected.createdAt)}</dd>
                      <dt>Forecast period</dt>
                      <dd>
                        {validityLabel(
                          payload.forecastWindows.find((w) => w.id === selected.validityId),
                        )}
                      </dd>
                      <dt>Read status</dt>
                      <dd>{selected.readStatus === "unread" ? "Unread" : "Read"} · session view</dd>
                      <dt>Assessment reference</dt>
                      <dd>{selected.assessmentId ?? "Not supplied"}</dd>
                    </dl>
                    <section className="alert-rationale">
                      <h3>Why this alert was supplied</h3>
                      {selected.rationale.length ? (
                        <ul>
                          {selected.rationale.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No rationale was supplied. No reasons are inferred by the frontend.</p>
                      )}
                    </section>
                    <section className="alert-recommended">
                      <h3>Recommended preventive action</h3>
                      <p>
                        {selected.recommendedAction ??
                          "No preventive action was supplied. Consult an authoritative source."}
                      </p>
                    </section>
                    <div className="alert-detail-actions">
                      <button
                        className="button secondary"
                        onClick={() => {
                          controller.setRead(
                            selected.id,
                            selected.readStatus === "read" ? "unread" : "read",
                          );
                          onNotify("Read status updated for this session only.");
                        }}
                      >
                        <Icon
                          name={selected.readStatus === "unread" ? "check" : "bell"}
                          size={14}
                        />
                        {selected.readStatus === "unread" ? "Mark as read" : "Mark as unread"}
                      </button>
                      <button
                        className="text-link"
                        onClick={() => onRegion(selected.regionId, selected.validityId)}
                      >
                        View region forecast
                        <Icon name="arrow" size={13} />
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )}
      </DataBoundary>
      <p className="prevention-limitations">
        <Icon name="info" size={14} />
        The backend is responsible for generating alerts and recommended actions. This frontend
        sends no notifications. Read/unread changes are temporary UI state, reset on refresh or
        data-mode changes, and are not saved to a server.
      </p>
    </div>
  );
}
