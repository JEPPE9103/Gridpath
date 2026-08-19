import { listProjects } from "@/lib/data/projects";
import { PortfolioPage } from "@/features/portfolio/portfolio-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const { projects, blockedByRls, error } = await listProjects();
  return (
    <PortfolioPage
      projects={projects}
      blockedByRls={blockedByRls}
      error={error}
    />
  );
}
