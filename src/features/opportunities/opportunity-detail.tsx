"use client";

import { BellButton } from "@/components/layout/app-shell";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Metric, MetricStrip, PageBody, SectionHeader } from "@/components/ui/workspace";
import { SourceBadge } from "@/components/ui/badges";
import { EvidenceCoveragePanel, NetworkCoveringNote, ProvenanceChip } from "@/features/opportunities/evidence-coverage-panel";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import {
  promoteOpportunityAction,
  rejectOpportunityAction,
  reopenOpportunityAction,
  rerunOpportunitySearchAction,
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
import {
  NETWORK_COVERING_NOTE,
  buildEvidenceCoverageFromAssessments,
  recommendationConfidenceCaption,
} from "@/lib/opportunities/evidence-coverage";
import type { DataSourceKind } from "@/types";
import dynamic from "next/dynamic";
import Link from "next/link";

const MiniMap = dynamic(() => import("@/features/map/mini-map").then((mod) => mod.MiniMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-md border border-line bg-canvas text-sm text-muted">
      Loading map…
    </div>
  ),
});

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
  reassessmentNotices = [],
  assessmentVersions = [],
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
  reassessmentNotices?: Array<{ id: string; providerSlug: string; notice: string; status: string; createdAt: string }>;
  assessmentVersions?: Array<{
    id: string;
    versionNumber: number;
    rankingVersion: string | null;
    methodologyVersion: string | null;
    changeSummary: string | null;
    createdAt: string;
  }>;
  canWrite: boolean;
}) {
  const location = [item.municipality, item.region, item.country].filter(Boolean).join(", ");
  const positives = assessments.filter((row) => row.result === "strong" && row.completeness === "available");
  const risks = assessments.filter((row) => row.result === "review_required" || row.result === "excluded");
  const gaps = assessments.filter((row) => row.completeness === "insufficient");
  const coverage = buildEvidenceCoverageFromAssessments({ assessments });
  const gridAssessment = assessments.find((row) => row.dimension === "grid_context");

  return (
    <>
      <PageHeader
        eyebrow="Discover"
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
      <PageBody>
        <MetricStrip className="sm:grid-cols-3 lg:grid-cols-5">
          <Metric label="Status" value={opportunityStatusLabel(item.status)} />
          <Metric
            label="Requested MW"
            value={item.targetMw != null ? `${item.targetMw} MW` : "Not set"}
            hint={item.targetMw != null ? "Customer entered" : undefined}
          />
          <Metric label="Energy" value={item.targetMwh != null ? `${item.targetMwh} MWh` : "Not set"} />
          <Metric label="Recommendation confidence" value={opportunityConfidenceLabel(item.dataConfidence)} />
          <Metric label="Recommendation" value={opportunityRecommendationLabel(item.recommendation)} />
        </MetricStrip>

        <section className="rounded-md border border-line bg-surface p-5">
          <SectionHeader title="Why this is interesting" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProvenanceChip label="Noxheim Derived" />
            {item.targetMw != null ? <ProvenanceChip label="Customer Entered" /> : null}
          </div>
          <p className="mt-2 text-sm leading-6">{item.recommendationSummary}</p>
          <p className="mt-2 text-xs text-muted">{recommendationConfidenceCaption(item.dataConfidence, coverage)}</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <SignalList title="Positive signals" items={positives.map((row) => row.explanation)} empty="No official or customer-positive signal stored yet." />
            <SignalList title="Risks" items={risks.map((row) => row.explanation)} empty="No stored risk dimension." />
            <SignalList title="Open questions" items={gaps.map((row) => row.explanation)} empty="No evidence gaps recorded." />
          </div>
          <div className="mt-4">
            <NetworkCoveringNote
              title={gridAssessment?.completeness === "available" ? "Official covering geography" : "Not evaluated"}
              detail={gridAssessment?.explanation}
              note={NETWORK_COVERING_NOTE}
            />
          </div>
        </section>

        {item.latitude != null && item.longitude != null ? (
          <section className="overflow-hidden rounded-md border border-line bg-surface">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold">Location</h2>
              <p className="mt-1 text-xs text-muted">Screening location. Not a cadastral parcel.</p>
            </div>
            <MiniMap latitude={item.latitude} longitude={item.longitude} outlook="Unknown" />
          </section>
        ) : null}

        <EvidenceCoveragePanel coverage={coverage} />

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

        {reassessmentNotices.length > 0 ? (
          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Reassessment available</h2>
            <p className="mt-2 text-sm text-muted">
              A newer official source version is available. Previous snapshots are kept. NOXHEIM does
              not rewrite this opportunity automatically.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {reassessmentNotices.map((notice) => (
                <li key={notice.id}>{notice.notice}</li>
              ))}
            </ul>
            {canWrite && item.originatingSearchId ? (
              <form action={rerunOpportunitySearchAction} className="mt-4">
                <input type="hidden" name="searchId" value={item.originatingSearchId} />
                <Button type="submit" variant="secondary">
                  Re-run originating search
                </Button>
              </form>
            ) : null}
          </section>
        ) : null}

        {assessmentVersions.length > 0 ? (
          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Assessment versions</h2>
            <p className="mt-2 text-sm text-muted">
              Each save or re-run that writes a snapshot is kept. Later source refreshes do not overwrite
              earlier versions.
            </p>
            <ol className="mt-3 space-y-2 text-sm">
              {assessmentVersions.map((version) => (
                <li key={version.id}>
                  Assessment v{version.versionNumber}
                  {version.rankingVersion ? ` · ${version.rankingVersion}` : ""}
                  {version.changeSummary ? ` — ${version.changeSummary}` : ""}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

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
            <h2 className="text-base font-semibold">Development decisions</h2>
            <p className="mt-1 text-sm text-muted">
              Shortlist, reject, reopen, or promote. These are team workflow actions, not official
              approval.
            </p>
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
          <h2 className="text-base font-semibold">Assessment history</h2>
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
      </PageBody>
    </>
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
