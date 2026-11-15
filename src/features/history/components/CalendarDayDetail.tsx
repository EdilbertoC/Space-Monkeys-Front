import { Dot, Icon, PanelTitle, SensorBadge } from "../../../shared/ui/ui";
import {
  hasDemoData,
  isAllSensors,
  SENSOR_IDS,
  SENSOR_METADATA,
  sensorLabel,
  unavailableMessage,
} from "../../sensors/sensors";
import {
  activityFor,
  CALENDAR_CUTOFF,
  dateLabel,
  parseDate,
  signedPercent,
  type CalendarDay,
  type CalendarSensor,
} from "../demo/calendar-data";
import { formatCalendarCount } from "../model/calendar-presentation";

export default function CalendarDayDetail({
  day,
  sensor,
}: {
  day: CalendarDay | undefined;
  sensor: CalendarSensor;
}) {
  const activity = day ? activityFor(day, sensor) : null;
  return (
    <section className="panel burn-daily" aria-label="Selected day detail">
      <PanelTitle title="Daily observation detail">
        <Icon name="calendar" size={16} />
      </PanelTitle>
      {!day || !activity ? (
        <div className="burn-chart-empty">
          <Icon name="calendar" size={25} />
          <strong>No days in this selection</strong>
          <p>Adjust the month or date range to select a day.</p>
        </div>
      ) : (
        <>
          <div className="burn-daily-heading">
            <span>
              {parseDate(day.date).toLocaleDateString("en-US", {
                weekday: "long",
                timeZone: "UTC",
              })}
            </span>
            <h3>{dateLabel(day.date, true)}</h3>
            <span className="burn-scope-label">
              {isAllSensors(sensor)
                ? "Combined raw sensor observations"
                : `${sensorLabel(sensor)} selection`}{" "}
              · UTC
            </span>
          </div>
          <div className="burn-daily-total">
            <span>Total observed hotspots</span>
            <strong>{formatCalendarCount(activity.total)}</strong>
            <span
              className={`burn-state ${activity.anomalous ? "elevated" : ""} ${!activity.observed ? "unavailable" : ""}`}
            >
              <Dot color={activity.anomalous ? "orange" : "green"} />
              {!hasDemoData(sensor)
                ? "Output unavailable"
                : !activity.observed
                  ? "No observations"
                  : activity.partial
                    ? "Partial sensor coverage"
                    : activity.total === 0
                      ? "Observed · zero detections"
                      : "Observed · demo data"}
            </span>
          </div>
          <div className="burn-daily-sensors">
            {SENSOR_IDS.map((s) => (
              <div key={s}>
                <SensorBadge sensor={s} />
                <strong>{formatCalendarCount(day.observations[s])}</strong>
                <small>
                  {SENSOR_METADATA[s].tier === "core"
                    ? "Raw demo detections"
                    : "Planned · not integrated"}
                </small>
              </div>
            ))}
          </div>
          {!activity.observed && (
            <p className="burn-daily-explanation">
              {!hasDemoData(sensor)
                ? `${unavailableMessage(sensor)} Raw source values remain available where present.`
                : day.reason === "after-cutoff"
                  ? `This day is beyond the demo observation cutoff (${dateLabel(CALENDAR_CUTOFF)}). It is not an observed zero.`
                  : "No record is available for the selected sensor(s). Missing observations must not be interpreted as zero detections."}
            </p>
          )}
          <div className="burn-daily-baseline">
            <div>
              <span>Historical daily average</span>
              <strong>{formatCalendarCount(activity.baseline)}</strong>
            </div>
            <div>
              <span>Deviation from baseline</span>
              <strong className={activity.anomalous ? "increase" : ""}>
                {signedPercent(activity.deviation)}
              </strong>
            </div>
          </div>
          <div className="burn-classification">
            <span>Anomaly classification</span>
            <strong className={activity.anomalous ? "increase" : ""}>
              <Icon name={activity.anomalous ? "alert" : "info"} size={13} />
              {activity.classification}
            </strong>
            <p>
              Illustrative comparison rule only. Scientific anomaly detection is not implemented.
              Extended sources are not included in the core workflow.
            </p>
          </div>
          <div className="burn-harmonized-status">
            <Icon name="layers" size={16} />
            <div>
              <strong>Harmonized activity · not computed</strong>
              <p>Conceptual indicator only. Raw counts are not scientifically harmonized.</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
