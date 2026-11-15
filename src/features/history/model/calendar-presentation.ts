import { formatCount } from "../../../shared/lib/format-count";
import { summarizeCalendar } from "../demo/calendar-data";
export type CalendarSummary = ReturnType<typeof summarizeCalendar>;
export const formatCalendarCount = (value: number | null) =>
  value === null ? "N/A" : formatCount(value);
export const formatCompactCount = (n: number) =>
  n >= 1000000
    ? `${+(n / 1000000).toFixed(1)}m`
    : n >= 1000
      ? `${+(n / 1000).toFixed(1)}k`
      : formatCount(n);
