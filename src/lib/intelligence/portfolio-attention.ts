import { deriveProjectAttention } from "@/lib/intelligence/project-attention";
import type {
  PortfolioAttentionItem,
  PortfolioAttentionProjectInput,
  PortfolioAttentionResult,
} from "@/lib/intelligence/types";
import type { OverviewPipelineStage } from "@/lib/data/overview-types";

function buildPortfolioSummary(
  input: PortfolioAttentionProjectInput,
  level: "needs_attention" | "watch",
): string {
  const parts: string[] = [];
  const statusValue =
    input.connectionCaseStatusValue ??
    input.connectionCaseStatus?.trim().toLowerCase().replace(/\s+/g, "_") ??
    null;

  if (statusValue === "at_risk") {
    parts.push(`At-risk ${input.stage}`);
  } else if (statusValue === "overdue") {
    parts.push(`Overdue connection case · ${input.stage}`);
  } else if (statusValue === "waiting") {
    parts.push(`Waiting connection case · ${input.stage}`);
  } else if (input.hasConnectionCase) {
    parts.push(`${input.stage}`);
  } else {
    parts.push(`${input.stage} · no connection case`);
  }

  if (input.readinessRequiredCount > 0) {
    if (input.readinessPercent != null) {
      parts.push(`${input.readinessCompleteCount}/${input.readinessRequiredCount} required actions complete`);
    } else {
      parts.push(`${input.readinessRequiredCount} required actions tracked`);
    }
  }

  if (level === "needs_attention") {
    const overdue = input.requirements.filter(
      (item) =>
        item.required &&
        item.status !== "Complete" &&
        item.dueDate &&
        new Date(`${item.dueDate}T00:00:00`).getTime() < Date.now(),
    ).length;
    if (overdue > 0) {
      parts.push(
        overdue === 1 ? "1 overdue required action" : `${overdue} overdue required actions`,
      );
    }
  }

  return parts.join(" · ");
}

export function buildPortfolioAttention(
  projects: PortfolioAttentionProjectInput[],
): PortfolioAttentionResult {
  const needsAttention: PortfolioAttentionItem[] = [];
  const watch: PortfolioAttentionItem[] = [];

  for (const project of projects) {
    const attention = deriveProjectAttention({
      stage: project.stage,
      confidence: project.confidence,
      targetCOD: project.targetCOD,
      connectionCaseStatus: project.connectionCaseStatus,
      connectionCaseStatusValue: project.connectionCaseStatusValue,
      hasConnectionCase: project.hasConnectionCase,
      requirements: project.requirements,
      openAlertSeverities: project.openAlertSeverities,
    });

    if (attention.level !== "needs_attention" && attention.level !== "watch") {
      continue;
    }

    const item: PortfolioAttentionItem = {
      id: project.id,
      slug: project.slug,
      name: project.name,
      level: attention.level,
      summary: buildPortfolioSummary(project, attention.level),
      priorityScore: attention.priorityScore,
      stage: project.stage,
    };

    if (attention.level === "needs_attention") {
      needsAttention.push(item);
    } else {
      watch.push(item);
    }
  }

  const sortItems = (items: PortfolioAttentionItem[]) =>
    [...items].sort((a, b) => {
      const scoreDelta = b.priorityScore - a.priorityScore;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return a.name.localeCompare(b.name, "sv");
    });

  return {
    needsAttention: sortItems(needsAttention),
    watch: sortItems(watch),
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

export function stageLabelForSummary(stage: OverviewPipelineStage): string {
  return stage;
}
