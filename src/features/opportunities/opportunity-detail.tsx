"use client";

import { BellButton } from "@/components/layout/app-shell";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SourceBadge } from "@/components/ui/badges";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import {
  promoteOpportunityAction,
  rejectOpportunityAction,
  reopenOpportunityAction,
  updateOpportunityStatusAction,
} from "@/lib/opportunities/actions";
import {
  OPPORTUNITY_REJECT_REASON_VALUES,
  assessmentDimensionLabel,
  dimensionResultLabel,
  evidenceSourceLabel,
  opportunityConfidenceLabel,
  opportunityRecommendationLabel,
  opportunityRejectReasonLabel,
  opportunityStatusLabel,
  opportunityTechnologyLabel,
} from "@/lib/opportunities/catalog";
import type { DataSourceKind } from "@/types";
import Link from "next/link";

function sourceKindToBadge(value: string): DataSourceKind {
  if (value === "official") return "Official";
  if (value === "customer_data") return "Customer Data";
  return "NOXHEIM Analysis";
}

export function OpportunityDetailPage({
  item,
  notes,
  rejectionReason,
  rejectionNote,
  assessments,
  events,
  canWrite,
}: {
  item: OpportunityListItem;
  notes: string | null;
  rejectionReason: string | null;
  rejectionNote: string | null;
  assessments: Array<{
    dimension: string;
    result: string;
    explanation: string;
    sourceKind: string;
    completeness: string;
    assessedAt: string;
  }>;
  events: Array<{ id: string; title: string; detail: string | null; source: string; occurredAt: string }>;
  canWrite: boolean;
}) {
  const location = [item.municipality, item.region, item.country].filter(Boolean).join(", ");
  const positives = assessments.filter((row) => row.result === "strong" && row.completeness === "available");
  const risks = assessments.filter((row) => row.result === "review_required" || row.result === "excluded");
  const gaps = assessments.filter((row) => row.completeness === "insufficient");

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={`${opportunityTechnologyLabel(item.technology)} · ${location || "Location not set"}${item.ownerName ? ` · ${item.ownerName}` : ""}`}
        actions={
          <>
            <Link href="/opportunities" className={buttonClassName("secondary")}>
              All opportunities
            </Link>
            <BellButton />
          </>
        }
      />
      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
          <Fact label="Status" value={opportunityStatusLabel(item.status)} />
          <Fact label="Target" value={item.targetMw != null ? `${item.targetMw} MW` : "Not set"} />
          <Fact label="Energy" value={item.targetMwh != null ? `${item.targetMwh} MWh` : "Not set"} />
          <Fact label="Data confidence" value={opportunityConfidenceLabel(item.dataConfidence)} />
          <Fact label="Recommendation" value={opportunityRecommendationLabel(item.recommendation)} />
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Why NOXHEIM ranks this</h2>
          <p className="mt-2 text-sm leading-6">{item.recommendationSummary}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <SignalList title="Positive signals" items={positives.map((row) => row.explanation)} empty="No official or customer-positive signal stored yet." />
            <SignalList title="Risks" items={risks.map((row) => row.explanation)} empty="No stored risk dimension." />
            <SignalList title="Uncertainties" items={gaps.map((row) => row.explanation)} empty="No evidence gaps recorded." />
          </div>
          <p className="mt-4 text-xs text-muted">
            This is not a prediction of connection, feasibility or financial viability. Covering
            official geography is not available capacity.
          </p>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Origin</h2>
          <p className="mt-2 text-sm">
            {item.originatingRunId && item.originatingSearchId ? (
              <>
                Development Opportunity from a Site Suitability screening run.{" "}
                <Link
                  className="underline"
                  href={`/opportunities/searches/${item.originatingSearchId}/runs/${item.originatingRunId}`}
                >
                  Open originating candidate area
                </Link>
                {item.contiguousAreaHa != null
                  ? ` · snapshot contiguous usable area ${item.contiguousAreaHa.toFixed(1)} ha.`
                  : "."}{" "}
                Later dataset refreshes do not rewrite this snapshot.
              </>
            ) : (
              "Not saved from a geographic candidate area. Screening history is still stored on assessments and events."
            )}
          </p>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Assessment</h2>
          <ul className="mt-4 divide-y divide-line">
            {assessments.map((row) => (
              <li key={row.dimension} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{assessmentDimensionLabel(row.dimension)}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{dimensionResultLabel(row.result)}</span>
                    <SourceBadge source={sourceKindToBadge(row.sourceKind)} />
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted">{row.explanation}</p>
                <p className="mt-1 text-xs text-muted">{evidenceSourceLabel(row.sourceKind)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Sources</h2>
          {assessments.some((row) => row.sourceKind === "official") ? (
            <ul className="mt-3 space-y-2 text-sm">
              {assessments
                .filter((row) => row.sourceKind === "official")
                .map((row) => (
                  <li key={row.dimension}>
                    <SourceBadge source="Official" />
                    <span className="ml-2">{assessmentDimensionLabel(row.dimension)}</span>
                    <p className="mt-1 text-muted">{row.explanation}</p>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              No supported source evidence is available for this dimension yet.
            </p>
          )}
        </section>

        {notes ? (
          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Notes</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">{notes}</p>
          </section>
        ) : null}

        {item.status === "rejected" ? (
          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Rejection</h2>
            <p className="mt-2 text-sm">
              {rejectionReason ? opportunityRejectReasonLabel(rejectionReason) : "Rejected"}
              {rejectionNote ? ` · ${rejectionNote}` : ""}
            </p>
          </section>
        ) : null}

        {canWrite ? (
          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Decisions</h2>
            {item.status !== "promoted" && item.status !== "rejected" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <form action={updateOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={item.id} />
                  <input type="hidden" name="slug" value={item.slug} />
                  <input type="hidden" name="status" value="under_review" />
                  <Button type="submit" variant="secondary">
                    Under review
                  </Button>
                </form>
                <form action={updateOpportunityStatusAction}>
                  <input type="hidden" name="opportunityId" value={item.id} />
                  <input type="hidden" name="slug" value={item.slug} />
                  <input type="hidden" name="status" value="shortlisted" />
                  <Button type="submit" variant="secondary">
                    Shortlist
                  </Button>
                </form>
                <form action={promoteOpportunityAction}>
                  <input type="hidden" name="opportunityId" value={item.id} />
                  <Button type="submit">Promote to project</Button>
                </form>
              </div>
            ) : null}
            {item.status === "rejected" ? (
              <form action={reopenOpportunityAction} className="mt-4">
                <input type="hidden" name="opportunityId" value={item.id} />
                <input type="hidden" name="slug" value={item.slug} />
                <Button type="submit" variant="secondary">
                  Reopen
                </Button>
              </form>
            ) : item.status !== "promoted" ? (
              <form action={rejectOpportunityAction} className="mt-6 space-y-3">
                <input type="hidden" name="opportunityId" value={item.id} />
                <input type="hidden" name="slug" value={item.slug} />
                <label className="block text-sm">
                  <span className="text-muted">Reject reason</span>
                  <select name="reason" className="mt-1 h-9 w-full max-w-sm rounded-md border border-line bg-canvas px-3 text-sm">
                    {OPPORTUNITY_REJECT_REASON_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {opportunityRejectReasonLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-muted">Note</span>
                  <textarea name="note" rows={2} className="mt-1 w-full max-w-lg rounded-md border border-line bg-canvas px-3 py-2 text-sm" />
                </label>
                <Button type="submit" variant="danger">
                  Reject opportunity
                </Button>
              </form>
            ) : null}
            {item.promotedProjectId ? (
              <p className="mt-3 text-sm">
                Promoted. Continue in{" "}
                <Link
                  href={item.promotedProjectSlug ? `/projects/${item.promotedProjectSlug}` : "/portfolio"}
                  className="text-teal hover:underline"
                >
                  {item.promotedProjectSlug ? "the project" : "Portfolio"}
                </Link>
                .
              </p>
            ) : null}
          </section>
        ) : (
          <p className="text-sm text-muted">Viewers can inspect opportunities but cannot change them.</p>
        )}

        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Decision history</h2>
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No stored activity yet.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {events.map((event) => (
                <li key={event.id}>
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.detail ? <p className="text-sm text-muted">{event.detail}</p> : null}
                  <p className="text-xs text-muted">{event.source}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5">{value}</p>
    </div>
  );
}

function SignalList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {items.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
