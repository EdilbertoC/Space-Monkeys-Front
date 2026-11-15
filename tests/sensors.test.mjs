import test from "node:test";
import assert from "node:assert/strict";
import { SENSOR_IDS, SENSOR_METADATA, matchesSensor } from "../src/features/sensors/sensors.ts";
import {
  generateCalendar,
  summarizeCalendar,
  activityFor,
} from "../src/features/history/demo/calendar-data.ts";
import { getObservation, getSelectedHistory } from "../src/features/history/demo/demo-data.ts";

test("four canonical identifiers retain source-specific metadata and honest integration states", () => {
  assert.deepEqual(SENSOR_IDS, ["MODIS", "VIIRS", "SENTINEL3_SLSTR", "GOES_ABI"]);
  assert.equal(new Set(SENSOR_IDS.map((id) => SENSOR_METADATA[id].color)).size, 4);
  for (const id of SENSOR_IDS) {
    const source = SENSOR_METADATA[id];
    for (const key of [
      "satellites",
      "instrument",
      "resolution",
      "orbit",
      "role",
      "cadence",
      "algorithm",
      "format",
      "integration",
      "availability",
    ])
      assert.ok(source[key]);
    assert.doesNotMatch(source.integration, /^Connected|^Operational/);
  }
  assert.match(SENSOR_METADATA.GOES_ABI.resolution, /subsatellite/);
  assert.equal(SENSOR_METADATA.GOES_ABI.orbit, "Geostationary");
});

test("new source fields are null, never invented zero detections; existing observations are preserved", () => {
  const days = generateCalendar(2026, { kind: "Global", name: "Global" });
  for (const day of days) {
    assert.equal(day.observations.MODIS, day.modis);
    assert.equal(day.observations.VIIRS, day.viirs);
    assert.equal(day.observations.SENTINEL3_SLSTR, null);
    assert.equal(day.observations.GOES_ABI, null);
    for (const source of ["SENTINEL3_SLSTR", "GOES_ABI"]) {
      const result = activityFor(day, source);
      assert.equal(result.total, null);
      assert.equal(result.baseline, null);
      assert.equal(result.observed, false);
      assert.equal(result.anomalous, false);
      assert.match(result.classification, /unavailable/);
    }
  }
});

test("all four filters work without adding planned sources into core totals or baselines", () => {
  const period = "2026-08-01/2026-08-24";
  const all = getObservation(period, 1, "ALL");
  const m = getObservation(period, 1, "MODIS"),
    v = getObservation(period, 1, "VIIRS");
  assert.equal(all.total, m.total + v.total);
  assert.equal(m.viirs, 0);
  assert.equal(v.modis, 0);
  assert.equal(m.rawViirs, all.viirs);
  assert.equal(v.rawModis, all.modis);
  for (const id of SENSOR_IDS) {
    const selected = getObservation(period, 1, id);
    const history = getSelectedHistory(period, 1, false, id);
    assert.equal(history.total, selected.total);
    if (id === "MODIS")
      assert.ok(history.points.every((p) => p.viirs === 0 && p.baselineViirs === 0));
    if (id === "VIIRS")
      assert.ok(history.points.every((p) => p.modis === 0 && p.baselineModis === 0));
    if (SENSOR_METADATA[id].tier === "extended") {
      assert.equal(selected.unavailable, true);
      assert.equal(selected.hasObservations, false);
      const summary = summarizeCalendar(
        generateCalendar(2026, { kind: "Global", name: "Global" }),
        id,
      );
      assert.equal(summary.total, null);
      assert.equal(summary.baseline, null);
      assert.equal(summary.anomalyCount, 0);
      assert.equal(history.baseline, 0);
    }
    for (const other of SENSOR_IDS) assert.equal(matchesSensor(id, other), id === other);
    assert.equal(matchesSensor("ALL", id), true);
  }
});

test("sensor-specific missing observations remain missing", () => {
  const day = generateCalendar(2026, { kind: "Global", name: "Global" }).find(
    (d) => d.modis === null && d.viirs !== null,
  );
  assert.ok(day);
  assert.equal(getObservation(`${day.date}/${day.date}`, 1, "MODIS").hasObservations, false);
  assert.equal(getObservation(`${day.date}/${day.date}`, 1, "VIIRS").hasObservations, true);
});

test("partial coverage and observed zero remain distinct for summaries and exports", () => {
  const days = generateCalendar(2026, { kind: "Global", name: "Global" });
  const partial = days.find((d) => d.modis === null && d.viirs !== null);
  const zero = days.find((d) => d.modis === 0 && d.viirs === 0);
  assert.ok(partial && zero);
  const partialWindow = `${partial.date}/${partial.date}`;
  assert.equal(getObservation(partialWindow, 1, "ALL").total, partial.viirs);
  assert.equal(getObservation(partialWindow, 1, "MODIS").hasObservations, false);
  assert.equal(getObservation(partialWindow, 1, "VIIRS").total, partial.viirs);
  for (const sensor of ["MODIS", "VIIRS", "ALL"]) {
    const result = getObservation(`${zero.date}/${zero.date}`, 1, sensor);
    assert.equal(result.total, 0);
    assert.equal(result.hasObservations, true);
    assert.equal(result.unavailable, false);
  }
});
