"use client";

import { useToast } from "@/components/ui/toast-provider";
import { createPersistedStore } from "@/lib/persistence";
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
  compareIds: string[];
  addToCompare: (id: string, name?: string) => boolean;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  setCompareIds: (ids: string[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const MAX_COMPARE = 4;

const compareStore = createPersistedStore<string[]>("compareIds", []);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { pushToast } = useToast();
  const compareIds = useSyncExternalStore(
    compareStore.subscribe,
    compareStore.getSnapshot,
    compareStore.getServerSnapshot,
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
        description: name
          ? `${name} is saved in this browser only.`
          : "Selection is saved in this browser only.",
        tone: "success",
      });
      return true;
    },
    [pushToast],
  );

  const removeFromCompare = useCallback((id: string) => {
    compareStore.set(compareStore.getSnapshot().filter((item) => item !== id));
  }, []);

  const clearCompare = useCallback(() => {
    compareStore.set([]);
  }, []);

  const setCompareIds = useCallback(
    (ids: string[]) => {
      const unique = [...new Set(ids)].slice(0, MAX_COMPARE);
      compareStore.set(unique);
      pushToast({
        title: "Temporary compare updated",
        description: "Saved in this browser only until you save it for the team.",
        tone: "success",
      });
    },
    [pushToast],
  );

  const value = useMemo(
    () => ({
      ready: true,
      compareIds,
      addToCompare,
      removeFromCompare,
      clearCompare,
      setCompareIds,
    }),
    [compareIds, addToCompare, removeFromCompare, clearCompare, setCompareIds],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return value;
}
