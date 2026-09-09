export type EvidenceProviderStatus = "supported" | "unsupported";

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
 * Unsupported providers must not fabricate evidence. They surface as insufficient evidence.
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
      "Point-in-polygon against ingested Ei local-network and network development plan areas. Covering geography is not a connection point and is not available capacity.",
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
    key: "copernicus-dem-glo90",
    name: "Copernicus DEM GLO-90 derived slope",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "AWS public COG DSM, Copernicus WorldDEM-30 licence (free with attribution). 90 m DSM includes vegetation and buildings — not a DTM and not Lantmäteriet Grid 50+. Slope is Noxheim Derived. Evidence appears only after successful ingest.",
  },
  {
    key: "nv-nmd-2018",
    name: "Naturvårdsverket NMD 2018 basskikt",
    geography: "SE",
    status: "supported",
    dimensions: ["land_suitability"],
    notes:
      "CC0 10 m land-cover raster, ingested as 1 km majority-class polygons. Classes are evaluated against the organisation screening profile, not a universal good/bad ranking. Evidence appears only after successful ingest.",
  },
  {
    key: "trafikverket-inspire-roadlink",
    name: "Trafikverket INSPIRE RoadLink (NVDB)",
    geography: "SE",
    status: "supported",
    dimensions: ["access"],
    notes:
      "Dataset licence CC0. HTTPS WFS can be unstable; ingest records failure rather than substituting OSM (ODbL). Distance is not a heavy-transport access finding.",
  },
  {
    key: "lantmateriet",
    name: "Lantmäteriet",
    geography: "SE",
    status: "unsupported",
    dimensions: ["land_suitability", "access"],
    notes:
      "Grid 50+ DTM is CC0 but Geotorget OAuth is not configured. Building/residential products are blocked pending access and GDPR review.",
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
      "No official reusable bidding-zone geometry is integrated. SE1–SE4 may be stored as intent only.",
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
  return EVIDENCE_PROVIDERS.filter((item) => item.status === "unsupported");
}

export function providerByKey(key: string): EvidenceProvider | null {
  return EVIDENCE_PROVIDERS.find((item) => item.key === key) ?? null;
}
