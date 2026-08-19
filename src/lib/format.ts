import type {
  ApplicationReadiness,
  ChecklistItem,
  ChecklistStatus,
  ConnectionStage,
  Outlook,
  Project,
} from "@/types";

export function capacityMW(project: Pick<Project, "importMW" | "exportMW">): number {
  return Math.max(project.importMW, project.exportMW);
}

export function formatCapacity(project: Pick<Project, "importMW" | "exportMW">): string {
  if (project.importMW > 0 && project.exportMW > 0) {
    if (project.importMW === project.exportMW) {
      return `${project.importMW} / ${project.exportMW} MW`;
    }
    return `${project.importMW} / ${project.exportMW} MW`;
  }
  return `${capacityMW(project)} MW`;
}

export function formatCapacityShort(
  project: Pick<Project, "importMW" | "exportMW">,
): string {
  return `${capacityMW(project)} MW`;
}

export function formatMWTotal(mw: number): string {
  return `${mw.toLocaleString("en-GB")} MW`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatHeaderDate(iso = new Date().toISOString()): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelative(iso: string, now = new Date("2026-08-18T18:00:00+02:00")): string {
  const date = new Date(iso);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThatDay = new Date(date);
  startOfThatDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000,
  );

  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago`;
  return formatDate(iso);
}

export function daysUntil(iso: string, now = new Date("2026-08-18T12:00:00+02:00")): number {
  const target = new Date(iso);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export function computeReadiness(items: ChecklistItem[]): ApplicationReadiness {
  if (items.length === 0) return { percent: 0, items };
  const complete = items.filter((item) => item.status === "Complete").length;
  return {
    percent: Math.round((complete / items.length) * 100),
    items,
  };
}

export function isAttentionOutlook(outlook: Outlook): boolean {
  return outlook === "At Risk" || outlook === "Weak" || outlook === "Needs Attention";
}

export function outlookTone(
  outlook: Outlook,
): "success" | "warning" | "critical" | "neutral" {
  if (outlook === "Favourable") return "success";
  if (outlook === "Possible") return "warning";
  if (outlook === "Unknown") return "neutral";
  return "critical";
}

export function stageIndex(stage: ConnectionStage, stages: ConnectionStage[]): number {
  return stages.indexOf(stage);
}

const CHECKLIST_RANK: Record<ChecklistStatus, number> = {
  Complete: 4,
  "In Progress": 3,
  Incomplete: 2,
  "Not Started": 1,
  Missing: 0,
};

export function canCompleteChecklist(status: ChecklistStatus): boolean {
  return CHECKLIST_RANK[status] < 4;
}
