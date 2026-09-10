import { cn } from "@/lib/cn";
import {
  provenanceCustomerLabel,
  type EvidenceCoverageItem,
  type EvidenceCoverageView,
  type EvidenceState,
} from "@/lib/opportunities/evidence-coverage";

export function EvidenceCoveragePanel({
  coverage,
  compact = false,
}: {
  coverage: EvidenceCoverageView;
  compact?: boolean;
}) {
  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Evidence coverage</h2>
        <p className="text-xs text-muted">{coverage.summary}</p>
      </div>
      <ul className={cn("mt-3", compact ? "space-y-2" : "divide-y divide-line")}>
        {coverage.items.map((item) => (
          <EvidenceCoverageRow key={item.id} item={item} compact={compact} />
        ))}
      </ul>
    </section>
  );
}

function EvidenceCoverageRow({
  item,
  compact,
}: {
  item: EvidenceCoverageItem;
  compact: boolean;
}) {
  const provenance = provenanceCustomerLabel(item.provenance);
  return (
    <li className={cn(compact ? "" : "py-2.5")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.label}</p>
          <p className="mt-0.5 text-xs text-muted">{item.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {provenance ? <ProvenanceChip label={provenance} /> : null}
          <EvidenceStateMark state={item.state} />
        </div>
      </div>
      {item.sourceDetail && item.state === "evaluated" ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-ink">Source details</summary>
          <dl className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-2">
            <div>
              <dt className="uppercase tracking-wide">Provider</dt>
              <dd className="text-ink">{item.sourceDetail.provider}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wide">Dataset</dt>
              <dd className="text-ink">{item.sourceDetail.dataset}</dd>
            </div>
            {item.sourceDetail.version ? (
              <div>
                <dt className="uppercase tracking-wide">Version</dt>
                <dd className="text-ink">{item.sourceDetail.version}</dd>
              </div>
            ) : null}
            {item.sourceDetail.nativeResolution ? (
              <div>
                <dt className="uppercase tracking-wide">Native resolution</dt>
                <dd className="text-ink">{item.sourceDetail.nativeResolution}</dd>
              </div>
            ) : null}
            {item.sourceDetail.processingResolution ? (
              <div>
                <dt className="uppercase tracking-wide">Screening processing</dt>
                <dd className="text-ink">{item.sourceDetail.processingResolution}</dd>
              </div>
            ) : null}
            {item.sourceDetail.snapshot ? (
              <div className="sm:col-span-2">
                <dt className="uppercase tracking-wide">Source snapshot</dt>
                <dd className="break-all font-mono text-[11px] text-ink">{item.sourceDetail.snapshot}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      ) : null}
    </li>
  );
}

export function EvidenceStateMark({ state }: { state: EvidenceState }) {
  if (state === "evaluated") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink">
        <span aria-hidden="true">✓</span>
        Evaluated
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <span aria-hidden="true">—</span>
      Not evaluated
    </span>
  );
}

export function ProvenanceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
      {label}
    </span>
  );
}

export function NetworkCoveringNote({
  title,
  detail,
  note,
}: {
  title: string;
  detail?: string;
  note: string;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted">Network area</p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      {detail ? <p className="mt-0.5 text-xs text-muted">{detail}</p> : null}
      <p className="mt-1 text-xs leading-5 text-muted">{note}</p>
    </div>
  );
}
