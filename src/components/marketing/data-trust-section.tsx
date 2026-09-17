import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const KINDS = [
  {
    title: "Official Source",
    copy: "Published information from authorities — Naturvårdsverket, Ei covering geography, Trafikverket RoadLink, MSB flood, SGU ground, Länsstyrelserna EBH, and more.",
    label: "Official Source",
  },
  {
    title: "Customer Entered",
    copy: "Search intent, project data, outlook and workflow status entered by your organisation.",
    label: "Customer Entered",
  },
  {
    title: "Noxheim Derived",
    copy: "Geographic matching, Candidate Site generation, ranking and Candidate Intelligence. Ranking is not an official verdict.",
    label: "Noxheim Derived",
  },
];

export function DataTrustSection() {
  return (
    <MarketingSection id="trust" dark>
      <Reveal>
        <Eyebrow>
          <span className="text-[#9ad1c8]">Trust</span>
        </Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.15]">
          Public Swedish sources. Explicit about what is missing.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
          Noxheim separates Official Source information, Customer Entered data and Noxheim Derived
          context — on the site, not only after a project exists. Coverage varies by place, and the
          product says so.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-3 sm:grid-cols-3">
        {KINDS.map((item, index) => (
          <Reveal key={item.title} delay={index * 50}>
            <article className="h-full rounded-md border border-white/10 bg-white/5 px-5 py-5">
              <span className="inline-flex items-center rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/80">
                {item.label}
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/75">{item.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-10 text-sm text-white/55">
        Absence of an EBH object or soil polygon is not clearance. Unknown stays unknown until
        evidence improves.
      </p>
    </MarketingSection>
  );
}
