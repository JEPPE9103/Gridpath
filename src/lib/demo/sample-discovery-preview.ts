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
    longitude: 15.166,
    latitude: 59.045,
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
  missingLabels: ["Detailed terrain", "Road proximity", "Residential proximity"],
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
      label: "Road proximity",
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

/** Corner-cut a closed ring so marketing footprints read as land, not grid cells. */
function chaikin(ring: Ring, iterations = 2): Ring {
  let points = ring;
  for (let pass = 0; pass < iterations; pass += 1) {
    const next: Ring = [];
    for (let index = 0; index < points.length; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      next.push([start[0] * 0.75 + end[0] * 0.25, start[1] * 0.75 + end[1] * 0.25]);
      next.push([start[0] * 0.25 + end[0] * 0.75, start[1] * 0.25 + end[1] * 0.75]);
    }
    points = next;
  }
  return points;
}

function roundedBounds(
  west: number,
  south: number,
  east: number,
  north: number,
  radius = 0.007,
): Ring {
  const steps = 5;
  const points: Ring = [];
  const arc = (cx: number, cy: number, from: number, to: number) => {
    for (let index = 0; index <= steps; index += 1) {
      const angle = from + ((to - from) * index) / steps;
      points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
    }
  };
  arc(west + radius, south + radius, Math.PI, Math.PI * 1.5);
  arc(east - radius, south + radius, Math.PI * 1.5, Math.PI * 2);
  arc(east - radius, north - radius, 0, Math.PI * 0.5);
  arc(west + radius, north - radius, Math.PI * 0.5, Math.PI);
  return points;
}

const SEARCH_RING = roundedBounds(
  SAMPLE_SEARCH_BOUNDS.west,
  SAMPLE_SEARCH_BOUNDS.south,
  SAMPLE_SEARCH_BOUNDS.east,
  SAMPLE_SEARCH_BOUNDS.north,
);

/** Broader remaining geography after exclusions — context, not a Candidate Site. */
const ZONE_RING = chaikin(
  [
    [14.994, 59.030],
    [15.038, 59.016],
    [15.092, 59.018],
    [15.148, 59.024],
    [15.198, 59.040],
    [15.236, 59.058],
    [15.252, 59.086],
    [15.248, 59.118],
    [15.218, 59.140],
    [15.168, 59.148],
    [15.122, 59.142],
    [15.098, 59.128],
    [15.108, 59.114],
    [15.072, 59.108],
    [15.036, 59.122],
    [14.996, 59.114],
    [14.984, 59.086],
    [14.986, 59.054],
  ],
  1,
);

/**
 * Land-grown investigation footprints: irregular qualifying land, not parcels
 * and not circular blobs. Corners are softened for marketing, not cell stairs.
 */
const SITE_RINGS: Record<(typeof SAMPLE_CANDIDATE_SITES)[number]["id"], Ring> = {
  "site-a": chaikin(
    [
      [15.151, 59.043],
      [15.156, 59.038],
      [15.164, 59.036],
      [15.172, 59.037],
      [15.178, 59.041],
      [15.179, 59.047],
      [15.174, 59.052],
      [15.166, 59.054],
      [15.159, 59.051],
      [15.161, 59.047],
      [15.156, 59.046],
      [15.152, 59.047],
    ],
    1,
  ),
  "site-b": chaikin(
    [
      [15.186, 59.098],
      [15.192, 59.092],
      [15.202, 59.090],
      [15.212, 59.094],
      [15.218, 59.100],
      [15.216, 59.108],
      [15.208, 59.114],
      [15.198, 59.116],
      [15.192, 59.112],
      [15.190, 59.106],
      [15.194, 59.103],
      [15.188, 59.102],
    ],
    1,
  ),
  "site-c": chaikin(
    [
      [15.024, 59.114],
      [15.030, 59.108],
      [15.040, 59.106],
      [15.048, 59.110],
      [15.053, 59.117],
      [15.050, 59.125],
      [15.044, 59.131],
      [15.034, 59.133],
      [15.028, 59.128],
      [15.026, 59.122],
      [15.031, 59.118],
      [15.025, 59.116],
    ],
    1,
  ),
};

/** Sample Ei local-network covering geography — covering, not capacity. */
const COVERING_RING = chaikin(
  [
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
  ],
  2,
);

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
    longitude: 15.166,
    latitude: 59.045,
  },
  {
    id: "project-north",
    kind: "project" as const,
    name: "Project",
    longitude: 15.162,
    latitude: 59.078,
  },
] as const;
