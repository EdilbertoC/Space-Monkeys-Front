// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Fused live fire events from /fires/live (GOES ABI + FIRMS NRT), newest first.
import { liveApi } from "../../../app/api";
import { useApi } from "../../../shared/api/useApi";
import { PanelTitle } from "../../../shared/ui/ui";
import { PanelState } from "../../history/components/HistoryParts";

export default function LiveFiresTable({ limit = 12 }: { limit?: number }) {
  const live = useApi((signal) => liveApi.getFires(undefined, { signal }), []);
  if (live.status !== "success")
    return (
      <section className="panel">
        <PanelTitle title="Live fires" />
        <PanelState error={live.error ?? undefined} />
      </section>
    );
  const fires = [...live.data.features].sort((a, b) =>
    b.properties.last_seen.localeCompare(a.properties.last_seen),
  );
  return (
    <section className="panel hw-live-panel">
      <PanelTitle
        title="Live fires"
        subtitle={`${fires.length} fused fire events in the real-time window${live.data.updated_at ? `, updated ${live.data.updated_at.replace("T", " ").slice(0, 16)} UTC` : ""}. Confidence combines sensors as 1 − ∏(1 − c): a heuristic, not a calibrated probability.`}
      >
        <button className="hw-button" onClick={live.reload}>
          Refresh
        </button>
      </PanelTitle>
      {fires.length === 0 ? (
        <PanelState error={new Error("No live fires in the current window.")} />
      ) : (
        <div className="hw-table-wrap">
          <table className="hw-table">
            <thead>
              <tr>
                <th>Last seen (UTC)</th>
                <th>Location</th>
                <th>Sensors</th>
                <th>Detections</th>
                <th>Position ±</th>
                <th>Max FRP</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {fires.slice(0, limit).map((f) => {
                const p = f.properties;
                const [lon, lat] = f.geometry.coordinates as [number, number];
                return (
                  <tr key={f.id}>
                    <td>{p.last_seen.replace("T", " ").slice(0, 16)}</td>
                    <td>
                      {Math.abs(lat).toFixed(2)}°{lat < 0 ? "S" : "N"}, {Math.abs(lon).toFixed(2)}°
                      {lon < 0 ? "W" : "E"}
                    </td>
                    <td>{p.sensors.join(" + ")}</td>
                    <td>{p.n_detections}</td>
                    <td>{p.uncertainty_km.toFixed(1)} km</td>
                    <td>{p.frp_max_mw == null ? "—" : `${p.frp_max_mw.toFixed(0)} MW`}</td>
                    <td>{p.confidence.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {fires.length > limit && (
            <p className="hw-note">
              Showing the {limit} most recent of {fires.length}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
