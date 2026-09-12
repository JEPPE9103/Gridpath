/**
 * Candidate constraint semantics v1.
 *
 * Derived interpretation of already-evaluated evidence. Does not copy official
 * datasets. Missing evidence is UNKNOWN, never a BLOCKER, and never favourable.
 *
 * BLOCKER = a configured rule whose current evidence means the Candidate should
 * not proceed under this screening profile (usually already hard-excluded).
 * MAJOR_RISK / RISK = investigate, not automatically fatal.
 * UNKNOWN = important evidence was not evaluated.
 * INFO = useful context that is not itself negative.
 */

import type { EvidenceSourceValue } from "@/lib/opportunities/catalog";
import type { EvidenceCategoryId } from "@/lib/opportunities/evidence-coverage";
import { opportunityCopyContainsForbiddenTerm } from "@/lib/opportunities/copy";
import type { SlopeConstraintMode } from "@/lib/opportunities/terrain";

export const CONSTRAINT_SEMANTICS_VERSION = "candidate-constraints-v1";

export const CONSTRAINT_SEVERITIES = [
  "blocker",
  "major_risk",
  "risk",
  "unknown",
  "info",
] as const;

export type ConstraintSeverity = (typeof CONSTRAINT_SEVERITIES)[number];

export type ConstraintEvidenceCategory = EvidenceCategoryId | "geometry" | "grid_capacity" | "screening_profile";

export type CandidateConstraint = {
  id: string;
  severity: ConstraintSeverity;
  title: string;
  explanation: string;
  whyItMatters: string;
  evidenceCategory: ConstraintEvidenceCategory;
  provenance: EvidenceSourceValue;
  evaluated: boolean;
  measuredValue: string | null;
  threshold: string | null;
  automaticExclusion: boolean;
  userActionRecommended: boolean;
};

export type CandidateConstraintInput = {
  excluded?: boolean;
  exclusionReason?: string | null;
  geometryQuality?: string | null;
  geometryQualityReason?: string | null;
  terrainQueried?: boolean;
  meanSlopeDeg?: number | null;
  p90SlopeDeg?: number | null;
  pctBelowSlope?: number | null;
  terrainResolution?: string | null;
  maxSlopeDegrees?: number | null;
  slopeMode?: SlopeConstraintMode | null;
  roadQueried?: boolean;
  roadDistanceM?: number | null;
  roadClass?: string | null;
  maxRoadDistanceM?: number | null;
  roadMode?: SlopeConstraintMode | null;
  landCoverQueried?: boolean;
  protectedQueried?: boolean;
  naturaQueried?: boolean;
  excludeProtected?: boolean;
  excludeNatura?: boolean;
  coveringQueried?: boolean;
  localCoveringName?: string | null;
  nupCoveringName?: string | null;
};

const SEVERITY_ORDER: Record<ConstraintSeverity, number> = {
  blocker: 0,
  major_risk: 1,
  risk: 2,
  unknown: 3,
  info: 4,
};

function constraint(
  partial: CandidateConstraint,
): CandidateConstraint {
  const forbidden = opportunityCopyContainsForbiddenTerm(
    `${partial.title} ${partial.explanation} ${partial.whyItMatters}`,
  );
  if (forbidden) {
    throw new Error(`Constraint copy contains forbidden term: ${forbidden}`);
  }
  return partial;
}

export function constraintSeverityRank(severity: ConstraintSeverity): number {
  return SEVERITY_ORDER[severity];
}

export function constraintSeverityLabel(severity: ConstraintSeverity): string {
  switch (severity) {
    case "blocker":
      return "Blocker";
    case "major_risk":
      return "Major risk";
    case "risk":
      return "Risk";
    case "unknown":
      return "Unknown";
    default:
      return "Info";
  }
}

export function deriveCandidateConstraints(input: CandidateConstraintInput): CandidateConstraint[] {
  const rows: CandidateConstraint[] = [];
  const slopeThreshold = input.maxSlopeDegrees ?? 5;
  const roadMax = input.maxRoadDistanceM ?? 1000;
  const slopeMode = input.slopeMode === "hard" ? "hard" : "preference";
  const roadMode = input.roadMode === "hard" ? "hard" : "preference";

  if (input.excluded) {
    rows.push(
      constraint({
        id: "screening_exclusion",
        severity: "blocker",
        title: "Does not proceed under this screening profile",
        explanation: input.exclusionReason?.trim() || "A configured screening rule excluded this footprint.",
        whyItMatters: "Further investigation of this Candidate is not recommended under the current profile.",
        evidenceCategory: "screening_profile",
        provenance: "noxheim_derived",
        evaluated: true,
        measuredValue: null,
        threshold: null,
        automaticExclusion: true,
        userActionRecommended: false,
      }),
    );
  }

  if (input.geometryQuality === "review") {
    rows.push(
      constraint({
        id: "geometry_review",
        severity: "major_risk",
        title: "Footprint geometry needs review",
        explanation:
          input.geometryQualityReason?.trim() ||
          "The screening geometry is elongated, fragmented, or has a narrow connection.",
        whyItMatters:
          "A usable development envelope may be smaller than the Candidate polygon. Confirm the footprint before treating area as available land.",
        evidenceCategory: "geometry",
        provenance: "noxheim_derived",
        evaluated: true,
        measuredValue: input.geometryQualityReason ?? "review",
        threshold: "compact / non-fragmented screening geometry",
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  }

  if (input.terrainQueried !== true) {
    rows.push(
      constraint({
        id: "terrain_unavailable",
        severity: "unknown",
        title: "Terrain evidence unavailable",
        explanation: "Coarse slope summaries were not evaluated for this Candidate.",
        whyItMatters: "Grading and earthworks risk cannot be ranked from terrain evidence.",
        evidenceCategory: "terrain",
        provenance: "official",
        evaluated: false,
        measuredValue: null,
        threshold: slopeMode === "hard" ? `hard limit ${slopeThreshold}°` : `preference ${slopeThreshold}°`,
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  } else {
    const mean = input.meanSlopeDeg;
    if (mean != null && mean > slopeThreshold) {
      rows.push(
        constraint({
          id: "terrain_above_preference",
          severity: slopeMode === "hard" ? "blocker" : "risk",
          title: slopeMode === "hard" ? "Slope exceeds the configured hard limit" : "Slope exceeds the preferred threshold",
          explanation: `Mean slope is ${mean.toFixed(1)}°, against a ${slopeMode} threshold of ${slopeThreshold}°. Coarse Copernicus-derived summaries, not a survey.`,
          whyItMatters:
            slopeMode === "hard"
              ? "The current screening profile treats this slope as a reason not to proceed."
              : "Earthworks and layout flexibility may be harder. This is not a constructability finding.",
          evidenceCategory: "terrain",
          provenance: "official",
          evaluated: true,
          measuredValue: `${mean.toFixed(1)}° mean`,
          threshold: `${slopeThreshold}° ${slopeMode}`,
          automaticExclusion: slopeMode === "hard",
          userActionRecommended: true,
        }),
      );
    }
    if (input.terrainResolution !== "detailed") {
      rows.push(
        constraint({
          id: "detailed_terrain_unavailable",
          severity: "unknown",
          title: "Detailed terrain not evaluated",
          explanation: "Only coarse slope summaries were used. 1 m official DTM was not applied to this Candidate.",
          whyItMatters: "Local grading and earthworks risk cannot be assessed from 1 km summaries.",
          evidenceCategory: "detailed_terrain",
          provenance: "official",
          evaluated: false,
          measuredValue: input.terrainResolution ?? "coarse",
          threshold: null,
          automaticExclusion: false,
          userActionRecommended: true,
        }),
      );
    }
  }

  if (input.roadQueried !== true) {
    rows.push(
      constraint({
        id: "road_unavailable",
        severity: "unknown",
        title: "Road access not evaluated",
        explanation: "Official road-link evidence was not available for this Candidate.",
        whyItMatters: "Construction and heavy-vehicle access remain unknown. This is not a finding that access is easy.",
        evidenceCategory: "road_access",
        provenance: "official",
        evaluated: false,
        measuredValue: null,
        threshold: roadMode === "hard" ? `hard ${roadMax} m` : `preference ${roadMax} m`,
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  } else if (input.roadDistanceM != null && input.roadDistanceM > roadMax) {
    rows.push(
      constraint({
        id: "road_beyond_preference",
        severity: roadMode === "hard" ? "blocker" : "risk",
        title: roadMode === "hard" ? "Access distance exceeds the hard limit" : "Nearest official road is beyond the preferred distance",
        explanation: `Nearest official road link is ${Math.round(input.roadDistanceM)} m (${input.roadClass ?? "class unknown"}). Road proximity is screening evidence, not construction access.`,
        whyItMatters: "Access tracks or upgrades may be needed. This is not a construction-route design or a rights finding.",
        evidenceCategory: "road_access",
        provenance: "official",
        evaluated: true,
        measuredValue: `${Math.round(input.roadDistanceM)} m`,
        threshold: `${roadMax} m ${roadMode}`,
        automaticExclusion: roadMode === "hard",
        userActionRecommended: true,
      }),
    );
  } else if (input.roadDistanceM != null) {
    const intersectsGeometry = input.roadDistanceM < 10;
    rows.push(
      constraint({
        id: "road_proximity_evaluated",
        severity: "info",
        title: "Road proximity evaluated",
        explanation: intersectsGeometry
          ? `Official RoadLink intersects this Candidate screening geometry (${Math.round(input.roadDistanceM)} m, ${input.roadClass ?? "class unknown"}).`
          : `Nearest official RoadLink is ${Math.round(input.roadDistanceM)} m (${input.roadClass ?? "class unknown"}).`,
        whyItMatters:
          "A nearby official road is screening-level proximity, not a confirmed entrance, heavy-vehicle route, or access right.",
        evidenceCategory: "road_access",
        provenance: "official",
        evaluated: true,
        measuredValue: intersectsGeometry ? "intersects geometry" : `${Math.round(input.roadDistanceM)} m`,
        threshold: `${roadMax} m ${roadMode}`,
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  }

  if (input.landCoverQueried !== true) {
    rows.push(
      constraint({
        id: "land_cover_unavailable",
        severity: "unknown",
        title: "Land cover not evaluated",
        explanation: "Official land-cover summaries were not available for this Candidate.",
        whyItMatters: "Usable-land ranking cannot be checked against the screening land-cover profile.",
        evidenceCategory: "land_cover",
        provenance: "official",
        evaluated: false,
        measuredValue: null,
        threshold: null,
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  }

  if (input.excludeProtected !== false && input.protectedQueried !== true) {
    rows.push(
      constraint({
        id: "protected_not_evaluated",
        severity: "unknown",
        title: "Protected-area evidence not evaluated",
        explanation: "The profile excludes protected areas, but official polygons were not queried for this Candidate.",
        whyItMatters: "A hard environmental cut could not be applied. Absence of overlap is not proven.",
        evidenceCategory: "environmental_protection",
        provenance: "official",
        evaluated: false,
        measuredValue: null,
        threshold: "exclude protected",
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  }

  if (input.excludeNatura !== false && input.naturaQueried !== true) {
    rows.push(
      constraint({
        id: "natura_not_evaluated",
        severity: "unknown",
        title: "Natura 2000 evidence not evaluated",
        explanation: "The profile excludes Natura 2000, but official polygons were not queried for this Candidate.",
        whyItMatters: "A hard environmental cut could not be applied. Absence of overlap is not proven.",
        evidenceCategory: "natura_2000",
        provenance: "official",
        evaluated: false,
        measuredValue: null,
        threshold: "exclude Natura 2000",
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  }

  rows.push(
    constraint({
      id: "residential_not_evaluated",
      severity: "unknown",
      title: "Residential proximity not evaluated",
      explanation: "NOXHEIM does not currently use a residential-distance dataset.",
      whyItMatters: "Neighbour and disturbance questions remain outside this screening.",
      evidenceCategory: "residential_proximity",
      provenance: "noxheim_derived",
      evaluated: false,
      measuredValue: null,
      threshold: null,
      automaticExclusion: false,
      userActionRecommended: false,
    }),
  );

  if (input.coveringQueried === true && (input.localCoveringName || input.nupCoveringName)) {
    const operator = input.localCoveringName ?? "the covering local network";
    rows.push(
      constraint({
        id: "network_covering_capacity_unknown",
        severity: "info",
        title: `Covered by ${operator}. Capacity not assessed.`,
        explanation: input.nupCoveringName
          ? `Official local-network covering plus NUP planning area “${input.nupCoveringName}”. Covering geography is not available capacity.`
          : `Official local-network covering. Covering geography is not available capacity.`,
        whyItMatters: "Site origination does not establish connection feasibility. Assess connection separately with the network operator.",
        evidenceCategory: "grid_capacity",
        provenance: "official",
        evaluated: true,
        measuredValue: operator,
        threshold: null,
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  } else if (input.coveringQueried === true) {
    rows.push(
      constraint({
        id: "network_covering_none",
        severity: "info",
        title: "No official local-network covering polygon at the Candidate centroid",
        explanation: "Covering geography was queried. A missing covering polygon is not a no-capacity finding.",
        whyItMatters: "Connection still has to be investigated separately.",
        evidenceCategory: "network_geography",
        provenance: "official",
        evaluated: true,
        measuredValue: "no covering name",
        threshold: null,
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  } else {
    rows.push(
      constraint({
        id: "network_covering_unavailable",
        severity: "unknown",
        title: "Network geography not evaluated",
        explanation: "Official covering geography was not queried for this Candidate.",
        whyItMatters: "The local-network operator is unknown here. Capacity is also not assessed.",
        evidenceCategory: "network_geography",
        provenance: "official",
        evaluated: false,
        measuredValue: null,
        threshold: null,
        automaticExclusion: false,
        userActionRecommended: true,
      }),
    );
  }

  return rows.sort((left, right) => constraintSeverityRank(left.severity) - constraintSeverityRank(right.severity));
}

export function constraintsBySeverity(
  constraints: CandidateConstraint[],
  severity: ConstraintSeverity,
): CandidateConstraint[] {
  return constraints.filter((item) => item.severity === severity);
}

export function hasBlocker(constraints: CandidateConstraint[]): boolean {
  return constraints.some((item) => item.severity === "blocker");
}
