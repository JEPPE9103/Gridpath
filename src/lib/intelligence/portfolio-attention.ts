import {
  attentionSortRank,
  deriveProjectAttention,
  earliestSignalDueAt,
} from "@/lib/intelligence/project-attention";
import type {
  PortfolioAttentionItem,
  PortfolioAttentionProjectInput,
  PortfolioAttentionResult,
} from "@/lib/intelligence/types";
import type { OverviewPipelineStage } from "@/lib/data/overview-types";

export const EMPTY_PORTFOLIO_ATTENTION: PortfolioAttentionResult = {
  needsAttention: [],
  watch: [],
  prioritized: [],
  actionRequiredCount: 0,
  upcomingCount: 0,
  reviewCount: 0,
};

function buildPortfolioSummary(
  input: PortfolioAttentionProjectInput,
  attention: ReturnType<typeof deriveProjectAttention>,
): string {
  const primary = attention.signals[0];
  if (primary?.detail) {
    return `${primary.title} · ${primary.detail}`;
  }
  if (primary) {
    return primary.title;
  }

  const parts: string[] = [];
  if (input.hasConnectionCase) {
    parts.push(input.stage);
  } else {
    parts.push(`${input.stage} · no connection case`);
  }
  return parts.join(" · ");
}

function toAttentionInput(project: PortfolioAttentionProjectInput) {
  return {
    stage: project.stage,
    confidence: project.confidence,
    targetCOD: project.targetCOD,
    connectionCaseStatus: project.connectionCaseStatus,
    connectionCaseStatusValue: project.connectionCaseStatusValue,
    hasConnectionCase: project.hasConnectionCase,
    requirements: project.requirements,
    openAlertSeverities: project.openAlertSeverities,
    unreviewedOfficialChangeCount: project.unreviewedOfficialChangeCount,
    connectionDeadline: project.connectionDeadline,
    nextMilestone: project.nextMilestone,
    connectionCaseCreatedAt: project.connectionCaseCreatedAt,
    connectionCaseOwnerAssigned: project.connectionCaseOwnerAssigned,
    events: project.events,
    lastActivityAt: project.lastActivityAt,
    unmatchedOfficialGeography: project.unmatchedOfficialGeography,
    projectSlug: project.slug,
    projectId: project.id,
  };
}

function compareAttentionItems(
  left: PortfolioAttentionItem & { _dueAt: string | null; _rank: number },
  right: PortfolioAttentionItem & { _dueAt: string | null; _rank: number },
): number {
  if (left._rank !== right._rank) {
    return left._rank - right._rank;
  }
  const leftDue = left._dueAt ?? "9999-12-31";
  const rightDue = right._dueAt ?? "9999-12-31";
  if (leftDue !== rightDue) {
    return leftDue.localeCompare(rightDue);
  }
  return left.name.localeCompare(right.name, "sv");
}

export function buildPortfolioAttention(
  projects: PortfolioAttentionProjectInput[],
  now: Date = new Date(),
): PortfolioAttentionResult {
  const needsAttention: Array<PortfolioAttentionItem & { _dueAt: string | null; _rank: number }> = [];
  const watch: Array<PortfolioAttentionItem & { _dueAt: string | null; _rank: number }> = [];
  const prioritized: Array<PortfolioAttentionItem & { _dueAt: string | null; _rank: number }> = [];

  for (const project of projects) {
    const attention = deriveProjectAttention(toAttentionInput(project), now);
    if (attention.band === "clear" || attention.level === "on_track" || attention.level === "insufficient_data") {
      continue;
    }
    if (attention.level !== "needs_attention" && attention.level !== "watch") {
      continue;
    }

    const item: PortfolioAttentionItem & { _dueAt: string | null; _rank: number } = {
      id: project.id,
      slug: project.slug,
      name: project.name,
      level: attention.level,
      band: attention.band,
      summary: buildPortfolioSummary(project, attention),
      priorityScore: attention.priorityScore,
      stage: project.stage,
      daysInCurrentStage: attention.daysInCurrentStage,
      lastActivityAt: attention.lastActivityAt,
      nextAction: attention.nextAction,
      signals: attention.signals,
      _dueAt: earliestSignalDueAt(attention.signals),
      _rank: attentionSortRank(attention),
    };

    prioritized.push(item);
    if (attention.level === "needs_attention") {
      needsAttention.push(item);
    } else {
      watch.push(item);
    }
  }

  const strip = (
    items: Array<PortfolioAttentionItem & { _dueAt: string | null; _rank: number }>,
  ): PortfolioAttentionItem[] =>
    [...items]
      .sort(compareAttentionItems)
      .map(({ _dueAt: _d, _rank: _r, ...item }) => item);

  const sortedNeeds = strip(needsAttention);
  const sortedWatch = strip(watch);
  const sortedPrioritized = strip(prioritized);

  return {
    needsAttention: sortedNeeds,
    watch: sortedWatch,
    prioritized: sortedPrioritized,
    actionRequiredCount: sortedNeeds.length,
    upcomingCount: sortedPrioritized.filter((item) => item.band === "attention").length,
    reviewCount: sortedPrioritized.filter((item) => item.band === "review").length,
  };
}

export function portfolioAttentionCounts(result: PortfolioAttentionResult): {
  needsAttention: number;
  watch: number;
} {
  return {
    needsAttention: result.needsAttention.length,
    watch: result.watch.length,
  };
}

/** Overview / Reports KPI — same list as Portfolio Attention action-required. */
export function countNeedsAttentionProjects(
  projects: PortfolioAttentionProjectInput[],
  now?: Date,
): number {
  return buildPortfolioAttention(projects, now).needsAttention.length;
}

export function projectIdsNeedingAttention(
  projects: PortfolioAttentionProjectInput[],
  now?: Date,
): Set<string> {
  return new Set(buildPortfolioAttention(projects, now).needsAttention.map((item) => item.id));
}

export function stageLabelForSummary(stage: OverviewPipelineStage): string {
  return stage;
}

export type PortfolioAttentionFilter = "all" | "action" | "needs_attention" | "official_changes";

export function projectAttentionById(
  projects: PortfolioAttentionProjectInput[],
  now: Date = new Date(),
): Map<string, ReturnType<typeof deriveProjectAttention>> {
  const map = new Map<string, ReturnType<typeof deriveProjectAttention>>();
  for (const project of projects) {
    map.set(project.id, deriveProjectAttention(toAttentionInput(project), now));
  }
  return map;
}

export function matchesPortfolioAttentionFilter(
  item: Pick<PortfolioAttentionItem, "band" | "signals"> | null,
  filter: PortfolioAttentionFilter,
): boolean {
  if (filter === "all") {
    return true;
  }
  if (!item) {
    return false;
  }
  if (filter === "action") {
    return item.band === "action";
  }
  if (filter === "needs_attention") {
    return item.band === "action" || item.band === "attention";
  }
  return item.signals.some((signal) => signal.type === "unreviewed_official_changes");
}
