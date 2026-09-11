import type { EvidenceCoverageView } from "@/lib/opportunities/evidence-coverage";

/** Sample marketing discovery geography. Not a live screening result. */
export const SAMPLE_SEARCH_BOUNDS = {
  west: 14.96,
  south: 58.99,
  east: 15.28,
  north: 59.16,
} as const;

export const SAMPLE_DISCOVERY_CENTER = {
  longitude: 15.11,
  latitude: 59.065,
} as const;

export const SAMPLE_CANDIDATE_SITES = [
  {
    id: "site-a",
    name: "Candidate Site A",
    rank: 1,
    recommendation: "Priority for further investigation",
    recommendationKey: "prioritise" as const,
    summary: "Compact footprint on evaluated land-cover and protection evidence. Ranking is for investigation, not constructability.",
    municipality: "Örebro County",
    contiguousHa: "9.4",
    covering: "Official local-network covering",
    evidenceSummary: "5 of 8 evidence categories evaluated",
    keyPositive: "No protected-area overlap on the site envelope",
    keyRisk: "Road access is not evaluated",
    longitude: 15.118,
    latitude: 59.048,
  },
  {
    id: "site-b",
    name: "Candidate Site B",
    rank: 2,
    recommendation: "Worth investigating",
    recommendationKey: "investigate" as const,
    summary: "Qualifying geography remains after exclusions. More evidence is missing than on Site A.",
    municipality: "Örebro County",
    contiguousHa: "11.2",
    covering: "Official local-network covering",
    evidenceSummary: "5 of 8 evidence categories evaluated",
    keyPositive: "NMD 2023 land cover evaluated",
    keyRisk: "Detailed terrain is not evaluated",
    longitude: 15.205,
    latitude: 59.102,
  },
  {
    id: "site-c",
    name: "Candidate Site C",
    rank: 3,
    recommendation: "Secondary screening priority",
    recommendationKey: "secondary" as const,
    summary: "Larger remaining area, weaker investigation priority on current evidence.",
    municipality: "Örebro County",
    contiguousHa: "14.8",
    covering: "Official local-network covering",
    evidenceSummary: "4 of 8 evidence categories evaluated",
    keyPositive: "Inside the Search Area",
    keyRisk: "Insufficient evidence on access and detailed terrain",
    longitude: 15.042,
    latitude: 59.118,
  },
] as const;

export const SAMPLE_SELECTED_CANDIDATE = SAMPLE_CANDIDATE_SITES[0];

export const SAMPLE_EVIDENCE_COVERAGE: EvidenceCoverageView = {
  evaluatedCount: 5,
  totalCount: 8,
  summary: "5 of 8 evidence categories evaluated",
  missingLabels: ["Detailed terrain", "Road access", "Residential proximity"],
  items: [
    {
      id: "environmental_protection",
      label: "Environmental protection",
      state: "evaluated",
      summary: "0.0% overlap of site envelope",
      provenance: "official",
      required: true,
      sourceDetail: {
        provider: "Naturvårdsverket",
        dataset: "Naturvårdsregistret protected areas",
        version: null,
        nativeResolution: null,
        processingResolution: null,
        snapshot: null,
      },
    },
    {
      id: "natura_2000",
      label: "Natura 2000",
      state: "evaluated",
      summary: "0.0% overlap of site envelope",
      provenance: "official",
      required: true,
      sourceDetail: {
        provider: "Naturvårdsverket",
        dataset: "Natura 2000",
        version: null,
        nativeResolution: null,
        processingResolution: null,
        snapshot: null,
      },
    },
    {
      id: "land_cover",
      label: "Land cover",
      state: "evaluated",
      summary: "NMD 2023",
      provenance: "official",
      required: true,
      sourceDetail: {
        provider: "Naturvårdsverket",
        dataset: "NMD 2023",
        version: "basskikt v0.3",
        nativeResolution: "10 m",
        processingResolution: "class composition inside the candidate site",
        snapshot: null,
      },
    },
    {
      id: "terrain",
      label: "Terrain",
      state: "evaluated",
      summary: "Copernicus GLO-90 · Coarse terrain evidence",
      provenance: "official",
      required: true,
      sourceDetail: {
        provider: "Copernicus",
        dataset: "Copernicus DEM GLO-90",
        version: null,
        nativeResolution: "90 m",
        processingResolution: "coarser derived slope summaries",
        snapshot: null,
      },
    },
    {
      id: "detailed_terrain",
      label: "Detailed terrain",
      state: "not_evaluated",
      summary: "Not evaluated",
      provenance: null,
      required: false,
      sourceDetail: null,
    },
    {
      id: "network_geography",
      label: "Network geography",
      state: "evaluated",
      summary: "Ei official covering",
      provenance: "official",
      required: true,
      sourceDetail: {
        provider: "Energimarknadsinspektionen",
        dataset: "Ei local-network and NUP covering geography",
        version: null,
        nativeResolution: null,
        processingResolution: null,
        snapshot: null,
      },
    },
    {
      id: "road_access",
      label: "Road access",
      state: "not_evaluated",
      summary: "Not evaluated",
      provenance: null,
      required: false,
      sourceDetail: null,
    },
    {
      id: "residential_proximity",
      label: "Residential proximity",
      state: "not_evaluated",
      summary: "Not evaluated",
      provenance: null,
      required: false,
      sourceDetail: null,
    },
  ],
};

type Ring = [number, number][];

function polygon(ring: Ring) {
  return {
    type: "Polygon" as const,
    coordinates: [[...ring, ring[0]]],
  };
}

const SEARCH_RING: Ring = [
  [SAMPLE_SEARCH_BOUNDS.west, SAMPLE_SEARCH_BOUNDS.south],
  [SAMPLE_SEARCH_BOUNDS.east, SAMPLE_SEARCH_BOUNDS.south],
  [SAMPLE_SEARCH_BOUNDS.east, SAMPLE_SEARCH_BOUNDS.north],
  [SAMPLE_SEARCH_BOUNDS.west, SAMPLE_SEARCH_BOUNDS.north],
];

const ZONE_RING: Ring = [
  [15.00, 59.02],
  [15.24, 59.03],
  [15.25, 59.13],
  [15.02, 59.14],
];

const SITE_RINGS: Record<(typeof SAMPLE_CANDIDATE_SITES)[number]["id"], Ring> = {
  "site-a": [
    [15.108, 59.040],
    [15.128, 59.041],
    [15.129, 59.056],
    [15.107, 59.055],
  ],
  "site-b": [
    [15.194, 59.094],
    [15.216, 59.095],
    [15.217, 59.110],
    [15.193, 59.109],
  ],
  "site-c": [
    [15.031, 59.110],
    [15.055, 59.111],
    [15.054, 59.126],
    [15.030, 59.125],
  ],
};

export const SAMPLE_DISCOVERY_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { id: "zone-1", candidateKind: "zone", recommendation: "", excluded: false },
      geometry: polygon(ZONE_RING),
    },
    ...SAMPLE_CANDIDATE_SITES.map((site) => ({
      type: "Feature" as const,
      properties: {
        id: site.id,
        candidateKind: "site",
        recommendation: site.recommendationKey,
        excluded: false,
      },
      geometry: polygon(SITE_RINGS[site.id]),
    })),
  ],
};

export const SAMPLE_SEARCH_BOUNDARY_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { kind: "search-boundary" },
      geometry: polygon(SEARCH_RING),
    },
  ],
};
