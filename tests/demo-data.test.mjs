import test from "node:test";
import assert from "node:assert/strict";
import {
  getObservation,
  getHistory,
  observationPeriods,
} from "../src/features/history/demo/demo-data.ts";

test("observation dates, integer sensor totals, and anomaly counts share one window", () => {
  for (const scale of [1, 0.327, 0.118, 0.286, 0.042, 0.176, 0.051]) {
    let previousTotal = 0;
    let previousAnomalies = 0;
    for (const period of Object.keys(observationPeriods)) {
      const observation = getObservation(period, scale);
      assert.equal(
        Date.parse(observation.end) - Date.parse(observation.start),
        observation.days * 86400000,
      );
      assert.equal(observation.total, observation.modis + observation.viirs);
      assert.ok(Number.isInteger(observation.total));
      assert.ok(observation.total > previousTotal);
      assert.ok(observation.anomalies > previousAnomalies);
      assert.match(observation.exactLabel, /15:00 UTC$/);
      previousTotal = observation.total;
      previousAnomalies = observation.anomalies;
    }
  }
  assert.equal(getObservation("Last 24 hours").total, 24873);
  assert.match(getObservation("Last 7 days").dateLabel, /Aug 17 – Aug 24/);
  assert.match(getObservation("Last 30 days").dateLabel, /Jul 25 – Aug 24/);
});

test("monthly and weekly histories conserve sensor and baseline totals", () => {
  for (const months of [6, 12, 24]) {
    for (const year of [2024, 2025, 2026]) {
      for (const scale of [1, 0.042, 0.286]) {
        const monthly = getHistory(months, year, scale);
        const weekly = getHistory(months, year, scale, true);
        assert.equal(monthly.points.length, months);
        assert.equal(monthly.total, monthly.current.modis + monthly.current.viirs);
        assert.equal(
          monthly.baseline,
          monthly.current.baselineModis + monthly.current.baselineViirs,
        );
        assert.equal(
          monthly.change,
          `+${((monthly.total / monthly.baseline - 1) * 100).toFixed(1)}%`,
        );
        assert.equal(weekly.total, monthly.total);
        for (const key of ["modis", "viirs", "baselineModis", "baselineViirs"]) {
          assert.equal(
            weekly.points.reduce((total, p) => total + p[key], 0),
            monthly.points.reduce((total, p) => total + p[key], 0),
          );
          for (const point of weekly.points) assert.ok(point[key] >= 0);
        }
        assert.equal(monthly.partial, year === 2026);
        assert.match(
          monthly.current.dateLabel,
          year === 2026 ? /Aug 1 – Aug 24, 2026/ : /Aug 1 – Aug 31/,
        );
      }
    }
  }
});

test("changing archive ranges preserves observations in overlapping months", () => {
  const recent = getHistory(12, 2025, 1);
  const extended = getHistory(24, 2026, 1);
  for (const point of recent.points) {
    assert.deepEqual(
      extended.points.find((p) => p.dateLabel === point.dateLabel),
      point,
    );
  }
  assert.deepEqual(getHistory(6, 2026, 1).current, getHistory(24, 2026, 1).current);
});
