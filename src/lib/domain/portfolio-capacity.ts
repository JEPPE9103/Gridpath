/**
 * Portfolio MW for one project.
 *
 * Uses export_mw when it is greater than zero, otherwise import_mw.
 * This avoids counting both directions of a bidirectional battery as two
 * separate megawatts in organisation totals.
 */
export function portfolioCapacityMW(project: {
  importMW: number;
  exportMW: number;
}): number {
  if (project.exportMW > 0) {
    return project.exportMW;
  }
  return Math.max(0, project.importMW);
}

export function totalPortfolioMW(
  projects: Array<{ importMW: number; exportMW: number }>,
): number {
  return projects.reduce((sum, project) => sum + portfolioCapacityMW(project), 0);
}
