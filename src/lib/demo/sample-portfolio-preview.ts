import type { Outlook } from "@/types";

/** Sample marketing metrics. Not live portfolio totals. */
export const SAMPLE_PORTFOLIO_METRICS = {
  sites: 10,
  megawatts: 370,
  requiringAttention: 2,
};

export const SAMPLE_SELECTED_PROJECT = {
  id: "stockholm-north-bess",
  name: "Stockholm North BESS",
  location: "Stockholm",
  technology: "Battery Storage",
  mw: "40 / 40 MW",
  stage: "Grid Study",
  readinessComplete: 4,
  readinessRequired: 8,
  localNetwork: "Ellevio AB",
  source: "Ei",
  nup: "Matched",
  retrieved: "12 Aug 2026",
};

/** Sample marketing preview sites. Not the authenticated demo workspace. */
export const SAMPLE_PORTFOLIO_PREVIEW_SITES: Array<{
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  outlook: Outlook;
}> = [
  { id: "stockholm-north-bess", name: "Stockholm North BESS", latitude: 59.3293, longitude: 18.0686, outlook: "At Risk" },
  { id: "uppsala-storage", name: "Uppsala Storage", latitude: 59.8586, longitude: 17.6389, outlook: "Favourable" },
  { id: "vasteras-bess", name: "Västerås BESS", latitude: 59.6099, longitude: 16.5448, outlook: "Possible" },
  { id: "orebro-storage", name: "Örebro Storage", latitude: 59.2753, longitude: 15.2134, outlook: "Unknown" },
  { id: "gavle-bess", name: "Gävle BESS", latitude: 60.6749, longitude: 17.1413, outlook: "Possible" },
  { id: "norrkoping-bess", name: "Norrköping BESS", latitude: 58.5877, longitude: 16.1924, outlook: "At Risk" },
  { id: "linkoping-storage", name: "Linköping Storage", latitude: 58.4108, longitude: 15.6214, outlook: "Favourable" },
  { id: "jonkoping-bess", name: "Jönköping BESS", latitude: 57.7826, longitude: 14.1618, outlook: "Possible" },
  { id: "goteborg-west-bess", name: "Göteborg West BESS", latitude: 57.7089, longitude: 11.9746, outlook: "Favourable" },
  { id: "malmo-south-storage", name: "Malmö South Storage", latitude: 55.605, longitude: 13.0038, outlook: "Possible" },
];
