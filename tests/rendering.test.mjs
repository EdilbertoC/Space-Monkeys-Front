import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server;
before(async () => {
  server = await createServer({
    logLevel: "error",
    server: { middlewareMode: true, hmr: false },
  });
});
after(async () => {
  await server?.close();
});

test("monthly chart SVG titles contain readable observations without React warnings", async (t) => {
  const { default: MonthlyComparison } = await server.ssrLoadModule(
    "/src/features/history/components/CalendarMonthlyComparison.tsx",
  );
  const { generateCalendar, summarizeCalendar } = await server.ssrLoadModule(
    "/src/features/history/demo/calendar-data.ts",
  );
  const errors = t.mock.method(console, "error", () => {});
  const summary = summarizeCalendar(
    generateCalendar(2020, { kind: "Global", name: "Global" }),
    "MODIS",
  );
  const html = renderToStaticMarkup(
    createElement(MonthlyComparison, { summary, year: 2020, sensor: "MODIS", onMonth: () => {} }),
  );
  assert.match(html, /<title>January: [\d,]+ hotspots; baseline [\d,]+; \d+ observed days;/);
  assert.equal((html.match(/<title>[^<]+<\/title>/g) ?? []).length, 12);
  assert.equal(errors.mock.callCount(), 0);
});

test("risk history SVG titles preserve supplied assessment details without React warnings", async (t) => {
  const { RiskEvolutionChart } = await server.ssrLoadModule(
    "/src/features/prevention-demo/components.tsx",
  );
  const { preventionDemo } = await server.ssrLoadModule("/src/features/prevention-demo/demo.ts");
  const assessment = preventionDemo.currentAssessments.find(
    (value) => value.value !== null && value.quality === "sufficient",
  );
  assert.ok(assessment);
  const errors = t.mock.method(console, "error", () => {});
  const html = renderToStaticMarkup(
    createElement(RiskEvolutionChart, {
      resource: { status: "demonstration", data: preventionDemo },
      assessment,
    }),
  );
  assert.match(html, /<title>[^<]+UTC · [\d.]+ · (?:low|moderate|high|critical|unknown)<\/title>/);
  assert.equal(errors.mock.callCount(), 0);
});
