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
    key: "lantmateriet",
    name: "Lantmäteriet",
    geography: "SE",
    status: "unsupported",
    dimensions: ["land_suitability", "access"],
    notes: "Not integrated.",
  },
  {
    key: "naturvardsverket",
    name: "Naturvårdsverket protected areas",
    geography: "SE",
    status: "unsupported",
    dimensions: ["environmental"],
    notes: "Not integrated. Configured exclusion rules are stored but not evaluated.",
  },
  {
    key: "natura-2000",
    name: "Natura 2000",
    geography: "SE",
    status: "unsupported",
    dimensions: ["environmental"],
    notes: "Not integrated. Configured exclusion rules are stored but not evaluated.",
  },
  {
    key: "slope",
    name: "Terrain slope",
    geography: "generic",
    status: "unsupported",
    dimensions: ["land_suitability"],
    notes: "Not integrated. Configured maximum slope is stored but not evaluated.",
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
