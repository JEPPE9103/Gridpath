import { getProjectDetailBySlug } from "@/lib/data/project-detail";
import { ProjectPage } from "@/features/projects/project-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

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
  const result = await getProjectDetailBySlug(slug);

  if (result.kind === "not_found") {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-sm text-muted sm:px-6 lg:px-8">Loading project…</div>
      }
    >
      <ProjectPage
        project={result.kind === "ok" ? result.project : null}
        error={result.kind === "error" ? result.message : null}
      />
    </Suspense>
  );
}
