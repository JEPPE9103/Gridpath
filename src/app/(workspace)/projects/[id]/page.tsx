import { getProjectDetailBySlug } from "@/lib/data/project-detail";
import { ProjectPage } from "@/features/projects/project-page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Project" };
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getProjectDetailBySlug(id);

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
