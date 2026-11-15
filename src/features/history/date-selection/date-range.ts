// Date helpers for the period picker. Periods are inclusive UTC ranges "YYYY-MM-DD/YYYY-MM-DD".
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
export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
export const parseDate = (date: string) => new Date(`${date}T00:00:00Z`);

/** Fallback shown by the picker before the API reports the record's coverage. */
export const DEFAULT_DATES = "2020-08-01/2020-10-31";
export const isDateRange = (value: string) => /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/.test(value);

/** Resolve "Last N days" presets to an inclusive range ending on `end` (the record's last day). */
export function resolveObservationPeriod(value: string, end = DEFAULT_DATES.slice(-10)) {
  const days = (
    { "Last 24 hours": 1, "Last 7 days": 7, "Last 30 days": 30 } as Record<string, number>
  )[value];
  if (!days) return value;
  const start = parseDate(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return `${isoDate(start)}/${end}`;
}
