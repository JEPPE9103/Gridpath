import {
  ASSESSMENT_DIMENSION_VALUES,
  assessmentDimensionLabel,
  initialStatusForRecommendation,
  type AssessmentDimensionKey,
  type DimensionResultValue,
  type EvidenceSourceValue,
  type OpportunityConfidenceValue,
  type OpportunityRecommendationValue,
  type OpportunityStatusValue,
  type OpportunityTechnologyValue,
} from "@/lib/opportunities/catalog";
import { opportunityCopyContainsForbiddenTerm } from "@/lib/opportunities/copy";
import {
  formatExclusionBreakdown,
  type ExclusionBreakdown,
} from "@/lib/opportunities/contiguous-geometry";
import {
  landCoverPreferenceScore,
  landCoverShareForRule,
  parseLandCoverProfile,
  type LandCoverComposition,
  type LandCoverProfile,
} from "@/lib/opportunities/land-cover";
import {
  classifySlopeAgainstThreshold,
  resolveMaxSlopeDegrees,
  type SlopeConstraintMode,
  type TerrainMetrics,
} from "@/lib/opportunities/terrain";

export type ScreeningCriteria = {
  technology: OpportunityTechnologyValue;
  country: string;
  region: string | null;
  municipality: string | null;
  targetMw: number | null;
  targetMwh: number | null;
  minSiteAreaHa: number | null;
  targetSiteAreaHa?: number | null;
  maxCandidateAreaHa?: number | null;
  maxReturnedCandidates?: number | null;
  maxDistanceKm: number | null;
  excludeProtected: boolean;
  excludeNatura: boolean;
  maxSlopePercent: number | null;
  maxSlopeDegrees?: number | null;
  slopeMode?: SlopeConstraintMode;
  landCoverProfile?: LandCoverProfile;
  maxRoadDistanceM?: number | null;
  roadMode?: SlopeConstraintMode;
  minDistanceResidentialM: number | null;
  electricityArea: string | null;
  notes: string | null;
  rankingVersion?: string;
};

export type OfficialCoveringEvidence = {
  queried: boolean;
  localCovered: boolean;
  nupCovered: boolean;
  localName: string | null;
  nupName: string | null;
  retrievedAt: string | null;
  sourceName: string | null;
};

export type LayerOverlapEvidence = {
  queried: boolean;
  overlapPercent: number | null;
  names: string[];
  sourceName: string | null;
};

export const PROTECTED_OVERLAP_FAIL_PERCENT = 1;

export type RoadAccessEvidence = {
  queried: boolean;
  nearestDistanceM: number | null;
  nearestClass: string | null;
  sourceName: string | null;
};

export type OpportunityCandidate = {
  name: string;
  country: string;
  region: string | null;
  municipality: string | null;
  latitude: number | null;
  longitude: number | null;
  targetMw: number | null;
  targetMwh: number | null;
  siteAreaHa: number | null;
  usableAreaHa: number | null;
  contiguousUsableAreaHa?: number | null;
  technology: OpportunityTechnologyValue;
  covering: OfficialCoveringEvidence;
  protectedOverlap?: LayerOverlapEvidence;
  naturaOverlap?: LayerOverlapEvidence;
  terrain?: TerrainMetrics;
  landCover?: {
    queried: boolean;
    composition: LandCoverComposition;
    sourceName: string | null;
  };
  road?: RoadAccessEvidence;
  exclusionBreakdown?: ExclusionBreakdown | null;
};

export type AssessmentDimension = {
  key: AssessmentDimensionKey;
  label: string;
  result: DimensionResultValue;
  explanation: string;
  sourceKind: EvidenceSourceValue;
  completeness: "available" | "insufficient";
};

export type ScreeningResult = {
  excluded: boolean;
  exclusionReason: string | null;
  recommendation: OpportunityRecommendationValue;
  recommendationSummary: string;
  status: OpportunityStatusValue;
  dataConfidence: OpportunityConfidenceValue;
  positives: string[];
  risks: string[];
  uncertainties: string[];
  dimensions: AssessmentDimension[];
};

const UNSUPPORTED_LAYER =
  "No supported source evidence is available for this dimension yet.";

export const CORE_SCREENING_DIMENSIONS = [
  "environmental",
  "terrain",
  "land_cover",
  "road",
  "grid_context",
  "residential",
] as const;

/**
 * Data confidence describes evidence coverage, not project success probability.
 * HIGH requires several currently supported core dimensions and no unevaluated
 * critical exclusion. Missing evidence never counts as a positive.
 */
export function deriveOpportunityConfidence(input: {
  availableDimensions: number;
  officialDimensions: number;
  criticalUnevaluated: boolean;
  coreAvailable?: number;
  coreSupported?: number;
}): OpportunityConfidenceValue {
  const coreAvailable = input.coreAvailable ?? input.officialDimensions;
  const coreSupported = input.coreSupported ?? CORE_SCREENING_DIMENSIONS.length;
  if (input.criticalUnevaluated) {
    if (coreAvailable >= 1) return "low";
    return "unknown";
  }
  if (coreAvailable >= 5 && input.officialDimensions >= 3 && input.availableDimensions >= 5) {
    return "high";
  }
  if (input.officialDimensions >= 2 && input.availableDimensions >= 4) {
    return "high";
  }
  if (coreAvailable >= Math.min(3, coreSupported) && input.officialDimensions >= 1) {
    return "medium";
  }
  if (input.availableDimensions >= 1) {
    return "low";
  }
  return "unknown";
}

function normalizePlace(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function dimension(
  key: AssessmentDimensionKey,
  result: DimensionResultValue,
  explanation: string,
  sourceKind: EvidenceSourceValue,
  completeness: "available" | "insufficient",
): AssessmentDimension {
  return {
    key,
    label: assessmentDimensionLabel(key),
    result,
    explanation,
    sourceKind,
    completeness,
  };
}

export function evaluateOpportunityScreening(input: {
  criteria: ScreeningCriteria;
  candidate: OpportunityCandidate;
}): ScreeningResult {
  const { criteria, candidate } = input;
  const dimensions: AssessmentDimension[] = [];
  const positives: string[] = [];
  const risks: string[] = [];
  const uncertainties: string[] = [];
  let excluded = false;
  let exclusionReason: string | null = null;

  const country = (candidate.country || criteria.country || "SE").trim().toUpperCase();
  const sweden = country === "SE" || country === "SWE" || country === "SWEDEN";

  if (criteria.region && candidate.region) {
    if (normalizePlace(criteria.region) !== normalizePlace(candidate.region)) {
      excluded = true;
      exclusionReason = "Outside the configured target region.";
    }
  } else if (criteria.region && !candidate.region) {
    uncertainties.push("Target region is configured, but this opportunity has no region recorded.");
  }

  if (criteria.municipality && candidate.municipality) {
    if (normalizePlace(criteria.municipality) !== normalizePlace(candidate.municipality)) {
      excluded = true;
      exclusionReason = exclusionReason ?? "Outside the configured municipality.";
    }
  }

  const contiguousArea = candidate.contiguousUsableAreaHa ?? candidate.usableAreaHa ?? candidate.siteAreaHa;
  if (criteria.minSiteAreaHa != null && contiguousArea != null && contiguousArea < criteria.minSiteAreaHa) {
    excluded = true;
    exclusionReason =
      exclusionReason ??
      `No contiguous screened area meets the configured minimum ${criteria.minSiteAreaHa} ha requirement.`;
  }

  const protectedOverlap = candidate.protectedOverlap;
  if (criteria.excludeProtected && protectedOverlap?.queried) {
    const pct = protectedOverlap.overlapPercent ?? 0;
    if (pct >= PROTECTED_OVERLAP_FAIL_PERCENT) {
      excluded = true;
      const named = protectedOverlap.names[0] ? ` (${protectedOverlap.names[0]})` : "";
      exclusionReason =
        exclusionReason ??
        `Direct overlap with a configured protected-area exclusion${named}: ${pct.toFixed(0)}% of the assessed area.`;
    }
  }

  const naturaOverlap = candidate.naturaOverlap;
  if (criteria.excludeNatura && naturaOverlap?.queried) {
    const pct = naturaOverlap.overlapPercent ?? 0;
    if (pct >= PROTECTED_OVERLAP_FAIL_PERCENT) {
      excluded = true;
      const named = naturaOverlap.names[0] ? ` (${naturaOverlap.names[0]})` : "";
      exclusionReason =
        exclusionReason ??
        `Direct overlap with a configured Natura 2000 exclusion${named}: ${pct.toFixed(0)}% of the assessed area.`;
    }
  }

  if (candidate.technology === criteria.technology) {
    positives.push("Technology matches the configured screening search.");
    dimensions.push(
      dimension(
        "strategic_fit",
        "strong",
        "Customer-entered technology matches the screening search.",
        "customer_data",
        "available",
      ),
    );
  } else {
    dimensions.push(
      dimension(
        "strategic_fit",
        "moderate",
        "Technology differs from the configured screening search. This is a customer-entered comparison, not a success score.",
        "customer_data",
        "available",
      ),
    );
  }

  const hasCoords = candidate.latitude != null && candidate.longitude != null;
  if (!hasCoords) {
    uncertainties.push("No coordinates recorded, so official geography cannot be matched.");
  }

  if (candidate.covering.queried && hasCoords && sweden) {
    if (candidate.covering.localCovered || candidate.covering.nupCovered) {
      const parts = [
        candidate.covering.localCovered
          ? `covering local-network geography${candidate.covering.localName ? ` (${candidate.covering.localName})` : ""}`
          : null,
        candidate.covering.nupCovered
          ? `covering network development plan geography${candidate.covering.nupName ? ` (${candidate.covering.nupName})` : ""}`
          : null,
      ].filter(Boolean);
      const explanation = `Relevant official grid context at this point: ${parts.join("; ")}. Covering geography is not a connection point and does not mean available capacity.`;
      dimensions.push(dimension("grid_context", "strong", explanation, "official", "available"));
      positives.push("Relevant official grid context at the recorded coordinates.");
      risks.push("Connection availability remains unconfirmed.");
    } else {
      dimensions.push(
        dimension(
          "grid_context",
          "moderate",
          "No covering official local-network or network development plan polygon at the recorded coordinates. That is a geographic observation, not a connection verdict.",
          "official",
          "available",
        ),
      );
      uncertainties.push("No covering official grid polygon at this point.");
    }
    dimensions.push(
      dimension(
        "grid_proximity",
        "unavailable",
        "Distance to substations or other grid infrastructure is not a supported dataset yet.",
        "noxheim_derived",
        "insufficient",
      ),
    );
  } else {
    dimensions.push(
      dimension(
        "grid_context",
        "unavailable",
        sweden
          ? hasCoords
            ? UNSUPPORTED_LAYER
            : "Official grid context requires coordinates."
          : "Sweden is the first supported geography. Official grid layers are not applied outside Sweden.",
        "noxheim_derived",
        "insufficient",
      ),
    );
    dimensions.push(
      dimension(
        "grid_proximity",
        "unavailable",
        "Distance to relevant infrastructure is not a supported dataset yet.",
        "noxheim_derived",
        "insufficient",
      ),
    );
    uncertainties.push("Official grid context is incomplete for ranking.");
  }

  const landCoverProfile = parseLandCoverProfile(criteria.landCoverProfile);
  const slopeThreshold = resolveMaxSlopeDegrees({
    maxSlopeDegrees: criteria.maxSlopeDegrees,
    maxSlopePercent: criteria.maxSlopePercent,
  });
  const slopeMode: SlopeConstraintMode = criteria.slopeMode === "hard" ? "hard" : "preference";
  const terrainMetrics: TerrainMetrics = candidate.terrain ?? {
    queried: false,
    meanSlopeDeg: null,
    medianSlopeDeg: null,
    p90SlopeDeg: null,
    maxSlopeDeg: null,
    pctBelowThreshold: null,
    sourceName: null,
  };

  let landSuitabilityPushed = false;
  if (slopeThreshold != null || terrainMetrics.queried) {
    const classified = classifySlopeAgainstThreshold({
      mode: slopeMode,
      thresholdDeg: slopeThreshold ?? 5,
      metrics: terrainMetrics,
    });
    if (classified.hardFail) {
      excluded = true;
      exclusionReason = exclusionReason ?? classified.explanation;
      dimensions.push(
        dimension("land_suitability", "excluded", classified.explanation, "noxheim_derived", "available"),
      );
      landSuitabilityPushed = true;
    } else if (!terrainMetrics.queried) {
      dimensions.push(
        dimension("land_suitability", "unavailable", classified.explanation, "noxheim_derived", "insufficient"),
      );
      landSuitabilityPushed = true;
      uncertainties.push("Terrain is configured but not evaluated from a supported ingest.");
    } else {
      dimensions.push(
        dimension(
          "land_suitability",
          classified.favorable ? "strong" : "moderate",
          classified.explanation,
          "noxheim_derived",
          "available",
        ),
      );
      landSuitabilityPushed = true;
      if (classified.favorable) {
        positives.push("Favorable terrain against configured screening criterion.");
      }
    }
  }

  const landCover = candidate.landCover;
  if (landCover?.queried) {
    const preferredShare = landCoverShareForRule(landCover.composition, landCoverProfile, "preferred");
    const score = landCoverPreferenceScore(landCover.composition, landCoverProfile);
    const parts = Object.entries(landCover.composition)
      .filter(([, share]) => share >= 1)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([group, share]) => `${group} ${share.toFixed(0)}%`);
    const explanation = `Land cover against the organisation screening profile: ${parts.join("; ") || "composition recorded"}. Preferred share ${preferredShare.toFixed(0)}%. This is not a universal land-quality finding.`;
    if (!landSuitabilityPushed) {
      dimensions.push(
        dimension(
          "land_suitability",
          score >= 0.1 ? "strong" : "moderate",
          explanation,
          "official",
          "available",
        ),
      );
      landSuitabilityPushed = true;
    } else {
      positives.push(explanation);
    }
  } else if (Object.values(landCoverProfile).some((rule) => rule === "excluded" || rule === "preferred")) {
    uncertainties.push(
      "Land-cover rules are configured, but a supported land-cover dataset is not available for this search.",
    );
  }

  if (!landSuitabilityPushed) {
    dimensions.push(
      dimension("land_suitability", "unavailable", UNSUPPORTED_LAYER, "noxheim_derived", "insufficient"),
    );
  }

  const protQueried = Boolean(protectedOverlap?.queried);
  const natQueried = Boolean(naturaOverlap?.queried);
  const protPct = protQueried ? (protectedOverlap?.overlapPercent ?? 0) : null;
  const natPct = natQueried ? (naturaOverlap?.overlapPercent ?? 0) : null;
  const protFail = Boolean(criteria.excludeProtected && protQueried && (protPct ?? 0) >= PROTECTED_OVERLAP_FAIL_PERCENT);
  const natFail = Boolean(criteria.excludeNatura && natQueried && (natPct ?? 0) >= PROTECTED_OVERLAP_FAIL_PERCENT);

  if (protFail || natFail) {
    const parts: string[] = [];
    if (protFail) {
      const named = protectedOverlap?.names[0] ? ` (${protectedOverlap.names[0]})` : "";
      parts.push(
        `Direct overlap with a configured protected-area exclusion${named}: ${(protPct ?? 0).toFixed(0)}% of the assessed area.`,
      );
    }
    if (natFail) {
      const named = naturaOverlap?.names[0] ? ` (${naturaOverlap.names[0]})` : "";
      parts.push(
        `Direct overlap with a configured Natura 2000 exclusion${named}: ${(natPct ?? 0).toFixed(0)}% of the assessed area.`,
      );
    }
    dimensions.push(
      dimension(
        "environmental",
        "excluded",
        `${parts.join(" ")} This is not a legal impossibility finding.`,
        "official",
        "available",
      ),
    );
  } else if (protQueried || natQueried) {
    const notable = (protPct ?? 0) > 0 || (natPct ?? 0) > 0;
    if (notable) {
      const bits = [
        protQueried && (protPct ?? 0) > 0
          ? `protected-area data intersects ${(protPct ?? 0).toFixed(0)}%${protectedOverlap?.names[0] ? ` (${protectedOverlap.names[0]})` : ""}`
          : null,
        natQueried && (natPct ?? 0) > 0
          ? `Natura 2000 data intersects ${(natPct ?? 0).toFixed(0)}%${naturaOverlap?.names[0] ? ` (${naturaOverlap.names[0]})` : ""}`
          : null,
      ].filter(Boolean);
      dimensions.push(
        dimension(
          "environmental",
          "review_required",
          `Supported ${bits.join("; ")} of the assessed area. Overlap is below the ${PROTECTED_OVERLAP_FAIL_PERCENT}% fail threshold or exclusion was not configured.`,
          "official",
          "available",
        ),
      );
    } else {
      const checked = [
        protQueried ? "protected-area" : null,
        natQueried ? "Natura 2000" : null,
      ].filter(Boolean);
      dimensions.push(
        dimension(
          "environmental",
          "low_conflict",
          `No direct overlap with supported ${checked.join(" and ")} datasets in the assessed area.`,
          "official",
          "available",
        ),
      );
      positives.push(`No direct overlap with supported ${checked.join(" and ")} datasets.`);
    }
  } else {
    const envParts: string[] = [];
    if (criteria.excludeProtected) {
      envParts.push(
        "Exclude protected areas is configured, but a supported protected-area layer is not available for this search. Candidates were not eliminated on this rule.",
      );
    }
    if (criteria.excludeNatura) {
      envParts.push(
        "Exclude Natura 2000 is configured, but a supported Natura 2000 layer is not available for this search. Candidates were not eliminated on this rule.",
      );
    }
    dimensions.push(
      dimension(
        "environmental",
        "unavailable",
        envParts.length > 0 ? envParts.join(" ") : UNSUPPORTED_LAYER,
        "noxheim_derived",
        "insufficient",
      ),
    );
    if (envParts.length > 0) {
      uncertainties.push("Environmental exclusion rules are recorded but cannot be fully evaluated yet.");
    }
  }

  if (candidate.exclusionBreakdown) {
    positives.push(formatExclusionBreakdown(candidate.exclusionBreakdown));
  }

  dimensions.push(
    dimension(
      "planning",
      "review_required",
      "Municipal planning review is not verified from a supported source. Treat planning as requiring review.",
      "noxheim_derived",
      "insufficient",
    ),
  );
  risks.push("Municipal planning review required.");

  const road = candidate.road;
  const roadMode = criteria.roadMode === "hard" ? "hard" : "preference";
  const maxRoadM = criteria.maxRoadDistanceM ?? (criteria.maxDistanceKm != null ? criteria.maxDistanceKm * 1000 : null);
  if (road?.queried && road.nearestDistanceM != null) {
    const within = maxRoadM == null || road.nearestDistanceM <= maxRoadM;
    if (roadMode === "hard" && maxRoadM != null && !within) {
      excluded = true;
      exclusionReason =
        exclusionReason ??
        `Nearest supported road is ${Math.round(road.nearestDistanceM)} m, beyond the configured ${Math.round(maxRoadM)} m hard threshold.`;
      dimensions.push(
        dimension("access", "excluded", exclusionReason, "official", "available"),
      );
    } else {
      dimensions.push(
        dimension(
          "access",
          within ? "strong" : "moderate",
          `Favorable proximity to supported road infrastructure: nearest ${road.nearestClass ?? "supported road"} is ${Math.round(road.nearestDistanceM)} m. This does not mean heavy transport can access the site.`,
          "official",
          "available",
        ),
      );
      if (within) positives.push("Favorable proximity to supported road infrastructure.");
    }
  } else {
    const configuredAccess =
      maxRoadM != null || criteria.minDistanceResidentialM != null || criteria.maxDistanceKm != null;
    dimensions.push(
      dimension(
        "access",
        "unavailable",
        configuredAccess
          ? "Access and residential-distance rules are configured, but a supporting official layer is not available for this search. The constraints were not applied."
          : "Residential proximity is blocked pending data rights. Road access is evaluated only after a licensed official ingest.",
        "noxheim_derived",
        "insufficient",
      ),
    );
  }

  uncertainties.push(
    "Residential proximity is unsupported pending legally reusable building data. It is not treated as a pass.",
  );

  if (criteria.electricityArea) {
    uncertainties.push(
      `Electricity area ${criteria.electricityArea} is recorded as search intent. NOXHEIM does not have official reusable bidding-zone geometry, so it was not used as a spatial filter.`,
    );
  }

  const available = dimensions.filter((item) => item.completeness === "available");
  const officialAvailable = available.filter((item) => item.sourceKind === "official").length;
  const environmentalUnevaluated =
    (criteria.excludeProtected && !protectedOverlap?.queried) ||
    (criteria.excludeNatura && !naturaOverlap?.queried);
  const coreAvailable =
    Number(protQueried || natQueried) +
    Number(terrainMetrics.queried) +
    Number(Boolean(landCover?.queried)) +
    Number(Boolean(road?.queried && road.nearestDistanceM != null)) +
    Number(candidate.covering.queried);
  const dataConfidence = deriveOpportunityConfidence({
    availableDimensions: available.length,
    officialDimensions: officialAvailable,
    criticalUnevaluated: environmentalUnevaluated,
    coreAvailable,
    coreSupported: 5,
  });

  let recommendation: OpportunityRecommendationValue = "insufficient_evidence";
  if (excluded) {
    recommendation = "low_priority";
  } else if (officialAvailable === 0) {
    recommendation = "insufficient_evidence";
  } else if (candidate.covering.localCovered && candidate.covering.nupCovered) {
    recommendation = "prioritise";
  } else if (candidate.covering.localCovered || candidate.covering.nupCovered) {
    recommendation = "investigate";
  } else if (candidate.covering.queried) {
    recommendation = "secondary";
  }

  if (
    !excluded &&
    environmentalUnevaluated &&
    (recommendation === "prioritise" || recommendation === "investigate")
  ) {
    recommendation = "insufficient_evidence";
    uncertainties.push(
      "Configured environmental exclusions could not be evaluated because a supporting official layer is unavailable.",
    );
  }

  const recommendationSummary = excluded
    ? `Do not prioritise under the current screening profile: ${exclusionReason}`
    : recommendation === "insufficient_evidence"
      ? "Based on currently available evidence and configured screening criteria, NOXHEIM cannot rank this area confidently."
      : recommendation === "prioritise"
        ? "NOXHEIM recommends prioritising this area for further screening. Candidate ranking uses currently supported evidence and is not a build or connection finding."
        : "This area ranks for further investigation relative to alternatives from currently supported evidence. This is not a prediction of project success or connection.";

  for (const item of [...positives, ...risks, ...uncertainties, recommendationSummary, ...dimensions.map((row) => row.explanation)]) {
    const forbidden = opportunityCopyContainsForbiddenTerm(item);
    if (forbidden) {
      throw new Error(`Screening copy contains forbidden term: ${forbidden}`);
    }
  }

  return {
    excluded,
    exclusionReason,
    recommendation,
    recommendationSummary,
    status: excluded ? "identified" : initialStatusForRecommendation(recommendation),
    dataConfidence,
    positives,
    risks,
    uncertainties,
    dimensions: ASSESSMENT_DIMENSION_VALUES.map(
      (key) => dimensions.find((item) => item.key === key) ?? dimension(key, "unavailable", UNSUPPORTED_LAYER, "noxheim_derived", "insufficient"),
    ),
  };
}

export function emptyCovering(): OfficialCoveringEvidence {
  return {
    queried: false,
    localCovered: false,
    nupCovered: false,
    localName: null,
    nupName: null,
    retrievedAt: null,
    sourceName: null,
  };
}
