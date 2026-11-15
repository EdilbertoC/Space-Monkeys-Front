// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
// Pure statistics for the Territory page: before/after a decision, the trend line and a
// reference comparison. They only summarise yearly totals the API returned; they never
// invent, fill or rescale a missing year.

export interface YearPoint {
  year: number;
  value: number;
  /** 90% interval, present only when the year is partly estimated from VIIRS. */
  low?: number;
  high?: number;
}

/** Fewest complete years on each side of a decision for a comparison to be shown. */
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

/** A decision taking effect in `year` puts that whole year on the "after" side. */
export function splitAt(points: readonly YearPoint[], year: number) {
  return {
    before: points.filter((p) => p.year < year),
    after: points.filter((p) => p.year >= year),
  };
}

/** Decision years that leave at least MIN_SEGMENT_YEARS complete years on each side. */
export function decisionYears(points: readonly YearPoint[]): number[] {
  return points
    .map((p) => p.year)
    .filter((year) => {
      const { before, after } = splitAt(points, year);
      return before.length >= MIN_SEGMENT_YEARS && after.length >= MIN_SEGMENT_YEARS;
    });
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
  before: Segment;
  after: Segment;
  /** Change of the median yearly total, in percent of the "before" median. */
  changePct: number | null;
  p: number | null;
  /** Both sides have at least MIN_SEGMENT_YEARS years. */
  enough: boolean;
}

export function compareAt(points: readonly YearPoint[], year: number): Comparison {
  const { before, after } = splitAt(points, year);
  const b = summarize(before);
  const a = summarize(after);
  const enough = before.length >= MIN_SEGMENT_YEARS && after.length >= MIN_SEGMENT_YEARS;
  return {
    before: b,
    after: a,
    changePct: enough && b.median > 0 ? ((a.median - b.median) / b.median) * 100 : null,
    p: enough
      ? mannWhitneyP(
          before.map((p) => p.value),
          after.map((p) => p.value),
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
