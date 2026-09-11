import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const FENCES = [
  "Screening ≠ engineering feasibility",
  "Ranking ≠ official verdict",
  "Network covering ≠ available capacity",
];

export function DecisionSupportSection() {
  return (
    <MarketingSection>
      <Reveal>
        <Eyebrow>Trust</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Decision support, not a grid connection guarantee.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
          Noxheim helps teams find sites worth investigating, see missing evidence, and keep that
          context through connection process tracking and official-source review.
        </p>
        <ul className="mt-6 max-w-xl space-y-2 text-sm leading-6 text-ink">
          {FENCES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Reveal>
    </MarketingSection>
  );
}
