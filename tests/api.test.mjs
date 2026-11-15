import test from "node:test";
import assert from "node:assert/strict";
import { HttpClient, ApiError } from "../src/shared/api/http.ts";
import {
  createHistoryApi,
  bboxSelector,
  calendarValue,
} from "../src/features/history/api/history.ts";
import { createLiveApi, applyPulse, subscribeFires } from "../src/features/live/api/live.ts";
import { createSystemApi } from "../src/features/system/api/system.ts";

function transport(respond = () => new Response("{}")) {
  const calls = [];
  const http = new HttpClient("http://localhost:8000/", {
    fetch: async (url, init) => {
      calls.push({ url: new URL(url), init });
      return respond(url, init);
    },
  });
  return { http, calls, history: createHistoryApi(http) };
}
const query = { biome: "Pantanal", start: "2020-08-01", end: "2020-10-31" };

test("history serializes exactly one area and the inclusive UTC dates", async () => {
  const { history, calls } = transport();
  await history.getCalendar({ ...query, granularity: "month" });
  assert.equal(calls[0].url.pathname, "/history/calendar");
  assert.deepEqual(Object.fromEntries(calls[0].url.searchParams), {
    ...query,
    granularity: "month",
  });
  assert.equal(calls[0].init.headers.Accept, "application/json");
});

test("invalid selectors, dates and WGS84 bounds are rejected before fetching", () => {
  const { history, calls } = transport();
  for (const area of [
    {},
    { biome: "Pantanal", area_id: "abc" },
    { area_id: "" },
    { bbox: "1,2,3" },
    { bbox: "-181,-19,-56,-17" },
  ]) {
    assert.throws(() => history.getCalendar({ start: query.start, end: query.end, ...area }));
  }
  for (const dates of [{ start: "2020-02-30" }, { end: "2019-01-01" }, { start: "20-01-01" }]) {
    assert.throws(() => history.getCalendar({ ...query, ...dates }));
  }
  assert.deepEqual(bboxSelector([-58, -19, -56, -17]), { bbox: "-58,-19,-56,-17" });
  assert.equal(calls.length, 0);
});

test("polygon registration posts GeoJSON JSON and returns the backend area id", async () => {
  const response = { area_id: "stable-id", cells: 1, bbox: [-58, -19, -56, -17] };
  const { history, calls } = transport(() => Response.json(response));
  const body = {
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-58, -19],
          [-56, -19],
          [-56, -17],
          [-58, -19],
        ],
      ],
    },
  };
  assert.deepEqual(await history.createArea(body), response);
  assert.equal(calls[0].url.pathname, "/history/areas");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), body);
});

test("all analytical history endpoints fall back only after a harmonized 409", async () => {
  for (const method of ["getClimatology", "getAnomaly", "getSeason", "getTrend"]) {
    const { history, calls } = transport((url) =>
      new URL(url).searchParams.get("series") === "harmonized"
        ? Response.json({ detail: "harmonization pending" }, { status: 409 })
        : Response.json({ series: "modis" }),
    );
    const result = await history[method]({ ...query, year: 2020 });
    assert.equal(result.requestedSeries, "harmonized");
    assert.equal(result.effectiveSeries, "modis");
    assert.equal(result.fallback, true);
    assert.equal(result.data.series, "modis");
    assert.equal(calls.length, 2);
  }
});

test("400, 404, 413 and FastAPI 422 retain detail and never trigger fallback", async () => {
  for (const status of [400, 404, 413, 422]) {
    const detail =
      status === 422 ? [{ loc: ["query", "start"], msg: "invalid" }] : "request rejected";
    const { history, calls } = transport(() => Response.json({ detail }, { status }));
    await assert.rejects(
      history.getAnomaly(query),
      (error) =>
        error instanceof ApiError &&
        error.status === status &&
        assert.deepEqual(error.detail, detail) === undefined,
    );
    assert.equal(calls.length, 1);
  }
  const { history, calls } = transport(() =>
    Response.json({ detail: "conflict" }, { status: 409 }),
  );
  await assert.rejects(history.getTrend({ biome: "Pantanal", series: "viirs" }), { status: 409 });
  assert.equal(calls.length, 1);
});

test("calendar retains zero, null and uncertainty without adding sensors", async () => {
  const bucket = {
    start: query.start,
    end: query.end,
    harmonized: null,
    modis: 0,
    viirs: 25,
    provisional: true,
  };
  assert.equal(calendarValue(bucket, "modis"), 0);
  assert.equal(calendarValue(bucket, "harmonized"), null);
  assert.equal(calendarValue({ ...bucket, modis: null }, "modis"), null);
  const interval = { value: 12, low: 8, high: 16 };
  assert.equal(calendarValue({ ...bucket, harmonized: interval }, "harmonized"), 12);
  const payload = {
    area: { kind: "biome", biome: "Pantanal", cells: 1301 },
    unit: "fire_cell_days",
    granularity: "month",
    buckets: [{ ...bucket, harmonized: interval }],
  };
  const { history } = transport(() => Response.json(payload));
  assert.deepEqual(await history.getCalendar(query), payload);
});

test("all JSON routes use their contract paths and preserve live confidence scale", async () => {
  const { http, history, calls } = transport();
  const live = createLiveApi(http),
    system = createSystemApi(http);
  await history.getMeta();
  await history.getMap(query);
  await live.getFires({ min_confidence: 0.8 });
  await live.getDetections({ sensor: "ABI", limit: 100 });
  await system.getHealth();
  await system.getStatus();
  assert.deepEqual(
    calls.map((call) => call.url.pathname),
    ["/history/meta", "/history/map", "/fires/live", "/detections/recent", "/health", "/status"],
  );
  assert.equal(calls[2].url.searchParams.get("min_confidence"), "0.8");
  assert.equal(calls[3].url.searchParams.get("sensor"), "ABI");
});

test("invalid JSON and network failures are never replaced by demo responses", async () => {
  const { history } = transport(() => new Response("<html>proxy error</html>"));
  await assert.rejects(history.getMeta(), /invalid JSON/);
  const failed = transport(() => {
    throw new TypeError("network unavailable");
  });
  await assert.rejects(failed.history.getMeta(), /network unavailable/);
});

test("abort signals and request timeouts stop in-flight requests", async () => {
  const waitForAbort = (_url, init) =>
    new Promise((_resolve, reject) => {
      if (init.signal.aborted) reject(init.signal.reason);
      else init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    });
  const http = new HttpClient("http://localhost:8000", { fetch: waitForAbort, timeoutMs: 20 });
  const controller = new AbortController();
  const pending = http.get("/health", undefined, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(http.get("/health"), { name: "TimeoutError" });
});

const feature = (id, confidence = 0.5) => ({
  type: "Feature",
  id,
  geometry: { type: "Point", coordinates: [-57, -17] },
  properties: {
    fire_id: id,
    uncertainty_km: 1,
    confidence,
    sensors: ["VIIRS"],
    n_detections: 1,
    first_seen: "2026-11-14T00:00:00Z",
    last_seen: "2026-11-14T00:00:00Z",
  },
});
const collection = (features) => ({ type: "FeatureCollection", features });

test("SSE pulses update stable identifiers, deduplicate and remove expired fires immutably", () => {
  const original = collection([feature("a"), feature("expired")]);
  const pulse = {
    at: "2026-11-14T01:00:00Z",
    new_detections: 1,
    total_fires: 2,
    new: collection([feature("b")]),
    updated: collection([feature("a", 0.9)]),
    removed: ["expired"],
  };
  const next = applyPulse(original, pulse);
  assert.deepEqual(
    next.features.map((f) => f.id),
    ["a", "b"],
  );
  assert.equal(next.features[0].properties.confidence, 0.9);
  assert.equal(next.updated_at, pulse.at);
  assert.equal(original.features[0].properties.confidence, 0.5);
  assert.equal(original.features[1].id, "expired");
});

test("SSE handles named events, reports malformed JSON, and closes on cleanup", () => {
  const { http } = transport();
  const events = new Map();
  let closed = false,
    snapshot,
    pulse,
    error;
  const close = subscribeFires(
    http,
    {
      snapshot: (data) => {
        snapshot = data;
      },
      pulse: (data) => {
        pulse = data;
      },
      error: (value) => {
        error = value;
      },
    },
    (url) => {
      assert.equal(url, "http://localhost:8000/fires/stream");
      return {
        addEventListener: (name, handler) => events.set(name, handler),
        close: () => {
          closed = true;
        },
      };
    },
  );
  events.get("snapshot")({ data: JSON.stringify(collection([])) });
  events.get("pulse")({ data: JSON.stringify({ removed: ["a"] }) });
  assert.deepEqual(snapshot, collection([]));
  assert.deepEqual(pulse.removed, ["a"]);
  events.get("pulse")({ data: "invalid" });
  assert.ok(error instanceof SyntaxError);
  close();
  assert.equal(closed, true);
});
