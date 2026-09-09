import { getProjectDetailBySlug } from "@/lib/data/project-detail";
import { listGridOperators } from "@/lib/data/grid-operators";
import { getOfficialSourceHealth } from "@/lib/data/source-health";
import { ConnectionWorkspace } from "@/features/connection-workspace/connection-workspace";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProjectDetailBySlug(slug);
  if (result.kind !== "ok") {
    return { title: "Connection application" };
  }
  return { title: `${result.project.name} · Connection` };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [result, operators, sourceHealth] = await Promise.all([
    getProjectDetailBySlug(slug),
    listGridOperators(),
    getOfficialSourceHealth(),
  ]);

  if (result.kind === "not_found") {
    notFound();
  }

  if (result.kind === "error" || !result.project) {
    return (
      <>
        <PageHeader title="Connection application" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Could not load connection application"
            description="Try again from the project. If the problem continues, sign in again."
            action={
              <Link href={`/projects/${slug}`}>
                <Button>Open project</Button>
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <ConnectionWorkspace
        project={result.project}
        operators={operators}
        sourceHealth={sourceHealth}
        standalone
      />
    </div>
  );
}
