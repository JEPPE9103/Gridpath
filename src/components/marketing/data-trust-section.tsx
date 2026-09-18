import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const PRINCIPLES = [
  {
    title: "Official evidence",
    body: "Connected to its underlying source — not an anonymous score.",
  },
  {
    title: "Unknown ≠ pass",
    body: "Missing information is surfaced rather than treated as clearance.",
  },
  {
    title: "Decision trace",
    body: "Preserve why a site progressed — or did not.",
  },
] as const;

/**
 * Trust — concise credibility, not a documentation dump.
 */
export function DataTrustSection() {
  return (
    <MarketingSection id="trust" dark>
      <Reveal>
        <Eyebrow>
          <span className="text-[#9ad1c8]">Trust</span>
        </Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.15]">
          Evidence you can trace.
          <br />
          Uncertainty you can see.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
          Screening supports early assessment — not engineering feasibility, available capacity, or
          a connection offer.
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">
          Official evidence from Swedish and European public sources including SGU, Trafikverket,
          Länsstyrelserna / EBH, Energimarknadsinspektionen, MSB / Myndigheten för civilt försvar,
          Naturvårdsverket (NMD) and Copernicus.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {PRINCIPLES.map((item, index) => (
          <Reveal key={item.title} delay={index * 40}>
            <article className="h-full rounded-md border border-white/10 bg-white/5 px-5 py-5">
              <h3 className="text-base font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/75">{item.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}
