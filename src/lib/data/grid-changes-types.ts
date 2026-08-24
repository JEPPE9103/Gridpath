import type {
  ChangeImpactLevel,
  ChangeMatchType,
  ChangeReviewStatus,
  ExternalChangeSeverity,
  ExternalChangeType,
  GridAuthorityLevel,
  GridConfidence,
} from "@/lib/domain/grid-intelligence";
import type { Outlook, PipelineStage } from "@/types";

export type ObservationChangeKind = "added" | "removed" | "changed";

export type GridChangeSourceClass = "official" | "fixture" | "other";

export type GridChangeValueView = {
  semanticLabel: string;
  display: string;
  empty: boolean;
  numeric: boolean;
};

export type GridChangeProjectView = {
  id: string;
  slug: string;
  name: string;
  stage: PipelineStage | "Energisation";
  outlook: Outlook;
  importMW: number;
  exportMW: number;
};

export type GridChangeImpactView = {
  id: string;
  project: GridChangeProjectView | null;
  matchType: ChangeMatchType;
  matchTypeLabel: string;
  impactLevel: ChangeImpactLevel;
  reason: string;
  confidence: GridConfidence;
  confidenceLabel: string;
  reviewStatus: ChangeReviewStatus;
  reviewedAt: string | null;
};

export type GridChangeSourceView = {
  name: string;
  slug: string;
  publisher: string | null;
  authorityLevel: GridAuthorityLevel;
  authorityLabel: string;
  classification: GridChangeSourceClass;
  baseUrl: string | null;
  sourceUrl: string | null;
};

export type GridChangeAreaView = {
  name: string;
  areaType: string;
  areaTypeLabel: string;
  officialCompany: string | null;
  accountingUnit: string | null;
  planningScope: string | null;
  hasGeometry: boolean;
  missing: boolean;
};

export type GridChangeProvenanceView = {
  publisher: string | null;
  sourceName: string;
  authorityLabel: string;
  planningAreaName: string | null;
  previousSnapshotAt: string | null;
  previousSnapshotAtLabel: string;
  currentSnapshotAt: string | null;
  currentSnapshotAtLabel: string;
  detectedBy: string;
  confidence: GridConfidence;
  confidenceLabel: string;
  officialSourceUrl: string | null;
};

export type OrganizationGridChange = {
  id: string;
  title: string;
  summary: string | null;
  changeType: ExternalChangeType;
  changeTypeLabel: string;
  severity: ExternalChangeSeverity;
  detectedAt: string;
  detectedAtLabel: string;
  publishedAt: string | null;
  changeKind: ObservationChangeKind;
  changeKindLabel: string;
  before: GridChangeValueView | null;
  after: GridChangeValueView | null;
  source: GridChangeSourceView;
  area: GridChangeAreaView | null;
  impacts: GridChangeImpactView[];
  affectedProjectCount: number;
  reviewSummary: string;
  provenance: GridChangeProvenanceView;
};

export type GridSourceBaselineView = {
  slug: string;
  name: string;
  classification: GridChangeSourceClass;
  baselineEstablished: boolean;
  lastRetrievedAt: string | null;
  lastRetrievedAtLabel: string | null;
  lastPublishedAt: string | null;
  changeCount: number;
};

export type GridChangesResult =
  | {
      kind: "ok";
      changes: OrganizationGridChange[];
      sourceBaselines: GridSourceBaselineView[];
      canWrite: boolean;
    }
  | { kind: "no_organization" }
  | { kind: "error"; message: string };

export const CHANGE_TYPE_FILTERS: ExternalChangeType[] = [
  "capacity",
  "reinforcement",
  "constraint",
  "timeline",
  "requirement",
  "process",
  "tariff",
  "geography",
  "other",
];

export const CHANGE_SEVERITY_FILTERS: ExternalChangeSeverity[] = [
  "info",
  "positive",
  "warning",
  "critical",
];

export const CHANGE_REVIEW_FILTERS: ChangeReviewStatus[] = [
  "unreviewed",
  "confirmed",
  "dismissed",
];
