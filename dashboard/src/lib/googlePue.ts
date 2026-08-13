interface PublishedPue {
  value: number;
  detail: string;
  source_url: string;
}

const SOURCE_URL = "https://datacenters.google/intl/en/efficiency/";

// Latest directly matchable Google campus TTM values. Multi-facility public
// locations use the conservative maximum and disclose that aggregation in `detail`.
// The mapping is intentionally sparse: unmatched locations use the explicit
// fleet fallback configured in the scenario panel.
const ttm = (value: number): PublishedPue => ({
  value,
  detail: "Google 2026 Q1 report · trailing 12 months",
  source_url: SOURCE_URL,
});

const quarterly = (value: number): PublishedPue => ({
  value,
  detail: "Google 2026 Q1 report · quarterly value; TTM unavailable",
  source_url: SOURCE_URL,
});

const aggregate = (value: number, range: string): PublishedPue => ({
  value,
  detail: `Google 2026 Q1 report · conservative maximum across facilities (${range})`,
  source_url: SOURCE_URL,
});

const GOOGLE_PUE_BY_SITE: Record<string, PublishedPue> = {
  "google-dc-usa-central-ohio": aggregate(1.06, "1.04–1.06 TTM"),
  "google-dc-twn-changhua-county-taiwan": ttm(1.13),
  "google-dc-usa-council-bluffs-iowa": aggregate(1.11, "1.08–1.11 TTM"),
  "google-dc-usa-douglas-county-georgia": ttm(1.09),
  "google-dc-irl-dublin-ireland": ttm(1.08),
  "google-dc-nld-eemshaven-netherlands": ttm(1.07),
  "google-dc-dnk-fredericia-denmark": ttm(1.06),
  "google-dc-fin-hamina-finland": ttm(1.10),
  "google-dc-usa-henderson-nevada": ttm(1.09),
  "google-dc-jpn-inzai-japan": ttm(1.10),
  "google-dc-usa-jackson-county-alabama": ttm(1.10),
  "google-dc-usa-lenoir-north-carolina": ttm(1.10),
  "google-dc-usa-mayes-county-oklahoma": ttm(1.11),
  "google-dc-usa-mesa-arizona": quarterly(1.22),
  "google-dc-usa-midlothian-texas": ttm(1.10),
  "google-dc-usa-montgomery-county-tennessee": ttm(1.09),
  "google-dc-usa-northern-virginia": aggregate(1.09, "1.08–1.09 TTM"),
  "google-dc-usa-omaha-nebraska": ttm(1.05),
  "google-dc-usa-papillion-nebraska": ttm(1.09),
  "google-dc-chl-quilicura-chile": ttm(1.08),
  "google-dc-usa-red-oak-texas": quarterly(1.10),
  "google-dc-sgp-singapore": aggregate(1.14, "1.12–1.14 TTM"),
  "google-dc-bel-st-ghislain-belgium": ttm(1.08),
  "google-dc-usa-storey-county-nevada": ttm(1.15),
  "google-dc-usa-the-dalles-oregon": aggregate(1.10, "1.06–1.10 TTM; third facility Q1 1.07"),
  "google-dc-usa-the-lowcountry-south-carolina": ttm(1.09),
  "google-dc-gbr-waltham-cross-united-kingdom": quarterly(1.26),
};

export function googlePueForSite(siteId: string): PublishedPue | null {
  return GOOGLE_PUE_BY_SITE[siteId] ?? null;
}

export const GOOGLE_PUE_SOURCE_URL = SOURCE_URL;
