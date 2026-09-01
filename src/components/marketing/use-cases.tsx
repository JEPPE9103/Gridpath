"use client";

import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { useState } from "react";

const CASES = [
  {
    id: "bess",
    label: "BESS portfolio screening",
    title: "BESS portfolio screening",
    copy: "Bring official grid-development context into every prospective battery project and compare where the team should focus next.",
    outputs: ["10 active sites", "370 MW portfolio", "2 requiring attention"],
  },
  {
    id: "connection",
    label: "Grid connection management",
    title: "Grid connection management",
    copy: "Keep connection stages, requirements, references and project status together instead of across spreadsheets and inboxes.",
    outputs: ["Stockholm North BESS", "Grid Study", "4 / 8 required · 50% readiness"],
  },
  {
    id: "changes",
    label: "Portfolio change review",
    title: "Portfolio change review",
    copy: "When published network information changes, understand which development projects may be affected.",
    outputs: ["Source snapshot", "Geographic match", "2 portfolio projects affected"],
  },
];

export function UseCases() {
  const [active, setActive] = useState(CASES[0].id);
  const current = CASES.find((item) => item.id === active) ?? CASES[0];

  return (
    <MarketingSection id="use-cases" className="bg-surface">
      <Reveal>
        <Eyebrow>Use cases</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Built for BESS and renewable development teams.
        </h2>
      </Reveal>
      <Reveal delay={70}>
        <div className="mt-10 grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {CASES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
                  active === item.id
                    ? "bg-ink text-white"
                    : "border border-line bg-canvas text-muted hover:text-ink",
                )}
                aria-pressed={active === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="rounded-md border border-line bg-canvas px-5 py-6 sm:px-6 sm:py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
              {current.label}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">{current.title}</h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{current.copy}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {current.outputs.map((output) => (
                <li
                  key={output}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] font-medium"
                >
                  {output}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-muted">Sample</p>
          </div>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
