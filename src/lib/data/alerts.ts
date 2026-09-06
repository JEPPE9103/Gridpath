import { getCurrentOrganization } from "@/lib/data/organization";
import { fetchAllQueryPages } from "@/lib/data/paged-select";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertSeverity } from "@/types";

export type AlertListStatus = "open" | "dismissed" | "resolved" | "all";

export type WorkspaceAlertItem = {
  id: string;
  severity: AlertSeverity;
  status: "open" | "dismissed" | "resolved";
  alertType: string | null;
  title: string;
  summary: string;
  detail: string;
  projectName: string | null;
  projectSlug: string | null;
  href: string;
  createdAt: string;
};

const SEVERITIES: AlertSeverity[] = ["critical", "warning", "info", "positive"];

function isAlertSeverity(value: string): value is AlertSeverity {
  return SEVERITIES.includes(value as AlertSeverity);
}

type AlertRow = {
  id: string;
  severity: string;
  status: string;
  alert_type: string | null;
  title: string;
  summary: string | null;
  detail: string | null;
  href: string | null;
  created_at: string;
  projects: { name: string; slug: string; archived_at: string | null } | { name: string; slug: string; archived_at: string | null }[] | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getWorkspaceAlerts(input?: {
  status?: AlertListStatus;
}): Promise<{
  kind: "ok" | "no_organization" | "error";
  alerts: WorkspaceAlertItem[];
  canWrite: boolean;
}> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization", alerts: [], canWrite: false };
  }

  const supabase = await createSupabaseServerClient();
  const { rows, error } = await fetchAllQueryPages<AlertRow>(async (from, to) => {
    let query = supabase
      .from("alerts")
      .select(
        `
        id,
        severity,
        status,
        alert_type,
        title,
        summary,
        detail,
        href,
        created_at,
        projects ( name, slug, archived_at )
      `,
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (input?.status && input.status !== "all") {
      query = query.eq("status", input.status);
    }
    const page = await query;
    return { data: page.data as AlertRow[] | null, error: page.error };
  });

  if (error) {
    console.error("getWorkspaceAlerts failed", error);
    return { kind: "error", alerts: [], canWrite: false };
  }

  const alerts: WorkspaceAlertItem[] = [];
  for (const row of rows) {
    if (!isAlertSeverity(row.severity)) continue;
    if (row.status !== "open" && row.status !== "dismissed" && row.status !== "resolved") continue;
    const project = asSingle(row.projects);
    alerts.push({
      id: row.id,
      severity: row.severity,
      status: row.status,
      alertType: row.alert_type,
      title: row.title,
      summary: row.summary ?? "",
      detail: row.detail ?? "",
      projectName: project?.name ?? null,
      projectSlug: project?.slug ?? null,
      href: row.href?.trim() || (project?.slug ? `/projects/${project.slug}` : "/overview"),
      createdAt: row.created_at,
    });
  }

  return {
    kind: "ok",
    alerts,
    canWrite:
      organization.role === "owner" ||
      organization.role === "admin" ||
      organization.role === "member",
  };
}
