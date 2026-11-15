import { useState } from "react";
import { Icon, PanelTitle } from "../../shared/ui/ui";
import DateCalendar from "../history/date-selection/DateCalendar";
export type WorkspacePreferences = { period: string; units: string; alerts: boolean };
export default function WorkspaceSettings({
  preferences,
  onApply,
}: {
  preferences: WorkspacePreferences;
  onApply: (p: WorkspacePreferences) => void;
}) {
  const [observationWindow, setObservationWindow] = useState(preferences.period);
  const [alerts, setAlerts] = useState(preferences.alerts);
  const [units, setUnits] = useState(preferences.units);
  const [saved, setSaved] = useState(false);
  return (
    <section className="panel settings-panel">
      <PanelTitle
        title="Workspace preferences"
        subtitle="Configure the workspace for this session."
      />
      <div className="setting-row">
        <div>
          <h3>Observation window</h3>
          <p>Change the date range used by the dashboard, map, and activity table.</p>
        </div>
        <DateCalendar
          value={observationWindow}
          label="Preferred observation calendar"
          onApply={(value) => {
            setObservationWindow(value);
            setSaved(false);
          }}
        />
      </div>
      <div className="setting-row">
        <div>
          <h3>Distance units</h3>
          <p>Display the map scale in kilometers or miles.</p>
        </div>
        <select
          aria-label="Distance units"
          value={units}
          onChange={(e) => {
            setUnits(e.target.value);
            setSaved(false);
          }}
        >
          {["Metric (km)", "Imperial (mi)"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="setting-row">
        <div>
          <h3>Demo notifications</h3>
          <p>Enable simulated activity notifications in this workspace.</p>
        </div>
        <button
          role="switch"
          aria-checked={alerts}
          aria-label="Demo notifications"
          className={`toggle ${alerts ? "on" : ""}`}
          onClick={() => {
            setAlerts(!alerts);
            setSaved(false);
          }}
        >
          <span />
        </button>
      </div>
      <div className="settings-bottom">
        <span>Preferences apply across the workspace for this session and reset on refresh.</span>
        <button
          className="button primary"
          onClick={() => {
            onApply({ period: observationWindow, units, alerts });
            setSaved(true);
          }}
        >
          <Icon name={saved ? "check" : "settings"} size={16} />
          {saved ? "Preferences applied" : "Apply preferences"}
        </button>
      </div>
    </section>
  );
}
