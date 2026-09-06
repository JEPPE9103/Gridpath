import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getOfficialSourceHealth } from "@/lib/data/source-health";
import { formatDateTime } from "@/lib/format";
import { isNoxheimOperator } from "@/lib/operator/authorize";
import { logError } from "@/lib/observability/log";
import { createSupabaseServiceClient, getSupabaseServiceRoleKey } from "@/lib/supabase/service";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

type IngestionRunRow = {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  trigger_type: string;
  source_changed: boolean | null;
  observations_processed: number | null;
  external_changes_created: number | null;
  impacts_created: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  grid_sources: { slug: string; name: string } | { slug: string; name: string }[] | null;
};

type DeliveryRow = {
  id: string;
  created_at: string;
  kind: string;
  status: string;
  error_code: string | null;
  organization_id: string;
};

type DemoRequestRow = {
  id: string;
  created_at: string;
  name: string;
  company: string;
  email: string;
};

export default async function OperationsPage() {
  const user = await getCurrentUserProfile();
  if (!user || !isNoxheimOperator({ email: user.email, userId: user.id })) {
    notFound();
  }
  if (!getSupabaseServiceRoleKey()) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-lg font-semibold">Operations</h1>
        <p className="mt-2 text-sm text-muted">Service role is not configured on this environment.</p>
      </main>
    );
  }

  const supabase = createSupabaseServiceClient();
  const [{ data: runs, error: runsError }, { data: deliveries, error: deliveryError }, { data: demos, error: demoError }, sources] =
    await Promise.all([
      supabase
        .from("source_ingestion_runs")
        .select(
          "id, started_at, completed_at, status, trigger_type, source_changed, observations_processed, external_changes_created, impacts_created, error_code, error_message, metadata, grid_sources ( slug, name )",
        )
        .order("started_at", { ascending: false })
        .limit(40),
      supabase
        .from("notification_deliveries")
        .select("id, created_at, kind, status, error_code, organization_id")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("demo_requests")
        .select("id, created_at, name, company, email")
        .order("created_at", { ascending: false })
        .limit(25),
      getOfficialSourceHealth(),
    ]);

  if (runsError) logError("operator.runs_failed", { message: runsError.message });
  if (deliveryError) logError("operator.deliveries_failed", { message: deliveryError.message });
  if (demoError) logError("operator.demo_requests_failed", { message: demoError.message });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <header>
        <p className="text-xs uppercase tracking-wide text-muted">Noxheim operators only</p>
        <h1 className="mt-1 text-lg font-semibold">Operations</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Global source runs, failed notification deliveries, and demo requests. Customer
          organisations cannot see this page. Error text is sanitized; document contents are never
          logged here.
        </p>
      </header>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Source health</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {sources.map((source) => (
            <li key={source.sourceId} className="rounded-md border border-line bg-canvas p-3">
              <p className="font-medium">
                {source.name} — {source.isRunning ? "running" : source.healthLabel}
              </p>
              <p className="text-xs text-muted">
                Last full ingest {formatMaybe(source.lastFullIngestAt)} · last attempt{" "}
                {source.lastAttemptStatus ?? "—"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Recent ingestion runs</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-3">Started</th>
                <th className="py-1 pr-3">Source</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Trigger</th>
                <th className="py-1 pr-3">Obs / changes / impacts</th>
                <th className="py-1 pr-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {((runs ?? []) as IngestionRunRow[]).map((run) => {
                const source = Array.isArray(run.grid_sources) ? run.grid_sources[0] : run.grid_sources;
                const probeOnly =
                  run.metadata && typeof run.metadata === "object"
                    ? Boolean((run.metadata as { probe_only?: boolean }).probe_only)
                    : false;
                return (
                  <tr key={run.id} className="border-t border-line">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(run.started_at)}</td>
                    <td className="py-2 pr-3">{source?.slug ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {run.status}
                      {probeOnly ? " (probe-only)" : ""}
                    </td>
                    <td className="py-2 pr-3">{run.trigger_type}</td>
                    <td className="py-2 pr-3">
                      {run.observations_processed ?? "—"} / {run.external_changes_created ?? "—"} /{" "}
                      {run.impacts_created ?? "—"}
                    </td>
                    <td className="py-2 pr-3">{run.error_code ?? run.error_message ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Failed notification deliveries</h2>
        {!(deliveries ?? []).length ? (
          <p className="mt-2 text-sm text-muted">No failed deliveries in the latest rows.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {((deliveries ?? []) as DeliveryRow[]).map((row) => (
              <li key={row.id}>
                {formatDateTime(row.created_at)} · {row.kind} · {row.error_code ?? "failed"}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Demo requests</h2>
        {!(demos ?? []).length ? (
          <p className="mt-2 text-sm text-muted">No demo requests loaded.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {((demos ?? []) as DemoRequestRow[]).map((row) => (
              <li key={row.id}>
                {formatDateTime(row.created_at)} · {row.company} · {row.name}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function formatMaybe(value: string | null): string {
  if (!value) return "—";
  return formatDateTime(value);
}
