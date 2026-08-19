# Google public-location portfolio

## Scope and count

The versioned seed represents publicly disclosed Google data-center **location units**, checked on 10 August 2026. It contains:

- 59 coordinate-bearing locations submitted to WRI Aqueduct and Ember;
- 30 locations reported as operating;
- 29 locations reported as in development, under construction, or announced;
- 1 additional announced Michigan project retained as unlocated and excluded from scoring.

Google's main location directory produced 59 raw entries. `Ellis County, Texas` is an aggregate label covering Midlothian and Red Oak, so the alias is excluded to avoid duplicate weighting. Morgan County, Indiana is added from Google's official Indiana location page. The unlocated Michigan announcement is not assigned a guessed coordinate.

Google states that one listed location can include more than one physical site. The seed keeps one Aqueduct row per public location. Known multi-facility labels from Google's PUE reporting are retained as metadata for Central Ohio, Council Bluffs, Northern Virginia, Singapore, and The Dalles.

Google Cloud regions, zones, network edge locations, third-party colocation capacity, and confidential parcels are excluded from the location-intelligence seed.

The separate EEMS workspace maps six management archetypes onto selected site workspaces to exercise lifecycle and control-rights workflows. Those working records do not alter the public-location scope or establish the actual ownership, permit, cooling or operating model of a named location. Each record remains awaiting site-owner confirmation.

## Coordinate confidence

| Basis | Confidence | Meaning |
|---|---|---|
| Google-published map point | Medium | A public location marker. It is not a verified campus boundary or street address. |
| OpenStreetMap Nominatim locality centroid | Low | A centroid for Google's published city, county, or region label. It supports regional screening only. |

Broad location labels such as Central Ohio, Northern Virginia, and The Lowcountry can span more than one Aqueduct polygon. Their point result requires stronger local validation.

## Business inputs

The assessment contract requires project type, cost priority, uptime constraint, and three-year growth. Google does not publish a complete set of these inputs per public location.

The seed uses explicit screening scenarios:

- operating location: retrofit, balanced cost, maintenance-window access, moderate growth;
- non-operating location: greenfield, balanced cost, major works allowed, high growth.

These values affect delivery sequencing and do not change the Location Exposure Score. Every seeded assessment carries a warning that the values are tool defaults rather than Google disclosures.

PUE, WUE, IT-load utilisation, annual IT energy, and cooling technology are null. Google's environmental reporting provides site-level PUE and some water data, but reporting units do not map cleanly to every public location record. A future enrichment should preserve reporting period, metric basis, facility mapping, and source footnotes.

## Framework boundary

Google's published Water Risk Framework is source-specific and uses local utility, water-district, monitoring, infrastructure, regulatory, and community evidence. Aqueduct is a regional screen within that broader process.

The dashboard retains its internal Location Exposure Score for sorting comparable source data. High, Extremely High, and Arid Aqueduct results trigger a provisional local-source diligence gate and a water-minimising shortlist. No result is labelled as Google's own water-risk rating.

## Reproducible seed

The controlling manifest is `data/public_portfolios/google_public_data_centers.v1.json`.

```bash
make seed-google-dry-run
make seed-google
```

The command validates the manifest, locks concurrent seed runs, checks all stable site IDs directly in SQLite, and assesses only missing rows through the configured live providers. Existing user assessments remain unchanged.
