// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Pure statistics for the Territory page: two periods compared (optionally within a month
// window), the trend line and a reference comparison. They only summarise yearly totals the API returned; they never
// invent, fill or rescale a missing year.

export interface YearPoint {
  year: number;
  value: number;
  /** 90% interval, present only when the year is partly estimated from VIIRS. */
  low?: number;
  high?: number;
}

/** From 2022 MODIS (Terra and Aqua) observes at drifting local times (docs/methodology.md, section 5). */
export const MODIS_DRIFT_FROM_YEAR = 2022;

/**
 * First year the harmonized series still takes from drifted MODIS, or null when a switch to
 * the VIIRS estimate on or before 2022-01-01 removes it.
 */
export function driftYear(switchDate: string | null | undefined): number | null {
  return !switchDate || switchDate > `${MODIS_DRIFT_FROM_YEAR}-01-01`
    ? MODIS_DRIFT_FROM_YEAR
    : null;
}

/** Fewest complete years in each period for a comparison to be shown. */
export const MIN_SEGMENT_YEARS = 3;

export function median(values: readonly number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Theil–Sen line through (year, value): median of pairwise slopes, median intercept. */
export function theilSen(
  points: readonly YearPoint[],
): { slope: number; intercept: number } | null {
  if (points.length < 3) return null;
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      slopes.push((points[j]!.value - points[i]!.value) / (points[j]!.year - points[i]!.year));
  const slope = median(slopes);
  return { slope, intercept: median(points.map((p) => p.value - slope * p.year)) };
}

export interface Segment {
  n: number;
  firstYear: number | null;
  lastYear: number | null;
  median: number;
  min: number;
  max: number;
}

export function summarize(points: readonly YearPoint[]): Segment {
  const values = points.map((p) => p.value);
  return {
    n: points.length,
    firstYear: points[0]?.year ?? null,
    lastYear: points.at(-1)?.year ?? null,
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** An inclusive range of calendar years. */
export interface YearRange {
  from: number;
  to: number;
}

export const inRange = (points: readonly YearPoint[], r: YearRange) =>
  points.filter((p) => p.year >= r.from && p.year <= r.to);

export const overlaps = (a: YearRange, b: YearRange) => a.from <= b.to && b.from <= a.to;

export const rangeLabel = (r: YearRange) => (r.from === r.to ? `${r.from}` : `${r.from}–${r.to}`);

/** "2003-2013" → range; null when malformed. */
export function parseRange(text: string | null): YearRange | null {
  const m = /^(\d{4})-(\d{4})$/.exec(text ?? "");
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  return from <= to ? { from, to } : null;
}

/**
 * Starting periods: the first and second half of the years available, so the page opens
 * with a comparison instead of an empty card. Null when there are too few years.
 */
export function defaultPeriods(years: readonly number[]): { a: YearRange; b: YearRange } | null {
  if (years.length < 2 * MIN_SEGMENT_YEARS) return null;
  const half = Math.floor(years.length / 2);
  return {
    a: { from: years[0]!, to: years[half - 1]! },
    b: { from: years[half]!, to: years.at(-1)! },
  };
}

/** Months of the year, 1–12, inclusive. `from > to` wraps the new year (e.g. Nov–Feb). */
export interface MonthRange {
  from: number;
  to: number;
}

export const ALL_MONTHS: MonthRange = { from: 1, to: 12 };
export const MONTHS = [
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
] as const;

export const isAllYear = (m: MonthRange) => m.from === 1 && m.to === 12;

export const monthsLabel = (m: MonthRange) =>
  isAllYear(m)
    ? "whole year"
    : m.from === m.to
      ? MONTHS[m.from - 1]!
      : `${MONTHS[m.from - 1]}–${MONTHS[m.to - 1]}`;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * One date span per year of `range` covering only the month window: Jul–Oct gives
 * Jul–Oct 2003, Jul–Oct 2004, … A window across the new year (Nov–Mar) counts for the year
 * it ends in, as windowTotals does. Spans starting after `today` (YYYY-MM-DD) are dropped;
 * one running past it is cut there.
 */
export function monthWindowSpans(
  range: YearRange,
  m: MonthRange,
  today: string,
): { start: string; end: string }[] {
  const wraps = m.from > m.to;
  const spans: { start: string; end: string }[] = [];
  for (let y = range.from; y <= range.to; y++) {
    const start = `${wraps ? y - 1 : y}-${pad2(m.from)}-01`;
    const lastDay = new Date(Date.UTC(y, m.to, 0)).getUTCDate();
    const end = `${y}-${pad2(m.to)}-${pad2(lastDay)}`;
    if (start > today) continue;
    spans.push({ start, end: end > today ? today : end });
  }
  return spans;
}

/** The months a window covers, in order (a wrapping window ends in the next year). */
export function windowMonths(m: MonthRange): number[] {
  const out: number[] = [];
  for (let k = m.from; ; k = (k % 12) + 1) {
    out.push(k);
    if (k === m.to) break;
  }
  return out;
}

export interface MonthBucket {
  /** First day of the month, YYYY-MM-DD. */
  start: string;
  value: number | null;
}

/**
 * Yearly totals restricted to a month window, from monthly buckets. A wrapping window
 * (Nov–Feb) is assigned to the year it ends in. A year counts only when every month of its
 * window has a value and the year is in `years` (complete years); nothing is filled in.
 */
export function windowTotals(
  buckets: readonly MonthBucket[],
  months: MonthRange,
  years: ReadonlySet<number>,
): YearPoint[] {
  const byMonth = new Map<string, number | null>();
  for (const b of buckets) byMonth.set(b.start.slice(0, 7), b.value);
  const list = windowMonths(months);
  const wraps = months.from > months.to;
  const out: YearPoint[] = [];
  for (const year of [...years].sort((a, b) => a - b)) {
    let total = 0;
    let ok = true;
    for (const m of list) {
      const y = wraps && m >= months.from ? year - 1 : year;
      const v = byMonth.get(`${y}-${String(m).padStart(2, "0")}`);
      if (v === null || v === undefined) {
        ok = false;
        break;
      }
      total += v;
    }
    if (ok) out.push({ year, value: total });
  }
  return out;
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26, absolute error below 1.5e-7).
function normalCdf(z: number): number {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/**
 * Two-sided Mann–Whitney U test (normal approximation, continuity and tie correction):
 * do yearly totals tend to be higher on one side? Returns null when a side is empty.
 */
export function mannWhitneyP(a: readonly number[], b: readonly number[]): number | null {
  const n1 = a.length;
  const n2 = b.length;
  if (!n1 || !n2) return null;
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort(
    (x, y) => x.v - y.v,
  );
  const ranks = new Array<number>(all.length);
  let tieTerm = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j + 1 < all.length && all[j + 1]!.v === all[i]!.v) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = rank;
    const t = j - i + 1;
    tieTerm += t ** 3 - t;
    i = j + 1;
  }
  const r1 = all.reduce((sum, item, i) => sum + (item.g === 0 ? ranks[i]! : 0), 0);
  const u = r1 - (n1 * (n1 + 1)) / 2;
  const n = n1 + n2;
  const variance = ((n1 * n2) / 12) * (n + 1 - tieTerm / (n * (n - 1)));
  if (variance <= 0) return 1;
  const z = (Math.abs(u - (n1 * n2) / 2) - 0.5) / Math.sqrt(variance);
  if (z <= 0) return 1; // the continuity correction already cancels the whole difference
  return Math.min(1, 2 * (1 - normalCdf(z)));
}

export interface Comparison {
  a: Segment;
  b: Segment;
  /** Change of the median yearly total from period A to period B, in percent of A. */
  changePct: number | null;
  p: number | null;
  /** Both periods have at least MIN_SEGMENT_YEARS years and do not overlap. */
  enough: boolean;
}

/** Period B against period A: change of the median year and a Mann–Whitney test. */
export function comparePeriods(
  points: readonly YearPoint[],
  a: YearRange,
  b: YearRange,
): Comparison {
  const pa = inRange(points, a);
  const pb = inRange(points, b);
  const sa = summarize(pa);
  const sb = summarize(pb);
  const enough =
    !overlaps(a, b) && pa.length >= MIN_SEGMENT_YEARS && pb.length >= MIN_SEGMENT_YEARS;
  return {
    a: sa,
    b: sb,
    changePct: enough && sa.median > 0 ? ((sb.median - sa.median) / sa.median) * 100 : null,
    p: enough
      ? mannWhitneyP(
          pa.map((p) => p.value),
          pb.map((p) => p.value),
        )
      : null,
    enough,
  };
}

/**
 * Rescale a series so the median of `baseYears` (or of every year, when none) is 100.
 * Used to put a territory and a reference on one axis. Returns [] if the base is not > 0.
 */
export function indexSeries(
  points: readonly YearPoint[],
  baseYears?: (year: number) => boolean,
): YearPoint[] {
  const base = median(points.filter((p) => !baseYears || baseYears(p.year)).map((p) => p.value));
  if (!(base > 0)) return [];
  const scale = (v: number | undefined) => (v === undefined ? undefined : (v / base) * 100);
  return points.map((p) => ({
    year: p.year,
    value: scale(p.value)!,
    low: scale(p.low),
    high: scale(p.high),
  }));
}

/** Runs of consecutive years that carry a 90% interval (years partly estimated from VIIRS). */
export function intervalRuns(points: readonly YearPoint[]): YearPoint[][] {
  const runs: YearPoint[][] = [];
  for (const p of points) {
    if (p.low === undefined || p.high === undefined) continue;
    const last = runs.at(-1);
    if (last && last.at(-1)!.year === p.year - 1) last.push(p);
    else runs.push([p]);
  }
  return runs;
}

export interface ExportRow {
  year: number;
  territory: number;
  low?: number;
  high?: number;
  reference?: number;
}

function csvCell(value: string | number | undefined): string {
  if (value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV of the yearly totals behind the chart: what the API returned, nothing derived. */
export function toCsv(rows: readonly ExportRow[], territory: string, reference: string | null) {
  const head = [
    "year",
    `fire_cell_days_${territory}`,
    "interval_low_90",
    "interval_high_90",
    ...(reference ? [`fire_cell_days_${reference}`] : []),
  ];
  const lines = rows.map((r) =>
    [r.year, r.territory, r.low, r.high, ...(reference ? [r.reference] : [])]
      .map(csvCell)
      .join(","),
  );
  return [head.map(csvCell).join(","), ...lines].join("\n") + "\n";
}
