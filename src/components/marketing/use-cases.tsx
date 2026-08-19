"use client";

import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { useState } from "react";

const CASES = [
  {
    id: "bess",
    label: "Battery Storage",
    title: "Keep a fast-moving BESS pipeline comparable.",
    copy: "Screen import/export requirements, manage multiple connection enquiries and monitor project readiness across a development portfolio that changes week to week.",
  },
  {
    id: "renewables",
    label: "Renewables",
    title: "Place solar and wind against the right voltage hypothesis.",
    copy: "Track long-lead applications, permit dependencies and operator studies for generation sites that often sit on congested 130–220 kV corridors.",
  },
  {
    id: "ev",
    label: "EV Infrastructure",
    title: "Treat charging capacity as a connection programme.",
    copy: "Follow load-driven import cases, urban reinforcement constraints and study timelines across hubs that cannot wait on informal spreadsheet tracking.",
  },
  {
    id: "industrial",
    label: "Industrial Electrification",
    title: "Connect demand projects without losing the paper trail.",
    copy: "Hold contracted milestones, design interfaces and operator correspondence in one record as load steps up through study, offer and agreement.",
  },
  {
    id: "consultants",
    label: "Grid & Engineering Consultants",
    title: "Give clients a shared picture of grid process risk.",
    copy: "Separate indicative public signals from official operator documents, and show which changes actually touch the sites you are advising on.",
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
          Built for grid-connected development.
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
                  "shrink-0 rounded-md px-3 py-2.5 text-left text-sm",
                  active === item.id
                    ? "bg-ink text-white"
                    : "border border-line bg-canvas text-muted hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="rounded-md border border-line bg-canvas px-6 py-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
              {current.label}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">{current.title}</h3>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{current.copy}</p>
          </div>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
