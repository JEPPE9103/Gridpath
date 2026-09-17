"use client";

import { DeferredDiscoveryMap } from "@/components/marketing/deferred-discovery-map";
import type { DiscoveryWorkflowStage } from "@/components/marketing/discovery-map";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { useState } from "react";

const STEPS: {
  id: DiscoveryWorkflowStage;
  title: string;
  body: string;
}[] = [
  {
    id: "search",
    title: "Search",
    body: "Start with an existing site or search a wider area.",
  },
  {
    id: "candidates",
    title: "Understand",
    body: "Bring together relevant official evidence and constraints.",
  },
  {
    id: "evidence",
    title: "Identify unknowns",
    body: "Separate missing evidence from genuine clearance.",
  },
  {
    id: "next",
    title: "Decide what's next",
    body: "Compare options and prioritise the next investigation.",
  },
];

export function HowItWorksSection() {
  const [active, setActive] = useState<DiscoveryWorkflowStage>("search");

  return (
    <MarketingSection id="how-it-works" wide>
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
          From location to decision intelligence.
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-12">
        <Reveal>
          <ol className="flex flex-col gap-2">
            {STEPS.map((step, index) => {
              const selected = step.id === active;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => setActive(step.id)}
                    aria-pressed={selected}
                    className={cn(
                      "w-full rounded-lg border px-4 py-3.5 text-left transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
                      selected
                        ? "border-teal/35 bg-teal-soft/50"
                        : "border-line bg-surface hover:bg-canvas",
                    )}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-teal">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-semibold text-ink">{step.title}</span>
                    </div>
                    <p className="mt-1.5 pl-8 text-sm leading-6 text-muted">{step.body}</p>
                  </button>
                </li>
              );
            })}
          </ol>
        </Reveal>

        <Reveal delay={50} fade>
          <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[0_24px_48px_-30px_rgba(26,30,36,0.4)]">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="text-[11px] text-muted">
                <span className="font-semibold text-ink">Search Area</span> → Candidate Sites
              </p>
              <span className="text-[10px] uppercase tracking-wide text-muted">Sample</span>
            </div>
            <DeferredDiscoveryMap size="full" variant="discovery" workflowStage={active} />
          </div>
        </Reveal>
      </div>
    </MarketingSection>
  );
}
