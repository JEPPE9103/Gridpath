"use client";

import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { useState } from "react";

const CASES = [
  {
    id: "discovery",
    label: "Geographic opportunity discovery",
    title: "Find Candidate Sites in a Search Area",
    copy: "Select a geography, derive Opportunity Zones from qualifying land, and identify Candidate Sites worth investigating — before a project record exists.",
    outputs: ["Search Area", "Opportunity Zones", "Candidate Sites"],
  },
  {
    id: "screening",
    label: "Candidate Site screening",
    title: "Screen and compare on the same evidence",
    copy: "See evaluated versus missing evidence, compare Candidate Sites, then save one as an Opportunity.",
    outputs: ["Evidence Coverage", "Compare", "Save as opportunity"],
  },
  {
    id: "lifecycle",
    label: "Opportunity to Project",
    title: "Carry the site into development",
    copy: "Promote a kept Opportunity to a Project so origin, evidence and covering geography follow the decision.",
    outputs: ["Opportunity", "Promote to project", "Project"],
  },
  {
    id: "connect",
    label: "Connection and monitoring",
    title: "Track connection work and official-source change",
    copy: "After promotion, keep connection stages, requirements and documents on the Project, and review official-source changes with a geographic match.",
    outputs: ["Connection process tracking", "Portfolio Attention", "Official Source"],
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
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          For Swedish BESS, solar, wind and hybrid development teams — and consultants working those
          same projects.
        </p>
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
          </div>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
