// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import test from "node:test";
import assert from "node:assert/strict";
import {
  comparePeriods,
  defaultPeriods,
  driftYear,
  evidenceOf,
  indexSeries,
  intervalRuns,
  mannWhitneyP,
  median,
  minAttainableP,
  monthsLabel,
  monthWindowSpans,
  parseRange,
  perDecadePct,
  theilSen,
  toCsv,
  windowMonths,
  windowTotals,
} from "../src/features/territory/model/territory.ts";

const pts = (values, first = 2003) => values.map((value, i) => ({ year: first + i, value }));

test("median handles odd, even and empty input", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.ok(Number.isNaN(median([])));
});

test("theilSen recovers an exact line and needs three years", () => {
  const line = theilSen(pts([10, 8, 6, 4, 2]));
  assert.ok(Math.abs(line.slope + 2) < 1e-9);
  assert.ok(Math.abs(line.slope * 2005 + line.intercept - 6) < 1e-6);
  assert.equal(theilSen(pts([1, 2])), null);
});

test("each period needs three years and periods must not overlap", () => {
  const series = pts([1, 2, 3, 4, 5, 6, 7, 8]);
  const short = comparePeriods(series, { from: 2003, to: 2004 }, { from: 2006, to: 2010 });
  assert.equal(short.enough, false);
  assert.equal(short.p, null);
  const shared = comparePeriods(series, { from: 2003, to: 2006 }, { from: 2006, to: 2010 });
  assert.equal(shared.enough, false);
  assert.equal(
    comparePeriods(series, { from: 2003, to: 2005 }, { from: 2006, to: 2010 }).enough,
    true,
  );
});

test("comparePeriods reports the change of the median year from A to B", () => {
  const series = pts([100, 120, 110, 999, 50, 60, 55]);
  // 2006 (999) is in neither period, so it does not count.
  const cmp = comparePeriods(series, { from: 2003, to: 2005 }, { from: 2007, to: 2009 });
  assert.equal(cmp.a.median, 110);
  assert.equal(cmp.b.median, 55);
  assert.equal(cmp.changePct, -50);
});

test("defaultPeriods splits the years in halves and needs enough years", () => {
  assert.deepEqual(defaultPeriods([2003, 2004, 2005, 2006, 2007, 2008, 2009]), {
    a: { from: 2003, to: 2005 },
    b: { from: 2006, to: 2009 },
  });
  assert.equal(defaultPeriods([2003, 2004, 2005, 2006, 2007]), null);
  assert.deepEqual(parseRange("2003-2011"), { from: 2003, to: 2011 });
  assert.equal(parseRange("2011-2003"), null);
});

test("windowTotals sums the window months and skips incomplete years", () => {
  const month = (y, m, value) => ({ start: `${y}-${String(m).padStart(2, "0")}-01`, value });
  const buckets = [
    month(2003, 7, 1),
    month(2003, 8, 2),
    month(2003, 9, 3),
    month(2004, 7, 10),
    month(2004, 8, null),
    month(2004, 9, 30),
    month(2004, 11, 5),
    month(2004, 12, 6),
    month(2005, 1, 7),
  ];
  assert.deepEqual(windowTotals(buckets, { from: 7, to: 9 }, new Set([2003, 2004])), [
    { year: 2003, value: 6 },
  ]);
  // Nov–Jan wraps: it counts for the year it ends in.
  assert.deepEqual(windowTotals(buckets, { from: 11, to: 1 }, new Set([2005])), [
    { year: 2005, value: 18 },
  ]);
  assert.deepEqual(windowMonths({ from: 11, to: 2 }), [11, 12, 1, 2]);
  assert.equal(monthsLabel({ from: 1, to: 12 }), "whole year");
  assert.equal(monthsLabel({ from: 7, to: 10 }), "Jul–Oct");
});

test("mannWhitneyP matches a worked example and is symmetric", () => {
  const p = mannWhitneyP([1, 2, 3], [4, 5, 6]);
  assert.ok(Math.abs(p - 0.081) < 0.005, `p = ${p}`);
  assert.equal(p, mannWhitneyP([4, 5, 6], [1, 2, 3]));
  assert.equal(mannWhitneyP([1, 2, 3], [1, 2, 3]), 1);
  assert.equal(mannWhitneyP([], [1]), null);
});

test("indexSeries puts the base median at 100 and refuses a zero base", () => {
  const out = indexSeries(pts([50, 100, 200]), (y) => y === 2003 || y === 2004);
  assert.deepEqual(
    out.map((p) => p.value),
    [(50 / 75) * 100, (100 / 75) * 100, (200 / 75) * 100],
  );
  assert.deepEqual(indexSeries(pts([0, 0, 0])), []);
});

test("toCsv writes what the API returned and leaves unknown cells empty", () => {
  const csv = toCsv(
    [
      { year: 2003, territory: 10, reference: 100 },
      { year: 2004, territory: 12, low: 9, high: 15 },
    ],
    "pantanal",
    "brazil",
  );
  assert.equal(
    csv,
    "year,fire_cell_days_pantanal,interval_low_90,interval_high_90,fire_cell_days_brazil\n" +
      "2003,10,,,100\n2004,12,9,15,\n",
  );
});

test("intervalRuns groups consecutive estimated years and skips years without an interval", () => {
  const p = (year, interval) => ({ year, value: 1, ...(interval ? { low: 0, high: 2 } : {}) });
  const runs = intervalRuns([p(2020), p(2021, true), p(2022, true), p(2023), p(2024, true)]);
  assert.deepEqual(
    runs.map((r) => r.map((q) => q.year)),
    [[2021, 2022], [2024]],
  );
  assert.deepEqual(intervalRuns([p(2020), p(2021)]), []);
});

test("a zero base cannot index a series, so the page must fall back to absolute values", () => {
  assert.deepEqual(
    indexSeries(pts([0, 0, 0, 5, 7]), (y) => y < 2006),
    [],
  );
});

test("drift is flagged until a switch date on or before 2022-01-01 removes it", () => {
  assert.equal(driftYear(null), 2022);
  assert.equal(driftYear(undefined), 2022);
  assert.equal(driftYear("2024-01-01"), 2022);
  assert.equal(driftYear("2022-01-01"), null);
  assert.equal(driftYear("2021-06-01"), null);
});

test("monthWindowSpans: the month window inside every year, never one long span", () => {
  assert.deepEqual(monthWindowSpans({ from: 2003, to: 2005 }, { from: 7, to: 10 }, "2026-11-15"), [
    { start: "2003-07-01", end: "2003-10-31" },
    { start: "2004-07-01", end: "2004-10-31" },
    { start: "2005-07-01", end: "2005-10-31" },
  ]);
  // Across the new year: each window counts for the year it ends in (leap February).
  assert.deepEqual(monthWindowSpans({ from: 2004, to: 2004 }, { from: 11, to: 2 }, "2026-11-15"), [
    { start: "2003-11-01", end: "2004-02-29" },
  ]);
  // A window not started yet is dropped; one under way is cut at today.
  assert.deepEqual(monthWindowSpans({ from: 2026, to: 2027 }, { from: 7, to: 12 }, "2026-11-15"), [
    { start: "2026-07-01", end: "2026-11-15" },
  ]);
});

test("minAttainableP: 3 years against 3 can never reach 0.05", () => {
  assert.equal(minAttainableP(3, 3), 0.1);
  assert.ok(minAttainableP(3, 4) > 0.05);
  assert.ok(minAttainableP(4, 4) < 0.05);
  assert.ok(minAttainableP(3, 5) < 0.05);
});

test("evidenceOf: a big drop with 3 years each is untestable, not 'no change'", () => {
  // Every B year below every A year: the strongest ordering 3 v 3 allows.
  const series = pts([100, 110, 120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 50, 55, 60]);
  const short = comparePeriods(series, { from: 2003, to: 2005 }, { from: 2018, to: 2020 });
  assert.equal(Math.round(short.changePct), -50);
  assert.equal(evidenceOf(short), "untestable");
  const long = comparePeriods(
    pts([100, 110, 120, 105, 115, 50, 55, 60, 52, 58]),
    { from: 2003, to: 2007 },
    { from: 2008, to: 2012 },
  );
  assert.equal(evidenceOf(long), "confirmed");
});

test("perDecadePct: slope as % of the typical year per decade", () => {
  assert.equal(perDecadePct(-10, [100, 100, 100]), -100);
  assert.equal(perDecadePct(5, [0, 0]), null);
});
