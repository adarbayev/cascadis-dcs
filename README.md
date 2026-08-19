# CASCADIS EEMS — Data Center Environmental & Energy Management

**CASCADIS** means **Campus Assurance, Sustainability, Compliance and Data-center Intelligence System**. The product combines environmental and energy management workspaces with the existing Data Center Sustainability Scoring location-intelligence module.

The product is independent portfolio decision support. It is not a Google product and does not imply Google endorsement.

The application is entirely in English. The management workspace covers site lifecycle, operating responsibilities, permits, environmental aspects, energy and water performance, cooling assets, contributor checklists, actions and assurance. Location Intelligence continues to support map clicks, manual coordinates, CSV batches of up to 100 sites, portfolio ranking, cooling shortlists and exports.

## Environmental and energy management workspace

The primary navigation contains:

- **Command center** — portfolio indicators, management-attention queue and EEMS map signals;
- **Sites** — site lifecycle, ownership/control matrix, cooling register and detailed records;
- **Compliance** — permits and obligations with holder, owner, review and due status;
- **Environmental** — activity, aspect, impact, operating condition, control and residual risk;
- **Energy** — facility electricity, IT electricity, water, PUE, WUE and CUE;
- **Actions** — improvement work, contributor checklists, audits and follow-up;
- **Location intelligence** — the original water/grid exposure and cooling-screening workflow;
- **Scoring** — the calculation assumptions, sensitivity views, anchors and weights.

Six detailed site archetypes illustrate owned mature operations, owned expansion, owned development, build-to-suit construction, colocation and partner-operated handover. Lifecycle and ownership remain separate, and every archetype includes a responsibility matrix for asset, facilities, IT, cooling, utilities, permits, data and action approval. Remaining portfolio sites enter the EEMS workflow at gap assessment.

Operational workspace entries are working planning records and await site-owner confirmation before operational use. See [the EEMS product model](docs/EEMS_PRODUCT_MODEL.md) for the ISO workflow mapping, archetype definitions, market patterns and connected-system roadmap.

## Google public-location portfolio

The repository includes a versioned manifest of 59 coordinate-bearing Google public data-center locations checked on 10 August 2026. The seed contains 30 locations reported as operating and 29 reported as in development, under construction, or announced. One additional Michigan announcement is retained in the manifest as unlocated and is not scored because Google has not disclosed a locality.

Validate and load the portfolio explicitly:

```bash
make seed-google-dry-run
make seed-google
```

The seed is append-only and idempotent. Stable `google-dc-*` IDs are checked directly against SQLite before any source lookup. Re-running the command inserts no duplicate rows and leaves unrelated assessments unchanged.

The unit of analysis is a Google public **location**, which can contain more than one physical facility. `Ellis County, Texas` is excluded as an aggregate alias of Midlothian and Red Oak. Google Cloud regions, zones, edge points, and undisclosed parcels are outside scope. Public Google map markers are medium-confidence coordinate proxies; other records use low-confidence OpenStreetMap Nominatim locality centroids. No coordinate is represented as a verified campus boundary or street address.

Project type, cost, uptime, and growth inputs are explicit tool scenarios. They are not Google disclosures. The portfolio view matches Google's 2026 Q1 PUE table to 27 public location rows. Unmatched rows use the visible, editable 2025 Google fleet PUE of 1.09. Site-level public WUE is unavailable; the default 1.15 L/kWh is an editable 2024 fleet proxy for data centers supporting LLM models. Every row shows whether a metric is operator-reported, a fleet proxy, a user assumption, or derived.

## Published dashboard

The read-only GitHub Pages edition is published at:

- <https://adarbayev.github.io/cascadis-dcs/>

Pages serves a pinned 59-location snapshot. Score scenarios, filters, comparison, and exports run in the browser. New coordinate assessments remain in the local FastAPI edition because GitHub Pages cannot run the backend or SQLite database.

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

## Dashboard workspaces

**Overview** is the portfolio-selection workspace. Search, status, PUE/WUE/CUE bounds, priority-score bounds, and the Baseline Water Stress selector reduce one shared result set. The KPI strip, map, sortable table, comparison set, and exports reconcile to that set. PUE, WUE, and CUE remain separate table columns with their units and evidence basis.

**Scoring methodology** contains controls that change calculations: metric assumptions, normalization anchors, WRI view, factor weights, and the default ranking basis. The static GitHub Pages snapshot recalculates the Composite Priority Score in the browser. Location Exposure weights apply only when the local API creates a new assessment because published snapshot exposure scores are already calculated.

## Operating metrics and composite scenario

The dashboard keeps two scores visible:

- **Location Exposure Score**: the original WRI water and national grid-carbon screen.
- **Composite Priority Score**: an editable scenario that adds a facility-efficiency benchmark gap.

A higher Composite Priority Score indicates greater intervention pressure from facility gaps and environmental exposure. The value is not an efficiency performance rating; a filter such as `Composite ≥ 80` selects higher-priority sites.

Default facility assumptions are taken from public Google evidence where a direct mapping is credible. CUE is derived as `PUE × grid factor / 1000` in `kgCO2e/kWh IT`. CUE remains filterable and receives no separate composite weight because PUE and grid carbon already appear in the calculation.

```text
pue_gap = clamp((PUE - 1.40) / (2.00 - 1.40), 0, 1)
wue_gap = clamp((WUE - 1.50) / (3.00 - 1.50), 0, 1)
facility_gap = 0.5 × pue_gap + 0.5 × wue_gap
composite = 100 × (0.30 × facility_gap + 0.40 × WRI/5 + 0.30 × grid/800)
```

The anchors and weights are internal scenario settings. Published Google PUE/WUE proxies are currently below the internal intervention thresholds, so the default facility-gap contribution is zero; changing a scenario value above a threshold makes the facility term active. Overview filters support inclusive minimum and maximum bounds for exposure, composite score, PUE, WUE, and CUE. The water-level selector always uses Baseline Water Stress and preserves Arid and No Data as explicit states. Changing the WRI sensitivity view under Scoring methodology does not change that filter definition. The same filtered set drives the map, summary, portfolio table, comparison queue, and exports.

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
- `dashboard/`: React, TypeScript, Vite, Tailwind, Leaflet with a MapLibre vector-basemap layer, tests
- `config/decision_policy.v1.json`: versioned score anchors, bands, cooling matrix, delivery actions
- `config/operational_composite.v1.json`: versioned operating assumptions, anchors, weights, and composite formula
- `dashboard/public/data/google-portfolio.2026-08-10.json`: pinned published assessment snapshot
- `.github/workflows/pages.yml`: tested GitHub Pages deployment
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

The Pages build can be reproduced locally with:

```bash
VITE_APP_MODE=static VITE_BASE_PATH=/cascadis-dcs/ npm --prefix dashboard run build
```

## Data handling and limitations

- Site inputs and assessment results are stored locally in SQLite at `DC_COOLING_DB_PATH`.
- Coordinates are sent to the configured Esri endpoint for Aqueduct lookup. Site names and business inputs are not sent to Esri.
- Ember receives an ISO3 country code, resolved from the Aqueduct feature. The public CSV fallback is downloaded without site coordinates.
- OpenFreeMap receives normal style, vector-tile, font, and sprite requests from the browser. Its public service requires no API key and provides no SLA; the map retains visible OpenStreetMap-derived attribution.
- The tool provides long-term screening evidence. Final cooling selection requires engineering review of temperature, humidity, available power, hydraulics, controls, and redundancy.
- Ember is a national lifecycle generation-intensity proxy. Values are not IEA factors, regional grid-zone factors, or formal Scope 2 reporting factors.
- For Google locations, Aqueduct is an external regional pre-screen and is not represented as a Google Water Risk Framework rating.

Method details are in [docs/METHODOLOGY.md](docs/METHODOLOGY.md). Google portfolio scope is in [docs/GOOGLE_PUBLIC_PORTFOLIO.md](docs/GOOGLE_PUBLIC_PORTFOLIO.md). Source terms and attribution are in [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md).
