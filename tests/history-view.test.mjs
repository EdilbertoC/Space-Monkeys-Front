// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import test from "node:test";
import assert from "node:assert/strict";
import {
  coverageYears,
  daysFromNormal,
  formatValue,
  intensityLevel,
  isCompleteYear,
  monthGrid,
  shiftLabel,
  weeksAgainstNormal,
  yearRange,
} from "../src/features/history/model/history-view.ts";

const meta = {
  coverage: {
    modis: { start: "2000-11-01", standard_until: "2026-08-31", end: "2026-11-14" },
    viirs: { start: "2012-01-20", standard_until: "2026-07-31", end: "2026-11-10" },
  },
};

const bucket = (start, values) => ({
  start,
  end: start,
  harmonized: values.harmonized === null ? null : { value: values.harmonized, low: 1, high: 3 },
  modis: values.modis,
  viirs: values.viirs,
  provisional: false,
});

test("year range is clipped to the record", () => {
  assert.deepEqual(yearRange(meta, 2000), { start: "2000-11-01", end: "2000-12-31" });
  assert.deepEqual(yearRange(meta, 2026), { start: "2026-01-01", end: "2026-11-14" });
  assert.equal(isCompleteYear(meta, 2025), true);
  assert.equal(isCompleteYear(meta, 2026), false);
  assert.equal(coverageYears(meta)[0], 2026);
  assert.equal(coverageYears(meta).at(-1), 2000);
});

test("month grid places buckets by date and marks days outside the month", () => {
  const grid = monthGrid(2021, [bucket("2021-02-28", { harmonized: 4, modis: 4, viirs: 9 })]);
  assert.equal(grid.length, 12);
  assert.equal(grid[1][27].bucket?.modis, 4);
  assert.equal(grid[1][28].inYear, false); // 29 Feb 2021 does not exist
  assert.equal(grid[0][0].bucket, null); // no bucket returned means no data, not zero
});

test("weeks are compared with the normal without filling missing values", () => {
  const normal = [
    { index: 0, label: "Jan 1–7", median: 5, p10: 2, p90: 8, mean: 5 },
    { index: 1, label: "Jan 8–14", median: 5, p10: 2, p90: 8, mean: 5 },
    { index: 2, label: "Jan 15–21", median: 5, p10: 2, p90: 8, mean: 5 },
  ];
  const weeks = [
    bucket("2021-01-01", { harmonized: 9, modis: 9, viirs: 20 }),
    bucket("2021-01-08", { harmonized: 1, modis: 1, viirs: 2 }),
  ];
  const rows = weeksAgainstNormal(weeks, normal, "harmonized");
  assert.deepEqual(
    rows.map((r) => r.status),
    ["above", "below", null],
  );
  assert.equal(rows[2].value, null);
  assert.equal(weeksAgainstNormal(weeks, normal, "viirs")[0].value, 20);
});

test("formatting keeps estimates fractional and missing data explicit", () => {
  assert.equal(formatValue(1234), "1,234");
  assert.equal(formatValue(12.345), "12.3");
  assert.equal(formatValue(null), "No data");
  assert.equal(intensityLevel(0, 100), 0);
  assert.equal(intensityLevel(100, 100), 5);
  assert.equal(daysFromNormal("2020-04-01", "05-14"), -43);
  assert.equal(shiftLabel(-43), "6 weeks earlier than normal");
  assert.equal(shiftLabel(3), "3 days later than normal");
});
