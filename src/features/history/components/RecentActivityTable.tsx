import { useState } from "react";
import { Dot, format, Icon, PanelTitle, SensorBadge } from "../../../shared/ui/ui";
import { hasDemoData, unavailableMessage, type SensorSelection } from "../../sensors/sensors";
import { getObservation } from "../demo/demo-data";
import { filterRecentActivity } from "../demo/recent-activity";

export default function RecentActivityTable({
  region,
  total,
  period,
  onSelect,
  sensor,
}: {
  region: string;
  total: number;
  period: string;
  onSelect: (s: string) => void;
  sensor: SensorSelection;
}) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const rows = filterRecentActivity(region, period, sensor).filter((record) =>
    record.region.toLowerCase().includes(search.toLowerCase()),
  );
  const observation = getObservation(period);
  const periodScale = observation.multiplier;
  const hasObservations = getObservation(period, 1, sensor).hasObservations;
  return (
    <section className="panel activity-panel">
      <PanelTitle
        title="Recent fire activity"
        subtitle={`Illustrative window totals · latest detection shown · ${observation.dateLabel}`}
      >
        {showAll && (
          <div className="table-search">
            <Icon name="search" size={14} />
            <input
              aria-label="Search regions"
              placeholder="Search region…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        <button
          className="text-link"
          onClick={() => {
            setShowAll(!showAll);
            setSearch("");
          }}
        >
          {showAll ? "Show less" : "View all activity"}{" "}
          <Icon name={showAll ? "chevron" : "arrow"} size={14} />
        </button>
      </PanelTitle>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>REGION</th>
              <th>
                DETECTION DATE <Icon name="chevron" size={11} />
              </th>
              <th>SATELLITE SENSOR</th>
              <th className="numeric">HOTSPOTS</th>
              <th>ACTIVITY LEVEL</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, showAll ? 8 : 4).map((r) => (
              <tr key={r.region}>
                <td>
                  <button className="region-link" onClick={() => onSelect(r.continent)}>
                    <span className={`country-code flag-${r.flag.toLowerCase()}`}>{r.flag}</span>
                    {r.region}
                  </button>
                </td>
                <td>
                  {r.date}
                  <span className="table-time">{r.time}</span>
                </td>
                <td>
                  <SensorBadge sensor={r.sensor} />
                </td>
                <td className="numeric hotspots-number">{format(r.count * periodScale)}</td>
                <td>
                  <span className={`level ${r.level.toLowerCase()}`}>
                    <Dot
                      color={
                        r.level === "Critical"
                          ? "red"
                          : r.level === "High"
                            ? "orange"
                            : r.level === "Low"
                              ? "green"
                              : "yellow"
                      }
                    />
                    {r.level}
                  </span>
                </td>
                <td>
                  <button
                    className="icon-button row-arrow"
                    aria-label={`Explore ${r.region}`}
                    onClick={() => onSelect(r.continent)}
                  >
                    <Icon name="arrow" size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="empty-state">
            {hasDemoData(sensor)
              ? "No illustrative regional records match the current filters."
              : unavailableMessage(sensor)}
          </div>
        )}
      </div>
      <div className="table-footer">
        <span>
          {hasObservations ? (
            <>
              <Dot color="orange" /> {format(total)} demo detections in selected observation window
              · {rows.length ? "regional sample shown" : "no matching regional sample records"}
            </>
          ) : (
            <>
              <Icon name="info" size={13} />{" "}
              {hasDemoData(sensor)
                ? "No observations available in the selected window — not zero detected activity."
                : "Source planned; no observations available — not zero detected activity."}
            </>
          )}
        </span>
        <span>All times in UTC</span>
      </div>
    </section>
  );
}
