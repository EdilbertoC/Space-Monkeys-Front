import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnnualActivity,
  buildActivityMatrix,
} from "../src/features/history/demo/harmonized-preview.ts";
import { generateCalendar, summarizeCalendar } from "../src/features/history/demo/calendar-data.ts";
const scope = { kind: "Global", name: "Global" };
test("annual view exposes 12 UTC months for every supported year from 2001", () => {
  for (let year = 2001; year <= 2026; year++) {
    const months = buildAnnualActivity(year, "raw", scope, "ALL");
    assert.equal(months.length, 12);
    assert.equal(months[0].start, `${year}-01-01`);
    assert.equal(months.at(-1).end, `${year}-12-31`);
  }
  assert.equal(buildAnnualActivity(2024, "raw", scope, "MODIS")[1].end, "2024-02-29");
  assert.deepEqual(buildAnnualActivity(2000, "raw", scope, "ALL"), []);
  assert.deepEqual(buildAnnualActivity(2027, "raw", scope, "ALL"), []);
});
test("annual data preserves raw references, zeros, missing data and historical compatibility", () => {
  for (const mode of ["raw", "harmonized"]) {
    assert.deepEqual(
      buildAnnualActivity(2026, mode, scope, "ALL"),
      buildActivityMatrix(mode, scope, "ALL").filter((c) => c.year === 2026),
    );
  }
  const summary = summarizeCalendar(generateCalendar(2001, scope), "MODIS");
  buildAnnualActivity(2001, "raw", scope, "MODIS").forEach((c, i) =>
    assert.equal(c.value, summary.monthly[i].total),
  );
  assert.ok(buildAnnualActivity(2026, "raw", scope, "GOES_ABI").every((c) => c.value === null));
  assert.ok(
    buildAnnualActivity(2026, "harmonized", scope, "ALL")
      .slice(8)
      .every((c) => c.value === null),
  );
  const zero = buildActivityMatrix("harmonized", scope, "ALL").find((c) => c.value === 0);
  assert.ok(zero);
  assert.equal(buildAnnualActivity(zero.year, "harmonized", scope, "ALL")[zero.month].value, 0);
});
