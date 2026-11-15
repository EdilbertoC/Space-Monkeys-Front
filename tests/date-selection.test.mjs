import test from "node:test";
import assert from "node:assert/strict";
import {
  getObservation,
  getSelectedHistory,
  selectedRecords,
} from "../src/features/history/demo/demo-data.ts";
import { activityFor } from "../src/features/history/demo/calendar-data.ts";
import { resolveObservationPeriod } from "../src/features/history/date-selection/date-range.ts";

test("custom dates preserve inclusive UTC range and raw sensor totals", () => {
  for (const period of [
    "2001-01-01/2001-01-01",
    "2024-02-28/2024-03-01",
    "2026-08-01/2026-08-10",
  ]) {
    const rows = selectedRecords(period);
    const observation = getObservation(period);
    assert.equal(observation.days, rows.length);
    assert.equal(
      observation.modis,
      rows.reduce((n, d) => n + (d.modis ?? 0), 0),
    );
    assert.equal(
      observation.viirs,
      rows.reduce((n, d) => n + (d.viirs ?? 0), 0),
    );
    assert.equal(observation.total, observation.modis + observation.viirs);
    assert.ok(observation.total >= 0);
    assert.equal(observation.anomalies, rows.filter((d) => activityFor(d, "All").anomalous).length);
    const history = getSelectedHistory(period, 1);
    assert.equal(history.total, observation.total);
    assert.equal(
      history.points.reduce((n, p) => n + p.modis + p.viirs, 0),
      observation.total,
    );
    assert.equal(getSelectedHistory(period, 1, true).total, observation.total);
  }
});

test("missing future observations remain zero totals, not invented data", () => {
  assert.equal(getObservation("2026-12-01/2026-12-31").total, 0);
  assert.equal(getSelectedHistory("2026-12-01/2026-12-31", 1).baseline, 0);
});

test("map/chart UI presets resolve to the same inclusive UTC observation dates", () => {
  for (const [preset, expected, days] of [
    ["Last 24 hours", "2026-08-24/2026-08-24", 1],
    ["Last 7 days", "2026-08-18/2026-08-24", 7],
    ["Last 30 days", "2026-07-26/2026-08-24", 30],
  ]) {
    const period = resolveObservationPeriod(preset);
    assert.equal(period, expected);
    const map = getObservation(period, 0.327);
    assert.equal(map.days, days);
    for (const weekly of [true, false]) {
      const chart = getSelectedHistory(period, 0.327, weekly);
      assert.equal(chart.rangeLabel, map.dateLabel);
      assert.equal(chart.total, map.total);
    }
    assert.equal(resolveObservationPeriod(period), period);
  }
});

test("explicit single-day, cross-month and cross-year selections retain their exact UTC range", () => {
  for (const range of ["2001-01-01/2001-01-01", "2024-02-28/2024-03-03", "2025-12-30/2026-01-03"]) {
    assert.equal(resolveObservationPeriod(range), range);
    const map = getObservation(range, 0.286);
    const chart = getSelectedHistory(resolveObservationPeriod(range), 0.286, true);
    assert.equal(chart.rangeLabel, map.dateLabel);
    assert.equal(chart.total, map.total);
  }
});
