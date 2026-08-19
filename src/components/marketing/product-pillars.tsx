import { AppFrame } from "@/components/marketing/app-frame";
import { CtaLink } from "@/components/marketing/cta-link";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { ConfidenceBadge, OutlookBadge, SourceBadge, StageBadge } from "@/components/ui/badges";
import { formatCapacity } from "@/lib/format";
import { projectRepository } from "@/lib/repositories";
import { CONNECTION_STAGES } from "@/types";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

const projects = projectRepository.list();
const mapProjects = projects.filter((project) =>
  ["gavle-bess", "vasteras-storage", "falun-bess", "lulea-wind", "malmo-bess", "uppsala-wind-north"].includes(
    project.id,
  ),
);
const gavle = projects.find((project) => project.id === "gavle-bess")!;

function pos(lat: number, lng: number) {
  return {
    left: `${((lng - 11) / 13) * 100}%`,
    top: `${((69.2 - lat) / 14.5) * 100}%`,
  };
}

function markerColor(outlook: string) {
  if (outlook === "Favourable") return "#176C4A";
  if (outlook === "Possible") return "#B54708";
  return "#B42318";
}

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
            Find where development effort is worth spending.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Compare potential sites, grid outlook, constraints, confidence and project readiness
            before committing expensive engineering resources.
          </p>
          <div className="mt-6">
            <CtaLink href="/map" variant="secondary">
              Open Map & Compare
            </CtaLink>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <AppFrame url="app.noxheim.com/map">
            <div className="grid bg-canvas md:grid-cols-[1fr_240px]">
              <div className="relative h-[340px] overflow-hidden">
                <div className="marketing-grid absolute inset-0" />
                <svg viewBox="0 0 120 220" className="absolute inset-4 h-[calc(100%-32px)] w-auto opacity-80">
                  <path
                    d="M52 10C68 8 82 20 84 36C90 54 98 74 92 96C100 118 108 138 98 158C90 176 78 192 62 198C46 204 34 192 32 174C24 156 14 140 18 120C12 98 20 78 24 58C28 36 38 14 52 10Z"
                    fill="#e7f1ef"
                    stroke="#cfd8d5"
                    strokeWidth="1.2"
                  />
                </svg>
                {mapProjects.map((project) => (
                  <span
                    key={project.id}
                    className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                    style={{
                      ...pos(project.latitude, project.longitude),
                      background: markerColor(project.outlook),
                      boxShadow:
                        project.id === "gavle-bess" ? "0 0 0 4px rgba(42,122,111,0.28)" : undefined,
                    }}
                    title={project.name}
                  />
                ))}
              </div>
              <aside className="border-t border-line bg-surface p-4 md:border-t-0 md:border-l">
                <p className="text-sm font-semibold">{gavle.name}</p>
                <p className="text-xs text-muted">{gavle.location}</p>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <Row label="Capacity" value={formatCapacity(gavle)} />
                  <Row label="Operator" value="Vattenfall" />
                  <Row label="Outlook" value={<OutlookBadge outlook={gavle.outlook} />} />
                  <Row label="Confidence" value={<ConfidenceBadge confidence={gavle.confidence} />} />
                  <Row label="Stage" value={<StageBadge stage={gavle.stage} />} />
                </dl>
                <p className="mt-4 text-[11px] leading-4 text-muted">
                  NOXHEIM analysis for comparison — not a capacity guarantee.
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
          <AppFrame url="app.noxheim.com/projects/gavle-bess">
            <div className="bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Gävle BESS</p>
                  <p className="text-[11px] text-muted">Battery Storage · 20 / 20 MW · 130 kV</p>
                </div>
                <OutlookBadge outlook="At Risk" />
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
                    Missing
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>Signed grid study agreement</li>
                    <li>Study fee confirmation</li>
                  </ul>
                </div>
                <div className="rounded-md border border-line bg-surface p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Case VF-GS-2025-1842
                  </p>
                  <p className="mt-2 text-xs text-muted">Owner: Anna Hellström</p>
                  <p className="mt-1 text-xs text-muted">Next: study workshop · 30 Sep 2026</p>
                </div>
              </div>
            </div>
          </AppFrame>
        </Reveal>
        <Reveal delay={80}>
          <Eyebrow>Manage</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Run every connection process in one workspace.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Track enquiries, applications, studies, offers, documents, deadlines and
            responsibilities across different grid operators.
          </p>
          <div className="mt-6">
            <CtaLink href="/connections" variant="secondary">
              Open Connections
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
            Know when the grid changes around your projects.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            NOXHEIM tracks relevant external grid and operator changes and maps them to the
            projects that may be affected.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <AppFrame url="app.noxheim.com/changes">
            <div className="bg-canvas p-4 sm:p-5">
              <p className="text-[11px] uppercase tracking-wide text-muted">Capacity</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">
                Vattenfall capacity publication updated
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Public hosting-capacity map refreshed for Gävleborg and Dalarna. Gävle 130 kV
                headroom reduced; Falun 20 kV headroom increased. Figures are indicative.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-teal px-2.5 py-1 text-[11px] font-semibold text-white">
                  This change affects 2 projects
                </span>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[12px]">Gävle BESS</span>
                <span className="rounded-full bg-surface px-2.5 py-1 text-[12px]">Falun BESS</span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <SourceBadge source="Indicative" />
                <CtaLink href="/changes" variant="ghost" className="gap-1 px-0 py-0 text-teal hover:text-teal-dark">
                  Review affected projects <ArrowRight size={14} />
                </CtaLink>
              </div>
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
      <dd>{value}</dd>
    </div>
  );
}
