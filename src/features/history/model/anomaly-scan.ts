// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import type { Schemas } from "../../../shared/api/types.ts";

export type MonthStatus = "above" | "below" | "within" | "partial" | "nodata";

export type MonthCell = {
  month: number; // 1-12
  value: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  status: MonthStatus;
};

const lastDayOfMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);

/** Classify each month of `year` against the monthly normal. */
export function classifyMonths(
  year: number,
  buckets: Schemas["CalendarBucket"][],
  normal: Schemas["Climatology"]["buckets"],
): MonthCell[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const bucket = buckets.find((b) => Number(b.start.slice(5, 7)) === month) ?? null;
    const row = normal.find((r) => r.index === month) ?? null;
    const value = bucket?.harmonized?.value ?? null;
    const base = {
      month,
      value,
      median: row?.median ?? null,
      p10: row?.p10 ?? null,
      p90: row?.p90 ?? null,
    };
    if (!bucket || value === null || !row) return { ...base, status: "nodata" as const };
    if (bucket.end !== lastDayOfMonth(year, month) || bucket.start.slice(8) !== "01")
      return { ...base, status: "partial" as const };
    const status = value > row.p90 ? "above" : value < row.p10 ? "below" : "within";
    return { ...base, status };
  });
}
