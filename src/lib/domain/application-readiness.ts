import type { ChecklistStatus } from "@/types";

export type ReadinessRequirement = {
  status: ChecklistStatus;
  required?: boolean;
};

export type ApplicationReadinessSummary = {
  percent: number | null;
  completeCount: number;
  requiredCount: number;
};

/**
 * Application readiness from project_requirements.
 * Only rows with required = true are counted. Optional rows never affect
 * the percentage. A required row is complete only when status is Complete.
 * Zero required rows → not available (null), never 100% or 0%.
 */
export function applicationReadinessFromRequirements(
  items: ReadinessRequirement[],
): ApplicationReadinessSummary {
  const required = items.filter((item) => item.required === true);
  if (required.length === 0) {
    return { percent: null, completeCount: 0, requiredCount: 0 };
  }

  const completeCount = required.filter((item) => item.status === "Complete").length;
  return {
    percent: Math.round((completeCount / required.length) * 100),
    completeCount,
    requiredCount: required.length,
  };
}
