# Refactoring report — Space Monkeys Frontend

This report records the earlier refactoring pass. The subsequent [file usage and correctness audit](file-audit.md) documents additional fixes, including the SVG title warnings listed below.

## 1. Diagnosis and scope

The structure, scripts, imports, HTTP calls, types, and main components were inspected before extraction. The baseline passed TypeScript checks, 63 tests, the build, and contract verification. Additional unused-code checks found an unused state setter and an unnecessary navigation index.

The project already had HTTP services organized by domain and centralized environment configuration. Both were retained. No libraries were installed, and the lockfile was not changed during this step.

## 2. Refactored components and functions

- `App.tsx`: reduced from 1,632 to 481 lines. Sidebar, topbar, indicator, and dialog presentation was extracted into controlled components in `app/components`; state and navigation remain in the composition.
- The historical timeline, recent activity table, and conceptual harmonization workflow were moved into their respective domains. Session preferences moved to `features/settings/WorkspaceSettings.tsx`.
- `BurningActivityCalendar.tsx`: reduced from 1,465 to 945 lines. Filters, monthly comparison, daily detail, and insights were extracted without changing callbacks or coordinated calendar/map state.
- Navigation and titles are typed in `app/navigation.ts` using `WorkspacePage`; indicators use `satisfies`, without icon or sensor casts.
- `SelectControl`: option props use React's type guard instead of a props assertion.
- Vite's HMR error replay uses Vite payload types, removing both explicit `any` declarations and unnecessary casts.

## 3. Removed duplication and cleanup

- A single `filterRecentActivity` serves the table and CSV export, preserving region, sensor, and inclusive date boundaries.
- A single `downloadCsv` replaces three repeated blocks for Blob creation, links, clicks, and URL cleanup. Content, MIME type, and filenames were preserved.
- Geographic options are shared in `shared/constants/geography.ts`; the existing `CONTINENTS` export remains available from the calendar module.
- Number formatting was isolated in a pure utility; the public `format` export remains compatible. Calendar presentation helpers remain within the domain.
- The unread alert count is calculated once per topbar render.
- The private `Sources` wrapper was removed after confirming that it only forwarded props to `SatelliteSources`.
- The unused setter and index were removed. The fixed timeline window became a named constant.
- Existing imports were organized using TypeScript tools; code that is not generated was standardized using the installed formatter. Fixtures, exported functions, and CSS classes were not removed without evidence that they were unused.

## 4. Organization and standardization

The `app / features / shared` architecture was retained, with new folders only for extracted responsibilities: `app/components`, `features/settings`, `features/history/model`, `shared/lib`, and `shared/constants`.

`.oxfmtrc.json` documents the formatting standard, and `npm run format:check` verifies it without writing files. Generated types, the contract, the lockfile, and CSS are excluded from formatting. `tsconfig.json` now checks `noUnusedLocals` and `noUnusedParameters`.

The rules in all 10 CSS files were preserved byte for byte. Explicit import ordering in `main.tsx` and the lazy calendar entrypoint preserves the original build's cascade, including after components were moved.

## 5. Verification results

| Check | Result |
| --- | --- |
| `npm.cmd run typecheck` | Passed, including unused-code checks |
| `npm.cmd test` | 65 tests passed; 0 failures |
| `npm.cmd run api:check` | Generated types match the OpenAPI contract |
| `npm.cmd run format:check` | Passed |
| `npm.cmd run build` | Passed |
| Lint | Not configured; not reported as executed |
| Reference HTML | 14 SSR renders compared, with no content differences |
| Build CSS | Both CSS bundles are identical to the baseline |

The renders include all nine navigation entries and the calendar rendered directly with ALL, MODIS, VIIRS, GOES ABI, and Sentinel-3 SLSTR. The lazy calendar route compares the initial fallback; calendar content is compared separately. Only Suspense diagnostic stack trace attributes are excluded from the comparison, because line numbers change after extraction. Temporary comparison scripts were removed after verification.

New tests cover inclusive date boundaries and the filters shared by the table and CSV export. Existing map, hotspot, calendar, sensor, anomaly, prevention, and HTTP transport tests continue to pass. This evidence does not replace complete browser interaction tests.

## 6. Affected files

New source files (19):

- `src/app/components/AboutDialog.tsx`
- `src/app/components/ObservationKpis.tsx`
- `src/app/components/WorkspaceSidebar.tsx`
- `src/app/components/WorkspaceTopbar.tsx`
- `src/app/navigation.ts`
- `src/features/history/components/ActivityTimeline.tsx`
- `src/features/history/components/CalendarDayDetail.tsx`
- `src/features/history/components/CalendarFilter.tsx`
- `src/features/history/components/CalendarInsights.tsx`
- `src/features/history/components/CalendarMonthlyComparison.tsx`
- `src/features/history/components/RecentActivityTable.tsx`
- `src/features/history/demo/recent-activity.ts`
- `src/features/history/demo/region-factors.ts`
- `src/features/history/model/calendar-presentation.ts`
- `src/features/sensors/SensorHarmonization.tsx`
- `src/features/settings/WorkspaceSettings.tsx`
- `src/shared/constants/geography.ts`
- `src/shared/lib/download-csv.ts`
- `src/shared/lib/format-count.ts`

Existing source files with content or formatting changes (26):

- `src/app/api.ts`
- `src/app/App.tsx`
- `src/features/history/api/history.ts`
- `src/features/history/components/AnomalyAlerts.tsx`
- `src/features/history/components/BurningActivityCalendar.tsx`
- `src/features/history/components/ExplorerHistory.tsx`
- `src/features/history/components/HarmonizedCalendar.tsx`
- `src/features/history/components/PriorityAnomalyTable.tsx`
- `src/features/history/demo/calendar-data.ts`
- `src/features/history/demo/demo-data.ts`
- `src/features/history/demo/exploration.ts`
- `src/features/history/demo/harmonized-preview.ts`
- `src/features/history/demo/priority-scenarios.ts`
- `src/features/map/components/FireMap.tsx`
- `src/features/map/components/HotspotTooltip.tsx`
- `src/features/prevention-demo/AlertCenter.tsx`
- `src/features/prevention-demo/components.tsx`
- `src/features/prevention-demo/Overview.tsx`
- `src/features/prevention-demo/RiskForecast.tsx`
- `src/features/prevention-demo/source.ts`
- `src/features/prevention-demo/usePrevention.ts`
- `src/features/sensors/SatelliteSources.tsx`
- `src/features/sensors/SensorControls.tsx`
- `src/main.tsx`
- `src/shared/ui/SelectControl.tsx`
- `src/shared/ui/ui.tsx`

Other modified or created files:

- `.oxfmtrc.json`, `package.json`, `tsconfig.json` e `vite.config.ts`.
- `README.md`, `AGENTS.md`, and this report.
- `tests/recent-activity.test.mjs`, with two new tests.
- Existing files in `tests/*.test.mjs` and `scripts/check-api-types.mjs` also went through the formatter; existing test scenarios were preserved.

## 7. Outstanding items and recommendations

- Interactive visual inspection could not be performed because computer use reported that its native connection was unavailable. The HTML/CSS comparison passed, but filters, focus, dragging, fullscreen, and responsiveness still need a manual browser review.
- SSR revealed pre-existing React warnings about multiple children in SVG `<title>` elements in the monthly comparison and preventive assessment history. These warnings also occur in the baseline before refactoring. They were documented and preserved because the current application renders on the client and this step prioritizes unchanged behavior. A dedicated fix could convert these texts to single strings and verify the tooltips.
- The calendar and map still coordinate substantial state and event handling. Further extractions can be made incrementally, preferably with interaction tests available, without introducing hooks solely to reduce line counts.
- Lint and browser tests can be evaluated in a dedicated step; no dependencies were installed for them during this cleanup.
- The screens remain in demonstration mode, and historical endpoint availability still depends on backend implementation status. No endpoint, response format, fallback, or satellite data was invented or changed during this step.
