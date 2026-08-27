import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SourceBadge } from "@/components/ui/badges";

const KINDS = [
  {
    source: "Official" as const,
    copy: "Ei local-network concessions, Ei network development plans, operator letters, offers and formal study reports.",
  },
  {
    source: "Indicative" as const,
    copy: "Public planning signals that are useful for screening. Not binding, and not treated as available MW.",
  },
  {
    source: "Customer Data" as const,
    copy: "Internal files, land control, load profiles and the operator name stored on the project.",
  },
  {
    source: "NOXHEIM Analysis" as const,
    copy: "Workspace judgements for comparison — never a capacity guarantee or derived connection outlook.",
  },
];

export function DataTrustSection() {
  return (
    <MarketingSection id="trust" dark>
      <Reveal>
        <Eyebrow>
          <span className="text-[#9ad1c8]">Data philosophy</span>
        </Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.15]">
          Grid intelligence you can interrogate, not blindly trust.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
          NOXHEIM does not guarantee grid capacity. Official datapoints are intended to show source,
          publication date, last retrieved time and confidence. Forecast figures from Ei NUP are
          published need for transfer capacity — not headroom.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {KINDS.map((item, index) => (
          <Reveal key={item.source} delay={index * 50}>
            <article className="rounded-md border border-white/10 bg-white/5 px-5 py-5">
              <SourceBadge source={item.source} />
              <p className="mt-3 text-sm leading-6 text-white/75">{item.copy}</p>
              <p className="mt-4 font-mono text-[11px] text-white/40">
                source · publication date · last retrieved · confidence
              </p>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-10 text-sm text-white/55">
        Indicative grid intelligence only. Formal grid operator assessment is always required.
      </p>
    </MarketingSection>
  );
}
