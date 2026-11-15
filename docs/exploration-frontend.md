# Linked exploration and anomaly review

This document describes the demonstration UI. Its fixtures now live in
`src/features/history/demo/`, and map fixtures in `src/features/map/demo/`.
The separate backend services and current integration status are documented in
[`backend-integration.md`](backend-integration.md).

This enhancement remains frontend-only. No endpoint, Payload model, live sensor
integration, validated anomaly detector, harmonization, or geospatial clipping
pipeline has been introduced. The existing prevention adapter is unchanged.

## State and navigation

- The application retains its existing navigation entries and adds **Anomaly
  Alerts**. All previous views remain accessible.
- The global region, source and UTC window are shared with the calendar. The
  calendar additionally retains its detailed scope and projected area selection
  in application state across navigation.
- Map layer switches live in `SensorLayersProvider`, so visibility survives
  navigation between Overview, Fire Map, the calendar and Risk Forecast.
  Only MODIS and VIIRS have demo observations; planned layers never gain markers.
- The initial global observation window follows `CALENDAR_CUTOFF`, the existing
  fixture availability boundary, rather than the clock or a second hardcoded date.
- Calendar year/month, selected day, chart period and map readouts are linked.
  Selecting a day preserves the wider heatmap context while changing the shared
  observation window. “Show full selected period” restores the analytical range.
  Cross-year heatmaps display the end year; the long-term chart spans the selected
  starting/ending years. Year/month filters are not duplicated below the map.

## Spatial selection limitations

`MapAreaSelection` supports individual/multiple projected grid cells, a rectangle
and a polygon. The preview shape is drawn in the existing map's SVG coordinates;
these are **not acquisition coordinates or a validated geographic footprint**.
Grid controls support arrows/Home/End and Enter/Space. Drawing surfaces support
arrow movement, Space to set corners/vertices, Enter to finish a polygon, and
Escape to cancel. Pan mode restores hotspot inspection.

Selections provide stable keys to the existing deterministic **synthetic** regional
fixture generator. They do not spatially filter satellite acquisitions or perform
polygon clipping. The UI states this next to the map, and CSV geometry is labeled
“projected preview only.” Custom geographic bounds remain available in the
original custom-area form. Real area calculations await the backend team's
defined data contract and validated projection/selection support.

## Historical series

The existing monthly comparison and raw source details are preserved. The new
long-term explorer uses MODIS as the primary All Sensors fallback while
harmonization is pending, keeps raw VIIRS comparison values in the inspection
readout and CSV, and matches synthetic baselines to available days. Missing bins
remain null. No FRP, uncertainty bounds or harmonized values are derived.
The historical archive is explicitly synthetic, including historical fixtures;
it is not evidence that all platforms were operational in every fixture year.

## Anomaly review

`DemoAnomaly` is a demo presentation type, **not an API contract**. Records are
derived solely from existing `activityFor` synthetic source-day flags, using
MODIS fallback or the selected VIIRS source. Missing, unavailable and harmonized
selections produce no flags. Illustrative severity thresholds are disclosed.

Geographic region, source and period filters use the global toolbar; severity
and session-only review status are local. Linked results open the selected
scope/date in the calendar/map workspace. The Overview banner is shown only
when a flagged result actually exists in the selected demo window. Dismissal
hides that banner but does not delete or change the result.

Backend mode shows unavailable without requests or demo fallback. There is
intentionally **no operational sidebar notification count** while validated
anomaly results are unavailable. A future count/banner must use supplier-provided
status, severity, provenance and metrics, not raw hotspot totals.

## Harmonized calendar design preview

The calendar now defaults to an emerald/cyan **Harmonized Index** presentation
preview. `harmonized-preview.ts` isolates the user-supplied sample KPI values and
synthetic monthly index colors from all existing observation models and APIs.
The 84.6 HFI, 142,890 MW, 14 regions and 68/32 regime split are explicitly labeled
fixed illustrative design values, not measurements of the selected AOI or period.
No index normalization, FRP unification or land-cover classification is performed.

The inclusive 2006–2026 matrix contains **21 rows**; “20-year” refers to the
requested reference window, not the number of calendar years displayed. Its
August 2026 global scenario is 92.4 HFI and +51% versus the mock reference. Months
after the existing fixture cutoff remain missing. Selecting an AOI changes the
deterministic illustrative matrix; unavailable sensors do not acquire HFI data.

**Raw Sensor Counts** switches the matrix to existing `generateCalendar` /
`summarizeCalendar` records with original source provenance. Selecting a cell or
temporal-comparison bar changes the shared UTC period, map and daily observations.
The original daily heatmap remains expandable; all previous analysis controls,
CSV exports and scientific availability behavior are preserved.

The requested “NASA FIRMS Synced” badge is deliberately not displayed because
there is no live FIRMS connection. The UI shows the real connection state and
the illustrative archive range instead. The same rule applies to operational
alert counts and harmonized/FRP measurements.

## South America pattern-layer and priority-table preview

The harmonized calendar's initial **viewport** is now South America with the
polygon drawing tool active. The global analytical scope and initial Overview
workspace remain global; the UI explicitly distinguishes analysis from viewport.
Existing continental filters, global reset, other selection tools, sensor filters,
raw-mode sensor colors and hotspot inspection remain available.

`priority-scenarios.ts` isolates four fictional Amazon/Cerrado triage scenarios.
The crimson pulsing markers correspond to two explicitly selected critical
scenario markers in the existing spatial fixture; other preview markers are amber.
These colors are **not a validated classification of the original observations**.
Native source identifiers, unavailable acquisition metadata and raw records remain
unchanged. Reduced-motion users receive a static ring instead of a pulse.

The floating legend explains the 1 km MODIS / 375 m VIIRS workflow but explicitly
states that no validated calibration is connected. It does not claim calibrated
counts, FRP or harmonization. Other maps retain their existing sensor-color display.

The Priority Anomaly Alerts table has illustrative z-scores, **mock** FRP values,
pattern labels and critical/warning pills. It is not a live incident queue or an
advisory to dispatch responders. Joint-source scenarios are unavailable for
single-source/planned sensor selections and outside the sample UTC period or
supported continental/country context. Custom polygons do not perform scientific
clipping; the table discloses that its scenario list is not spatially clipped.

“Inspect AOI” selects the scenario's projected polygon, updates the shared UTC
date, centers/zooms the map and shows the scenario provenance. Polygons and region
names are schematic UI references, not incident boundaries or georeferenced
acquisitions. No sample metric is copied into the real anomaly-review workflow,
notifications, original observation objects or raw-data exports.

## Validation commands

### Annual calendar and shared controls

The main visualization now shows twelve months for one selected year, with
previous/next and dropdown navigation from 2001. Month selection uses the existing
shared-period/map path. Long-term exploration remains in `ExplorerHistory`; the
old matrix builder remains compatible as a data utility, not a visible spreadsheet.
`SelectControl` shares full-hit-area triggers, portaled menus, keyboard navigation,
and independent values across region/sensor/year/month controls. The date popup
shares styling and now keeps keyboard focus within its portal correctly.
`refinements.css` centralizes typography/control tokens and center-origin marker
scaling. `DataStatus` centralizes observation provenance while retaining necessary
mock-metric and unavailable-source caveats. No Mapbox connection was added because
the public-token request was declined.

```sh
npm run typecheck
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```
