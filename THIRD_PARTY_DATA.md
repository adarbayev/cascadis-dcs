# Third-party data and attribution

## WRI Aqueduct 4.0

- Source: [WRI Aqueduct](https://www.wri.org/aqueduct), accessed 9 August 2026.
- Data dictionary: [Aqueduct 4.0 Water Risk Atlas](https://github.com/wri/Aqueduct40/blob/master/data_dictionary_water-risk-atlas.md).
- Live MVP delivery: [Esri Aqueduct Water Risk FeatureServer](https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/aqueduct_water_risk/FeatureServer/1).
- Licence: CC BY 4.0. The application's policy weights and recommendations are derived by this project and do not imply endorsement by WRI or Esri.

## Ember yearly electricity data

- Source: [Ember API](https://api.ember-energy.org/v1/docs).
- Dataset methodology: [Ember Yearly Electricity Data](https://ember-energy.org/data/yearly-electricity-data/).
- Licence: CC BY 4.0, with Ember attribution required.
- Application label: `Public proxy — Ember`.

Ember values are national lifecycle generation-intensity proxies. They are kept distinct from IEA annual emissions factors and from formal Scope 2 inventory factors.

## IEA emissions factors

- Product information: [IEA Emissions Factors](https://www.iea.org/data-and-statistics/data-product/emissions-factors-2025).
- Terms: [IEA Terms of Use for Non-CC Material](https://www.iea.org/terms/terms-of-use-for-non-cc-material).

No IEA source values are distributed with this repository. The disabled adapter requires a separately licensed file and appropriate rights for the intended audience.

## Country boundaries

The dashboard uses the `world-atlas` package, derived from [Natural Earth](https://www.naturalearthdata.com/), for simplified country geometry. Natural Earth data is in the public domain. Geometry supports visual context only and is not used to resolve or score a site.

## Google public data-center locations

- Primary directory: [Google Data Center Locations](https://www.datacenters.google/locations/), checked 10 August 2026.
- Cooling methodology reference: [Google Water Risk Framework](https://www.gstatic.com/gumdrop/sustainability/2023-data-center-water-risk-framework-whitepaper.pdf).
- Application label: `Google public location`; no row is represented as a confidential facility inventory or exact parcel.

Official Google announcements are retained per row where they provide a more specific development phase. Google source names and statuses are used for identification and provenance. Aqueduct and Ember outputs, tool scenario defaults, and Location Exposure Scores are independently derived and do not imply Google endorsement.

## Google operating-metric proxies

- PUE source: [Google Data Centers efficiency — 2026 Q1 report](https://datacenters.google/intl/en/efficiency/).
- WUE source: [Measuring the environmental impact of delivering AI at Google Scale](https://services.google.com/fh/files/misc/measuring_the_environmental_impact_of_delivering_ai_at_google_scale.pdf).

The dashboard matches current PUE records to public locations only where the facility identity is sufficiently clear. Multi-facility locations use the disclosed maximum and retain the facility range in the evidence detail. Unmatched Google rows use the published 2025 fleet PUE of 1.09 as an editable fleet proxy.

Google does not publish a site-level WUE table covering the portfolio. The editable 1.15 L/kWh default is the 2024 ISO WUE Category 2 consumptive-use value reported for Google data centers supporting LLM models. The application labels the value as a fleet proxy and never as a site observation. CUE is independently derived from effective PUE and Ember's national location-based proxy; it is not a Google-reported CUE.

## OpenStreetMap Nominatim coordinate proxies

- Service: [Nominatim](https://nominatim.openstreetmap.org/).
- Data attribution: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

Nominatim was used once to resolve Google-published locality labels to approximate centroids. Stored centroids are labelled low confidence and are not treated as campus addresses or boundaries.
