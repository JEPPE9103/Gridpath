import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PageBody, tableWrapClass } from "@/components/ui/workspace";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import {
  assessmentDimensionLabel,
  opportunityConfidenceLabel,
  opportunityRecommendationLabel,
  opportunityStatusLabel,
  opportunityTechnologyLabel,
} from "@/lib/opportunities/catalog";
import { canCompareOpportunities, compareRecommendation } from "@/lib/opportunities/compare";
import { buildEvidenceCoverageFromAssessments } from "@/lib/opportunities/evidence-coverage";
import { cn } from "@/lib/cn";
import Link from "next/link";

type CompareAssessment = {
  dimension: string;
  result: string;
  explanation: string;
  completeness?: string;
  sourceKind?: string;
};

export function OpportunityComparePage({
  items,
  assessmentsById,
}: {
  items: OpportunityListItem[];
  assessmentsById: Map<string, CompareAssessment[]>;
}) {
  const allowed = canCompareOpportunities(items.length);
  if (!allowed.ok) {
    return (
      <>
        <PageHeader eyebrow="Discover" title="Compare opportunities" />
        <PageBody>
          <EmptyState title="Select opportunities to compare" description={allowed.error} />
        </PageBody>
      </>
    );
  }

  const ranked = [...items].sort((left, right) =>
    compareRecommendation(left.recommendation, right.recommendation),
  );
  const leader = ranked[0];
  const dimensions = assessmentsById.get(items[0]?.id ?? "")?.map((row) => row.dimension) ?? [
    "grid_context",
    "grid_proximity",
    "land_suitability",
    "environmental",
    "planning",
    "access",
    "strategic_fit",
  ];

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Compare opportunities"
        subtitle="Why investigate one site instead of another, from stored evidence — not a success score."
      />
      <PageBody>
        {leader && ranked[1] ? (
          <p className="text-sm">
            <span className="font-medium">{leader.name}</span> ranks above {ranked[1].name} because
            its stored recommendation is “{opportunityRecommendationLabel(leader.recommendation)}”
            versus “{opportunityRecommendationLabel(ranked[1].recommendation)}”. This is current
            evidence, not a prediction of connection.
          </p>
        ) : null}
        <div className={tableWrapClass}>
          <table className="min-w-full border-collapse text-sm">
            <thead className="bg-canvas">
              <tr>
                <th className="border-b border-line px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted">
                  Dimension
                </th>
                {items.map((item) => (
                  <th key={item.id} className="border-b border-line px-3 py-2 text-left">
                    <Link href={`/opportunities/${item.slug}`} className="text-teal hover:underline">
                      {item.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow label="Technology" items={items}>
                {(item) => opportunityTechnologyLabel(item.technology)}
              </CompareRow>
              <CompareRow label="Status" items={items}>
                {(item) => opportunityStatusLabel(item.status)}
              </CompareRow>
              <CompareRow label="Recommendation" items={items} emphasize>
                {(item) => opportunityRecommendationLabel(item.recommendation)}
              </CompareRow>
              <CompareRow label="Recommendation confidence" items={items}>
                {(item) => opportunityConfidenceLabel(item.dataConfidence)}
              </CompareRow>
              <CompareRow label="Usable area" items={items}>
                {(item) =>
                  item.contiguousAreaHa != null ? `${item.contiguousAreaHa.toFixed(1)} ha` : "—"
                }
              </CompareRow>
              <CompareRow label="Target MW" items={items}>
                {(item) =>
                  item.targetMw != null ? `${item.targetMw} MW (customer-entered)` : "Not set"
                }
              </CompareRow>
              <CompareRow label="Evidence coverage" items={items}>
                {(item) => {
                  const coverage = coverageFor(item.id, assessmentsById);
                  return `${coverage.evaluatedCount}/${coverage.totalCount} evaluated`;
                }}
              </CompareRow>
              <CompareRow label="Unresolved evidence" items={items}>
                {(item) => {
                  const coverage = coverageFor(item.id, assessmentsById);
                  return coverage.missingLabels.length > 0
                    ? coverage.missingLabels.join(", ")
                    : "None recorded";
                }}
              </CompareRow>
              <CompareRow label="Network geography" items={items}>
                {(item) =>
                  item.keyPositive
                    ? `${item.keyPositive} Official covering geography — not available capacity.`
                    : "Official covering geography — not an indication of available connection capacity."
                }
              </CompareRow>
              <CompareRow label="Key risk" items={items}>
                {(item) => item.keyRisk ?? "No stored risk yet."}
              </CompareRow>
              {dimensions.map((dimension) => (
                <tr key={dimension}>
                  <td className="border-b border-line px-3 py-2 text-muted">
                    {assessmentDimensionLabel(dimension)}
                  </td>
                  {items.map((item) => {
                    const row = assessmentsById.get(item.id)?.find((entry) => entry.dimension === dimension);
                    const missing = !row || row.completeness === "insufficient" || row.result === "unknown";
                    return (
                      <td
                        key={item.id}
                        className={cn(
                          "border-b border-line px-3 py-2 align-top",
                          missing && "text-muted",
                        )}
                      >
                        {row ? row.result.replaceAll("_", " ") : "Not evaluated"}
                        {row?.completeness === "insufficient" ? " · missing evidence" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}

function coverageFor(
  id: string,
  assessmentsById: Map<string, CompareAssessment[]>,
) {
  return buildEvidenceCoverageFromAssessments({
    assessments: (assessmentsById.get(id) ?? []).map((row) => ({
      dimension: row.dimension,
      completeness: row.completeness ?? "insufficient",
      sourceKind: row.sourceKind ?? "derived",
      explanation: row.explanation,
    })),
  });
}

function CompareRow({
  label,
  items,
  emphasize,
  children,
}: {
  label: string;
  items: OpportunityListItem[];
  emphasize?: boolean;
  children: (item: OpportunityListItem) => string;
}) {
  return (
    <tr>
      <td className="border-b border-line px-3 py-2 text-muted">{label}</td>
      {items.map((item) => (
        <td
          key={item.id}
          className={cn("border-b border-line px-3 py-2 align-top", emphasize && "font-medium")}
        >
          {children(item)}
        </td>
      ))}
    </tr>
  );
}
