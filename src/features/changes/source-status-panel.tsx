import { TechnicalDetails } from "@/components/ui/workspace";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

export type SourceStatusRow = {
  slug: string;
  name: string;
  publisher: string | null;
  healthLabel: string;
  delayed: boolean;
  changeLabel: string;
  lastKnownAt: string | null;
};

export function SourceStatusPanel({ sources }: { sources: SourceStatusRow[] }) {
  if (sources.length === 0) {
    return (
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Monitored sources</h2>
        <p className="mt-2 text-sm text-muted">
          Official source status will appear here after Monitor tables are applied.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Monitored sources</h2>
        <p className="mt-1 text-xs text-muted">
          Status of supported official publications. Available means the last successful ingest is
          within cadence. Degraded means stale or failed. Not configured means no successful ingest
          yet. This is not real-time grid monitoring.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-canvas text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Dataset / context</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Last known state</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.slug} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-2.5 font-medium">{source.name}</td>
                <td className="px-4 py-2.5 text-muted">{source.publisher || "Official publication"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      source.healthLabel === "Available" && "bg-success-bg text-success",
                      source.healthLabel === "Degraded" && "bg-warning-bg text-warning",
                      (source.healthLabel === "Not configured" || source.healthLabel === "Not evaluated") &&
                        "bg-canvas text-muted",
                    )}
                  >
                    {source.healthLabel}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <p className="text-sm text-ink">
                    {source.changeLabel !== "—" ? source.changeLabel : "No stored change state"}
                  </p>
                  {source.lastKnownAt ? (
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(source.lastKnownAt)}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted">No stored retrieval time</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3">
        <TechnicalDetails summary="Technical diagnostics">
          <ul className="space-y-1">
            {sources.map((source) => (
              <li key={`${source.slug}-detail`}>
                {source.name}
                {source.delayed ? " · currently delayed" : ""}
                {source.lastKnownAt ? ` · last known ${formatDateTime(source.lastKnownAt)}` : ""}
              </li>
            ))}
          </ul>
        </TechnicalDetails>
      </div>
    </section>
  );
}
