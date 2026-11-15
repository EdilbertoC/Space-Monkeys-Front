import { Icon, PanelTitle } from "../../../shared/ui/ui";
import { hasDemoData, unavailableMessage } from "../../sensors/sensors";
import { dateLabel, signedPercent, type CalendarSensor } from "../demo/calendar-data";
import { formatCalendarCount, type CalendarSummary } from "../model/calendar-presentation";

export default function CalendarInsights({
  summary,
  sensor,
  onMonth,
  onDay,
  onPeriod,
  reset,
}: {
  summary: CalendarSummary;
  sensor: CalendarSensor;
  onMonth: (month: number) => void;
  onDay: (date: string) => void;
  onPeriod: (start: string, end: string) => void;
  reset: () => void;
}) {
  const topMonths = [...summary.monthly]
    .filter((m) => m.total !== null)
    .sort((a, b) => b.total! - a.total!)
    .slice(0, 3);
  const period = summary.elevatedPeriods[0];
  return (
    <section className="panel burn-insights">
      <PanelTitle
        title="Patterns & insights"
        subtitle="Descriptive summaries of the selected illustrative records—not scientific findings"
      >
        <span className="demo-pill">DEMO INSIGHTS</span>
      </PanelTitle>
      {!hasDemoData(sensor) || !summary.observedDays ? (
        <div className="burn-insights-empty">
          <Icon name="info" size={18} />
          <p>
            {!hasDemoData(sensor)
              ? unavailableMessage(sensor)
              : "There are no observed days in this selection. Insights cannot be calculated from missing records."}
          </p>
          <button className="text-link" onClick={reset}>
            {!hasDemoData(sensor) ? "View raw sensor demo" : "Reset filters"}
            <Icon name="arrow" size={13} />
          </button>
        </div>
      ) : (
        <div className="burn-insight-grid">
          <article>
            <span className="burn-insight-icon">
              <Icon name="flame" size={17} />
            </span>
            <span>Peak activity month</span>
            <h3>{summary.peakMonth?.name ?? "N/A"}</h3>
            <p>
              <strong>{formatCalendarCount(summary.peakMonth?.total ?? null)}</strong> observed
              hotspots across <strong>{summary.peakMonth?.days ?? 0}</strong> available days in this
              selection.
            </p>
            <button
              className="text-link"
              onClick={() => summary.peakMonth && onMonth(summary.peakMonth.month)}
            >
              Explore month
              <Icon name="arrow" size={12} />
            </button>
          </article>
          <article>
            <span className="burn-insight-icon">
              <Icon name="alert" size={17} />
            </span>
            <span>Largest daily deviation · demo</span>
            <h3>
              {summary.mostAnomalous
                ? dateLabel(summary.mostAnomalous.day.date)
                : "No flagged days"}
            </h3>
            <p>
              {summary.mostAnomalous ? (
                <>
                  <strong>{signedPercent(summary.mostAnomalous.activity.deviation)}</strong> versus
                  its matched daily baseline. An illustrative flag, not a verified anomaly.
                </>
              ) : (
                "No fully observed day crosses the illustrative +35% threshold."
              )}
            </p>
            {summary.mostAnomalous && (
              <button className="text-link" onClick={() => onDay(summary.mostAnomalous!.day.date)}>
                Inspect day
                <Icon name="arrow" size={12} />
              </button>
            )}
          </article>
          <article>
            <span className="burn-insight-icon">
              <Icon name="chart" size={17} />
            </span>
            <span>Seasonal pattern</span>
            <h3>{topMonths.map((m) => m.name.slice(0, 3)).join(" · ")}</h3>
            <p>
              Highest observed monthly totals in this selection. Coverage and filters affect this
              pattern; it is not an established fire season.
            </p>
            <button
              className="text-link"
              onClick={() => topMonths[0] && onMonth(topMonths[0].month)}
            >
              Examine peak
              <Icon name="arrow" size={12} />
            </button>
          </article>
          <article>
            <span className="burn-insight-icon">
              <Icon name="calendar" size={17} />
            </span>
            <span>Elevated period · demo</span>
            <h3>
              {period
                ? `${dateLabel(period.start).replace(/, \d{4}/, "")}${period.days > 1 ? ` – ${dateLabel(period.end).split(" ").slice(0, 2).join(" ").replace(",", "")}` : ""}`
                : "None flagged"}
            </h3>
            <p>
              {period ? (
                <>
                  <strong>{period.days}</strong> consecutive {period.days === 1 ? "day" : "days"} at
                  least <strong>35%</strong> above the demo baseline, with complete selected-sensor
                  coverage.
                </>
              ) : (
                "No elevated periods are flagged within this selection."
              )}
            </p>
            {period && (
              <button className="text-link" onClick={() => onPeriod(period.start, period.end)}>
                Review period
                <Icon name="arrow" size={12} />
              </button>
            )}
          </article>
        </div>
      )}
      <div className="source-note">
        <Icon name="info" size={14} />
        <span>
          All counts, baselines, seasonal patterns, and flags are synthetic demo data. The +35% flag
          is an illustrative UI rule; no scientific anomaly detection or harmonization is
          implemented.
        </span>
      </div>
    </section>
  );
}
