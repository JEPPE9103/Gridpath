import { formatDate } from "@/lib/format";
import type {
  OfficialGridAreaContext,
  OfficialNupContext,
} from "@/lib/domain/grid-intelligence";

export function OfficialDataFreshnessStrip({
  localNetwork,
  nup,
}: {
  localNetwork: OfficialGridAreaContext | null;
  nup: OfficialNupContext | null;
}) {
  const localProvenance = localNetwork?.provenance ?? null;
  const nupProvenance = nup?.provenance ?? null;
  const lastRetrieved = pickLatestDate(
    localProvenance?.retrievedAt ?? null,
    nupProvenance?.retrievedAt ?? null,
  );
  const planningPeriod = nupProvenance?.planningPeriod ?? null;
  const snapshotLabel = lastRetrieved ? formatDate(lastRetrieved) : null;

  if (!lastRetrieved && !planningPeriod) {
    return null;
  }

  return (
    <section className="rounded-md border border-line bg-canvas px-4 py-3 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Official source freshness
      </p>
      <dl className="mt-2 grid gap-2 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Last retrieved</dt>
          <dd className="font-medium text-ink">{lastRetrieved ? formatDate(lastRetrieved) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Source snapshot</dt>
          <dd className="font-medium text-ink">{snapshotLabel ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Planning period</dt>
          <dd className="font-medium text-ink">{planningPeriod ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-muted">
        Official source data is refreshed by NOXHEIM operations during the design partner phase.
      </p>
    </section>
  );
}

function pickLatestDate(left: string | null, right: string | null): string | null {
  if (!left) return right;
  if (!right) return left;
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}
