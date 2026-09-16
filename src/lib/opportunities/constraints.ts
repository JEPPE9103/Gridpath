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
import {
  CONTAMINATION_NEARBY_M,
  describeContaminationEvidence,
  formatContaminationNearestM,
  isHighOfficialRiskClass,
  type ContaminationConstraintMode,
} from "@/lib/opportunities/contamination";
import {
  GROUND_GROUP_LABELS,
  describeGroundComposition,
  formatGroundPct,
  groundGroupPct,
  isGroundGroup,
  parseGroundComposition,
  type GroundGroup,
} from "@/lib/opportunities/ground";
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
  floodQueried?: boolean;
  floodOverlapPct?: number | null;
  floodOverlapHa?: number | null;
  floodClasses?: string[] | null;
  floodMode?: SlopeConstraintMode | null;
  floodHardExclusionPct?: number | null;
  floodRiskOverlapPct?: number | null;
  floodMajorRiskOverlapPct?: number | null;
  groundQueried?: boolean;
  groundComposition?: Record<string, number> | null;
  groundDominantGroup?: string | null;
  groundSourceClasses?: string[] | null;
  groundMode?: SlopeConstraintMode | null;
  groundHardExclusionPct?: number | null;
  groundClayRiskPct?: number | null;
  groundClayMajorRiskPct?: number | null;
  groundPeatRiskPct?: number | null;
  groundPeatMajorRiskPct?: number | null;
  contaminationQueried?: boolean;
  contaminationIntersectingCount?: number | null;
  contaminationNearbyCount?: number | null;
  contaminationNearestM?: number | null;
  contaminationRiskClasses?: string[] | null;
  contaminationStatuses?: string[] | null;
  contaminationRecordIds?: string[] | null;
  contaminationProviderKey?: string | null;
  /** preference (default) = risk/major_risk only; hard = intersecting becomes BLOCKER. Never default blocker. */
  contaminationMode?: ContaminationConstraintMode | SlopeConstraintMode | null;
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

  {
    const floodMode = input.floodMode === "hard" ? "hard" : "preference";
    const riskPct = input.floodRiskOverlapPct ?? 1;
    const majorPct = input.floodMajorRiskOverlapPct ?? 10;
    const hardPct = input.floodHardExclusionPct ?? 1;
    const overlap = input.floodOverlapPct;

    if (input.floodQueried !== true) {
      rows.push(
        constraint({
          id: "flood_unavailable",
          severity: "unknown",
          title: "Flood / water evidence not evaluated",
          explanation: "Official mapped flood geography was not evaluated for this Candidate.",
          whyItMatters:
            "Screening-level flood exposure is unknown. This is not a finding that flood exposure is absent.",
          evidenceCategory: "flood_water",
          provenance: "official",
          evaluated: false,
          measuredValue: null,
          threshold:
            floodMode === "hard"
              ? `hard exclusion ≥ ${hardPct}% mapped overlap`
              : `risk ≥ ${riskPct}% · major risk ≥ ${majorPct}% (screening assumptions)`,
          automaticExclusion: false,
          userActionRecommended: true,
        }),
      );
    } else if (overlap != null && overlap > 0) {
      const classLabel =
        input.floodClasses && input.floodClasses.length > 0
          ? input.floodClasses.includes("bhf")
            ? "Calculated highest flow (BHF)"
            : input.floodClasses.join(", ")
          : "Mapped flood geography";
      const hardHit = floodMode === "hard" && overlap >= hardPct;
      const majorHit = overlap >= majorPct;
      const riskHit = overlap >= riskPct;
      rows.push(
        constraint({
          id: hardHit ? "flood_hard_exclusion" : majorHit ? "flood_major_overlap" : riskHit ? "flood_edge_overlap" : "flood_trace_overlap",
          severity: hardHit ? "blocker" : majorHit ? "major_risk" : riskHit ? "risk" : "info",
          title: hardHit
            ? "Mapped flood geography exceeds the hard exclusion threshold"
            : majorHit
              ? "Material mapped flood overlap"
              : riskHit
                ? "Limited mapped flood overlap"
                : "Trace mapped flood overlap",
          explanation: `Mapped flood geography (${classLabel}) intersects ${overlap.toFixed(1)}% of the Candidate footprint. Official MSB/MCF översvämningskartering — screening-level evidence, not a flood engineering finding.`,
          whyItMatters: hardHit
            ? "The active screening profile treats this mapped overlap as a reason not to proceed."
            : "Mapped flood exposure should be reviewed for site drainage implications before further development spend. This does not mean the site will flood.",
          evidenceCategory: "flood_water",
          provenance: "official",
          evaluated: true,
          measuredValue: `${overlap.toFixed(1)}% overlap`,
          threshold: hardHit
            ? `hard ≥ ${hardPct}%`
            : `risk ≥ ${riskPct}% · major ≥ ${majorPct}% (screening assumptions)`,
          automaticExclusion: hardHit,
          userActionRecommended: true,
        }),
      );
    } else {
      rows.push(
        constraint({
          id: "flood_no_mapped_overlap",
          severity: "info",
          title: "No mapped flood overlap in the evaluated dataset",
          explanation:
            "Official mapped flood geography (MSB/MCF BHF) does not intersect this Candidate footprint in the evaluated Search Area cache.",
          whyItMatters:
            "No mapped overlap is not the same as absent flood exposure. Other flood mechanisms and local conditions remain outside this screening.",
          evidenceCategory: "flood_water",
          provenance: "official",
          evaluated: true,
          measuredValue: "0% overlap",
          threshold: null,
          automaticExclusion: false,
          userActionRecommended: false,
        }),
      );
    }
  }

  {
    const groundMode = input.groundMode === "hard" ? "hard" : "preference";
    const clayRisk = input.groundClayRiskPct ?? 15;
    const clayMajor = input.groundClayMajorRiskPct ?? 40;
    const peatRisk = input.groundPeatRiskPct ?? 5;
    const peatMajor = input.groundPeatMajorRiskPct ?? 15;
    const hardPct = input.groundHardExclusionPct ?? 40;
    const composition = parseGroundComposition(input.groundComposition);
    const clayPct = groundGroupPct(composition, "CLAY_FINE_SEDIMENT");
    const peatPct = groundGroupPct(composition, "PEAT_ORGANIC");
    const dominant = isGroundGroup(input.groundDominantGroup ?? null)
      ? (input.groundDominantGroup as GroundGroup)
      : null;

    if (input.groundQueried !== true) {
      rows.push(
        constraint({
          id: "ground_unavailable",
          severity: "unknown",
          title: "Ground / soil evidence not evaluated",
          explanation: "Official SGU mapped surficial geology was not evaluated for this Candidate.",
          whyItMatters:
            "Screening-level ground conditions are unknown. This is not a finding that ground conditions are favourable.",
          evidenceCategory: "ground_soil",
          provenance: "official",
          evaluated: false,
          measuredValue: null,
          threshold:
            groundMode === "hard"
              ? `hard exclusion ≥ ${hardPct}% clay or peat (screening assumption)`
              : `clay risk ≥ ${clayRisk}% · major ≥ ${clayMajor}% · peat risk ≥ ${peatRisk}% · major ≥ ${peatMajor}% (screening assumptions)`,
          automaticExclusion: false,
          userActionRecommended: true,
        }),
      );
    } else {
      const compositionText = describeGroundComposition({ composition, dominant });
      let emittedRisk = false;

      if (peatPct > 0) {
        const hardHit = groundMode === "hard" && peatPct >= hardPct;
        const majorHit = peatPct >= peatMajor;
        const riskHit = peatPct >= peatRisk;
        if (hardHit || majorHit || riskHit || peatPct > 0) {
          rows.push(
            constraint({
              id: hardHit
                ? "ground_peat_hard_exclusion"
                : majorHit
                  ? "ground_peat_major"
                  : riskHit
                    ? "ground_peat_risk"
                    : "ground_peat_trace",
              severity: hardHit ? "blocker" : majorHit ? "major_risk" : riskHit ? "risk" : "info",
              title: hardHit
                ? "Mapped peat / organic ground exceeds the hard exclusion threshold"
                : majorHit
                  ? "Material mapped peat / organic ground"
                  : riskHit
                    ? "Mapped peat / organic ground present"
                    : "Trace mapped peat / organic ground",
              explanation: `SGU mapping indicates peat / organic ground across ${formatGroundPct(peatPct)} of the Candidate footprint. Screening-level mapped surficial geology — not a geotechnical investigation.`,
              whyItMatters: hardHit
                ? "The active screening profile treats this mapped class share as a reason not to proceed."
                : "Mapped peat / organic ground warrants geotechnical verification before further development spend.",
              evidenceCategory: "ground_soil",
              provenance: "official",
              evaluated: true,
              measuredValue: `${formatGroundPct(peatPct)} peat / organic`,
              threshold: hardHit
                ? `hard ≥ ${hardPct}%`
                : `risk ≥ ${peatRisk}% · major ≥ ${peatMajor}% (screening assumptions)`,
              automaticExclusion: hardHit,
              userActionRecommended: hardHit || majorHit || riskHit,
            }),
          );
          emittedRisk = true;
        }
      }

      if (clayPct > 0) {
        const hardHit = groundMode === "hard" && clayPct >= hardPct;
        const majorHit = clayPct >= clayMajor;
        const riskHit = clayPct >= clayRisk;
        if (hardHit || majorHit || riskHit || clayPct > 0) {
          rows.push(
            constraint({
              id: hardHit
                ? "ground_clay_hard_exclusion"
                : majorHit
                  ? "ground_clay_major"
                  : riskHit
                    ? "ground_clay_risk"
                    : "ground_clay_trace",
              severity: hardHit ? "blocker" : majorHit ? "major_risk" : riskHit ? "risk" : "info",
              title: hardHit
                ? "Mapped clay / fine sediment exceeds the hard exclusion threshold"
                : majorHit
                  ? "Material mapped clay / fine sediment"
                  : riskHit
                    ? "Mapped clay / fine sediment present"
                    : "Trace mapped clay / fine sediment",
              explanation: `SGU mapping indicates clay / fine sediment across ${formatGroundPct(clayPct)} of the Candidate footprint. Screening-level mapped surficial geology — not a geotechnical investigation.`,
              whyItMatters: hardHit
                ? "The active screening profile treats this mapped class share as a reason not to proceed."
                : "Mapped fine-grained material warrants geotechnical verification before further development spend.",
              evidenceCategory: "ground_soil",
              provenance: "official",
              evaluated: true,
              measuredValue: `${formatGroundPct(clayPct)} clay / fine sediment`,
              threshold: hardHit
                ? `hard ≥ ${hardPct}%`
                : `risk ≥ ${clayRisk}% · major ≥ ${clayMajor}% (screening assumptions)`,
              automaticExclusion: hardHit,
              userActionRecommended: hardHit || majorHit || riskHit,
            }),
          );
          emittedRisk = true;
        }
      }

      if (!emittedRisk) {
        const label = dominant ? GROUND_GROUP_LABELS[dominant] : "Mapped surficial geology";
        rows.push(
          constraint({
            id: "ground_mapped_context",
            severity: "info",
            title: `Mapped ground: ${label}`,
            explanation: compositionText,
            whyItMatters:
              "Mapped ground composition is context for investigation planning. It is not a foundation recommendation or constructability finding.",
            evidenceCategory: "ground_soil",
            provenance: "official",
            evaluated: true,
            measuredValue: dominant ? GROUND_GROUP_LABELS[dominant] : "Evaluated",
            threshold: null,
            automaticExclusion: false,
            userActionRecommended: false,
          }),
        );
      }
    }
  }

  {
    const contaminationMode = input.contaminationMode === "hard" ? "hard" : "preference";
    const intersecting = input.contaminationIntersectingCount ?? 0;
    const nearby = input.contaminationNearbyCount ?? 0;
    const riskClasses = (input.contaminationRiskClasses ?? []).filter(
      (item) => item && item !== "unspecified",
    );
    const statuses = (input.contaminationStatuses ?? []).filter(Boolean);
    const classificationLabels = riskClasses.length > 0 ? riskClasses : statuses;
    const highRisk = riskClasses.some((item) => isHighOfficialRiskClass(item));
    const evidenceText = describeContaminationEvidence({
      intersectingCount: intersecting,
      nearbyCount: nearby,
      nearestM: input.contaminationNearestM,
      riskClasses: classificationLabels,
    });

    if (input.contaminationQueried !== true) {
      rows.push(
        constraint({
          id: "contamination_unavailable",
          severity: "unknown",
          title: "Environmental history evidence not evaluated",
          explanation:
            "Official potentially contaminated-site (EBH) records were not evaluated for this Candidate.",
          whyItMatters:
            "Screening-level environmental history is unknown. This is not a finding that environmental history is absent.",
          evidenceCategory: "environmental_history",
          provenance: "official",
          evaluated: false,
          measuredValue: null,
          threshold:
            contaminationMode === "hard"
              ? "hard exclusion when any official record intersects the footprint (screening assumption)"
              : "preference mode — intersecting records are risks, not automatic exclusions",
          automaticExclusion: false,
          userActionRecommended: true,
        }),
      );
    } else if (intersecting > 0) {
      const hardHit = contaminationMode === "hard";
      const measured =
        intersecting === 1
          ? `1 intersecting record${input.contaminationNearestM != null ? ` · nearest ${formatContaminationNearestM(input.contaminationNearestM)}` : ""}`
          : `${intersecting} intersecting records${input.contaminationNearestM != null ? ` · nearest ${formatContaminationNearestM(input.contaminationNearestM)}` : ""}`;
      rows.push(
        constraint({
          id: hardHit
            ? "contamination_hard_exclusion"
            : highRisk
              ? "contamination_high_risk_intersecting"
              : "contamination_intersecting_record",
          severity: hardHit ? "blocker" : highRisk ? "major_risk" : "risk",
          title: hardHit
            ? "Official environmental-history record intersects the hard exclusion profile"
            : highRisk
              ? "High official-risk environmental-history record intersects the footprint"
              : "Official environmental-history record intersects the footprint",
          explanation: evidenceText,
          whyItMatters: hardHit
            ? "The active screening profile treats an intersecting official EBH record as a reason not to proceed."
            : "Mapped environmental-history records warrant review before further land commitment. A registered record is not confirmed contamination of Candidate land.",
          evidenceCategory: "environmental_history",
          provenance: "official",
          evaluated: true,
          measuredValue: measured,
          threshold: hardHit
            ? "hard · any intersecting record"
            : highRisk
              ? "official high-risk classification (MIFO 1–2 / stor risk language)"
              : "any intersecting official EBH record",
          automaticExclusion: hardHit,
          userActionRecommended: true,
        }),
      );
    } else if (nearby > 0) {
      rows.push(
        constraint({
          id: "contamination_nearby_record",
          severity: "risk",
          title: "Official environmental-history record nearby",
          explanation: evidenceText,
          whyItMatters:
            "Nearby historical activity within the screening distance may affect investigation planning. Proximity is not confirmed contamination of the Candidate footprint.",
          evidenceCategory: "environmental_history",
          provenance: "official",
          evaluated: true,
          measuredValue: `${nearby} within ${CONTAMINATION_NEARBY_M} m${input.contaminationNearestM != null ? ` · nearest ${formatContaminationNearestM(input.contaminationNearestM)}` : ""}`,
          threshold: `nearby ≤ ${CONTAMINATION_NEARBY_M} m (screening assumption)`,
          automaticExclusion: false,
          userActionRecommended: true,
        }),
      );
    } else {
      rows.push(
        constraint({
          id: "contamination_no_mapped_records",
          severity: "info",
          title: "No mapped environmental-history records in the evaluated dataset",
          explanation: evidenceText,
          whyItMatters:
            "No mapped official EBH record nearby is not the same as absent environmental history. Other mechanisms and local conditions remain outside this screening.",
          evidenceCategory: "environmental_history",
          provenance: "official",
          evaluated: true,
          measuredValue: "0 intersecting · 0 nearby",
          threshold: null,
          automaticExclusion: false,
          userActionRecommended: false,
        }),
      );
    }
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
