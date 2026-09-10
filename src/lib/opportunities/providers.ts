export type EvidenceProviderStatus = "supported" | "unsupported" | "blocked";

export type EvidenceProvider = {
  key: string;
  name: string;
  geography: "SE" | "generic";
  status: EvidenceProviderStatus;
  dimensions: string[];
  notes: string;
};

/**
 * Development Intelligence data providers.
 * Unsupported/blocked providers must not fabricate evidence.
 * Recommendation is relative investigation priority from configured criteria and currently
 * supported evidence — not a success score, connection chance, or “best site”.
 */
export const EVIDENCE_PROVIDERS: EvidenceProvider[] = [
  {
    key: "ei-official-covering",
    name: "Energimarknadsinspektionen covering geography",
    geography: "SE",
    status: "supported",
    dimensions: ["grid_context"],
    notes:
      "LOCAL/DISTRIBUTION CONTEXT. Point-in-polygon against ingested Ei local-network and network development plan areas. Covering geography is not a connection point and is not available capacity.",
  },
  {
    key: "nv-protected-areas",
    name: "Naturvårdsverket Naturvårdsregistret protected areas",
    geography: "SE",
    status: "supported",
    dimensions: ["environmental"],
    notes:
      "Official WFS SkyddadeOmraden, CC0. Evidence appears only after successful ingest. Direct overlap with a configured exclusion is a hard fail, not a legal impossibility finding.",
  },
  {
    key: "nv-natura-2000",
    name: "Naturvårdsverket Natura 2000",
    geography: "SE",
    status: "supported",
    dimensions: ["environmental"],
    notes:
      "Official Naturvårdsverket Natura 2000 open geodata (CC0). Production ingest prefers the national shapefile download (SPA_Rikstackande.zip / SCI when published) over WFS. Evidence appears only after successful ingest with feature count > 0. Direct overlap with a configured exclusion is a hard fail, not a legal impossibility finding.",
  },
  {
    key: "nv-nmd-2023",
    name: "Naturvårdsverket NMD 2023 basskikt v0.3",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "Current Swedish land-cover evidence (CC0, native 10 m). NMD2023 basskikt v0.3 is the screening product: fewer thematic classes grouped for water/wetland/forest/agriculture/open/developed. NMD2023 v2.x is a parallel finer-thematic product, not a replacement that makes v0.3 obsolete. Production path: one-time national GeoTIFF outside Git (NOXHEIM_NMD2023_TIF or NOXHEIM_GEODATA_CACHE / ~/noxheim-geodata), then AOI window extract — never redownload the 1.3+ GB archive per search. Discovery processes to 1 km majority class. Detailed screening targets 50 m (capped at 100 m). NMD 2018 is legacy fallback only.",
  },
  {
    key: "nv-nmd-2018",
    name: "Naturvårdsverket NMD 2018 basskikt (legacy fallback)",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "Legacy/fallback only. Must not be labelled as current Swedish land-cover evidence when NMD 2023 is ingested for the geography.",
  },
  {
    key: "copernicus-dem-glo90",
    name: "Copernicus DEM GLO-90 derived slope (discovery / fallback)",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "Coarse discovery terrain. AWS public COG DSM, Copernicus WorldDEM-30 licence. 90 m DSM includes vegetation and buildings — not a DTM. Preferred detailed source is Lantmäteriet 1 m DTM when Geotorget is configured.",
  },
  {
    key: "lantmateriet-dtm-1m",
    name: "Lantmäteriet Markhöjdmodell 1 m DTM",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "Preferred detailed terrain. STAC https://api.lantmateriet.se/stac-hojd/v1. Requires Geotorget credentials (LANTMATERIET_GEOTORGET_USERNAME/PASSWORD or LANTMATERIET_STAC_TOKEN). Candidate-scoped on-demand tiles only — not a nationwide PostGIS ingest. Unconfigured state: AUTH_REQUIRED / FALLBACK_ACTIVE (Copernicus).",
  },
  {
    key: "trafikverket-inspire-roadlink",
    name: "Trafikverket INSPIRE RoadLink (NVDB)",
    geography: "SE",
    status: "supported",
    dimensions: ["access"],
    notes:
      "Dataset licence CC0. Trafikverket WFS has returned HTTP 400 in production proof and is not retried per search. Official bulk geodata is via Lastkajen (operator account). Until a Lastkajen GeoPackage is configured (TRAFIKVERKET_ROADLINK_GPKG), road context stays insufficient evidence and does not block site generation. OSM is not substituted (ODbL).",
  },
  {
    key: "lm-marktacke",
    name: "Lantmäteriet Marktäcke Nedladdning, vektor",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "Complementary topographic land-type vectors via STAC https://api.lantmateriet.se/stac-vektor/v1/collections/marktacke (GeoPackage, avgiftsfri, valuable-dataset terms). Requires Geotorget API access. Not a drop-in replacement for NMD thematic classes. Unconfigured state: AUTH_REQUIRED. Each source is preserved independently.",
  },
  {
    key: "scb-administrative-areas",
    name: "SCB Digitala gränser (county / municipality)",
    geography: "SE",
    status: "supported",
    dimensions: ["grid_context"],
    notes:
      "CC0 cartographic boundaries for naming, municipality filter and county attachment. SCB states they are not suitable for cadastral analysis. Never used to clip usable site geometry.",
  },
  {
    key: "svk-indicative-transmission-2026",
    name: "Svenska kraftnät Official Indicative Transmission Context",
    geography: "SE",
    status: "blocked",
    dimensions: ["grid_context"],
    notes:
      "TRANSMISSION CONTEXT. The 2026 capacity map is interactive only (no documented API; not on data.svk.se). HTML scraping is forbidden. Provider contract is implemented. Display remains unavailable until a production-safe structured source exists. County bands must never be treated as site capacity.",
  },
  {
    key: "grid-infrastructure",
    name: "Electricity infrastructure proximity",
    geography: "SE",
    status: "unsupported",
    dimensions: ["grid_proximity"],
    notes:
      "Blocked pending a clearly documented, commercially reusable dataset. Proximity would not mean available connection capacity.",
  },
  {
    key: "electricity-area-geometry",
    name: "Electricity bidding-area geometry (SE1–SE4)",
    geography: "SE",
    status: "unsupported",
    dimensions: ["grid_context"],
    notes:
      "SvK published GIS files for the 2025 bidding-zone review without a stable machine-readable licence/URL suitable for production ingest. SE1–SE4 remains search intent only. Not fabricated.",
  },
  {
    key: "residential-distance",
    name: "Residential distance",
    geography: "SE",
    status: "unsupported",
    dimensions: ["access"],
    notes:
      "Licence blocked / GDPR. Lantmäteriet buildings require Geotorget access. Not scraped. Dimension stays insufficient evidence.",
  },
];

export function supportedEvidenceProviders(): EvidenceProvider[] {
  return EVIDENCE_PROVIDERS.filter((item) => item.status === "supported");
}

export function unsupportedEvidenceProviders(): EvidenceProvider[] {
  return EVIDENCE_PROVIDERS.filter((item) => item.status !== "supported");
}

export function providerByKey(key: string): EvidenceProvider | null {
  return EVIDENCE_PROVIDERS.find((item) => item.key === key) ?? null;
}
