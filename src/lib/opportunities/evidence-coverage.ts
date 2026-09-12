import { evidenceSourceLabel, type EvidenceSourceValue, type OpportunityConfidenceValue } from "@/lib/opportunities/catalog";
import { opportunityCopyContainsForbiddenTerm } from "@/lib/opportunities/copy";
import {
  LAND_COVER_PROVIDER_PRIORITY,
  NMD_2023_SOURCE_RESOLUTION_M,
  TERRAIN_PROVIDER_PRIORITY,
} from "@/lib/opportunities/precision";
import { NMD_2023_PRODUCT } from "@/lib/opportunities/land-cover";
import { providerByKey } from "@/lib/opportunities/providers";

export const NETWORK_COVERING_NOTE =
  "Official geographic covering. Not an indication of available connection capacity.";

export const REVIEW_FOOTPRINT_EXPLANATION =
  "This screening geometry contains a narrow connection or irregular boundary. Confirm the final development footprint during detailed site assessment.";

export const SUITABLE_FOOTPRINT_EXPLANATION =
  "This screening geometry is compact enough for investigation ranking. It is not a constructability finding.";

export const EMPTY_OPPORTUNITIES_TITLE = "Find your first development opportunity";
export const EMPTY_OPPORTUNITIES_DESCRIPTION =
  "Run a geographic screening to identify Candidate Sites worth investigating.";

export const EMPTY_OVERVIEW_TITLE = "Find your first development opportunity";
export const EMPTY_OVERVIEW_DESCRIPTION =
  "Run a geographic screening to identify Candidate Sites worth investigating. Projects can follow once a site is worth tracking.";

export type EvidenceState = "evaluated" | "not_evaluated" | "insufficient";
export type EvidenceProvenance = EvidenceSourceValue;

export type EvidenceCategoryId =
  | "environmental_protection"
  | "natura_2000"
  | "land_cover"
  | "terrain"
  | "detailed_terrain"
  | "network_geography"
  | "road_access"
  | "residential_proximity";

export type EvidenceSourceDetail = {
  provider: string;
  dataset: string;
  version: string | null;
  nativeResolution: string | null;
  processingResolution: string | null;
  snapshot: string | null;
};

export type EvidenceCoverageItem = {
  id: EvidenceCategoryId;
  label: string;
  state: EvidenceState;
  summary: string;
  provenance: EvidenceProvenance | null;
  sourceDetail: EvidenceSourceDetail | null;
  required: boolean;
};

export type EvidenceCoverageView = {
  evaluatedCount: number;
  totalCount: number;
  summary: string;
  missingLabels: string[];
  items: EvidenceCoverageItem[];
};

export type ScreeningFootprintQuality = {
  code: string | null;
  label: string;
  explanation: string | null;
};

const CATEGORY_LABELS: Record<EvidenceCategoryId, string> = {
  environmental_protection: "Environmental protection",
  natura_2000: "Natura 2000",
  land_cover: "Land cover",
  terrain: "Terrain",
  detailed_terrain: "Detailed terrain",
  network_geography: "Network geography",
  road_access: "Road access",
  residential_proximity: "Residential proximity",
};

const PROVIDER_LABELS: Record<string, string> = {
  "nv-protected-areas": "Naturvårdsverket",
  "nv-natura-2000": "Naturvårdsverket",
  "nv-nmd-2023": "Naturvårdsverket",
  "nv-nmd-2018": "Naturvårdsverket",
  "copernicus-dem-glo90": "Copernicus",
  "lantmateriet-dtm-1m": "Lantmäteriet",
  "ei-official-covering": "Energimarknadsinspektionen",
  "trafikverket-inspire-roadlink": "Trafikverket",
  terrain: "Copernicus",
  "land-cover": "Naturvårdsverket",
};

export function screeningFootprintQuality(quality: string | null, reason: string | null): ScreeningFootprintQuality {
  if (quality === "review") {
    return {
      code: quality,
      label: "Review footprint",
      explanation: reason?.trim() || REVIEW_FOOTPRINT_EXPLANATION,
    };
  }
  if (quality === "pass") {
    return {
      code: quality,
      label: "Suitable for screening",
      explanation: reason?.trim() || SUITABLE_FOOTPRINT_EXPLANATION,
    };
  }
  return { code: quality, label: "Not assessed", explanation: null };
}

export function provenanceCustomerLabel(value: EvidenceProvenance | null): string | null {
  if (!value) return null;
  return evidenceSourceLabel(value);
}

export function networkCoveringCopy(input: {
  localName: string | null;
  nupName: string | null;
  queried: boolean;
}): { title: string; detail: string; note: string } {
  const names = [input.localName, input.nupName].filter(Boolean).join(" · ");
  if (names) {
    return {
      title: names,
      detail: "Official geographic covering",
      note: NETWORK_COVERING_NOTE,
    };
  }
  if (input.queried) {
    return {
      title: "No Ei polygon at this centroid",
      detail: "Official covering queried",
      note: NETWORK_COVERING_NOTE,
    };
  }
  return {
    title: "Not evaluated",
    detail: "Official covering geography was not evaluated for this candidate.",
    note: NETWORK_COVERING_NOTE,
  };
}

function sourceDetail(input: {
  providerKey: string | null;
  dataset: string;
  version?: string | null;
  nativeResolution?: string | null;
  processingResolution?: string | null;
  snapshot?: string | null;
}): EvidenceSourceDetail {
  const provider = PROVIDER_LABELS[input.providerKey ?? ""] ?? providerByKey(input.providerKey ?? "")?.name ?? "Official source";
  return {
    provider,
    dataset: input.dataset,
    version: input.version ?? null,
    nativeResolution: input.nativeResolution ?? null,
    processingResolution: input.processingResolution ?? null,
    snapshot: input.snapshot ?? null,
  };
}

function item(input: {
  id: EvidenceCategoryId;
  state: EvidenceState;
  summary: string;
  provenance: EvidenceProvenance | null;
  sourceDetail: EvidenceSourceDetail | null;
  required?: boolean;
}): EvidenceCoverageItem {
  return {
    id: input.id,
    label: CATEGORY_LABELS[input.id],
    state: input.state,
    summary: input.summary,
    provenance: input.provenance,
    sourceDetail: input.sourceDetail,
    required: input.required === true,
  };
}

export type CandidateEvidenceInput = {
  protectedQueried: boolean;
  protectedOverlapPct: number | null;
  naturaQueried: boolean;
  naturaOverlapPct: number | null;
  landCoverQueried: boolean;
  landCover: Record<string, number>;
  landCoverProviderKey: string | null;
  landCoverResolution: string | null;
  terrainQueried: boolean;
  meanSlopeDeg: number | null;
  terrainProviderKey: string | null;
  terrainResolution: string | null;
  coveringQueried: boolean;
  localCoveringName: string | null;
  nupCoveringName: string | null;
  roadQueried: boolean;
  roadDistanceM: number | null;
  roadClass: string | null;
  providerAvailability?: Record<string, boolean>;
  sourceVersions?: Record<string, string | null>;
};

export function candidateToEvidenceInput(
  candidate: {
    protectedQueried?: boolean;
    protectedOverlapPct: number | null;
    naturaQueried?: boolean;
    naturaOverlapPct: number | null;
    landCoverQueried?: boolean;
    landCover: Record<string, number>;
    landCoverProviderKey: string | null;
    landCoverResolution: string | null;
    terrainQueried?: boolean;
    meanSlopeDeg: number | null;
    pctBelowSlope?: number | null;
    terrainProviderKey: string | null;
    terrainResolution: string | null;
    coveringQueried: boolean;
    localCoveringName: string | null;
    nupCoveringName: string | null;
    roadQueried?: boolean;
    roadDistanceM: number | null;
    roadClass: string | null;
  },
  extras?: {
    providerAvailability?: Record<string, boolean>;
    sourceVersions?: Record<string, string | null>;
  },
): CandidateEvidenceInput {
  return {
    protectedQueried: candidate.protectedQueried === true || candidate.protectedOverlapPct != null,
    protectedOverlapPct: candidate.protectedOverlapPct,
    naturaQueried: candidate.naturaQueried === true || candidate.naturaOverlapPct != null,
    naturaOverlapPct: candidate.naturaOverlapPct,
    landCoverQueried: candidate.landCoverQueried === true || Object.keys(candidate.landCover).length > 0,
    landCover: candidate.landCover,
    landCoverProviderKey: candidate.landCoverProviderKey,
    landCoverResolution: candidate.landCoverResolution,
    terrainQueried:
      candidate.terrainQueried === true || candidate.meanSlopeDeg != null || candidate.pctBelowSlope != null,
    meanSlopeDeg: candidate.meanSlopeDeg,
    terrainProviderKey: candidate.terrainProviderKey,
    terrainResolution: candidate.terrainResolution,
    coveringQueried: candidate.coveringQueried,
    localCoveringName: candidate.localCoveringName,
    nupCoveringName: candidate.nupCoveringName,
    roadQueried: candidate.roadQueried === true || candidate.roadDistanceM != null,
    roadDistanceM: candidate.roadDistanceM,
    roadClass: candidate.roadClass,
    providerAvailability: extras?.providerAvailability,
    sourceVersions: extras?.sourceVersions,
  };
}

function optionalUnavailable(availability: Record<string, boolean> | undefined, keys: string[]): boolean {
  if (!availability) return false;
  return keys.some((key) => availability[key] === false);
}

export function buildEvidenceCoverage(input: CandidateEvidenceInput): EvidenceCoverageView {
  const availability = input.providerAvailability ?? {};
  const versions = input.sourceVersions ?? {};
  const landProvider = input.landCoverProviderKey ?? (availability["nv-nmd-2023"] ? "nv-nmd-2023" : availability["nv-nmd-2018"] ? "nv-nmd-2018" : null);
  const terrainProvider = input.terrainProviderKey ?? (availability["copernicus-dem-glo90"] || availability.terrain ? TERRAIN_PROVIDER_PRIORITY.discoveryFallback : null);
  const detailedTerrain =
    input.terrainResolution === "detailed" || terrainProvider === TERRAIN_PROVIDER_PRIORITY.detailed;

  const items: EvidenceCoverageItem[] = [
    item({
      id: "environmental_protection",
      state: input.protectedQueried ? "evaluated" : optionalUnavailable(availability, ["nv-protected-areas"]) ? "not_evaluated" : "not_evaluated",
      summary: input.protectedQueried
        ? input.protectedOverlapPct != null
          ? `${input.protectedOverlapPct.toFixed(1)}% overlap of site envelope`
          : "Evaluated"
        : "Not evaluated",
      provenance: input.protectedQueried ? "official" : null,
      sourceDetail: input.protectedQueried
        ? sourceDetail({
            providerKey: "nv-protected-areas",
            dataset: "Naturvårdsregistret protected areas",
            snapshot: versions["nv-protected-areas"] ?? null,
          })
        : null,
      required: true,
    }),
    item({
      id: "natura_2000",
      state: input.naturaQueried ? "evaluated" : "not_evaluated",
      summary: input.naturaQueried
        ? input.naturaOverlapPct != null
          ? `${input.naturaOverlapPct.toFixed(1)}% overlap of site envelope`
          : "Evaluated"
        : "Not evaluated",
      provenance: input.naturaQueried ? "official" : null,
      sourceDetail: input.naturaQueried
        ? sourceDetail({
            providerKey: "nv-natura-2000",
            dataset: "Natura 2000",
            snapshot: versions["nv-natura-2000"] ?? null,
          })
        : null,
      required: true,
    }),
    item({
      id: "land_cover",
      state: input.landCoverQueried ? "evaluated" : "not_evaluated",
      summary: input.landCoverQueried
        ? landProvider === LAND_COVER_PROVIDER_PRIORITY.current
          ? "NMD 2023"
          : landProvider === LAND_COVER_PROVIDER_PRIORITY.legacyFallback
            ? "NMD 2018 (legacy fallback)"
            : "Evaluated"
        : "Not evaluated",
      provenance: input.landCoverQueried ? "official" : null,
      sourceDetail: input.landCoverQueried
        ? sourceDetail({
            providerKey: landProvider,
            dataset: landProvider === LAND_COVER_PROVIDER_PRIORITY.legacyFallback ? "NMD 2018 basskikt" : NMD_2023_PRODUCT,
            version: landProvider === LAND_COVER_PROVIDER_PRIORITY.current ? "basskikt v0.3" : null,
            nativeResolution: landProvider === LAND_COVER_PROVIDER_PRIORITY.current ? `${NMD_2023_SOURCE_RESOLUTION_M} m` : null,
            processingResolution:
              input.landCoverResolution === "detailed"
                ? "class composition inside the candidate site"
                : "coarser derived units",
            snapshot: versions[landProvider ?? "nv-nmd-2023"] ?? null,
          })
        : null,
      required: true,
    }),
    item({
      id: "terrain",
      state: input.terrainQueried ? "evaluated" : "not_evaluated",
      summary: input.terrainQueried
        ? detailedTerrain
          ? "Lantmäteriet 1 m DTM"
          : "Copernicus GLO-90 · Coarse terrain evidence"
        : "Not evaluated",
      provenance: input.terrainQueried ? "official" : null,
      sourceDetail: input.terrainQueried
        ? sourceDetail({
            providerKey: terrainProvider,
            dataset: detailedTerrain ? "Markhöjdmodell 1 m DTM" : "Copernicus DEM GLO-90",
            nativeResolution: detailedTerrain ? "1 m" : "90 m",
            processingResolution: detailedTerrain ? "candidate-scoped tiles" : "coarser derived slope summaries",
            snapshot: versions[terrainProvider ?? "copernicus-dem-glo90"] ?? versions.terrain ?? null,
          })
        : null,
      required: true,
    }),
    item({
      id: "detailed_terrain",
      state: detailedTerrain ? "evaluated" : "not_evaluated",
      summary: detailedTerrain ? "Lantmäteriet 1 m DTM" : "Not evaluated",
      provenance: detailedTerrain ? "official" : null,
      sourceDetail: detailedTerrain
        ? sourceDetail({
            providerKey: TERRAIN_PROVIDER_PRIORITY.detailed,
            dataset: "Markhöjdmodell 1 m DTM",
            nativeResolution: "1 m",
            processingResolution: "candidate-scoped tiles",
          })
        : null,
    }),
    item({
      id: "network_geography",
      state: input.coveringQueried ? "evaluated" : "not_evaluated",
      summary: input.coveringQueried
        ? input.localCoveringName || input.nupCoveringName
          ? "Ei official covering"
          : "Queried — no covering polygon at centroid"
        : "Not evaluated",
      provenance: input.coveringQueried ? "official" : null,
      sourceDetail: input.coveringQueried
        ? sourceDetail({
            providerKey: "ei-official-covering",
            dataset: "Ei local-network and NUP covering geography",
            snapshot: versions["ei-official-covering"] ?? null,
          })
        : null,
      required: true,
    }),
    item({
      id: "road_access",
      state: input.roadQueried ? "evaluated" : "not_evaluated",
      summary: input.roadQueried
        ? input.roadDistanceM != null
          ? `${Math.round(input.roadDistanceM)} m${input.roadClass ? ` (${input.roadClass})` : ""}`
          : "Evaluated"
        : "Not evaluated",
      provenance: input.roadQueried ? "official" : null,
      sourceDetail: input.roadQueried
        ? sourceDetail({
            providerKey: "trafikverket-inspire-roadlink",
            dataset: "INSPIRE RoadLink (NVDB)",
          })
        : null,
    }),
    item({
      id: "residential_proximity",
      state: "not_evaluated",
      summary: "Not evaluated",
      provenance: null,
      sourceDetail: null,
    }),
  ];

  const evaluatedCount = items.filter((entry) => entry.state === "evaluated").length;
  const missingLabels = items.filter((entry) => entry.state !== "evaluated").map((entry) => entry.label);
  return {
    evaluatedCount,
    totalCount: items.length,
    summary: `${evaluatedCount} of ${items.length} evidence categories evaluated`,
    missingLabels,
    items,
  };
}

export function buildEvidenceCoverageFromAssessments(input: {
  assessments: Array<{ dimension: string; completeness: string; sourceKind: string; explanation: string }>;
  coveringName?: string | null;
}): EvidenceCoverageView {
  const byKey = new Map(input.assessments.map((row) => [row.dimension, row]));
  const environmental = byKey.get("environmental");
  const land = byKey.get("land_suitability");
  const access = byKey.get("access");
  const grid = byKey.get("grid_context");
  const envAvailable = environmental?.completeness === "available";
  const landAvailable = land?.completeness === "available";
  const accessAvailable = access?.completeness === "available";
  const gridAvailable = grid?.completeness === "available";
  const mentionsNatura = /natura/i.test(environmental?.explanation ?? "");
  const mentionsProtected = /protected/i.test(environmental?.explanation ?? "");
  const mentionsDetailed = /1 m|lantmäteriet|lantmateriet/i.test(land?.explanation ?? "");

  return buildEvidenceCoverage({
    protectedQueried: envAvailable && (mentionsProtected || !mentionsNatura || envAvailable),
    protectedOverlapPct: null,
    naturaQueried: envAvailable && (mentionsNatura || envAvailable),
    naturaOverlapPct: null,
    landCoverQueried: landAvailable,
    landCover: landAvailable ? { open: 1 } : {},
    landCoverProviderKey: landAvailable ? LAND_COVER_PROVIDER_PRIORITY.current : null,
    landCoverResolution: landAvailable ? "coarse" : null,
    terrainQueried: landAvailable,
    meanSlopeDeg: landAvailable ? 0 : null,
    terrainProviderKey: landAvailable ? TERRAIN_PROVIDER_PRIORITY.discoveryFallback : null,
    terrainResolution: mentionsDetailed ? "detailed" : landAvailable ? "coarse" : null,
    coveringQueried: gridAvailable,
    localCoveringName: input.coveringName ?? null,
    nupCoveringName: null,
    roadQueried: accessAvailable,
    roadDistanceM: null,
    roadClass: null,
  });
}

export function whyCandidateRanks(candidate: {
  targetFitLabel: string | null;
  targetFitScore: number | null;
  landCover: Record<string, number>;
  meanSlopeDeg: number | null;
  pctBelowSlope: number | null;
  protectedOverlapPct: number | null;
  naturaOverlapPct: number | null;
  protectedQueried?: boolean;
  naturaQueried?: boolean;
  roadQueried?: boolean;
  roadDistanceM?: number | null;
  maxRoadDistanceM?: number | null;
  keyPositive: string | null;
}): string[] {
  const reasons: string[] = [];
  const fit = (candidate.targetFitLabel ?? "").toLowerCase();
  if (fit.includes("strong") || fit.includes("close") || fit.includes("on target") || (candidate.targetFitScore != null && candidate.targetFitScore >= 0.7)) {
    reasons.push("Strong target-area fit");
  } else if (fit.length > 0) {
    reasons.push(candidate.targetFitLabel as string);
  }
  const openShare = Number(candidate.landCover.open ?? 0);
  if (openShare >= 40) {
    reasons.push("Open land cover");
  }
  if (
    (candidate.meanSlopeDeg != null && candidate.meanSlopeDeg <= 4) ||
    (candidate.pctBelowSlope != null && candidate.pctBelowSlope >= 80)
  ) {
    reasons.push("Low observed slope");
  }
  if (
    candidate.roadQueried === true &&
    candidate.roadDistanceM != null &&
    candidate.maxRoadDistanceM != null &&
    candidate.roadDistanceM <= candidate.maxRoadDistanceM
  ) {
    reasons.push("Official road proximity within screening preference");
  }
  const protectedEvaluated = candidate.protectedQueried === true || candidate.protectedOverlapPct != null;
  const naturaEvaluated = candidate.naturaQueried === true || candidate.naturaOverlapPct != null;
  if (
    protectedEvaluated &&
    naturaEvaluated &&
    (candidate.protectedOverlapPct ?? 0) < 1 &&
    (candidate.naturaOverlapPct ?? 0) < 1
  ) {
    reasons.push("No overlap with evaluated protected/Natura areas");
  }
  if (reasons.length === 0 && candidate.keyPositive) {
    reasons.push(candidate.keyPositive);
  }
  return reasons.slice(0, 5);
}

export function recommendationConfidenceCaption(
  confidence: OpportunityConfidenceValue,
  coverage: EvidenceCoverageView,
): string {
  const missing = coverage.missingLabels.length > 0 ? ` Missing: ${coverage.missingLabels.join(", ")}.` : "";
  if (confidence === "high") {
    return `Strong on the evidence that was evaluated. This does not mean every development question is resolved.${missing}`;
  }
  if (confidence === "medium") {
    return `Moderate — ranking uses evaluated official evidence, not a complete development picture.${missing}`;
  }
  if (confidence === "low") {
    return `Limited evidence coverage.${missing}`;
  }
  return `Evidence coverage is unknown.${missing}`;
}

export function assertEvidenceCopySafe(text: string): void {
  const forbidden = opportunityCopyContainsForbiddenTerm(text);
  if (forbidden) {
    throw new Error(`Evidence copy contains forbidden term: ${forbidden}`);
  }
}

export function runSourceNotes(availability: Record<string, boolean>): Array<{ key: string; label: string; available: boolean }> {
  const labels: Record<string, string> = {
    "nv-protected-areas": "Environmental protection",
    "nv-natura-2000": "Natura 2000",
    "nv-nmd-2023": "Land cover (NMD 2023)",
    "nv-nmd-2018": "Land cover (NMD 2018 fallback)",
    "ei-official-covering": "Network geography",
    terrain: "Terrain",
    "copernicus-dem-glo90": "Terrain (Copernicus GLO-90)",
    "lantmateriet-dtm-1m": "Detailed terrain",
    "trafikverket-inspire-roadlink": "Road access",
    "land-cover": "Land cover",
    "grid-infrastructure": "Electricity infrastructure proximity",
    residential: "Residential proximity",
  };
  return Object.entries(availability).map(([key, available]) => ({
    key,
    label: labels[key] ?? key,
    available,
  }));
}
