import type { DevelopmentProfile } from "@/lib/domain/development-profile";
import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { AlertSeverity, Confidence, Outlook, Technology } from "@/types";

export type MapProjectAlert = {
  id: string;
  severity: AlertSeverity;
  title: string;
};

export type MapProjectConnectionCase = {
  caseId: string | null;
  status: string;
  nextMilestone: string | null;
  deadline: string | null;
};

export type MapProject = {
  id: string;
  slug: string;
  name: string;
  location: string;
  technology: Technology;
  importMW: number;
  exportMW: number;
  gridOperator: string;
  stage: OverviewPipelineStage;
  outlook: Outlook;
  confidence: Confidence;
  targetCOD: string;
  lastUpdated: string;
  latitude: number;
  longitude: number;
  hasCoordinates: boolean;
  readinessPercent: number | null;
  connectionCase: MapProjectConnectionCase | null;
  openAlerts: MapProjectAlert[];
  developmentProfile: DevelopmentProfile;
};

export type MapProjectsResult =
  | { kind: "ok"; projects: MapProject[] }
  | { kind: "no_organization" }
  | { kind: "error"; message: string };
