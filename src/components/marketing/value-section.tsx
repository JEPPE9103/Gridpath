import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { ArrowRight } from "lucide-react";

const SOURCES = [
  "Fragmented information",
  "Disconnected workflows",
  "Portfolio blind spots",
  "Team decisions",
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

      <Reveal delay={80}>
        <div className="mt-12 grid items-center gap-4 lg:grid-cols-[1fr_auto_auto_auto_1fr]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
            {SOURCES.map((label) => (
              <div
                key={label}
                className="rounded-md border border-line bg-surface px-3 py-4 text-center text-sm font-medium"
              >
                {label}
              </div>
            ))}
          </div>
          <ArrowRight className="mx-auto hidden text-muted lg:block" size={18} />
          <div className="rounded-md bg-ink px-6 py-5 text-center text-white">
            <p className="text-[11px] tracking-[0.16em]">NOXHEIM</p>
            <p className="mt-1 text-sm text-white/70">Grid Development Intelligence</p>
          </div>
          <ArrowRight className="mx-auto hidden text-muted lg:block" size={18} />
          <div className="rounded-md border border-teal/30 bg-teal-soft px-5 py-5 text-center">
            <p className="text-sm font-semibold text-teal">One development portfolio</p>
            <p className="mt-1 text-xs text-muted">Screen, manage and monitor</p>
          </div>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
