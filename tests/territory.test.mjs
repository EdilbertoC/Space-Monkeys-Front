// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import test from "node:test";
import assert from "node:assert/strict";
import {
  compareAt,
  decisionYears,
  indexSeries,
  mannWhitneyP,
  median,
  splitAt,
  theilSen,
  toCsv,
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

test("a decision year goes to the after side, and each side needs three years", () => {
  const series = pts([1, 2, 3, 4, 5, 6, 7, 8]);
  const { before, after } = splitAt(series, 2006);
  assert.deepEqual(
    before.map((p) => p.year),
    [2003, 2004, 2005],
  );
  assert.equal(after[0].year, 2006);
  assert.deepEqual(decisionYears(series), [2006, 2007, 2008]);
  assert.equal(compareAt(series, 2004).enough, false);
  assert.equal(compareAt(series, 2004).p, null);
});

test("compareAt reports the change of the median year", () => {
  const cmp = compareAt(pts([100, 120, 110, 50, 60, 55]), 2006);
  assert.equal(cmp.before.median, 110);
  assert.equal(cmp.after.median, 55);
  assert.equal(cmp.changePct, -50);
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
