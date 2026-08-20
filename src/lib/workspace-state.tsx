"use client";

import { useToast } from "@/components/ui/toast-provider";
import { createPersistedStore } from "@/lib/persistence";
import {
  emptyOverlays,
  projectRepository,
  type WorkspaceOverlays,
} from "@/lib/repositories";
import type { ChecklistStatus, DocumentCategory, DocumentStatus, ProjectDocument } from "@/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

interface WorkspaceContextValue {
  ready: boolean;
  overlays: WorkspaceOverlays;
  compareIds: string[];
  dismissAlert: (id: string) => void;
  setChecklistStatus: (projectId: string, itemId: string, status: ChecklistStatus) => void;
  addDocument: (input: {
    name: string;
    projectId: string;
    category: DocumentCategory;
  }) => void;
  setDocumentStatus: (id: string, status: DocumentStatus) => void;
  addToCompare: (id: string, name?: string) => boolean;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const MAX_COMPARE = 4;

const overlaysStore = createPersistedStore<WorkspaceOverlays>("overlays", emptyOverlays);
const compareStore = createPersistedStore<string[]>("compareIds", []);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useToast();
  const overlays = useSyncExternalStore(
    overlaysStore.subscribe,
    overlaysStore.getSnapshot,
    overlaysStore.getServerSnapshot,
  );
  const compareIds = useSyncExternalStore(
    compareStore.subscribe,
    compareStore.getSnapshot,
    compareStore.getServerSnapshot,
  );

  const dismissAlert = useCallback(
    (id: string) => {
      overlaysStore.set((current) => ({
        ...current,
        dismissedAlertIds: [...new Set([...current.dismissedAlertIds, id])],
      }));
      pushToast({ title: "Alert dismissed", description: "Hidden for this browser session." });
    },
    [pushToast],
  );

  const setChecklistStatus = useCallback(
    (projectId: string, itemId: string, status: ChecklistStatus) => {
      overlaysStore.set((current) => ({
        ...current,
        readinessOverrides: {
          ...current.readinessOverrides,
          [projectId]: {
            ...(current.readinessOverrides[projectId] ?? {}),
            [itemId]: status,
          },
        },
      }));
      pushToast({
        title: "Application readiness updated",
        description: "Change stored locally for this demo.",
        tone: "success",
      });
    },
    [pushToast],
  );

  const addDocument = useCallback(
    (input: { name: string; projectId: string; category: DocumentCategory }) => {
      const doc: ProjectDocument = {
        id: `doc-local-${Date.now()}`,
        name: input.name,
        projectId: input.projectId,
        category: input.category,
        status: "Draft",
        updatedAt: new Date().toISOString(),
        owner: "Jesper Persson",
      };
      overlaysStore.set((current) => ({
        ...current,
        extraDocuments: [doc, ...current.extraDocuments],
      }));
      pushToast({
        title: "Placeholder document added",
        description: "No file was uploaded. This is demo-only.",
        tone: "success",
      });
    },
    [pushToast],
  );

  const setDocumentStatus = useCallback(
    (id: string, status: DocumentStatus) => {
      overlaysStore.set((current) => ({
        ...current,
        documentStatusOverrides: {
          ...current.documentStatusOverrides,
          [id]: status,
        },
      }));
      pushToast({ title: "Document status updated", tone: "success" });
    },
    [pushToast],
  );

  const addToCompare = useCallback(
    (id: string, name?: string) => {
      const current = compareStore.getSnapshot();
      if (current.includes(id)) return false;
      if (current.length >= MAX_COMPARE) {
        pushToast({
          title: "Compare limit reached",
          description: "Up to four sites can be compared.",
          tone: "warning",
        });
        return false;
      }
      compareStore.set([...current, id]);
      pushToast({
        title: "Added to compare",
        description: name ?? projectRepository.getById(id)?.name,
        tone: "success",
      });
      return true;
    },
    [pushToast],
  );

  const removeFromCompare = useCallback((id: string) => {
    compareStore.set((current) => current.filter((item) => item !== id));
  }, []);

  const clearCompare = useCallback(() => compareStore.set([]), []);

  const value = useMemo(
    () => ({
      ready: true,
      overlays,
      compareIds,
      dismissAlert,
      setChecklistStatus,
      addDocument,
      setDocumentStatus,
      addToCompare,
      removeFromCompare,
      clearCompare,
    }),
    [
      overlays,
      compareIds,
      dismissAlert,
      setChecklistStatus,
      addDocument,
      setDocumentStatus,
      addToCompare,
      removeFromCompare,
      clearCompare,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return context;
}
