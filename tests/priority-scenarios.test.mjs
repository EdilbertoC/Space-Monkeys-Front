import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRIORITY_SCENARIOS,
  priorityScenarios,
  markerScenario,
} from "../src/features/history/demo/priority-scenarios.ts";
import {
  CALENDAR_CUTOFF,
  activityFor,
  generateCalendar,
} from "../src/features/history/demo/calendar-data.ts";
import { validPolygon } from "../src/features/history/demo/exploration.ts";
import { describeMapMarker } from "../src/features/map/model/map-location.ts";
const scope = { kind: "Global", name: "Global" };
const period = `${CALENDAR_CUTOFF}/${CALENDAR_CUTOFF}`;
const { markers } = JSON.parse(
  readFileSync(new URL("../src/features/map/demo/map-data.json", import.meta.url), "utf8"),
);

test("priority scenarios are explicitly illustrative and have distinct, valid projected AOIs", () => {
  assert.equal(PRIORITY_SCENARIOS.length, 4);
  assert.equal(new Set(PRIORITY_SCENARIOS.map((row) => row.id)).size, 4);
  assert.ok(PRIORITY_SCENARIOS.some((row) => row.biome.includes("Amazon")));
  assert.ok(PRIORITY_SCENARIOS.some((row) => row.biome.includes("Cerrado")));
  for (const row of PRIORITY_SCENARIOS) {
    assert.equal(row.illustrative, true);
    assert.equal(row.date, CALENDAR_CUTOFF);
    assert.equal(row.area.kind, "polygon");
    assert.ok(validPolygon(row.area.points));
    assert.ok(row.zScore > 0 && row.mockFrpMw > 0);
    assert.equal("harmonizedFrp" in row, false);
  }
});
test("scenario marker associations retain existing spatial records and never invent acquisitions", () => {
  const snapshot = JSON.stringify(markers);
  for (const row of PRIORITY_SCENARIOS) {
    const marker = markers[row.markerIndex];
    assert.equal(marker[4], "South America");
    assert.deepEqual(row.center, { x: marker[0], y: marker[1] });
    assert.equal(row.markerIndex % 5 === 0, false); // visible in the existing daily sample
    assert.equal(row.markerIndex % 11 === 0, false);
    assert.equal(markerScenario(row.markerIndex, period), row);
    const original = describeMapMarker(marker, row.markerIndex);
    assert.equal(original.observation.observedAt, null);
    assert.equal(original.observation.confidence, null);
    assert.equal("frp" in original.observation, false);
  }
  assert.equal(JSON.stringify(markers), snapshot);
  assert.equal(markerScenario(1000, period), undefined);
});
test("scenario table respects UTC periods and source availability without manufacturing real alerts", () => {
  assert.equal(priorityScenarios(period, "ALL", scope).length, 4);
  assert.equal(priorityScenarios(`2026-08-01/${CALENDAR_CUTOFF}`, "All", scope).length, 4);
  for (const sensor of ["MODIS", "VIIRS", "SENTINEL3_SLSTR", "GOES_ABI", "Harmonized"]) {
    assert.deepEqual(priorityScenarios(period, sensor, scope), []);
  }
  for (const range of ["2025-01-01/2025-12-31", "2026-09-01/2026-12-31", "Last 24 hours"]) {
    assert.deepEqual(priorityScenarios(range, "ALL", scope), []);
    assert.equal(markerScenario(PRIORITY_SCENARIOS[0].markerIndex, range), undefined);
  }
});
test("regional filters exclude unrelated continents and countries; custom areas remain marked schematic", () => {
  assert.equal(
    priorityScenarios(period, "ALL", { kind: "Continent", name: "South America" }).length,
    4,
  );
  assert.equal(priorityScenarios(period, "ALL", { kind: "Country", name: "Brazil" }).length, 4);
  assert.deepEqual(priorityScenarios(period, "ALL", { kind: "Continent", name: "Africa" }), []);
  assert.deepEqual(priorityScenarios(period, "ALL", { kind: "Country", name: "Canada" }), []);
  assert.equal(
    priorityScenarios(period, "ALL", { kind: "Custom Area", name: "Schematic AOI" }).length,
    4,
  );
});
test("the map preview does not change scientific harmonization or create scores on observation models", () => {
  priorityScenarios(period, "ALL", scope);
  const day = generateCalendar(2026, scope).find((d) => d.date === CALENDAR_CUTOFF);
  assert.equal(activityFor(day, "Harmonized").total, null);
  assert.equal(activityFor(day, "Harmonized").anomalous, false);
  const statuses = PRIORITY_SCENARIOS.map((row) => row.status);
  assert.equal(statuses.filter((s) => s === "CRITICAL").length, 2);
  assert.equal(statuses.filter((s) => s === "WARNING").length, 2);
});
