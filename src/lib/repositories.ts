import { alerts } from "@/data/alerts";
import { changes } from "@/data/changes";
import { connectionCases } from "@/data/connections";
import { impactMetrics } from "@/data/impact";
import { projects } from "@/data/projects";
import { computeReadiness } from "@/lib/format";
import type {
  Alert,
  ChecklistStatus,
  ConnectionCase,
  DocumentStatus,
  GridChange,
  ImpactMetrics,
  Project,
  ProjectDocument,
} from "@/types";

export interface WorkspaceOverlays {
  dismissedAlertIds: string[];
  readinessOverrides: Record<string, Record<string, ChecklistStatus>>;
  extraDocuments: ProjectDocument[];
  documentStatusOverrides: Record<string, DocumentStatus>;
}

export const emptyOverlays: WorkspaceOverlays = {
  dismissedAlertIds: [],
  readinessOverrides: {},
  extraDocuments: [],
  documentStatusOverrides: {},
};

function applyProjectOverlays(project: Project, overlays: WorkspaceOverlays): Project {
  const itemOverrides = overlays.readinessOverrides[project.id];
  const documents = [
    ...project.documents,
    ...overlays.extraDocuments.filter((doc) => doc.projectId === project.id),
  ].map((doc) => ({
    ...doc,
    status: overlays.documentStatusOverrides[doc.id] ?? doc.status,
  }));

  if (!itemOverrides) {
    return { ...project, documents };
  }

  const items = project.applicationReadiness.items.map((item) => ({
    ...item,
    status: itemOverrides[item.id] ?? item.status,
  }));

  return {
    ...project,
    documents,
    applicationReadiness: computeReadiness(items),
  };
}

export const projectRepository = {
  list(overlays: WorkspaceOverlays = emptyOverlays): Project[] {
    return projects.map((project) => applyProjectOverlays(project, overlays));
  },
  getById(id: string, overlays: WorkspaceOverlays = emptyOverlays): Project | undefined {
    const project = projects.find((item) => item.id === id);
    return project ? applyProjectOverlays(project, overlays) : undefined;
  },
};

export const alertRepository = {
  list(overlays: WorkspaceOverlays = emptyOverlays): Alert[] {
    const dismissed = new Set(overlays.dismissedAlertIds);
    return alerts.filter((alert) => !dismissed.has(alert.id));
  },
  all(): Alert[] {
    return alerts;
  },
};

export const documentRepository = {
  list(overlays: WorkspaceOverlays = emptyOverlays): ProjectDocument[] {
    const seeded = projects.flatMap((project) =>
      applyProjectOverlays(project, overlays).documents,
    );
    const extras = overlays.extraDocuments
      .filter((doc) => !seeded.some((item) => item.id === doc.id))
      .map((doc) => ({
        ...doc,
        status: overlays.documentStatusOverrides[doc.id] ?? doc.status,
      }));
    return [...seeded, ...extras].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  },
};

export const changeRepository = {
  list(): GridChange[] {
    return [...changes].sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
    );
  },
};

export const connectionRepository = {
  list(): ConnectionCase[] {
    return connectionCases;
  },
  getByProjectId(projectId: string): ConnectionCase | undefined {
    return connectionCases.find((item) => item.projectId === projectId);
  },
};

export const impactRepository = {
  get(): ImpactMetrics {
    return impactMetrics;
  },
};
