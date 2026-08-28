import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const PROBLEMS = [
  {
    title: "Fragmented information",
    copy: "Official grid and planning information is spread across multiple sources.",
  },
  {
    title: "Disconnected workflows",
    copy: "Connection cases, requirements and project decisions are often tracked separately.",
  },
  {
    title: "Portfolio blind spots",
    copy: "A published change only becomes actionable when you know which projects it affects.",
  },
];

export function ValueSection() {
  return (
    <MarketingSection>
      <Reveal>
        <Eyebrow>The problem</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Grid data is fragmented. Your development portfolio shouldn&apos;t be.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
          Network information lives across operators, regulators and public datasets. Connection
          processes live in emails and spreadsheets. Requirements, project status and team decisions
          often live somewhere else.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-ink">
          Noxheim connects the information to the projects it affects.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {PROBLEMS.map((item, index) => (
          <Reveal key={item.title} delay={index * 60}>
            <article className="h-full rounded-md border border-line bg-surface px-5 py-6">
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}
