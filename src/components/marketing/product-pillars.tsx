import { AppFrame } from "@/components/marketing/app-frame";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SourceBadge, StageBadge, StatusBadge } from "@/components/ui/badges";
import { SAMPLE_SELECTED_PROJECT } from "@/lib/demo/sample-portfolio-preview";
import { CONNECTION_STAGES } from "@/types";

export function ProductPillars() {
  return (
    <>
      <ScreenPillar />
      <ManagePillar />
    </>
  );
}

export function MonitorPillar() {
  return (
    <MarketingSection className="bg-surface">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <Eyebrow>Monitor</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Know when published information changes around your projects.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Noxheim stores official source snapshots, identifies relevant published changes and
            connects them to the projects they may affect.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            During the design-partner phase, official sources are refreshed by Noxheim operations.
            Source retrieval dates are shown in the product.
          </p>
        </Reveal>
        <Reveal delay={80} fade>
          <AppFrame path="/changes">
            <div className="bg-canvas p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  Sample change review
                </p>
                <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                  Sample
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                <FlowCard
                  step="Source snapshot"
                  title="Official network development plan"
                  detail="Retrieved 12 Aug 2026 · Ei"
                />
                <FlowArrow />
                <FlowCard
                  step="Change"
                  title="Published source update"
                  detail="Geographic match identified"
                />
                <FlowArrow />
                <FlowCard
                  step="Affected project"
                  title="2 portfolio projects"
                  detail="Sample workspace — not a live official event"
                />
              </div>
            </div>
          </AppFrame>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function ScreenPillar() {
  const project = SAMPLE_SELECTED_PROJECT;

  return (
    <MarketingSection className="bg-surface">
      <div className="grid items-start gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
        <Reveal>
          <Eyebrow>Screen</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Screen projects with context, not guesses.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Add a project location and bring relevant official grid context into the development
            record — before deciding where to spend further diligence.
          </p>
          <dl className="mt-6 max-w-sm space-y-2 text-sm">
            <OutputRow label="Official local-network" value={project.localNetwork} />
            <OutputRow label="Source" value={project.source} />
            <OutputRow label="NUP context" value={project.nup} />
            <OutputRow label="Last retrieved" value={project.retrieved} />
          </dl>
          <p className="mt-5 max-w-md text-[12px] leading-5 text-muted">
            Noxheim does not represent available grid capacity or guarantee connection feasibility.
          </p>
        </Reveal>
        <Reveal delay={80} fade>
          <AppFrame path="/projects/sample-bess">
            <div className="bg-canvas p-4 md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-base font-semibold">{project.name}</p>
                  <p className="mt-1 text-[12px] text-muted">
                    {project.location} · {project.technology} · {project.mw}
                  </p>
                </div>
                <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                  Sample
                </span>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <section className="rounded-md border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Official local network context</h3>
                    <SourceBadge source="Official" />
                  </div>
                  <dl className="mt-3 space-y-2 text-[12px]">
                    <GiRow label="Official local network company" value={project.localNetwork} />
                    <GiRow label="Match" value="Identified" />
                    <GiRow label="Source" value={`Official source · ${project.source}`} />
                  </dl>
                </section>
                <section className="rounded-md border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">Official network development plan</h3>
                    <SourceBadge source="Official" />
                  </div>
                  <dl className="mt-3 space-y-2 text-[12px]">
                    <GiRow label="NUP context" value={project.nup} />
                    <GiRow label="Publisher" value="Energimarknadsinspektionen" />
                    <GiRow label="Retrieved by NOXHEIM" value={project.retrieved} />
                  </dl>
                </section>
              </div>
              <p className="mt-3 text-[11px] leading-4 text-muted">
                Sample illustration. Forecast need for transfer capacity is published need — not
                available MW or connection capacity.
              </p>
            </div>
          </AppFrame>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function ManagePillar() {
  const project = SAMPLE_SELECTED_PROJECT;
  const currentIndex = CONNECTION_STAGES.indexOf("Grid Study");
  const readiness = Math.round(
    (project.readinessComplete / project.readinessRequired) * 100,
  );

  return (
    <MarketingSection>
      <div className="grid items-start gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
        <Reveal fade>
          <div className="relative lg:pb-8 lg:pt-6">
            <AppFrame path="/projects/sample-bess">
              <div className="bg-canvas p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{project.name}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      Connection case · sample workspace
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StageBadge stage={project.stage} />
                    <StatusBadge status="In Progress" />
                  </div>
                </div>
                <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                  {CONNECTION_STAGES.map((stage, index) => (
                    <div
                      key={stage}
                      className={
                        index < currentIndex
                          ? "min-w-[84px] rounded-md border border-success bg-success-bg px-2 py-1.5 text-[10px] text-success"
                          : index === currentIndex
                            ? "min-w-[84px] rounded-md border border-teal bg-teal-soft px-2 py-1.5 text-[10px] text-teal"
                            : "min-w-[84px] rounded-md border border-line bg-surface px-2 py-1.5 text-[10px] text-muted"
                      }
                    >
                      {stage}
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-md border border-line bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Connection case
                  </p>
                  <dl className="mt-2 space-y-1.5 text-[12px]">
                    <GiRow label="Stage" value={project.stage} />
                    <GiRow label="Reference" value="ELV-2026-0418" />
                    <GiRow label="Status" value="In progress" />
                  </dl>
                </div>
              </div>
            </AppFrame>
            <article className="mt-3 rounded-md border border-line bg-surface p-4 shadow-[0_16px_32px_-24px_rgba(26,30,36,0.5)] lg:absolute lg:-right-3 lg:-bottom-2 lg:mt-0 lg:w-[260px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Application readiness
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{readiness}%</p>
              <p className="mt-1 text-[12px] text-muted">
                {project.readinessComplete} / {project.readinessRequired} required actions complete
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div className="h-full bg-teal" style={{ width: `${readiness}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-muted">Workflow readiness — not feasibility.</p>
            </article>
            <article className="mt-3 hidden rounded-md border border-line bg-surface px-3 py-2.5 shadow-[0_12px_24px_-20px_rgba(26,30,36,0.45)] lg:absolute lg:-top-1 lg:-left-3 lg:block">
              <p className="text-[10px] uppercase tracking-wide text-muted">Project status</p>
              <p className="mt-0.5 text-[12px] font-medium">Grid Study · {project.mw}</p>
            </article>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <Eyebrow>Manage</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Run the development workflow in one place.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Keep each project&apos;s connection process, requirements and development status beside
            the intelligence that matters to it.
          </p>
          <dl className="mt-6 max-w-sm space-y-2 text-sm">
            <OutputRow label="Selected project" value={project.name} />
            <OutputRow label="Current stage" value={project.stage} />
            <OutputRow
              label="Readiness"
              value={`${project.readinessComplete} / ${project.readinessRequired} · ${readiness}%`}
            />
          </dl>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function FlowCard({
  step,
  title,
  detail,
}: {
  step: string;
  title: string;
  detail: string;
}) {
  return (
    <article className="rounded-md border border-line bg-surface px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">{step}</p>
      <p className="mt-2 text-sm font-semibold leading-5">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted">{detail}</p>
    </article>
  );
}

function FlowArrow() {
  return (
    <p className="hidden text-center text-muted md:block" aria-hidden>
      →
    </p>
  );
}

function OutputRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function GiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
