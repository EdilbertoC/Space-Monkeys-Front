// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Every month of a year against normal, for every biome and Brazil, from one call to
// GET /history/anomalies. The month in progress is compared up to the last day of data
// with the same dates of the base years, and marked as partial.
import { useMemo, useState } from "react";
import { historyApi } from "../../../app/api";
import { useApi } from "../../../shared/api/useApi";
import SelectControl from "../../../shared/ui/SelectControl";
import { Icon, PanelTitle } from "../../../shared/ui/ui";
import type { AreaChoice } from "../model/area";
import { flaggedMonths, scanRows, type MonthCell } from "../model/anomaly-scan";
import {
  ANOMALY_LABEL,
  coverageYears,
  formatValue,
  MONTH_SHORT,
  type Meta,
} from "../model/history-view";
import { PanelState } from "./HistoryParts";

export default function AnomalyScan({
  meta,
  onOpenArea,
}: {
  meta: Meta;
  onOpenArea: (area: AreaChoice) => void;
}) {
  const years = useMemo(() => coverageYears(meta), [meta]);
  const [year, setYear] = useState(years[0]!);
  const scan = useApi(
    (signal) => historyApi.getAnomalyScan({ year, areas: "biomes+country" }, { signal }),
    [year],
  );
  const rows = useMemo(() => (scan.data ? scanRows(scan.data.data) : []), [scan.data]);
  const flagged = flaggedMonths(rows);
  const base = scan.data?.data.base_years;

  return (
    <div className="history-workspace">
      <section className="panel hw-filters">
        <div className="hw-field">
          <span>Year</span>
          <SelectControl
            label="Year"
            icon="calendar"
            value={year}
            onChange={(v) => setYear(Number(v))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </SelectControl>
        </div>
        <p className="hw-note">
          <Icon name="info" size={13} /> Fire cell-days of each month in every biome and in Brazil,
          compared with the same dates in the base years
          {base ? ` (${base[0]}–${base[1]})` : ""}: above the 90th percentile, highest on record,
          below the 10th, or within. Computed on request; the backend does not issue alerts.
        </p>
      </section>

      {scan.status !== "success" ? (
        <section className="panel">
          <PanelState error={scan.error ?? undefined} />
        </section>
      ) : (
        <>
          <section className="panel">
            <PanelTitle
              title={`Months above normal in ${year}`}
              subtitle={`${flagged.length} area-months above the 90th percentile of their base years. Click one to open its calendar.`}
            />
            {flagged.length === 0 ? (
              <PanelState error={new Error("No month above the 90th percentile this year.")} />
            ) : (
              <div className="hw-table-wrap">
                <table className="hw-table">
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Month</th>
                      <th>Fire cell-days</th>
                      <th>Median</th>
                      <th>p90</th>
                      <th>× median</th>
                      <th>Class</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {flagged.map((f) => (
                      <tr key={`${f.name}${f.month}`}>
                        <td>{f.name}</td>
                        <td>
                          {MONTH_SHORT[f.month - 1]} {year}
                          {f.partial && <span className="hw-tag">to {f.end.slice(5)}</span>}
                        </td>
                        <td>{formatValue(f.value)}</td>
                        <td>{formatValue(f.median)}</td>
                        <td>{formatValue(f.p90)}</td>
                        <td>{f.ratio === null ? "—" : `${f.ratio.toFixed(1)}×`}</td>
                        <td className={`hw-class-${f.status}`}>
                          {f.status === "record" ? ANOMALY_LABEL.record : ANOMALY_LABEL.above}
                        </td>
                        <td>
                          <button className="text-link" onClick={() => onOpenArea(f.area)}>
                            Calendar <Icon name="arrow" size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <PanelTitle
              title="Every area, month by month"
              subtitle="▲▲ highest on record · ▲ above the 90th percentile · ▼ below the 10th · plain: within the band · hatched: month in progress · dashed: not assessed."
            />
            <div
              className="hw-matrix"
              role="table"
              aria-label={`Monthly status per area in ${year}`}
            >
              <div className="hw-matrix-row head" role="row">
                <span role="columnheader">Area</span>
                {MONTH_SHORT.map((m) => (
                  <span key={m} role="columnheader">
                    {m}
                  </span>
                ))}
              </div>
              {rows.map((row) => (
                <div className="hw-matrix-row" role="row" key={row.name}>
                  <button
                    className="text-link"
                    role="rowheader"
                    onClick={() => onOpenArea(row.area)}
                  >
                    {row.name}
                  </button>
                  {row.months.map((m) => (
                    <span
                      key={m.month}
                      role="cell"
                      className={`hw-mcell ${m.status} ${m.partial ? "partial" : ""}`}
                      title={cellTitle(row.name, year, m)}
                    >
                      {m.status === "record"
                        ? "▲▲"
                        : m.status === "above"
                          ? "▲"
                          : m.status === "below"
                            ? "▼"
                            : ""}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {scan.data.fallback && (
              <p className="hw-note hw-pad">Harmonized series unavailable: the scan uses MODIS.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function cellTitle(name: string, year: number, m: MonthCell) {
  const when = `${name}, ${MONTH_SHORT[m.month - 1]} ${year}${m.partial ? ` (to ${m.end})` : ""}`;
  if (m.status === "nodata") return `${when}: not assessed (${m.reason ?? "no data"})`;
  return `${when}: ${formatValue(m.value)} fire cell-days (median ${formatValue(m.median)}, p10–p90 ${formatValue(m.p10)}–${formatValue(m.p90)}) · ${ANOMALY_LABEL[m.status]}`;
}
