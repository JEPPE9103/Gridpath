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
    key: "lantmateriet",
    name: "Lantmäteriet",
    geography: "SE",
    status: "unsupported",
    dimensions: ["land_suitability", "access"],
    notes: "Not integrated. Parcel and terrain products are not ingested in this release.",
  },
  {
    key: "slope",
    name: "Terrain slope",
    geography: "generic",
    status: "unsupported",
    dimensions: ["land_suitability"],
    notes:
      "Not integrated. Lantmäteriet Grid 50+ is CC0 but requires Geotorget access and a nationwide raster pipeline. Configured maximum slope is stored but not evaluated.",
  },
  {
    key: "land-cover",
    name: "Swedish land cover",
    geography: "SE",
    status: "unsupported",
    dimensions: ["land_suitability"],
    notes: "Not integrated. Land-cover class is not inferred.",
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
    key: "transport-roads",
    name: "Transport / road access",
    geography: "generic",
    status: "unsupported",
    dimensions: ["access"],
    notes: "Not integrated.",
  },
  {
    key: "residential-distance",
    name: "Residential distance",
    geography: "generic",
    status: "unsupported",
    dimensions: ["access"],
    notes: "Not integrated. Configured minimum distance is stored but not evaluated.",
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
