/**
 * Deterministic next-investigation planner for Candidate Sites.
 * Rule-based. Not AI. Missing evidence never becomes a favourable action.
 */

import { opportunityCopyContainsForbiddenTerm } from "@/lib/opportunities/copy";
import {
  type CandidateConstraint,
  type ConstraintSeverity,
} from "@/lib/opportunities/constraints";

export const INVESTIGATION_SEMANTICS_VERSION = "next-investigation-v1";

export const INVESTIGATION_PRIORITIES = ["now", "next", "later"] as const;

export type InvestigationPriority = (typeof INVESTIGATION_PRIORITIES)[number];

export type NextInvestigation = {
  id: string;
  priority: InvestigationPriority;
  action: string;
  reason: string;
  whyItMatters: string;
  evidenceSource: string;
  constraintId: string;
  constraintSeverity: ConstraintSeverity;
};

const PRIORITY_ORDER: Record<InvestigationPriority, number> = {
  now: 0,
  next: 1,
  later: 2,
};

const MAX_INVESTIGATIONS = 5;

const SKIP_AS_INVESTIGATION = new Set(["residential_not_evaluated"]);

function investigation(row: NextInvestigation): NextInvestigation {
  const forbidden = opportunityCopyContainsForbiddenTerm(
    `${row.action} ${row.reason} ${row.whyItMatters}`,
  );
  if (forbidden) {
    throw new Error(`Investigation copy contains forbidden term: ${forbidden}`);
  }
  return row;
}

export function investigationPriorityLabel(priority: InvestigationPriority): string {
  switch (priority) {
    case "now":
      return "Now";
    case "next":
      return "Next";
    default:
      return "Later";
  }
}

export function investigationPriorityRank(priority: InvestigationPriority): number {
  return PRIORITY_ORDER[priority];
}

function priorityFor(constraint: CandidateConstraint): InvestigationPriority {
  if (constraint.severity === "blocker" || constraint.severity === "major_risk") return "now";
  if (constraint.severity === "unknown") {
    if (
      constraint.id === "terrain_unavailable" ||
      constraint.id === "road_unavailable" ||
      constraint.id === "land_cover_unavailable" ||
      constraint.id === "protected_not_evaluated" ||
      constraint.id === "natura_not_evaluated" ||
      constraint.id === "flood_unavailable" ||
      constraint.id === "ground_unavailable" ||
      constraint.id === "contamination_unavailable"
    ) {
      return "now";
    }
    return "next";
  }
  if (
    constraint.id === "contamination_intersecting_record" ||
    constraint.id === "contamination_high_risk_intersecting"
  ) {
    return "now";
  }
  if (constraint.severity === "risk") return "next";
  return "later";
}

function actionFor(constraint: CandidateConstraint): { action: string; evidenceSource: string } | null {
  switch (constraint.id) {
    case "screening_exclusion":
      return null;
    case "geometry_review":
      return {
        action: "Manually review the usable footprint",
        evidenceSource: "Noxheim Derived screening geometry",
      };
    case "terrain_unavailable":
      return {
        action: "Obtain coarse terrain/slope evidence for the Search Area",
        evidenceSource: "Official Source — Copernicus DEM GLO-90 (when ingested)",
      };
    case "terrain_above_preference":
      return {
        action: "Review slope against the screening profile with a site visit or finer DTM",
        evidenceSource: "Official Source — coarse slope summaries",
      };
    case "detailed_terrain_unavailable":
      return {
        action: "Review detailed terrain / earthworks with higher-resolution elevation",
        evidenceSource: "Official Source — Lantmäteriet 1 m DTM (not applied here)",
      };
    case "road_unavailable":
      return {
        action: "Confirm construction and heavy-vehicle access",
        evidenceSource: "Official Source — Trafikverket RoadLink (not evaluated)",
      };
    case "road_beyond_preference":
      return {
        action: "Confirm whether a viable access track can reach the Candidate",
        evidenceSource: "Official Source — Trafikverket RoadLink",
      };
    case "road_proximity_evaluated":
      return {
        action: "Confirm construction and heavy-vehicle access on site",
        evidenceSource: "Official Source — Trafikverket RoadLink (proximity, not access approval)",
      };
    case "land_cover_unavailable":
      return {
        action: "Obtain official land-cover evidence for the Search Area",
        evidenceSource: "Official Source — Naturvårdsverket NMD",
      };
    case "protected_not_evaluated":
    case "natura_not_evaluated":
      return {
        action: "Confirm official environmental geography before proceeding",
        evidenceSource: "Official Source — Naturvårdsverket",
      };
    case "flood_unavailable":
      return {
        action: "Obtain flood/water evidence before land commitment",
        evidenceSource: "Official Source — MSB/MCF översvämningskartering (not evaluated)",
      };
    case "flood_hard_exclusion":
    case "flood_major_overlap":
    case "flood_edge_overlap":
    case "flood_trace_overlap":
      return {
        action: "Review mapped flood exposure and site drainage implications",
        evidenceSource: "Official Source — MSB/MCF översvämningskartering (BHF)",
      };
    case "ground_unavailable":
      return {
        action: "Obtain ground-condition evidence before major land commitment",
        evidenceSource: "Official Source — SGU Jordarter 1:25 000–1:100 000",
      };
    case "ground_peat_hard_exclusion":
    case "ground_peat_major":
    case "ground_peat_risk":
      return {
        action:
          "Review ground conditions and potential settlement/foundation implications with a geotechnical specialist",
        evidenceSource: "Official Source — SGU Jordarter (grundlager)",
      };
    case "ground_clay_hard_exclusion":
    case "ground_clay_major":
    case "ground_clay_risk":
      return {
        action: "Verify ground conditions with geotechnical investigation",
        evidenceSource: "Official Source — SGU Jordarter (grundlager)",
      };
    case "contamination_unavailable":
      return {
        action: "Obtain contamination/environmental-history evidence",
        evidenceSource: "Official Source — Länsstyrelserna EBH (not evaluated)",
      };
    case "contamination_hard_exclusion":
    case "contamination_intersecting_record":
    case "contamination_high_risk_intersecting":
      return {
        action: "Review environmental history before land commitment",
        evidenceSource: "Official Source — Länsstyrelserna EBH (potentiellt förorenade områden)",
      };
    case "contamination_nearby_record":
      return {
        action: "Review whether nearby historical activity could affect Candidate",
        evidenceSource: "Official Source — Länsstyrelserna EBH (potentiellt förorenade områden)",
      };
    case "network_covering_capacity_unknown":
    case "network_covering_none":
      return {
        action: "Assess grid connection separately with the network operator",
        evidenceSource: "Official Source — Ei covering geography (not capacity)",
      };
    case "network_covering_unavailable":
      return {
        action: "Identify the covering local-network operator",
        evidenceSource: "Official Source — Ei network area concessions",
      };
    default:
      return {
        action: constraint.title,
        evidenceSource: constraint.provenance === "official" ? "Official Source" : "Noxheim Derived",
      };
  }
}

export function deriveNextInvestigations(constraints: CandidateConstraint[]): NextInvestigation[] {
  const planned: NextInvestigation[] = [];
  for (const constraint of constraints) {
    if (!constraint.userActionRecommended) continue;
    if (SKIP_AS_INVESTIGATION.has(constraint.id)) continue;
    if (constraint.severity === "blocker" && constraint.automaticExclusion) continue;
    const mapped = actionFor(constraint);
    if (!mapped) continue;
    planned.push(
      investigation({
        id: `investigate_${constraint.id}`,
        priority: priorityFor(constraint),
        action: mapped.action,
        reason: constraint.explanation,
        whyItMatters: constraint.whyItMatters,
        evidenceSource: mapped.evidenceSource,
        constraintId: constraint.id,
        constraintSeverity: constraint.severity,
      }),
    );
  }

  planned.sort((left, right) => {
    const byPriority = investigationPriorityRank(left.priority) - investigationPriorityRank(right.priority);
    if (byPriority !== 0) return byPriority;
    return left.id.localeCompare(right.id);
  });

  const seenActions = new Set<string>();
  const unique: NextInvestigation[] = [];
  for (const item of planned) {
    if (seenActions.has(item.action)) continue;
    seenActions.add(item.action);
    unique.push(item);
    if (unique.length >= MAX_INVESTIGATIONS) break;
  }
  return unique;
}
