import test from "node:test";
import assert from "node:assert/strict";
import { preventionDemo } from "../src/features/prevention-demo/demo.ts";
import { preventionIntegration } from "../src/features/prevention-demo/config.ts";
import {
  compatibleAssessments,
  displayableRisk,
  previousComparable,
  validPayload,
} from "../src/features/prevention-demo/presentation.ts";
import { loadPrevention } from "../src/features/prevention-demo/source.ts";

const clone = () => structuredClone(preventionDemo);
const signal = () => new AbortController().signal;

test("demo values are isolated, explicit scenarios with no fabricated probabilities", () => {
  assert.equal(preventionDemo.provenance, "demonstration");
  assert.equal(validPayload(preventionDemo), true);
  assert.ok(preventionDemo.currentAssessments.length);
  for (const record of [...preventionDemo.currentAssessments, ...preventionDemo.riskHistory]) {
    assert.equal(record.probability, null);
    assert.match(record.model.statusLabel, /Demonstration only/);
  }
  assert.ok(Object.values(preventionIntegration.endpoints).every((v) => v === null));
  assert.equal(preventionIntegration.adapter, null);
});
test("backend mode has no guessed endpoint or fallback risk", async () => {
  const result = await loadPrevention("backend", signal(), null);
  assert.equal(result.status, "unavailable");
  assert.equal(result.data, undefined);
});
test("all seven data states are supported without converting missing data to zero", async () => {
  for (const status of ["loading", "empty", "insufficient", "unavailable", "error"]) {
    const result = await loadPrevention("backend", signal(), {
      load: async () => ({ status, message: "Supplied state" }),
    });
    assert.equal(result.status, status);
    assert.equal(result.data, undefined);
  }
  const success = clone();
  success.provenance = "backend";
  assert.equal(
    (
      await loadPrevention("backend", signal(), {
        load: async () => ({ status: "success", data: success }),
      })
    ).status,
    "success",
  );
  assert.equal((await loadPrevention("demonstration", signal())).status, "demonstration");
});
test("demo provenance cannot silently masquerade as backend success", async () => {
  const result = await loadPrevention("backend", signal(), {
    load: async () => ({ status: "success", data: clone() }),
  });
  assert.equal(result.status, "demonstration");
});
test("incompatible target windows, horizons, models, metrics, and regions are never compared", () => {
  const data = clone(),
    current = data.currentAssessments[0],
    prior = previousComparable(current, data);
  assert.ok(prior);
  assert.equal(compatibleAssessments(current, prior, data.forecastWindows), true);
  for (const mutate of [
    (a) => {
      a.regionId = "attica";
    },
    (a) => {
      a.model.version = "other-version";
    },
    (a) => {
      a.model.id = "other-model";
    },
    (a) => {
      a.metric.id = "other-metric";
    },
    (a) => {
      a.metric.max = 1;
    },
    (a) => {
      a.validityId = "demo-48";
    },
  ]) {
    const other = structuredClone(prior);
    mutate(other);
    assert.equal(compatibleAssessments(current, other, data.forecastWindows), false);
  }
  const shifted = {
    ...data.forecastWindows[0],
    id: "shifted",
    validFrom: "2026-08-25T12:00:00Z",
    validTo: "2026-08-26T12:00:00Z",
  };
  assert.equal(
    compatibleAssessments(current, { ...prior, validityId: "shifted" }, [
      ...data.forecastWindows,
      shifted,
    ]),
    false,
  );
  const unknownHorizon = data.forecastWindows.map((w) => ({ ...w, horizonHours: null }));
  assert.equal(compatibleAssessments(current, prior, unknownHorizon), false);
});
test("unknown or insufficient references do not establish a trend", () => {
  const data = clone(),
    current = data.currentAssessments[0];
  current.trend.referenceAssessmentId = "not-supplied";
  assert.equal(previousComparable(current, data), null);
  current.trend.referenceAssessmentId = data.riskHistory[0].id;
  data.riskHistory[0].quality = "insufficient";
  assert.equal(previousComparable(current, data), null);
});
test("missing numeric values stay missing; explicit numeric zero remains displayable", () => {
  const data = clone(),
    a = data.currentAssessments[0];
  a.value = null;
  assert.equal(displayableRisk(a), false);
  assert.equal(a.value, null);
  a.value = 0;
  assert.equal(displayableRisk(a), true);
  a.value = Infinity;
  assert.equal(displayableRisk(a), false);
  a.value = 101;
  assert.equal(displayableRisk(a), false);
});
test("invalid supplier data fails safely instead of displaying a synthetic substitute", async () => {
  const data = clone();
  data.provenance = "backend";
  data.currentAssessments[0].probability = { value: 1.4, eventLabel: "Invalid input" };
  assert.equal(validPayload(data), false);
  const result = await loadPrevention("backend", signal(), {
    load: async () => ({ status: "success", data }),
  });
  assert.equal(result.status, "error");
  assert.equal(result.data, undefined);
  const failed = await loadPrevention("backend", signal(), {
    load: async () => {
      throw new Error("private-adapter-detail");
    },
  });
  assert.equal(failed.status, "error");
  assert.doesNotMatch(failed.message, /private-adapter-detail/);
});
test("responses do not mutate the original isolated demonstration fixtures", async () => {
  const before = JSON.stringify(preventionDemo);
  const result = await loadPrevention("demonstration", signal());
  const current = result.data.currentAssessments[0];
  previousComparable(current, result.data);
  assert.equal(JSON.stringify(preventionDemo), before);
});
