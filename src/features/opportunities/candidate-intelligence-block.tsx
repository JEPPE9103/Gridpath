import {
  constraintSeverityLabel,
  type CandidateConstraint,
  type ConstraintSeverity,
} from "@/lib/opportunities/constraints";
import {
  investigationPriorityLabel,
  type NextInvestigation,
} from "@/lib/opportunities/investigations";
import type { CandidateIntelligence } from "@/lib/opportunities/candidate-intelligence";
import { ProvenanceChip } from "@/features/opportunities/evidence-coverage-panel";
import { evidenceSourceLabel } from "@/lib/opportunities/catalog";

const SEVERITY_ORDER: ConstraintSeverity[] = ["blocker", "major_risk", "risk", "unknown", "info"];

function ConstraintList({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: CandidateConstraint[];
  compact?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-md border border-line bg-canvas px-3 py-2">
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted">{item.explanation}</p>
            {compact ? null : <p className="mt-1 text-xs text-muted">Why it matters: {item.whyItMatters}</p>}
            <p className="mt-1 text-[11px] text-muted">
              {constraintSeverityLabel(item.severity)} · {evidenceSourceLabel(item.provenance)}
              {item.evaluated ? "" : " · not evaluated"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CandidateIntelligenceBlock({
  intelligence,
  compact = false,
}: {
  intelligence: CandidateIntelligence;
  compact?: boolean;
}) {
  const grouped = Object.fromEntries(
    SEVERITY_ORDER.map((severity) => [severity, intelligence.constraints.filter((item) => item.severity === severity)]),
  ) as Record<ConstraintSeverity, CandidateConstraint[]>;
  const problemItems = [...grouped.blocker, ...grouped.major_risk, ...grouped.risk];
  const unknownItems = grouped.unknown.filter((item) => item.id !== "residential_not_evaluated");

  return (
    <div className="space-y-4">
      {intelligence.rankPositives.length > 0 || intelligence.rankNegatives.length > 0 ? (
        <div className={compact ? "space-y-2" : "grid gap-4 sm:grid-cols-2"}>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Why this site ranks</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {intelligence.rankPositives.length
                ? intelligence.rankPositives.map((item) => <li key={item}>{item}</li>)
                : <li className="text-muted">No stored positive ranking reason</li>}
            </ul>
          </div>
          {compact ? null : (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">What holds it back</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {intelligence.rankNegatives.length
                  ? intelligence.rankNegatives.map((item) => <li key={item}>{item}</li>)
                  : <li className="text-muted">No stored negative ranking reason</li>}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-3">
        {compact ? (
          <ConstraintList title="What could be a problem" items={problemItems} compact />
        ) : (
          <>
            <ConstraintList title="Blockers" items={grouped.blocker} />
            <ConstraintList title="Major risks" items={grouped.major_risk} />
            <ConstraintList title="Risks" items={grouped.risk} />
          </>
        )}
        <ConstraintList title="What we do not know" items={unknownItems} compact={compact} />
        <ConstraintList title={compact ? "Evaluated (not a verdict)" : "Info"} items={grouped.info} compact={compact} />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">What to investigate next</h3>
        {intelligence.nextInvestigations.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No further screening investigations were generated from current evidence.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {intelligence.nextInvestigations.map((item: NextInvestigation, index) => (
              <li key={item.id} className="rounded-md border border-line px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  {index + 1}. {investigationPriorityLabel(item.priority)}
                </p>
                <p className="mt-0.5 text-sm font-medium">{item.action}</p>
                <p className="mt-0.5 text-xs text-muted">{item.reason}</p>
                {compact ? null : <p className="mt-1 text-xs text-muted">Why it matters: {item.whyItMatters}</p>}
                <p className="mt-1 text-[11px] text-muted">{item.evidenceSource}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ProvenanceChip label="Noxheim Derived interpretation of Official Source evidence" />
    </div>
  );
}
