import { CALENDAR_CUTOFF } from "../demo/calendar-data.ts";
export const DEFAULT_DATES = `${CALENDAR_CUTOFF}/${CALENDAR_CUTOFF}`;
export const isDateRange = (value: string) => /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(value);

/** Resolve UI presets once to inclusive UTC fixture dates, shared by map and chart. */
export function resolveObservationPeriod(value: string) {
  const days = (
    { "Last 24 hours": 1, "Last 7 days": 7, "Last 30 days": 30 } as Record<string, number>
  )[value];
  if (!days) return value;
  const start = new Date(`${CALENDAR_CUTOFF}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return `${start.toISOString().slice(0, 10)}/${CALENDAR_CUTOFF}`;
}
