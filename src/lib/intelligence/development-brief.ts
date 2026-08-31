import { attentionLevelLabel } from "@/lib/intelligence/project-attention";
import type {
  DevelopmentBriefInput,
  DevelopmentBriefSummary,
} from "@/lib/intelligence/types";

function readinessPhrase(input: DevelopmentBriefInput): string | null {
  const { readinessRequiredCount, readinessCompleteCount, readinessPercent } = input;
  if (readinessRequiredCount === 0) {
    return null;
  }
  if (readinessPercent === 100) {
    return "Required development actions are complete";
  }
  return `${readinessCompleteCount} of ${readinessRequiredCount} required development actions are complete`;
}

function officialContextPhrase(input: DevelopmentBriefInput): string {
  const { localNetworkAvailable, nupAvailable } = input.officialContext;
  if (localNetworkAvailable && nupAvailable) {
    return "Official grid context is available for this project";
  }
  if (localNetworkAvailable) {
    return "Official local-network context is available for this project";
  }
  if (nupAvailable) {
    return "Official network development plan context is available for this project";
  }
  return "Official grid context is not currently matched for this project";
}

function connectionCasePhrase(input: DevelopmentBriefInput): string | null {
  const connection = input.connectionCase;
  if (!connection) {
    return "No connection case has been created yet";
  }
  if (connection.status === "At Risk") {
    return "Connection case is currently At Risk";
  }
  if (connection.status === "Overdue") {
    return "Connection case is currently Overdue";
  }
  if (connection.status === "Waiting") {
    return "Connection case is currently Waiting";
  }
  if (connection.status === "On Track") {
    return "Connection case is currently On Track";
  }
  return `Connection case status is ${connection.status}`;
}

export function buildDevelopmentBriefSummary(
  input: DevelopmentBriefInput,
): DevelopmentBriefSummary {
  const statusLevel = input.attention.level;
  const statusLabel = attentionLevelLabel(statusLevel);

  if (statusLevel === "insufficient_data") {
    return {
      statusLabel,
      statusLevel,
      headline:
        "Project development information is still limited. Add connection and requirements data to build a clearer workflow picture.",
      attentionReasons: input.attention.reasons.slice(0, 4),
    };
  }

  const parts: string[] = [];
  const casePart = connectionCasePhrase(input);
  if (casePart) {
    parts.push(`${casePart}.`);
  }

  const readinessPart = readinessPhrase(input);
  if (readinessPart) {
    parts.push(`${readinessPart}.`);
  }

  parts.push(`${officialContextPhrase(input)}.`);

  if (statusLevel === "on_track" && input.connectionCase?.status === "On Track") {
    const headline =
      readinessPart && readinessPart.startsWith("Required development actions are complete")
        ? "Required development actions are complete. The connection case is currently On Track. Official grid context is available."
        : parts.join(" ");
    return {
      statusLabel,
      statusLevel,
      headline,
      attentionReasons: input.attention.reasons.slice(0, 4),
    };
  }

  return {
    statusLabel,
    statusLevel,
    headline: parts.join(" "),
    attentionReasons: input.attention.reasons.slice(0, 4),
  };
}

export function formatWorkflowReadinessLabel(
  percent: number | null,
  completeCount: number,
  requiredCount: number,
): string {
  if (requiredCount === 0) {
    return "Not available";
  }
  if (percent == null) {
    return `${completeCount} / ${requiredCount} required complete`;
  }
  return `${percent}%`;
}
