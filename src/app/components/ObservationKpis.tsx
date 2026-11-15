import { getObservation } from "../../features/history/demo/demo-data";
import { hasDemoData, matchesSensor, type SensorSelection } from "../../features/sensors/sensors";
import { format, Icon, type IconName } from "../../shared/ui/ui";
interface KpiDefinition {
  label: string;
  value: number;
  change: string;
  desc: string;
  icon: IconName;
  color: string;
  points: string;
  sensorId?: "MODIS" | "VIIRS";
  isHistoricalAnomaly?: boolean;
}
export default function ObservationKpis({
  observation,
  sensor,
  sourceAvailability,
}: {
  observation: ReturnType<typeof getObservation>;
  sensor: SensorSelection;
  sourceAvailability: Record<"MODIS" | "VIIRS", boolean>;
}) {
  return (
    <div className="kpi-grid">
      {(
        [
          {
            label: "Active Fire Hotspots",
            value: observation.total,
            change: observation.changes.total,
            desc: "vs. previous period",
            icon: "flame",
            color: "orange",
            points: "0,23 8,20 16,24 24,13 32,17 40,10 48,14 56,4 64,8 72,2",
          },
          {
            label: "MODIS Detections",
            sensorId: "MODIS",
            value: observation.modis,
            change: observation.changes.modis,
            desc: "vs. previous period",
            icon: "satellite",
            color: "yellow",
            points: "0,25 8,19 16,23 24,17 32,18 40,9 48,15 56,8 64,11 72,5",
          },
          {
            label: "VIIRS Detections",
            sensorId: "VIIRS",
            value: observation.viirs,
            change: observation.changes.viirs,
            desc: "vs. previous period",
            icon: "satellite",
            color: "orange",
            points: "0,24 8,18 16,22 24,12 32,16 40,10 48,12 56,2 64,8 72,1",
          },
          {
            label: "Historical Anomalies",
            isHistoricalAnomaly: true,
            value: observation.anomalies,
            change: observation.changes.anomalies,
            desc: "vs. historical baseline",
            icon: "alert",
            color: "purple",
            points: "0,5 8,9 16,6 24,16 32,12 40,20 48,17 56,23 64,19 72,26",
          },
        ] satisfies KpiDefinition[]
      ).map((card) => (
        <section className="kpi-card" key={card.label}>
          <div className="kpi-top">
            <span>{card.label}</span>
            <span className={`kpi-icon ${card.color}`}>
              <Icon name={card.icon} size={17} />
            </span>
          </div>
          <div className="kpi-value-row">
            <strong>
              {observation.hasObservations &&
              (!card.sensorId ||
                (matchesSensor(sensor, card.sensorId) && sourceAvailability[card.sensorId]))
                ? format(card.value)
                : "N/A"}
            </strong>
            <svg
              viewBox="0 0 74 32"
              className={`sparkline ${card.isHistoricalAnomaly ? "green" : card.color}`}
            >
              <polyline points={card.points} fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </div>
          <div className="kpi-comparison">
            <span className={card.isHistoricalAnomaly ? "positive" : "increase"}>
              <Icon name={card.isHistoricalAnomaly ? "chevron" : "arrow"} size={11} />
              {hasDemoData(sensor) && (!card.sensorId || matchesSensor(sensor, card.sensorId))
                ? card.change
                : "—"}
            </span>
            <span>{card.desc}</span>
          </div>
        </section>
      ))}
    </div>
  );
}
