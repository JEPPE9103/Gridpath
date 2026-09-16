/**
 * Coverage-aware municipal planning source registry.
 *
 * Swedish detailed-plan data is NOT uniformly available nationwide as open
 * machine-readable geometry. NOXHEIM resolves Search Area → municipality →
 * provider. Unsupported municipalities must surface as UNAVAILABLE / UNKNOWN,
 * never as "no plan" or PASS.
 */
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export type PlanningProviderStatus = "supported" | "unavailable";

export type MunicipalPlanningProvider = {
  key: string;
  municipalityCode: string;
  municipalityName: string;
  status: PlanningProviderStatus;
  sourceSlug: string;
  publisher: string;
  notes: string;
  /** Approximate WGS84 extent used only for provider resolution (not cadastral). */
  bbox: SearchBbox;
  endpoint?: string;
  licenceNote?: string;
};

export const MALMO_PLANNING_PROVIDER_KEY = "malmo-gallande-detaljplaner";
export const MALMO_PLANNING_SOURCE_SLUG = "malmo-gallande-detaljplaner";
/** @deprecated alias — prefer MALMO_PLANNING_PROVIDER_KEY */
export const PLANNING_PROVIDER_KEY_MALMO = MALMO_PLANNING_PROVIDER_KEY;

export const MALMO_GALLANDE_QUERY_ENDPOINT =
  "https://gis.malmo.se/arcgis/rest/services/SEPlan/Gallande_planer/MapServer/1/query";
/** @deprecated alias */
export const MALMO_PLANNING_ENDPOINT = MALMO_GALLANDE_QUERY_ENDPOINT;

export const MUNICIPAL_PLANNING_PROVIDERS: MunicipalPlanningProvider[] = [
  {
    key: MALMO_PLANNING_PROVIDER_KEY,
    municipalityCode: "1280",
    municipalityName: "Malmö",
    status: "supported",
    sourceSlug: MALMO_PLANNING_SOURCE_SLUG,
    publisher: "Malmö stad · Stadsbyggnadskontoret (SBK)",
    licenceNote: "Official municipal GIS service (SBK). Preserve attribution.",
    notes:
      "Official machine-readable gällande detaljplan polygons via ArcGIS REST GeoJSON. Coverage is Malmö municipality only — not Sweden-wide.",
    bbox: { west: 12.85, south: 55.48, east: 13.18, north: 55.72 },
    endpoint: MALMO_GALLANDE_QUERY_ENDPOINT,
  },
  {
    key: "goteborg-detaljplan",
    municipalityCode: "1480",
    municipalityName: "Göteborg",
    status: "unavailable",
    sourceSlug: "goteborg-detaljplan",
    publisher: "Göteborgs Stad",
    notes:
      "No public machine-readable detaljplan API found for product use. geodata.sbk.goteborg.se GeoServer is login-walled (staden-konto). Interactive map only — not scraped.",
    bbox: { west: 11.7, south: 57.6, east: 12.2, north: 57.85 },
  },
  {
    key: "orebro-detaljplan",
    municipalityCode: "1880",
    municipalityName: "Örebro",
    status: "unavailable",
    sourceSlug: "orebro-detaljplan",
    publisher: "Örebro kommun",
    notes:
      "Gällande detaljplaner are published via interactive municipal map (karta.orebro.se / mycarta) without a documented public FeatureServer/WFS suitable for product ingest. Not scraped.",
    bbox: { west: 14.95, south: 59.15, east: 15.35, north: 59.4 },
  },
];

export function bboxIntersects(a: SearchBbox, b: SearchBbox): boolean {
  return a.west < b.east && a.east > b.west && a.south < b.north && a.north > b.south;
}

export function planningProviderByKey(key: string): MunicipalPlanningProvider | null {
  return MUNICIPAL_PLANNING_PROVIDERS.find((item) => item.key === key) ?? null;
}

export function supportedPlanningProviders(): MunicipalPlanningProvider[] {
  return MUNICIPAL_PLANNING_PROVIDERS.filter((item) => item.status === "supported");
}

export function planningProvidersForBbox(bbox: SearchBbox): MunicipalPlanningProvider[] {
  return MUNICIPAL_PLANNING_PROVIDERS.filter((item) => bboxIntersects(bbox, item.bbox));
}

export function supportedPlanningProvidersForBbox(bbox: SearchBbox): MunicipalPlanningProvider[] {
  return planningProvidersForBbox(bbox).filter((item) => item.status === "supported");
}

export function unavailablePlanningProvidersForBbox(bbox: SearchBbox): MunicipalPlanningProvider[] {
  return planningProvidersForBbox(bbox).filter((item) => item.status === "unavailable");
}
