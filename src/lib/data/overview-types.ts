import { PIPELINE_STAGES, type AlertSeverity, type Outlook, type Technology } from "@/types";

export const OVERVIEW_PIPELINE_STAGES = [...PIPELINE_STAGES, "Energisation"] as const;

export type OverviewPipelineStage = (typeof OVERVIEW_PIPELINE_STAGES)[number];

export type OverviewProject = {
  id: string;
  name: string;
  location: string;
  technology: Technology;
  importMW: number;
  exportMW: number;
  stage: OverviewPipelineStage;
  outlook: Outlook;
  lastUpdated: string;
};

export type OverviewAlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  detail: string;
  projectName: string | null;
  projectSlug: string | null;
  gridOperator: string | null;
  detectedAt: string;
  ctaLabel: string;
  href: string;
};

export type OverviewKpis = {
  activeSites: number;
  totalMW: number;
  connectionEnquiries: number;
  gridStudiesOpen: number;
  needsAttention: number;
};

export type PortfolioOverview =
  | {
      kind: "ok";
      organizationName: string;
      kpis: OverviewKpis;
      alerts: OverviewAlertItem[];
      projects: OverviewProject[];
      recentProjects: OverviewProject[];
      error: null;
    }
  | {
      kind: "no_organization";
      organizationName: null;
      kpis: OverviewKpis;
      alerts: OverviewAlertItem[];
      projects: OverviewProject[];
      recentProjects: OverviewProject[];
      error: null;
    }
  | {
      kind: "error";
      organizationName: string | null;
      kpis: OverviewKpis;
      alerts: OverviewAlertItem[];
      projects: OverviewProject[];
      recentProjects: OverviewProject[];
      error: string;
    };
