// Synthetic demonstration fixtures, not NASA observations or harmonized records.
import { hasDemoData, matchesSensor, type SensorSelection } from "../../sensors/sensors.ts";
import { isDateRange } from "../date-selection/date-range.ts";
import { activityFor, generateCalendar } from "./calendar-data.ts";
export function selectedRecords(period: string) {
  const [start, end] = period.split("/");
  return Array.from({ length: Number(end.slice(0, 4)) - Number(start.slice(0, 4)) + 1 }, (_, i) =>
    generateCalendar(Number(start.slice(0, 4)) + i, { kind: "Global", name: "Global" }),
  )
    .flat()
    .filter((d) => d.date >= start && d.date <= end);
}
export const observationPeriods = {
  "Last 24 hours": { days: 1, multiplier: 1, mapLabel: "24-hour observation" },
  "Last 7 days": { days: 7, multiplier: 5.3, mapLabel: "7-day observation" },
  "Last 30 days": { days: 30, multiplier: 18.4, mapLabel: "30-day observation" },
} as const;

export type ObservationPeriod = keyof typeof observationPeriods;
const demoEnd = new Date("2026-08-24T15:00:00Z");
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const shortDate = (date: Date) => dateFormatter.format(date);

export function getHistoryRangeLabel(months: number, endYear: number) {
  const start = new Date(Date.UTC(endYear, 8 - months, 1));
  return `${shortDate(start).replace(" 1", "")} ${start.getUTCFullYear()} – Aug ${endYear}`;
}

function getObservationCore(period: string, regionScale = 1) {
  if (isDateRange(period)) {
    const [a, b] = period.split("/");
    const days = Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
    const records = selectedRecords(period);
    const modis = Math.round(records.reduce((s, d) => s + (d.modis ?? 0), 0) * regionScale);
    const viirs = Math.round(records.reduce((s, d) => s + (d.viirs ?? 0), 0) * regionScale);
    const dateLabel =
      a === b
        ? `${shortDate(new Date(a))}, ${a.slice(0, 4)}`
        : `${shortDate(new Date(a))}, ${a.slice(0, 4)} – ${shortDate(new Date(b))}, ${b.slice(0, 4)}`;
    return {
      hasObservations: records.some((d) => d.modis !== null || d.viirs !== null),
      days,
      multiplier: (modis + viirs) / 24873,
      mapLabel: days === 1 ? "Daily observation" : `${days}-day observation`,
      start: `${a}T00:00:00.000Z`,
      end: `${b}T23:59:59.999Z`,
      dateLabel,
      exactLabel: `${dateLabel} · inclusive UTC dates`,
      modis,
      viirs,
      total: modis + viirs,
      anomalies: Math.round(
        records.filter((d) => activityFor(d, "All").anomalous).length * regionScale,
      ),
      changes: { total: "—", modis: "—", viirs: "—", anomalies: "—" },
    };
  }
  const definition =
    observationPeriods[period as ObservationPeriod] ?? observationPeriods["Last 24 hours"];
  const start = new Date(demoEnd.getTime() - definition.days * 86400000);
  const scale = definition.multiplier * regionScale;
  const modis = Math.round(8462 * scale);
  const viirs = Math.round(16411 * scale);
  const anomalies = Math.round(37 * scale);
  const modisGrowth = definition.days === 1 ? 0.082 : definition.days === 7 ? 0.064 : 0.097;
  const viirsGrowth = definition.days === 1 ? 0.154 : definition.days === 7 ? 0.118 : 0.139;
  const previousModis = Math.round(modis / (1 + modisGrowth));
  const previousViirs = Math.round(viirs / (1 + viirsGrowth));
  const change = (current: number, previous: number) =>
    previous ? `+${((current / previous - 1) * 100).toFixed(1)}%` : "—";
  return {
    hasObservations: true,
    ...definition,
    start: start.toISOString(),
    end: demoEnd.toISOString(),
    dateLabel: `${shortDate(start)} – ${shortDate(demoEnd)}, 2026`,
    exactLabel: `${shortDate(start)}, 2026 15:00 – ${shortDate(demoEnd)}, 2026 15:00 UTC`,
    modis,
    viirs,
    anomalies,
    total: modis + viirs,
    changes: {
      total: change(modis + viirs, previousModis + previousViirs),
      modis: change(modis, previousModis),
      viirs: change(viirs, previousViirs),
      anomalies: "−5.1%",
    },
  };
}

export function getObservation(period: string, regionScale = 1, sensor: SensorSelection = "ALL") {
  const raw = getObservationCore(period, regionScale);
  const available = hasDemoData(sensor);
  const records = isDateRange(period) ? selectedRecords(period) : null;
  const modis = available && matchesSensor(sensor, "MODIS") ? raw.modis : 0;
  const viirs = available && matchesSensor(sensor, "VIIRS") ? raw.viirs : 0;
  const anomalies = !available
    ? 0
    : records
      ? Math.round(records.filter((d) => activityFor(d, sensor).anomalous).length * regionScale)
      : raw.anomalies;
  return {
    ...raw,
    rawModis: raw.modis,
    rawViirs: raw.viirs,
    modis,
    viirs,
    total: modis + viirs,
    multiplier: sensor === "ALL" || sensor === "All" ? raw.multiplier : (modis + viirs) / 24873,
    anomalies,
    hasObservations:
      available &&
      (records ? records.some((d) => activityFor(d, sensor).observed) : raw.hasObservations),
    sensor,
    unavailable: !available,
  };
}

export type HistoryPoint = {
  label: string;
  dateLabel: string;
  modis: number;
  viirs: number;
  baselineModis: number;
  baselineViirs: number;
};

export function getHistory(months: number, endYear: number, regionScale: number, weekly = false) {
  const seasonal = [0.58, 0.62, 0.73, 0.81, 0.91, 1.02, 1.08, 1.0, 0.85, 0.72, 0.63, 0.57];
  const monthly: HistoryPoint[] = Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(endYear, 8 - months + i, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const yearScale = year >= 2026 ? 1 : year === 2025 ? 0.82 : 0.69 * 0.92 ** (2024 - year);
    const days =
      year === 2026 && month === 7 ? 24 : new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const scale = regionScale * yearScale * seasonal[month];
    const modis = Math.round(8462 * days * scale);
    const viirs = Math.round(16411 * days * scale * (1 + Math.sin(month * 1.7) * 0.035));
    const end = new Date(Date.UTC(year, month, days));
    return {
      label: shortDate(date).replace(" 1", ""),
      dateLabel: `${shortDate(date)} – ${shortDate(end)}, ${year}`,
      modis,
      viirs,
      baselineModis: Math.round(modis / (1.06 + Math.sin(month) * 0.025)),
      baselineViirs: Math.round(viirs / (1.14 + Math.cos(month) * 0.03)),
    };
  });
  const rangeLabel = getHistoryRangeLabel(months, endYear);
  const current = monthly[monthly.length - 1];
  const total = current.modis + current.viirs;
  const baseline = current.baselineModis + current.baselineViirs;
  // Weekly bins partition each month exactly, including the partial demo month.
  const points = weekly
    ? monthly.flatMap((point, i) => {
        const date = new Date(Date.UTC(endYear, 8 - months + i, 1));
        const lastDay =
          date.getUTCFullYear() === 2026 && date.getUTCMonth() === 7
            ? 24
            : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        const bins = Array.from({ length: Math.ceil(lastDay / 7) }, (_, bin) =>
          Math.min(7, lastDay - bin * 7),
        );
        const used = { modis: 0, viirs: 0, baselineModis: 0, baselineViirs: 0 };
        return bins.map((days, bin) => {
          const values = { ...used };
          for (const key of ["modis", "viirs", "baselineModis", "baselineViirs"] as const) {
            values[key] =
              bin === bins.length - 1
                ? point[key] - used[key]
                : Math.round((point[key] * days) / lastDay);
            used[key] += values[key];
          }
          const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), bin * 7 + 1));
          const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), bin * 7 + days));
          return {
            ...values,
            label: bin === 0 && (months <= 12 || i % 2 === 0) ? point.label : "",
            dateLabel: `${shortDate(from)} – ${shortDate(to)}, ${date.getUTCFullYear()}`,
          };
        });
      })
    : monthly;
  return {
    points,
    current,
    peak: monthly.reduce((peak, point) =>
      point.modis + point.viirs > peak.modis + peak.viirs ? point : peak,
    ),
    total,
    baseline,
    rangeLabel,
    referenceLabel: `${endYear - 5}–${endYear - 1}`,
    change: `+${((total / baseline - 1) * 100).toFixed(1)}%`,
    partial: endYear === 2026,
  };
}

function getSelectedHistoryCore(period: string, factor: number, weekly = false) {
  const records = selectedRecords(period);
  const buckets = new Map<string, typeof records>();
  records.forEach((d, i) => {
    const key = weekly ? String(Math.floor(i / 7)) : d.date.slice(0, 7);
    buckets.set(key, [...(buckets.get(key) ?? []), d]);
  });
  const points: HistoryPoint[] = [...buckets.values()].map((ds) => ({
    label: weekly ? shortDate(new Date(ds[0].date)) : shortDate(new Date(ds[0].date)).split(" ")[0],
    dateLabel: `${shortDate(new Date(ds[0].date))}, ${ds[0].date.slice(0, 4)} – ${shortDate(new Date(ds[ds.length - 1].date))}, ${ds[ds.length - 1].date.slice(0, 4)}`,
    modis: Math.round(ds.reduce((s, d) => s + (d.modis ?? 0), 0) * factor),
    viirs: Math.round(ds.reduce((s, d) => s + (d.viirs ?? 0), 0) * factor),
    baselineModis: Math.round(
      ds.reduce((s, d) => s + (d.modis === null ? 0 : d.baselineModis), 0) * factor,
    ),
    baselineViirs: Math.round(
      ds.reduce((s, d) => s + (d.viirs === null ? 0 : d.baselineViirs), 0) * factor,
    ),
  }));
  const observation = getObservation(period, factor);
  const baseline = points.reduce((s, p) => s + p.baselineModis + p.baselineViirs, 0);
  return {
    points,
    current: points[points.length - 1],
    peak: points.reduce((a, b) => (a.modis + a.viirs > b.modis + b.viirs ? a : b)),
    total: observation.total,
    baseline,
    rangeLabel: observation.dateLabel,
    referenceLabel: `${Number(period.slice(-10, -6)) - 5}–${Number(period.slice(-10, -6)) - 1}`,
    change: baseline ? `${((observation.total / baseline - 1) * 100).toFixed(1)}%` : "N/A",
    partial: false,
  };
}

export function getSelectedHistory(
  period: string,
  factor: number,
  weekly = false,
  sensor: SensorSelection = "ALL",
) {
  const history = getSelectedHistoryCore(period, factor, weekly);
  const available = hasDemoData(sensor);
  const points = history.points.map((point) => ({
    ...point,
    modis: available && matchesSensor(sensor, "MODIS") ? point.modis : 0,
    viirs: available && matchesSensor(sensor, "VIIRS") ? point.viirs : 0,
    baselineModis: available && matchesSensor(sensor, "MODIS") ? point.baselineModis : 0,
    baselineViirs: available && matchesSensor(sensor, "VIIRS") ? point.baselineViirs : 0,
  }));
  const observation = getObservation(period, factor, sensor);
  const baseline = points.reduce((s, p) => s + p.baselineModis + p.baselineViirs, 0);
  return {
    ...history,
    points,
    current: points[points.length - 1],
    peak: points.reduce((a, b) => (a.modis + a.viirs > b.modis + b.viirs ? a : b)),
    total: observation.total,
    baseline,
    change: baseline ? `${((observation.total / baseline - 1) * 100).toFixed(1)}%` : "N/A",
  };
}
