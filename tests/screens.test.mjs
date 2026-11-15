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
import { flaggedMonths, scanRows } from "../src/features/history/model/anomaly-scan.ts";
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
  assert.deepEqual(areaSelector({ kind: "country", country: "BR" }), { country: "BR" });
  assert.equal(areaLabel({ kind: "country", country: "BR" }), "Brazil (all biomes)");
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

test("the anomaly scan becomes twelve months per area, records and above first", () => {
  const month = (m, extra) => ({
    start: `2026-${m}-01`,
    end: `2026-${m}-28`,
    partial: false,
    ...extra,
  });
  const scan = {
    unit: "fire_cell_days",
    series: "harmonized",
    year: 2026,
    base_years: [2003, 2025],
    areas: [
      {
        area: { kind: "biome", biome: "Caatinga", cells: 7104 },
        months: [
          month("01", {
            value: 30,
            normal: { median: 10, p10: 5, p90: 20 },
            ratio_to_median: 3,
            class: "above",
          }),
          month("02", {
            value: 50,
            normal: { median: 10, p10: 5, p90: 20 },
            ratio_to_median: 5,
            class: "record",
          }),
          month("03", { class: null, reason: "fewer than 3 base years" }),
          {
            ...month("04", {
              value: 4,
              normal: { median: 10, p10: 5, p90: 20 },
              ratio_to_median: 0.4,
              class: "below",
            }),
            partial: true,
          },
        ],
      },
      { area: { kind: "country", country: "BR", cells: 71049 }, months: [] },
    ],
  };
  const rows = scanRows(scan);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["Caatinga", "Brazil"],
  );
  assert.deepEqual(rows[1].area, { kind: "country", country: "BR" });
  assert.equal(rows[0].months.length, 12);
  assert.deepEqual(
    rows[0].months.slice(0, 5).map((m) => m.status),
    ["above", "record", "nodata", "below", "nodata"],
  );
  assert.equal(rows[0].months[2].reason, "fewer than 3 base years");
  assert.equal(rows[0].months[3].partial, true);
  assert.deepEqual(
    flaggedMonths(rows).map((m) => [m.name, m.month, m.status]),
    [
      ["Caatinga", 2, "record"],
      ["Caatinga", 1, "above"],
    ],
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
