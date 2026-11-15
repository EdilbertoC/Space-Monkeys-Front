import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  describeMapMarker,
  panToMapPosition,
  placeHotspotTooltip,
} from "../src/features/map/model/map-location.ts";

const { markers } = JSON.parse(
  readFileSync(new URL("../src/features/map/demo/map-data.json", import.meta.url), "utf8"),
);

test("location details preserve every original spatial sample and sensor", () => {
  const snapshot = JSON.stringify(markers);
  markers.forEach((marker, index) => {
    const selected = describeMapMarker(marker, index);
    assert.equal(selected.sensor, marker[2] === 0 ? "MODIS" : "VIIRS");
    assert.equal(selected.region, marker[4]);
    assert.equal(selected.markerIndex, index);
    assert.equal(selected.observation.id, `demo-map-${index}`);
    assert.equal(selected.observation.original, marker);
    assert.deepEqual(selected.mapPosition, { x: marker[0], y: marker[1] });
  });
  assert.equal(JSON.stringify(markers), snapshot);
});

test("the spatial demo never invents acquisition metadata, risk or harmonized values", () => {
  const selected = describeMapMarker(markers[1], 1);
  assert.equal(selected.observation.illustrative, true);
  assert.equal(selected.observation.observedAt, null);
  assert.equal(selected.observation.confidence, null);
  assert.equal(selected.observation.satellite, null);
  for (const key of ["anomalyScore", "harmonizedFrp", "country", "latitude", "longitude"]) {
    assert.equal(key in selected, false);
    assert.equal(key in selected.mapPosition, false);
  }
});

test("focus navigation centers the existing marker without changing projection or data", () => {
  for (const marker of markers.slice(0, 20)) {
    for (const center of [
      [500, 225],
      [337, 300],
      [535, 120],
    ]) {
      for (const scale of [1, 2, 3.4, 5]) {
        const position = { x: marker[0], y: marker[1] };
        const pan = panToMapPosition(position, center, scale);
        assert.ok(Math.abs(500 - center[0] * scale + pan.x + position.x * scale - 500) < 1e-8);
        assert.ok(Math.abs(225 - center[1] * scale + pan.y + position.y * scale - 225) < 1e-8);
      }
    }
  }
});

test("floating tooltip stays clear of controls and prefers less crowded adjacent space", () => {
  const canvas = { width: 1000, height: 500 };
  const anchor = { x: 500, y: 250 };
  const crowded = Array.from({ length: 20 }, (_, i) => ({ x: 540 + i, y: 100 + i }));
  const position = placeHotspotTooltip(anchor, canvas, crowded);
  assert.ok(position.left < anchor.x);
  assert.ok(position.left >= 12);
  assert.ok(position.left + 272 <= canvas.width - 54);
  assert.ok(position.top >= 56);
  assert.ok(position.top + 246 <= canvas.height - 54);
  for (const size of [
    { width: 342, height: 390 },
    { width: 744, height: 450 },
  ]) {
    const p = placeHotspotTooltip({ x: size.width - 10, y: 20 }, size, []);
    assert.ok(p.left >= 12 && p.left + 272 <= size.width - 12);
    assert.ok(p.top >= 56 && p.top + 246 <= size.height - 54);
  }
});
