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
  app/                        Application composition and configured services
    components/               Application sidebar, topbar, indicators, and dialog
  shared/
    api/                      HTTP transport, errors, types, and request hook
      generated/schema.ts     Generated types; do not edit manually
    ui/                       Shared components
    lib/                      Number formatting and CSV downloads
    constants/                Shared geographic options
    styles/                   Global styles
  features/
    history/
      api/                    Calendar, climatology, anomalies, season, and trend
      components/             Historical data presentation
      date-selection/         Demo date range selection
      demo/                   Demonstration data and calculations only
      model/                  Calendar presentation types and formatting
      styles/
    live/api/                 Active events, detections, and SSE stream
    system/api/               Health and worker/source status
    map/                      Map components, model, styles, and sample data
    sensors/                  Sensor controls and display metadata
    prevention-demo/          Prototype outside the current contract
    settings/                 Session preferences
tests/                        Domain tests and integration tests with simulated transport
scripts/                      Contract and type verification
docs/                         Integration decisions and guidance
```

## Integration status

The HTTP layer and services support all 13 routes in the contract. The current screens still use explicit demonstrations; setting the URL does not automatically replace the displayed data. Connect components to services one feature at a time, using loading/error states and the API's units. See [`docs/backend-integration.md`](docs/backend-integration.md).

Contract version `0.2.0-draft` marks the historical routes as planned. Risk forecasting and preventive alert management have no endpoints in this contract and remain isolated in `prevention-demo`. Do not infer risk probabilities from fire counts.

## Verification

```powershell
npm test
npm run typecheck
npm run format:check
npm run api:check
npm run build
```

`npm run format` formats TypeScript/JavaScript and configuration files. The contract, generated types, and CSS files are preserved. No linter is configured; `format:check` checks formatting, while `typecheck` also detects unused variables and parameters.

The diagnosis, changes, and verification limits are documented in [`docs/refactoring-report.md`](docs/refactoring-report.md).

After receiving a new contract version, replace `contracts/openapi.yaml`, run `npm run api:generate`, and review any incompatibilities reported by TypeScript. The `api:check` command detects differences between the YAML contract and the versioned types.

Validate the complete OpenAPI document and its examples using Python through uv:

```powershell
uv run --no-project --python 3.12 --with openapi-spec-validator --with pyyaml --with jsonschema python scripts/validate_contract.py
```

To also query the five GET routes without required parameters, append `--server http://localhost:8000`. This check requires a running backend; it does not test the stream or register polygons.
