// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Month-by-month anomaly scan of every biome for one year. For each biome it reads the
// monthly calendar (/history/calendar) and the monthly normal (/history/climatology) and
// flags months above the 90th or below the 10th percentile of the base years. Months
// still in progress are not compared with full-month normals.
import { useMemo, useState } from "react";
import { historyApi } from "../../../app/api";
import type { Biome } from "../../../shared/api/types";
import { useApi } from "../../../shared/api/useApi";
import SelectControl from "../../../shared/ui/SelectControl";
import { Icon, PanelTitle } from "../../../shared/ui/ui";
import {
  coverageYears,
  formatValue,
  MONTH_SHORT,
  yearRange,
  type Meta,
} from "../model/history-view";
import { classifyMonths } from "../model/anomaly-scan";
import { PanelState } from "./HistoryParts";

export default function AnomalyScan({
  meta,
  onOpenBiome,
}: {
  meta: Meta;
  onOpenBiome: (biome: Biome) => void;
}) {
  const years = useMemo(() => coverageYears(meta), [meta]);
  const [year, setYear] = useState(years[0]!);
  const biomes = meta.biomes.map((b) => b.name);
  const range = yearRange(meta, year);
  const scan = useApi(
    (signal) =>
      Promise.all(
        biomes.map(async (biome) => {
          const [calendar, normal] = await Promise.all([
            historyApi.getCalendar({ biome, ...range, granularity: "month" }, { signal }),
            historyApi.getClimatology({ biome, granularity: "month" }, { signal }),
          ]);
          return {
            biome,
            fallback: normal.fallback,
            baseYears: normal.data.base_years,
            months: classifyMonths(year, calendar.buckets, normal.data.buckets),
          };
        }),
      ),
    [year, biomes.join(",")],
  );

  const flagged =
    scan.data
      ?.flatMap((row) =>
        row.months
          .filter((m) => m.status === "above")
          .map((m) => ({ biome: row.biome, ...m, ratio: m.median ? m.value! / m.median : null })),
      )
      .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0)) ?? [];
  const base = scan.data?.[0]?.baseYears;

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
          <Icon name="info" size={13} /> Harmonized fire cell-days per month in each biome, compared
          with the 10th–90th percentile of the same month in the base years
          {base ? ` (${base[0]}–${base[1]})` : ""}. Computed on request from the history API; the
          backend does not issue alerts.
        </p>
      </section>

      {scan.status !== "success" ? (
        <section className="panel">
          <PanelState error={scan.error ?? undefined} />
          {scan.status === "loading" && (
            <p className="hw-note hw-pad">
              Scanning {biomes.length} biomes; this takes a few seconds.
            </p>
          )}
        </section>
      ) : (
        <>
          <section className="panel">
            <PanelTitle
              title={`Months above normal in ${year}`}
              subtitle={`${flagged.length} biome-months above the 90th percentile. Click one to open its calendar.`}
            />
            {flagged.length === 0 ? (
              <PanelState
                error={new Error("No biome-month above the 90th percentile this year.")}
              />
            ) : (
              <div className="hw-table-wrap">
                <table className="hw-table">
                  <thead>
                    <tr>
                      <th>Biome</th>
                      <th>Month</th>
                      <th>Fire cell-days</th>
                      <th>Median</th>
                      <th>p90</th>
                      <th>× median</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {flagged.map((f) => (
                      <tr key={`${f.biome}${f.month}`}>
                        <td>{f.biome}</td>
                        <td>
                          {MONTH_SHORT[f.month - 1]} {year}
                        </td>
                        <td>{formatValue(f.value)}</td>
                        <td>{formatValue(f.median)}</td>
                        <td>{formatValue(f.p90)}</td>
                        <td>{f.ratio === null ? "—" : `${f.ratio.toFixed(1)}×`}</td>
                        <td>
                          <button className="text-link" onClick={() => onOpenBiome(f.biome)}>
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
              title="All biomes, month by month"
              subtitle="Above the 90th percentile, below the 10th, within the band, month still in progress, or no data."
            />
            <div
              className="hw-matrix"
              role="table"
              aria-label={`Monthly status per biome in ${year}`}
            >
              <div className="hw-matrix-row head" role="row">
                <span role="columnheader">Biome</span>
                {MONTH_SHORT.map((m) => (
                  <span key={m} role="columnheader">
                    {m}
                  </span>
                ))}
              </div>
              {scan.data.map((row) => (
                <div className="hw-matrix-row" role="row" key={row.biome}>
                  <button
                    className="text-link"
                    role="rowheader"
                    onClick={() => onOpenBiome(row.biome)}
                  >
                    {row.biome}
                  </button>
                  {row.months.map((m) => (
                    <span
                      key={m.month}
                      role="cell"
                      className={`hw-mcell ${m.status}`}
                      title={`${row.biome}, ${MONTH_SHORT[m.month - 1]} ${year}: ${formatValue(m.value)} fire cell-days (median ${formatValue(m.median)}, p10–p90 ${formatValue(m.p10)}–${formatValue(m.p90)}) · ${m.status}`}
                    >
                      {m.status === "above" ? "▲" : m.status === "below" ? "▼" : ""}
                    </span>
                  ))}
                </div>
              ))}
            </div>
            {scan.data.some((r) => r.fallback) && (
              <p className="hw-note hw-pad">Harmonized series unavailable: normals use MODIS.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
