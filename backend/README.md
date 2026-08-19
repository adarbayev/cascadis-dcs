# Cascadis Data Center Sustainability Scoring API

FastAPI backend for an internal location-screening tool. It combines WRI
Aqueduct 4.0 water-risk fields with an Ember national grid-carbon proxy, applies
the versioned policy in `../config/decision_policy.v1.json`, and stores source
responses and assessments in SQLite.

This API supports screening. A final cooling design requires engineering review
of climate hours, temperature, humidity, power availability, hydraulics and
redundancy.

## Local setup

From the repository root:

```bash
python3.11 -m venv backend/.venv
backend/.venv/bin/pip install 'backend[test]'
backend/.venv/bin/uvicorn dc_cooling.main:app --app-dir backend/src --reload --port 8000
```

Open `http://127.0.0.1:8000/docs` for the generated OpenAPI interface.

Configuration can be placed in `.env` or `backend/.env`. See `.env.example`.
An Ember API key is optional: the API is preferred when configured; the backend
uses Ember's public yearly CSV when the key is absent or the API request fails.
Grid factors come from the configured provider; the backend does not generate fallback factors.

## API

- `POST /api/v1/assessments` — assess 1–100 locations.
- `GET /api/v1/assessments/{assessment_id}` — retrieve one persisted result.
- `GET /api/v1/portfolio` — retrieve and re-rank persisted results.
- `GET /api/v1/policy` — inspect the active calculation and matrix policy.
- `GET /api/v1/sources/status` — inspect enabled, disabled and cached providers.
- `GET /api/v1/health` — service and policy version.

Input enums:

- `project_type`: `retrofit`, `expansion`, `greenfield`
- `cost_priority`: `constrained`, `balanced`, `investment_ready`
- `uptime_constraint`: `no_outage`, `maintenance_window`, `major_works_allowed`
- `growth_3y`: `stable`, `moderate`, `high`
- `water_view`: `baseline_water_stress`, `default_overall`, `electric_power`,
  `semiconductor`

Water and carbon weights must each be between 0 and 1 and must sum to 1. The
selected water view changes the composite sensitivity score and portfolio rank.
The cooling matrix always uses direct Baseline Water Stress.

## Source and policy safeguards

- Aqueduct source fields retain their original names and returned values.
- WRI `-1` (`Arid and Low Water Use`) is retained and mapped to an explicit
  policy normalisation of 1.0 for critical review.
- WRI `-9999` (`No Data`) blocks every automatic composite view.
- Missing grid factors remain null and block the composite; they never become
  zero.
- Electric Power and Semiconductor scores are labelled as proxy sensitivity
  views because WRI has no Data Center preset.
- PPA is a separate procurement lever and never changes location-based grid
  intensity or location-based CUE.
- Expired cache values are returned only after a source failure and are marked
  `cache.stale=true` with a sanitised fallback reason.
- API credentials are never included in returned or persisted error text.
- Combined portfolio ranking is blocked when scored results use different
  grid-factor providers, bases or units.

`aqueduct_local` and `iea_annual_file` are disabled provider contracts. They
require a pinned Aqueduct GeoPackage and a separately licensed IEA file,
respectively.

## Tests

```bash
PYTHONPATH="$PWD/backend/src" backend/.venv/bin/pytest backend/tests
```

The default suite uses deterministic fixtures and mocked HTTP responses. An
opt-in live Phoenix smoke test is available:

```bash
PYTHONPATH="$PWD/backend/src" RUN_NETWORK_TESTS=1 backend/.venv/bin/pytest backend/tests/test_network_smoke.py
```
