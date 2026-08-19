import { ProjectPage } from "@/features/projects/project-page";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Project" };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-sm text-muted sm:px-6 lg:px-8">Loading project…</div>
      }
    >
      <ProjectPage projectId={id} />
    </Suspense>
  );
}
