import { AppFrame } from "@/components/marketing/app-frame";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { StageBadge } from "@/components/ui/badges";
import { formatCapacity } from "@/lib/format";
import { projectRepository } from "@/lib/repositories";

const IDS = ["gavle-bess", "vasteras-storage", "uppsala-wind-north", "falun-bess"];
const projects = projectRepository.list().filter((project) => IDS.includes(project.id));

const ATTENTION = [
  {
    title: "Official local-network context identified",
    project: "Sample · Gävle BESS",
  },
  {
    title: "7 of 10 required items complete",
    project: "Sample · Uppsala Wind North",
  },
  {
    title: "Published network-development information changed",
    project: "Sample illustration",
  },
  {
    title: "1 portfolio project intersects the affected planning area",
    project: "Sample match",
  },
];

const NEXT: Record<string, string> = {
  "gavle-bess": "Study agreement",
  "vasteras-storage": "Completeness review",
  "uppsala-wind-north": "Requirements checklist",
  "falun-bess": "Enquiry response",
};

export function ProductProof() {
  return (
    <MarketingSection className="bg-surface" wide>
      <Reveal>
        <Eyebrow>Inside the workspace</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          One portfolio. Official context and connection work together.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Product preview — sample projects for illustration. Not live customer data or current
          official events.
        </p>
      </Reveal>
      <Reveal delay={70}>
        <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_280px]">
          <AppFrame path="/portfolio">
            <div className="overflow-x-auto bg-surface">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line bg-canvas text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-4 py-2 font-medium">Project operator</th>
                    <th className="px-4 py-2 font-medium">MW</th>
                    <th className="px-4 py-2 font-medium">Stage</th>
                    <th className="px-4 py-2 font-medium">Next action</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{project.name}</p>
                        <p className="text-[11px] text-muted">{project.location}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{project.gridOperator}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{formatCapacity(project)}</td>
                      <td className="px-4 py-3">
                        <StageBadge stage={project.stage} />
                      </td>
                      <td className="px-4 py-3 text-muted">{NEXT[project.id]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AppFrame>
          <aside className="rounded-md border border-line bg-canvas p-5">
            <p className="text-sm font-semibold">Example signals</p>
            <p className="mt-1 text-[11px] text-muted">Sample only</p>
            <ul className="mt-3 divide-y divide-line">
              {ATTENTION.map((item) => (
                <li key={item.title} className="py-3">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{item.project}</p>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
