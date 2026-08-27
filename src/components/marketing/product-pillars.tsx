import { AppFrame } from "@/components/marketing/app-frame";
import { CtaLink } from "@/components/marketing/cta-link";
import { MarketingMap } from "@/components/marketing/marketing-map";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
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
    <MarketingSection className="bg-surface">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <Eyebrow>Screen</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Understand and compare development projects.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Match a project coordinate to official Ei local-network concessions and network
            development-plan areas. Forecast MW is published need for transfer capacity — not
            available connection capacity.
          </p>
          <p className="mt-4 text-sm text-muted">
            Sample workspace below — illustrative only, not live customer or official events.
          </p>
        </Reveal>
        <Reveal delay={80} fade>
          <AppFrame path="/map">
            <div className="grid bg-canvas md:grid-cols-[1fr_240px]">
              <MarketingMap selectedId="gavle-bess" sites={mapSites} />
              <aside className="border-t border-line bg-surface p-4 md:border-t-0 md:border-l">
                <p className="text-sm font-semibold">Gävle BESS</p>
                <p className="text-xs text-muted">Sample project · Gävle</p>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <Row label="Official local network" value="Identified" />
                  <Row label="Network development plan" value="Matched" />
                  <Row label="Forecast need 2028" value="Published" />
                  <Row label="Team outlook" value="Customer-entered" />
                </dl>
                <p className="mt-4 text-[11px] leading-4 text-muted">
                  Official source · Energimarknadsinspektionen. Not a capacity guarantee.
                </p>
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
    <MarketingSection>
      <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal>
          <AppFrame path="/projects/sample-bess">
            <div className="bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Sample BESS</p>
                  <p className="text-[11px] text-muted">
                    Battery Storage · Connection process · customer-entered
                  </p>
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
                  <p className="mt-1 text-[11px] text-muted">
                    Workflow readiness — not a feasibility assessment.
                  </p>
                </div>
                <div className="rounded-md border border-line bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Connection case
                  </p>
                  <p className="mt-2 text-xs text-muted">Customer-entered case reference</p>
                  <p className="mt-1 text-xs text-muted">Next: study workshop</p>
                </div>
              </div>
            </div>
          </AppFrame>
        </Reveal>
        <Reveal delay={80}>
          <Eyebrow>Manage</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Track grid-connection process and project readiness.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Keep enquiries, studies, offers, deadlines and required checklist items next to the
            official grid record — without treating readiness as connection viability.
          </p>
          <div className="mt-6">
            <CtaLink href="/signup" variant="secondary">
              Get started
            </CtaLink>
          </div>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function MonitorPillar() {
  return (
    <MarketingSection className="bg-surface">
      <div className="grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal>
          <Eyebrow>Monitor</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Review relevant changes in published grid and planning information.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            When an official dataset is refreshed, NOXHEIM can show added, removed and changed
            records and which portfolio projects intersect the affected area. Pilot refresh is
            supervised — not continuous live monitoring.
          </p>
          <div className="mt-6">
            <CtaLink href="/#demo" variant="secondary">
              Book a demo
            </CtaLink>
          </div>
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
                need — not available connection capacity or headroom.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold text-white">
                  1 portfolio project intersects the affected planning area
                </span>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[12px]">Sample BESS</span>
              </div>
              <p className="mt-5 text-[11px] leading-4 text-muted">
                Sample illustration only. Not a live official event or customer alert.
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
