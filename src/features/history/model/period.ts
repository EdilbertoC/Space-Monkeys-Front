// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import type { Series } from "../../../shared/api/types.ts";
import { periodDays } from "./area.ts";
import { bucketValue, type Bucket } from "./history-view.ts";

export type Period = { start: string; end: string };

export function granularityFor(period: Period): "day" | "week" | "month" {
  const days = periodDays(period.start, period.end);
  return days <= 120 ? "day" : days <= 3 * 366 ? "week" : "month";
}

/** Sum of one series over buckets; null when no bucket has data for it. */
export function seriesTotal(buckets: Bucket[], series: Series): number | null {
  let total: number | null = null;
  for (const b of buckets) {
    const v = bucketValue(b, series);
    if (v !== null) total = (total ?? 0) + v;
  }
  return total === null ? null : Math.round(total * 10) / 10;
}
