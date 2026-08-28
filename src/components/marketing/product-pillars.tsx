import { AppFrame } from "@/components/marketing/app-frame";
import { MarketingMap } from "@/components/marketing/marketing-map";
import { Reveal } from "@/components/marketing/reveal";
import { CapabilityList, Eyebrow, MarketingSection } from "@/components/marketing/section";
import { StageBadge } from "@/components/ui/badges";
import { projectRepository } from "@/lib/repositories";
import { CONNECTION_STAGES } from "@/types";
import type { ReactNode } from "react";

const projects = projectRepository.list();
const mapProjects = projects.filter((project) =>
  ["gavle-bess", "vasteras-storage", "falun-bess", "lulea-wind", "malmo-bess", "uppsala-wind-north"].includes(
    project.id,
  ),
);
const mapSites = mapProjects.map((project) => ({
  id: project.id,
  name: project.name,
  latitude: project.latitude,
  longitude: project.longitude,
  outlook: project.outlook,
}));

export function ProductPillars() {
  return (
    <div id="product">
      <ScreenPillar />
      <ManagePillar />
      <MonitorPillar />
    </div>
  );
}

function ScreenPillar() {
  return (
    <MarketingSection>
      <div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal>
          <Eyebrow>Screen</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Screen projects with context, not guesses.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Add a project location and bring relevant official grid context directly into the
            development record. Understand network geography, published network-development
            information and your own project status before deciding where to focus further
            diligence.
          </p>
          <CapabilityList
            items={[
              {
                title: "Official network context",
                copy: "Identify the official local-network geography relevant to the project location.",
              },
              {
                title: "Network development plans",
                copy: "Bring published planning information and forecast need for transfer capacity into the project context.",
              },
              {
                title: "Portfolio triage",
                copy: "Compare projects using your team's development outlook, workflow readiness and connection progress.",
              },
            ]}
          />
          <p className="mt-6 max-w-md text-sm leading-6 text-muted">
            Noxheim does not represent available grid capacity or guarantee connection feasibility.
          </p>
        </Reveal>
        <Reveal delay={80} fade>
          <AppFrame path="/map">
            <div className="grid bg-canvas md:grid-cols-[1fr_220px]">
              <MarketingMap selectedId="gavle-bess" sites={mapSites} />
              <aside className="border-t border-line bg-surface p-4 md:border-t-0 md:border-l">
                <p className="text-sm font-semibold">Sample BESS</p>
                <p className="text-xs text-muted">Portfolio interface · not a capacity map</p>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <Row label="Official local network" value="Identified" />
                  <Row label="Network development plan" value="Matched" />
                  <Row label="Forecast need" value="Published" />
                  <Row label="Team outlook" value="Customer-entered" />
                </dl>
              </aside>
            </div>
          </AppFrame>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function ManagePillar() {
  const currentIndex = CONNECTION_STAGES.indexOf("Grid Study");
  return (
    <MarketingSection className="bg-surface">
      <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <Reveal>
          <AppFrame path="/projects/sample-bess">
            <div className="bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Sample BESS</p>
                  <p className="text-[11px] text-muted">Connection workflow · sample workspace</p>
                </div>
                <StageBadge stage="Grid Study" />
              </div>
              <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                {CONNECTION_STAGES.map((stage, index) => (
                  <div
                    key={stage}
                    className={
                      index < currentIndex
                        ? "min-w-[88px] rounded-md border border-success bg-success-bg px-2 py-1.5 text-[10px] text-success"
                        : index === currentIndex
                          ? "min-w-[88px] rounded-md border border-teal bg-teal-soft px-2 py-1.5 text-[10px] text-teal"
                          : "min-w-[88px] rounded-md border border-line bg-surface px-2 py-1.5 text-[10px] text-muted"
                    }
                  >
                    {stage}
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-line bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Requirements
                  </p>
                  <p className="mt-2 text-sm font-semibold">7 of 10 required items complete</p>
                  <p className="mt-1 text-[11px] text-muted">Workflow readiness — not feasibility.</p>
                </div>
                <div className="rounded-md border border-line bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Connection case
                  </p>
                  <p className="mt-2 text-xs text-muted">Customer-entered operator case</p>
                  <p className="mt-1 text-xs text-muted">Next: study workshop</p>
                </div>
              </div>
            </div>
          </AppFrame>
        </Reveal>
        <Reveal delay={80}>
          <Eyebrow>Manage</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Run the development workflow in one place.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Move beyond spreadsheets and disconnected project trackers. Keep each project&apos;s
            grid-connection process, requirements and development status beside the intelligence
            that matters to it.
          </p>
          <CapabilityList
            items={[
              {
                title: "Portfolio",
                copy: "Track projects, MW, technology, target COD and development stage across your portfolio.",
              },
              {
                title: "Grid connection workflow",
                copy: "Manage connection cases, operators, references, status and key project milestones.",
              },
              {
                title: "Requirements & readiness",
                copy: "Track required development actions and see workflow completeness across each project.",
              },
              {
                title: "Project record",
                copy: "Keep project context, document metadata and activity together in one development workspace.",
              },
            ]}
          />
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function MonitorPillar() {
  return (
    <MarketingSection>
      <div className="grid items-start gap-10 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal>
          <Eyebrow>Monitor</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Know when published information changes around your projects.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Noxheim stores official source snapshots over time, identifies relevant changes and
            connects them to the projects they may affect.
          </p>
          <CapabilityList
            items={[
              {
                title: "Source history",
                copy: "Maintain traceable snapshots of published grid and planning information.",
              },
              {
                title: "Change detection",
                copy: "Compare new source versions against the previous baseline.",
              },
              {
                title: "Portfolio impact",
                copy: "See which projects intersect the geography affected by a published change.",
              },
            ]}
          />
          <p className="mt-6 max-w-md text-sm leading-6 text-muted">
            During the design-partner phase, official sources are refreshed by Noxheim operations.
            Source retrieval dates are shown in the product.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <AppFrame path="/changes">
            <div className="bg-canvas p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Sample change</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                Published network-development information changed
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Forecast need for transfer capacity updated for a planning area. This is published
                need — not available connection capacity.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold text-white">
                  1 project intersects the affected planning area
                </span>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[12px]">Sample BESS</span>
              </div>
              <p className="mt-5 text-[11px] leading-4 text-muted">
                Sample illustration. Not a live official event.
              </p>
            </div>
          </AppFrame>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
