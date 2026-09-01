import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SourceBadge } from "@/components/ui/badges";
import type { DataSourceKind } from "@/types";

const KINDS: Array<{
  title: string;
  copy: string;
  source: DataSourceKind;
}> = [
  {
    title: "Official source",
    copy: "Published information from authorities and network-related sources.",
    source: "Official",
  },
  {
    title: "Your team",
    copy: "Project data, development outlook and workflow status entered by your organisation.",
    source: "Customer Data",
  },
  {
    title: "Noxheim derived",
    copy: "Geographic matching, portfolio impact and workflow calculations created from the underlying data.",
    source: "NOXHEIM Analysis",
  },
];

export function DataTrustSection() {
  return (
    <MarketingSection id="trust" dark>
      <Reveal>
        <Eyebrow>
          <span className="text-[#9ad1c8]">Provenance</span>
        </Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.15]">
          Know where the intelligence comes from.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
          Noxheim separates official source information, customer-entered project data and
          Noxheim-derived context.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {KINDS.map((item, index) => (
          <Reveal key={item.title} delay={index * 50}>
            <article className="h-full rounded-md border border-white/10 bg-white/5 px-5 py-5">
              <SourceBadge source={item.source} />
              <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/75">{item.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-10 text-sm text-white/55">
        Source provenance and retrieval dates are shown directly in Grid Intelligence.
      </p>
    </MarketingSection>
  );
}
