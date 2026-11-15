# File usage and correctness audit

## Findings

All 74 files under `src` have a documented purpose: 65 are reachable through application imports, eight belong to the planned backend integration, and one supplies TypeScript declarations. No unresolved relative imports or unreferenced source files were found. Reachability includes type imports and lazy imports; it does not mean every module executes on initial load.

No application file was deleted. Removing files solely because the backend connection is not active would discard the agreed integration work. Conversely, the eight integration files are not presented as necessary to display the current demonstration.

Run `npm run files:audit` for a summary, or `npm run files:audit -- --json` for the full inventory. The script checks local module references, including test imports, using the existing TypeScript dependency. It exits unsuccessfully if it finds an unresolved local import or an unreferenced source file. Future entrypoints are explicitly listed rather than automatically treating every file as planned work.

## Files outside src

| Files | Purpose and decision |
| --- | --- |
| `package.json`, `package-lock.json` | npm commands and reproducible dependency installation; keep both. |
| `index.html`, `vite.config.ts`, `tsconfig.json` | Browser entrypoint, bundling/dev server, and compiler checks; required by the current toolchain. |
| `.env.example` | Public backend URL example; keep. Actual environment files remain ignored. |
| `.oxfmtrc.json` | Formatting rules and exclusions; used by the formatting commands. |
| `.gitignore`, `.gitattributes`, `public/.gitattributes` | Keep dependencies, secrets, and build output out of Git, normalize text line endings, and retain the existing binary asset rules. Duplicate ignore patterns were removed. |
| `.mise.toml` | Optional Node version helper, also watched by the Figma environment; not required for local npm commands. |
| `.figma/make/site.json` | Imported by `vite.config.ts` for site metadata and robots configuration; currently used by the build. |
| Other `.figma` files | Figma installation, development, preview, publishing, formatting, route analysis, and language-server support. Optional outside Figma, but retained to preserve that workflow. |
| `AGENTS.md`, `CLAUDE.md` | Development-agent guidance; optional tooling, not shipped application code. `CLAUDE.md` points to `AGENTS.md` rather than duplicating its instructions. |
| `LICENSE` | Project license; retain. |
| `README.md`, `docs/*` | Setup, integration constraints, prototype behavior, and audit history; not application runtime files. |
| `contracts/openapi.yaml` | Backend contract used for type generation and validation; retained unchanged. |
| `scripts/check-api-types.mjs` | Detects drift between generated types and the OpenAPI contract. |
| `scripts/validate_contract.py` | Optional complete contract/example and live-response validation; not a browser dependency. |
| `scripts/audit-files.mjs` | Reproducible source usage and local import audit. |
| `public/world-map.svg` | Referenced by the SVG image in `FireMap.tsx`; it supplies the geographic background. |
| `src/features/map/demo/map-data.json` | Supplies the 1,008 synthetic markers; it does not duplicate the geographic background SVG. |
| `public/favicon.png` | Used by the Vite site configuration as the browser icon. |
| `public/data-attribution.txt` | Map attribution and scientific provenance information; useful even though it is not imported by JavaScript. |
| `tests/*` | Automated verification; not shipped to the browser. |
| `node_modules/`, `dist/` | Ignored, generated dependency/build folders; not versioned source. They can be recreated with `npm ci` and `npm run build`. |

## Removed duplication

- Calendar date parsing, ISO formatting, and month names now reuse the existing calendar utilities instead of maintaining duplicate implementations in the date picker.
- Map viewport centers are defined once and reused for both rendering and focus navigation. Focus previously used the global center for every region except South America.
- Selected-history summaries are computed once after sensor filtering. The previous private helper computed a complete summary that its caller immediately recomputed. Forty combinations of historical periods, sensor selections, and weekly/monthly aggregation produced identical result values before and after the change.
- Duplicate ignore patterns were removed without removing the corresponding exclusions.

## Fixed errors

- A new notification now cancels the previous dismissal timer. Previously an old timer could immediately dismiss a newer notification. The timer is also cleared when the application unmounts.
- SVG titles in monthly comparisons and risk history now contain single strings. React no longer reports the multiple-children warnings, and server-rendered titles contain their intended text instead of being empty.
- Regional map focus now uses the actual viewport center. Changes to anomaly-preview mode also trigger the intended viewport reset.
- Text files explicitly use LF in Git attributes. With the previous Windows checkout settings, `format:check` failed on all 79 formatted files despite unchanged logical content.

No backend route, response format, satellite value, CSS rule, or visual identity was changed. No new library was installed.

## Validation and limits

- TypeScript, the test suite, the production build, generated API type verification, formatting, and source usage checks were run after the changes.
- Regression tests cover non-global map focus and nonempty SVG titles without React warnings. Existing satellite, date, calendar, anomaly, prevention, and transport tests remain in place.
- Import reachability is evidence of use, not proof that every exported function or every branch is exercised. Dynamic CSS state selectors were retained because deleting them without browser interaction coverage could remove valid states.
- The current screens remain demonstrations. Backend service entrypoints are retained for the documented integration; they do not silently replace simulated data.
- No linter is configured. A real browser interaction review and live backend validation remain separate from these automated checks.

## Source inventory

| File | Referenced by |
| --- | --- |
| src/app/api.ts | backend integration |
| src/app/App.tsx | application |
| src/app/components/AboutDialog.tsx | application |
| src/app/components/ObservationKpis.tsx | application |
| src/app/components/WorkspaceSidebar.tsx | application |
| src/app/components/WorkspaceTopbar.tsx | application |
| src/app/navigation.ts | application |
| src/features/history/api/history.ts | backend integration |
| src/features/history/components/ActivityTimeline.tsx | application |
| src/features/history/components/AnomalyAlerts.tsx | application |
| src/features/history/components/BurningActivityCalendar.tsx | application |
| src/features/history/components/CalendarDayDetail.tsx | application |
| src/features/history/components/CalendarFilter.tsx | application |
| src/features/history/components/CalendarInsights.tsx | application |
| src/features/history/components/CalendarMonthlyComparison.tsx | application |
| src/features/history/components/ExplorerHistory.tsx | application |
| src/features/history/components/HarmonizedCalendar.tsx | application |
| src/features/history/components/PriorityAnomalyTable.tsx | application |
| src/features/history/components/RecentActivityTable.tsx | application |
| src/features/history/date-selection/date-calendar.css | application |
| src/features/history/date-selection/date-range.ts | application |
| src/features/history/date-selection/DateCalendar.tsx | application |
| src/features/history/demo/calendar-data.ts | application |
| src/features/history/demo/demo-data.ts | application |
| src/features/history/demo/exploration.ts | application |
| src/features/history/demo/harmonized-preview.ts | application |
| src/features/history/demo/priority-scenarios.ts | application |
| src/features/history/demo/recent-activity.ts | application |
| src/features/history/demo/region-factors.ts | application |
| src/features/history/model/calendar-presentation.ts | application |
| src/features/history/styles/calendar.css | application |
| src/features/history/styles/exploration.css | application |
| src/features/history/styles/harmonized-calendar.css | application |
| src/features/history/styles/priority-anomalies.css | application |
| src/features/live/api/live.ts | backend integration |
| src/features/map/components/FireMap.tsx | application |
| src/features/map/components/HotspotTooltip.tsx | application |
| src/features/map/components/MapAreaSelection.tsx | application |
| src/features/map/components/MapLocationDialog.tsx | application |
| src/features/map/demo/map-data.json | application |
| src/features/map/model/map-location.ts | application |
| src/features/map/styles/map-location.css | application |
| src/features/prevention-demo/AlertCenter.tsx | application |
| src/features/prevention-demo/components.tsx | application |
| src/features/prevention-demo/config.ts | application |
| src/features/prevention-demo/contracts.ts | application |
| src/features/prevention-demo/demo.ts | application |
| src/features/prevention-demo/Overview.tsx | application |
| src/features/prevention-demo/presentation.ts | application |
| src/features/prevention-demo/prevention.css | application |
| src/features/prevention-demo/RiskForecast.tsx | application |
| src/features/prevention-demo/source.ts | application |
| src/features/prevention-demo/usePrevention.ts | application |
| src/features/sensors/SatelliteSources.tsx | application |
| src/features/sensors/SensorControls.tsx | application |
| src/features/sensors/SensorHarmonization.tsx | application |
| src/features/sensors/sensors.css | application |
| src/features/sensors/sensors.ts | application |
| src/features/settings/WorkspaceSettings.tsx | application |
| src/features/system/api/system.ts | backend integration |
| src/main.tsx | application |
| src/shared/api/generated/schema.ts | backend integration |
| src/shared/api/http.ts | backend integration |
| src/shared/api/types.ts | backend integration |
| src/shared/api/useApiResource.ts | backend integration |
| src/shared/constants/geography.ts | application |
| src/shared/lib/download-csv.ts | application |
| src/shared/lib/format-count.ts | application |
| src/shared/styles/index.css | application |
| src/shared/styles/refinements.css | application |
| src/shared/ui/DataStatus.tsx | application |
| src/shared/ui/SelectControl.tsx | application |
| src/shared/ui/ui.tsx | application |
| src/vite-env.d.ts | TypeScript declarations |
