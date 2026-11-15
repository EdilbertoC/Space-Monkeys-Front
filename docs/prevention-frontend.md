# Prevention frontend integration — provisional, not an API contract

This prototype now lives in `src/features/prevention-demo/`. The supplied
`contracts/openapi.yaml` has no prevention forecast or alert-management routes.
Keep these presentation models separate from the generated backend schemas.

This increment adds presentation only. It does not create backend routes, models,
prediction algorithms, databases, notification delivery, or sensor harmonization.
The existing observation map, sensor filters, calendar, and historical data remain
on their existing data path.

## Integration boundary

- `src/features/prevention-demo/contracts.ts` defines provisional **view contracts**, not the
  backend's eventual wire format. Regions, observations, assessments, trends,
  validity periods, monitored-region records, and alerts have explicit types.
- `config.ts` centralizes unconfigured endpoint slots and a nullable
  `PreventionAdapter`. Every endpoint and the adapter currently remain `null`.
  No paths or API availability are assumed.
- Once the backend team defines its contract, implement a **browser-side**
  adapter with `load(signal)`, use the agreed configured URLs, honor cancellation,
  and normalize/validate responses into these view contracts. Never put private
  credentials into frontend configuration.
- `source.ts` is the retrieval boundary. `usePrevention.ts` manages loading,
  cancellation, retries, and session-only read-status overrides. Visual
  components receive data/state props rather than fetching or generating risk.
- The seven supported states are loading, success, empty, insufficient,
  unavailable, error, and demonstration. Missing/invalid results are not
  substituted with zero risk.

## Scientific display safeguards

The supplier must identify current assessments, classifications, risk trends,
attention flags, validity periods, optional numeric values, model metadata,
uncertainty, environmental factors, and alert actions. The UI does not derive
these from hotspot counts. A probability is optional and must include its
supplier-provided event definition; risk indices are never converted into
probabilities.

A previous reference is displayed as comparable only when region, model/version,
metric/scale, forecast horizon, and exact target validity interval match. Trend
arrows use the supplied direction only when that comparable reference exists.
Risk-history plots exclude incompatible records and leave missing numeric values
as gaps. No interpolation, threshold classification, probability estimation,
forecast generation, or resampling is performed.

Forecast-map markers remain the **existing illustrative hotspot observations**,
not predicted ignition locations, risk polygons, or a probability surface. An
optional `observationContext` lets the adapter link a region to an existing map
scope. No risk geography is invented when none is supplied.

## Demonstration vs backend mode

`demo.ts` is a separate, explicitly synthetic UI-scenario file. Its values,
classification labels, trends, factors, and example advisories are not scientific
results. The development frontend starts in clearly labeled **Illustrative
preview** mode. Backend mode, with the current null adapter, shows API unavailable
and makes no requests. Before any operational release, choose backend mode as the
default and supply the real adapter; never substitute demo fixtures on failure.
Demonstration provenance is retained even if a future adapter accidentally labels
a demonstration payload as a success result.

Forecast validity is independent of the observation-date picker. Always preserve
the supplied validity interval and issuance time; don't present historical
observation dates as a forecast window.

## Alert and monitoring behavior

The backend supplies alert records and monitored-region configuration. The UI
supports region/severity/search/read filters, an alert inspector, linked regional
assessment views, unread counts, and explicit read/unread controls. Read changes
currently last only until reload or data-mode changes; no acknowledgement API or
notification service is implemented. A future persistence contract must be agreed
before adding that integration. No frontend action creates or delivers a real
preventive alert.

## Validation

```sh
npm run typecheck
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```
