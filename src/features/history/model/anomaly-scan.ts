// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Presentation of GET /history/anomalies: every month of a year against normal, per area.
import type { Schemas } from "../../../shared/api/types.ts";
import type { AreaChoice } from "./area.ts";

export type MonthStatus = "record" | "above" | "normal" | "below" | "nodata";

export type MonthCell = {
  month: number; // 1-12
  start: string;
  end: string;
  partial: boolean;
  value: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  ratio: number | null;
  status: MonthStatus;
  reason: string | null;
};

export type ScanRow = { name: string; area: AreaChoice; months: MonthCell[] };

/** Area summary of the API → the area the pages can select. */
export function scanArea(summary: Schemas["AreaSummary"]): { name: string; area: AreaChoice } {
  if (summary.kind === "country")
    return { name: "Brazil", area: { kind: "country", country: "BR" } };
  const biome = summary.biome!;
  return { name: biome, area: { kind: "biome", biome } };
}

/** One row per area, twelve months each (months past the data are "nodata"). */
export function scanRows(scan: Schemas["AnomalyScan"]): ScanRow[] {
  return scan.areas.map((entry) => {
    const byMonth = new Map(entry.months.map((m) => [Number(m.start.slice(5, 7)), m]));
    const months = Array.from({ length: 12 }, (_, i): MonthCell => {
      const month = i + 1;
      const m = byMonth.get(month);
      const start = `${scan.year}-${String(month).padStart(2, "0")}-01`;
      if (!m)
        return {
          month,
          start,
          end: start,
          partial: false,
          value: null,
          median: null,
          p10: null,
          p90: null,
          ratio: null,
          status: "nodata",
          reason: "after the last day of data",
        };
      return {
        month,
        start: m.start,
        end: m.end,
        partial: m.partial,
        value: m.value ?? null,
        median: m.normal?.median ?? null,
        p10: m.normal?.p10 ?? null,
        p90: m.normal?.p90 ?? null,
        ratio: m.ratio_to_median ?? null,
        status: m.class ?? "nodata",
        reason: m.reason ?? null,
      };
    });
    return { ...scanArea(entry.area), months };
  });
}

/** Months above normal (or the highest on record), largest ratio to the median first. */
export function flaggedMonths(rows: ScanRow[]) {
  return rows
    .flatMap((row) =>
      row.months
        .filter((m) => m.status === "above" || m.status === "record")
        .map((m) => ({ ...m, name: row.name, area: row.area })),
    )
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
}
