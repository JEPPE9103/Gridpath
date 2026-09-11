import { AppFrame } from "@/components/marketing/app-frame";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { StageBadge, StatusBadge } from "@/components/ui/badges";
import { OVERVIEW_PIPELINE_STAGES } from "@/lib/data/overview-types";
import { SAMPLE_SELECTED_PROJECT } from "@/lib/demo/sample-portfolio-preview";

export function ConnectMonitorSection() {
  return (
    <>
      <ConnectBlock />
      <MonitorBlock />
    </>
  );
}

function ConnectBlock() {
  const project = SAMPLE_SELECTED_PROJECT;
  const currentIndex = OVERVIEW_PIPELINE_STAGES.indexOf("Grid Study");
  const readiness = Math.round((project.readinessComplete / project.readinessRequired) * 100);

  return (
    <MarketingSection className="bg-surface">
      <div className="grid items-start gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
        <Reveal fade>
          <div className="relative lg:pb-8 lg:pt-6">
            <AppFrame path="/connections">
              <div className="bg-canvas p-4 md:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-semibold">{project.name}</p>
                    <p className="mt-1 text-[12px] text-muted">
                      Connection case on a Project · sample workspace
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StageBadge stage={project.stage} />
                    <StatusBadge status="On Track" />
                  </div>
                </div>
                <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                  {OVERVIEW_PIPELINE_STAGES.map((stage, index) => (
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
                    <Row label="Stage" value={project.stage} />
                    <Row label="Reference" value="ELV-2026-0418" />
                    <Row label="Status" value="On Track" />
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
              <p className="mt-2 text-[11px] text-muted">Workflow readiness.</p>
            </article>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <Eyebrow>Connect</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Track the connection process after the site becomes a Project.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Keep stages, requirements, deadlines, documents and next actions on the same Project
            record. Connection process tracking starts after an Opportunity is promoted.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            Workflow readiness measures recorded requirements on the connection case.
          </p>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function MonitorBlock() {
  return (
    <MarketingSection>
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <Reveal>
          <Eyebrow>Monitor</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Official sources change. Portfolio Attention brings them back to the team.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Noxheim stores official source snapshots, identifies published changes with a geographic
            match, and lists them on matched projects for review. Overview shows which active
            projects need action and the next recorded workflow step.
          </p>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            During the design-partner phase, official sources are refreshed by Noxheim operations. A
            delayed source update is not the same as “no changes”.
          </p>
        </Reveal>
        <Reveal delay={80} fade>
          <AppFrame path="/changes">
            <div className="bg-canvas p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-muted">Sample change review</p>
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
                <p className="hidden text-center text-muted md:block" aria-hidden>
                  →
                </p>
                <FlowCard
                  step="Change"
                  title="Published source update"
                  detail="Geographic match for team review"
                />
                <p className="hidden text-center text-muted md:block" aria-hidden>
                  →
                </p>
                <FlowCard
                  step="Matched project"
                  title="2 portfolio projects"
                  detail="Sample workspace"
                />
              </div>
              <p className="mt-4 text-[11px] leading-5 text-muted">
                Official Source match for team review.
              </p>
            </div>
          </AppFrame>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
