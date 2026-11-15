import { SensorDot } from "../../sensors/SensorControls";
import { SENSOR_METADATA } from "../../sensors/sensors";
import type { MapLocationSelection } from "../model/map-location";

export default function HotspotTooltip({
  location,
  position,
  classification,
}: {
  location: MapLocationSelection;
  position: { left: number; top: number };
  classification?: "seasonal" | "anomaly";
}) {
  const source = SENSOR_METADATA[location.sensor];
  return (
    <div
      id="hotspot-observation-tooltip"
      role="tooltip"
      className="hotspot-tooltip"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      <strong>
        <SensorDot sensor={location.sensor} />
        {source.label}
      </strong>
      <p>{location.region} · illustrative spatial sample</p>
      {classification && (
        <p className="scenario-tooltip-pattern">
          {classification === "anomaly"
            ? "Historical anomaly · illustrative scenario"
            : "Expected seasonal burning · illustrative scenario"}
          <br />
          No validated historical classification supplied.
        </p>
      )}
      <dl>
        <div>
          <dt>Observed at (UTC)</dt>
          <dd>{location.observation.observedAt ?? "Not supplied"}</dd>
        </div>
        <div>
          <dt>Latitude / longitude</dt>
          <dd>Not georeferenced</dd>
        </div>
        <div>
          <dt>FRP</dt>
          <dd>Unavailable</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{location.observation.confidence ?? "Not supplied"}</dd>
        </div>
        <div>
          <dt>Resolution</dt>
          <dd>{source.resolution}</dd>
        </div>
        <div>
          <dt>Platform</dt>
          <dd>{location.observation.satellite ?? "Not supplied"}</dd>
        </div>
      </dl>
      <small>Demo marker, not an acquisition record. Enter or click for full details.</small>
    </div>
  );
}
