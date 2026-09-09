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

export type ScreeningCriteria = {
  technology: OpportunityTechnologyValue;
  country: string;
  region: string | null;
  municipality: string | null;
  targetMw: number | null;
  targetMwh: number | null;
  minSiteAreaHa: number | null;
  maxDistanceKm: number | null;
  excludeProtected: boolean;
  excludeNatura: boolean;
  maxSlopePercent: number | null;
  minDistanceResidentialM: number | null;
  notes: string | null;
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
  technology: OpportunityTechnologyValue;
  covering: OfficialCoveringEvidence;
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

  if (
    criteria.minSiteAreaHa != null &&
    candidate.siteAreaHa != null &&
    candidate.siteAreaHa < criteria.minSiteAreaHa
  ) {
    excluded = true;
    exclusionReason = exclusionReason ?? "Site area is below the configured minimum.";
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

  dimensions.push(
    dimension(
      "land_suitability",
      "unavailable",
      criteria.maxSlopePercent != null
        ? "Maximum slope is configured, but a supported slope dataset is not integrated. The constraint was not applied."
        : UNSUPPORTED_LAYER,
      "noxheim_derived",
      "insufficient",
    ),
  );

  const envParts: string[] = [];
  if (criteria.excludeProtected) {
    envParts.push("Exclude protected areas is configured, but no supported protected-area layer is integrated. Candidates were not eliminated on this rule.");
  }
  if (criteria.excludeNatura) {
    envParts.push("Exclude Natura 2000 is configured, but no supported Natura 2000 layer is integrated. Candidates were not eliminated on this rule.");
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
    uncertainties.push("Environmental exclusion rules are recorded but cannot be evaluated yet.");
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

  dimensions.push(
    dimension(
      "access",
      criteria.minDistanceResidentialM != null || criteria.maxDistanceKm != null
        ? "unavailable"
        : "unavailable",
      criteria.maxDistanceKm != null || criteria.minDistanceResidentialM != null
        ? "Access and residential-distance rules are configured, but supported transport/settlement layers are not integrated. The constraints were not applied."
        : UNSUPPORTED_LAYER,
      "noxheim_derived",
      "insufficient",
    ),
  );

  const available = dimensions.filter((item) => item.completeness === "available");
  const officialAvailable = available.filter((item) => item.sourceKind === "official").length;
  const dataConfidence: OpportunityConfidenceValue =
    officialAvailable >= 1 && available.length >= 3
      ? "high"
      : available.length >= 2
        ? "medium"
        : available.length >= 1
          ? "low"
          : "unknown";

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

  const recommendationSummary = excluded
    ? `Based on the configured screening criteria, this opportunity is excluded: ${exclusionReason}`
    : recommendation === "insufficient_evidence"
      ? "Based on currently available evidence and configured screening criteria, NOXHEIM cannot rank this opportunity confidently."
      : "Based on currently available evidence and configured screening criteria, this opportunity is ranked for further investigation relative to alternatives. This is not a prediction of project success or connection.";

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
