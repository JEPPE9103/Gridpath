import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { Confidence, Outlook } from "@/types";

export type DevelopmentProfileFactor = {
  key: string;
  direction: "positive" | "negative" | "neutral";
  label: string;
  points: number;
};

export type DevelopmentProfile = {
  score: number;
  factors: DevelopmentProfileFactor[];
};

export type DevelopmentProfileInput = {
  outlook: Outlook;
  confidence: Confidence;
  stage: OverviewPipelineStage;
  readinessPercent: number | null;
  openCriticalAlerts: number;
  openWarningAlerts: number;
  connectionCaseStatus: string | null;
};

/**
 * Transparent NOXHEIM development-profile ranking.
 * Uses stored customer/project workflow data only — not live grid capacity.
 *
 * Outlook (stored project assessment):
 *   Favourable +24, Possible 0, Unknown 0, Needs Attention -12, At Risk -16, Weak -16
 * Confidence:
 *   High +12, Medium +6, Low +2, Unknown 0
 * Application readiness (required items only; null = not available):
 *   round(percent * 0.2), so 100% = +20
 * Connection process validation (not an asset-quality ranking):
 *   Prospect 0, Screened +2, Enquiry +6, Application +10, Grid Study +12,
 *   Offer +16, Agreement +16, Construction +8, Energisation +8
 *   Construction/energisation are capped below offer/agreement so later
 *   operational stages are not treated as a stronger connection case.
 * Open alerts:
 *   each critical -12, each warning -6
 * Connection case:
 *   waiting -6, at risk -8, overdue -10
 */
export function calculateDevelopmentProfile(
  project: DevelopmentProfileInput,
): DevelopmentProfile {
  const factors: DevelopmentProfileFactor[] = [
    outlookFactor(project.outlook),
    confidenceFactor(project.confidence),
    readinessFactor(project.readinessPercent),
    stageFactor(project.stage),
  ];

  if (project.openCriticalAlerts > 0) {
    const points = project.openCriticalAlerts * -12;
    factors.push({
      key: "critical_alerts",
      direction: "negative",
      label:
        project.openCriticalAlerts === 1
          ? "Open critical alert"
          : `${project.openCriticalAlerts} open critical alerts`,
      points,
    });
  }

  if (project.openWarningAlerts > 0) {
    const points = project.openWarningAlerts * -6;
    factors.push({
      key: "warning_alerts",
      direction: "negative",
      label:
        project.openWarningAlerts === 1
          ? "Open warning alert"
          : `${project.openWarningAlerts} open warning alerts`,
      points,
    });
  }

  const caseFactor = connectionCaseFactor(project.stage, project.connectionCaseStatus);
  if (caseFactor) {
    factors.push(caseFactor);
  }

  const score = factors.reduce((sum, factor) => sum + factor.points, 0);
  return { score, factors };
}

export function rankByDevelopmentProfile<T extends { developmentProfile: DevelopmentProfile; name: string }>(
  projects: T[],
): T[] {
  return [...projects].sort((a, b) => {
    const delta = b.developmentProfile.score - a.developmentProfile.score;
    if (delta !== 0) {
      return delta;
    }
    return a.name.localeCompare(b.name, "sv");
  });
}

export function strongestDevelopmentProfile<T extends { developmentProfile: DevelopmentProfile; name: string }>(
  projects: T[],
): T | undefined {
  return rankByDevelopmentProfile(projects)[0];
}

export function rankingExplanation(): string {
  return "Portfolio comparison ranked from team outlook, team confidence, application readiness, connection process state and open attention items. Development triage only — not an official grid score, capacity score, AI site score or feasibility assessment.";
}

function outlookFactor(outlook: Outlook): DevelopmentProfileFactor {
  switch (outlook) {
    case "Favourable":
      return { key: "outlook", direction: "positive", label: "Favourable outlook", points: 24 };
    case "Possible":
      return { key: "outlook", direction: "neutral", label: "Possible outlook", points: 0 };
    case "Unknown":
      return {
        key: "outlook",
        direction: "neutral",
        label: "Unknown outlook — limited signal",
        points: 0,
      };
    case "Needs Attention":
      return { key: "outlook", direction: "negative", label: "Needs-attention outlook", points: -12 };
    case "At Risk":
      return { key: "outlook", direction: "negative", label: "At risk outlook", points: -16 };
    case "Weak":
      return { key: "outlook", direction: "negative", label: "Weak outlook", points: -16 };
  }
}

function confidenceFactor(confidence: Confidence): DevelopmentProfileFactor {
  switch (confidence) {
    case "High":
      return { key: "confidence", direction: "positive", label: "High confidence", points: 12 };
    case "Medium":
      return { key: "confidence", direction: "neutral", label: "Medium confidence", points: 6 };
    case "Low":
      return { key: "confidence", direction: "neutral", label: "Low confidence", points: 2 };
    case "Unknown":
      return { key: "confidence", direction: "neutral", label: "Unknown confidence", points: 0 };
  }
}

function readinessFactor(percent: number | null): DevelopmentProfileFactor {
  if (percent == null) {
    return {
      key: "readiness",
      direction: "neutral",
      label: "Application readiness not available",
      points: 0,
    };
  }
  const points = Math.round(percent * 0.2);
  return {
    key: "readiness",
    direction: points > 0 ? "positive" : "neutral",
    label: `${percent}% application readiness`,
    points,
  };
}

function stageFactor(stage: OverviewPipelineStage): DevelopmentProfileFactor {
  const pointsByStage: Record<OverviewPipelineStage, number> = {
    Prospect: 0,
    Screened: 2,
    Enquiry: 6,
    Application: 10,
    "Grid Study": 12,
    Offer: 16,
    Agreement: 16,
    Construction: 8,
    Energisation: 8,
  };
  const points = pointsByStage[stage] ?? 0;
  return {
    key: "stage",
    direction: points >= 10 ? "positive" : points > 0 ? "neutral" : "neutral",
    label: `${stage} stage — process validation`,
    points,
  };
}

function connectionCaseFactor(
  stage: OverviewPipelineStage,
  status: string | null,
): DevelopmentProfileFactor | null {
  if (!status) {
    return null;
  }
  if (status === "Waiting") {
    return {
      key: "connection_case",
      direction: "negative",
      label:
        stage === "Enquiry"
          ? "Connection enquiry still awaiting response"
          : "Connection case awaiting operator response",
      points: -6,
    };
  }
  if (status === "At Risk") {
    return {
      key: "connection_case",
      direction: "negative",
      label: "Connection case at risk",
      points: -8,
    };
  }
  if (status === "Overdue") {
    return {
      key: "connection_case",
      direction: "negative",
      label: "Connection case overdue",
      points: -10,
    };
  }
  return null;
}
