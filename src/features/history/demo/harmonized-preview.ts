// Isolated presentation fixtures. These are NOT a harmonization algorithm,
// scientific index, FRP measurement, land-cover classification or live API data.
import type { SensorSelection } from "../../sensors/sensors.ts";
import {
  CALENDAR_CUTOFF,
  generateCalendar,
  MONTHS,
  summarizeCalendar,
  type CalendarScope,
} from "./calendar-data.ts";

export type ActivityDisplayMode = "raw" | "harmonized";
export const PREVIEW_SUMMARY = {
  index: 84.6,
  baselineChange: 18.4,
  frpMw: 142890,
  criticalRegions: 14,
  agriculturalPercent: 68,
  forestPercent: 32,
  illustrative: true,
} as const;
export type MatrixCell = {
  year: number;
  month: number;
  label: string;
  start: string;
  end: string;
  value: number | null;
  deviation: number | null;
  level: "minimal" | "seasonal" | "elevated" | "extreme" | "missing";
  observedDays: number | null;
  provenance: string;
};
export function buildActivityMatrix(
  mode: ActivityDisplayMode,
  scope: CalendarScope,
  sensor: SensorSelection,
  years = Array.from({ length: 21 }, (_, i) => 2006 + i),
): MatrixCell[] {
  const supported =
    mode === "harmonized"
      ? sensor === "ALL" || sensor === "All"
      : ["ALL", "All", "MODIS", "VIIRS"].includes(sensor);
  const seed = [...`${scope.kind}:${scope.name}:${JSON.stringify(scope.bounds ?? {})}`].reduce(
    (sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0,
    17,
  );
  return years.flatMap((year) => {
    const monthly =
      mode === "raw" ? summarizeCalendar(generateCalendar(year, scope), sensor).monthly : null;
    return MONTHS.map((name, month) => {
      const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const end = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
      const sample = (seed + year * 13 + month * 29) % 101;
      const reference = scope.kind === "Global" && year === 2026 && month === 7;
      const value =
        !supported || start > CALENDAR_CUTOFF
          ? null
          : mode === "raw"
            ? monthly![month].total
            : reference
              ? 92.4
              : sample % 17 === 0
                ? 0
                : Math.round((8 + sample * 0.89) * 10) / 10;
      const deviation =
        value === null
          ? null
          : mode === "raw"
            ? monthly![month].deviation
            : reference
              ? 51
              : Math.round((sample - 38) * 0.83);
      return {
        year,
        month,
        label: `${name} ${year}`,
        start,
        end,
        value,
        deviation,
        level:
          value === null
            ? ("missing" as const)
            : mode === "raw"
              ? value === 0
                ? ("minimal" as const)
                : (deviation ?? 0) >= 50
                  ? ("extreme" as const)
                  : (deviation ?? 0) >= 25
                    ? ("elevated" as const)
                    : ("seasonal" as const)
              : value < 15
                ? ("minimal" as const)
                : value < 60
                  ? ("seasonal" as const)
                  : value < 85
                    ? ("elevated" as const)
                    : ("extreme" as const),
        observedDays: mode === "raw" ? monthly![month].days : null,
        provenance:
          mode === "harmonized"
            ? "VIIRS + MODIS Harmonized · illustrative scenario only"
            : `${sensor === "ALL" || sensor === "All" ? "MODIS + VIIRS" : sensor} raw synthetic counts · not deduplicated`,
      };
    });
  });
}

export function buildAnnualActivity(
  year: number,
  mode: ActivityDisplayMode,
  scope: CalendarScope,
  sensor: SensorSelection,
) {
  if (!Number.isInteger(year) || year < 2001 || year > Number(CALENDAR_CUTOFF.slice(0, 4)))
    return [];
  return buildActivityMatrix(mode, scope, sensor, [year]);
}
