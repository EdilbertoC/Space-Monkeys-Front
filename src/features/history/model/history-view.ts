// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Pure presentation helpers for the API-backed burning calendar. They only reshape
// numbers the backend returned; they never invent, fill or rescale values.
import type { Schemas, Series } from "../../../shared/api/types.ts";
import { calendarValue } from "../api/history.ts";

export type Meta = Schemas["Meta"];
export type Bucket = Schemas["CalendarBucket"];
export type ClimatologyRow = Schemas["Climatology"]["buckets"][number];

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const SERIES_LABEL: Record<Series, string> = {
  harmonized: "Harmonized (MODIS-equivalent)",
  modis: "MODIS observed",
  viirs: "VIIRS observed",
};

/** Last day any sensor has data for. */
export function coverageEnd(meta: Meta): string {
  const ends = [meta.coverage.modis?.end, meta.coverage.viirs?.end].filter(
    (d): d is string => typeof d === "string",
  );
  return ends.sort().at(-1) ?? new Date().toISOString().slice(0, 10);
}

/** First day of the record (MODIS start). */
export function coverageStart(meta: Meta): string {
  return meta.coverage.modis?.start ?? meta.coverage.viirs?.start ?? "2000-11-01";
}

/** Years with at least one day of data, newest first. */
export function coverageYears(meta: Meta): number[] {
  const first = Number(coverageStart(meta).slice(0, 4));
  const last = Number(coverageEnd(meta).slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, i) => last - i);
}

/** The part of a calendar year the record covers (inclusive UTC dates). */
export function yearRange(meta: Meta, year: number): { start: string; end: string } {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const first = coverageStart(meta);
  const last = coverageEnd(meta);
  return { start: start < first ? first : start, end: end > last ? last : end };
}

export function isCompleteYear(meta: Meta, year: number): boolean {
  return yearRange(meta, year).end === `${year}-12-31`;
}

export function bucketValue(bucket: Bucket, series: Series): number | null {
  return calendarValue(bucket, series);
}

/** 0 = no fire observed, 1–5 = share of the year's busiest day. */
export function intensityLevel(value: number, maximum: number): number {
  if (value <= 0 || maximum <= 0) return 0;
  const ratio = value / maximum;
  return ratio < 0.1 ? 1 : ratio < 0.25 ? 2 : ratio < 0.45 ? 3 : ratio < 0.7 ? 4 : 5;
}

export type DayCell = { bucket: Bucket | null; date: string; inYear: boolean };

/** 12 rows (months) × 31 columns (day of month) for a calendar year. */
export function monthGrid(year: number, buckets: Bucket[]): DayCell[][] {
  const byDate = new Map(buckets.map((b) => [b.start, b]));
  return MONTH_SHORT.map((_, month) =>
    Array.from({ length: 31 }, (_, d) => {
      const date = new Date(Date.UTC(year, month, d + 1));
      const inYear = date.getUTCMonth() === month;
      const iso = date.toISOString().slice(0, 10);
      return { bucket: inYear ? (byDate.get(iso) ?? null) : null, date: iso, inYear };
    }),
  );
}

export type WeekVsNormal = {
  index: number;
  label: string;
  start: string | null;
  value: number | null;
  median: number;
  p10: number;
  p90: number;
  status: "above" | "below" | "within" | null;
};

/** Pairs this year's weekly buckets (in order) with the climatology weeks 0–51. */
export function weeksAgainstNormal(
  weekBuckets: Bucket[],
  normal: ClimatologyRow[],
  series: Series,
): WeekVsNormal[] {
  return normal.map((row) => {
    const bucket = weekBuckets[row.index] ?? null;
    const value = bucket ? bucketValue(bucket, series) : null;
    return {
      index: row.index,
      label: row.label,
      start: bucket?.start ?? null,
      value,
      median: row.median,
      p10: row.p10,
      p90: row.p90,
      status:
        value === null ? null : value > row.p90 ? "above" : value < row.p10 ? "below" : "within",
    };
  });
}

/** Integers stay integers; harmonized estimates (expected counts) keep one decimal. */
export function formatValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return "No data";
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatInterval(interval: { low: number; high: number } | null | undefined) {
  if (!interval || interval.low === interval.high) return null;
  return `90% interval ${formatValue(interval.low)}–${formatValue(interval.high)}`;
}

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const fullFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const shortDate = (iso: string) => dayFormatter.format(new Date(`${iso}T00:00:00Z`));
export const longDate = (iso: string) => fullFormatter.format(new Date(`${iso}T00:00:00Z`));

/** Days between a season date of `year` and the normal "MM-DD" of the same year. */
export function daysFromNormal(actual: string, normalMonthDay: string): number {
  const year = actual.slice(0, 4);
  const a = Date.parse(`${actual}T00:00:00Z`);
  const n = Date.parse(`${year}-${normalMonthDay}T00:00:00Z`);
  return Math.round((a - n) / 86_400_000);
}

export function shiftLabel(days: number): string {
  if (days === 0) return "on the normal date";
  const weeks = Math.abs(days) >= 14 ? `${Math.round(Math.abs(days) / 7)} weeks` : null;
  const amount = weeks ?? `${Math.abs(days)} days`;
  return `${amount} ${days < 0 ? "earlier" : "later"} than normal`;
}

export const ANOMALY_LABEL: Record<Schemas["Anomaly"]["class"], string> = {
  below: "Below normal",
  normal: "Within normal",
  above: "Above normal",
  record: "Highest on record",
};
