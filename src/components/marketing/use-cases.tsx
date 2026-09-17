"use client";

import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { useState } from "react";

const CASES = [
  {
    id: "discovery",
    label: "BESS site discovery",
    title: "Find Candidate Sites in a Search Area",
    copy: "Select a geography, derive Opportunity Zones from qualifying land, and identify Candidate Sites worth investigating — before a project record exists.",
    outputs: ["Search Area", "Opportunity Zones", "Candidate Sites"],
  },
  {
    id: "intelligence",
    label: "Candidate Intelligence",
    title: "See why, constraints, unknowns and next steps",
    copy: "Each Candidate Site carries why it ranks, the top constraint, the top unknown, and a recommended next investigation — so silence never looks like a pass.",
    outputs: ["Why this site", "Top constraint", "Top unknown", "Recommended next"],
  },
  {
    id: "screening",
    label: "Compare & decide",
    title: "Compare on the same evidence, then freeze",
    copy: "See evaluated versus missing evidence, compare Candidate Sites, save one as an Opportunity, and keep the decision trail.",
    outputs: ["Evidence Coverage", "Compare", "Save as opportunity"],
  },
  {
    id: "lifecycle",
    label: "Opportunity to Project",
    title: "Carry the site into development",
    copy: "Promote a kept Opportunity to a Project so origin, evidence and covering geography follow the decision.",
    outputs: ["Opportunity", "Promote to project", "Project"],
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
          Built for teams that screen BESS sites for a living.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Developers, advisors and internal screening teams use the same Development Intelligence
          loop — discover, decide, freeze — without turning the product into a generic GIS catalogue.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ul className="flex flex-col gap-2">
          {CASES.map((item) => {
            const selected = item.id === current.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "w-full rounded-md border px-4 py-3 text-left transition",
                    selected
                      ? "border-teal/40 bg-canvas"
                      : "border-line bg-canvas/60 hover:border-ink/20",
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{item.title}</p>
                </button>
              </li>
            );
          })}
        </ul>

        <Reveal key={current.id}>
          <article className="h-full rounded-lg border border-line bg-canvas px-5 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-teal">
              {current.label}
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">{current.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{current.copy}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {current.outputs.map((output) => (
                <li
                  key={output}
                  className="rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] font-medium"
                >
                  {output}
                </li>
              ))}
            </ul>
          </article>
        </Reveal>
      </div>
    </MarketingSection>
  );
}
