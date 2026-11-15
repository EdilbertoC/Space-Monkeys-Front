// Deterministic synthetic fixtures only. No live observations, scientific anomaly
// detection, or sensor harmonization is performed by this demo.
import {
  hasDemoData,
  isAllSensors,
  type SensorId,
  type SensorSelection,
} from "../../sensors/sensors.ts";
export const CALENDAR_CUTOFF = "2026-08-24";
export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export { CONTINENTS } from "../../../shared/constants/geography.ts";
export const COUNTRIES = [
  { name: "Brazil", factor: 0.24 },
  { name: "United States", factor: 0.09 },
  { name: "Canada", factor: 0.06 },
  { name: "DR Congo", factor: 0.12 },
  { name: "Australia", factor: 0.051 },
  { name: "Indonesia", factor: 0.085 },
  { name: "Greece", factor: 0.009 },
];
export type CalendarSensor = SensorSelection;
export type Bounds = { south: number; north: number; west: number; east: number };
export type CalendarScope = {
  kind: "Global" | "Continent" | "Country" | "Custom Area";
  name: string;
  bounds?: Bounds;
};
export type CalendarDay = {
  date: string;
  month: number;
  day: number;
  weekday: number;
  modis: number | null;
  viirs: number | null;
  observations: Record<SensorId, number | null>;
  baselineModis: number;
  baselineViirs: number;
  reason: "available" | "gap" | "after-cutoff";
};
export type DayActivity = {
  total: number | null;
  baseline: number | null;
  deviation: number | null;
  observed: boolean;
  partial: boolean;
  anomalous: boolean;
  classification: string;
};
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export const parseDate = (date: string) => new Date(`${date}T00:00:00Z`);
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
export function dateLabel(date: string, long = false) {
  return (long ? longDateFormatter : shortDateFormatter).format(parseDate(date));
}
export const signedPercent = (n: number | null) =>
  n === null ? "N/A" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}%`;

export function validBounds(bounds: Bounds) {
  return (
    Object.values(bounds).every(Number.isFinite) &&
    bounds.south >= -90 &&
    bounds.north <= 90 &&
    bounds.south < bounds.north &&
    bounds.west >= -180 &&
    bounds.east <= 180 &&
    bounds.west < bounds.east
  );
}
export function scopeLabel(scope: CalendarScope) {
  if (scope.kind !== "Custom Area" || !scope.bounds)
    return scope.kind === "Global" ? "Global" : scope.name;
  const b = scope.bounds;
  return `Custom area · ${b.south}° to ${b.north}° N / ${b.west}° to ${b.east}° E`;
}
function hash(text: string) {
  return [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
}
export function generateCalendar(year: number, scope: CalendarScope): CalendarDay[] {
  const continentFactors: Record<string, number> = {
    "South America": 0.327,
    "North America": 0.118,
    Africa: 0.286,
    Europe: 0.042,
    Asia: 0.176,
    Oceania: 0.051,
  };
  let factor =
    scope.kind === "Global"
      ? 1
      : scope.kind === "Continent"
        ? (continentFactors[scope.name] ?? 0.1)
        : (COUNTRIES.find((c) => c.name === scope.name)?.factor ?? 0.08);
  if (scope.kind === "Custom Area" && scope.bounds && validBounds(scope.bounds)) {
    factor = Math.max(
      0.001,
      Math.min(
        0.8,
        ((scope.bounds.north - scope.bounds.south) * (scope.bounds.east - scope.bounds.west)) /
          64800,
      ),
    );
  }
  const seed = hash(scopeLabel(scope));
  const start = Date.UTC(year, 0, 1);
  const count = (Date.UTC(year + 1, 0, 1) - start) / 86400000;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start + i * 86400000);
    const iso = isoDate(date);
    const month = date.getUTCMonth();
    const season = 0.69 + 0.4 * Math.sin(((month - (seed % 4)) * Math.PI) / 6) ** 2;
    const yearFactor = Math.max(0.1, 0.73 + (year - 2020) * 0.045);
    const baselineModis = Math.round(7400 * factor * season * yearFactor);
    const baselineViirs = Math.round(14350 * factor * season * yearFactor);
    const elevatedPeriod = (i >= 190 && i <= 198) || (i >= 228 && i <= 234);
    const variation =
      1.08 +
      0.13 * Math.sin(i * 0.53 + (seed % 13)) +
      (elevatedPeriod ? 0.58 : 0) +
      (i % 61 === 15 ? 0.95 : 0);
    const zero = (i + 1) % 47 === 0;
    const afterCutoff = iso > CALENDAR_CUTOFF;
    const gap = (i + 1) % 29 === 0;
    const modis =
      afterCutoff || gap || (i + 1) % 37 === 0
        ? null
        : zero
          ? 0
          : Math.round(baselineModis * variation);
    const viirs =
      afterCutoff || gap
        ? null
        : zero
          ? 0
          : Math.round(baselineViirs * variation * (1 + 0.025 * Math.cos(i)));
    return {
      date: iso,
      month,
      day: date.getUTCDate(),
      weekday: (date.getUTCDay() + 6) % 7,
      modis,
      viirs,
      observations: { MODIS: modis, VIIRS: viirs, SENTINEL3_SLSTR: null, GOES_ABI: null },
      baselineModis,
      baselineViirs,
      reason: afterCutoff ? "after-cutoff" : gap ? "gap" : "available",
    };
  });
}

export function activityFor(day: CalendarDay, sensor: CalendarSensor): DayActivity {
  if (!hasDemoData(sensor))
    return {
      total: null,
      baseline: null,
      deviation: null,
      observed: false,
      partial: false,
      anomalous: false,
      classification: sensor === "Harmonized" ? "Not computed" : "Source unavailable · planned",
    };
  const includeModis = sensor !== "VIIRS";
  const includeViirs = sensor !== "MODIS";
  const observed = (includeModis && day.modis !== null) || (includeViirs && day.viirs !== null);
  const partial = isAllSensors(sensor) && observed && (day.modis === null || day.viirs === null);
  if (!observed)
    return {
      total: null,
      baseline: null,
      deviation: null,
      observed: false,
      partial: false,
      anomalous: false,
      classification: "Not assessed · no observations",
    };
  const total = (includeModis ? (day.modis ?? 0) : 0) + (includeViirs ? (day.viirs ?? 0) : 0);
  const baseline =
    (includeModis && day.modis !== null ? day.baselineModis : 0) +
    (includeViirs && day.viirs !== null ? day.baselineViirs : 0);
  const deviation = baseline ? (total / baseline - 1) * 100 : null;
  const anomalous = !partial && deviation !== null && deviation >= 35;
  return {
    total,
    baseline,
    deviation,
    observed,
    partial,
    anomalous,
    classification: partial
      ? "Not assessed · partial coverage"
      : total === 0
        ? "Observed zero activity"
        : anomalous
          ? deviation! >= 75
            ? "Extreme deviation · demo"
            : "Elevated deviation · demo"
          : "Within illustrative range",
  };
}
export function inCalendarRange(day: CalendarDay, start: string, end: string, month = -1) {
  return day.date >= start && day.date <= end && (month === -1 || day.month === month);
}
export function summarizeCalendar(days: CalendarDay[], sensor: CalendarSensor) {
  const activities = days.map((day) => ({ day, activity: activityFor(day, sensor) }));
  const observed = activities.filter(({ activity }) => activity.observed);
  const monthly = MONTHS.map((name, month) => {
    const records = observed.filter(({ day }) => day.month === month);
    const modis =
      sensor === "VIIRS" || sensor === "Harmonized"
        ? 0
        : records.reduce((total, { day }) => total + (day.modis ?? 0), 0);
    const viirs =
      sensor === "MODIS" || sensor === "Harmonized"
        ? 0
        : records.reduce((total, { day }) => total + (day.viirs ?? 0), 0);
    const total = records.length ? modis + viirs : null;
    const baseline = records.length
      ? records.reduce((sum, { activity }) => sum + (activity.baseline ?? 0), 0)
      : null;
    return {
      name,
      month,
      modis,
      viirs,
      total,
      baseline,
      days: records.length,
      deviation: baseline && total !== null ? (total / baseline - 1) * 100 : null,
    };
  });
  const total = observed.length
    ? observed.reduce((sum, { activity }) => sum + activity.total!, 0)
    : null;
  const baseline = observed.length
    ? observed.reduce((sum, { activity }) => sum + activity.baseline!, 0)
    : null;
  const anomalous = observed.filter(({ activity }) => activity.anomalous);
  const mostAnomalous =
    [...anomalous].sort((a, b) => b.activity.deviation! - a.activity.deviation!)[0] ?? null;
  const peakMonth =
    [...monthly].filter((m) => m.total !== null).sort((a, b) => b.total! - a.total!)[0] ?? null;
  const elevatedPeriods: { start: string; end: string; days: number }[] = [];
  for (const record of anomalous) {
    const previous = elevatedPeriods[elevatedPeriods.length - 1];
    if (previous && Date.parse(record.day.date) - Date.parse(previous.end) === 86400000) {
      previous.end = record.day.date;
      previous.days++;
    } else elevatedPeriods.push({ start: record.day.date, end: record.day.date, days: 1 });
  }
  elevatedPeriods.sort((a, b) => b.days - a.days);
  return {
    total,
    baseline,
    monthly,
    observedDays: observed.length,
    partialDays: observed.filter(({ activity }) => activity.partial).length,
    zeroDays: observed.filter(({ activity }) => activity.total === 0).length,
    anomalyCount: anomalous.length,
    mostAnomalous,
    peakMonth,
    elevatedPeriods,
    deviation: total !== null && baseline ? (total / baseline - 1) * 100 : null,
  };
}
export function intensityLevel(total: number, maximum: number) {
  if (!total) return 0;
  const ratio = total / Math.max(1, maximum);
  return ratio < 0.25 ? 1 : ratio < 0.45 ? 2 : ratio < 0.65 ? 3 : ratio < 0.85 ? 4 : 5;
}
