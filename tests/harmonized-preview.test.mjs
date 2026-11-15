import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivityMatrix,
  PREVIEW_SUMMARY,
} from "../src/features/history/demo/harmonized-preview.ts";
import {
  activityFor,
  generateCalendar,
  summarizeCalendar,
  CALENDAR_CUTOFF,
} from "../src/features/history/demo/calendar-data.ts";

const scope = { kind: "Global", name: "Global" };
test("2006 through 2026 includes 21 years and 252 UTC month cells without implying a 21-year baseline", () => {
  const cells = buildActivityMatrix("harmonized", scope, "ALL");
  assert.equal(cells.length, 252);
  assert.equal(new Set(cells.map((c) => c.year)).size, 21);
  assert.equal(cells[0].start, "2006-01-01");
  assert.equal(cells.at(-1).end, "2026-12-31");
  assert.equal(cells.find((c) => c.start === "2024-02-01").end, "2024-02-29");
});
test("requested figures are isolated explicitly illustrative design fixtures, not API measurements", () => {
  assert.equal(PREVIEW_SUMMARY.illustrative, true);
  assert.equal(PREVIEW_SUMMARY.index, 84.6);
  assert.equal(PREVIEW_SUMMARY.frpMw, 142890);
  assert.equal(PREVIEW_SUMMARY.criticalRegions, 14);
  assert.equal(PREVIEW_SUMMARY.agriculturalPercent + PREVIEW_SUMMARY.forestPercent, 100);
  const august = buildActivityMatrix("harmonized", scope, "ALL").find(
    (c) => c.label === "August 2026",
  );
  assert.equal(august.value, 92.4);
  assert.equal(august.deviation, 51);
  assert.equal(august.level, "extreme");
  assert.match(august.provenance, /illustrative scenario only/);
  assert.equal(august.observedDays, null);
});
test("raw display switches to existing source records, never relabeling counts as HFI or FRP", () => {
  for (const sensor of ["ALL", "MODIS", "VIIRS"]) {
    const cells = buildActivityMatrix("raw", scope, sensor);
    const summary = summarizeCalendar(generateCalendar(2026, scope), sensor);
    for (const cell of cells.filter((c) => c.year === 2026)) {
      assert.equal(cell.value, summary.monthly[cell.month].total);
      assert.equal(cell.deviation, summary.monthly[cell.month].deviation);
      assert.equal(cell.observedDays, summary.monthly[cell.month].days);
      assert.match(cell.provenance, /raw synthetic counts/);
      assert.equal("frp" in cell, false);
    }
  }
});
test("the visual preview does not change scientific harmonization availability", () => {
  const day = generateCalendar(2026, scope)[0];
  buildActivityMatrix("harmonized", scope, "ALL");
  assert.equal(activityFor(day, "Harmonized").total, null);
  assert.equal(activityFor(day, "Harmonized").observed, false);
});
test("missing months stay missing and unavailable sources never acquire harmonized data", () => {
  for (const mode of ["raw", "harmonized"]) {
    const cells = buildActivityMatrix(mode, scope, "ALL");
    assert.ok(
      cells
        .filter((c) => c.start > CALENDAR_CUTOFF)
        .every((c) => c.value === null && c.level === "missing"),
    );
    for (const sensor of ["SENTINEL3_SLSTR", "GOES_ABI", "Harmonized"]) {
      assert.ok(
        buildActivityMatrix(mode, scope, sensor).every(
          (c) => c.value === null && c.level === "missing",
        ),
      );
    }
  }
  assert.ok(buildActivityMatrix("harmonized", scope, "VIIRS").every((c) => c.value === null));
  const zero = buildActivityMatrix("harmonized", scope, "ALL").find((c) => c.value === 0);
  assert.ok(zero);
  assert.equal(zero.level, "minimal");
});
test("AOI changes update both raw fixtures and clearly synthetic index scenarios deterministically", () => {
  const region = { kind: "Continent", name: "Africa" };
  for (const mode of ["raw", "harmonized"]) {
    const a = buildActivityMatrix(mode, region, "ALL");
    assert.deepEqual(a, buildActivityMatrix(mode, region, "ALL"));
    assert.notDeepEqual(a, buildActivityMatrix(mode, scope, "ALL"));
  }
});
