# Cascadis — Data Center Sustainability Scoring

**Cascadis** is the umbrella product name. **DCSS** means **Data Center Sustainability Scoring**. The current workspace provides location screening using WRI Aqueduct water risk, an Ember country-level grid-carbon proxy, and explicit cost, uptime, and growth constraints.

The product is independent public-data decision support. It is not a Google product and does not imply Google endorsement.

The application is entirely in English. It supports map clicks, manual coordinates, CSV batches of up to 100 sites, portfolio ranking, cooling shortlists, phased delivery actions, and CSV/JSON exports.

## Google public-location portfolio

The repository includes a versioned manifest of 59 coordinate-bearing Google public data-center locations checked on 10 August 2026. The seed contains 30 locations reported as operating and 29 reported as in development, under construction, or announced. One additional Michigan announcement is retained in the manifest as unlocated and is not scored because Google has not disclosed a locality.

Validate and load the portfolio explicitly:

```bash
make seed-google-dry-run
make seed-google
```

The seed is append-only and idempotent. Stable `google-dc-*` IDs are checked directly against SQLite before any source lookup. Re-running the command inserts no duplicate rows and leaves unrelated assessments unchanged.

The unit of analysis is a Google public **location**, which can contain more than one physical facility. `Ellis County, Texas` is excluded as an aggregate alias of Midlothian and Red Oak. Google Cloud regions, zones, edge points, and undisclosed parcels are outside scope. Public Google map markers are medium-confidence coordinate proxies; other records use low-confidence OpenStreetMap Nominatim locality centroids. No coordinate is represented as a verified campus boundary or street address.

Project type, cost, uptime, and growth inputs are explicit tool scenarios. They are not Google disclosures. PUE, WUE, capacity, and energy use remain null in the seed because public reporting does not map every value cleanly to each public location unit.

## Quick start

Requirements: Python 3.11, Node.js 20 or later, and npm.

```bash
cp .env.example .env
make setup
make dev
```

Open:

- Dashboard: `http://127.0.0.1:5173`
- API documentation: `http://127.0.0.1:8000/docs`

After setup, `make dev` is the single local launcher for the API and dashboard. Press `Ctrl+C` to stop both processes.

An Ember key is optional. With no key, the backend uses Ember's public yearly CSV. When `EMBER_API_KEY` is set, the backend prefers the documented yearly endpoint. Keys stay in the backend environment and are excluded from Git.

## User workflow

1. Click the map or enter latitude and longitude.
2. Add project type, cost priority, uptime constraint, and expected three-year growth.
3. Optionally add PUE, WUE, IT utilisation, and annual IT energy.
4. Queue one or more sites, choose water/carbon weights, then run the assessment.
5. Review the map, portfolio ranking, separate WRI sensitivity views, cooling shortlist, delivery sequence, source evidence, and warnings.

The WRI views stay separate. Baseline Water Stress drives the cooling matrix. Default, Electric Power, and Semiconductor scores support sensitivity analysis. WRI does not provide a Data Center preset.

## CSV input

Download the template from the dashboard or supply these headers:

```text
id,name,latitude,longitude,project_type,cost_priority,uptime_constraint,growth_3y,pue,wue_l_per_kwh,it_load_utilization_pct,annual_it_energy_mwh
```

Required fields are `id`, `name`, `latitude`, and `longitude`. Canonical categorical values are:

- `project_type`: `retrofit`, `expansion`, `greenfield`
- `cost_priority`: `constrained`, `balanced`, `investment_ready`
- `uptime_constraint`: `no_outage`, `maintenance_window`, `major_works_allowed`
- `growth_3y`: `stable`, `moderate`, `high`

The importer validates coordinates and optional metrics before any source lookup. The maximum batch size is 100 sites.

## API

Endpoints:

```text
POST /api/v1/assessments
GET  /api/v1/assessments/{id}
GET  /api/v1/portfolio
GET  /api/v1/policy
GET  /api/v1/sources/status
GET  /api/v1/health
```

Example request:

```json
{
  "locations": [{
    "id": "phoenix-1",
    "name": "Phoenix candidate",
    "latitude": 33.4484,
    "longitude": -112.074,
    "project_type": "retrofit",
    "cost_priority": "constrained",
    "uptime_constraint": "no_outage",
    "growth_3y": "high",
    "pue": 1.62,
    "wue_l_per_kwh": 0.4,
    "it_load_utilization_pct": null,
    "annual_it_energy_mwh": null
  }],
  "weights": { "water": 0.5, "carbon": 0.5 },
  "water_view": "baseline_water_stress"
}
```

## Architecture

- `backend/`: FastAPI, Pydantic, HTTPX, SQLite, providers, policy engine, tests
- `dashboard/`: React, TypeScript, Vite, Tailwind, Leaflet, tests
- `config/decision_policy.v1.json`: versioned score anchors, bands, cooling matrix, delivery actions
- `scripts/dev.py`: coordinated local launcher
- `scripts/prepare_aqueduct.py`: reproducible path from the pinned official Aqueduct ZIP to a slim GeoPackage

Source values, internal score policy, and recommendations remain separate in the API response. Every assessment persists its source vintage, unit, factor basis, retrieval time, cache status, source URL, and attribution.

The additive score is labelled **Location Exposure Score**. It supports regional screening and portfolio sorting. Cooling selection uses the non-compensatory baseline-water-stress gate in the decision matrix.

Portfolio ranking requires one common grid-factor provider, basis, and unit. If persisted results contain mixed Ember and IEA bases, the API and dashboard block the combined rank and require basis-specific review.

## Local Aqueduct preparation

The MVP queries Esri's Aqueduct 4.0 Baseline Annual layer and caches results in SQLite. Production or client deployment should use a pinned local Aqueduct dataset to remove reliance on Esri availability.

Install GDAL, then prepare the GeoPackage:

```bash
.venv/bin/python scripts/prepare_aqueduct.py --download
```

The script verifies the pinned ZIP checksum, extracts `baseline_annual`, selects the fields used by the assessment contract, reprojects to WGS 84, and creates a GeoPackage spatial index. The `aqueduct_local` provider remains deliberately disabled until the lookup adapter receives production validation.

The `iea_annual_file` adapter also remains disabled. No licensed IEA data is included.

## Validation

```bash
make test
```

The command runs backend tests, frontend component tests, and a production frontend build. The network smoke test is opt-in:

```bash
PYTHONPATH="$PWD/backend/src" RUN_NETWORK_TESTS=1 .venv/bin/python -m pytest backend/tests/test_network.py
```

Browser QA artifacts belong under `output/playwright/`, which is excluded from Git.

## Data handling and limitations

- Site inputs and assessment results are stored locally in SQLite at `DC_COOLING_DB_PATH`.
- Coordinates are sent to the configured Esri endpoint for Aqueduct lookup. Site names and business inputs are not sent to Esri.
- Ember receives an ISO3 country code, resolved from the Aqueduct feature. The public CSV fallback is downloaded without site coordinates.
- OpenStreetMap receives normal map-tile requests from the browser.
- The tool provides long-term screening evidence. Final cooling selection requires engineering review of temperature, humidity, available power, hydraulics, controls, and redundancy.
- Ember is a national lifecycle generation-intensity proxy. Values are not IEA factors, regional grid-zone factors, or formal Scope 2 reporting factors.
- For Google locations, Aqueduct is an external regional pre-screen and is not represented as a Google Water Risk Framework rating.

Method details are in [docs/METHODOLOGY.md](docs/METHODOLOGY.md). Google portfolio scope is in [docs/GOOGLE_PUBLIC_PORTFOLIO.md](docs/GOOGLE_PUBLIC_PORTFOLIO.md). Source terms and attribution are in [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md).
