import { useState } from "react";
import { format, Icon, SensorBadge } from "../../../shared/ui/ui";
import { CALENDAR_CUTOFF, dateLabel, signedPercent } from "../demo/calendar-data";
import { type DemoAnomaly } from "../demo/exploration";

export type AnomalyStatus = "Open" | "Reviewed";
export function AnomalyBanner({
  alert,
  onOpen,
  onDismiss,
}: {
  alert: DemoAnomaly;
  onOpen: (alert: DemoAnomaly) => void;
  onDismiss: () => void;
}) {
  return (
    <section className="anomaly-banner" aria-label={`${alert.severity} illustrative anomaly`}>
      <Icon name="alert" size={24} />
      <div>
        <span className="anomaly-banner-kicker">
          {alert.severity.toUpperCase()} DEVIATION · ILLUSTRATIVE DEMO
        </span>
        <h2>
          {alert.region} · {signedPercent(alert.deviation)} versus synthetic baseline
        </h2>
        <p>
          {dateLabel(alert.date)} UTC · {format(alert.current)} {alert.sensor} raw demo detections,
          baseline {format(alert.baseline)}. Not an operational warning.
        </p>
      </div>
      <button className="button secondary" onClick={() => onOpen(alert)}>
        View affected region <Icon name="arrow" size={14} />
      </button>
      <button className="icon-button" aria-label="Dismiss anomaly banner" onClick={onDismiss}>
        <Icon name="close" size={18} />
      </button>
    </section>
  );
}

export default function AnomalyAlerts({
  alerts,
  statuses,
  onStatus,
  onOpen,
  onArchive,
}: {
  alerts: DemoAnomaly[];
  statuses: Record<string, AnomalyStatus>;
  onStatus: (id: string, status: AnomalyStatus) => void;
  onOpen: (alert: DemoAnomaly) => void;
  onArchive: () => void;
}) {
  const [severity, setSeverity] = useState("All severities");
  const [status, setStatus] = useState("All statuses");
  const [mode, setMode] = useState("demo");
  const filtered = alerts.filter(
    (a) =>
      (severity === "All severities" || a.severity === severity) &&
      (status === "All statuses" || (statuses[a.id] ?? "Open") === status),
  );
  return (
    <div className="anomaly-page">
      <section className="anomaly-method panel">
        <Icon name="info" size={20} />
        <div>
          <strong>
            {mode === "demo" ? "Illustrative anomaly review" : "Anomaly integration unavailable"}
          </strong>
          <p>
            No validated anomaly API is connected. Demo results use the existing synthetic
            calendar’s deviation flags, not real-world critical events or forecasts. The sidebar
            intentionally shows no operational anomaly count. Geographic region, sensor and UTC
            period follow the shared filters above.
          </p>
        </div>
        <label className="filter-control">
          <select
            aria-label="Anomaly data mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="demo">Illustrative demo</option>
            <option value="backend">Backend · unavailable</option>
          </select>
        </label>
      </section>
      <div className="anomaly-controls">
        <label className="filter-control">
          <Icon name="alert" size={15} />
          <select
            aria-label="Anomaly severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            {["All severities", "Critical", "High", "Moderate"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="filter-control">
          <select
            aria-label="Anomaly status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {["All statuses", "Open", "Reviewed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span>
          {mode === "demo"
            ? `${filtered.length} illustrative results · review status is session-only`
            : "No requests made · adapter not configured"}
        </span>
      </div>
      {mode === "backend" ? (
        <section className="panel anomaly-empty">
          <Icon name="layers" size={28} />
          <h2>Awaiting validated anomaly results</h2>
          <p>
            No endpoint or scientific metric is assumed. Missing results are not zero anomalies.
            Existing observation and prevention integrations remain unchanged.
          </p>
        </section>
      ) : (
        <>
          <div className="anomaly-summary">
            {(["Critical", "High", "Moderate"] as const).map((s) => (
              <button
                key={s}
                className={`panel anomaly-severity-summary severity-${s.toLowerCase()}`}
                aria-pressed={severity === s}
                onClick={() => setSeverity(severity === s ? "All severities" : s)}
              >
                <span>
                  <Icon name="alert" size={16} />
                  {s}
                </span>
                <strong>
                  {
                    alerts.filter((a) => a.severity === s && (statuses[a.id] ?? "Open") === "Open")
                      .length
                  }
                </strong>
                <small>open demo results</small>
              </button>
            ))}
          </div>
          {!filtered.length ? (
            <section className="panel anomaly-empty">
              <Icon name="check" size={28} />
              <h2>No illustrative anomalies in this selection</h2>
              <p>
                This is not a statement about real-world fire conditions. Change the shared UTC
                period or filters to review historical demo flags.
              </p>
              <button className="button secondary" onClick={onArchive}>
                Explore {CALENDAR_CUTOFF.slice(0, 4)} demo archive <Icon name="arrow" size={14} />
              </button>
            </section>
          ) : (
            <div className="anomaly-results">
              {filtered.map((alert) => (
                <article
                  className={`panel anomaly-card severity-${alert.severity.toLowerCase()}`}
                  key={alert.id}
                >
                  <div className="anomaly-card-heading">
                    <span className="anomaly-severity">
                      <Icon name="alert" size={15} />
                      {alert.severity} · demo
                    </span>
                    <span className="demo-pill">ILLUSTRATIVE</span>
                    <span className="anomaly-status">{statuses[alert.id] ?? "Open"}</span>
                  </div>
                  <button className="anomaly-open" onClick={() => onOpen(alert)}>
                    <h2>{alert.region}</h2>
                    <span>
                      {dateLabel(alert.date)} · inclusive UTC day <Icon name="arrow" size={16} />
                    </span>
                  </button>
                  <dl className="anomaly-metrics">
                    <div>
                      <dt>Current activity</dt>
                      <dd>{format(alert.current)}</dd>
                    </div>
                    <div>
                      <dt>Matched synthetic baseline</dt>
                      <dd>{format(alert.baseline)}</dd>
                    </div>
                    <div>
                      <dt>Deviation</dt>
                      <dd>{signedPercent(alert.deviation)}</dd>
                    </div>
                  </dl>
                  <div className="anomaly-provenance">
                    <SensorBadge sensor={alert.sensor} />
                    <span>
                      Raw demo detections · not FRP · not harmonized
                      <br />
                      Existing calendar fixture · native observations unavailable
                    </span>
                  </div>
                  <details>
                    <summary>Method &amp; provenance</summary>
                    <p>
                      Existing activityFor demo flag ≥ +35%; illustrative severity: moderate ≥35%,
                      high ≥50%, critical ≥75%. Not a validated anomaly model. Baseline is
                      synthetic, coverage-matched to available source days. Uncertainty is not
                      supplied. All Sensors falls back to MODIS; VIIRS can be inspected separately.
                    </p>
                  </details>
                  <div className="anomaly-card-actions">
                    <button className="text-link" onClick={() => onOpen(alert)}>
                      View area &amp; historical analysis <Icon name="arrow" size={13} />
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        onStatus(
                          alert.id,
                          (statuses[alert.id] ?? "Open") === "Open" ? "Reviewed" : "Open",
                        )
                      }
                    >
                      {(statuses[alert.id] ?? "Open") === "Open" ? "Mark reviewed" : "Reopen"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
