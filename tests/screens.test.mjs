// SI-assisted: written with Claude (Anthropic), reviewed by the Space Monkeys team. See README.
import test from "node:test";
import assert from "node:assert/strict";
import {
  areaKey,
  areaLabel,
  areaSelector,
  lastDays,
  periodDays,
} from "../src/features/history/model/area.ts";
import { granularityFor, seriesTotal } from "../src/features/history/model/period.ts";
import { classifyMonths } from "../src/features/history/model/anomaly-scan.ts";
import { latToY, lonToX, viewBoxFor, BRAZIL_BOUNDS } from "../src/shared/geo/projection.ts";
import { resolveObservationPeriod } from "../src/features/history/date-selection/date-range.ts";
import { SENSOR_IDS, SENSOR_METADATA } from "../src/features/sensors/sensors.ts";

const bucket = (start, end, values) => ({
  start,
  end,
  harmonized: values.harmonized === null ? null : { value: values.harmonized, low: 0, high: 0 },
  modis: values.modis,
  viirs: values.viirs,
  provisional: false,
});

test("area selectors send exactly one selector", () => {
  assert.deepEqual(areaSelector({ kind: "biome", biome: "Pantanal" }), { biome: "Pantanal" });
  assert.deepEqual(areaSelector({ kind: "bbox", bbox: "-58,-20,-56,-18" }), {
    bbox: "-58,-20,-56,-18",
  });
  assert.match(areaLabel({ kind: "bbox", bbox: "-58,-20,-56,-18" }), /-20° to -18° lat/);
  assert.notEqual(
    areaKey({ kind: "biome", biome: "Pantanal" }),
    areaKey({ kind: "biome", biome: "Cerrado" }),
  );
});

test("periods are inclusive UTC ranges", () => {
  assert.equal(periodDays("2020-01-01", "2020-01-01"), 1);
  assert.equal(periodDays("2020-02-28", "2020-03-01"), 3);
  assert.deepEqual(lastDays("2026-11-14", 30), { start: "2026-10-16", end: "2026-11-14" });
  assert.equal(resolveObservationPeriod("Last 7 days", "2026-11-14"), "2026-11-08/2026-11-14");
  assert.equal(resolveObservationPeriod("2020-01-01/2020-01-31"), "2020-01-01/2020-01-31");
  assert.equal(granularityFor({ start: "2020-01-01", end: "2020-03-31" }), "day");
  assert.equal(granularityFor({ start: "2019-01-01", end: "2020-12-31" }), "week");
  assert.equal(granularityFor({ start: "2003-01-01", end: "2020-12-31" }), "month");
});

test("series totals skip missing buckets and never add sensors together", () => {
  const buckets = [
    bucket("2020-01-01", "2020-01-01", { harmonized: 2, modis: 2, viirs: 7 }),
    bucket("2020-01-02", "2020-01-02", { harmonized: 1.25, modis: null, viirs: 3 }),
  ];
  assert.equal(seriesTotal(buckets, "modis"), 2);
  assert.equal(seriesTotal(buckets, "viirs"), 10);
  assert.equal(seriesTotal(buckets, "harmonized"), 3.3);
  assert.equal(
    seriesTotal(
      [bucket("2020-01-01", "2020-01-01", { harmonized: null, modis: null, viirs: null })],
      "modis",
    ),
    null,
  );
});

test("months are flagged against the normal band, and partial months are not compared", () => {
  const normal = Array.from({ length: 12 }, (_, i) => ({
    index: i + 1,
    label: "",
    median: 10,
    p10: 5,
    p90: 20,
    mean: 10,
  }));
  const buckets = [
    bucket("2026-01-01", "2026-01-31", { harmonized: 25, modis: 25, viirs: 60 }),
    bucket("2026-02-01", "2026-02-28", { harmonized: 2, modis: 2, viirs: 4 }),
    bucket("2026-03-01", "2026-03-31", { harmonized: 12, modis: 12, viirs: 30 }),
    bucket("2026-04-01", "2026-04-14", { harmonized: 40, modis: 40, viirs: 90 }),
  ];
  const months = classifyMonths(2026, buckets, normal);
  assert.deepEqual(
    months.slice(0, 5).map((m) => m.status),
    ["above", "below", "within", "partial", "nodata"],
  );
});

test("the projection matches the equirectangular basemap", () => {
  assert.equal(lonToX(-180), 0);
  assert.equal(lonToX(180), 1000);
  assert.equal(latToY(85), 0);
  assert.equal(latToY(-60), 450);
  const vb = viewBoxFor(BRAZIL_BOUNDS, 0);
  assert.ok(Math.abs(vb.width - (42 * 1000) / 360) < 1e-9);
  const small = viewBoxFor([-57, -19, -56, -18], 0, 16);
  assert.ok(Math.abs(small.width - (16 * 1000) / 360) < 1e-9);
});

test("sensor metadata describes the real integration of each source", () => {
  assert.deepEqual(SENSOR_IDS, ["MODIS", "VIIRS", "SENTINEL3_SLSTR", "GOES_ABI"]);
  for (const id of SENSOR_IDS) assert.ok(SENSOR_METADATA[id].integration);
  assert.match(SENSOR_METADATA.MODIS.integration, /^Connected/);
  assert.match(SENSOR_METADATA.VIIRS.integration, /^Connected/);
  assert.match(SENSOR_METADATA.GOES_ABI.integration, /real-time layer only/);
  assert.equal(SENSOR_METADATA.SENTINEL3_SLSTR.integration, "Not used");
});
