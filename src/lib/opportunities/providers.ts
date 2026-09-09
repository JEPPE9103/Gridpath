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
      "Official WFS N2000, CC0. Evidence appears only after successful ingest. Direct overlap with a configured exclusion is a hard fail, not a legal impossibility finding.",
  },
  {
    key: "nv-nmd-2023",
    name: "Naturvårdsverket NMD 2023 basskikt v0.3",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "Current Swedish land-cover evidence (CC0, 10 m). Discovery uses 1 km majority class. Detailed screening uses class composition inside Candidate Area geometry from 100 m precision summaries when ingested. Mapping version nmd-group-v2. NMD 2018 is legacy fallback only.",
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
      "Dataset licence CC0. Scheduled bbox ingest of INSPIRE RoadLink is the production path (retries on WFS ExceptionReport). Lastkajen GeoPackage is the preferred bulk alternative when an operator has an account, but is not auto-wired (TRAFIKVERKET_ROADLINK_GPKG is reserved). OSM is not substituted (ODbL). Distance is not a heavy-transport access finding.",
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
