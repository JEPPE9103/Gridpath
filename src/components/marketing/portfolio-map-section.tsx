import { AppFrame } from "@/components/marketing/app-frame";
import { DeferredMarketingMap } from "@/components/marketing/deferred-marketing-map";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { StageBadge } from "@/components/ui/badges";
import {
  SAMPLE_PORTFOLIO_METRICS,
  SAMPLE_PORTFOLIO_PREVIEW_SITES,
  SAMPLE_SELECTED_PROJECT,
} from "@/lib/demo/sample-portfolio-preview";

export function PortfolioMapSection() {
  const project = SAMPLE_SELECTED_PROJECT;
  const readiness = Math.round(
    (project.readinessComplete / project.readinessRequired) * 100,
  );

  return (
    <MarketingSection wide>
      <Reveal>
        <Eyebrow>Portfolio</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Your development portfolio, geographically.
        </h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted">
          See where your sites sit — not a map of available grid capacity.
        </p>
      </Reveal>

      <Reveal delay={70} fade>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Active sites" value={String(SAMPLE_PORTFOLIO_METRICS.sites)} />
          <MetricCard label="Portfolio" value={`${SAMPLE_PORTFOLIO_METRICS.megawatts} MW`} />
          <MetricCard
            label="Requiring attention"
            value={String(SAMPLE_PORTFOLIO_METRICS.requiringAttention)}
          />
        </div>
      </Reveal>

      <Reveal delay={100} fade>
        <div className="mt-6">
          <AppFrame path="/map">
            <div className="relative bg-canvas">
              <DeferredMarketingMap
                selectedId={project.id}
                sites={SAMPLE_PORTFOLIO_PREVIEW_SITES}
                size="full"
              />
              <article className="border-t border-line bg-surface p-4 sm:absolute sm:bottom-4 sm:left-4 sm:w-[280px] sm:rounded-md sm:border sm:shadow-[0_16px_32px_-24px_rgba(26,30,36,0.55)]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{project.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {project.mw} · sample workspace
                    </p>
                  </div>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    Sample
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StageBadge stage={project.stage} />
                  <span className="text-[11px] text-muted">{readiness}% readiness</span>
                </div>
              </article>
            </div>
          </AppFrame>
        </div>
      </Reveal>
    </MarketingSection>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-md border border-line bg-surface px-4 py-4">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
    </article>
  );
}
