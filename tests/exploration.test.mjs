import test from "node:test";
import assert from "node:assert/strict";
import {
  activityFor,
  generateCalendar,
  CALENDAR_CUTOFF,
} from "../src/features/history/demo/calendar-data.ts";
import { DEFAULT_DATES } from "../src/features/history/date-selection/date-range.ts";
import {
  cellBounds,
  GRID_COLUMNS,
  GRID_ROWS,
  selectionScope,
  selectionLabel,
  validPolygon,
  getDemoAnomalies,
  getExplorationHistory,
  explorationCsv,
} from "../src/features/history/demo/exploration.ts";

const global = { kind: "Global", name: "Global" };
test("initial workspace period follows the fixture availability, not today's date", () => {
  assert.equal(DEFAULT_DATES, `${CALENDAR_CUTOFF}/${CALENDAR_CUTOFF}`);
  assert.deepEqual(selectionScope(null), global);
});
test("selection grid covers the map once and retains multi-cell identities irrespective of click order", () => {
  let area = 0;
  for (let i = 0; i < GRID_COLUMNS * GRID_ROWS; i++) {
    const b = cellBounds(i);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 1000.00001 && b.y + b.height <= 450.00001);
    area += b.width * b.height;
  }
  assert.ok(Math.abs(area - 450000) < 1e-6);
  const selection = { kind: "cells", cells: [14, 8], points: [] };
  assert.deepEqual(selectionScope(selection), selectionScope({ ...selection, cells: [8, 14] }));
  assert.match(selectionLabel({ kind: "cells", cells: [24], points: [] }), /R2 C1/);
  assert.notDeepEqual(selectionScope(selection), selectionScope({ ...selection, cells: [1, 2] }));
});
test("polygon completion rejects incomplete, out-of-map and degenerate shapes", () => {
  assert.equal(validPolygon([]), false);
  assert.equal(
    validPolygon([
      { x: 0, y: 0 },
      { x: 20, y: 20 },
      { x: 40, y: 40 },
    ]),
    false,
  );
  assert.equal(
    validPolygon([
      { x: -2, y: 0 },
      { x: 20, y: 20 },
      { x: 40, y: 0 },
    ]),
    false,
  );
  assert.equal(
    validPolygon([
      { x: 0, y: 0 },
      { x: 20, y: 20 },
      { x: 40, y: 0 },
    ]),
    true,
  );
});
test("illustrative anomalies derive exclusively from existing available source-day flags", () => {
  const alerts = getDemoAnomalies(global, "2026-01-01/2026-08-24", "ALL");
  assert.ok(alerts.length > 0);
  const days = generateCalendar(2026, global);
  for (const alert of alerts) {
    const day = days.find((d) => d.date === alert.date);
    const activity = activityFor(day, "MODIS");
    assert.equal(alert.sensor, "MODIS");
    assert.equal(alert.illustrative, true);
    assert.equal(activity.anomalous, true);
    assert.equal(alert.current, activity.total);
    assert.equal(alert.baseline, activity.baseline);
    assert.equal(alert.deviation, activity.deviation);
    assert.equal(
      alert.severity,
      alert.deviation >= 75 ? "Critical" : alert.deviation >= 50 ? "High" : "Moderate",
    );
    assert.ok(alert.date <= CALENDAR_CUTOFF);
    assert.equal("frp" in alert, false);
  }
});
test("missing and planned sources produce no demo alerts, never invented real-time critical events", () => {
  for (const sensor of ["Harmonized", "SENTINEL3_SLSTR", "GOES_ABI"]) {
    assert.deepEqual(getDemoAnomalies(global, "2026-01-01/2026-08-24", sensor), []);
  }
  assert.deepEqual(getDemoAnomalies(global, "2026-09-01/2026-12-31", "MODIS"), []);
  const gap = generateCalendar(2026, global).find((d) => d.modis === null);
  assert.deepEqual(getDemoAnomalies(global, `${gap.date}/${gap.date}`, "MODIS"), []);
  const viirs = getDemoAnomalies(global, "2026-01-01/2026-08-24", "VIIRS");
  assert.ok(viirs.every((a) => a.sensor === "VIIRS"));
});
test("monthly and yearly historical bins conserve the MODIS fallback and raw VIIRS comparison", () => {
  const monthly = getExplorationHistory(global, "ALL", 2024, 2026, -1, "Monthly");
  const yearly = getExplorationHistory(global, "ALL", 2024, 2026, -1, "Yearly");
  assert.equal(monthly.length, 36);
  assert.equal(yearly.length, 3);
  for (const year of yearly) {
    const months = monthly.filter((m) => m.label.startsWith(year.label));
    for (const key of ["total", "baseline", "viirs", "observedDays", "days"]) {
      assert.equal(
        year[key],
        months.reduce((n, m) => n + (m[key] ?? 0), 0),
      );
    }
  }
  const modis = getExplorationHistory(global, "MODIS", 2024, 2026, -1, "Monthly");
  assert.deepEqual(monthly, modis);
  assert.ok(
    monthly
      .filter((p) => p.start > CALENDAR_CUTOFF)
      .every((p) => p.total === null && p.baseline === null && p.viirs === null),
  );
});
test("historical scope, month and unavailable sensor selections affect the underlying series", () => {
  const months = getExplorationHistory(global, "ALL", 2020, 2026, 5, "Monthly");
  assert.equal(months.length, 7);
  assert.ok(months.every((p) => p.start.endsWith("-06-01") && p.end.endsWith("-06-30")));
  const selected = selectionScope({ kind: "cells", cells: [111], points: [] });
  assert.notDeepEqual(
    getExplorationHistory(selected, "MODIS", 2026, 2026, -1, "Yearly"),
    getExplorationHistory(global, "MODIS", 2026, 2026, -1, "Yearly"),
  );
  for (const sensor of ["SENTINEL3_SLSTR", "GOES_ABI", "Harmonized"]) {
    const series = getExplorationHistory(global, sensor, 2024, 2026, -1, "Monthly");
    assert.ok(series.every((p) => p.total === null && p.baseline === null && p.observedDays === 0));
  }
  assert.deepEqual(getExplorationHistory(global, "ALL", 2026, 2025, -1, "Monthly"), []);
});
test("series CSV preserves UTC, provenance, unavailable source columns and real zero versus missing", () => {
  const points = [
    {
      label: "zero",
      start: "2026-01-01",
      end: "2026-01-01",
      total: 0,
      baseline: 100,
      viirs: 0,
      observedDays: 1,
      days: 1,
    },
    {
      label: "missing",
      start: "2026-09-01",
      end: "2026-09-01",
      total: null,
      baseline: null,
      viirs: null,
      observedDays: 0,
      days: 1,
    },
  ];
  const csv = explorationCsv(points, "ALL", { kind: "Custom Area", name: 'Area, "A"' });
  assert.match(csv, /ILLUSTRATIVE DEMO/);
  assert.match(csv, /"MODIS fallback"/);
  assert.match(csv, /"Area, ""A"""/);
  assert.match(csv, /2026-01-01T00:00:00Z/);
  assert.match(csv, /2026-01-01T23:59:59.999Z/);
  assert.match(csv, /"0","100","0","N\/A","N\/A"/);
  assert.match(csv, /"N\/A","N\/A","N\/A","N\/A","N\/A"/);
});
