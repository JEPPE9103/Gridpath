export function ProvenanceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
      {label}
    </span>
  );
}

export function EvidenceStateMark({ state }: { state: "evaluated" | "not_evaluated" | "insufficient" }) {
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
