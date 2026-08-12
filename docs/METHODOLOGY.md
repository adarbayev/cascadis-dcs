# Methodology

## Purpose

Cascadis Data Center Sustainability Scoring (DCSS) is a screening and prioritisation tool. It combines long-term water-risk evidence with a national electricity-carbon proxy, then applies a separate and versioned decision policy. It does not replace climate, hydraulic, electrical, resilience, permitting, or detailed cooling-system engineering.

## Evidence layers

### Water risk

The default provider queries WRI Aqueduct 4.0 data published through Esri's Baseline Annual FeatureServer layer. Source values remain unchanged in the assessment record:

- baseline water stress (`bws_*`);
- Default overall water risk;
- Electric Power physical-quantity and overall risk;
- Semiconductor overall risk.

WRI does not publish a Data Center sector preset. Electric Power and Semiconductor are displayed only as sensitivity views. The primary cooling view uses baseline water stress.

Aqueduct special values follow the WRI 4.0 data dictionary: `-1` means `Arid and Low Water Use` and is escalated for review; `-9999` means `No Data` and blocks automated scoring. The Esri field description currently documents these sentinels differently, so the application validates values against WRI's official convention and the returned label.

### Grid carbon

The MVP uses Ember yearly country-level electricity carbon intensity. It is labelled `Public proxy — Ember` and uses the basis `national lifecycle generation intensity`. It is not presented as an IEA factor, a local grid-zone factor, or a formal Scope 2 reporting factor.

The adapter retains country, ISO3 code, observation year, value, unit, retrieval timestamp, provider, and factor basis. A licensed IEA annual-file adapter can be activated later without changing the assessment contract.

## Location Exposure Score

The active water view is normalised from its WRI score:

```text
water_normalised = selected_water_score / 5
```

For `Arid and Low Water Use`, the policy uses `1.0` and adds a critical-review flag. `No Data` remains null.

Grid carbon is normalised against a configurable policy anchor:

```text
carbon_normalised = min(grid_factor_gCO2e_per_kWh / 800, 1)
```

The Location Exposure Score is:

```text
100 × (
  water_weight × water_normalised +
  carbon_weight × carbon_normalised
)
```

Water and carbon weights must each be between 0 and 1 and sum to 1. Default weights are 0.5 and 0.5. The 800 gCO2e/kWh anchor and the carbon bands are tool-policy values, not external standards.

Baseline water stress, Default, Electric Power, and Semiconductor views are calculated independently. They are never added together, which avoids double-counting water stress already embedded in the aggregated WRI views.

Portfolio scores are ranked only when all scored results use the same grid-factor provider, factor basis, and unit. Mixed Ember and IEA results retain their individual scores, while combined ranking is blocked and flagged for basis-specific review.

The score is an internal, transparent screening index. It is not an industry standard and does not select cooling technology by itself. The cooling matrix keeps baseline water stress as a non-compensatory constraint so a lower-carbon grid cannot offset a high-water condition.

## Google framework alignment

Google publishes a two-tier Water Risk Framework for source-level cooling decisions. It does not publish one reproducible composite combining water, grid carbon, PUE/WUE/CUE, cost, uptime, and growth.

Tier 1, Responsible Use, assesses current and future water scarcity, chronic and acute depletion, and curtailment for the actual freshwater source. A High rating on any one KPI makes the source High risk for new capacity; Google then uses an alternative source such as reclaimed water or an alternative cooling technology such as air cooling.

Tier 2, Composite Risk, follows only after the source passes Tier 1. It considers source-water quantity, discharge, WASH, local sentiment, and regulatory risk and routes medium/high risks to mitigation. Google refreshes the assessment every three to five years.

Google describes Aqueduct and the WWF Water Risk Filter as high-level regional screening tools. Local source allocations, infrastructure, depletion history, curtailment, community access, regulation, and sentiment require separate evidence. Public numeric thresholds are incomplete, so this application cannot reproduce Google's internal rating.

For Google public-location rows, the application therefore:

- retains the Location Exposure Score for comparable regional screening;
- treats High, Extremely High, and Arid Aqueduct results as a provisional local-source diligence gate;
- keeps Ember carbon exposure and business phasing separate from the water gate;
- labels every Aqueduct result as external screening rather than a Google rating.

Reference: [Google Water Risk Framework](https://www.gstatic.com/gumdrop/sustainability/2023-data-center-water-risk-framework-whitepaper.pdf).

## Cooling screening matrix

The baseline water-stress category sets the water constraint. The grid proxy uses three configurable carbon bands: low below 150, moderate from 150 to below 400, and high at or above 400 gCO2e/kWh.

- High, Extremely High, and Arid water conditions prioritise water-minimising heat rejection, closed-loop liquid cooling, and dry systems. Evaporative operation is conditional on a defined water budget.
- Medium-High water stress favours adaptive hybrid or dry-led operation.
- Low water stress with high grid carbon prioritises energy-efficiency measures. Water-assisted options remain conditional on climate and WUE checks.
- Low water stress with low or moderate grid carbon is ranked by resilience, lifecycle cost, and growth fit.

A PPA is a separate energy-procurement lever. It does not change the displayed location-based factor or the location-based CUE calculation.

## Business adaptation

Cost, uptime, and growth change delivery sequencing while the environmental score remains visible:

- no-outage conditions route immediate work to controls, containment, metering, and pilots on redundant capacity;
- constrained cost starts with lower-disruption measures and stages capital work;
- high growth applies the preferred architecture to planned expansion capacity.

Missing IT-load-utilisation evidence creates a validation action. It does not create a confirmed root-cause statement.

## Optional operating calculations

When the required user inputs are present:

```text
proxy CUE (kgCO2e/kWh IT) = PUE × grid factor (kgCO2e/kWh)
annual emissions (tCO2e) = annual IT energy (MWh) × PUE × grid factor (kgCO2e/kWh)
annual water (m3) = annual IT energy (MWh) × WUE (L/kWh)
```

Every calculation inherits the displayed grid-factor basis and remains a screening estimate.

## Completeness and confidence

Missing values are not converted to zero and weights are not silently renormalised. A full score requires both selected water evidence and a grid factor. Partial source results remain visible with a `partial` status. Stale cached results carry their original retrieval time and a visible stale flag.
