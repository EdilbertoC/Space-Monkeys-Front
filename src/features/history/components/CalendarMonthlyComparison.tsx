import { useState } from "react";
import { format, Icon, PanelTitle } from "../../../shared/ui/ui";
import { SensorDot } from "../../sensors/SensorControls";
import { hasDemoData, sensorLabel, unavailableMessage } from "../../sensors/sensors";
import { MONTHS, signedPercent, type CalendarSensor } from "../demo/calendar-data";
import {
  formatCalendarCount,
  formatCompactCount,
  type CalendarSummary,
} from "../model/calendar-presentation";

export default function CalendarMonthlyComparison({
  summary,
  year,
  sensor,
  onMonth,
}: {
  summary: CalendarSummary;
  year: number;
  sensor: CalendarSensor;
  onMonth: (month: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const maximum = Math.max(1, ...summary.monthly.flatMap((m) => [m.total ?? 0, m.baseline ?? 0]));
  const y = (value: number) => 157 - (value / maximum) * 127;
  let previous = false;
  const baselinePath = summary.monthly
    .map((m, i) => {
      if (m.baseline === null) {
        previous = false;
        return "";
      }
      const part = `${previous ? "L" : "M"}${56 + i * 54},${y(m.baseline)}`;
      previous = true;
      return part;
    })
    .join(" ");
  return (
    <section className="panel burn-comparison">
      <PanelTitle
        title="Historical comparison"
        subtitle={`${year} monthly activity versus ${year - 5}–${year - 1} historical average`}
      >
        <span className="demo-pill">ILLUSTRATIVE</span>
      </PanelTitle>
      <div className="chart-legend">
        <span>
          <i className="line-key modis-line" />
          MODIS
        </span>
        <span>
          <i className="line-key viirs-line" />
          VIIRS
        </span>
        <span>
          <i className="line-key baseline-line" />
          Historical average
        </span>
        <span>
          <SensorDot sensor="SENTINEL3_SLSTR" />
          SLSTR · unavailable
        </span>
        <span>
          <SensorDot sensor="GOES_ABI" />
          ABI · unavailable
        </span>
        <span className="chart-unit">Hotspots · selected sensor(s)</span>
      </div>
      <div className="burn-comparison-totals">
        <div>
          <span>{year} selected observations</span>
          <strong>{formatCalendarCount(summary.total)}</strong>
        </div>
        <div>
          <span>Historical average</span>
          <strong>{formatCalendarCount(summary.baseline)}</strong>
        </div>
        <div>
          <span>Deviation · demo</span>
          <strong className="increase">{signedPercent(summary.deviation)}</strong>
        </div>
      </div>
      {!hasDemoData(sensor) ? (
        <div className="burn-chart-empty">
          <Icon name="layers" size={28} />
          <strong>{sensorLabel(sensor)} comparison is not available</strong>
          <p>
            {unavailableMessage(sensor)} Select All Sensors, MODIS, or VIIRS to compare illustrative
            raw observations.
          </p>
        </div>
      ) : (
        <div className="burn-monthly-chart" onMouseLeave={() => setHover(null)}>
          <svg
            viewBox="-18 12 750 210"
            role="group"
            aria-label={`Monthly ${year} sensor activity and coverage-matched historical average. Select a month to explore it.`}
          >
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  className="history-gridline"
                  x1="36"
                  x2="708"
                  y1={30 + (i * 127) / 3}
                  y2={30 + (i * 127) / 3}
                />
                <text x="29" y={34 + (i * 127) / 3} textAnchor="end">
                  {formatCompactCount(maximum * (1 - i / 3))}
                </text>
              </g>
            ))}
            {summary.monthly.map((m, i) => (
              <g
                key={m.name}
                role="button"
                tabIndex={0}
                aria-label={`${m.name} ${year}: ${m.total === null ? "no observations in this selection" : `${format(m.total)} demo hotspots, ${signedPercent(m.deviation)} versus baseline`}. Explore month.`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => onMonth(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onMonth(i);
                  }
                }}
              >
                <title>
                  {m.name}: {formatCalendarCount(m.total)} hotspots; baseline{" "}
                  {formatCalendarCount(m.baseline)}; {m.days} observed days;{" "}
                  {signedPercent(m.deviation)}
                </title>
                <rect
                  className="burn-bar-hit"
                  x={36 + i * 54}
                  y="20"
                  width="40"
                  height="193"
                  rx="3"
                />
                {m.total === null ? (
                  <rect
                    className="burn-chart-missing"
                    x={44 + i * 54}
                    y="151"
                    width="24"
                    height="6"
                    rx="1"
                  />
                ) : (
                  <>
                    <rect
                      className="burn-bar-modis"
                      x={44 + i * 54}
                      y={y(m.modis)}
                      width="24"
                      height={(m.modis / maximum) * 127}
                      rx="1"
                    />
                    <rect
                      className="burn-bar-viirs"
                      x={44 + i * 54}
                      y={y(m.modis + m.viirs)}
                      width="24"
                      height={(m.viirs / maximum) * 127}
                      rx="1"
                    />
                  </>
                )}
                <text x={56 + i * 54} y="181" textAnchor="middle">
                  {m.name.slice(0, 3)}
                </text>
                <text
                  className={
                    m.deviation !== null && m.deviation >= 35
                      ? "burn-chart-deviation elevated"
                      : "burn-chart-deviation"
                  }
                  x={56 + i * 54}
                  y="202"
                  textAnchor="middle"
                >
                  {signedPercent(m.deviation)}
                </text>
              </g>
            ))}
            <path className="burn-monthly-baseline" d={baselinePath} />
            {summary.monthly.map(
              (m, i) =>
                m.baseline !== null && (
                  <circle
                    className="burn-baseline-point"
                    key={m.name}
                    cx={56 + i * 54}
                    cy={y(m.baseline)}
                    r="2.3"
                  />
                ),
            )}
          </svg>
          {hover !== null && (
            <div className="chart-tooltip burn-month-tooltip">
              <strong>
                {MONTHS[hover]} {year} · illustrative
              </strong>
              <span>
                MODIS{" "}
                <b>
                  {sensor === "VIIRS"
                    ? "Not selected"
                    : summary.monthly[hover].days
                      ? format(summary.monthly[hover].modis)
                      : "N/A"}
                </b>
              </span>
              <span>
                VIIRS{" "}
                <b>
                  {sensor === "MODIS"
                    ? "Not selected"
                    : summary.monthly[hover].days
                      ? format(summary.monthly[hover].viirs)
                      : "N/A"}
                </b>
              </span>
              <span>
                Historical average <b>{formatCalendarCount(summary.monthly[hover].baseline)}</b>
              </span>
              <span>
                Observed days <b>{summary.monthly[hover].days}</b>
              </span>
            </div>
          )}
        </div>
      )}
      <div className="history-note">
        <Icon name="info" size={13} />
        <span>
          Stacked bars show raw sensor detections, not deduplicated fires. The synthetic baseline is
          matched to the same observed days and available sensors. N/A means no observations, not
          zero activity. Select a month to filter the calendar.
        </span>
      </div>
    </section>
  );
}
