import { AppFrame } from "@/components/marketing/app-frame";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { formatCapacity } from "@/lib/format";
import { projectRepository } from "@/lib/repositories";
import Link from "next/link";

const IDS = ["gavle-bess", "vasteras-storage", "uppsala-wind-north", "falun-bess"];
const projects = projectRepository.list().filter((project) => IDS.includes(project.id));

const ATTENTION = [
  { title: "Grid data changed", project: "Gävle BESS", href: "/projects/gavle-bess?tab=grid" },
  {
    title: "Application incomplete",
    project: "Uppsala Wind North",
    href: "/projects/uppsala-wind-north?tab=connection",
  },
  {
    title: "DSO response due",
    project: "Sundsvall Solar",
    href: "/projects/sundsvall-solar?tab=connection",
  },
  {
    title: "Outlook improved",
    project: "Falun BESS",
    href: "/projects/falun-bess?tab=grid",
  },
];

const NEXT: Record<string, string> = {
  "gavle-bess": "Study agreement",
  "vasteras-storage": "Completeness review",
  "uppsala-wind-north": "Deadline 5 Sep",
  "falun-bess": "Enquiry response",
};

export function ProductProof() {
  return (
    <MarketingSection className="bg-surface" wide>
      <Reveal>
        <Eyebrow>Inside the workspace</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          One portfolio. Grid connections in one place.
        </h2>
      </Reveal>
      <Reveal delay={70}>
        <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_280px]">
          <AppFrame path="/portfolio">
            <div className="overflow-x-auto bg-surface">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line bg-canvas text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-4 py-2 font-medium">Grid operator</th>
                    <th className="px-4 py-2 font-medium">MW</th>
                    <th className="px-4 py-2 font-medium">Stage</th>
                    <th className="px-4 py-2 font-medium">Outlook</th>
                    <th className="px-4 py-2 font-medium">Confidence</th>
                    <th className="px-4 py-2 font-medium">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/projects/${project.id}`} className="font-medium hover:text-teal">
                          {project.name}
                        </Link>
                        <p className="text-[11px] text-muted">{project.location}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{project.gridOperator}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{formatCapacity(project)}</td>
                      <td className="px-4 py-3">
                        <StageBadge stage={project.stage} />
                      </td>
                      <td className="px-4 py-3">
                        <OutlookBadge outlook={project.outlook} />
                      </td>
                      <td className="px-4 py-3">
                        <ConfidenceBadge confidence={project.confidence} />
                      </td>
                      <td className="px-4 py-3 text-muted">{NEXT[project.id]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AppFrame>
          <aside className="rounded-md border border-line bg-canvas p-5">
            <p className="text-sm font-semibold">Needs attention</p>
            <ul className="mt-3 divide-y divide-line">
              {ATTENTION.map((item) => (
                <li key={item.title} className="py-3">
                  <Link href={item.href} className="block hover:text-teal">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.project}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
