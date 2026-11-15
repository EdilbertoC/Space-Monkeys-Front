import { useMemo, useState } from "react";
import { format, Icon, PanelTitle } from "../../../shared/ui/ui";
import { isAllSensors, type SensorSelection } from "../../sensors/sensors";
import { CALENDAR_CUTOFF, type CalendarScope } from "../demo/calendar-data";
import { priorityScenarios, type PriorityScenario } from "../demo/priority-scenarios";
import "../styles/priority-anomalies.css";

export default function PriorityAnomalyTable({
  period,
  sensor,
  scope,
  selectedId,
  onInspect,
  onSamplePeriod,
}: {
  period: string;
  sensor: SensorSelection;
  scope: CalendarScope;
  selectedId?: string;
  onInspect: (scenario: PriorityScenario) => void;
  onSamplePeriod: () => void;
}) {
  const [severity, setSeverity] = useState("All priorities");
  const rows = useMemo(() => priorityScenarios(period, sensor, scope), [period, sensor, scope]);
  const filtered = rows.filter((row) => severity === "All priorities" || row.status === severity);
  return (
    <section className="panel priority-anomalies" aria-label="Priority Anomaly Alerts">
      <PanelTitle
        title="Priority Anomaly Alerts"
        subtitle="Illustrative responder-triage workflow · Amazon & Cerrado"
      >
        <span className="hfi-preview-tag">DEMO SCENARIOS</span>
        <span className="priority-result-count">{filtered.length} sample AOIs</span>
      </PanelTitle>
      <div className="priority-table-toolbar">
        <div className="segmented" role="group" aria-label="Priority alert severity">
          {["All priorities", "CRITICAL", "WARNING"].map((value) => (
            <button
              key={value}
              aria-pressed={severity === value}
              className={severity === value ? "selected" : ""}
              onClick={() => setSeverity(value)}
            >
              {value === "CRITICAL" ? "Critical" : value === "WARNING" ? "Warning" : value}
            </button>
          ))}
        </div>
        <span>
          <Icon name="calendar" size={13} />
          {CALENDAR_CUTOFF} · UTC sample day
        </span>
      </div>
      <div
        className="priority-table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scrollable priority anomaly scenarios"
      >
        <table>
          <caption className="sr-only">
            Illustrative scenario values, not real alerts or scientific measurements. Inspect AOI
            centers a schematic polygon on the linked map.
          </caption>
          <thead>
            <tr>
              <th scope="col">Region / Biome</th>
              <th scope="col">
                Anomaly Score<small>Z-Score · sample</small>
              </th>
              <th scope="col">
                Harmonized FRP<small>MW · mock display</small>
              </th>
              <th scope="col">Pattern Classification</th>
              <th scope="col">Alert Status</th>
              <th scope="col">
                <span className="sr-only">Inspect area</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr
                key={row.id}
                className={row.id === selectedId ? "priority-is-selected" : ""}
                aria-selected={row.id === selectedId}
              >
                <td>
                  <strong>{row.region}</strong>
                  <small>
                    <Icon name="globe" size={12} />
                    {row.biome}
                  </small>
                </td>
                <td>
                  <span className={`priority-zscore ${row.status.toLowerCase()}`}>
                    +{row.zScore.toFixed(2)}
                    <small>σ</small>
                  </span>
                </td>
                <td>
                  <span className="priority-frp">{format(row.mockFrpMw)}</span>
                  <small>Illustrative, not unified FRP</small>
                </td>
                <td>
                  <span className={`priority-pattern ${row.status.toLowerCase()}`}>
                    <i />
                    {row.pattern}
                  </span>
                </td>
                <td>
                  <span className={`priority-status ${row.status.toLowerCase()}`}>
                    <i />
                    {row.status}
                  </span>
                  <small>Demo, not operational</small>
                </td>
                <td>
                  <button
                    className="priority-inspect"
                    onClick={() => onInspect(row)}
                    aria-label={`Inspect AOI: ${row.region}`}
                  >
                    Inspect AOI
                    <Icon name="arrow" size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <div className="priority-empty" role="status">
          <Icon name="info" size={18} />
          <p>
            {!isAllSensors(sensor)
              ? "The joint-source scenario preview requires All Sensors. No harmonized alert results are available for this source selection."
              : !rows.length
                ? "No sample scenarios match the current region or UTC observation period. Missing results do not mean zero real-world anomalies."
                : "No sample scenarios match this severity filter."}
          </p>
          {!rows.length && isAllSensors(sensor) && (
            <button className="text-link" onClick={onSamplePeriod}>
              Load South America sample
              <Icon name="arrow" size={13} />
            </button>
          )}
        </div>
      )}
      <div className="priority-table-note">
        <Icon name="info" size={14} />
        <p>
          <strong>Design scenarios, not early warnings.</strong> Z-scores, FRP values,
          classifications and polygons are fixed illustrative fixtures, not API measurements or
          validated harmonization. The 1 km MODIS / 375 m VIIRS calibration workflow is not
          connected. This list is not spatially clipped to drawn AOIs and must not guide responder
          dispatch.
        </p>
      </div>
    </section>
  );
}
