export const MAX_COMPARISON_PROJECTS = 4;

export function canWritePortfolioComparisons(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canReadPortfolioComparisons(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member" || role === "viewer";
}

export function normalizeComparisonName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function validateComparisonName(name: string): string | null {
  const normalized = normalizeComparisonName(name);
  if (!normalized) {
    return "Enter a name for this comparison.";
  }
  if (normalized.length > 120) {
    return "Use a shorter comparison name.";
  }
  return null;
}

export function canAddProjectToComparison(input: {
  projectOrganizationId: string;
  comparisonOrganizationId: string;
  archivedAt: string | null | undefined;
  alreadyInComparison: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (input.projectOrganizationId !== input.comparisonOrganizationId) {
    return { ok: false, error: "Projects must belong to this workspace." };
  }
  if (input.archivedAt && !input.alreadyInComparison) {
    return { ok: false, error: "Archived projects cannot be added to a comparison." };
  }
  return { ok: true };
}

export function planComparisonProjectUpdate(input: {
  existingProjectIds: string[];
  nextProjectIds: string[];
}): { toRemove: string[]; toAdd: string[]; toKeep: string[] } {
  const existing = new Set(input.existingProjectIds);
  const next = [...new Set(input.nextProjectIds)];
  return {
    toKeep: next.filter((id) => existing.has(id)),
    toAdd: next.filter((id) => !existing.has(id)),
    toRemove: input.existingProjectIds.filter((id) => !next.includes(id)),
  };
}

export function validateComparisonProjectCount(count: number): string | null {
  if (count < 1) {
    return "Select at least one project.";
  }
  if (count > MAX_COMPARISON_PROJECTS) {
    return "Up to four sites can be compared.";
  }
  return null;
}
