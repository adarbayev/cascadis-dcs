declare module "world-atlas/countries-110m.json" {
  const value: unknown;
  export default value;
}

declare module "world-countries" {
  const value: Array<{
    cca3: string;
    ccn3?: string;
    name: { common: string };
  }>;
  export default value;
}
