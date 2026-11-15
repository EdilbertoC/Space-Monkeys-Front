import test from "node:test";
import assert from "node:assert/strict";
import {
  CALENDAR_CUTOFF,
  activityFor,
  generateCalendar,
  inCalendarRange,
  summarizeCalendar,
  validBounds,
} from "../src/features/history/demo/calendar-data.ts";

const globalScope = { kind: "Global", name: "Global" };

test("each supported year has every UTC day exactly once, including leap days", () => {
  for (let year = 2020; year <= 2026; year++) {
    const days = generateCalendar(year, globalScope);
    assert.equal(days.length, year % 4 === 0 ? 366 : 365);
    assert.equal(new Set(days.map((d) => d.date)).size, days.length);
    assert.equal(days[0].date, `${year}-01-01`);
    assert.equal(days.at(-1).date, `${year}-12-31`);
    assert.equal(new Set(days.map((d) => d.month)).size, 12);
    assert.equal(
      days.some((d) => d.date === `${year}-02-29`),
      year % 4 === 0,
    );
    assert.deepEqual(generateCalendar(year, globalScope), days);
  }
});

test("observed zero, partial coverage, missing data, and future cutoff are distinct", () => {
  const days = generateCalendar(2026, globalScope);
  const zero = days.find((d) => d.modis === 0 && d.viirs === 0);
  const missing = days.find((d) => d.reason === "gap");
  const partial = days.find((d) => d.modis === null && d.viirs !== null);
  assert.ok(zero && missing && partial);
  assert.equal(activityFor(zero, "All").total, 0);
  assert.equal(activityFor(zero, "All").observed, true);
  assert.ok(activityFor(zero, "All").baseline > 0);
  assert.equal(activityFor(missing, "All").total, null);
  assert.equal(activityFor(missing, "All").baseline, null);
  assert.equal(activityFor(partial, "All").total, partial.viirs);
  assert.equal(activityFor(partial, "All").baseline, partial.baselineViirs);
  assert.equal(activityFor(partial, "All").partial, true);
  assert.equal(activityFor(partial, "All").anomalous, false);
  assert.equal(activityFor(partial, "MODIS").observed, false);
  assert.equal(activityFor(partial, "VIIRS").observed, true);
  for (const day of days.filter((d) => d.date > CALENDAR_CUTOFF)) {
    assert.equal(day.reason, "after-cutoff");
    assert.equal(activityFor(day, "All").total, null);
  }
});

test("daily and monthly sensor counts, baselines, percentages, and flags agree", () => {
  const days = generateCalendar(2025, globalScope);
  for (const sensor of ["All", "MODIS", "VIIRS"]) {
    const summary = summarizeCalendar(days, sensor);
    const observed = days.map((d) => activityFor(d, sensor)).filter((a) => a.observed);
    assert.equal(
      summary.total,
      observed.reduce((sum, a) => sum + a.total, 0),
    );
    assert.equal(
      summary.total,
      summary.monthly.reduce((sum, m) => sum + (m.total ?? 0), 0),
    );
    assert.equal(
      summary.baseline,
      observed.reduce((sum, a) => sum + a.baseline, 0),
    );
    assert.equal(
      summary.baseline,
      summary.monthly.reduce((sum, m) => sum + (m.baseline ?? 0), 0),
    );
    assert.equal(
      summary.observedDays,
      summary.monthly.reduce((sum, m) => sum + m.days, 0),
    );
    assert.equal(summary.deviation, (summary.total / summary.baseline - 1) * 100);
    assert.equal(summary.anomalyCount, observed.filter((a) => a.anomalous).length);
    assert.ok(summary.mostAnomalous);
    assert.equal(
      summary.mostAnomalous.activity.deviation,
      Math.max(...observed.filter((a) => a.anomalous).map((a) => a.deviation)),
    );
    for (const a of observed) assert.equal(a.anomalous, !a.partial && a.deviation >= 35);
  }
});

test("range and month filters are inclusive and preserve source observations", () => {
  const days = generateCalendar(2024, globalScope);
  const feb = days.filter((d) => inCalendarRange(d, "2024-02-01", "2024-02-29", 1));
  assert.equal(feb.length, 29);
  assert.equal(feb[0].date, "2024-02-01");
  assert.equal(feb.at(-1).date, "2024-02-29");
  assert.deepEqual(
    feb[12],
    days.find((d) => d.date === "2024-02-13"),
  );
  assert.equal(days.filter((d) => inCalendarRange(d, "2024-06-01", "2024-06-30", 1)).length, 0);
  const noObservations = generateCalendar(2026, globalScope).filter((d) => d.month === 11);
  const summary = summarizeCalendar(noObservations, "All");
  assert.equal(summary.total, null);
  assert.equal(summary.baseline, null);
  assert.equal(summary.mostAnomalous, null);
});

test("geography and validated custom bounds change the synthetic series", () => {
  const global = generateCalendar(2025, globalScope);
  const regional = generateCalendar(2025, { kind: "Country", name: "Brazil" });
  const a = { south: -15, north: 5, west: -75, east: -45 };
  const b = { south: -10, north: 10, west: 10, east: 60 };
  assert.ok(validBounds(a));
  assert.equal(validBounds({ ...a, south: 8, north: 2 }), false);
  assert.equal(validBounds({ ...a, west: -181 }), false);
  assert.equal(validBounds({ ...a, east: NaN }), false);
  assert.notEqual(global[0].modis, regional[0].modis);
  assert.notDeepEqual(
    generateCalendar(2025, { kind: "Custom Area", name: "Custom Area", bounds: a }),
    generateCalendar(2025, { kind: "Custom Area", name: "Custom Area", bounds: b }),
  );
});

test("harmonized mode never fabricates activity, baseline, or anomaly output", () => {
  const days = generateCalendar(2025, globalScope);
  for (const day of days) {
    const harmonized = activityFor(day, "Harmonized");
    assert.equal(harmonized.total, null);
    assert.equal(harmonized.baseline, null);
    assert.equal(harmonized.deviation, null);
    assert.equal(harmonized.anomalous, false);
    assert.equal(harmonized.classification, "Not computed");
  }
  const summary = summarizeCalendar(days, "Harmonized");
  assert.equal(summary.total, null);
  assert.equal(summary.observedDays, 0);
  assert.equal(summary.peakMonth, null);
  assert.equal(summary.mostAnomalous, null);
});
