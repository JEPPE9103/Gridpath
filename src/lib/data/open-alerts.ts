import { cache } from "react";
import { getCurrentOrganization } from "@/lib/data/organization";
import { fetchAllQueryPages } from "@/lib/data/paged-select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertSeverity } from "@/types";

const SEVERITIES: AlertSeverity[] = ["critical", "warning", "info", "positive"];
const RECENT_ALERT_FETCH = 24;
const RECENT_ALERT_KEEP = 8;

function isAlertSeverity(value: string): value is AlertSeverity {
  return SEVERITIES.includes(value as AlertSeverity);
}

export type AlertCenterItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  projectName: string | null;
  href: string;
  createdAt: string;
};

export type AlertCenterSnapshot = {
  openCount: number;
  criticalCount: number;
  recent: AlertCenterItem[];
  canWrite: boolean;
};

type AlertCountRow = {
  id: string;
  severity: string;
  projects: { archived_at: string | null } | { archived_at: string | null }[] | null;
};

type AlertRow = {
  id: string;
  severity: string;
  title: string;
  href: string | null;
  created_at: string;
  project_id: string | null;
  projects: { name: string; slug: string; archived_at: string | null } | { name: string; slug: string; archived_at: string | null }[] | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isActiveAlert(row: { projects: AlertCountRow["projects"] | AlertRow["projects"] }): boolean {
  const project = asSingle(row.projects);
  return !project?.archived_at;
}

export async function getOpenCriticalAlertCountForCurrentOrganization(): Promise<number> {
  const snapshot = await getAlertCenterForCurrentOrganization();
  return snapshot.criticalCount;
}

export const getAlertCenterForCurrentOrganization = cache(async (): Promise<AlertCenterSnapshot> => {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { openCount: 0, criticalCount: 0, recent: [], canWrite: false };
  }

  const supabase = await createSupabaseServerClient();
  const [countsResult, recentResult] = await Promise.all([
    fetchAllQueryPages<AlertCountRow>(async (from, to) => {
      const page = await supabase
        .from("alerts")
        .select("id, severity, projects ( archived_at )")
        .eq("organization_id", organization.id)
        .eq("status", "open")
        .range(from, to);
      return { data: page.data as AlertCountRow[] | null, error: page.error };
    }),
    supabase
      .from("alerts")
      .select(
        `
        id,
        severity,
        title,
        href,
        created_at,
        project_id,
        projects ( name, slug, archived_at )
      `,
      )
      .eq("organization_id", organization.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(RECENT_ALERT_FETCH),
  ]);

  if (countsResult.error || recentResult.error) {
    console.error("getAlertCenterForCurrentOrganization failed", {
      counts: countsResult.error,
      recent: recentResult.error?.message,
    });
    return { openCount: 0, criticalCount: 0, recent: [], canWrite: false };
  }

  const active = countsResult.rows.filter(isActiveAlert);
  const recent: AlertCenterItem[] = [];
  for (const row of (recentResult.data ?? []) as AlertRow[]) {
    if (!isActiveAlert(row) || !isAlertSeverity(row.severity)) continue;
    const project = asSingle(row.projects);
    recent.push({
      id: row.id,
      severity: row.severity,
      title: row.title,
      projectName: project?.name ?? null,
      href: row.href?.trim() || (project?.slug ? `/projects/${project.slug}` : "/overview"),
      createdAt: row.created_at,
    });
    if (recent.length >= RECENT_ALERT_KEEP) break;
  }

  return {
    openCount: active.length,
    criticalCount: active.filter((row) => row.severity === "critical").length,
    recent,
    canWrite:
      organization.role === "owner" ||
      organization.role === "admin" ||
      organization.role === "member",
  };
});
