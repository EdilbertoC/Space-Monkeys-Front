# Space Monkeys Frontend

React 19, TypeScript, Vite, and Tailwind CSS. The integration contract is versioned in [`contracts/openapi.yaml`](contracts/openapi.yaml).

## Getting started

Requirements: Node.js 22.18+ or 24 and npm (included with Node.js).

In Windows PowerShell, if `npm` fails because execution of `npm.ps1` is blocked, use `npm.cmd` in the commands below (for example, `npm.cmd run dev`). This works without changing the system execution policy. Vite uses port 8443 and selects the next available port if it is occupied; open the URL shown in the terminal.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` in `.env` and restart Vite after making changes. The default address is `http://localhost:8000`. The backend must allow the frontend origin through CORS, including the SSE stream. `VITE_*` variables are public: do not include passwords or private keys.

## Project structure

```text
contracts/                    Contract supplied by the backend
src/
  main.tsx                    React entrypoint
  app/                        Application composition, page routing and configured services
    components/               Sidebar, topbar and dialog
  shared/
    api/                      HTTP transport, errors, types and request hooks
      generated/schema.ts     Generated types; do not edit manually
    geo/                      Lon/lat projection onto the Natural Earth basemap
    ui/                       Shared components
    lib/                      Number formatting
    styles/                   Global styles
  features/
    history/
      api/                    Calendar, climatology, anomalies, season, trend and map
      components/             Burning calendar, period overview, analysis, anomaly scan
      date-selection/         Period picker
      model/                  Area, period and presentation helpers (pure, tested)
      styles/
    forecast/                 7-day forecast client and page
    live/                     Live fires client, SSE helpers and table
    system/                   Health and worker/source status
    map/                      Georeferenced map (history cells, live fires, forecast)
    sensors/                  Sensor descriptions and harmonization panel
    settings/                 Session preferences
tests/                        Domain tests and integration tests with simulated transport
scripts/                      Contract and type verification
docs/                         Integration decisions and guidance
```

## Integration status

Every page reads the Space Monkeys API; no screen uses fixtures. Coverage is Brazil (biomes or a lon/lat box), with fire cell-days as the unit. See [`docs/backend-integration.md`](docs/backend-integration.md) for which route feeds which page and what the backend does not provide yet.

The API must allow this origin in `CORS_ORIGINS` (`http://localhost:8443` in development). The forecast needs `FIRMS_MAP_KEY` on the server; without it the Risk Forecast page says so.

## Verification

```powershell
npm test
npm run typecheck
npm run format:check
npm run api:check
npm run files:audit
npm run build
```

`npm run format` formats TypeScript/JavaScript and configuration files. The contract, generated types, and CSS files are preserved. No linter is configured; `format:check` checks formatting, while `typecheck` also detects unused variables and parameters.

The diagnosis, changes, and verification limits are documented in [`docs/refactoring-report.md`](docs/refactoring-report.md).

For a file-by-file usage inventory, optional tooling explanations, and the latest correctness fixes, see [`docs/file-audit.md`](docs/file-audit.md). Run `npm run files:audit -- --json` to inspect the current source dependency inventory.

Before committing or pushing, see [`docs/version-control.md`](docs/version-control.md) for required files, optional tooling, credential exclusions, and attribution guidance.

After receiving a new contract version, replace `contracts/openapi.yaml`, run `npm run api:generate`, and review any incompatibilities reported by TypeScript. The `api:check` command detects differences between the YAML contract and the versioned types.

Validate the complete OpenAPI document and its examples using Python through uv:

```powershell
uv run --no-project --python 3.12 --with openapi-spec-validator --with pyyaml --with jsonschema python scripts/validate_contract.py
```

To also query the five GET routes without required parameters, append `--server http://localhost:8000`. This check requires a running backend; it does not test the stream or register polygons.
