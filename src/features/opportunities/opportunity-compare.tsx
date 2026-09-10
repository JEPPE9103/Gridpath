import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import {
  assessmentDimensionLabel,
  opportunityConfidenceLabel,
  opportunityRecommendationLabel,
  opportunityStatusLabel,
  opportunityTechnologyLabel,
} from "@/lib/opportunities/catalog";
import { canCompareOpportunities, compareRecommendation } from "@/lib/opportunities/compare";
import Link from "next/link";

export function OpportunityComparePage({
  items,
  assessmentsById,
}: {
  items: OpportunityListItem[];
  assessmentsById: Map<string, Array<{ dimension: string; result: string; explanation: string }>>;
}) {
  const allowed = canCompareOpportunities(items.length);
  if (!allowed.ok) {
    return (
      <>
        <PageHeader title="Compare opportunities" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState title="Select opportunities to compare" description={allowed.error} />
        </div>
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
        title="Compare opportunities"
        subtitle="Why one candidate ranks above another, based on stored evidence — not a success score."
      />
      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {leader && ranked[1] ? (
          <p className="text-sm">
            {leader.name} ranks above {ranked[1].name} because its stored recommendation is
            “{opportunityRecommendationLabel(leader.recommendation)}” versus “
            {opportunityRecommendationLabel(ranked[1].recommendation)}”. This is current evidence,
            not a prediction of connection.
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-line px-3 py-2 text-left font-medium text-muted">Dimension</th>
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
              <tr>
                <td className="border-b border-line px-3 py-2 text-muted">Technology</td>
                {items.map((item) => (
                  <td key={item.id} className="border-b border-line px-3 py-2">
                    {opportunityTechnologyLabel(item.technology)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b border-line px-3 py-2 text-muted">Status</td>
                {items.map((item) => (
                  <td key={item.id} className="border-b border-line px-3 py-2">
                    {opportunityStatusLabel(item.status)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b border-line px-3 py-2 text-muted">Recommendation</td>
                {items.map((item) => (
                  <td key={item.id} className="border-b border-line px-3 py-2">
                    {opportunityRecommendationLabel(item.recommendation)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b border-line px-3 py-2 text-muted">Recommendation confidence</td>
                {items.map((item) => (
                  <td key={item.id} className="border-b border-line px-3 py-2">
                    {opportunityConfidenceLabel(item.dataConfidence)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b border-line px-3 py-2 text-muted">Network area</td>
                {items.map((item) => (
                  <td key={item.id} className="border-b border-line px-3 py-2">
                    Official covering geography — not an indication of available connection capacity.
                    {item.keyPositive ? ` ${item.keyPositive}` : ""}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="border-b border-line px-3 py-2 text-muted">Target MW</td>
                {items.map((item) => (
                  <td key={item.id} className="border-b border-line px-3 py-2">
                    {item.targetMw ?? "—"}
                  </td>
                ))}
              </tr>
              {dimensions.map((dimension) => (
                <tr key={dimension}>
                  <td className="border-b border-line px-3 py-2 text-muted">
                    {assessmentDimensionLabel(dimension)}
                  </td>
                  {items.map((item) => {
                    const row = assessmentsById.get(item.id)?.find((entry) => entry.dimension === dimension);
                    return (
                      <td key={item.id} className="border-b border-line px-3 py-2 align-top">
                        {row ? row.result.replaceAll("_", " ") : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
