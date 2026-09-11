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

/** Broader remaining geography after exclusions — context, not a Candidate Site. */
const ZONE_RING: Ring = [
  [14.995, 59.026],
  [15.055, 59.018],
  [15.132, 59.022],
  [15.198, 59.038],
  [15.246, 59.062],
  [15.258, 59.108],
  [15.232, 59.138],
  [15.168, 59.148],
  [15.092, 59.146],
  [15.028, 59.136],
  [14.988, 59.108],
  [14.982, 59.068],
];

/**
 * Land-grown investigation footprints.
 * Stepped like dissolved 150 m screening cells — compact, irregular, not parcels or blobs.
 */
const SITE_RINGS: Record<(typeof SAMPLE_CANDIDATE_SITES)[number]["id"], Ring> = {
  "site-a": [
    [15.108, 59.041],
    [15.114, 59.041],
    [15.114, 59.038],
    [15.122, 59.038],
    [15.122, 59.041],
    [15.128, 59.041],
    [15.128, 59.047],
    [15.131, 59.047],
    [15.131, 59.053],
    [15.125, 59.053],
    [15.125, 59.057],
    [15.116, 59.057],
    [15.116, 59.053],
    [15.111, 59.053],
    [15.111, 59.047],
    [15.108, 59.047],
  ],
  "site-b": [
    [15.191, 59.096],
    [15.198, 59.096],
    [15.198, 59.092],
    [15.208, 59.092],
    [15.208, 59.096],
    [15.218, 59.096],
    [15.218, 59.103],
    [15.214, 59.103],
    [15.214, 59.110],
    [15.206, 59.110],
    [15.206, 59.114],
    [15.198, 59.114],
    [15.198, 59.108],
    [15.191, 59.108],
  ],
  "site-c": [
    [15.032, 59.112],
    [15.040, 59.112],
    [15.040, 59.108],
    [15.048, 59.108],
    [15.048, 59.112],
    [15.054, 59.112],
    [15.054, 59.118],
    [15.057, 59.118],
    [15.057, 59.126],
    [15.050, 59.126],
    [15.050, 59.131],
    [15.041, 59.131],
    [15.041, 59.126],
    [15.035, 59.126],
    [15.035, 59.120],
    [15.032, 59.120],
  ],
};

/** Sample Ei local-network covering geography — covering, not capacity. */
const COVERING_RING: Ring = [
  [14.93, 58.978],
  [15.04, 58.968],
  [15.18, 58.976],
  [15.29, 59.012],
  [15.34, 59.068],
  [15.33, 59.128],
  [15.27, 59.178],
  [15.14, 59.198],
  [15.00, 59.176],
  [14.91, 59.118],
  [14.90, 59.042],
];

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

export const SAMPLE_COVERING_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { kind: "ei-covering" },
      geometry: polygon(COVERING_RING),
    },
  ],
};

export const SAMPLE_MAP_RECORDS = [
  {
    id: "opportunity-a",
    kind: "opportunity" as const,
    name: "Opportunity",
    longitude: 15.118,
    latitude: 59.048,
  },
  {
    id: "project-north",
    kind: "project" as const,
    name: "Project",
    longitude: 15.162,
    latitude: 59.078,
  },
] as const;
