import test from "node:test";
import assert from "node:assert/strict";
import { filterRecentActivity } from "../src/features/history/demo/recent-activity.ts";

test("recent regional records respect inclusive UTC date boundaries", () => {
  const atSample = filterRecentActivity("Global", "2026-08-24/2026-08-24", "ALL");
  assert.equal(atSample.length, 8);
  assert.deepEqual(filterRecentActivity("Global", "2026-08-01/2026-08-24", "ALL"), atSample);
  assert.deepEqual(filterRecentActivity("Global", "2026-08-24/2026-08-31", "ALL"), atSample);
  assert.deepEqual(filterRecentActivity("Global", "2026-08-01/2026-08-23", "ALL"), []);
  assert.deepEqual(filterRecentActivity("Global", "2026-08-25/2026-08-31", "ALL"), []);
});

test("the filter shared by the table and CSV preserves sensor and regional selections", () => {
  const period = "2026-08-24/2026-08-24";
  assert.deepEqual(
    filterRecentActivity("South America", period, "MODIS").map((row) => row.region),
    ["Mato Grosso, Brazil"],
  );
  assert.deepEqual(
    filterRecentActivity("South America", period, "VIIRS").map((row) => row.region),
    ["Amazonas, Brazil"],
  );
  assert.equal(filterRecentActivity("South America", period, "ALL").length, 2);
  assert.deepEqual(filterRecentActivity("Global", period, "SENTINEL3_SLSTR"), []);
  assert.deepEqual(filterRecentActivity("Global", period, "GOES_ABI"), []);
});
