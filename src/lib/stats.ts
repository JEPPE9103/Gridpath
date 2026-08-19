import { capacityMW, isAttentionOutlook } from "@/lib/format";
import type { PipelineStage, Project } from "@/types";
import { PIPELINE_STAGES } from "@/types";

export function totalCapacityMW(projects: Project[]): number {
  return projects.reduce((sum, project) => sum + capacityMW(project), 0);
}

export function countByStage(projects: Project[]): Record<PipelineStage, number> {
  const counts = Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<
    PipelineStage,
    number
  >;
  for (const project of projects) {
    counts[project.stage] += 1;
  }
  return counts;
}

export function kpis(projects: Project[]) {
  const enquiry = projects.filter((project) => project.stage === "Enquiry").length;
  const studies = projects.filter((project) => project.stage === "Grid Study").length;
  const attention = projects.filter((project) => isAttentionOutlook(project.outlook)).length;

  return {
    activeSites: projects.length,
    totalMW: totalCapacityMW(projects),
    connectionEnquiries: enquiry,
    gridStudiesOpen: studies,
    needsAttention: attention,
  };
}

export function averageReadiness(projects: Project[]): number {
  if (projects.length === 0) return 0;
  const sum = projects.reduce(
    (total, project) => total + project.applicationReadiness.percent,
    0,
  );
  return Math.round(sum / projects.length);
}

export function mwByOperator(projects: Project[]): Array<{ operator: string; mw: number; count: number }> {
  const map = new Map<string, { mw: number; count: number }>();
  for (const project of projects) {
    const current = map.get(project.gridOperator) ?? { mw: 0, count: 0 };
    current.mw += capacityMW(project);
    current.count += 1;
    map.set(project.gridOperator, current);
  }
  return [...map.entries()]
    .map(([operator, value]) => ({ operator, ...value }))
    .sort((a, b) => b.mw - a.mw);
}

export function countByOutlook(projects: Project[]) {
  const map = new Map<string, number>();
  for (const project of projects) {
    map.set(project.outlook, (map.get(project.outlook) ?? 0) + 1);
  }
  return [...map.entries()].map(([outlook, count]) => ({ outlook, count }));
}
