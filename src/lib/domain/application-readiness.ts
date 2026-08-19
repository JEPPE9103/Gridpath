import type { ChecklistStatus } from "@/types";

export type ReadinessRequirement = {
  status: ChecklistStatus;
  required?: boolean;
};

export type ApplicationReadinessSummary = {
  percent: number;
  completeCount: number;
  requiredCount: number;
};

/**
 * Application readiness from project_requirements.
 * complete counts as complete; every other status is incomplete.
 * Only required items are in the denominator. When `required` is omitted,
 * the item is treated as required (the current schema has no required flag).
 */
export function applicationReadinessFromRequirements(
  items: ReadinessRequirement[],
): ApplicationReadinessSummary {
  const required = items.filter((item) => item.required !== false);
  if (required.length === 0) {
    return { percent: 0, completeCount: 0, requiredCount: 0 };
  }

  const completeCount = required.filter((item) => item.status === "Complete").length;
  return {
    percent: Math.round((completeCount / required.length) * 100),
    completeCount,
    requiredCount: required.length,
  };
}
