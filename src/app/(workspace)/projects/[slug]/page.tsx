import { getProjectDetailBySlug } from "@/lib/data/project-detail";
import { listGridOperators } from "@/lib/data/grid-operators";
import { getOfficialSourceHealth } from "@/lib/data/source-health";
import { ProjectPage } from "@/features/projects/project-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProjectDetailBySlug(slug);
  if (result.kind !== "ok") {
    return { title: "Project" };
  }
  return { title: result.project.name };
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

  return (
    <ProjectPage
      project={result.kind === "ok" ? result.project : null}
      error={result.kind === "error" ? result.message : null}
      operators={operators}
      sourceHealth={sourceHealth}
    />
  );
}
