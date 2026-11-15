import type { SensorSelection } from "../../sensors/sensors.ts";
import {
  activityFor,
  CALENDAR_CUTOFF,
  generateCalendar,
  type CalendarScope,
} from "./calendar-data.ts";

export type MapPoint = { x: number; y: number };
export type AreaSelection = {
  kind: "cells" | "rectangle" | "polygon";
  points: MapPoint[];
  cells: number[];
};
export const GRID_COLUMNS = 24;
export const GRID_ROWS = 12;
export function cellBounds(index: number) {
  return {
    x: (index % GRID_COLUMNS) * (1000 / GRID_COLUMNS),
    y: Math.floor(index / GRID_COLUMNS) * (450 / GRID_ROWS),
    width: 1000 / GRID_COLUMNS,
    height: 450 / GRID_ROWS,
  };
}
export function selectionLabel(area: AreaSelection | null) {
  if (!area) return "Global";
  if (area.kind === "cells")
    return area.cells.length === 1
      ? `Grid cell R${Math.floor(area.cells[0] / GRID_COLUMNS) + 1} C${(area.cells[0] % GRID_COLUMNS) + 1}`
      : `${area.cells.length} selected grid cells`;
  return area.kind === "polygon"
    ? `Custom polygon · ${area.points.length} vertices`
    : "Rectangular area";
}
export function selectionScope(area: AreaSelection | null): CalendarScope {
  if (!area) return { kind: "Global", name: "Global" };
  // A stable fixture identity, not a geographic query or a sensor footprint.
  const key =
    area.kind === "cells"
      ? [...area.cells].sort((a, b) => a - b).join("-")
      : area.points.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join(";");
  return { kind: "Custom Area", name: `${selectionLabel(area)} [${key}]` };
}
export function validPolygon(points: MapPoint[]) {
  if (points.length < 3) return false;
  const area = points.reduce((sum, p, i) => {
    const next = points[(i + 1) % points.length];
    return sum + p.x * next.y - next.x * p.y;
  }, 0);
  return (
    Math.abs(area) > 10 &&
    points.every(
      (p) =>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.x >= 0 &&
        p.x <= 1000 &&
        p.y >= 0 &&
        p.y <= 450,
    )
  );
}
export const latestDemoYear = Number(CALENDAR_CUTOFF.slice(0, 4));
export type DemoAnomaly = {
  id: string;
  region: string;
  date: string;
  sensor: "MODIS" | "VIIRS";
  current: number;
  baseline: number;
  deviation: number;
  severity: "Critical" | "High" | "Moderate";
  illustrative: true;
};
export function getDemoAnomalies(
  scope: CalendarScope,
  period: string,
  sensor: SensorSelection,
): DemoAnomaly[] {
  if (!["ALL", "All", "MODIS", "VIIRS"].includes(sensor)) return [];
  const source = sensor === "VIIRS" ? "VIIRS" : "MODIS";
  const [start, end] = period.split("/");
  if (!start || !end || start > end) return [];
  const first = Math.max(2001, Number(start.slice(0, 4)));
  const last = Math.min(latestDemoYear, Number(end.slice(0, 4)));
  const records: DemoAnomaly[] = [];
  for (let year = first; year <= last; year++) {
    for (const day of generateCalendar(year, scope)) {
      if (day.date < start || day.date > end) continue;
      const a = activityFor(day, source);
      if (
        !a.anomalous ||
        a.partial ||
        a.total === null ||
        a.baseline === null ||
        a.deviation === null
      )
        continue;
      records.push({
        id: `${scope.kind}:${scope.name}:${day.date}:${source}`,
        region: scope.name,
        date: day.date,
        sensor: source,
        current: a.total,
        baseline: a.baseline,
        deviation: a.deviation,
        severity: a.deviation >= 75 ? "Critical" : a.deviation >= 50 ? "High" : "Moderate",
        illustrative: true,
      });
    }
  }
  return records.sort((a, b) => b.deviation - a.deviation);
}

export function getExplorationHistory(
  scope: CalendarScope,
  sensor: SensorSelection,
  startYear: number,
  endYear: number,
  month: number,
  aggregation: "Monthly" | "Yearly",
) {
  if (startYear < 2001 || endYear > latestDemoYear || startYear > endYear) return [];
  const primary = sensor === "ALL" || sensor === "All" ? "MODIS" : sensor;
  const buckets = new Map<string, ReturnType<typeof generateCalendar>>();
  for (let year = startYear; year <= endYear; year++) {
    for (const day of generateCalendar(year, scope)) {
      if (month >= 0 && day.month !== month) continue;
      const key = aggregation === "Yearly" ? day.date.slice(0, 4) : day.date.slice(0, 7);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(day);
    }
  }
  return [...buckets].map(([label, days]) => {
    const records = days.map((day) => activityFor(day, primary)).filter((a) => a.observed);
    const viirs = days.filter((day) => day.viirs !== null);
    return {
      label,
      start: days[0].date,
      end: days[days.length - 1].date,
      total: records.length ? records.reduce((s, a) => s + a.total!, 0) : null,
      baseline: records.length ? records.reduce((s, a) => s + (a.baseline ?? 0), 0) : null,
      viirs: viirs.length ? viirs.reduce((s, d) => s + d.viirs!, 0) : null,
      observedDays: records.length,
      days: days.length,
    };
  });
}

export function explorationCsv(
  points: ReturnType<typeof getExplorationHistory>,
  sensor: SensorSelection,
  scope: CalendarScope,
) {
  const quote = (value: string | number | null) =>
    `"${String(value ?? "N/A").replace(/"/g, '""')}"`;
  const primary = sensor === "ALL" || sensor === "All" ? "MODIS fallback" : sensor;
  return [
    ["OrbitBurn historical exploration", "ILLUSTRATIVE DEMO; not operational observations"],
    ["Selected area", scope.name],
    ["Sensor filter", sensor],
    ["Primary series", primary],
    ["Harmonized output", "Not implemented; no harmonized metric or FRP"],
    ["SENTINEL3_SLSTR", "Planned; no observations"],
    ["GOES_ABI", "Planned; no observations; regional coverage, not global"],
    [
      "Period",
      "Start UTC",
      "End UTC",
      "Primary raw demo detections",
      "Matched synthetic baseline",
      "VIIRS raw comparison",
      "SENTINEL3_SLSTR observations",
      "GOES_ABI observations",
      "Observed days",
      "Selected days",
    ],
    ...points.map((p) => [
      p.label,
      `${p.start}T00:00:00Z`,
      `${p.end}T23:59:59.999Z`,
      p.total,
      p.baseline,
      p.viirs,
      null,
      null,
      p.observedDays,
      p.days,
    ]),
  ]
    .map((row) => row.map(quote).join(","))
    .join("\n");
}
